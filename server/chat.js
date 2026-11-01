// Saath assistant: POST /api/chat
//
//  1. If the user is in the middle of a booking (a `pending` step), that is handled first.
//  2. Clear requests (book, start a group, show / remove bookings, pay, open a page) run through the agent.
//  3. Everything else goes to Claude (with tools) when ANTHROPIC_API_KEY is set, otherwise to the built-in
//     knowledge base. Either way it answers in English, Hindi (Devanagari) or Hinglish.
//
// Mount it with one line in index.js:  registerChat(app, { db });
import { detectLang, match, detectService, TOPICS, GENERAL, tokenize } from './chat/knowledge.js';
import { FEATURES, SITE_GUIDE, PAGES } from './chat/features.js';
import * as agent from './chat/agent.js';
import { todayIST } from './dates.js';

const { L } = agent;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const API_URL = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.CHAT_MODEL || 'claude-haiku-5-5';
// Gemma 4 (open-weights) through the Gemini API. Takes priority when GEMINI_API_KEY is set.
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMMA_MODEL = process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';   // or gemma-4-31b-it
const GEMINI_BASE = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta';
const PROVIDER = (process.env.CHAT_PROVIDER || '').toLowerCase() || (GEMINI_KEY ? 'gemma' : API_KEY ? 'claude' : 'builtin');
const SUPPORT = process.env.SUPPORT_EMAIL || 'support@saath.in';
const MAX_MESSAGES = 12;
const MAX_CHARS = 600;
const PENDING_KINDS = new Set(['join', 'create', 'leave', 'choose_service']);

const hits = new Map();
function allowed(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  if (arr.length >= 80) return false;
  arr.push(now); hits.set(ip, arr);
  return true;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.every((t) => now - t > 3_600_000)) hits.delete(k); }, 600_000).unref();

const stripMarkdown = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '').replace(/`/g, '').trim();

// ---- talking to the site's own API with the visitor's login -------------------------------------
function makeCall(req) {
  const base = `http://127.0.0.1:${req.socket.localPort}/api`;
  const authz = req.headers.authorization;
  return async (method, path, body) => {
    try {
      const r = await fetch(base + path, {
        method, signal: AbortSignal.timeout(8000),
        headers: { 'content-type': 'application/json', ...(authz ? { authorization: authz } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, data };
    } catch (e) { return { ok: false, status: 0, data: { error: 'The server did not respond.' } }; }
  };
}
let metaCache = { at: 0, slots: [], today: null };
async function slotsFor(call) {
  if (Date.now() - metaCache.at < 5 * 60_000 && metaCache.slots.length) return metaCache;
  const r = await call('GET', '/meta');
  if (r.ok) metaCache = { at: Date.now(), slots: r.data.time_slots || [], today: r.data.today };
  return metaCache;
}

// ---- built-in answers ------------------------------------------------------------------------------
const norm = (s) => String(s || '').toLowerCase().normalize('NFC');
function matchFeature(text) {
  const raw = norm(text); const toks = tokenize(text);
  let best = null;
  for (const f of FEATURES) {
    const n = f.words.filter((w) => (w.includes(' ') ? raw.includes(w) : toks.some((t) => t === w || (w.length > 4 && t.startsWith(w))))).length;
    if (n && (!best || n > best.n)) best = { f, n };
  }
  return best || null;
}
const bookChip = (svc, lang) => ({ label: L(lang, `✅ Book ${svc.name}`, `✅ ${svc.name} बुक करो`, `✅ ${svc.name} book karo`), send: L(lang, `Book ${svc.name} for me`, `${svc.name} बुक करो`, `${svc.name} book karo`) });
const helpChips = (lang) => [
  { label: L(lang, 'Book AC repair', 'AC repair बुक करो', 'AC repair book karo'), send: L(lang, 'Book AC repair', 'AC repair बुक करो', 'AC repair book karo') },
  { label: L(lang, 'My bookings', 'मेरी बुकिंग', 'Meri bookings'), send: L(lang, 'Show my bookings', 'मेरी बुकिंग दिखाओ', 'Meri bookings dikhao') },
  { label: L(lang, 'What can you do?', 'आप क्या कर सकते हो?', 'Aap kya kar sakte ho?'), send: L(lang, 'What can you do?', 'आप क्या कर सकते हो?', 'Aap kya kar sakte ho?') },
];

function builtIn(services, users, lang) {
  const last = users[users.length - 1] || ''; const prev = users[users.length - 2] || '';
  let m = match(last);
  let slug = detectService(last);
  if (m.kind === 'fallback' && prev) { m = match(`${prev} ${last}`); slug = slug || detectService(prev); }
  if ((m.kind === 'price' || m.kind === 'book') && !slug) slug = detectService(prev);
  const bySlug = Object.fromEntries(services.map((s) => [s.slug, s]));
  let reply; let service = null; let links = null; let chips = null;

  // A website-feature question beats a vague topic ("how", "time", "call"), but never a service symptom topic.
  const GENERIC = new Set(['how-it-works', 'slot', 'human', 'pay', 'login', 'society']);
  const feat = matchFeature(last) || (m.kind === 'fallback' && prev ? matchFeature(`${prev} ${last}`) : null);
  const featureWins = feat && m.kind !== 'danger' && (m.kind !== 'topic' || feat.n >= 2 || GENERIC.has(m.topic.id)) && !(m.kind === 'topic' && m.topic.service);

  if (featureWins) { reply = feat.f[lang]; if (feat.f.links) links = feat.f.links.map(([label, to]) => ({ label, to })); }
  else if (m.kind === 'topic') { reply = m.topic[lang].replace('{{support}}', SUPPORT); service = m.topic.service || null; }
  else if (m.kind === 'price') {
    if (slug && bySlug[slug]) { reply = GENERAL.price.one[lang](bySlug[slug]); service = slug; }
    else reply = GENERAL.price.all[lang](services.map((s) => `- ${s.name}: ₹${s.regular_price} / ${s.unit_label}`).join('\n'));
  } else if (m.kind === 'book') { reply = GENERAL.book[lang]; service = slug; }
  else if (m.kind === 'fallback') {
    {
      reply = L(lang, `I did not fully get that, but I can help with a lot: ${GENERAL.services.en}\n\nTry "Book AC repair", "Show my bookings", "Start a car wash group", or tell me a problem like "AC is leaking water".`,
        `मैं पूरी तरह समझ नहीं पाया, पर मैं काफ़ी कुछ कर सकता हूँ: ${GENERAL.services.hi}\n\nबोलकर देखिए "AC repair बुक करो", "मेरी बुकिंग दिखाओ", "कार वॉश का ग्रुप बनाओ", या कोई समस्या बताइए जैसे "AC से पानी टपक रहा है"।`,
        `Main poori tarah samajh nahi paaya, par main kaafi kuch kar sakta hoon: ${GENERAL.services.hing}\n\nBoliye "AC repair book karo", "meri bookings dikhao", "car wash ka group banao", ya koi problem batayein jaise "AC se paani tapak raha hai".`);
      chips = helpChips(lang);
    }
  } else { reply = GENERAL[m.kind][lang]; if (m.kind === 'hello' || m.kind === 'services') chips = helpChips(lang); }
  if (service && !bySlug[service]) service = null;
  if (service) chips = [bookChip(bySlug[service], lang)];
  return { reply, service, links, chips };
}

// ---- Claude with tools ----------------------------------------------------------------------------------
const TOOLS = [
  { name: 'list_services', description: 'List all Saath services with slug, unit and regular price.', input_schema: { type: 'object', properties: {} } },
  { name: 'find_groups', description: "Find open or unlocked groups for a service in the logged-in resident's society.", input_schema: { type: 'object', properties: { service_slug: { type: 'string' } }, required: ['service_slug'] } },
  { name: 'get_my_bookings', description: "List the logged-in resident's bookings with status and payment.", input_schema: { type: 'object', properties: {} } },
  { name: 'propose_join', description: 'Propose booking (joining a group). Shows Confirm/Cancel buttons to the user. It does NOT book until the user confirms.', input_schema: { type: 'object', properties: { group_id: { type: 'integer' }, units: { type: 'integer', minimum: 1, maximum: 6 } }, required: ['group_id', 'units'] } },
  { name: 'propose_create_group', description: 'Propose starting a new group in the resident\'s society. Shows Confirm/Cancel buttons. Date must be tomorrow or later, within 60 days.', input_schema: { type: 'object', properties: { service_slug: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, time_slot: { type: 'string', enum: ['6-9', '9-12', '12-3', '3-6', '6-8'] } }, required: ['service_slug', 'date', 'time_slot'] } },
  { name: 'propose_leave', description: 'Propose removing the resident from a group they joined. Shows Confirm/Cancel buttons.', input_schema: { type: 'object', properties: { group_id: { type: 'integer' } }, required: ['group_id'] } },
  { name: 'open_page', description: 'Open a page of the website for the user.', input_schema: { type: 'object', properties: { path: { type: 'string', enum: PAGES.map((p) => p.to) } }, required: ['path'] } },
];

function systemPrompt(ctx, services) {
  const list = services.map((s) => `- ${s.slug}: ${s.name}. ${s.tagline} Regular price Rs ${s.regular_price} per ${s.unit_label}. Includes: ${JSON.parse(s.includes).join(', ')}.`).join('\n');
  const who = ctx.user ? `The user is logged in as resident ${ctx.user.name}, society ${ctx.user.society.name} (${ctx.user.society.city}), flat ${ctx.user.flat}.` : 'The user is NOT logged in. Booking actions need a resident login; tell them to log in or sign up.';
  return `You are the Saath assistant, a friendly, capable helper built into the Saath website. Today is ${ctx.today} (India).

${SITE_GUIDE}

Services:
${list}

${who}

How to behave:
- Reply in the language and script the user used: Hindi in Devanagari, English, or Hinglish (Hindi in English letters). Follow their latest message.
- You know every feature of the website (above). Answer questions about any of them directly and completely. Never say you cannot help with something about the site; if you truly lack a detail, say what you do know and point to ${SUPPORT}.
- Help with home problems (AC leaking, RO taste, stains, cockroaches...): likely causes, 2 to 4 safe steps, when a technician is needed. Safety first: for sparks, burning smell, smoke, shock or gas smell tell them to switch off at the MCB, move away, and call 112 for fire or smoke. Never advise opening an outdoor AC unit, handling refrigerant, rewiring or mixing chemicals.
- You can ACT with tools. To book, use find_groups, then propose_join (ask how many units if the service is per AC/car/purifier/sofa set). To start a group use propose_create_group. To remove a booking use propose_leave. propose_* only show Confirm/Cancel buttons; the user must confirm, so never say it is already booked. After proposing, ask them to confirm in one short sentence.
- Resolve dates like "tomorrow" or "Sunday" yourself from today's date. Arrival slots: 6-9, 9-12, 12-3, 3-6, 6-8.
- Keep replies short (under 110 words), plain text, no markdown or bold. Simple numbered lines for steps.
- Only quote prices from the services list or tool results. Never invent offers, numbers or partner names.
- Unrelated topics: politely say you only help with Saath and home services. You are an AI assistant, not a human.`;
}

async function runTool(ctx, name, input, out, services) {
  const needLogin = () => { out.links = [{ label: 'Log in', to: '/login' }, { label: 'Sign up', to: '/signup' }]; return { error: 'not_logged_in: ask the user to log in as a resident first' }; };
  const lang = ctx.lang;
  try {
    if (name === 'list_services') return services.map((s) => ({ slug: s.slug, name: s.name, unit: s.unit_label, regular_price: s.regular_price }));
    if (name === 'open_page') { if (!PAGES.some((p) => p.to === input.path)) return { error: 'unknown page' }; out.navigate = input.path; return { ok: true }; }
    if (!ctx.user) return needLogin();
    if (name === 'find_groups') {
      if (!services.some((s) => s.slug === input.service_slug)) return { error: 'unknown service_slug' };
      out.service = input.service_slug;
      const gs = await agent.openGroups(ctx, input.service_slug);
      return gs.map((g) => ({ group_id: g.id, date: g.scheduled_date, slot: g.time_slot_label, joined: g.joined, target: g.target, group_price: g.group_price, regular_price: g.regular_price, unit: g.service.unit_label, already_joined: g.my_units != null, state: g.state }));
    }
    if (name === 'get_my_bookings') {
      return (await agent.myBookings(ctx)).map((b) => ({ group_id: b.group.id, service: b.group.service.name, date: b.group.scheduled_date, slot: b.group.time_slot_label, units: b.units, group_state: b.group.state, service_status: b.group.service_status, payment: b.group.my_payment?.status }));
    }
    if (name === 'propose_join') {
      const r = await ctx.call('GET', `/groups/${Number(input.group_id)}`);
      if (!r.ok) return { error: r.data.error || 'group not found' };
      const g = r.data.group;
      if (!['open', 'unlocked'].includes(g.state)) return { error: 'group is closed' };
      if (g.society.id !== ctx.user.society.id) return { error: 'group is in a different society' };
      const units = Math.min(Math.max(parseInt(input.units, 10) || 1, 1), 6);
      const jp = agent.joinPending(ctx, g, units, lang);
      out.pending = jp.pending; out.chips = jp.chips; out.service = g.service.slug; out.summary = jp.text;
      return { status: 'proposed_waiting_for_user_confirmation', summary: jp.text };
    }
    if (name === 'propose_create_group') {
      const svc = services.find((s) => s.slug === input.service_slug);
      if (!svc) return { error: 'unknown service_slug' };
      if (agent.dateProblem(input.date, ctx.today) || !/^\d{4}-\d{2}-\d{2}$/.test(String(input.date))) return { error: 'date must be tomorrow or later, within 60 days (YYYY-MM-DD)' };
      if (!ctx.slots.some((s) => s.key === input.time_slot)) return { error: 'invalid time_slot' };
      const cp = agent.createPending(ctx, svc, input.date, input.time_slot, lang);
      out.pending = cp.pending; out.chips = cp.chips; out.service = svc.slug; out.summary = cp.text;
      return { status: 'proposed_waiting_for_user_confirmation', summary: cp.text };
    }
    if (name === 'propose_leave') {
      const b = (await agent.myBookings(ctx)).find((x) => x.group.id === Number(input.group_id));
      if (!b) return { error: 'booking not found' };
      const lp = agent.leavePending(ctx, b, lang);
      out.pending = lp.pending; out.chips = lp.chips; out.summary = lp.text;
      return { status: 'proposed_waiting_for_user_confirmation', summary: lp.text };
    }
  } catch (e) { return { error: 'tool failed' }; }
  return { error: 'unknown tool' };
}

// Gemma has no tool calling here: it answers questions and looks at photos. Booking actions are handled by
// the agent (see chat/agent.js) before the model is asked.
function gemmaPrompt(ctx, services) {
  const list = services.map((s) => `- ${s.slug}: ${s.name}. ${s.tagline} Regular price Rs ${s.regular_price} per ${s.unit_label}. Includes: ${JSON.parse(s.includes).join(', ')}.`).join('\n');
  const who = ctx.user ? `The user is logged in as resident ${ctx.user.name} of ${ctx.user.society.name}.` : 'The user is not logged in.';
  return `You are the Saath assistant on the Saath website. Today is ${ctx.today} (India).

${SITE_GUIDE}

Services:
${list}

${who}

Rules:
- Reply in the language and script the user used: Hindi in Devanagari, English, or Hinglish (Hindi in English letters).
- Answer questions about any feature of the website using the guide above. Never say you cannot help with the site.
- For a home problem (AC leaking, RO taste, stains, pests...) give the likely causes and 2 to 4 safe steps, then say when a technician is needed. If the user sends a photo, describe what you can see in one sentence, say the most likely problem, and give safe next steps. If the photo is unclear or unrelated, say so and ask for a clearer one.
- Safety first: for sparks, burning smell, smoke, electric shock or a gas smell tell them to switch off at the MCB, move away, and call 112 for fire or smoke. Never advise opening an outdoor AC unit, handling refrigerant, rewiring or mixing chemicals.
- To book, tell them to say for example "Book AC repair" and you will do it for them in the chat.
- Plain text only, under 110 words, no markdown or bold. Only quote prices from the services list. Never invent offers or numbers.
- If a Saath service fits the problem, end with one tag on its own line: [[service:SLUG]] (slug from the list). Use none for greetings or emergencies.
- You are an AI assistant, not a human.`;
}

async function askGemma(ctx, services, history, image, signal) {
  const contents = history.map((m, i) => {
    const parts = [{ text: i === 0 ? `${gemmaPrompt(ctx, services)}\n\nUser: ${m.content}` : m.content }];
    return { role: m.role === 'assistant' ? 'model' : 'user', parts };
  });
  if (image) contents[contents.length - 1].parts.push({ inline_data: { mime_type: image.mime, data: image.data } });
  const res = await fetch(`${GEMINI_BASE}/models/${GEMMA_MODEL}:generateContent`, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 700, temperature: 0.4 } }),
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}`);
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('\n').trim();
  if (!text) throw new Error('empty reply');
  return text;
}

async function claude(body, signal) {
  const res = await fetch(API_URL, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  return res.json();
}

async function askClaude(ctx, services, history, signal) {
  const out = { service: null, pending: null, chips: null, links: null, navigate: null };
  const msgs = history.map((m) => ({ role: m.role, content: m.content }));
  const system = systemPrompt(ctx, services);
  for (let i = 0; i < 5; i++) {
    const data = await claude({ model: MODEL, max_tokens: 700, system, tools: TOOLS, messages: msgs }, signal);
    const blocks = data.content || [];
    const uses = blocks.filter((b) => b.type === 'tool_use');
    if (data.stop_reason !== 'tool_use' || !uses.length) {
      const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      if (!text.trim() && !out.pending) throw new Error('empty reply');
      return { text, out };
    }
    msgs.push({ role: 'assistant', content: blocks });
    const results = [];
    for (const u of uses) results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(await runTool(ctx, u.name, u.input || {}, out, services)) });
    msgs.push({ role: 'user', content: results });
  }
  throw new Error('too many tool steps');
}

// ---- the route ---------------------------------------------------------------------------------------------
export function registerChat(app, { db }) {
  app.get('/api/chat/status', (_req, res) => {
    const provider = PROVIDER === 'gemma' && GEMINI_KEY ? 'gemma' : (PROVIDER === 'claude' || PROVIDER === 'gemma') && API_KEY ? 'claude' : 'builtin';
    res.json({ ai: provider !== 'builtin', provider, model: provider === 'gemma' ? GEMMA_MODEL : provider === 'claude' ? MODEL : null, actions: true, photos: provider === 'gemma' });
  });

  app.post('/api/chat', async (req, res) => {
    if (!allowed(req.ip)) return res.status(429).json({ error: 'Too many messages. Please wait a few minutes.' });
    const raw = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const history = raw
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS) }))
      .slice(-MAX_MESSAGES);
    while (history.length && history[0].role !== 'user') history.shift();
    if (!history.length || history[history.length - 1].role !== 'user') return res.status(400).json({ error: 'Type a message first.' });

    // optional photo (small JPEG/PNG/WebP, base64) for the AI to look at
    const im = req.body?.image;
    const image = im && typeof im.data === 'string' && /^image\/(jpeg|png|webp)$/.test(im.mime) && im.data.length < 1_800_000 ? { mime: im.mime, data: im.data } : null;

    const pIn = req.body?.pending;
    const pending = pIn && typeof pIn === 'object' && PENDING_KINDS.has(pIn.kind) && pIn.params && typeof pIn.params === 'object' ? pIn : null;

    const services = db.prepare('SELECT id, slug, name, tagline, unit_label, regular_price, includes FROM services ORDER BY id').all();
    const slugs = new Set(services.map((s) => s.slug));
    const users = history.filter((m) => m.role === 'user').map((m) => m.content);
    const last = users[users.length - 1];
    const prevLang = users.length > 1 ? detectLang(users[users.length - 2], 'en') : 'en';
    const lang = detectLang(last, pending?.lang || prevLang);

    const call = makeCall(req);
    const meta = await slotsFor(call);
    let user = null;
    if (req.headers.authorization) {
      const s = await call('GET', '/session');
      if (s.ok && s.data.role === 'customer') user = s.data.profile;
    }
    const ctx = { text: last, lang, user, pending, services, slots: meta.slots, today: meta.today || todayIST(), call };
    const send = (r, source) => res.json({
      reply: r.reply, service: r.service || null, pending: r.cleared ? null : (r.pending || null), chips: r.chips || null,
      links: r.links || null, navigate: r.navigate || null, lang, source,
    });

    try {
      if (pending && !image) {
        const r = await agent.handlePending(ctx, lang);
        if (r) return send(r, 'agent');
      }
      const a = image ? null : await agent.intent({ ...ctx, pending: null }, lang);
      if (a) return send(a, 'agent');
    } catch (e) { console.warn('[chat] agent error:', e.message); }

    if (PROVIDER === 'gemma' && GEMINI_KEY) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 30_000);
      try {
        const text = await askGemma({ ...ctx, pending: null }, services, history, image, ctl.signal);
        const tag = text.match(/\[\[service:([a-z-]+)\]\]/);
        const reply = stripMarkdown(text.replace(/\[\[service:[a-z-]+\]\]/g, ''));
        const service = tag && slugs.has(tag[1]) ? tag[1] : null;
        return send({ reply, service, chips: service ? [bookChip(services.find((s) => s.slug === service), lang)] : null }, 'gemma');
      } catch (e) {
        console.warn('[chat] Gemma call failed, trying the next option:', e.message);
      } finally { clearTimeout(timer); }
    }

    if (API_KEY && PROVIDER !== 'builtin' && !image) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 25_000);
      try {
        const { text, out } = await askClaude({ ...ctx, pending: null }, services, history, ctl.signal);
        const tag = text.match(/\[\[service:([a-z-]+)\]\]/);
        const reply = stripMarkdown(text.replace(/\[\[service:[a-z-]+\]\]/g, '')) || out.summary || '';
        const service = out.service || (tag && slugs.has(tag[1]) ? tag[1] : null);
        const chips = out.chips || (service ? [bookChip(services.find((s) => s.slug === service), lang)] : null);
        return send({ reply, service, pending: out.pending, chips, links: out.links, navigate: out.navigate }, 'ai');
      } catch (e) {
        console.warn('[chat] AI call failed, using built-in answers:', e.message);
      } finally { clearTimeout(timer); }
    }
    if (image) {
      return send({ reply: L(lang, 'Photo analysis needs the AI assistant, which is not switched on right now. Please describe the problem in words, for example "AC is leaking water", and I will help.',
        'फोटो देखने के लिए AI असिस्टेंट चाहिए, जो अभी चालू नहीं है। कृपया समस्या शब्दों में बताइए, जैसे "AC से पानी टपक रहा है", मैं मदद करूँगा।',
        'Photo dekhne ke liye AI assistant chahiye, jo abhi chalu nahi hai. Kripya problem shabdon mein batayein, jaise "AC se paani tapak raha hai", main madad karunga.'), chips: helpChips(lang) }, 'builtin');
    }
    send(builtIn(services, users, lang), 'builtin');
  });
}

export { TOPICS, builtIn, matchFeature };

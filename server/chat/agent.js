// The assistant's "hands": it can book (join a group), start a group, leave a booking, list bookings,
// point to payment and open pages. Everything goes through the site's own API with the user's login,
// so every rule (society, dates, payment lock, phone number...) still applies.
//
// A write action never runs just because the model said so: it is first shown as a `pending` action
// with Confirm / Cancel buttons, and only runs when the user says yes.
import { detectService, tokenize } from './knowledge.js';
import { PAGES } from './features.js';
import { todayIST, addDays, weekdayOf, isRealDate } from '../dates.js';

export const L = (lang, en, hi, hing) => (lang === 'hi' ? hi : lang === 'hing' ? hing : en);
const norm = (s) => String(s || '').toLowerCase().normalize('NFC');
const tok = (s) => tokenize(s);
// exact-word / phrase match (so "bookings" does not count as "book")
const any = (t, words) => words.some((w) => (w.includes(' ') ? t.raw.includes(w) : t.set.has(w)));
const mk = (text) => ({ raw: norm(text), list: tok(text), set: new Set(tok(text)) });

const AFFIRM = ['yes', 'yeah', 'yep', 'yup', 'ok', 'okay', 'confirm', 'confirmed', 'sure', 'proceed', 'go ahead', 'do it', 'haan', 'han', 'ha', 'haa', 'hanji', 'ji', 'jee', 'theek', 'thik', 'kar', 'karo', 'kardo', 'kar do', 'book kar', 'हाँ', 'हां', 'हा', 'जी', 'ठीक', 'कर', 'करो', 'कर दो', 'कन्फर्म', 'पक्का', 'बिल्कुल'];
const DENY = ['no', 'nope', 'nahi', 'nahin', 'nhi', 'cancel', 'stop', 'mat', 'ruko', 'rehne', 'rahne', 'chhodo', 'chodo', 'leave it', 'never mind', 'nevermind', 'नहीं', 'नही', 'मत', 'रुको', 'कैंसल', 'रहने', 'छोड़ो', 'रद्द'];
export const isAffirm = (text) => any(mk(text), AFFIRM);
export const isDeny = (text) => any(mk(text), DENY);

const NUMS = { one: 1, ek: 1, 'एक': 1, two: 2, do: 2, 'दो': 2, three: 3, teen: 3, 'तीन': 3, four: 4, char: 4, chaar: 4, 'चार': 4, five: 5, paanch: 5, panch: 5, 'पांच': 5, 'पाँच': 5, six: 6, chhe: 6, chhah: 6, 'छह': 6, 'छः': 6 };
// allowDo=false ignores "do" because in Hinglish it also means "give" ("kar do")
export function parseCount(text, allowDo = true) {
  const t = mk(text);
  for (const w of t.list) {
    if (/^[1-6]$/.test(w)) return Number(w);
    if (NUMS[w] && (allowDo || (w !== 'do' && w !== 'दो'))) return NUMS[w];
  }
  return null;
}

const MONTHS = { jan: 1, january: 1, 'जनवरी': 1, feb: 2, february: 2, 'फरवरी': 2, mar: 3, march: 3, 'मार्च': 3, apr: 4, april: 4, 'अप्रैल': 4, may: 5, 'मई': 5, jun: 6, june: 6, 'जून': 6,
  jul: 7, july: 7, 'जुलाई': 7, aug: 8, august: 8, 'अगस्त': 8, sep: 9, sept: 9, september: 9, 'सितंबर': 9, oct: 10, october: 10, 'अक्टूबर': 10, nov: 11, november: 11, 'नवंबर': 11, dec: 12, december: 12, 'दिसंबर': 12 };
const WEEKDAYS = { 0: ['sunday', 'sun', 'ravivar', 'itwar', 'रविवार', 'इतवार'], 1: ['monday', 'mon', 'somvar', 'somwar', 'सोमवार'], 2: ['tuesday', 'tue', 'tues', 'mangalvar', 'mangalwar', 'मंगलवार'],
  3: ['wednesday', 'wed', 'budhvar', 'budhwar', 'बुधवार'], 4: ['thursday', 'thu', 'thur', 'thurs', 'guruvar', 'brihaspativar', 'veervar', 'गुरुवार', 'वीरवार'], 5: ['friday', 'fri', 'shukravar', 'shukrawar', 'शुक्रवार'], 6: ['saturday', 'sat', 'shanivar', 'shaniwar', 'शनिवार'] };

export function parseDate(text, today = todayIST()) {
  const t = mk(text);
  let iso = null;
  if (any(t, ['day after tomorrow', 'parso', 'parson', 'परसों', 'परसो'])) iso = addDays(today, 2);
  else if (any(t, ['tomorrow', 'tmrw', 'tomorow', 'kal', 'कल'])) iso = addDays(today, 1);
  else {
    for (const [d, words] of Object.entries(WEEKDAYS)) {
      if (any(t, words)) { let x = addDays(today, 1); while (weekdayOf(x) !== Number(d)) x = addDays(x, 1); iso = x; break; }
    }
  }
  if (!iso) {
    const m = t.raw.match(/\b(\d{1,2})\s*[\/\-.]\s*(\d{1,2})(?:\s*[\/\-.]\s*(\d{2,4}))?\b/);
    if (m) {
      let [, d, mo, y] = m; d = Number(d); mo = Number(mo);
      let year = y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : Number(today.slice(0, 4));
      let c = `${year}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (!y && c <= today) c = `${year + 1}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (isRealDate(c)) iso = c;
    }
  }
  if (!iso) {
    const dayTok = t.list.find((w) => /^\d{1,2}(st|nd|rd|th)?$/.test(w));
    const monTok = t.list.find((w) => MONTHS[w]);
    if (dayTok && monTok) {
      const d = parseInt(dayTok, 10); const mo = MONTHS[monTok]; let year = Number(today.slice(0, 4));
      let c = `${year}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (c <= today) c = `${year + 1}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (isRealDate(c)) iso = c;
    }
  }
  return iso;
}
export function dateProblem(iso, today = todayIST()) {
  if (!iso) return null;
  if (iso <= today) return 'past';
  if (iso > addDays(today, 60)) return 'far';
  return null;
}

export function parseSlot(text) {
  const t = mk(text);
  const direct = t.raw.match(/\b(6|9|12|3)\s*(?:-|to|se|से)\s*(9|12|3|6|8)\b/);
  if (direct) { const k = `${direct[1]}-${direct[2]}`; if (['6-9', '9-12', '12-3', '3-6', '6-8'].includes(k)) return k; }
  if (any(t, ['early', 'savere', 'सवेरे', 'tadke', 'तड़के'])) return '6-9';
  if (any(t, ['morning', 'subah', 'subha', 'सुबह', 'सवेरा'])) return '9-12';
  if (any(t, ['afternoon', 'dopahar', 'dopehar', 'दोपहर', 'noon'])) return '12-3';
  if (any(t, ['evening', 'shaam', 'sham', 'शाम'])) return '3-6';
  if (any(t, ['night', 'raat', 'रात'])) return '6-8';
  return null;
}

// ---- formatting ------------------------------------------------------------------
const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
export function fmtDate(iso, lang) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}
const slotText = (ctx, key) => ctx.slots.find((s) => s.key === key)?.label || key;
const unitWord = (s) => (s.unit_label === 'flat' ? 'flat' : s.unit_label);
const svcByslug = (ctx, slug) => ctx.services.find((s) => s.slug === slug);

const confirmChips = (lang) => [
  { label: L(lang, '✅ Confirm', '✅ कन्फर्म', '✅ Confirm'), send: L(lang, 'Yes, confirm', 'हाँ, कन्फर्म करो', 'Haan, confirm karo') },
  { label: L(lang, '✕ Cancel', '✕ रहने दो', '✕ Rehne do'), send: L(lang, 'No, cancel', 'नहीं, रहने दो', 'Nahi, rehne do') },
];
const loginReply = (lang) => ({
  reply: L(lang, 'Please log in with your resident account first, then I can do this for you. New here? Sign up takes a minute.',
    'पहले अपने निवासी अकाउंट से लॉग इन करें, फिर मैं यह आपके लिए कर दूँगा। नए हैं? साइन अप में एक मिनट लगता है।',
    'Pehle apne resident account se login karein, phir main ye aapke liye kar dunga. Naye hain? Sign up mein ek minute lagta hai.'),
  links: [{ label: L(lang, 'Log in', 'लॉग इन', 'Log in'), to: '/login' }, { label: L(lang, 'Sign up', 'साइन अप', 'Sign up'), to: '/signup' }],
});
const failReply = (lang, msg) => ({
  reply: L(lang, `I could not do that: ${msg}`, `यह नहीं हो पाया: ${msg}`, `Ye nahi ho paaya: ${msg}`),
});

// ---- building blocks (also used by the AI tools) ----------------------------------
export function groupLine(ctx, g, lang) {
  return L(lang,
    `${g.service.name}, ${fmtDate(g.scheduled_date, lang)}, ${slotText(ctx, g.time_slot)}. ${g.joined} of ${g.target} flats joined. Group price ${money(g.group_price)} per ${unitWord(g.service)} (regular ${money(g.regular_price)}).`,
    `${g.service.name}, ${fmtDate(g.scheduled_date, lang)}, ${slotText(ctx, g.time_slot)}। ${g.target} में से ${g.joined} फ्लैट जुड़े हैं। ग्रुप प्राइस ${money(g.group_price)} प्रति ${unitWord(g.service)} (सामान्य ${money(g.regular_price)})।`,
    `${g.service.name}, ${fmtDate(g.scheduled_date, lang)}, ${slotText(ctx, g.time_slot)}. ${g.target} mein se ${g.joined} flats jude hain. Group price ${money(g.group_price)} per ${unitWord(g.service)} (regular ${money(g.regular_price)}).`);
}

export function joinPending(ctx, g, units, lang) {
  const total = units * g.group_price;
  const text = L(lang,
    `Confirm booking: ${g.service.name} on ${fmtDate(g.scheduled_date, lang)}, ${slotText(ctx, g.time_slot)}, ${units} ${unitWord(g.service)}. You pay ${money(total)} at the group price once the group fills (${money(units * g.regular_price)} if it does not unlock). Nothing is charged now. Shall I book it?`,
    `बुकिंग कन्फर्म करें: ${g.service.name}, ${fmtDate(g.scheduled_date, lang)}, ${slotText(ctx, g.time_slot)}, ${units} ${unitWord(g.service)}। ग्रुप भरने पर ग्रुप प्राइस पर ${money(total)} देना होगा (अनलॉक न हुआ तो ${money(units * g.regular_price)})। अभी कुछ चार्ज नहीं होगा। बुक कर दूँ?`,
    `Booking confirm karein: ${g.service.name}, ${fmtDate(g.scheduled_date, lang)}, ${slotText(ctx, g.time_slot)}, ${units} ${unitWord(g.service)}. Group bharne par group price par ${money(total)} dena hoga (unlock na hua to ${money(units * g.regular_price)}). Abhi kuch charge nahi hoga. Book kar dun?`);
  return { pending: { kind: 'join', stage: 'confirm', lang, params: { group_id: g.id, units } }, text, chips: confirmChips(lang) };
}

export function createDefaults(svc) {
  let gp = Math.round((svc.regular_price * 0.8) / 10) * 10;
  if (gp >= svc.regular_price) gp = svc.regular_price - 10;
  return { target: 15, group_price: Math.max(gp, 50) };
}
export function createPending(ctx, svc, date, slot, lang, extra = {}) {
  const d = { ...createDefaults(svc), ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v != null)) };
  const where = ctx.user?.society?.name || '';
  const text = L(lang,
    `Confirm new group: ${svc.name} at ${where} on ${fmtDate(date, lang)}, ${slotText(ctx, slot)}. It needs ${d.target} flats and the group price will be ${money(d.group_price)} per ${unitWord(svc)} (regular ${money(svc.regular_price)}). You become the host and your own booking is added. Shall I create it?`,
    `नया ग्रुप कन्फर्म करें: ${svc.name}, ${where}, ${fmtDate(date, lang)}, ${slotText(ctx, slot)}। इसके लिए ${d.target} फ्लैट चाहिए और ग्रुप प्राइस ${money(d.group_price)} प्रति ${unitWord(svc)} होगा (सामान्य ${money(svc.regular_price)})। आप होस्ट होंगे और आपकी अपनी बुकिंग जुड़ जाएगी। बना दूँ?`,
    `Naya group confirm karein: ${svc.name}, ${where}, ${fmtDate(date, lang)}, ${slotText(ctx, slot)}. Isme ${d.target} flats chahiye aur group price ${money(d.group_price)} per ${unitWord(svc)} hoga (regular ${money(svc.regular_price)}). Aap host honge aur aapki apni booking judd jayegi. Bana dun?`);
  return { pending: { kind: 'create', stage: 'confirm', lang, params: { service_slug: svc.slug, date, slot, ...d } }, text, chips: confirmChips(lang) };
}

export function leavePending(ctx, b, lang) {
  const g = b.group;
  const text = L(lang,
    `Confirm: remove your booking for ${g.service.name} on ${fmtDate(g.scheduled_date, lang)}? You will be taken out of the group.`,
    `कन्फर्म करें: ${g.service.name}, ${fmtDate(g.scheduled_date, lang)} की आपकी बुकिंग हटा दूँ? आप ग्रुप से बाहर हो जाएँगे।`,
    `Confirm karein: ${g.service.name}, ${fmtDate(g.scheduled_date, lang)} ki aapki booking hata dun? Aap group se bahar ho jaayenge.`);
  return { pending: { kind: 'leave', stage: 'confirm', lang, params: { group_id: g.id } }, text, chips: confirmChips(lang) };
}

// ---- data fetch ---------------------------------------------------------------------
export async function openGroups(ctx, slug) {
  const r = await ctx.call('GET', `/groups?society_id=${ctx.user.society.id}&service=${encodeURIComponent(slug)}`);
  if (!r.ok) return [];
  return (r.data.groups || []).filter((g) => ['open', 'unlocked'].includes(g.state));
}
export async function myBookings(ctx) {
  const r = await ctx.call('GET', '/me/bookings');
  return r.ok ? r.data.bookings || [] : [];
}

const SVC_CHIPS = (ctx) => ctx.services.map((s) => ({ label: s.name, send: s.name }));

// ---- flows ----------------------------------------------------------------------------
export async function startBooking(ctx, slug, lang) {
  if (!ctx.user) return loginReply(lang);
  const svc = svcByslug(ctx, slug);
  const groups = await openGroups(ctx, slug);
  const joinable = groups.filter((g) => g.my_units == null);
  if (!joinable.length) {
    if (groups.length) {
      return { reply: L(lang, `You have already joined the ${svc.name} group in your society. You can see it in My bookings.`, `आप अपनी सोसाइटी का ${svc.name} ग्रुप पहले ही जॉइन कर चुके हैं। My bookings में देख सकते हैं।`, `Aap apni society ka ${svc.name} group pehle hi join kar chuke hain. My bookings mein dekh sakte hain.`),
        links: [{ label: 'My bookings', to: '/bookings' }] };
    }
    return {
      reply: L(lang, `There is no open ${svc.name} group in ${ctx.user.society.name} right now. I can start one for you. Which day would you like? (for example tomorrow, Sunday or 15/11)`,
        `${ctx.user.society.name} में अभी ${svc.name} का कोई खुला ग्रुप नहीं है। मैं आपके लिए नया ग्रुप शुरू कर सकता हूँ। किस दिन चाहिए? (जैसे कल, रविवार या 15/11)`,
        `${ctx.user.society.name} mein abhi ${svc.name} ka koi khula group nahi hai. Main aapke liye naya group shuru kar sakta hoon. Kis din chahiye? (jaise kal, Sunday ya 15/11)`),
      pending: { kind: 'create', stage: 'ask_date', lang, params: { service_slug: slug } },
      chips: [{ label: L(lang, 'Tomorrow', 'कल', 'Kal'), send: L(lang, 'tomorrow', 'कल', 'kal') }, { label: L(lang, 'Day after', 'परसों', 'Parso'), send: L(lang, 'day after tomorrow', 'परसों', 'parso') }],
    };
  }
  const g = joinable[0];
  const more = joinable.length > 1;
  const said = g.service.unit_label === 'flat' ? null : parseCount(ctx.text, false); // "book 2 AC for Sunday"
  if (said) {
    const jp = joinPending(ctx, g, said, lang);
    return { reply: L(lang, 'I found a group in your society: ', 'आपकी सोसाइटी में ग्रुप मिला: ', 'Aapki society mein group mila: ') + groupLine(ctx, g, lang) + '\n\n' + jp.text, pending: jp.pending, chips: jp.chips, service: slug };
  }
  const head = L(lang, `I found a group in ${ctx.user.society.name}: `, `${ctx.user.society.name} में ग्रुप मिला: `, `${ctx.user.society.name} mein group mila: `) + groupLine(ctx, g, lang);
  const tail = more ? L(lang, ` (${joinable.length - 1} more on the Groups page.)`, ` (${joinable.length - 1} और ग्रुप्स पेज पर हैं।)`, ` (${joinable.length - 1} aur Groups page par hain.)`) : '';
  if (g.service.unit_label === 'flat') {
    const jp = joinPending(ctx, g, 1, lang);
    return { reply: `${head}${tail}\n\n${jp.text}`, pending: jp.pending, chips: jp.chips, service: slug };
  }
  return {
    reply: `${head}${tail}\n\n` + L(lang, `How many ${unitWord(g.service)}s do you want serviced? (1 to 6)`, `कितने ${unitWord(g.service)} की सर्विस चाहिए? (1 से 6)`, `Kitne ${unitWord(g.service)} ki service chahiye? (1 se 6)`),
    pending: { kind: 'join', stage: 'ask_units', lang, params: { group_id: g.id } },
    chips: [1, 2, 3].map((n) => ({ label: String(n), send: String(n) })), service: slug,
  };
}

export async function startCreate(ctx, slug, lang, text = '') {
  if (!ctx.user) return loginReply(lang);
  const svc = svcByslug(ctx, slug);
  const date = parseDate(text, ctx.today); const slot = parseSlot(text);
  return continueCreate(ctx, { kind: 'create', stage: 'ask_date', lang, params: { service_slug: slug, date: date || undefined, slot: slot || undefined } }, svc, lang);
}

// move a create flow forward as far as the known details allow
function continueCreate(ctx, p, svc, lang) {
  const { date, slot } = p.params;
  if (!date) {
    return { reply: L(lang, `Which day should the ${svc.name} visit be? (tomorrow up to 60 days ahead, for example Sunday or 15/11)`, `${svc.name} किस दिन चाहिए? (कल से 60 दिन तक, जैसे रविवार या 15/11)`, `${svc.name} kis din chahiye? (kal se 60 din tak, jaise Sunday ya 15/11)`),
      pending: { ...p, stage: 'ask_date' }, chips: [{ label: L(lang, 'Tomorrow', 'कल', 'Kal'), send: L(lang, 'tomorrow', 'कल', 'kal') }] };
  }
  if (!slot) {
    return { reply: L(lang, `${fmtDate(date, lang)}. Which arrival time slot? Morning (9 to 12), afternoon (12 to 3), evening (3 to 6)...`, `${fmtDate(date, lang)}। कौन सा टाइम स्लॉट? सुबह (9 से 12), दोपहर (12 से 3), शाम (3 से 6)...`, `${fmtDate(date, lang)}. Kaun sa time slot? Subah (9 se 12), dopahar (12 se 3), shaam (3 se 6)...`),
      pending: { ...p, stage: 'ask_slot' },
      chips: ctx.slots.map((s) => ({ label: s.label.replace(' to ', '–'), send: s.key.replace('-', ' to ') })) };
  }
  const cp = createPending(ctx, svc, date, slot, lang, { target: p.params.target, group_price: p.params.group_price });
  return { reply: cp.text, pending: cp.pending, chips: cp.chips };
}

function describeBooking(b, lang) {
  const g = b.group;
  const st = g.service_status;
  const status = st === 'completed' ? L(lang, 'completed', 'पूरी हो गई', 'poori ho gayi')
    : st === 'confirmed' ? L(lang, 'confirmed', 'कन्फर्म', 'confirmed')
    : g.provider_status === 'awaiting' ? L(lang, 'awaiting a service partner', 'पार्टनर का इंतज़ार', 'partner ka intezaar')
    : ['cancelled', 'not_fulfilled', 'expired'].includes(st) ? L(lang, 'closed', 'बंद', 'band')
    : L(lang, 'waiting for more flats', 'और फ्लैट का इंतज़ार', 'aur flats ka intezaar');
  const pay = g.my_payment?.status;
  const payText = pay === 'paid' ? L(lang, 'paid', 'पेमेंट हो गया', 'payment ho gaya') : pay === 'refund_due' ? L(lang, 'refund due', 'रिफंड बाकी', 'refund baaki') : L(lang, 'unpaid', 'पेमेंट बाकी', 'payment baaki');
  return `• ${g.service.name}, ${fmtDate(g.scheduled_date, lang)}, ${g.time_slot_label}, ${b.units} ${unitWord(g.service)}: ${status}, ${payText}`;
}

export async function showBookings(ctx, lang) {
  if (!ctx.user) return loginReply(lang);
  const list = await myBookings(ctx);
  if (!list.length) {
    return { reply: L(lang, 'You have no bookings yet. Say "book AC repair" and I will do it for you.', 'अभी आपकी कोई बुकिंग नहीं है। कहिए "AC repair बुक करो", मैं कर दूँगा।', 'Abhi aapki koi booking nahi hai. Kahiye "AC repair book karo", main kar dunga.'), links: [{ label: 'Services', to: '/services' }] };
  }
  const shown = list.slice(0, 6);
  return { reply: L(lang, 'Your bookings:\n', 'आपकी बुकिंग:\n', 'Aapki bookings:\n') + shown.map((b) => describeBooking(b, lang)).join('\n') + (list.length > 6 ? `\n+${list.length - 6}` : ''),
    links: [{ label: 'My bookings', to: '/bookings' }] };
}

export async function startLeave(ctx, lang, text, slugHint) {
  if (!ctx.user) return loginReply(lang);
  const list = (await myBookings(ctx)).filter((b) => ['open', 'unlocked'].includes(b.group.state));
  const slug = slugHint || detectService(text);
  let pick = slug ? list.filter((b) => b.group.service.slug === slug) : list;
  if (!pick.length) return { reply: L(lang, 'I could not find an active booking to remove.', 'हटाने के लिए कोई चालू बुकिंग नहीं मिली।', 'Hatane ke liye koi active booking nahi mili.'), links: [{ label: 'My bookings', to: '/bookings' }] };
  if (pick.length > 1) {
    return { reply: L(lang, 'Which booking do you want to remove?\n', 'कौन सी बुकिंग हटानी है?\n', 'Kaun si booking hatani hai?\n') + pick.map((b) => describeBooking(b, lang)).join('\n'),
      pending: { kind: 'leave', stage: 'ask_which', lang, params: {} }, chips: pick.map((b) => ({ label: b.group.service.name, send: b.group.service.name })) };
  }
  const lp = leavePending(ctx, pick[0], lang);
  return { reply: lp.text, pending: lp.pending, chips: lp.chips };
}

export async function payHelp(ctx, lang) {
  if (!ctx.user) return loginReply(lang);
  const list = (await myBookings(ctx)).filter((b) => b.group.state === 'unlocked' && b.group.my_payment?.status !== 'paid');
  if (!list.length) {
    return { reply: L(lang, 'You have nothing to pay online right now. Online payment opens once a group you joined reaches its flat count. Until then you pay the partner after the service.',
      'अभी आपके पास ऑनलाइन चुकाने के लिए कुछ नहीं है। जब आपका ग्रुप फ्लैट टारगेट पूरा कर लेता है तब ऑनलाइन पेमेंट खुलता है। तब तक सर्विस के बाद पार्टनर को दें।',
      'Abhi aapke paas online chukane ke liye kuch nahi hai. Jab aapka group flat target poora kar leta hai tab online payment khulta hai. Tab tak service ke baad partner ko dein.') };
  }
  return { reply: L(lang, 'These bookings are unlocked and can be paid online. Open one and tap "Pay now":', 'ये बुकिंग अनलॉक हैं और ऑनलाइन चुकाई जा सकती हैं। एक खोलकर "Pay now" दबाएँ:', 'Ye bookings unlock hain aur online chukayi ja sakti hain. Ek kholkar "Pay now" dabayein:'),
    links: list.slice(0, 4).map((b) => ({ label: `${b.group.service.name} · ${money(b.amount_if_unlocked ?? b.amount)}`, to: `/groups/${b.group.id}` })) };
}

// ---- executing a confirmed action ---------------------------------------------------------
export async function execute(ctx, p, lang) {
  if (!ctx.user) return loginReply(lang);
  const q = p.params || {};
  if (p.kind === 'join') {
    const r = await ctx.call('POST', `/groups/${Number(q.group_id)}/join`, { units: Number(q.units) || 1 });
    if (!r.ok) return failReply(lang, r.data.error || 'try again');
    const g = r.data.group;
    const unlocked = ['unlocked', 'completed'].includes(g.state);
    return {
      reply: L(lang, `Done! You are booked for ${g.service.name} on ${fmtDate(g.scheduled_date, lang)}, ${slotText(ctx, g.time_slot)} (${g.my_units} ${unitWord(g.service)}). ${g.joined} of ${g.target} flats have joined.${unlocked ? ' The group price is unlocked, so you can pay online or after the service.' : ' The group price unlocks when the target is reached. Nothing is charged now.'}`,
        `हो गया! ${g.service.name}, ${fmtDate(g.scheduled_date, lang)}, ${slotText(ctx, g.time_slot)} (${g.my_units} ${unitWord(g.service)}) की बुकिंग हो गई। ${g.target} में से ${g.joined} फ्लैट जुड़ चुके हैं।${unlocked ? ' ग्रुप प्राइस खुल गया है, आप ऑनलाइन या सर्विस के बाद पेमेंट कर सकते हैं।' : ' टारगेट पूरा होने पर ग्रुप प्राइस खुलेगा। अभी कुछ चार्ज नहीं हुआ।'}`,
        `Ho gaya! ${g.service.name}, ${fmtDate(g.scheduled_date, lang)}, ${slotText(ctx, g.time_slot)} (${g.my_units} ${unitWord(g.service)}) ki booking ho gayi. ${g.target} mein se ${g.joined} flats jud chuke hain.${unlocked ? ' Group price khul gaya hai, aap online ya service ke baad payment kar sakte hain.' : ' Target poora hone par group price khulega. Abhi kuch charge nahi hua.'}`),
      links: [{ label: 'My bookings', to: '/bookings' }, { label: L(lang, 'Open group', 'ग्रुप खोलें', 'Group kholein'), to: `/groups/${g.id}` }],
    };
  }
  if (p.kind === 'create') {
    const svc = svcByslug(ctx, q.service_slug);
    if (!svc) return failReply(lang, 'unknown service');
    const r = await ctx.call('POST', '/groups', { service_id: svc.id, scheduled_date: q.date, time_slot: q.slot, target: Number(q.target), group_price: Number(q.group_price), description: '' });
    if (!r.ok) return failReply(lang, r.data.error || 'try again');
    const id = r.data.id;
    return {
      reply: L(lang, `Your ${svc.name} group is live for ${fmtDate(q.date, lang)}, ${slotText(ctx, q.slot)}. It needs ${q.target} flats, and your own booking is already added. Share it with neighbours so the price unlocks sooner.`,
        `आपका ${svc.name} ग्रुप ${fmtDate(q.date, lang)}, ${slotText(ctx, q.slot)} के लिए शुरू हो गया। इसके लिए ${q.target} फ्लैट चाहिए, और आपकी अपनी बुकिंग जुड़ चुकी है। पड़ोसियों के साथ शेयर करें ताकि कीमत जल्दी खुले।`,
        `Aapka ${svc.name} group ${fmtDate(q.date, lang)}, ${slotText(ctx, q.slot)} ke liye shuru ho gaya. Isme ${q.target} flats chahiye, aur aapki apni booking judd chuki hai. Padosiyon ke saath share karein taaki price jaldi khule.`),
      links: [{ label: L(lang, 'Open group', 'ग्रुप खोलें', 'Group kholein'), to: `/groups/${id}` }],
    };
  }
  if (p.kind === 'leave') {
    const r = await ctx.call('DELETE', `/groups/${Number(q.group_id)}/join`);
    if (!r.ok) return failReply(lang, r.data.error || 'try again');
    return { reply: L(lang, 'Done, your booking is removed.', 'हो गया, आपकी बुकिंग हटा दी गई।', 'Ho gaya, aapki booking hata di gayi.'), links: [{ label: 'My bookings', to: '/bookings' }] };
  }
  return null;
}

// ---- pending conversation (units, date, slot, confirm) ---------------------------------------
export async function handlePending(ctx, lang) {
  const p = ctx.pending;
  const text = ctx.text;
  const sayCancelled = { reply: L(lang, 'Okay, I have cancelled that. Nothing was booked.', 'ठीक है, मैंने वह रद्द कर दिया। कुछ बुक नहीं हुआ।', 'Theek hai, maine wo cancel kar diya. Kuch book nahi hua.'), cleared: true };

  if (p.kind === 'choose_service') {
    const slug = detectService(text);
    if (!slug) return isDeny(text) ? sayCancelled : null;
    return p.purpose === 'create' ? startCreate(ctx, slug, lang, '') : startBooking(ctx, slug, lang);
  }
  if (isDeny(text) && !parseCount(text)) return sayCancelled;

  if (p.kind === 'join') {
    const r = await ctx.call('GET', `/groups/${Number(p.params.group_id)}`);
    if (!r.ok) return failReply(lang, r.data.error || 'group not found');
    const g = r.data.group;
    const n = parseCount(text);
    if (p.stage === 'ask_units') {
      if (!n) return null;
      const jp = joinPending(ctx, g, n, lang);
      return { reply: jp.text, pending: jp.pending, chips: jp.chips };
    }
    if (p.stage === 'confirm') {
      if (n && !isAffirm(text)) { const jp = joinPending(ctx, g, n, lang); return { reply: jp.text, pending: jp.pending, chips: jp.chips }; }
      if (isAffirm(text)) return { ...(await execute(ctx, p, lang)), cleared: true };
    }
    return null;
  }
  if (p.kind === 'create') {
    const svc = svcByslug(ctx, p.params.service_slug);
    if (p.stage === 'confirm') return isAffirm(text) ? { ...(await execute(ctx, p, lang)), cleared: true } : null;
    const np = { ...p, params: { ...p.params } };
    const d = parseDate(text, ctx.today); const s = parseSlot(text);
    if (d) {
      const prob = dateProblem(d, ctx.today);
      if (prob) return { reply: prob === 'past' ? L(lang, 'That date is today or earlier. Please pick tomorrow or a later day.', 'वह तारीख आज या उससे पहले की है। कल या उसके बाद का दिन बताइए।', 'Wo date aaj ya usse pehle ki hai. Kal ya uske baad ka din batayein.') : L(lang, 'Please pick a date within the next 60 days.', 'कृपया अगले 60 दिनों के अंदर की तारीख बताइए।', 'Kripya agle 60 dinon ke andar ki date batayein.'), pending: p };
      np.params.date = d;
    }
    if (s) np.params.slot = s;
    const tgt = text.match(/(?:target|flats?|फ्लैट)\D{0,6}(\d{1,3})|(\d{1,3})\s*(?:flats?|फ्लैट)/i);
    if (tgt) { const v = Number(tgt[1] || tgt[2]); if (v >= 5 && v <= 200) np.params.target = v; }
    if (!d && !s && !tgt) return null;
    return continueCreate(ctx, np, svc, lang);
  }
  if (p.kind === 'leave') {
    if (p.stage === 'ask_which') {
      const slug = detectService(text);
      if (!slug) return null;
      return startLeave(ctx, lang, text, slug);
    }
    if (p.stage === 'confirm' && isAffirm(text)) return { ...(await execute(ctx, p, lang)), cleared: true };
  }
  return null;
}

// ---- intent detection for a fresh message ---------------------------------------------------------
const W = {
  bookStrong: ['book', 'booking', 'karwana', 'karvana', 'karwao', 'karwa', 'karwani', 'karvao', 'lagwana', 'lagwao', 'schedule', 'बुक', 'करवाना', 'करवाओ', 'करवा', 'लगवाना', 'लगवाओ', 'join'],
  bookWeak: ['chahiye', 'chahie', 'need', 'want', 'bulao', 'bulana', 'bhejo', 'bhej', 'चाहिए', 'बुलाओ', 'भेजो', 'order', 'hire', 'arrange'],
  mine: ['my', 'meri', 'mere', 'mera', 'मेरी', 'मेरे', 'मेरा', 'status', 'kab', 'कब', 'check'],
  show: ['show', 'list', 'dikhao', 'dikha', 'dikhaiye', 'dekho', 'dekhna', 'batao', 'bata', 'दिखाओ', 'दिखा', 'देखो', 'देखना', 'बताओ', 'view'],
  bookingNouns: ['bookings', 'booking', 'orders', 'order', 'बुकिंग', 'बुकिंग्स', 'बुकिंगें'],
  cancel: ['cancel', 'remove', 'leave', 'unjoin', 'withdraw', 'hatao', 'hata', 'hatana', 'nikalo', 'nikal', 'radd', 'कैंसल', 'हटाओ', 'हटा', 'हटाना', 'निकालो', 'रद्द', 'cancelled'],
  createWords: ['start', 'create', 'make', 'new', 'naya', 'nayi', 'nai', 'banao', 'banana', 'bana', 'shuru', 'open', 'नया', 'नई', 'बनाओ', 'बनाना', 'बना', 'शुरू', 'launch'],
  groupWords: ['group', 'groups', 'ग्रुप'],
  pay: ['pay', 'payment', 'paisa', 'paise', 'bhugtan', 'bharna', 'पेमेंट', 'भुगतान', 'पे', 'पैसे'],
  payAct: ['now', 'abhi', 'अभी', 'karna', 'karni', 'karo', 'करना', 'करनी', 'करो', 'make', 'due', 'baaki', 'बाकी', 'dena', 'देना'],
  info: ['kaise', 'how', 'kya', 'what', 'kyun', 'why', 'methods', 'options', 'कैसे', 'क्या', 'क्यों', 'which', 'kaun', 'kaunsa'],
  open: ['open', 'kholo', 'khol', 'kholiye', 'go', 'take', 'le', 'chalo', 'jao', 'visit', 'page', 'खोलो', 'खोलिए', 'खोल', 'जाओ', 'चलो', 'ले', 'पेज', 'dikhao', 'show', 'दिखाओ'],
};

export async function intent(ctx, lang) {
  const t = mk(ctx.text);
  const slug = detectService(ctx.text);
  const bookNoun = any(t, W.bookingNouns);

  // "open ... page" always means navigate
  if (any(t, ['open', 'kholo', 'khol', 'kholiye', 'page', 'खोलो', 'खोलिए', 'पेज', 'take me', 'go to', 'chalo', 'le chalo'])) {
    const nav = pageFor(t, lang);
    if (nav) return nav;
  }

  // cancel / remove a booking
  if (any(t, W.cancel) && !any(t, W.info) && (bookNoun || any(t, ['group', 'ग्रुप', 'join', 'service', 'सर्विस']) || slug)) return startLeave(ctx, lang, ctx.text, slug);

  // start a new group
  if (any(t, W.groupWords) && any(t, W.createWords) && !any(t, W.info)) {
    if (!slug) return { reply: L(lang, 'Which service should the new group be for?', 'नया ग्रुप किस सर्विस के लिए बनाना है?', 'Naya group kis service ke liye banana hai?'), pending: { kind: 'choose_service', purpose: 'create', lang, params: {} }, chips: SVC_CHIPS(ctx) };
    return startCreate(ctx, slug, lang, ctx.text);
  }

  // show my bookings
  if (bookNoun && (any(t, W.mine) || any(t, W.show)) && !any(t, W.bookStrong.filter((w) => w !== 'booking' && w !== 'bookings' && w !== 'बुकिंग'))) return showBookings(ctx, lang);
  if (any(t, ['booking status', 'order status', 'meri booking', 'mera order', 'कब आएगा', 'kab aayega', 'kab ayega'])) return showBookings(ctx, lang);

  // pay
  if (any(t, W.pay) && any(t, W.payAct) && !any(t, W.info)) return payHelp(ctx, lang);

  // book a service
  const bookStrong = any(t, W.bookStrong) && !bookNoun;
  const bookWeak = any(t, W.bookWeak);
  if (slug && (bookStrong || bookWeak) && !any(t, ['price', 'cost', 'kitna', 'kitne', 'rate', 'कितना', 'कितने', 'कीमत'])) return startBooking(ctx, slug, lang);
  if (!slug && bookStrong && !any(t, W.info)) {
    return { reply: L(lang, 'Sure. Which service would you like to book?', 'ज़रूर। कौन सी सर्विस बुक करनी है?', 'Zaroor. Kaun si service book karni hai?'), pending: { kind: 'choose_service', purpose: 'book', lang, params: {} }, chips: SVC_CHIPS(ctx) };
  }

  // open a page ("services dikhao")
  if (any(t, W.open)) { const nav = pageFor(t, lang); if (nav) return nav; }
  return null;
}

function pageFor(t, lang) {
  let best = null;
  for (const p of PAGES) {
    const n = p.words.filter((w) => (w.includes(' ') ? t.raw.includes(w) : t.set.has(w))).length;
    if (n && (!best || n > best.n || (n === best.n && p.words.some((w) => w.includes(' '))))) best = { p, n };
  }
  if (!best) return null;
  const label = best.p.label[lang] || best.p.label.en;
  return { reply: L(lang, `Opening ${label}.`, `${label} खोल रहा हूँ।`, `${label} khol raha hoon.`), navigate: best.p.to };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useMeta } from '../meta.jsx';
import './chat.css';

const STORE = 'saath_chat_v2';
const STARTERS = ['AC repair book karo', 'मेरे RO का पानी कड़वा लग रहा है', 'Show my bookings', 'Pest control bachchon ke liye safe hai?'];
const GREETING = {
  role: 'assistant', greeting: true,
  content: 'Hi! I am the Saath assistant. I can answer questions about Saath, help with home problems, and book services for you. Try "AC repair book karo", "meri bookings dikhao", or describe a problem. You can type, send a photo, or tap the mic and speak in English, Hindi or Hinglish.',
};

// ---- voice (browser built-ins, no extra service) ------------------------------------------------------
const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
const FEMALE = /female|woman|swara|heera|kalpana|neerja|veena|zira|aria|jenny|samantha|karen|tessa|moira|fiona|victoria|susan|hazel|libby|sonia|lekha|priya|raveena|natasha|catherine|google हिन्दी|google hindi/i;
const MALE = /\bmale\b|hemant|ravi\b|prabhat|rishi|david|mark\b|daniel|james|george|alex\b|fred|guy\b|ryan|mohan|madhur|rehaan|tom\b|bob\b/i;

function pickVoice(lang) {
  if (!synth) return null;
  const want = lang.toLowerCase();
  let best = null; let bestScore = -99;
  for (const v of synth.getVoices()) {
    const vl = v.lang.toLowerCase().replace('_', '-');
    let sc = vl === want ? 6 : vl.startsWith(want.slice(0, 2)) ? 3 : -50;
    if (sc < 0) continue;
    if (FEMALE.test(v.name)) sc += 4;
    if (MALE.test(v.name)) sc -= 6;
    if (/google|natural|online/i.test(v.name)) sc += 1;
    if (sc > bestScore) { best = v; bestScore = sc; }
  }
  return best;
}
const isDev = (t) => (t.match(/[\u0900-\u097F]/g) || []).length > t.length * 0.2;
function speakable(text) {
  const hi = isDev(text);
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF→•✅✕]/gu, ' ')
    .replace(/₹\s?([\d,]+)/g, (_, n) => `${n} ${hi ? 'रुपये' : 'rupees'}`)
    .replace(/(\d+)\s?%/g, (_, n) => `${n} ${hi ? 'प्रतिशत' : 'percent'}`)
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}
function chunks(text) {
  const parts = text.split(/(?<=[.!?।])\s+/); const out = []; let cur = '';
  for (const p of parts) { if ((cur + ' ' + p).length > 170 && cur) { out.push(cur); cur = p; } else cur = cur ? `${cur} ${p}` : p; }
  if (cur) out.push(cur);
  return out;
}

// shrink a photo before sending (a phone photo can be several MB)
function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1024 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL('image/jpeg', 0.8); URL.revokeObjectURL(url);
      resolve({ mime: 'image/jpeg', data: dataUrl.split(',')[1], preview: dataUrl });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that photo.')); };
    img.src = url;
  });
}

export default function ChatWidget() {
  const { provider, admin } = useAuth();
  const { services } = useMeta();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState(() => {
    try { const s = JSON.parse(sessionStorage.getItem(STORE)); if (Array.isArray(s?.msgs) && s.msgs.length) return s.msgs; } catch { /* ignore */ }
    return [GREETING];
  });
  const [pending, setPending] = useState(() => { try { return JSON.parse(sessionStorage.getItem(STORE))?.pending || null; } catch { return null; } });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ provider: 'builtin', photos: false });
  const [photo, setPhoto] = useState(null);
  const [voiceOn, setVoiceOn] = useState(() => localStorage.getItem('saath_voice') !== 'off');
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [micLang, setMicLang] = useState(() => localStorage.getItem('saath_mic_lang') || 'hi-IN');
  const [micNote, setMicNote] = useState('');
  const bodyRef = useRef(null); const inputRef = useRef(null); const fileRef = useRef(null);
  const msgsRef = useRef(msgs); const pendingRef = useRef(pending); const photoRef = useRef(null);
  const recRef = useRef(null); const voiceChat = useRef(false); const noSpeech = useRef(0); const sendRef = useRef(null);
  const voiceOnRef = useRef(voiceOn); const micLangRef = useRef(micLang);
  msgsRef.current = msgs; pendingRef.current = pending; photoRef.current = photo; voiceOnRef.current = voiceOn; micLangRef.current = micLang;

  useEffect(() => {
    try { sessionStorage.setItem(STORE, JSON.stringify({ msgs: msgs.slice(-40).map(({ image, ...m }) => m), pending })); } catch { /* ignore */ }
  }, [msgs, pending]);
  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs, busy, open, listening]);
  useEffect(() => { if (open) { setTimeout(() => inputRef.current?.focus(), 80); api('/chat/status').then(setStatus).catch(() => {}); } }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => { if (synth) { synth.getVoices(); synth.onvoiceschanged = () => synth.getVoices(); } return () => { synth?.cancel(); try { recRef.current?.abort(); } catch { /* ignore */ } }; }, []);
  useEffect(() => { if (!open) { voiceChat.current = false; stopSpeaking(); stopListening(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function stopSpeaking() { synth?.cancel(); setSpeaking(false); }
  function stopListening() { try { recRef.current?.abort(); } catch { /* ignore */ } setListening(false); }

  const speak = useCallback((reply, done) => {
    if (!synth || !voiceOnRef.current || !reply) { done?.(); return; }
    synth.cancel();
    const clean = speakable(reply);
    const lang = isDev(clean) ? 'hi-IN' : 'en-IN';
    const voice = pickVoice(lang);
    const list = chunks(clean);
    setSpeaking(true);
    list.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = voice?.lang || lang; if (voice) u.voice = voice;
      u.rate = 0.98; u.pitch = 1.1;
      if (i === list.length - 1) { u.onend = () => { setSpeaking(false); done?.(); }; u.onerror = () => { setSpeaking(false); done?.(); }; }
      synth.speak(u);
    });
  }, []);

  const startListening = useCallback(() => {
    if (!SR) return;
    stopSpeaking();
    const rec = new SR();
    rec.lang = micLangRef.current; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    let finalText = ''; let interim = ''; let timer = null; let sent = false;
    const finish = () => { clearTimeout(timer); try { rec.stop(); } catch { /* ignore */ } };
    rec.onresult = (e) => {
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finalText += `${r[0].transcript} `; else interim += r[0].transcript; }
      const live = `${finalText}${interim}`.trim(); setText(live); setMicNote('');
      clearTimeout(timer); if (live) timer = setTimeout(finish, 1700); // stop after a short pause so one sentence is sent in one go
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { voiceChat.current = false; setMicNote('Microphone is blocked. Allow it in the browser settings.'); }
      else if (e.error === 'no-speech') noSpeech.current += 1;
      else if (e.error === 'network') { voiceChat.current = false; setMicNote('Voice needs an internet connection. You can type instead.'); }
    };
    rec.onend = () => {
      setListening(false);
      const t = `${finalText}${interim}`.trim();
      if (t && !sent) { sent = true; noSpeech.current = 0; sendRef.current?.(t, { fromMic: true }); return; }
      if (!t && voiceChat.current && noSpeech.current < 2) { startListening(); return; }
      if (!t) { voiceChat.current = false; setMicNote('I did not hear anything. Tap the mic and try again.'); }
    };
    recRef.current = rec; setListening(true); setMicNote('');
    try { rec.start(); } catch { setListening(false); }
  }, []);

  const send = useCallback(async (raw, opts = {}) => {
    const att = photoRef.current;
    const q = String(raw ?? '').trim() || (att ? 'What is wrong here?' : '');
    if (!q) return;
    stopSpeaking();
    if (!opts.fromMic && voiceChat.current) { voiceChat.current = false; stopListening(); }
    const userMsg = { role: 'user', content: q, image: att?.preview };
    const next = [...msgsRef.current, userMsg];
    setMsgs(next); setText(''); setBusy(true); setPhoto(null);
    const history = next.filter((m) => !m.greeting).map(({ role, content }) => ({ role, content }));
    try {
      const d = await api('/chat', { method: 'POST', body: { messages: history, pending: pendingRef.current, image: att ? { mime: att.mime, data: att.data } : undefined } });
      setPending(d.pending || null);
      setMsgs((m) => [...m, { role: 'assistant', content: d.reply, service: d.service, chips: d.chips, links: d.links }]);
      const after = () => { if (voiceChat.current && SR) setTimeout(startListening, 350); };
      speak(d.reply, after);
      if (!voiceOnRef.current || !synth) after();
      if (d.navigate) setTimeout(() => { navigate(d.navigate); if (window.innerWidth < 520) setOpen(false); }, 900);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', content: e.message || 'Something went wrong. Please try again.', error: true }]);
      voiceChat.current = false;
    } finally { setBusy(false); }
  }, [navigate, speak, startListening]);
  sendRef.current = send;

  if (provider || admin) return null; // partners and admins do not need the resident assistant

  const nameOf = (slug) => services.find((s) => s.slug === slug)?.name;
  const lastIdx = msgs.length - 1;
  const fresh = msgs.length <= 1;
  const toggleVoice = () => { if (speaking) { stopSpeaking(); return; } const v = !voiceOn; setVoiceOn(v); localStorage.setItem('saath_voice', v ? 'on' : 'off'); if (!v) stopSpeaking(); };
  const toggleMic = () => {
    if (listening) { voiceChat.current = false; stopListening(); return; }
    voiceChat.current = true; noSpeech.current = 0; startListening();
  };
  const flipLang = () => { const n = micLang === 'hi-IN' ? 'en-IN' : 'hi-IN'; setMicLang(n); localStorage.setItem('saath_mic_lang', n); };
  const onPhoto = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { setPhoto(await shrinkPhoto(f)); } catch (err) { setMsgs((m) => [...m, { role: 'assistant', content: err.message, error: true }]); }
  };

  return (
    <div className="chat-root">
      {open && (
        <section className="chat-panel" role="dialog" aria-label="Saath assistant" aria-modal="false">
          <header className="chat-head">
            <span className="chat-avatar" aria-hidden="true">S</span>
            <div className="chat-title">
              <b>Saath assistant</b>
              <small><i className={`chat-dot${speaking || listening ? ' live' : ''}`} />{listening ? 'Listening… speak now' : speaking ? 'Speaking…' : (status.provider === 'gemma' ? 'Powered by Gemma 4' : 'Hindi · English · Hinglish')}</small>
            </div>
            {synth && <button className={`chat-x${voiceOn ? ' on' : ''}`} onClick={toggleVoice} aria-label={speaking ? 'Stop speaking' : voiceOn ? 'Turn voice replies off' : 'Turn voice replies on'} title={voiceOn ? 'Voice replies on' : 'Voice replies off'}>{speaking ? '■' : voiceOn ? '🔊' : '🔇'}</button>}
            <button className="chat-x" onClick={() => { setMsgs([GREETING]); setPending(null); stopSpeaking(); }} aria-label="Start a new chat" title="New chat">↺</button>
            <button className="chat-x" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
          </header>

          <div className="chat-body" ref={bodyRef} aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`chat-row ${m.role}`}>
                <div className={`chat-bubble${m.error ? ' err' : ''}`}>
                  {m.image && <img className="chat-photo" src={m.image} alt="Your photo" />}
                  {m.content}
                </div>
                {m.service && nameOf(m.service) && !m.chips && <Link className="chat-cta" to={`/services/${m.service}`} onClick={() => setOpen(false)}>Open {nameOf(m.service)} →</Link>}
                {m.links?.map((l) => <Link key={l.to + l.label} className="chat-cta" to={l.to} onClick={() => window.innerWidth < 520 && setOpen(false)}>{l.label} →</Link>)}
                {i === lastIdx && !busy && m.chips?.length > 0 && (
                  <div className="chat-chips">{m.chips.map((c) => <button key={c.label} type="button" onClick={() => send(c.send)}>{c.label}</button>)}</div>
                )}
              </div>
            ))}
            {busy && <div className="chat-row assistant"><div className="chat-bubble typing" aria-label="Assistant is typing"><i /><i /><i /></div></div>}
            {fresh && !busy && <div className="chat-starters">{STARTERS.map((s) => <button key={s} type="button" onClick={() => send(s)}>{s}</button>)}</div>}
          </div>

          {photo && (
            <div className="chat-attach"><img src={photo.preview} alt="Photo to send" /><span>Photo ready. Add a question or just send.</span><button type="button" onClick={() => setPhoto(null)} aria-label="Remove photo">✕</button></div>
          )}
          {micNote && <p className="chat-micnote" role="status">{micNote}</p>}
          <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            {status.photos && (
              <>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
                <button type="button" className="chat-mic" onClick={() => fileRef.current?.click()} aria-label="Send a photo of the problem" title="Send a photo">📷</button>
              </>
            )}
            <input ref={inputRef} value={text} maxLength={600} onChange={(e) => setText(e.target.value)} placeholder={listening ? 'Listening…' : 'Type or speak…'} aria-label="Your message" autoComplete="off" />
            {SR && <button type="button" className="chat-lang" onClick={flipLang} aria-label="Speech language" title="Speech language: tap to switch">{micLang === 'hi-IN' ? 'हिं' : 'EN'}</button>}
            {SR && <button type="button" className={`chat-mic${listening ? ' on' : ''}`} onClick={toggleMic} aria-label={listening ? 'Stop listening' : 'Speak your question'} title="Speak">🎤</button>}
            <button type="submit" className="chat-send" disabled={busy || (!text.trim() && !photo)} aria-label="Send">➤</button>
          </form>
          <p className="chat-note">AI assistant. For anything urgent or risky, switch the appliance off and call 112.</p>
        </section>
      )}

      <button className={`chat-fab${open ? ' open' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? 'Close assistant' : 'Chat with Saath assistant'}>
        {open ? <span aria-hidden="true">✕</span> : (
          <>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5v-8Z" fill="currentColor" /><circle cx="9" cy="9.5" r="1.2" fill="#0A0805" /><circle cx="12.5" cy="9.5" r="1.2" fill="#0A0805" /><circle cx="16" cy="9.5" r="1.2" fill="#0A0805" /></svg>
            <span className="chat-fab-label">Ask Saath</span>
          </>
        )}
      </button>
    </div>
  );
}

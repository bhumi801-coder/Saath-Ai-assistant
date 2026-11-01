import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './transition.css';

/*
  Page-flip transition, inspired by the shader-style transitions of studio sites.

  A full-screen WebGL layer sweeps across the screen like a page being turned:
  a noisy, slanted edge with a champagne-gold glow and a soft fold shadow.
  The old page is covered, the route changes behind it, then the new page is
  revealed while #main tilts into place. Colours match the Saath black + gold theme.

  - Plays when a resident clicks any internal link, and on back/forward or redirects.
  - Plays once per browser tab as a short intro on first load.
  - Skipped for prefers-reduced-motion, for browsers without WebGL, and for
    ctrl/cmd/shift-clicks and target="_blank" links (they behave normally).
  - Nothing is drawn while idle, so it costs no battery between page changes.
*/

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uPhase;
uniform float uTime;

float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
float fbm(vec2 p){
  float v=0.,a=.5;
  for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=.5;}
  return v;
}

void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float asp=uRes.x/uRes.y;
  vec2 q=vec2(uv.x*asp,uv.y);

  // Sweep coordinate: slanted left-to-right, gently bent by low-frequency noise
  // so the edge reads as a page being turned, not a straight wipe.
  float n=noise(q*vec2(1.1,1.6)+vec2(0.,uTime*.1))*.65+noise(q*vec2(2.3,3.3)-vec2(0.,uTime*.08))*.35;
  float s=uv.x*.9+(uv.y-.5)*.28+.14+(n-.5)*.34;

  float cover=step(uPhase,1.);
  float t=cover>.5?uPhase:uPhase-1.;
  float e=mix(-.25,1.45,t);
  // d > 0 is the dark covered side, d < 0 is the page underneath
  float d=cover>.5?(e-s):(s-e);

  float mask=smoothstep(0.,.02,d);
  float glow=exp(-abs(d)*16.)*.6;
  float curl=1.-smoothstep(0.,.26,d);          // bright back of the turning page
  float shadow=(1.-mask)*exp(-max(-d,0.)*7.)*.6; // soft shadow cast on the page ahead

  vec3 ink=vec3(.02,.015,.008);
  vec3 gold=vec3(.78,.64,.42);
  vec3 hi=vec3(.95,.82,.56);

  float dust=fbm(q*7.+vec2(uTime*.2,-uTime*.12));
  vec3 col=ink+gold*dust*.05+gold*curl*curl*.45;

  vec3 rgb=col*mask+hi*glow;
  float a=clamp(mask+glow*.7+shadow,0.,1.);
  gl_FragColor=vec4(rgb,a);
}`;

function createEngine(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = shader(gl.VERTEX_SHADER, VERT);
  const fs = shader(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uPhase = gl.getUniformLocation(prog, 'uPhase');
  const uTime = gl.getUniformLocation(prog, 'uTime');

  // The edge is soft, so a reduced resolution looks the same and stays fast on phones.
  const SCALE = 0.7;
  const resize = () => {
    const w = Math.max(2, Math.round(window.innerWidth * SCALE));
    const h = Math.max(2, Math.round(window.innerHeight * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
  };

  return {
    draw(phase, time) {
      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uPhase, phase);
      gl.uniform1f(uTime, time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    destroy() {
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    },
  };
}

const ease = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  soft: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prefersReduced = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const INTRO_KEY = 'saath-intro-seen';
function wantsIntro() {
  if (prefersReduced()) return false;
  try { return !sessionStorage.getItem(INTRO_KEY); } catch { return false; }
}

export default function PageTransition() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const routeKey = pathname + search;
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const labelRef = useRef(null);
  const api = useRef(null);
  const S = useRef({ busy: false, pending: false, phase: 0, token: 0, key: routeKey, timer: 0 });
  const [boot, setBoot] = useState(wantsIntro);

  // Route changed: if we started it, reveal the new page; if not (back/forward,
  // redirect after login), cover instantly and reveal so it still feels the same.
  useLayoutEffect(() => {
    const st = S.current;
    if (st.key === routeKey) return;
    st.key = routeKey;
    if (!api.current) return;
    if (st.pending) {
      st.pending = false;
      api.current.reveal();
    } else if (!st.busy) {
      api.current.instant();
    }
  }, [routeKey]);

  useEffect(() => {
    const st = S.current;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const label = labelRef.current;
    if (!canvas || !wrap || prefersReduced()) { setBoot(false); return undefined; }
    const engine = createEngine(canvas);
    if (!engine) { setBoot(false); return undefined; }

    let raf = 0;
    let alive = true;
    const mainEl = () => document.getElementById('main');

    const show = (phase) => {
      st.phase = phase;
      const active = phase > 0.001 && phase < 1.999;
      wrap.classList.toggle('on', active);
      if (active) engine.draw(phase, performance.now() / 1000);
      label.style.opacity = String(Math.max(0, 1 - Math.abs(phase - 1) / 0.3));
    };

    // Animate the phase value. Returns false if a newer animation took over.
    const run = (from, to, ms, easing) => new Promise((resolve) => {
      const mine = ++st.token;
      const t0 = performance.now();
      const step = (now) => {
        if (!alive || st.token !== mine) { resolve(false); return; }
        const k = Math.min(1, (now - t0) / ms);
        show(from + (to - from) * easing(k));
        if (k < 1) raf = requestAnimationFrame(step); else resolve(true);
      };
      raf = requestAnimationFrame(step);
    });

    const reveal = async () => {
      clearTimeout(st.timer);
      st.busy = true;
      const m = mainEl();
      if (st.phase < 1) await run(st.phase, 1, 220, ease.out);
      show(1);
      if (m) {
        m.classList.remove('pt-out');
        m.classList.remove('pt-in');
        void m.offsetWidth; // restart the flip-in animation
        m.classList.add('pt-in');
      }
      await sleep(120);
      const ok = await run(1, 2, 950, ease.soft);
      if (!ok) return;
      show(2);
      st.busy = false;
      setTimeout(() => mainEl()?.classList.remove('pt-in'), 1200);
    };

    const instant = () => { st.busy = true; show(1); return reveal(); };

    const goTo = async (a, href) => {
      st.busy = true;
      st.pending = true;
      mainEl()?.classList.add('pt-out');
      const ok = await run(0, 1, 640, ease.inOut);
      if (!ok || !alive) return;
      // Click the original link again so react-router handles it (keeps state, replace, etc.).
      st.bypass = true;
      if (a.isConnected) a.click(); else navigate(href);
      st.bypass = false;
      // Safety net: if the route never changes, do not leave the screen covered.
      st.timer = setTimeout(() => { if (st.pending) { st.pending = false; reveal(); } }, 3000);
    };

    const onClick = (ev) => {
      if (st.bypass || st.busy || ev.defaultPrevented) return;
      if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const a = ev.target instanceof Element ? ev.target.closest('a[href]') : null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      let url;
      try { url = new URL(a.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      ev.preventDefault();
      ev.stopPropagation();
      goTo(a, url.pathname + url.search + url.hash);
    };
    document.addEventListener('click', onClick, true);

    api.current = { reveal, instant };

    if (boot) {
      try { sessionStorage.setItem(INTRO_KEY, '1'); } catch { /* private mode */ }
      st.busy = true;
      show(1);
      setBoot(false);
      sleep(450).then(() => { if (alive) reveal(); });
    }

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(st.timer);
      document.removeEventListener('click', onClick, true);
      api.current = null;
      st.busy = false;
      st.pending = false;
      st.bypass = false;
      engine.destroy();
      wrap.classList.remove('on');
      mainEl()?.classList.remove('pt-out', 'pt-in');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className="pt" data-boot={boot ? '1' : undefined} aria-hidden="true">
      <canvas ref={canvasRef} />
      <span ref={labelRef} className="pt-label">Saath</span>
    </div>
  );
}

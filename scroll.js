// Motion that follows the scroll, as on Apple's product pages: text and tiles rise in, the MacBook from our 3D teaser
// is scrubbed frame by frame while its section stays pinned, numbers count up, and one dark band holds the app's water.
// No libraries. With Reduce Motion everything simply appears and the MacBook shows its last frame.
import { makeWater } from './water.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (k) => 1 - Math.pow(1 - k, 3);

// ---- Reveal: .reveal elements get .in once they're a little way into the viewport.
const seen = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); }
}, { rootMargin: '0px 0px -12% 0px' });
for (const el of document.querySelectorAll('.reveal')) seen.observe(el);

// ---- Count-up: big numbers run from 0 to their value when they appear.
const counted = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    counted.unobserve(e.target);
    const el = e.target, to = Number(el.dataset.count), dec = Number(el.dataset.decimals || 0);
    const suffix = el.querySelector('small')?.outerHTML ?? '';
    const show = (v) => { el.innerHTML = v.toFixed(dec) + suffix; };
    if (reduce || to === 0) { show(to); continue; }
    const start = performance.now();
    const tick = (now) => { const k = Math.min(1, (now - start) / 1400); show(to * ease(k)); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
}, { threshold: 0.6 });
for (const el of document.querySelectorAll('[data-count]')) counted.observe(el);

// ---- Scrub: the pinned MacBook. Progress through the section picks the frame and the caption.
for (const section of document.querySelectorAll('.scrub')) scrub(section);

function scrub(section) {
  const canvas = section.querySelector('canvas');
  const g = canvas.getContext('2d');
  const captions = [...section.querySelectorAll('.scrub-caption')];
  const dots = [...section.querySelectorAll('.scrub-progress i')];
  const count = Number(section.dataset.frames);
  const tall = () => innerWidth / innerHeight < 0.8;
  let kind = tall() ? 'tall' : 'wide';
  let frames = [];
  let shown = -1, want = 0, raf = 0;

  // The stage size in device pixels, so frames draw sharp.
  function fit() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    shown = -1;
  }

  // Cover-fit a frame into the canvas, like object-fit: cover.
  function paint(img) {
    if (!img) return;
    const cw = canvas.width, ch = canvas.height, iw = img.width, ih = img.height;
    const k = Math.max(cw / iw, ch / ih), w = iw * k, h = ih * k;
    g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch);
    g.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  // Nearest loaded frame to the one we want, so scrubbing never shows a blank while frames stream in.
  function draw() {
    raf = 0;
    if (want === shown) return;
    let i = want;
    for (let d = 0; d < count; d++) { if (frames[want - d]) { i = want - d; break; } if (frames[want + d]) { i = want + d; break; } }
    if (!frames[i]) return;
    paint(frames[i]);
    shown = want === i ? i : -1;
  }

  function load(which) {
    kind = which;
    frames = new Array(count);
    const base = section.dataset[which];
    const pad = (n) => String(n).padStart(4, '0');
    const get = (i) => new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { frames[i] = img; if (Math.abs(i - want) < 3 || shown < 0) schedule(); resolve(); };
      img.onerror = resolve;
      img.src = `${base}${pad(i + 1)}.webp`;
    });
    // First the frame on screen, then every 8th (a coarse pass), then the rest: smooth sooner.
    const order = [Math.min(count - 1, want), 0];
    for (let i = 0; i < count; i += 8) order.push(i);
    for (let i = 0; i < count; i++) order.push(i);
    const queue = [...new Set(order)];
    let active = 0;
    const next = () => { while (active < 6 && queue.length) { active++; get(queue.shift()).then(() => { active--; next(); }); } };
    next();
  }

  function schedule() { if (!raf) raf = requestAnimationFrame(draw); }

  function onScroll() {
    const r = section.getBoundingClientRect();
    const span = section.offsetHeight - innerHeight;
    const p = reduce ? 1 : Math.min(1, Math.max(0, -r.top / Math.max(1, span)));
    want = Math.round(p * (count - 1));
    let active = -1;
    captions.forEach((c, i) => { const on = p >= Number(c.dataset.from) && p < Number(c.dataset.to); c.classList.toggle('on', on); if (on) active = i; });
    dots.forEach((d, i) => d.classList.toggle('on', i === active));
    schedule();
  }

  fit();
  load(kind);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { fit(); const k = tall() ? 'tall' : 'wide'; if (k !== kind) load(k); onScroll(); });
  onScroll();
}

// ---- The water moment: the app's water in a dark band, following the pointer like a fingertip.
const pool = document.querySelector('.water-moment .pool');
if (pool) {
  const water = makeWater(pool.querySelector('canvas'), { element: true, autoDrops: true, fingerRadius: 0.045, dark: true });
  if (water) {
    let lift = 0;
    const uv = (e) => { const r = pool.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    pool.addEventListener('pointermove', (e) => {
      water.press([uv(e)]);
      clearTimeout(lift);
      lift = setTimeout(() => water.lift(), 120);
    });
    pool.addEventListener('pointerleave', () => water.lift());
    pool.addEventListener('pointerdown', (e) => water.splash([uv(e)]));
  }
}

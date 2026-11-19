// Motion that follows the scroll, as on Apple's product pages: text and tiles rise in, the whole 3D teaser plays
// live as you scroll while its stage stays pinned, numbers count up, and one dark band holds the app's water.
// No libraries. With Reduce Motion everything simply appears and the film shows its end card.
import { makeWater } from './water.js?v=20261119d';

// WebGL2 is what the film, the Try it trackpad's water and the water band need. Browsers with graphics acceleration
// turned off (or a blocklisted GPU) don't have it; they get a still picture straight away instead of a blank box.
// Browsers that can't make a WebGL2 context (graphics acceleration off, a blocklisted GPU) still define the API; the
// film itself then reports failure and the still takes over. Probing with a real context here would cost up to a
// second on slow GPUs before anything else runs.
export const has3D = 'WebGL2RenderingContext' in window;

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

// ---- The film: the teaser's own 3D scene, embedded and rendered live; scroll progress is the film's clock.
const filmSection = document.querySelector('.film');
if (filmSection) film(filmSection);

function film(section) {
  const stage = section.querySelector('.film-stage');
  const frame = section.querySelector('.film-frame');
  const iframe = frame.querySelector('iframe');
  const fallback = frame.querySelector('.film-fallback');
  const nav = section.querySelector('.film-chapters');
  const bar = section.querySelector('.film-bar i');
  const DURATION = 39;
  // Each chapter lands just after its caption has settled (captions blur in over about half a second).
  const CHAPTERS = [['Tap', 1.6], ['Claude', 3.5], ['Reveal', 5.6], ['Gestures', 9.9], ['Packs', 21.0], ['Same tap', 27.1], ['Values', 31.3], ['End', 36.5]];
  let win = null, aspect = '', target = 0, shown = -1, current = 0, last = 0, raf = 0, onScreen = true, started = false;

  // Chapter buttons scroll to their moment in the film.
  const buttons = CHAPTERS.map(([label, t]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    b.addEventListener('click', () => scrollTo({ top: section.offsetTop + (section.offsetHeight - innerHeight) * (t / DURATION) + 1, behavior: reduce ? 'auto' : 'smooth' }));
    nav.append(b);
    return [b, t];
  });

  // Portrait screens get the film's 9:16 cut, everything else 16:9; either way it is scaled to fit, never cropped.
  function layout() {
    const want = stage.clientWidth / stage.clientHeight < 0.75 ? '9x16' : '16x9';
    const [w, h] = want === '9x16' ? [1080, 1920] : [1920, 1080];
    const scale = Math.min(stage.clientWidth / w, (stage.clientHeight - 64) / h);
    frame.classList.toggle('tall', want === '9x16');
    frame.style.transform = `translate(${(stage.clientWidth - w * scale) / 2}px, ${Math.max(0, (stage.clientHeight - 64 - h * scale) / 2)}px) scale(${scale})`;
    // Sharpness: the film's pixels match the screen's, up to about 2560 × 1440 (3.7 million pixels). Beyond that the
    // GPU memory grows fast for no visible gain, and weaker Macs and phones lose the tab. Phones' 3× screens get 2×:
    // half the pixels to fill, and the difference doesn't show at that size.
    const ratio = Math.min(Math.sqrt(3.7e6 / (w * h)), Math.max(0.5, scale * Math.min(2, devicePixelRatio || 1)));
    if (started && want !== aspect) {
      aspect = want; win = null;
      iframe.src = `film/index.html?aspect=${want}&bg=ffffff&v=20261119d`;
    }
    frame.dataset.ratio = ratio;
    if (win) { win.setPixelRatio(ratio); shown = -1; schedule(); }
  }

  // The still: for browsers without 3D, a film that failed, or one still loading after 12 s on a very slow line.
  // The section stops being a long scroll then, since there is nothing to scrub.
  function showStill() {
    if (!fallback.src) fallback.src = fallback.dataset.src;
    iframe.hidden = true; fallback.hidden = false;
    section.classList.add('still');
  }
  function showFilm() {
    iframe.hidden = false; fallback.hidden = true;
    section.classList.remove('still');
  }

  iframe.addEventListener('load', () => {
    const w = iframe.contentWindow;
    const wait = () => {
      if (w.failed) { showStill(); return; }
      if (w.ready === true) { win = w; showFilm(); win.setPixelRatio(Number(frame.dataset.ratio)); shown = -1; current = target; schedule(); return; }
      setTimeout(wait, 60);
    };
    wait();
  });
  // The film (three.js and its textures) is the page's heaviest part, so it never competes with the first paint:
  // it starts once the page has loaded and gone idle, or as soon as its stage nears the screen (an IntersectionObserver
  // reports only after a frame has painted), whichever comes first. Until it is ready the stage is plain white.
  function begin() {
    if (started) return;
    started = true;
    near.disconnect();
    if (!has3D) { showStill(); return; }
    layout();
    // No WebGL2 (or the film failed): show a still instead.
    // Its src is set only now, so visitors whose film plays never download the still.
    // If the film turns up later after all, it takes over again (see showFilm above).
    setTimeout(() => { if (!win) showStill(); }, 12000);
  }
  const near = new IntersectionObserver(([e]) => { if (e.isIntersecting) begin(); }, { rootMargin: '100% 0px' });
  near.observe(stage);
  const idle = () => (window.requestIdleCallback ? requestIdleCallback(begin, { timeout: 500 }) : setTimeout(begin, 200));
  if (document.readyState === 'complete') idle(); else addEventListener('load', idle, { once: true });

  function progress() {
    const span = section.offsetHeight - innerHeight;
    return reduce ? 1 : Math.min(1, Math.max(0, (scrollY - section.offsetTop) / Math.max(1, span)));
  }

  function onScroll() {
    target = progress() * DURATION;
    bar.style.transform = `scaleX(${target / DURATION})`;
    let active = 0;
    buttons.forEach(([, t], i) => { if (target + 0.05 >= (i ? CHAPTERS[i][1] - 0.4 : 0)) active = i; });
    buttons.forEach(([b], i) => b.setAttribute('aria-current', String(i === active)));
    schedule();
  }

  // The shown time follows the scroll with a short ease, so flicks and jumps play rather than step.
  function tick(now) {
    raf = 0;
    if (win && win.failed) { win = null; showStill(); return; }
    if (!win || !onScreen) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    current += (target - current) * (1 - Math.exp(-dt / 0.12));
    if (Math.abs(target - current) < 0.004) current = target;
    const t = Math.round(current * 1000) / 1000;
    if (t !== shown) { win.renderAt(t); shown = t; }
    if (current !== target) schedule(); else last = 0;
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(tick); }

  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) schedule(); }).observe(section);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { layout(); onScroll(); });
  layout();
  onScroll();
}

// ---- The water moment: the app's water in a dark band, following the pointer like a fingertip.
// Its WebGL context is made the first time the band comes within a viewport of the screen, not at page load.
const pool = document.querySelector('.water-moment .pool');
if (pool) {
  const near = new IntersectionObserver(([e]) => { if (e.isIntersecting) { near.disconnect(); pond(pool); } }, { rootMargin: '100% 0px' });
  near.observe(pool);
}

function pond(pool) {
  const water = makeWater(pool.querySelector('canvas'), { element: true, autoDrops: true, fingerRadius: 0.045, dark: true });
  if (!water) pool.querySelector('span').textContent = 'Turn on graphics acceleration in your browser to see the water.';
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

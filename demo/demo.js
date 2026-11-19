// "Try it": a virtual MacBook that answers TapDeck's gestures. The screen is the teaser's macOS desktop; the
// trackpad is the app's water. Phones and iPads use real fingers. On a Mac the browser never sees multi-finger
// trackpad taps (macOS keeps them), so visitors pick how many fingers and click.
import { makeScreen } from './screen.js?v=20261120a';
import { makeRecognizer, RULES, MOUSE_RULES } from './recognizer.js?v=20261120a';
import { makeWater } from '../water.js?v=20261120a';


// The app's default packs (Sources/Config/Packs.swift). App packs win while their app is in front.
const EVERYDAY = { name: 'Everyday Mac', dot: 'rainbow' };
const BROWSER = { name: 'Chrome', dot: '#4285F4' };
const BINDINGS = [
  { key: 'hold3', label: '3 fingers · hold', does: 'Mission Control', pack: EVERYDAY, run: (a, t) => (a.missionControl(t) ? 'Mission Control' : 'Close Mission Control') },
  { key: 'tap5x1', label: '5 fingers · tap', does: 'Play / pause', pack: EVERYDAY, run: (a, t) => a.playPause(t) },
  { key: 'corner-top-right', label: 'Top-right corner', does: 'Spotlight', pack: EVERYDAY, run: (a, t) => a.spotlight(t) },
  { key: 'corner-top-left', label: 'Top-left corner', does: 'Screenshot', pack: EVERYDAY, run: (a, t) => a.screenshot(t) },
];
// Chrome in front: the Chrome pack's gestures take over, so the same hold does something else.
// A binding's run() may return a string to say what actually happened this time.
const IN_CHROME = [
  { key: 'tap3x1', label: '3 fingers · tap', does: 'New tab', pack: BROWSER, run: (a, t) => (a.reopenTab(t) ? 'New tab' : 'New tab: the demo stops at four') },
  { key: 'hold3', label: '3 fingers · hold', does: 'Search tabs', pack: BROWSER, run: () => 'Search tabs' },
  { key: 'tap4x1', label: '4 fingers · tap', does: 'Reopen closed tab', pack: BROWSER, run: (a, t) => (a.reopenTab(t) ? 'Reopen closed tab' : 'Reopen closed tab: none left to reopen') },
  { key: 'tap4x2', label: '4 fingers · double tap', does: 'Close tab', pack: BROWSER, run: (a, t) => (a.closeTab(t) ? 'Close tab' : 'Close tab: the last tab stays open') },
];
const COUNT = ['', 'tap', 'double tap', 'triple tap'];

function start(root) {
  const screenCanvas = root.querySelector('.demo-screen canvas');
  const pad = root.querySelector('.demo-pad');
  const pill = root.querySelector('.demo-pill');
  const cheat = root.querySelector('.demo-cheat');
  const ring = root.querySelector('.demo-hold');
  // The 2048 px screen, its Dock icons and the pad's WebGL water are made the first time the demo comes within a
  // viewport of the screen (or is touched), not at page load; until then nothing here needs them.
  let screen = null, water = null;
  const ensure = () => {
    if (screen) return;
    screen = makeScreen(screenCanvas);
    // Without WebGL2 there's no water, but the gestures still work.
    water = makeWater(pad.querySelector('canvas'), { element: true, fingerRadius: 0.07, dark: false }) || { press() {}, lift() {}, splash() {} };
    screen.act.front(front);
    screen.ready.then(() => screen.draw(now()));
  };
  const near = new IntersectionObserver(([e]) => { if (e.isIntersecting) { near.disconnect(); ensure(); } }, { rootMargin: '100% 0px' });
  near.observe(root);
  const now = () => performance.now() / 1000;
  let front = 'finder';
  let fingers = 4;

  const bindings = () => (front === 'chrome' ? [...IN_CHROME, ...BINDINGS.filter((b) => !IN_CHROME.some((c) => c.key === b.key))] : BINDINGS);

  // Cheat sheet: what each gesture does with the current app in front.
  function renderCheat() {
    cheat.innerHTML = '';
    for (const b of bindings()) {
      const li = document.createElement('li');
      li.dataset.key = b.key;
      li.innerHTML = `<span class="dot"></span><b></b><span class="does"></span>`;
      li.querySelector('.dot').style.background = b.pack.dot === 'rainbow' ? 'var(--rainbow-x)' : b.pack.dot;
      li.querySelector('b').textContent = b.label;
      li.querySelector('.does').textContent = b.does;
      cheat.append(li);
    }
  }
  renderCheat();

  let pillTimer = 0;
  function say(textContent, pack, ok = true) {
    pill.className = `demo-pill show${ok ? '' : ' hint'}`;
    pill.querySelector('.dot').style.background = !pack ? 'transparent' : pack.dot === 'rainbow' ? 'var(--rainbow-x)' : pack.dot;
    pill.querySelector('.text').textContent = textContent;
    clearTimeout(pillTimer);
    pillTimer = setTimeout(() => pill.classList.remove('show'), 2600);
  }

  // One highlight timer, restarted by each gesture, so a repeat isn't cut short by the one before.
  let litTimer = 0;
  function light(key) {
    for (const li of cheat.children) li.classList.toggle('lit', li.dataset.key === key);
    clearTimeout(litTimer);
    litTimer = setTimeout(() => { for (const li of cheat.children) li.classList.remove('lit'); }, 1400);
  }

  function onGesture(g) {
    const key = g.kind === 'corner' ? `corner-${g.corner}` : g.kind === 'hold' ? `hold${g.fingers}` : `tap${g.fingers}x${g.count}`;
    const b = bindings().find((x) => x.key === key);
    const what = g.kind === 'corner' ? `${g.corner.replace('-', ' ')} corner` : `${g.fingers} finger${g.fingers > 1 ? 's' : ''} · ${g.kind === 'hold' ? 'hold' : COUNT[g.count]}`;
    // Mission Control stays up until something else happens; its own hold toggles it.
    if (key !== 'hold3') screen.act.closeMissionControl(now());
    if (!b) {
      say(`${what}: not set up here. Try one from the list.`, null, false);
      return;
    }
    const did = b.run(screen.act, now());
    say(`${what} → ${typeof did === 'string' ? did : b.does}`, b.pack);
    light(key);
  }
  // A touch that was neither a tap nor a hold would otherwise do nothing at all; say why.
  function onReject({ reason, duration }) {
    say(reason === 'moved' ? (duration > 0.5 ? 'You moved while holding: keep still for 1.5 s' : 'You moved while tapping: keep still')
      : 'That was a long press: tap quickly, or hold for 1.5 s for a hold', null, false);
  }
  const onHolding = (k) => { ring.style.setProperty('--k', k); ring.classList.toggle('on', k > 0); };
  const aspect = () => { const r = pad.getBoundingClientRect(); return r.width / r.height || 1; };
  // Clicks get roomier timing than fingers (see MOUSE_RULES); touch screens keep the app's rules.
  const mouseRec = makeRecognizer({ onGesture, onHolding, onReject, aspect, rules: MOUSE_RULES });
  const touchRec = makeRecognizer({ onGesture, onHolding, onReject, aspect, rules: RULES });

  // ---- Input. Real fingers on touch screens; on a Mac, the picked number of fingers at each click.
  const rect = () => pad.getBoundingClientRect();
  const toUV = (x, y) => { const r = rect(); return [Math.min(1, Math.max(0, (x - r.left) / r.width)), Math.min(1, Math.max(0, (y - r.top) / r.height))]; };
  // Only the top corners have bindings and dashed boxes, so a click lower down is an ordinary tap. The boxes
  // end exactly at the corner zone's inner edge (styles.css), so what you see is what counts.
  const corners = ([u, v]) => (u < RULES.cornerSize || u > 1 - RULES.cornerSize) && v < RULES.cornerSize;
  // A click stands for several fingertips side by side, so the water shows them all.
  const spread = ([u, v], n) => Array.from({ length: n }, (_, i) => [u + (i - (n - 1) / 2) * 0.075, v + Math.abs(i - (n - 1) / 2) * 0.03]);

  let mouse = null;
  pad.addEventListener('pointerdown', (e) => {
    ensure();
    if (e.pointerType === 'touch') return;          // touch screens use the touch events below
    if (e.button !== 0) return;                     // right and middle clicks aren't taps
    e.preventDefault();
    pad.setPointerCapture(e.pointerId);
    const uv = toUV(e.clientX, e.clientY);
    const n = corners(uv) ? 1 : fingers;            // a click in a corner is a one-finger corner tap
    mouse = { n };
    const pts = spread(uv, n);
    water.press(pts);
    mouseRec.update(pts, e.timeStamp / 1000);
  });
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  pad.addEventListener('pointermove', (e) => {
    if (!mouse || e.pointerType === 'touch') return;
    const pts = spread(toUV(e.clientX, e.clientY), mouse.n);
    water.press(pts);
    mouseRec.update(pts, e.timeStamp / 1000);
  });
  const up = (e) => {
    if (!mouse || e.pointerType === 'touch') return;
    const pts = spread(toUV(e.clientX, e.clientY), mouse.n);
    mouse = null;
    water.lift();
    water.splash(pts);
    mouseRec.update([], e.timeStamp / 1000);
  };
  pad.addEventListener('pointerup', up);
  pad.addEventListener('pointercancel', up);

  let lastTouch = [];
  const touchPoints = (e) => [...e.touches].map((t) => toUV(t.clientX, t.clientY));
  const onTouch = (e) => {
    ensure();
    e.preventDefault();
    const pts = touchPoints(e);
    if (pts.length) { water.press(pts); lastTouch = pts; } else { water.lift(); water.splash(lastTouch); }
    touchRec.update(pts, e.timeStamp / 1000);
  };
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) pad.addEventListener(type, onTouch, { passive: false });

  // Finger picker: buttons, or the keys 3, 4 and 5 while the demo is on screen.
  const picker = root.querySelectorAll('.demo-fingers button');
  const pick = (n) => {
    fingers = n;
    for (const b of picker) b.setAttribute('aria-pressed', String(Number(b.dataset.n) === n));
  };
  for (const b of picker) b.addEventListener('click', () => pick(Number(b.dataset.n)));
  pick(4);
  let inView = false;
  addEventListener('keydown', (e) => {
    if (!inView || e.metaKey || e.ctrlKey || e.altKey || /input|textarea/i.test(e.target.tagName)) return;
    if (['3', '4', '5'].includes(e.key)) pick(Number(e.key));
  });

  // Front app: the same tap does different things in Finder and Chrome.
  const apps = root.querySelectorAll('.demo-apps button');
  for (const b of apps) b.addEventListener('click', () => {
    front = b.dataset.app;
    ensure();
    screen.act.front(front);
    for (const x of apps) x.setAttribute('aria-pressed', String(x === b));
    renderCheat();
    say(front === 'chrome' ? 'Chrome is in front: its Chrome pack takes over' : 'Finder is in front', front === 'chrome' ? BROWSER : EVERYDAY);
  });

  // Touch screens get real fingers, so the picker hides there.
  if (matchMedia('(pointer: coarse)').matches) root.classList.add('touch');

  // Draw the screen only while the demo is visible.
  let running = false;
  const frame = () => {
    if (!inView) { running = false; return; }
    ensure();
    screen.draw(now());
    requestAnimationFrame(frame);
  };
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (inView && !running) { running = true; requestAnimationFrame(frame); }
  }).observe(root);
}

const root = document.querySelector('.demo');
if (root) start(root);

// The six pack cards, drawn like PacksView.swift's PackCard in light mode, floating above the keyboard.
import * as THREE from 'three';
import { PACK, RAINBOW, clamp, easeOutCubic, easeOutBack, easeInOutCubic, smooth } from './timeline.js';

const CW = 760, CH = 380, M = 48;   // card size, plus a margin for its soft shadow
const FONT = '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif';
export const ORDER = ['everyday-mac', 'claude', 'browser', 'code-editors', 'xcode', 'terminal'];
const INFO = {
  'everyday-mac': { count: 8 },
  claude: { count: 3 },
  browser: { count: 6 },
  'code-editors': { count: 14 },
  xcode: { count: 5 },
  terminal: { count: 3 },
};

// Exactly what Settings › Packs shows (Sources/Config/Packs.swift, PacksView.swift): each pack's apps
// in order, and the apps whose icon becomes the tile (the first one installed wins).
const APP = {
  claude: 'com.anthropic.claudefordesktop',
  browsers: ['com.google.Chrome', 'com.apple.Safari', 'company.thebrowser.dia', 'company.thebrowser.Browser', 'com.brave.Browser', 'com.microsoft.edgemac'],
  editors: ['com.microsoft.VSCode', 'com.todesktop.230313mzl4w4u92', 'dev.zed.Zed', 'com.exafunction.windsurf'],
  jetBrains: ['com.jetbrains.pycharm', 'com.jetbrains.pycharm.ce', 'com.jetbrains.intellij', 'com.jetbrains.intellij.ce', 'com.jetbrains.WebStorm',
    'com.jetbrains.goland', 'com.jetbrains.CLion', 'com.jetbrains.rider', 'com.jetbrains.PhpStorm', 'com.jetbrains.rubymine'],
  neovide: 'com.neovide.neovide',
  xcode: 'com.apple.dt.Xcode',
  terminals: ['com.mitchellh.ghostty', 'com.apple.Terminal', 'com.googlecode.iterm2', 'dev.warp.Warp-Stable'],
};
const PACK_APPS = {
  'everyday-mac': { apps: [], iconApps: [] },
  claude: { apps: [APP.claude], iconApps: [APP.claude] },
  browser: { apps: APP.browsers, iconApps: ['company.thebrowser.dia', 'com.google.Chrome', 'com.apple.Safari'] },
  'code-editors': { apps: [...APP.editors, ...APP.jetBrains, APP.neovide], iconApps: ['dev.zed.Zed'] },
  xcode: { apps: [APP.xcode], iconApps: [APP.xcode] },
  terminal: { apps: APP.terminals, iconApps: APP.terminals },
};
// AppInfo.knownNames, for the scope text and the lettered discs of apps that aren't installed.
const NAMES = {
  'com.anthropic.claudefordesktop': 'Claude', 'com.google.Chrome': 'Chrome', 'com.apple.Safari': 'Safari', 'company.thebrowser.dia': 'Dia',
  'company.thebrowser.Browser': 'Arc', 'com.brave.Browser': 'Brave', 'com.microsoft.edgemac': 'Edge', 'com.microsoft.VSCode': 'VS Code',
  'com.todesktop.230313mzl4w4u92': 'Cursor', 'dev.zed.Zed': 'Zed', 'com.exafunction.windsurf': 'Windsurf', 'com.neovide.neovide': 'Neovim',
  'com.jetbrains.pycharm': 'PyCharm', 'com.jetbrains.pycharm.ce': 'PyCharm CE', 'com.jetbrains.intellij': 'IntelliJ IDEA',
  'com.jetbrains.intellij.ce': 'IntelliJ IDEA CE', 'com.jetbrains.WebStorm': 'WebStorm', 'com.jetbrains.goland': 'GoLand',
  'com.jetbrains.CLion': 'CLion', 'com.jetbrains.rider': 'Rider', 'com.jetbrains.PhpStorm': 'PhpStorm', 'com.jetbrains.rubymine': 'RubyMine',
  'com.apple.dt.Xcode': 'Xcode', 'com.mitchellh.ghostty': 'Ghostty', 'com.apple.Terminal': 'Terminal', 'com.googlecode.iterm2': 'iTerm2',
  'dev.warp.Warp-Stable': 'Warp',
};
// RetroAppleTile.stripes.
const APPLE_STRIPES = ['rgb(97,186,69)', 'rgb(252,184,38)', 'rgb(245,130,31)', 'rgb(224,59,61)', 'rgb(150,61,150)', 'rgb(3,158,219)'];
const PT = 100 / 44;      // canvas pixels per app point: the tile is 44 pt in the app, 100 px here
const ICONS = {};         // bundle ID → loaded <img>, only for installed apps
// One icon set for the whole film: the Dock (screen.js) already loads these files, so the cards reuse them
// instead of a second copy per bundle ID.
const ICON_FILE = {
  'com.anthropic.claudefordesktop': 'claude', 'com.google.Chrome': 'chrome', 'com.apple.Safari': 'safari',
  'company.thebrowser.dia': 'dia', 'com.todesktop.230313mzl4w4u92': 'cursor', 'dev.zed.Zed': 'zed',
  'com.jetbrains.pycharm': 'pycharm', 'com.jetbrains.rider': 'rider', 'com.apple.dt.Xcode': 'xcode',
  'com.mitchellh.ghostty': 'ghostty', 'com.apple.Terminal': 'terminal',
};

async function loadIcons() {
  let installed = [];
  try { installed = await (await fetch('out/icons/installed.json')).json(); } catch { /* none exported */ }
  await Promise.all(installed.filter((id) => ICON_FILE[id]).map((id) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { ICONS[id] = img; resolve(); };
    img.onerror = resolve;
    img.src = `out/icons/${ICON_FILE[id]}.webp`;
  })));
}

function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function stripes(g, x, y, w, h, alpha = 1) {
  g.save(); g.globalAlpha *= alpha;
  RAINBOW.forEach((c, i) => { g.fillStyle = c; g.fillRect(x, y + (h * i) / 6, w, h / 6 + 1); });
  g.restore();
}

/// PackTile: the real icon of the pack's first installed app, else the retro Apple tile.
function tile(g, id, x, y, s, on) {
  g.save();
  const icon = PACK_APPS[id].iconApps.map((a) => ICONS[a]).find(Boolean);
  if (icon) {
    g.globalAlpha = on ? 1 : 0.9;
    g.filter = on ? 'none' : 'saturate(0.75)';
    if (on) { g.shadowColor = rgbaOf(ACCENT[id], 0.45); g.shadowBlur = 14 * PT; g.shadowOffsetY = 2 * PT; }
    const big = s * 1.1;
    g.drawImage(icon, x - (big - s) / 2, y - (big - s) / 2, big, big);
  } else {
    // RetroAppleTile: a white tile with the Apple logo in six stripes.
    if (on) { g.shadowColor = 'rgba(3,158,219,0.3)'; g.shadowBlur = 14 * PT; g.shadowOffsetY = 2 * PT; }
    rr(g, x, y, s, s, s * 0.26); g.fillStyle = '#FFFFFF'; g.fill();
    g.shadowColor = 'transparent';
    g.lineWidth = 0.5; g.strokeStyle = DARK.faint; g.stroke();
    const lw = s * 0.58, lh = s * 0.68, c = document.createElement('canvas');
    c.width = Math.ceil(lw * PT * 2); c.height = Math.ceil(lh * PT * 2);
    const cg = c.getContext('2d');
    APPLE_STRIPES.forEach((col, i) => { cg.fillStyle = col; cg.fillRect(0, (c.height * i) / 6, c.width, c.height / 6 + 1); });
    cg.globalCompositeOperation = 'destination-in';
    cg.fillStyle = '#000'; cg.textAlign = 'center'; cg.textBaseline = 'alphabetic';
    cg.font = `${c.height * 1.12}px -apple-system, "SF Pro Display"`;
    const m = cg.measureText('\uF8FF');
    const gh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    const k = Math.min(c.width / (m.actualBoundingBoxLeft + m.actualBoundingBoxRight), c.height / gh);
    cg.translate(c.width / 2, c.height / 2); cg.scale(k, k);
    cg.fillText('\uF8FF', (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
    g.filter = on ? 'none' : 'saturate(0.75)';
    g.drawImage(c, x + (s - lw) / 2, y + (s - lh) / 2, lw, lh);
  }
  g.restore();
}

/// ScopeLabel: "Everywhere", or up to seven app icons (installed first) and a short text.
function scope(g, id, x, y) {
  const apps = PACK_APPS[id].apps;
  const h = apps.length ? 24 : 19;
  g.save();
  g.font = `600 ${11}px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left';
  if (!apps.length) {
    const label = 'Everywhere', gw = 9;
    const w = 8 + gw + 4 + g.measureText(label).width + 8;
    rr(g, x, y, w, h, h / 2); g.fillStyle = DARK.faint; g.fill();
    // SF Symbol "globe".
    const cx = x + 8 + gw / 2, cy = y + h / 2, r = gw / 2 - 1;
    g.strokeStyle = DARK.muted; g.lineWidth = 1.1;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(cx, cy, r * 0.45, r, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.stroke();
    g.fillStyle = DARK.muted; g.fillText(label, x + 8 + gw + 4, cy + 1);
    g.restore();
    return;
  }
  const shown = [...apps.filter((a) => ICONS[a]), ...apps.filter((a) => !ICONS[a])].slice(0, 7);
  const names = apps.map((a) => NAMES[a]);
  const text = names.length <= 2 ? names.join(', ') : apps.length > 7 ? `+${apps.length - 7}` : `${apps.length} apps`;
  const b = 20, step = b - 3;
  const w = 3 + b + step * (shown.length - 1) + 6 + g.measureText(text).width + 8;
  rr(g, x, y, w, h, h / 2); g.fillStyle = DARK.faint; g.fill();
  shown.forEach((a, i) => {
    const bx = x + 3 + i * step, by = y + 2;
    if (ICONS[a]) {
      const big = b * 1.15;
      g.drawImage(ICONS[a], bx - (big - b) / 2, by - (big - b) / 2, big, big);
    } else {
      // A lettered disc for an app that isn't installed.
      const cx = bx + b / 2, cy = by + b / 2, r = (b - 2) / 2;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = DARK.cream; g.fill();
      g.lineWidth = 0.5; g.strokeStyle = DARK.faint; g.stroke();
      g.fillStyle = DARK.muted; g.textAlign = 'center';
      g.font = `700 ${b * 0.5}px ui-rounded, ${FONT}`;
      g.fillText(NAMES[a][0], cx, cy + 1);
      g.textAlign = 'left'; g.font = `600 ${11}px ${FONT}`;
    }
  });
  g.fillStyle = DARK.muted;
  g.fillText(text, x + 3 + b + step * (shown.length - 1) + 6, y + h / 2 + 1);
  g.restore();
}

// The app in dark mode (Theme.swift, dark values).
const DARK = {
  card: 'rgba(29,32,39,0.94)', ink: '#F2F3F5', muted: 'rgba(242,243,245,0.62)', faint: 'rgba(255,255,255,0.12)',
  rim: 'rgba(255,255,255,0.16)', cream: '#2B3038',
};
// PackStyle.accent / floodFill / switchFill, dark variants.
const ACCENT = { 'everyday-mac': 'rgb(252,184,38)', claude: '#D97757', browser: '#7FB2EE', 'code-editors': '#E6E7EA', xcode: '#1F8BF0', terminal: '#3D52C8' };
const SWITCH = { claude: ['#E58B6A', '#D06A45'], 'code-editors': ['#FAFAFA', '#C4C7CC'], xcode: ['#3FA9FF', '#0A63D6'], terminal: ['#4F6BFF', '#1D2756'] };
const SUMMARY = {
  'everyday-mac': 'Windows, Mission Control, Spotlight, media and lock screen, in every app.',
  claude: "Open Claude from anywhere; new chat and stop while you're in it.",
  browser: 'Tabs, private windows, refresh and DevTools in Chrome, Safari, Dia, Arc, Brave and Edge.',
  'code-editors': 'Command palette, quick open, AI suggestions and the terminal in VS Code, Cursor, Zed, Windsurf, JetBrains IDEs and Neovim.',
  xcode: 'Run, stop, build and open quickly in Xcode; bring up the iOS Simulator from anywhere.',
  terminal: 'New tab, interrupt and clear in Ghostty, Terminal, iTerm2 and Warp.',
};
const ROUNDED = 'ui-rounded, "SF Pro Rounded", -apple-system, sans-serif';

/// SwiftUI's .spring(response:dampingFraction:) from rest, as a 0 → 1 curve (it overshoots when underdamped).
export function spring(t, response, damping) {
  if (t <= 0) return 0;
  const w0 = (2 * Math.PI) / response, wd = w0 * Math.sqrt(1 - damping * damping);
  return 1 - Math.exp(-damping * w0 * t) * (Math.cos(wd * t) + ((damping * w0) / wd) * Math.sin(wd * t));
}
const SNAPPY = [0.32, 0.78], WOBBLE = [0.45, 0.6];
const PRESS = 0.16;   // the finger is down this long before the switch flips

/// Everything that moves when a pack is switched on, exactly as PackCard, GlassCard and LiquidSwitch animate it.
function switchState(t, onAt) {
  if (onAt == null) return { level: 0, knob: 21, slosh: 0, flood: 0 };
  const down = spring(t - (onAt - PRESS), ...SNAPPY), up = spring(t - onAt, ...WOBBLE);
  return {
    level: up,                                                         // the liquid fills with the wobble spring
    knob: 21 + 6 * down - 6 * up,                                      // stretches while pressed, springs back
    slosh: t < onAt ? 0 : 1 - spring(t - onAt, 0.9, 0.35),             // the slosh dies away
    flood: spring(t - onAt, 0.7, 0.8),                                 // the wash grows from the switch corner
  };
}

function wrap(g, text, width) {
  const lines = [];
  let line = '';
  for (const w of text.split(' ')) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > width && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function drawCard(g, id, t, onAt) {
  const st = switchState(t, onAt);
  const on = st.level > 0.5;
  const W = CW / PT;                                   // the card's width in app points
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, CW + 2 * M, CH + 2 * M);
  g.translate(M, M);
  g.scale(PT, PT);

  // Lay out the text first: the card is as tall as its summary needs, like the app's VStack.
  g.font = `400 12.5px ${FONT}`;
  const lines = wrap(g, SUMMARY[id], W - 32);
  const sumY = 16 + 48 + 12, rowY = sumY + lines.length * 15.5 + 12, H = rowY + 15 + 16;
  const R = 20;

  g.shadowColor = 'rgba(0,0,0,0.28)'; g.shadowBlur = 16 * PT; g.shadowOffsetY = 7 * PT;
  rr(g, 0, 0, W, H, R); g.fillStyle = DARK.card; g.fill();
  g.shadowColor = 'transparent';

  // GlassCard's flood: a circle growing from 40 pt in from the top-right corner reveals the pack's wash.
  if (st.flood > 0.001) {
    g.save(); rr(g, 0, 0, W, H, R); g.clip();
    const d = 2.2 * Math.hypot(W, H), cx = W - 40, cy = 28;
    g.beginPath(); g.arc(cx, cy, (d / 2) * st.flood, 0, Math.PI * 2); g.clip();
    let wash;
    if (id === 'everyday-mac') {
      wash = g.createLinearGradient(0, 0, 0, H);
      APPLE_STRIPES.forEach((c, i) => wash.addColorStop(i / 5, c.replace('rgb', 'rgba').replace(')', ',0.24)')));
    } else if (id === 'browser') {
      wash = g.createLinearGradient(W, 0, 0, H);
      wash.addColorStop(0, 'rgba(156,199,245,0.38)'); wash.addColorStop(0.5, 'rgba(255,212,92,0.3)'); wash.addColorStop(1, 'rgba(245,154,58,0.22)');
    } else {
      const k = id === 'code-editors' ? 0.16 : 0.3;
      wash = g.createRadialGradient(W, 0, 0, W, 0, 520);
      wash.addColorStop(0, rgbaOf(ACCENT[id], k)); wash.addColorStop(1, rgbaOf(ACCENT[id], k * 0.35));
    }
    g.fillStyle = wash; g.fillRect(0, 0, W, H);
    g.restore();
  }
  rr(g, 0.5, 0.5, W - 1, H - 1, R - 0.5); g.lineWidth = 1; g.strokeStyle = DARK.rim; g.stroke();
  rr(g, 0.25, 0.25, W - 0.5, H - 0.5, R - 0.25); g.lineWidth = 0.5; g.strokeStyle = DARK.faint; g.stroke();

  tile(g, id, 16, 16, 44, on);
  g.fillStyle = DARK.ink; g.font = `700 16px ${ROUNDED}`; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.fillText(PACK[id].name, 72, 31);
  scope(g, id, 72, 40);

  g.font = `400 12.5px ${FONT}`; g.fillStyle = DARK.muted;
  lines.forEach((l, i) => g.fillText(l, 16, sumY + 12 + i * 15.5));
  // "› 8 shortcuts": SF Symbol chevron.right, 10 pt bold, then 12 pt semibold.
  g.strokeStyle = DARK.muted; g.lineWidth = 1.6; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(18, rowY + 4); g.lineTo(21.5, rowY + 7.5); g.lineTo(18, rowY + 11); g.stroke();
  g.font = `600 12px ${FONT}`; g.fillText(`${INFO[id].count} shortcuts`, 30, rowY + 12);

  liquidSwitch(g, id, W - 16 - 46, 16, st);
}

/// LiquidSwitch: a 46 × 26 track that fills with the pack's colours behind a wavy, sloshing edge.
function liquidSwitch(g, id, x, y, st) {
  const w = 46, h = 26;
  g.save();
  rr(g, x, y, w, h, h / 2); g.fillStyle = DARK.cream; g.fill();
  if (st.level > 0.001) {
    g.save(); rr(g, x, y, w, h, h / 2); g.clip();
    let fill;
    if (id === 'everyday-mac') {
      fill = g.createLinearGradient(0, y, 0, y + h);
      APPLE_STRIPES.forEach((c, i) => { fill.addColorStop(i / 6, c); fill.addColorStop((i + 1) / 6, c); });
    } else if (id === 'browser') {
      fill = g.createLinearGradient(x, y, x + w, y + h);
      ['#9CC7F5', '#FFD45C', '#F59A3A'].forEach((c, i) => fill.addColorStop(i / 2, c));
    } else {
      fill = g.createLinearGradient(0, y, 0, y + h);
      SWITCH[id].forEach((c, i, a) => fill.addColorStop(i / (a.length - 1), c));
    }
    // WaveFill: filled from the left up to `level`, its leading edge a sine that sloshes.
    const edge = x + w * st.level, amp = 3 * st.slosh, phase = st.slosh * 6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(edge, y);
    for (let i = 0; i <= 16; i++) g.lineTo(edge + amp * Math.sin(phase + (i / 16) * Math.PI * 2), y + (h * i) / 16);
    g.lineTo(x, y + h); g.closePath(); g.fillStyle = fill; g.fill();
    g.restore();
  }
  rr(g, x + 0.25, y + 0.25, w - 0.5, h - 0.5, h / 2); g.lineWidth = 0.5; g.strokeStyle = DARK.faint; g.stroke();
  // The knob rides from the leading to the trailing edge, 2.5 pt in, widening while pressed.
  const kw = st.knob, kx = x + 2.5 + (w - 5 - kw) * st.level;
  g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 4 * PT; g.shadowOffsetY = 1 * PT;
  rr(g, kx, y + 2.5, kw, 21, 10.5); g.fillStyle = '#FFFFFF'; g.fill();
  g.restore();
}

function rgbaOf(c, a) {
  if (c.startsWith('#')) return hexA(c, a);
  return c.replace('rgb', 'rgba').replace(')', `,${a})`);
}

function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }

export function makeCards(tall = false) {
  const ready = loadIcons();
  const group = new THREE.Group();
  const W = 10.2, H = (W * CH) / CW, PW = W * (CW + 2 * M) / CW, PH = H * (CH + 2 * M) / CH;
  const cards = ORDER.map((id, i) => {
    const canvas = document.createElement('canvas'); canvas.width = CW + 2 * M; canvas.height = CH + 2 * M;
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat);
    const col = i % 3, row = Math.floor(i / 3);
    // A 3 × 2 grid floating in the white space, where the laptop was.
    const place = tall
      ? { x: ((i % 2) - 0.5) * (W + 0.9), y: 20.6 - Math.floor(i / 2) * 5.6, z: 0 }
      : { x: (col - 1) * (W + 1.0), y: row === 0 ? 17.9 : 12.3, z: (col - 1) * (col - 1) * -1.2 };
    mesh.userData = { id, g: canvas.getContext('2d'), tex, ...place, row, i, last: -1 };
    group.add(mesh);
    return mesh;
  });

  function update(t, tl) {
    const [r0, r1] = tl.packs.rise, [s0, s1] = tl.packs.sink;
    group.visible = t > r0 && t < s1 + 0.05;
    if (!group.visible) return;
    for (const m of cards) {
      const d = m.userData;
      const rise = easeOutCubic(clamp((t - r0 - d.i * 0.14) / (r1 - r0 - 0.7))) * (1 - easeInOutCubic(clamp((t - s0 - d.i * 0.05) / (s1 - s0 - 0.25))));
      m.rotation.set(lerp(-0.6, 0, rise), (1 - d.x / 11.2 * 0) * -d.x * 0.012, 0);
      m.position.set(d.x, d.y - (1 - rise) * 3.5 + 0.18 * Math.sin(t * 1.3 + d.i), d.z);
      m.material.opacity = clamp(rise * 1.5);
      const onAt = tl.packs.on[d.id];
      // Redraw every frame while the switch is moving, then only on state changes.
      const moving = onAt != null && t > onAt - PRESS - 0.02 && t < onAt + 2.5;
      const key = moving ? Math.round(t * 1000) : onAt != null && t >= onAt ? 'on' : 'off';
      if (key !== d.last) { drawCard(d.g, d.id, t, onAt); d.tex.needsUpdate = true; d.last = key; }
    }
  }
  return { group, update, ready };
}

const lerp = (a, b, k) => a + (b - a) * k;

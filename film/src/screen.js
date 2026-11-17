// The laptop's display: a realistic light-mode macOS desktop drawn on a canvas each frame.
// The wallpaper is original (an iridescent look-alike made in code); Dock icons come from the apps on this Mac.
import * as THREE from 'three';
import { clamp, lerp, smooth, easeOutCubic, easeOutBack, easeInOutCubic, PACK } from './timeline.js';

export const SW = 2048, SH = Math.round(2048 / 1.532);
const FONT = '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif';
const MENU = 48;
const DOCK_H = 104;
const INK = '#1d1d1f', INK2 = 'rgba(29,29,31,0.62)', LINE = 'rgba(0,0,0,0.1)', FAINT = 'rgba(0,0,0,0.07)';
const ICONS = ['finder', 'safari', 'chrome', 'dia', 'claude', 'zed', 'cursor', 'ghostty', 'xcode', 'simulator', 'notes', 'calendar', 'settings'];

function rr(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const R = (x, y, w, h) => ({ x, y, w, h });
const lerpRect = (a, b, k) => R(lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.w, b.w, k), lerp(a.h, b.h, k));
const bar = (g, x, y, w, h, c) => { rr(g, x, y, w, h, h / 2); g.fillStyle = c; g.fill(); };
const text = (g, s, x, y, size, color = INK, weight = 400, align = 'left') => {
  g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align; g.fillText(s, x, y); g.textAlign = 'left';
};

/// An original wallpaper with an iridescent, silky feel: soft pastel light and flowing bands. Deterministic.
function wallpaper() {
  const c = document.createElement('canvas'); c.width = SW; c.height = SH;
  const g = c.getContext('2d');
  const base = g.createLinearGradient(0, 0, SW, SH);
  base.addColorStop(0, '#f4f1ff'); base.addColorStop(0.5, '#eef6ff'); base.addColorStop(1, '#fff4f0');
  g.fillStyle = base; g.fillRect(0, 0, SW, SH);
  const blobs = [
    [0.18, 0.25, 0.55, 'rgba(156,199,245,0.85)'], [0.72, 0.18, 0.5, 'rgba(255,182,214,0.75)'], [0.55, 0.72, 0.6, 'rgba(201,182,255,0.8)'],
    [0.9, 0.78, 0.45, 'rgba(255,222,160,0.75)'], [0.12, 0.85, 0.42, 'rgba(168,236,214,0.7)'], [0.42, 0.38, 0.35, 'rgba(255,255,255,0.8)'],
  ];
  g.filter = 'blur(60px)';
  for (const [x, y, r, col] of blobs) {
    const gr = g.createRadialGradient(x * SW, y * SH, 0, x * SW, y * SH, r * SW);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, SW, SH);
  }
  // Silky bands sweeping across.
  g.filter = 'blur(28px)';
  g.globalCompositeOperation = 'soft-light';
  for (let i = 0; i < 7; i++) {
    const y0 = SH * (0.1 + i * 0.13);
    const gr = g.createLinearGradient(0, y0, SW, y0 + 300);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, i % 2 ? 'rgba(255,255,255,0.95)' : 'rgba(120,110,200,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = gr; g.lineWidth = 70 + (i % 3) * 40;
    g.beginPath(); g.moveTo(-200, y0);
    g.bezierCurveTo(SW * 0.3, y0 - 260 + i * 30, SW * 0.6, y0 + 300 - i * 40, SW + 200, y0 - 120);
    g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  g.filter = 'none';
  return c;
}

function windowShell(g, r, title, { alpha = 1, sidebar = 0, titleBar = '#f6f6f7' } = {}) {
  g.save();
  g.globalAlpha *= alpha;
  g.shadowColor = 'rgba(0,0,0,0.32)'; g.shadowBlur = 70; g.shadowOffsetY = 24;
  rr(g, r.x, r.y, r.w, r.h, 24); g.fillStyle = '#ffffff'; g.fill();
  g.shadowColor = 'transparent';
  g.save(); rr(g, r.x, r.y, r.w, r.h, 24); g.clip();
  if (sidebar) { g.fillStyle = 'rgba(240,240,244,0.96)'; g.fillRect(r.x, r.y, sidebar, r.h); g.fillStyle = LINE; g.fillRect(r.x + sidebar, r.y, 1.5, r.h); }
  g.fillStyle = titleBar; g.fillRect(r.x + sidebar, r.y, r.w - sidebar, 58);
  g.fillStyle = LINE; g.fillRect(r.x + sidebar, r.y + 58, r.w - sidebar, 1.5);
  [['#ff5f57'], ['#febc2e'], ['#28c840']].forEach(([c], i) => { g.beginPath(); g.arc(r.x + 30 + i * 30, r.y + 29, 10, 0, Math.PI * 2); g.fillStyle = c; g.fill(); });
  if (title) text(g, title, r.x + sidebar + 26, r.y + 38, 24, INK, 700);
  rr(g, r.x, r.y, r.w, r.h, 24); g.lineWidth = 1.5; g.strokeStyle = 'rgba(0,0,0,0.14)'; g.stroke();
  return () => { g.restore(); g.restore(); };
}

function folderIcon(g, x, y, s) {
  rr(g, x, y + s * 0.08, s * 0.42, s * 0.2, s * 0.06); g.fillStyle = '#6fb6f2'; g.fill();
  rr(g, x, y + s * 0.16, s, s * 0.66, s * 0.08); const gr = g.createLinearGradient(0, y, 0, y + s); gr.addColorStop(0, '#9fd2fb'); gr.addColorStop(1, '#73b8f3'); g.fillStyle = gr; g.fill();
}

function finder(g, r, alpha) {
  const done = windowShell(g, r, 'tapdeck', { alpha, sidebar: Math.min(250, r.w * 0.24) });
  const sb = Math.min(250, r.w * 0.24);
  text(g, 'Favourites', r.x + 26, r.y + 100, 18, 'rgba(29,29,31,0.45)', 600);
  ['Recents', 'Applications', 'Desktop', 'Documents', 'Downloads'].forEach((n, i) => {
    if (i === 3) { rr(g, r.x + 12, r.y + 116 + i * 44, sb - 24, 38, 9); g.fillStyle = 'rgba(0,0,0,0.07)'; g.fill(); }
    rr(g, r.x + 26, r.y + 126 + i * 44, 18, 18, 4); g.fillStyle = '#3d8af7'; g.fill();
    text(g, n, r.x + 56, r.y + 142 + i * 44, 21, INK);
  });
  const names = ['Sources', 'Resources', 'docs', 'scripts', 'marketing', 'packaging', 'Tests', 'README.md'];
  const cell = 176, cols = Math.max(2, Math.floor((r.w - sb - 40) / cell));
  names.forEach((n, i) => {
    const cx = r.x + sb + 40 + (i % cols) * cell, cy = r.y + 100 + Math.floor(i / cols) * 170;
    if (cy + 140 > r.y + r.h) return;
    if (n.endsWith('.md')) { rr(g, cx + 18, cy, 84, 104, 8); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = LINE; g.lineWidth = 2; g.stroke(); for (let k = 0; k < 5; k++) bar(g, cx + 32, cy + 22 + k * 15, 56, 5, FAINT); }
    else folderIcon(g, cx + 6, cy, 108);
    text(g, n, cx + 60, cy + 136, 19, INK, 400, 'center');
  });
  done();
}

function editor(g, r, alpha) {
  const done = windowShell(g, r, 'Water.swift', { alpha, sidebar: 200 });
  ['Sources', '  TapDeck', '    Design', '      Water.swift', '      Theme.swift', '    PacksView.swift', 'Tests'].forEach((n, i) => {
    if (i === 3) { rr(g, r.x + 10, r.y + 76 + i * 36, 180, 32, 7); g.fillStyle = 'rgba(0,0,0,0.07)'; g.fill(); }
    text(g, n, r.x + 22, r.y + 98 + i * 36, 17, i === 3 ? INK : INK2);
  });
  const code = [
    [['struct ', '#a626a4'], ['WaterLayer', '#c18401'], [': NSViewRepresentable {', INK]],
    [['    var ', '#a626a4'], ['touches', INK], [': [Touch]', '#c18401']],
    [['    var ', '#a626a4'], ['blobs', INK], [': [FloorBlob]', '#c18401']],
    [['', INK]],
    [['    func ', '#a626a4'], ['update', '#4078f2'], ['(_ view: WaterView) {', INK]],
    [['        view.', INK], ['update', '#4078f2'], ['(touches: touches,', INK]],
    [['                    blobs: blobs)', INK]],
    [['    }', INK]],
    [['}', INK]],
    [['', INK]],
    [['// Fingers press dents into the surface.', '#a0a1a7']],
    [['let ', '#a626a4'], ['lens', INK], [' = smoothstep(', INK], ['0.08', '#986801'], [', ', INK], ['0.2', '#986801'], [', h)', INK]],
  ];
  g.font = `400 21px ui-monospace, "SF Mono", Menlo, monospace`;
  code.forEach((line, i) => {
    const y = r.y + 100 + i * 34;
    if (y > r.y + r.h - 20) return;
    g.fillStyle = 'rgba(29,29,31,0.3)'; g.textAlign = 'right'; g.fillText(String(i + 1), r.x + 250, y); g.textAlign = 'left';
    let x = r.x + 270;
    for (const [s, c] of line) { g.fillStyle = c; g.fillText(s, x, y); x += g.measureText(s).width; }
  });
  done();
}

function browser(g, r, alpha, newTab = 0) {
  const done = windowShell(g, r, '', { alpha, titleBar: '#dee1e6' });
  const tabs = ['TapDeck', 'Release notes', 'Packs'];
  const tw = Math.min(250, (r.w - 220) / 4.2);
  const all = newTab > 0 ? [...tabs, 'Docs'] : tabs;
  all.forEach((n, i) => {
    const isNew = i === tabs.length;
    const k = isNew ? easeOutBack(newTab) : 1;
    const x = r.x + 120 + i * (tw + 6);
    g.save(); g.globalAlpha *= isNew ? clamp(newTab * 2) : 1;
    const active = isNew || (i === 0 && newTab === 0);
    rr(g, x, r.y + 12, tw * k, 46, 12); g.fillStyle = active ? '#ffffff' : 'rgba(255,255,255,0.45)'; g.fill();
    g.beginPath(); g.arc(x + 24, r.y + 35, 9, 0, Math.PI * 2); g.fillStyle = isNew ? PACK.browser.accent : '#9aa0a6'; g.fill();
    g.save(); g.beginPath(); g.rect(x, r.y, tw * k - 10, 60); g.clip(); text(g, n, x + 44, r.y + 42, 19, INK); g.restore();
    g.restore();
  });
  g.fillStyle = '#ffffff'; g.fillRect(r.x, r.y + 58, r.w, 62);
  bar(g, r.x + 130, r.y + 70, r.w - 260, 40, '#f1f3f4');
  text(g, 'github.com/Saba-Burduli/tapdeck', r.x + 160, r.y + 97, 20, INK2);
  const page = r.y + 140;
  text(g, newTab > 0.6 ? 'Docs' : 'TapDeck', r.x + 80, page + 70, 46, INK, 700);
  bar(g, r.x + 80, page + 100, Math.min(560, r.w - 200), 14, FAINT);
  rr(g, r.x + 80, page + 140, r.w - 160, Math.min(300, r.h * 0.35), 20); g.fillStyle = '#f5f5f7'; g.fill();
  for (let i = 0; i < 6; i++) { const y = page + 480 + i * 38; if (y > r.y + r.h - 40) break; bar(g, r.x + 80, y, (r.w - 200) * [0.9, 0.7, 0.8, 0.5, 0.75, 0.6][i], 12, FAINT); }
  done();
}

function sparkle(g, x, y, s, color) {
  g.save(); g.translate(x, y); g.fillStyle = color; g.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rad = i % 2 ? s * 0.28 : s; g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
  g.closePath(); g.fill(); g.restore();
}

function claude(g, r, alpha) {
  const done = windowShell(g, r, '', { alpha, titleBar: '#faf9f5' });
  g.fillStyle = '#faf9f5'; g.fillRect(r.x, r.y + 59, r.w, r.h - 59);
  sparkle(g, r.x + r.w / 2, r.y + r.h * 0.3, 36, PACK.claude.accent);
  text(g, 'What should we build?', r.x + r.w / 2, r.y + r.h * 0.3 + 90, 42, INK, 500, 'center');
  rr(g, r.x + 60, r.y + r.h * 0.3 + 140, r.w - 120, 130, 26); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.1)'; g.stroke();
  text(g, 'Help me plan the TapDeck launch…', r.x + 92, r.y + r.h * 0.3 + 192, 24, 'rgba(29,29,31,0.45)');
  rr(g, r.x + r.w - 128, r.y + r.h * 0.3 + 206, 48, 48, 12); g.fillStyle = PACK.claude.accent; g.fill();
  done();
}

/// macOS menu bar: transparent over the wallpaper, either side of the Dynamic Island.
function menuBar(g, app) {
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(0, 0, SW, MENU);
  text(g, app, 36, 32, 23, INK, 700);
  g.font = `400 23px ${FONT}`;
  let x = 36 + g.measureText(app).width + 36;
  for (const item of ['File', 'Edit', 'View', app === 'Chrome' ? 'History' : 'Go', 'Window', 'Help']) { text(g, item, x, 32, 23, INK); x += g.measureText(item).width + 32; }
  text(g, 'Tue 17 Nov  9:41', SW - 36, 32, 23, INK, 500, 'right');
  // Control Centre, Wi-Fi, battery, search, drawn as simple glyphs.
  let sx = SW - 300;
  g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 2.5;
  rr(g, sx - 40, 15, 40, 19, 5); g.stroke(); g.fillRect(sx - 37, 18, 28, 13); g.fillRect(sx + 1, 21, 3, 7);
  sx -= 70;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(sx, 34, 6 + i * 6, -Math.PI * 0.75, -Math.PI * 0.25); g.stroke(); }
  sx -= 56;
  g.beginPath(); g.arc(sx, 22, 8, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(sx + 6, 28); g.lineTo(sx + 12, 34); g.stroke();
  sx -= 52;
  rr(g, sx - 12, 14, 24, 9, 4.5); g.stroke(); rr(g, sx - 12, 27, 24, 9, 4.5); g.stroke();
  // Dynamic Island: a small black pill with the camera.
  rr(g, SW / 2 - 120, 6, 240, 38, 19); g.fillStyle = '#000'; g.fill();
  g.beginPath(); g.arc(SW / 2 + 92, 25, 7, 0, Math.PI * 2); g.fillStyle = '#121a2a'; g.fill();
}

function dock(g, icons, running) {
  const n = icons.length, size = 80, gap = 14;
  const w = n * size + (n - 1) * gap + 34, x0 = (SW - w) / 2, y0 = SH - DOCK_H - 12;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.18)'; g.shadowBlur = 40; g.shadowOffsetY = 10;
  rr(g, x0, y0, w, DOCK_H, 30); g.fillStyle = 'rgba(255,255,255,0.42)'; g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.stroke();
  icons.forEach(([name, img], i) => {
    const x = x0 + 17 + i * (size + gap), y = y0 + 10;
    if (img.complete && img.naturalWidth) g.drawImage(img, x, y, size, size);
    if (running.includes(name)) { g.beginPath(); g.arc(x + size / 2, y0 + DOCK_H - 7, 3.5, 0, Math.PI * 2); g.fillStyle = 'rgba(29,29,31,0.7)'; g.fill(); }
  });
  g.restore();
}

export function makeScreen() {
  const canvas = document.createElement('canvas');
  canvas.width = SW; canvas.height = SH;
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const wall = wallpaper();
  const icons = ICONS.map((n) => { const img = new Image(); img.src = `out/icons/${n}.png`; return [n, img]; });
  const dockIcons = icons.filter(([n]) => n !== 'simulator');
  const iconOf = (n) => icons.find(([k]) => k === n)[1];
  const ready = Promise.all(icons.map(([, img]) => new Promise((r) => { if (img.complete) r(); else { img.onload = r; img.onerror = r; } })));

  const work = SH - MENU - DOCK_H - 30;
  const free = R(480, 200, 1080, 700), left = R(12, MENU + 10, SW / 2 - 18, work), right = R(SW / 2 + 6, MENU + 10, SW / 2 - 18, work);
  const full = R(0, MENU, SW, SH - MENU);
  const editorRest = R(110, 120, 1000, 660), browserRest = R(1100, 300, 860, 640), claudeRest = R(640, 200, 760, 880);
  const browserFront = R(280, 110, 1480, 980);

  /// Finder's frame at time t: each event eases to a new frame; a cut switches instantly.
  function finderRect(t, s) {
    const steps = [[s.snapLeft, left], [s.snapRight, right], [s.fullScreen, full], [s.restore, free], [s.sameSnap, left], [s.sameCut, free, true]];
    let r = free;
    for (const [at, to, cut] of steps) r = lerpRect(r, to, cut ? (t >= at ? 1 : 0) : easeInOutCubic(clamp((t - at) / 0.34)));
    return r;
  }

  function draw(t, tl) {
    const s = tl.screen;
    g.globalAlpha = 1;
    g.drawImage(wall, 0, 0);

    const mc = easeInOutCubic(clamp((t - s.missionIn) / 0.35)) * (1 - easeInOutCubic(clamp((t - s.missionOut) / 0.35)));
    const grid = [R(220, 250, 740, 440), R(1090, 250, 740, 440), R(220, 760, 740, 440), R(1090, 760, 740, 440)];
    const fit = (r, cell) => { const k = Math.min(cell.w / r.w, cell.h / r.h); return R(cell.x + (cell.w - r.w * k) / 2, cell.y + (cell.h - r.h * k) / 2, r.w * k, r.h * k); };
    const fr = finderRect(t, s);
    const chromeFront = t >= s.sameCut;
    const claudeK = t >= s.claudeOpen && t < s.claudeClose ? clamp((t - s.claudeOpen) / 0.4) : 0;
    const scaleIn = (r, k) => R(r.x + r.w * (1 - k) / 2, r.y + r.h * (1 - k) / 2, r.w * k, r.h * k);

    let ed = editorRest, br = browserRest, cl = claudeRest;
    if (mc > 0) {
      g.filter = `blur(${18 * mc}px)`; g.drawImage(wall, 0, 0); g.filter = 'none';
      g.fillStyle = `rgba(0,0,0,${0.12 * mc})`; g.fillRect(0, 0, SW, SH);
      ed = lerpRect(ed, fit(ed, grid[0]), mc); br = lerpRect(br, fit(br, grid[1]), mc); cl = lerpRect(cl, fit(cl, grid[3]), mc);
    }
    editor(g, ed, 1);
    if (!chromeFront) browser(g, br, 1);
    if (mc > 0) claude(g, cl, mc);
    finder(g, mc > 0 ? lerpRect(fr, fit(fr, grid[2]), mc) : fr, 1);
    if (chromeFront) browser(g, browserFront, 1, clamp((t - s.reopenTab) / 0.35));
    if (mc > 0) {
      g.globalAlpha = mc;
      ['Zed', 'Chrome', 'Finder', 'Claude'].forEach((n, i) => text(g, n, grid[i].x + grid[i].w / 2, grid[i].y + grid[i].h + 44, 26, '#ffffff', 600, 'center'));
      for (let i = 0; i < 3; i++) { rr(g, SW / 2 - 330 + i * 230, MENU + 26, 200, 120, 14); g.save(); g.clip(); g.drawImage(wall, SW / 2 - 330 + i * 230, MENU + 26, 200, 120); g.restore(); g.strokeStyle = i === 0 ? '#ffffff' : 'rgba(255,255,255,0.5)'; g.lineWidth = i === 0 ? 4 : 2; g.stroke(); }
      g.globalAlpha = 1;
    }
    if (claudeK > 0) claude(g, scaleIn(R(560, 120, 920, 1000), 0.88 + 0.12 * easeOutBack(claudeK, 1.2)), clamp(claudeK * 2));

    // Play / Pause HUD: a light glass square.
    const pp = clamp((t - s.playPause) / 0.2) * (1 - smooth(s.playPause + 0.85, s.playPause + 1.15, t));
    if (pp > 0) {
      g.save(); g.globalAlpha = pp;
      const k = 0.85 + 0.15 * easeOutBack(clamp((t - s.playPause) / 0.3));
      const cx = SW / 2, cy = SH / 2, sz = 300 * k;
      g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = 50;
      rr(g, cx - sz / 2, cy - sz / 2, sz, sz, 46 * k); g.fillStyle = 'rgba(246,246,248,0.92)'; g.fill(); g.shadowColor = 'transparent';
      g.fillStyle = INK;
      g.beginPath(); g.moveTo(cx - 80 * k, cy - 55 * k); g.lineTo(cx - 10 * k, cy); g.lineTo(cx - 80 * k, cy + 55 * k); g.closePath(); g.fill();
      g.fillRect(cx + 15 * k, cy - 55 * k, 24 * k, 110 * k); g.fillRect(cx + 56 * k, cy - 55 * k, 24 * k, 110 * k);
      g.restore();
    }

    // Spotlight typing "Simulator".
    const sp = clamp((t - s.spotlight) / 0.18) * (1 - smooth(s.spotlightOut - 0.1, s.spotlightOut + 0.1, t));
    if (sp > 0) {
      g.save(); g.globalAlpha = sp;
      const bx = SW / 2 - 640, by = 300;
      const n = Math.max(0, Math.min(s.spotlightText.length, Math.floor((t - s.spotlight - 0.12) / 0.055)));
      const shown = s.spotlightText.slice(0, n), results = n === s.spotlightText.length;
      g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = 70; g.shadowOffsetY = 20;
      rr(g, bx, by, 1280, results ? 250 : 120, 34); g.fillStyle = 'rgba(248,248,250,0.96)'; g.fill(); g.shadowColor = 'transparent';
      g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = INK2; g.lineWidth = 5; g.beginPath(); g.arc(bx + 66, by + 56, 20, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(bx + 81, by + 71); g.lineTo(bx + 96, by + 86); g.stroke();
      text(g, shown, bx + 126, by + 78, 54, INK);
      if (Math.floor(t * 4) % 2 === 0 || n < s.spotlightText.length) { g.font = `400 54px ${FONT}`; const w = g.measureText(shown).width; g.fillStyle = '#3d8af7'; g.fillRect(bx + 130 + w, by + 32, 3, 56); }
      if (results) {
        g.fillStyle = LINE; g.fillRect(bx, by + 120, 1280, 1.5);
        rr(g, bx + 24, by + 142, 1232, 86, 18); g.fillStyle = '#3d8af7'; g.fill();
        const img = iconOf('simulator'); if (img.complete && img.naturalWidth) g.drawImage(img, bx + 40, by + 147, 76, 76);
        text(g, 'Simulator', bx + 132, by + 197, 34, '#ffffff', 600);
        text(g, 'Application', bx + 1230, by + 196, 28, 'rgba(255,255,255,0.8)', 400, 'right');
      }
      g.restore();
    }

    dock(g, dockIcons, ['finder', 'chrome', 'claude', 'zed', ...(claudeK > 0 ? [] : [])]);

    // Screenshot: a flash, then a thumbnail in the corner.
    const shot = t - s.screenshot;
    if (shot > 0 && shot < 1.9) {
      const thumbIn = easeOutCubic(clamp((shot - 0.15) / 0.35)) * (1 - smooth(1.55, 1.85, shot));
      if (thumbIn > 0) {
        const w = 380, h = w / 1.532, x = SW - w - 40 + (1 - thumbIn) * 460, y = SH - h - DOCK_H - 40;
        g.save(); g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = 40;
        rr(g, x, y, w, h, 16); g.fillStyle = '#fff'; g.fill(); g.shadowColor = 'transparent';
        g.save(); rr(g, x, y, w, h, 16); g.clip(); g.drawImage(canvas, 0, 0, SW, SH, x, y, w, h); g.restore();
        rr(g, x, y, w, h, 16); g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.stroke();
        g.restore();
      }
      const flash = 1 - smooth(0, 0.3, shot);
      if (flash > 0) { g.fillStyle = `rgba(255,255,255,${0.9 * flash})`; g.fillRect(0, 0, SW, SH); }
    }

    menuBar(g, claudeK > 0.3 ? 'Claude' : chromeFront ? 'Chrome' : 'Finder');
    g.fillStyle = '#000';
    for (const [x, sx] of [[0, 1], [SW, -1]]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + sx * 40, 0); g.arcTo(x, 0, x, 40, 40); g.closePath(); g.fill(); }
    texture.needsUpdate = true;
  }

  return { texture, draw, ready };
}

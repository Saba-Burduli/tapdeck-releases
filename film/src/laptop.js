// A 16-inch MacBook Pro (PROLED XDR, 2026), modelled procedurally in centimetres.
// Apple's specs: 35.6 × 24.4 × 1.6 cm, a 16.3-inch 3472 × 2266 display with a Dynamic Island.
// No logos or branding anywhere.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const DIM = { w: 35.6, d: 24.4, base: 1.04, lid: 0.56 };
export const PAD = { w: 16.0, h: 10.0, z0: 1.55 };          // trackpad: size and back edge (z)
export const DECK_Y = DIM.base;
export const LID_ANGLE = 105;

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/// The MacBook Pro's slab: flat top and bottom, large rounded corners seen from above,
/// and only a tight radius on the edges. Spans y = 0…h, centred on x and z.
function slab(w, d, h, corner, edge) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w - 2 * edge, d - 2 * edge, corner - edge), {
    depth: h - 2 * edge, bevelEnabled: true, bevelThickness: edge, bevelSize: edge, bevelSegments: 6, curveSegments: 40,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, edge, 0);
  geo.computeVertexNormals();
  return geo;
}

/// The logo on the lid, drawn from the system font's Apple glyph.
function logoTexture(rainbow) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.font = '440px -apple-system, "SF Pro Display", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('\uF8FF', 256, 280);
  if (rainbow) {
    // The classic six stripes, lit from within.
    g.globalCompositeOperation = 'source-atop';
    ['#61BB46', '#FDB827', '#F5821F', '#E03A3E', '#963D97', '#009DDC'].forEach((col, i) => { g.fillStyle = col; g.fillRect(0, 70 + i * 66, 512, 67); });
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,214,140,0.55)'); gr.addColorStop(0.3, 'rgba(240,120,160,0.22)'); gr.addColorStop(0.6, 'rgba(90,150,240,0.1)'); gr.addColorStop(1, 'rgba(90,150,240,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/// A flat rounded rectangle lying on the deck (normal +y).
function deckPlate(w, h, r, material, y, z = 0, x = 0) {
  const geo = new THREE.ShapeGeometry(roundedRectShape(w, h, r), 12);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}

function grilleTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 128, 512);
  g.fillStyle = '#ffffff';
  for (let y = 6; y < 512; y += 12) for (let x = 6 + ((y / 12) % 2) * 6; x < 128; x += 12) { g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Legends printed on the keys, in the light grey Apple uses on black keys.
const rowsLabels = [
  ['esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', ''],
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'delete'],
  ['tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
  ['caps lock', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'return'],
  ['shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'shift'],
  ['fn', 'control', 'option', 'command', '', 'command', 'option', ''],
];
function legends(keys, labels, rows, u, z0, kbW) {
  const ppc = 90, W = Math.round(kbW * ppc), H = Math.round(rows.length * u * ppc);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(232,233,236,0.82)'; g.textBaseline = 'middle';
  rows.forEach((row, r) => {
    let x = 0;
    row.forEach((w, i) => {
      const label = labels[r][i] ?? '';
      const kx = x * u * ppc, kw = w * u * ppc, ky = r * u * ppc, kh = u * ppc;
      if (r === 5 && i === row.length - 1) {
        g.font = `600 ${0.24 * ppc}px -apple-system, sans-serif`; g.textAlign = 'center';
        const cw = kw / 3;
        g.fillText('◀', kx + cw * 0.5, ky + kh * 0.74); g.fillText('▲', kx + cw * 1.5, ky + kh * 0.26); g.fillText('▼', kx + cw * 1.5, ky + kh * 0.74); g.fillText('▶', kx + cw * 2.5, ky + kh * 0.74);
      } else if (label.length === 1 || /^F\d+$/.test(label)) {
        g.font = `500 ${(label.length === 1 ? 0.5 : 0.24) * ppc}px -apple-system, sans-serif`; g.textAlign = 'center';
        g.fillText(label, kx + kw / 2, ky + kh / 2);
      } else if (label) {
        g.font = `500 ${0.2 * ppc}px -apple-system, sans-serif`;
        const rightSide = i > row.length / 2;
        g.textAlign = rightSide ? 'right' : 'left';
        g.fillText(label, rightSide ? kx + kw - 0.25 * ppc : kx + 0.25 * ppc, ky + kh - 0.3 * ppc);
      }
      x += w;
    });
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const geo = new THREE.PlaneGeometry(kbW, rows.length * u); geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  m.position.set(0, DECK_Y + 0.102, z0 + (rows.length * u) / 2);
  return m;
}

export function makeLaptop({ screenTexture, padMaterial }) {
  const root = new THREE.Group();

  // Silver: bead-blasted aluminium, bright with a soft satin sheen.
  const alu = new THREE.MeshPhysicalMaterial({
    color: '#dcdee2', metalness: 0.9, roughness: 0.34, clearcoat: 0.12, clearcoatRoughness: 0.5, envMapIntensity: 1.15,
  });
  const aluDark = alu.clone(); aluDark.color.set('#b9bcc2');
  // Real keycaps are matte black: keep reflections of the bright set off them so they never read as grey.
  const keyMat = new THREE.MeshStandardMaterial({ color: '#060607', roughness: 0.82, metalness: 0.0, envMapIntensity: 0.08 });
  const wellMat = new THREE.MeshStandardMaterial({ color: '#020203', roughness: 0.95, envMapIntensity: 0.04 });
  const blackGlass = new THREE.MeshPhysicalMaterial({ color: '#030304', roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 });

  // Base: a thin, flat slab with gently rounded edges.
  const base = new THREE.Mesh(slab(DIM.w, DIM.d, DIM.base, 1.15, 0.16), alu);
  base.castShadow = true;
  root.add(base);
  // Thumb scoop at the front edge for opening the lid.
  {
    const sh = new THREE.Shape();
    sh.moveTo(-3.2, 0); sh.quadraticCurveTo(0, 1.3, 3.2, 0); sh.lineTo(-3.2, 0);
    const geo = new THREE.ShapeGeometry(sh, 24); geo.rotateX(-Math.PI / 2);
    const scoop = new THREE.Mesh(geo, aluDark);
    scoop.position.set(0, DECK_Y + 0.003, DIM.d / 2 - 0.3);
    root.add(scoop);
  }
  // Ports: MagSafe, two Thunderbolt and the headphone jack on the left; SD, HDMI and Thunderbolt on the right.
  const portMat = new THREE.MeshStandardMaterial({ color: '#18191b', roughness: 0.6 });
  const port = (side, z, w, h, r) => {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(w, h, r), 6), portMat);
    m.rotation.y = side * Math.PI / 2;
    m.position.set(side * (DIM.w / 2 + 0.003), DIM.base * 0.48, z);
    root.add(m);
  };
  port(-1, -8.2, 1.25, 0.32, 0.14); port(-1, -5.6, 0.95, 0.32, 0.15); port(-1, -4.2, 0.95, 0.32, 0.15); port(-1, 7.2, 0.36, 0.36, 0.18);
  port(1, -7.6, 2.4, 0.18, 0.05); port(1, -4.6, 1.5, 0.42, 0.06); port(1, -2.4, 0.95, 0.32, 0.15);

  // Keyboard: 6 full-height rows of 15 units, including the function row with Touch ID at the top right.
  const u = 1.84, keyW = 28.2 / 15.0 * 0.0 + u;
  const rows = [
    [1.5, ...Array(12).fill(1), 1.5],
    [...Array(13).fill(1), 2],
    [1.5, ...Array(12).fill(1), 1.5],
    [1.8, ...Array(11).fill(1), 2.2],
    [2.3, ...Array(10).fill(1), 2.7],
    [1, 1, 1, 1.25, 5.5, 1.25, 1, 3],
  ];
  const kbW = 15 * u, kbD = rows.length * u;
  const kbZ0 = PAD.z0 - 1.25 - kbD;                  // back edge of the keyboard
  root.add(deckPlate(kbW + 0.5, kbD + 0.5, 0.5, wellMat, DECK_Y + 0.002, kbZ0 + kbD / 2));
  const keyGeo = new RoundedBoxGeometry(1, 0.1, 1, 2, 0.045);
  const keys = [];
  rows.forEach((row, r) => {
    let x = -kbW / 2;
    row.forEach((w, i) => {
      const cz = kbZ0 + (r + 0.5) * u;
      if (r === 5 && i === row.length - 1) {
        // Arrow keys: left, right full width at half height, up/down stacked in the middle.
        const cw = (w * u) / 3;
        for (let k = 0; k < 3; k++) {
          const cx = x + cw * (k + 0.5);
          if (k === 1) { keys.push([cx, cz - u * 0.24, cw - 0.22, u * 0.46 - 0.12]); keys.push([cx, cz + u * 0.24, cw - 0.22, u * 0.46 - 0.12]); }
          else keys.push([cx, cz + u * 0.24, cw - 0.22, u * 0.46 - 0.12]);
        }
      } else {
        keys.push([x + (w * u) / 2, cz, w * u - 0.24, u - 0.24, r === 0 && i === row.length - 1]);
      }
      x += w * u;
    });
  });
  const inst = new THREE.InstancedMesh(keyGeo, keyMat, keys.length);
  const m4 = new THREE.Matrix4();
  keys.forEach(([x, z, w, d], i) => { m4.compose(new THREE.Vector3(x, DECK_Y + 0.05, z), new THREE.Quaternion(), new THREE.Vector3(w, 1, d)); inst.setMatrixAt(i, m4); });
  inst.castShadow = true;
  root.add(inst);
  root.add(legends(keys, rowsLabels, rows, u, kbZ0, kbW));
  // Touch ID: a glossy key with a faint ring.
  const touch = keys.find((k) => k[4]);
  const tid = new THREE.Mesh(new RoundedBoxGeometry(touch[2], 0.1, touch[3], 2, 0.05), blackGlass);
  tid.position.set(touch[0], DECK_Y + 0.056, touch[1]);
  root.add(tid);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.47, 48), new THREE.MeshBasicMaterial({ color: '#3a3c42' }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(touch[0], DECK_Y + 0.108, touch[1]);
  root.add(ring);

  // Speaker grilles either side of the keyboard.
  const grille = new THREE.MeshStandardMaterial({ color: '#4a4c51', roughness: 0.8, alphaMap: grilleTexture(), transparent: true });
  for (const side of [-1, 1]) {
    const g = deckPlate(2.4, kbD + 0.3, 0.2, grille, DECK_Y + 0.003, kbZ0 + kbD / 2, side * (kbW / 2 + 2.15));
    root.add(g);
  }

  // The very large Force Touch trackpad, centred below the keyboard: this is where the water lives.
  const padZ = PAD.z0 + PAD.h / 2;
  // The fine groove around the trackpad, with a lit chamfer on its inner edge.
  root.add(deckPlate(PAD.w + 0.09, PAD.h + 0.09, 0.62, new THREE.MeshStandardMaterial({ color: '#6f7278', roughness: 0.5 }), DECK_Y + 0.001, padZ));
  root.add(deckPlate(PAD.w + 0.03, PAD.h + 0.03, 0.59, new THREE.MeshStandardMaterial({ color: '#f4f5f7', roughness: 0.3, metalness: 0.6 }), DECK_Y + 0.002, padZ));
  const padGeo = new THREE.ShapeGeometry(roundedRectShape(PAD.w, PAD.h, 0.58), 16);
  // ShapeGeometry has no UVs matching the rectangle; set them from position.
  const pos = padGeo.attributes.position, uvs = [];
  for (let i = 0; i < pos.count; i++) uvs.push(pos.getX(i) / PAD.w + 0.5, pos.getY(i) / PAD.h + 0.5);
  padGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  padGeo.rotateX(-Math.PI / 2);
  const pad = new THREE.Mesh(padGeo, padMaterial);
  pad.position.set(0, DECK_Y + 0.004, padZ);
  root.add(pad);

  // Hinge: a thin, continuous black band.
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 30.4, 32), new THREE.MeshStandardMaterial({ color: '#1c1d20', roughness: 0.45, metalness: 0.5 }));
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, DECK_Y - 0.12, -DIM.d / 2 + 0.25);
  root.add(hinge);

  // Lid, pivoting at the back edge of the deck.
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, DECK_Y - 0.05, -DIM.d / 2 + 0.25);
  root.add(lidPivot);
  const lidD = DIM.d - 0.3;
  const lid = new THREE.Mesh(slab(DIM.w, lidD, DIM.lid, 1.1, 0.13), alu);
  lid.castShadow = true;
  lid.position.set(0, 0.05, lidD / 2);
  // The logo, centred on the outside of the lid, glows as the lid opens.
  const logoMat = new THREE.MeshBasicMaterial({ map: logoTexture(false), transparent: true, toneMapped: false, color: '#9da1a8', depthWrite: false });
  const litMat = new THREE.MeshBasicMaterial({ map: logoTexture(true), transparent: true, toneMapped: false, depthWrite: false, opacity: 0 });
  const logoGeo = new THREE.PlaneGeometry(4.0, 4.0); logoGeo.rotateX(-Math.PI / 2); logoGeo.rotateY(Math.PI);
  const logo = new THREE.Mesh(logoGeo, logoMat);
  logo.position.set(0, 0.05 + DIM.lid + 0.004, lidD / 2);
  lidPivot.add(logo);
  const lit = new THREE.Mesh(logoGeo, litMat);
  lit.position.set(0, 0.05 + DIM.lid + 0.006, lidD / 2);
  lidPivot.add(lit);
  const haloMat = new THREE.MeshBasicMaterial({ map: haloTexture(), transparent: true, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const haloGeo = new THREE.PlaneGeometry(9, 9); haloGeo.rotateX(-Math.PI / 2);
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.position.set(0, 0.05 + DIM.lid + 0.008, lidD / 2);
  lidPivot.add(halo);
  lidPivot.add(lid);
  // Black glass over the whole inner face, then the 16.3-inch display (1.53:1) with thin bezels.
  const glassGeo = new THREE.ShapeGeometry(roundedRectShape(DIM.w - 0.36, lidD - 0.36, 0.95), 24);
  glassGeo.rotateX(Math.PI / 2);
  const glass = new THREE.Mesh(glassGeo, blackGlass);
  glass.position.set(0, 0.035, lidD / 2);
  lidPivot.add(glass);
  const dispW = 34.67, dispH = 22.63, chin = lidD - dispH - 0.62;
  const dispGeo = new THREE.PlaneGeometry(dispW, dispH);
  dispGeo.rotateX(Math.PI / 2);
  const display = new THREE.Mesh(dispGeo, new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }));
  display.position.set(0, 0.03, chin + dispH / 2);
  lidPivot.add(display);

  function setLid(deg) { lidPivot.rotation.x = -THREE.MathUtils.degToRad(deg); }
  setLid(LID_ANGLE);

  /// World position of a point on the trackpad (u across, v from the far edge).
  function padPoint(uu, vv, lift = 0) {
    return new THREE.Vector3((uu - 0.5) * PAD.w, DECK_Y + 0.01 + lift, PAD.z0 + vv * PAD.h);
  }

  /// 0 = the plain polished logo, 1 = shining.
  function setLogoGlow(k) {
    litMat.opacity = k;
    haloMat.opacity = 0.9 * k;
  }

  return { root, setLid, setLogoGlow, padPoint, padCenter: padPoint(0.5, 0.5), keyboard: { z0: kbZ0, w: kbW, d: kbD }, display, lidPivot, dispSize: [dispW, dispH, chin] };
}

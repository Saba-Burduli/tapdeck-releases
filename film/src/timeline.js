// Shared timing helpers. Everything is a pure function of t, so any frame renders on its own.

export const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
export const easeOutCubic = (k) => 1 - Math.pow(1 - clamp(k), 3);
export const easeInOutCubic = (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
export const easeOutBack = (k, s = 1.6) => { k = clamp(k); const c = s + 1; return 1 + c * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2); };
/// 0 → 1 over [a, a+d], then holds.
export const ramp = (t, a, d) => clamp((t - a) / d);
/// Fades in over `fi` from `a`, out over `fo` before `b`.
export const window01 = (t, a, b, fi = 0.35, fo = 0.35) => smooth(a, a + fi, t) * (1 - smooth(b - fo, b, t));

export const PACK = {
  'everyday-mac': { name: 'Everyday Mac', accent: '#FDB827', patch: null, sw: null, rainbow: true },
  claude:         { name: 'Claude', accent: '#D97757', patch: '#E07A55', sw: ['#E58B6A', '#D06A45'] },
  browser:        { name: 'Browser', accent: '#7FB2EE', patch: '#8FBDF2', sw: ['#9CC7F5', '#FFD45C', '#F59A3A'] },
  'code-editors': { name: 'Code Editors', accent: '#E6E7EA', patch: '#8A8F99', sw: ['#FAFAFA', '#C4C7CC'] },
  xcode:          { name: 'Xcode & Simulator', accent: '#1F8BF0', patch: '#2E93F2', sw: ['#3FA9FF', '#0A63D6'] },
  terminal:       { name: 'Terminal', accent: '#3D52C8', patch: '#5566E0', sw: ['#4F6BFF', '#1D2756'] },
};
export const RAINBOW = ['#61BB46', '#FDB827', '#F5821F', '#E03A3E', '#963D97', '#009DDC'];
/// Where each pack's colour pools on the floor (from PacksView.floorSpots): x, y, radius.
export const SPOTS = {
  'everyday-mac': [0.10, 0.20, 0.30], claude: [0.90, 0.10, 0.32], browser: [0.55, 0.70, 0.30],
  'code-editors': [0.08, 0.95, 0.30], xcode: [0.94, 0.88, 0.34], terminal: [0.50, -0.02, 0.28],
};

/// Fingertip positions on the pad (u across, v from the far edge) for a contact.
export function fingers(c) {
  const [u, v] = c.at;
  const n = c.n;
  if (n === 1) return [[u, v]];
  const layouts = {
    3: [[-0.11, 0.025], [0, -0.035], [0.11, 0.02]],
    4: [[-0.17, 0.05], [-0.06, -0.03], [0.055, -0.04], [0.16, 0.0]],
    5: [[-0.25, 0.2], [-0.15, 0.03], [-0.05, -0.04], [0.06, -0.045], [0.165, -0.005]],
  };
  return layouts[n].map(([du, dv]) => [u + du, v + dv]);
}

/// How far a contact's fingers are pressed into the pad: 0 up in the air, 1 touching.
export function press(c, t) {
  if (c.kind === 'drop') return 0;
  const down = smooth(c.t - 0.07, c.t, t);
  const up = smooth(c.t + c.dur, c.t + c.dur + 0.1, t);
  return down * (1 - up);
}

/// How high a fingertip hovers (0 touching, 1 at the top of its approach), and how visible it is.
export function hover(c, t) {
  const before = clamp((c.t - t) / 0.22);
  const after = clamp((t - (c.t + c.dur)) / 0.3);
  const h = t < c.t ? before : t > c.t + c.dur ? after : 0;
  const vis = smooth(c.t - 0.32, c.t - 0.18, t) * (1 - smooth(c.t + c.dur + 0.18, c.t + c.dur + 0.42, t));
  return { h, vis };
}

/// The pixels' strength: rises fast on a touch, sinks back slowly (as in Water.swift).
export function energy(contacts, t) {
  let e = 0;
  for (const c of contacts) {
    if (t < c.t) continue;
    const end = c.t + Math.max(c.dur, 0.05);
    const rise = (x) => 1 - Math.exp(-x * 12);
    const v = t < end ? rise(t - c.t) : rise(end - c.t) * Math.exp(-(t - end) * 1.1);
    e = Math.max(e, (c.kind === 'drop' ? 0.85 : 1) * v);
  }
  return e;
}

/// A pack's patch on the floor: 0 before it's switched on, blooming to 1.
export function bloom(onAt, t) { return onAt == null ? 0 : easeOutCubic((t - onAt) / 1.1); }

/// Samples camera keys [{t, pos, target, fov, shift, up?}] with eased segments.
export function sampleKeys(keys, t) {
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b.t) {
      const k = easeInOutCubic((t - a.t) / (b.t - a.t));
      const mix = (x, y) => Array.isArray(x) ? x.map((v, j) => lerp(v, y[j], k)) : lerp(x, y, k);
      const out = { t };
      for (const key of Object.keys(b)) if (key !== 't') out[key] = mix(a[key] ?? b[key], b[key]);
      return out;
    }
  }
  return keys[keys.length - 1];
}

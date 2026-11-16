// Easing helpers, copied from the teaser's src/timeline.js so the demo animates exactly like the film.
export const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
export const easeOutCubic = (k) => 1 - Math.pow(1 - clamp(k), 3);
export const easeInOutCubic = (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
export const easeOutBack = (k, s = 1.6) => { k = clamp(k); const c = s + 1; return 1 + c * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2); };

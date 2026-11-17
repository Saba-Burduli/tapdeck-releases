// The trackpad's water, a deterministic copy of Sources/TapDeck/Design/Water.swift.
// Instead of stepping a wave equation, the surface height is a sum of closed-form wave packets,
// one per finger contact, so any frame can be rendered on its own.
import * as THREE from 'three';
import { SPOTS, PACK, RAINBOW, energy, bloom, press, fingers } from './timeline.js';

const MAX = 32;

/// sRGB components as written (the shader works in display colour, like Water.swift).
const hex = (h) => { const n = parseInt(h.slice(1), 16); return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255 }; };

export function makeWater(aspect) {
  const uniforms = {
    uTime: { value: 0 },
    uAspect: { value: aspect },
    uEnergy: { value: 0 },
    uReveal: { value: 1 },
    uFade: { value: 1 },
    uDark: { value: 0 },
    uCells: { value: 64 },
    uCount: { value: 0 },
    uC: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },   // u, v, t0, t1
    uK: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },   // amp, drop?, press, -
    uPCount: { value: 0 },
    uP: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) },     // x, y, r, alpha
    uPC: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) },    // rgb, rainbow
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = vec2(uv.x, 1.0 - uv.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime, uAspect, uEnergy, uReveal, uFade, uCells, uDark;
      uniform int uCount, uPCount;
      uniform vec4 uC[${MAX}], uK[${MAX}], uP[6], uPC[6];

      float packet(float dist, float dt, float amp, float speed) {
        if (dt <= 0.0) return 0.0;
        float x = dist - speed * dt;
        float w = 0.045 + 0.035 * dt;
        return amp * exp(-x * x / (w * w)) * sin(x * 58.0) * exp(-dt * 1.35) / (1.0 + dist * 4.0);
      }

      float height(vec2 p) {
        float h = 0.0;
        for (int i = 0; i < ${MAX}; i++) {
          if (i >= uCount) break;
          vec4 c = uC[i]; vec4 k = uK[i];
          float dist = length((p - c.xy) * vec2(uAspect, 1.0));
          float dt = uTime - c.z;
          if (k.y > 0.5) {
            // A falling drop: a sharp dent that springs back, then wide rings.
            h -= 0.55 * exp(-dist * dist / 0.003) * exp(-max(dt, 0.0) * 5.0) * step(0.0, dt);
            h += packet(dist, dt, 0.9 * k.x, 0.42);
          } else {
            h -= 0.32 * k.z * exp(-dist * dist / 0.0032);
            h += packet(dist, dt, 0.22 * k.x, 0.34);
            h += packet(dist, uTime - c.w, -0.12 * k.x, 0.34);
          }
        }
        return h;
      }

      vec3 stripes(float t) {
        vec3 band[6];
        band[0] = vec3(0.38, 0.73, 0.27); band[1] = vec3(0.99, 0.72, 0.15); band[2] = vec3(0.96, 0.51, 0.12);
        band[3] = vec3(0.88, 0.23, 0.24); band[4] = vec3(0.59, 0.24, 0.59); band[5] = vec3(0.01, 0.62, 0.86);
        float x = clamp(t, 0.0, 0.999) * 5.0;
        int i = int(x);
        return mix(band[i], band[min(i + 1, 5)], smoothstep(0.25, 0.75, x - float(i)));
      }

      vec3 floorColor(vec2 uv) {
        vec3 color = uDark > 0.5 ? vec3(0.055, 0.062, 0.078) : vec3(0.925, 0.937, 0.955);
        color += (uDark > 0.5 ? 0.035 : 0.05) * (1.0 - smoothstep(0.0, 1.3, length(uv * vec2(uAspect, 1.0) * 0.8)));
        for (int i = 0; i < 6; i++) {
          if (i >= uPCount) break;
          vec4 b = uP[i];
          vec2 centre = b.xy + 0.035 * vec2(sin(uTime * 0.11 + float(i) * 1.7), cos(uTime * 0.13 + float(i) * 2.3));
          vec2 d = (uv - centre) * vec2(uAspect, 1.0);
          float w = exp(-dot(d, d) / (b.z * b.z)) * b.w;
          vec3 tint = uPC[i].w > 0.5 ? stripes((uv.y - centre.y) / (b.z * 1.5) + 0.5) : uPC[i].rgb;
          color = mix(color, tint, w * (uDark > 0.5 ? 0.42 : 0.4));
        }
        return color;
      }

      // One sample of the subpixel grid at grid coordinate q.
      vec3 gridAt(vec2 q, vec2 cells, float lens) {
        vec2 cell = floor(q), f = fract(q);
        vec3 source = floorColor((cell + 0.5) / cells);
        float third = f.x * 3.0;
        int sub = int(third);
        float fx = fract(third);
        float edge = mix(0.12, 0.07, lens);
        float lit = smoothstep(0.03, 0.03 + edge, fx) * smoothstep(0.97, 0.97 - edge, fx)
                  * smoothstep(0.03, 0.03 + edge * 0.7, f.y) * smoothstep(0.97, 0.97 - edge * 0.7, f.y);
        vec3 pick = vec3(sub == 0 ? 1.0 : 0.0, sub == 1 ? 1.0 : 0.0, sub == 2 ? 1.0 : 0.0);
        vec3 calm = source * (0.22 + pick * lit * 2.9);
        vec3 vivid = min(pow(max(source, vec3(0.16)), vec3(0.6)) * pick * lit * 3.2, vec3(1.0)) + source * 0.22 + 0.03;
        return mix(calm, vivid, lens);
      }

      void main() {
        vec2 p = vUv;
        float e = 0.004;
        float h = height(p);
        float left = height(p - vec2(e, 0.0)), right = height(p + vec2(e, 0.0));
        float up = height(p - vec2(0.0, e)), down = height(p + vec2(0.0, e));
        vec2 slope = vec2(right - left, down - up);
        float curve = left + right + up + down - 4.0 * h;

        vec3 color = floorColor(p + slope * 0.05);

        // The floor is a screen seen through liquid: red, green and blue subpixels everywhere, bent by the ripples.
        // The wave lights the pixels all the way round its ring, not only where it bends the columns sideways.
        float lens = smoothstep(0.035, 0.12, abs(h)) * step(0.001, uReveal);
        vec2 cells = vec2(uCells, uCells / uAspect);
        vec2 q = (p + clamp(slope, -0.18, 0.18) * 0.08) * cells;   // gentle refraction: strong bending smeared the columns into streaks
        // Four samples per screen pixel, so the grid stays crisp without shimmering.
        vec2 dx = dFdx(q) * 0.25, dy = dFdy(q) * 0.25;
        vec3 grid = 0.25 * (gridAt(q + dx + dy, cells, lens) + gridAt(q + dx - dy, cells, lens)
                          + gridAt(q - dx + dy, cells, lens) + gridAt(q - dx - dy, cells, lens));
        vec3 source = floorColor((floor(q) + 0.5) / cells);
        // Far away the grid is smaller than a screen pixel: show its average instead of shimmering.
        float aa = smoothstep(0.18, 0.45, max(fwidth(q.x), fwidth(q.y)) / 3.0);
        grid = mix(grid, source * mix(0.86, 1.2, lens), aa);
        float everywhere = mix(0.34, 0.62, uEnergy) * (uDark > 0.5 ? 0.8 : 1.0) * uReveal;
        color = mix(color, grid, mix(everywhere, 1.0, lens));

        vec3 normal = normalize(vec3(-slope * 3.0, 1.0));
        vec3 light = normalize(vec3(-0.5, -0.62, 0.6));
        float lt = dot(normal, light) - light.z;
        color *= 1.0 + clamp(lt, -0.5, 0.5) * (uDark > 0.5 ? 2.4 : 1.4);
        vec3 halfway = normalize(light + vec3(0.0, 0.0, 1.0));
        float shine = max(0.0, pow(max(dot(normal, halfway), 0.0), 70.0) - pow(halfway.z, 70.0));
        color += min(shine, 0.6) * (uDark > 0.5 ? vec3(0.6, 0.68, 0.85) : vec3(0.75));
        color += clamp(-curve * 4.0, -0.5, 0.5) * (uDark > 0.5 ? 0.34 : 0.26);
        // Deeper water reads slightly cooler.
        color = mix(color, color * vec3(0.9, 0.95, 1.0), clamp(-h * 0.6, 0.0, 0.6) * (1.0 - uDark));

        // Glass: a faint diagonal sheen and a soft darkening toward the edges, so it reads as a surface.
        float sheen = smoothstep(0.35, 0.0, abs((p.x * 0.8 - p.y) + 0.25)) * 0.06;
        color = mix(color, vec3(1.0), sheen * (1.0 - uDark));
        vec2 e2 = min(p, 1.0 - p) * vec2(uAspect, 1.0);
        color *= 1.0 - 0.06 * (1.0 - smoothstep(0.0, 0.08, min(e2.x, e2.y)));
        gl_FragColor = vec4(mix(vec3(uDark > 0.5 ? 0.0 : 1.0), clamp(color, 0.0, 1.0), uFade), 1.0);
      }
    `,
  });

  /// Sets every uniform for time t.
  function update(t, tl, opts = {}) {
    uniforms.uTime.value = t;
    uniforms.uEnergy.value = energy(tl.contacts, t);
    uniforms.uReveal.value = opts.reveal ?? 1;
    uniforms.uFade.value = opts.fade ?? 1;
    uniforms.uDark.value = opts.dark ? 1 : 0;
    let n = 0;
    for (const c of tl.contacts) {
      if (t < c.t - 0.1 || t > c.t + c.dur + 4.5) continue;
      const amp = c.kind === 'drop' ? 1 : 1;
      const pr = press(c, t);
      for (const [u, v] of fingers(c)) {
        if (n >= MAX) break;
        uniforms.uC.value[n].set(u, v, c.t, c.t + c.dur);
        uniforms.uK.value[n].set(amp, c.kind === 'drop' ? 1 : 0, pr, 0);
        n++;
      }
    }
    uniforms.uCount.value = n;
    let m = 0;
    for (const id of Object.keys(SPOTS)) {
      const a = bloom(tl.packs.on[id], t);
      if (a <= 0) continue;
      const [x, y, r] = SPOTS[id];
      uniforms.uP.value[m].set(x, y, r * (0.35 + 0.65 * a), a);
      const col = PACK[id].patch ? hex(PACK[id].patch) : hex(RAINBOW[1]);
      uniforms.uPC.value[m].set(col.r, col.g, col.b, PACK[id].rainbow ? 1 : 0);
      m++;
    }
    uniforms.uPCount.value = m;
  }

  return { material, update };
}

// The app's water (Sources/TapDeck/Design/Water.swift), ported from Metal to WebGL2 for the site's background:
// a wave equation on a height field, seen as a liquid over a screen of red, green and blue subpixels.
// makeWater(canvas) fills the page behind everything: the pointer presses into it like a finger on the trackpad,
// a click splashes, drops fall now and then. makeWater(canvas, { element: true }) fills one element instead (the demo's
// trackpad) and is driven by its owner through press(), lift() and splash().
export function makeWater(canvas, { element = false, autoDrops = !element, fingerRadius = 0.03, dark: theme = null } = {}) {
  // `dark`: true or false fixes the look; null follows the system setting.
  const gl = canvas && canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const canRenderFloat = !!gl.getExtension('EXT_color_buffer_float');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');

  const MAX_FINGERS = 12;
  // Every pack switched on: their colours pool on the floor, where Settings › Packs puts them.
  const BLOBS = [
    [0.10, 0.20, 0.30, 1, [0, 0, 0]],                       // Everyday Mac: the rainbow
    [0.90, 0.10, 0.32, 0, [0xE0, 0x7A, 0x55]],              // Claude
    [0.55, 0.70, 0.30, 0, [0x8F, 0xBD, 0xF2]],              // Browser
    [0.08, 0.95, 0.30, 0, [0x8A, 0x8F, 0x99]],              // Code editors
    [0.94, 0.88, 0.34, 0, [0x2E, 0x93, 0xF2]],              // Xcode
    [0.50, -0.02, 0.28, 0, [0x55, 0x66, 0xE0]],             // Terminal
  ];

  const vert = `#version 300 es
  out vec2 uv;
  void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    uv = vec2(p.x, 1.0 - p.y);
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const common = `#version 300 es
  precision highp float;
  in vec2 uv;
  out vec4 outColor;
  uniform sampler2D state;
  uniform vec4 size;      // width, height (CSS px), time, dark
  uniform vec4 counts;    // fingers, blobs, cell width, cell height (uv)
  uniform vec4 tune;      // velocity damping, wave speed², reduce motion, energy
  uniform vec3 base;      // floor colour
  uniform vec4 fingers[${MAX_FINGERS}];
  uniform vec4 blobPos[6];
  uniform vec4 blobCol[6];
  `;

  const stepFrag = common + `
  void main() {
    vec2 c = counts.zw;
    vec2 here = texture(state, uv).rg;
    float h = here.r;
    float around = texture(state, uv - vec2(c.x, 0)).r + texture(state, uv + vec2(c.x, 0)).r
                 + texture(state, uv - vec2(0, c.y)).r + texture(state, uv + vec2(0, c.y)).r;
    float next = h + (h - here.g) * tune.x + tune.y * (around - 4.0 * h);
    next = mix(next, around * 0.25, 0.012);
    next *= 0.9992;
    float aspect = size.x / size.y;
    for (int i = 0; i < ${MAX_FINGERS}; i++) {
      if (i >= int(counts.x)) break;
      vec4 f = fingers[i];
      vec2 d = (uv - f.xy) * vec2(aspect, 1.0);
      float w = exp(-dot(d, d) / (f.z * f.z));
      next = mix(next, -f.w, w * 0.3);
    }
    outColor = vec4(clamp(next, -4.0, 4.0), h, 0.0, 1.0);
  }`;

  const drawFrag = common + `
  vec3 stripes(float t) {
    vec3 band[6] = vec3[6](vec3(0.38, 0.73, 0.27), vec3(0.99, 0.72, 0.15), vec3(0.96, 0.51, 0.12),
                           vec3(0.88, 0.23, 0.24), vec3(0.59, 0.24, 0.59), vec3(0.01, 0.62, 0.86));
    float x = clamp(t, 0.0, 0.999) * 5.0;
    int i = int(x);
    return mix(band[i], band[min(i + 1, 5)], smoothstep(0.25, 0.75, x - float(i)));
  }

  vec3 floorColor(vec2 p) {
    float aspect = size.x / size.y;
    float t = size.z;
    float dark = size.w;
    vec3 color = base;
    color += (dark > 0.5 ? 0.035 : 0.05) * (1.0 - smoothstep(0.0, 1.3, length(p * vec2(aspect, 1.0) * 0.8)));
    for (int i = 0; i < 6; i++) {
      if (i >= int(counts.y)) break;
      vec4 b = blobPos[i];
      vec2 centre = b.xy + 0.035 * vec2(sin(t * 0.11 + float(i) * 1.7), cos(t * 0.13 + float(i) * 2.3));
      vec2 d = (p - centre) * vec2(aspect, 1.0);
      float w = exp(-dot(d, d) / (b.z * b.z)) * blobCol[i].a;
      vec3 tint = b.w > 0.5 ? stripes((p.y - centre.y) / (b.z * 1.5) + 0.5) : blobCol[i].rgb;
      color = mix(color, tint, w * (dark > 0.5 ? 0.42 : 0.4));
    }
    return color;
  }

  void main() {
    vec2 c = counts.zw;
    float dark = size.w;
    float h = texture(state, uv).r;
    float left = texture(state, uv - vec2(c.x, 0)).r, right = texture(state, uv + vec2(c.x, 0)).r;
    float up = texture(state, uv - vec2(0, c.y)).r, down = texture(state, uv + vec2(0, c.y)).r;
    vec2 slope = vec2(right - left, down - up);
    float curve = left + right + up + down - 4.0 * h;

    vec3 color = floorColor(uv + slope * 0.05);

    float lens = smoothstep(0.08, 0.2, abs(h));
    {
      const float pitch = 15.0;
      vec2 q = (uv + clamp(slope, -0.18, 0.18) * 0.2) * size.xy / pitch;
      vec2 cell = floor(q), f = fract(q);
      vec3 source = floorColor((cell + 0.5) * pitch / size.xy);
      float third = f.x * 3.0;
      int sub = int(third);
      float fx = fract(third);
      float edge = mix(0.12, 0.07, lens);
      float lit = smoothstep(0.03, 0.03 + edge, fx) * smoothstep(0.97, 0.97 - edge, fx)
                * smoothstep(0.03, 0.03 + edge * 0.7, f.y) * smoothstep(0.97, 0.97 - edge * 0.7, f.y);
      vec3 pick = vec3(sub == 0 ? 1.0 : 0.0, sub == 1 ? 1.0 : 0.0, sub == 2 ? 1.0 : 0.0);
      vec3 calm = source * (0.22 + pick * lit * 2.9);
      vec3 vivid = min(pow(max(source, vec3(0.16)), vec3(0.6)) * pick * lit * 3.2, vec3(1.0)) + source * 0.22 + 0.03;
      // Quieter than the app at rest (0.34 → 0.62) so the page's text stays readable; ripples stay fully vivid.
      float everywhere = mix(0.2, 0.3, tune.w) * (dark > 0.5 ? 0.8 : 1.0);
      color = mix(color, mix(calm, vivid, lens), mix(everywhere, 1.0, lens));
    }

    vec3 normal = normalize(vec3(-slope * 3.0, 1.0));
    vec3 light = normalize(vec3(-0.5, -0.62, 0.6));
    float lt = dot(normal, light) - light.z;
    color *= 1.0 + clamp(lt, -0.5, 0.5) * (dark > 0.5 ? 2.4 : 0.45);
    vec3 halfway = normalize(light + vec3(0.0, 0.0, 1.0));
    float shine = max(0.0, pow(max(dot(normal, halfway), 0.0), 70.0) - pow(halfway.z, 70.0));
    color += min(shine, 0.6) * (dark > 0.5 ? vec3(0.6, 0.68, 0.85) : vec3(0.75));
    color += clamp(-curve, -0.5, 0.5) * (dark > 0.5 ? 0.34 : 0.12);
    color = mix(color, color * vec3(0.9, 0.95, 1.0), clamp(-h * 0.6, 0.0, 0.6) * (1.0 - dark));
    outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }`;

  function program(fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vert], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(p)); return null; }
    const loc = {};
    for (const n of ['state', 'size', 'counts', 'tune', 'base', 'fingers', 'blobPos', 'blobCol']) loc[n] = gl.getUniformLocation(p, n);
    return { p, loc };
  }
  const sim = program(stepFrag), draw = program(drawFrag);
  if (!sim || !draw) return null;

  // Ping-pong height fields: about one cell per 2.5 CSS px, like the app.
  let state = [], fbos = [], gw = 0, gh = 0, current = 0;
  function makeState(w, h) {
    for (const t of state) gl.deleteTexture(t);
    for (const f of fbos) gl.deleteFramebuffer(f);
    state = []; fbos = [];
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      if (canRenderFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, w, h, 0, gl.RG, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      state.push(t);
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      fbos.push(f);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gw = w; gh = h;
  }

  let cssW = 0, cssH = 0;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cssW = element ? Math.max(1, canvas.clientWidth) : innerWidth;
    cssH = element ? Math.max(1, canvas.clientHeight) : innerHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const w = Math.max(16, Math.min(640, Math.round(cssW / 2.5)));
    const h = Math.max(16, Math.min(640, Math.round(cssH / 2.5)));
    if (w !== gw || h !== gh) makeState(w, h);
  }
  if (element) new ResizeObserver(resize).observe(canvas); else addEventListener('resize', resize);
  resize();

  // Fingers. Page: the pointer while it moves, a splash on click, an occasional drop on its own.
  // Element: whatever the owner presses, as a list of [u, v] points held down.
  let pointer = null, pointerSeen = 0, splash = [], splashSteps = 0, nextDrop = 2, energy = 0, held = [];
  if (!element) {
    const toUV = (e) => [e.clientX / cssW, e.clientY / cssH];
    // The demo's trackpad has its own water; the page behind it ignores what happens there.
    const own = (e) => e.target && e.target.closest && e.target.closest('.demo-pad');
    addEventListener('pointermove', (e) => { if (own(e)) return; pointer = toUV(e); pointerSeen = performance.now(); }, { passive: true });
    addEventListener('pointerdown', (e) => { if (own(e)) return; splash = [toUV(e)]; splashSteps = 5; }, { passive: true });
  }

  const fingerData = new Float32Array(MAX_FINGERS * 4);
  const blobPos = new Float32Array(24), blobCol = new Float32Array(24);
  BLOBS.forEach(([x, y, r, rainbow, rgb], i) => {
    blobPos.set([x, y, r, rainbow], i * 4);
    blobCol.set([rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 1], i * 4);
  });

  function uniforms(loc, t, nFingers) {
    const isDark = theme === null ? darkQuery.matches : theme;
    gl.uniform1i(loc.state, 0);
    gl.uniform4f(loc.size, cssW, cssH, reduceMotion.matches ? 0 : t, isDark ? 1 : 0);
    gl.uniform4f(loc.counts, nFingers, BLOBS.length, 1 / gw, 1 / gh);
    gl.uniform4f(loc.tune, 0.982, 0.24, reduceMotion.matches ? 1 : 0, energy);
    gl.uniform3fv(loc.base, isDark ? [0.055, 0.062, 0.078] : [0.925, 0.937, 0.955]);
    gl.uniform4fv(loc.fingers, fingerData);
    gl.uniform4fv(loc.blobPos, blobPos);
    gl.uniform4fv(loc.blobCol, blobCol);
  }

  const start = performance.now();
  let last = start, debt = 0, visible = !document.hidden, onScreen = true, running = false;
  const wake = () => { if (!running && visible && onScreen) { running = true; last = performance.now(); requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; wake(); });
  // An element off screen stops drawing until it scrolls back.
  if (element) new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; wake(); }).observe(canvas);

  function frame(now) {
    if (!visible || !onScreen) { running = false; return; }
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const t = (now - start) / 1000;

    // Which "fingers" are down this frame.
    let n = 0;
    const moving = pointer && now - pointerSeen < 120;
    const down = element ? held : moving ? [pointer] : [];
    for (const [u, v] of down) if (n < MAX_FINGERS) fingerData.set([u, v, fingerRadius, 0.32], 4 * n++);
    const pressed = n;
    if (splashSteps > 0) for (const [u, v] of splash) if (n < MAX_FINGERS) fingerData.set([u, v, fingerRadius * 1.8, -0.6], 4 * n++);
    const touching = pressed > 0;
    if (autoDrops && !reduceMotion.matches && t > nextDrop) {
      splash = [[0.08 + Math.random() * 0.84, 0.1 + Math.random() * 0.8]];
      splashSteps = 5;
      nextDrop = t + 2.5 + Math.random() * 3;
    }
    const excited = touching || splashSteps > 0 ? 1 : 0;
    energy += (excited - energy) * Math.min(1, dt * (excited > energy ? 12 : 1.1));

    gl.bindVertexArray(null);
    let steps = 0;
    if (!reduceMotion.matches && canRenderFloat) {
      debt += dt * 120;
      steps = Math.min(10, Math.floor(debt));
      debt -= steps;
    }
    gl.useProgram(sim.p);
    gl.viewport(0, 0, gw, gh);
    for (let i = 0; i < steps; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[1 - current]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, state[current]);
      uniforms(sim.loc, t, n);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      current = 1 - current;
      if (splashSteps > 0) { splashSteps--; if (splashSteps === 0) n = pressed; }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(draw.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state[current]);
    uniforms(draw.loc, t, n);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }
  canvas.classList.add('on');
  wake();

  return {
    /// Fingers held down at these [u, v] points (0–1 across the element).
    press(points) { held = points.slice(0, MAX_FINGERS - 4); },
    lift() { held = []; },
    /// A drop where fingers just tapped: a bulge that falls back as rings.
    splash(points) { splash = points.slice(0, 4); splashSteps = 5; },
  };
}

// The page's background, wherever a #water canvas exists.
const background = document.getElementById('water');
if (background) makeWater(background);

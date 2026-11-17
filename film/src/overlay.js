// HTML text over the 3D scene, in the style of Apple's product films: one short idea per shot, big type.
//   hero: centred near the bottom   top: centred above the subject   side: a column beside the laptop
import { PACK, RAINBOW, clamp, smooth, easeOutCubic, easeOutBack } from './timeline.js';

export function makeOverlay(root, tl) {
  root.innerHTML = `
    <div class="cap"><div class="title"></div><div class="sub"></div><div class="gesture"><span class="dot"></span><span class="gtext"></span></div></div>
    <div class="values"><div class="value"></div><div class="vsub"></div></div>
    <div class="end">
      <div class="icon-wrap"><div class="ring"></div><div class="ring"></div><div class="ring"></div><img class="icon" src="out/icon-680.webp"></div>
      <div class="name">TapDeck</div>
      <div class="tagline">Your MacBook trackpad, as a shortcut panel.</div>
      <div class="launch">Coming November 17</div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const cap = $('.cap'), title = $('.title'), sub = $('.sub'), gesture = $('.gesture'), gtext = $('.gtext'), dot = $('.dot');
  const value = $('.value'), vsub = $('.vsub'), values = $('.values');
  const end = $('.end'), e = tl.end;
  const rings = [...root.querySelectorAll('.ring')];
  const items = [['.icon', e.icon], ['.name', e.title], ['.tagline', e.tagline], ['.launch', e.launch]].map(([s, at]) => [$(s), at]);
  const rainbow = `linear-gradient(90deg, ${RAINBOW.join(', ')})`;

  function update(t) {
    const c = tl.captions.find((c) => t >= c.from && t < c.to);
    if (c) {
      cap.className = `cap ${c.style}`;
      title.textContent = c.title;
      sub.textContent = c.sub ?? '';
      sub.style.display = c.sub ? '' : 'none';
      gesture.style.display = c.gesture ? '' : 'none';
      if (c.gesture) {
        gtext.textContent = c.gesture;
        dot.style.background = c.pack === 'everyday-mac' ? rainbow : PACK[c.pack].accent;
      }
      // Words arrive quickly and settle; a cut ends a caption at once, a soft ending fades it.
      const k = clamp((t - c.from) / 0.45);
      const out = c.cut ? 1 : 1 - smooth(c.to - 0.3, c.to, t);
      cap.style.opacity = clamp(k * 2.2) * out;
      title.style.transform = `translateY(${(1 - easeOutCubic(k)) * 28}px)`;
      title.style.filter = `blur(${(1 - easeOutCubic(clamp(k * 1.6))) * 10}px)`;
      sub.style.opacity = clamp((t - c.from - 0.18) / 0.35);
      gesture.style.opacity = clamp((t - c.from - 0.22) / 0.35);
    } else cap.style.opacity = 0;

    // Values: one word at a time, each landing with its tap.
    const live = tl.values.filter((v) => t >= v.t);
    const shown = t >= tl.values[0].t - 0.05 && t < e.fade[0];
    values.style.opacity = shown ? 1 - smooth(e.fade[0] - 0.25, e.fade[0], t) : 0;
    if (live.length) {
      const v = live[live.length - 1];
      const k = clamp((t - v.t) / 0.35);
      if (value.textContent !== v.text) {
        // One line always: a longer phrase shrinks to fit the column instead of wrapping.
        value.textContent = v.text;
        value.style.fontSize = '';
        const room = values.clientWidth, need = value.scrollWidth;
        if (need > room) value.style.fontSize = `${parseFloat(getComputedStyle(value).fontSize) * room / need}px`;
      }
      value.style.opacity = clamp(k * 2);
      value.style.transform = `scale(${0.92 + 0.08 * easeOutBack(k, 1.6)})`;
      value.style.filter = `blur(${(1 - k) * 8}px)`;
    } else value.style.opacity = 0;
    vsub.textContent = tl.valuesSub.text;
    vsub.style.opacity = smooth(tl.valuesSub.t, tl.valuesSub.t + 0.5, t);

    // End card.
    const f = smooth(e.fade[0], e.fade[1], t);
    end.style.opacity = f;
    end.style.visibility = f > 0 ? 'visible' : 'hidden';
    items.forEach(([el, at], i) => {
      const k = clamp((t - at) / (i === 0 ? 0.6 : 0.45));
      el.style.opacity = clamp(k * 1.6);
      el.style.transform = i === 0 ? `scale(${0.4 + 0.6 * easeOutBack(k, 1.8)})` : `translateY(${(1 - easeOutCubic(k)) * 26}px)`;
      el.style.filter = i === 0 ? 'none' : `blur(${(1 - easeOutCubic(k)) * 8}px)`;
    });
    rings.forEach((r, i) => {
      const k = clamp((t - e.icon - i * 0.28) / 1.6);
      r.style.opacity = k > 0 ? (1 - k) * 0.7 : 0;
      r.style.transform = `translate(-50%,-50%) scale(${0.9 + easeOutCubic(k) * 1.6})`;
    });
  }
  return { update };
}

// The app's gesture rules (Sources/Recognizer), small enough for a web page. Defaults from Gesture.swift:
// a tap is down for at most 0.30 s and moves at most 3% of the pad; taps chain into double and triple taps when the
// next one starts within 0.25 s; resting fingers still for 1.5 s is a hold; one finger in the outer 15% is a corner.
export const RULES = { maxTapDuration: 0.3, multiTapInterval: 0.25, holdDuration: 1.5, maxTravel: 0.03, cornerSize: 0.15 };

/// Feed it contacts as they change; it calls onGesture({ kind: 'tap'|'hold'|'corner', fingers, count, corner }).
/// It also calls onHolding(progress 0–1) while fingers rest, so the page can show the hold filling up.
export function makeRecognizer({ onGesture, onHolding = () => {}, rules = RULES }) {
  let session = null;   // one touch: from the first finger down to the last finger up
  let pending = null;   // a tap waiting to see whether another one follows
  let pendingTimer = 0, holdTimer = 0, holdTick = 0;

  const centroid = (pts) => pts.reduce((a, [u, v]) => [a[0] + u / pts.length, a[1] + v / pts.length], [0, 0]);

  function cornerOf([u, v]) {
    const c = rules.cornerSize;
    const x = u < c ? 'left' : u > 1 - c ? 'right' : null;
    const y = v < c ? 'top' : v > 1 - c ? 'bottom' : null;
    return x && y ? `${y}-${x}` : null;
  }

  function flush() {
    clearTimeout(pendingTimer);
    if (pending) onGesture({ kind: 'tap', fingers: pending.fingers, count: pending.count });
    pending = null;
  }

  function stopHold() { clearTimeout(holdTimer); cancelAnimationFrame(holdTick); onHolding(0); }

  return {
    /// Contacts changed: `points` are all fingers down now, as [u, v] in 0–1 across the pad.
    update(points, now = performance.now() / 1000) {
      if (points.length && !session) {
        session = { start: now, origin: centroid(points), count: points.length, fingers: points.length, travel: 0, held: false, first: points[0] };
        // A new touch soon after a tap may continue it; otherwise the waiting tap is final.
        if (pending && now - pending.end > rules.multiTapInterval) flush();
        clearTimeout(pendingTimer);
        holdTimer = setTimeout(() => {
          if (!session || session.travel > rules.maxTravel) return;
          session.held = true;
          stopHold();
          flush();
          onGesture({ kind: 'hold', fingers: session.fingers });
        }, rules.holdDuration * 1000);
        const tick = () => {
          if (!session || session.held) return;
          const k = Math.min(1, (performance.now() / 1000 - session.start) / rules.holdDuration);
          if (k > 0.2) onHolding((k - 0.2) / 0.8);
          holdTick = requestAnimationFrame(tick);
        };
        holdTick = requestAnimationFrame(tick);
      }
      if (!session) return;
      if (points.length) {
        session.fingers = Math.max(session.fingers, points.length);
        // Fingers land and lift a few ms apart, which shifts the centre; only movement of a steady set of fingers counts.
        if (points.length !== session.count) { session.count = points.length; session.origin = centroid(points); return; }
        const [cu, cv] = centroid(points);
        session.travel = Math.max(session.travel, Math.hypot(cu - session.origin[0], cv - session.origin[1]));
        return;
      }
      // All fingers up: decide what the touch was.
      const s = session;
      session = null;
      stopHold();
      if (s.held) return;
      const duration = now - s.start;
      if (duration > rules.maxTapDuration || s.travel > rules.maxTravel) { flush(); return; }
      const corner = s.fingers === 1 ? cornerOf(s.first) : null;
      if (corner) { flush(); onGesture({ kind: 'corner', fingers: 1, corner }); return; }
      if (pending && pending.fingers === s.fingers && s.start - pending.end <= rules.multiTapInterval) {
        pending.count += 1;
        pending.end = now;
      } else {
        flush();
        pending = { fingers: s.fingers, count: 1, end: now };
      }
      if (pending.count >= 3) { flush(); return; }
      pendingTimer = setTimeout(flush, rules.multiTapInterval * 1000 + 20);
    },
  };
}

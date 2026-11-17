// The app's gesture rules (Sources/Recognizer), small enough for a web page. Defaults from Gesture.swift:
// a tap is down for at most 0.30 s and moves at most 3% of the pad; taps chain into double and triple taps when the
// next one starts within 0.25 s; resting fingers still for 1.5 s is a hold; one finger in the outer 15% is a corner.
export const RULES = { maxTapDuration: 0.3, multiTapInterval: 0.25, holdDuration: 1.5, maxTravel: 0.03, cornerSize: 0.15 };
// Those windows are for fingertips on glass. A mouse button or tap-to-click leaves 250–450 ms between clicks and
// stays down longer, so clicks get roomier windows; touch screens keep the app's exact rules.
export const MOUSE_RULES = { ...RULES, maxTapDuration: 0.5, multiTapInterval: 0.5 };

/// Feed it contacts as they change; it calls onGesture({ kind: 'tap'|'hold'|'corner', fingers, count, corner }).
/// It also calls onHolding(progress 0–1) while fingers rest, so the page can show the hold filling up, and
/// onReject({ reason: 'long'|'moved', fingers, duration }) for a touch that was neither a tap nor a hold.
/// `aspect()` is the pad's width / height: travel is measured in pad widths both ways, so 3% is the same
/// distance across and down.
export function makeRecognizer({ onGesture, onHolding = () => {}, onReject = () => {}, rules = RULES, aspect = () => 1 }) {
  let session = null;   // one touch: from the first finger down to the last finger up
  let pending = null;   // a tap waiting to see whether another one follows
  let pendingTimer = 0, holdTimer = 0, holdTick = 0;

  const centroid = (pts) => pts.reduce((a, [u, v]) => [a[0] + u / pts.length, a[1] + v / pts.length], [0, 0]);
  const clock = () => performance.now() / 1000;

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
    /// Contacts changed: `points` are all fingers down now, as [u, v] in 0–1 across the pad. `now` is the
    /// event's own timestamp in seconds, so a busy main thread doesn't stretch the gaps between taps.
    update(points, now = clock()) {
      if (points.length && !session) {
        // `peak` is when the last finger landed and `lift` when the first one left: fingers land and lift a few
        // ms apart, and with four or five that spread alone can outlast a tap.
        session = { start: now, peak: now, lift: null, origin: centroid(points), count: points.length, fingers: points.length, travel: 0, held: false, first: points[0] };
        // A new touch soon after a tap may continue it; otherwise the waiting tap is final.
        if (pending && now - pending.end > rules.multiTapInterval) flush();
        clearTimeout(pendingTimer);
        // The event may have waited behind a frame; count the hold from when the fingers landed.
        holdTimer = setTimeout(() => {
          if (!session || session.travel > rules.maxTravel) return;
          session.held = true;
          stopHold();
          flush();
          onGesture({ kind: 'hold', fingers: session.fingers });
        }, Math.max(0, (now + rules.holdDuration - clock()) * 1000));
        const tick = () => {
          if (!session || session.held) return;
          const k = Math.min(1, (clock() - session.start) / rules.holdDuration);
          if (k > 0.2) onHolding((k - 0.2) / 0.8);
          holdTick = requestAnimationFrame(tick);
        };
        holdTick = requestAnimationFrame(tick);
      }
      if (!session) return;
      if (points.length) {
        if (points.length > session.fingers) { session.fingers = points.length; session.peak = now; session.lift = null; }
        else if (points.length < session.count && session.lift === null) session.lift = now;
        // Fingers land and lift a few ms apart, which shifts the centre; only movement of a steady set of fingers counts.
        if (points.length !== session.count) { session.count = points.length; session.origin = centroid(points); return; }
        const [cu, cv] = centroid(points);
        session.travel = Math.max(session.travel, Math.hypot(cu - session.origin[0], (cv - session.origin[1]) / aspect()));
        // Moving ends a hold: stop the ring now rather than letting it fill up for nothing.
        if (session.travel > rules.maxTravel) stopHold();
        return;
      }
      // All fingers up: decide what the touch was.
      const s = session;
      session = null;
      stopHold();
      if (s.held) return;
      const duration = (s.lift ?? now) - s.peak;
      if (s.travel > rules.maxTravel) { flush(); onReject({ reason: 'moved', fingers: s.fingers, duration: now - s.start }); return; }
      if (duration > rules.maxTapDuration) { flush(); onReject({ reason: 'long', fingers: s.fingers, duration }); return; }
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
      // Wait out the window from the lift itself, not from when this handler happened to run.
      pendingTimer = setTimeout(flush, Math.max(0, (pending.end + rules.multiTapInterval - clock()) * 1000) + 20);
    },
  };
}

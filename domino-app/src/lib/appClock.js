// Wall-clock anchor for the cold open. Screens mount behind the intro overlay,
// so entrance animations must wait for the reveal — otherwise they play unseen.
const APP_START = Date.now();

/**
 * Milliseconds until `pointMs` after app start (0 once passed). Reveal adds this
 * to its stagger so the first screen's cascade begins exactly as the intro
 * overlay dissolves, instead of finishing invisibly behind it.
 */
export function delayUntilAppTime(pointMs) {
  return Math.max(0, pointMs - (Date.now() - APP_START));
}

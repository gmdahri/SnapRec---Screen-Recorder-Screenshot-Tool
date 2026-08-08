export const motion = Object.freeze({
  fast: 120,
  mid: 180,
  slow: 220,
  ease: 'cubic-bezier(.2,.8,.2,1)',
});

/** The signature gesture. Used at exactly three moments: countdown, capture completion, link creation. */
export const CORNER_STRIKE_KEYFRAMES = `
@keyframes sr-corner-strike {
  from { opacity: 0; transform: scale(1.25); }
  to   { opacity: 1; transform: scale(1); }
}`;

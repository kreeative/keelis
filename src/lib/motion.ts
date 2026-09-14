/**
 * The two motion facts that have to exist in JavaScript as well as in CSS.
 *
 * Everything else about the app's motion lives in tokens.css and is generated from the
 * spring equation in scripts/springs.mjs. These two cannot: React decides when an element
 * leaves the tree, and that decision has to agree with a duration written in a stylesheet.
 */

/**
 * How long anything stays mounted after it is dismissed. Must equal `--dur-exit` in
 * tokens.css, which src/lib/motion.test.ts asserts — a number in a stylesheet and a number
 * in a timer that are meant to be the same number will not stay the same number on their own.
 */
export const EXIT_MS = 180

/**
 * Reduced motion gets the end state, never a shorter animation — so there is nothing to
 * wait for and the element goes immediately.
 */
export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

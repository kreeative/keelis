/** Light haptic tick where supported (keypad). Silent no-op elsewhere. */
export function tick() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(8)
  } catch {
    /* ignore */
  }
}

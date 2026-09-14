#!/usr/bin/env node
/**
 * Generate the app's easing curves from an actual damped spring.
 *
 * Apple's motion is not an ease curve, it is a *spring*: a mass on a spring with damping,
 * released toward its target. That is why an iOS control feels like it has weight — it
 * accelerates, overshoots by a hair when it is meant to, and settles. A cubic-bezier cannot
 * overshoot at all (its control points are clamped to the unit square), so no amount of
 * fiddling with one gets there.
 *
 * CSS `linear()` can: it takes a list of output values and walks them at even time
 * intervals, values above 1 included. So sample the spring's step response and hand the
 * browser the shape. Sampled, not approximated — the numbers below come out of the
 * equation, and re-running this file is how they change.
 *
 * The parameters follow SwiftUI's `Spring(duration:bounce:)`, which is the vocabulary Apple
 * itself uses:
 *
 *     ω  = 2π / duration          the natural frequency
 *     ζ  = 1 − bounce             the damping ratio; bounce 0 is critically damped
 *     ωd = ω √(1 − ζ²)            the damped frequency, for ζ < 1
 *
 * and the unit step response is
 *
 *     ζ < 1:  x(t) = 1 − e^(−ζωt) · [cos(ωd·t) + (ζω/ωd)·sin(ωd·t)]
 *     ζ = 1:  x(t) = 1 − e^(−ωt)  · (1 + ωt)
 *
 * Run: node scripts/springs.mjs          — prints the tokens
 *      node scripts/springs.mjs --check  — fails if tokens.css has drifted from them
 */
import { readFileSync } from 'node:fs'

/**
 * The curves, and what each is for.
 *
 * Three springs and one plain exit. Nothing that *leaves* the screen should bounce: an
 * element on its way out that wobbles reads as hesitation, and Apple accelerates those away
 * instead. So `exit` is a cubic-bezier and stays one.
 *
 * `duration` here is SwiftUI's *perceptual* duration — how long the motion reads as — not
 * how long the maths runs for. A spring never mathematically arrives, so the CSS duration
 * emitted below is the settling time, computed rather than chosen.
 */
export const SPRINGS = [
  {
    name: '--ease-smooth',
    duration: 0.24,
    bounce: 0,
    note: 'No overshoot. Colour, opacity, shadow — anything where a bounce would be a tic.',
  },
  {
    name: '--ease-snappy',
    duration: 0.3,
    bounce: 0.15,
    note: 'A hair of overshoot. A control answering a finger — this is what gives it weight.',
  },
  {
    name: '--ease-bouncy',
    duration: 0.5,
    bounce: 0.32,
    note: 'Visible overshoot, for something arriving: a sheet, a toast, a success state.',
  },
]

/** Position of a unit step response at time `t`, in seconds. */
export function springAt(t, duration, bounce) {
  const omega = (2 * Math.PI) / duration
  const zeta = 1 - bounce
  if (zeta >= 1) return 1 - Math.exp(-omega * t) * (1 + omega * t)
  const omegaD = omega * Math.sqrt(1 - zeta * zeta)
  return 1 - Math.exp(-zeta * omega * t) * (Math.cos(omegaD * t) + ((zeta * omega) / omegaD) * Math.sin(omegaD * t))
}

/**
 * How long until the spring is within `tol` of its target and stays there.
 *
 * This is the number that has to become the CSS duration. Sampling over the *perceptual*
 * duration instead is what the first version of this file did, and it is wrong in a way that
 * is easy to miss in the arithmetic and obvious on screen: at t = duration the bouncy spring
 * is still at 1.019, so forcing the last stop to 1 made the curve fall 2% in its final
 * frames — a snap at the end of every sheet, which is precisely the tic a spring is used to
 * avoid. Sampled to settling, the last stop is already within a fifth of a percent and
 * pinning it to 1 changes nothing anyone can see.
 */
export function settleTime(duration, bounce, tol = 0.004) {
  for (let ms = 10; ms <= 5000; ms += 10) {
    const t = ms / 1000
    // Settled only if it is inside the band *and* the envelope keeps it there.
    if (Math.abs(springAt(t, duration, bounce) - 1) < tol && Math.abs(springAt(t + 0.005, duration, bounce) - 1) < tol) {
      const zeta = 1 - bounce
      const omega = (2 * Math.PI) / duration
      const envelope = Math.exp(-Math.min(zeta, 1) * omega * t) * (zeta >= 1 ? 1 + omega * t : 1 / Math.sqrt(1 - zeta * zeta))
      if (envelope < tol) return ms
    }
  }
  return 5000
}

/**
 * Sample a spring into a `linear()` easing over its settling time.
 *
 * `linear()` walks its stops at equal time intervals, so the sampling rate *is* the
 * fidelity. Sixteen is enough for a curve with no overshoot and too few for one with: the
 * peak lands between two stops and gets cut off, turning a bounce into a shrug. Thirty-two
 * keeps the peak on every curve here — the window is the settling time now, which is wider
 * than the perceptual duration, so the stops are further apart and the peak needs more of
 * them, not fewer.
 */
export function toLinear(duration, bounce, ms = settleTime(duration, bounce), steps = 32) {
  const total = ms / 1000
  const values = []
  for (let i = 0; i <= steps; i++) {
    const v = springAt((i / steps) * total, duration, bounce)
    values.push(i === steps ? 1 : Number(v.toFixed(4)))
  }
  // The first stop is always 0 and the last always 1: a spring starts where it starts and
  // ends where it was sent, whatever the arithmetic says about the last millisecond.
  values[0] = 0
  return `linear(${values.join(', ')})`
}

const tokens = SPRINGS.map((s) => {
  const ms = settleTime(s.duration, s.bounce)
  return { ...s, ms, value: toLinear(s.duration, s.bounce, ms) }
})

if (process.argv.includes('--check')) {
  const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
  const drifted = tokens.flatMap((t) => {
    const miss = []
    if (!css.includes(`${t.name}: ${t.value};`)) miss.push({ name: t.name, want: t.value })
    const dur = `${t.name.replace('--ease', '--dur')}: ${t.ms}ms;`
    if (!css.includes(dur)) miss.push({ name: t.name.replace('--ease', '--dur'), want: `${t.ms}ms` })
    return miss
  })
  if (drifted.length) {
    console.error(
      `These motion tokens in tokens.css are not what the spring equation produces:\n` +
        drifted.map((t) => `  ${t.name}\n    want: ${t.want}`).join('\n') +
        `\n\nRun \`node scripts/springs.mjs\` and paste the output.`,
    )
    process.exit(1)
  }
  console.log(`Springs: ${tokens.length} easings and their durations match the equation that generated them.`)
} else {
  for (const t of tokens) {
    console.log(`  /* ${t.note}`)
    console.log(`     Spring: ${t.duration}s perceptual, bounce ${t.bounce}; ${t.ms}ms to settle.`)
    console.log(`     Generated — run \`node scripts/springs.mjs\`, never edit by hand. */`)
    console.log(`  ${t.name}: ${t.value};`)
    console.log(`  ${t.name.replace('--ease', '--dur')}: ${t.ms}ms;`)
  }
}

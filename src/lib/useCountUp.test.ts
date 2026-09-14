/**
 * The balance is the one thing on the screen that has earned motion, and the rules that
 * keep that from becoming a gimmick are the ones worth pinning.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openingValue, useCountUp, FIGURE_MS } from './useCountUp'

/** Drive requestAnimationFrame from the fake clock so the animation is observable. */
function useFakeFrames() {
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(now), 16) as unknown as number)
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  return {
    advance(ms: number) {
      now += ms
      act(() => {
        vi.advanceTimersByTime(ms)
      })
    },
  }
}

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduced-motion'), media: q, addEventListener() {}, removeEventListener() {} }))
}

beforeEach(() => {
  vi.useFakeTimers()
  setReducedMotion(false)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('a figure arriving', () => {
  it('starts near the answer, not at zero', () => {
    // Counting from zero turns a balance into a slot machine and takes the whole duration
    // to become readable.
    expect(openingValue(1_000_000)).toBeGreaterThan(500_000)
    expect(openingValue(1_000_000)).toBeLessThan(1_000_000)
  })

  it('counts up on the first landing, and ends exactly on the value', () => {
    const frames = useFakeFrames()
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, true), { initialProps: { v: undefined as number | undefined } })
    rerender({ v: 1_000_000 })
    expect(result.current).toBeLessThan(1_000_000)
    frames.advance(FIGURE_MS + 32)
    // Exactly, not approximately: a balance must not settle a franc from the truth.
    expect(result.current).toBe(1_000_000)
  })

  it('does not re-count when the figure moves again', () => {
    // The Actifs balance changes every ten seconds. Re-counting would be a fidget, and it
    // would be moving exactly when someone is reading it.
    const frames = useFakeFrames()
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, true), { initialProps: { v: undefined as number | undefined } })
    rerender({ v: 1_000_000 })
    frames.advance(FIGURE_MS + 32)
    rerender({ v: 1_000_500 })
    expect(result.current).toBe(1_000_500)
  })

  it('snaps when the call site says not to animate', () => {
    // Scrubbing a chart: the hero has to keep up with the finger.
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, false), { initialProps: { v: undefined as number | undefined } })
    rerender({ v: 42_000 })
    expect(result.current).toBe(42_000)
  })

  it('gives the final figure immediately under reduced motion', () => {
    setReducedMotion(true)
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, true), { initialProps: { v: undefined as number | undefined } })
    rerender({ v: 7_500 })
    // Not a shorter animation — none.
    expect(result.current).toBe(7_500)
  })
})

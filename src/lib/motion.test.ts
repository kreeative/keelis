/**
 * The exit timer and the exit animation are the same duration written twice — once in
 * TypeScript so React knows when to unmount, once in CSS so the browser knows how long to
 * animate. Pin them together: too short and a sheet vanishes mid-slide, too long and a
 * transparent full-screen overlay sits over the app swallowing taps after it is gone.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXIT_MS } from './motion'

describe('the exit duration', () => {
  it('is --dur-exit, exactly', () => {
    const css = readFileSync(join(__dirname, '../styles/tokens.css'), 'utf8')
    const ms = css.match(/--dur-exit:\s*(\d+)ms;/)?.[1]
    expect(ms).toBeDefined()
    expect(EXIT_MS).toBe(Number(ms))
  })
})

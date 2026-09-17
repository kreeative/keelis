/**
 * The manifest's contract, and the two things about it that cannot be seen by reading it.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PHOTOS, PHOTO_TYPES, PHOTO_WIDTHS, photo, photoCredits } from './photos'

const ROOT = join(__dirname, '../..')

describe('the photography manifest', () => {
  it('gives every slot an intent somebody could commission from', () => {
    /* The manifest is the brief. A slot whose intent is a word is a slot the owner cannot
       hand to a photographer, and the photographs are the owner's to obtain. */
    for (const [name, slot] of Object.entries(PHOTOS)) {
      expect(slot.intent.length, `${name} intent`).toBeGreaterThan(40)
      expect(slot.name, `${name} file stem`).toBe(name)
    }
  })

  it('returns null for a slot with no file, so a screen falls back rather than breaks', () => {
    for (const [name, slot] of Object.entries(PHOTOS)) {
      if (!slot.present) expect(photo(name as keyof typeof PHOTOS), name).toBeNull()
    }
  })

  /**
   * **A photograph on screen with nobody credited is the failure this catches.**
   *
   * `/entreprise` promises that every figure on it is one the codebase can point at, and a
   * picture is a claim in another medium: somebody took it and somebody licensed it. The
   * moment a slot is switched on, its credit and its alt text stop being optional — and both
   * are the kind of thing that gets left for later and then ships.
   */
  it('refuses a live slot with no credit and no alt text', () => {
    const naked = Object.values(PHOTOS)
      .filter((p) => p.present)
      .filter((p) => !p.credit || p.alt.trim().length < 10)
      .map((p) => p.name)
    expect(naked, 'live slots missing a credit or a describing sentence').toEqual([])
  })

  it('prints a credit for every live slot', () => {
    expect(photoCredits().length).toBe(Object.values(PHOTOS).filter((p) => p.present).length)
  })

  /**
   * **No image file may be committed, ever.** The rights are the owner's to hold, and an
   * unlicensed photograph in git history is a problem that outlives the commit which removed
   * it — the same reasoning that keeps `.env` out. `scripts/photo-placeholder.mjs` writes
   * stand-ins into this folder for local work, so without this the first careless `git add -A`
   * commits twelve fake JPEGs; with a real licence in hand it would commit the real ones and
   * put them in the history for good.
   */
  it('keeps public/photos free of committed images', () => {
    const ignore = readFileSync(join(ROOT, '.gitignore'), 'utf8')
    expect(ignore).toContain('public/photos/*')
    expect(ignore).toContain('!public/photos/README.md')
  })

  it('names the README as the only thing the folder is allowed to carry', () => {
    const tracked = readdirSync(join(ROOT, 'public/photos'))
    expect(tracked).toContain('README.md')
  })

  it('asks for the formats in the order a browser should try them', () => {
    /* AVIF first, JPEG last: a <source> list is taken in order, so reversing this serves the
       heaviest file to every modern browser. */
    expect(PHOTO_TYPES.map((t) => t.ext)).toEqual(['avif', 'webp', 'jpg'])
    expect(PHOTO_WIDTHS).toEqual([800, 1600])
  })
})

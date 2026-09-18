/**
 * The manifest's contract, and the two things about it that cannot be seen by reading it.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
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
   * **A placeholder must never reach the deployed site**, and this is the guard that can
   * actually tell one from a photograph.
   *
   * It used to be a `.gitignore` path over `public/photos/`, which was wrong in a way worth
   * keeping written down: the site builds from this repository, so ignoring the folder
   * guaranteed the deployed app had no pictures at all — the rule made the feature
   * impossible while looking like caution. And a path could never have worked anyway, because
   * a stand-in and the real thing share filenames *by design*: that is what makes dropping
   * the real ones in a no-code change.
   *
   * So `scripts/photo-placeholder.mjs` stamps each frame with a PNG `tEXt` chunk and this
   * reads the bytes. A marker survives being renamed, copied and re-committed; a path does
   * not survive being moved.
   */
  it('has no placeholder among the committed photographs', () => {
    const dir = join(ROOT, 'public/photos')
    const marker = Buffer.from('KEEWAL-PLACEHOLDER')
    const fake = readdirSync(dir)
      .filter((f) => /\.(jpe?g|webp|avif|png)$/i.test(f))
      .filter((f) => readFileSync(join(dir, f)).includes(marker))
    expect(fake, 'placeholder images in public/photos — run `node scripts/photo-placeholder.mjs --clean`').toEqual([])
  })

  /**
   * A slot's `widths` are what is **on disk**, and a `srcset` naming a width with no file
   * sends the browser after a 404 at the worst moment — the first paint of the front door.
   */
  it('has every file a live slot promises', () => {
    const dir = join(ROOT, 'public/photos')
    const missing: string[] = []
    for (const slot of Object.values(PHOTOS)) {
      if (!slot.present) continue
      expect(slot.widths.length, `${slot.name} widths`).toBeGreaterThan(0)
      for (const w of slot.widths) {
        for (const t of PHOTO_TYPES) {
          const f = `${slot.name}-${w}.${t.ext}`
          if (!existsSync(join(dir, f))) missing.push(f)
        }
      }
    }
    expect(missing, 'files a live slot advertises but does not have').toEqual([])
  })

  it('asks for the formats in the order a browser should try them', () => {
    /* AVIF first, JPEG last: a <source> list is taken in order, so reversing this serves the
       heaviest file to every modern browser. */
    /* AVIF is absent on purpose — Chromium's canvas answers a request for it with a PNG and
       no error, so the importer refuses it rather than write bytes whose name lies. */
    expect(PHOTO_TYPES.map((t) => t.ext)).toEqual(['webp', 'jpg'])
    expect(PHOTO_WIDTHS).toEqual([800, 1600])
  })
})

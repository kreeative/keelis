/**
 * The photography manifest.
 *
 * **The app reads this, never the folder.** A slot whose `present` is false renders its
 * screen's type-only layout — which is exactly what shipped before photography existed — so
 * a missing file is a design that is quieter, never a design that is broken. That matters
 * more than it sounds: the owner supplies the licensed images, and until they arrive the
 * app has to be shippable. Building the image-led layout *and* leaving the type-only one
 * intact is the only way both of those are true at once.
 *
 * Adding a photograph is: drop the six files named in `public/photos/README.md`, set
 * `present: true`, fill in `credit` and `alt`. No component changes.
 */

export interface PhotoSlot {
  /** File stem under `public/photos/`. `welcome` → `welcome-800.avif` and friends. */
  readonly name: string
  /** What this slot is for, so the next person knows what to commission rather than guessing. */
  readonly intent: string
  /**
   * Whether the files are actually there.
   *
   * A boolean rather than a fetch: this decides the *layout*, and a layout that waits on a
   * network round trip to know its own shape flashes one and then the other. The build is
   * where this is known, so the build is where it is written down.
   */
  readonly present: boolean
  /**
   * The describing sentence. Not decoration — these photographs carry the culture the app is
   * for, and « image » is what a screen reader says when nobody wrote one.
   */
  readonly alt: string
  /** Photographer · source · licence. Printed on `/entreprise`; an uncredited photo is a problem, not a gap. */
  readonly credit: string | null
}

/**
 * Declared slots. The intents come from the references the owner gave: masks lit singly out
 * of darkness, and the hands that play and carry them.
 */
export const PHOTOS = {
  welcome: {
    name: 'welcome',
    intent:
      'The front door. One carved mask lit warm out of near-black, room around it — the app’s type sits in the frame’s empty half, so the subject must not be centred.',
    present: false,
    alt: '',
    credit: null,
  },
  company: {
    name: 'company',
    intent: 'A band across /entreprise. Hands at work — weaving, playing, counting — rather than a face; the page is about what the product does, not who it is for.',
    present: false,
    alt: '',
    credit: null,
  },
  /* No `as const` here, deliberately. It would freeze `present` to the literal `false`, so
     `photo()` would be typed as always returning null and the flag could never mean anything
     — a manifest unable to express the one thing it exists to say. `satisfies` keeps the
     keys literal for `PhotoName` without narrowing the values. */
} satisfies Record<string, PhotoSlot>

export type PhotoName = keyof typeof PHOTOS

/** The slot, or null when there is no file — the one question every caller asks. */
export function photo(name: PhotoName): PhotoSlot | null {
  const slot = PHOTOS[name]
  return slot.present ? slot : null
}

/** Every credit that exists, for the page that prints them. */
export function photoCredits(): ReadonlyArray<{ name: string; credit: string }> {
  const out: { name: string; credit: string }[] = []
  for (const p of Object.values(PHOTOS)) if (p.present && p.credit) out.push({ name: p.name, credit: p.credit })
  return out
}

/** The widths `public/photos/README.md` asks for, in the order a `srcset` wants them. */
export const PHOTO_WIDTHS = [800, 1600] as const
/** AVIF first, JPEG last — a browser takes the first type it understands. */
export const PHOTO_TYPES = [
  { ext: 'avif', mime: 'image/avif' },
  { ext: 'webp', mime: 'image/webp' },
  { ext: 'jpg', mime: 'image/jpeg' },
] as const

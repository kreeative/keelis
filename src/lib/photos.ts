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
  /**
   * The widths actually on disk, which is **not** always what the README asks for.
   *
   * `scripts/photo-import.mjs` never upscales: a 1000px source asked to fill a 1600px slot is
   * the same pixels in more bytes, and a `srcset` advertising a width no file has makes the
   * browser pick the heavier of two identical pictures. So the slot records what exists.
   */
  readonly widths: readonly number[]
  /**
   * Where the subject is, as a CSS `object-position`.
   *
   * A frame is cropped by whatever box it lands in, and **the right crop is a property of the
   * picture, not of the component**. One default served the welcome hero and beheaded the
   * mask on `/entreprise`: the same `50% 35%` that keeps a tall subject clear of the sheet
   * cuts the face off a portrait dropped into a landscape band.
   */
  readonly focus: string
}

/**
 * Declared slots. The intents come from the references the owner gave: masks lit singly out
 * of darkness, and the hands that play and carry them.
 */
export const PHOTOS = {
  welcome: {
    name: 'welcome',
    intent:
      'The front door. One carved mask lit warm out of near-black, room around it — the app’s type sits above the frame, so what this needs is depth rather than a gap.',
    present: true,
    alt: 'Un masque dan bordé de cauris, porté par une personne qui joue d’une kora dans un couloir sombre',
    /* The owner's word: the image is free for anyone to use. The photographer is still
       unnamed, and a name is worth printing the day one is known. */
    credit: 'Image libre d’utilisation, fournie par le propriétaire',
    widths: [800, 1000],
    /* The mask sits high in the frame and the sheet covers the lower third, so the crop is
       weighted up — the hands on the kora are lost to the sheet either way. */
    focus: '50% 30%',
  },
  company: {
    name: 'company',
    intent: 'A band across /entreprise, breaking the column. Nothing sits on it, so it can be the one brightly-lit frame in the set — an object photographed against a pale ground rather than a subject in darkness.',
    present: true,
    alt: 'Un masque africain en laiton, photographié de face sur un fond gris clair',
    credit: 'Fournie par le propriétaire — photographe et licence à confirmer avant la mise en ligne',
    widths: [800, 1200],
    /* Centred: this one is an object photographed square-on, so any weighting cuts it. */
    focus: '50% 48%',
  },
  card: {
    name: 'card',
    intent:
      'The face of the virtual card, under the wordmark, the chip and the holder’s name. A dark brown brushed-metal card lit by one warm light from the top, laser-engraved in textured copper-gold line with one mark, the cowrie shell seen from its slotted underside, six times at one size: clustered toward the top-right corner, each tilted its own way, two along the top edge, three in a loose row beneath, one below those — the owner’s own placement, taken off their Figma card. The left two thirds and the bottom band stay plain, because that is where the wordmark, the chip and the name sit.',
    present: true,
    alt: 'Face de carte en métal brun brossé, gravée à l’or de six cauris groupés vers le coin supérieur droit',
    credit: 'Rendu commandé par le propriétaire sur son compte Higgsfield (GPT Image) — libre d’utilisation dans l’application',
    widths: [800, 1600],
    /* The picture is 3:2 and the card is 1.586:1, so the crop is vertical only; centred, the
       cowrie's tip and foot both stay inside the card. */
    focus: '50% 50%',
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

/** The widths asked for; a slot records the ones it actually got in `widths`. */
export const PHOTO_WIDTHS = [800, 1600] as const

/**
 * WebP first, JPEG behind it — a browser takes the first type it understands.
 *
 * **AVIF is deliberately absent, and it was removed on a measurement rather than a hunch.**
 * `scripts/photo-import.mjs` encodes through the Chromium this repo already has, and
 * `canvas.toDataURL('image/avif')` does not throw or return null: it **silently hands back a
 * PNG**. Shipping that behind `<source type="image/avif">` would serve PNG bytes, several
 * times the weight, to every modern browser — chosen first, precisely because they support
 * the format the file is not — with nothing anywhere reporting a fault. The importer now
 * refuses any encode whose returned type is not the one it asked for. If AVIF is ever worth
 * having, it needs a real encoder; it does not need this list to mention it.
 */
export const PHOTO_TYPES = [
  { ext: 'webp', mime: 'image/webp' },
  { ext: 'jpg', mime: 'image/jpeg' },
] as const

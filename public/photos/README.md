# Photographs

**Nothing in this folder ships without a licence the owner holds**, and that is the whole
reason the folder is empty and the app works anyway. The four references this direction came
from cannot be used: one carries a photographer's watermark, one is museum object
photography, one is a Mercedes-Benz product shot and their trademark. A fintech app is the
last place to be casual about provenance — the footer on `/entreprise` promises the reader
that every claim on it is one the codebase can point at, and an unlicensed photograph is the
same promise broken in a different medium.

## How this works

`src/lib/photos.ts` is the manifest. Every slot is declared there with the shape it needs and
what it is *for*; the app reads the manifest, not the folder. A slot with no file renders the
screen's type-only layout, which is exactly what shipped before this existed — so the app is
never broken by a missing photograph, and adding one is dropping files here and flipping
`present: true`.

## What each file must be

For a slot named `welcome`, drop:

    welcome-800.avif    welcome-800.webp    welcome-800.jpg
    welcome-1600.avif   welcome-1600.webp   welcome-1600.jpg

- **Three formats, two widths.** `Photo` emits a `<picture>` with AVIF first, WebP second and
  JPEG last, and a `srcset` across the two widths. Most of the people this app is for are on
  a phone on mobile data; a 1600px JPEG served to a 390px screen is the difference between a
  screen that arrives and one that does not.
- **800px wide covers every phone** at 2× (a 390px screen asks for 780) and 1600 covers a
  laptop. There is no 2400: nothing in this app is full-bleed on a 4K monitor.
- **Budget: 120 KB for the 800, 320 KB for the 1600**, in AVIF. `pnpm check:photos` fails
  above that. A hero nobody waits for is a hero nobody sees.
- **Dark subject, single warm light.** The references are all one lit object against darkness,
  which is what lets the app's own type sit over the frame without a heavy scrim eating the
  picture. A bright, evenly-lit photograph needs a scrim so dark it may as well not be there.

## Credit

Every file needs a line in the manifest's `credit` field — photographer, source, licence.
`/entreprise` prints them. A credit that exists only in a folder is a credit nobody gave.

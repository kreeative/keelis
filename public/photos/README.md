# Photographs

**Nothing in this folder ships without a licence the owner holds.** A fintech app is the last
place to be casual about provenance — the footer on `/entreprise` promises the reader that
every claim on it is one the codebase can point at, and an unlicensed photograph is the same
promise broken in a different medium. The `credit` in the manifest is printed on that page,
and it is not decoration: a photograph on screen with nobody named is the gap this is meant
to close.

These files are committed, and that is deliberate — the site builds from the repository, so
an ignored photograph is one the deployed app never has. What must never be committed is a
**placeholder**: `scripts/photo-placeholder.mjs` stamps every stand-in it writes with a PNG
`tEXt` marker, and a test fails on any image here carrying it. The guard is in the bytes
because a stand-in and the real thing share filenames on purpose.

## How this works

`src/lib/photos.ts` is the manifest. Every slot is declared there with the shape it needs and
what it is *for*; the app reads the manifest, not the folder. A slot with no file renders the
screen's type-only layout, which is exactly what shipped before this existed — so the app is
never broken by a missing photograph, and adding one is dropping files here and flipping
`present: true`.

## What each file must be

Hand the source to the importer and it writes them:

    node scripts/photo-import.mjs welcome ~/Pictures/mask.jpg

It produces `welcome-800.webp`, `welcome-800.jpg` and the same pair at the next width, then
prints the `widths` line to paste into the slot.

- **Two formats, WebP first.** Most of the people this app is for are on a phone on mobile
  data; a 1600px file served to a 390px screen is the difference between a screen that
  arrives and one that does not.
- **There is no AVIF, and that is measured.** Chromium's `canvas.toDataURL('image/avif')`
  does not fail — it silently returns a **PNG**. Behind `<source type="image/avif">` that
  serves PNG bytes, several times the weight, to exactly the browsers modern enough to have
  been offered the format. The importer refuses any encode whose returned type is not the one
  it asked for. Adding AVIF back means adding a real encoder, not re-adding the line.
- **800px wide covers every phone** at 2× (a 390px screen asks for 780) and 1600 covers a
  laptop. There is no 2400: nothing here is full-bleed on a 4K monitor.
- **The importer never upscales.** A 1000px source gives 800 and 1000, and the slot records
  what exists — a `srcset` naming a width with no file sends the browser after a 404.
- **Budget: about 120 KB at 800 and 320 KB at 1600.** A hero nobody waits for is a hero
  nobody sees.
- **Dark subject, single warm light.** The references are all one lit object against darkness,
  which is what lets the app's own type sit over the frame without a heavy scrim eating the
  picture. A bright, evenly-lit photograph needs a scrim so dark it may as well not be there.

## Credit

Every file needs a line in the manifest's `credit` field — photographer, source, licence.
`/entreprise` prints them. A credit that exists only in a folder is a credit nobody gave.

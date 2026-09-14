#!/usr/bin/env python3
"""
Tint the monogram discs into the palette, without redrawing them.

The brand sheet draws the K disc *embossed* — a raised letter, a lit rim, a soft shadow —
and both exports are pure greyscale (measured: zero chroma on every opaque pixel). That was
invisible while the app was monochrome. On warm brown it is not: a neutral disc among warm
neutrals reads as a cold patch, the same failure the token guard now catches for `oklch(L 0 0)`.

So this maps each grey to the *same lightness* in the warm family and leaves everything else
alone. It is a tint, not a trace: the emboss is entirely carried by relative lightness, and
that is exactly what is preserved. `CLAUDE.md` forbids replacing the disc with a drawn
circle, and this does not — the artwork is the artwork, wearing the palette's colour.

Chroma is gamut-mapped per level rather than clamped: near white, `oklch(0.98 0.03 88)` is
outside sRGB, and clipping a channel shifts the hue instead of reducing the saturation.

One-off, kept for reproducibility — the greyscale exports stay in `brand-src/`, which is not
served, so a different warmth is one edit and a re-run away rather than a re-export.

    python3 scripts/tint-mark.py
"""
from PIL import Image
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# (source, destination, chroma, hue). The paper disc goes on dark brown surfaces and the
# always-dark card; the ink disc goes on the cream page. Both stay near-neutral: this is a
# surface, not the accent, so it borrows the warmth without borrowing the gold.
JOBS = [
    ("brand-src/mark-paper-grey.png", "public/brand/mark-paper.png", 0.030, 88),
    ("brand-src/mark-ink-grey.png", "public/brand/mark-ink.png", 0.026, 68),
]


def oklch_to_srgb(L, C, H):
    h = np.radians(H)
    a, b = C * np.cos(h), C * np.sin(h)
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    return np.array([
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ])


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * max(c, 0.0) ** (1 / 2.4) - 0.055


def lightness_of_grey(g):
    """oklch L of a neutral: every channel equal, so the cube roots collapse to one."""
    return np.cbrt(srgb_to_linear(g / 255))


def lut(chroma, hue):
    """256 greys → 256 warm RGB triples, chroma reduced per level until it is in gamut."""
    out = np.zeros((256, 3), dtype=np.uint8)
    for g in range(256):
        L = lightness_of_grey(g)
        c = chroma
        while True:
            lin = oklch_to_srgb(L, c, hue)
            if c <= 0.0005 or (lin.min() >= -0.001 and lin.max() <= 1.001):
                break
            c *= 0.95
        out[g] = [round(min(255, max(0, linear_to_srgb(v) * 255))) for v in lin]
    return out


for src, dst, chroma, hue in JOBS:
    im = Image.open(ROOT / src).convert("RGBA")
    a = np.asarray(im)
    table = lut(chroma, hue)
    tinted = np.dstack([table[a[:, :, 0]], a[:, :, 3]])
    Image.fromarray(tinted, "RGBA").save(ROOT / dst, optimize=True)
    print(f"{src} → {dst}  (chroma {chroma}, hue {hue})")

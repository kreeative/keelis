/**
 * A photograph, served at the size the screen actually needs.
 *
 * **Most of the people this app is for are on a phone on mobile data**, and a hero is the
 * heaviest thing a screen can carry. So this is a `<picture>`: AVIF first, WebP second, JPEG
 * last, across the two widths `public/photos/README.md` asks for, with `sizes` telling the
 * browser what it is about to paint *before* it chooses a file. A 1600px JPEG served to a
 * 390px screen is the difference between a screen that arrives on a taxi connection and one
 * that does not — and that is the same connection `RouteBoundary` exists for.
 *
 * `width` and `height` are always emitted so the box is reserved before the bytes land. A
 * hero that pops in and shoves the page is the layout shift people feel most, and it happens
 * exactly where first impressions are made.
 *
 * **There is no placeholder photograph.** A slot with no file renders nothing and the screen
 * falls back to its type-only layout, which is what shipped before this existed. Inventing a
 * stand-in image would mean shipping somebody else's picture, and a fintech app is the last
 * place to be casual about that.
 */
import type { CSSProperties } from 'react'
import { PHOTO_TYPES, photo, type PhotoName } from '@/lib/photos'
import { cn } from '@/lib/cn'
import styles from './Photo.module.css'

export interface PhotoProps {
  name: PhotoName
  /**
   * What the browser should assume this will occupy, as a `sizes` attribute. Default is
   * full-bleed; pass the real measure when it sits in a column, or the browser fetches for a
   * width the picture never gets.
   */
  sizes?: string
  /**
   * A dark wash over the frame so type can sit on it. `bottom` weights it to the foot, where
   * a hero's text goes; `full` is an even wash for a band behind a whole block.
   *
   * It is not optional styling: the contrast audit cannot measure text over a photograph —
   * it reads computed backgrounds, and a picture has no colour to read — so legibility here
   * has to hold by construction. The scrim is that construction.
   */
  scrim?: 'none' | 'bottom' | 'full'
  /**
   * Pour the page's own colour over the **top** edge, so the photograph has no line where it
   * begins. Not a scrim — the opposite operation, at the other end of the frame — and the
   * thing the reference does that this app was missing: it dissolves into the page, while
   * ours drew a hard horizontal rule across the screen at the point the eye arrives.
   */
  dissolve?: boolean | 'deep'
  /** The first image on a screen is worth fetching eagerly; anything below the fold is not. */
  priority?: boolean
  className?: string
}

export function Photo({ name, sizes = '100vw', scrim = 'none', dissolve = false, priority = false, className }: PhotoProps) {
  const slot = photo(name)
  if (!slot) return null

  /* The slot's own widths, not the wished-for ones: the importer never upscales, so a
     narrow source has fewer files and a `srcset` naming a width that is not there sends the
     browser after a 404. */
  const srcSet = (ext: string) => slot.widths.map((w) => `/photos/${slot.name}-${w}.${ext} ${w}w`).join(', ')
  const fallback = `/photos/${slot.name}-${slot.widths[0]}.jpg`

  return (
    <div
      className={cn(styles.frame, scrim !== 'none' && styles[scrim], dissolve && styles.dissolve, dissolve === 'deep' && styles.deep, className)}
      data-photo={slot.name}
      /* Through a custom property rather than an inline `object-position`, so the crop stays
         a value the stylesheet owns and a screen can still override it for its own box. */
      style={{ '--photo-focus': slot.focus } as CSSProperties}
    >
      <picture>
        {PHOTO_TYPES.map((t) => (
          <source key={t.ext} type={t.mime} srcSet={srcSet(t.ext)} sizes={sizes} />
        ))}
        <img
          className={styles.img}
          src={fallback}
          sizes={sizes}
          alt={slot.alt}
          width={slot.widths[0]}
          height={Math.round((slot.widths[0] ?? 800) * 1.25)}
          loading={priority ? 'eager' : 'lazy'}
          /* `high` on the one image a screen is *about*, so it is not queued behind the
             fonts and the chunk; `auto` everywhere else. */
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
        />
      </picture>
    </div>
  )
}

/** True when a screen may draw its image-led layout. Keeps the check in one place. */
export function hasPhoto(name: PhotoName): boolean {
  return photo(name) !== null
}

/**
 * The engraving on the virtual card, drawn rather than rendered.
 *
 * The first face was a Higgsfield render with the symbols baked in, and the owner pointed
 * at them: hand-drawn, each one a little different, the comb crooked and the spirals
 * unequal. « I want the symbols to have an even shape. » A model draws a symbol the way a
 * hand does; an engraver draws it the way a machine does. So the brushed metal stays a
 * photograph — the ground is what a render is good at — and the marks on it are vector,
 * **computed** where they have a shape a formula owns: the spirals of Dwennimmen are one
 * Archimedean spiral mirrored four ways, the Nkyinkyim is a sine, the cowrie's slit is a
 * zigzag with every tooth the same. One stroke width, round joins, one gold: even by
 * construction, and the same at every size because it scales with the card.
 *
 * The cowrie is the owner's own print — the slotted underside, serrated, chevrons either
 * side — and the four Adinkra are the ones on the sheet they sent: Duafe, Dwennimmen,
 * Adinkrahene, Nkyinkyim. Everything sits on the right half; the type owns the left.
 */
import styles from './CardEngraving.module.css'

/** Points on an Archimedean spiral from radius `r0` to `r1` over `turns`, as a path. */
function spiral(cx: number, cy: number, r0: number, r1: number, turns: number, dir: 1 | -1, flipY: 1 | -1): string {
  const steps = Math.round(turns * 40)
  const parts: string[] = []
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const a = t * turns * Math.PI * 2 * dir
    const r = r0 + (r1 - r0) * t
    const x = cx + r * Math.cos(a)
    const y = cy + flipY * r * Math.sin(a)
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return parts.join(' ')
}

/** A vertical sine wave: the Nkyinkyim's twist, every bend the same. */
function wave(cx: number, y0: number, y1: number, amp: number, periods: number): string {
  const steps = periods * 24
  const parts: string[] = []
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const y = y0 + (y1 - y0) * t
    const x = cx + amp * Math.sin(t * periods * Math.PI * 2)
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return parts.join(' ')
}

/** A vertical zigzag between `y0` and `y1`: the cowrie's serrated lip. */
function zigzag(x: number, y0: number, y1: number, amp: number, teeth: number, side: 1 | -1): string {
  const parts: string[] = [`M${x.toFixed(2)},${y0.toFixed(2)}`]
  for (let i = 1; i <= teeth * 2; i += 1) {
    const y = y0 + ((y1 - y0) * i) / (teeth * 2)
    const dx = i % 2 === 1 ? amp * side : 0
    parts.push(`L${(x + dx).toFixed(2)},${y.toFixed(2)}`)
  }
  return parts.join(' ')
}

/** Four spirals about a centre, mirrored so the ram's horns curl outward on every side. */
function dwennimmen(cx: number, cy: number, spread: number, r: number): string[] {
  const out: string[] = []
  for (const sx of [-1, 1] as const) {
    for (const sy of [-1, 1] as const) {
      const dir = (sx * sy) as 1 | -1
      out.push(spiral(cx + sx * spread, cy + sy * spread, 1.2, r, 1.6, dir, sy))
    }
  }
  return out
}

const COWRIE = { cx: 292, cy: 126, rx: 48, ry: 68, slit: 5, teeth: 14, amp: 3.2 }

export function CardEngraving() {
  const c = COWRIE
  return (
    <svg className={styles.engraving} viewBox="0 0 400 252" aria-hidden="true" focusable="false">
      <g fill="none" stroke="var(--accent-etch)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* Cowrie: the shell, the serrated slit, the chevrons and their dots. */}
        <ellipse cx={c.cx} cy={c.cy} rx={c.rx} ry={c.ry} />
        <path d={zigzag(c.cx - c.slit, c.cy - c.ry + 14, c.cy + c.ry - 14, c.amp, c.teeth, -1)} />
        <path d={zigzag(c.cx + c.slit, c.cy - c.ry + 14, c.cy + c.ry - 14, c.amp, c.teeth, 1)} />
        {[-1, 1].map((s) => (
          <g key={s}>
            <path d={`M${c.cx + s * 34},${c.cy - 26} L${c.cx + s * 22},${c.cy - 14} L${c.cx + s * 34},${c.cy - 2}`} />
            <path d={`M${c.cx + s * 34},${c.cy + 2} L${c.cx + s * 22},${c.cy + 14} L${c.cx + s * 34},${c.cy + 26}`} />
            <circle cx={c.cx + s * 40} cy={c.cy + 38} r="1.6" fill="var(--accent-etch)" stroke="none" />
          </g>
        ))}

        {/* Duafe, the comb: two even lobes on a bar, five teeth of one length. */}
        <circle cx="231" cy="30" r="6.5" />
        <circle cx="245" cy="30" r="6.5" />
        <path d="M238,36 L238,42" />
        <rect x="222" y="42" width="32" height="8" rx="2" />
        {[225, 231.5, 238, 244.5, 251].map((x) => (
          <path key={x} d={`M${x},50 L${x},70`} />
        ))}

        {/* Dwennimmen, the ram's horns: one spiral, mirrored four ways, a diamond between. */}
        {dwennimmen(354, 46, 11, 8).map((d) => (
          <path key={d} d={d} />
        ))}
        <path d="M354,42 L358,46 L354,50 L350,46 Z" />

        {/* Adinkrahene: three circles, one centre. */}
        <circle cx="365" cy="126" r="6" />
        <circle cx="365" cy="126" r="13" />
        <circle cx="365" cy="126" r="20" />

        {/* Nkyinkyim: a twist with every bend alike. */}
        <path d={wave(230, 150, 236, 9, 2.5)} />
      </g>
    </svg>
  )
}

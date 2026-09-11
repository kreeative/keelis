# Kaalis — conventions for contributors (human or agent)

Kaalis is a mobile-first fintech web app (React 19 + TypeScript + Vite). Three products: Crypto, Chèque (spending + card), Épargne (high-interest savings). UI copy is **French (fr-CA)**; number/date formatting is localised via `src/lib/format.ts`.

## Commands
- `pnpm dev` — dev server · `pnpm build` — typecheck + build · `pnpm preview` — serve `dist/` on :4173
- `pnpm typecheck` · `pnpm test` (vitest) · `pnpm check:design` (static design-rule check) · `pnpm check` (all three)
- `pnpm e2e` — Playwright screenshots + runtime audit (contrast, tap targets, overflow, shadows) against the preview server

## Non-negotiable design rules (enforced by `scripts/check-design.mjs` and `e2e/screenshots.mjs`)
- **All visual values come from `src/styles/tokens.css`.** Never write a colour literal, px font-size, shadow, blur or gradient in a component. Use `var(--…)`.
- **Material.** Surfaces are glass: `.glass` (or `.glass-strong`) + an `.elev-*` class, or the `Card` component, which composes both. Glass = translucent background + `var(--glass-blur)` + a hairline `--glass-border` top highlight. There is an opaque `@supports` fallback; never assume backdrop-filter exists.
- **Elevation is layered, never a single blur.** Use `--elev-1/2/3` (ambient contact + direct drop + deep lift) and `--elev-2-hover`. A hand-rolled `box-shadow` fails the design check.
- **Tactile physics.** Interactive surfaces lift with `var(--lift)` (`translateY(-2px) scale(1.01)`) and settle with `var(--press)`; both collapse to `none` under reduced motion. Animate transform and box-shadow only.
- **Ambient ground.** `<AmbientGround />` (mounted once in `App`) paints the colour field the glass refracts. `body` is transparent on purpose — do not give it a background.
- **The palette is monochrome.** Every colour is a neutral derived from black and white — `oklch(L 0 0)`. A token with chroma > 0, or an `rgb()` whose channels differ, fails the design check. No hue anywhere, including charts, badges and status.
- **Direction and status are never carried by hue.** Gains, losses, warnings and errors all resolve to `--ink-900`; the signal is the explicit sign (`+` / `−`), the directional glyph, weight and the alert icon. Keep `signed` on amounts that can go either way.
- **`--cta` is a fill only** (ink in light, paper in dark), reserved for primary buttons; text on it is `--on-cta`. Links, ghost buttons and focus rings use `--accent`; accent text on `--accent-soft` uses `--accent-text`.
- `--ink-300` is **not** for text (fails contrast); use `--ink-400` for labels/tertiary text.
- No emoji. Gradients only in the token/base/AmbientGround layer. `backdrop-filter` only via `--glass-blur`.
- Text ≥ 12px (`--fs-label`). Tap targets ≥ 44px (`--tap`).
- Motion 150–250 ms via `--dur-*` and `--ease`; nothing bounces. Reduced motion is handled globally.
- Every screen has one dominant number (`AmountDisplay`) or one dominant title (`PageHeader` / `.t-h1`).
- **The typeface is Futura** (`--font-sans`), with the self-hosted geometric stand-in Jost (`src/styles/fonts.css`, `public/fonts/`) wherever Futura is not installed, then Century Gothic. Never add a third-party font request. Financial figures use `--font-numeric` (the same family) with `tabular-nums` so columns still align.
- Futura's figures are narrow: give short controls an explicit `min-width: var(--tap)` or they fall under 44px.
- Radii: `--r-card` 24px for cards and panels, `--r-field` 16px for inner elements, `--r-pill` for pills.

## Architecture
- `src/api/types.ts` — the `KaalisApi` contract. `src/api/mock/` implements it (latency, events, price ticks, optimistic settlement). Screens import `api` from `@/api` only.
- `src/store/` — `useQuery` (cache; data never drops to undefined during refetch), `useMutation`, `QK` query keys, `useSession` (auth + PIN lock), `useSettings` (theme / locale / hidden balances), `useToast`, `useMarket` / `useAsset` (live prices), `useOnline`.
- `src/components/` — the component library. Import from `@/components`. Do not create parallel primitives; extend these.
- `src/features/<area>/` — screens. Routes live in `src/shell/routes.tsx` (French paths).
- Layout: wrap page content in `<div className="page">` (gutter + max-width). Type utilities: `.t-display .t-h1 .t-h2 .t-body .t-small .t-label .t-muted .t-faint .num`.

## Money flows
Every buy / sell / transfer / deposit / withdrawal: amount → **Sheet de confirmation** (montant, frais/spread explicites, total) → état de succès explicite → gestion d'erreur (`ApiError.code`: `insufficient_funds`, `validation`, `offline`, `network`). Transactions appear as « En attente » immediately (API events patch the cache), then settle.

## States
Loading → `Skeleton*` (never a spinner for balances/lists). Empty → `EmptyState`. Error → `ErrorState` with Réessayer. Offline → `OfflineBanner` (mounted in the shell) + keep cached data visible.

## Accessibility
Keyboard-complete; `:focus-visible` rings; ARIA roles on tabs (`SegmentedControl`), dialogs (`Sheet`), switches; long-form `aria-label` on amounts (`Money`, `AmountDisplay`); `prefers-reduced-motion` → 0 ms.

## Demo
Demo account: `aissatou.ndiaye@exemple.ca` · code `246810` · PIN `1234`. Welcome screen has « Explorer la démo ».

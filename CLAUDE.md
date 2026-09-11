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
- **The typeface is Futura** (`--font-sans`), with the self-hosted geometric stand-in Jost (`src/styles/fonts.css`, `public/fonts/`) wherever Futura is not installed, then Century Gothic. Never add a third-party font request. Financial figures use `--font-numeric` (the same family) with `tabular-nums` so columns still align. The reference kit is set in Futura too, and its Foundations page is the authority for the scale.
- **Headings track positive, running text tracks negative.** Measured from the kit's named styles: H1 22/29/+1px, H3 16/21/+0.5, H4 14/19/+0.5, H6 11/15/+1.5 uppercase, body/large 16/26/−0.25, body/med 14/20/0. Headings are weight 700 (Futura Demi Bold).
- **Money is weight 700** (`--fw-numeric`) — bold, not black. Futura at 900 turns a balance into a slab; the size already carries the hierarchy, so the weight does not have to. It applies through `Money`, `AmountDisplay`, `.t-display`, `.figures`, `AmountEntry` and `ListRow` values; change the token, never a component.
- Futura's figures are narrow: give short controls an explicit `min-width: var(--tap)` or they fall under 44px.
- The spacing scale is the kit's: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 (`--sp-1`…`--sp-8`, plus 96 for documentation). The screen's side margin is `--gutter` — 16px on mobile, the kit's own value.
- Radii follow the kit's scale (2 / 4 / 8 / 12 / 16 / 24 / 32): `--r-card` 16px for a card, `--r-panel` 24px for a container that holds cards, `--r-field` 16px for inner elements, `--r-sheet` 32px, `--r-pill` for pills and buttons.
- **Section titles** (`SectionHeader`) carry the kit's own title spec: 14px / 18px, weight 700, uppercase, full `--ink-900`. Inline labels stay on `.t-label` (12px, weight 500, `--ink-400`) — titles assert, labels recede. Do not collapse the two.
- **`Switch` carries a checkmark when on.** In a palette with no hue, a fill-only toggle reads as "dark grey vs darker grey"; the knob's shape and the check make the state legible. Anatomy is the kit's: a 56×30 track at 16px radius, a dark knob on a pale bordered track when off, a pale knob with a check on a filled track when on, both lifted by `--elev-item`.
- **Section rhythm comes from the spacing-application tokens, not from `--sp-*` picked by hand.** The kit's second spacing board says where each step goes: `--space-elements` (8) inside a component, `--space-items` (16) between list items, `--space-block` (16 → 24) from a section's header to its content, `--space-section` (40 → 48) between sections. Only those last two grow, at the kit's own 1024px breakpoint. Reach for `--sp-*` for local spacing; never for the gap between two sections.
- **A stepped task becomes one form at 1024px** (`useLargeScreen`, the kit's « optimize for devices »): on a large screen a keyboard and a mouse beat a wizard, so group the steps and drop the step counter — but keep the mobile flow exactly as it was, since that is the one people know from the app. `Ajouter des fonds` is the worked example.
- **Warn before, not after** (`Callout`, the kit's « reinforce sense of security »): a consequence worth knowing goes in the flow beside the control, not only in the confirmation sheet. `note` is the inline line, `panel` the boxed form.
- **A field's message carries a glyph.** With no hue, a success line, a warning and an error are the same grey 14px text; `Field`/`SelectField`/`TextAreaField` take `success` and `warning` alongside `error`, and all three render with their icon. A `hint` stays bare — it is not a state. `warning` is a caution that does not block: the message appears, the field's border stays neutral. `AmountEntry`'s error line carries the same alert glyph.
- **Choosing among options is a `ChoiceList`**, not a `<select>`: the kit builds its list selector out of universal rows with a radio trailing, so each option can carry the facts that decide the choice (fee, delay, last payment). It is a real radiogroup — one tab stop, arrows move and select, disabled options are skipped — and takes a `footer` for the escape hatch. Keep `SelectField` for flat lists of plain labels.
- **`ListRow stack`** is the kit's mobile row: below 768px the value drops under the text instead of competing with it for width, while the leading mark and the trailing control span both lines. Use it when a row carries both a long label and a value.
- **`StatGrid`** is the kit's Stats block, with both of its shapes: label-left / value-right rows under 768px, a label-above-value grid beyond it.
- **Unread markers** use `StatusDot`: 8px with a 2px ring of `--surface`, and `corner` anchors it to the top-right of the *glyph's* wrapper, never the 44px control around it.
- **Icons** are a 20px box (`--icon`, the reference kit's grid size) holding a ~16px glyph, lucide outlines at 1.5px stroke. `Icon` defaults to 20; pass `size` only where a screen needs otherwise. The `ICONS` map ends with a semantic group taken from the kit — `deposit`, `withdraw`, `transfer`, `recurring`, `cheque`, `wire`, `crypto`, `invest`, `split`, `face-id`, `warning` and friends. Prefer the semantic name over a generic arrow: it says what the action means and survives a change of glyph.

## Design source
The visual reference is a duplicated copy of the Wealthsimple 2025 UI kit, in the owner's
Figma drafts:

    https://www.figma.com/design/LEKUzfrzrGOCBBbGMvGK2z/Wealthsimple-Design-System-2025-%7C-UI-Kit--Community---Copy-?node-id=26-692

Read it with the Figma MCP tools (`get_design_context`, `get_variable_defs`, `get_screenshot`)
— fileKey `LEKUzfrzrGOCBBbGMvGK2z`, nodeId `26:692`. The server is resolved at session start,
so if `/mcp` does not list Figma, start a fresh session rather than retrying.

Take structure from it — component anatomy, spacing, states, screen composition. Do NOT take
its wordmark, its cream ground, its accent hues or its typeface: Kaalis is monochrome and
set in Futura, and those two decisions outrank the kit.

## Architecture
- `src/api/types.ts` — the `KaalisApi` contract. `src/api/mock/` implements it (latency, events, price ticks, optimistic settlement). Screens import `api` from `@/api` only.
- `src/store/` — `useQuery` (cache; data never drops to undefined during refetch), `useMutation`, `QK` query keys, `useSession` (auth + PIN lock), `useSettings` (theme / locale / hidden balances), `useToast`, `useMarket` / `useAsset` (live prices), `useOnline`.
- `src/components/` — the component library. Import from `@/components`. Do not create parallel primitives; extend these.
- `src/features/<area>/` — screens. Routes live in `src/shell/routes.tsx` (French paths).
- **Mobile navigation is a floating pill**, not a bar welded to the edge: centred, glass, `--elev-2`, with the active destination in a filled capsule and icons only (each link carries its name as an `aria-label`). Anything sticky at the bottom of a screen must clear it — `calc(var(--navbar-height) + var(--navbar-gap) * 2 + var(--safe-bottom) + …)`.
- Layout: wrap page content in `<div className="page">` (gutter + max-width). Type utilities: `.t-display .t-h1 .t-h2 .t-body .t-small .t-label .t-muted .t-faint .num`.

## Money flows
Every buy / sell / transfer / deposit / withdrawal: amount → **Sheet de confirmation** (montant, frais/spread explicites, total) → état de succès explicite → gestion d'erreur (`ApiError.code`: `insufficient_funds`, `validation`, `offline`, `network`). Transactions appear as « En attente » immediately (API events patch the cache), then settle.

## States
Loading → `Skeleton*` (never a spinner for balances/lists). Empty → `EmptyState`. Error → `ErrorState` with Réessayer. Offline → `OfflineBanner` (mounted in the shell) + keep cached data visible.

## Accessibility
Keyboard-complete; `:focus-visible` rings; ARIA roles on tabs (`SegmentedControl`), dialogs (`Sheet`), switches; long-form `aria-label` on amounts (`Money`, `AmountDisplay`); `prefers-reduced-motion` → 0 ms.

## Demo
Demo account: `aissatou.ndiaye@exemple.ca` · code `246810` · PIN `1234`. Welcome screen has « Explorer la démo ».

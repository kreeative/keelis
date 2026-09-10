# Kaalis — conventions for contributors (human or agent)

Kaalis is a mobile-first fintech web app (React 19 + TypeScript + Vite). Three products: Crypto, Chèque (spending + card), Épargne (high-interest savings). UI copy is **French (fr-CA)**; number/date formatting is localised via `src/lib/format.ts`.

## Commands
- `pnpm dev` — dev server · `pnpm build` — typecheck + build · `pnpm preview` — serve `dist/` on :4173
- `pnpm typecheck` · `pnpm test` (vitest) · `pnpm check:design` (static design-rule check) · `pnpm check` (all three)
- `pnpm e2e` — Playwright screenshots + runtime audit (contrast, tap targets, overflow, shadows) against the preview server

## Non-negotiable design rules (enforced by `scripts/check-design.mjs` and `e2e/screenshots.mjs`)
- **All visual values come from `src/styles/tokens.css`.** Never write a colour literal, px font-size, shadow or gradient in a component. Use `var(--…)`.
- One accent (`--accent`) for primary actions/positive states, never as a large filled surface. Text on `--accent` uses `--on-accent`. Accent-as-text on `--accent-soft` uses `--accent-text`.
- `--ink-300` is **not** for text (fails contrast); use `--ink-400` for labels/tertiary text.
- No shadows except `--sheet-shadow` (Sheet only) and focus rings. No gradients. No emoji. No borders-as-accent on cards.
- Text ≥ 12px (`--fs-label`); nav labels use `--fs-nav` (11px) only in NavBar. Tap targets ≥ 44px (`--tap`).
- Motion 150–250 ms via `--dur-*` and `--ease`; nothing bounces. Reduced motion is handled globally.
- Every screen has one dominant number (`AmountDisplay`) or one dominant title (`PageHeader` / `.t-h1`).
- `font-variant-numeric: tabular-nums` wherever a number can change (`.num`, `Money`, `AmountDisplay`).

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

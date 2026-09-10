# Kaalis — système de design

Tout vit dans `src/styles/tokens.css`. Aucun composant ne contient de valeur codée en dur (`pnpm check:design` l'impose).

## Écarts assumés par rapport au brief

Le brief fixe à la fois des valeurs de tokens et un critère d'acceptation « contraste texte ≥ 4,5:1 ». Plusieurs valeurs fournies ne l'atteignent pas ; le critère l'emporte. Contrastes calculés (oklch → luminance relative, WCAG 2.x) :

| Token | Brief | Contraste brief | Kaalis | Contraste Kaalis |
|---|---|---|---|---|
| `--ink-400` (clair) | L 0,66 | 3,0:1 | L 0,52 | 5,4:1 sur surface, 5,0:1 sur surface-alt |
| `--ink-400` (sombre) | L 0,55 | 4,0:1 | L 0,62 | 5,3:1 / 4,9:1 |
| `--accent` (clair, en texte et blanc-sur-accent) | L 0,55 | 4,25:1 | L 0,50 | 5,2:1 (texte), 5,2:1 (`--on-accent` sur accent) |
| `--pos` (clair) | L 0,55 | 4,5:1 surface / 4,2:1 alt | L 0,52 | 5,1:1 / 4,7:1 |
| `--neg` (clair) | L 0,55 | 5,0:1 / 4,6:1 | L 0,54 | 5,2:1 / 4,8:1 |
| `--warn` (clair) | L 0,62 | 3,6:1 | L 0,54 | 5,0:1 / 4,7:1 |

Tokens ajoutés :

- `--ink-300` : la valeur d'origine de `--ink-400` (L 0,66 clair / 0,50 sombre), réservée aux usages **non textuels** (placeholders décoratifs, glyphes désactivés, rail d'interrupteur).
- `--accent-text` : accent assombri pour du texte posé sur `--accent-soft` (les badges). Accent sur accent-soft ne fait que 3,7:1 en clair.
- `--on-accent` : texte sur fond accent (presque blanc en clair, surface sombre en sombre — le blanc sur l'accent sombre ne ferait que 2,3:1).
- `--card-surface` / `--card-ink` / `--card-ink-muted` : la carte virtuelle reste sombre dans les deux modes.
- `--focus-ring`, `--focus-ring-offset`, `--focus-ring-neg`, `--sheet-shadow`, `--backdrop`.

Autre écart : le brief demande des libellés de barre de navigation à 11px et, ailleurs, « jamais de texte sous 12px ». Les libellés sont à 12px (`--fs-nav`).

## Typographie

`Söhne`, sinon `"Helvetica Neue", Helvetica, Arial`. Une seule famille.

| Style | Mobile / Desktop | Tracking | Graisse | Classe |
|---|---|---|---|---|
| display | 48 / 64 | −0,03em | 500 | `.t-display` (tabular-nums) |
| h1 | 30 / 38 | −0,02em | 500 | `.t-h1` |
| h2 | 22 / 26 | −0,015em | 500 | `.t-h2` |
| body | 16 | −0,005em | 400 | `.t-body` (line-height 1,5) |
| small | 14 | 0 | 400 | `.t-small` |
| label | 12 | 0,04em | 500, capitales, `--ink-400` | `.t-label` |

## Espacement, rayons, élévation

Échelle `--sp-1 … --sp-9` = 4, 8, 12, 16, 24, 32, 48, 64, 96. Gouttière 20px mobile / 32px ≥ 768px, `max-width: 1120px`. Rayons 10 (champs, boutons), 16 (cartes), 20 (feuilles), 999 (pills). Une seule ombre, `--sheet-shadow`, réservée au `Sheet`.

## Mouvement

`--ease: cubic-bezier(.2,.8,.2,1)`, `--dur-fast 150ms`, `--dur 200ms`, `--dur-slow 250ms`. `prefers-reduced-motion` met tout à 0 ms (tokens **et** règle globale).

## Composants (tous les états visibles sur `/composants`)

| Composant | États |
|---|---|
| `Button` | primary / secondary / ghost / destructive · md 44 / lg 52 · hover, active, focus-visible, disabled, loading (largeur figée), icône, icône seule, block |
| `AmountDisplay` | display / h1 · delta pos / neg / plat · période · skeleton · masqué · unité crypto |
| `Keypad` | chiffres, virgule, effacer · entier seulement · désactivé · vibration légère |
| `ListRow` / `List` | avatar, titre, sous-titre, valeur + sous-valeur, chevron, trailing, lien, bouton, statique, atténué · séparateurs 1px entre les lignes |
| `SegmentedControl` | 2–4 segments, pill accent-soft glissante, clavier (flèches, Home/End), rôles tablist/tab |
| `Sheet` | poignée 36×4, coins 20, backdrop `--ink-900/0.35`, focus piégé, Échap, verrouillé pendant l'envoi ; dialogue centré ≥ 768px |
| `Chart` / `Sparkline` | ligne 1,5px, sans grille ni axes ni remplissage, point + infobulle, couleur selon le delta, skeleton |
| `Field` / `SelectField` / `TextAreaField` | label 12px au-dessus, anneau 2px accent, erreur `--neg` 14px liée par aria-describedby, adornments, désactivé |
| `Badge` | accent / neutral / pos / neg / warn, icône |
| `EmptyState` | phrase + bouton, placeholder SVG à rayures + légende monospace |
| `ErrorState` / `OfflineBanner` | réseau vs hors ligne, bouton Réessayer |
| `Toast` | bas, 1 ligne, 3 s, `--ink-900` sur `--surface` |
| `Skeleton` | text / circle / card / pill, `SkeletonRow`, `SkeletonAmount`, pulse 1,4 s |
| `NavBar` | barre basse 5 onglets (icônes trait 1,5px, actif `--ink-900`) / rail 240px |
| `Switch`, `ProgressBar` (1 ligne fine), `QRCode`, `Avatar` (monogrammes, pas de logos), `Card`, `QuickActions`, `PageHeader`, `Wordmark`, `Icon` (lucide, trait 1,5px, liste explicite) |

Parcours d'argent (`features/shared`) : `AmountEntry` (chiffre héros + pavé) → `ConfirmSheet` (montant, frais, spread, total, délai, erreur inline) → `SuccessScreen` (ce qui a été acquis, statut En attente → Réglé).

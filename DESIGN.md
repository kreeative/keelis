# Kaalis — système de design

Tout vit dans `src/styles/tokens.css`. Aucun composant ne contient de valeur codée en dur (`pnpm check:design` l'impose).

## Matière : verre et profondeur

Les surfaces sont du verre translucide posé sur un fond de couleur, avec une pile d'ombres à trois couches qui donne l'élévation.

| Élément | Token | Valeur |
|---|---|---|
| Fond de verre | `--glass-bg` | `rgba(255,255,255,0.72)` clair · `rgba(24,24,28,0.72)` sombre |
| Fond dense | `--glass-bg-strong` | `rgba(255,255,255,0.85)` · `rgba(24,24,28,0.85)` |
| Fond léger | `--glass-bg-soft` | `rgba(255,255,255,0.65)` · `rgba(18,18,20,0.65)` |
| Flou | `--glass-blur` | `blur(16px) saturate(180%)` |
| Liseré de lumière | `--glass-border` | `rgba(255,255,255,0.8)` · `rgba(255,255,255,0.12)`, sur le bord supérieur seulement |
| Repli opaque | `--glass-fallback` | utilisé quand `backdrop-filter` n'existe pas (`@supports`) |

Élévation en trois couches, jamais une ombre unique :

```
--elev-2:
  0 2px 4px rgba(0,0,0,0.02)        /* contact ambiant */
  0 10px 20px -4px rgba(0,0,0,0.08) /* chute directe */
  0 24px 48px -12px rgba(0,0,0,0.12)/* portance 3D */
```

`--elev-1` est plus discret, `--elev-3` sert aux feuilles modales, `--elev-2-hover` accompagne le survol. En mode sombre les mêmes couches montent à 0,28 / 0,40 / 0,52 d'opacité, sans quoi elles disparaîtraient sur un fond noir.

**Physique tactile.** Au survol et à l'appui : `--lift` = `translateY(-2px) scale(1.01)`, `--press` = `translateY(0) scale(0.995)`. Seuls `transform` et `box-shadow` sont animés, les deux se composent sur le GPU. Sous `prefers-reduced-motion`, les deux valent `none`.

**Fond ambiant.** `<AmbientGround />`, monté une fois dans `App`, peint trois champs radiaux (`--ambient-1/2/3`) derrière toute l'application. Sans lui le flou n'a rien à réfracter et le verre ressemble à du blanc. C'est une couche fixe unique plutôt qu'un `background-attachment: fixed`, qui repeint le dégradé à chaque image de défilement sur mobile. `body` est volontairement transparent.

## Couleur

L'accent haute intensité `--cta` (citrine `oklch(0.90 0.17 105)`) est réservé aux appels à l'action et aux indicateurs positifs. Il sert uniquement de **fond** : en texte sur une surface claire il ne fait que 1,3:1. Le texte posé dessus est `--on-cta` (encre presque noire), soit 14,1:1. Les liens, boutons fantômes et anneaux de focus gardent le teal `--accent`.

Contrastes vérifiés (oklch → luminance relative, WCAG 2.x) :

| Paire | Clair | Sombre |
|---|---|---|
| `--ink-900` sur `--surface` | 18,3:1 | 17,8:1 |
| `--ink-600` sur `--surface` | 6,9:1 | 7,8:1 |
| `--ink-400` sur `--surface-alt` | 5,0:1 | 4,9:1 |
| `--on-cta` sur `--cta` | 14,1:1 | 14,1:1 |
| `--accent` en texte sur `--surface` | 5,2:1 | 8,3:1 |
| `--pos` / `--neg` sur `--surface-alt` | 4,7:1 / 4,8:1 | 7,4:1 / 5,9:1 |

`--ink-300` n'est jamais du texte : placeholders, glyphes désactivés, traits décoratifs.

L'audit navigateur recalcule ces contrastes sur le rendu réel, en aplatissant les surfaces translucides sur le fond effectivement composé.

## Typographie

| Rôle | Police |
|---|---|
| Courant, titres | `--font-sans` : pile système menée par SF Pro |
| Montants financiers | `--font-numeric` : monospace système, `tabular-nums`, `--ls-numeric: -0.04em` |

`Money`, `AmountDisplay`, `.figures`, `.t-display`, les valeurs de `ListRow` et le pavé numérique portent déjà la monospace.

| Style | Mobile / Bureau | Tracking | Graisse | Classe |
|---|---|---|---|---|
| display | 48 / 64 | −0,04em | 500 | `.t-display` |
| h1 | 30 / 38 | −0,02em | 500 | `.t-h1` |
| h2 | 22 / 26 | −0,015em | 500 | `.t-h2` |
| body | 16 | −0,005em | 400 | `.t-body` |
| small | 14 | 0 | 400 | `.t-small` |
| label | 12 | 0,04em | 500, capitales | `.t-label` |

## Espacement, rayons, couches

Échelle `--sp-1 … --sp-9` = 4, 8, 12, 16, 24, 32, 48, 64, 96. Gouttière 20px mobile / 32px ≥ 768px, `max-width: 1120px`. Rayons : 24px cartes et panneaux (`--r-card`), 16px éléments internes (`--r-field`), 28px feuilles, `--r-pill` pour les pastilles.

Ordre des couches, une seule échelle : `--z-nav` 50, `--z-sticky` 60, `--z-toast` 100, `--z-sheet` 200, `--z-lock` 300, `--z-skip` 400. Une feuille couvre donc toujours une notification éphémère.

## Mouvement

`--ease: cubic-bezier(.2,.8,.2,1)`, `--dur-fast 150ms`, `--dur 200ms`, `--dur-slow 250ms`. `prefers-reduced-motion` met tout à 0 ms et annule `--lift` / `--press`.

## Composants (tous les états sur `/composants`)

| Composant | États |
|---|---|
| `Card` | matière `glass` / `glass-strong` / `solid` · élévation `flat`/1/2/3 · `div`, lien ou bouton · portance au survol, enfoncement à l'appui, anneau de focus cumulé à l'ombre |
| `Button` | primary (fond `--cta`, portance, élévation) / secondary (verre) / ghost / destructive · md 44 / lg 52 · hover, active, focus-visible, disabled, loading à largeur figée |
| `AmountDisplay` | display / h1 · monospace · `signed`, `tone`, `unit` (quantité crypto) · delta pos / neg / plat · squelette · masqué |
| `Keypad` | chiffres, virgule, effacer · entier seulement · normalise un décimal à point injecté de l'extérieur |
| `ListRow` / `List` | avatar, titre, sous-titre, valeur monospace + sous-valeur, chevron, trailing, `wrap`, lien, bouton, statique, atténué |
| `SegmentedControl` | 2–4 segments (44px chacun), pastille `accent-soft` glissante, clavier, rôles tablist/tab |
| `Sheet` | verre dense, `--elev-3`, poignée 36×4, backdrop flouté, focus piégé, Échap, verrouillé pendant l'envoi ; dialogue centré ≥ 768px |
| `Chart` / `Sparkline` | ligne 1,5px sans grille ni axes, point + infobulle, couleur selon le delta, squelette |
| `Field` / `SelectField` / `TextAreaField` | label 12px, un seul anneau de focus, erreur `--neg` liée par `aria-describedby`, chevron sur les listes déroulantes, adornments |
| `Badge`, `EmptyState`, `ErrorState`, `OfflineBanner`, `Toast`, `Skeleton`, `Switch`, `ProgressBar`, `QRCode`, `Avatar`, `QuickActions`, `PageHeader`, `Wordmark`, `AmbientGround`, `Icon` | voir la galerie |

Parcours d'argent (`features/shared`) : `AmountEntry` (chiffre héros monospace + pavé) → `ConfirmSheet` (montant, frais, écart, total, délai) → `SuccessScreen` (ce qui a été acquis, En attente → Réglé).

## Historique

La première itération suivait un brief « fintech nordique minimaliste » : zéro ombre hors feuilles modales, zéro dégradé, zéro glassmorphism. Le brief a été remplacé par le système verre et profondeur décrit ci-dessus ; `scripts/check-design.mjs` et l'audit navigateur ont été mis à jour en conséquence. Ce qui n'a pas changé : tout passe par les tokens, contraste ≥ 4,5:1, cibles ≥ 44px, texte ≥ 12px, mode sombre complet.

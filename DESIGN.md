# Keewal Meere — système de design

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

**Fond ambiant.** `<AmbientGround />`, monté une fois dans `App`, peint quatre champs radiaux (`--ambient-1/2/3/4`) derrière toute l'application. Sans lui le flou n'a rien à réfracter et le verre ressemble à une surface pleine. C'est une couche fixe unique plutôt qu'un `background-attachment: fixed`, qui repeint le dégradé à chaque image de défilement sur mobile. `body` est volontairement transparent.

## Couleur : une seule famille chaude

La palette était monochrome — chaque valeur un neutre écrit `oklch(L 0 0)`. Le propriétaire a
remplacé cette décision par la référence brun-et-or. En l'échantillonnant, **chaque surface,
chaque encre et l'accent lui-même tiennent entre les teintes 62 et 97** : une seule famille
éclairée différemment, pas une collection de couleurs.

`pnpm check:design` fait respecter la bande (55–105) et un **budget de chroma par rôle** — la
rampe d'accent (`--cta`, `--accent*`, `--aurora-*`) monte à 0,14, tout le reste reste sous
0,05. La référence est catégorique là-dessus : les surfaces sont presque neutres et seul
l'accent est saturé. Une surface qui rejoint la chroma de l'accent, c'est une palette
retenue qui devient une palette brune. **La chroma 0 échoue aussi** désormais, hors ombres
et voiles : un gris pur au milieu de neutres chauds se lit comme une plaque morte.

**L'or est la signature, et c'est un aplat.** `--cta` est l'or beurre dans les **deux**
thèmes — `#f0de9a` sur sombre, un `#ddba56` plus profond sur clair pour tenir sur la crème —
avec `--on-cta` en brun profond. Trois emplacements, les trois que l'œil doit trouver en
premier : le bouton principal, la destination active de la barre, un filtre sélectionné. Le
`.canvas` de l'accueil ne le redéfinit **pas** : il le forçait en papier, ce qui était juste
quand le bouton principal ne pouvait être que l'inverse de son fond, et ce qui ferait
aujourd'hui de l'écran d'accueil le seul endroit où l'application ne montre pas sa couleur.

**Les liens et les anneaux de focus ne sont pas l'or.** `--accent` est un bronze en clair,
l'or en sombre : un or pâle en *texte* sur une page crème échoue au contraste, si bel aplat
soit-il. `--cta` pour les remplissages, `--accent` pour tout ce qui se lit.

**La direction reste en dehors de la famille, et c'est la seule chose qui en sort.** `--pos`
est vert, `--neg` rouge : la hausse et la baisse sont le seul sens que les gens lisent par la
couleur avant de lire quoi que ce soit, et ni l'un ni l'autre ne peut être chaud sans cesser
de vouloir dire ce qu'il veut dire. La couleur n'est jamais le *seul* porteur — le signe
explicite (`+` / `−`), la flèche et la graisse le disent aussi, donc chaque état survit à une
capture en niveaux de gris.

Contrastes vérifiés (oklch → luminance relative, WCAG 2.x) :

| Paire | Clair | Sombre |
|---|---|---|
| `--ink-900` sur `--surface` | 16,6:1 | 15,9:1 |
| `--ink-600` sur `--surface` | 6,9:1 | 8,0:1 |
| `--ink-400` sur `--surface-alt` | 5,3:1 | 5,2:1 |
| `--ink-400` sur `--accent-soft` | 4,9:1 | 4,9:1 |
| `--on-cta` sur `--cta` | 9,3:1 | 13,5:1 |
| `--accent` sur `--surface` | 7,2:1 | 13,1:1 |
| `--accent-text` sur `--accent-soft` | 8,3:1 | 9,9:1 |
| `--pos` sur `--surface-alt` | 5,0:1 | 8,5:1 |
| `--neg` sur `--surface-alt` | 5,3:1 | 5,6:1 |

`--ink-300` n'est jamais du texte courant : placeholders, glyphes désactivés, traits
décoratifs. Il tient tout de même 3,4:1, parce qu'un montant vide l'affiche à 48 px et que
le grand texte demande 3:1.

L'audit navigateur recalcule ces contrastes sur le rendu réel, en aplatissant les surfaces translucides sur le fond effectivement composé.

## Typographie : Poppins

Une seule famille, pour tout, y compris les montants.

```
--font-sans: "Poppins", "Jost", "Century Gothic", "Avenir Next", "Avenir", system-ui, sans-serif
```

**Poppins**, hébergée par nous sous licence SIL OFL (`src/styles/fonts.css`, `public/fonts/poppins-*.woff2`). Aucune requête vers un tiers, donc rien à attendre au premier rendu et la démo en fichier unique fonctionne hors ligne, les polices étant intégrées en base64. Poppins se distribue en graisses statiques : seules les quatre que le jeu de jetons nomme sont déclarées — 400, 500, 600, 700 — chacune en latin et latin-ext. Ajouter une graisse veut dire ajouter ses deux fichiers.

Les montants restent dans la même famille avec `font-variant-numeric: tabular-nums`, ce qui garde les colonnes alignées. `--ls-numeric: -0.01em`.

Un contrôle au libellé court a besoin d'un `min-width: var(--tap)` explicite, sinon il passe sous 44 px.

| Style | Mobile / Bureau | Tracking | Graisse | Classe |
|---|---|---|---|---|
| display | 48 / 64 | −0,01em | 500 | `.t-display` |
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

1. Brief « fintech nordique minimaliste » : zéro ombre hors feuilles modales, zéro dégradé, zéro glassmorphism, accent teal.
2. Remplacé par le système verre et profondeur : glassmorphism, ombres en trois couches, fond ambiant, accent citrine, chiffres en monospace.
3. Puis **monochrome intégral** et **Poppins** (Futura d'abord, puis Poppins sur demande). La matière de verre et la pile d'élévation restent ; la teinte et la monospace disparaissent.
4. Remplacé par l'état actuel : **brun et or**, sur la référence du propriétaire. Le monochrome n'était pas une contrainte technique mais une décision, et elle a été reprise. Ce qui n'a pas changé, c'est qu'il y ait une règle : la garde statique est passée de « chroma 0 » à « une bande de teintes, et un budget de chroma par rôle », parce qu'une palette que rien ne surveille dérive d'une couleur plausible à la fois jusqu'à devenir un nuancier.

`scripts/check-design.mjs` et l'audit navigateur ont suivi chaque fois. Ce qui n'a jamais changé : tout passe par les tokens, contraste ≥ 4,5:1, cibles ≥ 44 px, texte ≥ 12 px, mode sombre complet, aucune information portée par la seule couleur.

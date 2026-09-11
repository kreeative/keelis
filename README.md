# Kaalis

Application fintech mobile-first (web app responsive) qui réunit trois produits :

| Produit | Ce que c'est |
|---|---|
| **Kaalis Chèque** | compte de dépense avec carte virtuelle, virements, e-Transfer |
| **Kaalis Épargne** | compte à intérêt élevé (APY 4,00 %) avec objectifs |
| **Kaalis Crypto** | achat, vente, détention, envoi et réception de 8 actifs, spread affiché avant chaque ordre |

Style : monochrome intégral et Poppins, sur une matière de verre translucide posée sur un champ de dégradés neutres. Le chiffre est le héros — les montants sont en graisse 700, à l'échelle d'affichage. Tout le système visuel est défini par `src/styles/tokens.css`, et `DESIGN.md` en détaille les mesures.

## Déployer

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkreeative%2Fkeelis)

Le dépôt est prêt pour Vercel : `vercel.json` fixe le cadriciel, la commande de compilation, le dossier de sortie et les réécritures nécessaires à une application à page unique. Aucune variable d'environnement n'est requise, les données sont simulées.

Import manuel : sur Vercel, **Add New → Project → Import Git Repository**, choisis `kreeative/keelis`, puis **Deploy**. Vercel détecte Vite tout seul. La branche `main` devient la production ; chaque autre branche reçoit une adresse de prévisualisation.

## Démarrer

```bash
pnpm install
pnpm dev            # http://localhost:5173
```

Compte de démonstration : `aissatou.ndiaye@exemple.ca` · code `246810` · NIP `1234` (ou « Explorer la démo » sur l'écran d'accueil).

## Vérifier

```bash
pnpm typecheck      # TypeScript strict
pnpm test           # vitest (formatage fr-CA, pavé numérique, API mock)
pnpm check:design   # règles statiques : aucune couleur/ombre/dégradé/emoji/texte < 12px hors tokens
pnpm build && pnpm preview &
pnpm e2e            # Playwright : captures 320/390/768/1440 × clair/sombre + audit contraste, cibles 44px, débordement
```

## Architecture

```
src/
  styles/tokens.css     source unique de vérité (couleurs clair/sombre, typo, espacement, rayons, motion)
  styles/base.css       reset + utilitaires de type (.t-display … .t-label), .page, .num, .sr-only
  lib/format.ts         fr-CA / en-CA : virgule décimale, espace fine, dates, libellés ARIA longs
  api/types.ts          contrat KaalisApi (typé, isolé) — remplacez le mock par un vrai client
  api/mock/             implémentation en mémoire : latence, événements, ticks de prix 10 s, règlement optimiste
  store/                useQuery (cache conservé pendant le refetch), session + verrou NIP, réglages, toasts, marché
  components/           bibliothèque (Button, AmountDisplay, Keypad, ListRow, SegmentedControl, Sheet, Chart, …)
  features/shared/      AmountEntry → ConfirmSheet → SuccessScreen (tous les parcours d'argent), TransactionRow, hooks
  features/<zone>/      écrans : home, crypto, checking, savings, funds, onboarding, profile, notifications
  shell/                routeur (chemins français), barre basse / rail latéral, gardes, écran de verrouillage
```

`/composants` : galerie de tous les composants dans tous leurs états (revue de design en isolation).

## Comportements produit

- Prix crypto quasi temps réel (tick 10 s) ; les valeurs en cache restent affichées pendant le refetch — un solde ne saute jamais à zéro.
- Tout achat/vente/virement/dépôt/retrait passe par une feuille de confirmation (montant, frais, spread explicite, total, délai) puis un écran de succès explicite ; les erreurs (`insufficient_funds`, `validation`, `offline`, `network`) sont gérées en ligne.
- Validation optimiste : la transaction apparaît « En attente » immédiatement puis se règle.
- Sécurité : 2FA, verrou NIP au retour d'arrière-plan et après inactivité, masquage des soldes, délai de session réglable.
- Accessibilité : clavier complet, `focus-visible`, rôles ARIA (onglets, dialogues, interrupteurs), montants lus en toutes lettres, `prefers-reduced-motion` → 0 ms.

Voir `DESIGN.md` pour les tokens, les états des composants et les écarts assumés par rapport au brief.

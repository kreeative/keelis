# Keewal Meere

Application fintech mobile-first pour l'**Afrique**, en français (fr-SN), avec l'anglais
nigérian (en-NG) en seconde langue.

| Produit | Ce que c'est |
|---|---|
| **Actifs** | actions africaines (BRVM, NGX, JSE) et crypto dans le même compte, écart affiché avant chaque ordre |
| **Chèque** | compte de dépense avec carte virtuelle, virements, Mobile Money |
| **Épargne** | compte rémunéré avec objectifs nommés |
| **Change** | seize devises, du franc CFA au rand, taux du marché et marge côte à côte |

Style : monochrome intégral et Poppins, sur une matière de verre translucide posée sur un
champ de dégradés neutres. Le chiffre est le héros — les montants sont en graisse 500 et à
l'échelle d'affichage, serrés plutôt que gras. Tout le système visuel est défini par
`src/styles/tokens.css`, et `DESIGN.md` en détaille les mesures.

## Déployer

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkreeative%2Fkeelis)

Le dépôt est prêt pour Vercel : `vercel.json` fixe le cadriciel, la commande de compilation,
le dossier de sortie et les réécritures nécessaires à une application à page unique. Aucune
variable d'environnement n'est requise : sans back-end, l'application tourne sur ses données
de démonstration et le dit.

Import manuel : sur Vercel, **Add New → Project → Import Git Repository**, choisis `kreeative/keewal`, puis **Deploy**. Vercel détecte Vite tout seul. La branche `main` devient la production ; chaque autre branche reçoit une adresse de prévisualisation.

## Brancher un back-end

L'interface ne parle qu'au contrat `KeewalApi`. Une seule variable décide à qui :

```bash
VITE_API_URL=https://api.votredomaine.com/v1
```

- **Non définie** → l'application tourne sur `src/api/mock/`, et chaque surface qui montre
  un chiffre indique d'où il vient.
- **Définie** → l'application parle à ce back-end, et la compilation **retire** entièrement
  les données simulées du paquet livré : des soldes inventés n'ont rien à faire dans le même
  fichier que des soldes réels.

Aucun écran ne change, parce qu'aucun écran ne sait à qui il parle.
[`docs/API.md`](docs/API.md) est la spécification complète : 62 points d'entrée, la forme des
erreurs, le flux d'évènements, et ce que le back-end doit garantir.

> **Si le back-end est sur un autre domaine**, ajoutez-le à `connect-src` dans la
> Content-Security-Policy de `vercel.json`. La politique est volontairement stricte
> (`connect-src 'self'`), et sans cet ajout le navigateur bloque chaque appel : l'application
> se comporte alors exactement comme si le réseau était coupé. `pnpm e2e:csp` sert
> l'application sous la politique réellement déployée et échoue à la moindre violation.

> **Une variable `VITE_` est publique.** Vite l'inscrit dans le JavaScript livré à chaque
> visiteur. Les clés de données de marché, de KYC, de Wave, d'Orange Money, de Flutterwave,
> du dépositaire — **toutes** vivent sur le serveur. « Brancher les clés » veut dire : les
> donner au back-end, et pointer `VITE_API_URL` vers lui. Voir `.env.example`.

## Démarrer

```bash
pnpm install
pnpm dev            # http://localhost:5173
```

Compte de démonstration : `aissatou.ndiaye@exemple.sn` · code `246810` · NIP `1234` (ou « Explorer la démo » sur l'écran d'accueil).

## Vérifier

```bash
pnpm typecheck      # TypeScript strict
pnpm test           # vitest (devises, change, IBAN, pavé numérique, API mock, client REST)
pnpm check:design   # règles statiques : aucune couleur/ombre/dégradé/emoji/texte < 12px hors tokens
pnpm build && pnpm preview &
pnpm e2e            # Playwright : captures 320/390/768/1440 × clair/sombre + audit contraste, cibles 44px, débordement
pnpm e2e:flows      # Playwright : parcours d'argent réels — acheter, envoyer par opérateur, convertir, déposer, hors ligne, verrou
pnpm e2e:csp        # Playwright : l'application sous la Content-Security-Policy déployée
```

## Architecture

```
src/
  styles/tokens.css     source unique de vérité (couleurs clair/sombre, typo, espacement, rayons, motion)
  styles/base.css       reset + utilitaires de type (.t-display … .t-label), .page, .num, .sr-only
  lib/currency.ts       les seize devises : unités mineures, arrimage à l'euro, arrondis
  lib/fx.ts             conversion et marge, par paliers, la parité CFA en constante
  lib/format.ts         fr-SN / en-NG : groupes par virgule, point décimal, dates, libellés ARIA longs
  api/types.ts          contrat KeewalApi — la seule chose que connaissent les écrans
  api/mock/             implémentation en mémoire : latence, événements, ticks de prix, règlement optimiste
  api/rest/             implémentation HTTP (docs/API.md), retenue dès que VITE_API_URL est définie
  config/env.ts         les variables publiques, et ce qui n'a pas le droit d'en être une
  store/                useQuery (cache conservé pendant le refetch), session + verrou NIP, réglages, toasts, marché
  components/           bibliothèque (Button, AmountDisplay, Keypad, ListRow, SegmentedControl, Sheet, Chart, …)
  features/shared/      AmountEntry → ConfirmSheet → SuccessScreen (tous les parcours d'argent), TransactionRow, hooks
  features/<zone>/      écrans : home, crypto, checking, savings, funds, onboarding, profile, notifications
  shell/                routeur (chemins français), barre basse / rail latéral, gardes, écran de verrouillage
```

`/composants` : galerie de tous les composants dans tous leurs états (revue de design en isolation).

## Comportements produit

- Prix quasi temps réel ; les valeurs en cache restent affichées pendant le refetch — un solde ne saute jamais à zéro.
- Tout achat/vente/virement/dépôt/retrait passe par une feuille de confirmation (montant, frais, spread explicite, total, délai) puis un écran de succès explicite ; les erreurs (`insufficient_funds`, `validation`, `offline`, `network`) sont gérées en ligne.
- Validation optimiste : la transaction apparaît « En attente » immédiatement puis se règle.
- Sécurité : 2FA, verrou NIP au retour d'arrière-plan et après inactivité, masquage des soldes, délai de session réglable.
- Accessibilité : clavier complet, `focus-visible`, rôles ARIA (onglets, dialogues, interrupteurs), montants lus en toutes lettres, `prefers-reduced-motion` → 0 ms.

Voir `DESIGN.md` pour les tokens, les états des composants et les écarts assumés par rapport au brief.

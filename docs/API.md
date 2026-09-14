# Le contrat back-end de Keewal Meere

Ce document est la spécification que doit satisfaire un back-end pour que l'application
cesse d'être une démonstration. Il n'y a rien d'autre à faire côté interface : aucun écran
ne sait à qui il parle.

```
VITE_API_URL=https://api.votredomaine.com/v1
```

Tant que cette variable n'est pas définie, l'application tourne sur `src/api/mock/` et le
dit sur chaque surface qui affiche un chiffre.

## Avant tout : où vont les clés

**Une variable `VITE_` est publique.** Vite l'inscrit dans le JavaScript livré à chaque
visiteur ; n'importe qui la lit avec « afficher la source ». Une seule chose a donc sa
place ici : l'URL du back-end.

Les clés de données de marché, de KYC, de Wave, d'Orange Money, de MTN, de Flutterwave, du
dépositaire — **toutes** vivent sur le serveur, jamais dans cette application. « Brancher
les clés » veut dire : les donner au back-end, et pointer `VITE_API_URL` vers lui.

## Forme générale

- **Transport** : JSON sur HTTPS. `Accept: application/json`, et `Content-Type:
  application/json` sur les requêtes qui portent un corps.
- **Authentification** : `Authorization: Bearer <token>`. Le jeton est celui rendu par
  `POST /auth/verify` ou `POST /auth/onboarding/complete`. Un `401` fait oublier le jeton
  au client et ramène l'utilisateur à l'écran de connexion.
- **Montants** : des nombres dans l'unité principale de la devise (1 500 F CFA s'écrit
  `1500`), jamais des centimes. Chaque objet qui porte un montant porte aussi sa devise.
- **Dates** : ISO 8601 en UTC.
- **Succès sans contenu** : `204`.
- **Délai** : le client abandonne à 15 s et présente l'échec comme un problème de réseau.

### Les erreurs

```json
{ "error": { "code": "insufficient_funds", "message": "Solde insuffisant", "details": { "iban": "Longueur incorrecte" } } }
```

`message` est affiché tel quel : il doit être en français, court, et dire quoi faire.
`details` associe un nom de champ à sa propre phrase, et remonte sous le champ concerné.

`code` décide de ce que l'écran fait, et prime sur le statut HTTP :

| `code` | Ce que l'application fait |
| --- | --- |
| `insufficient_funds` | Message sur le montant, la saisie est conservée |
| `validation` | Message sous le champ fautif, rien n'est envoyé |
| `unauthorized` | Jeton oublié, retour à la connexion |
| `not_found` | État « introuvable » |
| `rate_limited` | Invite à patienter |
| `frozen` | Le mouvement est refusé parce que la carte est gelée |
| `network` | Bouton « Réessayer » |

Sans `code`, le statut décide : `401`/`403` → `unauthorized`, `404` → `not_found`,
`409`/`422` → `validation`, `429` → `rate_limited`, `5xx` → `network`.

### Une règle de routage, et elle n'est pas cosmétique

**Aucun segment littéral ne partage sa position avec un paramètre.** `/orders/quote` à côté
d'un futur `/orders/:id` est l'ambiguïté classique : cela fonctionne jusqu'au jour où la
deuxième route existe, et dépend alors de l'ordre de déclaration dans un cadriciel que le
front ne voit pas. D'où `POST /quotes` et non `/orders/quote`, `/networth/history` et non
`/accounts/history`, `/crypto/withdrawals` et non `/assets/send`, `/transfer-providers` et
non `/transfers/providers`. Chaque chemin ci-dessous est non ambigu quel que soit l'ordre
d'enregistrement.

## Le flux d'événements

```
GET /events        (text/event-stream)
```

Chaque trame est un `ApiEvent` en JSON :

```
data: {"type":"transaction","transaction":{…}}
data: {"type":"accounts"}
data: {"type":"card","card":{…}}
data: {"type":"notification","notification":{…}}
data: {"type":"goals"}
data: {"type":"recurring"}
```

C'est ce qui fait passer une transaction de « En attente » à réglée sans que l'utilisateur
rafraîchisse. Si le flux est absent, le client se rabat sur une relance toutes les 20 s —
un règlement en retard est un agacement, un règlement qui n'arrive jamais est un rapport de
bogue.

## Les points d'entrée

Les types de chaque corps et de chaque réponse sont dans `src/api/types.ts`, qui fait foi :
le nom entre parenthèses est celui de l'interface TypeScript.

### Session et intégration

| Méthode | Chemin | Réponse |
| --- | --- | --- |
| GET | `/auth/session` | `Session \| null` |
| POST | `/auth/code` | `{ sent: true, devHint?: string }` — envoie le code à `{ email }` |
| POST | `/auth/verify` | `{ ok: true, session?: Session }` pour `{ email, code }` |
| GET | `/auth/onboarding` | `OnboardingState` |
| PATCH | `/auth/onboarding` | `OnboardingState` |
| POST | `/auth/onboarding/document` | `{ ok: true }` — **métadonnées seulement** : les octets vont au fournisseur KYC depuis une URL signée que le back-end délivre, un passeport ne traverse pas cette application |
| POST | `/auth/onboarding/complete` | `Session` |
| POST | `/auth/pin` | `{ ok: true }` pour `{ pin }` |
| POST | `/auth/pin/verify` | `{ ok: boolean }` |
| POST | `/auth/signout` | `204` |

### Comptes et valeur nette

| Méthode | Chemin | Réponse |
| --- | --- | --- |
| GET | `/accounts` | `Account[]` |
| GET | `/accounts/:id` | `Account` |
| GET | `/accounts/:id/details` | `AccountDetails` |
| GET | `/networth/history?range=1D\|1W\|1M\|1Y\|MAX` | `PriceHistory` — tous comptes confondus |

### Transactions

| Méthode | Chemin | Réponse |
| --- | --- | --- |
| GET | `/transactions` | `Transaction[]` |
| GET | `/transactions/:id` | `Transaction` |
| POST | `/transactions/:id/report` | `{ caseId }` pour `{ reason }` |
| POST | `/transactions/:id/receipt` | `{ sentTo }` |

Filtres en chaîne de requête, tous facultatifs : `accountId`, `types`, `categories`,
`status` (listes séparées par des virgules), `minAmount`, `maxAmount`, `from`, `to`, `q`,
`limit`. Une clé non fournie est absente, jamais vide.

### Carte

| Méthode | Chemin | Réponse |
| --- | --- | --- |
| GET | `/card` | `Card` |
| PATCH | `/card` | `Card` pour `{ frozen }` |
| POST | `/card/reveal` | `CardSecrets` — point d'entrée distinct pour que le PAN ne soit récupéré que lorsqu'on le demande, et journalisé quand il l'est |

### Actifs, portefeuille et ordres

| Méthode | Chemin | Réponse |
| --- | --- | --- |
| GET | `/assets` | `CryptoAsset[]` — actions africaines **et** crypto |
| GET | `/assets/:id` | `CryptoAsset` |
| PATCH | `/assets/:id/watch` | `CryptoAsset` pour `{ watched }` |
| GET | `/assets/:id/history?range=…` | `PriceHistory` |
| GET | `/assets/:id/address?network=…` | `ReceiveAddress` |
| GET | `/portfolio/holdings` | `Holding[]` |
| GET | `/portfolio/history?range=…` | `PriceHistory` — **calculée**, pas simulée : la série réelle de chaque ligne multipliée par la quantité détenue, sommée point par point. Une courbe qui contredirait les lignes en dessous serait pire que pas de courbe |
| POST | `/quotes` | `Quote` pour `QuoteRequest` |
| POST | `/orders` | `Order` pour `{ quoteId }` |
| GET | `/recurring` | `RecurringBuy[]` |
| POST | `/recurring` | `RecurringBuy` |
| PATCH | `/recurring/:id` | `RecurringBuy` |
| DELETE | `/recurring/:id` | `204` |
| POST | `/crypto/withdrawals/preview` | `CryptoSendPreview` |
| POST | `/crypto/withdrawals` | `MoneyMovementResult` |

Un actif indivisible se cote en unités entières. `POST /quotes` arrondit la quantité à la
précision de l'actif (`decimals` : 0 pour une action, 8 pour le bitcoin), **vers le bas** à
l'achat — personne ne doit être débité de plus qu'il n'a demandé — et recalcule le total à
partir de la quantité réellement traitée. Un montant qui n'atteint pas une unité entière est
refusé avec une phrase qui dit le cours.

Le devis porte le prix, l'écart et les frais **explicitement** : l'écran de confirmation les
affiche séparément avant l'engagement. Un écart caché dans un moins bon prix est un frais
déguisé, et l'application ne le présente jamais ainsi.

### Épargne

| Méthode | Chemin | Réponse |
| --- | --- | --- |
| GET | `/savings` | `SavingsSummary` |
| GET | `/savings/history?range=…` | `PriceHistory` |
| POST | `/savings/deposit` | `MoneyMovementResult` pour `{ amount, fromAccountId }` |
| POST | `/savings/withdraw` | `MoneyMovementResult` pour `{ amount, toAccountId }` |
| GET | `/savings/goals` | `SavingsGoal[]` |
| POST | `/savings/goals` | `SavingsGoal` |
| PATCH | `/savings/goals/:id` | `SavingsGoal` |
| POST | `/savings/goals/:id/contribute` | `SavingsGoal` pour `{ amount }` |
| DELETE | `/savings/goals/:id` | `204` |

### Alimentation et envois

| Méthode | Chemin | Réponse |
| --- | --- | --- |
| GET | `/funding/sources` | `FundingSource[]` |
| POST | `/funding` | `MoneyMovementResult` pour `AddFundsRequest` |
| POST | `/transfers` | `MoneyMovementResult` pour `TransferRequest` |
| GET | `/transfer-providers` | `TransferProvider[]` |

`TransferProvider` porte `available` : un opérateur non encore raccordé reste dans la liste,
grisé. Savoir qu'il arrive vaut quelque chose ; faire semblant qu'il marche ne vaut rien.

`POST /transfers` porte **`providerId`** quand `method` vaut `operator` : c'est le rail
emprunté, et c'est lui qui décide des frais. Le destinataire est identifié par `handle` —
un numéro de téléphone pour le Mobile Money, un identifiant pour Revolut, une adresse
courriel pour Wise — jamais par un champ nommé `email`. Le back-end **valide `handle` selon
le `handle` de l'opérateur**, exactement comme le formulaire (`src/lib/transferHandle.ts`).

La réponse porte **`fee`** : ce que l'opérateur a prélevé, dans la devise d'envoi. Le total
débité est `amount + fee`, et les deux sont affichés avant confirmation. Les frais d'un
opérateur ne sont pas les nôtres, et la personne qui paie ne fait pas la différence.

### Notifications

| Méthode | Chemin | Réponse |
| --- | --- | --- |
| GET | `/notifications` | `AppNotification[]` |
| POST | `/notifications/:id/read` | `204` |
| PATCH | `/notifications` | `204` pour `{ read: true }` — tout marquer comme lu |
| GET | `/notifications/prefs` | `NotificationPrefs` |
| PATCH | `/notifications/prefs` | `NotificationPrefs` |

### Profil

| Méthode | Chemin | Réponse |
| --- | --- | --- |
| GET | `/me` | `User` |
| PATCH | `/me` | `User` |
| GET | `/me/security` | `SecuritySettings` |
| PATCH | `/me/security` | `SecuritySettings` |
| GET | `/me/devices` | `Device[]` |
| DELETE | `/me/devices/:id` | `204` |
| GET | `/me/statements` | `Statement[]` |
| GET | `/me/tax-documents` | `TaxDocument[]` |

## Ce que le back-end doit garantir, et que l'interface suppose déjà

1. **Un mouvement d'argent est idempotent.** L'application désactive le bouton pendant
   l'appel, mais un réseau mobile rejoue les requêtes : `POST /funding`, `/transfers`,
   `/orders` et `/crypto/withdrawals` doivent accepter un en-tête `Idempotency-Key` et
   rendre le même résultat pour la même clé.
2. **Une transaction apparaît immédiatement en attente.** L'interface l'affiche comme
   « En attente » dès la réponse, puis attend l'événement de règlement. Une réponse qui
   n'arrive qu'une fois le règlement fait laisse l'utilisateur devant un écran figé.
3. **Le grand livre est en partie double.** Les soldes rendus par `/accounts` doivent être
   dérivés du livre, jamais stockés à côté.
4. **La conversion arrondit une seule fois, à la fin.** Arrondir au franc entier au milieu
   d'un croisement à deux étapes perd une unité par étape. Les règles de devise de
   l'application sont dans `src/lib/currency.ts` et doivent être les mêmes des deux côtés.
5. **XOF et XAF sont arrimés à l'euro à 655,957 exactement.** Ce n'est pas une cotation :
   si un flux de taux propose autre chose pour ces paires, il a tort.

## Vérifier

Le client REST est testé sans back-end (`src/api/rest/restApi.test.ts`) : chemins, chaîne de
requête, en-tête d'autorisation, correspondance des erreurs. Un test vérifie aussi que ce
document liste **tous** les points d'entrée que le client appelle — ajouter un appel sans
l'écrire ici fait échouer la suite.

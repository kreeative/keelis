# Keewal Meere — feuille de route

La checklist du propriétaire, tenue à jour. **Rien ici n'est urgent** : c'est la référence
de ce qui reste à bâtir, et dans quel ordre.

L'état est écrit honnêtement. « Fait » veut dire : présent dans l'application, vérifié par
un test ou par une capture, et non « commencé ».

## Positionnement

L'app porte **principalement sur l'achat d'actions africaines** — BRVM, NGX, JSE, NSE. La
cryptomonnaie vient ensuite, à côté et non au-dessus.

**Fait.** La démonstration détient des actions africaines — Sonatel, Dangote Cement,
Safaricom, NSIA Banque — pour plus de la moitié du portefeuille, Sonatel en première ligne,
et les achats qui les ont produites figurent dans l'activité. La pédagogie contextuelle est
là : `LearnSheet` explique une introduction en bourse et comment lire un cours, et la carte
« Bientôt en bourse » annonce une IPO datée.

## 1. Architecture de l'information et navigation

- Navigation globale : 5 destinations, flottantes à toutes les largeurs — **fait**
- Tableau de bord : solde héros, bascule de période, rendement, actions rapides — **fait**
- Moteur de marché : recherche, filtres par classe et par détention, page d'actif — **fait**
- Chandeliers (`CandleChart`), à partir de 1024 px, en option — **fait**
- Portefeuille multidevise : XOF/EUR/NGN côte à côte, conversion réelle entre poches — **fait**
- Carnet d'ordres, consensus des analystes — **manque un flux de données de marché.**
  Rien à coder tant qu'il n'existe pas : un carnet inventé ressemblerait à de l'information
  sans en être.

## 2. Parcours et intégration

- Intégration progressive : courriel → code → identité → adresse → pièce → 2FA → NIP — **fait**,
  et ouvrable depuis les 34 pays que l'application sert, pas seulement depuis le Canada
- Passage d'ordre : aperçu en direct, frais explicites, feuille de confirmation — **fait**.
  Un actif indivisible se cote en unités entières : une action ne se fractionne pas sur la BRVM
- Capture de document et selfie, test de vivacité (Smile ID / Sumsub) — **manque un fournisseur KYC.**
  L'écran accepte un fichier ; la vérification est côté serveur
- Profil de risque : questionnaire avant de débloquer les classes d'actifs complexes — **à faire.**
  C'est le prochain morceau utile côté interface : il ne dépend d'aucun tiers
- Fractions d'action — **à décider.** Techniquement possible pour un dépositaire qui les
  offre ; la BRVM, elle, ne les connaît pas

## 3. Front-end et système de design

- Jetons, bibliothèque de composants, mode confidentialité — **fait**
- Contrôles vérifiés par machine : règles de design statiques, audit de contraste composité,
  cibles de 44 px, débordement, parcours d'argent réels, Content-Security-Policy — **fait**
- Motion : le solde se pose, la courbe se dessine — **fait**, et coupée sous
  `prefers-reduced-motion`
- **Nouvelle marque.** Le mot-symbole est composé en Poppins, en attendant : l'ancien tracé
  épelait *Keelis*. Le monogramme, lui, survit. Décision du propriétaire

## 4. Back-end et moteur

Rien de tout cela ne peut exister côté interface. Le contrat est écrit et le client HTTP
aussi : [`docs/API.md`](docs/API.md), 65 points d'entrée, la forme des erreurs, le flux
d'évènements. Brancher un back-end qui le satisfait est une variable d'environnement.

**Et le contrat a été exécuté, pas seulement rédigé.** `server/reference.mjs` le sert en
HTTP, `pnpm e2e:server` compile l'application configurée — sans la moindre donnée simulée
dans le paquet — et lui fait ouvrir une session, lire les comptes, passer un ordre et
recevoir le flux d'évènements sur le réseau. Un contrat que personne n'a jamais fait tourner
est une hypothèse ; celui-ci a tenu.

- Identité : OAuth 2.0 / OIDC, JWT, MFA, empreinte d'appareil
- Grand livre en partie double : portefeuilles, règlements en attente, conversion de devises
- OMS : routage d'ordres vers un BaaS ou les bourses locales (FIX/REST)
- Notifications : push, SMS, courriel

## 5. Intégrations tierces

**Toutes vivent sur le serveur, jamais dans cette application** : une variable `VITE_` est
publique, inscrite dans le JavaScript livré à chaque visiteur.

- KYC : registres d'identité locaux, contrôle PPE, listes de sanctions
- Rails de paiement : Wave, Orange Money, MTN ; Flutterwave, Paystack, Bizao
- Données de marché : cours en direct et différés, historiques
- Garde et BaaS : ouverture de compte, exécution, documents fiscaux

## 6. Sécurité et conformité

- Chiffrement en transit, en-têtes stricts, CSP exercée à chaque compilation — **fait côté livraison**
- NIP / biométrie, verrou après inactivité et au retour d'arrière-plan — **fait**
- AES-256 au repos, journaux d'audit immuables — **côté serveur**
- Agrément. **L'application n'en détient aucun et le dit** : sur `/entreprise`, dans
  « Données et connexion », et partout où un chiffre est une valeur de démonstration

---

## État actuel

L'API est simulée (`src/api/mock/`) derrière le contrat `KeewalApi`. Aucun écran ne connaît
la différence : une compilation configurée retire entièrement les données simulées du paquet
livré, parce que des soldes inventés n'ont rien à faire dans le même fichier que des soldes
réels.

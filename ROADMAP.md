# Keelis — feuille de route

Ce document est la checklist du propriétaire, conservée telle qu'elle a été formulée.
**Rien ici n'est requis pour aujourd'hui.** Il sert de référence pour savoir ce qui reste
à bâtir et dans quel ordre.

## Positionnement

L'app porte **principalement sur l'achat d'actions africaines** — BRVM, NGX, JSE, NSE.
La cryptomonnaie vient ensuite, à côté et non au-dessus. La démo doit déjà montrer des
actions africaines et de la pédagogie contextuelle (IPO à venir, comment lire un cours).

## 1. Architecture de l'information et navigation

- Navigation globale : 4–5 destinations (Accueil/Portefeuille, Marchés, Portefeuille/Dépôt, Activité, Profil)
- Tableau de bord : solde héros, bascule de période (1J 1S 1M 1A Max), rendement total, actions rapides
- Moteur de marché : recherche, catégories (actions US, actions locales/BRVM, obligations d'État, crypto), page d'actif (chandeliers, carnet d'ordres, statistiques clés, consensus des analystes)
- Portefeuille : solde en monnaie locale, dépôts en attente, multidevise (XOF/USD, NGN/USD côte à côte)

## 2. Parcours et intégration

- Intégration progressive : téléphone/courriel → biométrie → KYC par paliers
- Capture de document et selfie : détection de contours en direct, test de vivacité (Smile ID / Sumsub)
- Profil de risque : questionnaire de 3–4 questions avant de débloquer les classes d'actifs complexes
- Passage d'ordre : exécution en deux touches, aperçu du prix en direct, fractions d'action, frais explicites, modale de confirmation

## 3. Front-end et système de design

- Jetons : échelles clair/sombre, élévations, flous dynamiques, typographie — **fait**
- Bibliothèque de composants : cartes, feuilles d'action, feuilles de transaction, graphiques, toasts — **fait**
- Mode confidentialité : masquage des soldes en un geste — **fait**

## 4. Back-end et moteur

- Identité : OAuth 2.0 / OIDC, JWT, MFA, empreinte d'appareil
- Grand livre en partie double : portefeuilles, règlements en attente, soldes de compensation, conversion de devises
- OMS : routage d'ordres vers un BaaS (DriveWealth/Alpaca) ou les bourses locales (FIX/REST)
- Notifications : push, SMS, courriel pour exécutions, mouvements de prix, dépôts

## 5. Intégrations tierces

- KYC : registres d'identité locaux, contrôle PPE, listes de sanctions
- Rails de paiement : Wave, Orange Money, MTN ; Flutterwave, Paystack, Bizao
- Données de marché : cours en direct et différés, historiques (WebSocket / REST)
- Garde et BaaS : ouverture de compte, exécution, documents fiscaux (W-8BEN)

## 6. Sécurité et conformité

- Chiffrement : TLS 1.3 en transit, AES-256 au repos
- NIP / biométrie : verrouillage après 30 s d'inactivité ou changement d'app
- Journaux d'audit immuables : transactions, adresses IP, exécutions

---

## État actuel de la démo

L'API est simulée (`src/api/mock/`) derrière le contrat `KeelisApi`. Aucun écran ne connaît
la différence : brancher un vrai back-end veut dire implémenter cette interface, pas
retoucher l'interface utilisateur.

# SEDIMA Logistique & Distribution

> Pour reprendre le projet dans une nouvelle session, lire d'abord **[REPRISE.md](REPRISE.md)**.

Application de gestion de la flotte automobile de SEDIMA : véhicules, chauffeurs,
affectations, conformité, maintenance, carburant, caisse, achats, transporteurs et coûts.

Elle est le **système de référence du parc** : le module M3 de SediLiv ne sera pas
développé, et le cahier des charges « Extension SediLiv v1.4 » §8 vaut spécification.

## Démarrer

```bash
npm install
npm run dev
```

L'application écoute sur <http://localhost:3000> et ouvre sur le **tableau de bord SQDCM**.
La page de garde est sur `/connexion`.

## Socle technique

| Brique | Choix |
|---|---|
| Cadre | Next.js 16, App Router, React 19 |
| Langage | TypeScript strict |
| Styles | Tailwind 4, configuration CSS-first dans `src/app/globals.css` |
| Base | Supabase, projet dédié (non branché à ce stade) |
| Déploiement | Vercel |

## Design

Deux sources, chacune à sa place :

- **L'identité** vient de `docs/SEDIMA-charte-formatage.md` de SEDIMA Opérations : Inter,
  vert SEDIMA `#78B225` réservé à l'action principale, à l'état actif de navigation et au
  focus ; le rouge aux écarts et aux suppressions. Interface neutre à 95 %.
- **Le traitement** vient des références retenues par la Direction des Opérations
  (maquettes de logiciels de gestion sur Dribbble) : fond froid très clair, cartes
  arrondies à ombre douce, graisses légères, identifiants en couleur d'accent, contrôles
  en pilule, barre d'outils dans la carte du tableau, pagination en pied.

Les utilitaires de base (`carte`, `bouton-principal`, `bouton-secondaire`, `champ-pilule`,
`en-tete-colonne`…) sont définis dans `src/app/globals.css`.

Tout le vocabulaire du code est en français, comme dans MMS Finances.

> Piège connu : le reset CSS doit rester dans `@layer base`. Hors couche, une règle
> d'élément comme `button{background:none}` l'emporte sur les utilitaires Tailwind et
> tous les boutons perdent leur fond.

## Organisation

```
src/
  app/
    (application)/     pages portant le rail de navigation
    connexion/         page de garde, hors rail
    globals.css        système de design
  composants/
    coquille/          rail de navigation, rétractable
    interface/         pastilles, bandeau de KPI, liste de référentiel (TableListe), tableau de fiche
                       (TableauSimple : en-tête figé, choix des colonnes), panneau ChoixColonnes
    flotte/            liste flotte, création d'un véhicule
    vehicule/          fiche véhicule 360°
    chauffeurs/        liste, fiche chauffeur, classement SQDCM
    affectations/      planning véhicule × période, conflits, propositions
    conformite/        échéancier unique et centre d'alertes
    incidents/         déclaration en quatre étapes, liste des incidents et sinistres
    disponibilite/     prêt à charger, capacité du jour
    tableau/           tableau de bord SQDCM du parc, sur la maquette de la DO : cinq axes,
                       38 indicateurs disponibles dont les six du référentiel DO par défaut,
                       sélection composable, alertes du jour, dépenses par BU
    transporteurs/     les trois façons dont le parc achète du transport : affrètement au
                       voyage, mise à disposition ADEX à la journée, prestations hors
                       grille — plus les grilles et leur source, bâti sur le dossier de la DO
    parametres/        clôture des mois, règles des documents, énergie, notifications et
                       **programmes d'entretien** — un gabarit par type de véhicule
    rapports/          catalogue de 25 rapports standards en neuf familles, plus les rapports
                       personnalisés composés par l'utilisateur ; puis un rapport : période
                       fine (jour, mois, trimestre, année, plage libre), facettes déduites des
                       colonnes, colonnes rangeables au glisser-déposer, totaux, export Excel,
                       réglages et vues nommées conservés par profil
    caisse/            journal de caisse (dépense rattachée obligatoire), demandes d'achat :
                       circuit de validation à seuil puis étapes constatées depuis Sage X3
                       (ModaleDecision) — l'achat lui-même vit dans X3
    prestataires/      liste des prestataires et fiche prestataire (statistiques, achats,
                       interventions, pleins, caisse, documents, visites)
    maintenance/       à faire déduit des fiches, ordres de travail (planifié → en atelier → clos),
                       interventions de toute la flotte
    carburant/         pleins de la flotte, journal de la cuve interne (stock recalculé, relevés de
                       jauge), consommation par véhicule contre la référence
    clotures/          clôture des mois et approbation des demandes (Paramètres)
    parametres/        règles des documents, énergie et carburant (prix, contenance de la cuve),
                       prestataires (garages, fournisseurs, stations, assureurs, centres agréés)
    discussion/        fil de discussion des fiches (mentions @)
    transactions/      modification tracée des transactions (modale, champs, contexte)
    connexion/         formulaire et comptes de démonstration
  domaine/             types, libellés, rôles, immatriculations, règles des documents, paramètres
  donnees/             données de démonstration (temporaire)
  lib/                 formatage, session de démonstration, paramètres (navigateur + cookie lu par le serveur)
```

## Trois choix structurants

1. **L'affectation est une entité datée**, pas un champ « chauffeur » du véhicule.
   Sans cela, on ne peut pas imputer la consommation d'un mois au bon conducteur.
2. **Toute dépense est un mouvement daté rattaché à un véhicule**, quelle que soit sa
   voie de paiement — caisse, bon de commande ou facture. Une dépense non rattachée
   sort de l'analyse et fausse l'arbitrage entre réparer et réformer.
3. **Le relevé kilométrique est un fait daté**, d'origine tracée — saisie, plein,
   garage ou télématique. L'odomètre courant en est déduit.

À quoi s'ajoute, pour rendre les KPI calculables : un **historique de statut horodaté**
(sans lui, ni D_TDPA ni D_TICV) et un marqueur **transport spécial** porté par le
véhicule, indépendant de sa catégorie technique.

## État d'avancement

Livré (Lot 1 complet en démonstration, 3 septembre 2026) : socle technique, système
de design, page de garde avec comptes de démonstration, rail rétractable, Flotte et
fiche véhicule 360°, Chauffeurs et performance SQDCM, Affectations, Conformité,
Disponibilité du jour, Incidents & sinistres, Caisse & achats, Paramètres (clôture des
mois, règles des documents). Toute transaction est numérotée, modifiable avec trace,
et soumise à la clôture des mois.

Lot 2 entamé : Maintenance (à faire déduit des fiches, ordres de travail, clôture
qui crée l'intervention sur la fiche du véhicule) et Carburant (pleins, journal de la
cuve interne à stock recalculé, consommation par véhicule). Chaque véhicule porte son
énergie (gasoil, essence, électrique, hybride) ; les prix de l'énergie et la
contenance de la cuve sont des Paramètres, comme le référentiel des prestataires.

Livré le 4 septembre 2026 : **Rapports** — « Coûts & analyses » a été renommé et
élargi, le coût n'étant qu'une dimension parmi d'autres. Vingt et un rapports
standards sur toutes les dimensions du parc, chacun décrit (colonnes typées, totaux,
fenêtre de temps) plutôt que codé écran par écran. `/couts` redirige vers
`/rapports`.

Les **rapports personnalisés** sont livrés : on choisit une base — ce qu'une
ligne compte —, puis ses colonnes, ses filtres et sa période, avec un aperçu
vivant. L'**export** produit un classeur Excel formaté : cartouche des conditions
(période, filtres, tri, auteur), vrai tableau Excel, valeurs typées et donc
sommables. Le rail a été regroupé par la question que l'on se pose : le tableau
de bord en tête, puis Exploitation, Suivi, Pilotage, Administration.

À venir : **module IA** interrogeable de partout sur la flotte, et les **courbes
du tableau de bord** — c'est lui qui donne le coup d'œil rapide, un rapport qui
donne la table. Puis dossiers sinistres, inspections, et le branchement Supabase,
qui remplacera `src/donnees/*-demo.ts` et la session de démonstration. Le détail
et l'ordre sont dans [REPRISE.md](REPRISE.md).

## Authentification

Le mécanisme reprend celui de SEDIMA Opérations : Supabase Auth, identité résolue
**côté serveur** par une fonction `get_me()` en `SECURITY DEFINER` — le client ne
déduit jamais son rôle — double authentification obligatoire pour les administrateurs.

Tant qu'aucun projet Supabase n'est configuré, l'application reste en mode
démonstration et l'identité se choisit sur la page de garde. C'est le principe de
non-régression de SEDIMA Opérations ; `src/lib/session-demo.ts` ne fait autorité sur
rien et disparaîtra au branchement.

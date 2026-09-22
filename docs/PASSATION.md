# Passation — où en est SEDIMA Parc (22 septembre 2026)

*À lire en premier dans une nouvelle conversation. Le détail de chaque chantier
est dans les documents cités ; ce fichier dit où l'on en est et comment on
travaille.*

## Comment on travaille ici

- **Langue** : tout en français — code, commentaires, commits, documents,
  échanges.
- **Pile** : Next.js 16 (lire `node_modules/next/dist/docs` avant d'écrire du
  code Next — voir `AGENTS.md`), Supabase (RLS par `peut(module, niveau)`,
  `mon_role()`), TypeScript.
- **SQL** : le métier joue lui-même les fichiers dans le **SQL Editor de
  Supabase**, dans l'ordre donné. Un fichier au-delà de ~500 Ko est refusé. Un
  fichier doit être **rejouable** (`if not exists`, `on conflict`, `drop … if
  exists`).
- **Git** : on commite ; **le métier pousse lui-même** (`git push origin main`)
  — le push de l'assistant est refusé.
- **Secrets** : `.env.local` porte la clé de service ; les scripts la lisent
  sans jamais l'afficher. Lectures de contrôle en base : scripts temporaires
  sous `scripts/_*.mts`, supprimés après usage.
- **Style** : commentaires en tête de fichier qui disent *pourquoi*, citations
  du métier datées ; `npm run verifier-charte` doit passer.
- **Écritures** : navigateur d'abord (`enregistrerCreation` /
  `enregistrerModification`, `lib/clotures-demo.ts`), synchronisation vers la
  base par `lib/transactions-actions.ts` ; correspondance des colonnes dans
  `lib/transactions-colonnes.ts` ; champs des formulaires dans
  `composants/transactions/champs.ts`.
- **Piège d'outil** : dans les scripts d'édition passés par heredoc bash, les
  `\b`, `\s`, `\d`, `\n` des expressions régulières se perdent. Écrire ces
  scripts avec l'outil d'écriture de fichier, ou corriger à l'éditeur, et
  vérifier par `grep` après coup.

## Bancs d'essai

```bash
PGLITE_DIR=C:/Users/mamadou.seck/AppData/Local/Temp/sedima-pglite node --import tsx --import ./scripts/rendu/hook.mjs scripts/tester-services-maintenance.mts
```

- `tester-services-maintenance` — 82 contrôles : services, pannes, catalogue,
  0059 à 0063, rapports de maintenance, règlements.
- Aussi : `tester-fiche-rendu`, `tester-fiche`, `tester-atelier`,
  `tester-maintenance`, `tester-rapports`, `tester-caisse-cuve`,
  `tester-caisse-reelle`, `tester-facture`, `tester-conformite-incidents`,
  `tester-piece-a-droite`.
- `npx tsc --noEmit -p .` (lent : jusqu'à ~3 min) et `npm run verifier-charte`.
- `tester-conformite` échouait déjà avant ces chantiers (jeu de démonstration
  sans documents) : connu, non traité.

## Ce qui est en base (joué par le métier)

Migrations jusqu'à **0062** ; `taches-service.sql` (294 tâches) ;
`interventions-taches.sql` (696 affectations) ;
`correctif-operations-doublons.sql` (23 opérations d'entretien).

**À jouer si ce n'est pas fait**, dans l'ordre : `0063_reglements.sql` (une
sortie de caisse qui dit ce qu'elle règle), `0064_livraisons_saisies.sql`
(livraisons saisies), `0065_pleins_approvisionnement.sql` (`plein.remboursable`,
`ajouter_station()`), `0066_evenements_chauffeur.sql` (événements du chauffeur). Le code lit et écrit sans elles (colonne retirée à
l'écriture, lecture de repli), mais sans leur apport.

## Les chantiers récents (du plus récent au plus ancien)

Tout est décrit dans **`docs/SERVICES-MAINTENANCE.md`** (sections datées).

1. **Performance chauffeur (0066)** : plus de piliers SQDCM. Six indicateurs
   automatiques (`KPI_CHAUFFEUR` : accidents responsables, infractions, pannes
   et avaries en mission, écart de consommation, présence, discipline) ; score =
   moyenne simple des calculables ; objectifs des compteurs **par mois**.
   Performance = mois en cours ; Aperçu = courbe du score mensuel
   (`scoresMensuels`). Onglet **Événements** (`evenement_chauffeur`, type
   `evenement`, préfixe EVC) : cas disciplinaire, retard, plainte (négatifs),
   félicitation, formation (positifs) — ils font l'indicateur Discipline avec
   les sanctions existantes. L'écart du classement « moins de 300 km » est
   remplacé par « aucune affectation dans le mois ». Sanctions retirées de
   l'onglet Incidents ; indisponibilités sous Affectations ; date de naissance
   retirée ; sélecteur 3/6/12 mois retiré (12 mois roulants).
1. **Documents du chauffeur** : comme la Conformité du véhicule — rappels et
   scan sur la même ligne, ouvert à droite ; « Renouveler » dépose la pièce.
1. **Planning** : filtre Exploitation / Autres (`VehiculePlanning.regime`).
1. **Carburant (0065)** : le plein dit pompe du siège (pas de facture, pas
   remboursable) ou station (choisie, ou ajoutée à la volée par
   `ajouter_station`), facture, remboursable (défaut ; seul un plein
   remboursable attend la caisse), complet ou partiel. Onglet Carburant :
   consommation retirée de la fiche (métier) : L/100 km et F/100 km dans le
   rapport « Consommation de carburant » ; Aperçu : F par tonne livrée sur 12 mois.
   **En base, aucun des 720 pleins des 12 derniers mois ne porte le compteur** :
   les L/100 km du rapport restent vides pour la plupart des véhicules
   tant que le « Km relevé » n'est pas saisi au plein.
1. **Relevé kilométrique** : dernier relevé en bas du formulaire, contrôle de
   cohérence avant validation (`controleReleve` dans `vehicule/ajout.ts`,
   prop `controle` de la modale ; alerte bloquante, confirmable).
1. **Disponibilité** : filtres Tout le parc / Exploitation / Service /
   Fonction (+ BU) ; colonnes Statut et Chauffeur affecté (nom, attributaire,
   ou « Non affecté ») ; capacité par catégorie et « Ce qui manque » retirés.
1. **Chauffeurs** : Km/contraventions/incidents quittent la liste (rapports) ;
   forfait carburant et plan car ne se suivent plus (DCH).
1. **Règlements (0063)** : une dépense ou un service dit comment il se règle
   (caisse / bon de commande avec n° et pièce / facture) ; une sortie de caisse
   dit ce qu'elle règle (plein, service, autre dépense) et cite l'élément
   ouvert ; « à régler » = dépenses caisse + pleins de station 90 j + services
   caisse (net à payer). Les demandes d'achat ont quitté l'écran Caisse.
2. **Tâche saisie dans l'ordre** : tâche → catégorie → système de la catégorie
   → ensemble généré (`prochainEnsemble`), en lecture (type de champ
   `lecture`).
3. **Suppression tracée** : bouton « Supprimer » (modale de modification,
   formulaire de service), motif obligatoire, ligne `modification` champ
   `suppression` avec la plaque entre crochets, affichée au journal du
   véhicule (`domaine/suppression.ts`, `supprimerTransaction`).
4. **Service depuis un plan d'entretien** (« Depuis le plan d'entretien… »).
5. **Fiche véhicule** : onglet « Conformité » ; en-tête n'immobilise que sur
   les rappels échus de documents critiques ; atelier : colonne « Tâche de
   service », une ligne par numéro (`sansDoublon`), pas de visionneuse sans
   pièce.
6. **Programmes d'entretien en base et éditables (0062)** ; main-d'œuvre
   globale d'un service ; immobilisation calculée ; précision libre par ligne.
7. **Rapports de maintenance** : Services de maintenance, Pannes signalées,
   Tâches de maintenance ; « À faire » avec pannes et services ouverts
   (`travauxOuverts`).
8. **Utilisations comptées sur le parc (0061)** : `intervention_tache`,
   `scripts/affecter-interventions-taches.mts`.
9. **Catalogue revu** : `scripts/charger-taches-fleetio.mts` (table de revue
   explicite, numéros stables).
10. **Services de maintenance, pannes, catalogue (0059-0060)** : voir aussi
    `docs/PROPOSITION-MAINTENANCE.md` (décisions du métier).

## Ce qui reste ouvert

- **Question posée au métier, sans réponse** : ajouter le règlement (BC, n°,
  pièce) à la saisie de facture de l'atelier (`FormulaireFacture`, « Saisir
  une facture ») ?
- La liste Flotte et les rapports calculent encore l'immobilisation
  administrative sur les documents, pas sur les rappels suivis (l'en-tête de la
  fiche, lui, suit les rappels) — à aligner si le métier le demande.
- Plans préventifs **par modèle** (aujourd'hui par catégorie) ; échéance qui
  propose le service, tâches remplies.
- Rapports à faire : respect du plan préventif, consommation de pièces par
  tâche.
- Observations de visite technique à rattacher aux signalements.
- Le téléphone de l'atelier ne connaît pas le formulaire de service.
- Possible doublon d'import dans les pleins : PLN-R-000829 et PLN-R-005671
  ont les mêmes valeurs — à vérifier avant d'en supprimer un.
- Aucun écran n'a été vérifié dans un navigateur sur ces chantiers : l'accès
  demande une connexion que l'assistant ne fait pas.

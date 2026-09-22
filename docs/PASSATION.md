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

**À jouer si ce n'est pas fait** : `supabase/migrations/0063_reglements.sql`
— sans elle, une sortie de caisse qui dit ce qu'elle règle ne s'écrit pas.

## Les chantiers récents (du plus récent au plus ancien)

Tout est décrit dans **`docs/SERVICES-MAINTENANCE.md`** (sections datées).

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
- Aucun écran n'a été vérifié dans un navigateur sur ces chantiers : l'accès
  demande une connexion que l'assistant ne fait pas.

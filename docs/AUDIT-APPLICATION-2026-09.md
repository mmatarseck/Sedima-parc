# Audit de l'application — 23 septembre 2026

*Connexions à la base, cohérence des données, tableau de bord.*

## Ce qui a été vérifié

- **Typage** (`tsc --noEmit`) et **charte** (`npm run verifier-charte`) : tenus.
- **Base** (projet Supabase de production, en lecture seule) : les 62 tables
  répondent ; les onze fonctions de lecture aussi (`lire_tableau`, `lire_parc`,
  `lire_chauffeurs`, `lire_transporteurs`, `lire_prestataires`,
  `lire_fiches_chauffeurs`, `situation_journaliere`, `types_document_suivis`,
  `derniere_saisie`, `annuaire`, `lire_fiche`). La plus lente est
  `lire_fiches_chauffeurs` (≈ 4 s).
- **Tableau de bord** recalculé sur les données réelles, indicateur par
  indicateur, avec le code de l'application.

## Défauts corrigés dans le code

| # | Défaut | Effet | Correction |
| --- | --- | --- | --- |
| 1 | `situation_journaliere()` lue avec `.maybeSingle()` alors qu'elle rend un tableau | PostgREST répondait PGRST116 et l'application **basculait sur la démonstration** : les pastilles du tableau de bord (hors service, prêts à charger, caisse, échéances…) affichaient en production des **chiffres inventés** | `donnees/situations.ts` : lecture sans `.maybeSingle()` ; base branchée, un échec ne sert plus jamais la démonstration |
| 2 | Même défaut sur `lire_fiches_chauffeurs()` | Le **classement des chauffeurs** et la cohorte tournaient sans historique | `donnees/fiche-chauffeur.ts` |
| 3 | Les situations nomment le véhicule par son UUID, le tableau de bord par sa plaque | Poser un filtre BU, catégorie ou site **vidait les pastilles** | `VehiculeTableau.uuid`, filtre sur les deux clés |
| 4 | 676 demandes d'achat à l'étape « réglée » sans date de règlement | « Engagements en cours » = **1 020 570 366 F** ; même gonflement dans le Budget et le rapport de cycle d'achat | `achatClos` / `achatEngage` (`domaine/caisse.ts`), utilisés par le tableau de bord, le budget et les rapports |
| 5 | Les pleins n'entraient pas dans les coûts du tableau de bord ni de l'écran Coûts (la fiche véhicule, elle, les comptait) | Coût du parc, coût/km, coût à la tonne, « Où passe l'argent » **sans le carburant**, premier poste du parc | Pleins ajoutés au coût du véhicule-mois (`donnees/tableau-bord.ts`, `donnees/couts.ts`) |
| 6 | Coût/km et L/100 km : charges et litres de tout le parc divisés par les km de quelques véhicules | 1 434 F/km et **443 L/100 km** sur 12 mois | Ratios restreints aux véhicules-mois dont les km sont connus (`coutSurKm`, `litresSurKm`, `kmAvecLitres`, `accidentsSurKm`) |
| 7 | Compteur lu « dernier relevé avant » | Les km de décembre à juillet versés sur juillet (41 000 km en un mois) | Compteur **interpolé** entre deux relevés (`kmVers`) |
| 8 | Coût à la tonne du parc (C_CDM_SEDI) : charges de tout le parc / tonnes du seul relevé UAB | 26 795 F/t en août, hors cible à tort | Tonnes des **bons de livraison** (toutes usines) dès qu'ils couvrent le mois ; C_CDM_SEDI ne se calcule plus sur le relevé |
| 9 | Taux d'externalisation (repli en coût) : 0 % « dans la cible » quand les coûts des tiers du mois ne sont pas encore saisis | Faux vert | Les deux termes sont exigés |
| 10 | Conformité des véhicules spéciaux : aucun certificat de salubrité au parc | **0 %**, hors cible | « — » tant que le registre n'est pas tenu |
| 11 | Code mort : sélection à 5 pastilles, score par axe | Deux règles contradictoires dans le code (5 contre 6 pastilles) | Retiré |

## Le tableau de bord, renforcé

- **Trois nouveaux indicateurs** (courbes) : *Tonnes livrées par le parc*,
  *Tonnes livrées par véhicule engagé*, *Carburant par tonne livrée* — sur les
  16 771 bons de livraison que le tableau de bord ne lisait pas. Ils suivent
  les filtres BU, catégorie, site.
- **Courbes par défaut** : les quatre anciennes (disponibilité, coût/km,
  consommation, accidents) étaient **vides en production** faute de durées
  d'immobilisation, de compteurs et d'incidents. Le défaut devient : coût à la
  tonne du parc, taux d'externalisation, tonnes livrées, dépenses. Un compte qui
  avait déjà choisi ses courbes garde son choix.
- Les pastilles montrent désormais les **vrais chiffres** (défaut n° 1).

Ce que donnent les nouvelles règles sur la base (avant le correctif des pleins) :

| Mois | Source des tonnes | Tonnes parc | Coût/t parc | Externalisation |
| --- | --- | ---: | ---: | ---: |
| 2025-11 | bons | 2 590 | 10 153 F | 70,9 % |
| 2026-01 | bons | 3 054 | 11 466 F | 74,4 % |
| 2026-04 | bons | 3 907 | 6 478 F | 71,3 % |
| 2026-06 | bons | 3 707 | 11 091 F | 73,8 % |
| 2026-07 | relevé (bons incomplets) | — | — | 92,5 % |
| 2026-08 | bons | 2 825 | 7 520 F | 74,2 % |

## À jouer par le métier (SQL Editor, dans cet ordre)

1. **`supabase/migrations/0067_tableau_livraisons.sql`** — `lire_tableau`
   rend les bons de livraison agrégés. Sans elle, le tableau de bord reste au
   relevé de transport (et C_CDM_SEDI affiche « — »). Rejouable.
2. **`supabase/correctif-pleins-doublons.sql`** (220 Ko) — le carburant a été
   **chargé deux fois** le 10 septembre 2026 (18 h 58 avec une ancienne
   version du générateur, puis les parties actuelles) : **1 032 pleins en
   double** (310 388 L, dont les 415 cumuls mensuels de juillet 2025 à juillet
   2026 : les litres des douze derniers mois sont doublés), et **1 032 pleins
   de 2022 absents**. Le fichier, écrit par `scripts/reconcilier-pleins.mts`,
   retire les doubles et ajoute les manquants : la base redevient identique aux
   parties. Seules des lignes de chargement (PLN-R, PLN-C) sont touchées.

## Données à compléter (aucun code n'y peut rien)

- **454 interventions curatives sans durée d'immobilisation**, et 17 véhicules
  immobilisés depuis une date inconnue : le **taux de disponibilité (D_TDPA)**
  et l'indisponibilité des véhicules spéciaux (D_TICV) restent « — ».
- **Registre des incidents vide** : accidents, pannes en mission (D_NPVEL),
  jours sans accident restent « — ».
- **Compteurs** : 139 relevés en tout, 6 pleins avec km ; les 65 engagés sont
  « sans relevé depuis 7 jours ». Coût/km et L/100 km ne sont qu'un ordre de
  grandeur.
- **Carburant** : aucun plein après le 31 juillet 2026.
- **Cuve** : 253 000 L « en cuve » — les 30 livraisons de 2026 sont comptées,
  mais aucune sortie : les pleins importés ne portent pas « cuve » dans leur
  source. Saisir une **jauge** (mouvement de cuve « jauge ») remet le stock à
  la réalité.
- **Certificats de salubrité** : aucun pour les 26 véhicules de transport
  spécial.
- **Caisse** : solde 29 653 F pour un seuil de 200 000 F.
- **19 véhicules engagés immobilisés administrativement** (33 documents échus).
- Doublons **internes à un même chargement**, laissés tels quels (peut-être
  réels) : 93 pleins, 116 groupes de bons de livraison, 4 affrètements.

## Décisions prises par l'assistant, à confirmer

- Les **bons de livraison** priment sur le relevé de transport pour les
  tonnes (coût à la tonne, externalisation) quand ils couvrent au moins 65 %
  des jours du mois ; les modes « client » et « inconnu » ne comptent ni pour
  le parc ni pour les tiers.
- Les **pleins sont une charge** du véhicule dans tous les écrans de coûts.
- Une demande à l'étape « réglée » est close même sans date.

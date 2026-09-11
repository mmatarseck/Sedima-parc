# L'audit interne du parc, et ce que l'application en fait

*11 septembre 2026.*

## Les sources

- **Rapport d'audit de la gestion du parc automobile**, provisoire. Période du
  1er janvier 2025 au 31 juillet 2026. Réalisé par Fatou Gaye Mbaye et Yacine
  Camara, sous la supervision de Marième Gueye (Audit et Contrôle interne).
- **Compte rendu de la réunion de synthèse** du 2 septembre 2026, entre la DACI
  et la Direction Supply Chain.
- Le classeur `SEDIMA_Maintenance_Parc_Bons_de_commande.xlsx` reçu avec eux est
  identique, octet pour octet, à celui du dossier DO déjà chargé : il n'apporte
  rien de nouveau.

Ce qui entre dans la base : `supabase/correctif-audit-parc-2026.sql`, avec le
banc `scripts/tester-audit-parc.mts`.

## Constat par constat

| Constat de l'audit | Dans l'application |
| --- | --- |
| Véhicules ADEX mis à disposition pas pleinement utilisés | **Intégré** (voir plus bas) |
| Six véhicules au garage depuis plus d'un an | **Intégré** au commentaire des véhicules ; DK 3143 NY manque au référentiel |
| Véhicules de livraison sans balise | **Intégré** au commentaire ; pas de suivi de balise dans l'application |
| 47 demandes d'achat sur 64 avec une seule offre | Hors application (processus d'achat dans Sage X3) |
| Fiche suiveuse des dépenses par véhicule non tenue depuis 2025 | **Déjà couvert** : fiche véhicule et écran Coûts, bons 2023-2026 |
| PROFLEET hors service, registre carburant incomplet | **Limite notée** dans `docs/CARBURANT-REEL.md` |
| Contrats : 3 transporteurs sur 12 | **Intégré** : Abdou Kane sous contrat ; Mamadou Diop absent du référentiel |
| 254 amendes forfaitaires, 1 201 568 F (janvier – mi-juillet 2026) | **Non chargeable** : pas de détail par véhicule dans les pièces reçues |
| Fichier de caisse mal tenu | **Déjà couvert** par le module Caisse, sauf les inventaires physiques |
| Double paiement de la manutention | Hors application (concertation avec le Commercial) |
| Fichier du parc pas à jour (AB 489 JY, AB 282 JT, AB 900 JW) | **Déjà couvert** : ces trois véhicules sont au référentiel (lot 1, 2026) |
| Pas de planning de maintenance par véhicule | **Couvert en partie** : plan d'entretien par catégorie, mais sans compteurs fiables |
| Grille des frais de route non validée | À décider : une grille dans Paramètres, validée par les RH |
| Deux comptes X3 pour le même fournisseur | **Intégré** : fournisseurs en double fondus |

## Ce qui est intégré

### Les mises à disposition ADEX

L'audit a pointé les factures d'avril 2026 contre les lignes de livraison :

| Camion | Jours facturés | Jours sur ligne de livraison | Écart |
| --- | ---: | ---: | ---: |
| AA 573 EC | 24 | 13 | 11 |
| AA 571 EC | 25 | 16 | 9 |
| AA 569 EC | 20 | 10 | 10 |

L'audit confirme aussi le contrat : mise à disposition « 6 jours / 7 »,
décomptée « selon la fonctionnalité du véhicule, même immobilisé au niveau de
la SEDIMA ». Un jour non facturé est donc un jour où le véhicule n'était pas
disponible.

C'est exactement le modèle de mise à disposition de l'application :

- jours dus = six jours sur sept du mois, moins les jours d'indisponibilité ;
- jours payés non roulés = jours dus moins jours roulés.

Les trois factures d'avril entrent donc en mises à disposition, avec leurs jours
de livraison en jours roulés. **L'application dit l'écart de l'audit, au jour
près** : 11, 9 et 10 jours payés non roulés.

**Août est converti de la même façon.** Le CA provisoire avait été chargé en
prestations au jour, faute de savoir comment ADEX décomptait ses jours. L'audit
répond à la question. Les six camions deviennent des mises à disposition : jours
dus du contrat, jours non facturés en indisponibilité, montant hors taxe
inchangé au franc près (14 370 000 F avec la benne). Leurs jours roulés restent
inconnus : le relevé de tonnage d'août est incomplet, et en tirer des jours
roulés gonflerait l'écart. La benne sans plaque reste en prestation, faute de
camion au référentiel.

Le carburant qu'ADEX prend à la pompe SEDIMA n'est pas rattaché à ces mois : la
colonne vaut zéro par construction du schéma, et l'audit note que ces véhicules
ne sont pas suivis sur Géoris.

### Les véhicules au garage

Le constat et la réponse du parc entrent dans le commentaire de chaque véhicule.

| Garage | Véhicules | Ce que le parc a répondu |
| --- | --- | --- |
| Djily, Pikine | DK 7620 BG | En panne depuis 2020 ; diagnostic du prestataire Daniel, sans devis |
| Djily, Pikine | DK 3143 NY | Proposé à la réforme en 2022 — **absent du référentiel** |
| Gormack, Rufisque | DK 9619 BB, DL 5941 D, DK 4003 AG, DK 7619 BG | Garagiste en contentieux : réparations réglées (675 000 F pour deux plateaux), non effectuées |

DK 3143 NY n'est pas au référentiel. Il faudra l'y ajouter avec ses
caractéristiques : marque, modèle, catégorie.

Les dates de panne ne sont connues qu'à l'année. Le tableau de bord continue de
compter ces véhicules « immobilisés depuis une date inconnue » (migration 0041),
jusqu'à ce qu'un changement de statut daté soit saisi.

AA 920 VA et AA 433 AJ portent l'absence de balise. Les véhicules ADEX sont
suivis par le système IRIS du transporteur, dont les accès ont été communiqués
au parc.

### Les fournisseurs en double

L'audit relève deux comptes X3 pour le même garagiste. FL100136 GIE NDIAYE ET
FRERES et FL001251 ALIOUNE NDIAYE : le fournisseur est passé du GIE à
l'entreprise individuelle, et l'ancien compte doit être fermé. Le référentiel
en portait trois lignes, et Gormack deux. Tout ce qui les cite — interventions,
dépenses, bons — est rattaché à une seule ligne, et les doublons sont
désactivés avec la mention de la ligne où ils ont été fondus.

CFAO Motors et CFAO sont très probablement le même fournisseur : ils ne sont pas
fondus tant que ce n'est pas confirmé.

### Les contrats

L'audit ne compte que trois transporteurs liés par un contrat : ADEX, Mamadou
Diop et Abdou Kane. Abdou Kane passe sous contrat, payé par livraison. Mamadou
Diop n'est pas au référentiel des transporteurs. L'objectif fixé par le
Directeur des Opérations est de six transporteurs au plus.

## Ce que l'application pourrait porter ensuite

À décider avec le métier :

1. **Le suivi des balises** par véhicule (installée, commandée, absente) : il
   rendrait visible le constat de géolocalisation.
2. **La grille des frais de route** dans Paramètres, validée par les RH, et
   rapprochée des frais de route payés en caisse.
3. **Le nombre d'offres par demande d'achat**, pour suivre la mise en
   concurrence que l'audit demande.
4. **Un reporting hebdomadaire des mises à disposition** — jours facturés, jours
   roulés, écart —, recommandé par l'audit, à partir du relevé de tonnage.
5. **La détection des réparations récurrentes** sur un même véhicule, comme les
   deux changements de moteur du bus AA 106 NE en cinq semaines.
6. **Les amendes**, dès que le détail par véhicule du fichier de caisse sera
   disponible.

## Le plan d'actions de l'audit

| Constat | Action | Délai | Responsable |
| --- | --- | --- | --- |
| Utilisation des véhicules mis à disposition | Charger le matin, reporting hebdomadaire, renégocier le contrat ADEX | 31/12/2026 | DSC |
| Véhicules au garage depuis plus d'un an | Délai de diagnostic imposé ; décision documentée par véhicule : réparation, cession ou réforme | 31/10/2026 | DSC |
| Véhicules non géolocalisés | Géolocaliser tous les véhicules de livraison actifs | 31/10/2026 | DSC |
| Demandes d'achat à offre unique | Procédure d'offre unique, prestataires par catégorie, appels d'offres, contrats | 31/12/2026 | DSC |
| Fiche de dépenses par véhicule | Rattrapage par des stagiaires ; fiche analytique par véhicule | 31/12/2026 | DSC |
| PROFLEET hors service | Changer la pompe et le système | 31/10/2026 | DSI, DSC |
| Contrats des transporteurs | Sélectionner et contractualiser | 31/12/2026 | DSC, DJC |
| Amendes forfaitaires | Contrôle avant chargement, plaques de tare, pas de surcharge | 31/10/2026 | DSC |
| Fichier de caisse | Fichier normalisé, inventaires inopinés, arrêtés de caisse | 31/10/2026 | DSC, DACI |
| Double manutention | Autorisation de la DG hors catégories définies | 31/10/2026 | DSC |
| Fichier du parc | Mise à jour régulière de toute la flotte | 31/10/2026 | DSC |
| Planning de maintenance | Planning par véhicule, exécution suivie | 31/10/2026 | DSC |
| Frais de route | Grille formalisée et validée | 31/10/2026 | DSC |

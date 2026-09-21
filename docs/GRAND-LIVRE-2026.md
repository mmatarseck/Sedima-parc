# Le grand livre 2026 : prix d'achat, amortissement, entretien, cuve

*18 septembre 2026. Métier : « des données utiles jusqu'à fin août 2026, avec le
prix d'achat des véhicules, l'amortissement, en plus des coûts de transport, de
maintenance — extraire et mettre à jour la base ».*

Source : `RECAP 31082026.xlsx`, dossier DO « 2. Stratégie, Budget, Objectifs /
21. Budget / 212. Budget 2027 / Fichiers de travail ». Extrait du grand livre
Sage X3 du 1er janvier au 31 août 2026, et tableau des immobilisations
« matériel de transport ».

Lecture et fabrication : `npx tsx scripts/charger-grand-livre.mts` — lit la base
en lecture seule (flotte, prestataires, bons déjà chargés), n'y écrit rien, et
fabrique `supabase/grand-livre-2026/`. Banc : `scripts/tester-grand-livre.mts`.

## Ce que le classeur porte

| Feuille | Contenu | Montant | Sort |
| --- | --- | ---: | --- |
| AMORTS | 186 immobilisations : date, valeur, cumul, dotation, durée | 4 310 M F au bilan, dotation 162 M F | **89 véhicules valorisés** |
| 62421 ENT VEHIC | 372 écritures d'entretien et réparation | 120,2 M F | chargé, hors doublons |
| 60541 FRES VEHIC | 166 écritures de fournitures véhicules | 34,7 M F | chargé, hors doublons |
| CARBURANT SIEGE | 30 livraisons EDK OIL à la cuve du siège | 155,0 M F | **chargé** dans `mouvement_cuve` |
| TRANSPORTEURS | cumul par transporteur au 31/08, sans date ni pièce | 786,8 M F | confronté, **non chargé** |
| 6671 MANUT, 6671 AUTRES MANUT | manutention SITOR, Layti Pouye, dépôts | 246,4 M F | hors du parc, non chargé |

## À jouer, dans cet ordre

```
supabase/migrations/0057_acquisition.sql                   -- date d'acquisition, référence d'immobilisation
supabase/grand-livre-2026/grand-livre-01-prestataires.sql  -- 4 fournisseurs
supabase/grand-livre-2026/grand-livre-02-acquisitions.sql  -- 89 véhicules
supabase/grand-livre-2026/grand-livre-03-interventions.sql -- 193 interventions
supabase/grand-livre-2026/grand-livre-04-depenses.sql      -- 403 dépenses, 115,8 M F
supabase/grand-livre-2026/grand-livre-05-cuve.sql          -- 30 livraisons, 244 000 L
```

Tout est rejouable. `rapport.txt`, à côté, liste chaque véhicule valorisé avec sa
preuve, et chaque immobilisation laissée dehors.

## Le prix d'achat et l'amortissement

Aucun des 190 véhicules n'avait de valeur d'acquisition. 89 en reçoivent une,
pour **2 185 M F**, avec la date d'acquisition, la durée (4 ou 5 ans selon le
centre de coûts) et la référence d'immobilisation.

**La preuve, par ordre de force** — elle est écrite en commentaire de chaque
ligne du SQL :

1. la **plaque** dans la désignation (41 véhicules) ;
2. le **numéro de châssis** dans la désignation (1) ;
3. un **rapprochement relu à la main** (47), retenu seulement quand le modèle est
   unique au parc (la Lexus, la Chrysler, le Range Rover, le MAN, le FAW, la
   citerne CUBAS…) ou quand N immobilisations identiques répondent à N véhicules
   identiques — cinq L200 achetés le 28/02/2017 pour cinq L200 immatriculés en
   février-mars 2017 : peu importe laquelle va à qui, valeur, date et durée sont
   les mêmes. La table est dans le script (`RAPPROCHEMENTS`), avec ses raisons.

Une immobilisation qui nomme deux véhicules (« 2 Renault Duster », « CFAO 2
Suzuki AA 270 JF-AA 320 JF ») est partagée par moitié.

**Le garde-fou** : une valeur déjà saisie à la main n'est jamais écrasée.

**Ce qui reste dehors :**

* 15 **composants et engins** — moteurs Hatz, boîtes, caisses frigorifiques,
  chariots, chargeurs : ce n'est pas le prix d'achat du véhicule qui les porte.
* 4 immobilisations dont **la plaque n'est pas dans la flotte** : le Prado du DG
  AA 866 YH (46,6 M F — toujours à créer, point 4 de la reprise), le Santa Fe
  DK 2517 BG, le Berlingo AA 018 EA, et le Berlingo « DK 3580 AK » qui est
  presque sûrement **DK 5830 AK** (Berlingo mis en circulation en 2006,
  immatriculé le 12/08/2011 ; l'immobilisation est du 08/09/2011) — à confirmer.
* 81 immobilisations **sans véhicule reconnu** : achats groupés (« 4 camions
  frigo Ventatrucks », « 2 têtes camions Tata »), véhicules sortis, ou
  candidats multiples — sept L200 de septembre 2021 pour cinq L200 au parc,
  trois L200 de 2023 pour cinq candidats. Le métier peut les trancher : une
  ligne de plus dans `RAPPROCHEMENTS`, et le script refait le fichier.

**Dans l'application (0057).** La fiche amortissait depuis la première mise en
circulation — juste pour un véhicule neuf, faux pour une occasion : le Hilux de
2019 acheté en mai 2026 aurait été amorti depuis 2023, quand la comptabilité lui
donne 21 M F de valeur nette. `vehicule` gagne `date_acquisition` et
`reference_immobilisation` ; `src/domaine/amortissement.ts` porte la règle
unique (la date d'acquisition d'abord, la mise en circulation à défaut), lue par
la fiche et par les rapports. Les deux champs se lisent sur la fiche (« Achat,
valeur et amortissement ») et se saisissent à la création et à la modification.

**La dotation de l'exercice** (162 M F de janvier à août) n'est pas chargée en
dépenses : elle se recalcule depuis la valeur, la date et la durée. Si le métier
veut que le « coût complet » la lise mois par mois, ce sont des dépenses du poste
`amortissement` à générer — décision à prendre.

## L'entretien et les fournitures

Le grand livre et les bons de commande racontent le même achat. Pour ne rien
compter deux fois :

| Écartées | Écritures | Montant |
| --- | ---: | ---: |
| Bon de commande déjà en base (`BC26010032` = `CMD2-26010032`) | 101 | 47,0 M F |
| Journaux de caisse (CAISP, CAISS) — la caisse parc est déjà chargée dépense par dépense | 26 | 2,0 M F |
| Avoirs et remboursements sur un exercice antérieur (SICAS sur décembre 2025, Bamba Taïf sur BC17320) | 7 | −10,0 M F |

Sur les 72 bons communs, les montants du grand livre et ceux de la base
s'accordent au franc près ou à 1 % près — les deux sources sont sur la même base.

**Retenues : 403 écritures, 115,8 M F.** 317 sont rattachées à un véhicule
(72,1 M F) ; 86 ne nomment aucun véhicule du parc (43,7 M F : huiles en fûts,
batteries et pneus de stock, maintenance mensuelle des camions d'Abdou Khadre
Diop, pièces « pour divers véhicules ») et restent des dépenses du parc au nom
de leur fournisseur.

| Poste | Écritures | Montant |
| --- | ---: | ---: |
| Maintenance curative | 205 | 71,5 M F |
| Pièces | 162 | 31,3 M F |
| Pneumatiques | 30 | 12,1 M F |
| Maintenance préventive | 6 | 0,9 M F |

Chaque écriture d'entretien (62421) rattachée à un véhicule a son intervention
jumelle (193), au même numéro — `INT-GL-…` / `DEP-GL-…` — pour que l'atelier les
lise ensemble. La référence porte le bon quand l'écriture le cite
(`CMD2-26020233 · ACH260200131`), et toujours la pièce comptable : la recherche
globale retrouve l'un comme l'autre. L'origine est `facture`.

Une écriture qui nomme plusieurs véhicules est rattachée au premier, et le dit —
la règle de `charger-maintenance`. Un avoir de l'exercice est déduit de sa
facture (551 000 F sur les batteries SICAS).

**Plaques redressées.** Le grand livre écrit « AA 4922 BB » pour DK 4922 BB : quand
les chiffres et la série ne désignent qu'un véhicule, le script redresse et le
dit (DK 6875 BF, DK 3033 BD, DK 6154 AS, AB 930 BV). Trois fautes relues à la
main : AA 106 EN → AA 106 NE, AA 09 VA → AA 093 VA, DK 9649 → DK 9649 BG.

## La cuve du siège

`mouvement_cuve` était vide. 30 livraisons EDK OIL y entrent : **244 000 litres,
155,0 M F**, à 630 F le litre jusqu'en juillet, 705 F en août. Les litres sont
lus dans le libellé (« 7000L GASOIL »).

À surveiller : le stock de la cuve se calcule depuis un stock initial de 9 000 L,
plus les livraisons, moins les pleins pris à la cuve. Les pleins chargés
s'arrêtent en juillet 2026 : le stock affiché sera trop haut tant que ceux
d'août ne sont pas là, ou qu'un relevé de jauge ne le recale.

## Les transporteurs : confrontés, non chargés

La feuille donne un **cumul par transporteur au 31 août 2026 — 786,8 M F sur 25
noms** —, sans date, sans pièce, sans voyage. La base porte 99,3 M F de
prestations sur la même période (46 lignes, tirées des bons de commande).

| Transporteur | Grand livre | Prestations en base |
| --- | ---: | ---: |
| ADEX Location | 187,6 M F | 2,5 M F |
| Abdou Kane | 167,5 M F | 38,1 M F |
| Abdou Dieng | 116,9 M F | 8,1 M F |
| Ets Kane Transport / Moussa Kane | 90,9 M F | 7,9 M F |
| Malick Diop / Mamadou Diop | 36,8 M F | — |
| Mohamed Dème | 29,7 M F | 3,0 M F |
| Dr Ibrahima Wade | 24,7 M F | 6,0 M F |

L'écart est celui que `CA-LOCATION-AOUT-2026.md` avait déjà vu : les quatre
transporteurs qui portent l'essentiel des tonnes ne passent pas par les bons de
commande chargés. **On ne fabrique pas de prestations datées à partir d'un
total.** Deux sorties possibles, à décider :

1. obtenir de la comptabilité le **détail du compte transport** (une ligne par
   facture, comme pour l'entretien) — il se chargera comme ici, bon par bon ;
2. à défaut, poser **une prestation de régularisation par transporteur** au
   31/08/2026, pour l'écart, marquée comme telle — le coût annuel devient juste,
   le coût mensuel reste faux.

## Ce que le banc vérifie

`PGLITE_DIR=… npx tsx scripts/tester-grand-livre.mts` — 16 contrôles, tous au
vert le 18 septembre 2026 : tout entre, le rejeu n'ajoute rien, chaque
intervention a sa jumelle au même montant, une valeur saisie à la main n'est pas
écrasée, aucune dépense nulle ou négative, une dépense sans véhicule cite
toujours quelqu'un, et l'amortissement part de la date d'acquisition.

## Suite du 21 septembre 2026

Les six fichiers ci-dessus sont joués : 89 véhicules valorisés, 403 dépenses en
base. Trois demandes du métier, le même jour.

**1. Les achats de véhicules sortent des achats** —
`supabase/correctif-achats-vehicules.sql`, à jouer. Trois demandes chargées
depuis les bons de commande étaient des investissements : les quinze L200 Triton
(299,1 M F), le tracteur FAW (40,7 M F) et la camionnette HOWO (21 M F, rangée à
tort en « pièces détachées » par l'extraction) — 360,8 M F qui gonflaient les
achats réglés. Rien d'autre ne les citait. Leurs montants sont sur les fiches :
le FAW, la HOWO et dix L200 depuis le grand livre ; les **cinq L200 du
1er septembre** (AB 010/060/062/066/112 KT), entrés après l'arrêté, reçoivent
les mêmes 19 940 000 F — le bon fait 299 100 000 F pour quinze. Le vendeur est
écrit sur les dix-sept fiches. `charger-demandes-achat.mts` saute désormais ces
bons **sans renuméroter** les autres demandes.

**2. « Renouvellement 2026 » ne liste que les véhicules neufs** : immatriculés,
et mis en circulation pour la première fois en 2026. Ni les véhicules que la
cascade libère et réattribue, ni les occasions achetées dans l'année (le Jeep de
2017, les Hilux de 2019), ni ceux qui attendent leur plaque. Le rapport gagne la
plaque, la date de mise en circulation, la valeur d'acquisition et le vendeur,
et ouvre la fiche.

**3. Un rapport « Immobilisations et amortissements »** (famille Coûts) refait,
depuis les fiches, le tableau de la comptabilité : référence, business unit,
véhicule, date d'acquisition, valeur, cumul au début, dotation, cumul à la fin,
fin d'amortissement, durée, taux, valeur nette — pour la période choisie. Pour
retrouver l'exercice comptable, prendre « Année en cours ». Les véhicules sans
prix y figurent, « à valoriser » : ce qui manque se voit.

C'est un **calcul au prorata des jours**, pas l'écriture comptable. Deux écarts
connus avec le tableau de la comptabilité : la dotation diffère d'environ 1 %
(995 893 F contre 985 743 F pour le Hilux AB 900 JW au 31 août) ; et en dernière
année, la comptabilité étale le reliquat jusqu'au 31 décembre, quand le calcul
s'arrête à la date anniversaire (le Berlingo de juillet 2021 est amorti le
6 juillet 2026 ici, le 31 décembre là-bas).

Banc : `npx tsx scripts/tester-immobilisations.mts` — 17 contrôles.

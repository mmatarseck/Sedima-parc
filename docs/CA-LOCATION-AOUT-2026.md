# Le CA provisoire des transporteurs, août 2026

*11 septembre 2026. Lu, vérifié et confronté au relevé. **Rien n'est chargé** :
plusieurs points demandent une décision du métier avant de verser un franc.*

Source : `61. Gestion Parc/BIRAHIME FALL/CA PROVISOIRE AOUT 2026 LOCATION.xlsx`.
Lecture : `npx tsx scripts/extraire-ca-location.mts`.

## Pourquoi ce fichier compte

Le coût du transport confié aux tiers ressortait à **606 F la tonne en
juillet**, alors que les tarifs vont de 2 500 à 3 500 F. La raison est simple :
les bons de commande chargés pour juin, juillet et août 2026 concernent Moussa
Kane, Dr Wade, Dame Ndoye, Mbagnick Gaye, K2SBT et des locations frigorifiques.
**Aucun ne concerne les quatre transporteurs qui portent l'essentiel des tonnes
du relevé** : A. Dieng, A. Kane, ADEX et Sokhna Diop. Leur coût est absent de
la base, alors que leurs tonnes y sont.

Ce classeur est la seule source qui donne ce coût, et il le date **au mois du
service**, non à l'émission d'un bon.

## Ce qu'il porte

| Feuille | Contenu | Hors taxe | TTC |
| --- | --- | ---: | ---: |
| AB DIENG | 43 voyages : date, camion, client, tare, brut, net pesé, tarif, montant | 7 541 170 | 8 898 581 |
| SOKHNA | 22 voyages, même détail, produit en plus | 3 960 000 | 4 672 800 |
| ADEX | 10 camions : jours facturés × prix du jour | 14 370 000 | 16 956 600 |
| CA PROVISOIRE AOUT 2026 | 17 montants par transporteur, sans détail pour 14 d'entre eux | — | 87 252 734 |

Le récapitulatif compte aussi A. Kane (19,5 M F), Moussa Kane (10,3 M F),
Massaran (6,2 M F), des transports de poulets, une location d'eau… Certaines de
ces lignes relèvent du transport de marchandises, d'autres du personnel ou d'un
autre service.

## Ce que la confrontation montre

**1. Les pesées et le relevé s'accordent sur les poids.** Quand un même camion
figure le même jour (ou à un jour près) dans les deux sources, le tonnage du
relevé et le poids net du pont bascule diffèrent de 0,13 t en moyenne, 0,26 t au
plus.

**2. Ils ne s'accordent pas sur qui a roulé quel jour.**

| | Facturés | Au relevé d'août | Retrouvés (±1 jour) | Facturés absents du relevé | Relevés sans facture |
| --- | ---: | ---: | ---: | ---: | ---: |
| A. Dieng | 43 | 34 | 22 | 21 | 12 |
| Sokhna Diop | 22 | 15 | 14 | 8 | 1 |

Chez A. Dieng, la moitié des voyages facturés ne se retrouvent pas au relevé
pour le même camion, et douze voyages relevés n'ont pas de ligne de facture.
L'une des deux sources inverse les camions, ou il manque des voyages de part et
d'autre.

**3. Quatre pesées en double chez A. Dieng.** Le camion AA 314 CT porte deux
lignes rigoureusement identiques (même tare, même poids brut, même client) les
8, 10, 18 et 20 août. Deux pesées à la tonne près, le même jour, sont une saisie
en double. Reprise telle quelle, la feuille ferait payer **662 460 F HT** de
trop.

**4. Sokhna Diop facture 40 t par voyage**, quel que soit le poids pesé (de
40,04 à 40,36 t). C'est un forfait à la tonne entière, cohérent sur les 22
voyages. Il reste à confirmer que c'est bien la règle convenue.

**5. Le récapitulatif ne reprend pas la feuille de Sokhna Diop** : 4 956 000 F
contre 4 672 800 F TTC, soit un écart de **283 200 F**. C'est exactement un
voyage à 240 000 F HT plus 18 % : il y a un voyage de trop au récapitulatif, ou
un voyage manquant au détail.

**6. Une taxe de 18 % s'applique partout.** Le module Transporteurs connaît la
retenue à la source de 5 %, pas la TVA. Si la TVA est récupérable, le coût du
transport pour le parc est le montant hors taxe.

**7. Les jours facturés par ADEX ne suivent pas le contrat modélisé.**
L'application compte les jours dus comme six jours sur sept du mois, moins les
jours de panne. ADEX facture 19, 17, 19, 22 et 23 jours selon le camion, et les
tracteurs à 130 000 F le jour ne comptent que 4 à 7 voyages au relevé d'août.
Une ligne « BENNE » (31 jours à 80 000 F) n'a pas de plaque. « AA 072 BP » est
inconnu du référentiel, et facturé 21 jours à 0 F.

## Ce que le métier a décidé (11 septembre 2026)

1. **La base du coût** : « ajuster l'app en rendant clair la TVA de 18 % ou le
   BRS de 5 %, ce qui nous permettra de voir les charges HT ou TTC ». Voir plus
   bas.
2. **Les quatre pesées en double** : chargées telles quelles. Chacune le dit dans
   son commentaire.
3. **Le périmètre** : le détail seulement, c'est-à-dire A. Dieng, Sokhna Diop et
   ADEX.
4. **Le statut** : livré, à facturer.

## Le régime fiscal, rendu clair (migration 0039)

Chaque transporteur porte désormais son **régime fiscal** sur son profil :

| Régime | Ce que la facture fait | Hors taxe | TTC | Le transporteur touche |
| --- | --- | --- | --- | --- |
| TVA 18 % | ajoute 18 % au hors-taxe | la charge du parc | HT + 18 % | le TTC |
| Retenue 5 % | pas de TVA ; SEDIMA retient 5 % | la facture | = HT | 95 % |
| À confirmer | lu comme une retenue, comme avant | | | |

Le régime n'est posé que là où une pièce le prouve :

- **TVA** pour A. Dieng, Sokhna Diop et ADEX, d'après ce CA provisoire ;
- **retenue** pour Dème, Mouhamed Sy, Dame Ndoye et Aïssata Gaye, d'après leurs
  factures et les demandes d'achat de septembre 2026 ;
- **à confirmer** pour les six autres, dont Dr Wade : sa demande d'achat retire
  18 % au lieu d'en ajouter, ce qui ne prouve rien.

Ce qui change à l'écran :

- **Fiche transporteur** : le régime, avec sa règle, dans l'identité ; les
  affrètements et les mises à disposition en coût **HT** et **TTC**.
- **Tableau de bord** : un choix **HT / TTC** à côté des filtres. Il porte sur
  les coûts des transporteurs : coût tiers, coût à la tonne des tiers, taux
  d'externalisation en coût. Les coûts du parc ne changent pas.
- **Le calcul** : sous TVA, le prix convenu s'entend hors taxe. Il ne subit plus
  la majoration de la retenue, qui aurait gonflé le coût de 5 %.

Au passage, **le motif d'affrètement devient facultatif**. Le CA provisoire ne
dit pas pourquoi le parc a confié la tonne, et un motif inventé fausserait le
rapport des affrètements subis.

## Ce qui est chargé

`supabase/ca-location-aout-2026.sql`, montants **hors taxe** :

| | Lignes | HT | TTC recalculé | Feuille TTC |
| --- | ---: | ---: | ---: | ---: |
| A. Dieng | 43 affrètements | 7 541 170 | 8 898 581 | 8 898 580,6 |
| Sokhna Diop | 22 affrètements | 3 960 000 | 4 672 800 | 4 672 800 |
| ADEX | 7 prestations au jour | 14 370 000 | 16 956 600 | 16 956 600 |

- **Un voyage est un affrètement** : le camion, le client livré, le poids net pesé
  en tonnage, le montant hors taxe en prix convenu, le statut « livré ». La
  pesée complète et le tarif sont dans le commentaire. Sokhna Diop y porte aussi
  « facturé sur 40 t forfaitaires ».
- **ADEX entre en prestation au jour**, et non en mise à disposition. Ses jours
  facturés ne suivent pas le contrat modélisé (six jours sur sept, panne
  déduite). Une mise à disposition les aurait recalculés, ou il aurait fallu
  inventer des jours de panne pour retomber sur la somme. Les trois lignes à
  zéro franc (AA 269 NW, la camionnette AA 658 JS, AA 072 BP) ne sont pas
  chargées.
- **Rien ne compte dans « Factures tiers à régler »** : il n'y a pas encore de
  facture.

**Effet sur le tableau de bord.** Le coût du transport tiers d'août passe à
33,1 M F HT, et le coût à la tonne des tiers à **5 767 F/t HT**, contre 1 259
avant. Il reste sous-estimé : A. Kane, qui porte le plus de tonnes au relevé,
n'a qu'une ligne au récapitulatif (19,5 M F TTC), sans détail, et n'est donc pas
chargé.

## À jouer en production

1. `supabase/migrations/0039_regime_fiscal.sql`
2. `supabase/ca-location-aout-2026.sql`, après 0039 et après
   `releve-parties/releve-01-camions.sql`, qui ajoute trois des camions cités.

Banc : `tester-regime-fiscal.mts`.

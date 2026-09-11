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

## Les décisions attendues

1. **La base du coût** : hors taxe ou TTC ?
2. **Les quatre pesées en double** : les écarter, ou les charger telles quelles
   en attendant la facture définitive ?
3. **Le périmètre** : le détail seul (A. Dieng, Sokhna Diop, ADEX), ou aussi les
   montants du récapitulatif pour les transporteurs sans détail ?
4. **Le statut** : un CA provisoire est un service rendu, non encore facturé.
   Faut-il le charger comme « livré », qui apparaîtra comme dû au compte du
   transporteur, ou attendre les factures définitives ?

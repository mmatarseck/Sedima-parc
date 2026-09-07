# Rapprochement du parc — dossier DO contre application

*7 septembre 2026. Question posée : le parc de l'application est-il au complet ?*

**Réponse courte : le parc léger est complet, le parc lourd ne l'est pas.**
L'application connaît 19 véhicules de transport là où les listes 2026 du
dossier en comptent une cinquantaine. Le parc léger (101 immatriculés et les
15 du lot 2) recouvre exactement ses trois sources ; mais dix pick-up du lot 2
ont été assurés le 19 août 2026 et portent donc déjà une plaque.

## Méthode

Toutes les plaques des classeurs ci-dessous ont été extraites (Excel en COM,
`dumper-excel.ps1`), normalisées (majuscules, sans espace ni tiret) et
comparées à celles de l'application : `FLOTTE` de `src/donnees/parc-demo.ts`
(19 lignes) et `vehiculesLegers()` de `src/donnees/parc-leger-demo.ts` (116
lignes, dont 15 sans plaque). Le dossier est
`OneDrive - SEDIMA S.A\Direction des Operations (DO) - Documents\6. Logistique & Distribution\`.

Listes lues, par ordre de fraîcheur :

| Classeur | Où | Ce qu'il dit |
| --- | --- | --- |
| `Copie de ATTESTATIONS SEDIMA SA 19082026.xlsx` | `61. Gestion Parc\MALICK\Admnistrative\ASSURANCE 2026` | 10 L200 neufs assurés le 19 août 2026 |
| `QR SEDIMA SA 2026.xlsx`, `QR SEDIMA ABATTOIRS.xlsx` | idem | attestations 2026 (113 + 20 plaques) |
| `FICHE RENOUVELLEMENT ASSURANCES 2026.xlsx` | `61. Gestion Parc\BOCAR\M.SECK` | flotte assurée 2026, SA (117) et Abattoirs (22) |
| `SITUATION PARC SEDIMA LOURDS.xlsx` | idem | **lourds** : opérationnels, en panne, en réparation, à réformer |
| `AFFECTATION LOURDS.xlsx` | idem | chauffeur et site par lourd |
| `Suivi Administratif Parc SEDIMA.xlsx` | `…\M.SECK\SITUATION PARC SEDIMA` | échéances visite, assurance, licence — lourds et légers |
| `PARC LEGERS AFFECTATION 2026.xlsx` | `…\M.SECK` | **légers** : parc, Almadies, motos, plan car |
| `Plan d'affectation des véhicules légers v2.xlsx` | `62. Transport & Flotte Automobile` | lot 1, lot 2, cascade, synthèse |
| `VEHICULE POULET FRAIS.xlsx`, `VEHICULE DE LOCATION.xlsx`, `VEHICULE HORS SEDIMA 2025.xlsx`, `Vente_véhicules_ SEDIMA 2025.xlsx`, `LES VEHICULES A ENLEVER OU CONSERVER LEURS BALISES.xlsx` | `…\M.SECK` | frigos, loués, hors SEDIMA, vendus, balises |
| `Etat des véhicules en panne.xlsx`, `Visite Technique.xlsx`, `Renouvellements licences.xlsx`, `FICHE RENOUVELEMENT … TAXE PUB 2026.xlsx` | `MALICK\Admnistrative` | pannes, visites, licences, taxe |
| `FICHIER PARC SEDIMA GROUP.xlsx`, `FICHIER COMPLET PARC SEDIMA GROUP.xlsx`, `FICHIER PARC 2024.xlsx`, `FICHE COMPLET VEHICULES PARC LIVRAISONS ET PERSONNELS.xlsx` | `MALICK` | inventaires 2023-2024, anciennes plaques DK |
| `BASE DE DONNEES PROFLEET.xlsx`, `DOTATION HEBDOMADAIRE.xlsx`, `FICHIER CODES PUCE CARBURANT.xlsx` | `MALICK\CARBURANT` | puces carburant |

Les listes 2023-2024 désignent la même flotte sous ses **anciennes plaques
DK** : le dossier note lui-même les changements (« NOUVELLE PLAQUE » sur
DK 9619 BB ; DK 6874 BF devenu AA-335-HK et DK 1067 AY devenu AA-977-MR dans
l'état des pannes). Elles ne s'ajoutent donc pas : **les cinq listes 2026
(situation, affectation, suivi administratif, assurance, attestations) sont
la référence, et elles s'accordent entre elles.**

## 1. Parc léger : complet, avec trois réserves

Les 101 plaques de l'application sont toutes dans `PARC LEGERS AFFECTATION
2026` (65 + 7 Almadies + 7 motos + 10 plan car), dans le suivi administratif
(60) et dans le plan d'affectation ; aucune plaque de ces trois sources ne
manque à l'application.

**Le lot 2 est livré pour dix véhicules.** Le plan d'affectation dit encore
« Lot 2 : à commander », mais l'assureur a émis le 19 août 2026, sur la police
4482823J, dix attestations pour des **Mitsubishi L200 pick-up** neufs :

AB 565 KP · AB 609 KP · AB 611 KP · AB 612 KP · AB 614 KP · AB 615 KP ·
AB 616 KP · AB 617 KP · AB 619 KP · AB 622 KP

Le lot 2 compte 14 L200 DC et un véhicule alternatif (C3 ou Sonet, Maimouna
Gaye, lot 2-05). Le dossier ne dit pas quelle plaque va à quelle ligne du lot :
**à arbitrer** avant de passer ces dix véhicules d'« à recevoir » à « en
service ». Les cinq autres restent à recevoir.

**Affectation des dix plaques, arbitrée le 7 septembre 2026.** Deux
décisions du métier ont fixé la proposition : Maimouna Gaye garde le L200 (pas
de véhicule alternatif), et les postes à recruter d'ici la fin de l'année ne
s'équipent pas encore — ni les recrutements du lot, ni le responsable
logistique qui devait reprendre le véhicule d'Amacodou Ndiaye. Les dix vont
donc aux lignes qui équipent quelqu'un aujourd'hui sans véhicule, qui en
libèrent un pour quelqu'un sans véhicule, ou qui remplacent un véhicule à
réformer ; les plaques suivent l'ordre des lignes du lot. C'est ce que
l'application porte (`parc-leger-demo.ts`, seed régénéré : 129 véhicules,
5 à recevoir).

| Plaque | Ligne | Bénéficiaire | Pourquoi maintenant |
| --- | --- | --- | --- |
| AB 565 KP | 2-01 | Aly Gaye, technicien intégration | Remplace DK 1307 BB (2016, 257 838 km, pannes récurrentes), à réformer |
| AB 609 KP | 2-02 | Bakary Sow, commercial farine Sud | Remplace AB 078 JS (2017, 322 134 km), à réformer |
| AB 611 KP | 2-03 | Bineta Djiba, commerciale Kaolack-Ziguinchor | Libère AA 022 EA pour Mourtalla Thiaw (SATV), sans véhicule |
| AB 612 KP | 2-04 | Yacine Siby, responsable dépôts | Sans véhicule aujourd'hui |
| AB 614 KP | 2-05 | Maimouna Gaye, responsable pôle farine et bétail | Remplace DK 5679 BL (2019, accident 2023, pannes répétitives), à réformer |
| AB 615 KP | 2-08 | Moustapha Mboup, commercial Diourbel-Linguère | Libère AA 023 EA pour Alla Faye (Touba), sans véhicule |
| AB 616 KP | 2-10 | Dr Babacar Soumaré, responsable pôle SATV | Libère AA 386 JG pour Mamadou Gueye (SATV), sans véhicule |
| AB 617 KP | 2-12 | Adama Wane, responsable couvoir | Libère le Berlingo AA 019 EA, à réparer d'ici fin septembre pour Khady Mbaye (labo) |
| AB 619 KP | 2-14 | Papa Samba Mbengue, maintenance fermes et couvoir | Nouvelle recrue, sans véhicule |
| AB 622 KP | 2-15 | Cheikhou Keïta, maintenance abattoir | Libère DK 1306 BB pour Ibrahima Faye (équipe mobile), sans véhicule |

Attendent la prochaine livraison (cinq lignes) : 2-06 Amacodou Ndiaye (sa
cascade servait un poste à recruter), 2-07 Amadou Yoro Ba et 2-09 Pape Bouba
Gaye (leurs véhicules actuels sont les plus récents du lot, 2022 et 2021, et
leur cascade renforce la distribution sans échéance), 2-11 et 2-13 (postes en
recrutement).

**Véhicules assurés et entretenus par SEDIMA mais absents de l'application.**
`VEHICULE HORS SEDIMA 2025` en liste cinq (colonne « assurance et entretien »),
et l'assurance 2026 en ajoute six. Ce sont des charges du parc même si l'usage
est extérieur ; à décider s'ils entrent, et sous quel régime :

| Plaque | Véhicule | Source |
| --- | --- | --- |
| DK 2517 BG | Hyundai Santa Fe / Tucson 2018, Almadies, en panne à l'atelier KM | hors SEDIMA 2025, assurance, visite technique |
| AA 339 EN | Mercedes Sprinter 2020 (van), Mme Ngom | hors SEDIMA 2025, assurance |
| AA 018 EA | Citroën Berlingo 2021 (Abattoirs) | hors SEDIMA 2025, assurance Abattoirs, taxe 2026 |
| AA 265 JC | Suzuki Vitara 2022, Mme Diack (plan car 2023 : Lena Sarr) | hors SEDIMA 2025, assurance |
| DK 9181 BD | Chrysler, Mouhamed Ngom — l'application l'a sous **DK 9181 BB** | hors SEDIMA 2025 |
| AB 820 EL | Autocar Force Motors 2025, 24 places | assurance SA, taxe 2026 (« BUS ») |
| AA 372 YJ | Suzuki moto 2025 | assurance SA |
| AA 013 AT | Suzuki moto 125, Mapenda Thiam (Abattoirs) | assurance Abattoirs |
| DK 8741 BG | Mercedes C450 (Président, Almadies) | assurance SA, parc 2023 |
| AA 972 AJ | Bentley 2019 (Président, Almadies) | assurance SA, visite technique |
| AB 648 BX | Ford, carte brune seule | attestations 2026 |

**Trois plaques diffèrent d'une lettre** entre l'application et l'assureur :
AB 930 BB (application) contre AB 930 BV (assurance et attestation 2026) ;
DK 9723 BD contre DK-9723-BG (assurance ; le parc 2023 dit BD) ; DK 9181 BB
contre DK 9181 BD. La carte grise tranche.

Deux autres points : DK 4942 AK (L200 2010, Sécurité) est sur la liste de
vente 2025 (1 500 000 F) — à sortir si la vente est faite ; et **DK 2347 BD
figure deux fois** dans l'application, dans la flotte de transport (« retrait
en cours ») et dans le parc léger (« à réformer ») — le plan d'affectation le
donne à Sidy Ndao, c'est un léger.

## 2. Parc lourd : 19 lignes pour une cinquantaine de véhicules

`SITUATION PARC SEDIMA LOURDS` compte **33 unités opérationnelles** (38
plaques, cinq attelages tracteur + semi), 5 en panne, 3 en réparation, 8 à
réformer. L'affectation, le suivi administratif et l'assurance disent la même
chose. L'application connaît 16 de ces unités.

### Opérationnels absents de l'application (17 unités, 21 plaques)

| Plaque | Véhicule | Année | Site | Chauffeur (affectation) |
| --- | --- | --- | --- | --- |
| AA 927 CA + AA 053 AP | Renault tracteur + citerne vrac Cubas Segres 27 t | 2012 + 2019 | UAB | Birago Wane / Abdou Ndiaye / Lybass Diop |
| AA 713 VE | Plateau nu Lecitrailer 35 t, semi de AA 737 ZW (l'application n'a que le tracteur) | 1990 | UAB | Boubacar Dieng / Thierno Dramé |
| AB 681 HE | Camion 10 t neuf (pas encore assuré) | 2026 | Minoterie | Omar Cissé |
| AA 291 PT | Tata 10 t ridelle | 2016 | Dépôt Touba | Demba Sy |
| AA 281 PT | Tata 10 t | 2019 | Dépôt Thiès | Gora Diop |
| AA 920 VA | Tata 5 t ridelle | 2016 | Couvoir Notto / Dépôt Touba | Abdou Lakhat Thiam |
| AA 605 TR | Tata 5 t | 2012 | UAB / Minoterie | Abdourahim Djité |
| AA 359 AH | Tata frigo 5 t | 2019 | Abattoirs | Samba Thioub |
| AA 186 CQ | Renault frigo 5 t, en réparation | 2010 | Abattoirs | Cheikh Ba |
| AA 783 BN | Tata frigo 5 t | 2021 | Dépôt Ziguinchor | Aly Touré |
| AA 226 SX | Tata 10 t fourgon (œufs) | 2016 | Karaouni 1 | Ndiaga Guèye |
| AA 433 AJ | Peugeot Boxer (œufs), moteur en cours de changement | 2020 | Karaouni 1 | — |
| AA 235 MR | Renault frigo 5 t, en réparation | 2017 | Karaouni 1 | Ousmane Diarra |
| AA 300 PT | Renault Aubineau, 40 000 poussins | 2010 | Couvoir Notto | Bakary Diatta / Gorgui Diop / Abdoulaye Dièye |
| AA 898 PZ | Tata 5 t fourgon (poussins, OAC) | 2018 | Couvoir Notto | Bougouma Diop |
| AA 277 PT | Tata 5 t ridelle (poussins, OAC) | 2016 | Ndiakhirate | Abdourahim Djité |
| AA 905 CW + AA 214 XK | Renault tracteur + plateau Trailor 35 t (abattage) | 2012 + 2017 | Abattoirs | Saliou Ngom |
| AA 350 JN + AA 909 CW | Renault Kerax tracteur + citerne à eau Coder (fermes) | 2013 + 2012 | Fermes | Fallou Ndiaye |
| DK 9839 BK | Mitsubishi L200 pick-up (opérationnel au suivi administratif) | 2018 | Siège | — |

S'y ajoute une **faute de plaque** : l'application écrit **DK 6875 DF** ; toutes
les listes (situation, affectation, assurance, attestation, puce carburant)
disent **DK 6875 BF** (L200 2017, Amadou Baldé / Cheikh Thiaw).

### Non opérationnels absents (16 plaques)

- **En panne** (Keur Massar sauf mention) : DK 6874 BF pick-up (réimmatriculé
  AA-335-HK), AA 761 JV citerne vrac, AA 769 JV citerne vrac (semi de
  AA 633 JL d'après les licences), AA 217 FF camion vrac 20 t (siège, « à
  transformer en 20 t »), DK 2507 BD frigo 10 t œufs MAN.
- **En réparation** (garage Gormack, Rufisque) : DK 4003 AG benne Renault,
  DK 7619 BG plateau nu, DL 5941 D plateau nu.
- **À réformer** : DK 7376 AC, DK 9361 BB, DK 3143 BC, DK 3142 BC, AA 318 AM,
  AA 654 AS (ex TH 6065 S) — les six sont sur `Vente_véhicules_ SEDIMA 2025` —
  plus DK 7620 BG (tracteur, garage Djily) et DK 9619 BB (tracteur, Gormack).
- **Assurés 2026 mais dans aucune situation** : AA 542 BQ + AA 507 BQ (Renault
  Premium 2020 + semi benne Schmitz, béton et sable, ferme Djilakh, licence à
  renouveler), AA 708 BB (Tata 10 t 2020, accidenté, ferraille), TH 4207 D
  (tracteur 2012), DK 4280 AS (semi-remorque, carte brune seule).

### Ce que l'application dit et que le dossier ne dit pas

- **AA 412 UB**, chariot élévateur Toyota à l'UAB : dans aucune liste. La base
  ProFleet a bien une puce « CHARIOT » (100 l/semaine) mais sans plaque. À
  confirmer ou retirer.
- Les **statuts et sites** des 16 lourds connus viennent du jeu de
  démonstration et contredisent la situation 2026, qui les dit tous
  opérationnels : AA 737 ZW et AA 180 CQ « hors service », AA 565 GA « en
  réparation » (site Pikine), AA 568 GA « en mutation » (siège), AB 932 EF et
  AB 551 HS « en restauration ». Les frigos AA 565 GA, AA 568 GA, AA 093 VA,
  AA 180 CQ sont aux Abattoirs.
- Les **camions loués** (41 plaques, `VEHICULE DE LOCATION`) ne sont pas des
  véhicules du parc ; ils relèvent des transporteurs. Aucun n'est dans la
  flotte, c'est correct.

## 3. Ce qu'il reste à décider, puis à faire

À l'équipe parc :

1. Quelle plaque du 19 août va à quelle ligne du lot 2 (dix sur quinze).
2. Les onze véhicules hors SEDIMA assurés par le parc : dedans ou dehors.
3. Les trois plaques à une lettre près (AB 930 BB/BV, DK 9723 BD/BG,
   DK 9181 BB/BD), le chariot AA 412 UB, la vente de DK 4942 AK.

Dans l'application, une fois arbitré : corriger DK 6875 DF, ajouter les 17
unités opérationnelles avec leurs attelages, chauffeurs et sites, ajouter les
16 non opérationnels sous leur statut, aligner les statuts des 16 connus,
retirer DK 2347 BD de la flotte de transport. Tout cela passe par
`parc-demo.ts`, puis `npm run generer-seed` et un rejeu de la partie 1 du seed
(la ligne DK 6875 DF déjà en base se supprime à la main : le seed ne réécrit
pas). Les chauffeurs de l'affectation qui manquent à la liste des chauffeurs
seront à ajouter en même temps.

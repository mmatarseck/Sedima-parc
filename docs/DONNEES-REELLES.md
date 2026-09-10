# Passer aux données réelles — état et chemin

*Ouvert le 10 septembre 2026, à la demande « mettre uniquement des données
réelles dans l'application et se débarrasser de la démonstration ».*

## Ce qu'il faut savoir d'abord : « démonstration » recouvre deux choses

C'est le point qui change tout le plan, et il n'est écrit nulle part ailleurs.

Les fichiers `src/donnees/*-demo.ts` ne sont pas tous du décor. Ils jouent
**deux rôles** que rien ne distingue aujourd'hui :

1. **Le référentiel réel, saisi en TypeScript.** `parc-demo.ts` (le parc de
   transport), `parc-leger-demo.ts` (116 véhicules légers), les sites, les
   prestataires, les plans d'entretien, le budget. C'est de la vraie donnée
   d'entreprise, recoupée avec le dossier DO le 7 septembre 2026
   (`RAPPROCHEMENT-PARC.md`). **Et c'est la source du seed** :
   `npm run generer-seed` la transforme en `supabase/seed-parties/*.sql`,
   qui est ce que la production a chargé. La supprimer viderait la base.
2. **Des transactions fabriquées.** Relevés kilométriques, pleins, dépenses,
   interventions, incidents, mouvements de caisse, relevés de transport : ils
   sont **tirés au sort** à la génération. Repérables aux tirages :

   | Fichier | Tirages aléatoires |
   | --- | --- |
   | `fiche-demo.ts` | 77 |
   | `chauffeurs-demo.ts` | 41 |
   | `releve-demo.ts` | 31 |
   | `caisse-demo.ts` | 30 |
   | `transporteurs-demo.ts` | 28 |
   | `maintenance-demo.ts` | 8 |
   | `pieces-demo.ts`, `tableau-bord-demo.ts`, `carburant-demo.ts`, `prestataires-demo.ts`, `situation-demo.ts` | 4 à 7 chacun |

   Le seed pèse **1,6 Mo en six parties** ; l'essentiel est cette matière
   inventée, déjà chargée en production.

**Donc** : « se débarrasser de la démonstration » veut dire *purger les
transactions fabriquées* et *garder puis compléter le référentiel*, pas
supprimer les fichiers. Un troisième rôle mérite aussi d'être préservé :
la démonstration sert de **témoin aux dix-sept bancs d'essai** et à la
photographie des 48 rapports — c'est elle qui a fait tomber trois défauts de
production les 9 et 10 septembre. La perdre, c'est perdre le filet.

## Ce qui est fait (10 septembre 2026)

**Une chaîne d'extraction et de consolidation**, reproductible :

- `scripts/extraire-classeurs.ps1` — sort chaque feuille d'un classeur Excel
  en JSON (Excel en COM, lecture seule).
- `scripts/consolider-parc.mts` — fusionne les cinq listes 2026 par plaque,
  **garde la provenance de chaque fait**, et signale les désaccords au lieu de
  choisir en silence.

Les listes lues, toutes du 3 septembre 2026 sauf mention, dans
`6. Logistique & Distribution\61. Gestion Parc\` :

| Classeur | Feuilles retenues |
| --- | --- |
| `BOCAR\M.SECK\SITUATION PARC SEDIMA LOURDS.xlsx` | opérationnels, pannes, réparations, à réformer |
| `BOCAR\M.SECK\AFFECTATION LOURDS.xlsx` | chauffeur, téléphone, site |
| `BOCAR\M.SECK\SITUATION PARC SEDIMA\Suivi Administratif Parc SEDIMA.xlsx` | échéances visite, assurance, licence (lourds et légers) |
| `BOCAR\M.SECK\PARC LEGERS AFFECTATION 2026.xlsx` | parc léger, Almadies, motos, plan car |
| `BOCAR\M.SECK\FICHE RENOUVELLEMENT ASSURANCES 2026.xlsx` | SA et Abattoirs |
| `MALICK\Admnistrative\ASSURANCE 2026\Copie de ATTESTATIONS SEDIMA SA 19082026.xlsx` | les dix L200 du lot 2 |

### Ce que la consolidation dit

**160 plaques distinctes** sur treize feuilles : 54 lourds, 89 légers, 16 vues
par la seule assurance.

**Huit désaccords entre sources.** Le plus net : **AA 433 AJ** (Peugeot Boxer
œufs) est à la fois dans « véhicules opérationnels » et dans « pannes » du
même classeur, et le suivi administratif le dit opérationnel ; son site est
Karaouni 1 pour l'un, Keur Massar pour l'autre. Les sept autres sont des
sites écrits différemment (« UAB/MINOTERIE » contre « UAB/MINOTERIE/POUSSIN/
OAC », « SITES » contre « FERMES ») — à normaliser, pas à arbitrer.

**Six paires de plaques à un caractère près sans source commune**, la
signature d'une faute de saisie. La consolidation a retrouvé seule les deux
que le rapprochement du 7 septembre avait relevées à la main, et en a ajouté
une :

| Paire | Statut |
| --- | --- |
| `AB 930 BB` (parc léger) ≈ `AB 930 BV` (assurance) | connu, carte grise à trancher |
| `DK 9723 BD` (suivi, parc léger) ≈ `DK 9723 BG` (assurance) | connu, carte grise à trancher |
| `AA 272 YJ` (motos) ≈ `AA 372 YJ` (assurance) | **nouveau** — une moto Suzuki 2025, deux plaques |
| `AA 761 JV` / `AA 768 JV` / `AA 769 JV` | trois citernes vrac distinctes, pas une faute |
| `DK 6874 BF` / `DK 6875 BF` | deux véhicules distincts, pas une faute |

**Trente-quatre plaques ne tiennent qu'à une source.** Elles ne sont pas
fausses pour autant — une moto n'est que dans la feuille des motos — mais
aucune ne devrait entrer en base sans être confirmée.

## Le parc lourd, complété (10 septembre 2026)

Les dix-sept unités opérationnelles qui manquaient sont entrées, avec leurs
attelages, leurs chauffeurs et leurs sites, depuis `SITUATION PARC SEDIMA
LOURDS` et `AFFECTATION LOURDS`. Au passage :

- **`DK 6875 DF` était une plaque fausse** — toutes les listes disent
  `DK 6875 BF`. Corrigée, et le véhicule repasse opérationnel à l'UAB.
- **`DK 2347 BD` a quitté la flotte de transport** : il y figurait en double,
  c'est un véhicule léger.
- **Les statuts des seize lourds déjà connus sont alignés** sur la situation
  2026, qui les dit tous opérationnels. Ce qui vivait ici — « hors service »,
  « en restauration », « en mutation » — venait du jeu de démonstration et
  contredisait le dossier. Les quatre frigos rejoignent les Abattoirs.
- **Trois noms de chauffeurs** suivent désormais l'affectation 2026 :
  Ablaye Diop sur AA 768 JV, Ass Guèye sur AA 633 JL, Bathie Kandji sur
  AA 285 PT.
- **Huit sites** sont nés de ces véhicules : Minoterie, Dépôt Touba, Dépôt
  Ziguinchor, Karaouni 1, Couvoir Notto, Ndiakhirate, Fermes, Garage Djily
  Dalifort.

Les véhicules ajoutés **ne portent ni kilométrage ni coût** : le dossier n'en
donne pas, et un compteur se relève — il ne se devine pas.

Le jeu de départ passe de 6 à **9 parties**, avec 151 véhicules, 36 chauffeurs
et 17 sites.

### Deux défauts que cet agrandissement a réveillés

Les deux faisaient **disparaître toutes les demandes du seed sans un mot**,
parce que tous les chargeurs du projet avalent leurs erreurs — commode pour
rejouer un seed sur une base déjà remplie, aveugle pour tout le reste.

1. **`generer-seed.mts` coupait ses parties à n'importe quelle ligne**, pas
   aux frontières d'instruction, malgré ce que son commentaire promettait. Un
   `insert` de plusieurs milliers de lignes s'est retrouvé partagé entre deux
   fichiers : la première moitié sans son point-virgule, la seconde sans son
   en-tête, les deux refusées. Le défaut dormait tant que le parc était petit.
2. **`demandes-demo.ts` composait une heure à la main** — `07:${10 + i * 3}`,
   qui a donné « 13:61 » dès qu'il y a eu assez de titulaires. Une date se
   calcule, elle ne se concatène pas.

**Le banc `scripts/tester-seed.mts`** est né de là : il charge le seed en
disant tout haut ce qui est refusé, vérifie que chaque partie est close sur
elle-même, que les tables du référentiel ne sont pas vides, qu'aucune plaque
n'est en double et qu'aucune n'est hors forme.

## Ce qui reste à décider (métier)

Ces points bloquent le chargement, ils ne se devinent pas :

1. **AA 433 AJ** : opérationnel ou en panne ? Le classeur se contredit.
2. Les **trois plaques à un caractère près** : la carte grise tranche.
3. Les **onze véhicules hors SEDIMA** assurés et entretenus par le parc
   (Almadies, Président, autocar AB 820 EL, motos) : dedans ou dehors, et sous
   quel régime — la liste est au §1 de `RAPPROCHEMENT-PARC.md`.
4. Le **chariot AA 412 UB**, dans l'application et dans aucune liste.
5. **DK 4942 AK**, sur la liste de vente 2025 : vendu ou non.

## Ce qui reste à faire (application), dans l'ordre

1. ~~**Compléter le référentiel**~~ — fait le 10 septembre 2026 : les 17
   unités opérationnelles, la plaque corrigée, les statuts alignés, le doublon
   retiré, puis **les 16 non opérationnelles** (5 en panne, 3 en réparation,
   8 à réformer). Les véhicules à réformer sortent du périmètre de
   disponibilité — ils quittent la flotte, les compter parmi les engagés
   fausserait le taux. Le parc de transport compte désormais **56 véhicules,
   47 engagés**, et le tableau de bord voit enfin ses 19 hors service.
2. **Purger les transactions fabriquées** de la base, en gardant le
   référentiel : une migration qui vide relevés, pleins, dépenses,
   interventions, incidents, mouvements de caisse et de cuve, relevés de
   transport, et remet les compteurs à leur dernière valeur connue.
3. **Charger le réel là où le dossier le porte** : échéances de visite,
   d'assurance et de licence (suivi administratif), pannes en cours, puces
   carburant (`BASE DE DONNEES PROFLEET`, `DOTATION HEBDOMADAIRE`).
4. **Séparer les deux rôles dans le code** : le référentiel quitte les
   fichiers `*-demo.ts` pour un dossier qui dit ce qu'il est ; les
   générateurs de transactions restent, réservés aux bancs, et ne sont plus
   jamais servis à un écran.

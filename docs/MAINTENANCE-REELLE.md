# La maintenance réelle du parc

*10 septembre 2026. Suite du carburant : la matière suivante.*

Le dossier DO porte un classeur d'extraction des bons de commande —
`62. Transport & Flotte Automobile / 61. Gestion Parc / Maintenance` — bâti sur
**694 factures PDF**, de novembre 2023 à septembre 2026. Il donne ce qui
manquait à l'application : des interventions datées, chiffrées et attribuées.

## Ce que le chargement porte

`supabase/maintenance-parties/` — trois fichiers : **259 interventions, 259
dépenses, 88 véhicules, 155 M F TTC**, du 16 novembre 2023 au 2 septembre 2026.

| Exercice | Bons | Montant TTC |
| --- | ---: | ---: |
| 2023 (deux mois) | 8 | 9 M F |
| 2024 | 63 | 26 M F |
| 2025 | 118 | 66 M F |
| 2026 (huit mois) | 70 | 54 M F |

| Type | Bons |
| --- | ---: |
| Curatif | 181 |
| Préventif | 78 |

Trente-huit **fournisseurs** entrent au référentiel des prestataires : garages,
magasins de pièces, pneumaticiens, dépanneurs. Le type vient de la catégorie de
dépense de leur premier bon. Une intervention sans garage vaut la moitié d'une
intervention.

## Deux écritures par bon, et c'est voulu

Le modèle de l'application veut qu'une intervention d'atelier et sa dépense
soient deux faits distincts : l'une décrit un travail, l'autre un décaissement.
Le jeu de départ le faisait déjà. Et surtout : **le coût d'un véhicule se
calcule sur les dépenses, jamais sur les interventions**. Charger l'un sans
l'autre laisserait soit l'atelier vide, soit le coût à zéro.

Les deux portent le même numéro de bon en référence, ce qui permet de les
apparier — le banc le vérifie sur les 259.

Le poste de dépense suit la catégorie du bon :

| Catégorie du classeur | Type | Poste |
| --- | --- | --- |
| Entretien, Vidange & lubrifiants | préventif | maintenance-preventive |
| Réparation, Carrosserie, Main d'œuvre, Remorquage | curatif | maintenance-curative |
| Pièces détachées, Batterie, Outillage | curatif | pieces |
| Pneumatiques | curatif | pneumatiques |

La vidange est le seul geste que l'on classe préventif sans qu'il porte le mot
« entretien » : on y va parce que le compteur le dit, pas parce que quelque
chose est cassé.

## Ce qui n'est pas chargé, et pourquoi

Sur 694 bons, 435 restent dehors :

| Motif | Bons |
| --- | ---: |
| Famille « Location & transport » | 229 |
| Aucune immatriculation lisible | 100 |
| Doublon, ou exclu des totaux par l'extraction | 60 |
| Famille « Administratif & divers » | 23 |
| Immatriculation hors du parc de l'application | 18 |
| Montant absent ou nul | 3 |
| Famille « Acquisition de véhicules » | 2 |

Les 229 bons de **location et transport** ne sont pas de la maintenance de
parc : ce sont des affrètements et des locations, qui relèvent du module
Transporteurs. Ils attendent leur propre chargement.

Les 100 bons **sans immatriculation** couvrent la flotte entière ou plusieurs
véhicules sans en désigner un principal. Les rattacher à un véhicule choisi au
hasard fausserait son coût ; les laisser dehors laisse un trou qu'on connaît.
C'est le moindre mal, et il se dit.

Un bon couvrant plusieurs véhicules avec une plaque principale **est** chargé,
sur cette plaque, comme le classeur le fait lui-même. Sa référence porte alors
la mention « bon couvrant plusieurs véhicules », pour qu'on sache que le
montant n'est pas entièrement le sien.

## Un piège attrapé par le banc

Le rapprochement des fournisseurs se faisait sur deux règles différentes : une
clé normalisée pour décider s'il fallait créer le prestataire, et une égalité
exacte pour le retrouver. Le classeur écrit « TATA PIKINE » là où le
référentiel porte « TATA Pikine » : le prestataire n'était pas créé, et
l'intervention sortait sans garage.

**Une clé de rapprochement doit être la même des deux côtés.** Elle l'est
maintenant, en SQL comme en TypeScript, et le banc exige que zéro intervention
soit sans garage.

## Ce qui reste

1. **Jouer les trois fichiers dans l'ordre** : les prestataires d'abord, les
   interventions et les dépenses les citent.
2. Les **229 bons de location et transport** : ils alimenteraient
   `affretement` et `mise_a_disposition`, aujourd'hui vides après la purge.
3. Le dossier **BIRAHIME FALL** (`61. Gestion Parc`) porte 280 factures PDF et
   un classeur de chiffre d'affaires provisoire d'août 2026. Les PDF sont la
   matière brute d'une extraction qui reste à faire ; le classeur mêle des
   mises à disposition propres (onglet ADEX, dix véhicules) et des relevés de
   transport à la mise en page irrégulière. À trancher : ce qui mérite une
   extraction, et ce qui se saisira dans l'application.
4. Les **relevés kilométriques** restent la matière absente. Sans compteur, le
   parc a des litres, des francs et des interventions, mais ni consommation aux
   100 km ni coût au kilomètre.

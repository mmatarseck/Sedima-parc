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

---

## Le défaut du lecteur, et ce qu'il a coûté (10 septembre 2026)

`lire-xlsx.mts` lisait les attributs d'une cellule avec un motif **gourmand** :
`<c([^>]*)(?:\/>|>…<\/c>)`. Sur une cellule vide auto-fermée —
`<c r="AH2" s="6"/>` — le moteur avalait la barre oblique dans les attributs,
prenait la branche `>` et courait jusqu'au premier `</c>` venu. Quatre cellules
vides à la suite étaient absorbées d'un coup, et la valeur de la cinquième
atterrissait dans la colonne de la première.

**Les colonnes se décalaient en silence**, d'autant de rangs qu'il y avait de
vides consécutifs. Rien ne plantait ; les valeurs arrivaient juste ailleurs.

Ce que ça a coûté, précisément :

| Chargement | Lignes fausses | Lignes manquantes | Sur |
| --- | ---: | ---: | ---: |
| Carburant | 8 | 8 | 5 871 |
| Interventions | 3 | 42 | 298 |
| Dépenses de maintenance | 3 | 42 | 298 |

Les suivis hebdomadaires de carburant ont cinq colonnes et peu de vides : le
décalage n'y mordait presque pas. Le classeur des bons en a quarante dont
beaucoup de vides : le décalage y faisait rater l'immatriculation ou le
montant, et le bon était alors **écarté** au lieu d'être chargé de travers.
D'où des lignes manquantes plutôt que des lignes fausses — le moins mauvais des
deux, sans que ce soit une consolation.

`supabase/correctif-chargements.sql` n'est pas un rechargement : c'est la
**différence** entre ce qui est chargé et ce qui aurait dû l'être — 106 lignes.
Rejouer 1,1 Mo pour quinze lignes de carburant serait disproportionné, et
surtout risqué : un rechargement complet demande d'effacer d'abord, donc de
toucher à des lignes justes.

Le correctif a été éprouvé sur l'état exact de la production : une base montée
avec les migrations, le seed, la purge et **les anciens fichiers**, puis le
correctif, puis comparaison avec un rechargement propre des fichiers corrigés.
Les deux états coïncident au litre et au franc.

**Un second piège, attrapé par cette vérification.** La différence se calculait
sur la clé naturelle d'une ligne — véhicule, jour, litres. Or deux pleins
peuvent partager cette clé sans être la même ligne : un camion qui fait deux
fois cent litres le même jour, cela arrive et c'est vrai. Un simple index en
écrasait une, et le correctif rendait une ligne de moins que la cible. Les
répétitions sont maintenant numérotées.

---

## Les compteurs, trouvés dans le texte des bons (10 septembre 2026)

Le parc avait des litres, des francs et des interventions, mais pas de
kilométrage — donc ni consommation aux 100 km ni coût au kilomètre, deux des
chiffres que le métier regarde en premier.

Il se cachait dans le **texte** des bons : « ENTRETIEN AUX 16000KM DU VEHICULE
AA025HD », « ENTRETIEN DU VÉHICULE AA 032 EA A 175000 km ». Cent quinze bons
sur six cent quatre-vingt-quatorze en citent un.

`supabase/kilometrages.sql` en verse **105, sur 30 véhicules, du 12 janvier
2024 au 25 août 2026**, de 3 000 à 332 000 km. Ce n'est pas un relevé
quotidien, mais c'est un point daté, exact, et attesté par une facture.
`origine_releve` prévoit déjà « garage » pour ce cas : un compteur lu à
l'atelier, ni saisi par un chauffeur ni remonté par une balise.

Le kilométrage entre à deux endroits : dans `releve_kilometrique`, parce que
c'est un fait daté du véhicule, et dans la colonne `km` de l'intervention
correspondante, restée nulle au premier chargement. Le même fait à deux
endroits qui le regardent différemment — l'histoire du compteur d'un côté, le
kilométrage auquel ce travail a été fait de l'autre.

**Un compteur qui recule est écarté, et nommé.** Sur AA 554 JD, deux bons
disent 78 000 km en janvier 2026 puis 69 000 km en mai. Un des deux est faux —
coquille de saisie, ou moteur remplacé — et on ne sait pas lequel. Charger les
deux abîmerait tout calcul de distance ; garder le plus grand serait choisir
sans raison. Les deux restent dehors, avec leur motif écrit dans le fichier.

Les 599 pleins qui portent un compteur ne sont **pas** recopiés ici : ils sont
déjà en base dans `plein.km`, et l'application les lit comme des relevés — la
situation journalière comme la fiche cherchent le compteur des deux côtés. Le
même fait à deux endroits finirait par diverger.

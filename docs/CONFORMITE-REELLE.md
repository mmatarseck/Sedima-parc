# La conformité réelle : visites techniques et licences

*10 septembre 2026.*

Après la purge, la Conformité ne tenait que les attestations d'assurance.
L'écran des échéances était presque vide, et la pastille « Échéances » ne
comptait que ce qui restait. Le dossier DO tient pourtant deux fiches de suivi
à jour, dans `61. Gestion Parc / MALICK / FICHE SUIVI 2026`.

## Ce que le chargement porte

`supabase/conformite.sql` :

| Pièce | Chargées | Échues au 10/09/2026 |
| --- | ---: | ---: |
| Visites techniques | 113 | 29 |
| Licences de transport | 31 | 2 |

Treize visites et trois licences portent une plaque absente du parc ; elles
restent dehors.

## La question ouverte, tranchée

Le rapprochement du 7 septembre avait laissé une question au métier : **« 85
visites échues sur 98 : crise réelle, ou colonne en retard ? »** Elle venait de
la colonne « visite technique » du *suivi administratif*.

La réponse est : **colonne en retard.** La fiche de suivi 2026, tenue à part,
dit 29 échues sur 113 — un quart, et non neuf dixièmes. Le suivi administratif
n'était pas repris après chaque passage ; la fiche 2026 l'est. C'est elle qui
est chargée.

29 échues reste un vrai sujet, mais c'est un sujet de gestion courante, pas une
flotte entière hors la loi.

## Une colonne qui ment sur son contenu

La fiche des visites titre sa colonne **« DATE VISITE TECHNIQUES »**. Le
premier jet l'a crue, a pris ces dates pour des passages, et calculé les
échéances à douze mois. Les documents sortaient alors avec des passages
jusqu'en 2027, et sept échues seulement.

Le compte l'a démenti : **94 des 127 dates sont dans le futur**, jusqu'au
19 août 2027. Une visite technique ne se passe pas l'an prochain. Ce que la
fiche suit, c'est la date à laquelle il faudra y retourner — l'échéance.

La lecture est donc retournée : la colonne donne l'échéance, et la date d'effet
se calcule en remontant de douze mois. Le nombre d'échues passe de 7 à 29.
L'écart n'est pas un détail : c'est la différence entre un parc qui paraît en
règle et un parc qui a vingt-neuf visites à rattraper.

**Quand une donnée contredit son en-tête, ce sont les dates qui gagnent.** Le
banc vérifie désormais qu'aucun passage n'est daté dans le futur — le contrôle
qui aurait attrapé l'erreur au premier passage.

## Calculer une date n'est pas l'inventer

Les visites ne donnent qu'une date ; la date d'effet est calculée. Ce n'est pas
fabriquer une donnée : `type_document` range la visite technique avec
`validite_mois = 12`. Poser l'effet à douze mois de l'échéance, c'est appliquer
la règle que le référentiel énonce lui-même. Chaque document le dit dans son
émetteur.

Les licences n'ont besoin d'aucune règle quand la fiche donne les deux dates.
Quand la délivrance manque, on remonte de vingt-quatre mois depuis
l'expiration — la validité que le référentiel donne à une licence — parce que
la table exige une date d'effet antérieure à l'échéance.

## Pourquoi des documents, et non des visites

La table `visite_technique` décrit un **rendez-vous** : centre agréé, heure,
résultat, délai de contre-visite. Elle exige un centre que la fiche ne nomme
pas — sa colonne « EMPLACEMENT » dit où stationne le véhicule, pas où il a été
contrôlé. Ce qu'on a est une pièce et sa validité : c'est un `document`, et
c'est ce que la Conformité lit pour ses échéances.

Les licences vont dans `licence_transport` avec un périmètre « partie » et une
ligne de `licence_vehicule` : chaque véhicule porte sa propre licence, et la
fiche donne bien des dates par véhicule.

Un véhicule qui figure deux fois ne garde que sa pièce la plus récente. Deux
visites valides pour un même camion se contrediraient.

# Le carburant réel de 2025 et 2026 — ce que le dossier porte

*10 septembre 2026. Demande du métier : « une fois les données réelles
consolidées, mettre à jour la base avec les données de 2025 et 2026 ».*

Le référentiel est chargé depuis ce matin : 167 véhicules, 36 chauffeurs, 17
sites. Il lui manque une histoire. Le **carburant** est la seule matière du
dossier DO qui soit à la fois datée, volumineuse et tenue régulièrement.

## Ce qu'il y a, et ce que ça vaut

Deux séries, de deux granularités différentes, qu'il ne faut surtout pas
confondre.

| Série | Ce qu'une ligne est | Couverture | Volume |
| --- | --- | --- | --- |
| `SUIVI CONSOMMATION HEBDOMADAIRE` | **un plein**, daté au jour | mars 2022 → avril 2025 | 11 545 pleins, 1 279 901 L |
| `FICHIER DETAILLE` | un **cumul mensuel** par véhicule | juillet 2025 → juillet 2026 | 543 lignes, 342 370 L |

Sur la fenêtre demandée :

- **Pleins 2025** : 851 lignes de janvier à avril, 99 861 L, 55 véhicules.
- **Cumuls** : treize mois pleins, de juillet 2025 à juillet 2026, sans trou.
- **Mai et juin 2025 manquent** des deux côtés.

Un cumul mensuel n'est pas un plein. Le poser comme tel inventerait une date,
une heure et un geste qui n'ont pas eu lieu. Les deux séries sont donc rendues
séparées, et se chargeront différemment.

## Trois faits qui changent le chargement

**1. Le dossier ne dit nulle part le prix du litre.** Le carburant se tire sur
puce à la pompe, la quantité est suivie, la facturation vit ailleurs. Aucun des
classeurs — ni les hebdomadaires, ni les mensuels, ni la base ProFleet, ni la
dotation, ni les codes puce — ne porte un prix ou un montant.

Or `plein` exige `prix_litre > 0` et un `montant`. **Cette contrainte encode
une hypothèse que la donnée réelle contredit** : « tout plein a un prix connu ».
C'est la contrainte qui doit céder, pas la donnée — et surtout pas en
inventant un prix moyen, qui ferait passer une estimation pour un relevé.

**Décision attendue** : une migration rend `prix_litre` et `montant` nullables,
avec une contrainte qui exige les deux ensemble ou aucun des deux. Un plein
sans prix se lit « 152 L · prix non relevé » ; le coût du carburant se calcule
alors sur les seuls pleins qui en ont un, et l'écran le dit.

**2. Les suivis couvrent tout le groupe, pas seulement le parc.** Dix-huit
plaques sur cinquante-cinq (pleins 2025-2026) et dix-huit sur soixante-treize
(cumuls) ne sont pas dans la flotte de l'application. La base ProFleet le
confirme : elle range les puces par filiale — SEDIMA, ABATTOIRS, ADEX, KFC — et
les séries `AA 5xx EC` comme les `BT …` sont des véhicules d'ADEX et des engins
de chantier.

Ces lignes ne seront pas chargées, et ce n'est pas une perte : elles décrivent
un parc que cette application ne tient pas. Le dire évite qu'on cherche plus
tard pourquoi les litres du dossier et ceux de l'application ne s'accordent pas.

**3. Les pleins ne portent presque jamais le kilométrage.** Sur les 851 pleins
de 2025, **aucun** n'a de compteur. La colonne « KLMS » existe dans les
classeurs mais reste vide. La consommation aux 100 km ne se déduira donc pas de
ces pleins seuls ; il y faudra des relevés, qui sont une autre matière.

## L'outillage, et pourquoi il ne passe plus par Excel

`scripts/extraire-classeurs.ps1` pilotait Excel en COM. Le 10 septembre 2026,
COM a rendu « Unable to get the Open property of the Workbooks class » et
l'extraction s'est arrêtée là. Or un `.xlsx` est une archive ZIP de fichiers
XML, et Node sait tout ce qu'il faut.

`scripts/lire-xlsx.mts` lit un classeur sans Excel : chaînes partagées, styles
pour reconnaître les dates, une feuille rendue en tableau de lignes. Trois cents
lignes remplacent la dépendance, et la lecture devient **de nature** en lecture
seule — on ne peut pas abîmer un classeur qu'on se contente de dézipper.

`scripts/extraire-carburant.mts` s'en sert pour parcourir les cinq années du
dossier carburant et rendre les deux séries, plus la liste de ce qu'il a écarté
et pourquoi. Sur 11 957 lignes lues, 412 sont écartées : 250 feuilles sans date
en tête (des récapitulatifs, et des classeurs de 2022 dont la date n'est que
dans le nom du fichier), 152 lignes dont la plaque n'en est pas une, 10 sans
quantité.

## Ce qui reste à faire, dans l'ordre

1. **Trancher le prix** : migration qui rend le prix facultatif, ou décision de
   ne charger que les litres sans passer par `plein`.
2. Charger les **851 pleins de 2025** dont la plaque est au parc.
3. Décider du sort des **treize mois de cumuls** : une ligne mensuelle par
   véhicule, dûment marquée comme un cumul, ou hors de `plein`.
4. Les **trois années antérieures** (2022 à 2024, 10 694 pleins) attendent la
   même décision ; elles donneraient au tableau de bord un historique que
   l'application n'a jamais eu.

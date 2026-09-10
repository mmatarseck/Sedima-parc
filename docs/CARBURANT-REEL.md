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

**1. Le prix du litre est connu, mais pas dans ces classeurs.** Le carburant
se tire sur puce à la pompe, la quantité est suivie, la facturation vit
ailleurs : aucun des classeurs ne porte un prix.

Le métier a donné la clé le 10 septembre 2026 : au Sénégal les prix des
produits pétroliers ne sont pas de marché, ils sont **fixés par arrêté** et
valent plafond pour toutes les stations. Ils n'ont bougé que deux fois en deux
ans :

| Période | Gasoil | Supercarburant |
| --- | ---: | ---: |
| jusqu'au 5 décembre 2025 | 755 F | 990 F |
| 6 décembre 2025 → 14 août 2026 | 680 F | 920 F |
| depuis le 15 août 2026 | 755 F | 990 F |

La grille vit dans `src/domaine/carburant-tarifs.ts`, avec ses dates d'effet et
l'origine de chaque chiffre. Un prix officiel à une date n'est pas une
estimation : c'est la donnée, au même titre que les litres.

Ce qu'on dit quand même : le tarif est le **plafond réglementaire**, pas le
montant d'une facture. Chaque ligne chargée porte donc sa référence — « Tarif
officiel du 06/12/2025 » — pour qu'on ne prenne jamais un montant calculé pour
un montant relevé. Avant 2025 la grille s'arrête et `prixOfficiel()` rend
`null` : les pleins de 2022 à 2024 ne se chargent pas tant que la table ne
remonte pas jusqu'à eux.

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

## Le chargement, prêt

`scripts/charger-carburant.mts` fabrique `supabase/carburant-2025-2026.sql` :
**1 029 lignes, 310 212 litres, 59 véhicules, du 1er janvier 2025 au 31 juillet
2026.**

| Nature | Lignes | Ce que porte la ligne |
| --- | ---: | --- |
| Pompe — suivi hebdomadaire | 614 | un plein daté au jour, `plein_complet` vrai |
| Cumul mensuel — suivi carburant | 415 | le mois d'un véhicule, daté du dernier jour, `plein_complet` **faux** |

Les cumuls entrent, mais marqués. La colonne `plein_complet` existe pour dire
ce dont on ne peut pas tirer une consommation entre deux pleins ; un cumul de
mois en est l'exemple même. Sans elle, il aurait fallu choisir entre laisser
treize mois de consommation réelle dehors et les faire passer pour des pleins.

Écartées : 6 464 lignes dont la plaque n'est pas au parc (101 plaques du
groupe), et 4 595 lignes antérieures à 2025, hors des périodes tarifaires
établies.

`scripts/tester-carburant-reel.mts` charge le fichier dans une base montée avec
les migrations, le seed et la purge — l'état exact de la production — et vérifie
treize points : chaque ligne trouve son véhicule, les deux natures restent
distinctes, les cumuls tombent en fin de mois, chaque prix est celui du tarif
officiel de sa date, la baisse du 6 décembre est appliquée sur toute sa période,
le montant est le produit exact, et un second passage n'ajoute rien.

**Un piège attrapé par ce banc**, qui vaut d'être noté : `34,30 × 755` vaut
25 896,499999999996 en virgule flottante et 25 896,50 en numérique exact.
JavaScript arrondissait à 25 896 là où Postgres attend 25 897. Le générateur ne
calcule donc plus le montant : il écrit `round(34.30 * 755)` et laisse la base
faire sa propre arithmétique décimale.

## Ce qui reste

1. **Jouer le fichier** dans le SQL Editor, après le seed, l'alignement, la
   purge et la plaque.
2. **Mai et juin 2025** manquent au dossier : ni suivi hebdomadaire, ni fichier
   détaillé. À chercher, ou à acter comme un trou.
3. Les **trois années antérieures** — 2022 à 2024, 10 694 pleins — attendent
   que la grille tarifaire remonte jusqu'à elles. Elles donneraient au tableau
   de bord un historique que l'application n'a jamais eu.
4. Les **relevés kilométriques** restent la matière manquante : sans compteur,
   pas de consommation aux 100 km ni de coût au kilomètre.

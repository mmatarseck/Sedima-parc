# Le carburant réel, de 2022 à 2026

*10 septembre 2026. Demande du métier : « une fois les données réelles
consolidées, mettre à jour la base avec les données de 2025 et 2026 ».*

Le référentiel est chargé — 167 véhicules, 36 chauffeurs, 17 sites — mais sans
histoire. Le **carburant** est la seule matière du dossier DO qui soit à la
fois datée, volumineuse et tenue régulièrement. Il y en avait plus que prévu :
en cherchant 2025 et 2026, on a trouvé **quatre ans et demi**.

## Ce que le chargement porte

`supabase/carburant-parties/` — **cinq fichiers**, 5 871 lignes, 840 284
litres, 66 véhicules, du 28 février 2022 au 31 juillet 2026.

Pourquoi cinq fichiers et non un. Le SQL Editor de Supabase refuse une requête
d'un mégaoctet : « Query is too large to be run via the SQL Editor ». Les
parties font environ 250 ko, la taille qu'ont les douze parties du jeu de
départ et qui passe. **Chaque partie est un `insert` complet** : elle se joue
seule, dans l'ordre ou non, et se rejoue sans rien ajouter — ce qui compte
quand on colle cinq fichiers à la main dans un navigateur.

| Nature | Lignes | Ce qu'une ligne est |
| --- | ---: | --- |
| Pompe — suivi hebdomadaire | 5 456 | un plein daté au jour, `plein_complet` vrai |
| Cumul mensuel — suivi carburant | 415 | le mois d'un véhicule, daté du dernier jour, `plein_complet` **faux** |

Les deux séries viennent de deux familles de classeurs, et il ne faut surtout
pas les confondre. Les **suivis hebdomadaires** tiennent un plein par ligne :
chauffeur, véhicule, quantité, heure, parfois kilomètres — de février 2022 à
avril 2025. Les **fichiers détaillés** ne tiennent qu'un cumul par véhicule et
par mois, de juillet 2025 à juillet 2026.

Un cumul mensuel n'est pas un plein. Le charger comme tel inventerait une date,
une heure et un geste qui n'ont pas eu lieu. Il entre donc **marqué** :
`plein_complet` à faux, ce qui est exactement ce que cette colonne veut dire —
« ne tirez pas de consommation de cette ligne ». Sans ce marqueur il aurait
fallu choisir entre laisser treize mois de consommation réelle dehors et les
faire passer pour des pleins.

**Mai et juin 2025 manquent** au dossier, des deux côtés : ni suivi
hebdomadaire, ni fichier détaillé.

## Le prix, qui bloquait tout

Les suivis ne portent **aucun prix** : le carburant se tire sur puce à la
pompe, la quantité est relevée, la facturation vit ailleurs. Aucun classeur du
dossier — ni les hebdomadaires, ni les mensuels, ni la base ProFleet, ni la
dotation, ni les codes puce — ne porte un montant. Or `plein` exige
`prix_litre > 0`.

Le métier a donné la clé : au Sénégal les prix des produits pétroliers ne sont
pas de marché, ils sont **fixés par arrêté** et valent plafond pour toutes les
stations. Ils bougent rarement, et tiennent des années entre deux arrêtés.

| Période | Gasoil | Supercarburant |
| --- | ---: | ---: |
| 2022 → 6 janvier 2023 | 655 F | non établi |
| 7 janvier 2023 → 5 décembre 2025 | 755 F | 990 F |
| 6 décembre 2025 → 14 août 2026 | 680 F | 920 F |
| depuis le 15 août 2026 | 755 F | 990 F |

En 2022 l'État a tout absorbé : le gasoil aurait dû coûter 1 019 F au coût de
revient, il est resté à 655 F toute l'année, pour 583,5 milliards de
subvention. Le supercarburant a changé en juin 2022, mais **la date exacte
n'est pas établie** — d'où un tarif nul pour lui sur cette période. Le parc
étant au gasoil à 165 véhicules sur 167, la lacune ne coûte presque rien.

La grille vit dans `src/domaine/carburant-tarifs.ts`, chaque ligne avec sa date
d'effet et l'origine de son chiffre. **Un prix officiel à une date n'est pas
une estimation : c'est la donnée**, au même titre que les litres.

Ce qu'on dit quand même : le tarif est le **plafond réglementaire**, pas le
montant d'une facture — une remise négociée ou une livraison en gros s'en
écartent. Chaque ligne chargée porte donc sa référence, « Tarif officiel du
07/01/2023 », pour qu'on ne prenne jamais un montant calculé pour un montant
relevé. Hors des périodes établies, `prixOfficiel()` rend `null` et la ligne ne
se charge pas.

## Ce que l'audit interne dit de ces données (11 septembre 2026)

L'audit de la gestion du parc (rapport provisoire, voir
`docs/AUDIT-PARC-2026.md`) n'a pas pu fiabiliser la consommation. Trois raisons
touchent directement ce chargement :

- **Le registre de la pompe n'est pas exhaustif.** Selon l'agent chargé de la
  distribution, les prises de nuit et de week-end manquent. Les litres chargés
  sont donc un minimum, pas un total.
- **PROFLEET est hors service depuis plusieurs mois**, à cause d'un câble. Son
  rapport de distribution, qui aurait servi de contrôle, ne peut pas être
  extrait.
- **Géoris et la pompe ne disent pas la même quantité.** Sur douze prises de
  février 2026 comparées par l'audit, les écarts vont de −189,7 l (AA 768 JV,
  200 l à la pompe contre 389,7 l sur Géoris) à +99,3 l (AA 633 JL). Les
  véhicules ADEX, qui se servent à la pompe SEDIMA, ne sont pas suivis sur
  Géoris.

Une consommation aux 100 km tirée de ces pleins reste un ordre de grandeur.

## Ce qui n'est pas chargé

**7 261 lignes portent une plaque absente du parc** — 105 plaques. Ce n'est
pas une anomalie : les suivis couvrent tout le groupe, et la base ProFleet le
confirme en rangeant les puces par filiale, SEDIMA, ABATTOIRS, ADEX, KFC. Les
séries `AA 5xx EC` sont des véhicules d'ADEX, les `BT …` des engins de
chantier. Le dire évite qu'on cherche plus tard pourquoi les litres du dossier
et ceux de l'application ne s'accordent pas.

**185 feuilles restent sans date.** L'essentiel sont des récapitulatifs, qui
n'ont rien à faire dans des transactions. Les autres portent une date que le
nom du fichier écrit faux — « SEM DU 28-04 AU 31-04-2025 » annonce un 31 avril,
« SEM DU 24-02 AU 02-02-2025 » finit avant de commencer. Le repli qui déduit la
date du nom du fichier est **gardé** : il n'accepte que si le lundi annoncé
tombe vraiment un lundi. Il a récupéré ainsi un millier de pleins ; sur les
autres, une date déduite d'un nom fautif vaut moins que pas de date.

**Le kilométrage manque presque partout** : 586 pleins sur 12 589 en portent
un, et aucun sur 2025. La colonne « KLMS » existe dans les classeurs et reste
vide. La consommation aux 100 km et le coût au kilomètre ne se déduiront donc
pas de ces pleins ; il y faudra des relevés, qui sont une autre matière.

## L'outillage, et pourquoi il ne passe plus par Excel

`scripts/extraire-classeurs.ps1` pilotait Excel en COM. Le 10 septembre 2026,
COM a rendu « Unable to get the Open property of the Workbooks class » et
l'extraction s'est arrêtée là. Or un `.xlsx` est une archive ZIP de fichiers
XML, et Node sait tout ce qu'il faut.

- `scripts/lire-xlsx.mts` lit un classeur **sans Excel** : chaînes partagées,
  styles pour reconnaître les dates, feuilles rendues en tableaux de lignes.
  Trois cents lignes remplacent la dépendance, et la lecture devient de nature
  en lecture seule — on n'abîme pas un classeur qu'on se contente de dézipper.
- `scripts/extraire-carburant.mts` parcourt les cinq années du dossier et rend
  les deux séries, plus la liste de ce qu'il écarte et pourquoi.
- `scripts/charger-carburant.mts` en fait le fichier SQL, en écartant ce qui
  n'est pas du parc et ce qui n'a pas de tarif.
- `scripts/tester-carburant-reel.mts` charge le fichier dans une base montée
  avec les migrations, le seed et la purge — l'état exact de la production — et
  vérifie treize points.

**Un piège attrapé par ce banc**, qui vaut d'être noté : `34,30 × 755` vaut
25 896,499999999996 en virgule flottante et 25 896,50 en numérique exact.
JavaScript arrondissait un franc en dessous de ce que Postgres attend. Le
générateur ne calcule donc plus le montant : il écrit `round(34.30 * 755)` et
laisse la base faire sa propre arithmétique décimale.

## Ce qui reste

1. **Jouer les cinq parties** de `supabase/carburant-parties/` dans le SQL
   Editor, après le seed, l'alignement, la purge et la plaque. Chacune est
   rejouable : un second passage n'ajoute rien.
2. **Mai et juin 2025** : à chercher dans le dossier, ou à acter comme un trou.
3. **La date de bascule du supercarburant en juin 2022**, si l'on veut charger
   les quelques pleins d'essence de cette année-là.
4. **Les relevés kilométriques**, qui sont la matière suivante : sans compteur,
   le tableau de bord aura des litres et des francs, mais ni consommation aux
   100 km ni coût au kilomètre.

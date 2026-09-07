# Les pastilles du tableau de bord : l'état du moment, pas la tendance

*Proposition du 8 septembre 2026, à valider. Demande du métier : « contrairement
aux courbes, les pastilles doivent en priorité montrer des informations
instantanées ou d'une période précédente — la veille, la semaine passée, la
semaine en cours — utiles par rapport à maintenant : nombre de véhicules hors
service, etc. »*

## Le principe

Une page, deux temps. **Les courbes** répondent à « comment ça évolue » :
douze mois, une échelle par courbe, la cible en pointillé. **Les pastilles**
répondent à « où en est-on, là, maintenant » : un état compté ce matin, ou le
résultat d'une période close qu'on peut encore corriger — hier, la semaine
passée. Aujourd'hui les pastilles reprennent les mêmes indicateurs que les
courbes, cumulés sur la période choisie : c'est une tendance en petit, pas un
état. C'est cela qui change.

## Ce qu'une pastille dit désormais

Chaque pastille porte quatre choses, dans cet ordre :

1. **La valeur du moment** — un compte ou un taux, mesuré à l'instant ou sur
   la dernière période close.
2. **La référence** — ce que c'était hier, ou la semaine passée, ou le même
   jour de la semaine passée : la flèche et l'écart disent si l'on va dans le
   bon sens.
3. **Le seuil** — le rouge n'apparaît qu'au-dessus : trois véhicules hors
   service ne sont pas une alerte, huit le sont.
4. **Le geste** — un clic mène à la liste qui explique le chiffre : les
   véhicules hors service, les échéances de la semaine, les véhicules sans
   relevé.

Le pied de pastille garde une mini-courbe, mais sur **quatorze jours**, pas
douze mois : c'est le bon horizon pour un état.

## Les pastilles proposées

Par axe SQDCM, l'instant en premier. Chaque ligne dit ce qui existe déjà dans
l'application et ce qu'il faut construire.

| Axe | Pastille | Ce qu'elle compte | Référence | Seuil | Source |
| --- | --- | --- | --- | --- | --- |
| D | **Hors service maintenant** | Véhicules engagés qui ne sont ni en service ni en backup, à cet instant | hier même heure | > 10 % du parc engagé | statuts, existe (`SituationJour`) |
| D | **Prêts à charger ce matin** | Véhicules opérationnels avec chauffeur affecté et disponible | hier | < 80 % des engagés | existe (`pretsACharger`) |
| D | **Immobilisés depuis plus de 7 jours** | Véhicules hors service ou en réparation dont l'immobilisation dure | semaine passée | ≥ 1 | périodes de statut, à calculer |
| D | **Pannes de la semaine** | Pannes déclarées depuis lundi | semaine passée, même jour | > 3 | incidents, existe (D_NPVEL au mois) |
| S | **Jours sans accident** | Depuis le dernier accident déclaré | — | rouge sous 7 jours | existe (`joursSansAccident`) |
| S | **Accidents de la semaine** | Accidents déclarés depuis lundi | semaine passée | ≥ 1 | incidents, existe |
| Q | **Échéances dans les 7 jours** | Documents et visites qui expirent d'ici sept jours, véhicules et chauffeurs | semaine passée (échues ou non) | ≥ 1 échue | documents, existe (Conformité) |
| Q | **Immobilisés administrativement** | Véhicules dont un document critique manque ou est échu | hier | ≥ 1 | existe (`immobilisationAdministrative`) |
| Q | **Sans relevé depuis 7 jours** | Véhicules engagés sans relevé kilométrique valide sur sept jours | semaine passée | > 10 % | relevés, à calculer (déjà sur le téléphone) |
| C | **Carburant de la semaine** | Litres et francs depuis lundi, cuve et stations | semaine passée, même jour | > moyenne des 4 semaines + 15 % | pleins, existe |
| C | **Stock de la cuve** | Litres restants, jours d'autonomie au rythme des 7 derniers jours | hier | < 5 jours | cuve, existe (Carburant) |
| C | **Caisse parc** | Solde et engagements en cours | hier | sous le seuil de réapprovisionnement | existe (`soldeCaisse`) |
| C | **Dépenses de la semaine** | Maintenance et divers depuis lundi | semaine passée | > enveloppe hebdomadaire | dépenses, existe |
| M | **Chauffeurs indisponibles aujourd'hui** | Indisponibilités en cours | hier | > 10 % | existe (Chauffeurs) |
| M | **Ordres de travail ouverts** | Ordres non clos, dont ceux de plus de 15 jours | semaine passée | ≥ 1 de plus de 15 jours | existe (Maintenance) |
| M | **Demandes sans réponse** | Demandes poussées aux détenteurs, sans réponse à l'échéance | hier | ≥ 1 | à construire avec le mobile |

**Le choix par défaut, cinq pastilles** : Hors service maintenant · Prêts à
charger ce matin · Échéances dans les 7 jours · Carburant de la semaine ·
Jours sans accident. Le choix reste libre par compte, cinq au plus, par axe,
comme aujourd'hui.

## Ce qui change dans la page

- Le sélecteur « Choisir les indicateurs » propose **les pastilles du moment**
  d'un côté, **les indicateurs de période** (les actuels) de l'autre, pour qui
  tient à en garder une ou deux en pastille.
- Les filtres BU, catégorie et site s'appliquent aux pastilles comme aux
  courbes ; le sélecteur de période (semaine, mois, année) ne pilote plus
  que les courbes et la troisième rangée — une pastille du moment n'a pas de
  période.
- Le libellé sous la valeur dit toujours la référence en clair : « 3 de plus
  qu'hier », « −2 vs semaine passée », jamais un pourcentage seul.
- Le rouge reste réservé au seuil franchi ; le gris dit « pas de référence »
  (première semaine, pas de relevé).

## Ce que ça demande

- Un **calcul de situation à un instant** (`situationA(date, heure)`) à côté du
  cumul mensuel existant : les statuts et affectations sont datés à l'heure
  (`PeriodeStatut`), les documents à la date — tout ce qu'il faut est là ; les
  relevés et immobilisations « depuis plus de 7 jours » se déduisent des
  périodes de statut.
- **Les références « hier » et « semaine passée »** : la même fonction, à une
  autre date. La mini-courbe sur quatorze jours, c'est quatorze appels — en
  base, une seule fonction `situation_journaliere(depuis, jusqua)` qui rend
  les quatorze points d'un coup, dans la lignée de `lire_parc()`.
- Le catalogue `INDICATEURS` gagne un champ `moment: "instant" | "veille" |
  "semaine"` et une `reference`, et `evaluerIndicateur` sait comparer à
  cette référence plutôt qu'à la période précédente.
- Aucun changement pour les courbes ni pour la troisième rangée.

## Décidé et construit le 8 septembre 2026

Le métier a tranché : la référence des états est **hier en fin de journée** ;
le seuil du hors service est **en nombre** ; les indicateurs de période
**restent aux courbes**, jamais en pastille ; le défaut à cinq est retenu.

Construit le soir même : `src/domaine/pastilles.ts` (quinze pastilles,
`evaluerPastille` avec référence, seuil et quatorze jours),
`src/donnees/situation-demo.ts` (les situations journalières des quatre
dernières semaines, déduites des fiches, des incidents, des chauffeurs, des
ordres, de la caisse et de la cuve), la rangée et le sélecteur du tableau de
bord. La « demande sans réponse » attend le module des demandes.

Le lendemain : les seuils se règlent dans **Paramètres › Pastilles du
tableau de bord** (une valeur par pastille, en nombre, la valeur du jour à
côté), et la migration `0010_situation_journaliere.sql` rend les situations
journalières depuis la base, dans la lignée de `lire_parc()` — ordres, caisse
et cuve exceptés, qui n'ont pas encore leur table et se montrent « — ».

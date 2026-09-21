# Proposition : pannes, services de maintenance, pièces et plans d'entretien

*21 septembre 2026. À valider avant tout code. Métier : « revoir la gestion des
entretiens, de la maintenance et des pièces de rechange en adoptant un mécanisme
simple et facile à comprendre et à suivre — on peut s'aligner avant que tu ne le
codes ». Référence jointe : l'export des tâches de service Fleetio et une
facture ventilée en main-d'œuvre et pièces.*

## L'idée en une phrase

**On signale une panne, on ouvre un service qui la répare, on clôt le service.**
Tout le reste en découle : le coût, le stock, l'historique, les rapports.

```
 Signalement ──► Service de maintenance ──► Clôture
 (panne, anomalie)   (planifié / non planifié / urgent)   │
      ▲                 │  tâches du catalogue            ├─► intervention + dépenses (coûts, atelier)
      │                 │  pièces du magasin ─────────────├─► sorties de stock
 Plan préventif ────────┘  lignes MO / pièces             ├─► signalements résolus
 (échéance km ou mois)     documents, photos              └─► plan d'entretien remis à zéro
```

## 1. Signaler une panne ou une anomalie

Un formulaire court, qu'on remplit en une minute, au garage comme au téléphone :

| Champ | Contenu |
| --- | --- |
| Véhicule | choisi dans la liste, ou celui de la fiche |
| Date | aujourd'hui par défaut |
| Priorité | basse · normale · haute · critique (immobilise le véhicule) |
| Type | moteur, freins, pneus, électricité, carrosserie, climatisation, transmission, suspension, éclairage, autre |
| Description | une ligne : ce qui ne va pas |
| Détails | texte libre |
| Photos et documents | plusieurs, comme la déclaration d'incident |
| Kilométrage | facultatif — il devient un relevé |

Un signalement vit en trois états : **ouvert → pris en charge** (inclus dans un
service) **→ résolu** (le service est clos). Il se voit sur la fiche du véhicule
et sur la page Maintenance, avec son ancienneté.

Les **observations de visite technique** existantes deviennent des signalements
de même nature : une seule liste de « ce qu'il faut réparer ».

**Recommandation** : un signalement n'est pas un incident. L'incident, tel que la
fiche le déclare, porte l'assurance, les tiers, la responsabilité et
l'immobilisation. Le signalement ne dit que : « ceci est à réparer ». Une panne
en mission peut produire les deux : l'incident pour le constat, le signalement
pour la réparation.

## 2. Le service de maintenance

Il **remplace l'ordre de travail**. C'est la même chose en plus complet, et deux
objets voisins embrouilleraient tout le monde. Les ordres existants seraient
repris comme services.

**L'en-tête.** Véhicule · priorité (planifié, non planifié, urgent) · type
(préventif, curatif) · début et fin des travaux · prestataire (garage extérieur,
ou atelier interne) · kilométrage · statut (**planifié → en atelier → terminé**,
ou annulé).

**Les signalements inclus.** Les signalements ouverts du véhicule sont listés,
avec une case à cocher. Ceux qu'on coche passent « pris en charge », et seront
« résolus » à la clôture du service.

**Les lignes**, comme sur la facture jointe. Une ligne par **tâche du
catalogue** (§ 3), avec :

| Tâche | Main-d'œuvre | Pièces | Sous-total |
| --- | ---: | ---: | ---: |
| Remplacement de l'embrayage | 150 000 | 420 000 | 570 000 |
| Remplacement des plaquettes de frein | 25 000 | 65 000 | 90 000 |

Sous le tableau : total main-d'œuvre, total pièces, remise, taxe, **total**. Les
pièces d'une ligne se saisissent de deux façons :

- **prises au magasin** : on choisit la pièce et la quantité. Le stock baisse, et
  le coût est porté par le service (§ 4) ;
- **achetées pour l'occasion** : un montant, le fournisseur, la facture.

**Les pièces jointes.** Devis, facture, photos avant et après.

**La clôture** écrit ce que l'application sait déjà lire, sans rien changer aux
analyses : une **intervention** (le travail, le garage, le compteur,
l'immobilisation) et **une dépense par ligne** (main-d'œuvre et pièces, au bon
poste), avec la facture jointe. L'onglet Atelier, les coûts, le budget et les
rapports actuels continuent de fonctionner tels quels.

## 3. Le catalogue des tâches de service

La base qui rendra les rapports pertinents : chaque ligne de service cite une
tâche du catalogue, jamais un texte libre.

Une tâche a un **libellé**, une **description**, un **système** (moteur, freins,
pneus, électricité, carrosserie, transmission…) et un type par défaut (préventif
ou curatif). Elle peut porter une durée de main-d'œuvre et des pièces
habituelles. On en crée une depuis le formulaire du service si elle manque.

**Point de départ : l'export Fleetio.** 510 tâches, dont 350 utilisées au moins
une fois (11 481 utilisations), avec leurs codes catégorie, système et ensemble.
Je propose d'importer **les 350 utilisées**, après un nettoyage :

- « main d'oeuvre » (1 678 utilisations) n'est pas une tâche : c'est la colonne
  main-d'œuvre de chaque ligne ;
- « vidange » (306) et « Remplacement de l'huile moteur et du filtre » (1 107)
  sont la même tâche ;
- « Maintenance curative », « Transport », « Frais administratifs/divers » ne
  sont pas des tâches de maintenance.

Les 160 jamais utilisées restent dans l'export, à reprendre au besoin.

## 4. Les pièces de rechange

Le magasin existe déjà : références, stock minimum, mouvements, pneus. Ce qui
change :

- depuis un service, **« prendre au magasin »** crée une sortie de stock,
  rattachée au véhicule et au service ;
- le **coût de la sortie** est porté par la ligne du service, puis par la dépense
  « pièces » à la clôture : la charge passe du magasin au véhicule ;
- une pièce sous son **stock minimum** déclenche une demande de
  réapprovisionnement, qui existe déjà. Il reste à poser les seuils.

## 5. Les plans de maintenance préventive

Le mécanisme existe à moitié : des programmes d'entretien **par catégorie** de
véhicule, des opérations à intervalle en km, en heures ou en mois, et des
ajustements par véhicule. Il manque trois choses :

- un plan **par modèle** (Mitsubishi L200, Tata LPT 1618, Toyota Hilux…), plus
  précis que par catégorie ; et toujours l'ajustement **par véhicule** ;
- des opérations qui citent **les tâches du catalogue**, au lieu d'un libellé à
  part ;
- une échéance proche ou dépassée qui **propose le service** à planifier, en un
  clic sur la page Maintenance, les tâches déjà remplies.

L'intervalle se règle en **km et/ou en mois** : c'est la première des deux
limites atteinte qui déclenche l'échéance.

## 6. Les rapports

Tous tirés des services clos, des signalements et des plans :

- coût de maintenance par véhicule, modèle, système, tâche, prestataire ; part
  main-d'œuvre et part pièces ;
- préventif et curatif : la part de chacun, et son évolution ;
- **pannes les plus fréquentes** par modèle ; temps moyen entre deux pannes ;
- **délai** entre le signalement et la réparation, et temps d'immobilisation ;
- **respect du plan préventif** : services faits à l'heure, en retard, oubliés ;
- consommation de pièces par véhicule et par tâche ; valeur du stock ; ruptures.

## Découpage proposé

| Lot | Contenu | Ce qu'on obtient |
| --- | --- | --- |
| 1 | Catalogue des tâches (import Fleetio nettoyé) · signalements | on signale, et chaque tâche a un nom stable |
| 2 | Services : en-tête, signalements inclus, lignes MO et pièces, pièces jointes, clôture | le cœur, qui remplace l'ordre de travail |
| 3 | Pièces du magasin dans le service, sorties de stock, coût porté | la charge passe du stock au véhicule |
| 4 | Plans par modèle et par véhicule sur le catalogue ; services proposés à l'échéance | le préventif se pilote |
| 5 | Rapports de maintenance | les chiffres pour décider |

Chaque lot est utilisable seul, et le suivant s'appuie sur lui.

## Ce qu'il faut trancher

1. **Signalement et incident séparés ?** Recommandé : oui (voir § 1).
2. **Le service remplace l'ordre de travail**, et les ordres existants sont
   repris ? Recommandé : oui.
3. **Les lignes du service** : main-d'œuvre et pièces par tâche, puis remise et
   taxe globales, comme sur la facture jointe ? Ou plus simple : un montant par
   ligne, avec le poste ?
4. **Le catalogue de départ** : les 350 tâches utilisées dans Fleetio, nettoyées ?
   Faut-il garder les codes Fleetio (catégorie, système, ensemble), ou seulement
   un système en clair ?
5. **Le coût d'une pièce prise au magasin** : son prix de référence, ou le coût
   moyen des achats ?
6. **Qui clôt un service** : le service parc seul, ou avec la validation d'un
   responsable au-delà d'un montant ?

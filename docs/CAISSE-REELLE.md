# La caisse parc réelle, 2025-2026

*11 septembre 2026.*

La caisse de l'application n'avait aucun mouvement : sa pastille disait « — »,
et le registre des contraventions était vide. La gestion du parc tient pourtant
la caisse par quinzaine, dans `MALICK/Depense CAISSE` : un récapitulatif par
période, de janvier 2025 au 31 août 2026.

## Ce qui est chargé

`supabase/caisse-parties/`, **six fichiers** à jouer dans l'ordre : **42 quinzaines,
3 949 dépenses, 3 990 mouvements**, du 20 janvier 2025 au 31 août 2026.

| Poste | Lignes | Montant |
| --- | ---: | ---: |
| Frais de route | 722 | 7 922 700 F |
| Péage, pesage, stationnement | 337 | 5 760 550 F |
| Maintenance curative | 350 | 4 338 050 F |
| Conformité (visites, attestations) | 365 | 4 227 500 F |
| Pièces | 507 | 4 083 882 F |
| **Contraventions** | **843** | **4 030 500 F** |
| Divers (lavage, manutention, courses) | 317 | 2 893 122 F |
| Carburant | 206 | 2 799 612 F |
| Pneumatiques | 138 | 1 278 000 F |
| Maintenance préventive | 164 | 1 157 200 F |

**2 577 dépenses sont rattachées à 117 véhicules**, par la plaque que le libellé
cite. Les autres nomment un bénéficiaire, comme la contrainte l'exige.

## Comment une quinzaine se lit

Le récapitulatif s'ouvre sur ses « RECETTES » — le fonds disponible, 1 004 000 F
—, liste ses dépenses avec 1 % de frais de transfert, et se ferme sur son total.

- **Le fonds est reconstitué**, il ne s'ajoute pas. Août 1A reprend comme recette
  les 368 205 F restés d'août 1 ; août 2 se clôt sur « SOLDE au 31/08/2026 :
  29 653 ». L'argent réellement entré vaut donc la recette **moins le reste de la
  période précédente** : charger chaque recette comme une entrée aurait compté
  deux fois le même argent.
- **Le solde reporté passe à zéro** : le journal s'ouvre sur le premier
  approvisionnement de janvier 2025 (1 004 000 F).
- **Le contrôle tient sur les 42 périodes** : le total calculé égale celui écrit
  au fichier, et le solde de la base retombe sur le reste de chaque
  récapitulatif — 29 653 F au 31 août 2026.

**Ce que chaque quinzaine produit** : une entrée (l'approvisionnement réel), une
dépense et sa sortie par ligne — la règle du métier veut qu'une sortie cite la
dépense qu'elle règle —, et une dépense de frais de transfert pour la période.

## Les dates

Le récapitulatif ne date pas ses lignes, sauf celui d'août 2 2026.

- **Une dépense sans date** prend la date de clôture de sa quinzaine, et sa
  référence le dit.
- **La clôture** est la date du fichier ; elle concorde avec les deux soldes
  datés des récapitulatifs (12 et 31 août 2026).
- **Le journal de caisse suit le rythme des récapitulatifs** : chaque mouvement
  est daté de la clôture de sa quinzaine, sans quoi le solde plongerait en
  négatif au milieu d'août — les dépenses datées d'août 2 précèdent son
  approvisionnement. La dépense, elle, garde sa date réelle quand la feuille la
  donne : c'est elle qui porte le coût du véhicule et son mois.

## Ce que le tableau de bord y gagne

- **La pastille Caisse** cesse de dire « — » : la caisse est tenue, et le solde
  au 31 août 2026 est de 29 653 F, sous le seuil de réapprovisionnement.
- **Le registre des contraventions** (0042) est tenu : 843 amendes forfaitaires
  sur 20 mois, soit bien au-delà de la cible de 5 par mois.
- **Le coût par véhicule** gagne 2 577 dépenses de proximité que les bons de
  commande ne voyaient pas : lavages, pesées, petites pièces, dépannages.

## Les limites connues

- **Les brouillards ne sont pas relus.** Leur première feuille recopie des lignes
  d'une quinzaine à l'autre ; la seconde est le récapitulatif lui-même.
- **Les frais de transfert** sont chargés en une dépense par quinzaine, non par
  ligne : le coût par véhicule ignore donc ce 1 %.
- **Juin 1 2026** porte 45 770 F de frais pour 915 400 F de dépenses, au lieu du
  1 % habituel. Le récapitulatif est repris tel quel, son total en tient compte.
- **Le SQL Editor refuse une requête trop grosse.** Un fichier d'1,3 Mo a rendu « Query is too
  large » : les fichiers sont coupés à 400 Ko, sans jamais couper une quinzaine en deux. Ils
  se jouent dans l'ordre, le solde d'une période dépendant du reste de la précédente.
- **L'écran Caisse lit 5 000 mouvements** et calcule son solde sur cette liste ;
  le chargement en pose 3 990. La marge est faible : à la prochaine année de
  caisse, il faudra soit remonter cette limite, soit lire le solde en base.
- **Depuis le 1er septembre 2026**, rien n'est chargé : la quinzaine en cours
  n'était pas close au moment de l'extraction.

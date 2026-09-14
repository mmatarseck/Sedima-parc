# Les attelages

Un tracteur et une semi-remorque sont deux véhicules au référentiel — deux
cartes grises, deux visites techniques, deux fiches — mais une seule unité qui
roule. La situation du parc lourd les compte d'ailleurs ainsi : **33 unités
opérationnelles, 38 plaques, cinq attelages tracteur + semi**.

L'application savait déjà tout dire d'un attelage : le type, la fiche véhicule,
son bouton « Nouvel attelage », le numéro `ATT-…`. Tout, sauf le garder — il n'y
avait pas de table. Ce qu'on créait depuis l'écran ne survivait pas au
rechargement, et la fiche servait toujours une liste vide.

## Ce que c'est, et ce que ce n'est pas

Ce n'est pas une **affectation** : l'affectation lie une personne à un véhicule,
l'attelage lie deux véhicules entre eux. Ce n'est pas non plus une propriété du
tracteur : la même semi passe d'un tracteur à l'autre, et c'est précisément ce
qu'on veut suivre.

## Les cinq attelages du parc

Lus sur `BOCAR\M.SECK\SITUATION PARC SEDIMA LOURDS.xlsx`, feuille
« VEHICULES OPERATIONELS », le 14 septembre 2026. Cinq de ses lignes portent
deux plaques séparées d'une barre, et le genre le dit — « CAMION VRAC 27T
(tracteur+S.remorque) ».

| Tracteur | Semi-remorque | Ce que la feuille écrit | Site |
| --- | --- | --- | --- |
| AA 927 CA | AA 053 AP | Camion vrac 27 t | UAB — aliments |
| AB 932 EF | AB 551 HS | Camion vrac 30 t acheté en Chine, neuf | UAB — aliments |
| AA 737 ZW | AA 713 VE | Camion plateau nu 35 t | UAB — aliments |
| AA 905 CW | AA 214 XK | Camion plateau nu 35 t | Abattoirs — abattage |
| AA 350 JN | AA 909 CW | Camion citerne à eau pour les fermes | Sites — citerne eau |

Le tracteur est toujours écrit en premier, la semi en second, et les catégories
du référentiel le confirment sans exception — le banc le vérifie, parce qu'un
chargement par plaques peut inverser les deux colonnes sans que rien ne proteste,
et la fiche dirait alors qu'une citerne tracte un Renault.

### La date de début, qui n'est pas dans la source

La feuille est une **situation** : elle dit ce qui est attelé aujourd'hui, pas
depuis quand. Inventer une date serait faux ; laisser les cinq attelages dehors
serait pire, puisque c'est la réalité du parc. La date retenue est donc celle de
la lecture — le 14 septembre 2026 — et le motif de chaque ligne le dit, pour que
personne ne la prenne pour une date d'attelage. Elle se corrigera d'un clic le
jour où le dossier donnera la vraie.

Les cinq sont `permanent` : ce sont les attelages de référence du parc, pas des
prêts le temps d'une panne.

## Ce qui n'est pas chargé, et attend le métier

- **AA 633 JL + AA 769 JV.** Les licences de transport laissent entendre que la
  citerne vrac AA 769 JV est la semi du tracteur AA 633 JL. La situation, elle,
  porte AA 633 JL seul et range AA 769 JV parmi les véhicules **en panne**. Un
  attelage est un fait présent : celui-ci ne l'est plus, et on ne charge pas un
  attelage sur une supposition.
- **AA 542 BQ + AA 507 BQ**, Renault Premium et semi benne Schmitz. Le couple ne
  vient que de l'assurance 2026 ; il ne figure dans aucune situation de parc.
  Même règle.

## Ce que la base refuse

Quatre garde-fous, tenus par la base plutôt que par du code — un écran peut
changer, une contrainte non :

- un véhicule ne s'attelle pas à lui-même ;
- une fin antérieure au début n'est pas une période ;
- un tracteur ne tire pas deux semi-remorques à la fois ;
- une semi-remorque n'est pas tirée par deux tracteurs à la fois.

Les deux derniers ne valent que pour les attelages **en cours** : les attelages
clos d'un même couple sont normaux, c'est l'historique. Sans cela on ne pourrait
pas réatteler ce qu'on a dételé.

## À jouer

```
supabase/migrations/0050_attelage.sql
supabase/attelages.sql
```

La migration crée la table et rejoue `lire_parc()` pour que la liste Flotte
reçoive les attelages en cours avec le reste, sans aller-retour de plus. Le
fichier de données se joue après elle et après `aligner-referentiel.sql`, qui
apporte les dix véhicules. Les deux sont rejouables.

Banc : `scripts/tester-attelages.mts`.

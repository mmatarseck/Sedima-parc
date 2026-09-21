# Les factures qui couvrent plusieurs véhicules, et la facture ouverte à droite

*21 septembre 2026. Métier : « on voit des factures qui regroupent plusieurs
véhicules — à splitter par véhicule pour bien répartir les charges. Les factures
doivent être visualisées dans l'appli comme pour les documents. Au clic d'une
ligne de dépense, on rétracte la vue et on voit le document à droite, dans l'app
toujours. »*

## 1. La répartition — `supabase/correctif-factures-partagees.sql`, à jouer

Les chargements rattachaient un bon couvrant plusieurs véhicules à sa plaque
principale, comme le classeur d'extraction le fait lui-même. Le premier véhicule
portait donc la charge de tous : le Tata AA 565 GA payait l'entretien de cinq
camions.

**59 dépenses, 47 775 262 F, deviennent 164 parts** — 34 des bons de commande
(`DEP-R`), 4 des corrections (`DEP-C`), 21 du grand livre (`DEP-GL`) —, et 56
interventions jumelles suivent.

**D'où vient la liste des véhicules.** Pour un bon de commande, la colonne
« Toutes immatriculations » du classeur d'extraction ; pour une écriture du grand
livre, les plaques que son libellé nomme.

**D'où viennent les parts.**

1. **Le grand livre, quand il détaille le bon — 7 bons.** La comptabilité passe
   souvent une écriture par véhicule là où le bon n'a qu'un total : CMD2-26040372
   fait 2 259 000 F au bon, et six écritures au grand livre (716 000 F pour
   DK 1870 BG, 680 000 F pour DK 3033 BD…). Quand chaque écriture nomme un seul
   véhicule et que leur somme retrouve le montant à 2 % près, ce sont les vraies
   parts. L'écart de quelques francs va à la plus grosse : le total du bon fait foi.
2. **À parts égales, sinon — 52.** C'est une **convention, pas une mesure** : la
   facture ne ventile pas. La référence de chaque part le dit, avec le total :
   `BC15526 · facture répartie — part 2/5 de 3 218 378 F, à parts égales`.

**Ce qui ne bouge pas.** La dépense d'origine garde son numéro et devient la part
du premier véhicule : sa facture attachée, la demande d'achat et la caisse qui la
citent la retrouvent. Les autres parts naissent à côté (`DEP-R-00002-2`, `-3`…)
avec sa date, son poste, son fournisseur et **sa facture attachée** — chaque
véhicule ouvre la même facture. L'intervention jumelle suit, au même suffixe :
l'atelier les lit ensemble.

**12 parts vont à des véhicules absents de la flotte** (DK 6241 BM, DK 2614 BH,
DK 7621 BG, DK 4280 AS, DK 1306 BB, DK 3674 AX, DK 1399 BK, AA 125 JC,
AA 763 JV) : elles restent des dépenses du parc, sans véhicule, et nomment la
plaque dans leur libellé. Deux plaques mal écrites ont été redressées à la
relecture : AB 534 GA → AB 543 GA, AA 186 CP → AA 186 CQ. AA 125 JC et AA 763 JV
ont plusieurs voisins possibles et restent hors flotte — au métier de dire.

**Garde-fou et rejeu.** Une ligne n'est touchée que si son montant est encore le
total lu, ou déjà sa part. Un second passage ne change rien, et la requête de fin
de fichier ne doit rien rendre : le total de chaque facture est intact, au franc.
`scripts/repartir-factures.mts` reconnaît ce qu'il a déjà réparti et refait le
même fichier. Banc : `tester-factures-partagees` (13 contrôles).

Les chargements d'origine ne changent pas : sur une base neuve, ce correctif se
joue après eux.

## 2. La facture s'ouvre à droite de la liste

Sur la fiche véhicule, onglets **Atelier** et **Autres dépenses** : un clic sur
la ligne, la liste se rétracte sur trois colonnes (date, objet, montant) et la
facture se lit à droite, dans le même cadre que les documents du Dossier —
« Ouvrir dans un onglet », « Modifier la ligne », et la croix qui rend sa largeur
à la liste. Un second clic sur la ligne la referme. Sous 1280 px, la pièce passe
au-dessus de la liste. Une ligne sans facture le dit, et propose de la joindre.

Ce qui a été fait pour cela :

- `VisionneusePiece` est tiré du dossier des pièces, qui s'en sert à son tour :
  une pièce s'ouvre de la même façon partout, et son adresse ne se signe qu'à
  l'ouverture.
- `ListeEtPiece` pose la liste et la pièce côte à côte.
- `TableauSimple` reçoit `surLigne`, `ouverte` et `seulement` — le clic, la ligne
  marquée, les colonnes de la liste rétractée (sans toucher aux réglages).
- **Un défaut corrigé au passage** : l'assemblage de la fiche laissait tomber la
  facture de la dépense. En base réelle, le lien « ouvrir la facture » de
  l'atelier ne s'affichait donc jamais, alors que 208 dépenses portent un fichier.
- La modification d'une dépense propose désormais « La facture ou le reçu » :
  on la joint, on la remplace, on la retire depuis la ligne.

Banc : `node --import tsx --import ./scripts/rendu/hook.mjs scripts/tester-piece-a-droite.mts`
(15 contrôles). L'écran lui-même n'a pas été vu dans un navigateur : l'application
demande une connexion, et la démonstration ne démarre pas tant que `.env.local`
pointe sur la base. À vérifier à l'œil après déploiement.

**Pas encore fait** : le journal de caisse, la fiche d'un poste budgétaire et le
compte d'un prestataire listent aussi des dépenses, mais leurs lignes ne portent
pas la référence du fichier ; il faut d'abord la leur faire lire.

## 3. Le chargeur du grand livre ne s'efface plus lui-même

Une fois son SQL joué, `charger-grand-livre` trouvait ses propres bons « déjà en
base » et ses propres fournisseurs « déjà créés » : régénéré, le fichier fondait.
Il ignore maintenant ce qu'il a lui-même écrit (`DEP-GL-`, `INT-GL-`,
`PRE-2026-6…`) et refait exactement les fichiers commités. La lecture des plaques
d'un libellé est partagée avec la répartition (`scripts/plaques-libelle.mts`).

## 4. Suite du 21 septembre : saisir une facture, et plus rien hors de l'application

*Métier : « éliminer les boutons qui ouvrent les fichiers hors plateforme. On
doit pouvoir rajouter des dépenses et interventions en renseignant toutes les
lignes de dépenses, le fournisseur, le kilométrage, etc., en attachant la
facture en PDF ou image, directement à partir de la vue maintenance du véhicule,
ou sur la page Maintenance globale. La même possibilité pour les dépenses
autres, où l'on attache la pièce justificative. »*

**Saisir une facture** (`FormulaireFacture`) : l'en-tête une fois — véhicule
(choisi depuis la page Maintenance, celui de la fiche sinon), fournisseur pris
au référentiel ou écrit, date, n° de facture, kilométrage, « réglée par »,
nature, immobilisation, objet — et la **pièce jointe, obligatoire**, en PDF ou
en image. Puis les lignes, autant qu'il en faut : poste, libellé, montant, avec
le total qui se tient à jour.

| D'où | Bouton | Ce qui s'écrit |
| --- | --- | --- |
| Fiche véhicule, onglet Atelier | « Saisir une facture » | une intervention au total de la facture, et une dépense par ligne (postes de maintenance) |
| Page Maintenance | « Saisir une facture » | la même chose, sur le véhicule choisi |
| Fiche véhicule, onglet Autres dépenses | « Saisir une dépense » | une dépense par ligne (assurance, péage, documents, frais de route…) |
| Menu « Ajouter » de la fiche | Intervention, Dépense | le même formulaire que les boutons |

Chaque ligne porte la pièce jointe et le fournisseur ; le compteur est relevé une
seule fois. Une clé `FAC-AAMMJJ-XXXX`, écrite dans la référence de l'intervention
et de ses lignes, les rassemble à l'atelier en **une ligne au total de la
facture** — le suffixe des numéros ne le pouvait pas : une facture a plusieurs
lignes, et les numéros se renumérotent en base, chaque table de son côté.

**Plus aucun fichier ne s'ouvre hors de l'application.** « Ouvrir dans un
onglet » a quitté le cadre des pièces ; le justificatif d'une ligne dit
« Jointe », et la ligne l'ouvre à droite ; le bon scanné de la caisse et les
pièces du chauffeur s'ouvrent dans un cadre par-dessus l'écran. Restent les
étiquettes QR : un PDF que l'application fabrique pour l'imprimer, pas une pièce
jointe.

Au passage : les formulaires de la fiche proposaient le 2 septembre comme date,
jour où ils ont été écrits ; ils proposent aujourd'hui. Et une dépense tout juste
créée garde sa pièce jointe avant même que la base ne la renvoie.

Le dépôt d'un PDF demande la base branchée — en démonstration, seules les images
passent. Banc : `node --import tsx --import ./scripts/rendu/hook.mjs scripts/tester-facture.mts`
(21 contrôles).

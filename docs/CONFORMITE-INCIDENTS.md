# Fiche véhicule : renouveler avec sa pièce, Conformité & dossier, déclarer un incident

*21 septembre 2026. Métier : « pour le renouvellement des documents de
conformité, prévoir la possibilité de joindre une pièce justificative (PV de
visite technique, police d'assurance…) ; regrouper les onglets Conformité et
Dossier ; rajouter un bouton de création d'un incident ou sinistre comme sur les
autres onglets, avec possibilité de prendre des photos. »*

## À jouer

```
supabase/migrations/0058_pieces_incident.sql   -- incident.pieces : photos et documents d'une déclaration
```

**Avant de déployer le code.** Une déclaration sans pièce passe même sans 0058 :
la colonne n'est écrite que lorsqu'il y a des pièces. Une déclaration avec des
pièces, elle, serait refusée par une base qui n'a pas encore la colonne.

## Renouveler, c'est déposer la nouvelle pièce

« Renouveler », sur une échéance de conformité, ouvre la création du document :
son type (celui du rappel), « Renouvelé le » (aujourd'hui), la nouvelle échéance
(proposée d'après la validité du type), le n° de pièce, l'émetteur, le montant,
et **la pièce justificative, obligatoire**, en PDF ou en image. À
l'enregistrement, le rappel prend la nouvelle échéance et la date du
renouvellement, et son commentaire nomme la pièce.

Chaque échéance montre un trombone quand une pièce la prouve. Un clic sur la
ligne ouvre cette pièce à droite, avec « Renouveler » à portée de main. La
preuve est le document que le rappel cite ; à défaut, le plus récent document du
même type qui porte un scan (`preuveDuRappel`).

Le rappel ne reçoit pas le numéro du document : ce numéro peut encore changer
quand la base le prend, et la clé étrangère `rappel.document_numero` refuserait
alors l'écriture.

## Un seul onglet, « Conformité & dossier »

Les échéances en haut, le dossier des pièces en dessous (réglementaire, procès-
verbaux de visite), avec ses boutons « Déposer ». Le dossier s'affiche
maintenant sur tous les écrans : il était masqué sous 1024 px, sans message. Les
anciennes adresses `?onglet=dossier`, dont celle du rapport des pièces, ouvrent
l'onglet commun.

## Déclarer un incident ou sinistre

L'onglet Incidents & sinistres a son bouton « Déclarer un incident ou sinistre »,
comme les autres onglets. Il ouvre le formulaire en quatre étapes, qui propose
maintenant **plusieurs photos et documents** : photos prises sur place, constat,
procès-verbal. Sur un téléphone, chaque cadre propose l'appareil photo ou la
galerie. Le formulaire promettait ces pièces depuis le cadrage (« au branchement
de la base ») ; la colonne n'existait pas.

Dans la liste, un trombone et le nombre de pièces. Un clic sur la ligne ouvre la
première à droite, et les flèches passent à la suivante.

## Au passage

- Le menu « Ajouter » de l'en-tête avait sa propre copie du geste d'ajout : il
  ouvrait l'ancien formulaire d'intervention et de dépense. Il ouvre maintenant
  la saisie de facture, comme les boutons des listes.
- Les formulaires de la fiche, et la déclaration, proposaient le 2 septembre
  comme date : ils proposent aujourd'hui.

## Bancs

`tester-conformite-incidents` (20 contrôles, dont la migration 0058 dans PGlite),
et `tester-facture`, `tester-fiche-rendu` mis à jour. `tester-conformite`
échouait déjà avant ces changements (« 0 assurances… sur les véhicules
d'exploitation », dernier changement du banc le 14 septembre) : son jeu de
démonstration n'a plus de documents.

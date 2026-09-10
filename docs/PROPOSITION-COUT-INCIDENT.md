# Ce que coûte un incident — proposition du 10 septembre 2026

*Trois décisions à prendre avant toute construction. Rien n'est fait tant
qu'elles ne le sont pas.*

## Le constat

L'application sait tout d'un incident sauf ce qu'il a coûté.

La déclaration porte la nature, le type, le lieu, la mission, la
responsabilité, les blessés, le sinistre ouvert, les jours d'immobilisation.
Elle ne porte pas de montant, et **rien ne relie une dépense à une
déclaration** : la table des dépenses n'a pas de colonne pour le dire, et
aucun écran ne propose le rattachement. Seule la demande d'achat cite une
transaction d'origine, incident compris — mais une demande d'achat n'est pas
une dépense, et toutes les suites d'un incident ne passent pas par elle.

En démonstration, le coût est un chiffre écrit dans le dossier. C'est ce
chiffre qui alimente aujourd'hui la fiche du chauffeur et deux rapports. En
base, il n'y a rien : la fiche affichait « 0 F », c'est-à-dire une affirmation
fausse — non pas « cet incident n'a rien coûté » mais « on l'ignore ».

**Corrigé le 10 septembre 2026, sans attendre ces décisions** : un coût
inconnu se dit désormais « non suivi » et ne compte pas au score du chauffeur.
Un chauffeur sans aucune déclaration coûte toujours zéro, ce qui est exact.
La correction rend l'écran honnête ; elle ne remplit pas le manque.

## Ce que le manque coûte

- **La fiche du chauffeur** ne peut pas dire ce que ses accidents ont coûté à
  l'entreprise, alors que c'est la question du responsable d'exploitation.
- **Deux rapports** — « Performance des chauffeurs » et « Incidents par
  chauffeur » — laissent une colonne vide.
- **Un accident coûteux ne se distingue pas d'une éraflure** dans les
  classements et les revues.
- **Le budget** ne rattache aucune dépense de sinistre à son fait générateur :
  la réparation se lit en poste « entretien » sans qu'on sache qu'elle répare
  un accident.

## Les trois décisions

### 1. Qu'est-ce qui compose le coût d'un incident ?

Ma recommandation : **les dépenses réellement rattachées, et rien d'autre**,
sur le modèle déjà retenu pour les pièces de rechange et le compte des
prestataires — une somme se déduit, elle ne se saisit pas.

| Ce qui compose le coût | Retenu ? |
| --- | --- |
| La réparation du véhicule (garage, pièces) | à décider |
| Le dépannage et le remorquage | déjà créé par la déclaration, à rattacher |
| La franchise d'assurance | à décider |
| Les dommages versés à un tiers | à décider |
| La perte d'exploitation (jours d'immobilisation) | **non** — elle se calcule déjà par les jours, la mêler au coût la compterait deux fois |

*Question ouverte* : l'indemnité reçue de l'assureur vient-elle **en déduction**
du coût, ou se suit-elle à part ? Un coût net est plus juste pour l'entreprise ;
un coût brut dit mieux la gravité du fait. Ma recommandation : garder le brut
comme coût, et montrer l'indemnité à côté.

### 2. Comment une dépense se rattache-t-elle à une déclaration ?

Trois voies possibles, non exclusives :

1. **À la déclaration** : le formulaire crée déjà une dépense de dépannage
   quand on saisit un montant. Il suffit de la rattacher — c'est acquis, sans
   effort de saisie.
2. **À la dépense** : un champ « Suite de l'incident » dans la modale de
   dépense, choisi dans l'index comme la demande d'achat choisit son origine.
   C'est la voie principale : la réparation arrive des semaines après.
3. **Depuis la fiche de l'incident** : un bouton « Rattacher une dépense » qui
   ouvre la liste des dépenses du véhicule sur la période, à cocher.

Ma recommandation : **les trois**, la deuxième d'abord. Le coût de
construction est modeste une fois la colonne posée.

### 3. Qui a le droit de rattacher ?

Ma recommandation : **le niveau saisie sur le module Incidents**, comme la
déclaration elle-même. Le rattachement n'est pas un acte comptable — il ne
crée ni ne modifie une dépense, il la désigne.

*Question ouverte* : un rattachement sur un mois clos doit-il passer par
l'approbation, comme toute modification de mois clos ? Ma recommandation : oui,
par cohérence, puisque la dépense elle-même y est soumise.

## Ce que la construction demanderait

Une fois les décisions prises, l'ordre serait celui-ci — chacun se recette
seul.

1. **Migration 0030** : une colonne `incident_id` sur `depense`, en référence
   nulle avec `on delete set null`, plus son index. Une dépense ne cite qu'un
   incident ; un incident porte plusieurs dépenses.
2. **Le domaine** : `IncidentChauffeur.cout` et `LigneIncident.cout` se
   déduisent de la somme rattachée — le type accepte déjà la valeur nulle
   depuis la correction du 10 septembre.
3. **La lecture** : `incidents.ts` et la fiche du chauffeur somment les
   dépenses citées, en une requête bornée.
4. **La saisie** : le champ « Suite de l'incident » dans la modale de dépense,
   le rattachement automatique du dépannage, le bouton de la fiche.
5. **Les écrans** : la colonne « Coût » des incidents cesse d'être vide, la
   fiche du chauffeur retrouve son montant, les deux rapports aussi ; la fiche
   de l'incident liste ce qui lui est rattaché.
6. **Le banc** `scripts/tester-incidents.mts` : une déclaration, deux dépenses
   rattachées, une troisième qui ne l'est pas, le coût déduit, un mois clos.

Estimation : une session, migration comprise, si les trois décisions sont
tranchées d'avance.

## Ce que je ne propose pas

- **Un montant saisi à la main sur la déclaration.** Ce serait la voie facile,
  et elle produirait deux vérités : un chiffre tapé et des dépenses réelles qui
  ne concordent pas. Le parti pris du projet — le stock déduit, la dette du
  prestataire déduite — est de ne jamais saisir ce qui se déduit.
- **Un poste de dépense « sinistre ».** Le poste dit la nature de la dépense
  (entretien, pièces, dépannage) ; le rattachement dit sa cause. Les confondre
  ferait perdre l'un ou l'autre.
- **Une table de liaison.** Une dépense a une cause, pas plusieurs. Une simple
  colonne suffit et se lit plus vite.

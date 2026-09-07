# SEDIMA Parc sur le téléphone — proposition du 7 septembre 2026

*Maquette et détail : <https://claude.ai/code/artifact/7ef45bcc-a580-4a03-b091-6f32bfbca0c5>.
Demande du métier : « la version mobile doit se focaliser sur les entrées de
données terrain, la vue rapide d'un véhicule et la mise à jour de son statut ;
pas de version chauffeur ; pour chaque personne, définir ce qu'elle voit ».*

## Le parti pris

Le téléphone ne refait pas le bureau. Il sert là où le bureau n'est pas : au
dépôt, à l'atelier, sur le parking. Il fait peu de choses, vite. Une
application web installable (PWA) sur la même adresse, mêmes données, mêmes
droits ; une saisie faite sans réseau part au retour du réseau.

## Complété le 7 septembre au soir, sur cinq retours du métier

- La **photo de la pièce justificative est obligatoire** : plein, dépense,
  réponse à une demande de relevé, réserve sur un transfert.
- **L'administrateur approuve** tout écart d'un accès par rapport à son profil.
- Le **détenteur** d'un véhicule (chauffeur titulaire ou attributaire) a un
  compte réduit : son véhicule, les demandes reçues, les transferts à signer.
  Rien d'autre, aucun accès au bureau.
- Le parc **pousse des demandes ciblées** au détenteur — relevé de compteur en
  premier, puis jauge, position, contrôle du matin — à une personne, à
  plusieurs, ou à tous les détenteurs d'un site ; réponse avec photo,
  suivi de qui a répondu et qui tarde.
- Une **fiche de transfert** accompagne toute remise d'un véhicule à un
  chauffeur ou à un récipiendaire : compteur, carburant, documents à bord,
  équipements, réserves avec photos, signature de celui qui remet et de
  celui qui reçoit. Elle ouvre l'affectation qui suit et ferme la précédente.

## Huit écrans

1. **Accueil**, réduit au périmètre de la personne : disponibles, en panne,
   à faire aujourd'hui, quatre gestes (relevé, plein, panne, chercher).
2. **Fiche rapide** : marque et modèle, chauffeur, site, compteur, kilomètres
   avant la prochaine vidange, échéances, derniers faits, un bouton « Changer
   le statut ».
3. **Changer le statut** : un panneau, les statuts que le profil a le droit de
   poser, un motif, l'heure.
4. **Relevé et plein** : plaque, compteur contrôlé contre le dernier relevé et
   le plafond, litres, source, montant au barème du jour, photo du ticket.
5. **Panne avec photo** : cause, lieu, « peut rouler », et ce que l'envoi
   déclenche (hors service, alerte maintenance, incident).
6. **Atelier** (maintenance) : ordres ouverts, clôture d'une intervention
   depuis la fosse, retour en service en un geste.
7. **Demandes du détenteur** : la demande poussée par le parc, la réponse
   avec photo du compteur, les autres demandes possibles.
8. **Fiche de transfert** : remettant, récipiendaire, compteur, carburant,
   état des lieux, deux signatures sur l'écran.

## Six profils

| Profil | Rôles actuels | Téléphone |
| --- | --- | --- |
| Administrateur | administrateur | tout ; les utilisateurs se règlent au bureau |
| Responsable | gestionnaire-parc, direction | tout le parc, tous les statuts, affectation rapide, validations |
| Maintenance | responsable-maintenance | atelier, clôture d'intervention, réparation ↔ service, panne, relevé |
| Agent terrain | correspondant-site, responsable-carburant | son site : relevé, plein, panne, service ↔ panne, document renouvelé |
| Lecteur | controle-de-gestion, achats, direction | chiffres d'accueil, fiche rapide sans action, alertes |
| Détenteur | nouveau, lié au chauffeur ou à l'attributaire | son véhicule, ses demandes, ses transferts à signer |

La liste du métier dit « Admin » deux fois ; le second a été lu comme l'agent
de terrain, à confirmer.

## Pour chaque personne : la fiche d'accès

Sur le modèle du formulaire de contact de Fleetio, dans Paramètres ›
Utilisateurs : identité, accès (compte activé ou contact seul), profil qui
pose les défauts, périmètre (sites, BU, régimes), niveau par module (—,
lecture, saisie, gestion), sanctions visibles ou non, notifications.
En base : une table `acces_utilisateur` rendue par `get_me()` et lue par les
politiques RLS. Les huit rôles actuels deviennent les défauts des cinq
profils.

Deux objets nouveaux en base : la **demande** (type, destinataires,
échéance, réponse, photo, horodatage) et la **fiche de transfert**
(véhicule, remettant, récipiendaire, compteur, carburant, documents,
équipements, réserves, photos, deux signatures).

## L'ordre proposé

1. La fiche d'accès et le modèle par personne, au bureau.
2. La fiche rapide et le statut sur le téléphone.
3. Relevé, plein, panne, photo obligatoire.
4. Le compte détenteur, les demandes poussées et leur suivi.
5. La fiche de transfert.
6. L'atelier.

## Décidé le 7 septembre

Photo justificative obligatoire ; écarts de profil approuvés par
l'administrateur ; compte détenteur ; demandes poussées ; fiche de transfert.

## Reste à décider

1. Le second « Admin » : agent terrain, ou autre chose ?
2. Le périmètre d'un agent terrain : son site seul, ou aussi les véhicules de passage ?
3. La panne passe-t-elle le véhicule hors service dès l'envoi, ou après confirmation ?
4. Le détenteur reçoit-il ses demandes par l'application seule, ou aussi par SMS ?

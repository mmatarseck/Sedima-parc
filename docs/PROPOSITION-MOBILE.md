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

## Six écrans

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

## Cinq profils

| Profil | Rôles actuels | Téléphone |
| --- | --- | --- |
| Administrateur | administrateur | tout ; les utilisateurs se règlent au bureau |
| Responsable | gestionnaire-parc, direction | tout le parc, tous les statuts, affectation rapide, validations |
| Maintenance | responsable-maintenance | atelier, clôture d'intervention, réparation ↔ service, panne, relevé |
| Agent terrain | correspondant-site, responsable-carburant | son site : relevé, plein, panne, service ↔ panne, document renouvelé |
| Lecteur | controle-de-gestion, achats, direction | chiffres d'accueil, fiche rapide sans action, alertes |

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

## L'ordre proposé

1. La fiche d'accès et le modèle par personne, au bureau.
2. La fiche rapide et le statut sur le téléphone.
3. Relevé, plein, panne avec photo.
4. L'atelier.

## À décider

1. Le second « Admin » : agent terrain, ou autre chose ?
2. Le périmètre d'un agent terrain : son site seul, ou aussi les véhicules de passage ?
3. La panne passe-t-elle le véhicule hors service dès l'envoi, ou après confirmation ?
4. Un plein saisi sans photo du ticket : accepté, ou en attente de justificatif ?
5. Qui approuve un accès qui s'écarte du profil ?

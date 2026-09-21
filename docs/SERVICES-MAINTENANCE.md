# Pannes signalées, services de maintenance, catalogue des tâches

*21 septembre 2026. Lots 1 à 3 de `PROPOSITION-MAINTENANCE.md`, sur les décisions
du métier du même jour.*

## Les décisions

| # | Question | Décision |
| --- | --- | --- |
| 1 | Signalement et incident séparés ? | Oui. |
| 2 | Le service remplace l'ordre de travail ? | Oui, et reprend les ordres existants : même table, même numéro OTR. |
| 3 | Quelle facture ? | Toutes : remise par ligne, remise globale, TVA 18 %, BRS 5 %, total HT, total TTC. |
| 4 | Quel catalogue ? | Une catégorisation comme Fleetio : catégorie, système, ensemble. |
| 5 | Le coût d'une pièce du magasin ? | Son prix de référence, posé à l'entrée de stock. |
| 6 | Qui clôt un service ? | Le responsable du parc. |

## À jouer, dans cet ordre

```
supabase/migrations/0059_depense_origine_stock.sql   -- une dépense peut venir du magasin (seule dans son fichier)
supabase/migrations/0060_services_maintenance.sql    -- catalogue, signalements, service, clôture, droits, prix de référence
supabase/taches-service.sql                          -- le catalogue tiré de Fleetio : 341 tâches
```

**Avant de déployer le code.** Les pages Maintenance et Paramètres › Catalogue
lisent les nouvelles tables ; une lecture qui échoue arrête la page. La fiche
véhicule et les formulaires tolèrent l'absence de 0060, pour ne pas fermer toute
l'application.

## Signaler une panne

Page Maintenance › « Signaler une panne », ou fiche véhicule › onglet
Maintenance › « Signaler une panne », ou le menu « Ajouter ». Le formulaire
demande :

- le véhicule, depuis la page Maintenance ;
- la date ;
- la priorité : basse, normale, haute, critique ;
- le type, c'est-à-dire le système concerné, dans la classification du
  catalogue ;
- le problème en une ligne, puis les détails ;
- le kilométrage ;
- des photos et des documents, plusieurs à la fois.

Un signalement passe par trois états :

- **ouvert** ;
- **pris en charge** dès qu'un service ouvert l'inclut — cet état se lit sur le
  service, rien ne s'écrit ;
- **résolu** à la clôture de ce service — c'est la base qui l'écrit (déclencheur
  de 0060).

La page Maintenance a une vue « Pannes signalées ». Chaque panne ouverte y
propose « Créer un service », et le service l'inclut d'avance.

## Le service de maintenance

Il s'ouvre depuis :

- la page Maintenance : « Nouveau service », « Planifier » sur une échéance, ou
  « Créer un service » sur une panne ;
- la fiche véhicule : carte « Services de maintenance », ou menu « Ajouter ».

**L'en-tête.** Priorité (planifié, non planifié, urgent) · type (préventif,
curatif) · début et fin des travaux · prestataire · kilométrage · n° de facture
· immobilisation prévue · objet.

**Les pannes incluses.** Les pannes ouvertes du véhicule, à cocher. Une panne
déjà prise par un autre service ouvert n'est pas proposée.

**Les lignes.** Une par tâche du catalogue, comme sur une facture :

- main-d'œuvre, pièces achetées, remise de ligne (en francs ou en pour cent),
  sous-total HT ;
- sous chaque ligne, **les pièces prises au magasin** : le stock disponible et
  le prix de référence s'affichent, la quantité se saisit.

Une tâche écrite à la main, absente du catalogue, y entre à l'enregistrement,
avec le système qu'on lui donne.

**La facture** se lit comme celle du prestataire :

- main-d'œuvre, pièces, remises des lignes, sous-total HT ;
- remise globale, total HT ;
- TVA 18 % (case cochée par défaut, taux modifiable), total TTC ;
- BRS 5 % (case à cocher), **net à payer au prestataire** ;
- pièces du magasin, hors facture ;
- **coût du service**.

Le coût du service est le TTC plus les pièces du magasin. La BRS ne le diminue
pas : SEDIMA la verse à l'État à la place du prestataire. Les pièces du magasin
ne portent ni remise ni taxe : elles ne passent pas par la facture du garage.
Tous les calculs sont dans `domaine/service.ts`.

**Les documents et photos.** Devis, facture, photos avant et après.

**La clôture** est réservée au responsable du parc et à l'administrateur. Le
bouton n'apparaît qu'à eux. La base refuse aux autres (déclencheur de 0060) et
signe la clôture (`cloture_par`). La clôture écrit ce que l'application sait
déjà lire (`domaine/cloture-service.ts`) :

- **une intervention**, au coût du service, avec le prestataire, le compteur et
  les jours d'immobilisation, du début à la fin des travaux ;
- **une dépense par part de ligne** : main-d'œuvre au poste préventif ou
  curatif, pièces achetées au poste pièces. Leur part du TTC inclut remises et
  taxes, et la facture jointe les accompagne. Leur somme est le coût du
  service, au franc ;
- pour chaque pièce du magasin, **une dépense d'origine « stock »** et **une
  sortie de stock**, rattachées au véhicule et au service ;
- enfin le service passe « clos », et ses pannes incluses sont résolues.

Toutes ces écritures portent le numéro du service, le n° de facture et une clé
de facture. L'atelier du véhicule les lit donc en **une ligne**, au coût du
service.

**Le budget ne compte pas deux fois.** Une pièce du magasin a été payée à
l'achat, par sa demande d'achat. Sa dépense d'origine « stock » donne son coût
au véhicule, mais le budget l'écarte.

**Le prix de référence** d'une pièce suit désormais sa dernière entrée de stock
(déclencheur de 0060) : c'est ce prix que prend une sortie.

## Les droits

Le responsable du parc (`gestionnaire-parc`) passe de la **lecture à la
gestion** sur la maintenance, pour clore les services. La direction garde la
lecture. Le responsable de la maintenance gère les services, sans les clore.

Côté application, le profil « Responsable » réunit gestionnaire du parc et
direction, et passe en gestion. La base, elle, tient la différence : la
direction n'y écrit pas.

## Le catalogue des tâches

Il vient de l'export Fleetio (`scripts/charger-taches-fleetio.mts`) :

- 510 tâches dans l'export ;
- 160 jamais utilisées : laissées de côté ;
- 4 qui ne sont pas des tâches (« main d'oeuvre », « Maintenance curative »,
  « Maintenance préventive », « Transport ») : écartées ;
- 5 doublons fondus : « vidange » dans « Remplacement de l'huile moteur et du
  filtre », « MAIN D OEUVRE DEPANNAGE » dans « Assistance routière/remorquage »,
  etc. Le nom fondu reste en alias et se retrouve encore dans le formulaire.

Restent **341 tâches**, classées comme Fleetio, sur trois niveaux :

- la **catégorie** : 0 cabine et carrosserie, 1 châssis, 2 transmission,
  3 électricité, 4 moteur, 5 accessoires et fluides, 9 divers ;
- le **système** : 013 Freins, 017 Pneus, 045 Moteur…
- l'**ensemble** : un code à trois chiffres dans le système.

Les 143 tâches créées à la main dans Fleetio n'avaient pas de code. Leur système
se reconnaît au libellé. Par exemple, les « appareils à air », poumons et
électrovannes relèvent du freinage pneumatique. **26 restent à classer** :
« Maintenance périodique », « Huile pour engreanages », « crochet teton »…

Paramètres › **Catalogue des tâches de service** : on les consulte, on les
classe en un clic, on en crée. Les filtres sont « À classer », une catégorie, ou
« Toutes ».

## Ce qui reste (lots 4 et 5)

- **Plans préventifs** par modèle et par véhicule, sur le catalogue, avec un
  intervalle en km et/ou en mois. Une échéance proposerait le service, tâches
  déjà remplies.
- **Rapports de maintenance** : par tâche, système, catégorie, modèle,
  prestataire ; préventif et curatif ; pannes fréquentes ; délai de réparation ;
  respect du plan ; consommation de pièces.
- Les observations de visite technique, à rattacher aux signalements.
- Le téléphone de l'atelier démarre et clôt encore l'ancien ordre de travail. Il
  n'a pas le formulaire de service.

## Bancs

`PGLITE_DIR=… node --import tsx --import ./scripts/rendu/hook.mjs scripts/tester-services-maintenance.mts`
— 45 contrôles :

- une facture calculée à la main : remises, TVA, BRS, net, magasin, coût ;
- la répartition en dépenses, au franc ;
- ce qu'écrit la clôture, et l'atelier qui la lit en une ligne ;
- les états d'un signalement, la classification ;
- dans PGlite : les migrations, le catalogue rejoué sans doublon, le refus de
  clôture au responsable de la maintenance, la clôture signée par le
  responsable du parc, la panne résolue, le prix de référence à l'entrée.

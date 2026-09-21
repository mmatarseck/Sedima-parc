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
supabase/migrations/0061_intervention_tache.sql      -- les tâches de chaque intervention, les utilisations comptées sur le parc
supabase/taches-service.sql                          -- le catalogue tiré de Fleetio, revu : 294 tâches
supabase/interventions-taches.sql                    -- les 581 interventions du parc affectées au catalogue
```

**Si 0060 a échoué à moitié** (« syntax error at end of input », 21 septembre 2026 : les tables `tache_service` et `signalement` créées, les colonnes du service et 0059 absentes), jouer à la place `supabase/rattrapage-0059-0060.sql` : les deux migrations en un fichier, sans commentaires, rejouable — éprouvé deux fois de suite sur une base dans cet état. Puis `taches-service.sql`.

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

Les 143 tâches créées à la main dans Fleetio n'avaient pas de code, et beaucoup
étaient mal créées. **La revue du 21 septembre 2026** les reprend une à une
(table explicite dans le script, qui s'arrête si une tâche reste sans système) :

- **8 retirées** : ce n'est pas de la maintenance, ou c'est illisible —
  « Location de véhicule », « service HSE », « réparation quaie de
  chargement », « raccord », « CONFECTIONNEUSE ECROUS », « JEUX ARRET
  MERCESDES AXOR », et deux tâches d'engins (« AWD Filter Replacement »,
  « Circle Drive Oil Replacement ») ;
- **des achats de pièces saisis comme des tâches**, fondus dans la tâche qu'ils
  servent : « ACHATS PNEU 385 » dans « Remplacement des pneus », « RIMULA
  EXTRA » et « FILTRE A HUILE » dans la vidange moteur, « ACHAT BATTERIE »
  dans « Remplacement de la batterie », « JEU DE PLAQUETTE » dans les
  plaquettes de frein…
- **des doublons** fondus : « GLACIOLE EAUX », « LAVAGE VEHICULE », « Huile
  pour engreanages » (vidange du pont arrière)…
- **33 tâches standard ajoutées** — 25 par la revue, 8 pour les interventions du
  parc (plus bas) —, bien nommées et codées, qui regroupent les
  réparations réelles sans équivalent Fleetio :
  - freins : circuit d'air de freinage (« appareil air », électrovanne,
    distributeur, boudins), vases de frein (poumons), compresseur d'air, frein à
    main, étrier ;
  - châssis : ballons de suspension pneumatique, lames de ressort, goujons et
    écrous de roue, attelage (crochet, sellette), contrôle et gonflage des
    pneus ;
  - groupe frigorifique (système 054) : entretien, compresseur, recharge de gaz,
    ventilateur et condenseur, filtres et capillaires ;
  - hydraulique de benne (052) : vérin, huile et filtre ;
  - et : robot de boîte, feux de gabarit, klaxon, prise de remorque, graissage
    général, réfection moteur, entretien périodique (révision), courroie de
    ventilateur ;
- **12 recodées** : les « Divers » sans système reçoivent le leur (Moteur 045,
  Transmission 020, Électricité 030, Accessoires 050), les tâches d'essieu le
  pont arrière (022), deux libellés corrigés (« Remise en état après sinistre »,
  « Désinfection et désinsectisation du véhicule »).

Le nom d'une tâche fondue reste en **alias** : taper « appareil air » ou
« ACHATS PNEU 385 » dans le formulaire retrouve la bonne tâche.

Restent **294 tâches, toutes codifiées** comme Fleetio, sur trois niveaux, et
**aucune à classer** :

- la **catégorie** : 0 cabine et carrosserie, 1 châssis, 2 transmission,
  3 électricité, 4 moteur, 5 accessoires et fluides, 9 divers ;
- le **système** : 013 Freins, 017 Pneus, 045 Moteur…
- l'**ensemble** : un code à trois chiffres dans le système. **999** est le
  divers du système, pour les tâches que Fleetio laissait sans ensemble.

Cinq systèmes s'ajoutent à la classification : 020 Transmission — divers,
030 Électricité — divers, 050 Accessoires et aménagements, 052 Hydraulique —
benne et vérins, 054 Groupe frigorifique et caisse isotherme.

Les numéros suivent le classement (système, ensemble, libellé), et restent donc
les mêmes d'une génération à l'autre. **Rejouer `taches-service.sql`** remplace
les tâches venues de Fleetio. Celles saisies dans l'application restent, et les
affectations des interventions sont mises de côté puis rendues. Aucune ligne de
service ne pointe une tâche par clé étrangère : un service déjà saisi garde ses
libellés.

## Les utilisations, comptées sur notre parc

Métier, 21 septembre 2026 : le nombre d'utilisations dans Fleetio ne dit rien
de SEDIMA. On compte donc dans notre flotte, en affectant chaque intervention
déjà faite à la bonne tâche, ou au divers.

**Le lien** (0061) : `intervention_tache`, une intervention pour une ou
plusieurs tâches (« disque d'embrayage et huile de boîte »). Son origine est
« historique » pour l'affectation des interventions passées, « saisie » pour un
lien posé dans l'application.

**L'affectation** (`scripts/affecter-interventions-taches.mts`, qui fabrique
`interventions-taches.sql`). Pour chaque intervention, le script lit :

- son objet, sans les désignations creuses (« ENTRETIEN VEHICULE ; RETENUE
  5% ») ;
- quand elle vient d'un bon de commande, l'objet de la demande d'achat et les
  désignations de ses lignes, tirés du classeur des bons de maintenance. Une
  ligne du grand livre qui nomme déjà son travail se suffit : l'objet de son
  bon, commun à plusieurs véhicules, brouillerait.

Ce texte passe devant une liste de motifs relus à la main, un par tâche. Les
tâches « (Divers) » d'un système ne jouent que si aucune tâche précise du même
système n'est reconnue. Un entretien « aux 50 000 km », une révision, sont
l'**entretien périodique**. Ce qui ne se reconnaît pas va à l'entretien
périodique si l'intervention est préventive, à **« Travaux non détaillés
(Divers) »** sinon.

Résultat, au 21 septembre 2026 : **581 interventions**, dont 444 lues avec leur
bon, donnent 696 affectations sur 82 tâches. 488 interventions ont trouvé leur
tâche. **93 restent en divers** : des factures groupées sans détail (« facture
réparation des véhicules … par TSA »), des « réparation du véhicule » sans plus,
des pièces de rechange non nommées. Les plus fréquentes :

| Tâche | Interventions |
| --- | ---: |
| Entretien périodique (révision) | 156 |
| Travaux non détaillés (Divers) | 93 |
| Remplacement des pneus | 46 |
| Tôlerie et peinture | 34 |
| Réparation du groupe frigorifique | 25 |
| Remplacement de l'ensemble moteur | 23 |
| Remplacement de l'huile moteur et du filtre | 22 |
| Lavage du véhicule | 20 |
| Moteur (Divers) | 18 |
| Système électrique (Divers) | 16 |

Huit tâches ont été ajoutées au catalogue pour ce que le parc fait et que
Fleetio n'avait pas : tôlerie et peinture ; sellerie et tapisserie ; disques de
frein ; arbre de transmission ou cardan ; réparation de la boîte de vitesses ;
réparation du groupe frigorifique ; caisse isotherme ; travaux non détaillés.

**Le compte.** `tache_service.utilisations` vaut les interventions affectées
plus les services clos dont une ligne cite la tâche (par son libellé ou un
alias). Il se recompte à chaque affectation et à chaque clôture de service. Le
catalogue et les listes de choix sont triés sur ce compte.

**À l'écran.** La liste des interventions de la page Maintenance a une colonne
« Tâches ». Une base sans 0061 l'affiche vide, sans bloquer la page.
Paramètres › Catalogue montre « Utilisations (parc) ».

**Rejouer** `affecter-interventions-taches.mts` après un nouveau chargement
d'interventions, puis `interventions-taches.sql` : les affectations
« historique » sont refaites, celles saisies restent.

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
— 55 contrôles :

- une facture calculée à la main : remises, TVA, BRS, net, magasin, coût ;
- la répartition en dépenses, au franc ;
- ce qu'écrit la clôture, et l'atelier qui la lit en une ligne ;
- les états d'un signalement, la classification ;
- l'affectation d'une intervention du parc : plusieurs tâches, l'entretien
  périodique, le divers, le groupe frigorifique distinct du moteur ;
- dans PGlite, 0061 : une intervention affectée et rejouée, le compte des
  utilisations (service clos compris), les affectations gardées quand on rejoue
  le catalogue ;
- dans PGlite : les migrations, le catalogue rejoué sans doublon, toutes ses
  tâches codifiées, les tâches mal créées rangées ou retirées, le refus de
  clôture au responsable de la maintenance, la clôture signée par le
  responsable du parc, la panne résolue, le prix de référence à l'entrée.

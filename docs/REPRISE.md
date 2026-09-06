# Reprise du projet — état au 3 septembre 2026

Note de passage de relais : à lire en premier dans une nouvelle session.
Elle dit où en est le projet, ce qui a été décidé, et ce qui reste à faire.

---

## 0 bis. Session du 5 septembre 2026 — listes, budget, rapports

**Le tableau de référentiel se généralise.** `TableListe` — filet de couleur en
début de ligne, première colonne et en-tête figés, colonnes au choix et largeurs
enregistrées par compte — sert désormais aussi aux **transporteurs** et au
**budget**, à la demande du métier (« comme sur les vues Véhicules et
Chauffeurs »). Il a gagné une propriété `libelleFilet` : le filet portait
« Statut » en dur, ce qui était faux là où il porte une notation ou un état
budgétaire.

**Le pavé d'explication devient un « i ».** Le motif né sur le tableau de bord
vit maintenant dans `composants/interface/AideSurvol.tsx` et sert au budget.

### Le budget, refondu

- **Une ligne par poste**, plus par couple poste × business unit. La maille fine
  reste celle des enveloppes — c'est elle qui se défend en comité — mais elle se
  lit dans **la page du poste** (`/budget/carburant`), avec son filtre par
  business unit, sa ventilation, sa courbe du cumul contre le rythme attendu,
  ses dépenses et ses engagements. Répondre à « on doit pouvoir rentrer sur un
  poste et voir les dépenses qui l'ont impacté ».
- Les postes **hors budget** ont quitté leur tableau à part et rejoint la liste :
  un poste sans enveloppe n'est pas d'une autre nature, c'est un poste dont le
  budget vaut zéro, et sa page se lit comme les autres.

**Deux défauts que cette refonte a mis au jour** — tous deux invisibles tant que
la matière était rangée dans un coin de l'écran :

1. **Le carburant n'avait aucune enveloppe.** 141 M F, le premier poste du parc,
   en « hors budget » : ses dépenses ne commencent qu'en janvier de l'exercice et
   la fenêtre de base n'en voyait pas un franc. Les postes sans base historique
   dérivent maintenant leur enveloppe de leur propre rythme annualisé, ce qui est
   écrit sur la ligne. Le hors-budget passe de 148 M F à ~1 M F et retrouve son
   sens : un poste trop petit pour mériter une enveloppe.
2. **Cinq bons de commande vivaient hors de tout écran**, parce que leur poste
   (« pièces ») n'avait encore produit aucune dépense. L'engagé entre désormais
   dans la liste au même titre que le consommé — un engagement invisible est
   exactement la mauvaise surprise que ce suivi doit empêcher — et le KPI
   « Engagé » compte tous les postes, en disant ce qui est hors budget.

### Les rapports : 26 → 40, au moins trois par rubrique

Nouvelle famille **Budget** (postes, enveloppes par BU, engagements en cours) et
onze rapports ajoutés : conformité par véhicule et visites techniques ;
sinistralité par véhicule et par chauffeur ; discipline et frais de route ;
délais du cycle d'achat ; comptes et notation des prestataires ; **efficacité du
transport au F/tonne** et coût par destination.

**`transporteurs-efficacite` est le rapport qui tranche** : il met le parc SEDIMA
sur la même ligne que les tiers. Sur douze mois — 43 329 t, 2 813 chargements,
458 M F — ADEX porte la tonne à **9 510 F** contre **13 039 F** pour le parc
(−27 %). C'est la même conclusion que la question 54, sur une autre base : la
cible de 35 % d'externalisation est à réinterroger.

Deux corrections au passage : les tonnes étaient déclarées en type `poids`, donc
affichées en kg ; et les **enlèvements clients** apparaissaient comme un
transporteur à 0 F la tonne — ils ont désormais leur nature propre et un coût
vide plutôt que nul, parce qu'une tonne que le client vient chercher n'est pas
une piste d'économie.

Dans le rail du catalogue, « Tous les rapports » et « Favoris » sont séparés des
rubriques par un filet et un intitulé : ce ne sont pas des rubriques, ce sont
des façons de couper le catalogue.

### Le référentiel prestataires, les tiers dans le planning

**Les colonnes du référentiel prestataires** répondent maintenant aux questions
qu'on se pose devant la liste — qui est-ce, vaut-il quelque chose, que fait-il
pour nous, combien, lui doit-on, travaille-t-il encore — et non plus à « quel
est son numéro de téléphone », qui est une donnée de fiche. Huit colonnes par
défaut, **quarante-trois au choix** : compte fournisseur (pièces dues, échu,
retard le plus ancien, avances, solde net), activité (véhicules servis, postes,
pleins, litres, documents, visites, première activité, ancienneté), qualité de
service (évaluations, qualité, délai, prix, reprises, note), achats Sage X3, et
la carte d'identité restée au choix.

**Une incohérence corrigée** : un transporteur affichait « — » partout parce que
son activité ne passe pas par les demandes d'achat. `activiteTransport()` lit
désormais affrètements, mises à disposition et prestations, et sert au
référentiel, au rapport et à la fiche — ADEX passe de 0 F à 206,9 M F. La
**note** aussi divergeait d'un écran à l'autre (63 ici, 68 là) parce que
l'ancienneté ne comptait pas les mêmes traces : les trois sources s'accordent
maintenant. Une note qui change selon l'écran ne vaut rien.

**La fiche prestataire s'édite depuis la fiche transporteur** : même modale,
même trace, surcharge appliquée aussitôt. Un agent qui corrige un téléphone n'a
plus à changer d'écran.

**La saisie d'une livraison choisit dans la flotte du transporteur** — ses
chauffeurs (avec leur téléphone) et ses camions (avec leur capacité), l'attelage
habituel proposé par défaut. La ligne créée est alors *suivie* : elle renvoie à
une immatriculation du référentiel, pas à une plaque notée à la volée.

**Le planning des affectations porte les camions des transporteurs** — 33 lignes
à côté des 19 du parc — et rien ne les confond : filet ambre, pastille
« Tiers », nom du transporteur sous la plaque, et l'attelage habituel en
pointillé (constaté au référentiel, pas décidé : il ne s'ouvre pas). Un
sélecteur de périmètre — Tous / Parc SEDIMA / Transporteurs — coupe le planning,
et **les compteurs du bandeau comme les conflits ne portent que sur le parc** :
un camion tiers sans conducteur n'est pas un poste à pourvoir. Une vraie
affectation peut se programmer par-dessus, avec un chauffeur tiers ; les deux
référentiels se proposent dans le même choix, les tiers marqués de leur
transporteur.

### Le carnet, soldé

- **L'exception tarifaire se promeut en règle**, depuis l'onglet Grille de la
  fiche transporteur. La promotion crée une ligne de grille datée du jour, qui
  cite la mission d'origine dans son commentaire — c'est ce lien qui permet de
  dire, au retour, quelles exceptions ont déjà été reprises. Rien n'est réécrit
  rétroactivement : les missions passées gardent leur prix.
- **L'UAB n'est plus à Diamniadio.** Le site `s-diam` a disparu du référentiel
  et ses deux véhicules ont rejoint l'UAB, qui est au siège de Rufisque.

---

## 0 ter. Session du 6 septembre 2026 — paramètres, audit, mise en production

### Les paramètres, complets

Les quatre sections « au cadrage » sont livrées ; l'écran en compte neuf, dont
six où l'on saisit.

- **Règles d'alerte** — ce qu'un compte reçoit sans rien toucher : dix familles
  d'alerte × huit rôles, et le délai de prévenance. C'est **branché** :
  `reglageParDefaut()` lit ces règles, et un nouveau compte les reçoit. À ne pas
  confondre avec « Mes notifications », qui est le réglage de chacun.
- **Référentiels** — les vingt registres de l'application (124 valeurs), chacun
  avec **le nombre d'enregistrements qui le portent**. Rien ne s'y modifie, et
  c'est délibéré : ces valeurs sont les clés des enregistrements, pas des
  libellés ; la colonne « usages » dit ce qui pourrait disparaître sans rien
  casser.
- **Utilisateurs et rôles** — les huit rôles, leur périmètre, ce que chacun a le
  droit de faire (la règle vient du domaine, elle n'est pas recopiée), et de
  quoi prendre un autre rôle pour la démonstration.
- **Barème SQDCM** — les cinq piliers pondérés, les indicateurs avec objectif,
  tolérance, définition, formule et source, les quatre tranches de prime. Il vit
  dans les paramètres parce qu'**un chauffeur doit pouvoir lire son barème** :
  une prime dont la règle n'est pas publique cesse d'orienter les comportements.

### L'audit

**Boutons.** Treize boutons ne faisaient rien. Six sur la fiche chauffeur
(nouvelle affectation, document, contravention, incident, sanction,
indisponibilité) sont branchés sur l'`ajouter()` qui existait déjà dans la fiche
— la logique n'a pas été dupliquée, elle a été passée aux onglets. « Ajouter un
chauffeur » ouvre une vraie création (`fabriquerLigneChauffeur`, échéances
calculées à la même règle que les autres). Les deux « Exporter » mènent au
rapport correspondant, où les colonnes sont typées et le classeur part avec son
cartouche — réécrire ici un export approximatif aurait donné deux vérités pour
le même tableau. Les trois « Voir » d'un justificatif sont devenus des mentions
« Fourni » : rien ne stocke encore les fichiers, et un bouton qui promet une
pièce qu'il ne peut pas montrer est pire qu'une mention.

**Chiffres.** Les effectifs, les coûts, le carburant et le transport
s'accordent entre écrans et rapports (véhicules 19/19, chauffeurs 21/21, coûts
236 653 193 F des deux côtés, relevé 2 813 chargements et 43 329 t partout). Le
budget aussi : synthèse et somme des postes au franc près.

**Un défaut trouvé** : le rapport « Dépenses par poste » comparait le **mois en
cours** — deux jours au 2 septembre — à la moyenne mensuelle, et annonçait
« −100 % » sur le carburant. Il compare maintenant le dernier mois **complet**,
et une colonne dit lequel. Le carburant passe de −100 % à +44,8 % en août : un
signal, au lieu d'un artefact de calendrier.

**Code.** `noUnusedLocals`, `noUnusedParameters` et `noFallthroughCasesInSwitch`
sont activés ; les dix-sept déclarations mortes qu'ils ont révélées sont
retirées. Le script `verifier-charte`, déclaré dans `package.json` mais absent
du dépôt depuis toujours, est écrit : il vérifie les dépendances interdites, les
boutons sans action, le vocabulaire français, les échappatoires de typage, les
en-têtes de module et les résidus de mise au point. **189 fichiers, aucun
manquement.**

### La mise en production

- **Dépôt git initialisé**, premier commit posé sur `main` (210 fichiers).
- **`supabase/migrations/0001_socle.sql`** — le socle : référentiels, flotte,
  chauffeurs, transactions, trace des modifications, clôture, paramètres. Avec
  les énumérations en types PostgreSQL (une faute de frappe ne crée pas une
  neuvième catégorie de véhicule), une contrainte d'exclusion qui interdit deux
  titulaires simultanés sur un véhicule, les politiques RLS, et `get_me()` en
  SECURITY DEFINER. La lecture des sanctions y est réservée, comme dans le code.
  Restent à écrire en `0002` : transporteurs, budget, rapports personnalisés.
- **`.github/workflows/verification.yml`** — types, charte, construction.
- **`README.md`** — démarrage, règles du projet, et la marche à suivre pour
  GitHub, Supabase et Vercel, y compris l'ordre de branchement écran par écran.
- **`.env.example`** complété.

**Ce qui reste avant la production**, et qui ne se décide pas ici :
l'inventaire de référence du parc (les huit listes du dossier parc ne
s'accordent pas) doit être arbitré par l'équipe parc, pas par une migration.

### La suite de la mise en production (même journée)

- **`0002_transport_budget.sql`** — transporteurs, entretien, compte
  fournisseur, budget, rapports personnalisés. Les règles du code y deviennent
  des contraintes : une exception tarifaire sans motif est refusée par la base,
  un contrat écrit sans référence aussi, un relevé en mode « parc » cite un
  véhicule.
- **`src/lib/supabase.ts`** — les trois clients et `utilisateurCourant()` via
  `get_me()`. `@supabase/ssr` ajouté pour la session en cookies avec l'App
  Router.
- **`scripts/generer-seed.mts`** (`npm run generer-seed`) — verse le jeu de
  démonstration en SQL : 5 967 lignes sur 29 tables, identifiants stables,
  rejouable. Il vient de la même source que l'application, donc il dit la même
  chose.

**Un défaut de données trouvé en générant le seed** : le référentiel tiers
tenait sept camions ADEX, les factures de mise à disposition et le relevé en
citaient neuf. Les deux camions à œufs (AA 567 EC, AA 076 BP) ne passent pas par
le relevé de tonnage de l'aliment, mais ils roulent et se facturent — sans eux,
527 chargements et 24 mois de mise à disposition perdaient leur camion à
l'entrée en base. Ajoutés au référentiel : 35 camions tiers, tout est lié.
La même génération a aussi révélé que les factures écrivent « AA-076-BP » et le
référentiel « AA076BP » — normalisé avant de lier.

### Où en est la mise en production (6 septembre 2026, fin de session)

**Fait.**

- Dépôt GitHub : `https://github.com/mmatarseck/Sedima-parc` — `main` poussé,
  intégration continue **verte** (types, charte, construction).
- Projet Supabase : `mafnzghuexfcxctupyqb` (organisation MATAR_S, projet
  `sedima-parc`). **Les migrations 0001 et 0002 sont passées** dans le SQL
  Editor du tableau de bord, sans une correction : 39 tables, RLS, `get_me()`.
- Le mot de passe de la base a été réinitialisé et a transité par la
  conversation : **le réinitialiser encore une fois** avant de le poser dans
  Vercel.

**Ce qui a coincé, et la parade.**

- `npx` refuse de s'exécuter sous PowerShell (politique d'exécution) : utiliser
  `npx.cmd`.
- `supabase link` répond « Your account does not have the necessary
  privileges » quel que soit le compte connecté au CLI. Non résolu — et
  contourné : **tout se joue dans le SQL Editor**, ce qui donne le même résultat
  qu'un `db push`. `supabase/config.toml` a été posé par `supabase init` ; il
  est inoffensif.
- Le seed entier (1,3 Mo) dépasse la limite du SQL Editor : il est découpé en
  cinq parties **ordonnées** dans `supabase/seed-parties/` (ignoré par git,
  régénérable). Elles se jouent 01 → 05 sans en sauter.

### Le seed validé hors ligne (6 septembre 2026, reprise du soir)

Deux allers-retours dans le SQL Editor avaient corrigé la partie 02 à
l'aveugle (horodatage des incidents, lien sanction → incident). Plutôt que de
continuer une erreur à la fois, **le seed est rejoué en local dans PGlite**
(PostgreSQL en WebAssembly, installé dans le bac à sable de la session, pas
dans le projet) avec un schéma `auth` factice : migrations 0001 à 0003, puis
les cinq parties, en quelques secondes. Le rejeu a trouvé d'un coup ce qui
restait :

- **Les tableaux d'énumérations.** `array['tonne']` est un `text[]`, que
  `mode_remuneration[]` refuse ; même chose pour `categorie_vehicule[]` sur
  les programmes d'entretien (et l'opération qui les cite tombait derrière).
  Le générateur écrit désormais les tableaux en littéral `'{…}'`, qui prend
  le type de la colonne.
- **Le mois en cours d'une mise à disposition.** 0002 exigeait 28 à 31 jours
  calendaires ; septembre entamé en porte 2, comme l'écran Transporteurs qui
  ne compte que les jours écoulés. Migration `0003` : de 1 à 31.
- **Dix-sept documents perdus en silence.** Le générateur annonçait 128
  documents, la base en gardait 111 : la licence de transport était recopiée
  sur chaque véhicule couvert, et l'unicité du numéro n'en gardait qu'une —
  `on conflict do nothing` cachait le reste. La licence est portée par la
  flotte (décision du 3 septembre) : `0003_mad_et_licence.sql` lui donne sa
  table `licence_transport` et son périmètre `licence_vehicule`, avec deux
  déclencheurs (une licence de flotte ne liste personne ; passer une licence
  en « flotte » vide son périmètre), l'horodatage et les politiques des
  documents. Le seed la verse deux fois, pas dix-neuf.

Le générateur découpe maintenant lui-même les parties (`supabase/seed-parties/`,
300 Ko au plus, aux frontières d'instruction) : `npm run generer-seed` suffit.
Le rejeu complet passe **5 954 lignes sur 31 tables, zéro erreur**, et le
compte annoncé par le générateur est celui de la base — plus aucune ligne
écartée sans le dire.

**Fait le 6 septembre au soir.** La migration 0003 et les cinq parties sont
passées dans le SQL Editor ; `verifier-seed.sql` répond « ok » sur les 31
tables — après le retrait de deux lignes de `document` : la partie 01, jouée la
veille avant 0003, y avait laissé les deux licences comme documents de
véhicule. **La base Supabase porte le jeu de démonstration complet
(5 954 lignes).**

**Vérifié le 6 septembre, plus tard dans la soirée.** `main` est poussé
(commit 66629df), l'intégration continue est verte sur ce commit, et
l'application est déployée : **https://sedima-parc.vercel.app** rend le
tableau de bord sans erreur console — sur son jeu de démonstration, puisque
aucun écran n'est encore branché sur la base. Le premier administrateur et les
variables Vercel ne se vérifient pas depuis le code : les tenir pour faits
quand le gestionnaire se connecte.

### Le branchement commence : authentification et référentiels (6 septembre, nuit)

Les politiques RLS exigent une session avec un profil actif : brancher un
écran sans connexion réelle aurait lu des listes vides. Le premier incrément
est donc l'authentification, et le premier module les référentiels.

- **`src/proxy.ts`** (Next 16 appelle ainsi le middleware) : rafraîchit la
  session `@supabase/ssr` dans les cookies, renvoie à `/connexion` sans
  session et à `/flotte` depuis la page de garde avec une session. Inactif
  sans configuration Supabase.
- **`src/lib/session-serveur.ts`** : `sessionCourante()` — démonstration,
  anonyme, sans profil, ou connecté (rôle par `get_me()`, nom par `profil`).
  La mise en page de l'application la lit et redirige ; connectée, elle rend
  `AmorceSession`, qui pose rôle et identité dans le navigateur sous la clé
  que les trente appels à `lireRole()` lisaient déjà. Aucun écran n'a changé.
- **Page de garde** : connexion par courriel et mot de passe, lien de
  réinitialisation, motif « sans profil » expliqué (et session refermée pour
  que le proxy ne renvoie pas en boucle). Menu du compte et écran Profil
  affichent le nom du profil, pas celui du rôle de démonstration.
- **`src/donnees/referentiels.ts`** : `sites()`, `vehiculesParSite()`,
  `prestataires()` — Supabase avec le client serveur si configuré, jeu de
  démonstration sinon. Branché sur Prestataires (liste et fiche), Caisse,
  Affectations et Paramètres › Référentiels. `fichePrestataire` reçoit la
  liste en argument : les transactions restent celles de la démonstration et
  citent le prestataire par son nom, que `prestatairePour` retrouve.

Types, charte (194 fichiers) et construction passent ; en démonstration,
rien n'a bougé.

**Recetté sur Vercel le 6 septembre, tard.** Le gestionnaire s'est connecté
avec le compte invité ; la page de garde n'a plus de comptes de démonstration
et un visiteur sans session est renvoyé à la connexion. Deux pièges, pour
mémoire :

- les variables `NEXT_PUBLIC_` sont gravées à la construction : les poser
  après coup ne sert à rien sans redéploiement, et un commit vide force une
  construction neuve ;
- une URL Supabase mal collée (sans `https://`, ou avec des guillemets) fait
  planter le proxy à chaque requête : « Invalid supabaseUrl » dans l'onglet
  Logs de Vercel, et « Internal Server Error » sur toutes les pages, page de
  garde comprise. Les deux variables publiques sont en type Config, la clé
  de service en Secret.

Sur le poste, `.env.local` (ignoré par git) porte l'URL et une clé factice :
cela suffit à exercer le proxy et la page de garde en mode réel. Pour lire la
base d'ici, y mettre la vraie clé anon.

### Les paramètres branchés (6 septembre, nuit, suite)

Barèmes d'énergie, règles d'alerte et types de document ont **une seule
vérité** en mode réel : `parametre` (une ligne JSON par clé) et
`type_document`.

- Lecture serveur : `parametresServeur()` lit la base si configurée, le
  cookie sinon. La mise en page passe le résultat à `AmorceParametres`, qui le
  pose dans le navigateur **pendant le rendu** — avant que les écrans, rendus
  après, ne lisent `lireParametres()` dans leurs états initiaux.
- Écriture : `ecrireParametres()` et `reinitialiserParametres()` deviennent
  asynchrones et rendent un motif de refus. En réel, elles appellent la
  fonction serveur `enregistrerParametres()` (`parametres-actions.ts`), qui
  refait le contrôle de rôle (administrateur, direction) avant les politiques
  RLS, écrit les deux lignes de `parametre`, met à jour les types de document
  et retire ceux qui ont disparu — sauf s'ils portent encore des documents,
  ce que la base dit et que l'écran affiche. Les trois écrans montrent le
  refus à côté des boutons.

Types, charte (195 fichiers), construction : bons. En démonstration, la
sauvegarde d'un barème a été exercée (cookie posé, « Enregistré »). **Le
chemin réel reste à recetter sur Vercel** : Paramètres › Énergie, modifier la
capacité de cuve, Enregistrer, puis recharger — la valeur doit tenir, et un
compte non administrateur doit lire le refus.

### Les listes Flotte et Chauffeurs branchées (7 septembre 2026)

Deux modules, même motif que les référentiels : lecture en base si
configurée, démonstration sinon, écrans inchangés.

- **`src/donnees/flotte.ts`** — `lireParc()` lit d'un coup véhicules, sites,
  chauffeurs, affectations, documents, licences, relevés, dépenses, pleins,
  interventions (par pages de mille : Supabase plafonne une réponse, et une
  liste tronquée en silence vaudrait un compteur faux) ; `ligneDepuisLaBase()`
  dérive la ligne avec les règles du domaine : titulaire et suppléants par
  les affectations en cours, dernier compteur toutes sources (relevé, dépense,
  plein), état des documents type par type — licence de flotte comprise —,
  échéance de conformité la plus proche, immobilisation administrative,
  coût douze mois, prochaine échéance d'entretien par `echeancesDuPlan`.
- **`src/donnees/chauffeurs.ts`** — `lireChauffeurs()` puis
  `lignesDepuisLaBase()` : statut déduit (en poste dès qu'une affectation
  court, titulaire ou suppléant), véhicule tenu, échéances permis et visite,
  incidents et contraventions de l'année, kilomètres attribués au titulaire
  au prorata de ses jours disponibles.
- Les identifiants restent ceux de l'application (immatriculation,
  identifiant lisible du chauffeur) : les adresses et les fiches — encore en
  démonstration — ne changent pas de clé.

**Comparé à la démonstration sur le même seed** (`scripts/comparer-listes.mts`,
qui rejoue migrations et seed dans PGlite) : statut effectif et immobilisation
identiques sur les 19 véhicules. Les écarts restants sont documentés, et
plutôt à l'avantage de la base : la colonne « conformité » de la liste de
démonstration vient d'une valeur posée à la main dans `BRUT`, pas des
documents de la fiche, qui disent autre chose (AA105VA : la liste annonce
l'assurance à 74 jours, les documents une visite technique échue depuis six
jours) ; le compteur de la liste diffère du dernier relevé pour deux
véhicules ; le coût douze mois diffère d'un million environ sur quatre
véhicules (fenêtre glissante) ; deux prochaines échéances d'entretien
diffèrent parce que les ajustements du plan (`AJUSTEMENTS` de démonstration)
n'ont pas de table. Côté chauffeurs, seuls les kilomètres attribués s'écartent
(la démonstration confie au suppléant les jours d'indisponibilité du
titulaire ; ce raffinement viendra avec la fiche).

**Ce que la base ne porte pas encore** : l'attelage courant (pas de table
`attelage`), les ajustements du plan d'entretien (`plan_vehicule` vide). À
poser en migration 0004 avant de brancher la fiche véhicule.

**À faire, dans l'ordre.**

1. ~~Le seed~~ — fait.
2. **Le premier administrateur** : Authentication › Users › *Invite user* avec
   l'adresse du gestionnaire, puis dans le SQL Editor :
   `insert into profil (utilisateur_id, nom, role) values ('<uuid du compte>',
   'Prénom Nom', 'administrateur');`
3. **Vercel** : importer le dépôt GitHub, poser les trois variables de
   `.env.example` (`SUPABASE_SERVICE_ROLE_KEY` sans préfixe `NEXT_PUBLIC_`).
   Tant que les variables ne sont pas posées, l'application déployée tourne
   sur son jeu de démonstration — ce qui est déjà une recette utile.
4. **Le branchement écran par écran** (`src/donnees/` → `src/lib/supabase.ts`),
   en commençant par les référentiels.

---

## 0. Reprise rapide (session du 4 septembre 2026)

**Ce qui a été fait cette session.**

*Dettes techniques purgées* (les « suivis » de l'ancien §0, tous traités) :
- **Modale réactive** : un champ peut désormais en entraîner d'autres
  (`entraine` de `ModaleTransaction`). Choisir une autre dépense dans une sortie
  de caisse re-remplit libellé, montant, bénéficiaire et pièce.
- **Fiche d'un véhicule créé dans l'application** : `ficheVierge()`
  (`fiche-demo.ts`) et un rendu client de repli (`FicheVehiculeCreee.tsx`) —
  identité, documents manquants, et l'immobilisation administrative qui en
  découle dès le premier jour. Le lien de la liste ne mène plus à un 404.
- **Index de recherche** : la recherche globale lit le catalogue unifié (index
  du serveur **et** créations du navigateur, le même que `ChampReference`) et
  les véhicules créés.
- **Incident déclaré côté chauffeur** : `creationsLiees()` du contexte
  d'édition le fait remonter sur la fiche du véhicule cité, liste et journal.
- **Relevés** : le contrôle de cohérence se rejoue sur la série entière, et les
  kilométrages portés par les pleins, interventions et dépenses créés y entrent.
- **Agrégats de l'Aperçu** : `agregerCouts()` vit dans le domaine
  (`domaine/fiche.ts`), le serveur et la fiche appliquent la même règle — les
  charges, les dépenses mensuelles et le coût au kilomètre suivent les créations.
- **Statut déclaré → Disponibilité du jour** : le dernier statut déclaré prime,
  sauf immobilisation administrative.
- D_NPVEL / D_TICV étaient en réalité **déjà calculés** depuis les incidents par
  le tableau de bord livré ensuite : la note était périmée.

*Module **Rapports*** (décision du métier du 4 septembre : « Coûts & analyses »
devient **Rapports**, le coût n'étant qu'une dimension parmi d'autres) :
- `/rapports` — **catalogue de 25 rapports standards** en dix familles
  (Flotte, Coûts, Carburant, Maintenance, Conformité, Incidents, Chauffeurs,
  Achats & caisse, Prestataires), cherchable, avec favoris par compte.
- **Un rapport est décrit, jamais codé écran par écran** (`domaine/rapports.ts`) :
  colonnes typées, totaux déclarés, fenêtre de temps. Les lignes se construisent
  dans `donnees/rapports-demo.ts` — **un rapport ne calcule rien de neuf**, il
  lit ce que les modules calculent déjà.
- **Le maximum de colonnes** : jusqu'à 44 par rapport, dont les techniques
  (PTAC, PTRA, cylindrée, VNC, fin d'amortissement), et `parDefaut` décide de
  ce qui s'affiche à l'ouverture.
- **Période fine** (`domaine/periodes.ts`, `ChoixPeriode.tsx`) : aujourd'hui,
  hier, 7/30/90 jours, ce mois, le mois dernier, ce trimestre, le trimestre
  dernier, cette année, l'année dernière, 12/24 mois, tout l'historique, ou
  **deux dates posées à la main**. Elle est **dans l'adresse** : un rapport se
  partage par son lien.
- **Le maximum de filtres** (`FiltresRapport.tsx`) : chaque colonne de
  vocabulaire fermé **est** une facette, ses valeurs sont celles réellement
  présentes, comptées ; plusieurs valeurs par facette, conditions cumulées
  entre facettes. Rien à tenir à la main : une colonne de plus, un filtre de plus.
- **Colonnes rangeables** (`ColonnesRapport.tsx`) : glisser-déposer **et**
  Alt + flèches au clavier, l'identifiant figé en tête.
- **Réglages conservés par profil** (`reglages.ts`) : le dernier état de chaque
  rapport (colonnes, ordre, filtres, tri, période) est retenu sans qu'on le
  demande, et l'on peut enregistrer des **vues nommées** rappelées d'un clic.
- Export CSV de ce que l'on voit — colonnes choisies, dans leur ordre, tri et
  filtres du moment.
- `/couts` **redirige** vers `/rapports` : les liens déjà donnés survivent.
  Ce que l'écran portait s'y retrouve (coût au km avec verdict, postes,
  consommation, catégories, business units) ; **ses graphiques de synthèse
  rejoignent le tableau de bord**, qui reste le coup d'œil rapide.

*Suite de la même session — quatre demandes du métier traitées :*

- **Rapports personnalisés** livrés. « Nouveau rapport » choisit d'abord une
  **base** — le rapport standard qui décide de ce qu'une ligne compte et fournit
  le vivier de colonnes —, puis on compose ses colonnes, ses filtres et sa
  période avec un **aperçu vivant** (les vraies lignes, construites par le
  serveur comme celles du rapport final). Enregistré par compte, le rapport
  paraît dans le catalogue sous « Mes rapports », s'ouvre à l'adresse
  `/rapports/<base>?perso=<id>` et se retouche par « Modifier ».
  Fichiers : `composants/rapports/personnalises.ts`, `ChoixBase.tsx`,
  `EcranConstructeur.tsx`, page `/rapports/nouveau`.
  **Pourquoi une base plutôt qu'un choix libre parmi toutes les colonnes** : une
  ligne doit compter une seule chose. Mêler « litres du plein » et « échéance du
  permis » ne donne pas un rapport mais un produit cartésien. Croiser deux
  dimensions demandera une base de plus, pas un assouplissement de celle-ci.

- **Export Excel** (`src/lib/xlsx.ts`, écrivain `.xlsx` maison, sans
  dépendance — comme le lecteur `.xlsx` déjà écrit pour ce projet). Le CSV est
  remplacé par un classeur qui porte :
  un **cartouche** — le rapport, sa question, la période et ses deux dates, le
  périmètre du coût, les filtres posés, la recherche, le tri, le nombre de
  lignes, qui a exporté et quand ; un **vrai tableau Excel** (ListObject) à
  filtres automatiques, bandes alternées et en-tête figé ; et des **valeurs
  typées** — les montants sont des nombres, les dates des dates, donc sommables,
  triables et croisables, ce qu'un CSV de chaînes interdit. L'export reprend
  exactement ce qui est à l'écran : colonnes choisies **dans leur ordre**, tri et
  filtres du moment. Vérifié : archive relue partie par partie, XML équilibré,
  série de dates juste, échappement correct.

- **Rail réorganisé** (`coquille/navigation.ts`). Les groupes répondent
  désormais à *la question que l'on se pose*, pas au genre de la donnée :
  le **tableau de bord** passe en tête, **sans titre de groupe** — c'est l'écran
  d'entrée, et un tableau de bord n'est pas une tâche d'exploitation ;
  **Exploitation** (« qu'est-ce qui roule aujourd'hui, et avec qui ? ») reçoit
  **Transporteurs**, qui était en Pilotage — on affrète pour la journée ;
  **Suivi** (« quels processus sont en cours ? ») garde conformité, maintenance,
  incidents, carburant, caisse et prestataires ; **Pilotage** (« qu'est-ce que ça
  donne, en chiffres ? ») ne garde que **Rapports**, que le module IA rejoindra ;
  **Administration** est un groupe neuf pour **Paramètres** — régler
  l'application n'est pas piloter le parc.

- **Défaut d'hydratation corrigé** sur le catalogue : les favoris et les rapports
  personnalisés étaient lus *pendant* le rendu, ce qui faisait diverger le
  premier rendu du client de celui du serveur et faisait rejeter l'hydratation de
  la page entière. Ils se lisent maintenant dans un effet, après le montage —
  c'est la règle pour tout ce qui vit dans le navigateur.

### Module Transporteurs — livré sur les données réelles (4 septembre 2026)

Le métier a ouvert le dossier de la Direction des Opérations en cours de route.
**Le module n'est donc pas bâti sur des données inventées** : il l'a d'abord été,
puis refait sur ce qui existe.

**Ce qui a été trouvé et lu** (lecteur `.xlsx` maison en Node : ZIP +
`inflateRawSync`, ni Python ni poppler sur cette machine) :

- `61. Gestion Parc/BOCAR/M.SECK/TARIF TRANSPOTEURS.xlsx` — **la grille
  tarifaire**. Un tarif à la tonne par destination et par transporteur (Dakar
  2 500, Thiès 3 500, Touba et Kaolack 6 000, Saint-Louis 8 000, Ziguinchor
  jusqu'à 22 000 F/t), des forfaits au voyage pour les poulets (80 000 à
  140 000) et le phosphate, un forfait pick-up et cargo, et une feuille ADEX de
  mises à disposition à la journée.
- `62. Transport & Flotte Automobile/Données Finance/FACTURES DES TRANSPORTEURS
  2026.xlsx` — **38 feuilles**, janvier à avril 2026, une par transporteur et
  par mois ; **593 lignes de voyage** extraites.

**La question 42 trouve sa réponse — et se déplace.** « Les grilles tarifaires
transporteurs sont-elles formalisées par écrit ? » **Oui**, le tableur existe.
Ce qui reste à trancher n'est plus son existence mais son **statut** : un
tableur tenu par la gestion de parc n'est pas un contrat signé. Chaque ligne de
grille porte donc sa `source` — `contrat`, `accord-verbal`, `a-confirmer` — et
la vue Grilles compte celles qui sont opposables. Un écart ne se conteste que
sur une ligne opposable ; sur les autres, il se discute.

**Une mécanique de prix a été découverte et vérifiée**, qui n'était écrite nulle
part : *prix de grille × 1,05 = prix facturé, puis 5 % de retenue à la source
(BRS)* — **le transporteur touche net le prix de la grille**. Confrontation aux
factures : **56 lignes sur 57** concordent avec la grille × 1,05 (la 57ᵉ est un
prix au sac, une autre prestation), et **319 sur 319** vérifient net = TTC ×
0,95. C'est ce qui rend le contrôle de facture possible, et c'est pourquoi
l'écart se mesure **net à net** : comparer le TTC à la grille ferait apparaître
5 % d'écart sur chaque facture juste, et personne ne regarderait plus la colonne.

**Le module** (`domaine/transporteurs.ts`, `donnees/transporteurs-demo.ts`,
`composants/transporteurs/EcranTransporteurs.tsx`, `/transporteurs`) :

- **Affrètements** — la mission confiée : trajet, tonnage, **motif** (et le motif
  dit si l'externalisation était *subie* — aucun véhicule, véhicule immobilisé —
  ou *choisie* : trois affrètements par mois pour cause d'immobilisation ne se
  corrigent pas en négociant un tarif, mais en réparant le parc), dû net,
  facturé TTC, retenue, net, **écart à la grille**, étape et références Sage X3.
  Sept filtres, dont « écart de facturation » et « hors grille ».
- **Transporteurs** — les douze du référentiel, avec missions, tonnes, coût,
  restant dû, écart moyen, nombre hors tolérance et **base tarifaire**.
- **Grilles tarifaires** — les prix nets et les prix facturés côte à côte, la
  source de chacun, et le compte des lignes opposables en tête.

**C_TED_EXT alimenté** — l'un des six indicateurs du référentiel DO qui
attendaient leur source. **Arbitrage à faire valider** : le référentiel le
définit sur les **tonnes**, mais les tonnages internes viennent de SediLiv et
manquent encore ; il est donc calculé **en coût de transport**, et l'indicateur
l'écrit. Le jour où les tonnages arriveront, seule la base changera. À porter
avec la question 54, qui met déjà la cible de 35 % en doute face au modèle
transport 2026 (~60 %).

**Défaut corrigé au passage** : le tableau de bord disait « source à brancher »
dans **deux** cas très différents — l'indicateur sans source, et l'indicateur
dont la source existe mais dont la période ne porte rien. Confondre les deux
fait passer un module livré pour un module manquant, ce qui est arrivé au taux
d'externalisation le jour de sa mise en service. Les deux états sont maintenant
distincts (`non-alimente` / `sans-donnee`), et seul le premier compte dans
« en attente de source ».

**Ce qui reste sur les transporteurs** : la **pré-facturation** proprement dite
— produire la facture attendue et la confronter à celle du transporteur.

### Les prix d'énergie cessent d'être un chiffre unique (5 septembre 2026)

« Vu que les prix d'hydrocarbure changent, il faut prévoir une gestion
d'historique des prix, et utiliser les prix définis aux périodes dédiées. »

**Ce n'était pas un confort.** Un prix unique appliqué à tout l'historique
**réécrit le passé** : la dépense de carburant de janvier 2025 changeait de
montant parce que le gasoil avait baissé depuis, et le coût au kilomètre de
l'an dernier devenait faux. Un fait comptable se valorise au prix de son jour.

Les prix sont donc une **suite de barèmes datés** (`BaremeEnergie`) : chacun
entre en vigueur à sa date et vaut jusqu'au suivant, et chacun porte sa
**source** — arrêté, facture, relevé. C'est cette colonne qui dira, le jour
venu, ce qui a été vérifié : les quatre paliers livrés sont **plausibles, pas
authentiques**, et le disent. Le dernier reprend exactement les prix
qu'appliquait l'application jusqu'ici, de sorte que rien ne bouge sur la période
courante — seul le passé se corrige.

`prixEnergie(energie, date, parametres)` **exige désormais une date**, et c'est
délibéré : un appelant qui n'y pense pas ne doit pas obtenir silencieusement le
prix du jour pour valoriser un plein de l'an dernier. Le compilateur a fait la
revue à notre place — quinze erreurs, quinze endroits à dater.

**Revue des prix en dur, faite** : la série carburant des fiches (630 F/L
codé en clair), les livraisons de la cuve, la dotation carburant des mises à
disposition ADEX, et les pré-remplissages de formulaire. Vérifié dans
l'application : les pleins de janvier et février 2026 sont à 655 F/L, ceux de
mars à août à 630 — le palier du 1er mars ; et le journal de la cuve porte ses
quatre prix, de 705 F en 2024 à 590 F aujourd'hui.

**L'écran des paramètres** tient la suite : ajout d'un barème, date d'effet,
quatre prix, source, retrait. Les barèmes sont **retriés à l'enregistrement** —
un barème saisi après coup pour un mois passé doit se ranger à sa place, sinon
la recherche par date rendrait le mauvais prix.

### Le tableau de bord répond à trois questions, pas à une (4 septembre 2026)

Les courbes disaient *si ça monte*. Elles ne disaient ni *où va l'argent* ni
*qui le dépense* — et un total sur lequel on ne sait pas agir ne sert à rien.
Trois figures, donc, chacune pour une question
(`composants/tableau/Graphiques.tsx`, écrites à la main en SVG comme le reste) :

**1. La courbe, à deux séries.** Au premier plan les douze derniers mois, en
arrière-plan pointillé **les douze d'avant**. Une pente ne se juge pas seule :
« −8 % » ne veut rien dire tant qu'on ignore ce que faisait la même période un
an plus tôt. Le serveur servait déjà vingt-quatre mois — `PROFONDEUR_MOIS = 24`,
posée « pour comparer une période à la précédente » — et attendait qu'on s'en
serve.

L'infobulle suit le survol et donne les deux valeurs et leur écart : *juin 26 —
94,9 %, contre 100,0 % en juin 25, −5,1 %*. Elle remplace les `<title>` natifs,
qui n'apparaissaient qu'au bout d'une seconde et ne comparaient rien.

**Le chiffre d'écart de l'en-tête a changé de sens**, et c'est une correction :
il comparait le premier point de la courbe au dernier, ce qui mélangeait la
tendance et la saison. Il compare maintenant **les douze derniers mois aux
douze précédents**, sur les mois où les deux séries existent.

**2. L'anneau — où passe l'argent du transport.** Cinq parts, et le total au
centre. Ce qu'il montre du parc SEDIMA sur douze mois :

| | | |
|---|---:|---:|
| Mises à disposition (ADEX) | 206,2 M F | **39,6 %** |
| Autres charges du parc | 175,4 M F | 33,7 % |
| Maintenance du parc | 64,4 M F | 12,4 % |
| Prestations hors grille | 58,7 M F | 11,3 % |
| Affrètements au voyage | 15,5 M F | 3,0 % |

**La mise à disposition est le premier poste de dépense du transport**, devant
toutes les charges du parc hors carburant. Ce chiffre n'existait nulle part
avant aujourd'hui, et il donne au compte rendu ADEX — « contrat inadapté et à
revoir » — sa mesure.

Une précaution : les charges du parc suivent les filtres BU / catégorie / site,
le transport tiers non, faute d'être porté par un véhicule du parc. **Dès qu'un
filtre est posé, les parts tierces sortent de l'anneau** et la carte le dit —
rapporter une part filtrée à un total qui ne l'est pas donnerait un pourcentage
faux.

**4. Chaque dimension prend la figure qui lui convient.** Une décision de
fond, portée par le référentiel lui-même (`forme: "courbe" | "barres"`) :

> **Un flux se lit en barres, un état en courbe.** Trois accidents en mars et un
> en avril ne se relient pas d'un trait : il n'existe aucun instant entre les
> deux où l'on aurait mesuré « deux accidents ». Un taux de disponibilité, lui,
> existe à tout moment — la courbe dit vrai.

Passent en barres : accidents, contraventions, véhicules non conformes,
incidents produit, pannes en ligne (D_NPVEL), indisponibilité des véhicules
spéciaux (D_TICV), dépenses de parc et coût du transport tiers. La période
précédente n'y est pas une seconde barre — vingt-quatre barres sur douze mois
sont illisibles — mais **un trait posé sur la barre**, à la hauteur de l'an
dernier.

**Le lissage ne ment pas.** Les courbes sont interpolées en cubique
**monotone** (tangentes de Fritsch–Carlson) et non en Bézier naïve : entre deux
mois, le trait reste borné par les deux mesures. Sans cette précaution, une
disponibilité mesurée à 100 % puis 96 % passerait visuellement au-dessus de
100 %, et une consommation pourrait plonger sous zéro.

**L'infobulle s'ancre au point**, cartouche encre au-dessus de la mesure — elle
bascule dessous quand le point est trop haut, se recentre aux bords —, avec le
repère pointillé qui traverse le cadre et **la pastille du mois** en abscisse.
Les douze pastilles intermédiaires de la courbe ont disparu : ne restent que le
dernier point et celui qu'on survole.

**Le remplissage passe au-dessus du trait**, blanc en dessous, comme le modèle
donné par le métier — et **soutenu au contact de la courbe**, s'effaçant en
montant vers le haut du cadre. Deux partis, deux raisons : le blanc sous le
trait laisse lire les points bas, là où se trouve d'ordinaire ce qu'on cherche
— un creux de disponibilité, un mois sans accident ; et la teinte accrochée au
trait tient à la courbe plutôt qu'elle ne pèse sur l'échelle.

**Le choix des courbes est rangé par axe SQDCM**, comme celui des indicateurs :
dix-sept dimensions en vrac obligeaient à lire chaque libellé pour retrouver de
quoi on parlait. Les cinq colonnes rendent visible, en outre, ce qu'on ne suit
pas — un axe sans aucune courbe se voit d'un regard.

**Deux réglages du métier** : douze courbes affichables au lieu de quatre, et le
mode d'emploi du tableau replié dans un « i » — il occupait un bloc entier sous
les pastilles, utile la première fois, encombrant les suivantes.

**Un défaut corrigé, et il était grave** : deux indicateurs portaient
l'identifiant `c9` — « Coût du transport tiers », ajouté la veille, et « Solde
de la caisse parc ». La `Map` d'accès ne gardait que le second : cocher l'un
affichait l'autre, et React signalait deux enfants de même clé à chaque rendu.
Le nouveau est passé en `c13`, ce qui laisse les sélections déjà enregistrées
pointer sur ce qu'elles désignaient.

**Sur la fiche véhicule**, la tranche haute des barres empilées était arrondie
sur ses **quatre** coins — `rx` ne sait pas faire autrement — et se détachait de
la tranche du dessous. Elle est maintenant tracée à la main, arrondie par le
haut seulement.

**3. Les barres de contribution — qui pèse le plus.** Les six véhicules les plus
coûteux sur douze mois, chacun avec sa part, et le cumul en pied. Sur ce parc,
les six premiers font **44 %** de la dépense : la flotte est homogène, il n'y a
pas de gouffre isolé — ce qui est en soi une réponse, et oriente vers une
action sur le programme plutôt que sur un véhicule.

### Le plan d'entretien devient calculable (4 septembre 2026)

Jusqu'ici, « plan d'entretien » désignait six lignes de texte sur la fiche :
*« Vidange moteur + filtres — tous les 15 000 km »*. Rien ne s'en déduisait, et
la seule échéance suivie était une vidange posée d'avance sur chaque véhicule,
sans rapport avec ce que l'historique disait.

**Trois objets, et c'est leur enchaînement qui fait le module**
(`domaine/entretien.ts`) :

1. le **programme** — un gabarit par type de véhicule. Quatre, parce que quatre
   familles ne s'entretiennent pas pareil : le porteur et le tracteur, la
   semi-remorque (aucun moteur, tout le freinage), le léger, et l'**engin de
   manutention**, le seul qui compte des **heures**. C'est la réponse à « au
   kilométrage, ou horaire » ;
2. le **plan appliqué** — le gabarit rattaché au véhicule, avec ses
   **ajustements**. Chaque ajustement porte un motif : une périodicité resserrée
   sans raison écrite passe pour une erreur de saisie à la première revue de
   coûts. Trois véhicules s'écartent dans le jeu, dont un chariot électrique
   pour lequel la vidange moteur est **retirée** — elle n'a pas de sens ;
3. l'**échéance** — le plan confronté au compteur et à l'historique. Les trois
   bases coexistent et **la première atteinte l'emporte** : une vidange se fait
   aux 15 000 km *ou* tous les douze mois, selon ce qui arrive d'abord.

**L'état qu'il ne fallait pas escamoter.** Beaucoup d'opérations n'ont aucun
passage dans l'historique — ni le graissage du châssis, ni l'huile de pont. Deux
lectures, et l'application ne peut pas trancher : ou bien l'opération n'a jamais
été faite, ou bien elle l'a été sans être écrite. D'où un état à part,
`sans-reference` : ni « à jour » — ce serait mentir —, ni « en retard » — ce
serait crier au loup sur toute la flotte le premier jour. Il dit ce qu'il sait,
et il ne remonte pas dans le travail à faire : un trou d'historique n'est pas du
travail à programmer, c'est une vérification à faire sur le véhicule.

**Ce qui a fallu corriger dans le jeu de démonstration.** Au premier essai,
**les vingt-cinq échéances étaient « en retard »** — aucune « à planifier ». Non
parce que le parc l'était, mais parce que les deux séries s'ignoraient : les
objets d'intervention étaient tirés d'une liste fixe (« Vidange + filtres »…)
sans rapport avec les périodicités. Les entretiens préventifs sont désormais
**tirés du plan du véhicule** et datés à une fraction de leur périodicité
(20 % à 115 %) : la plupart sont à jour, quelques-uns arrivent, quelques autres
sont dépassés. On lit maintenant **9 en retard et 16 à planifier**, ce qui est
une charge d'atelier crédible.

**Un véhicule est entré au parc pour l'occasion** : le chariot élévateur
électrique de l'UAB (AA 412 UB). Sans lui, la base horaire n'aurait été qu'une
promesse dans le code. Il est hors périmètre de disponibilité (`engage: false`),
donc il ne touche à aucun indicateur de disponibilité.

**Ce que l'écran des programmes apporte** (`/parametres/entretien`) : le coût et
l'immobilisation du gabarit **sur un cycle de référence** — 1 863 000 F et
56 heures d'atelier par an pour un poids lourd à 60 000 km. Resserrer une
périodicité se paie, et le chiffre doit être sous les yeux au moment où on en
décide.

**L'ajustement passe par la modale de modification**, comme tout le reste : il
est tracé, horodaté, signé, relisible dans l'historique. Deux motifs y
coexistent, et ce n'est pas une redondance : « pourquoi ce véhicule s'écarte du
gabarit » reste sur la ligne du plan, « motif de la modification » trace le
geste du jour. La ligne se **recalcule** aussitôt : sans quoi elle afficherait la
nouvelle périodicité à côté de l'ancien état, et se contredirait sous les yeux
de celui qui vient de la régler.

**Ce qui reste** : les gabarits sont livrés **en lecture** — leur modification
attend qu'on tranche qui, du responsable de parc ou de l'atelier, en a la main
(**question 74**). Et le compteur horaire de l'engin est estimé sur la durée de
service, faute d'être relevé : une seule ligne de code changera le jour où
l'atelier le saisira.

### ADEX et les prestations hors grille (4 septembre 2026)

Les deux modèles qui manquaient. Ils ne sont pas des variantes de
l'affrètement : **ils coûtent quatre fois plus cher que lui**, et c'est en les
comptant que le taux d'externalisation devient crédible.

**La mise à disposition (ADEX)** — feuille « ADEX » du tableur de la DO, et une
note qui tient lieu de contrat : *« Tous les véhicules ADEX sont des mises à
disposition payable 6 jours sur 7 sauf en cas de panne avec dotation
carburant. »* Trois prix par jour selon ce que le véhicule porte : **130 000 F**
pour un porteur d'aliments, de farines ou de poulets, **45 000 F** pour la
camionnette à œufs, **85 000 F** pour la navette de son de blé.

Trois conséquences, et elles font tout le calcul :

1. **on paie six jours sur sept, roulé ou non.** Sur douze mois, les jours payés
   que le pointage ne voit pas représentent **182 jours, soit 18,3 M F**. La
   facture est juste — elle porte bien six septièmes du mois. Le gisement n'est
   pas dans la facture, il est dans le contrat ;
2. **la panne suspend le paiement**, mais seulement si quelqu'un l'a relevée ;
3. **le carburant est à la charge de SEDIMA**, servi à sa propre cuve : il
   n'apparaît sur aucune facture ADEX. **33,5 M F sur douze mois, un sixième du
   coût**, invisibles tant qu'on ne les rattache pas.

Les six immatriculations sont réelles — les véhicules marqués ADEX dans
`61. Gestion Parc/MALICK/CARBURANT/CONSOMMATION CARBURANT VEHICULES ADEX 2024 -
2025.xlsx`, dont les litres mensuels donnent les ordres de grandeur retenus.
C'est ce fichier qui prouve que leur carburant sort de la cuve SEDIMA.

**Le compte rendu de réunion tranche déjà dans ce sens.** « Présentation ADEX —
Externalisation du transport » (`62. Transport & Flotte Automobile/Données
Finance`) dit le contrat de mise à disposition **« inadapté et à revoir »**,
l'approvisionnement carburant depuis la pompe SEDIMA **« non maîtrisé »**, et son
plan d'action demande un contrat *« hors mise à disposition, couvrant toutes
charges, articulé au km, à la tonne ou à la mU »*. L'écran donne le coût complet
**à la journée et à la tonne** — 9 475 F/t sur douze mois, à comparer aux
2 500–22 000 F/t de la grille au voyage, **à distance égale seulement**. Au km,
il manque le relevé : personne ne compte les kilomètres d'un véhicule qui n'est
pas au parc, et c'est ce qui empêche aujourd'hui de répondre au plan d'action.

**Les prestations hors grille** — relevées une à une dans les factures 2026 : la
livraison d'œufs et de farine de Mouhamed Sy (facture N42-26, DA200-2601295), le
transport du personnel des abattoirs de Dame Ndoye (62 rotations à 21 050 F en
janvier), les farines et œufs de K2SBT (33 voyages à 60 000 F), les liaisons
Gambie d'Aïssata Gaye (250 000 F le voyage). **58,7 M F sur douze mois, un
cinquième du coût tiers**, qu'aucune grille ne permet de contrôler et qui ne se
comptent en tonnes nulle part.

**Une découverte au passage, et elle vaut de l'argent.** Deux conventions de
facturation coexistent pour une seule et même retenue :

| | Prix de référence | Facture | Le transporteur touche |
|---|---|---|---|
| Dème (et 56 lignes sur 57) | 140 000 | **147 368** | 140 000 |
| Mouhamed Sy, Dame Ndoye, Aïssata Gaye | 1 464 000 | **1 464 000** | **1 390 800** |

Même taux, même Trésor — mais dans le second cas le transporteur touche **5 % de
moins que le prix affiché**, soit **1,9 M F par an** sur les seules prestations
relevées. Ce n'est pas une erreur de calcul, c'est une clause absente : chaque
ligne porte donc sa `convention` (`net-majore`, `brut-retenu`, `inconnue`), et
douze prestations restent en `inconnue` faute de facture qui tranche
(**question 72**).

**Le taux d'externalisation change d'échelle.** Sur les seuls affrètements, il
donnait 6,4 % — un chiffre que personne au métier n'aurait reconnu. En comptant
les trois modèles : **55,4 %** sur l'année, contre une cible de 35 %. La
question 54, qui mettait déjà cette cible en doute face au modèle transport 2026
(~60 %), trouve là sa confirmation chiffrée.

**Deux défauts corrigés au passage**, tous deux antérieurs :

- **C_TED_EXT valait 100 % sur le mois en cours.** Un taux a besoin de ses deux
  termes : les premiers jours d'un mois portent déjà de la location tierce quand
  le parc n'a pas encore enregistré une dépense. L'indicateur rend maintenant
  « aucune donnée sur la période » plutôt qu'un rapport vrai par construction.
- **Le bandeau de KPI s'écrasait à un filet d'un pixel** dès qu'une vue était un
  peu chargée : il vit dans une colonne de hauteur fixe et son `overflow-hidden`
  ramenait sa taille minimale automatique à zéro. `shrink-0` le protège partout.

**Ce qui reste sur ADEX** : le relevé kilométrique (sans lui, pas de tarif au
km), le rapprochement avec une vraie facture ADEX — le fichier de factures 2026
n'en porte aucune, la mise à disposition se réglant hors de ce circuit —, et
donc la convention de facturation d'ADEX, toujours inconnue.

**Limite connue des rapports personnalisés** : ils vivent dans le navigateur,
donc le titre de l'onglet reste celui de la base, et un lien `?perso=…` envoyé à
un collègue ne lui montrera pas le rapport — il n'a pas la définition. En
production, une table `rapport_personnalise` côté Supabase lèvera les deux, et
rendra le partage possible.

*Suite de la session — **assistant du parc**, puis une salve de retours du métier
faite écran par écran :*

- **Assistant du parc livré** (`domaine/assistant.ts`, `donnees/assistant-demo.ts`,
  `composants/assistant/Assistant.tsx`). Accessible de partout depuis la barre
  d'application (Ctrl + J), il s'ouvre en volet à droite sans quitter l'écran.
  **Il répond depuis les lignes des rapports**, jamais d'un calcul à lui : le
  chiffre cité se retrouve à l'écran, à la même valeur. Chaque réponse porte les
  chiffres nommés, les lignes qui les composent, et **le lien de l'écran qui fait
  foi**. Dix-sept intentions couvrent flotte, disponibilité, immobilisations,
  conformité, coûts, consommation, cuve, maintenance, incidents, caisse, achats,
  chauffeurs, classement et prestataires ; citer une immatriculation donne la
  situation du véhicule. Il **lit seulement** : il ne crée, ne modifie, n'envoie
  rien — une transaction se crée dans un formulaire, avec son motif et sa trace.
  Contrat prêt pour l'API Claude : `Assistant.repondre(demande)`, asynchrone ;
  seule la ligne d'import changera.
  Deux défauts trouvés et corrigés à la vérification : le rapprochement se
  faisait sur des **fragments** de mots (« Dakar » déclenchait les demandes
  d'achat — il se fait maintenant sur des mots entiers), et le « dernier
  mouvement » d'un journal était pris **en tête** de liste alors que les journaux
  sont rendus du plus ancien au plus récent. Vérifié : les dix-sept exemples du
  catalogue retrouvent leur intention, onze questions posées autrement aussi, et
  cinq questions hors sujet ne déclenchent rien.

- **Rail réorganisé**, **export Excel** et **rapports personnalisés** : voir plus
  haut dans cette même section.

*Corrections livrées dans la salve :*

- **Filtres du tableau de bord** — ils fonctionnaient, mais la zone cliquable du
  `select` ne faisait que 20 px dans une pilule de 125 : le filtre passait pour
  cassé. Le `select` recouvre maintenant toute la pilule, et un chevron dit
  qu'il y a une liste à ouvrir.
- **Bloc « Ce qui demande une action » retiré** du tableau de bord (alertes du
  jour, dépenses par business unit) : les premières se lisent sur Conformité où
  on les traite, la seconde dans Rapports où on la filtre.
- **Pastilles d'indicateurs resserrées** (136 → 104 px) et **lettre d'axe
  retirée** : elle redisait ce que la colonne dit déjà. L'axe se marque
  désormais par un **filet de couleur en tête de colonne**, une fois pour toutes.
- **Menu du compte activé** : ses trois entrées étaient inertes. « Notifications »
  mène au réglage neuf ; « Mon profil » et « Identifiants et mot de passe » à
  `/profil`, qui dit l'identité dans l'application, renvoie au réglage des
  alertes, et **ne fait pas semblant** sur la connexion : l'authentification est
  déléguée à Supabase, le mot de passe ne se règle pas ici, et l'écran le dit
  plutôt que d'offrir un formulaire qui ne s'appliquerait nulle part.
- **Sept boutons d'ajout de la fiche véhicule branchés** (affectation, attelage,
  document, intervention, plein, dépense, relevé). Le geste vit dans
  `composants/vehicule/ajout.ts`, partagé avec le menu « Ajouter » : ils
  demandent la même chose, ils font la même chose.

---

## 4 ter. Transporteurs — le chantier calé le 5 septembre 2026

Brainstorm avec la Direction des Opérations, puis lecture du dossier DO. Ce qui
suit remplace le découpage précédent du module.

### Ce que le métier a dit, et qui change le modèle

**Il n'y a pas quatre catégories de transport, mais un modèle à trois axes.**
Le transporteur — **sous contrat ou non** — met à disposition un **certain
nombre de véhicules identifiés avec des chauffeurs identifiés**, et il est payé
**à la tonne livrée**. La journée est le régime des mises à disposition (ADEX
aujourd'hui, d'autres demain : « il faudrait garder la possibilité d'en
rajouter »), la mission celui du ponctuel. Le mode de rémunération est donc un
**attribut du contrat**, pas une catégorie — et le modèle n'a aucune exception.

**Tous les véhicules qui livrent ne se gèrent pas de la même façon.** Le camion
d'un transporteur dédié se suit dans le temps : il existe au référentiel. Le
camion d'un client venu enlever sa marchandise une fois, ou celui d'un
prestataire ponctuel, se note **sur la transaction** — immatriculation et
chauffeur, rien de plus. « Ça ne doit pas être une catégorie, ça doit être
rattaché à quelque chose de plus général. » D'où la règle qui commande le
référentiel : **on ne crée un objet que si on doit le suivre dans le temps**.

**Le tarif est par destination, la livraison ne l'est pas.** Les contrats fixent
Thiès, Touba, Kaolack ; on livre à Bayakh, Niakhirate, Kaniac. Il faut donc
**choisir la ligne tarifaire** à chaque livraison, **retenir le rattachement**
pour la fois suivante, et pouvoir poser une **exception** — prix exceptionnel ou
complément — qui, une fois jugée bonne, **devient la règle**. C'est ainsi qu'une
grille se construit réellement : par les cas rencontrés.

### Ce que le dossier DO a confirmé

**Compte rendu de réunion ADEX du 10 avril 2025** (Président, DGA, Directeur des
Opérations, ADEX) : « multiplicité des transporteurs (SEDIMA, ADEX, autres)
**sans pilotage unifié** » ; « contrat actuel (mise à disposition) **inadapté et
à revoir** ». Plan d'action : *partager les coûts de transport (F/tonne ou
F/mU) par transporteur*, et *élaborer un nouveau contrat avec ADEX **hors mise à
disposition**, articulé au km, à la tonne ou au mU*. La mise à disposition n'est
donc pas une exception à préserver : c'est une exception à faire disparaître.

**`RECAP TONNAGE HEBDOMMADAIRE.xlsx`** — treize semaines, et c'est exactement le
modèle décrit : par transporteur, un chauffeur nommé, un camion immatriculé, un
téléphone, puis destination et tonnage jour par jour. **SEDIMA y figure comme un
transporteur parmi les autres** — le pilotage unifié que le CR réclame existe
déjà sur ce tableau. Trente-huit camions relevés, dont une ligne « AUTRES » qui
est la catégorie hors contrat, et qui a son propre bon de commande (« BONCDE2 ·
2026 DIVERS TRANSPORT ROUTE »).

### Phase 1 — livrée

- **`domaine/flotte-tierce.ts`** : forme (société ou particulier), contrat, modes
  de rémunération, `CamionTiers`, `ChauffeurTiers`, rattachement de localité,
  exception tarifaire.
- **`donnees/flotte-tierce-demo.ts`** : les **immatriculations et chauffeurs
  réels** du relevé — dix camions chez Abdou Dieng, sept chez Abdou Kane, sept
  chez ADEX —, et quarante rattachements de localités.
- **Fiche transporteur** (`/transporteurs/PRE-…`), sur le modèle de la Flotte :
  identité, contrat, flotte, activité, grille. Elle donne le **coût à la tonne**
  par transporteur que le CR réclame — 10 178 F/t chez Abdou Dieng.
- **Le faux « hors grille » est corrigé** : `tarifApplicable` cherche la
  destination littérale, puis la destination **rattachée**. Les affrètements de
  démonstration partent désormais vers les localités réelles (Bayakh, Pout,
  Zig), et une livraison à Bayakh se facture au tarif de Notto — 25 t × 3 500 =
  87 500 F — au lieu de ressortir hors grille.
- Les missions portent enfin **les camions et chauffeurs du référentiel** au lieu
  d'immatriculations tirées au sort.

### Phase 2 — livrée : le relevé de transport

**`/releve`** — le tableau que la DO tient à la main, porté dans l'application.
Une ligne par chargement : la date, **qui a exécuté**, le camion, le chauffeur,
la destination réelle, le produit, le tonnage annoncé et le tonnage pesé.
2 926 chargements sur douze mois.

**Le mode d'exécution est le pivot**, et il porte la règle du référentiel :

| Mode | Camion et chauffeur | Ce qu'on paie |
|---|---|---|
| Parc SEDIMA | au référentiel (Flotte, Chauffeurs) | charges fixes, aucune facture |
| Transporteur | **au référentiel tiers** | à la tonne livrée, ou à la journée |
| Enlèvement client | **simple mention** sur la ligne | rien — le client emporte |
| Prestataire ponctuel | **simple mention** | à la mission |

Les deux derniers modes ne créent aucune fiche : « ces informations-là ne vont
pas être une catégorie, ça doit être rattaché à quelque chose de plus général ».
Une immatriculation notée à la volée s'affiche en gris et ne mène nulle part —
et c'est exactement ce qu'on veut.

### Ce que le relevé débloque : les six indicateurs du référentiel DO

**Question 71, résolue.** Le taux d'externalisation se calcule enfin **en
tonnes**, comme le référentiel le définit, et non plus en coût faute de mieux.
Les deux bases convergent — **56,7 % en tonnes contre 55,4 % en coût** sur
l'année —, ce qui donne rétrospectivement raison à l'approximation.

**C_CDM_SEDI et C_CDM_TR, alimentés.** Les deux coûts à la tonne que le plan
d'action du compte rendu ADEX réclamait — « partager les coûts de transport
(F/tonne ou F/mU) par transporteur » — sont calculés :

| | Sur l'année | Cible |
|---|---:|---:|
| Coût de transport — flotte SEDIMA | **14 024 F/t** | ≤ 14 000 |
| Coût de transport — tiers | **12 686 F/t** | ≤ 16 000 |
| Taux d'externalisation (tonnes) | **56,7 %** | ≤ 35 % |

**Ce que ces trois chiffres disent ensemble mérite d'être posé sur la table :
sur ces données, le transport confié à des tiers coûte moins cher à la tonne
que le parc.** Si le rapport se confirme sur les données réelles, la cible de
35 % d'externalisation ne se défend plus par le coût — elle ne peut se défendre
que par la maîtrise du service, la disponibilité ou la dépendance. C'est la
question 54, et elle devient chiffrée.

**Trois défauts de méthode corrigés en chemin**, tous du même genre — un ratio
dont les deux termes ne couvrent pas la même période :

1. la **mise à disposition se facture au mois** ; sur un mois entamé, le 2
   septembre portait trente jours de location contre deux jours de tonnage, et
   le coût tiers ressortait à 67 725 F/t. Elle est désormais mise au prorata
   des jours écoulés ;
2. le relevé, d'abord tenu sur treize semaines comme le tableur, rapportait
   douze mois de charges à trois mois de tonnage — 51 000 F/t au lieu de
   14 000. Il couvre maintenant l'année ;
3. un **coût nul** sur un mois à peine commencé n'est pas « le transport est
   gratuit » : l'indicateur n'affiche plus rien plutôt qu'un zéro.

### Refonte du module Transporteurs (5 septembre 2026, en fin de journée)

Consigne du métier : « tout ce qui est rapport de transport doit rester sur la
page Rapports. Simplifier la page transporteur avec la liste des transporteurs
et les colonnes nécessaires, et dans chaque ligne on rejoint la page du
transporteur avec son identification incluant les termes de contrats, les
performances, la liste de ses véhicules et chauffeurs, la liste des transactions
(livraisons) avec la possibilité de créer des lignes. Structurer comme les vues
Véhicules et Chauffeurs. »

**Un écran de référentiel liste ; il n'analyse pas.** Les cinq vues qui
vivaient sur `/transporteurs` — affrètements, mises à disposition, prestations,
activité, grilles — ont été réparties :

| Ce qui vivait là | Où c'est allé |
|---|---|
| Affrètements, mises à disposition, prestations | fiche du transporteur, onglet **Facturation** |
| Grilles tarifaires | fiche, onglet **Grille tarifaire** |
| Activité comparée des transporteurs | **liste**, en colonnes |
| Relevé de transport (écran dédié) | **Rapports** — rapport « Relevé de transport », dix-sept colonnes |

**La fiche transporteur** est désormais bâtie comme la fiche Véhicule : un
en-tête avec la note et le statut contractuel, cinq chiffres, six onglets —
Identité (dont les termes du contrat et les modes de rémunération), Flotte
(camions et chauffeurs nommés), **Livraisons**, Facturation, Grille, Notation.

**Les livraisons se saisissent depuis la fiche** : bouton « Nouvelle livraison »,
modale de création, et modification ligne à ligne — comme toute transaction de
l'application, avec sa trace. Un transporteur en mise à disposition portant plus
de quinze cents chargements sur l'année, la table s'ouvre sur **les trois
derniers mois** — la période qu'on contrôle — et l'historique complet reste à un
clic.

L'écran `/releve` et l'entrée de menu qui l'accompagnait ont disparu : le relevé
se saisit là où il se produit — sur le transporteur — et se lit là où on
l'analyse — dans Rapports.

### La notation des transporteurs — livrée

Demandée au brainstorm (« qu'on puisse mesurer la performance de chaque
transporteur ») et au carnet du 4 septembre pour les prestataires (« une
pastille avec code couleur, plusieurs dimensions, quatre à cinq niveaux »).

**Le parti pris : rien ne se saisit.** Cinq dimensions calculées sur des faits
déjà enregistrés — tenue du prix (30 %), fidélité du tonnage (25 %), assise
contractuelle (20 %), régularité (15 %), coût à la tonne (10 %). Une notation à
la main se remplit trois mois puis plus personne ne la tient ; une notation
calculée est toujours à jour et, surtout, **elle se conteste** : le transporteur
à qui l'on dit « vous facturez 2,8 % au-dessus de la grille sur 23 missions »
peut vérifier.

**Ce qu'elle ne mesure pas est écrit sur la fiche** : ponctualité, état des
camions, tenue des chauffeurs. Ce sont des jugements ; il reste à trancher qui
les porterait et à quelle occasion.

**Deux garde-fous, posés après avoir vu les résultats :**

1. **absent du relevé n'est pas « irrégulier »**, c'est « pas mesuré » — un
   transporteur d'œufs payé au sac n'y figure pas, et lui donner zéro le
   jugerait sur un critère qui ne le concerne pas ;
2. **trois dimensions au moins, sinon aucune note.** Cinq transporteurs
   ressortaient « Insuffisant 0 » alors qu'on ne savait d'eux que l'absence de
   contrat. Une note qui ne repose que sur ce qui manque juge le dossier, pas le
   transporteur. Ils sont désormais **non notés**, ce qui est la vérité.

**Ce que la notation donne, et ce qu'elle révèle :**

| Transporteur | Note | Ce qui la fait |
|---|---|---|
| ADEX Express | **Bon 81** | le seul sous contrat écrit |
| Abdou Dieng · Abdou Kane · Moussa Kane | Fragile 42 à 51 | prix tenus, mais aucun écrit |
| Sokhna Diop · Dème · Abdou K. Diop | Insuffisant 21 à 36 | écarts de 4 à 9,5 % sans rien d'opposable |
| 5 autres | non notés | trop peu de matière |

**Le classement est dominé par le vide contractuel**, et c'est en soi le
constat : le seul transporteur bien noté est le seul à avoir un écrit.

**Deux incohérences corrigées en chemin, révélées par la notation elle-même :**

- la grille d'Abdou Kane et d'Abdou Dieng portait « contrat signé » alors que
  leur profil disait « aucun contrat écrit » — la fiche affichait « aucun
  contrat écrit · 100 % de la grille opposable ». Les sources sont alignées sur
  ce que le métier a tranché : **aucun contrat**, hors ADEX. La question 42 se
  lit maintenant **0 ligne opposable sur 71**, ce qui est la situation réelle ;
- **ADEX était absent de la liste des transporteurs** — elle ne retenait que
  ceux ayant des affrètements ou une grille, et l'activité d'ADEX est faite de
  mises à disposition. Le premier contributeur tiers du parc, 206,9 M F et
  21 765 tonnes, manquait au module dont l'objet est le pilotage unifié. La
  liste repose désormais sur l'agrégat partagé, qui compte les trois modèles.

### Ce qui reste

### Phase 2 — la réserve, levée

Le **relevé hebdomadaire** — transporteur, chauffeur, camion, destination,
tonnage, par jour — plutôt que « la livraison » : le métier a signalé que la
structuration des livraisons relève de l'équipe logistique, pas de cette
application. La nuance est importante et **reste à confirmer**. Ce relevé
donnerait le F/tonne par transporteur, le taux d'externalisation **en tonnes**
(question 71) et la pré-facturation.

**Les exceptions tarifaires sont livrées** : prix exceptionnel qui remplace le
tarif, complément qui s'y ajoute, motif obligatoire, et une pastille sur le
montant attendu — c'est là qu'on la cherche quand on se demande pourquoi ce
prix-là. Une livraison à Pout portée à 4 200 F/t au lieu du tarif de Thiès
donne 126 000 F au lieu de 105 000, et l'écart se mesure désormais contre le
prix convenu pour cette mission, non contre un tarif dont on savait qu'il ne
s'appliquait pas.

Restent : la **promotion d'une exception en règle** (le domaine la prévoit,
l'écran ne la propose pas encore), la **notation** des transporteurs, et le
chantier **prestataires** du carnet — dettes, avances, évaluation — qui n'a pas
été traité ici.

**La réserve sur la phase 2 est levée** (confirmé le 5 septembre) : l'outil
logistique n'existe pas, cette application doit donc porter le suivi des
livraisons affectées aux transporteurs, pour permettre les rapports et la
facturation rattachée.

---

## 4 quater. Le compte prestataire — 5 septembre 2026

Demande du carnet : « voir les dettes fournisseurs (travail effectué, paiement
non encore effectif), les avances, l'évaluation d'un service, et une notation
qui classe le fournisseur ».

**La dette ne se saisit pas, elle se déduit.** C'était la question posée au
cadrage, et elle décide de tout. L'application connaît déjà les demandes
d'achat livrées ou facturées, les affrètements livrés, les mises à disposition,
les prestations. Une dette saisie à la main divergerait de ces objets dès la
première semaine ; une dette déduite est **juste par construction**, et un
règlement enregistré dans la Caisse l'éteint ici sans double saisie. Vérifié :
la fiche de La Sénégalaise de l'Automobile affiche 691 k F de dette, exactement
ce que son aperçu porte déjà en « non réglé ».

**L'avance est le seul objet nouveau** : un décaissement qui ne solde rien
encore. Elle porte son motif, celui qui l'a autorisée, et surtout **la pièce sur
laquelle elle est imputée**. Deux des quatre avances du jeu restent ouvertes —
900 k F chez TATA Pikine, 5 M F chez ADEX —, et l'écran le signale : une avance
qui traîne dit ou que le service n'a jamais été rendu, ou qu'il l'a été sans que
personne ne le rapproche.

**L'évaluation se saisit, et c'est assumé.** La qualité d'une réparation ne se
déduit d'aucune donnée. Trois critères — qualité, délai, prix —, notés de 1 à 5
à la réception du service, quand l'avis est frais. Au-delà de trois, personne ne
remplit. Deux dimensions s'ajoutent, calculées celles-là : les **reprises** —
deux interventions sur le même véhicule pour le même objet à moins de soixante
jours — et l'**ancienneté** de la relation.

**Ce que la notation donne**, sur cinq dimensions et cinq niveaux :

| Prestataire | Note | Ce qui la fait |
|---|---|---|
| Garage SEDIMA | Bon 83 | une évaluation excellente, aucune reprise |
| La Sénégalaise de l'Automobile | Bon 78 | 4,3 sur 5 en qualité et en délai, 3,7 sur le prix |
| ADEX Express | Acceptable 68 | régulier, mais le contrat à la journée pèse sur le prix |
| First Garage | Fragile 47 | 2,0 sur 5 en délai — trois semaines au lieu d'une |
| 21 autres | non notés | aucune évaluation saisie |

**Vingt et un prestataires sur vingt-cinq ne sont pas notés**, et c'est la
vérité du démarrage : la notation ne s'invente pas, elle se remplit à mesure
que les services sont reçus. Le seuil de trois dimensions mesurées empêche de
publier une note qui ne reposerait que sur ce qui manque.

**Un défaut corrigé** : les évaluations citaient des numéros d'intervention
inventés, qui n'existaient pas dans le jeu — la colonne « Pièce » pointait dans
le vide. Chaque évaluation est désormais **rattachée à une intervention réelle**
du prestataire, la plus proche de sa date, et datée du lendemain du service.

---

## 4 bis. Carnet du métier — salve du 4 septembre 2026

Retours faits écran par écran, dans l'ordre où ils sont venus. **Rien n'est
commencé** sur ces points sauf mention contraire.

| # | Demande | Portée |
|---|---|---|
| 1 | ~~**Transporteurs**~~ — **fait**, et **sur les données réelles du dossier DO** (voir plus bas). Cinq vues : affrètements au voyage, **mises à disposition ADEX**, **prestations hors grille**, activité par transporteur, grilles tarifaires et prix journaliers avec leur source. **C_TED_EXT est alimenté — 55,4 % sur l'année**, très au-dessus de la cible de 35 %, et proche des ~60 % que la question 54 soupçonnait. Quatre rapports au catalogue. | — |
| 2 | ~~**Maintenance préventive**~~ — **fait**. Quatre gabarits par type de véhicule (`/parametres/entretien`), appliqués à la création, **ajustables véhicule par véhicule avec motif** dans l'onglet Maintenance de la fiche, et suivis en alerte sur l'onglet comme dans le travail à faire. L'engin de manutention compte des **heures**, pas des kilomètres. | — |
| 3 | ~~**Historique des prix d'énergie**~~ — **fait**. Les prix sont une **suite de barèmes datés** (`/parametres/energie`), chacun en vigueur jusqu'au suivant ; pleins, livraisons de cuve et dotations ADEX se valorisent au barème de leur date. Revue faite : plus aucun prix de carburant en dur hors des barèmes. | — |
| 4 | **Budget** — à définir et à suivre contre les dépenses. | Grande |
| 5 | ~~**Prestataires**~~ — **fait**. Onglet **Compte** (dette déduite des pièces, avances ouvertes et imputées, solde net) et onglet **Évaluation** (trois critères saisis à la réception, deux dimensions calculées, pastille à cinq niveaux). Colonnes « Notation » et « Reste dû » dans la liste. | — |
| 6 | ~~**Notifications**~~ — **fait**. `/parametres/notifications` : dix sortes d'alerte × trois canaux (application, courriel, Teams), prévenance J−90…J−1, suspension générale, réglage par compte enregistré à chaque clic. `domaine/alertes.ts` porte le catalogue. Les trois entrées du menu du compte mènent quelque part : Profil et Identifiants vers `/profil` (neuf), Notifications vers l'écran de réglage. | — |
| 7 | ~~**Photo du véhicule**~~ — **fait**. Cadre dans l'en-tête de la fiche, vignette en colonne facultative de la liste Flotte, repli par silhouette de catégorie quand il n'y a pas de photo. Le téléversement **redimensionne à 480 px en JPEG avant d'enregistrer** (une photo de téléphone pèse trois mégaoctets, le stockage du navigateur en tient cinq en tout) ; le changement est tracé comme toute modification de fiche. | — |
| 8 | ~~**Aperçu de la fiche véhicule**~~ — **fait**. « Dépenses mensuelles » est empilée par famille (`GraphiqueBarresEmpilees`, légende, infobulle par tranche, total au sommet) ; `CoutMensuel` porte désormais son détail `parGroupe`. La carte « Consommation mensuelle » est retirée — elle se lit dans l'onglet Carburant et dans le rapport de consommation. | — |

**Ce qui reste sur la table** (demandé le 4 septembre) :
1. ~~**Tableau de bord** : courbes à deux séries, anneau de répartition, barres
   de contribution~~ — **fait** (voir plus bas). Restent les références Fleetio
   « Standard Reports » et « Filters » pour d'éventuels raffinements de filtrage.

---

## 0 bis. Reprise (session du 3 septembre 2026, nuit)

**Où on en est.** Le **Lot 1 est complet en démonstration** et vérifié dans un onglet
neuf du navigateur : Flotte (liste, création d'un véhicule, fiche 360° modifiable),
Chauffeurs (fiche, SQDCM, classement, sanctions confidentielles), Affectations
(planning zoomable ; **un clic sur une barre ouvre l'affectation**), Conformité,
Disponibilité du jour, Incidents & sinistres, **Caisse & achats** (module F : journal
de caisse à dépense rattachée obligatoire, dépenses en attente de règlement, demandes
d'achat et circuit de validation à seuil ; une seule caisse parc, tranché), Paramètres.
Le **Lot 2 est entamé** : **Maintenance** (à faire déduit des fiches → ordre de
travail OTR → clôture qui crée l'intervention INT sur la fiche, §3) et **Carburant**
(pleins de la flotte, journal de la cuve interne dont les sorties sont les pleins et
le stock recalculé, consommation par véhicule contre la référence, §3). Décisions du
métier intégrées la même nuit : **chaque véhicule porte son énergie** (gasoil, essence,
électrique, hybride), **les prix de l'énergie et la contenance de la cuve sont des
Paramètres** (`/parametres/energie`), et les **prestataires** ont leur page
(`/prestataires`, entrée Suivi du rail après Caisse & achats, choisis comme garage d'un ordre de travail).
**Session du 3 septembre, soir — décision du métier : l'application ne se substitue pas à
Sage X3.** Tout le processus d'achat (DA, bon de commande, réception, facture, règlement)
vit dans X3. Ici : rattacher une DA ou une sortie de caisse à un véhicule, une
intervention ou un incident, en connaître le **coût**, et **suivre à quelle étape en est
chaque DA** — soumise, visa parc, validée, puis, constatées depuis X3, commandée, livrée,
facturée, réglée (`/caisse`, vue Demandes d'achat). Une première version à cinq vues
(commandes BCO, réceptions REC, factures FAC, rapprochement à trois voies) a été
**retirée le soir même** pour cette raison : ne pas ressaisir ce que X3 tient déjà.
Les **prestataires** ont leur **fiche** (`/prestataires/PRE-…`, comme un véhicule ou un
chauffeur : indicateurs, achats par mois, demandes, interventions, pleins, caisse,
documents, visites) et la liste porte leurs statistiques sur douze mois. Les champs
**« transaction d'origine » des formulaires sont des sélecteurs contrôlés**
(`ChampReference`) : proposition depuis l'index, refus d'un numéro inconnu, d'un mauvais
type ou d'un autre véhicule — « pour être sûr du rattachement ». **Coûts & analyses** est
livré (`/rapports`, Pilotage) : synthèse, coût au kilomètre de chaque véhicule situé dans sa
catégorie (l'arbitrage réparer / réformer), postes × mois, consommation véhicule × mois —
tout lu sur les fiches, deux périmètres pour la question 52. Le **tableau de bord SQDCM
du parc** est livré et devient l'**écran d'entrée** (`/`), **refait sur la maquette
« Parc SEDIMA »** de la Direction des Opérations : cinq axes, **38 indicateurs
disponibles** dont les **six du référentiel DO** (D_TDPA, D_TICV, D_NPVEL, C_CDM_SEDI,
C_CDM_TR, C_TED_EXT) affichés par défaut, **sélection composable et mémorisée**,
alertes du jour, véhicules les plus coûteux et dépenses par business unit. Tout passe par
les transactions numérotées, modifiables avec trace, et les mois clos. Les tableaux
des fiches ont un **en-tête figé** et un **choix des colonnes** par compte
(`TableauSimple`, `ChoixColonnes`). `npx tsc --noEmit` propre, serveur de
développement sur le port 3000.

**Par où continuer.**
1. Lire ce document jusqu'au §4 ; `docs/CADRAGE-INCIDENTS.md` si l'on touche aux
   incidents.
2. **Faire valider Caisse & achats, Maintenance et Carburant écran par écran** avec le
   métier (points ouverts en §3 sous chaque module : seuil et rôles du circuit
   d'achat, qui approvisionne la caisse ; rôles de l'atelier, effets de la clôture
   d'un ordre ; contenance de la cuve, fréquence des livraisons, seuils de jauge et
   de dérive).
3. **Faire valider le suivi des DA dans Sage X3** (étapes constatées, qui constate quoi,
   n° de DA et de BC X3, coût facturé → dépense du véhicule) et la **fiche prestataire**.
   **Faire valider Coûts & analyses** (périmètre exploitation / complet — question 52 —,
   seuils du verdict au kilomètre, références L/100 par catégorie, le coût par tonne
   attendra SediLiv). **Faire valider le tableau de bord SQDCM** : les cibles reprises de
   la maquette, et surtout les **dix-huit indicateurs qui attendent leur source**
   (télématique, tonnages et livraisons SediLiv, pont bascule, RH) — dont trois des six
   du référentiel DO. **Confronter les autres écrans de la maquette** (Flotte, Fiche
   véhicule, Caisse, Achats) à ce qui est livré.
   Puis la suite du **Lot 2** : dossiers sinistres, inspections mobiles.
4. Garder les suivis notés dans §4 (statut déclaré → disponibilité, D_NPVEL /
   D_TICV, pièces jointes, fiche d'un véhicule créé dans l'application, index de
   recherche des créations, agrégats de l'Aperçu qui ignorent les créations).

**Règles à ne pas oublier** (détail en §5 et §6) : vocabulaire du code en français,
commentaires qui disent pourquoi ; aucun menu déroulant là où un bouton à segments
suffit (refusé par le métier sur la Disponibilité) ; pas de bandeau de KPI sur un
écran de liste ; un onglet = un seul type de transaction ; vérifier dans un onglet
**neuf** du navigateur (les erreurs console d'un onglet ancien sont des résidus HMR) ;
écrire les scripts d'édition dans un fichier plutôt qu'en ligne de commande (les
guillemets cassent sous PowerShell/Git Bash) ; mettre REPRISE.md et LISEZMOI.md à
jour après chaque livraison.

---

## 1. De quoi il s'agit

**SEDIMA Logistique & Distribution** — application de gestion de la flotte automobile
de SEDIMA SA (agro-industrie avicole, Sénégal). Utilisateurs : l'équipe de gestion de
parc. **Les chauffeurs ne sont pas utilisateurs.**

Elle est le **système de référence du parc**. Le module M3 « Flotte et transporteurs »
de l'extension SediLiv, chiffré 12 890 500 FCFA HT par HTSoft, **ne sera pas
développé** : cette décision est actée, et le cahier des charges §8 vaut désormais
spécification pour cette application.

Périmètre cible, par lots :

| Lot | Contenu |
|---|---|
| 1 | Référentiel véhicules, fiche 360°, chauffeurs et permis, affectations datées, conformité et alertes, disponibilité du jour, caisse parc, demandes d'achat, **déclaration des accidents et incidents** (formulaire en quatre étapes, voir `CADRAGE-INCIDENTS.md`) |
| 2 | Maintenance préventive et curative, inspections mobiles, carburant et cuve, BC / réceptions / rapprochement à trois voies, coûts par véhicule, tableau de bord SQDCM, **dossiers sinistres** |
| 3 | Transporteurs et pré-facturation vers Sage X3, interface X3 du cycle achat, télématique, tonnages, capacité publiée, scorecards SQDCM, KPI historisés, mobile hors connexion, budget et renouvellement |

---

## 2. Documents de référence

Ils sont hors du dépôt, dans OneDrive :

| Document | Emplacement | À quoi il sert |
|---|---|---|
| Note de cadrage | Artifact publié en session | Modèle de données, écrans, phasage, 66 questions ouvertes |
| Cadrage incidents | `docs/CADRAGE-INCIDENTS.md` | Déclaration des accidents et incidents : formulaire, cycle de vie, modèle, Q67–Q70 |
| CDC Extension SediLiv v1.4 | `DO - Documents/6. Logistique & Distribution/69. Autres/` | Spécification de référence, section 8 |
| Charte de formatage | `40 Applications (DEV)/SEDIMA Operations/SEDIMA-OCT/docs/SEDIMA-charte-formatage.md` | **Identité** : Inter, vert SEDIMA, règle des 95 % |
| Références de traitement | Maquettes Dribbble « kiosk management » (Viktoriia) : shots 23326248, 23443759, 25472258, 25572701, 23582244 | **Traitement** : aéré, graisses légères, cartes arrondies à ombre douce, pilules, pagination |
| Modèle d'accès | `SEDIMA-OCT/auth.js` + `docs/AUTHENTIFICATION.md`, `docs/DROITS_RLS.md` | Supabase Auth, `get_me()` en SECURITY DEFINER, MFA admin |
| Données du parc | `DO - Documents/6. Logistique & Distribution/62. Transport & Flotte Automobile/` | 859 fichiers, dont 694 factures PDF |
| Tonnages livrés | `.../63. Logistique Usines/634. Suivi des Livraisons Usines/` | Dénominateur des KPI de coût |
| **Maquette « Parc SEDIMA »** (remise le 3 septembre au soir) | Artifact `5522637c-dd75-4547-ac73-b050a81a59f7` sur claude.ai | **La référence de l'écran d'entrée** : tableau de bord SQDCM à cinq axes, **38 indicateurs disponibles** dont les **six du référentiel DO** par défaut, sélection composable et mémorisée, blocs « Ce qui demande une action » et « Dépenses par business unit ». Contient aussi des maquettes Flotte, Fiche véhicule, Caisse et Achats, à confronter aux écrans livrés. |
| Dossier de gestion du parc (remis le 3 septembre) | `DO - Documents/6. Logistique & Distribution/61. Gestion Parc/` | Ce que le métier tient à la main : `Admnistrative/ETAT REGLEMENT.xlsx` (n°, date, fournisseur, montant, **DA**, **BC**, description — l'état de règlement des fournisseurs), `DA ET PRESTATAIRE.xlsx`, `FICHE SUIVI 2026/FICHE DEPENSES VEHICULES 2026.xlsx` (désignation, **n° DA Sage X3 « DA200-2601023 »**, fournisseur, immatriculations, montant), `BOCAR/M.SECK/SUIVI DEPENSES PARC 2025 - 2026.xlsx` (dépenses par rubrique), `Maintenance/Factures/` (1 015 bons de commande X3 en PDF, « BC18767 CFAO SENEGAL »), `CARBURANT/`, `Depense CAISSE/`, assurances, pneus, batteries, huiles, péages, pointage. Lecteur `.xlsx` en Node : `lirexlsx.mjs` de la session (ZIP + `inflateRawSync`, à recréer au besoin). |

> Ni Python ni poppler sur cette machine. Node v24 est disponible : pour lire un
> `.xlsx` ou un `.docx`, écrire un petit lecteur ZIP + `zlib.inflateRawSync`.
> Sous Git Bash, un chemin `/c/Users/...` contenant une apostrophe n'est pas
> converti : utiliser la forme `C:/Users/...`.

---

## 3. Ce qui est livré

Application Next.js qui tourne (`npm run dev`), compile (`npm run build`) et passe
`npx tsc --noEmit`, sans erreur console.

- **Système de design** — `src/app/globals.css` : identité de la charte SEDIMA, traitement des
  références Dribbble (voir « Décision de design » ci-dessous). Utilitaires `carte`,
  `bouton-principal`, `bouton-secondaire`, `bouton-discret`, `champ-pilule`, `en-tete-colonne`.
- **Coquille** — barre d'application (picto, nom, recherche transversale `Ctrl+K`,
  menu du compte), rail de navigation rétractable, titre d'écran dans le contenu.
- **Page de connexion** — alignée sur celle de SEDIMA Opérations : panneau de marque
  à gauche, formulaire à droite, comptes de démonstration sous le bouton.
- **Page Flotte** — 18 véhicules réels, colonne Immat. figée (la seule, à la demande
  du métier), largeurs déclarées et ajustables, sélecteur de colonnes, filtres en
  bascule, en-tête figé, pagination en pied (25/50/100). Chaque ligne ouvre la fiche.
- **Fiche véhicule 360°** — `/flotte/<immatriculation>`, toute écriture acceptée,
  `?onglet=` pour viser une section. **En-tête fixe** (retour, identité, six
  indicateurs, onglets) : seul le contenu de l'onglet défile. **Règle de structure
  posée par le métier le 2 septembre au soir** : l'Aperçu porte tout ce qui s'agrège,
  s'analyse ou alerte — charges en trois familles **Carburant / Maintenance / Autres**,
  alertes, dépenses mensuelles, consommation, situation, échéances — et chaque autre
  onglet est une **liste de transactions d'un seul type** : Caractéristiques,
  Affectations, Conformité (documents), Entretien (interventions, pièces et pneus),
  Carburant (les pleins, pas de rapport mensuel — il ira dans Coûts & analyses), Autres
  dépenses, Kilométrages (relevés et verdict du contrôle), Journal (chronologie et
  périodes de statut). Le plein est la transaction élémentaire du carburant : le cumul
  mensuel n'est qu'une lecture.
  Données de démonstration dérivées de la ligne de flotte (`src/donnees/fiche-demo.ts`),
  types de vue dans `src/domaine/fiche.ts`. AA 032 EA reprend les valeurs de la maquette.
- **Dépenses et relevés sur la fiche** — l'onglet Coûts liste **toutes** les dépenses
  rattachées au véhicule, maintenance comprise mais aussi carburant, assurance et
  documents, pneus, péages, frais de route, contraventions, divers — avec l'origine du
  décaissement (caisse parc, bon de commande X3, facture). Les agrégats par poste et par
  mois **en sont dérivés**, jamais saisis à part. **Chaque dépense porte un relevé
  kilométrique** (demande du métier du 2 septembre : chaque intervention, plein ou autre
  est une occasion de relever le compteur) ; l'historique des relevés, d'origine tracée
  (plein, garage, dépense, balise), s'en déduit et donne l'odomètre courant.
  **Chaque relevé passe le contrôle de cohérence** de `src/domaine/releves.ts` (valeur
  nulle, compteur qui recule, progression au-delà d'un plafond par catégorie) : un relevé
  incohérent reste visible, barré et motivé, mais n'alimente ni l'odomètre ni les
  échéances. L'onglet **Kilométrage** porte l'historique complet avec le verdict ligne à
  ligne ; l'Aperçu montre la situation du jour (titulaire, conformité, dernière
  intervention), la consommation, l'activité récente, les échéances et les coûts en bref. La colonne « Coût 12 mois » de la liste vient encore du jeu de démo de
  la liste, pas des dépenses : les deux se rejoindront au branchement de la base.
- **Composants de base** — `Carte`, `Definitions`, `TableauSimple`
  (`src/composants/interface/Carte.tsx`), `GraphiqueBarres` en SVG à la main.
- **Liste de référentiel réutilisable** — `src/composants/interface/TableListe.tsx`
  (3 septembre). Tout ce que la liste Flotte faisait — recherche et filtres dans la
  carte, filet de statut, une seule colonne figée, colonnes au choix et largeurs
  réglables enregistrées par compte et par écran (`preferences-liste.ts`), en-tête
  figé, défilement par flèches, pagination — est maintenant générique. `TableFlotte`
  et `TableChauffeurs` ne déclarent plus que leurs colonnes. Les préférences de la
  Flotte gardent leurs anciennes clés de stockage : personne n'a perdu ses réglages.
- **Module Chauffeurs** (3 septembre, module A du Lot 1) :
  - `/chauffeurs` — liste de 21 chauffeurs (titulaires et suppléants des fiches
    véhicules, plus quatre cas sans véhicule), filet de **statut déduit** : en poste,
    disponible, indisponible, sorti (`src/domaine/chauffeur.ts`, `STATUT_CHAUFFEUR`).
    Filtres : Tous / En poste / Disponibles / Indisponibles / Non conformes / Sortis.
    Colonnes : site, véhicule (titulaire + suppléances), permis (catégories), échéance
    permis, visite médicale, km 12 mois, contraventions, incidents ; matricule,
    contrat, prochaine échéance, téléphone et statut au choix.
  - `/chauffeurs/<id>` — fiche, même structure que la fiche véhicule (en-tête fixe,
    six indicateurs, onglets), avec un **sélecteur de période** 3 / 6 / 12 mois à
    droite des onglets : indicateurs, Aperçu et listes suivent la période. Onglets :
    Aperçu (consommation par véhicule à référence pondérée, km par mois, événements
    par mois, alertes, situation, bilan de période), Identité, Affectations, Documents
    (permis, visite médicale), Consommation (mois × véhicule, au prorata des jours
    conduits), Contraventions (avec ou sans retenue), Incidents & sanctions, Frais de
    route, Journal (chronologie + indisponibilités). Menu « Ajouter » propre au
    chauffeur : affectation, document, indisponibilité, contravention, incident,
    sanction (`ENTREES_CHAUFFEUR` dans `MenuAjout.tsx`).
  - **Tout se déduit des fiches véhicules** (`src/donnees/chauffeurs-demo.ts`) :
    affectations, kilomètres, consommation, contraventions, frais de route et pannes
    viennent des véhicules conduits sur la période d'affectation. Un chauffeur n'a
    jamais deux vérités. Les incidents sont dérivés des interventions curatives ; trois
    accidents forcés (Cheikh Sarr, Boubacar Dieng, Amadou Baldé) montrent les suites
    (responsabilité, sinistre, sanction).
  - Le nom du chauffeur est cliquable depuis l'en-tête et l'onglet Affectations de la
    fiche véhicule ; la recherche `Ctrl+K` mène à la fiche chauffeur.
  - Types ajoutés dans `types.ts` : `Indisponibilite`, `Sanction`,
    `DeclarationIncident` (modèle du cadrage incidents §7), champs `dateNaissance`,
    `dateEmbauche`, `dateSortie` sur `Chauffeur`.
- **Performance SQDCM des chauffeurs** (3 septembre, demandé par le métier) —
  `src/domaine/performance.ts`, calqué sur le registre KPI de SEDIMA Opérations
  (piliers S Q D C M, catégories résultat / performance / signal, règle de
  conformité, objectif). Quinze indicateurs, trois par pilier, codes `X_CH_…` :
  Sécurité (accidents responsables, accidents, infractions, aptitude à conduire),
  Qualité (avaries de chargement, justificatifs de frais, relevés cohérents), Délais
  (présence, pannes en mission, activité kilométrique vs cohorte), Coûts (écart de
  consommation, frais de route aux 100 km, coût des incidents), Morale (sanctions,
  formation, polyvalence). **Tout vient des faits rattachés aux affectations** : rien
  n'est saisi pour la performance. Score d'indicateur : 100 si l'objectif est tenu,
  descente linéaire jusqu'à zéro à la tolérance ; pilier = moyenne ; global = piliers
  pondérés S 30 / Q 15 / D 20 / C 25 / M 10. **Barème de prime** : Excellent ≥ 90 →
  100 %, Bon ≥ 75 → 75 %, Acceptable ≥ 60 → 50 %, sinon 0. **Éliminatoires** :
  accident responsable, sanction lourde (blâme, mise à pied), documents de conduite
  non valides, moins de 300 km par mois. Objectifs, poids, barème sont des constantes
  de ce fichier en attendant le module Paramètres.
  - Onglet **Performance** de la fiche chauffeur (`OngletPerformance.tsx`) : score,
    tranche de prime, rang du mois révolu, cinq tuiles de pilier, un tableau
    d'indicateurs par pilier (valeur, objectif, score, précision), rappel du barème.
    Suit la période 3 / 6 / 12 mois de la fiche. La moyenne de la cohorte et le
    classement sont calculés côté serveur dans la page (`ContexteFiche`).
  - **Chauffeur du mois** — `/chauffeurs/classement` (`Classement.tsx`), bouton
    en tête de la liste. Six mois révolus au choix, podium des trois premiers,
    tableau (rang et évolution vs mois précédent, km, score par pilier, score, prime,
    situation), encart « comment le classement est établi ». Ordre : score, puis
    pilier Sécurité, puis kilomètres ; non classables en fin de liste sans rang.
- **Confidentialité des sanctions** (3 septembre) — `ROLES_VOYANT_SANCTIONS` dans
  `roles.ts` : administrateur, gestionnaire de parc, direction. Pour les autres
  rôles, la fiche tait tout ce qui relève des sanctions : carte Sanctions de
  l'onglet Incidents & sanctions (remplacée par une ligne « réservé »), entrées du
  journal marquées `confidentiel`, lignes Sanctions et Retenues de l'Aperçu,
  indicateur M_CH_SANC (valeur « réservé », cadenas), entrée « Sanction » du menu
  Ajouter, motif de non-classement quand il s'agit d'une sanction (« motif
  réservé »). Le rôle est lu dans le navigateur après le montage — en production,
  la même liste devient une politique RLS sur la table `sanction`.
- **Numéro de référence des transactions** (3 septembre, demandé par le métier :
  l'équipe parc le cite dans une demande d'achat avant de la créer et de la valider).
  `src/domaine/reference.ts` : forme `PRÉFIXE-AAAA-NNNNN` — DEP dépense, PLN plein,
  INT intervention, DOC document, REL relevé, AFF affectation, INC incident, SAN
  sanction, IND indisponibilité. **Une transaction, un numéro** : le plein et la
  dépense carburant qu'il porte, l'intervention et sa dépense, le document et sa
  dépense partagent le même. Colonne « Réf. » en tête de chaque liste de transactions
  des deux fiches, un clic copie (`Numero.tsx`). Les références externes (bon de
  commande, PV, bon de sortie) s'appellent maintenant « Pièce ». La recherche
  `Ctrl+K` retrouve un numéro, même partiel (`references-demo.ts`), et ouvre la fiche
  sur l'onglet et la ligne (`?onglet=…&ref=…`, ligne soulignée et amenée à l'écran
  par `useCible`). En démonstration, la séquence est le rang du véhicule ou du
  chauffeur suivi d'un compteur ; en production, une séquence PostgreSQL par type et
  par année, jamais recyclée.
- **Modification tracée et clôture des mois** (3 septembre, demandé par le métier).
  `src/domaine/cloture.ts`, `src/lib/clotures-demo.ts`. Chaque ligne de transaction
  des deux fiches porte un crayon (au survol) qui ouvre la **modale de modification**
  (`src/composants/transactions/ModaleTransaction.tsx`) : les champs du type
  (`champs.ts`), un **motif obligatoire**, et l'**historique** de la transaction
  (qui, quand, champ, avant → après, motif, statut). Rien ne se modifie sans motif.
  **Clôture** : la direction et l'administrateur (`ROLES_CLOTURANT`) clôturent ou
  rouvrent un mois sur `/clotures` (rail, groupe Pilotage). Sur un mois clos, une
  modification faite par un autre rôle devient une **demande** : rien ne change,
  les approbateurs sont prévenus par la cloche, ils approuvent ou refusent sur
  `/clotures` avec un commentaire, et l'auteur est prévenu de la décision. La date
  compte avant comme après : déplacer une transaction hors d'un mois clos passe par
  l'approbation. En démonstration, les valeurs modifiées **recouvrent** le jeu de
  données (`surcharges`) et la fiche les affiche via `FournisseurEdition` /
  `useEdition` ; les agrégats de l'Aperçu ne se recalculent pas — en production, la
  transaction change en base et les vues recalculent. Journal d'audit jamais purgé.
  Même limite pour l'index de la recherche : il est construit côté serveur depuis le
  jeu de démonstration et montre les valeurs d'origine ; la fiche, elle, montre les
  valeurs modifiées. Vérifié de bout en bout le 3 septembre : modification directe
  d'un plein, clôture d'août 2026 par la direction, demande du gestionnaire de parc
  sur ce mois, notification, approbation avec commentaire, application et notification
  de l'auteur.
- **Paramètres** (3 septembre, demandé par le métier) : la clôture des mois a quitté
  le rail pour `/parametres/clotures` ; `/parametres` liste les sections — Clôture
  des mois (livrée), Référentiels, Utilisateurs et rôles, Règles d'alerte, Barème
  SQDCM (au cadrage). L'ancienne adresse `/clotures` redirige. Dans le rail, « Caisse
  parc » et « Achats & DA » ne font plus qu'une entrée, **Caisse & achats** (module F,
  au cadrage).
- **Paramètres › Règles des documents** (3 septembre, demandé par le métier).
  **La visite technique est annuelle pour tous** (plus de six mois pour les poids
  lourds). Pour un véhicule léger neuf, **pas de règle d'exemption dans
  l'application** : à la création du véhicule, l'agent saisit la date de la première
  visite technique que la réglementation lui accorde, et l'échéancier part de là
  (décision du métier, après une première version à règle paramétrée). La validité
  et la criticité de chaque document sont des **paramètres**
  (`src/domaine/parametres.ts`, défauts `PARAMETRES_DEFAUT`) réglables sur
  `/parametres/documents` par la direction et l'administrateur (les autres rôles
  lisent). En démonstration, les paramètres sont écrits dans le navigateur et dans un
  **cookie**, que les pages rendues par le serveur relisent
  (`src/lib/parametres-serveur.ts`) ; les fiches sont mises en cache par
  immatriculation **et** empreinte des paramètres. Enregistrer rafraîchit les pages.
  En production : une table `parametre`, une seule vérité pour le navigateur et le
  serveur.
  **La liste des documents est elle-même un paramètre** : le métier ajoute un
  document (identifiant « doc-… » dérivé du libellé), le renomme, règle son porteur
  (véhicule, chauffeur, flotte), son applicabilité (tous, poids lourds, légers,
  lourds et camionnettes, transports spéciaux), sa validité et sa criticité ; **toute
  ligne se retire**, standard comprise (le document n'est alors plus exigé, plus
  calculé, plus proposé ; les pièces enregistrées restent lisibles ; un standard
  retiré se remet d'un clic). `TypeDocument` est ouvert
  (`TypeDocumentStandard | string`) et `TYPE_DOCUMENT` est un Proxy qui lit le
  registre des libellés alimenté à chaque lecture des paramètres (serveur :
  `parametresServeur()` ; navigateur : `lireParametres()`, chargé par
  `AmorceParametres` dans la coquille avant l'hydratation). **Piège** : un document
  ajouté critique et exigé immobilise tout véhicule qui ne l'a pas — c'est voulu,
  l'écran le dit, et un ajout naît non critique.
- **Module Incidents & sinistres** (3 septembre, module E du Lot 1, lot 1 du cadrage
  incidents). **Formulaire en quatre étapes**
  (`src/composants/incidents/FormulaireDeclaration.tsx`) : les faits (véhicule,
  nature, type dépendant de la nature, date et heure jamais dans le futur, lieu,
  site, conducteur — le titulaire proposé —, compteur **passé au contrôle de
  cohérence des relevés** et signalé s'il est incohérent, mission, description) ;
  conséquences (roulant, **nouveau statut proposé** « en réparation » si non
  roulant, dépannage, garage, retour prévu) ; tiers et responsabilité (accident
  seulement : tiers, constat, police et PV, blessés, responsabilité, témoins) ;
  suites (assureur avec **n° de police pré-rempli** depuis le document Assurance,
  franchise, sanction du conducteur, actions correctives). **À la validation, une
  saisie produit plusieurs transactions tracées** : INC (déclaration, sujet
  `vehicule:<id>`), STA (période de statut si l'état change, motif panne ou
  sinistre), REL (relevé, avec le motif du rejet s'il est incohérent), DEP
  (dépannage), SAN (sur la fiche du conducteur) — et **notifie** gestionnaire de
  parc et responsable maintenance, plus la direction si blessé ou tiers (cloche,
  lien `/incidents?ref=INC-…`). Le formulaire s'ouvre depuis `/incidents` ›
  Déclarer, depuis la fiche véhicule › Ajouter › Déclarer, et par
  `/incidents?declarer=1`. **Liste** (`EcranIncidents`, `TableListe`) : filet par
  état du suivi, filtres Tous / En cours / Accidents / Incidents / Sinistres ouverts
  / Non roulants / Clos, période (30 j, 90 j, 12 mois, tout) et BU dans l'en-tête ;
  chaque ligne se **qualifie, suit et clôt par la modification tracée** (bouton
  d'action, champs `CHAMPS.incident`). **Onglet Incidents & sinistres** sur la fiche
  véhicule (`OngletIncidents`), coût et jours d'immobilisation en précision. Les
  données de démonstration viennent des fiches chauffeurs
  (`src/donnees/incidents-demo.ts`, une seule vérité) ; les créations vivent dans
  le navigateur (`lireToutesCreations("incident")`). Le contexte d'édition expose
  `actualiser()` pour qu'un formulaire hors modale rafraîchisse les créations.
  **Reste au lot 2** : pièces jointes, dossier sinistre (sous-cycle expertise →
  indemnisé), rattachement des dépenses ultérieures à la déclaration (le coût d'une
  déclaration créée n'est que le dépannage), D_NPVEL / D_TICV sur le tableau de
  bord, prise en compte du statut déclaré dans la Disponibilité du jour, typologies
  administrables dans Paramètres.
- **Module Caisse & achats** (3 septembre, nuit, module F du Lot 1, une seule entrée
  du rail `/caisse`). Domaine dans `src/domaine/caisse.ts`, données de démonstration
  dans `src/donnees/caisse-demo.ts`, écran `src/composants/caisse/EcranCaisse.tsx`,
  décision `ModaleDecision.tsx`. Deux vues par bouton à segments, période et BU
  communes, pas de bandeau de KPI (le solde et les compteurs sont dans le sous-titre).
  - **Journal de caisse** (`TableListe`, écran `caisse`) : mouvements **CAI**, colonnes
    Entrée / Sortie / Solde (le solde se **recalcule** sur tout le journal, y compris
    les créations, jamais saisi ; `avecSolde`), justificatif, dépense réglée, véhicule.
    **Règle du métier portée par le formulaire** : une sortie cite obligatoirement la
    dépense qu'elle règle (champ « Dépense réglée » en choix parmi les dépenses caisse
    non réglées, `champsCreation("caisse", { sens: "sortie", depenses })`) ; un
    approvisionnement ne règle rien. Filet par état (approvisionnement, réglée et
    justifiée, sans justificatif, sans dépense rattachée = anomalie à régulariser).
    **Bandeau d'une ligne « n dépenses en attente de règlement »** ouvrant un volet
    avec un bouton **Régler** par dépense : la modale de création s'ouvre pré-remplie
    (dépense, libellé, montant, pièce, justificatif). Boutons Approvisionner et Sortie
    de caisse. **Un clic sur une ligne ouvre la pièce** (modification tracée) ;
    l'immatriculation mène à la fiche.
  - **Demandes d'achat** (écran `achats`) : numéros **DAC**, objet, poste, montant
    estimé, urgence (normale, urgente, véhicule immobilisé), fournisseur pressenti,
    **transaction d'origine obligatoire** (OBS, INT, INC, DOC… — règle du métier ;
    `lienOrigine` en fait un lien vers la fiche). **Circuit à seuil**
    (`SEUIL_VALIDATION_DIRECTION` = 500 000 F) : soumise → visa parc → (validation
    direction si ≥ seuil) → commandée par les achats avec **n° de bon de commande
    obligatoire** ; refus possible à toute étape avec motif. `prochaineEtape`,
    `peutDecider`, `roleAttendu`, `ROLE_DECIDEUR`. La décision est une
    **modification tracée** de la demande (étape, visa, validation, BC, commentaire
    via `enregistrerModification`, donc soumise à la clôture des mois) et **prévient**
    par la cloche celui qu'on attend ensuite, ou le demandeur (`demandeurRole`) à la
    commande ou au refus. Bouton **Décider** sur les lignes qui reviennent au rôle
    connecté (sinon Modifier), filtre « À ma décision », **un clic sur la ligne ouvre
    la demande**. Une demande créée naît « soumise ».
  - Données de démonstration : le journal relit **toutes les dépenses des fiches dont
    l'origine est « caisse »** (une seule vérité, 877 sorties + un approvisionnement
    mensuel dimensionné sur les sorties du mois, solde initial 1 500 000 F) ; les
    dépenses des **douze derniers jours restent non réglées** pour alimenter le volet
    « à régler ». Onze demandes dérivées des observations de visite ouvertes, des
    interventions curatives et des sinistres en cours, à toutes les étapes. Les
    numéros CAI et DAC sont dans l'index de recherche (`/caisse?vue=…&ref=…`).
  - Vérifié de bout en bout le 3 septembre : règlement de DEP-2026-08024 → CAI-2026-90001
    en tête du journal, solde et bandeau recalculés ; visa du parc sur DAC-2026-00001
    (sous le seuil : la direction est sautée), notification aux achats, commande sous
    BC17420 par le rôle Achats, notification au responsable maintenance, historique
    complet.
  - **Tranché par le métier le 3 septembre : une seule caisse parc** (pas de caisse
    par site). **À trancher encore** : le seuil et les rôles du circuit (à porter dans
    Paramètres), qui approvisionne la caisse (contrôle de gestion ?), la sortie de
    caisse partielle. **Limite connue** :
    la modale n'est pas réactive — choisir une autre dépense dans la liste ne
    re-remplit pas libellé et montant (le volet « Régler » contourne le problème en
    pré-remplissant avant l'ouverture). Réception et rapprochement à trois voies :
    Lot 2.
- **Module Maintenance** (3 septembre, nuit, première brique du Lot 2, une seule
  entrée du rail `/maintenance`). Domaine `src/domaine/maintenance.ts`, données
  `src/donnees/maintenance-demo.ts`, écran `src/composants/maintenance/EcranMaintenance.tsx`.
  Trois vues par bouton à segments, BU commune, période sur les deux dernières.
  - **À faire** : le tableau de l'atelier, **rien ne s'y saisit** — tout se déduit des
    fiches : échéance du plan d'entretien (`prochaineIntervention`, urgence par seuils
    `SEUIL_KM_PLANIFICATION` 1 500 km / `SEUIL_JOURS_PLANIFICATION` 21 j, en retard
    sous zéro), observation de visite technique non corrigée (avant la contre-visite),
    véhicule en réparation ou en restauration (période de statut ouverte), incident
    non roulant en cours. Filet par urgence ; filtre « À traiter » par défaut. Bouton
    **Planifier** sur chaque ligne → ordre de travail pré-rempli ; une ligne dont un
    ordre est ouvert passe « en cours » et montre son numéro, et redevient à planifier
    si l'ordre se clôt sans que la cause ait disparu (en démonstration, le statut du
    véhicule ne change pas : à brancher sur les périodes de statut).
  - **Ordres de travail** : numéros **OTR** (`CHAMP_DATE` = date prévue), véhicule,
    nature (préventif/curatif), objet, transaction d'origine citée (OBS, INC… ou « plan
    d'entretien »), garage au choix (`GARAGES` exporté de `fiche-demo.ts`), date
    prévue, immobilisation et montant estimés. Cycle **planifié → en atelier → clos**,
    ou annulé : **Démarrer** est une modification tracée en un clic (motif « Véhicule
    entré au garage ») ; **Clôturer** ouvre la création de l'**intervention INT sur la
    fiche du véhicule** (pré-remplie : date, nature, objet, garage, immobilisation
    depuis l'entrée au garage, montant estimé ; `sujetDe` → `vehicule:<id>`) et, par
    le nouveau rappel `apresCreation` de `ModaleTransaction` / `DemandeCreation`, referme
    l'ordre sur le numéro de l'intervention (statut clos, date, `interventionNumero`).
    Un clic sur la ligne ouvre l'ordre (modification tracée, annulation par le statut).
  - **Interventions** : toutes les INT de la flotte (fiches + créées, lues par
    `lireToutesCreations("intervention")` et rattachées au véhicule par le sujet),
    filet préventive / curative, un clic ouvre l'intervention.
  - Démonstration : six ordres à tous les stades (trois échéances planifiées, une
    observation corrigée dont l'ordre est clos sur son INT, un véhicule en atelier,
    un doublon annulé) ; numéros OTR dans la recherche (`/maintenance?vue=ordres&ref=`).
    Vérifié le 3 septembre : Planifier sur AB 932 EF → OTR-2026-90001, Démarrer →
    en atelier, Clôturer → INT-2026-90001 sur la fiche et l'ordre clos ; l'intervention
    apparaît en tête de la vue Interventions et sur l'onglet Entretien de la fiche.
  - **À faire ensuite** : qui peut planifier, démarrer, clôturer (rôles) ; la clôture
    devrait proposer de refermer la période de statut « en réparation » et de
    marquer l'observation « corrigée » (aujourd'hui à faire à la main) ; le relevé
    kilométrique de l'intervention créée n'est pas soumis au contrôle de cohérence ;
    inspections (check-lists) et pièces consommées au cadrage ; le bouton « Nouvelle
    intervention » de l'onglet Entretien de la fiche reste inerte (le menu Ajouter
    fait le travail).
- **Module Carburant** (3 septembre, nuit, Lot 2, une seule entrée du rail
  `/carburant`). Domaine `src/domaine/carburant.ts`, données
  `src/donnees/carburant-demo.ts`, écran `src/composants/carburant/EcranCarburant.tsx`.
  Trois vues par bouton à segments, période et BU communes, pas de bandeau de KPI.
  - **Pleins** : tous les PLN de la flotte (fiches + créés, rattachés au véhicule par
    le sujet), filet par source (cuve interne, station) ou relevé écarté par le
    contrôle de cohérence (compteur barré, motif au survol). **Saisir un plein**
    depuis le module : le véhicule se choisit (`champsCreation("plein", { pour:
    "carburant" })`) et le plein est rangé sur sa fiche (`sujetDe`) — la fiche le voit,
    la cuve aussi. Un clic sur la ligne ouvre le plein.
  - **Cuve interne** : le journal de la cuve, tenu comme celui de la caisse
    (`avecStock`). **Les sorties sont les pleins pris à la cuve — même numéro PLN**
    (une transaction, un numéro), reconstruites depuis les pleins tels qu'ils sont ;
    seules les **livraisons** et les **relevés de jauge** ont leur numéro **CUV**
    (`CHAMP_DATE` = date). Colonnes Entrée / Sortie / Écart jauge / Stock ; le stock
    se recalcule sur tout le journal, **un relevé de jauge recale le stock sur la
    réalité et son écart au théorique est calculé** (vigilance au-delà de 50 L,
    défavorable au-delà de 150 L). Boutons **Livraison** (bordereau, prix du litre
    590 F, fournisseur pré-remplis) et **Relevé de jauge** (stock courant proposé).
    `CAPACITE_CUVE` 30 000 L et `PART_STOCK_BAS` 20 % (stock en rouge, sous-titre
    « à réapprovisionner ») sont des constantes de démonstration à confirmer. Un clic
    sur une sortie ouvre le plein ; sur une livraison ou une jauge, le mouvement.
  - **Consommation** : une ligne par véhicule sur la période (`consolider` des mois
    de `fiche.carburant`) : litres, km, L/100 km, référence de la catégorie, écart en
    %, état (conforme / dérive au-delà de `SEUIL_DERIVE` 8 % / dérive forte au-delà de
    15 %) ; sous-titre avec le L/100 de la flotte et le nombre de véhicules en dérive.
    Cette vue tient lieu du rapport mensuel que la fiche ne montre pas (décision du
    2 septembre : sur la fiche, seulement les pleins).
  - Démonstration : 429 pleins (tous pris à la cuve dans le jeu de données : le
    générateur des fiches nomme toutes les sources « Cuve… »), livraisons par quinzaine
    dimensionnées sur les sorties, un relevé de jauge par fin de mois à ±1 % du
    théorique, stock initial 9 000 L. Numéros CUV dans la recherche
    (`/carburant?vue=cuve&ref=`).
  - Vérifié le 3 septembre : plein de 250 L saisi depuis le module sur AA 032 EA →
    PLN-2026-90001 en tête des pleins, sortie de cuve du même numéro, stock recalculé ;
    livraison de 5 000 L → CUV-2026-90001 et stock relevé d'autant. Deux corrections
    au passage : le relevé de jauge se recalait sur le premier mouvement du journal
    au lieu du dernier (le stock grimpait au-delà de la capacité), et une livraison
    mensuelle ne couvre pas un mois de consommation (passée à la quinzaine).
  - **À trancher avec le métier** : la contenance réelle de la cuve, la fréquence des
    livraisons, les seuils d'écart de jauge et de dérive, qui saisit les pleins
    (responsable carburant) ; pleins en station payés par la caisse (le lien avec le
    journal de caisse existe déjà par l'origine « caisse » de la dépense) ; le prix du
    litre de la cuve devrait venir de la dernière livraison (coût moyen pondéré) plutôt
    que d'une constante.
- **Énergie des véhicules et prix en Paramètres** (3 septembre, nuit, décision du
  métier). `Vehicule.energie : Energie | null` (`gasoil`, `essence`, `electrique`,
  `hybride` — libellés `ENERGIE` dans `libelles.ts`) remplace l'ancien champ
  `carburant` limité à gasoil / essence : saisi à la création et modifiable sur la
  fiche (« Énergie », obligatoire), lu dans Caractéristiques, colonne optionnelle
  « Énergie » de la liste Flotte. L'inventaire de démonstration est tout gasoil
  (`Brut.energie` facultatif dans `parc-demo.ts`) : **à compléter à l'inventaire de
  référence**. **Paramètres › Énergie et carburant** (`/parametres/energie`,
  `EcranEnergie.tsx`, `ParametresEnergie` dans `parametres.ts`, défauts
  `ENERGIE_DEFAUT`) : prix du litre de gasoil et d'essence en station, prix du kWh, prix
  du litre livré en cuve, contenance de la cuve — réglés par la direction et
  l'administrateur, lus par le navigateur et le serveur comme les règles des
  documents (cookie + stockage, `fusionnerParametres` remet un défaut à tout prix
  absent ou invalide). **Effets** : un plein saisi depuis une fiche prend le prix de
  l'énergie du véhicule (`prixEnergie(v.energie, lireParametres())` dans
  `FicheVehicule.ajouter`) ; depuis le module Carburant, le prix du gasoil (le véhicule
  n'est pas encore choisi) ; une livraison prend le prix cuve ; le journal de la cuve
  se borne à la contenance (`stockBas(stock, capacite)`, sous-titre et colonne Stock).
  Vérifié : gasoil réglé à 700 F → le formulaire de plein d'AA 032 EA propose 700.
  **À faire** : un plein de véhicule électrique se dit en kWh, pas en litres (libellés
  du formulaire à adapter selon l'énergie) ; la consommation par véhicule ignore les
  électriques ; la référence L/100 par catégorie devrait elle aussi devenir un
  paramètre.
- **Suivi › Prestataires** (3 septembre, nuit, demandé par le métier :
  « une page pour la gestion des prestataires »). Première brique des Référentiels.
  `src/domaine/prestataires.ts` (`Prestataire`, `TypePrestataire` : garage, pièces,
  pneumatiques, station, fournisseur de carburant, assureur, centre de visite,
  dépanneur, transporteur, autre), `src/donnees/prestataires-demo.ts` (21 fiches
  dérivées des noms déjà cités par l'application — garages des interventions,
  fournisseurs des demandes d'achat, stations, TotalEnergies, CCVA ; contacts et
  NINEA illustratifs), écran `src/composants/prestataires/EcranPrestataires.tsx` sur `/prestataires` (sorti des Paramètres le 3 septembre : entrée du rail dans Suivi, après Caisse & achats)
  (`TableListe`, filet actif / inactif, filtres par famille, « Nouveau prestataire »
  et modification par la modale tracée, type **PRE** sans mois). **Un prestataire
  inactif reste lisible et n'est plus proposé** : le garage d'un ordre de travail se
  choisit parmi les prestataires actifs de type garage ou dépanneur, fiches créées
  comprises (`optionsPrestataires(TYPES_GARAGE, lireCreations)` dans
  `champsCreation("ordre")`). Numéros PRE dans la recherche. Vérifié : « Garage
  Ndiaye Poids Lourds » créé → PRE-2026-90001 en liste et proposé dans le formulaire
  d'ordre de travail. **À faire** : rattacher par choix le fournisseur d'une demande
  d'achat, l'émetteur d'un document (assureur), la source d'un plein (station), le
  centre d'une visite technique, le garage d'une intervention — aujourd'hui des
  textes libres ou des listes en dur ; fiche du prestataire avec ses transactions ;
  qui gère les prestataires (achats ?).
- **Suivi des demandes d'achat dans Sage X3, et fiche prestataire** (3 septembre, soir).
  **Décision du métier** : « il ne faut surtout pas qu'on se substitue à X3 ; tout le
  process d'achat se situe à ce niveau. Ce qui est souhaité : rattacher une DA ou une
  sortie de caisse à un véhicule, à une intervention ou autre, avoir le coût, suivre les
  étapes de la DA, et éviter au maximum les données détaillées qu'on a déjà dans X3. »
  Une première livraison du soir (types BCO / REC / FAC, vues Commandes, Réceptions,
  Factures, rapprochement à trois voies, état de règlement) a donc été **retirée** ;
  seul en reste ce qui suit.
  - **Le circuit de la DA s'allonge sans rien ressaisir** (`domaine/caisse.ts`,
    `EtapeAchat`) : soumise → visa parc → validée (selon le seuil) → **commandée** →
    **livrée** → **facturée** → **réglée**, ou refusée (un refus n'a plus de sens après la
    commande, `peutRefuser`). Trois **phases** (`phaseDe`) : en validation, dans Sage X3,
    close. Chaque étape X3 est **constatée** par `ModaleDecision` avec une seule
    information : à la commande, le **bon Sage X3**, le **fournisseur choisi dans le
    référentiel** (numéro PRE, pressenti pré-sélectionné) et le **montant du bon**
    (`montantEngage`) ; à la livraison, une date ; à la facture, une date et le
    **montant facturé** (`montantReel`) ; au règlement, une date. Au visa, le **n° de DA
    X3** est facultatif (`numeroDemandeX3`, clé de l'état de règlement tenu par le
    métier). Rôles : `ROLE_DECIDEUR` (livraison constatée par le parc, l'atelier ou le
    site ; facture et règlement par les achats ou le contrôle de gestion) ; notification
    de celui qu'on attend, du demandeur au règlement ou au refus.
  - **Le coût** (`coutDe`) : facturé, sinon engagé, sinon estimé — la nature se lit sous
    le montant (colonne « Coût » de la liste, filtres Toutes / À ma décision / En
    validation / Dans Sage X3 / Urgentes / Réglées / Refusées, colonnes DA X3, bon X3,
    livrée / facturée / réglée le, dépense du véhicule). **À la facturation, le coût
    rejoint le véhicule** : si la transaction d'origine porte déjà la dépense (INT, DOC,
    PLN, DEP — `originePorteLeCout`), c'est elle qui est citée (`depenseNumero`) ;
    sinon (OBS, INC), une dépense **DEP** d'origine « bon de commande » est créée sur la
    fiche du véhicule au montant facturé.
  - **Fournisseur par numéro PRE** : la création d'une DA choisit le fournisseur
    pressenti dans le référentiel (`optionsPrestatairesParNumero`, fiches créées
    comprises), la commande le confirme ; `fabriquerLigneAchat(c, prestataires)` résout la
    raison sociale. `prestatairePour(nom)` (dans `prestataires-demo.ts`) retrouve un
    prestataire derrière un nom cité par une fiche — c'est ce qui relie encore les
    interventions, pleins, documents et visites à leur prestataire tant qu'ils ne
    portent qu'un nom.
  - **Statistiques par prestataire** (`statistiquesParPrestataire`, lues sur les DA
    commandées et au-delà) : nombre, montant, non réglé, refusées, délai moyen
    facture → règlement ; colonnes **Achats 12 mois**, **Montant 12 mois**, **Non
    réglé** (et Délai de règlement au choix) sur `/prestataires` ; la raison sociale et
    la ligne mènent à la fiche.
  - **Fiche prestataire** `/prestataires/<PRE>` (`FichePrestataire.tsx`,
    `fiche-prestataire-demo.ts`, types dans `domaine/prestataires.ts`) — demandée par le
    métier « comme pour les véhicules et les chauffeurs ». En-tête fixe (retour,
    initiales, raison sociale, type, actif, ville, contact, téléphone, courriel, délai de
    paiement ; Modifier ; **Demande d'achat** pré-remplie du prestataire, rangée sur
    `caisse`), six indicateurs sur la période 3 / 6 / 12 mois (total payé toutes voies,
    achats sur bon, non réglé, délai de règlement contre le délai convenu,
    interventions, caisse), onglets **Aperçu** (dépenses par mois, par poste, demandes en
    cours, situation), **Demandes d'achat**, **Interventions**, **Pleins**, **Sorties de
    caisse**, **Documents**, **Visites techniques**, **Identité** — chaque onglet une liste
    d'un seul type, chaque ligne citant son véhicule ; les onglets sans matière restent
    visibles, grisés, avec leur compte. Rien ne s'y saisit. Numéros PRE de la recherche
    → fiche. **Limites** : une fiche créée dans le navigateur n'a pas de page (le serveur
    ne la connaît pas) ; pas de discussion sur la fiche ; les interventions, pleins,
    documents, visites et sorties de caisse sont rattachés par le nom, pas encore par le
    numéro PRE.
  - Données de démonstration : les DA dérivées des interventions curatives se répartissent
    sur tout le circuit jusqu'au règlement (bon X3, montant engagé ±8 %, livraison,
    facture, montant réel ±3 % une fois sur cinq, règlement au délai du prestataire),
    `depenseNumero` = l'intervention citée.
  - **Tranché par le métier le 3 septembre au soir : pas d'interface avec X3.** Les étapes
    commandée, livrée, facturée, réglée se constatent à la main dans l'application.
    **À trancher** : qui les constate ; le n° de DA X3 est-il connu dès
    la demande ; une DA multi-véhicules (la fiche dépenses 2026 en montre : « DIVERS »,
    plusieurs immatriculations par DA) ; **Q62** devient sans objet ici.
- **Transaction d'origine choisie, jamais tapée à l'aveugle** (3 septembre, soir, demande du
  métier : « tout ce qui est transaction d'origine à saisir dans les formulaires devrait
  pouvoir être sélectionnable avec contrôle de validité, pour être sûr du
  rattachement »). Nouveau type de champ `"reference"` (`ChampEdition.references` : les
  types acceptés) rendu par `src/composants/transactions/ChampReference.tsx` dans la
  modale : on tape un bout de numéro ou un mot du libellé (« obs », « freinage »), la
  liste propose jusqu'à huit transactions de l'index de recherche **et** des créations du
  navigateur (`catalogueReferences`), d'abord celles du véhicule du formulaire ; flèches,
  Entrée, ou clic. Le verdict est toujours affiché (`resoudreReference`) : **valide**
  (titre et précision de la transaction), **inconnue**, **hors type** (« INT-… est une
  intervention : ce champ attend une observation… »), **autre véhicule** (« appartient à
  AA 985 MR, pas au véhicule de ce formulaire »). La modale **n'enregistre pas** tant
  qu'une référence saisie n'est pas valide (« Rattachement à vérifier : … »). Le véhicule
  de contrôle est celui choisi dans le formulaire, sinon celui de la fiche qui porte la
  création. Champs convertis : transaction d'origine de la demande d'achat (OBS, INT,
  INC, VTE, DOC, DEP, PLN, OTR), transaction d'origine de l'ordre de travail (OBS, INC,
  INT, VTE), intervention réalisée de l'ordre, intervention qui corrige une observation.
  Vérifié le 3 septembre : « freinage » propose les interventions de contrôle de
  freinage, le choix pose INT-2026-01002 avec son libellé, et le passage du véhicule à
  AA 032 EA refuse le numéro. **À faire** : proposer aussi le véhicule à partir de la
  transaction choisie (aujourd'hui l'inverse seulement) ; étendre le type aux champs
  « dépense réglée » et « commande » qui restent des listes déroulantes.
- **Coûts & analyses** (3 septembre, soir, Lot 2, entrée Pilotage du rail `/couts`).
  Domaine `src/domaine/couts.ts`, données `src/donnees/couts-demo.ts`, écran
  `src/composants/couts/EcranCouts.tsx`. **Rien ne s'y saisit** : la matière est relue
  sur les fiches véhicules — dépenses (toutes voies de paiement), kilomètres et litres
  de la consommation mensuelle, interventions curatives — sur vingt-quatre mois
  (`DonneesVehicule`, un `MoisVehicule` par mois). Quatre vues par bouton à segments,
  **période** 3 / 6 / 12 / 24 mois, **périmètre** et **BU** communs :
  - **Synthèse** — six tuiles (coût total et moyenne mensuelle, coût au kilomètre,
    parts carburant et maintenance, consommation contre la référence pondérée par les
    kilomètres, véhicules à arbitrer), évolution mensuelle (`GraphiqueBarres`, ligne =
    moyenne de la période), « où va l'argent » (trois familles et leur premier poste),
    **véhicules à arbitrer**, par catégorie (fourchette du coût au km), par BU. Le
    bandeau de KPI y est assumé : c'est une lecture d'agrégats, pas une liste.
  - **Véhicules** — `TableListe` (écran `couts-vehicules`) : km, total, carburant,
    maintenance, autres, **coût / km**, **écart à la médiane de sa catégorie**
    (`qualifier` : catégories d'au moins deux véhicules ayant roulé), L/100 et écart à
    la référence, pannes (interventions curatives), immobilisation, **tendance**
    (trimestre révolu contre le précédent, le mois en cours laissé de côté), âge,
    **lecture** : économe (≤ −15 %), dans la norme, à surveiller (≥ +15 %), **à
    arbitrer** (≥ +40 % — réparer ou réformer ?). Seuils `SEUIL_ECONOME`,
    `SEUIL_SURVEILLER`, `SEUIL_ARBITRER`, à porter dans Paramètres. Filtres Tous / À
    arbitrer / À surveiller / Économes / Conso en dérive / Lourds / Légers. Le verdict
    se prend contre toute la catégorie, quelle que soit la BU affichée.
  - **Postes** — le tableau **poste × mois** que le métier tient à la main dans « SUIVI
    DEPENSES PARC 2025 - 2026.xlsx » : groupes carburant / maintenance / autres avec
    sous-totaux, total, part, kilomètres et coût au km par mois ; défile dans sa carte.
  - **Carburant** — le **rapport mensuel des consommations** que la fiche ne montre pas
    (décision du 2 septembre : sur la fiche, seulement les pleins) : véhicule × mois en
    L/100 contre la référence de la catégorie (vigilance au-delà de 8 %, dérive au-delà
    de 15 %), litres, km, écart ; ligne Flotte.
  - **Périmètre** (`Perimetre`) : **exploitation** (sans amortissement ni salaire) ou
    **complet** — la question 52 du cadrage reste ouverte, l'écran montre les deux.
    L'assurance est dans les deux. **Coût par tonne** : à venir avec les tonnages de
    SediLiv ; ici le coût au kilomètre.
  - La liste Flotte lit désormais son « Coût 12 mois » sur les dépenses de la fiche
    (`page.tsx` de la flotte), la même somme que l'Aperçu et que ce module.
  - Vérifié le 3 septembre dans un onglet neuf : 18 véhicules, 225,7 M F sur douze
    mois, 282 F/km, carburant 61 %, un véhicule à arbitrer (AA 236 MR, +41 % sur sa
    catégorie) ; les quatre vues s'affichent, aucune erreur console. **Limites** : les
    dépenses créées dans l'application ne sont pas comptées (comme l'Aperçu) ; les mois
    d'octobre à décembre 2025 du jeu de démonstration sont creux (les fiches ne
    génèrent que douze mois). **À trancher** : les seuils, les références L/100 par
    catégorie (aujourd'hui des constantes de `fiche-demo.ts`), le périmètre retenu.
- **Tableau de bord SQDCM du parc** (3 septembre, soir, Lot 2 — l'**écran d'entrée** de
  l'application, `/` ; l'ancienne redirection vers `/flotte` est supprimée).
  **Refait le soir même sur la maquette « Parc SEDIMA »** que le métier a communiquée :
  une première version maison (score global pondéré, quinze indicateurs, barème à
  tolérance, courbe mensuelle) a été **jugée non conforme et remplacée**. Domaine
  `src/domaine/tableau-bord.ts`, faits `src/donnees/tableau-bord-demo.ts`, écran
  `src/composants/tableau/EcranTableauBord.tsx`.
  - **Cinq axes** : S Sécurité, Q Qualité, **D Livraison**, **C Coût**, M Morale — les
    noms de la maquette, pas ceux que j'avais inventés. Une teinte par axe, prise dans
    la charte SEDIMA.
  - **Trente-huit indicateurs disponibles**, repris un à un de la maquette avec leurs
    libellés, unités et cibles. Les **six du référentiel DO** — **D_TDPA**, **D_TICV**,
    **D_NPVEL**, **C_CDM_SEDI**, **C_CDM_TR**, **C_TED_EXT** — sont la **sélection par
    défaut** ; les autres portent la mention « proposé ». « **Choisir les indicateurs** »
    ouvre un panneau à cinq colonnes, une case par indicateur ; la sélection est
    **mémorisée par compte** (`sedima.parc.tableau-bord.<rôle>`), avec « Sélection par
    défaut » pour revenir aux six.
  - **Le score d'un axe est la part de ses indicateurs affichés qui tiennent leur
    cible** — la règle de la maquette, refaisable de tête, et non un barème à tolérance.
    Vert au-delà de 80, vigilance au-delà de 50, défavorable en dessous. Un axe sans
    indicateur affiché, ou dont aucun n'est mesurable, est **grisé** et ne montre pas de
    score.
  - **Vingt indicateurs sont alimentés** par l'application, **dix-huit attendent leur
    source** : télématique Teltonika (conduite, chaîne du froid), livraisons et tonnages
    SediLiv (OTIF, remplissage, km à vide, coût à la tonne, réclamations), pont bascule
    (pesée), RH (formations), transporteurs (externalisation, coût tiers, écarts de
    facturation), et le rapprochement à trois voies qui vit dans Sage X3. Ils
    s'affichent « **source à brancher** », restent sélectionnables pour que le métier
    voie la cible visée, et **ne comptent pas dans le score**. **Trois des six
    indicateurs du référentiel DO sont dans ce cas** (C_CDM_SEDI, C_CDM_TR, C_TED_EXT) :
    c'est le premier constat à porter au métier.
  - **Cibles mensuelles mises à l'échelle** : la maquette est écrite pour le mois en
    cours ; l'application tient les trois périodes, donc cinq pannes tolérées par mois
    deviennent soixante sur l'année (`parMois`, `cibleEffective`, sur la **durée
    nominale** de la période et non les jours écoulés — sans quoi la cible du mois
    s'effondrerait le 2 du mois).
  - **Filtres de la maquette, tous actifs** : **Semaine** (sept jours glissants, avec
    ses propres faits), **Mois en cours**, **Année**, puis **BU**, **catégorie de
    flotte** et **site**. C'est ce qui a imposé la maille **véhicule × mois** dans les
    faits : filtrer sur trois dimensions sans rien recharger.
  - **Ce qui demande une action** : « **Alertes du jour** » (documents échus ou à
    échoir sous trente jours, immobilisations de plus de vingt et un jours, chacune
    cliquable vers la fiche) et « **Véhicules les plus coûteux — 12 mois** ». Puis
    « **Dépenses par business unit — cumul de l'exercice** » en barres.
  - **Mise en page arrêtée avec le métier le 3 septembre au soir, écran en main** :
    les indicateurs sont **en colonne sous la puce de leur axe** (cinq colonnes aux
    mêmes ruptures que le bandeau, filets verticaux entre axes) et non plus à la suite
    les uns des autres ; **trois indicateurs par axe au maximum** (`MAX_PAR_AXE`,
    `basculer` fait sortir le plus ancien de l'axe quand on en coche un quatrième,
    `limiter` borne une sélection enregistrée avant la règle, compteur « 2/3 » par
    colonne dans le sélecteur) ; **toutes les pastilles ont la même taille** (136 px,
    libellé sur deux lignes réservées, cible poussée en bas), une colonne courte ne les
    étire plus ; et les cinq puces d'axe sont **à largeur égale**, score et jauge
    alignés.
  - **Le bloc « Véhicules les plus coûteux — 12 mois » a été retiré** à la demande du
    métier le 3 septembre au soir, alors qu'il figurait dans la maquette : « Ce qui
    demande une action » ne garde que les **alertes du jour** et les **dépenses par
    business unit**, côte à côte. Le calcul correspondant a été retiré des données, pas
    seulement masqué.
  - **Courbes sur douze mois, sous les pastilles** (demandé le même soir) : chaque mois
    est cumulé pour lui-même et repassé dans le calcul de l'indicateur, ce qui donne une
    valeur mensuelle à ce qui se lit d'ordinaire sur toute la période ; le périmètre
    (BU, catégorie, site) s'applique aussi aux courbes. **Quatre courbes au plus**
    (`MAX_COURBES`), choisies parmi les **quinze dimensions suivables**
    (`INDICATEURS_COURBE` : alimentées, et non « instantanées » — le solde de caisse ou
    les véhicules prêts se lisent au jour dit et feraient une droite), sélection
    mémorisée par compte. **Une échelle par courbe** : une consommation et un coût au
    kilomètre ne se superposent pas ; chacune porte sa ligne de cible en pointillé.
    SVG écrit à la main, comme le reste. **Agrandies et étoffées** à la relecture du
    métier : deux par ligne et non quatre, échelle chiffrée à gauche, aire sous la
    courbe, ligne de cible avec sa valeur, plus haut et plus bas de la période marqués,
    dernier point détaché et coloré selon qu'il tient la cible, mois en abscisse, et
    dans l'en-tête la dernière valeur avec la variation d'un bout à l'autre de la
    période.
  - **Rien ne se saisit** : chaque pastille est un lien vers l'écran où sa valeur se
    vérifie ligne à ligne.
  - Vérifié le 3 septembre dans un onglet neuf, après remise à zéro des réglages :
    six pastilles par défaut réparties trois sous Livraison et trois sous Coût, les
    trois autres colonnes portant « Aucun indicateur affiché », quatre courbes tracées,
    toutes les pastilles à 136 px. Puis : six pastilles par défaut, D à 67/100,
    D_TDPA 64,7 % sur le mois en cours et 94,1 % sur l'année, le panneau montre bien
    trente-huit cases dont six cochées, cocher « Accidents de circulation » passe le
    compteur à sept et écrit la sélection ; aucune erreur console. **Deux corrections au
    passage** : le bandeau de KPI s'écrasait faute de `shrink-0` (piège du §5, oublié
    ici **et** sur Coûts & analyses, corrigé sur les deux) ; et la conformité
    documentaire du passé tombait à 43 % parce qu'un document renouvelé en 2026
    paraissait « manquant » en 2025 — le passé ne se juge plus que sur les échéances
    dépassées.
  - **Limites** : les faits sont ceux du jeu de démonstration et les créations du
    navigateur n'y entrent pas ; les kilomètres de la semaine sont un prorata du mois
    (la consommation est mensuelle) ; le respect du plan préventif se lit sur l'échéance
    courante et vaut approximation pour les mois passés ; l'historique des documents
    manque pour juger pleinement la conformité passée.
  - **À trancher** : les cibles, et surtout **quelles sources brancher en premier** —
    sans télématique ni tonnages, la moitié du référentiel DO reste muette.
- **Transaction d'origine choisie, jamais tapée à l'aveugle** (3 septembre, soir, demande du
  métier : « tout ce qui est transaction d'origine à saisir dans les formulaires devrait
  pouvoir être sélectionnable avec contrôle de validité, pour être sûr du
  rattachement »). Nouveau type de champ `"reference"` (`ChampEdition.references` : les
  types acceptés) rendu par `src/composants/transactions/ChampReference.tsx` dans la
  modale : on tape un bout de numéro ou un mot du libellé (« obs », « freinage »), la
  liste propose jusqu'à huit transactions de l'index de recherche **et** des créations du
  navigateur (`catalogueReferences`), d'abord celles du véhicule du formulaire ; flèches,
  Entrée, ou clic. Le verdict est toujours affiché (`resoudreReference`) : **valide**
  (titre et précision de la transaction), **inconnue**, **hors type** (« INT-… est une
  intervention : ce champ attend une observation… »), **autre véhicule** (« appartient à
  AA 985 MR, pas au véhicule de ce formulaire »). La modale **n'enregistre pas** tant
  qu'une référence saisie n'est pas valide (« Rattachement à vérifier : … »). Le véhicule
  de contrôle est celui choisi dans le formulaire, sinon celui de la fiche qui porte la
  création. Champs convertis : transaction d'origine de la demande d'achat (OBS, INT,
  INC, VTE, DOC, DEP, PLN, OTR), transaction d'origine de l'ordre de travail (OBS, INC,
  INT, VTE), intervention réalisée de l'ordre, intervention qui corrige une observation.
  Vérifié le 3 septembre : « freinage » propose les interventions de contrôle de
  freinage, le choix pose INT-2026-01002 avec son libellé, et le passage du véhicule à
  AA 032 EA refuse le numéro. **À faire** : proposer aussi le véhicule à partir de la
  transaction choisie (aujourd'hui l'inverse seulement) ; étendre le type aux champs
  « dépense réglée » et « commande » qui restent des listes déroulantes.
- **Coûts & analyses** (3 septembre, soir, Lot 2, entrée Pilotage du rail `/couts`).
  Domaine `src/domaine/couts.ts`, données `src/donnees/couts-demo.ts`, écran
  `src/composants/couts/EcranCouts.tsx`. **Rien ne s'y saisit** : la matière est relue
  sur les fiches véhicules — dépenses (toutes voies de paiement), kilomètres et litres
  de la consommation mensuelle, interventions curatives — sur vingt-quatre mois
  (`DonneesVehicule`, un `MoisVehicule` par mois). Quatre vues par bouton à segments,
  **période** 3 / 6 / 12 / 24 mois, **périmètre** et **BU** communs :
  - **Synthèse** — six tuiles (coût total et moyenne mensuelle, coût au kilomètre,
    parts carburant et maintenance, consommation contre la référence pondérée par les
    kilomètres, véhicules à arbitrer), évolution mensuelle (`GraphiqueBarres`, ligne =
    moyenne de la période), « où va l'argent » (trois familles et leur premier poste),
    **véhicules à arbitrer**, par catégorie (fourchette du coût au km), par BU. Le
    bandeau de KPI y est assumé : c'est une lecture d'agrégats, pas une liste.
  - **Véhicules** — `TableListe` (écran `couts-vehicules`) : km, total, carburant,
    maintenance, autres, **coût / km**, **écart à la médiane de sa catégorie**
    (`qualifier` : catégories d'au moins deux véhicules ayant roulé), L/100 et écart à
    la référence, pannes (interventions curatives), immobilisation, **tendance**
    (trimestre révolu contre le précédent, le mois en cours laissé de côté), âge,
    **lecture** : économe (≤ −15 %), dans la norme, à surveiller (≥ +15 %), **à
    arbitrer** (≥ +40 % — réparer ou réformer ?). Seuils `SEUIL_ECONOME`,
    `SEUIL_SURVEILLER`, `SEUIL_ARBITRER`, à porter dans Paramètres. Filtres Tous / À
    arbitrer / À surveiller / Économes / Conso en dérive / Lourds / Légers. Le verdict
    se prend contre toute la catégorie, quelle que soit la BU affichée.
  - **Postes** — le tableau **poste × mois** que le métier tient à la main dans « SUIVI
    DEPENSES PARC 2025 - 2026.xlsx » : groupes carburant / maintenance / autres avec
    sous-totaux, total, part, kilomètres et coût au km par mois ; défile dans sa carte.
  - **Carburant** — le **rapport mensuel des consommations** que la fiche ne montre pas
    (décision du 2 septembre : sur la fiche, seulement les pleins) : véhicule × mois en
    L/100 contre la référence de la catégorie (vigilance au-delà de 8 %, dérive au-delà
    de 15 %), litres, km, écart ; ligne Flotte.
  - **Périmètre** (`Perimetre`) : **exploitation** (sans amortissement ni salaire) ou
    **complet** — la question 52 du cadrage reste ouverte, l'écran montre les deux.
    L'assurance est dans les deux. **Coût par tonne** : à venir avec les tonnages de
    SediLiv ; ici le coût au kilomètre.
  - La liste Flotte lit désormais son « Coût 12 mois » sur les dépenses de la fiche
    (`page.tsx` de la flotte), la même somme que l'Aperçu et que ce module.
  - Vérifié le 3 septembre dans un onglet neuf : 18 véhicules, 225,7 M F sur douze
    mois, 282 F/km, carburant 61 %, un véhicule à arbitrer (AA 236 MR, +41 % sur sa
    catégorie) ; les quatre vues s'affichent, aucune erreur console. **Limites** : les
    dépenses créées dans l'application ne sont pas comptées (comme l'Aperçu) ; les mois
    d'octobre à décembre 2025 du jeu de démonstration sont creux (les fiches ne
    génèrent que douze mois). **À trancher** : les seuils, les références L/100 par
    catégorie (aujourd'hui des constantes de `fiche-demo.ts`), le périmètre retenu.
- **Tableau de bord SQDCM du parc** (3 septembre, soir, Lot 2 — l'**écran d'entrée** de
  l'application, `/` ; l'ancienne redirection vers `/flotte` est supprimée).
  Domaine `src/domaine/tableau-bord.ts`, faits `src/donnees/tableau-bord-demo.ts`,
  écran `src/composants/tableau/EcranTableauBord.tsx`.
  - **Même modèle que la performance des chauffeurs** : un indicateur a un code, un
    pilier, une catégorie (résultat / performance / signal), une règle de conformité, un
    objectif et une tolérance ; son score vaut 100 tant que l'objectif est tenu puis
    descend en droite ligne jusqu'à zéro (`scoreKpi` de `performance.ts`, dont la
    signature s'ouvre à `{ regle }` pour servir les deux). **Poids du parc**, différents
    de ceux du chauffeur parce qu'on demande d'abord à une flotte d'être disponible :
    **S 25 · Q 15 · D 30 · C 25 · M 5** — à valider.
  - **Quinze indicateurs, trois par pilier.** S : accidents déclarés, accidents
    corporels, conformité documentaire. Q : part du préventif, visites techniques
    acceptées, observations non corrigées. D : **D_TDPA** (jours-véhicules opérationnels
    ÷ jours-véhicules engagés, lu sur la période et non au jour le jour), **D_NPVEL**
    (pannes déclarées en mission — celles du parking ne comptent pas, cadrage §4),
    **D_TICV** (jours d'immobilisation par véhicule engagé). C : coût au kilomètre, écart
    de consommation à la référence, poids du curatif dans le coût de maintenance. M :
    score SQDCM moyen des chauffeurs classés, véhicules opérationnels pourvus d'un
    titulaire, et **coût à la tonne** marqué « à venir » (tonnages de SediLiv), qui ne
    compte pas dans le score.
  - **Rien ne se saisit.** Chaque fait est relu sur les fiches — périodes de statut,
    interventions, visites, observations, documents, dépenses, consommation,
    affectations — sur les déclarations d'incident et sur les évaluations des chauffeurs.
    Chaque ligne du tableau porte le **lien vers l'écran où sa valeur se vérifie**.
  - **L'écran** : bandeau de six tuiles (score global avec son écart à la période
    précédente, puis les cinq piliers avec leur poids), **courbe du score mois par mois**
    (SVG écrit à la main, barre colorée par tranche, ligne de l'objectif 75), **« ce qui
    coûte le plus de points »** (`pointsPerdus` : les indicateurs non tenus, chiffrés en
    points de score global perdus), puis le tableau des quinze indicateurs groupé par
    pilier — valeur, objectif, score, **évolution** contre la période précédente (la
    flèche sait que baisser est une bonne nouvelle pour un indicateur à minimiser),
    source. Période 3 / 6 / 12 mois et business unit ; les compteurs voient leur objectif
    proratisé (six accidents tolérés par an, ce n'est pas six par mois).
  - Vérifié le 3 septembre dans un onglet neuf : score 70/100 « acceptable » sur douze
    mois (S 66, Q 96, D 54, C 75, M 84), D_NPVEL et D_TICV en tête des points perdus,
    aucune erreur console. **Deux corrections au passage** : le bandeau de KPI
    s'écrasait, faute de `shrink-0` — le piège déjà noté en §5, oublié ici **et** sur
    Coûts & analyses, corrigé sur les deux ; et la conformité documentaire du passé
    tombait à 43 % parce qu'un document renouvelé en 2026 paraissait « manquant » en
    2025 — la fiche ne porte que les pièces courantes, pas leur historique, donc le passé
    ne se juge plus que sur les échéances dépassées (92,4 % après correction).
  - **Limites** : les faits sont ceux du jeu de démonstration, servis sur vingt-quatre
    mois, et les créations du navigateur n'y entrent pas ; le score SQDCM d'une business
    unit est celui des chauffeurs dont le véhicule titulaire y est rattaché ; l'historique
    des documents manque pour juger pleinement la conformité passée. **À trancher** :
    tous les objectifs et tolérances, les poids des piliers, et si la direction veut un
    export mensuel de ce tableau (les présentations « INDICATEURS … .pptx » du dossier
    parc en tiennent lieu aujourd'hui).
- **Retouches du 3 septembre, nuit, à la demande du métier** :
  - **Tableaux des fiches** (`TableauSimple`) : **en-tête figé** quand le contenu de
    l'onglet défile (`figerEnTete="fiche"` par défaut, `"page"` sur le Classement,
    `false` pour désactiver) et **choix des colonnes** par compte (`reglages="fiche-
    vehicule.pleins"`, panneau `ChoixColonnes.tsx` partagé avec `TableListe`, colonnes
    `parDefaut: false` masquées d'emblée). Les 22 tableaux des fiches véhicule et
    chauffeur, de l'onglet Incidents et du Classement ont leur clé.
  - **Disponibilité du jour et Flotte** : plus de mention « titulaire / suppléant »
    sous le nom du conducteur ni « administratif · … » sous la pastille de statut (la
    colonne « Ce qui manque » et la fiche les portent ; l'info reste au survol).
  - **Planning des affectations** : un clic sur une barre **ouvre l'affectation**
    (modale tracée : début, fin, motif, historique) au lieu de la fiche véhicule.
  - `TableListe` accepte `surLigne` : un clic sur la ligne ouvre quelque chose au lieu
    de naviguer (caisse, achats) ; le lien de la colonne figée garde son adresse.
  - **Paramètres › Clôture des mois** : la liste couvre du mois courant à janvier de
    l'année précédente, avec un **filtre par année** en bouton à segments (l'année en
    cours par défaut). En production, les années viendront des mois qui portent des
    transactions.
- **Fiche chauffeur › Modifier** couvre toute l'identité (état civil, contact,
  adresse, contact d'urgence, contrat, dates d'entrée et de sortie, permis :
  numéro, catégories en texte « B · C », délivrance, échéances) — même modale,
  même trace ; l'onglet Identité lit les surcharges sous le numéro de la fiche.
- **Retouches du 3 septembre, à la demande du métier** :
  - **Création d'un véhicule** depuis Flotte › « Ajouter un véhicule »
    (`src/composants/flotte/EcranFlotte.tsx`, champs `champsCreation("vehicule")`,
    fabrique `fabriquerLigneFlotte`). Le formulaire demande la **première visite
    technique** : pour un léger neuf, la date accordée par la réglementation. Le
    véhicule créé apparaît en tête de liste avec cette échéance ; sa fiche 360° et
    son inscription dans les autres écrans viendront avec la base (aujourd'hui, les
    créations vivent dans le navigateur, sujet « flotte »).
  - **Caractéristiques modifiables** : « Modifier » sur la fiche véhicule couvre
    aussi l'identité technique (type, dates, puissance, PTAC, charge utile, réservoir,
    entité, régime, télématique, valeur, amortissement) — même modale, même trace ;
    l'onglet Caractéristiques lit les surcharges sous le numéro de la fiche.
  - **Usage du véhicule** (`UsageVehicule` : vrac, frigorifique, poussins, plateau,
    ridelle, citerne, benne, fourgon, tracteur seul, utilitaire, autre), déduit de
    l'appellation en démonstration, saisi à la création en production. **Disponibilité
    du jour** se filtre par **BU** — KPI, capacité et liste suivent le filtre — et la
    capacité est une **bande de tuiles** à trois mailles : catégorie de véhicule,
    catégorie de flotte, **type d'usage** (le métier a refusé un menu déroulant pour
    le type : c'est une maille du bouton Véhicule / Flotte / Type).
  - **Conformité** : filtre par **type de document** (sélecteur dans l'en-tête, en
    plus de la portée) ; un document critique exigé qu'une fiche n'a pas du tout
    (typiquement un document ajouté dans Paramètres) apparaît **manquant** dans
    l'échéancier.
  - **Affectations** : les trois cartes (sans titulaire, chauffeurs disponibles,
    conflits) sont devenues un **bandeau à trois compteurs**, chacun ouvrant un volet
    (un seul à la fois, fermé par défaut) : le point du jour tient en une ligne et le
    planning a la place.
- **Module Disponibilité du jour** (3 septembre, module D du Lot 1) — `/disponibilite`
  (`src/composants/disponibilite/EcranDisponibilite.tsx`, règles dans
  `src/domaine/disponibilite.ts`). **Prêt à charger** se déduit : véhicule engagé et
  opérationnel au **statut effectif** (documents critiques compris), **conducteur du
  jour** affecté — le titulaire s'il peut conduire, sinon un suppléant apte, sinon le
  titulaire empêché —, disponible et apte. Cinq états portés par le filet : prêt,
  sans conducteur, conducteur empêché, immobilisé, hors périmètre (mutation, retrait,
  non engagé). Écran de pilotage, donc un **bandeau** : prêts sur engagés, D_TDPA du
  jour (opérationnels sur engagés), charge utile prête en tonnes, opérationnels non
  prêts ; puis la **capacité par catégorie** (véhicule ou flotte : engagés,
  opérationnels, prêts, part prête, charge utile prête) ; puis la liste avec « ce qui
  manque » et l'action (Affecter → planning, Régulariser → documents). Les
  affectations créées dans l'application ne sont pas encore prises en compte ici
  (lecture serveur du jeu de données) ; la charge utile vient de l'identité de la
  fiche, illustrative jusqu'à l'inventaire.
- **Validité des documents et immobilisation administrative** (3 septembre, demandé
  par le métier) — `src/domaine/documents.ts`, règles proposées **à valider** :

  | Document | Porteur | Validité | Critique |
  |---|---|---|---|
  | Carte grise | véhicule | permanente | oui |
  | Assurance | véhicule | 12 mois | oui |
  | Visite technique | véhicule | 12 mois pour tous ; léger neuf : première date saisie à la création | oui |
  | Licence de transport | flotte | 24 mois | oui (lourds et camionnettes) |
  | Certificat de salubrité | véhicule | 12 mois | oui (transports de denrées) |
  | Carte de transport | véhicule | 12 mois | non — alerte sans immobilisation |
  | Permis de conduire | chauffeur | 60 mois | oui — le chauffeur ne conduit pas |
  | Visite médicale | chauffeur | 12 mois | oui — le chauffeur ne conduit pas |

  À la création ou au renouvellement d'un document sans échéance saisie, **l'échéance
  se calcule** depuis la date d'effet (`echeanceCalculee`), et l'alerte suit
  automatiquement dans l'échéancier (J-60 / J-30 / J-7 / échu), l'Aperçu et la liste.
  Un **document critique exigé, manquant ou échu, immobilise le véhicule** : statut
  effectif « hors service », motif administratif (`immobilisationAdministrative`),
  sans saisie et sans toucher au statut saisi, qui reprend dès le renouvellement.
  Le statut effectif est celui de la liste Flotte (filet, filtres, colonne Statut avec
  la mention « administratif · assurance »), de l'en-tête de la fiche (pastille +
  bandeau « Immobilisé administrativement · … »), de l'Aperçu (alerte) et du planning
  des affectations. Conséquence en démonstration : la licence de vrac alimentaire
  étant échue, AA 633 JL et AA 768 JV, saisis « en service », sont immobilisés — c'est
  la règle voulue ; un véhicule en mutation ou en retrait n'est pas concerné. À
  faire : porter ces règles dans Paramètres, et faire redescendre le statut effectif
  dans D_TDPA et la disponibilité du jour (module D).
- **Référentiel documentaire corrigé** (3 septembre, décisions du métier) : **plus de
  vignette** dans le processus ; un **certificat de salubrité** (Service d'hygiène)
  pour les véhicules qui transportent des denrées — les « transports spéciaux » de la
  fiche ; la **licence de transport est portée par la flotte ou par une partie de la
  flotte** (`LicenceTransport`, `LICENCES` dans `parc-demo.ts`), jamais par un
  véhicule seul. Chaque véhicule couvert l'affiche parmi ses documents avec sa portée
  (« Toute la flotte », « 4 véhicules — transport de vrac alimentaire ») ; un véhicule
  que rien ne couvre est non conforme ; l'échéancier ne compte chaque licence qu'une
  fois, sur la ligne « Toute la flotte » ou « n véhicules » ; elle ne se crée pas
  depuis une fiche véhicule et se renouvellera dans Paramètres › Référentiels (à
  venir). Démonstration : la licence de vrac alimentaire (AB 932 EF, AB 551 HS,
  AA 633 JL, AA 768 JV) est échue depuis le 30/08.
- **Visite technique comme processus** (3 septembre, demandé par le métier). Types
  `VisiteTechnique` (rendez-vous au centre agréé, heure, passage, résultat accepté /
  refusé / annulé, n° de PV, délai de contre-visite, commentaire — numéros VTE) et
  `ObservationVisite` (défaut relevé par le centre : libellé, catégorie, gravité,
  suivi à traiter / en cours / corrigée, intervention qui la corrige, date de
  correction — numéros OBS). Sur la fiche véhicule : carte **Visites techniques** dans
  Conformité (historique complet, modifiable), carte **Observations de visite
  technique** dans Entretien — chaque observation est une **action corrective** suivie
  jusqu'à sa clôture —, alertes de l'Aperçu (refus sans contre-visite prise et délai,
  observations ouvertes, rendez-vous à venir). Menu Ajouter : « Rendez-vous de visite
  technique » (visite ou contre-visite ; le résultat se saisit ensuite par
  modification) et « Observation de visite technique » (rattachée à une visite).
  Échéancier Conformité : une ligne « Contre-visite à programmer » avec le délai et
  le bouton « Prendre rendez-vous », une ligne par rendez-vous pris. Démonstration :
  AA 236 MR a rendez-vous le 08/09, AA 737 ZW a été refusé le 12/08 (trois
  observations, contre-visite le 10/09 avant le 12/10), AB 551 HS refusé le 21/08
  sans contre-visite prise. Reste à faire : renouveler automatiquement le document
  « visite technique » quand une visite passe à « acceptée », et rattacher une
  observation à une intervention par choix plutôt que par numéro saisi.
- **Tri et filtre sur tous les tableaux** (3 septembre, demandé par le métier).
  `src/composants/interface/tri.ts` : une colonne se trie sur ce qu'elle affiche —
  le texte de la cellule rendue, où l'on reconnaît une date « 28/09/2026 », un nombre
  « 12 890 F » ou « 343 307 km », sinon une chaîne — sans configuration par colonne ;
  un écran peut fournir sa propre clé (`tri` sur `ColonneListe`). Clic sur un
  en-tête : croissant, décroissant, puis l'ordre d'origine (qui est, sur les fiches,
  du plus récent au plus ancien — l'ancienneté s'obtient en triant la date en
  croissant). Les listes (`TableListe`) gardent recherche et filtres en bascule ;
  les tableaux des fiches (`TableauSimple`) reçoivent un filtre texte dès qu'ils
  dépassent cinq lignes (`filtrable`), qui retient les lignes contenant chaque mot.
  La **recherche des listes lit toutes les colonnes**, affichées ou non, plus les champs
  propres à l'écran, sans accents ni casse, chaque mot tapé devant se retrouver dans
  la ligne (signalé par le métier le 3 septembre : la recherche de la Flotte ignorait
  le modèle et le statut). Une colonne dont le rendu ne porte pas son texte — une
  pastille de statut — fournit `texte` (`ColonneListe.texte`).
  Le tri n'est pas mémorisé par compte, contrairement aux colonnes et largeurs.
- **Défilement des écrans** (3 septembre, signalé par le métier) : la coquille confie
  le défilement à chaque écran (`lg:overflow-hidden` sur le contenu) ; Affectations,
  Classement et Clôtures ne défilaient donc pas en grand écran. Corrigé : Classement
  et Clôtures défilent en page ; Affectations garde ses cartes de décision en haut
  (chacune bornée, défilant en dedans) et le **planning** prend le reste avec sa
  propre zone de défilement dans les deux sens, la **ligne des mois figée en haut et
  la colonne des véhicules figée à gauche** — le même traitement que les listes.
  Le planning se **zoome au curseur** (demande du métier) : un curseur continu en
  pixels par jour (`pxParJourDe`, de 3 à 1 200), trois repères qui le positionnent —
  **Mois** (une colonne par mois), **Jour** (une colonne par jour, week-ends teintés),
  **Heure** (une colonne par heure) — et la maille de la grille suit le zoom
  (`echelleDe` : mois sous 12 px/jour, jour sous 240, heure au-delà). La fenêtre de
  temps suit aussi en maille jour et heure (ce qui tient dans 1 400 px, aujourd'hui aux
  trois cinquièmes) ; en maille mois, dix mois entiers.
  **Le jour J reste à l'écran** : à l'ouverture et à chaque zoom, la zone se cale pour
  que le trait d'aujourd'hui soit au tiers de la partie visible. Les affectations
  étant datées au jour, une barre couvre ses journées entières à l'échelle de
  l'heure ; l'heure prendra son sens avec les missions de SediLiv.
- **Module Conformité** (3 septembre, module C du Lot 1) — `/conformite`
  (`src/composants/conformite/EcranConformite.tsx`, règles dans
  `src/domaine/conformite.ts`). **Échéancier unique** : chaque document de chaque
  véhicule et de chaque chauffeur actif, plus la prochaine échéance d'entretien, sur
  la même liste (`TableListe`, écran `conformite`). Le filet porte le **niveau** :
  manquant, échu, J-7, J-30, J-60, à jour, permanent (`niveauPour()`, préavis du
  catalogue d'alertes). Les filtres en bascule portent leurs comptes — c'est le
  **centre d'alertes**, sans bandeau de KPI : À traiter, Échus, J-7, J-30, J-60, Tous ;
  portée Tous / Véhicules / Chauffeurs. Chaque ligne mène à la fiche, onglet et
  ligne visés ; le bouton **Renouveler** ouvre le formulaire de création du document
  pré-rempli (type, émetteur, date d'effet du jour), rangé sur la bonne fiche.
  L'envoi des alertes (courriel, cloche) n'est pas fait : les niveaux sont visibles,
  pas encore poussés — à brancher sur la notification au passage de chaque seuil.
  Vérifié le 3 septembre : « Renouveler » le permis échu d'Alioune Thiam crée
  DOC-2026-90001 sur sa fiche. Deux corrections au passage : les documents manquants
  étaient numérotés en 1900 ; deux colonnes portaient la clé « numero » dans les
  tableaux de documents (avertissement React).
  Correction du même jour : en fenêtre étroite, l'en-tête des fiches ne casse plus
  l'immatriculation ou le nom mot par mot ; les actions passent dessous.
- **Module Affectations** (3 septembre, module B du Lot 1) — `/affectations`
  (`src/composants/affectations/EcranAffectations.tsx`, règles dans
  `src/domaine/affectations.ts`). Trois cartes de décision : **véhicules sans
  titulaire** (opérationnels et engagés) avec des **propositions** de chauffeurs
  disponibles aptes, classés par permis adapté à la catégorie, même site, contrat ;
  **chauffeurs disponibles** ; **conflits** du jour (deux titulaires sur un véhicule,
  un chauffeur titulaire de deux véhicules, titulaire indisponible sans suppléant
  apte, chauffeur affecté qui ne peut pas conduire, véhicule opérationnel sans
  titulaire). Puis le **planning** : une ligne par véhicule, six mois en arrière et
  trois en avant, une barre par affectation (titulaire en plein, suppléant en clair),
  trait du jour, chaque barre mène à la ligne de la fiche véhicule. « Nouvelle
  affectation » et chaque bouton « Affecter » ouvrent le formulaire de création
  pré-rempli (véhicule, chauffeur, rôle, date du jour) ; l'affectation est rangée sur
  le véhicule choisi (`sujetDe`) et apparaît sur les deux fiches et le planning.
  Deux limites de la démonstration : le statut des chauffeurs (disponible, en poste)
  vient du jeu de données et ne se recalcule pas après une affectation créée ; une
  affectation créée depuis le planning est rangée sur le véhicule et ne remonte pas
  encore sur la fiche du chauffeur. Vérifié le 3 septembre : le conflit « AA 977 MR
  sans conducteur » disparaît dès qu'un suppléant apte est affecté.
  L'assistant « cascade » du cadrage n'est pas fait : quand un titulaire change de
  véhicule, l'ancien véhicule remonte simplement dans « sans titulaire » avec ses
  propositions — à voir si cela suffit.
- **Formulaires de création et de modification des fiches** (3 septembre, demandé
  par le métier). Chaque entrée livrée du menu « Ajouter » ouvre la même modale en
  **mode création** (`ModaleTransaction`, `mode="creation"`) : champs du type plus
  ce qui se fixe une fois pour toutes (`champsCreation()` dans `champs.ts` — poste et
  origine d'une dépense, source d'un plein, type d'un document, chauffeur ou véhicule
  d'une affectation, remorque ou tracteur d'un attelage, nature et type d'un
  incident), commentaire facultatif, **numéro attribué à l'enregistrement** par une
  séquence par type et par année (`prochainNumero`, séquences de démonstration à
  partir de 90 001), création tracée dans l'historique. Sur un mois clos, un rôle
  non habilité ne crée pas : il change la date ou demande la réouverture. Véhicule :
  plein, dépense, intervention, affectation, attelage, incident (entrée au journal),
  document, relevé, changement de statut (période de statut + statut de l'en-tête).
  Chauffeur : affectation, document, indisponibilité, décision d'aptitude (prime sur
  l'en-tête), contravention, incident, sanction. Les créations sont stockées par
  fiche (`sedima.parc.creations.<sujet>`) et fabriquées à la forme des vues
  (`fabriques.ts`) ; elles n'alimentent pas encore les agrégats de l'Aperçu ni la
  performance — en production, elles seront des lignes comme les autres. Le bouton
  **Modifier** de l'en-tête modifie la fiche elle-même (types `vehicule` /
  `chauffeur`, numéros `VEH-…` / `CHA-…`), tracée comme une transaction, sans
  clôture puisqu'une fiche n'a pas de mois. Un relevé créé n'est pas encore soumis au
  contrôle de cohérence ; un incident créé côté chauffeur n'apparaît pas encore sur
  la fiche du véhicule (les créations sont rangées par fiche).
- **Attelages tracteur–remorque** (3 septembre, demandé par le métier) : entité
  datée `Attelage` (`types.ts`) — tracteur, remorque, début, fin, **définitif** ou sur
  période, motif — numérotée ATT. Carte « Attelages » dans l'onglet Affectations de la
  fiche véhicule (tracteurs et semi-remorques, ou tout véhicule qui en a), avec le
  rôle vu du véhicule (« tire » / « tirée par »), modifiable et tracée comme les
  autres transactions ; l'autre moitié en cours dans l'en-tête de la fiche et en
  colonne optionnelle de la liste ; entrée « Attelage » du menu Ajouter ; numéros dans
  la recherche. Règle : un jour donné, une remorque n'a qu'un tracteur et un tracteur
  qu'une remorque — à faire respecter par le formulaire. Démonstration : AB 551 HS
  attelé en permanence à AA 633 JL, prêté un mois à AA 737 ZW.
- **VIN** (3 septembre) : `Vehicule.vin`, affiché dans Caractéristiques →
  Identification, colonne optionnelle de la liste Flotte, cherché par `Ctrl+K`. Les
  VIN de démonstration sont illustratifs (sauf AA 032 EA) ; l'inventaire de référence
  apportera les vrais.
- **Discussion sur les fiches** (3 septembre, demandé par le métier) — bouton
  « Discussion » dans l'en-tête des fiches véhicule et chauffeur, qui ouvre un
  panneau à droite par-dessus le contenu (`src/composants/discussion/PanneauDiscussion.tsx`) :
  fil horodaté groupé par jour (Aujourd'hui / Hier / date), messages avec auteur et
  heure, **mentions « @ »** avec sélecteur (flèches, Entrée, Tab), personnes citées
  mises en évidence et annoncées comme « prévenues », Entrée pour envoyer, Maj+Entrée
  pour la ligne. Personnes citables : les utilisateurs de l'application et les
  chauffeurs passés par le véhicule. Stockage de démonstration dans le navigateur
  (`src/lib/discussion-demo.ts`, une clé par sujet, amorcé avec deux ou trois messages) ;
  modèle dans `src/domaine/discussion.ts`. Au branchement : table `message` (sujet,
  auteur, date, texte, mentions), RLS, et notification des personnes citées.

### Décision de design (2 septembre 2026, soir)

Le user a jugé la première version **« très loin »** des références Dribbble qu'il avait
données. Elle appliquait la charte SEDIMA-OCT à la lettre : dense, tout en gras, sans
respiration. Décision : **la charte donne l'identité, les références donnent le
traitement.** Concrètement :

- fond froid très clair `#F4F6F9`, cartes blanches à rayon 14 px et ombre à peine
  perceptible, un seul filet ;
- graisses légères : 400/500 partout, 600 sur les titres de bloc et les boutons,
  700 sur le seul titre de page (22 px) ;
- identifiants (immatriculations) en vert foncé, comme les liens des références ;
- contrôles en pilule : recherche, filtres en bascule d'onglets, pastilles sans bordure ;
- barre d'outils **dans** la carte du tableau, pagination en pied (25/50/100 par page) ;
- barre d'application à 60 px, avatar en vert, cloche de notifications ;
- rail à 240 px (64 px rétracté), entrées de 36 px à rayon 10 px.

Le vert reste réservé à l'action principale, à l'état actif et au focus. Rien n'a
changé dans le comportement : colonnes figées, largeurs réglables, préférences par compte.

### Décisions d'interface prises avec le métier

- **Pas de redondance d'information sur une même vue** (2 septembre, soir). Une donnée
  n'apparaît qu'à un endroit par écran : sur la fiche, le statut est dans l'en-tête et
  nulle part ailleurs, la conformité dans la carte Situation, le prochain entretien dans
  les échéances, le journal dans son onglet. Le fil d'Ariane ne répète pas le titre.
- **Chaque dépense est une occasion de relever le compteur** : le kilométrage est un
  champ de la dépense (plein, intervention, pneus, contravention…), et l'odomètre se
  déduit des relevés, il ne se saisit pas à part.
- **Business unit et site sont deux colonnes distinctes** dans la liste flotte.
- **Aucune barre de défilement visible dans le rail** ni dans la barre d'onglets.

- Le **filet de couleur en début de ligne porte le statut**, pas la conformité.
- **Pas de bandeau de KPI sur les écrans de liste** — réservé au tableau de bord SQDCM.
- Les largeurs de colonnes sont **déclarées** (`table-fixed` + `colgroup`) : elles ne
  bougent pas quand un filtre change le contenu affiché.
- **Colonnes et largeurs sont enregistrées par compte.** Aujourd'hui dans le
  navigateur sous une clé qui porte le rôle ; demain dans une table de préférences.
- La page ne défile pas : **le tableau possède sa propre zone de défilement**, ce qui
  est la seule façon de figer son en-tête (voir les pièges).
- Le **détail de conformité et le marqueur « transport spécial »** ont été retirés de
  la liste : ils vont sur la fiche 360°.

### Les sept statuts

`en-service` · `en-backup` · `en-reparation` · `en-restauration` · `hors-service` ·
`en-mutation` · `retrait-en-cours`. Couleurs dans `globals.css`, libellés dans
`src/domaine/libelles.ts`.

**Les deux premiers sont opérationnels** : ils forment le numérateur de D_TDPA.
Le statut « prêt à charger » du CDC est plus exigeant encore — opérationnel **et**
chauffeur affecté **et** disponible pour le chargement. Il se déduit, il ne se saisit
pas. **Livré** le 3 septembre avec le module Disponibilité du jour (§3).

---

## 4. Ce qui reste à faire

**État au 3 septembre 2026** : liste Flotte, fiche véhicule 360° et module
**Chauffeurs** (liste + fiche) livrés ; la discussion est en place sur les deux
fiches. Le module Chauffeurs n'a pas encore été validé écran par écran avec le
métier : **c'est la première chose à faire** dans la prochaine session, avant
d'attaquer le module suivant. Ordre proposé pour le Lot 1, un module par session :

| Ordre | Module (rail) | Ce qu'il contient | S'appuie sur |
|---|---|---|---|
| A | **Chauffeurs** — livré le 3 septembre, à valider | liste, fiche chauffeur (permis, visite médicale, affectations, consommation, contraventions, incidents et sanctions sur période) | `Chauffeur`, `Affectation`, `Document` de `types.ts` |
| B | **Affectations** — livré le 3 septembre, à valider | planning véhicule × période, titulaire / suppléant, conflits, véhicules sans chauffeur, propositions | `AffectationFiche` de la fiche véhicule, `AffectationChauffeur` de la fiche chauffeur, `LigneChauffeur.statut` (disponibles) |
| C | **Conformité** — livré le 3 septembre, à valider | échéancier unique tous véhicules et chauffeurs, centre d'alertes, règles J-60 / J-30 / J-7 | `documents` et `echeances` de la fiche |
| D | **Disponibilité du jour** — livré le 3 septembre, à valider | statut « prêt à charger » = opérationnel + chauffeur affecté + disponible, capacité par catégorie de flotte | `STATUT_VEHICULE.operationnel`, périodes de statut, `STATUT_CHAUFFEUR.mobilisable` et `nonConforme()` du chauffeur |
| E | **Incidents & sinistres** — livré le 3 septembre, à valider | formulaire en quatre étapes (`CADRAGE-INCIDENTS.md`), liste, onglet de la fiche, période de statut, relevé, dépense, sanction, notifications | `DeclarationIncident`, `LigneIncident` |
| F | **Caisse & achats** — livré le 3 septembre (nuit), à valider | journal de caisse à dépense rattachée obligatoire, dépenses en attente de règlement, demandes d'achat citant la transaction d'origine, circuit de validation à seuil | `LigneMouvement`, `LigneAchat` de `domaine/caisse.ts`, dépenses d'origine `caisse` des fiches |

Les formulaires du menu « Ajouter » (point 1 ci-dessous) peuvent se faire module par
module, chacun avec le sien, plutôt qu'en un bloc.

Dans l'ordre où je le ferais pour la fiche elle-même :

1. **Formulaires derrière le menu « Ajouter »** de la fiche
   (`src/composants/vehicule/MenuAjout.tsx`, calqué sur le menu « Add » de Fleetio) :
   plein, dépense, intervention, affectation, incident ou accident, document, relevé
   kilométrique, changement de statut — puis inspection et ordre de travail (Lot 2,
   affichés inertes). Aujourd'hui chaque entrée ouvre l'onglet qui liste ce type ;
   demain elle ouvrira sa modale (carte centrée, champs arrondis, bouton plein), avec
   le contrôle de cohérence sur tout kilométrage saisi. Le bouton « Modifier » et les
   boutons d'ajout en tête des listes sont eux aussi à brancher.
2. **Schéma Supabase du Lot 1** — migrations SQL, RLS, `get_me()`. Reprendre les
   conventions de `SEDIMA-OCT/supabase/`.
3. **Branchement** — remplacer `src/donnees/parc-demo.ts` et `src/lib/session-demo.ts`.
4. **Inventaire de référence** — consolider les huit listes du dossier parc en une
   seule, immatriculations normalisées, écarts signalés pour arbitrage. À faire
   valider par l'équipe parc avant toute reprise de données.
5. Les autres écrans du rail, dans l'ordre du phasage.

### Décisions du métier sur le module Chauffeurs (3 septembre 2026)

- **Statut déduit + aptitude saisie.** Le statut (en poste, disponible, indisponible,
  sorti) reste déduit. S'y ajoute une **aptitude** saisie par la gestion de parc —
  apte, apte avec réserve, inapte — avec motif et date (`Chauffeur.aptitude`). Elle
  se lit en pastille dans l'en-tête de la fiche quand elle n'est pas « apte », dans la
  carte Situation, dans Identité, en colonne optionnelle de la liste, et dans les
  alertes. Un inapte est **non conforme** (`nonConforme()`), ne peut pas conduire
  (`peutConduire()` — à reprendre par Disponibilité du jour), a S_CH_APT à zéro et
  n'est pas classable.
- **Tout au titulaire.** Les kilomètres, la consommation, les contraventions, les
  frais, les relevés et les pannes d'un véhicule vont au titulaire. Le suppléant ne
  reçoit que les jours où le titulaire est **indisponible** (congé, maladie,
  suspension, formation) ou absent : un jour n'a qu'un conducteur. Conséquence
  assumée : un suppléant permanent d'un titulaire toujours présent n'a rien à son
  actif et n'est pas classable (Ousmane Faye sur AA 633 JL) ; le congé de Moustapha
  Diaw du 3 au 21 février 2026 est enregistré pour que la suppléance d'Ibrahima
  Camara lui soit attribuée.
- **La sanction est une trace** (Q69). La retenue sur salaire est enregistrée comme
  décision, sans montant : **le montant est une donnée de paie, suivie aux RH, pas
  ici**. `Sanction.montant` a été retiré ; la contravention garde son indicateur
  « prise en charge chauffeur », qui n'est qu'une décision.
- **Les personnes citées dans une discussion sont prévenues.** Cloche de la barre
  d'application (`src/composants/coquille/Cloche.tsx`) : point rouge tant qu'il y a du
  non lu, liste des messages où l'on est cité, clic vers la fiche discussion ouverte
  (`?discussion=1`). Stockage de démonstration par destinataire
  (`src/lib/notifications-demo.ts`) ; en production, table `notification` alimentée par
  un déclencheur sur `message`, puis courriel ou Teams. Les chauffeurs, non
  utilisateurs, sont mis en évidence dans le fil mais pas notifiés.
- **Le SQDCM chauffeur est validé**, avec la règle des accidents précisée le 3
  septembre : **plus d'un accident sur la période, quelle qu'en soit la
  responsabilité, élimine avec le minimum de points** (score à zéro, prime nulle) ;
  un seul accident responsable ramène son indicateur à zéro sans éliminer. Les autres
  éliminatoires : sanction lourde, inaptitude ou documents non valides, moins de
  300 km par mois. Deux indicateurs sont **retenus mais à venir**, en attendant les
  livraisons de SediLiv : volume transporté (D_CH_TON, tonnes rapportées à la moyenne
  de la catégorie) et coût par tonne (C_CH_CPT, carburant + frais + incidents ÷
  tonnes, part chauffeur de C_CDM_SEDI). Ils s'affichent « à venir » et ne comptent
  pas tant qu'ils ne sont pas alimentés. Le **rang du mois révolu** est affiché dans
  l'en-tête de la fiche chauffeur, à côté du statut.
- **Qui voit les sanctions** : administrateur, gestionnaire de parc, direction. Le
  contrôle de gestion ne les voit pas — les retenues n'étant plus dans l'application,
  il n'en a pas besoin.

### Points à trancher avec le métier sur le module Chauffeurs

- **Performance SQDCM** : l'activité kilométrique (D_CH_ACT) compare à la moyenne des
  chauffeurs en poste faute de tonnages livrés — SediLiv les apportera. Le montant de
  la prime variable n'est pas dans l'application, seulement la part attribuée.
- Qui peut **lire** un fil de discussion — tout le monde, ou le périmètre du rôle ?
- **Qui clôture** : direction et administrateur aujourd'hui. Le contrôle de gestion
  doit-il pouvoir clôturer, ou seulement demander la clôture ?
- **Création sur un mois clos** : aujourd'hui bloquée pour les rôles non habilités
  (changer la date ou demander la réouverture). Faut-il plutôt une demande de
  création approuvable, comme pour la modification ?

### Questions ouvertes qui bloquent

- **Q42** — ~~les grilles tarifaires transporteurs sont-elles formalisées par
  écrit ?~~ **Répondue le 4 septembre 2026** : oui, `TARIF TRANSPOTEURS.xlsx`
  dans le dossier de la DO. La question devient : **quel statut leur donner ?**
  Un tableur tenu par la gestion de parc n'est pas opposable à un transporteur.
  Lesquelles reposent sur un contrat signé, lesquelles sur un accord verbal ?
  L'écran Transporteurs › Grilles pose le compte. Sans réponse, un écart de
  facturation se discute mais ne se conteste pas.
- **Q52** — le coût interne inclut-il amortissement et assurance ? Le référentiel KPI
  dit non, le CDC §8.4 dit oui. Les deux ne peuvent pas coexister.
- **Q74 (neuve)** — **qui tient les programmes d'entretien ?** Les gabarits
  engagent le coût de tout le parc : passer une vidange de 15 000 à 12 000 km sur
  le programme « poids lourd » ajoute environ 300 000 F par véhicule et par an,
  sur treize véhicules. Le responsable de parc en a-t-il la main seul, faut-il
  l'accord de l'atelier, ou est-ce une décision de la Direction des Opérations ?
  Tant que ce n'est pas tranché, l'écran des programmes reste en lecture.
- **Q72 (neuve)** — **sur quel prix la retenue à la source s'applique-t-elle ?**
  Deux conventions coexistent sans qu'aucune soit écrite : Dème facture 147 368 F
  pour 140 000 F de grille et touche ses 140 000 ; Mouhamed Sy, Dame Ndoye et
  Aïssata Gaye facturent le prix convenu et touchent 5 % de moins. **1,9 M F par
  an** sur les seules prestations relevées, et douze lignes où l'on ignore
  laquelle s'applique. À trancher au contrat, transporteur par transporteur.
- **Q73 (neuve)** — **que devient le contrat ADEX ?** Le compte rendu le dit
  « inadapté et à revoir » et demande un contrat hors mise à disposition,
  articulé au km, à la tonne ou à la mU. L'application donne le coût complet au
  jour et à la tonne ; **au km, le relevé n'existe pas**. Faut-il l'obtenir
  d'ADEX (relevé mensuel de compteur), l'estimer depuis les litres, ou négocier
  à la tonne ? Sans réponse, le plan d'action reste sans chiffre.
- **Q71 (neuve)** — sur quelle **base** mesurer le taux d'externalisation ? Le
  référentiel DO le définit en tonnes ; faute des tonnages internes (SediLiv),
  l'application le calcule **en coût de transport** et l'affiche ainsi. Les deux
  bases ne donnent pas le même chiffre : à trancher avant de comparer à la cible.
- **Q54** — la cible de C_TED_EXT est fixée à 35 % alors que le modèle transport 2026
  prévoit ~60 % d'externalisation.
- **Q62** — existe-t-il une réception formalisée (GRN), ou se confond-elle avec la
  facture ? Sans elle, le rapprochement à trois voies se réduit à deux. L'application
  distingue déjà la réception (REC) de la facture (FAC) ; si le métier confirme qu'il
  n'y a pas de réception formalisée, la réception se saisira au moment de la facture.
- **Q66** — confirmer le mécanisme d'accès de l'application de gestion de la
  performance, pour le reprendre à l'identique.

---

## 5. Pièges rencontrés, à ne pas refaire

**Le reset CSS doit rester dans `@layer base`.** Hors couche, une règle d'élément
comme `button{background:none}` l'emporte sur les utilitaires Tailwind et tous les
boutons perdent leur fond.

**`overflow-y: clip` ne sauve pas l'en-tête figé.** Un conteneur qui défile
horizontalement est nécessairement une zone de défilement verticale : la
spécification ramène `clip` à `hidden` dès que l'autre axe défile. Pour figer un
en-tête de tableau, il faut donner au tableau sa propre hauteur bornée et son propre
défilement. Vérifié sur le style calculé, pas supposé.

**Un conteneur `overflow-x: auto` autour d'un tableau tue son en-tête figé.** Il
devient une zone de défilement, et `sticky` se fige par rapport à lui — donc jamais,
puisqu'il ne défile pas verticalement. Sur les tableaux des fiches, le conteneur est
passé à `overflow-x: clip` (qui ne crée pas de zone de défilement) : l'en-tête se fige
dans la zone de l'onglet, et ce qui déborde en largeur se retire par le choix des
colonnes. Le décalage à compenser est celui du rembourrage de la zone : `lg:-top-6`
pour les fiches (`py-6`), `lg:-top-7` pour une page (`py-7`) — mesuré, pas supposé.

**Les créations du navigateur se lisent après le montage, jamais pendant
l'hydratation.** Un `typeof window === "undefined" ? [] : lireCreations(…)` dans un
`useMemo` rend côté client, dès l'hydratation, une liste que le serveur n'avait pas :
le sous-titre dit « 94 réceptions » là où le HTML disait « 93 », et React abandonne
l'hydratation. Le bon geste est celui des Prestataires : un état `monte` passé à vrai
dans un effet, et les créations lues seulement quand il l'est (corrigé sur Caisse &
achats le 3 septembre au soir).

**Une décision prise hors de la modale de transaction doit redemander les valeurs.**
`ModaleDecision` écrit par `enregistrerModification`, mais c'est `actualiser()` du
contexte d'édition qui fait relire les surcharges : sans lui, la ligne reste à
l'étape précédente alors que la trace et la notification sont parties.

**Au relâchement d'une poignée de redimensionnement, React n'a pas encore réappliqué
l'état.** Enregistrer depuis une référence miroir, pas depuis la valeur de rendu,
sinon on écrit la largeur précédente.

**Pas de `toLocaleString` dans ce qui est rendu.** Serveur et navigateur ne séparent
pas toujours les milliers avec le même caractère : la page ne s'hydrate pas. Passer
par `nombre()` de `src/lib/format.ts`. De même, un `<title>` SVG doit contenir **une
seule chaîne**, pas plusieurs nœuds texte.

**Un élément `sticky` dans un conteneur défilant à `padding` colle à la hauteur du
padding, pas au bord.** La barre d'onglets de la fiche porte `-top-7` pour compenser le
`py-7` du conteneur, et un fond opaque pour que le contenu ne transparaisse pas.

**Dans un conteneur flex-column défilant, les enfants doivent être `shrink-0`**, sinon
le bandeau de KPI s'écrase quand le contenu dépasse la hauteur. **Refait deux fois le
3 septembre au soir** (Coûts & analyses, puis le tableau de bord) : le bandeau paraît
alors une bande blanche vide, alors que le texte est bien dans le DOM — chercher
`shrink-0` avant de chercher ailleurs.

**Une préférence d'affichage enregistrée doit mémoriser les colonnes connues à
l'instant du choix.** Sans cela, une colonne ajoutée plus tard reste invisible pour
tous ceux qui ont déjà réglé leur affichage.

**Un composant générique qui lit des préférences dans un effet doit recevoir des
tableaux stables.** Un `fixes = []` par défaut dans les paramètres crée un nouveau
tableau à chaque rendu, l'effet repart, écrit l'état, et la page boucle. Les
définitions de colonnes sont des constantes de module, et le défaut est un tableau
vide partagé (`AUCUNE` dans `TableListe.tsx`).

**Dans un `textarea`, Entrée sert à envoyer, mais d'abord à choisir.** Quand le
sélecteur de mention est ouvert, Entrée et Tab insèrent la personne surlignée ; sinon
Entrée envoie et Maj+Entrée va à la ligne. L'ordre des tests dans `onKeyDown` est
ce qui rend le geste naturel.

---

## 6. Conventions

Tout le vocabulaire du code est **en français**, comme dans MMS Finances :
`src/composants`, `src/domaine`, `src/donnees`, `src/lib`, groupe de routes
`(application)`. Les commentaires expliquent *pourquoi*, pas *quoi*.

Trois choix structurants du modèle, à ne pas défaire :

1. **L'affectation est une entité datée**, pas un champ « chauffeur » du véhicule.
2. **Toute dépense est un mouvement daté rattaché à un véhicule**, quelle que soit sa
   voie de paiement.
3. **Le relevé kilométrique est un fait daté**, d'origine tracée.

À quoi s'ajoutent, pour rendre les KPI calculables : un **historique de statut
horodaté** et un marqueur **transport spécial** porté par le véhicule.

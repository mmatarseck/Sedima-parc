# Les pièces de rechange du parc : une proposition avant construction

*Proposition du 8 septembre 2026, à valider. Demande du métier : « intégrer le
module de gestion des pièces de rechange du parc ; faire une proposition de
cette gestion avant exécution ». Rien n'est construit : ce document dit ce que
le module ferait, sur quoi il s'appuie, et les sept décisions qui restent à
prendre. La construction commence quand elles sont prises.*

## Le parti pris

**Le stock ne se saisit pas : il se déduit.** C'est la règle qui a décidé du
compte prestataire (« la dette ne se saisit pas, elle se déduit ») et elle vaut
ici mot pour mot. Un stock tenu à la main diverge dès la première semaine ; un
stock déduit des mouvements — ce qui est entré, ce qui est sorti, ce qui a été
compté — est juste par construction, et chaque quantité se remonte jusqu'au
fait qui l'a produite : la livraison, l'ordre de travail, l'inventaire.

**Une pièce ne sort jamais dans le vide.** Toute sortie cite ce qui la
justifie : l'ordre de travail en atelier, l'intervention faite, ou au moins le
véhicule. C'est ce rattachement qui donne, sans rien saisir de plus, le coût des
pièces par véhicule, par intervention et par kilomètre — la question que le
métier pose vraiment.

**L'application s'appuie sur ce qu'elle a déjà.** Les fournisseurs de pièces
sont dans le référentiel des prestataires (SENEMECA, Espace Auto, CFAO, Diagne &
Frères…). La demande d'achat existe, avec son numéro de DA et son bon de
commande Sage X3, et sa dette se lit dans le compte du prestataire. L'ordre de
travail (migration 0016) et l'intervention portent déjà le montant. Le poste de
dépense « pièces » existe. Le module ajoute la matière qui manque — la pièce,
le magasin, le mouvement — et relie le reste.

## Ce que le module tient

### Le référentiel des pièces

Une fiche par pièce, numérotée `PCE-…` : référence interne, désignation,
catégorie (filtration, lubrifiant, freinage, pneumatique, électricité,
transmission, moteur, carrosserie, consommable, autre), unité (pièce, litre,
jeu), référence constructeur, photo, fournisseur habituel et prix de référence,
**stock minimum et maximum** par magasin, et les **compatibilités** : les
marques et modèles qu'elle sert, tels que la flotte les nomme (Mercedes Actros,
Renault Kerax, Toyota Hilux…). La compatibilité fait que l'atelier ne cherche
pas dans tout le catalogue : sur un véhicule, seules ses pièces apparaissent.

### Les magasins

Un magasin est un lieu de stockage rattaché à un site — l'atelier central
d'abord, puis, si le métier le décide, un magasin par dépôt ou par ferme. Un
magasin a un responsable. Le stock se lit par magasin et en tout.

### Les mouvements

Le journal, numéroté `MVT-…`, avec cinq natures :

| Nature | Ce qui l'occasionne | Ce qu'il cite |
|---|---|---|
| **Entrée** | Une livraison reçue | Le bon de commande X3 (la demande d'achat), le fournisseur, le prix unitaire, la photo du bon de livraison |
| **Sortie** | Une pièce posée ou donnée à l'atelier | L'ordre de travail ou l'intervention, donc le véhicule ; à défaut le véhicule seul |
| **Retour** | Une pièce sortie et non posée | La sortie qu'il annule |
| **Transfert** | D'un magasin à un autre | Les deux magasins |
| **Régularisation** | Un inventaire qui a compté autre chose | L'inventaire, le motif, celui qui a validé |

Le stock d'une pièce dans un magasin est la somme de ces mouvements. Rien
d'autre.

### La valorisation

Chaque entrée porte son prix ; le stock se valorise au **coût moyen pondéré**,
recalculé à chaque entrée. Une sortie vaut ce coût moyen à l'instant de la
sortie. C'est la méthode la plus simple qui reste juste quand les prix bougent,
et celle que la comptabilité admet.

### Le lien avec les coûts du véhicule

C'est la décision qui évite de compter deux fois. **L'achat d'une pièce n'est
pas une dépense du véhicule** : il entre en stock, sa dette va au fournisseur.
**La sortie l'est** : à la sortie, l'application crée la dépense « pièces » du
véhicule, au coût moyen, rattachée à l'intervention. Le coût par kilomètre et
les rapports de coûts n'ont rien à apprendre de nouveau : ils lisent des
dépenses, comme aujourd'hui. Le montant d'une intervention devient
main-d'œuvre plus pièces sorties, lisible ligne à ligne.

### Le réapprovisionnement

Une pièce sous son minimum est signalée : sur la liste du stock, sur une
pastille « Pièces sous le seuil » du tableau de bord, et sur une **liste de
réapprovisionnement** qui propose, pour chaque pièce, la quantité qui ramène
au maximum et le fournisseur habituel. Un geste en fait une **demande
d'achat** — la transaction qui existe déjà, préremplie — et la boucle se ferme
d'elle-même : demande, bon de commande X3, livraison qui entre en stock en
citant le bon, facture dans le compte du prestataire.

### L'inventaire

Un inventaire, numéroté `INV-…`, se fait par magasin : on compte, pièce par
pièce, sur le téléphone ou au bureau ; l'application montre l'écart avec le
stock déduit ; la clôture de l'inventaire crée les régularisations, avec un
motif, et demande une validation. Un inventaire ouvert gèle les autres
mouvements du magasin.

### Les pneus

Les pneus sont d'abord des pièces comme les autres (une référence par
dimension, un stock, des sorties sur intervention). Le suivi individuel — un
numéro par pneu, sa position sur le véhicule, ses kilomètres, ses rechapages —
est un module en soi ; il est proposé en phase ultérieure, à décider à part.

## Les écrans

**Au bureau**, une entrée « Pièces de rechange » dans le rail, section Suivi,
sur le modèle des listes de référence (`TableListe`, colonnes au choix) :

- **Stock** : référence, désignation, catégorie, magasin, quantité, minimum,
  coût moyen, valeur, état (pastille : à jour, sous le seuil, épuisée,
  dormante depuis six mois). Filtres par magasin, catégorie, compatibilité.
- **Mouvements** : le journal, avec ce que chaque ligne cite ; saisie d'une
  entrée, d'une sortie, d'un retour, d'un transfert par la modale commune des
  transactions, avec la photo du bon de livraison.
- **Réapprovisionnement** : les pièces sous le seuil, la quantité proposée, le
  fournisseur, le bouton qui crée la demande d'achat.
- **Inventaires** : ouverts et clos, avec leurs écarts.
- **La fiche d'une pièce** (`/pieces/PCE-…`) : identité et photo,
  compatibilités, stock par magasin, mouvements, fournisseurs et prix payés,
  véhicules qui la consomment le plus.

**Sur les fiches existantes** : la fiche véhicule montre, sous chaque
intervention, les pièces sorties et leur coût ; l'ordre de travail liste les
pièces sorties pendant qu'il est en atelier ; la fiche du prestataire compte
ce qu'il a livré.

**Sur le téléphone**, dans l'atelier :

- **Sortir une pièce** : scanner le QR du véhicule, choisir l'ordre en
  atelier, chercher la pièce parmi celles compatibles (ou scanner
  l'étiquette de son casier), la quantité, valider. Trois gestes.
- **Recevoir une livraison** : le bon de commande, les lignes reçues, la
  photo du bon de livraison.
- **Compter** : l'inventaire, pièce par pièce, dans l'ordre des casiers.

Les étiquettes de casier reprennent la mécanique des QR de véhicules : un PDF
de vignettes à imprimer, la référence sous le code.

## Les droits

Un module « Pièces de rechange » s'ajoute aux onze de la fiche d'accès, avec
les trois niveaux habituels : lecture (voir le stock et les mouvements),
saisie (entrer, sortir, retourner, compter), validation (clore un inventaire,
régulariser, transférer). Pas de nouveau profil : le chef d'atelier et l'agent
terrain saisissent, le gestionnaire valide, comme pour la maintenance. Le
périmètre suit celui de la personne : elle voit les magasins de ses sites.

## La base

Une migration `0017_pieces_de_rechange.sql` : les tables `piece`,
`piece_compatibilite`, `magasin`, `mouvement_stock`, `inventaire` et
`inventaire_ligne`, leurs politiques sur le modèle des autres (`peut('pieces',
…)` et le périmètre par site du magasin), une fonction `lire_stock()` qui rend
le stock déduit et valorisé de tous les magasins en un JSON, et `lire_piece()`
pour la fiche. Le jeu de démonstration reçoit une soixantaine de pièces
plausibles pour la flotte (filtres, huiles, plaquettes, courroies, pneus
315/80 R22.5…), leurs entrées et les sorties qui expliquent les interventions
déjà en démonstration.

## L'ordre proposé

1. **Le référentiel et le stock** : pièces, compatibilités, magasins, la liste
   Stock, la fiche d'une pièce, le seed. Le stock se lit mais rien ne bouge
   encore.
2. **Les mouvements** : entrée sur livraison, sortie sur ordre ou
   intervention, retour, transfert ; la dépense « pièces » créée à la sortie ;
   les pièces sous chaque intervention de la fiche véhicule.
3. **Le téléphone** : sortir une pièce depuis l'atelier, recevoir une
   livraison, les étiquettes de casier.
4. **Le réapprovisionnement** : seuils, liste de réapprovisionnement, demande
   d'achat en un geste, pastille du tableau de bord, rapports (valeur du stock,
   consommation par véhicule, pièces dormantes, délais des fournisseurs).
5. **L'inventaire** : comptage, écarts, clôture validée.

Chaque étape se livre seule et se recette avant la suivante, comme les modules
précédents.

## Les décisions à prendre

Pour chacune, la proposition retenue est en premier ; dire « d'accord » suffit.

1. **Les magasins** : un seul, l'atelier central, pour commencer — ou dès le
   départ un par site qui stocke ?
2. **Le stock déduit, valorisé au coût moyen pondéré** — ou un stock saisi et
   corrigé à la main, ou une autre méthode de valorisation ?
3. **Sage X3** : l'application tient le stock *technique* du parc et cite le
   bon de commande X3 à chaque entrée, sans ressaisir la facture — ou X3 tient
   déjà un stock de pièces, auquel cas le module doit s'y accorder plutôt que
   le doubler. *À vérifier avec la comptabilité.*
4. **Toute sortie rattachée** (ordre de travail, intervention, ou véhicule),
   et c'est la sortie — non l'achat — qui fait la dépense du véhicule ?
5. **Les pneus comme des pièces d'abord**, le suivi individuel plus tard ?
6. **Pas de nouveau profil** : chef d'atelier et agent terrain saisissent, le
   gestionnaire valide ?
7. **Les étiquettes de casier en QR**, sur le modèle des véhicules ?

Deux questions ouvertes, sans proposition : y a-t-il aujourd'hui un magasinier
désigné, et le stock initial sera-t-il compté (un premier inventaire) ou repris
d'une liste existante ?

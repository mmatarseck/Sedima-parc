# SEDIMA Parc

Gestion de la flotte automobile, des chauffeurs, de la maintenance, du
carburant, des achats, du budget et des transporteurs — pour SEDIMA Logistique
& Distribution.

L'application tourne aujourd'hui sur un **jeu de démonstration** : aucune base
n'est branchée, et tout ce qui s'affiche est dérivé de données écrites dans
`src/donnees/`. C'est délibéré — on montre l'application avant de reprendre les
données, et le jeu de démonstration dit toujours ce qu'il extrapole.

---

## Démarrer

```bash
npm install
npm run dev
```

L'application écoute sur <http://localhost:3000>.

| Commande | Ce qu'elle fait |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Construction de production — rend 169 pages statiques |
| `npm start` | Sert la construction |
| `npm run typecheck` | `tsc --noEmit`, en mode strict |
| `npm run verifier-charte` | Tient les règles du projet (voir plus bas) |

## Ce que le projet s'impose

Ces règles ne sont pas des préférences : chacune répond à un problème rencontré.
`npm run verifier-charte` les vérifie, et l'intégration continue s'en sert.

- **Le vocabulaire du code est en français.** Le métier lit le code ; un
  `handleSubmit` au milieu d'un `enregistrerModification` casse la lecture.
- **Les commentaires disent *pourquoi*, pas *quoi*.** Le code dit déjà ce qu'il
  fait ; ce qu'on oublie en six mois, c'est la raison.
- **Aucune bibliothèque de graphiques ni de classeurs.** Les graphiques sont en
  SVG écrit à la main, le classeur `.xlsx` par `src/lib/xlsx.ts`. Une
  bibliothèque emporte un style qui n'est pas le nôtre et pèse plus qu'elle ne
  rend.
- **Aucun bouton sans action.** Un bouton qui ne fait rien est pire qu'un bouton
  absent : il promet.
- **Pas de bandeau d'indicateurs sur un écran de liste.** On y retrouve
  quelqu'un ou quelque chose ; ce qui s'agrège est sur la fiche ou le tableau de
  bord.
- **Un onglet, un seul type de transaction.**
- **Le rôle n'est jamais décidé par le navigateur.** Il vient du serveur —
  `get_me()` en SECURITY DEFINER.

## Comment c'est rangé

```
src/
  app/            Les routes (App Router). Une page = un écran.
  composants/     Les écrans et l'interface. Rien de métier ici.
  domaine/        Les règles : types, calculs, seuils. Sans React ni données.
  donnees/        Le jeu de démonstration. Remplacé par Supabase, écran par écran.
  lib/            Format, session, paramètres, classeur.
supabase/
  migrations/     Le schéma, les politiques RLS, get_me().
scripts/          Vérification de la charte.
docs/             REPRISE.md — l'état du projet et les décisions du métier.
```

`docs/REPRISE.md` est la note de passage de relais : **à lire en premier**. Elle
dit où en est le projet, ce que le métier a décidé, et pourquoi.

---

## Passer en production

### 1. Le dépôt

```bash
git init
git add -A
git commit -m "Socle SEDIMA Parc"
gh repo create sedima-parc --private --source=. --push
```

L'intégration continue (`.github/workflows/verification.yml`) vérifie à chaque
poussée : les types, la charte, la construction.

### 2. Supabase

Créer un projet dédié, puis appliquer la migration :

```bash
supabase link --project-ref <ref-du-projet>
supabase db push
```

Sept migrations, dans l'ordre :

- `0001_socle.sql` — référentiels, flotte, chauffeurs, transactions, trace des
  modifications, clôture des mois, paramètres — avec les politiques RLS et
  `get_me()` en SECURITY DEFINER.
- `0002_transport_budget.sql` — transporteurs (profils, flotte tierce, grilles,
  rattachements, affrètements, mises à disposition, prestations, relevé de
  transport), entretien (programmes, plans, ajustements), compte fournisseur
  (avances, évaluations), budget, rapports personnalisés.
- `0003_mad_et_licence.sql` — une mise à disposition peut porter sur un mois
  entamé (jours calendaires de 1 à 31), et la licence de transport a sa table,
  `licence_transport`, avec son périmètre (`licence_vehicule`) : elle est
  portée par la flotte, pas recopiée sur chaque véhicule.
- `0004_parc_leger.sql` — le parc léger : un régime d'usage sur chaque
  véhicule (exploitation, service, fonction), les attributaires, les
  attributions avec le plan car, les forfaits carburant, les véhicules à
  recevoir.
- `0005_statut_a_recevoir.sql` — le statut « à recevoir » : un véhicule
  commandé, pas encore livré ni immatriculé.
- `0006_categorie_metier.sql` — la catégorie ajoutée par le métier sur un
  véhicule (`categorie_metier`), à côté de sa famille qui porte les règles.
  Marques, modèles et catégories se règlent dans Paramètres › Véhicules
  (clé `vehicules` de `parametre`).
- `0007_acces_utilisateur.sql` — la fiche d'accès par personne : profil,
  périmètre, écarts par module approuvés par l'administrateur ; le rôle
  « détenteur » entre dans l'énumération. `profil.role` reste la clé que
  `get_me()` rend.

Si `supabase link` refuse le projet, le SQL Editor du tableau de bord donne le
même résultat : coller chaque migration, dans l'ordre.

Puis le jeu de démonstration, si l'on veut une base peuplée pour recetter :

```bash
npm run generer-seed      # écrit supabase/seed.sql et supabase/seed-parties/
supabase db reset         # ou coller les parties, dans l'ordre, dans l'éditeur SQL
```

Le seed est **généré**, jamais écrit à la main : il dit la même chose que
l'application parce qu'il vient de la même source. Il est rejouable (`on
conflict do nothing`), et ses identifiants sont stables — un UUID dérivé du
numéro métier. Il ne porte ni les comptes (ils citent `auth.users`) ni les
fichiers des justificatifs. Le fichier entier (1,3 Mo) dépasse ce que
l'éditeur SQL accepte d'un coup : `seed-parties/` le découpe en parties
ordonnées d'au plus 300 Ko, à coller l'une après l'autre sans en sauter.
`supabase/verifier-seed.sql`, joué ensuite, compare table par table ce que la
base compte à ce que le générateur a versé : tout doit dire « ok ».

Pour valider migrations et seed sans Postgres sur le poste, PGlite (PostgreSQL
en WebAssembly, `npm i -D @electric-sql/pglite`) les rejoue en quelques
secondes avec un schéma `auth` factice ; c'est ainsi que la syntaxe et les
contraintes ont été vérifiées avant d'être jouées sur Supabase.

Après la migration, créer le premier administrateur :

```sql
insert into profil (utilisateur_id, nom, role)
values ('<uuid du compte Supabase>', 'Prénom Nom', 'administrateur');
```

### 3. Vercel

Importer le dépôt. Vercel détecte Next.js — aucun réglage de construction n'est
nécessaire. Poser les variables d'environnement de `.env.example` :

| Variable | Portée |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Toutes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Toutes |
| `SUPABASE_SERVICE_ROLE_KEY` | Serveur seulement — ne jamais préfixer `NEXT_PUBLIC_` |

### 4. Le branchement, écran par écran

Le jeu de démonstration et la base ne cohabitent pas par accident : chaque
module de `src/donnees/` expose des fonctions (`listeChauffeurs()`,
`fichePourImmatriculation()`…) que les écrans appellent. Les remplacer une à une
par des requêtes Supabase branche l'application sans toucher aux écrans.

`src/lib/supabase.ts` fournit les trois clients — navigateur, serveur (session
lue des cookies), service (clé qui passe outre les politiques, serveur
seulement) — et `utilisateurCourant()`, qui appelle `get_me()`. Tant que
`NEXT_PUBLIC_SUPABASE_URL` n'est pas posée, rien de tout cela n'est appelé.

**L'authentification est branchée.** Dès que les variables sont posées :

- `src/proxy.ts` rafraîchit la session dans les cookies à chaque requête et
  garde la porte — sans session, retour à `/connexion` ; avec, la page de garde
  renvoie à la flotte. C'est un contrôle optimiste ; l'autorisation est dans les
  politiques RLS.
- La mise en page de l'application lit la session (`src/lib/session-serveur.ts`)
  et pose le rôle résolu par `get_me()` dans le navigateur (`AmorceSession`),
  sous la clé que les écrans lisaient déjà en démonstration. Un compte invité
  sans profil est renvoyé à la page de garde, qui le dit.
- La page de garde connecte par courriel et mot de passe, envoie le lien de
  réinitialisation, et cache ses comptes de démonstration.

**Le premier module branché** est `src/donnees/referentiels.ts` — sites et
prestataires — et il fixe le motif : une fonction asynchrone par lecture, qui
interroge Supabase avec le client serveur quand un projet est configuré et
rend le jeu de démonstration sinon. Les écrans ne changent pas, seule la page
qui les alimente devient asynchrone. Une page ne mélange pas les sources : les
identifiants diffèrent (« s-uab » en démonstration, un UUID en base), donc les
usages d'un site se comptent là où les sites se lisent.

**Les paramètres sont branchés** — barèmes d'énergie, règles d'alerte, types
de document. Le serveur les lit dans `parametre` et `type_document`
(`src/lib/parametres-serveur.ts`) ; la mise en page les pose dans le
navigateur (`AmorceParametres`) pour que les écrans qui calculent chez eux
appliquent les mêmes règles ; l'écriture passe par une fonction serveur
(`src/lib/parametres-actions.ts`), qui vérifie le rôle avant que les
politiques RLS ne tranchent, et rend le motif d'un refus à l'écran. En
démonstration, le cookie et le stockage du navigateur restent la source.

L'ordre qui tient pour la suite : la flotte et les chauffeurs, puis les
transactions, puis les modules qui en dérivent (coûts, budget, rapports). Le module transporteurs vient en dernier : il dépend de
tout le reste. Les composants client qui importent encore `SITES` ou `FLOTTE`
(formulaires, recherche globale) passeront par des propriétés quand leur page
sera branchée.

**L'inventaire de référence reste à consolider** avant toute reprise : les huit
listes du dossier parc ne s'accordent pas, et les écarts doivent être arbitrés
par l'équipe parc — pas par une migration.

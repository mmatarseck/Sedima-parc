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

`supabase/migrations/0001_socle.sql` pose les référentiels, la flotte, les
chauffeurs, les transactions, la trace des modifications, la clôture des mois et
les paramètres — avec leurs politiques RLS et `get_me()`.

Ce qu'il **reste à écrire** (migration `0002`) : le module transporteurs
(grilles tarifaires, affrètements, relevé de transport), le budget et les
rapports personnalisés. Ils sont conçus et fonctionnent sur le jeu de
démonstration ; on les branche une fois le socle repris en données.

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

L'ordre qui tient : référentiels (sites, prestataires, types de document), puis
la flotte et les chauffeurs, puis les transactions, puis les modules qui en
dérivent (coûts, budget, rapports). Le module transporteurs vient en dernier :
il dépend de tout le reste.

**L'inventaire de référence reste à consolider** avant toute reprise : les huit
listes du dossier parc ne s'accordent pas, et les écarts doivent être arbitrés
par l'équipe parc — pas par une migration.

# Revue de performance — 8 septembre 2026

*Le métier : « l'application devient lente ». Ce que j'ai mesuré, ce qui
ralentit, ce que je propose, dans l'ordre du gain.*

## Ce qui a été mesuré

| Mesure | Résultat |
| --- | --- |
| Production locale, démonstration, première requête | Tableau de bord 0,21 s · Flotte 0,40 s · fiche véhicule 0,10 s · Conformité 0,11 s |
| Production locale, démonstration, requête suivante | 5 à 50 ms partout |
| Version en ligne, page statique `/connexion`, depuis Dakar | 4,4 s à froid (3,3 s de poignée de main TLS), 1,6 s ensuite ; cache Vercel **HIT** à Paris (cdg1) |
| Version en ligne, redirection `/flotte` (fonction serveur) | 1,5 s, puis 0,24 à 0,64 s |
| Un aller-retour vers Supabase depuis Dakar | 0,5 s |
| Serveur de développement (Webpack, liaisons WebAssembly) | `/connexion` 16,9 s à la première compilation ; `/telephone` 2,1 s ; fiche rapide 2,4 s |
| Poids du JavaScript envoyé au navigateur | trois blocs partagés de 235, 202 et 196 Ko, la mise en page de l'application 148 Ko, le cadre React 185 Ko |

L'application elle-même n'est pas lente : servie en production sur ce poste,
chaque page répond en moins d'une demi-seconde à froid. La lenteur vient de
trois endroits, qui ne se corrigent pas au même niveau.

## 1. Le poste de développement (ce qui se voit aujourd'hui)

- **Le binaire natif de Next est bloqué** depuis ce soir par la stratégie de
  contrôle d'application du poste. Next retombe sur ses liaisons WebAssembly,
  cinq à dix fois plus lentes à compiler : 17 s pour la première page, 2 s à
  chaque page nouvelle. Ce n'était pas le cas ce matin.
- **Le projet vit dans OneDrive.** Chaque fichier que Next écrit dans `.next`
  est synchronisé et scanné ; c'est du temps disque à chaque compilation.

Proposition, sans toucher au code :
1. Demander à l'informatique une exception pour
   `node_modules\@next\swc-win32-x64-msvc\next-swc.win32-x64-msvc.node` —
   ou, à défaut, garder le lancement Webpack ajouté ce soir.
2. Sortir `.next` de OneDrive : `next.config.mjs` lit déjà `NEXT_DIST_DIR` ;
   poser `NEXT_DIST_DIR=%LOCALAPPDATA%\sedima-parc\.next` dans
   l'environnement du poste. Mieux : cloner le dépôt hors de OneDrive
   (`C:\dev\sedima-parc`), GitHub tenant lieu de sauvegarde.

## 2. La version en ligne (ce que les utilisateurs verront à Dakar)

- **La distance.** Le cache Vercel répond depuis Paris, la fonction serveur
  depuis la région par défaut de Vercel (Washington), Supabase est en Europe.
  Depuis Dakar, chaque aller-retour vers Supabase coûte 0,5 s ; une fonction
  à Washington qui interroge une base en Europe ajoute encore 0,1 s par
  requête.
- **Le nombre de requêtes par page.** La liste Flotte lit le parc en
  **quatorze requêtes** (véhicules, sites, chauffeurs, affectations,
  documents, licences, relevés, dépenses, pleins, interventions,
  attributions, attributaires, véhicules à recevoir…), les tables de plus
  de mille lignes par pages **successives** (les 1 103 dépenses en deux
  pages, les 2 926 relevés de transport en trois). Les paramètres se lisent
  **deux fois** par page — dans la mise en page, puis dans la page. Rien
  n'est mis en cache : chaque affichage refait tout.
- **Le résultat attendu** : une page Flotte en ligne, c'est 2 à 4 s de base
  avant de rendre quoi que ce soit — et c'est ce que le métier ressent.

Proposition, par ordre de gain :
1. **Une lecture par requête, pas deux.** Envelopper `parametresServeur()`
   et `lignesFlotte()` dans `React.cache()` : la mise en page et la page
   partagent la même lecture. Une ligne par fonction, gain immédiat d'un
   tiers des requêtes.
2. **Une vue en base pour la liste Flotte.** Ce que `lireParc` recompose en
   TypeScript à partir de quatorze tables — compteur courant, prochaine
   échéance, coût sur douze mois, statut effectif — se calcule dans
   Postgres, à côté des données. Une vue `ligne_flotte` (ou une fonction
   `lire_lignes_flotte()`), et la page fait **une** requête au lieu de
   quatorze, sans pagination. Même chose ensuite pour les chauffeurs et le
   tableau de bord.
3. **Un cache court, invalidé à l'écriture.** `unstable_cache` (ou
   `"use cache"` avec `cacheLife`) sur les lectures du parc, une minute, et
   `revalidateTag("parc")` dans chaque fonction serveur qui écrit. Deux
   personnes qui ouvrent la Flotte à la suite ne font qu'une lecture.
4. **Rapprocher la fonction de la base.** Poser la région de la fonction
   Vercel sur celle du projet Supabase (`vercel.json`, `regions`) ; ce sont
   des dizaines d'allers-retours par page qui passent de 0,1 s à
   quelques millisecondes. Vérifier la région du projet Supabase dans son
   tableau de bord.
5. **Les pages qui ne dépendent pas de la session en statique.** Les
   écrans Paramètres et Rapports lisent des référentiels qui bougent peu :
   les rendre une fois et les revalider à l'écriture.

## 3. Le navigateur

- La modale de transaction, le champ « transaction d'origine » et la
  recherche globale importent **les données de démonstration** dans le
  navigateur : la flotte, les chauffeurs, les prestataires, la flotte
  tierce, l'index des références. C'est ce qui fait les blocs de 235 et
  202 Ko, chargés sur toute page qui porte une modale, et les 148 Ko de la
  mise en page (la recherche globale).
- Le champ « transaction d'origine » (`ChampReference`) construit l'index de
  toutes les transactions dans le navigateur à l'ouverture d'un formulaire.

Proposition :
1. **Les listes de choix viennent du serveur.** Sites, chauffeurs,
   prestataires et véhicules se passent en propriétés aux écrans (comme la
   page « Nouveau véhicule » le fait déjà pour les sites et fournisseurs),
   au lieu d'être importés par `champs.ts`. Le bloc partagé perd les
   données de démonstration.
2. **La recherche globale et l'index des références interrogent une
   route** (`/api/recherche?q=`) plutôt que d'embarquer l'index : la mise
   en page revient sous 50 Ko.
3. **La modale de transaction se charge à la demande** (`next/dynamic`) :
   un lecteur qui ne crée rien ne la télécharge pas.

## Ce que je propose de faire en premier

Dans l'ordre, chacun se recette seul : (1) `React.cache()` sur les deux
lectures — une heure de travail, un tiers de requêtes en moins ; (2) la vue
`ligne_flotte` en base — la Flotte, le téléphone et Paramètres › Véhicules
passent de quatorze requêtes à une ; (3) la région Vercel ; (4) les listes
de choix servies par le serveur. Le poste, lui, relève de l'informatique :
l'exception pour le binaire et le dépôt hors de OneDrive.

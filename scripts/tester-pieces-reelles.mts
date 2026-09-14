/* Le magasin de pièces, à ses premières matières.
 *
 * `supabase/pieces-parties/` charge les deux matières que la gestion du parc
 * suit au classeur : les batteries et les embrayages Tata. Ce banc les joue
 * sur le référentiel de production et vérifie :
 *
 *   * que les pièces et les mouvements annoncés entrent, et que le chargement
 *     est rejouable ;
 *   * que **toute sortie est rattachée** à un véhicule du parc — c'est la
 *     règle du module, et une sortie dans le vide n'aurait aucun sens ;
 *   * que le **stock déduit ne passe jamais par un négatif**, à aucune date et
 *     pour aucune pièce : c'est l'invariant que l'entrée déduite du montage
 *     sert à tenir ;
 *   * que le stock au terme du journal est celui que l'en-tête annonce ;
 *   * que chaque régularisation porte son écart signé et son motif, et que
 *     rien d'autre n'en porte ;
 *   * que les dates restent dans la fenêtre des classeurs.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-pieces-reelles.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();
const MOI = "00000000-0000-0000-0000-000000000001";

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key);
  insert into auth.users values ('${MOI}');
  create function auth.uid() returns uuid language sql stable as $$ select '${MOI}'::uuid $$;`);
for (const r of ["anon", "authenticated", "service_role"]) {
  try {
    await pg.exec(`create role ${r}`);
  } catch {}
}
for (const m of readdirSync(join(projet, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
await pg.exec(`insert into profil (utilisateur_id, nom, role, actif) values ('${MOI}', 'Banc', 'administrateur', true) on conflict do nothing;`);
for (const p of readdirSync(join(projet, "supabase/seed-parties")).filter((f) => f.endsWith(".sql")).sort()) {
  let courant: string[] = [];
  for (const ligne of readFileSync(join(projet, "supabase/seed-parties", p), "utf8").split("\n")) {
    courant.push(ligne);
    if (!/^on conflict .*;$/.test(ligne.trim())) continue;
    try {
      await pg.exec(courant.join("\n"));
    } catch {}
    courant = [];
  }
}
const purge = readFileSync(join(projet, "supabase/purge-demonstration.sql"), "utf8");
await pg.exec(purge.slice(purge.indexOf("begin;"), purge.indexOf("commit;") + 7));
const jouer = async (f: string) => {
  const t = readFileSync(join(projet, "supabase", f), "utf8");
  const fin = t.indexOf("-- ---------------------------------------------------------------------------\n-- Vérification");
  await pg.exec(fin < 0 ? t : t.slice(0, fin));
};
await pg.exec(readFileSync(join(projet, "supabase/aligner-referentiel.sql"), "utf8"));
await jouer("vehicules-manquants.sql");
/* Les fournisseurs des pièces — SICAS, ETS MALEYE, TATA INTERNATIONAL — sont
   au référentiel des prestataires, chargé avec la maintenance. */
await jouer("maintenance-parties/maintenance-01-prestataires.sql");

const un = async <T>(sql: string): Promise<T> => (await pg.query(sql)).rows[0] as T;
const referentiel = readFileSync(join(projet, "supabase/pieces-parties/pieces-01-referentiel.sql"), "utf8");
const journal = readFileSync(join(projet, "supabase/pieces-parties/pieces-02-mouvements.sql"), "utf8");
const [, annoncePieces] = /\*\*Ce n'est pas une migration\.\*\* (\d+) pièces/.exec(referentiel) ?? [];
const [, annonceMouvements, premiere, derniere] = /\*\*Ce n'est pas une migration\.\*\* (\d+) mouvements, du (\d{4}-\d{2}-\d{2}) au (\d{4}-\d{2}-\d{2})/.exec(journal) ?? [];
const [, annonceEntrees, annonceSorties] = /-- (\d+) entrées, (\d+) sorties toutes rattachées/.exec(journal) ?? [];
const [, annonceRegularisations] = /-- et (\d+) régularisations/.exec(journal) ?? [];
const annonceStock = new Map<string, number>();
for (const m of (/-- Stock déduit au terme du journal : (.+)\./.exec(journal)?.[1] ?? "").split(", ")) {
  const [, reference, quantite] = /^(\S+) (-?\d+)$/.exec(m) ?? [];
  if (reference) annonceStock.set(reference, Number(quantite));
}

/* -- 1. Le référentiel ------------------------------------------------------- */

await jouer("pieces-parties/pieces-01-referentiel.sql");
const pieces = await un<{ n: number; avec_prix: number; avec_fournisseur: number; avec_seuil: number }>(`select count(*)::int as n,
    count(prix_reference)::int as avec_prix, count(prestataire_id)::int as avec_fournisseur,
    count(*) filter (where stock_minimum > 0)::int as avec_seuil from piece where numero like 'PCE-R-%'`);
attendu(`${pieces.n} pièces entrées (${annoncePieces} annoncées)`, pieces.n === Number(annoncePieces));
attendu(`chacune porte son prix de référence et son fournisseur au référentiel prestataires (${pieces.avec_prix}, ${pieces.avec_fournisseur})`, pieces.avec_prix === pieces.n && pieces.avec_fournisseur === pieces.n);
attendu("aucun seuil de réapprovisionnement inventé", pieces.avec_seuil === 0);

/* -- 2. Le journal ----------------------------------------------------------- */

await jouer("pieces-parties/pieces-02-mouvements.sql");
const compte = await un<{ n: number; entrees: number; sorties: number; regularisations: number; pieces: number; vehicules: number; premier: string; dernier: string }>(`select count(*)::int as n,
    count(*) filter (where nature = 'entree')::int as entrees,
    count(*) filter (where nature = 'sortie')::int as sorties,
    count(*) filter (where nature = 'regularisation')::int as regularisations,
    count(distinct piece_id)::int as pieces, count(distinct vehicule_id)::int as vehicules,
    min(date)::text as premier, max(date)::text as dernier
  from mouvement_stock where numero like 'MVT-R-%'`);
attendu(`${compte.n} mouvements entrés (${annonceMouvements} annoncés) : ${compte.entrees} entrées, ${compte.sorties} sorties, ${compte.regularisations} régularisations`, compte.n === Number(annonceMouvements) && compte.entrees === Number(annonceEntrees) && compte.sorties === Number(annonceSorties) && compte.regularisations === Number(annonceRegularisations));
attendu(`du ${compte.premier} au ${compte.dernier}, comme annoncé`, compte.premier === premiere && compte.dernier === derniere);
attendu(`les trois pièces servent, sur ${compte.vehicules} véhicules`, compte.pieces === pieces.n && compte.vehicules >= 20);

await jouer("pieces-parties/pieces-01-referentiel.sql");
await jouer("pieces-parties/pieces-02-mouvements.sql");
const rejoue = await un<{ pieces: number; mouvements: number }>(`select
    (select count(*)::int from piece where numero like 'PCE-R-%') as pieces,
    (select count(*)::int from mouvement_stock where numero like 'MVT-R-%') as mouvements`);
attendu("rejouable : les fichiers rejoués n'ajoutent rien", rejoue.pieces === pieces.n && rejoue.mouvements === compte.n);

/* -- 3. Toute sortie est rattachée ------------------------------------------- */

const orphelines = await un<{ n: number }>(`select count(*)::int as n from mouvement_stock
  where numero like 'MVT-R-%' and nature = 'sortie' and vehicule_id is null`);
attendu(`toute sortie cite son véhicule (${orphelines.n} orpheline${orphelines.n > 1 ? "s" : ""})`, orphelines.n === 0);
const rattachees = await un<{ entrees: number; regularisations: number }>(`select
    count(*) filter (where nature = 'entree' and vehicule_id is not null)::int as entrees,
    count(*) filter (where nature = 'regularisation' and vehicule_id is not null)::int as regularisations
  from mouvement_stock where numero like 'MVT-R-%'`);
attendu("une entrée et une régularisation ne s'imputent à aucun véhicule", rattachees.entrees === 0 && rattachees.regularisations === 0);

/* -- 4. Le stock ne passe jamais par un négatif ------------------------------- */
/* Le journal est cumulé dans son ordre de numérotation, qui est celui des
   dates ; le minimum du cumul doit rester positif ou nul pour chaque pièce. */

const creux = (await pg.query<{ reference: string; creux: number; quand: string }>(`
  with cumul as (
    select p.reference, m.date,
           sum(case m.nature when 'entree' then m.quantite when 'sortie' then -m.quantite else coalesce(m.ecart, 0) end)
             over (partition by p.reference order by m.numero) as stock
      from mouvement_stock m join piece p on p.id = m.piece_id
     where m.numero like 'MVT-R-%'
  )
  select distinct on (reference) reference, stock::int as creux, date::text as quand
    from cumul order by reference, stock, date`)).rows;
for (const c of creux) attendu(`${c.reference} : le stock ne descend jamais sous zéro (creux ${c.creux} le ${c.quand})`, c.creux >= 0);

const final = (await pg.query<{ reference: string; stock: number }>(`
  select p.reference, sum(case m.nature when 'entree' then m.quantite when 'sortie' then -m.quantite else coalesce(m.ecart, 0) end)::int as stock
    from mouvement_stock m join piece p on p.id = m.piece_id
   where m.numero like 'MVT-R-%' group by 1 order by 1`)).rows;
console.log("    " + final.map((f) => `${f.reference} ${f.stock}`).join(" · "));
attendu(
  `le stock au terme du journal est celui de l'en-tête (${[...annonceStock].map(([r, q]) => `${r} ${q}`).join(", ")})`,
  annonceStock.size === final.length && final.every((f) => annonceStock.get(f.reference) === f.stock),
);

/* -- 5. Les régularisations disent pourquoi ---------------------------------- */

const regularisations = await un<{ n: number; signees: number; motivees: number; ailleurs: number }>(`select
    count(*) filter (where nature = 'regularisation')::int as n,
    count(*) filter (where nature = 'regularisation' and ecart < 0)::int as signees,
    count(*) filter (where nature = 'regularisation' and motif like '%hors référentiel%' or nature = 'regularisation' and motif like '%ne nomme pas%')::int as motivees,
    count(*) filter (where nature <> 'regularisation' and ecart is not null)::int as ailleurs
  from mouvement_stock where numero like 'MVT-R-%'`);
attendu(`les ${regularisations.n} régularisations portent un écart négatif et disent leur cas`, regularisations.signees === regularisations.n && regularisations.motivees === regularisations.n);
attendu("aucun autre mouvement ne porte d'écart", regularisations.ailleurs === 0);

/* -- 6. Ce que les classeurs n'ont pas donné --------------------------------- */

const qualite = await un<{ futures: number; avant: number; sans_motif: number; entrees_sans_bon: number }>(`select
    count(*) filter (where date > current_date)::int as futures,
    count(*) filter (where date < '2025-02-04')::int as avant,
    count(*) filter (where coalesce(trim(motif), '') = '')::int as sans_motif,
    count(*) filter (where nature = 'entree' and demande_numero is null)::int as entrees_sans_bon
  from mouvement_stock where numero like 'MVT-R-%'`);
attendu(`aucune date future ni antérieure au premier bon (${qualite.futures} futures, ${qualite.avant} avant le 4 février 2025)`, qualite.futures === 0 && qualite.avant === 0);
attendu(`chaque mouvement dit d'où il vient (${qualite.sans_motif} sans motif)`, qualite.sans_motif === 0);
console.log(`    ${qualite.entrees_sans_bon} entrée(s) dont le classeur ne nomme pas le bon`);

const propagees = await un<{ n: number }>(`select count(*)::int as n from mouvement_stock
  where numero like 'MVT-R-%' and motif like '%non relevée au classeur%'`);
attendu(`les lignes datées par propagation le disent dans leur motif (${propagees.n})`, propagees.n > 0);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

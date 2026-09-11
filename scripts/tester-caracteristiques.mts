/* Les caractéristiques des véhicules, tirées de la fiche complète du parc.
 *
 * Ce banc joue `supabase/caracteristiques-vehicules.sql` sur une base à l'état
 * du référentiel et vérifie :
 *
 *   * que les véhicules annoncés sont complétés, et les relevés du 8 juillet
 *     chargés ;
 *   * qu'aucun zéro n'entre : une masse ou une puissance inconnue reste nulle ;
 *   * qu'une valeur déjà en base n'est jamais écrasée — sauf la mise en
 *     circulation « 1er janvier » de l'alignement, que la carte grise précise ;
 *   * qu'aucune date n'est future, ni une mise en circulation postérieure à
 *     l'immatriculation ;
 *   * que le chargement est rejouable.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-caracteristiques.mts */
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
/* Le référentiel de production : l'alignement ajoute les véhicules légers au jeu de départ. */
await pg.exec(readFileSync(join(projet, "supabase/aligner-referentiel.sql"), "utf8"));
/* Les véhicules manquants, créés juste avant dans l'ordre de jeu : le fichier les complète aussi. */
const manquants = readFileSync(join(projet, "supabase/vehicules-manquants.sql"), "utf8");
await pg.exec(manquants.slice(0, manquants.indexOf("-- Vérification")));

const un = async <T>(sql: string): Promise<T> => (await pg.query(sql)).rows[0] as T;
const chemin = join(projet, "supabase/caracteristiques-vehicules.sql");
if (!existsSync(chemin)) throw new Error("lancer d'abord scripts/charger-caracteristiques.mts");
const texte = readFileSync(chemin, "utf8");
const nombre = (motif: RegExp) => Number(motif.exec(texte)?.[1] ?? 0);
const annonceVehicules = nombre(/-- (\d+) véhicules complétés/);
const annonceReleves = nombre(/complétés, (\d+) relevés/);
const annoncePuissance = nombre(/-- Puissance pour (\d+) véhicules/);
const jouer = async () => pg.exec(texte.slice(0, texte.indexOf("-- Vérification")));

/* Une valeur déjà en base, que la feuille ne doit pas écraser. */
const temoin = await un<{ immatriculation: string } | undefined>(`select immatriculation from vehicule where immatriculation in ('AA985MR', 'AA633JL', 'AA977MR') order by 1 limit 1`);
if (temoin) await pg.exec(`update vehicule set puissance_cv = 999 where immatriculation = '${temoin.immatriculation}'`);

/* La puissance n'est portée par aucun véhicule du référentiel : ce que le chargement y met se compte net. */
const avant = await un<{ n: number; janvier: number }>(`select count(puissance_cv)::int as n, count(*) filter (where to_char(premiere_mise_en_circulation, 'MM-DD') = '01-01')::int as janvier from vehicule`);
await jouer();
const apres = await un<{ n: number; janvier: number; zeros: number; futures: number; inversees: number }>(`select
    count(puissance_cv)::int as n,
    count(*) filter (where to_char(premiere_mise_en_circulation, 'MM-DD') = '01-01')::int as janvier,
    count(*) filter (where 0 in (puissance_cv, cylindree, ptra, ptac, poids_vide, charge_utile))::int as zeros,
    count(*) filter (where premiere_mise_en_circulation > current_date or date_immatriculation > current_date)::int as futures,
    count(*) filter (where premiere_mise_en_circulation > date_immatriculation)::int as inversees
  from vehicule`);
attendu(`${apres.n - avant.n} véhicules gagnent une puissance (${annoncePuissance} annoncées, ${annonceVehicules} véhicules complétés)`, apres.n - avant.n >= annoncePuissance - 1 && annoncePuissance > 100);
attendu(`les mises en circulation « 1er janvier » de l'alignement cèdent à la carte grise : ${avant.janvier} → ${apres.janvier}`, apres.janvier < avant.janvier);
attendu(`aucun zéro chargé (${apres.zeros})`, apres.zeros === 0);
attendu(`aucune date future (${apres.futures}), aucune mise en circulation après l'immatriculation (${apres.inversees})`, apres.futures === 0 && apres.inversees === 0);
if (temoin) {
  const t = await un<{ puissance_cv: number }>(`select puissance_cv from vehicule where immatriculation = '${temoin.immatriculation}'`);
  attendu(`${temoin.immatriculation} garde la puissance déjà en base (${t.puissance_cv})`, t.puissance_cv === 999);
}
const releves = await un<{ n: number; dates: number; origines: number }>(`select count(*)::int as n, count(distinct date)::int as dates, count(*) filter (where origine <> 'saisie')::int as origines from releve_kilometrique where numero like 'REL-FC-%'`);
attendu(`${releves.n} relevés du 8 juillet chargés (${annonceReleves} annoncés), tous à la même date, saisis`, releves.n === annonceReleves && releves.n > 0 && releves.dates === 1 && releves.origines === 0);

const empreinte = async () => (await un<{ e: string }>(`select md5(string_agg(concat_ws('|', immatriculation, premiere_mise_en_circulation, date_immatriculation, type_modele, puissance_cv, cylindree, ptra, ptac, poids_vide, charge_utile), ',' order by immatriculation)) as e from vehicule`)).e;
const e1 = await empreinte();
await jouer();
attendu("rejouable : un second passage ne change ni les véhicules ni les relevés", (await empreinte()) === e1 && (await un<{ n: number }>(`select count(*)::int as n from releve_kilometrique where numero like 'REL-FC-%'`)).n === releves.n);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

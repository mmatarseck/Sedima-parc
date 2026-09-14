/* Les pneus du parc, un par un.
 *
 * `supabase/pneus-parties/` charge les montages suivis par la gestion du parc.
 * Ce banc les joue sur le référentiel de production et vérifie :
 *
 *   * que les pneus annoncés entrent, tous montés sur un véhicule du parc, et
 *     que le chargement est rejouable ;
 *   * qu'une dimension est toujours écrite — celle du classeur, ou « Dimension
 *     non relevée » quand il n'en donne pas — et qu'aucune date de pose n'est
 *     future ;
 *   * que les pneus d'une même commande se comptent bien un par un ;
 *   * que ce qui n'est pas suivi reste vide : position, compteur, série.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-pneus-reels.mts */
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

const un = async <T>(sql: string): Promise<T> => (await pg.query(sql)).rows[0] as T;
const fichier = readFileSync(join(projet, "supabase/pneus-parties/pneus-01-montages.sql"), "utf8");
const [, annonce, annonceVehicules] = /-- \*\*Ce n'est pas une migration\.\*\* (\d+) pneus montés sur (\d+) véhicules/.exec(fichier) ?? [];

await jouer("pneus-parties/pneus-01-montages.sql");
const compte = await un<{ n: number; vehicules: number; montes: number; sans_vehicule: number }>(`select count(*)::int as n, count(distinct vehicule_id)::int as vehicules,
    count(*) filter (where etat = 'monte')::int as montes, count(*) filter (where vehicule_id is null)::int as sans_vehicule from pneu where numero like 'PNE-R-%'`);
attendu(`${compte.n} pneus entrés sur ${compte.vehicules} véhicules (${annonce} et ${annonceVehicules} annoncés), tous montés`, compte.n === Number(annonce) && compte.vehicules === Number(annonceVehicules) && compte.montes === compte.n && compte.sans_vehicule === 0);
await jouer("pneus-parties/pneus-01-montages.sql");
attendu("rejouable : le fichier rejoué n'ajoute rien", (await un<{ n: number }>(`select count(*)::int as n from pneu where numero like 'PNE-R-%'`)).n === compte.n);

const qualite = await un<{ sans_dimension: number; futures: number; anciennes: number; avec_position: number; avec_km: number; avec_serie: number }>(`select
    count(*) filter (where dimension is null or dimension = '')::int as sans_dimension,
    count(*) filter (where date_pose > current_date)::int as futures,
    count(*) filter (where date_pose < '2024-01-01')::int as anciennes,
    count(position)::int as avec_position, count(km_pose)::int as avec_km, count(numero_serie)::int as avec_serie
  from pneu where numero like 'PNE-R-%'`);
attendu(`une dimension est toujours écrite (${qualite.sans_dimension} vides)`, qualite.sans_dimension === 0);
attendu(`aucune pose future ni antérieure aux classeurs (${qualite.futures} futures, ${qualite.anciennes} avant 2024)`, qualite.futures === 0 && qualite.anciennes === 0);
attendu("ce qui n'est pas suivi reste vide : position, compteur, numéro de série", qualite.avec_position === 0 && qualite.avec_km === 0 && qualite.avec_serie === 0);

const releves = await un<{ n: number }>(`select count(*)::int as n from pneu where numero like 'PNE-R-%' and dimension = 'Dimension non relevée'`);
const dimensions = (await pg.query<{ dimension: string; n: number }>(`select dimension, count(*)::int as n from pneu where numero like 'PNE-R-%' group by 1 order by 2 desc limit 4`)).rows;
console.log("    " + dimensions.map((d) => `${d.dimension} ${d.n}`).join(" · ") + ` · sans dimension au classeur ${releves.n}`);
attendu(`les dimensions du classeur sont lues : ${dimensions.length} dimensions en tête, ${releves.n} pneus sans dimension au classeur`, dimensions[0]!.n >= 20 && releves.n < compte.n / 4);

const camion = await un<{ immatriculation: string; n: number }>(`select ve.immatriculation, count(*)::int as n from pneu p join vehicule ve on ve.id = p.vehicule_id where p.numero like 'PNE-R-%' group by 1 order by 2 desc limit 1`);
attendu(`les pneus d'une commande se comptent un par un : ${camion.immatriculation} en porte ${camion.n}`, camion.n >= 6);
const commentaires = await un<{ n: number }>(`select count(*)::int as n from pneu where numero like 'PNE-R-%' and commentaire like '%pneu %sur %'`);
attendu(`chaque pneu dit d'où il vient et son rang dans la commande (${commentaires.n})`, commentaires.n === compte.n);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

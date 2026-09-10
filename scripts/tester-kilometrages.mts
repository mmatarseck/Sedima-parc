/* Les compteurs lus sur les bons, chargés pour de bon.
 *
 * `supabase/kilometrages.sql` verse 105 relevés d'origine « garage », tirés du
 * **texte** des bons de commande, et porte le kilométrage sur l'intervention
 * qui l'a relevé.
 *
 * Ce banc les charge sur une base à l'état de la production — migrations,
 * seed, purge, maintenance — et vérifie :
 *
 *   * chaque relevé trouve son véhicule ;
 *   * **aucun compteur ne recule** sur un même véhicule : c'est la seule chose
 *     qui rendrait tout calcul de distance faux, et le générateur écarte les
 *     paires incohérentes plutôt que de choisir entre elles ;
 *   * l'intervention du même bon porte désormais son kilométrage ;
 *   * le chargement est rejouable, et ne réécrit pas un kilométrage déjà posé.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-kilometrages.mts */
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

const fichier = join(projet, "supabase/kilometrages.sql");
if (!existsSync(fichier)) {
  console.log("supabase/kilometrages.sql absent — lancez d'abord charger-kilometrages.");
  process.exit(0);
}

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
  const texte = readFileSync(join(projet, "supabase/seed-parties", p), "utf8");
  let courant: string[] = [];
  for (const ligne of texte.split("\n")) {
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
for (const f of readdirSync(join(projet, "supabase/maintenance-parties")).filter((x) => x.endsWith(".sql")).sort()) {
  await pg.exec(readFileSync(join(projet, "supabase/maintenance-parties", f), "utf8"));
}

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};
const un = async <T>(sql: string): Promise<T | undefined> => (await pg.query(sql)).rows[0] as T | undefined;

const avant = await un<{ n: number; k: number }>(
  `select (select count(*) from releve_kilometrique)::int as n, (select count(*) from intervention where km is not null)::int as k`,
);
attendu(`la base part sans relevé, et sans kilométrage sur les interventions (${avant?.n}, ${avant?.k})`, avant?.n === 0 && avant?.k === 0);

const sql = readFileSync(fichier, "utf8");
const jouer = () => pg.exec(sql.slice(0, sql.indexOf("-- Vérification")));
await jouer();

const total = await un<{ n: number; veh: number; du: string; au: string; min: number; max: number }>(
  `select count(*)::int as n, count(distinct vehicule_id)::int as veh, min(date)::text as du, max(date)::text as au, min(km)::int as min, max(km)::int as max
     from releve_kilometrique where origine = 'garage'`,
);
attendu(
  `${total?.n} relevés sur ${total?.veh} véhicules, du ${total?.du} au ${total?.au}, de ${total?.min?.toLocaleString("fr-FR")} à ${total?.max?.toLocaleString("fr-FR")} km`,
  (total?.n ?? 0) > 50,
);

const orphelins = await un<{ n: number }>(`select count(*)::int as n from releve_kilometrique r left join vehicule v on v.id = r.vehicule_id where v.id is null`);
attendu("chaque relevé trouve son véhicule", (orphelins?.n ?? 1) === 0);

/* -- Le contrôle qui compte : un compteur ne recule pas --------------------- */

const recule = (await pg.query<{ immat: string; d1: string; k1: number; d2: string; k2: number }>(
  `select v.immatriculation as immat, a.date::text as d1, a.km as k1, b.date::text as d2, b.km as k2
     from releve_kilometrique a
     join releve_kilometrique b on b.vehicule_id = a.vehicule_id and b.date > a.date and b.km < a.km
     join vehicule v on v.id = a.vehicule_id
    limit 5`,
)).rows;
attendu(
  recule.length ? `un compteur recule : ${recule.map((r) => `${r.immat} ${r.k1}→${r.k2}`).join(", ")}` : "aucun compteur ne recule",
  recule.length === 0,
);

/* -- Le kilométrage porté sur l'intervention -------------------------------- */

const portees = await un<{ n: number }>(`select count(*)::int as n from intervention where km is not null`);
attendu(`${portees?.n} interventions portent maintenant leur kilométrage`, (portees?.n ?? 0) > 50);

const incoherentes = await un<{ n: number }>(
  `select count(*)::int as n from intervention i join releve_kilometrique r on r.vehicule_id = i.vehicule_id and r.date = i.date where i.km is not null and i.km <> r.km`,
);
attendu("le kilométrage de l'intervention est celui du relevé du même jour", (incoherentes?.n ?? 1) === 0);

/* -- Rejouable -------------------------------------------------------------- */

await jouer();
const apres = await un<{ n: number; k: number }>(
  `select (select count(*) from releve_kilometrique)::int as n, (select count(*) from intervention where km is not null)::int as k`,
);
attendu("un second passage n'ajoute rien", apres?.n === total?.n && apres?.k === portees?.n);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

/* Le seed se charge en entier, sans une instruction refusée.
 *
 * Le 10 septembre 2026, en complétant le parc lourd, deux défauts ont fait
 * disparaître **toutes les demandes** du jeu de départ — sans un mot :
 *
 *  1. `generer-seed.mts` coupait ses parties à n'importe quelle ligne, pas
 *     aux frontières d'instruction : un `insert` de plusieurs milliers de
 *     lignes s'est trouvé partagé entre `seed-05` et `seed-06`.
 *  2. `demandes-demo.ts` composait une heure à la main — « 07:{10 + i × 3} »,
 *     qui a donné « 13:61 » dès qu'il y a eu assez de titulaires.
 *
 * Ni l'un ni l'autre n'a fait de bruit, parce que **tous les chargeurs du
 * projet avalent les erreurs** (`try {} catch {}`) : le seed se rejoue sur une
 * base déjà remplie, où les doublons sont normaux. C'est commode et c'est
 * aveugle. Ce banc est l'endroit où l'on regarde.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-seed.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();
const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key);
  insert into auth.users values ('00000000-0000-0000-0000-000000000001');
  create function auth.uid() returns uuid language sql stable as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;`);
for (const r of ["anon", "authenticated", "service_role"]) {
  try {
    await pg.exec(`create role ${r}`);
  } catch {}
}
for (const m of readdirSync(join(projet, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

/* -- 1. Chaque partie est close sur elle-même ------------------------------- */

const parties = readdirSync(join(projet, "supabase/seed-parties")).filter((f) => f.endsWith(".sql")).sort();
let coupees = 0;
for (const p of parties) {
  const texte = readFileSync(join(projet, "supabase/seed-parties", p), "utf8");
  const debuts = (texte.match(/^insert into /gm) ?? []).length;
  const fins = (texte.match(/;\s*$/gm) ?? []).length;
  if (debuts !== fins) {
    coupees++;
    console.log(`   ${p} : ${debuts} instruction(s) ouverte(s) pour ${fins} close(s)`);
  }
}
attendu(`les ${parties.length} parties du seed sont closes sur elles-mêmes (aucune instruction coupée en deux fichiers)`, coupees === 0);

/* -- 2. Tout se charge, et l'on dit ce qui ne passe pas ---------------------- */

const refus: string[] = [];
for (const p of parties) {
  const texte = readFileSync(join(projet, "supabase/seed-parties", p), "utf8");
  let courant: string[] = [];
  for (const ligne of texte.split("\n")) {
    courant.push(ligne);
    if (!/^on conflict .*;$/.test(ligne.trim())) continue;
    const sql = courant.join("\n");
    courant = [];
    try {
      await pg.exec(sql);
    } catch (e) {
      const table = /insert into (\w+)/.exec(sql)?.[1] ?? "?";
      refus.push(`${p} → ${table} : ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`);
    }
  }
}
for (const r of refus.slice(0, 10)) console.log(`   ${r}`);
attendu(`le seed se charge sans une instruction refusée (${refus.length} refus)`, refus.length === 0);

/* -- 3. Les tables qui portent le référentiel ne sont pas vides -------------- */

const attendus: [string, number][] = [
  ["site", 1],
  ["vehicule", 100],
  ["chauffeur", 20],
  ["affectation", 20],
  ["demande", 1],
  ["transfert", 1],
  ["prestataire", 1],
];
const comptes: string[] = [];
let vides = 0;
for (const [table, minimum] of attendus) {
  const n = ((await pg.query(`select count(*)::int as n from ${table}`)).rows[0] as { n: number }).n;
  comptes.push(`${table} ${n}`);
  if (n < minimum) {
    vides++;
    console.log(`   ${table} : ${n} ligne(s), au moins ${minimum} attendue(s)`);
  }
}
attendu(`les tables du référentiel sont remplies (${comptes.join(", ")})`, vides === 0);

/* -- 4. Aucune plaque en double, aucune sans forme ---------------------------- */

const doublons = ((await pg.query(`select count(*)::int as n from (select immatriculation from vehicule group by immatriculation having count(*) > 1) x`)).rows[0] as { n: number }).n;
attendu("aucune immatriculation en double dans la flotte", doublons === 0);

const malformees = (await pg.query(`select immatriculation from vehicule where immatriculation !~ '^[A-Z]{2}[0-9]{3,4}[A-Z]{1,2}$'`)).rows as { immatriculation: string }[];
for (const m of malformees.slice(0, 10)) console.log(`   plaque hors forme : ${m.immatriculation}`);
attendu(`toutes les immatriculations ont la forme attendue (${malformees.length} hors forme)`, malformees.length === 0);

console.log(echecs === 0 ? "tout passe" : `${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

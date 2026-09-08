/* Les lectures de production, chronométrées avec les politiques ACTIVES :
   un rôle non privilégié, un compte administrateur dans profil, auth.uid()
   qui le rend. Mesure l'état jusqu'à la migration donnée, puis après la
   suivante. Lancer : node tester-rls.mjs 0019 0021 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(join(process.env.PGLITE_DIR ?? "", "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");

const [jusqua, puis] = process.argv.slice(2);
const projet = process.cwd();
const UID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select '${UID}'::uuid $$;`);
const migrations = readdirSync(join(projet, "supabase/migrations")).sort();
for (const m of migrations.filter((f) => f.slice(0, 4) <= jusqua)) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
for (const p of readdirSync(join(projet, "supabase/seed-parties")).filter((f) => f.endsWith(".sql")).sort()) {
  const texte = readFileSync(join(projet, "supabase/seed-parties", p), "utf8");
  let courant = [];
  for (const ligne of texte.split("\n")) { courant.push(ligne); if (/^on conflict .*;$/.test(ligne.trim())) { try { await pg.exec(courant.join("\n")); } catch {} courant = []; } }
}
await pg.exec(`insert into auth.users (id) values ('${UID}');
  insert into profil (utilisateur_id, nom, role, actif) values ('${UID}', 'Admin Test', 'administrateur', true);
  create role appli nologin;
  grant usage on schema public, auth to appli;
  grant select on all tables in schema public to appli;
  grant execute on all functions in schema public to appli;
  grant execute on function auth.uid() to appli;`);

async function mesurer(etiquette) {
  await pg.exec(`set role appli`);
  const lectures = [
    ["lire_parc", `select lire_parc('2025-09-08') as j`],
    ["lire_fiche AA032EA", `select lire_fiche('AA032EA') as j`],
    ["lire_chauffeurs", `select lire_chauffeurs('2025-09-08') as j`],
    ["situation 28 jours", `select situation_journaliere('2026-08-12', '2026-09-08') as j`],
    ["lire_fiches_chauffeurs", `select lire_fiches_chauffeurs() as j`],
    ["ordres joints", `select count(*)::int as n from ordre_travail o join vehicule v on v.id = o.vehicule_id`],
  ];
  const resultats = {};
  for (const [nom, sql] of lectures) {
    try { await pg.query(sql); } catch { console.log(`${etiquette.padEnd(6)} ${nom.padEnd(24)}      — (absente)`); continue; }
    const t0 = performance.now();
    const r = await pg.query(sql);
    const ms = Math.round(performance.now() - t0);
    const j = r.rows[0].j ?? r.rows[0].n;
    const taille = j === null || j === undefined ? "null" : typeof j === "number" ? `${j} lignes` : Array.isArray(j) ? `${j.length} éléments` : `${Object.keys(j).length} clés`;
    resultats[nom] = ms;
    console.log(`${etiquette.padEnd(6)} ${nom.padEnd(24)} ${String(ms).padStart(6)} ms   ${taille}`);
  }
  await pg.exec(`reset role`);
  return resultats;
}

const avant = await mesurer(jusqua);
const visibles = (await pg.query(`select count(*)::int as n from vehicule`)).rows[0].n;
console.log(`(${visibles} véhicules visibles par le compte de test)`);
if (puis) {
  for (const m of migrations.filter((f) => f.slice(0, 4) > jusqua && f.slice(0, 4) <= puis)) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
  await pg.exec(`grant execute on all functions in schema public to appli`);
  const apres = await mesurer(puis);
  for (const k of Object.keys(apres)) if (k in avant) console.log(`${k.padEnd(24)} ${avant[k]} → ${apres[k]} ms`);
}

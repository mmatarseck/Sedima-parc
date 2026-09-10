/* La plaque écrite deux fois, et pourquoi on ne la supprime pas d'un `delete`.
 *
 * Le 10 septembre 2026, `aligner-referentiel.sql` finissait par un `delete from
 * vehicule where immatriculation = 'DK6875DF'`. Joué dans le SQL Editor, il a
 * rendu :
 *
 *   ERROR: 23514: new row for relation "depense" violates check constraint
 *   "depense_tracable"
 *   CONTEXT: SQL statement "UPDATE ONLY "public"."depense"
 *            SET "vehicule_id" = NULL WHERE $1 = "vehicule_id""
 *
 * Ce banc reproduit cet échec exact — c'est sa première moitié, et la plus
 * utile : un banc qui ne prouverait que le succès du nouveau script ne dirait
 * pas de quoi il nous protège. Puis il vérifie que `plaque-dk6875.sql` refuse
 * proprement dans la même situation, et aboutit une fois la purge passée.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-plaque.mts */
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
for (const m of readdirSync(join(projet, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
  await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
}

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};
const un = async <T>(sql: string): Promise<T | undefined> => (await pg.query(sql)).rows[0] as T | undefined;
/* Renvoie le message d'erreur, ou null si le bloc a été accepté. */
const refus = async (sql: string): Promise<string | null> => {
  try {
    await pg.exec(sql);
    return null;
  } catch (e) {
    try {
      await pg.exec("rollback");
    } catch {}
    return e instanceof Error ? e.message : String(e);
  }
};

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

/* -- 1. L'ancienne plaque, telle qu'elle est en production ------------------
 *
 * Une ligne DK 6875 DF venue de l'ancien référentiel, avec une dépense de
 * caisse rattachée — exactement la ligne que le SQL Editor a nommée. */

await pg.exec(`insert into vehicule (id, immatriculation, marque, appellation, categorie, categorie_flotte, usage, business_unit, statut)
  values ('11111111-1111-1111-1111-111111111111', 'DK6875DF', 'MITSUBISHI', 'L200 SC', 'camionnette', 'interne', 'utilitaire', 'commercial', 'en-service');
  insert into depense (id, numero, vehicule_id, date, poste, libelle, montant, origine, justificatif)
  values (gen_random_uuid(), 'DEP-2026-99001', '11111111-1111-1111-1111-111111111111', '2026-06-08', 'divers', 'Bâche et sangles d''arrimage', 15000, 'caisse', true);`);

const deux = await un<{ n: number }>(`select count(*)::int as n from vehicule where immatriculation in ('DK6875DF', 'DK6875BF')`);
attendu("les deux plaques cohabitent, comme en production", (deux?.n ?? 0) === 2);

/* -- 2. Le `delete` du premier jet, et son échec ---------------------------- */

const message = await refus(`delete from vehicule where immatriculation = 'DK6875DF'
  and exists (select 1 from vehicule v where v.immatriculation = 'DK6875BF');`);
attendu(
  `le \`delete\` nu échoue sur depense_tracable, comme en production`,
  message !== null && message.includes("depense_tracable"),
);

const survit = await un<{ n: number }>(`select count(*)::int as n from vehicule where immatriculation = 'DK6875DF'`);
attendu("et la ligne est toujours là : la transaction est retombée", (survit?.n ?? 0) === 1);

/* -- 3. Le nouveau script, avant la purge : il refuse, et il dit pourquoi --- */

const script = readFileSync(join(projet, "supabase/plaque-dk6875.sql"), "utf8");
const traitement = script.slice(script.indexOf("begin;"));

const refusPropre = await refus(traitement);
attendu(
  `avant la purge, le script refuse en nommant la table (« ${(refusPropre ?? "").split(";")[0]?.slice(0, 60)}… »)`,
  refusPropre !== null && refusPropre.includes("depense") && refusPropre.includes("purge-demonstration"),
);

const depenseIntacte = await un<{ n: number }>(`select count(*)::int as n from depense where vehicule_id = '11111111-1111-1111-1111-111111111111'`);
attendu("la dépense n'a pas été déliée : rien n'a bougé", (depenseIntacte?.n ?? 0) === 1);

/* -- 4. L'inventaire dit la vérité, et ne modifie rien ---------------------- */

/* Le marqueur « PARTIE 2 » apparaît deux fois : dans le sommaire en tête, puis
 * sur le séparateur. C'est le second qu'on veut, d'où le `fromIndex`. */
const debut = script.indexOf("with ancienne as");
const inventaire = script.slice(debut, script.indexOf("-- PARTIE 2", debut));
const lignes = (await pg.query<{ table_liee: string; ancienne_df: number; nouvelle_bf: number }>(inventaire.slice(0, inventaire.lastIndexOf(";") + 1))).rows;
attendu(`l'inventaire couvre les 22 liens du catalogue`, inventaire.split("union all").length === 22);
const surDF = lignes.filter((l) => l.ancienne_df > 0);
attendu(
  `l'inventaire trouve la dépense sur l'ancienne plaque (${surDF.map((l) => `${l.table_liee} ${l.ancienne_df}`).join(", ")})`,
  surDF.length === 1 && surDF[0]?.table_liee === "depense",
);
attendu(`et ${lignes.filter((l) => l.nouvelle_bf > 0).length} table(s) garnies sur la nouvelle`, lignes.some((l) => l.nouvelle_bf > 0));

/* -- 5. Après la purge, le script aboutit ----------------------------------- */

const purge = readFileSync(join(projet, "supabase/purge-demonstration.sql"), "utf8");
const corps = purge.slice(purge.indexOf("begin;"), purge.indexOf("commit;") + 7);
await pg.exec(corps);

const apresPurge = await refus(traitement);
attendu("après la purge, le script passe sans un refus", apresPurge === null);

const partie = await un<{ n: number }>(`select count(*)::int as n from vehicule where immatriculation = 'DK6875DF'`);
attendu("l'ancienne plaque est partie", (partie?.n ?? 0) === 0);

const restee = await un<{ n: number }>(`select count(*)::int as n from vehicule where immatriculation = 'DK6875BF'`);
attendu("la bonne est restée", (restee?.n ?? 0) === 1);

/* -- 6. Rejoué une seconde fois, il ne se plaint pas ------------------------ */

const rejeu = await refus(traitement);
attendu("rejoué sur une base déjà corrigée, il ne fait rien et n'échoue pas", rejeu === null);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

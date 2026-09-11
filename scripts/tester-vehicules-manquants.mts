/* Les véhicules manquants, créés depuis la fiche complète du parc.
 *
 * Ce banc joue `supabase/vehicules-manquants.sql` puis
 * `supabase/caracteristiques-vehicules.sql` sur le référentiel de production,
 * et vérifie :
 *
 *   * que les véhicules décidés sont créés, sans doublon de plaque ;
 *   * que AB 930 BB devient AB 930 BV sans perdre son histoire (même
 *     identifiant, même attribution) ;
 *   * que les L200 neufs reçoivent leur attributaire ou leur pool, et que les
 *     trois lots « à recevoir » se ferment sur eux ;
 *   * que les caractéristiques techniques rejoignent les véhicules créés ;
 *   * que le tout est rejouable.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-vehicules-manquants.mts */
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
await pg.exec(readFileSync(join(projet, "supabase/aligner-referentiel.sql"), "utf8"));

const un = async <T>(sql: string): Promise<T> => (await pg.query(sql)).rows[0] as T;
const jouer = async (f: string) => {
  const t = readFileSync(join(projet, "supabase", f), "utf8");
  await pg.exec(t.slice(0, t.indexOf("-- Vérification")));
};
const manquants = readFileSync(join(projet, "supabase/vehicules-manquants.sql"), "utf8");
const annonce = Number(/(\d+) véhicules créés/.exec(manquants)?.[1] ?? 0);
const plaques = [...manquants.matchAll(/^ {2}\('([A-Z]{2}\d{3,4}[A-Z]{1,2})', '/gm)].map((m) => m[1]!);

const santaFe = await un<{ id: string; attributions: number } | undefined>(`select v.id, (select count(*)::int from attribution_legere a where a.vehicule_id = v.id) as attributions from vehicule v where immatriculation = 'AB930BB'`);
const avant = await un<{ n: number; recevoir: number }>(`select (select count(*)::int from vehicule) as n, (select count(*)::int from vehicule_a_recevoir where recu_le is null) as recevoir`);

await jouer("vehicules-manquants.sql");
await jouer("caracteristiques-vehicules.sql");

const apres = await un<{ n: number; recevoir: number; doublons: number }>(`select (select count(*)::int from vehicule) as n, (select count(*)::int from vehicule_a_recevoir where recu_le is null) as recevoir,
  (select count(*)::int from (select immatriculation from vehicule group by 1 having count(*) > 1) d) as doublons`);
attendu(`${apres.n - avant.n} véhicules créés (${annonce} annoncés, ${plaques.length} plaques dans le fichier), aucun doublon de plaque`, apres.n - avant.n === annonce && plaques.length === annonce && apres.doublons === 0);

if (santaFe) {
  const bv = await un<{ id: string; attributions: number } | undefined>(`select v.id, (select count(*)::int from attribution_legere a where a.vehicule_id = v.id) as attributions from vehicule v where immatriculation = 'AB930BV'`);
  const bb = await un<{ n: number }>(`select count(*)::int as n from vehicule where immatriculation = 'AB930BB'`);
  attendu("AB 930 BB devient AB 930 BV : même véhicule, même attribution, plus de BB", bv?.id === santaFe.id && bv.attributions === santaFe.attributions && bb.n === 0);
}

const neufs = (await pg.query<{ immatriculation: string; detenteur: string | null; lot: string | null }>(
  `select v.immatriculation, coalesce(t.nom, a.pool) as detenteur, r.lot from vehicule v
     left join attribution_legere a on a.vehicule_id = v.id left join attributaire t on t.id = a.attributaire_id
     left join vehicule_a_recevoir r on r.vehicule_id = v.id
    where v.immatriculation like 'AB%KT' order by 1`,
)).rows;
console.log("    " + neufs.map((n) => `${n.immatriculation} → ${n.detenteur ?? "—"}${n.lot ? ` (${n.lot})` : ""}`).join(" · "));
attendu("les cinq L200 neufs ont chacun un détenteur", neufs.length === 5 && neufs.every((n) => n.detenteur));
attendu(`trois lots « à recevoir » se ferment sur eux (${avant.recevoir} → ${apres.recevoir})`, neufs.filter((n) => n.lot).length === 3 && avant.recevoir - apres.recevoir === 3);

const complets = await un<{ n: number; puissance: number }>(`select count(*)::int as n, count(puissance_cv)::int as puissance from vehicule where immatriculation in (${plaques.map((p) => `'${p}'`).join(", ")})`);
attendu(`les caractéristiques rejoignent les véhicules créés : ${complets.puissance} sur ${complets.n} ont une puissance`, complets.puissance >= 10);
const bn = await un<{ puissance_cv: number | null }>(`select puissance_cv from vehicule where immatriculation = 'AA783BN'`);
attendu(`la coquille AA 783 SN de la fiche complète AA 783 BN (puissance ${bn.puissance_cv})`, bn.puissance_cv !== null);

const empreinte = async () => (await un<{ e: string }>(`select md5(concat((select string_agg(immatriculation || coalesce(puissance_cv::text, ''), ',' order by immatriculation) from vehicule), (select count(*)::text from attribution_legere), (select count(*)::text from vehicule_a_recevoir where recu_le is null))) as e`)).e;
const e1 = await empreinte();
await jouer("vehicules-manquants.sql");
await jouer("caracteristiques-vehicules.sql");
attendu("rejouable : un second passage ne change rien", (await empreinte()) === e1);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

/* Le carburant réel de 2025 et 2026, chargé pour de bon.
 *
 * `supabase/carburant-reel.sql` verse mille vingt-neuf lignes tirées des
 * suivis du dossier DO. Ce banc les charge dans une base montée avec les
 * migrations, le seed et la purge — l'état exact de la production — et vérifie
 * ce qui doit l'être :
 *
 *   * chaque ligne trouve son véhicule (le `select` imbriqué ne rend pas null,
 *     ce qui violerait le `not null` de la clé) ;
 *   * les deux natures sont distinctes et comptées ;
 *   * **les cumuls mensuels ne se font pas passer pour des pleins** : ils
 *     portent `plein_complet = false`, et c'est ce marqueur qui empêche la
 *     fiche d'en tirer une consommation ;
 *   * le prix suit le tarif officiel de la date, pas un prix moyen ;
 *   * le fichier est rejouable — un second passage n'ajoute rien.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-carburant-reel.mts */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { prixOfficiel } from "../src/domaine/carburant-tarifs";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();
const MOI = "00000000-0000-0000-0000-000000000001";

const chargement = join(projet, "supabase/carburant-reel.sql");
if (!existsSync(chargement)) {
  console.log("supabase/carburant-reel.sql absent — lancez d'abord extraire-carburant puis charger-carburant.");
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
/* La purge, pour partir de l'état réel : la production n'a plus aucun plein fabriqué. */
const purge = readFileSync(join(projet, "supabase/purge-demonstration.sql"), "utf8");
await pg.exec(purge.slice(purge.indexOf("begin;"), purge.indexOf("commit;") + 7));

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};
const un = async <T>(sql: string): Promise<T | undefined> => (await pg.query(sql)).rows[0] as T | undefined;

const avant = await un<{ n: number }>(`select count(*)::int as n from plein`);
attendu(`la base part sans aucun plein (${avant?.n})`, (avant?.n ?? -1) === 0);

/* -- Le chargement --------------------------------------------------------- */

const sql = readFileSync(chargement, "utf8");
await pg.exec(sql.slice(0, sql.indexOf("-- Vérification")));

const total = await un<{ n: number; litres: string; du: string; au: string; veh: number }>(
  `select count(*)::int as n, round(sum(litres))::text as litres, min(date)::text as du, max(date)::text as au, count(distinct vehicule_id)::int as veh from plein`,
);
attendu(`${total?.n} lignes chargées, ${Number(total?.litres).toLocaleString("fr-FR")} litres, ${total?.veh} véhicules, du ${total?.du} au ${total?.au}`, (total?.n ?? 0) > 1000);

const orphelins = await un<{ n: number }>(`select count(*)::int as n from plein p left join vehicule v on v.id = p.vehicule_id where v.id is null`);
attendu("aucune ligne n'a perdu son véhicule", (orphelins?.n ?? 1) === 0);

/* -- Les deux natures, et le marqueur qui les sépare ------------------------ */

const natures = (await pg.query<{ source: string; n: number; complet: boolean }>(`select source, count(*)::int as n, bool_and(plein_complet) as complet from plein group by source order by source`)).rows;
attendu(`deux natures distinctes : ${natures.map((x) => `${x.source} ${x.n}`).join(" · ")}`, natures.length === 2);
const cumuls = natures.find((x) => x.source.startsWith("Cumul"));
const pompes = natures.find((x) => x.source.startsWith("Pompe"));
attendu("les cumuls mensuels sont marqués « pas un plein complet »", cumuls !== undefined && cumuls.complet === false);
attendu("les pleins de pompe, eux, sont complets", pompes !== undefined && pompes.complet === true);

const cumulsHorsFinDeMois = await un<{ n: number }>(
  `select count(*)::int as n from plein where source like 'Cumul%' and date <> (date_trunc('month', date) + interval '1 month - 1 day')::date`,
);
attendu("chaque cumul est daté du dernier jour de son mois", (cumulsHorsFinDeMois?.n ?? 1) === 0);

/* -- Le prix suit le tarif officiel, pas une moyenne ------------------------ */

const prix = (await pg.query<{ prix_litre: number; du: string; au: string; n: number }>(
  `select prix_litre, min(date)::text as du, max(date)::text as au, count(*)::int as n from plein group by prix_litre order by min(date)`,
)).rows;
console.log(`     tarifs appliqués : ${prix.map((x) => `${x.prix_litre} F du ${x.du} au ${x.au} (${x.n})`).join(" · ")}`);
attendu(
  "chaque ligne porte le tarif officiel de sa date",
  prix.every((x) => prixOfficiel(x.du) === x.prix_litre && prixOfficiel(x.au) === x.prix_litre),
);
const bascule = await un<{ n: number }>(`select count(*)::int as n from plein where date >= '2025-12-06' and date <= '2026-08-14' and prix_litre <> 680`);
attendu("la baisse du 6 décembre 2025 est bien appliquée sur toute sa période", (bascule?.n ?? 1) === 0);

const montants = await un<{ n: number }>(`select count(*)::int as n from plein where montant <> round(litres * prix_litre)`);
attendu("le montant est toujours le produit des litres par le prix", (montants?.n ?? 1) === 0);

const reference = await un<{ n: number }>(`select count(*)::int as n from plein where reference not like 'Tarif officiel du %'`);
attendu("chaque ligne dit que son prix est un tarif, non une facture", (reference?.n ?? 1) === 0);

/* -- Rejouable -------------------------------------------------------------- */

await pg.exec(sql.slice(0, sql.indexOf("-- Vérification")));
const apres = await un<{ n: number }>(`select count(*)::int as n from plein`);
attendu("un second passage n'ajoute rien", apres?.n === total?.n);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

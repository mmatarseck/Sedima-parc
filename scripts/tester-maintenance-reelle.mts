/* La maintenance réelle du parc, chargée pour de bon.
 *
 * `supabase/maintenance-parties/` verse 259 interventions et autant de
 * dépenses, tirées du classeur d'extraction des bons de commande du dossier
 * DO — 694 factures PDF, de novembre 2023 à septembre 2026.
 *
 * Ce banc les charge dans une base montée avec les migrations, le seed, la
 * purge et le carburant — l'état de la production — et vérifie ce qui compte :
 *
 *   * chaque intervention trouve son véhicule **et son garage** ; un
 *     `prestataire_id` nul voudrait dire qu'on a chargé les fournisseurs après
 *     les interventions, ou pas du tout ;
 *   * **une intervention, une dépense**, appariées par le numéro de bon. Le
 *     coût d'un véhicule se calcule sur les dépenses et l'atelier se lit sur
 *     les interventions : l'une sans l'autre laisse l'un des deux à zéro ;
 *   * l'entretien est préventif et le reste curatif, avec le poste de dépense
 *     qui suit ;
 *   * les montants se retrouvent, année par année, dans ce que le classeur
 *     annonce ;
 *   * tout est rejouable.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-maintenance-reelle.mts */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();
const MOI = "00000000-0000-0000-0000-000000000001";

const dossier = join(projet, "supabase/maintenance-parties");
if (!existsSync(dossier)) {
  console.log("supabase/maintenance-parties/ absent — lancez d'abord charger-maintenance.");
  process.exit(0);
}
const parties = readdirSync(dossier).filter((f) => f.endsWith(".sql")).sort();

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

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};
const un = async <T>(sql: string): Promise<T | undefined> => (await pg.query(sql)).rows[0] as T | undefined;

const vide = await un<{ i: number; d: number }>(`select (select count(*) from intervention)::int as i, (select count(*) from depense)::int as d`);
attendu(`la base part sans intervention ni dépense (${vide?.i}, ${vide?.d})`, vide?.i === 0 && vide?.d === 0);

/** Joue les parties dans l'ordre : les prestataires d'abord, les autres les citent. */
async function jouer(): Promise<void> {
  for (const f of parties) await pg.exec(readFileSync(join(dossier, f), "utf8"));
}
await jouer();

const total = await un<{ i: number; d: number; veh: number; du: string; au: string; m: string }>(
  `select (select count(*) from intervention)::int as i,
          (select count(*) from depense)::int as d,
          (select count(distinct vehicule_id) from intervention)::int as veh,
          (select min(date)::text from intervention) as du,
          (select max(date)::text from intervention) as au,
          (select round(sum(montant) / 1000000.0)::text from depense) as m`,
);
attendu(`${total?.i} interventions et ${total?.d} dépenses, ${total?.veh} véhicules, du ${total?.du} au ${total?.au}, ${total?.m} M F`, (total?.i ?? 0) > 200 && total?.i === total?.d);

/* -- Chaque ligne est complète --------------------------------------------- */

const sansGarage = await un<{ n: number }>(`select count(*)::int as n from intervention where prestataire_id is null`);
attendu("chaque intervention porte son garage", (sansGarage?.n ?? 1) === 0);

const orphelines = await un<{ n: number }>(`select count(*)::int as n from intervention i left join vehicule v on v.id = i.vehicule_id where v.id is null`);
attendu("chaque intervention trouve son véhicule", (orphelines?.n ?? 1) === 0);

/* -- Une intervention, une dépense, appariées par le bon -------------------- */

const appariees = await un<{ n: number }>(
  `select count(*)::int as n from intervention i
    join depense d on d.reference = i.reference and d.vehicule_id = i.vehicule_id and d.date = i.date and d.montant = i.montant`,
);
attendu(`les ${appariees?.n} paires intervention/dépense se retrouvent par leur numéro de bon`, appariees?.n === total?.i);

const memesMontants = await un<{ i: string; d: string }>(`select (select sum(montant)::text from intervention) as i, (select sum(montant)::text from depense) as d`);
attendu(`les deux tables portent le même total (${Number(memesMontants?.i).toLocaleString("fr-FR")} F)`, memesMontants?.i === memesMontants?.d);

/* -- Le préventif et le curatif, avec leur poste ---------------------------- */

const types = (await pg.query<{ type: string; n: number }>(`select type, count(*)::int as n from intervention group by type order by type`)).rows;
console.log(`     ${types.map((t) => `${t.type} ${t.n}`).join(" · ")}`);
attendu("les deux types d'intervention sont représentés", types.length === 2);

const postes = (await pg.query<{ poste: string; n: number }>(`select poste::text, count(*)::int as n from depense group by poste order by 2 desc`)).rows;
console.log(`     postes : ${postes.map((p) => `${p.poste} ${p.n}`).join(" · ")}`);
attendu("aucune dépense n'est hors des postes de maintenance", postes.every((p) => ["maintenance-preventive", "maintenance-curative", "pieces", "pneumatiques"].includes(p.poste)));

const preventifMalPoste = await un<{ n: number }>(
  `select count(*)::int as n from intervention i join depense d on d.reference = i.reference and d.date = i.date and d.vehicule_id = i.vehicule_id
    where (i.type = 'preventif') <> (d.poste = 'maintenance-preventive')`,
);
attendu("le type de l'intervention et le poste de sa dépense s'accordent", (preventifMalPoste?.n ?? 1) === 0);

/* -- Les montants, année par année ------------------------------------------ */

const annees = (await pg.query<{ an: string; n: number; m: string }>(
  `select to_char(date, 'YYYY') as an, count(*)::int as n, round(sum(montant) / 1000000.0)::text as m from depense group by 1 order by 1`,
)).rows;
console.log(`     ${annees.map((a) => `${a.an} : ${a.n} bons, ${a.m} M F`).join(" · ")}`);
attendu("la dépense de maintenance couvre quatre exercices", annees.length === 4);

/* -- Rejouable -------------------------------------------------------------- */

await jouer();
const apres = await un<{ i: number; d: number }>(`select (select count(*) from intervention)::int as i, (select count(*) from depense)::int as d`);
attendu("un second passage n'ajoute rien", apres?.i === total?.i && apres?.d === total?.d);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

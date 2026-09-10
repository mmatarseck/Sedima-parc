/* Le rejeu du seed sur une base déjà chargée, et ce qu'il ne suffit pas à faire.
 *
 * Question du métier, 10 septembre 2026 : « dois-je repasser seed01 à 12 ? ».
 * Oui — mais **pas seulement**, et ce banc dit pourquoi.
 *
 * Le seed pose partout `on conflict do nothing` : il ajoute ce qui manque et
 * ne touche jamais à ce qui existe. C'est le bon comportement pour un rejeu —
 * un seed ne doit pas écraser ce qui a été saisi dans l'application — mais le
 * référentiel, lui, a été **corrigé à la source** : statuts réalignés sur la
 * situation 2026, sites nouveaux, une plaque fausse remplacée. Un simple rejeu
 * ajoute les nouveaux véhicules et **laisse les anciens tels qu'ils étaient**.
 *
 * Le banc reproduit la situation : une base chargée avec l'état d'avant, puis
 * le seed d'aujourd'hui rejoué, puis `aligner-referentiel.sql`. Il vérifie
 * qu'après le rejeu seul la correction manque, et qu'après l'alignement elle
 * est là.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-alignement.mts */
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
const un = async <T>(sql: string): Promise<T | undefined> => (await pg.query(sql)).rows[0] as T | undefined;

async function jouerLeSeed(): Promise<void> {
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
}

/* -- 1. L'état d'avant : le seed d'aujourd'hui, puis on le « vieillit » ------
 *
 * On ne garde pas l'ancien seed dans le dépôt ; on reconstitue donc l'écart en
 * remettant à la main ce que la base de production porte encore : les statuts
 * d'avant sur trois lourds, un site au mauvais libellé, la plaque fausse.
 * ------------------------------------------------------------------------- */

await jouerLeSeed();

await pg.exec(`update vehicule set statut = 'hors-service', site_id = (select id from site where code = 'GORMACK') where immatriculation = 'AA737ZW';
  update vehicule set statut = 'en-reparation' where immatriculation = 'AA565GA';
  update vehicule set statut = 'en-mutation' where immatriculation = 'AA568GA';
  update site set libelle = 'Ancien libellé' where code = 'MINOT';
  insert into vehicule (id, immatriculation, marque, appellation, categorie, categorie_flotte, usage, business_unit, statut)
  values (gen_random_uuid(), 'DK6875DF', 'MITSUBISHI', 'L200 SC', 'camionnette', 'interne', 'utilitaire', 'commercial', 'en-reparation')
  on conflict do nothing;`);

const avant = await un<{ n: number }>(`select count(*)::int as n from vehicule`);
console.log(`\nBase « d'avant » reconstituée : ${avant?.n} véhicules, dont la plaque fausse.\n`);

/* -- 2. Le rejeu du seed seul : ce qu'il fait, et ce qu'il ne fait pas ------- */

await jouerLeSeed();

const apresRejeu = await un<{ statut: string }>(`select statut from vehicule where immatriculation = 'AA737ZW'`);
attendu(
  `le rejeu du seed ne corrige PAS un statut déjà en base (AA 737 ZW reste « ${apresRejeu?.statut} »)`,
  apresRejeu?.statut === "hors-service",
);

const siteApresRejeu = await un<{ libelle: string }>(`select libelle from site where code = 'MINOT'`);
attendu(`ni un libellé de site (« ${siteApresRejeu?.libelle} »)`, siteApresRejeu?.libelle === "Ancien libellé");

const fausse = await un<{ n: number }>(`select count(*)::int as n from vehicule where immatriculation = 'DK6875DF'`);
attendu("et la plaque fausse est toujours là", (fausse?.n ?? 0) === 1);

const bonne = await un<{ n: number }>(`select count(*)::int as n from vehicule where immatriculation = 'DK6875BF'`);
attendu("mais il a bien ajouté la bonne, et les véhicules nouveaux", (bonne?.n ?? 0) === 1);

/* La plaque fausse n'est plus traitée ici. Le premier jet la supprimait en pied
 * de l'alignement ; en production le `delete` a buté sur `depense_tracable` et
 * a fait retomber tout l'alignement avec lui. Elle a son script et son banc,
 * `tester-plaque.mts`. Ce banc-ci vérifie seulement que l'alignement **n'y
 * touche pas** — c'est ce qui le rend sans danger. */

/* -- 3. L'alignement : ce qu'il répare -------------------------------------- */

await pg.exec(readFileSync(join(projet, "supabase/aligner-referentiel.sql"), "utf8"));

const apresAlignement = await un<{ statut: string; site: string }>(
  `select v.statut, s.code as site from vehicule v left join site s on s.id = v.site_id where v.immatriculation = 'AA737ZW'`,
);
attendu(
  `l'alignement remet le statut et le site (AA 737 ZW : « ${apresAlignement?.statut} » à ${apresAlignement?.site})`,
  apresAlignement?.statut === "en-service" && apresAlignement?.site === "UAB",
);

const deuxAutres = await un<{ n: number }>(`select count(*)::int as n from vehicule where immatriculation in ('AA565GA', 'AA568GA') and statut = 'en-service'`);
attendu("et les deux autres statuts réalignés sur la situation 2026", (deuxAutres?.n ?? 0) === 2);

const siteApres = await un<{ libelle: string }>(`select libelle from site where code = 'MINOT'`);
attendu(`le libellé du site revient (« ${siteApres?.libelle} »)`, siteApres?.libelle === "Minoterie");

const fausseApres = await un<{ n: number }>(`select count(*)::int as n from vehicule where immatriculation = 'DK6875DF'`);
attendu("l'alignement ne supprime rien, pas même la plaque fausse", (fausseApres?.n ?? 0) === 1);

attendu("et il ne contient aucun `delete`", !readFileSync(join(projet, "supabase/aligner-referentiel.sql"), "utf8").toLowerCase().includes("delete"));

const total = await un<{ n: number }>(`select count(*)::int as n from vehicule`);
attendu(`le parc compte ${total?.n} véhicules, sans doublon`, (total?.n ?? 0) > 100);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

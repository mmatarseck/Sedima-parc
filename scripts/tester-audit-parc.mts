/* Ce que l'audit interne du parc fait entrer dans la base.
 *
 * `supabase/correctif-audit-parc-2026.sql` fond les fournisseurs en double,
 * pose le contrat d'Abdou Kane, porte le constat sur les véhicules concernés,
 * convertit les jours ADEX d'août en mises à disposition et charge les mois
 * d'avril que l'audit a pointés.
 *
 * Ce banc le joue sur une base à l'état de la production et vérifie :
 *
 *   * qu'aucune ligne ne cite plus un fournisseur fondu, et que rien ne s'est
 *     perdu en route : la ligne gardée porte tout ce que portaient les autres ;
 *   * que le coût d'ADEX en août ne bouge pas d'un franc — 14 370 000 F hors
 *     taxe, mises à disposition et benne comprises — une fois converti ;
 *   * que les jours payés non roulés d'avril sont ceux de l'audit : 11, 9, 10 ;
 *   * que le correctif est rejouable.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-audit-parc.mts */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { coutMiseADisposition, coutPrestation, joursPayesNonRoules } from "../src/domaine/transporteurs";

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
for (const bloc of readFileSync(join(projet, "supabase/migrations/0039_regime_fiscal.sql"), "utf8").match(/update profil_transporteur set regime_fiscal[^;]*;/g) ?? []) await pg.exec(bloc);
const jouer = async (chemin: string) => {
  const t = readFileSync(chemin, "utf8");
  const fin = t.indexOf("-- Vérification");
  await pg.exec(fin < 0 ? t : t.slice(0, fin));
};
/* L'état de la production : la maintenance, le correctif des fournisseurs joué après elle, le transport, les camions du relevé, le CA d'août. */
for (const dossier of ["maintenance-parties", "transport-parties"]) {
  for (const f of readdirSync(join(projet, "supabase", dossier)).filter((x) => x.endsWith(".sql")).sort()) await jouer(join(projet, "supabase", dossier, f));
}
for (const f of ["correctif-prestataires.sql", "releve-parties/releve-01-camions.sql", "ca-location-aout-2026.sql"]) if (existsSync(join(projet, "supabase", f))) await jouer(join(projet, "supabase", f));

const un = async <T>(sql: string): Promise<T> => (await pg.query(sql)).rows[0] as T;
const SOURCES = ["PRE-2026-70004", "PRE-2026-90024", "PRE-2026-90019"];
const CIBLES = ["PRE-2026-90041", "PRE-2026-00004"];
const liens = (await pg.query<{ nom_table: string; colonne: string }>(
  `select cl.relname as nom_table, a.attname as colonne from pg_constraint k join pg_class cl on cl.oid = k.conrelid
     join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1] where k.contype = 'f' and k.confrelid = 'prestataire'::regclass`,
)).rows;
const citations = async (numeros: string[]) => {
  let n = 0;
  for (const l of liens) {
    n += (await un<{ n: number }>(`select count(*)::int as n from "${l.nom_table}" where "${l.colonne}" in (select id from prestataire where numero in (${numeros.map((x) => `'${x}'`).join(", ")}))`)).n;
  }
  return n;
};
const avantSources = await citations(SOURCES);
const avantCibles = await citations(CIBLES);
attendu(`avant : ${avantSources} lignes citent un doublon, ${avantCibles} la ligne gardée`, avantSources + avantCibles > 0);

const sql = readFileSync(join(projet, "supabase/correctif-audit-parc-2026.sql"), "utf8");
await jouer(join(projet, "supabase/correctif-audit-parc-2026.sql"));

attendu(`après : plus aucune ligne ne cite un doublon (${await citations(SOURCES)}), la ligne gardée porte tout (${await citations(CIBLES)})`, (await citations(SOURCES)) === 0 && (await citations(CIBLES)) === avantSources + avantCibles);
const inactifs = await un<{ n: number }>(`select count(*)::int as n from prestataire where numero in (${SOURCES.map((x) => `'${x}'`).join(", ")}) and not actif and note like '%Fondu dans%'`);
attendu(`les ${inactifs.n} doublons sont désactivés et disent où ils ont été fondus`, inactifs.n === SOURCES.length);

const kane = await un<{ sous_contrat: boolean; reference_contrat: string | null }>(`select sous_contrat, reference_contrat from profil_transporteur where prestataire_id = (select id from prestataire where numero = 'PRE-2026-00021')`);
attendu("Abdou Kane est sous contrat, avec sa référence", kane.sous_contrat && kane.reference_contrat !== null);

const constats = await un<{ n: number }>(`select count(*)::int as n from vehicule where commentaire like '%Audit interne 2026%'`);
attendu(`${constats.n} véhicules portent le constat de l'audit`, constats.n === 7);

interface LigneMad { numero: string; immatriculation: string; mois: string; jours_calendaires: number; jours_panne: number; jours_roules: number | null; prix_jour: number; convention: "inconnue"; montant_facture: number | null; statut: "livre" | "regle"; carburant_montant: number }
const mads = (await pg.query<LigneMad>(`select numero, immatriculation, mois, jours_calendaires, jours_panne, jours_roules, prix_jour, convention::text as convention, montant_facture::float as montant_facture, statut::text as statut, carburant_montant::float as carburant_montant from mise_a_disposition where numero like 'MAD-2026-9%' order by numero`)).rows;
const enDomaine = (m: LigneMad) => ({ joursCalendaires: m.jours_calendaires, joursPanne: m.jours_panne, joursRoules: m.jours_roules, prixJour: m.prix_jour, convention: m.convention, montantFacture: m.montant_facture, statut: m.statut, carburantMontant: m.carburant_montant, regime: "tva" as const });
const aout = mads.filter((m) => m.mois === "2026-08");
const benne = (await pg.query<{ quantite: number; prix_unitaire: number }>(`select quantite::float as quantite, prix_unitaire from prestation where numero like 'PRS-2026-9%'`)).rows;
const coutAout = aout.reduce((s, m) => s + coutMiseADisposition(enDomaine(m)).location, 0) + benne.reduce((s, p) => s + coutPrestation({ quantite: p.quantite, prixUnitaire: p.prix_unitaire, convention: "inconnue", montantFacture: null, statut: "livre", regime: "tva" }), 0);
attendu(`août : ${aout.length} mises à disposition et ${benne.length} benne, ${coutAout} F hors taxe — le montant du CA provisoire (14 370 000)`, aout.length === 6 && benne.length === 1 && coutAout === 14_370_000);

const avril = mads.filter((m) => m.mois === "2026-04");
const ecarts = avril.map((m) => `${m.immatriculation} ${joursPayesNonRoules(enDomaine(m))}`);
attendu(`avril : jours payés non roulés ${ecarts.join(", ")} — ceux de l'audit (AA573EC 11, AA571EC 9, AA569EC 10)`, ecarts.join(", ") === "AA573EC 11, AA571EC 9, AA569EC 10");

await jouer(join(projet, "supabase/correctif-audit-parc-2026.sql"));
const encore = await un<{ mads: number; notes: number }>(
  `select (select count(*) from mise_a_disposition where numero like 'MAD-2026-9%')::int as mads,
          (select count(*) from prestataire where note like '%Fondu dans%Fondu dans%')::int as notes`,
);
attendu("un second passage n'ajoute ni ligne ni note", encore.mads === mads.length && encore.notes === 0 && sql.length > 0);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

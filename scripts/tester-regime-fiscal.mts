/* Le régime fiscal des transporteurs, et le coût d'août 2026 chargé.
 *
 * Demande du métier (11 septembre 2026) : rendre clair la TVA de 18 % ou la
 * retenue à la source de 5 %, pour lire les charges hors taxe ou TTC.
 *
 * Ce banc vérifie :
 *
 *   * la ventilation — sous TVA, le TTC ajoute 18 % et rien n'est retenu ;
 *     sous retenue, le TTC est le hors-taxe et le transporteur touche 95 % ;
 *   * que le coût d'une mission sous TVA ne subit plus la majoration de la
 *     retenue, et qu'une mission sous retenue garde la lecture d'avant ;
 *   * que 0039 pose les régimes que les pièces prouvent, et rien d'autre ;
 *   * que le CA provisoire d'août entre en entier : chaque voyage, chaque camion
 *     retrouvé, chaque total hors taxe égal à la feuille, et le TTC recalculé
 *     égal au TTC de la feuille, au franc près par ligne ;
 *   * qu'un service livré et non facturé ne compte pas dans les factures à
 *     régler ;
 *   * que le tableau de bord porte la TVA du mois : elle est exactement celle
 *     des lignes sous TVA ;
 *   * que le chargement est rejouable.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-regime-fiscal.mts */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { PARAMETRES_DEFAUT } from "../src/domaine/parametres";
import { coutAffretement, coutPrestation, ventiler } from "../src/domaine/transporteurs";
import { donneesDepuisLaBase, type TableauJson } from "../src/donnees/tableau-bord";

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

/* -- 1. Le domaine ------------------------------------------------------------ */

const tva = ventiler(100_000, "tva");
attendu(`sous TVA : 100 000 HT → ${tva.tva} de TVA, ${tva.ttc} TTC, ${tva.retenue} retenu, ${tva.verse} versé`, tva.tva === 18_000 && tva.ttc === 118_000 && tva.retenue === 0 && tva.verse === 118_000);
const brs = ventiler(100_000, "brs");
attendu(`sous retenue : 100 000 HT → ${brs.tva} de TVA, ${brs.ttc} TTC, ${brs.retenue} retenu, ${brs.verse} versé`, brs.tva === 0 && brs.ttc === 100_000 && brs.retenue === 5_000 && brs.verse === 95_000);
attendu("un régime à confirmer se lit comme une retenue, comme avant", JSON.stringify(ventiler(100_000)) === JSON.stringify(brs));
const mission = { montantConvenu: 140_000, montantFacture: null, statut: "livre" as const };
attendu(
  `une mission à 140 000 F coûte ${coutAffretement({ ...mission, regime: "tva" })} F sous TVA, ${coutAffretement({ ...mission, regime: "brs" })} F sous retenue (facture majorée)`,
  coutAffretement({ ...mission, regime: "tva" }) === 140_000 && coutAffretement({ ...mission, regime: "brs" }) === 147_368 && coutAffretement(mission) === 147_368,
);
attendu(
  "une prestation sous TVA coûte quantité × prix, sans majoration",
  coutPrestation({ quantite: 19, prixUnitaire: 130_000, convention: "inconnue", montantFacture: null, statut: "livre", regime: "tva" }) === 2_470_000,
);

/* -- 2. La base ---------------------------------------------------------------- */

const fichier = join(process.cwd(), "supabase/ca-location-aout-2026.sql");
if (!existsSync(fichier)) {
  console.log("supabase/ca-location-aout-2026.sql absent — lancez d'abord charger-ca-location.");
  process.exit(echecs === 0 ? 0 : 1);
}
const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();
const MOI = "00000000-0000-0000-0000-000000000001";
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
/* Le seed est joué après les migrations : on rejoue la pose des régimes de 0039, comme en production où le référentiel précède la migration. */
const m0039 = readFileSync(join(projet, "supabase/migrations/0039_regime_fiscal.sql"), "utf8");
for (const bloc of m0039.match(/update profil_transporteur set regime_fiscal[\s\S]*?;/g) ?? []) await pg.exec(bloc);
const purge = readFileSync(join(projet, "supabase/purge-demonstration.sql"), "utf8");
await pg.exec(purge.slice(purge.indexOf("begin;"), purge.indexOf("commit;") + 7));
const sansVerification = (t: string) => (t.indexOf("-- Vérification") < 0 ? t : t.slice(0, t.indexOf("-- Vérification")));
await pg.exec(sansVerification(readFileSync(join(projet, "supabase/releve-parties/releve-01-camions.sql"), "utf8")));

const un = async <T>(sql: string): Promise<T> => (await pg.query(sql)).rows[0] as T;
const regimes = (await pg.query<{ numero: string; regime: string }>(
  `select p.numero, t.regime_fiscal::text as regime from profil_transporteur t join prestataire p on p.id = t.prestataire_id order by 1`,
)).rows;
const de = (numero: string) => regimes.find((x) => x.numero === numero)?.regime;
attendu(
  `TVA pour A. Dieng, Sokhna Diop, ADEX ; retenue pour Dème, Mouhamed Sy, Dame Ndoye, Aïssata Gaye (${regimes.filter((x) => x.regime !== "a-confirmer").length} posés)`,
  ["PRE-2026-00022", "PRE-2026-00023", "PRE-2026-00033"].every((n) => de(n) === "tva") && ["PRE-2026-00026", "PRE-2026-00029", "PRE-2026-00030", "PRE-2026-00032"].every((n) => de(n) === "brs"),
);
attendu(
  `les autres restent à confirmer (${regimes.filter((x) => x.regime === "a-confirmer").map((x) => x.numero).join(", ")})`,
  regimes.filter((x) => x.regime !== "a-confirmer").length === 7,
);

const sql = readFileSync(fichier, "utf8");
await pg.exec(sansVerification(sql));
const ecrits = { aff: (sql.match(/^ {2}\('AFF-2026-9\d{4}'/gm) ?? []).length, prs: (sql.match(/^ {2}\('PRS-2026-9\d{4}'/gm) ?? []).length };
const lus = await un<{ aff: number; prs: number; camions: number; motifs: number }>(
  `select (select count(*) from affretement where numero like 'AFF-2026-9%')::int as aff,
          (select count(*) from prestation where numero like 'PRS-2026-9%')::int as prs,
          (select count(immatriculation_externe) from affretement where numero like 'AFF-2026-9%')::int as camions,
          (select count(motif) from affretement where numero like 'AFF-2026-9%')::int as motifs`,
);
attendu(`${lus.aff} affrètements et ${lus.prs} prestations en base pour ${ecrits.aff} et ${ecrits.prs} écrits`, lus.aff === ecrits.aff && lus.prs === ecrits.prs && lus.aff > 60);
attendu(`chaque voyage retrouve son camion au référentiel tiers (${lus.camions} sur ${lus.aff})`, lus.camions === lus.aff);
attendu("aucun motif n'est inventé", lus.motifs === 0);

const totaux = (await pg.query<{ numero: string; ht: number; ttc: number }>(
  `select p.numero, sum(a.montant_convenu)::float as ht, sum(round(a.montant_convenu * 0.18) + a.montant_convenu)::float as ttc
     from affretement a join prestataire p on p.id = a.prestataire_id where a.numero like 'AFF-2026-9%' group by 1
   union all
   select p.numero, sum(round(x.quantite * x.prix_unitaire))::float, sum(round(round(x.quantite * x.prix_unitaire) * 0.18) + round(x.quantite * x.prix_unitaire))::float
     from prestation x join prestataire p on p.id = x.prestataire_id where x.numero like 'PRS-2026-9%' group by 1`,
)).rows;
const total = (n: string) => totaux.find((x) => x.numero === n);
attendu(`A. Dieng : ${total("PRE-2026-00022")?.ht} F HT, ${total("PRE-2026-00022")?.ttc} F TTC (feuille 7 541 170 et 8 898 580,6)`, total("PRE-2026-00022")?.ht === 7_541_170 && Math.abs((total("PRE-2026-00022")?.ttc ?? 0) - 8_898_580.6) <= 43);
attendu(`Sokhna Diop : ${total("PRE-2026-00023")?.ht} F HT, ${total("PRE-2026-00023")?.ttc} F TTC (feuille 3 960 000 et 4 672 800)`, total("PRE-2026-00023")?.ht === 3_960_000 && total("PRE-2026-00023")?.ttc === 4_672_800);
attendu(`ADEX : ${total("PRE-2026-00033")?.ht} F HT, ${total("PRE-2026-00033")?.ttc} F TTC (feuille 14 370 000 et 16 956 600)`, total("PRE-2026-00033")?.ht === 14_370_000 && total("PRE-2026-00033")?.ttc === 16_956_600);

const flotte = (await un<{ f: Record<string, unknown> }>(`select situation_journaliere('2026-09-10', '2026-09-10')->0->'flotte' as f`)).f;
attendu(`un service livré et non facturé ne compte pas dans les factures à régler (${flotte.tiers_factures})`, flotte.tiers_factures === 0);

/* -- 3. Le tableau de bord ---------------------------------------------------- */

const j = (await un<{ j: TableauJson }>(`select lire_tableau('2024-10-01') as j`)).j;
attendu("lire_tableau porte le régime de chaque mission", j.affretements.every((a) => a.regime !== undefined) && j.prestations.every((p) => p.regime !== undefined));
const d = donneesDepuisLaBase(j, [], [], [], PARAMETRES_DEFAUT, "2026-09-11");
const aout = d.flotte.find((f) => f.mois === "2026-08");
const tvaAttendue = totaux.reduce((s, x) => s + (x.ttc - x.ht), 0);
attendu(
  `août : ${aout?.coutTransportTiers} F HT de transport tiers, ${aout?.taxeTransportTiers} F de TVA — celle des seules lignes sous TVA (${tvaAttendue} F)`,
  aout !== undefined && aout.taxeTransportTiers === tvaAttendue && aout.coutTransportTiers >= 7_541_170 + 3_960_000 + 14_370_000,
);

await pg.exec(sansVerification(sql));
const encore = await un<{ aff: number; prs: number }>(
  `select (select count(*) from affretement where numero like 'AFF-2026-9%')::int as aff, (select count(*) from prestation where numero like 'PRS-2026-9%')::int as prs`,
);
attendu("un second passage n'ajoute rien", encore.aff === lus.aff && encore.prs === lus.prs);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

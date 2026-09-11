/* Les demandes d'achat réelles.
 *
 * `supabase/achats-parties/` charge une demande par bon de commande de
 * l'extraction du dossier DO, et les six DA du registre de septembre 2026. Ce
 * banc les joue sur une base à l'état de la production — maintenance,
 * transport et leurs correctifs déjà passés — et vérifie :
 *
 *   * que toutes les demandes entrent, et que le chargement est rejouable ;
 *   * qu'elles retrouvent, par le numéro du bon, l'intervention, la prestation
 *     ou la dépense chargées depuis le même bon, et que la dépense citée porte
 *     le même montant ;
 *   * qu'aucune n'est un engagement en cours : réglées, elles ne mangent pas le
 *     budget une seconde fois ;
 *   * que les six factures de septembre sont des dettes, pour leur montant hors
 *     taxe, chez le bon transporteur, à la bonne date.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-achats-reels.mts */
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
const jouer = async (chemin: string) => {
  const t = readFileSync(chemin, "utf8");
  const fin = t.indexOf("-- Vérification");
  await pg.exec(fin < 0 ? t : t.slice(0, fin));
};
/* L'état de la production : la maintenance, les fournisseurs qui manquaient, le transport et son règlement. */
for (const dossier of ["maintenance-parties", "transport-parties"]) {
  for (const f of readdirSync(join(projet, "supabase", dossier)).filter((x) => x.endsWith(".sql")).sort()) await jouer(join(projet, "supabase", dossier, f));
}
for (const f of ["correctif-prestataires.sql", "correctif-reglement-transport.sql"]) if (existsSync(join(projet, "supabase", f))) await jouer(join(projet, "supabase", f));

const un = async <T>(sql: string): Promise<T> => (await pg.query(sql)).rows[0] as T;
const dossier = join(projet, "supabase/achats-parties");
const annonce = Number(/-- \*\*Ce n'est pas une migration\.\*\* (\d+) demandes/.exec(readFileSync(join(dossier, "achats-01-bons-de-commande.sql"), "utf8"))?.[1] ?? 0);
for (const f of readdirSync(dossier).filter((x) => x.endsWith(".sql")).sort()) await jouer(join(dossier, f));

const bons = await un<{ n: number; reglees: number }>(`select count(*)::int as n, count(*) filter (where etape = 'reglee')::int as reglees from demande_achat where numero like 'DAC-R-0%'`);
attendu(`${bons.n} demandes entrées pour ${annonce} bons annoncés, toutes réglées`, bons.n === annonce && annonce > 600 && bons.reglees === bons.n);
for (const f of readdirSync(dossier).filter((x) => x.endsWith(".sql")).sort()) await jouer(join(dossier, f));
attendu("rejouable : les fichiers rejoués n'ajoutent rien", (await un<{ n: number }>(`select count(*)::int as n from demande_achat where numero like 'DAC-R-%'`)).n === bons.n + 6);

const origines = (await pg.query<{ origine: string; n: number; depense: number; vehicule: number; prestataire: number }>(
  `select case when origine_numero like 'INT-%' then 'intervention' when origine_numero like 'PRS-%' then 'prestation' when origine_numero like 'DEP-%' then 'dépense' else 'bon' end as origine,
          count(*)::int as n, count(depense_numero)::int as depense, count(vehicule_id)::int as vehicule, count(prestataire_id)::int as prestataire
     from demande_achat where numero like 'DAC-R-0%' group by 1 order by 2 desc`,
)).rows;
console.log("    " + origines.map((o) => `${o.origine} ${o.n} (dépense ${o.depense}, véhicule ${o.vehicule}, prestataire ${o.prestataire})`).join(" · "));
const parOrigine = (o: string) => origines.find((x) => x.origine === o)?.n ?? 0;
const interventions = await un<{ n: number }>(`select count(distinct split_part(reference, ' · ', 1))::int as n from intervention where numero like 'INT-R-%'`);
attendu(`chaque bon de la maintenance retrouve son intervention : ${parOrigine("intervention")} demandes pour ${interventions.n} bons chargés`, parOrigine("intervention") === interventions.n);
const prestations = await un<{ n: number }>(`select count(*)::int as n from prestation where numero like 'PRS-R-%'`);
attendu(`chaque bon du transport retrouve sa prestation : ${parOrigine("prestation")} demandes pour ${prestations.n} prestations`, parOrigine("prestation") === prestations.n);
const frais = await un<{ n: number }>(`select count(*)::int as n from depense where numero like 'DEP-T-%'`);
attendu(`chaque frais de mission retrouve sa dépense : ${parOrigine("dépense")} demandes pour ${frais.n} frais`, parOrigine("dépense") === frais.n);
const ecarts = await un<{ n: number; liees: number }>(`select count(*) filter (where d.montant <> a.montant_engage)::int as n, count(*)::int as liees from demande_achat a join depense d on d.numero = a.depense_numero where a.numero like 'DAC-R-0%'`);
attendu(`la dépense citée porte le montant du bon (${ecarts.liees} liées, ${ecarts.n} en écart)`, ecarts.liees === parOrigine("intervention") + parOrigine("dépense") && ecarts.n === 0);
const sansPrestataire = await un<{ n: number }>(`select count(*)::int as n from demande_achat where numero like 'DAC-R-0%' and prestataire_id is null and fournisseur is null`);
attendu("chaque demande nomme son fournisseur, au référentiel ou en clair", sansPrestataire.n === 0);

const engagees = await un<{ n: number }>(`select count(*)::int as n from demande_achat where numero like 'DAC-R-%' and etape in ('commandee', 'livree')`);
attendu("aucune demande chargée n'est un engagement en cours", engagees.n === 0);

const factures = (await pg.query<{ numero_demande_x3: string; date: string; etape: string; montant_reel: number; montant_estime: number; prestataire: string | null }>(
  `select a.numero_demande_x3, a.date::text as date, a.etape, a.montant_reel::float as montant_reel, a.montant_estime::float as montant_estime, p.numero as prestataire
     from demande_achat a left join prestataire p on p.id = a.prestataire_id where a.numero like 'DAC-R-9%' order by a.numero`,
)).rows;
attendu(`registre de septembre : ${factures.length} factures, toutes à régler pour leur montant hors taxe`, factures.length === 6 && factures.every((f) => f.etape === "facturee" && f.montant_reel === f.montant_estime));
const wade = factures.find((f) => f.numero_demande_x3 === "DA200-2609134");
attendu(`Dr Wade : la date du registre (10/01) cède au numéro de la DA (${wade?.date})`, wade?.date === "2026-09-10" && wade.prestataire === "PRE-2026-00027");
attendu("« DEM » reste sans fiche, les cinq autres ont leur transporteur", factures.filter((f) => f.prestataire === null).length === 1 && factures.find((f) => f.numero_demande_x3 === "DA200-2609129")?.prestataire === null);

/* Le métier, le 11 septembre 2026 : la taxe de 18 % de Dr Wade est de la TVA. */
await jouer(join(projet, "supabase/correctif-dr-wade-tva.sql"));
await jouer(join(projet, "supabase/correctif-dr-wade-tva.sql"));
const tva = await un<{ regime: string | null; commentaire: string }>(
  `select (select pt.regime_fiscal::text from profil_transporteur pt join prestataire p on p.id = pt.prestataire_id where p.numero = 'PRE-2026-00027') as regime,
          (select commentaire_decision from demande_achat where numero = 'DAC-R-90004') as commentaire`,
);
const mentions = tva.commentaire.split("TVA de 18 % confirmée").length - 1;
attendu(`Dr Wade au régime TVA (${tva.regime}), sa DA dit 297 360 F TTC, une seule fois après deux passages`, (tva.regime === null || tva.regime === "tva") && tva.commentaire.includes("297 360 F TTC") && mentions === 1);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

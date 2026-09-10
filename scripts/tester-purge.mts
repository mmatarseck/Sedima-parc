/* La purge des transactions fabriquées, éprouvée avant d'être jouée en vrai.
 *
 * `supabase/purge-demonstration.sql` efface des lignes de production ; rien ne
 * les ramène sinon un rejeu du seed. Ce banc la joue d'abord sur une base
 * PGlite chargée du seed, et vérifie trois choses :
 *
 *   1. **le référentiel survit** — véhicules, chauffeurs, sites, prestataires,
 *      affectations, parc léger, licences, plans d'entretien, budget, accès ;
 *   2. **les transactions disparaissent**, sans qu'une contrainte résiste ;
 *   3. **les documents d'assurance restent** : ils viennent de la police 2026,
 *      les effacer déclarerait le parc non assuré.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-purge.mts */
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
for (const p of readdirSync(join(projet, "supabase/seed-parties")).filter((f) => f.endsWith(".sql")).sort()) {
  const texte = readFileSync(join(projet, "supabase/seed-parties", p), "utf8");
  let courant: string[] = [];
  for (const ligne of texte.split("\n")) {
    courant.push(ligne);
    if (/^on conflict .*;$/.test(ligne.trim())) {
      try {
        await pg.exec(courant.join("\n"));
      } catch {}
      courant = [];
    }
  }
}

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};
const compte = async (sql: string): Promise<number> => ((await pg.query(sql)).rows[0] as { n: number }).n;

const REFERENTIEL = ["vehicule", "chauffeur", "site", "prestataire", "affectation", "attributaire", "attribution_legere", "forfait_carburant", "licence_transport", "programme_entretien", "operation_entretien", "profil_transporteur", "camion_tiers", "ligne_tarif", "enveloppe", "acces_utilisateur", "parametre", "type_document"];
const TRANSACTIONS = ["releve_kilometrique", "plein", "depense", "intervention", "incident", "mouvement_caisse", "mouvement_cuve", "demande_achat", "releve_transport", "affretement", "mise_a_disposition", "prestation", "ordre_travail", "visite_technique", "observation_visite", "demande", "transfert", "message", "notification", "mouvement_stock", "pneu", "piece", "avance_prestataire", "evaluation_prestataire", "sanction", "indisponibilite", "modification"];

const avant = new Map<string, number>();
for (const t of [...REFERENTIEL, ...TRANSACTIONS]) avant.set(t, await compte(`select count(*)::int as n from ${t}`));
const assurancesAvant = await compte(`select count(*)::int as n from document where type_document_id = 'assurance'`);
const documentsAvant = await compte(`select count(*)::int as n from document`);

console.log(`\nAvant la purge : ${[...REFERENTIEL].reduce((t, x) => t + (avant.get(x) ?? 0), 0)} lignes de référentiel, ${[...TRANSACTIONS].reduce((t, x) => t + (avant.get(x) ?? 0), 0)} de transactions, ${documentsAvant} documents dont ${assurancesAvant} assurances.\n`);

/* -- La purge, telle qu'elle sera jouée --------------------------------------
 *
 * Seule la partie 2 est exécutée : la 1 et la 3 sont des inventaires que l'on
 * lit à l'écran. On la découpe au point-virgule, comme le ferait l'éditeur
 * SQL, et **on ne cache rien** — un refus doit faire échouer le banc.
 * ------------------------------------------------------------------------- */

const script = readFileSync(join(projet, "supabase/purge-demonstration.sql"), "utf8");
const partie2 = script.slice(script.indexOf("begin;"), script.indexOf("commit;") + "commit;".length);
attendu("la partie 2 du script se retrouve dans le fichier", partie2.startsWith("begin;") && partie2.endsWith("commit;"));

/* Jouée d'un bloc, comme on la collerait dans l'éditeur SQL. Un premier jet
   la découpait au point-virgule après avoir retiré les commentaires : trois
   `delete` sur vingt-sept passaient à la trappe sans un mot, et le banc
   annonçait « 0 refus ». Découper du SQL à la main est un piège ; l'exécuter
   entier est à la fois plus simple et plus fidèle. */
const refus: string[] = [];
try {
  await pg.exec(partie2);
} catch (e) {
  refus.push(e instanceof Error ? e.message.slice(0, 200) : String(e));
}
for (const r of refus) console.log(`   ${r}`);
attendu(`la purge se joue sans qu'une contrainte résiste (${refus.length} refus)`, refus.length === 0);

/* -- 1. Le référentiel survit ------------------------------------------------ */

const perdus: string[] = [];
for (const t of REFERENTIEL) {
  const apres = await compte(`select count(*)::int as n from ${t}`);
  if (apres !== avant.get(t)) perdus.push(`${t} : ${avant.get(t)} → ${apres}`);
}
for (const p of perdus) console.log(`   ${p}`);
attendu(`le référentiel est intact (${REFERENTIEL.length} tables, dont ${avant.get("vehicule")} véhicules et ${avant.get("chauffeur")} chauffeurs)`, perdus.length === 0);

/* -- 2. Les transactions ont disparu ----------------------------------------- */

const restants: string[] = [];
for (const t of TRANSACTIONS) {
  const apres = await compte(`select count(*)::int as n from ${t}`);
  if (apres !== 0) restants.push(`${t} : ${apres} ligne(s) restante(s)`);
}
for (const r of restants) console.log(`   ${r}`);
attendu(`toutes les transactions fabriquées sont parties (${TRANSACTIONS.length} tables vidées)`, restants.length === 0);

/* -- 3. L'assurance reste ----------------------------------------------------- */

const assurancesApres = await compte(`select count(*)::int as n from document where type_document_id = 'assurance'`);
const autresApres = await compte(`select count(*)::int as n from document where type_document_id <> 'assurance'`);
attendu(`les ${assurancesApres} documents d'assurance sont gardés, les ${documentsAvant - assurancesAvant} autres effacés`, assurancesApres === assurancesAvant && assurancesApres > 0 && autresApres === 0);

/* -- 4. Les lectures de l'application tiennent sur une base sans histoire ----- */

const lectures: [string, string][] = [
  ["lire_parc", `select lire_parc('2025-09-10') as j`],
  ["lire_chauffeurs", `select lire_chauffeurs('2025-09-10') as j`],
  ["lire_tableau", `select lire_tableau('2025-01-01') as j`],
  ["situation_journaliere", `select situation_journaliere('2026-08-12', '2026-09-10') as j`],
  ["lire_transporteurs", `select lire_transporteurs('2000-01-01') as j`],
  ["lire_prestataires", `select lire_prestataires('2000-01-01') as j`],
];
const casses: string[] = [];
for (const [nom, sql] of lectures) {
  try {
    await pg.query(sql);
  } catch (e) {
    casses.push(`${nom} : ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`);
  }
}
for (const c of casses) console.log(`   ${c}`);
attendu(`les ${lectures.length} lectures de production tiennent sur une base sans transaction`, casses.length === 0);

/* Une fiche de véhicule se dresse encore, sans un seul fait à montrer. */
try {
  const immat = ((await pg.query(`select immatriculation from vehicule order by immatriculation limit 1`)).rows[0] as { immatriculation: string }).immatriculation;
  await pg.query(`select lire_fiche($1) as j`, [immat]);
  attendu(`la fiche d'un véhicule se dresse sur une base vidée (${immat})`, true);
} catch (e) {
  attendu(`la fiche d'un véhicule se dresse sur une base vidée — ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`, false);
}

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

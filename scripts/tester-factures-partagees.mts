/* La répartition des factures qui couvrent plusieurs véhicules
 * (`supabase/correctif-factures-partagees.sql`, fabriqué par `repartir-factures`).
 *
 * Le banc reconstruit, dans PGlite, les dépenses et les interventions d'origine
 * telles que le correctif les attend — un total sur le premier véhicule, une
 * facture attachée — puis le joue deux fois et vérifie :
 *
 *   * que le total de chaque facture est intact, au franc ;
 *   * que chaque véhicule de la flotte reçoit sa part, et sa facture attachée ;
 *   * que chaque intervention répartie a sa dépense jumelle au même montant ;
 *   * qu'un second passage ne change rien ;
 *   * qu'une dépense dont le montant a changé depuis la lecture n'est pas touchée.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-factures-partagees.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { apparierAtelier } from "../src/domaine/atelier";

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
await pg.exec(`create schema auth; create table auth.users (id uuid primary key); insert into auth.users values ('${MOI}');
  create function auth.uid() returns uuid language sql stable as $$ select '${MOI}'::uuid $$;`);
for (const r of ["anon", "authenticated", "service_role"]) {
  try {
    await pg.exec(`create role ${r}`);
  } catch {}
}
for (const m of readdirSync(join(projet, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));

const sql = readFileSync(join(projet, "supabase/correctif-factures-partagees.sql"), "utf8");
const correctif = sql.slice(0, sql.indexOf("-- Vérification") - 80);
const verification = sql.slice(sql.indexOf("with attendu"));

/* Ce que le correctif attend : les originaux, avec leur total et leur premier véhicule. */
const plaques = new Set([...sql.matchAll(/immatriculation = '([A-Z0-9]+)'/g)].map((m) => m[1]!));
const originaux = [...sql.matchAll(/^-- ((?:DEP)-[^ ]+) · .*?· ([\d ]+) F · (\d+) véhicules/gm)].map((m) => ({ numero: m[1]!, total: Number(m[2]!.replace(/\s/g, "")), vehicules: Number(m[3]) }));
const avecIntervention = new Set([...sql.matchAll(/^update intervention .* where numero = '([^']+)'/gm)].map((m) => m[1]!));
attendu(`le fichier annonce ses dépenses (${originaux.length}) et ses interventions (${avecIntervention.size})`, originaux.length > 0 && avecIntervention.size > 0);

await pg.exec(`insert into vehicule (immatriculation, marque, appellation, categorie) values ${[...plaques, "TEMOIN1"].map((p) => `('${p}', 'Banc', 'Banc', 'camion')`).join(", ")};
  insert into prestataire (numero, raison_sociale, type) values ('PRE-BANC', 'Garage du banc', 'garage');`);
const premier = "(select id from vehicule where immatriculation = 'TEMOIN1')";
const garage = "(select id from prestataire where numero = 'PRE-BANC')";
await pg.exec(
  `insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, origine, justificatif, reference, photo) values ${originaux
    .map((o) => `('${o.numero}', ${premier}, ${garage}, '2026-01-15', 'maintenance-curative', 'Facture du banc', ${o.total}, 'bon-de-commande', true, 'BC · bon couvrant plusieurs véhicules', 'pieces/documents/banc/${o.numero}.pdf')`)
    .join(", ")};
   insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, reference) values ${[...avecIntervention].map((n) => `('${n}', ${premier}, ${garage}, '2026-01-15', 'curatif', 'Facture du banc', ${originaux.find((o) => o.numero === n.replace(/^INT-/, "DEP-"))!.total}, 'BC · bon couvrant plusieurs véhicules')`).join(", ")};`,
);

const etat = async () =>
  (await pg.query(`select (select count(*) from depense)::int as depenses, (select sum(montant) from depense)::bigint as total, (select count(*) from intervention)::int as interventions, (select count(*) from depense where photo is not null)::int as factures`)).rows[0] as { depenses: number; total: number; interventions: number; factures: number };
const avant = await etat();
await pg.exec(correctif);
const un = await etat();
await pg.exec(correctif);
const deux = await etat();

const partsAttendues = originaux.reduce((s, o) => s + o.vehicules, 0);
attendu(`chaque facture devient autant de parts que de véhicules (${un.depenses} parts)`, un.depenses === partsAttendues);
attendu(`le total général ne bouge pas (${Number(un.total).toLocaleString("fr-FR")} F)`, Number(un.total) === Number(avant.total));
const ecarts = (await pg.query(verification)).rows;
attendu("le total de chaque facture est intact, au franc", ecarts.length === 0);
attendu("chaque part porte la facture attachée de l'originale", un.factures === un.depenses);
attendu("un second passage ne change rien", JSON.stringify(un) === JSON.stringify(deux));

const nuls = (await pg.query(`select count(*)::int as n from depense where montant <= 0`)).rows[0] as { n: number };
attendu("aucune part nulle ou négative", nuls.n === 0);
const horsFlotte = (await pg.query(`select count(*)::int as n, count(*) filter (where beneficiaire is null)::int as sans_nom, count(*) filter (where libelle not like '%hors flotte')::int as sans_plaque from depense where vehicule_id is null`)).rows[0] as { n: number; sans_nom: number; sans_plaque: number };
attendu(`une part hors flotte reste une dépense du parc, nomme quelqu'un et dit sa plaque (${horsFlotte.n})`, horsFlotte.sans_nom === 0 && horsFlotte.sans_plaque === 0);
const references = (await pg.query(`select count(*)::int as n from depense where reference !~ 'facture répartie — part \\d+/\\d+ de [\\d ]+ F, (à parts égales|selon le grand livre)$'`)).rows[0] as { n: number };
attendu("chaque référence dit la part, le total et la méthode", references.n === 0);
const surLePremier = (await pg.query(`select count(*)::int as n from depense where vehicule_id = ${premier} and numero not in (${originaux.map((o) => `'${o.numero}'`).join(", ")})`)).rows[0] as { n: number };
attendu("les parts nouvelles vont aux autres véhicules, pas au premier", surLePremier.n === 0);

const i = (await pg.query(`select numero, montant::int as montant, vehicule_id from intervention`)).rows as { numero: string; montant: number; vehicule_id: string }[];
const d = (await pg.query(`select numero, montant::int as montant, vehicule_id from depense`)).rows as { numero: string; montant: number; vehicule_id: string | null }[];
const paires = apparierAtelier(i, d);
attendu(`chaque intervention répartie a sa dépense jumelle (${paires.paires.length})`, paires.interventionsSeules.length === 0 && paires.paires.length === i.length && i.length > avecIntervention.size);
attendu("au même montant, sur le même véhicule", paires.paires.every((p) => p.intervention.montant === p.depense.montant && p.intervention.vehicule_id === p.depense.vehicule_id));

/* Le garde-fou : une dépense corrigée à la main entre la lecture et le passage n'est pas touchée. */
const temoin = originaux[0]!;
await pg.exec(`delete from depense where numero like '${temoin.numero}-%'; update depense set montant = 123, reference = 'corrigée à la main' where numero = '${temoin.numero}';`);
await pg.exec(correctif);
const apres = (await pg.query(`select montant::int as montant, reference from depense where numero = '${temoin.numero}'`)).rows[0] as { montant: number; reference: string };
attendu("une dépense dont le montant a changé depuis la lecture garde son montant et sa référence", apres.montant === 123 && apres.reference === "corrigée à la main");

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);

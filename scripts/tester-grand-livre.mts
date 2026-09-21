/* Le grand livre 2026 (`supabase/grand-livre-2026/`, docs/GRAND-LIVRE-2026.md).
 *
 * Ce banc joue les cinq fichiers sur une base aux migrations à jour, peuplée
 * des seuls véhicules que le chargement cite, et vérifie :
 *
 *   * que tout entre, et que le chargement est rejouable sans rien ajouter ;
 *   * que chaque intervention a sa dépense jumelle, au même montant — l'atelier
 *     les lit ensemble par leur suffixe ;
 *   * qu'une valeur d'acquisition saisie à la main n'est jamais écrasée ;
 *   * que l'amortissement part de la date d'acquisition quand elle est connue.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-grand-livre.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { amortissementDe } from "../src/domaine/amortissement";
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

/* -- L'amortissement, sans base -------------------------------------------- */

const occasion = amortissementDe({ valeurAcquisition: 23_330_000, dureeAmortissementAnnees: 4, premiereMiseEnCirculation: "2019-09-09", dateAcquisition: "2026-05-06" }, "2026-08-31");
attendu(`une occasion s'amortit depuis son achat, pas depuis 2019 (VNC ${occasion.valeurNetteComptable})`, (occasion.valeurNetteComptable ?? 0) > 21_000_000 && occasion.finAmortissement === "2030-05-06");
const neuf = amortissementDe({ valeurAcquisition: 20_000_000, dureeAmortissementAnnees: 4, premiereMiseEnCirculation: "2024-08-31", dateAcquisition: null }, "2026-08-31");
attendu("sans date d'acquisition, la première mise en circulation en tient lieu", Math.abs((neuf.valeurNetteComptable ?? 0) - 10_000_000) < 20_000 && neuf.finAmortissement === "2028-08-31");
const futur = amortissementDe({ valeurAcquisition: 10_000_000, dureeAmortissementAnnees: 4, premiereMiseEnCirculation: null, dateAcquisition: "2026-12-01" }, "2026-08-31");
attendu("un achat à venir vaut son prix, pas davantage", futur.valeurNetteComptable === 10_000_000);

/* -- La base ------------------------------------------------------------------ */

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

const dossier = join(projet, "supabase/grand-livre-2026");
const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".sql")).sort();
attendu(`cinq fichiers, dans l'ordre (${fichiers.length})`, fichiers.length === 5 && fichiers[0]!.includes("01-prestataires") && fichiers[4]!.includes("05-cuve"));
const sql = Object.fromEntries(fichiers.map((f) => [f, readFileSync(join(dossier, f), "utf8")]));
const tout = Object.values(sql).join("\n");

/* Les véhicules que le chargement cite : le banc n'a pas la flotte réelle. */
const plaques = new Set<string>();
for (const m of tout.matchAll(/immatriculation = '([A-Z0-9]+)'/g)) plaques.add(m[1]!);
for (const m of sql[fichiers[1]!]!.matchAll(/^\s+\('([A-Z0-9]+)', \d+, '/gm)) plaques.add(m[1]!);
await pg.exec(`insert into vehicule (immatriculation, marque, appellation, categorie) values ${[...plaques].map((p) => `('${p}', 'Banc', 'Banc', 'camion')`).join(", ")};`);

/* Une valeur saisie à la main, que le chargement ne doit pas toucher. */
const temoin = /^\s+\('([A-Z0-9]+)', \d+, '/m.exec(sql[fichiers[1]!]!)![1]!;
await pg.exec(`update vehicule set valeur_acquisition = 1 where immatriculation = '${temoin}';`);

const compter = async () => {
  const r = await pg.query(`select (select count(*) from prestataire)::int as prestataires, (select count(*) from vehicule where reference_immobilisation is not null)::int as valorises,
    (select count(*) from intervention where numero like 'INT-GL-%')::int as interventions, (select count(*) from depense where numero like 'DEP-GL-%')::int as depenses,
    (select coalesce(sum(montant), 0) from depense where numero like 'DEP-GL-%')::bigint as montant, (select count(*) from mouvement_cuve)::int as cuve`);
  return r.rows[0] as { prestataires: number; valorises: number; interventions: number; depenses: number; montant: number; cuve: number };
};
for (const f of fichiers) await pg.exec(sql[f]!);
const un = await compter();
for (const f of fichiers) await pg.exec(sql[f]!);
const deux = await compter();

const lignes = (f: string, prefixe: string) => [...sql[f]!.matchAll(new RegExp(`^\\s+\\('${prefixe}`, "gm"))].length;
const acquisitions = [...sql[fichiers[1]!]!.matchAll(/^\s+\('[A-Z0-9]+', \d+, '/gm)].length;
attendu(`toutes les interventions entrent (${un.interventions})`, un.interventions === lignes(fichiers[2]!, "INT-GL-") && un.interventions > 0);
attendu(`toutes les dépenses entrent (${un.depenses}, ${Number(un.montant).toLocaleString("fr-FR")} F)`, un.depenses === lignes(fichiers[3]!, "DEP-GL-") && un.depenses > 0);
attendu(`toutes les livraisons de cuve entrent (${un.cuve})`, un.cuve === lignes(fichiers[4]!, "CUV-GL-") && un.cuve > 0);
attendu(`tous les véhicules sont valorisés sauf le témoin (${un.valorises} sur ${acquisitions})`, un.valorises === acquisitions - 1);
attendu("le chargement est rejouable : un second passage n'ajoute rien", JSON.stringify(un) === JSON.stringify(deux));

const t = (await pg.query(`select valeur_acquisition::int as v, reference_immobilisation as r from vehicule where immatriculation = '${temoin}'`)).rows[0] as { v: number; r: string | null };
attendu(`une valeur saisie à la main n'est pas écrasée (${temoin})`, t.v === 1 && t.r === null);

const incoherents = (await pg.query(`select count(*)::int as n from vehicule where reference_immobilisation is not null and (valeur_acquisition is null or valeur_acquisition <= 0 or date_acquisition is null or duree_amortissement_annees not between 3 and 6)`)).rows[0] as { n: number };
attendu("chaque véhicule valorisé a sa valeur, sa date et une durée de 3 à 6 ans", incoherents.n === 0);

const interventions = (await pg.query(`select numero, montant::int as montant, vehicule_id from intervention where numero like 'INT-GL-%'`)).rows as { numero: string; montant: number; vehicule_id: string }[];
const depenses = (await pg.query(`select numero, montant::int as montant, vehicule_id from depense where numero like 'DEP-GL-%'`)).rows as { numero: string; montant: number; vehicule_id: string | null }[];
const paires = apparierAtelier(interventions, depenses);
attendu(`chaque intervention a sa dépense jumelle (${paires.paires.length})`, paires.interventionsSeules.length === 0 && paires.paires.length === interventions.length);
attendu("les jumelles portent le même montant et le même véhicule", paires.paires.every((p) => p.intervention.montant === p.depense.montant && p.intervention.vehicule_id === p.depense.vehicule_id));

const sansTrace = (await pg.query(`select count(*)::int as n from depense where numero like 'DEP-GL-%' and vehicule_id is null and beneficiaire is null`)).rows[0] as { n: number };
attendu("une dépense sans véhicule cite toujours quelqu'un", sansTrace.n === 0);
const negatifs = (await pg.query(`select count(*)::int as n from depense where numero like 'DEP-GL-%' and montant <= 0`)).rows[0] as { n: number };
attendu("aucune dépense nulle ou négative", negatifs.n === 0);

const cuve = (await pg.query(`select sum(litres)::int as litres, sum(montant)::bigint as montant, min(prix_litre)::int as mini, max(prix_litre)::int as maxi from mouvement_cuve`)).rows[0] as { litres: number; montant: number; mini: number; maxi: number };
attendu(`la cuve : ${cuve.litres} L, prix du litre entre ${cuve.mini} et ${cuve.maxi} F`, cuve.litres > 0 && cuve.mini >= 500 && cuve.maxi <= 900);

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);

/* Un registre vide n'est pas un registre à zéro.
 *
 * Le tableau de bord affichait zéro panne, zéro accident, zéro contravention et
 * zéro chauffeur indisponible : aucun de ces registres n'a de ligne depuis la
 * purge, aucune source n'a été chargée. La règle de la carte grise s'y
 * applique : un registre sans aucune ligne n'est pas tenu, et ses comptes ne
 * sont pas des zéros.
 *
 * Ce banc vérifie :
 *
 *   * côté domaine, que les courbes des accidents, du taux de fréquence, des
 *     contraventions, des incidents produit, des pannes en ligne et de
 *     l'absentéisme sortent « — » quand leur registre n'est pas tenu, et
 *     gardent leur valeur — zéro compris — quand il l'est ;
 *   * côté base, que la situation journalière dit les registres tenus sur le
 *     jeu de départ, et non tenus après la purge (0042).
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-registres.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { INDICATEURS_COURBE, cumuler, type FaitsFlotteMois, type FaitsVehiculeMois, type SituationJour } from "../src/domaine/tableau-bord";

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

/* -- 1. Le domaine ------------------------------------------------------------ */

const fait: FaitsVehiculeMois = {
  vehiculeId: "A",
  mois: "2026-07",
  jours: 31,
  engage: true,
  transportSpecial: false,
  km: 10_000,
  litres: 0,
  litresReference: 0,
  joursImmobilises: 0,
  nonConforme: false,
  entretienEnRetard: false,
  accidents: 0,
  accidentsCorporels: 0,
  pannesEnMission: 0,
  avariesChargement: 0,
  contraventions: 0,
  montantContraventions: 0,
  interventionsPreventives: 0,
  interventionsCuratives: 0,
  immobilisationInterventions: 0,
  nombreInterventions: 0,
  curativesSansDuree: 0,
  immobilisationsSansDebut: 0,
  cout: 0,
  coutMaintenance: 0,
  coutCuratif: 0,
};
const flotte: FaitsFlotteMois = {
  mois: "2026-07",
  joursIndisponibiliteChauffeurs: 0,
  joursChauffeurs: 310,
  coutTransportTiers: 0,
  coutAffretements: 0,
  coutMisesADisposition: 0,
  coutPrestations: 0,
  taxeTransportTiers: 0,
  tonnesTiers: null,
  tonnesInternes: null,
};
const jourAvec = (tenus: boolean) => ({ registres: { incidents: tenus, contraventions: tenus, indisponibilites: tenus } }) as SituationJour;
const valeur = (id: string, tenus: boolean) => INDICATEURS_COURBE.find((d) => d.id === id)!.calcul!(cumuler([fait], [flotte], jourAvec(tenus), 30.44));

for (const [id, libelle] of [["s1", "accidents"], ["s2", "taux de fréquence"], ["s3", "contraventions"], ["q2", "incidents produit"], ["d3", "pannes en ligne"], ["m4", "absentéisme"]] as const) {
  attendu(`${libelle} : « — » sans registre tenu (${valeur(id, false)}), ${valeur(id, true)} quand il l'est`, valeur(id, false) === null && valeur(id, true) === 0);
}

/* -- 2. La base ---------------------------------------------------------------- */

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
const registres = async () =>
  ((await pg.query(`select situation_journaliere(current_date, current_date)->0->'flotte' as f`)).rows[0] as { f: { registre_incidents: boolean; registre_indisponibilites: boolean } }).f;

const depart = await registres();
attendu(`jeu de départ : registre des incidents ${depart.registre_incidents}, des indisponibilités ${depart.registre_indisponibilites}`, depart.registre_incidents === true && depart.registre_indisponibilites === true);

const purge = readFileSync(join(projet, "supabase/purge-demonstration.sql"), "utf8");
await pg.exec(purge.slice(purge.indexOf("begin;"), purge.indexOf("commit;") + 7));
const apres = await registres();
attendu(`après la purge : registre des incidents ${apres.registre_incidents}, des indisponibilités ${apres.registre_indisponibilites} — pas tenus`, apres.registre_incidents === false && apres.registre_indisponibilites === false);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

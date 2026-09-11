/* Une durée d'immobilisation inconnue n'est pas zéro jour.
 *
 * Le tableau de bord montrait une disponibilité de 100 % tous les mois de 2026 :
 * les 298 interventions réelles ne disent pas combien de jours le véhicule est
 * resté au garage, et le chargement avait écrit zéro. La migration 0040 rend la
 * colonne facultative et passe ces zéros à nul.
 *
 * Ce banc vérifie :
 *
 *   * côté domaine, qu'une réparation curative sans durée rend la disponibilité
 *     et l'indisponibilité des véhicules spéciaux inconnues, et que sans elle
 *     le calcul est celui d'avant ;
 *   * côté base, qu'une intervention saisie sans durée reste nulle — aucun
 *     défaut ne l'écrit à la place de la personne —, que 0040 passe les zéros
 *     repris à nul et ne touche à rien d'autre, et qu'elle est rejouable ;
 *   * que la situation journalière tient avec des durées nulles.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-immobilisation-inconnue.mts */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { INDICATEURS_COURBE, cumuler, type FaitsVehiculeMois, type SituationJour } from "../src/domaine/tableau-bord";

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

/* -- 1. Le domaine ------------------------------------------------------------ */

const fait = (x: Partial<FaitsVehiculeMois>): FaitsVehiculeMois => ({
  vehiculeId: "AA000AA",
  mois: "2026-07",
  jours: 31,
  engage: true,
  transportSpecial: false,
  km: 0,
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
  ...x,
});
/* La situation du jour n'entre dans aucun des indicateurs regardés ici. */
const jour = {} as SituationJour;
const indicateur = (id: string) => INDICATEURS_COURBE.find((d) => d.id === id)!;
const valeur = (id: string, faits: FaitsVehiculeMois[]) => indicateur(id).calcul!(cumuler(faits, [], jour, 30.44));

const connus = [fait({ vehiculeId: "A", joursImmobilises: 3, interventionsCuratives: 1, immobilisationInterventions: 3, nombreInterventions: 1 }), fait({ vehiculeId: "B" })];
attendu(`durées connues : disponibilité ${valeur("d1", connus)} %, immobilisation moyenne ${valeur("d7", connus)} j`, valeur("d1", connus) === 95.2 && valeur("d7", connus) === 3);
const inconnue = [...connus, fait({ vehiculeId: "C", interventionsCuratives: 1, curativesSansDuree: 1 })];
attendu(`une réparation sans durée rend la disponibilité inconnue (${valeur("d1", inconnue)}), la moyenne reste celle des durées connues (${valeur("d7", inconnue)} j)`, valeur("d1", inconnue) === null && valeur("d7", inconnue) === 3);
const toutesInconnues = [fait({ vehiculeId: "C", interventionsCuratives: 2, curativesSansDuree: 2 })];
attendu(`sans aucune durée connue, la moyenne au garage est inconnue aussi (${valeur("d7", toutesInconnues)})`, valeur("d7", toutesInconnues) === null);
const speciaux = [fait({ vehiculeId: "S", transportSpecial: true, joursImmobilises: 2 })];
attendu(`véhicules spéciaux : ${valeur("d2", speciaux)} h connues, inconnues dès qu'une panne n'a pas de durée`, valeur("d2", speciaux) === 48 && valeur("d2", [...speciaux, fait({ vehiculeId: "T", transportSpecial: true, curativesSansDuree: 1 })]) === null);
/* Un troisième véhicule ajoute ses jours au dénominateur : 3 jours sur 93. */
const avecPreventive = valeur("d1", [...connus, fait({ vehiculeId: "P", interventionsPreventives: 1 })]);
attendu(`une préventive sans durée ne bloque pas la disponibilité (${avecPreventive} %)`, avecPreventive === 96.8);

const sansDebut = [...connus, fait({ vehiculeId: "H", immobilisationsSansDebut: 1 })];
attendu(`un véhicule immobilisé depuis une date inconnue rend la disponibilité inconnue (${valeur("d1", sansDebut)})`, valeur("d1", sansDebut) === null);

/* Le respect du plan préventif, même règle : un véhicule dont on ignore l'état ne compte pas pour à jour. */
const aJour = [fait({ vehiculeId: "A" }), fait({ vehiculeId: "B" })];
attendu(`plan préventif, deux véhicules à jour : ${valeur("d6", aJour)} %`, valeur("d6", aJour) === 100);
attendu(`un véhicule en retard sur deux : ${valeur("d6", [aJour[0]!, fait({ vehiculeId: "B", entretienEnRetard: true })])} %`, valeur("d6", [aJour[0]!, fait({ vehiculeId: "B", entretienEnRetard: true })]) === 50);
attendu(
  `un véhicule d'état inconnu rend le taux inconnu (${valeur("d6", [...aJour, fait({ vehiculeId: "C", entretienEnRetard: null })])})`,
  valeur("d6", [...aJour, fait({ vehiculeId: "C", entretienEnRetard: null })]) === null,
);

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
const migrations = readdirSync(join(projet, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
for (const m of migrations) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
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
const un = async <T>(sql: string): Promise<T> => (await pg.query(sql)).rows[0] as T;

const vehicule = (await un<{ id: string }>(`select id from vehicule limit 1`)).id;
await pg.exec(`insert into intervention (numero, vehicule_id, date, type, objet) values ('INT-BANC-1', '${vehicule}', '2026-09-01', 'curatif', 'Saisie sans durée')`);
const saisie = await un<{ j: number | null }>(`select immobilisation_jours as j from intervention where numero = 'INT-BANC-1'`);
attendu(`une intervention saisie sans durée reste nulle (${saisie.j}) : aucun défaut ne l'écrit à la place de la personne`, saisie.j === null);

const seed = await un<{ n: number; nuls: number }>(`select count(*)::int as n, count(*) filter (where immobilisation_jours is null)::int as nuls from intervention where numero not like 'INT-R-%' and numero <> 'INT-BANC-1'`);

const purge = readFileSync(join(projet, "supabase/purge-demonstration.sql"), "utf8");
await pg.exec(purge.slice(purge.indexOf("begin;"), purge.indexOf("commit;") + 7));
const dossier = join(projet, "supabase/maintenance-parties");
if (!existsSync(dossier)) {
  console.log("supabase/maintenance-parties absent — partie base sautée.");
  process.exit(echecs === 0 ? 0 : 1);
}
const sansVerification = (t: string) => (t.indexOf("-- Vérification") < 0 ? t : t.slice(0, t.indexOf("-- Vérification")));
for (const f of readdirSync(dossier).filter((x) => x.endsWith(".sql")).sort()) await pg.exec(sansVerification(readFileSync(join(dossier, f), "utf8")));

/* L'état de la production avant 0040 : les interventions reprises portent un zéro. */
await pg.exec(`update intervention set immobilisation_jours = 0 where numero like 'INT-R-%'`);
await pg.exec(`insert into intervention (numero, vehicule_id, date, type, objet, immobilisation_jours) values ('INT-BANC-2', '${vehicule}', '2026-09-02', 'curatif', 'Saisie à zéro jour', 0) on conflict do nothing`);
const avant = await un<{ zeros: number }>(`select count(*)::int as zeros from intervention where numero like 'INT-R-%' and immobilisation_jours = 0`);
const m0040 = readFileSync(join(projet, "supabase/migrations/0040_immobilisation_inconnue.sql"), "utf8");
await pg.exec(m0040);
const apres = await un<{ zeros: number; nuls: number; banc: number | null }>(
  `select (select count(*) from intervention where numero like 'INT-R-%' and immobilisation_jours = 0)::int as zeros,
          (select count(*) from intervention where numero like 'INT-R-%' and immobilisation_jours is null)::int as nuls,
          (select immobilisation_jours from intervention where numero = 'INT-BANC-2') as banc`,
);
attendu(`0040 passe les ${avant.zeros} zéros repris à nul (${apres.nuls} nuls, ${apres.zeros} zéro restant)`, avant.zeros > 200 && apres.zeros === 0 && apres.nuls === avant.zeros);
attendu(`un zéro saisi dans l'application, lui, est gardé (${apres.banc})`, apres.banc === 0);
await pg.exec(m0040);
const encore = await un<{ nuls: number }>(`select count(*)::int as nuls from intervention where numero like 'INT-R-%' and immobilisation_jours is null`);
attendu("0040 est rejouable", encore.nuls === apres.nuls);
attendu(`le jeu de départ garde ses durées (${seed.n} interventions, ${seed.nuls} sans durée)`, seed.n > 0 && seed.nuls === 0);

/* 0041 : sans trace de statut ni réparation, un véhicule arrêté l'est depuis une date inconnue — pas depuis l'enregistrement de sa fiche. */
const arretes = await un<{ inconnus: number; dates: number }>(
  `select count(*) filter (where v->'immobilise_depuis_jours' = 'null'::jsonb)::int as inconnus,
          count(*) filter (where v->'immobilise_depuis_jours' <> 'null'::jsonb)::int as dates
     from jsonb_array_elements(situation_journaliere(current_date, current_date)->0->'vehicules') v
    where v->>'statut' not in ('en-service', 'en-backup')`,
);
attendu(`véhicules arrêtés sans trace : ${arretes.inconnus} depuis une date inconnue, ${arretes.dates} datés par une réparation`, arretes.inconnus > 0);

const situation = await un<{ n: number }>(`select jsonb_array_length(situation_journaliere('2026-07-01', '2026-07-31'))::int as n`);
attendu(`la situation journalière tient avec des durées nulles (${situation.n} jours)`, situation.n === 31);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

/* ============================================================================
 * Compare les listes Flotte et Chauffeurs dérivées de la base à celles de la
 * démonstration, sur le même seed, rejoué dans PGlite.
 *
 *   npx tsx scripts/comparer-listes.mts <dossier-pglite>
 *
 * Le dossier passé est celui où @electric-sql/pglite est installé (le bac à
 * sable de la session, pas le projet). La date de référence est celle de la
 * démonstration, pour que les échéances se comparent jour pour jour.
 * ==========================================================================*/

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PARAMETRES_DEFAUT } from "@/domaine/parametres";
import { DATE_REFERENCE, listeChauffeurs } from "@/donnees/chauffeurs-demo";
import { lignesDepuisLaBase, type ChauffeursBrut } from "@/donnees/chauffeurs";
import { fichePourImmatriculation } from "@/donnees/fiche-demo";
import { ligneDepuisLaBase, type ParcBrut } from "@/donnees/flotte";
import { FLOTTE } from "@/donnees/parc-demo";

const dossier = process.argv[2];
if (!dossier) throw new Error("Passer le dossier où @electric-sql/pglite est installé.");
const charger = (m: string) => import(pathToFileURL(join(dossier, "node_modules", "@electric-sql", "pglite", "dist", m)).href);
const { PGlite } = await charger("index.js");
const { btree_gist } = await charger("contrib/btree_gist.js");
const { pgcrypto } = await charger("contrib/pgcrypto.js");

const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
for (const m of readdirSync("supabase/migrations").sort()) await pg.exec(readFileSync(join("supabase/migrations", m), "utf8"));
for (const p of readdirSync("supabase/seed-parties").sort()) await pg.exec(readFileSync(join("supabase/seed-parties", p), "utf8"));

const lignes = async <T,>(sql: string): Promise<T[]> => (await pg.query(sql)).rows as T[];
const iso = (v: unknown): unknown => (v instanceof Date ? v.toISOString().slice(0, 10) : v);
const dates = <T extends object>(l: T[]): T[] => l.map((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, iso(v)])) as T);

const aujourdhui = DATE_REFERENCE;
const depuis = `${Number(aujourdhui.slice(0, 4)) - 1}${aujourdhui.slice(4)}`;

const parc: ParcBrut = {
  aujourdhui,
  vehicules: dates(await lignes("select * from vehicule order by immatriculation")),
  sites: new Map((await lignes<{ id: string; code: string; libelle: string; region: string; type: never }>("select id, code, libelle, region, type from site")).map((s) => [s.id, s])),
  chauffeurs: new Map((await lignes<{ id: string; nom: string; prenom: string }>("select id, nom, prenom from chauffeur")).map((c) => [c.id, c])),
  affectations: dates(await lignes("select vehicule_id, chauffeur_id, role, debut, fin from affectation")),
  documents: dates(await lignes("select vehicule_id, type_document_id, date_effet, echeance from document where vehicule_id is not null")),
  licences: dates(await lignes("select id, perimetre, echeance from licence_transport")),
  licencesVehicules: await lignes("select licence_id, vehicule_id from licence_vehicule"),
  releves: dates(await lignes(`select vehicule_id, date, km from releve_kilometrique where motif_rejet is null and date >= '${depuis}'`)),
  depenses: dates(await lignes(`select vehicule_id, date, montant::int as montant, km, km_motif_rejet from depense where date >= '${depuis}'`)),
  pleins: dates(await lignes(`select vehicule_id, date, km from plein where date >= '${depuis}'`)),
  interventions: dates(await lignes("select vehicule_id, numero, date, objet, km from intervention")),
};

console.log("=== Flotte : base contre démonstration");
const demoParImmat = new Map(
  FLOTTE.map((l) => {
    const f = fichePourImmatriculation(l.vehicule.immatriculation, PARAMETRES_DEFAUT);
    const imm = f?.immobilisationAdministrative ?? null;
    return [l.vehicule.immatriculation, { ...l, coutDouzeMois: f?.indicateurs.coutDouzeMois ?? l.coutDouzeMois, statutEffectif: imm?.statut ?? l.vehicule.statut, immobilisationAdministrative: imm?.documents ?? [], fiche: f }];
  }),
);
let ecarts = 0;
for (const v of parc.vehicules) {
  const base = ligneDepuisLaBase(v, parc, PARAMETRES_DEFAUT);
  const demo = demoParImmat.get(v.immatriculation);
  if (!demo) {
    console.log(`${v.immatriculation} : absent de la démonstration`);
    ecarts++;
    continue;
  }
  const diff: string[] = [];
  const cmp = (champ: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) diff.push(`${champ} base=${JSON.stringify(a)} démo=${JSON.stringify(b)}`);
  };
  cmp("titulaire", base.chauffeurTitulaire?.nom ?? null, demo.chauffeurTitulaire?.nom ?? null);
  cmp("suppléants", base.nombreSuppleants, demo.nombreSuppleants);
  cmp("site", base.site?.code ?? null, demo.site?.code ?? null);
  cmp("km", base.kilometrage, demo.fiche?.indicateurs.kilometrage ?? demo.kilometrage);
  cmp("conformité", base.prochaineEcheanceConformite ? `${base.prochaineEcheanceConformite.type} ${base.prochaineEcheanceConformite.joursRestants}` : null, demo.prochaineEcheanceConformite ? `${demo.prochaineEcheanceConformite.type} ${demo.prochaineEcheanceConformite.joursRestants}` : null);
  cmp("statut effectif", base.statutEffectif, demo.statutEffectif);
  cmp("immobilisation", base.immobilisationAdministrative?.map((d) => `${d.type}:${d.etat}`).sort(), demo.immobilisationAdministrative?.map((d) => `${d.type}:${d.etat}`).sort());
  cmp("coût 12 mois", base.coutDouzeMois, demo.coutDouzeMois);
  cmp("entretien", base.prochaineEcheanceEntretien?.libelle ?? null, demo.fiche?.prochaineIntervention?.libelle ?? null);
  if (diff.length) {
    ecarts++;
    console.log(`${v.immatriculation}\n  ${diff.join("\n  ")}`);
  }
}
console.log(`${parc.vehicules.length} véhicules, ${ecarts} avec écart`);

console.log("\n=== Chauffeurs : base contre démonstration");
const brut: ChauffeursBrut = {
  aujourdhui,
  chauffeurs: dates(await lignes("select * from chauffeur")),
  sites: await lignes("select id, code, libelle, region, type from site"),
  vehicules: await lignes("select id, immatriculation, marque, appellation from vehicule"),
  affectations: dates(await lignes("select vehicule_id, chauffeur_id, role, debut, fin from affectation")),
  indisponibilites: dates(await lignes("select id, numero, chauffeur_id, motif, debut, fin, commentaire from indisponibilite")),
  documents: dates(await lignes("select chauffeur_id, type_document_id, echeance from document where chauffeur_id is not null")),
  incidents: dates(await lignes(`select chauffeur_id, date_heure from incident where date_heure >= '${depuis}T00:00:00Z'`)),
  releves: dates(await lignes("select vehicule_id, date, km from releve_kilometrique where motif_rejet is null")),
  depenses: dates(await lignes(`select vehicule_id, date, poste, km, km_motif_rejet from depense where date >= '${depuis}'`)),
};
const baseC = lignesDepuisLaBase(brut);
const demoC = new Map(listeChauffeurs().map((l) => [l.id, l]));
let ecartsC = 0;
for (const b of baseC) {
  const d = demoC.get(b.id);
  if (!d) {
    console.log(`${b.id} : absent de la démonstration`);
    ecartsC++;
    continue;
  }
  const diff: string[] = [];
  const cmp = (champ: string, x: unknown, y: unknown) => {
    if (JSON.stringify(x) !== JSON.stringify(y)) diff.push(`${champ} base=${JSON.stringify(x)} démo=${JSON.stringify(y)}`);
  };
  cmp("statut", b.statut, d.statut);
  cmp("véhicule", b.vehiculeTitulaire?.immatriculation ?? null, d.vehiculeTitulaire?.immatriculation ?? null);
  cmp("suppléances", b.suppleances.map((s) => s.immatriculation).sort(), d.suppleances.map((s) => s.immatriculation).sort());
  cmp("permis", `${b.permis.manquant} ${b.permis.joursRestants}`, `${d.permis.manquant} ${d.permis.joursRestants}`);
  cmp("visite", `${b.visiteMedicale.manquant} ${b.visiteMedicale.joursRestants}`, `${d.visiteMedicale.manquant} ${d.visiteMedicale.joursRestants}`);
  cmp("incidents", b.incidentsDouzeMois, d.incidentsDouzeMois);
  cmp("contraventions", b.contraventionsDouzeMois, d.contraventionsDouzeMois);
  const ratio = b.kmDouzeMois && d.kmDouzeMois ? Math.round((b.kmDouzeMois / d.kmDouzeMois) * 100) : null;
  if (ratio === null ? b.kmDouzeMois !== d.kmDouzeMois : ratio < 70 || ratio > 130) diff.push(`km base=${b.kmDouzeMois} démo=${d.kmDouzeMois}`);
  if (diff.length) {
    ecartsC++;
    console.log(`${b.id}\n  ${diff.join("\n  ")}`);
  }
}
console.log(`${baseC.length} chauffeurs, ${ecartsC} avec écart`);

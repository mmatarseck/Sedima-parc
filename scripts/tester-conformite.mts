/* L'échéancier de la Conformité depuis la base, dans PGlite avec le seed :
 * documents, manquants, licences, contre-visite, rendez-vous, entretien,
 * chauffeurs — la même liste que la démonstration sait dresser.
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-conformite.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { assemblerFicheChauffeur } from "../src/domaine/assembler-fiche-chauffeur";
import { PARAMETRES_DEFAUT } from "../src/domaine/parametres";
import { listeChauffeurs } from "../src/donnees/chauffeurs-demo";
import { echeancesDepuisLaBase, type FaitsConformite } from "../src/donnees/conformite";
import { faitsChauffeurDepuisJson } from "../src/donnees/fiche-chauffeur";
import { ligneDepuisLaBase, type ParcBrut } from "../src/donnees/flotte";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();
const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
for (const m of readdirSync(join(projet, "supabase/migrations")).sort()) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
for (const p of readdirSync(join(projet, "supabase/seed-parties")).filter((f) => f.endsWith(".sql")).sort()) {
  const texte = readFileSync(join(projet, "supabase/seed-parties", p), "utf8");
  let courant: string[] = [];
  for (const ligne of texte.split("\n")) { courant.push(ligne); if (/^on conflict .*;$/.test(ligne.trim())) { try { await pg.exec(courant.join("\n")); } catch {} courant = []; } }
}
let echecs = 0;
const attendu = (libelle: string, ok: boolean) => { console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`); if (!ok) echecs++; };
const iso = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : d === null || d === undefined ? null : String(d));

const aujourdhui = "2026-09-08";
const j = (await pg.query(`select lire_parc($1) as j`, ["2025-09-08"])).rows[0].j as any;
const parc: ParcBrut = {
  aujourdhui, attributions: j.attributions, attributaires: new Map(j.attributaires.map((a: any) => [a.id, a])), aRecevoir: j.a_recevoir, vehicules: j.vehicules,
  sites: new Map(j.sites.map((s: any) => [s.id, { id: s.id, code: s.code, libelle: s.libelle, region: s.region, type: s.type }])),
  chauffeurs: new Map(j.chauffeurs.map((c: any) => [c.id, c])), affectations: j.affectations, documents: j.documents, licences: j.licences, licencesVehicules: j.licences_vehicules,
  releves: j.releves, depenses: j.depenses, pleins: j.pleins, interventions: j.interventions,
};
const lignes = parc.vehicules.map((v) => ligneDepuisLaBase(v, parc, PARAMETRES_DEFAUT));
const uuidParImmat = new Map(parc.vehicules.map((v) => [v.immatriculation, v.id]));

const faits: FaitsConformite = {
  documents: (await pg.query(`select numero, vehicule_id, type_document_id, date_effet, echeance, numero_piece, emetteur from document where vehicule_id is not null`)).rows.map((r: any) => ({ ...r, date_effet: iso(r.date_effet), echeance: iso(r.echeance) })),
  licences: (await pg.query(`select l.numero, l.libelle, l.numero_piece, l.emetteur, l.perimetre, l.echeance, (select coalesce(jsonb_agg(jsonb_build_object('vehicule', jsonb_build_object('immatriculation', v.immatriculation))), '[]'::jsonb) from licence_vehicule lv join vehicule v on v.id = lv.vehicule_id where lv.licence_id = l.id) as licence_vehicule from licence_transport l`)).rows.map((r: any) => ({ ...r, echeance: iso(r.echeance) })),
  visites: (await pg.query(`select numero, vehicule_id, type, centre, date_rendez_vous, heure, statut, numero_pv, date_limite_contre_visite from visite_technique where statut in ('rendez-vous', 'refusee')`)).rows.map((r: any) => ({ ...r, date_rendez_vous: iso(r.date_rendez_vous), date_limite_contre_visite: iso(r.date_limite_contre_visite) })),
  observations: (await pg.query(`select vehicule_id from observation_visite where statut <> 'corrigee'`)).rows as { vehicule_id: string }[],
};
const toutes = (await pg.query(`select lire_fiches_chauffeurs() as j`)).rows[0].j as { identifiant: string; fiche: any }[];
const lignesChauffeurs = listeChauffeurs();
const fichesChauffeurs = toutes.flatMap((f) => { const l = lignesChauffeurs.find((x) => x.id === f.identifiant); return l && f.fiche ? [assemblerFicheChauffeur(l, faitsChauffeurDepuisJson(f.fiche, l.id), aujourdhui)] : []; });

const t0 = performance.now();
const echeances = echeancesDepuisLaBase(lignes, uuidParImmat, faits, fichesChauffeurs, PARAMETRES_DEFAUT, aujourdhui);
console.log(`échéancier dressé en ${Math.round(performance.now() - t0)} ms : ${echeances.length} lignes`);
const par = (type: string) => echeances.filter((e) => e.type === type).length;
attendu(`${par("assurance")} assurances, ${par("visite-technique")} visites techniques, ${par("carte-grise")} cartes grises sur les véhicules d'exploitation`, par("assurance") > 10 && par("carte-grise") > 10);
attendu(`${par("licence-transport")} licence(s), une par licence, jamais par véhicule`, par("licence-transport") === faits.licences.length && faits.licences.length > 0);
attendu(`${par("contre-visite")} contre-visite(s) à programmer, ${par("rendez-vous")} rendez-vous`, par("contre-visite") >= 1 && par("rendez-vous") >= 1);
const contre = echeances.find((e) => e.type === "contre-visite");
attendu(`la contre-visite porte le nombre d'observations (${contre?.libelle})`, /\d+ observation/.test(contre?.libelle ?? ""));
const entretiens = echeances.filter((e) => e.type === "entretien");
attendu(`${entretiens.length} échéances d'entretien, ${entretiens.filter((e) => e.repere).length} en kilomètres, les autres en jours`, entretiens.length > 5 && entretiens.every((e) => e.repere?.includes("km") || e.joursRestants !== null));
const manquants = echeances.filter((e) => e.niveau === "manquant");
attendu(`${manquants.length} documents manquants signalés, avec un lien vers la fiche`, manquants.every((e) => e.sujetHref.includes("onglet=conformite")));
const chauffeurs = echeances.filter((e) => e.sujet === "chauffeur");
attendu(`${chauffeurs.length} échéances de chauffeurs (permis, visite médicale)`, chauffeurs.length > 20);
attendu(`aucune ligne d'un véhicule léger`, echeances.filter((e) => e.sujet === "vehicule" && e.sujetId !== "flotte").every((e) => lignes.find((l) => l.vehicule.id === e.sujetId)?.vehicule.regime === "exploitation"));
attendu(`triée : les niveaux les plus graves d'abord (${echeances[0]?.niveau} … ${echeances.at(-1)?.niveau})`, echeances[0]?.niveau !== "permanent" || echeances.every((e) => e.niveau === "permanent"));
attendu(`les clés sont uniques`, new Set(echeances.map((e) => e.cle)).size === echeances.length);
console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);

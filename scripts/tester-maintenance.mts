/* La Maintenance depuis la base, dans PGlite avec le seed : le travail à faire
 * déduit du parc, des ordres et des incidents ; les interventions de la table.
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-maintenance.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { PARAMETRES_DEFAUT } from "../src/domaine/parametres";
import { ligneDepuisLaBase, type ParcBrut } from "../src/donnees/flotte";
import { interventionDepuisLigne, laisseNonRoulant, travauxDepuisLaBase, type IncidentEnCours, type LigneInterventionBase } from "../src/donnees/maintenance";
import { ordreDepuisLigne, type LigneOrdreBase } from "../src/donnees/ordres";

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

const aujourdhui = "2026-09-08";
const j = (await pg.query(`select lire_parc($1) as j`, ["2025-09-08"])).rows[0].j as any;
const parc: ParcBrut = {
  aujourdhui,
  attributions: j.attributions, attributaires: new Map(j.attributaires.map((a: any) => [a.id, a])), aRecevoir: j.a_recevoir, vehicules: j.vehicules,
  sites: new Map(j.sites.map((s: any) => [s.id, { id: s.id, code: s.code, libelle: s.libelle, region: s.region, type: s.type }])),
  chauffeurs: new Map(j.chauffeurs.map((c: any) => [c.id, c])), affectations: j.affectations, documents: j.documents, licences: j.licences, licencesVehicules: j.licences_vehicules,
  releves: j.releves, depenses: j.depenses, pleins: j.pleins, interventions: j.interventions,
};
const lignes = parc.vehicules.map((v) => ligneDepuisLaBase(v, parc, PARAMETRES_DEFAUT));

/* Les ordres, comme ordresServeur() les lit. */
const ordresBruts = (await pg.query(`
  select o.numero, o.vehicule_id, o.type, o.objet, o.origine_numero, o.origine_libelle, o.garage, o.date_prevue, o.immobilisation_prevue_jours, o.montant_estime, o.statut, o.date_debut, o.date_cloture, o.intervention_numero, o.commentaire, o.demandeur_nom,
    jsonb_build_object('immatriculation', v.immatriculation, 'marque', v.marque, 'appellation', v.appellation, 'business_unit', v.business_unit, 'site', (select jsonb_build_object('libelle', s.libelle) from site s where s.id = v.site_id)) as vehicule,
    (select jsonb_build_object('raison_sociale', p.raison_sociale) from prestataire p where p.id = o.prestataire_id) as prestataire
  from ordre_travail o join vehicule v on v.id = o.vehicule_id`)).rows as LigneOrdreBase[];
const ordres = ordresBruts.map(ordreDepuisLigne);
const incidents = (await pg.query(`select numero, vehicule_id, date_heure, type, immobilisation_jours, description from incident where statut <> 'clos'`)).rows as IncidentEnCours[];

const travaux = travauxDepuisLaBase(lignes, parc, ordres, incidents, aujourdhui);
const parNature = (n: string) => travaux.filter((t) => t.nature === n).length;
attendu(`${travaux.length} travaux déduits : ${parNature("echeance")} échéances, ${parNature("immobilisation")} immobilisations, ${parNature("incident")} incidents`, travaux.length > 0 && parNature("echeance") > 0);
attendu(`chaque travail porte un véhicule de la liste`, travaux.every((t) => lignes.some((l) => l.vehicule.id === t.vehiculeId)));
attendu(`les clés sont uniques`, new Set(travaux.map((t) => t.cle)).size === travaux.length);
const nonRoulants = incidents.filter(laisseNonRoulant);
attendu(`${nonRoulants.length} incident(s) en cours non roulant(s) sur ${incidents.length} en cours, tous dans les travaux`, nonRoulants.every((i) => travaux.some((t) => t.origineNumero === i.numero)));
const enCours = travaux.filter((t) => t.urgence === "en-cours");
attendu(`${enCours.length} travaux « en cours » citent un ordre ouvert`, enCours.every((t) => t.ordreNumero && ordres.some((o) => o.numero === t.ordreNumero)));
const retards = travaux.filter((t) => t.urgence === "en-retard");
attendu(`${retards.length} échéances en retard, classées en tête`, travaux.findIndex((t) => t.urgence !== "en-retard") >= retards.length);
attendu(`aucune ligne d'un véhicule léger`, travaux.every((t) => lignes.find((l) => l.vehicule.id === t.vehiculeId)?.vehicule.regime === "exploitation"));

/* Les interventions, comme interventionsServeur() les lit. */
const interventionsBrutes = (await pg.query(`
  select i.numero, i.vehicule_id, i.date, i.type, i.objet, i.montant, i.immobilisation_jours, i.km, i.reference,
    jsonb_build_object('immatriculation', v.immatriculation, 'marque', v.marque, 'appellation', v.appellation, 'business_unit', v.business_unit, 'site', (select jsonb_build_object('libelle', s.libelle) from site s where s.id = v.site_id)) as vehicule,
    (select jsonb_build_object('raison_sociale', p.raison_sociale) from prestataire p where p.id = i.prestataire_id) as prestataire
  from intervention i join vehicule v on v.id = i.vehicule_id order by i.date desc`)).rows as LigneInterventionBase[];
const interventions = interventionsBrutes.map(interventionDepuisLigne);
const n = (await pg.query(`select count(*)::int as n from intervention`)).rows[0] as { n: number };
attendu(`${interventions.length} interventions lues = table (${n.n})`, interventions.length === n.n);
attendu(`chaque intervention a son véhicule, son garage et un montant numérique`, interventions.every((i) => i.immatriculation.length >= 6 && i.garage !== "" && Number.isFinite(i.montant)));
const t0 = interventions[0]!;
console.log(`   première : ${t0.numero} ${t0.immatriculationAffichee} — ${t0.objet} chez ${t0.garage}, ${t0.montant} F`);
console.log(`   premier travail : ${travaux[0]?.immatriculationAffichee} — ${travaux[0]?.objet} (${travaux[0]?.echeance})`);

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);

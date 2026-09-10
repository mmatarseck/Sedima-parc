/* Les rapports depuis la base, dans PGlite avec le seed : les lecteurs neufs
 * (coûts mensuels, incidents, visites, relevé entier, affectations du parc,
 * résumé des fiches) rejoués sur les tables, comparés à la démonstration, puis
 * les rapports assemblés sur une source mixte — base pour ces pièces,
 * démonstration pour le reste — doivent se dresser sans une erreur.
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-rapports.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { construireRapportDe, resumesFicheDepuisLaSource, type SourceRapports } from "../src/domaine/assembler-rapports";
import { PARAMETRES_DEFAUT } from "../src/domaine/parametres";
import { RAPPORTS } from "../src/domaine/rapports";
import { consommationsDepuisLaBase, pleinDepuisLigne, type LignePleinBase } from "../src/donnees/carburant";
import { donneesCouts } from "../src/donnees/couts-demo";
import { donneesCoutsDepuisLaBase, type LigneDepenseCout } from "../src/donnees/couts";
import { ligneDepuisLaBase, type ParcBrut } from "../src/donnees/flotte";
import { incidentDepuisLigne, type LigneIncidentBase } from "../src/donnees/incidents";
import { listeIncidents } from "../src/donnees/incidents-demo";
import { interventionDepuisLigne, type LigneInterventionBase } from "../src/donnees/maintenance";
import { affectationsDepuisLeParc } from "../src/donnees/rapports";
import { affectationsDemonstration, sourceRapportsDemo } from "../src/donnees/rapports-demo";
import { relevesTransport } from "../src/donnees/releve-demo";
import { visitesDemonstration } from "../src/donnees/visites-demo";

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
for (const m of readdirSync(join(projet, "supabase/migrations")).sort()) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
for (const p of readdirSync(join(projet, "supabase/seed-parties")).filter((f) => f.endsWith(".sql")).sort()) {
  const texte = readFileSync(join(projet, "supabase/seed-parties", p), "utf8");
  let courant: string[] = [];
  for (const ligne of texte.split("\n")) { courant.push(ligne); if (/^on conflict .*;$/.test(ligne.trim())) { try { await pg.exec(courant.join("\n")); } catch {} courant = []; } }
}
let echecs = 0;
const attendu = (libelle: string, ok: boolean) => { console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`); if (!ok) echecs++; };
const iso = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : d === null || d === undefined ? null : String(d));
const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const demo = sourceRapportsDemo(PARAMETRES_DEFAUT);
const aujourdhui = demo.aujourdhui;

/* ---- 1. Le parc, les lignes, les pièces neuves ---- */
const j = (await pg.query(`select lire_parc($1) as j`, [`${Number(aujourdhui.slice(0, 4)) - 1}${aujourdhui.slice(4)}`])).rows[0].j as any;
const parc: ParcBrut = {
  aujourdhui, attributions: j.attributions, attributaires: new Map(j.attributaires.map((a: any) => [a.id, a])), aRecevoir: j.a_recevoir, vehicules: j.vehicules,
  sites: new Map(j.sites.map((s: any) => [s.id, { id: s.id, code: s.code, libelle: s.libelle, region: s.region, type: s.type }])),
  chauffeurs: new Map(j.chauffeurs.map((c: any) => [c.id, c])), affectations: j.affectations, documents: j.documents, licences: j.licences, licencesVehicules: j.licences_vehicules,
  releves: j.releves, depenses: j.depenses, pleins: j.pleins, interventions: j.interventions,
};
const lignes = parc.vehicules.map((v) => ligneDepuisLaBase(v, parc, PARAMETRES_DEFAUT));
const vehiculeJson = `(select jsonb_build_object('immatriculation', v.immatriculation, 'marque', v.marque, 'appellation', v.appellation, 'business_unit', v.business_unit, 'site', (select jsonb_build_object('libelle', s.libelle) from site s where s.id = v.site_id)) from vehicule v where v.id = x.vehicule_id)`;
const pleins = ((await pg.query(`select x.numero, x.vehicule_id, x.date, x.litres, x.prix_litre, x.montant, x.km, x.source, x.reference, ${vehiculeJson} as vehicule, (select jsonb_build_object('raison_sociale', p.raison_sociale) from prestataire p where p.id = x.prestataire_id) as prestataire from plein x order by x.date desc`)).rows as any[]).map((r) => ({ ...r, date: iso(r.date) }) as LignePleinBase).map(pleinDepuisLigne);
const consommations = consommationsDepuisLaBase(pleins, parc, aujourdhui);
const interventions = ((await pg.query(`select x.numero, x.vehicule_id, x.date, x.type, x.objet, x.montant, x.immobilisation_jours, x.km, x.reference, ${vehiculeJson} as vehicule, (select jsonb_build_object('raison_sociale', p.raison_sociale) from prestataire p where p.id = x.prestataire_id) as prestataire from intervention x order by x.date desc`)).rows as any[]).map((r) => ({ ...r, date: iso(r.date) }) as LigneInterventionBase).map(interventionDepuisLigne);
const t0 = performance.now();
const depensesCout = ((await pg.query(`select x.date, x.poste, x.montant, (select jsonb_build_object('immatriculation', v.immatriculation) from vehicule v where v.id = x.vehicule_id) as vehicule from depense x where x.vehicule_id is not null`)).rows as any[]).map((r) => ({ ...r, date: iso(r.date) }) as LigneDepenseCout);
const couts = donneesCoutsDepuisLaBase(lignes, depensesCout, consommations, interventions, aujourdhui);
console.log(`parc : ${lignes.length} lignes, ${depensesCout.length} dépenses avec poste, ${pleins.length} pleins, ${interventions.length} interventions ; coûts de ${couts.length} véhicules en ${Math.round(performance.now() - t0)} ms`);

/* Les dépenses des douze derniers mois, véhicule par véhicule : la base et la démonstration doivent dire la même somme — sur le parc de transport, le parc léger ne coûtant en démonstration que des forfaits que la base ne porte pas encore. */
const transportImmats = new Set(lignes.filter((l) => !l.vehicule.regime || l.vehicule.regime === "exploitation").map((l) => l.vehicule.immatriculation));
const douze = new Set(Array.from({ length: 12 }, (_, k) => { const [a, m] = aujourdhui.split("-").map(Number); return new Date(Date.UTC(a!, m! - 1 - k, 1)).toISOString().slice(0, 7); }));
const somme = (d: { mois: { mois: string; parPoste: Partial<Record<string, number>> }[] }) => d.mois.filter((m) => douze.has(m.mois)).reduce((t, m) => t + Object.values(m.parPoste).reduce((u, x) => u + (x ?? 0), 0), 0);
const coutsDemo = donneesCouts();
let ecarts = 0;
let compares = 0;
for (const d of couts) {
  const dd = coutsDemo.find((x) => x.immatriculation === d.immatriculation);
  if (!dd || !transportImmats.has(d.immatriculation)) continue;
  compares++;
  if (Math.abs(somme(d) - somme(dd)) > 1) { ecarts++; if (ecarts <= 3) console.log(`  écart ${d.immatriculationAffichee} : base ${fmt(somme(d))} F, démo ${fmt(somme(dd))} F`); }
}
attendu(`les dépenses de douze mois par véhicule : ${compares} véhicules comparés, ${ecarts} écart(s)`, compares > 0 && ecarts === 0);
const total12 = couts.reduce((t, d) => t + somme(d), 0);
attendu(`les coûts portent les kilomètres et les litres (${fmt(couts.reduce((t, d) => t + d.mois.reduce((u, m) => u + m.km, 0), 0))} km, ${fmt(couts.reduce((t, d) => t + d.mois.reduce((u, m) => u + m.litres, 0), 0))} L) et ${fmt(total12)} F sur douze mois`, total12 > 0 && couts.some((d) => d.mois.some((m) => m.km > 0 && m.litres > 0)));

const incidents = ((await pg.query(`select x.numero, x.date_heure, x.nature, x.type, x.lieu, x.mission, x.responsabilite, x.statut, x.blesses, x.sinistre_ouvert, x.immobilisation_jours, x.kilometrage, x.declarant, x.description, ${vehiculeJson} as vehicule, (select jsonb_build_object('nom', c.nom, 'prenom', c.prenom) from chauffeur c where c.id = x.chauffeur_id) as chauffeur from incident x order by x.date_heure desc`)).rows as any[]).map((r) => ({ ...r, date_heure: r.date_heure instanceof Date ? r.date_heure.toISOString() : String(r.date_heure) }) as LigneIncidentBase).map(incidentDepuisLigne);
const incidentsDemo = listeIncidents();
attendu(`les incidents : ${incidents.length} en base, ${incidentsDemo.length} en démonstration ; chacun cite son véhicule et son chauffeur`, incidents.length === incidentsDemo.length && incidents.every((i) => i.immatriculation && i.chauffeur));
attendu(`un incident retrouvé à l'identique (${incidents[0]?.numero} : ${incidents[0]?.chauffeur}, ${incidents[0]?.statut})`, incidents.length > 0 && incidentsDemo.some((d) => d.numero === incidents[0]!.numero && d.chauffeur === incidents[0]!.chauffeur && d.statut === incidents[0]!.statut && d.dateHeure.slice(0, 10) === incidents[0]!.dateHeure.slice(0, 10)));

const visitesBase = (await pg.query(`select count(*)::int as n from visite_technique`)).rows[0] as { n: number };
const observationsBase = (await pg.query(`select count(*)::int as n from observation_visite`)).rows[0] as { n: number };
const visitesDemo = visitesDemonstration(PARAMETRES_DEFAUT);
attendu(`les visites techniques : ${visitesBase.n} en base, ${visitesDemo.visites.length} en démonstration ; observations ${observationsBase.n} / ${visitesDemo.observations.length}`, visitesBase.n === visitesDemo.visites.length && observationsBase.n === visitesDemo.observations.length);

const relevesBase = (await pg.query(`select count(*)::int as n from releve_transport`)).rows[0] as { n: number };
attendu(`le relevé de transport entier : ${relevesBase.n} lignes en base, ${relevesTransport().length} en démonstration`, relevesBase.n === relevesTransport().length);

const affectations = affectationsDepuisLeParc(parc);
const affectationsDemo = affectationsDemonstration(PARAMETRES_DEFAUT);
const nbBase = [...affectations.values()].reduce((t, l) => t + l.length, 0);
const nbDemo = [...affectationsDemo.values()].reduce((t, l) => t + l.length, 0);
const enCours = [...affectations.values()].flat().filter((a) => a.fin === null).length;
const enCoursDemo = [...affectationsDemo.values()].flat().filter((a) => a.fin === null).length;
/* lire_parc() ne rend que les affectations en cours : les rapports d'affectation et de disponibilité n'en lisent pas d'autres. */
attendu(`les affectations du parc : ${nbBase} en base (${enCours} en cours) contre ${nbDemo} en démonstration (${enCoursDemo} en cours) ; chacune nomme son chauffeur`, enCours > 0 && [...affectations.values()].flat().every((a) => a.chauffeur && a.chauffeurId));

/* Les kilomètres de chaque période se lisent sur les relevés du véhicule. Ils
   valaient zéro pour tout le parc : la colonne « Km du titulaire » du rapport
   des affectations annonçait « 0 km » partout, un chiffre inventé. */
const avecKm = [...affectations.values()].flat().filter((a) => a.kmParcourus > 0);
const totalKm = avecKm.reduce((t, a) => t + a.kmParcourus, 0);
attendu(`les kilomètres des affectations : ${avecKm.length} période(s) sur ${nbBase} en portent, ${totalKm.toLocaleString("fr-FR")} km au total — plus aucun zéro d'office`, avecKm.length > 0 && totalKm > 0);

/* ---- 2. La source mixte et les rapports ---- */
const sansFiches: Omit<SourceRapports, "resumesFiche"> = { ...demo, aujourdhui, lignes, affectations, couts, pleins, interventions, incidents };
const resumes = resumesFicheDepuisLaSource(sansFiches);
const transport = lignes.filter((l) => !l.vehicule.regime || l.vehicule.regime === "exploitation");
attendu(`le résumé des fiches, dérivé : ${resumes.size} véhicules, identité portée (${resumes.get(transport[0]!.vehicule.id)?.identite.typeModele ?? "—"}), immobilisations ${[...resumes.values()].filter((r) => r.immobilisation).length}`, resumes.size === lignes.length && transport.every((l) => resumes.get(l.vehicule.id)?.identite));
const source: SourceRapports = { ...sansFiches, resumesFiche: resumes };
let rapportsOk = 0;
for (const r of RAPPORTS) {
  try {
    const lignesRapport = construireRapportDe(source, r.id, { periode: { preset: "12-mois", debut: null, fin: null }, perimetre: "exploitation" }, PARAMETRES_DEFAUT);
    const attenduPlein = ["flotte-details", "flotte-affectations", "flotte-disponibilite", "couts-vehicule", "carburant-pleins", "maintenance-interventions", "incidents-declarations", "conformite-vehicule"].includes(r.id);
    if (attenduPlein && lignesRapport.length === 0) attendu(`${r.id} : aucune ligne`, false);
    else rapportsOk++;
  } catch (x) {
    attendu(`${r.id} : ${(x as Error).message}`, false);
  }
}
attendu(`${rapportsOk} rapports sur ${RAPPORTS.length} se dressent sur la source mixte`, rapportsOk === RAPPORTS.length);
const details = construireRapportDe(source, "flotte-details", undefined, PARAMETRES_DEFAUT);
attendu(`le détail des véhicules : ${details.length} lignes (${transport.length} véhicules de transport), coût par km porté`, details.length === transport.length && details.some((l) => typeof l.coutParKm === "number"));
const dispo = construireRapportDe(source, "flotte-disponibilite", undefined, PARAMETRES_DEFAUT);
attendu(`la disponibilité : ${dispo.filter((l) => (l.etat as { libelle: string }).libelle === "Prêt à charger").length} prêts à charger sur ${dispo.length}, conducteurs nommés ${dispo.filter((l) => l.conducteur).length}`, dispo.length === transport.length && dispo.some((l) => l.conducteur));
const coutsVehicule = construireRapportDe(source, "couts-vehicule", undefined, PARAMETRES_DEFAUT);
attendu(`les coûts par véhicule : ${coutsVehicule.length} lignes, total ${fmt(coutsVehicule.reduce((t, l) => t + Number(l.total ?? 0), 0))} F`, coutsVehicule.length > 0 && coutsVehicule.some((l) => Number(l.total) > 0));

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);

/* Le tableau de bord depuis la base, dans PGlite avec le seed : lire_tableau()
 * puis l'assemblage du domaine — faits par véhicule et par mois, semaine,
 * flotte, situation du jour, alertes.
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-tableau.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { PARAMETRES_DEFAUT } from "../src/domaine/parametres";
import { achatDepuisLigne, type LigneAchatBase } from "../src/donnees/achats";
import { ligneDepuisLaBase, type ParcBrut } from "../src/donnees/flotte";
import { donneesDepuisLaBase, moisDuTableau, type TableauJson } from "../src/donnees/tableau-bord";
import type { SituationJournaliere } from "../src/domaine/pastilles";

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

const aujourdhui = "2026-09-02";
const depuis = `${moisDuTableau(aujourdhui)[0]}-01`;
const t0 = performance.now();
const j = (await pg.query(`select lire_tableau($1) as j`, [depuis])).rows[0].j as TableauJson;
console.log(`lire_tableau en ${Math.round(performance.now() - t0)} ms : ${j.vehicules.length} véhicules, ${j.releves.length} relevés, ${j.pleins.length} pleins, ${j.depenses.length} dépenses, ${j.incidents.length} incidents, ${j.affretements.length} affrètements, ${j.mises_a_disposition.length} mises à disposition, ${j.prestations.length} prestations, ${j.releves_transport.length} relevés de transport`);

const jp = (await pg.query(`select lire_parc($1) as j`, ["2025-09-02"])).rows[0].j as any;
const parc: ParcBrut = {
  aujourdhui, attributions: jp.attributions, attributaires: new Map(jp.attributaires.map((a: any) => [a.id, a])), aRecevoir: jp.a_recevoir, vehicules: jp.vehicules,
  sites: new Map(jp.sites.map((s: any) => [s.id, { id: s.id, code: s.code, libelle: s.libelle, region: s.region, type: s.type }])),
  chauffeurs: new Map(jp.chauffeurs.map((c: any) => [c.id, c])), affectations: jp.affectations, documents: jp.documents, licences: jp.licences, licencesVehicules: jp.licences_vehicules,
  releves: jp.releves, depenses: jp.depenses, pleins: jp.pleins, interventions: jp.interventions,
};
const lignes = parc.vehicules.map((v) => ligneDepuisLaBase(v, parc, PARAMETRES_DEFAUT));
const sit = (await pg.query(`select situation_journaliere($1, $2) as j`, ["2026-08-06", aujourdhui])).rows[0].j as any[];
const situations: SituationJournaliere[] = sit.map((s) => ({
  jour: s.jour,
  vehicules: s.vehicules.map((v: any) => ({ vehiculeId: v.vehicule_id, jour: s.jour, engage: v.engage, statut: v.statut, immobiliseAdmin: v.immobilise_admin, immobiliseDepuisJours: v.immobilise_depuis_jours, echeances7: v.echeances7, echues: v.echues, sansReleve7: v.sans_releve7, litres: Number(v.litres), carburant: Number(v.carburant), depenses: Number(v.depenses), pannes: v.pannes, accidents: v.accidents, pretACharger: v.pret_a_charger })),
  flotte: { jour: s.jour, chauffeurs: s.flotte.chauffeurs, chauffeursIndisponibles: s.flotte.chauffeurs_indisponibles, ordresOuverts: s.flotte.ordres_ouverts, ordresAnciens: s.flotte.ordres_anciens, soldeCaisse: s.flotte.solde_caisse, seuilCaisse: s.flotte.seuil_caisse, cuveLitres: s.flotte.cuve_litres, cuveJours: s.flotte.cuve_jours, joursSansAccident: s.flotte.jours_sans_accident, demandesSansReponse: s.flotte.demandes_sans_reponse },
}));
const achats = ((await pg.query(`select a.numero, a.date, a.objet, a.poste, a.montant_estime, a.fournisseur, a.urgence, a.origine_numero, a.origine_libelle, a.demandeur_nom, a.demandeur_role, a.etape, a.visa_par, a.visa_le, a.valide_par, a.validee_le, a.numero_demande_x3, a.numero_bon_commande, a.montant_engage, a.date_livraison, a.date_facture, a.montant_reel, a.date_reglement, a.depense_numero, a.commentaire_decision, null as vehicule, null as prestataire from demande_achat a`)).rows as any[]).map((r) => ({ ...r, date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date, date_reglement: r.date_reglement instanceof Date ? r.date_reglement.toISOString().slice(0, 10) : r.date_reglement }) as LigneAchatBase).map(achatDepuisLigne);

const t1 = performance.now();
const d = donneesDepuisLaBase(j, lignes, situations, achats, PARAMETRES_DEFAUT, aujourdhui);
console.log(`assemblage en ${Math.round(performance.now() - t1)} ms`);

attendu(`${d.mois.length} mois, du ${d.mois[0]} au ${d.mois.at(-1)}`, d.mois.length === 24 && d.mois.at(-1) === "2026-09");
attendu(`${d.vehicules.length} véhicules d'exploitation, ${d.faits.length} faits mensuels (= véhicules × 24)`, d.vehicules.length > 15 && d.faits.length === d.vehicules.length * 24);
const somme = (cle: keyof (typeof d.faits)[number]) => d.faits.reduce((s, f) => s + Number(f[cle] ?? 0), 0);
attendu(`kilomètres ${somme("km")}, litres ${Math.round(somme("litres"))}, coût ${somme("cout")} F sur deux ans`, somme("km") > 100000 && somme("litres") > 10000 && somme("cout") > 10000000);
attendu(`${somme("accidents")} accidents dont ${somme("accidentsCorporels")} corporels, ${somme("pannesEnMission")} pannes en mission, ${somme("contraventions")} contraventions`, somme("accidents") > 0 && somme("contraventions") > 0);
attendu(`${somme("interventionsPreventives")} préventives, ${somme("interventionsCuratives")} curatives, ${somme("joursImmobilises")} jours immobilisés`, somme("interventionsCuratives") > 0 && somme("joursImmobilises") > 0);
attendu(`les litres de référence suivent les kilomètres`, d.faits.every((f) => (f.km === 0) === (f.litresReference === 0)));
attendu(`${d.faits.filter((f) => f.nonConforme).length} véhicule-mois non conformes, ${d.faits.filter((f) => f.entretienEnRetard).length} en retard d'entretien`, true);
const s = d.semaine;
attendu(`semaine : ${s.length} véhicules, ${s.reduce((x, f) => x + f.km, 0)} km, ${s.reduce((x, f) => x + f.cout, 0)} F`, s.length === d.vehicules.length && s.every((f) => f.jours === 7));
const fl = d.flotte;
const dernierMois = fl.find((f) => f.mois === "2026-08")!;
attendu(`août : ${dernierMois.joursChauffeurs} jours-chauffeurs, ${dernierMois.joursIndisponibiliteChauffeurs} indisponibles, transport tiers ${dernierMois.coutTransportTiers} F (affrètements ${dernierMois.coutAffretements}, MAD ${dernierMois.coutMisesADisposition}, prestations ${dernierMois.coutPrestations}), ${dernierMois.tonnesTiers} t tiers / ${dernierMois.tonnesInternes} t parc`, dernierMois.joursChauffeurs > 0 && dernierMois.coutTransportTiers > 0 && dernierMois.tonnesInternes > 0);
attendu(`la mise à disposition du mois en cours est au prorata des jours (${fl.at(-1)?.coutMisesADisposition} F sur 2 jours)`, (fl.at(-1)?.coutMisesADisposition ?? 0) < dernierMois.coutMisesADisposition);
attendu(`semaine flotte : ${d.flotteSemaine[0]?.joursChauffeurs} jours-chauffeurs, ${d.flotteSemaine[0]?.coutTransportTiers} F de tiers`, (d.flotteSemaine[0]?.joursChauffeurs ?? 0) > 0);
attendu(`jour : caisse ${d.jour.soldeCaisse} F (seuil ${d.jour.seuilReapprovisionnement}), ${d.jour.pretsACharger} prêts sur ${d.jour.engages} engagés, ${d.jour.joursSansAccident} j sans accident, ${d.jour.engagementsEnCours} F engagés, cycle ${d.jour.cycleAchatJours} j, spéciaux ${d.jour.vehiculesSpeciauxConformes}/${d.jour.vehiculesSpeciaux}`, d.jour.soldeCaisse > 0 && d.jour.engages > 0 && d.jour.vehiculesSpeciaux > 0);
attendu(`${d.alertes.length} alertes, critiques d'abord (${d.alertes.slice(0, 3).map((a) => a.libelle).join(" ; ")})`, d.alertes.length > 0 && d.alertes.every((a, i) => i === 0 || a.niveau !== "critique" || d.alertes[i - 1]!.niveau === "critique"));
console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);

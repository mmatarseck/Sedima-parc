/* Le parc léger depuis la base, dans PGlite avec le seed (0004) : les
 * véhicules de service et de fonction, leurs attributaires, les forfaits
 * carburant — comparés au dossier de démonstration ; les forfaits en dépense,
 * les huit rapports du parc léger, et le budget avec les forfaits, à
 * l'identique de la démonstration.
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-parc-leger.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { donneesBudgetDe } from "../src/domaine/assembler-budget";
import { construireRapportDe, type SourceRapports } from "../src/domaine/assembler-rapports";
import { depensesForfaitsDe } from "../src/domaine/parc-leger";
import { PARAMETRES_DEFAUT } from "../src/domaine/parametres";
import { RAPPORTS } from "../src/domaine/rapports";
import { achatDepuisLigne, type LigneAchatBase } from "../src/donnees/achats";
import { sourceDepuisLignes as sourceBudgetDepuisLignes, type LigneDepenseBudget, type LigneEnveloppe } from "../src/donnees/budget";
import { sourceBudgetDemo } from "../src/donnees/budget-demo";
import { DATE_REFERENCE } from "../src/donnees/chauffeurs-demo";
import { ligneDepuisLaBase, lignesARecevoir, type ParcBrut } from "../src/donnees/flotte";
import { FLOTTE } from "../src/donnees/parc-demo";
import { sourceDepuisLignes, type LigneAttributaireBase, type LigneAttributionBase, type LigneForfaitBase } from "../src/donnees/parc-leger";
import { sourceParcLegerDemo } from "../src/donnees/parc-leger-demo";
import { sourceRapportsDemo } from "../src/donnees/rapports-demo";

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
const aujourdhui = DATE_REFERENCE;
const forfaitDefaut = PARAMETRES_DEFAUT.parcLeger.forfaitCarburantMensuel;

/* ---- 1. La source ---- */
const j = (await pg.query(`select lire_parc($1) as j`, [`${Number(aujourdhui.slice(0, 4)) - 1}${aujourdhui.slice(4)}`])).rows[0].j as any;
const parc: ParcBrut = {
  aujourdhui, attributions: j.attributions, attributaires: new Map(j.attributaires.map((a: any) => [a.id, a])), aRecevoir: j.a_recevoir, vehicules: j.vehicules,
  sites: new Map(j.sites.map((s: any) => [s.id, { id: s.id, code: s.code, libelle: s.libelle, region: s.region, type: s.type }])),
  chauffeurs: new Map(j.chauffeurs.map((c: any) => [c.id, c])), affectations: j.affectations, documents: j.documents, licences: j.licences, licencesVehicules: j.licences_vehicules,
  releves: j.releves, depenses: j.depenses, pleins: j.pleins, interventions: j.interventions,
};
const lignes = [...parc.vehicules.map((v) => ligneDepuisLaBase(v, parc, PARAMETRES_DEFAUT)), ...lignesARecevoir(parc)];
const attributions = ((await pg.query(`select a.attributaire_id, a.pool, a.plan_car, a.plan_car_duree_mois, a.plan_car_debut, a.plan_car_statut, (select jsonb_build_object('immatriculation', v.immatriculation) from vehicule v where v.id = a.vehicule_id) as vehicule from attribution_legere a where a.fin is null`)).rows as LigneAttributionBase[]);
const attributaires = ((await pg.query(`select id, nom, fonction, departement, business_unit, actif from attributaire order by nom`)).rows as LigneAttributaireBase[]);
const forfaits = ((await pg.query(`select attributaire_id, montant_mensuel, carte from forfait_carburant`)).rows as LigneForfaitBase[]);
const source = sourceDepuisLignes(lignes, attributions, attributaires, forfaits);
/* Le dossier compte deux véhicules déjà dans la flotte de transport : la base les tient une fois, en exploitation. */
const transport = new Set(FLOTTE.map((l) => l.vehicule.immatriculation));
const demoComplet = sourceParcLegerDemo();
const demo = { ...demoComplet, vehicules: demoComplet.vehicules.filter((v) => v.regime !== "exploitation" && (!v.immatriculation || !transport.has(v.immatriculation))) };
const parRegime = (s: typeof source) => Object.fromEntries(["service", "fonction"].map((r) => [r, s.vehicules.filter((v) => v.regime === r).length]));
const parEtat = (s: typeof source) => Object.fromEntries(["actif", "pool", "panne", "a-reformer", "a-recevoir"].map((e) => [e, s.vehicules.filter((v) => v.etat === e).length]));
/* Le dossier de démonstration compte les véhicules à recevoir ; la liste de la base aussi (sous leur lot). */
attendu(`les véhicules légers : ${source.vehicules.length} en base, ${demo.vehicules.length} en démonstration — ${JSON.stringify(parRegime(source))} / ${JSON.stringify(parRegime(demo))}`, source.vehicules.length === demo.vehicules.length && JSON.stringify(parRegime(source)) === JSON.stringify(parRegime(demo)));
attendu(`par état : ${JSON.stringify(parEtat(source))} (démo ${JSON.stringify(parEtat(demo))})`, JSON.stringify(parEtat(source)) === JSON.stringify(parEtat(demo)));
attendu(`les attributaires : ${source.attributaires.length} en base, ${demo.attributaires.length} en démonstration ; identifiants de la table (uuid)`, source.attributaires.length === demo.attributaires.length && source.attributaires.every((a) => /^[0-9a-f-]{36}$/.test(a.id)));
attendu(`les forfaits : ${source.forfaits.length} en base, ${demo.forfaits.length} en démonstration`, source.forfaits.length === demo.forfaits.length);
const nommes = source.vehicules.filter((v) => v.attributaireId).length;
attendu(`${nommes} véhicules nomment leur attributaire (démo ${demo.vehicules.filter((v) => v.attributaireId).length}), ${source.vehicules.filter((v) => v.planCar).length} en plan car (démo ${demo.vehicules.filter((v) => v.planCar).length})`, nommes === demo.vehicules.filter((v) => v.attributaireId).length && source.vehicules.filter((v) => v.planCar).length === demo.vehicules.filter((v) => v.planCar).length);
const fb = depensesForfaitsDe(source, aujourdhui, forfaitDefaut);
const fd = depensesForfaitsDe(demo, aujourdhui, forfaitDefaut);
attendu(`les forfaits en dépense : ${fb.length} lignes pour ${fmt(fb.reduce((t, d) => t + d.montant, 0))} F (démo ${fd.length} lignes, ${fmt(fd.reduce((t, d) => t + d.montant, 0))} F)`, fb.length === fd.length && fb.reduce((t, d) => t + d.montant, 0) === fd.reduce((t, d) => t + d.montant, 0));

/* ---- 2. Les huit rapports du parc léger ---- */
const rapportsDemo = { ...sourceRapportsDemo(PARAMETRES_DEFAUT), parcLeger: demo };
const rapportsBase: SourceRapports = { ...rapportsDemo, parcLeger: source };
for (const r of RAPPORTS.filter((x) => x.id.startsWith("parc-leger"))) {
  const b = construireRapportDe(rapportsBase, r.id, undefined, PARAMETRES_DEFAUT);
  const d = construireRapportDe(rapportsDemo, r.id, undefined, PARAMETRES_DEFAUT);
  attendu(`${r.id} : ${b.length} lignes (démo ${d.length})`, b.length === d.length);
}

/* ---- 3. Le budget, forfaits compris, à l'identique ---- */
const exercice = aujourdhui.slice(0, 4);
const enveloppes = ((await pg.query(`select numero, exercice, poste, business_unit, montant, profil, base, commentaire from enveloppe where exercice = $1 order by numero`, [exercice])).rows as LigneEnveloppe[]);
const depenses = ((await pg.query(`select d.numero, d.date, d.poste, d.libelle, d.montant, d.beneficiaire, d.origine, d.justificatif,
  (select jsonb_build_object('immatriculation', v.immatriculation, 'marque', v.marque, 'appellation', v.appellation, 'business_unit', v.business_unit) from vehicule v where v.id = d.vehicule_id) as vehicule
  from depense d where d.date >= $1 and d.date <= $2`, [`${exercice}-01-01`, aujourdhui])).rows as Record<string, unknown>[]).map((r) => ({ ...r, date: iso(r.date) }) as unknown as LigneDepenseBudget);
const achats = ((await pg.query(`select a.numero, a.date, a.objet, a.poste, a.montant_estime, a.fournisseur, a.urgence, a.origine_numero, a.origine_libelle, a.demandeur_nom, a.demandeur_role, a.etape, a.visa_par, a.visa_le, a.valide_par, a.validee_le, a.numero_demande_x3, a.numero_bon_commande, a.montant_engage, a.date_livraison, a.date_facture, a.montant_reel, a.date_reglement, a.depense_numero, a.commentaire_decision,
  (select jsonb_build_object('immatriculation', v.immatriculation, 'business_unit', v.business_unit, 'site', null) from vehicule v where v.id = a.vehicule_id) as vehicule,
  (select jsonb_build_object('numero', p.numero, 'raison_sociale', p.raison_sociale) from prestataire p where p.id = a.prestataire_id) as prestataire from demande_achat a`)).rows as Record<string, unknown>[])
  .map((r) => ({ ...r, date: iso(r.date), date_livraison: iso(r.date_livraison), date_facture: iso(r.date_facture), date_reglement: iso(r.date_reglement), visa_le: iso(r.visa_le), validee_le: iso(r.validee_le) }) as unknown as LigneAchatBase)
  .map(achatDepuisLigne);
const budgetBase = donneesBudgetDe(sourceBudgetDepuisLignes(enveloppes, depenses, achats, aujourdhui, fb));
const budgetDemo = donneesBudgetDe(sourceBudgetDemo());
const carburantBase = budgetBase.postes.find((p) => p.poste === "carburant")!;
const carburantDemo = budgetDemo.postes.find((p) => p.poste === "carburant")!;
attendu(`le carburant du budget, forfaits compris : consommé ${fmt(carburantBase.cumul.consomme)} F (démo ${fmt(carburantDemo.cumul.consomme)}), ${carburantBase.parBu.length} BU, état ${carburantBase.cumul.etat} (démo ${carburantDemo.cumul.etat})`, carburantBase.cumul.consomme === carburantDemo.cumul.consomme && carburantBase.cumul.etat === carburantDemo.cumul.etat);
attendu(`la synthèse du budget à l'identique : consommé ${fmt(budgetBase.synthese.consomme)} F (démo ${fmt(budgetDemo.synthese.consomme)})`, budgetBase.synthese.consomme === budgetDemo.synthese.consomme && budgetBase.synthese.horsBudget === budgetDemo.synthese.horsBudget);

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);

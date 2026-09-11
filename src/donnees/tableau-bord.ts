/* ============================================================================
 * Le tableau de bord, lu avec la session de l'utilisateur.
 *
 * Base branchée : `lire_tableau()` (0024) rend les faits bruts de deux ans en
 * une requête, et l'assemblage ci-dessous les agrège à la maille véhicule ×
 * mois, sur la semaine glissante et au jour — avec les règles du domaine,
 * les mêmes qu'en démonstration : coût d'un affrètement facturé retenue
 * comprise, mise à disposition au prorata du mois en cours, tonnes au relevé
 * de transport, immobilisation administrative, groupe des postes. Le solde de
 * caisse, les prêts à charger et l'immobilisation prolongée viennent des
 * situations journalières (0010), les engagements des demandes d'achat.
 * Sinon, le jeu de démonstration.
 * ==========================================================================*/

import { cache } from "react";
import { REFERENCE_L100 } from "@/domaine/assembler-fiche";
import type { LigneAchat } from "@/domaine/caisse";
import { immobilisationAdministrative } from "@/domaine/documents";
import type { EtatDocument } from "@/domaine/fiche";
import { afficher } from "@/domaine/immatriculation";
import { TYPE_DOCUMENT, groupeDuPoste } from "@/domaine/libelles";
import type { Parametres } from "@/domaine/parametres";
import type { SituationJournaliere } from "@/domaine/pastilles";
import { bornesDuReleve, releveCouvre, tonnagesPar, type LigneReleve } from "@/domaine/releve-transport";
import type { FaitsFlotteMois, FaitsVehiculeMois, SituationJour, VehiculeTableau } from "@/domaine/tableau-bord";
import { coutAffretement, coutMiseADisposition, coutPrestation, prestationFaite, type Affretement, type MiseADisposition, type Prestation, type RegimeFiscal, ventiler } from "@/domaine/transporteurs";
import type { BusinessUnit, CategorieFlotte, CategorieVehicule, LigneFlotte, PosteDepense, StatutVehicule, TypeDocument } from "@/domaine/types";
import { joursRestants } from "@/lib/format";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { achatsServeur } from "./achats";
import { lignesFlotte } from "./flotte";
import { situationsServeur } from "./situations";
import { donneesTableau, type Alerte, type DonneesTableau } from "./tableau-bord-demo";

/* -- Ce que la base rend ------------------------------------------------------- */

export interface TableauJson {
  vehicules: { id: string; immatriculation: string; marque: string; appellation: string; categorie: CategorieVehicule; categorie_flotte: CategorieFlotte; business_unit: BusinessUnit | null; site: string | null; engage: boolean; transport_special: boolean; statut: StatutVehicule; regime: string | null }[];
  releves: { vehicule_id: string; date: string; km: number }[];
  pleins: { vehicule_id: string; date: string; litres: number | string; montant: number; km: number | null }[];
  depenses: { vehicule_id: string; date: string; poste: PosteDepense; montant: number }[];
  interventions: { vehicule_id: string; date: string; type: "preventif" | "curatif"; immobilisation_jours: number | null }[];
  incidents: { vehicule_id: string; date_heure: string; nature: "incident" | "accident"; type: string; mission: string | null; blesses: boolean }[];
  documents: { vehicule_id: string; numero: string; type_document_id: string; date_effet: string | null; echeance: string | null }[];
  statuts: { immatriculation: string; avant: string | null; apres: string | null; le: string }[];
  chauffeurs: { id: string; date_embauche: string | null; date_sortie: string | null }[];
  indisponibilites: { chauffeur_id: string; debut: string; fin: string | null }[];
  affretements: { date: string; statut: Affretement["statut"]; montant_convenu: number; montant_facture: number | null; tonnage_prevu: number | string; tonnage_livre: number | string | null; regime?: RegimeFiscal }[];
  mises_a_disposition: { mois: string; statut: MiseADisposition["statut"]; jours_calendaires: number; jours_panne: number; prix_jour: number; convention: MiseADisposition["convention"]; montant_facture: number | null; carburant_montant: number; tonnes_transportees: number | string | null; regime?: RegimeFiscal }[];
  prestations: { date: string; statut: Prestation["statut"]; quantite: number | string; prix_unitaire: number; convention: Prestation["convention"]; montant_facture: number | null; regime?: RegimeFiscal }[];
  releves_transport: { date: string; mode: LigneReleve["mode"]; produit: LigneReleve["produit"]; tonnage: number | string; tonnage_pese: number | string | null }[];
}

export const PROFONDEUR_MOIS = 24;
const IMMOBILISANTS: StatutVehicule[] = ["en-reparation", "en-restauration", "hors-service"];
const n = (v: number | string | null | undefined): number => (v === null || v === undefined ? 0 : typeof v === "number" ? v : Number(v));

function dernierJour(mois: string): string {
  const [a, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(a!, m!, 0)).toISOString().slice(0, 10);
}
function joursEntre(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;
}
/** Jours de [debut, fin] compris dans [depuis, jusqua] — zéro si les intervalles ne se croisent pas. */
function joursDans(debut: string, fin: string | null, depuis: string, jusqua: string): number {
  const d = debut > depuis ? debut : depuis;
  const f = (fin ?? jusqua) < jusqua ? (fin ?? jusqua) : jusqua;
  return f < d ? 0 : joursEntre(d, f);
}
function etatALaDate(d: { dateEffet: string | null; echeance: string | null }, date: string): EtatDocument {
  if (!d.echeance) return "permanent";
  if (d.dateEffet && d.dateEffet > date) return "a-jour";
  return d.echeance < date ? "echu" : "a-jour";
}
function plusJours(jour: string, k: number): string {
  return new Date(Date.parse(`${jour}T00:00:00Z`) + k * 86_400_000).toISOString().slice(0, 10);
}
/** Le compteur à une date, lu sur des points (date, km) croissants : le dernier point avant, sinon le premier après. */
function kmVers(points: { date: string; km: number }[], date: string): number | null {
  let avant: number | null = null;
  for (const p of points) {
    if (p.date <= date) avant = p.km;
    else return avant ?? p.km;
  }
  return avant;
}
/** Les kilomètres parcourus entre deux dates, compteur du début exclu si l'on a mieux ensuite. */
function kmEntre(points: { date: string; km: number }[], debut: string, fin: string): number {
  const a = kmVers(points, plusJours(debut, -1));
  const b = kmVers(points, fin);
  return a !== null && b !== null && b > a ? b - a : 0;
}

/** Les mois de la profondeur, du plus ancien au courant. */
export function moisDuTableau(aujourdhui: string, profondeur = PROFONDEUR_MOIS): string[] {
  const [a, m] = aujourdhui.split("-").map(Number);
  const mois: string[] = [];
  for (let k = profondeur - 1; k >= 0; k--) mois.push(new Date(Date.UTC(a!, m! - 1 - k, 1)).toISOString().slice(0, 7));
  return mois;
}

interface PeriodeStatut {
  statut: StatutVehicule;
  debut: string;
  fin: string | null;
}

/**
 * L'assemblage, pur : ce que la page montre, depuis les faits bruts, les lignes
 * de la liste (immobilisation, plan d'entretien), les situations journalières
 * (caisse, prêts à charger, immobilisation du jour) et les demandes d'achat.
 */
export function donneesDepuisLaBase(j: TableauJson, lignes: LigneFlotte[], situations: SituationJournaliere[], achats: LigneAchat[], parametres: Parametres, aujourdhui: string): DonneesTableau {
  const mois = moisDuTableau(aujourdhui);
  const finDe = (x: string) => (dernierJour(x) > aujourdhui ? aujourdhui : dernierJour(x));
  const joursDuMois = new Map(mois.map((x) => [x, joursEntre(`${x}-01`, finDe(x))]));
  const debutSemaine = plusJours(aujourdhui, -6);
  const joursSemaine = joursEntre(debutSemaine, aujourdhui);
  const dernier = situations.at(-1) ?? null;
  const situationPar = new Map((dernier?.vehicules ?? []).map((v) => [v.vehiculeId, v]));
  const ligneParImmat = new Map(lignes.map((l) => [l.vehicule.immatriculation, l]));

  const parVehicule = <T extends { vehicule_id: string }>(liste: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of liste) m.set(x.vehicule_id, [...(m.get(x.vehicule_id) ?? []), x]);
    return m;
  };
  const relevesPar = parVehicule(j.releves);
  const pleinsPar = parVehicule(j.pleins);
  const depensesPar = parVehicule(j.depenses.filter((d) => d.poste !== "amortissement" && d.poste !== "salaire"));
  const interventionsPar = parVehicule(j.interventions);
  const incidentsPar = parVehicule(j.incidents.map((i) => ({ ...i, date: i.date_heure.slice(0, 10) })));
  const documentsPar = parVehicule(j.documents);
  /* La non-conformité du mois ne juge que les pièces portées par le véhicule —
     « VT ou assurance échue », comme la fonction SQL. La lecture du tableau ne
     porte pas les licences : les laisser dans les types les déclarait
     manquantes chaque mois, et tout poids lourd sortait non conforme. */
  const parametresVehicule = { ...parametres, documents: { types: parametres.documents.types.filter((t) => t.porteur === "vehicule") } };
  const statutsPar = new Map<string, TableauJson["statuts"]>();
  for (const s of j.statuts) statutsPar.set(s.immatriculation, [...(statutsPar.get(s.immatriculation) ?? []), s]);

  const vehicules: VehiculeTableau[] = [];
  const faits: FaitsVehiculeMois[] = [];
  const semaine: FaitsVehiculeMois[] = [];
  const alertes: Alerte[] = [];
  let vehiculesSpeciaux = 0;
  let vehiculesSpeciauxConformes = 0;

  for (const v of j.vehicules) {
    if (v.regime && v.regime !== "exploitation") continue;
    const ligne = ligneParImmat.get(v.immatriculation) ?? null;
    if (!ligne) continue;
    const immatriculationAffichee = afficher(v.immatriculation);
    vehicules.push({ id: v.immatriculation, immatriculation: v.immatriculation, immatriculationAffichee, libelle: `${v.marque} ${v.appellation}`, categorie: v.categorie, categorieFlotte: v.categorie_flotte, businessUnit: v.business_unit, site: v.site });

    /* Les points de compteur : relevés valides et compteurs des pleins, croissants. */
    const points = [...(relevesPar.get(v.id) ?? []).map((r) => ({ date: r.date, km: r.km })), ...(pleinsPar.get(v.id) ?? []).filter((p) => p.km !== null).map((p) => ({ date: p.date, km: p.km! }))].sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);
    const propres: { date: string; km: number }[] = [];
    for (const p of points) if (propres.length === 0 || p.km >= propres[propres.length - 1]!.km) propres.push(p);

    /* Les périodes de statut : la trace, puis les réparations qui immobilisent ; sans trace, la situation du jour dit depuis quand. */
    const periodes: PeriodeStatut[] = [];
    const trace = (statutsPar.get(v.immatriculation) ?? []).filter((s) => s.apres);
    for (let i = 0; i < trace.length; i++) periodes.push({ statut: trace[i]!.apres as StatutVehicule, debut: trace[i]!.le.slice(0, 10), fin: trace[i + 1] ? trace[i + 1]!.le.slice(0, 10) : null });
    for (const i of (interventionsPar.get(v.id) ?? []).filter((x) => x.type === "curatif" && (x.immobilisation_jours ?? 0) > 0)) periodes.push({ statut: "en-reparation", debut: i.date, fin: plusJours(i.date, i.immobilisation_jours ?? 0) });
    const situation = situationPar.get(v.id) ?? null;
    if (periodes.length === 0 && IMMOBILISANTS.includes(v.statut)) periodes.push({ statut: v.statut, debut: plusJours(aujourdhui, -Math.max(0, (situation?.immobiliseDepuisJours ?? 1) - 1)), fin: null });

    const profil = { categorie: v.categorie, transportSpecial: v.transport_special, statut: v.statut };
    const documents = (documentsPar.get(v.id) ?? []).map((d) => ({ type: d.type_document_id as TypeDocument, numero: d.numero, dateEffet: d.date_effet, echeance: d.echeance }));
    /* L'état du plan ne vaut que pour aujourd'hui : il ne se lit que sur une période qui contient ce jour. */
    const etatPlan = ligne.etatPlanEntretien ?? "inconnu";
    const refL100 = REFERENCE_L100[v.categorie] ?? 20;

    const faitsSur = (cle: string, debut: string, fin: string, jours: number): FaitsVehiculeMois => {
      const dans = <T extends { date: string }>(liste: T[]) => liste.filter((y) => y.date >= debut && y.date <= fin);
      const interventions = dans(interventionsPar.get(v.id) ?? []);
      const depenses = dans(depensesPar.get(v.id) ?? []);
      const pleins = dans(pleinsPar.get(v.id) ?? []);
      const incidents = dans(incidentsPar.get(v.id) ?? []);
      const contraventions = depenses.filter((d) => d.poste === "contravention");
      const km = kmEntre(propres, debut, fin);
      let joursImmobilises = 0;
      for (const p of periodes) if (IMMOBILISANTS.includes(p.statut)) joursImmobilises += joursDans(p.debut, p.fin, debut, fin);
      return {
        vehiculeId: v.immatriculation,
        mois: cle,
        jours,
        engage: v.engage,
        transportSpecial: v.transport_special,
        km,
        litres: Math.round(pleins.reduce((s, p) => s + n(p.litres), 0) * 10) / 10,
        litresReference: (km * refL100) / 100,
        joursImmobilises: Math.min(joursImmobilises, jours),
        nonConforme: immobilisationAdministrative(profil, documents.map((d) => ({ type: d.type, etat: etatALaDate(d, fin) })), parametresVehicule) !== null,
        entretienEnRetard: fin < aujourdhui || etatPlan === "inconnu" ? null : etatPlan === "en-retard",
        accidents: incidents.filter((i) => i.nature === "accident").length,
        accidentsCorporels: incidents.filter((i) => i.nature === "accident" && i.blesses).length,
        pannesEnMission: incidents.filter((i) => i.nature === "incident" && i.mission !== null && i.mission !== "hors-mission").length,
        avariesChargement: incidents.filter((i) => i.type === "avarie-chargement").length,
        contraventions: contraventions.length,
        montantContraventions: contraventions.reduce((s, d) => s + n(d.montant), 0),
        interventionsPreventives: interventions.filter((i) => i.type === "preventif").length,
        interventionsCuratives: interventions.filter((i) => i.type === "curatif").length,
        /* La durée moyenne au garage ne porte que sur les interventions dont la durée est connue. */
        immobilisationInterventions: interventions.reduce((s, i) => s + (i.immobilisation_jours ?? 0), 0),
        nombreInterventions: interventions.filter((i) => i.immobilisation_jours !== null).length,
        curativesSansDuree: interventions.filter((i) => i.type === "curatif" && i.immobilisation_jours === null).length,
        cout: depenses.reduce((s, d) => s + n(d.montant), 0),
        coutMaintenance: depenses.filter((d) => groupeDuPoste(d.poste) === "maintenance").reduce((s, d) => s + n(d.montant), 0),
        coutCuratif: depenses.filter((d) => d.poste === "maintenance-curative").reduce((s, d) => s + n(d.montant), 0),
      };
    };
    for (const x of mois) {
      if (`${x}-01` > aujourdhui) continue;
      faits.push(faitsSur(x, `${x}-01`, finDe(x), joursDuMois.get(x) ?? 0));
    }
    semaine.push(faitsSur("semaine", debutSemaine, aujourdhui, joursSemaine));

    if (v.transport_special) {
      vehiculesSpeciaux += 1;
      const salubrite = documents.filter((d) => d.type === "certificat-salubrite").sort((a, b) => (b.echeance ?? "").localeCompare(a.echeance ?? ""))[0];
      if (salubrite && etatALaDate(salubrite, aujourdhui) !== "echu") vehiculesSpeciauxConformes += 1;
    }

    /* Les alertes du jour : les documents échus ou proches, l'immobilisation qui dure. */
    for (const d of documents) {
      const j0 = joursRestants(d.echeance, new Date(`${aujourdhui}T00:00:00Z`));
      if (j0 === null) continue;
      if (j0 < 0) alertes.push({ immatriculation: v.immatriculation, immatriculationAffichee, libelle: `${TYPE_DOCUMENT[d.type]} échue`, echeance: `échue de ${Math.abs(j0)} j`, niveau: "critique", href: `/flotte/${v.immatriculation}?onglet=conformite&ref=${d.numero}` });
      else if (j0 <= 30) alertes.push({ immatriculation: v.immatriculation, immatriculationAffichee, libelle: TYPE_DOCUMENT[d.type], echeance: `dans ${j0} j`, niveau: "vigilance", href: `/flotte/${v.immatriculation}?onglet=conformite&ref=${d.numero}` });
    }
    const immobiliseDepuis = situation && IMMOBILISANTS.includes(situation.statut) ? situation.immobiliseDepuisJours : 0;
    if (immobiliseDepuis >= 21) alertes.push({ immatriculation: v.immatriculation, immatriculationAffichee, libelle: "Immobilisation prolongée", echeance: `${immobiliseDepuis} j au garage`, niveau: immobiliseDepuis >= 45 ? "critique" : "vigilance", href: `/flotte/${v.immatriculation}?onglet=journal` });
  }

  /* ---- La flotte, mois par mois : l'absentéisme et le transport confié à des tiers ---- */
  const affretements = j.affretements.map((a) => ({ date: a.date, statut: a.statut, montantConvenu: n(a.montant_convenu), montantFacture: a.montant_facture === null ? null : n(a.montant_facture), tonnes: prestationFaite(a.statut) ? n(a.tonnage_livre ?? a.tonnage_prevu) : 0, regime: a.regime ?? "a-confirmer" }));
  const mads = j.mises_a_disposition.map((m) => ({ mois: m.mois, statut: m.statut, joursCalendaires: m.jours_calendaires, joursPanne: m.jours_panne, prixJour: m.prix_jour, convention: m.convention, montantFacture: m.montant_facture === null ? null : n(m.montant_facture), carburantMontant: n(m.carburant_montant), tonnes: n(m.tonnes_transportees), regime: m.regime ?? "a-confirmer" }));
  const prestations = j.prestations.map((p) => ({ date: p.date, statut: p.statut, quantite: n(p.quantite), prixUnitaire: p.prix_unitaire, convention: p.convention, montantFacture: p.montant_facture === null ? null : n(p.montant_facture), regime: p.regime ?? "a-confirmer" }));
  /* Le relevé de transport ne sert qu'aux tonnes : mode, produit et tonnages suffisent aux règles. */
  const relevesTransport = j.releves_transport.map((t) => ({ date: t.date, mode: t.mode, produit: t.produit, tonnage: n(t.tonnage), tonnagePese: t.tonnage_pese === null ? null : n(t.tonnage_pese) }) as unknown as LigneReleve & { date: string });
  /* Un mois n'a de tonnes que si le relevé le couvre en entier : voir `releveCouvre`. */
  const bornes = bornesDuReleve(relevesTransport);
  const actifsAu = (jour: string) => j.chauffeurs.filter((c) => (!c.date_embauche || c.date_embauche <= jour) && (!c.date_sortie || c.date_sortie > jour)).length;
  const indisponiblesSur = (debut: string, fin: string) => j.indisponibilites.reduce((s, i) => s + joursDans(i.debut, i.fin, debut, fin), 0);

  const flotte: FaitsFlotteMois[] = mois.map((x) => {
    if (`${x}-01` > aujourdhui) return { mois: x, joursIndisponibiliteChauffeurs: 0, joursChauffeurs: 0, coutTransportTiers: 0, coutAffretements: 0, coutMisesADisposition: 0, coutPrestations: 0, taxeTransportTiers: 0, tonnesTiers: null, tonnesInternes: null };
    const debut = `${x}-01`;
    const fin = finDe(x);
    const jours = joursDuMois.get(x) ?? 0;
    const partDuMois = x === aujourdhui.slice(0, 7) ? jours / Number(dernierJour(x).slice(8, 10)) : 1;
    const aff = affretements.filter((a) => a.date.slice(0, 7) === x);
    const madMois = mads.filter((m) => m.mois === x);
    const pres = prestations.filter((p) => p.date.slice(0, 7) === x);
    const coutAff = aff.reduce((s, a) => s + coutAffretement(a), 0);
    const coutMad = Math.round(madMois.reduce((s, m) => s + coutMiseADisposition(m).total, 0) * partDuMois);
    const coutPres = pres.reduce((s, p) => s + coutPrestation(p), 0);
    /* La TVA de ces coûts, pour qui les lit TTC : la location d'une mise à disposition la porte, pas son carburant. */
    const taxe = aff.reduce((s, a) => s + ventiler(coutAffretement(a), a.regime).tva, 0) + Math.round(madMois.reduce((s, m) => s + ventiler(coutMiseADisposition(m).location, m.regime).tva, 0) * partDuMois) + pres.reduce((s, p) => s + ventiler(coutPrestation(p), p.regime).tva, 0);
    const tonnes = tonnagesPar(relevesTransport.filter((l) => l.date >= debut && l.date <= fin));
    const couvert = releveCouvre(bornes, debut, fin);
    return { mois: x, joursIndisponibiliteChauffeurs: indisponiblesSur(debut, fin), joursChauffeurs: actifsAu(fin) * jours, coutTransportTiers: coutAff + coutMad + coutPres, coutAffretements: coutAff, coutMisesADisposition: coutMad, coutPrestations: coutPres, taxeTransportTiers: taxe, tonnesTiers: couvert ? tonnes.externe : null, tonnesInternes: couvert ? tonnes.interne : null };
  });
  const flotteSemaine: FaitsFlotteMois[] = [
    (() => {
      const moisCourant = aujourdhui.slice(0, 7);
      const aff = affretements.filter((a) => a.date >= debutSemaine && a.date <= aujourdhui);
      const coutAff = aff.reduce((s, a) => s + coutAffretement(a), 0);
      const coutMad = Math.round(mads.filter((m) => m.mois === moisCourant).reduce((s, m) => s + (coutMiseADisposition(m).total * joursSemaine) / m.joursCalendaires, 0));
      const coutPres = prestations.filter((p) => p.date >= debutSemaine && p.date <= aujourdhui).reduce((s, p) => s + coutPrestation(p), 0);
      const taxe = aff.reduce((s, a) => s + ventiler(coutAffretement(a), a.regime).tva, 0) + Math.round(mads.filter((m) => m.mois === moisCourant).reduce((s, m) => s + (ventiler(coutMiseADisposition(m).location, m.regime).tva * joursSemaine) / m.joursCalendaires, 0)) + prestations.filter((p) => p.date >= debutSemaine && p.date <= aujourdhui).reduce((s, p) => s + ventiler(coutPrestation(p), p.regime).tva, 0);
      const tonnes = tonnagesPar(relevesTransport.filter((l) => l.date >= debutSemaine && l.date <= aujourdhui));
      const couvert = releveCouvre(bornes, debutSemaine, aujourdhui);
      return { mois: "semaine", joursIndisponibiliteChauffeurs: indisponiblesSur(debutSemaine, aujourdhui), joursChauffeurs: actifsAu(aujourdhui) * joursSemaine, coutTransportTiers: coutAff + coutMad + coutPres, coutAffretements: coutAff, coutMisesADisposition: coutMad, coutPrestations: coutPres, taxeTransportTiers: taxe, tonnesTiers: couvert ? tonnes.externe : null, tonnesInternes: couvert ? tonnes.interne : null };
    })(),
  ];

  /* ---- La situation du jour ---- */
  const reglees = achats.filter((d) => d.dateReglement !== null);
  const engagementsEnCours = achats.filter((d) => d.numeroBonCommande !== null && d.dateReglement === null && d.etape !== "refusee").reduce((s, d) => s + (d.montantReel ?? d.montantEngage ?? d.montantEstime), 0);
  const cycleAchatJours = reglees.length ? Math.round(reglees.reduce((s, d) => s + (Date.parse(d.dateReglement!) - Date.parse(d.date)) / 86_400_000, 0) / reglees.length) : null;
  const engages = (dernier?.vehicules ?? []).filter((x) => x.engage);
  const jour: SituationJour = {
    /* Pas de repli sur le solde reporté : sans mouvement, ce n'est pas une mesure (0037). */
    soldeCaisse: dernier?.flotte.soldeCaisse ?? null,
    seuilReapprovisionnement: dernier?.flotte.seuilCaisse ?? parametres.caisse.seuil,
    pretsACharger: engages.filter((x) => x.pretACharger && !x.immobiliseAdmin).length,
    engages: engages.length,
    joursSansAccident: dernier?.flotte.joursSansAccident ?? null,
    engagementsEnCours,
    cycleAchatJours,
    vehiculesSpeciaux,
    vehiculesSpeciauxConformes,
  };

  alertes.sort((x, y) => (x.niveau === y.niveau ? 0 : x.niveau === "critique" ? -1 : 1));
  return { mois, semaine, flotteSemaine, vehicules, faits, flotte, jour, alertes };
}

/* -- Ce que la page appelle -------------------------------------------------- */

async function donneesTableauServeurBrut(parametres: Parametres): Promise<DonneesTableau> {
  if (!authentificationReelle()) return donneesTableau();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const depuis = `${moisDuTableau(aujourdhui)[0]}-01`;
  const client = await clientServeur();
  const [lecture, lignes, situations, achats] = await Promise.all([client.rpc("lire_tableau", { depuis }).maybeSingle<TableauJson | null>(), lignesFlotte(parametres), situationsServeur(aujourdhui), achatsServeur()]);
  /* Fonction pas encore jouée : un tableau sans courbes, les pastilles tiennent seules. */
  if (lecture.error || !lecture.data) {
    if (lecture.error) console.warn(`Tableau de bord : lire_tableau() indisponible (${lecture.error.message}).`);
    const vide: TableauJson = { vehicules: [], releves: [], pleins: [], depenses: [], interventions: [], incidents: [], documents: [], statuts: [], chauffeurs: [], indisponibilites: [], affretements: [], mises_a_disposition: [], prestations: [], releves_transport: [] };
    return donneesDepuisLaBase(vide, lignes, situations, achats, parametres, aujourdhui);
  }
  return donneesDepuisLaBase(lecture.data, lignes, situations, achats, parametres, aujourdhui);
}

export const donneesTableauServeur = cache(donneesTableauServeurBrut);

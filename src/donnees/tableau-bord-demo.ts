/* ============================================================================
 * Tableau de bord SQDCM — les faits, véhicule par véhicule et mois par mois.
 *
 * Une seule vérité : rien n'est saisi pour le tableau de bord. Chaque fait se
 * relit sur les fiches — périodes de statut, interventions, documents, plan
 * d'entretien, dépenses, consommation — sur les déclarations d'incident, sur
 * la caisse et les demandes d'achat, et sur les fiches chauffeurs. Une valeur
 * du tableau de bord se remonte donc toujours jusqu'à la ligne qui la produit.
 *
 * La maille est le **véhicule × mois** : c'est elle qui permet à l'écran de
 * filtrer par business unit, par catégorie de flotte et par site sans rien
 * recharger, comme le demande la maquette.
 * ==========================================================================*/

import { conducteurDuJour, etatDisponibilite } from "@/domaine/disponibilite";
import { immobilisationAdministrative } from "@/domaine/documents";
import type { EtatDocument } from "@/domaine/fiche";
import { TYPE_DOCUMENT, groupeDuPoste } from "@/domaine/libelles";
import type { FaitsFlotteMois, FaitsVehiculeMois, SituationJour, VehiculeTableau } from "@/domaine/tableau-bord";
import type { StatutVehicule } from "@/domaine/types";
import { SOLDE_INITIAL, demandesAchat, journalCaisse } from "./caisse-demo";
import { DATE_REFERENCE, fichesChauffeurs, listeChauffeurs } from "./chauffeurs-demo";
import { fichePourImmatriculation } from "./fiche-demo";
import { listeIncidents } from "./incidents-demo";
import { FLOTTE } from "./parc-demo";
import { coutMiseADisposition, coutPrestation, coutAffretement, prestationFaite } from "@/domaine/transporteurs";
import { affretements, misesADisposition, prestations } from "./transporteurs-demo";
import { bornesDuReleve, releveCouvre, tonnagesPar } from "@/domaine/releve-transport";
import { relevesTransport } from "./releve-demo";

/** Profondeur servie : deux ans, pour comparer une période à la précédente. */
const PROFONDEUR_MOIS = 24;

/** Seuil de réapprovisionnement de la caisse parc, repris de la maquette. */
const SEUIL_REAPPRO = 200_000;

/** Les statuts qui immobilisent : le véhicule est au parc, il ne roule pas. */
const IMMOBILISANTS: StatutVehicule[] = ["en-reparation", "en-restauration", "hors-service"];

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

/**
 * L'état d'un document à une date passée. Un document dont la date d'effet est
 * postérieure au mois observé ne dit rien de ce mois-là : la fiche ne porte que
 * les pièces courantes, pas leur historique, et le renouvellement de 2026 ne
 * prouve pas qu'il manquait en 2025. On ne juge donc le passé que sur les
 * échéances dépassées ; au branchement, l'historique des documents rendra la
 * lecture complète.
 */
function etatALaDate(d: { dateEffet: string | null; echeance: string | null }, date: string): EtatDocument {
  if (!d.echeance) return "permanent";
  if (d.dateEffet && d.dateEffet > date) return "a-jour";
  return d.echeance < date ? "echu" : "a-jour";
}

export interface Alerte {
  immatriculation: string;
  immatriculationAffichee: string;
  libelle: string;
  /** « échue de 12 j », « dans 8 j », « 32 j au garage ». */
  echeance: string;
  niveau: "critique" | "vigilance";
  href: string;
}

/** Les tonnes d'un mois, prises au relevé de transport. */
function tonnesDuMois(mois: string): { interne: number; externe: number } {
  const lignes = relevesTransport().filter((l) => l.date.slice(0, 7) === mois);
  const t = tonnagesPar(lignes);
  return { interne: t.interne, externe: t.externe };
}

export interface DonneesTableau {
  mois: string[];
  /** Les mêmes faits, bornés aux sept derniers jours — la période « Semaine » de la maquette. */
  semaine: FaitsVehiculeMois[];
  flotteSemaine: FaitsFlotteMois[];
  vehicules: VehiculeTableau[];
  faits: FaitsVehiculeMois[];
  flotte: FaitsFlotteMois[];
  jour: SituationJour;
  /** Ce qui appelle une action aujourd'hui — bloc « Alertes du jour » de la maquette. */
  alertes: Alerte[];
}

let CACHE: DonneesTableau | null = null;

export function donneesTableau(): DonneesTableau {
  if (CACHE) return CACHE;

  const [a, m] = DATE_REFERENCE.split("-").map(Number);
  const mois: string[] = [];
  for (let k = PROFONDEUR_MOIS - 1; k >= 0; k--) mois.push(new Date(Date.UTC(a!, m! - 1 - k, 1)).toISOString().slice(0, 7));

  const finDe = (x: string) => (dernierJour(x) > DATE_REFERENCE ? DATE_REFERENCE : dernierJour(x));
  const joursDuMois = new Map(mois.map((x) => [x, joursEntre(`${x}-01`, finDe(x))]));

  /* La semaine se calcule à part : les faits sont mensuels, et une semaine ne
     se découpe pas dans un mois. Sept jours glissants, bornés à aujourd hui. */
  const debutSemaine = new Date(Date.parse(DATE_REFERENCE) - 6 * 86_400_000).toISOString().slice(0, 10);
  const joursSemaine = joursEntre(debutSemaine, DATE_REFERENCE);

  const incidents = listeIncidents();
  const vehicules: VehiculeTableau[] = [];
  const faits: FaitsVehiculeMois[] = [];
  const semaine: FaitsVehiculeMois[] = [];
  const alertes: Alerte[] = [];
  let vehiculesSpeciaux = 0;
  let vehiculesSpeciauxConformes = 0;
  let pretsACharger = 0;
  let engagesJour = 0;

  const chauffeurs = new Map(listeChauffeurs().map((c) => [c.id, c]));

  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation);
    if (!f) continue;
    const v = l.vehicule;
    const profil = { categorie: v.categorie, transportSpecial: v.transportSpecial, statut: v.statut };
    vehicules.push({
      id: v.id,
      immatriculation: v.immatriculation,
      immatriculationAffichee: v.immatriculationAffichee,
      libelle: `${v.marque} ${v.appellation}`,
      categorie: v.categorie,
      categorieFlotte: v.categorieFlotte,
      businessUnit: v.businessUnit,
      site: l.site?.libelle ?? null,
    });

    const incidentsDuVehicule = incidents.filter((i) => i.vehiculeId === v.id);
    /* L'échéance du plan d'entretien : dépassée quand il ne reste plus de
       kilomètres avant la prochaine. La fiche ne donne que l'échéance courante,
       donc la lecture ne vaut que pour la période en cours : les mois passés
       sortent nuls, comme en base. */
    const entretienEnRetard = (f.prochaineIntervention?.kmRestants ?? 1) < 0;

    for (const x of mois) {
      const debutMois = `${x}-01`;
      if (debutMois > DATE_REFERENCE) continue;
      const finMois = finDe(x);
      const jours = joursDuMois.get(x) ?? 0;

      let joursImmobilises = 0;
      for (const p of f.periodesStatut) {
        if (!IMMOBILISANTS.includes(p.statut)) continue;
        joursImmobilises += joursDans(p.debut, p.fin, debutMois, finMois);
      }

      const documents = f.documents.map((d) => ({ type: d.type, etat: etatALaDate(d, finMois) }));
      const nonConforme = immobilisationAdministrative(profil, documents) !== null;

      const duMois = <T extends { date: string }>(liste: T[]) => liste.filter((y) => y.date.slice(0, 7) === x);
      const interventions = duMois(f.interventions);
      const depenses = duMois(f.depenses).filter((d) => d.poste !== "amortissement" && d.poste !== "salaire");
      const carburant = f.carburant.find((y) => y.mois === x);
      const incidentsMois = incidentsDuVehicule.filter((i) => i.dateHeure.slice(0, 7) === x);
      const contraventions = depenses.filter((d) => d.poste === "contravention");

      const cout = depenses.reduce((s, d) => s + d.montant, 0);
      const km = carburant?.kmParcourus ?? 0;

      faits.push({
        vehiculeId: v.id,
        mois: x,
        jours,
        engage: v.engage,
        transportSpecial: v.transportSpecial,
        km,
        litres: carburant?.litres ?? 0,
        litresReference: (km * f.referenceL100) / 100,
        joursImmobilises: Math.min(joursImmobilises, jours),
        nonConforme,
        entretienEnRetard: finMois < DATE_REFERENCE ? null : entretienEnRetard,
        accidents: incidentsMois.filter((i) => i.nature === "accident").length,
        accidentsCorporels: incidentsMois.filter((i) => i.nature === "accident" && i.blesses).length,
        pannesEnMission: incidentsMois.filter((i) => i.nature === "incident" && i.mission !== null && i.mission !== "hors-mission").length,
        avariesChargement: incidentsMois.filter((i) => i.type === "avarie-chargement").length,
        contraventions: contraventions.length,
        montantContraventions: contraventions.reduce((s, d) => s + d.montant, 0),
        interventionsPreventives: interventions.filter((i) => i.type === "preventif").length,
        interventionsCuratives: interventions.filter((i) => i.type === "curatif").length,
        immobilisationInterventions: interventions.reduce((s, i) => s + (i.immobilisationJours ?? 0), 0),
        nombreInterventions: interventions.filter((i) => i.immobilisationJours !== null).length,
        curativesSansDuree: interventions.filter((i) => i.type === "curatif" && i.immobilisationJours === null).length,
        immobilisationsSansDebut: 0,
        cout,
        coutMaintenance: depenses.filter((d) => groupeDuPoste(d.poste) === "maintenance").reduce((s, d) => s + d.montant, 0),
        coutCuratif: depenses.filter((d) => d.poste === "maintenance-curative").reduce((s, d) => s + d.montant, 0),
      });

    }

    /* ---- Les sept derniers jours ---- */
    {
      const dans = <T extends { date: string }>(liste: T[]) => liste.filter((y) => y.date >= debutSemaine && y.date <= DATE_REFERENCE);
      const interventions = dans(f.interventions);
      const depenses = dans(f.depenses).filter((d) => d.poste !== "amortissement" && d.poste !== "salaire");
      const incidentsSemaine = incidentsDuVehicule.filter((i) => i.dateHeure.slice(0, 10) >= debutSemaine);
      const contraventions = depenses.filter((d) => d.poste === "contravention");
      let immobilises = 0;
      for (const p of f.periodesStatut) {
        if (!IMMOBILISANTS.includes(p.statut)) continue;
        immobilises += joursDans(p.debut, p.fin, debutSemaine, DATE_REFERENCE);
      }
      /* Les kilomètres de la semaine se déduisent du mois au prorata : la
         consommation est mensuelle, la fiche ne dit pas le détail des jours. */
      const moisCourant = DATE_REFERENCE.slice(0, 7);
      const carburant = f.carburant.find((y) => y.mois === moisCourant);
      const joursDuMoisCourant = joursDuMois.get(moisCourant) ?? 1;
      const part = Math.min(1, joursSemaine / Math.max(1, joursDuMoisCourant));
      const km = Math.round((carburant?.kmParcourus ?? 0) * part);
      semaine.push({
        vehiculeId: v.id,
        mois: "semaine",
        jours: joursSemaine,
        engage: v.engage,
        transportSpecial: v.transportSpecial,
        km,
        litres: Math.round((carburant?.litres ?? 0) * part),
        litresReference: (km * f.referenceL100) / 100,
        joursImmobilises: Math.min(immobilises, joursSemaine),
        nonConforme: (f.immobilisationAdministrative ?? null) !== null,
        entretienEnRetard,
        accidents: incidentsSemaine.filter((i) => i.nature === "accident").length,
        accidentsCorporels: incidentsSemaine.filter((i) => i.nature === "accident" && i.blesses).length,
        pannesEnMission: incidentsSemaine.filter((i) => i.nature === "incident" && i.mission !== null && i.mission !== "hors-mission").length,
        avariesChargement: incidentsSemaine.filter((i) => i.type === "avarie-chargement").length,
        contraventions: contraventions.length,
        montantContraventions: contraventions.reduce((s, d) => s + d.montant, 0),
        interventionsPreventives: interventions.filter((i) => i.type === "preventif").length,
        interventionsCuratives: interventions.filter((i) => i.type === "curatif").length,
        immobilisationInterventions: interventions.reduce((s, i) => s + (i.immobilisationJours ?? 0), 0),
        nombreInterventions: interventions.filter((i) => i.immobilisationJours !== null).length,
        curativesSansDuree: interventions.filter((i) => i.type === "curatif" && i.immobilisationJours === null).length,
        immobilisationsSansDebut: 0,
        cout: depenses.reduce((s, d) => s + d.montant, 0),
        coutMaintenance: depenses.filter((d) => groupeDuPoste(d.poste) === "maintenance").reduce((s, d) => s + d.montant, 0),
        coutCuratif: depenses.filter((d) => d.poste === "maintenance-curative").reduce((s, d) => s + d.montant, 0),
      });
    }

    /* ---- La situation du jour ---- */
    const immobilisation = f.immobilisationAdministrative ?? null;
    const statutEffectif = immobilisation?.statut ?? v.statut;
    if (v.engage) {
      engagesJour += 1;
      const conducteur = conducteurDuJour(f.affectations, chauffeurs, DATE_REFERENCE);
      const { etat } = etatDisponibilite({ engage: v.engage, statutEffectif, conducteur, immobilisation });
      if (etat === "pret") pretsACharger += 1;
    }
    if (v.transportSpecial) {
      vehiculesSpeciaux += 1;
      /* Un véhicule de transport spécial est conforme si son certificat de
         salubrité est en cours de validité — c'est ce que le Service d'hygiène
         contrôle. */
      const salubrite = f.documents.find((d) => d.type === "certificat-salubrite");
      if (salubrite && salubrite.etat !== "echu" && salubrite.etat !== "manquant") vehiculesSpeciauxConformes += 1;
    }

    /* ---- Les alertes du jour ---- */
    for (const d of f.documents) {
      if (d.joursRestants === null) continue;
      if (d.joursRestants < 0) {
        alertes.push({
          immatriculation: v.immatriculation,
          immatriculationAffichee: v.immatriculationAffichee,
          libelle: `${TYPE_DOCUMENT[d.type]} échue`,
          echeance: `échue de ${Math.abs(d.joursRestants)} j`,
          niveau: "critique",
          href: `/flotte/${v.immatriculation}?onglet=conformite&ref=${d.numero}`,
        });
      } else if (d.joursRestants <= 30) {
        alertes.push({
          immatriculation: v.immatriculation,
          immatriculationAffichee: v.immatriculationAffichee,
          libelle: TYPE_DOCUMENT[d.type],
          echeance: `dans ${d.joursRestants} j`,
          niveau: "vigilance",
          href: `/flotte/${v.immatriculation}?onglet=conformite&ref=${d.numero}`,
        });
      }
    }
    /* Une immobilisation qui dure est une alerte en soi : le véhicule ne
       produit rien, et personne ne s'en émeut si rien ne le dit. */
    const ouverte = f.periodesStatut.find((p) => IMMOBILISANTS.includes(p.statut) && p.fin === null);
    if (ouverte) {
      const jours = joursEntre(ouverte.debut, DATE_REFERENCE);
      if (jours >= 21) {
        alertes.push({
          immatriculation: v.immatriculation,
          immatriculationAffichee: v.immatriculationAffichee,
          libelle: "Immobilisation prolongée",
          echeance: `${jours} j au garage`,
          niveau: jours >= 45 ? "critique" : "vigilance",
          href: `/flotte/${v.immatriculation}?onglet=journal`,
        });
      }
    }
  }

  /* ---- Les chauffeurs, mois par mois : l'absentéisme ----
     et le transport confié à des tiers, qui se lit au même niveau : il n'est
     porté par aucun véhicule du parc, mais il pèse sur le coût de transport. */
  const fiches = fichesChauffeurs();
  const tiers = affretements();
  type Tiers = { cout: number; tonnes: number; affretements: number; mad: number; prestations: number };
  const vide = (): Tiers => ({ cout: 0, tonnes: 0, affretements: 0, mad: 0, prestations: 0 });
  const tiersParMois = new Map<string, Tiers>();
  const ajouterAuMois = (mois: string, modele: "affretements" | "mad" | "prestations", cout: number, tonnes: number) => {
    const actuel = tiersParMois.get(mois) ?? vide();
    tiersParMois.set(mois, { ...actuel, cout: actuel.cout + cout, tonnes: actuel.tonnes + tonnes, [modele]: actuel[modele] + cout });
  };
  for (const a of tiers) ajouterAuMois(a.date.slice(0, 7), "affretements", coutAffretement(a), prestationFaite(a.statut) ? (a.tonnageLivre ?? a.tonnagePrevu) : 0);
  /*
   * Le transport tiers ne se résume pas à l'affrètement au voyage. La **mise à
   * disposition ADEX** — six véhicules à la journée, carburant SEDIMA compris —
   * et les **prestations hors grille** — œufs, farine, transport du personnel —
   * en font partie, et elles pèsent bien plus lourd. Les compter ensemble est
   * ce qui rend le taux d'externalisation crédible : sur les seuls
   * affrètements, il tombait à 6 %, ce que personne au métier n'aurait reconnu.
   */
  for (const m of misesADisposition()) ajouterAuMois(m.mois, "mad", coutMiseADisposition(m).total, m.tonnesTransportees ?? 0);
  /* Une prestation ne se compte pas en tonnes : ni le personnel des abattoirs
     ni un plateau d'œufs n'entrent dans un tonnage transporté. */
  for (const p of prestations()) ajouterAuMois(p.date.slice(0, 7), "prestations", coutPrestation(p), 0);
  const flotte: FaitsFlotteMois[] = mois.map((x) => {
    const debutMois = `${x}-01`;
    if (debutMois > DATE_REFERENCE)
      return { mois: x, joursIndisponibiliteChauffeurs: 0, joursChauffeurs: 0, coutTransportTiers: 0, coutAffretements: 0, coutMisesADisposition: 0, coutPrestations: 0, taxeTransportTiers: 0, tonnesTiers: null, tonnesInternes: null };
    const finMois = finDe(x);
    const jours = joursDuMois.get(x) ?? 0;
    let indisponibles = 0;
    let actifs = 0;
    for (const fiche of fiches) {
      if (!fiche.ligne.chauffeur.actif) continue;
      actifs += 1;
      for (const i of fiche.indisponibilites) indisponibles += joursDans(i.debut, i.fin, debutMois, finMois);
    }
    const brut = tiersParMois.get(x) ?? vide();
    /*
     * Le mois en cours est incomplet, et les trois modèles ne s'y comportent
     * pas de la même façon : un affrètement se date au jour, une **mise à
     * disposition se facture au mois entier**. Sans prorata, le 2 septembre
     * portait déjà trente jours de location contre deux jours de tonnage — et
     * le coût à la tonne des tiers ressortait à 67 725 F au lieu de 16 000.
     */
    const partDuMois = x === DATE_REFERENCE.slice(0, 7) ? (joursDuMois.get(x) ?? 0) / new Date(Date.UTC(Number(x.slice(0, 4)), Number(x.slice(5, 7)), 0)).getUTCDate() : 1;
    const mad = Math.round(brut.mad * partDuMois);
    const t = { ...brut, mad, cout: brut.cout - brut.mad + mad };
    return {
      mois: x,
      joursIndisponibiliteChauffeurs: indisponibles,
      joursChauffeurs: actifs * jours,
      coutTransportTiers: t.cout,
      coutAffretements: t.affretements,
      coutMisesADisposition: t.mad,
      coutPrestations: t.prestations,
      /* La démonstration ne porte pas de régime fiscal : ses coûts se lisent tels quels. */
      taxeTransportTiers: 0,
      /* Les tonnes viennent du **relevé de transport** : c'est lui qui porte
         les deux termes du taux d'externalisation, et c'est ce qui résout la
         question 71 — la base juste est la tonne, non le coût. */
      tonnesTiers: releveCouvre(bornesDuReleve(relevesTransport()), debutMois, finMois) ? tonnesDuMois(x).externe : null,
      tonnesInternes: releveCouvre(bornesDuReleve(relevesTransport()), debutMois, finMois) ? tonnesDuMois(x).interne : null,
    };
  });

  /* ---- Caisse et achats ---- */
  const soldeCaisse = journalCaisse().reduce((s, mv) => s + (mv.sens === "entree" ? mv.montant : -mv.montant), SOLDE_INITIAL);
  const demandes = demandesAchat();
  const reglees = demandes.filter((d) => d.dateReglement !== null);
  const engagementsEnCours = demandes
    .filter((d) => d.numeroBonCommande !== null && d.dateReglement === null && d.etape !== "refusee")
    .reduce((s, d) => s + (d.montantReel ?? d.montantEngage ?? d.montantEstime), 0);
  const cycleAchatJours = reglees.length
    ? Math.round(reglees.reduce((s, d) => s + (Date.parse(d.dateReglement!) - Date.parse(d.date)) / 86_400_000, 0) / reglees.length)
    : null;

  const dernierAccident = incidents
    .filter((i) => i.nature === "accident")
    .map((i) => i.dateHeure.slice(0, 10))
    .sort()
    .at(-1);

  const jour: SituationJour = {
    soldeCaisse,
    seuilReapprovisionnement: SEUIL_REAPPRO,
    pretsACharger,
    engages: engagesJour,
    joursSansAccident: dernierAccident ? Math.max(0, joursEntre(dernierAccident, DATE_REFERENCE) - 1) : null,
    engagementsEnCours,
    cycleAchatJours,
    vehiculesSpeciaux,
    vehiculesSpeciauxConformes,
  };

  /* Les alertes les plus urgentes d'abord : les échues avant celles qui arrivent. */
  alertes.sort((x, y) => (x.niveau === y.niveau ? 0 : x.niveau === "critique" ? -1 : 1));

  /* L absentéisme de la semaine, sur la même borne. */
  const flotteSemaine: FaitsFlotteMois[] = [
    (() => {
      let indisponibles = 0;
      let actifs = 0;
      for (const fiche of fiches) {
        if (!fiche.ligne.chauffeur.actif) continue;
        actifs += 1;
        for (const i of fiche.indisponibilites) indisponibles += joursDans(i.debut, i.fin, debutSemaine, DATE_REFERENCE);
      }
      /* Sur sept jours glissants, l'affrètement se compte à la date de mission.
         La mise à disposition, elle, se facture au mois : on la ramène au prorata
         des jours, sans quoi une semaine porterait un mois entier de location. */
      const tiersSemaine = tiers.filter((a) => a.date >= debutSemaine && a.date <= DATE_REFERENCE);
      const moisCourant = DATE_REFERENCE.slice(0, 7);
      const prorata = misesADisposition()
        .filter((m) => m.mois === moisCourant)
        .reduce((s, m) => s + (coutMiseADisposition(m).total * joursSemaine) / m.joursCalendaires, 0);
      const prestationsSemaine = prestations().filter((p) => p.date >= debutSemaine && p.date <= DATE_REFERENCE);
      /* Les tonnes de la semaine se prennent au relevé, qui les porte au jour :
         aucun prorata à faire, contrairement au coût des mises à disposition. */
      const tonnesDeLaSemaine = tonnagesPar(relevesTransport().filter((l) => l.date >= debutSemaine && l.date <= DATE_REFERENCE));
      return {
        mois: "semaine",
        joursIndisponibiliteChauffeurs: indisponibles,
        joursChauffeurs: actifs * joursSemaine,
        coutTransportTiers:
          tiersSemaine.reduce((s, a) => s + coutAffretement(a), 0) + Math.round(prorata) + prestationsSemaine.reduce((s, p) => s + coutPrestation(p), 0),
        coutAffretements: tiersSemaine.reduce((s, a) => s + coutAffretement(a), 0),
        coutMisesADisposition: Math.round(prorata),
        coutPrestations: prestationsSemaine.reduce((s, p) => s + coutPrestation(p), 0),
        taxeTransportTiers: 0,
        tonnesTiers: releveCouvre(bornesDuReleve(relevesTransport()), debutSemaine, DATE_REFERENCE) ? tonnesDeLaSemaine.externe : null,
        tonnesInternes: releveCouvre(bornesDuReleve(relevesTransport()), debutSemaine, DATE_REFERENCE) ? tonnesDeLaSemaine.interne : null,
      };
    })(),
  ];

  CACHE = { mois, semaine, flotteSemaine, vehicules, faits, flotte, jour, alertes: alertes.slice(0, 8) };
  return CACHE;
}

export { DATE_REFERENCE };

/* ============================================================================
 * Maintenance — données de démonstration.
 *
 * Une seule vérité : le travail à faire se déduit des fiches véhicules (plan
 * d'entretien, observations de visite, périodes de statut) et des déclarations
 * d'incident ; les interventions sont celles des fiches. Seuls les ordres de
 * travail sont propres au module, et ils citent ce qui les motive.
 * ==========================================================================*/

import { estEnCours } from "@/domaine/incidents";
import { MOTIF_IMMOBILISATION, STATUT_VEHICULE, TYPE_INCIDENT } from "@/domaine/libelles";
import { estOuvert, urgenceEcheance, type LigneInterventionFlotte, type LigneOrdre, type LigneTravail } from "@/domaine/maintenance";
import { appelleUneAction, libelleEcheance } from "@/domaine/entretien";
import { formerNumero } from "@/domaine/reference";
import type { LigneFlotte } from "@/domaine/types";
import { date as formaterDate } from "@/lib/format";
import { GARAGES, fichePourImmatriculation, graine } from "./fiche-demo";
import { listeIncidents } from "./incidents-demo";
import { FLOTTE } from "./parc-demo";

/** Date de référence du jeu de démonstration, comme dans les autres modules. */
const AUJOURDHUI = "2026-09-02";

function decaler(iso: string, jours: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

function joursEntre(debut: string, fin: string): number {
  return Math.max(0, Math.round((new Date(`${fin}T00:00:00Z`).getTime() - new Date(`${debut}T00:00:00Z`).getTime()) / 86_400_000));
}

/** Ce qu'une ligne du module dit du véhicule qui la porte. */
function porteur(l: LigneFlotte) {
  return {
    vehiculeId: l.vehicule.id,
    immatriculation: l.vehicule.immatriculation,
    immatriculationAffichee: l.vehicule.immatriculationAffichee,
    vehicule: `${l.vehicule.marque} ${l.vehicule.appellation}`,
    businessUnit: l.vehicule.businessUnit,
    site: l.site?.libelle ?? null,
  };
}

/* -- Interventions ------------------------------------------------------------- */

let CACHE_INTERVENTIONS: LigneInterventionFlotte[] | null = null;

export function interventionsFlotte(): LigneInterventionFlotte[] {
  if (CACHE_INTERVENTIONS) return CACHE_INTERVENTIONS;
  const lignes: LigneInterventionFlotte[] = [];
  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation);
    if (!f) continue;
    for (const i of f.interventions) lignes.push({ ...i, ...porteur(l), creee: false });
  }
  lignes.sort((a, b) => b.date.localeCompare(a.date));
  CACHE_INTERVENTIONS = lignes;
  return lignes;
}

/* -- Ordres de travail ---------------------------------------------------------- */

let CACHE_ORDRES: LigneOrdre[] | null = null;

/**
 * Huit ordres environ, à tous les stades : les échéances les plus proches sont
 * planifiées, les observations en cours de correction ont leur ordre clos sur
 * l'intervention qui les a corrigées, un véhicule en réparation est en atelier,
 * et un doublon a été annulé.
 */
export function ordresDeTravail(): LigneOrdre[] {
  if (CACHE_ORDRES) return CACHE_ORDRES;
  const bruts: Omit<LigneOrdre, "numero">[] = [];

  const fiches = FLOTTE.map((l) => ({ l, f: fichePourImmatriculation(l.vehicule.immatriculation)! })).filter((x) => x.f);

  /* Les échéances les plus pressantes : trois ordres planifiés. */
  const pressantes = fiches
    .filter(({ f }) => f.prochaineIntervention && urgenceEcheance(f.prochaineIntervention.kmRestants, f.prochaineIntervention.joursEstimes) !== "a-venir")
    .sort((a, b) => a.f.prochaineIntervention!.kmRestants - b.f.prochaineIntervention!.kmRestants)
    .slice(0, 3);
  for (const { l, f } of pressantes) {
    const alea = graine(`otr-${l.vehicule.immatriculation}`);
    const lourd = ["camion", "tracteur", "semi-remorque"].includes(l.vehicule.categorie);
    bruts.push({
      ...porteur(l),
      type: "preventif",
      objet: f.prochaineIntervention!.libelle,
      origineNumero: null,
      origineLibelle: "Plan d'entretien",
      garage: GARAGES[Math.round(alea() * (GARAGES.length - 1))]!,
      datePrevue: decaler(AUJOURDHUI, 2 + Math.round(alea() * 7)),
      immobilisationPrevueJours: 1,
      montantEstime: (lourd ? 180 + Math.round(alea() * 24) * 10 : 95 + Math.round(alea() * 5) * 10) * 1000,
      statut: "planifie",
      dateDebut: null,
      dateCloture: null,
      interventionNumero: null,
      commentaire: null,
      demandeur: "Responsable maintenance",
      creee: false,
    });
  }

  /* Les observations en cours de correction : leur ordre est clos sur l'intervention. */
  for (const { l, f } of fiches) {
    for (const o of f.observationsVisite.filter((x) => x.statut === "en-cours" && x.interventionNumero)) {
      const i = f.interventions.find((x) => x.numero === o.interventionNumero);
      if (!i) continue;
      bruts.push({
        ...porteur(l),
        type: "curatif",
        objet: o.libelle,
        origineNumero: o.numero,
        origineLibelle: `Observation · ${o.libelle}`,
        garage: i.garage,
        datePrevue: decaler(i.date, -2),
        immobilisationPrevueJours: i.immobilisationJours,
        montantEstime: Math.round(i.montant / 5_000) * 5_000,
        statut: "clos",
        dateDebut: i.date,
        dateCloture: decaler(i.date, Math.max(0, (i.immobilisationJours ?? 0) - 1)),
        interventionNumero: i.numero,
        commentaire: "Corrigée avant la contre-visite.",
        demandeur: "Responsable maintenance",
        creee: false,
      });
    }
  }

  /* Un véhicule en réparation : ordre en atelier. */
  const enReparation = fiches.find(({ l }) => l.vehicule.statut === "en-reparation");
  if (enReparation) {
    const { l, f } = enReparation;
    const periode = f.periodesStatut.find((p) => p.fin === null && p.statut === "en-reparation");
    const debut = periode?.debut ?? decaler(AUJOURDHUI, -3);
    bruts.push({
      ...porteur(l),
      type: "curatif",
      objet: `Réparation — ${periode?.motif ? MOTIF_IMMOBILISATION[periode.motif].toLowerCase() : "panne"}`,
      origineNumero: null,
      origineLibelle: "Période de statut « en réparation »",
      garage: "Garage SEDIMA",
      datePrevue: debut,
      immobilisationPrevueJours: 5,
      montantEstime: 650_000,
      statut: "en-atelier",
      dateDebut: debut,
      dateCloture: null,
      interventionNumero: null,
      commentaire: null,
      demandeur: "Gestionnaire de parc",
      creee: false,
    });
  }

  /* Un doublon annulé : le même entretien avait déjà été fait. */
  const recente = fiches.find(({ f }) => f.interventions.some((i) => i.type === "preventif" && i.date > decaler(AUJOURDHUI, -30)));
  if (recente) {
    const i = recente.f.interventions.find((x) => x.type === "preventif" && x.date > decaler(AUJOURDHUI, -30))!;
    bruts.push({
      ...porteur(recente.l),
      type: "preventif",
      objet: i.objet,
      origineNumero: null,
      origineLibelle: "Plan d'entretien",
      garage: i.garage,
      datePrevue: decaler(i.date, 6),
      immobilisationPrevueJours: 1,
      montantEstime: i.montant,
      statut: "annule",
      dateDebut: null,
      dateCloture: decaler(i.date, 2),
      interventionNumero: null,
      commentaire: `Doublon : entretien déjà réalisé le ${formaterDate(i.date)} (${i.numero}).`,
      demandeur: "Responsable maintenance",
      creee: false,
    });
  }

  bruts.sort((a, b) => a.datePrevue.localeCompare(b.datePrevue));
  const sequences = new Map<string, number>();
  const ordres: LigneOrdre[] = bruts.map((o) => {
    const annee = o.datePrevue.slice(0, 4);
    const suivant = (sequences.get(annee) ?? 0) + 1;
    sequences.set(annee, suivant);
    return { ...o, numero: formerNumero("ordre", o.datePrevue, suivant) };
  });
  ordres.sort((a, b) => b.datePrevue.localeCompare(a.datePrevue));
  CACHE_ORDRES = ordres;
  return ordres;
}

/* -- Ce qui reste à faire ------------------------------------------------------- */

let CACHE_TRAVAUX: LigneTravail[] | null = null;

/**
 * Le tableau de l'atelier. Une ligne par chose à faire, du plus urgent au plus
 * lointain ; quand un ordre de travail est déjà ouvert pour elle, la ligne le dit
 * et passe « en cours » plutôt que de réclamer une planification.
 */
export function travauxAFaire(): LigneTravail[] {
  if (CACHE_TRAVAUX) return CACHE_TRAVAUX;
  const ordres = ordresDeTravail().filter((o) => estOuvert(o.statut));
  const ordrePour = (vehiculeId: string, origineNumero: string | null, type: "preventif" | "curatif") =>
    ordres.find((o) => o.vehiculeId === vehiculeId && (origineNumero ? o.origineNumero === origineNumero : o.origineNumero === null && o.type === type))?.numero ?? null;

  const lignes: LigneTravail[] = [];
  const incidentsNonRoulants = listeIncidents().filter((i) => i.roulant !== "oui" && estEnCours(i.statut));
  const vehiculesAvecIncident = new Set(incidentsNonRoulants.map((i) => i.vehiculeId));

  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation);
    if (!f) continue;
    const p = porteur(l);

    /*
     * Le travail préventif vient du **plan d'entretien**, opération par
     * opération. Il n'y avait auparavant qu'une ligne par véhicule — la
     * prochaine échéance —, ce qui masquait le reste : un camion peut devoir
     * une vidange *et* un contrôle de freinage, et l'atelier a besoin de voir
     * les deux pour les grouper sur un même passage.
     *
     * Seules les échéances qui appellent une action entrent ici. Celles qu'aucun
     * passage ne référence restent sur la fiche : ce sont des trous
     * d'historique, pas du travail à programmer.
     */
    for (const e of f.planEntretien.echeances.filter(appelleUneAction)) {
      const ordreNumero = ordrePour(l.vehicule.id, null, "preventif");
      lignes.push({
        cle: `echeance:${l.vehicule.id}:${e.code}`,
        nature: "echeance",
        urgence: ordreNumero ? "en-cours" : e.etat === "en-retard" ? "en-retard" : "a-planifier",
        type: "preventif",
        ...p,
        objet: e.libelle,
        origineNumero: null,
        echeance: libelleEcheance(e).toLowerCase(),
        kmRestants: e.kmRestants,
        joursRestants: e.joursRestants,
        ordreNumero,
      });
    }

    const limite = f.visitesTechniques.find((v) => v.statut === "refusee" && v.dateLimiteContreVisite)?.dateLimiteContreVisite ?? null;
    for (const o of f.observationsVisite.filter((x) => x.statut !== "corrigee")) {
      const ordreNumero = ordrePour(l.vehicule.id, o.numero, "curatif");
      lignes.push({
        cle: `observation:${o.numero}`,
        nature: "observation",
        urgence: ordreNumero || o.interventionNumero ? "en-cours" : "a-planifier",
        type: "curatif",
        ...p,
        objet: o.libelle,
        origineNumero: o.numero,
        echeance: limite ? `contre-visite avant le ${formaterDate(limite)}` : "avant la contre-visite",
        kmRestants: null,
        joursRestants: limite ? joursEntre(AUJOURDHUI, limite) : null,
        ordreNumero,
      });
    }

    const statut = l.vehicule.statut;
    if ((statut === "en-reparation" || statut === "en-restauration") && !vehiculesAvecIncident.has(l.vehicule.id)) {
      const periode = f.periodesStatut.find((x) => x.fin === null) ?? null;
      const debut = periode?.debut ?? AUJOURDHUI;
      const ordreNumero = ordrePour(l.vehicule.id, null, "curatif");
      lignes.push({
        cle: `immobilisation:${l.vehicule.id}`,
        nature: "immobilisation",
        urgence: ordreNumero ? "en-cours" : "a-planifier",
        type: "curatif",
        ...p,
        objet: `${STATUT_VEHICULE[statut].libelle}${periode?.motif ? ` — ${MOTIF_IMMOBILISATION[periode.motif].toLowerCase()}` : ""}`,
        origineNumero: null,
        echeance: `depuis le ${formaterDate(debut)} · ${joursEntre(debut, AUJOURDHUI)} j`,
        kmRestants: null,
        joursRestants: null,
        ordreNumero,
      });
    }
  }

  for (const i of incidentsNonRoulants) {
    const l = FLOTTE.find((x) => x.vehicule.id === i.vehiculeId);
    if (!l) continue;
    const ordreNumero = ordrePour(l.vehicule.id, i.numero, "curatif");
    const jour = i.dateHeure.slice(0, 10);
    lignes.push({
      cle: `incident:${i.numero}`,
      nature: "incident",
      urgence: ordreNumero ? "en-cours" : "a-planifier",
      type: "curatif",
      ...porteur(l),
      objet: `Remise en état — ${TYPE_INCIDENT[i.type]}`,
      origineNumero: i.numero,
      echeance: `depuis le ${formaterDate(jour)} · ${joursEntre(jour, AUJOURDHUI)} j`,
      kmRestants: null,
      joursRestants: null,
      ordreNumero,
    });
  }

  const rang: Record<LigneTravail["urgence"], number> = { "en-retard": 0, "a-planifier": 1, "en-cours": 2, "a-venir": 3 };
  lignes.sort((a, b) => rang[a.urgence] - rang[b.urgence] || (a.kmRestants ?? 0) - (b.kmRestants ?? 0));
  CACHE_TRAVAUX = lignes;
  return lignes;
}

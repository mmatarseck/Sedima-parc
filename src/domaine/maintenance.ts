/* ============================================================================
 * Maintenance — le domaine du module (Lot 2, première brique).
 *
 * Trois objets, dans l'ordre où l'atelier les rencontre :
 *
 *  - le **travail à faire** : ce qui appelle une intervention sans qu'on l'ait
 *    encore planifiée — une échéance du plan d'entretien qui approche ou qui est
 *    dépassée, une observation de visite technique à corriger avant la
 *    contre-visite, un véhicule immobilisé, un incident qui a laissé le véhicule
 *    non roulant. Rien ne se saisit : tout se déduit des fiches ;
 *  - l'**ordre de travail** (numéro OTR) : la planification — véhicule, objet,
 *    garage, date prévue, immobilisation attendue — qui cite la transaction
 *    d'origine et se suit : planifié → en atelier → clos ;
 *  - l'**intervention** (numéro INT, déjà sur la fiche) : ce qui a été fait,
 *    quand, où, pour combien. La clôture d'un ordre la crée sur la fiche du
 *    véhicule, et l'ordre garde son numéro.
 *
 * Les seuils qui font passer une échéance « à planifier » sont des constantes
 * en attendant Paramètres.
 * ==========================================================================*/

import type { Intervention } from "./fiche";
import type { Ton } from "./libelles";
import type { BusinessUnit } from "./types";

/* -- Ce qui reste à faire -------------------------------------------------- */

export type NatureTravail = "echeance" | "observation" | "immobilisation" | "incident";

export const NATURE_TRAVAIL: Record<NatureTravail, string> = {
  echeance: "Échéance d'entretien",
  observation: "Observation de visite",
  immobilisation: "Véhicule immobilisé",
  incident: "Incident non roulant",
};

export type UrgenceTravail = "en-retard" | "a-planifier" | "a-venir" | "en-cours";

export const URGENCE_TRAVAIL: Record<UrgenceTravail, string> = {
  "en-retard": "En retard",
  "a-planifier": "À planifier",
  "a-venir": "À venir",
  "en-cours": "En cours",
};

export const PRECISION_URGENCE_TRAVAIL: Record<UrgenceTravail, string> = {
  "en-retard": "L'échéance est dépassée, le véhicule roule sans entretien",
  "a-planifier": "À programmer dans les prochains jours",
  "a-venir": "Rien à faire tout de suite",
  "en-cours": "Un ordre de travail est ouvert",
};

export const TON_URGENCE_TRAVAIL: Record<UrgenceTravail, Ton> = {
  "en-retard": "defavorable",
  "a-planifier": "vigilance",
  "a-venir": "neutre",
  "en-cours": "favorable",
};

export const COULEUR_URGENCE_TRAVAIL: Record<UrgenceTravail, string> = {
  "en-retard": "var(--color-defavorable)",
  "a-planifier": "var(--color-vigilance)",
  "a-venir": "var(--color-attenue-2)",
  "en-cours": "var(--color-accent)",
};

/** Sous ces seuils, une échéance du plan d'entretien passe « à planifier ». */
export const SEUIL_KM_PLANIFICATION = 1_500;
export const SEUIL_JOURS_PLANIFICATION = 21;

export function urgenceEcheance(kmRestants: number, joursEstimes: number): UrgenceTravail {
  if (kmRestants <= 0) return "en-retard";
  if (kmRestants <= SEUIL_KM_PLANIFICATION || joursEstimes <= SEUIL_JOURS_PLANIFICATION) return "a-planifier";
  return "a-venir";
}

export interface LigneTravail {
  /** Unique dans la liste : « echeance:AA032EA », « observation:OBS-2026-09001 ». */
  cle: string;
  nature: NatureTravail;
  urgence: UrgenceTravail;
  type: "preventif" | "curatif";
  vehiculeId: string;
  immatriculation: string;
  immatriculationAffichee: string;
  vehicule: string;
  businessUnit: BusinessUnit | null;
  site: string | null;
  objet: string;
  /** La transaction qui motive le travail — nulle pour une échéance du plan. */
  origineNumero: string | null;
  /** « dans 850 km · ≈ 12 j », « depuis le 12/08 · 21 j ». */
  echeance: string;
  kmRestants: number | null;
  joursRestants: number | null;
  /** L'ordre de travail déjà ouvert pour ce travail, s'il existe. */
  ordreNumero: string | null;
}

/* -- Ordres de travail ------------------------------------------------------- */

export type StatutOrdre = "planifie" | "en-atelier" | "clos" | "annule";

export const STATUT_ORDRE: Record<StatutOrdre, string> = {
  planifie: "Planifié",
  "en-atelier": "En atelier",
  clos: "Clos",
  annule: "Annulé",
};

export const PRECISION_STATUT_ORDRE: Record<StatutOrdre, string> = {
  planifie: "Rendez-vous pris, véhicule pas encore entré",
  "en-atelier": "Véhicule au garage, travaux en cours",
  clos: "Intervention réalisée et enregistrée sur la fiche",
  annule: "Sans suite, avec motif",
};

export const TON_STATUT_ORDRE: Record<StatutOrdre, Ton> = {
  planifie: "vigilance",
  "en-atelier": "neutre",
  clos: "favorable",
  annule: "neutre",
};

export const COULEUR_STATUT_ORDRE: Record<StatutOrdre, string> = {
  planifie: "var(--color-vigilance)",
  "en-atelier": "var(--color-accent)",
  clos: "var(--color-attenue-2)",
  annule: "var(--color-attenue-2)",
};

export interface LigneOrdre {
  numero: string;
  vehiculeId: string;
  immatriculation: string;
  immatriculationAffichee: string;
  vehicule: string;
  businessUnit: BusinessUnit | null;
  site: string | null;
  type: "preventif" | "curatif";
  objet: string;
  origineNumero: string | null;
  origineLibelle: string | null;
  garage: string;
  datePrevue: string;
  immobilisationPrevueJours: number | null;
  montantEstime: number | null;
  statut: StatutOrdre;
  dateDebut: string | null;
  dateCloture: string | null;
  /** L'intervention INT créée à la clôture. */
  interventionNumero: string | null;
  commentaire: string | null;
  demandeur: string;
  creee: boolean;
}

export function estOuvert(statut: StatutOrdre): boolean {
  return statut === "planifie" || statut === "en-atelier";
}

/** Un ordre planifié se démarre ; un ordre en atelier se clôt par l'intervention. */
export function actionSuivante(statut: StatutOrdre): "demarrer" | "cloturer" | null {
  if (statut === "planifie") return "demarrer";
  if (statut === "en-atelier") return "cloturer";
  return null;
}

/* -- Interventions, vues de toute la flotte ---------------------------------- */

export interface LigneInterventionFlotte extends Intervention {
  vehiculeId: string;
  immatriculation: string;
  immatriculationAffichee: string;
  vehicule: string;
  businessUnit: BusinessUnit | null;
  site: string | null;
  creee: boolean;
}

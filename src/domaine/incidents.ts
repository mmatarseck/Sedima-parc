/* ============================================================================
 * Incidents & sinistres — le domaine de la déclaration.
 *
 * Cadrage `docs/CADRAGE-INCIDENTS.md` : un accident ou un incident se déclare
 * en quatre étapes (faits, conséquences, tiers et responsabilité, suites), a
 * une référence INC, ouvre une période de statut, enregistre un relevé, et se
 * suit jusqu'à clôture. Ce fichier porte ce qui ne dépend d'aucun écran : les
 * typologies par nature, la ligne de liste, les tons, les règles de suite.
 * ==========================================================================*/

import type { Ton } from "./libelles";
import type { BusinessUnit, MissionIncident, NatureIncident, Responsabilite, StatutDeclaration, StatutVehicule, TypeIncident } from "./types";

/** Le cadrage §4 : la liste des types dépend de la nature. */
export const TYPES_PAR_NATURE: Record<NatureIncident, TypeIncident[]> = {
  incident: ["panne-mecanique", "panne-electrique", "crevaison", "surchauffe", "defaut-freinage", "avarie-chargement", "bris-de-glace", "vol-vandalisme", "immobilisation-administrative", "autre"],
  accident: ["collision-tiers", "collision-sans-tiers", "renversement", "accident-chargement", "accident-corporel", "incendie"],
};

export type Blesses = "aucun" | "sedima" | "tiers" | "les-deux";
export const BLESSES: Record<Blesses, string> = { aucun: "Aucun", sedima: "SEDIMA", tiers: "Tiers", "les-deux": "SEDIMA et tiers" };

export type Roulant = "oui" | "non" | "reserve";
export const ROULANT: Record<Roulant, string> = { oui: "Oui", non: "Non", reserve: "Avec réserve" };

export type SanctionSuite = "aucune" | "avertissement" | "blame";

export interface TiersIncident {
  nom: string;
  immatriculation: string;
  assureur: string;
  telephone: string;
}

/** Le statut proposé selon que le véhicule roule ou non (cadrage, étape 2). */
export function statutPropose(roulant: Roulant, courant: StatutVehicule): StatutVehicule {
  if (roulant === "non") return "en-reparation";
  return courant;
}

/** Le motif de la période de statut ouverte par une déclaration. */
export function motifDeclaration(nature: NatureIncident): "panne" | "sinistre" {
  return nature === "accident" ? "sinistre" : "panne";
}

/** Une déclaration en liste — la même ligne pour le module et pour l'onglet de la fiche. */
export interface LigneIncident {
  numero: string;
  vehiculeId: string;
  immatriculation: string;
  immatriculationAffichee: string;
  vehicule: string;
  businessUnit: BusinessUnit | null;
  site: string | null;
  nature: NatureIncident;
  type: TypeIncident;
  /** ISO, à la minute. */
  dateHeure: string;
  lieu: string;
  chauffeurId: string | null;
  chauffeur: string | null;
  mission: MissionIncident | null;
  roulant: Roulant;
  statut: StatutDeclaration;
  responsabilite: Responsabilite | null;
  blesses: boolean;
  sinistreOuvert: boolean;
  /** Somme des dépenses rattachées — jamais saisie ; nulle tant qu'aucune n'est rattachée. */
  cout: number | null;
  immobilisationJours: number | null;
  description: string;
  kilometrage: number | null;
  declarant: string;
  /** Créée dans l'application (pas dans le jeu de démonstration). */
  creee: boolean;
}

export const TON_STATUT_DECLARATION: Record<StatutDeclaration, Ton> = {
  declare: "vigilance",
  qualifie: "vigilance",
  "en-traitement": "neutre",
  clos: "favorable",
};

/** Couleur du filet de liste : ce qui attend une action ressort. */
export const COULEUR_DECLARATION: Record<StatutDeclaration, string> = {
  declare: "var(--color-defavorable)",
  qualifie: "var(--color-vigilance)",
  "en-traitement": "var(--color-accent)",
  clos: "var(--color-attenue-2)",
};

export const PRECISION_DECLARATION: Record<StatutDeclaration, string> = {
  declare: "Saisie, pas encore relue",
  qualifie: "Nature, type et responsabilité confirmés",
  "en-traitement": "Réparation ou dossier en cours",
  clos: "Véhicule revenu, coûts arrêtés",
};

export function estEnCours(statut: StatutDeclaration): boolean {
  return statut !== "clos";
}

/** Qui est prévenu à la validation (cadrage §3) : le parc, la maintenance, et la direction si blessé ou tiers. */
export function destinatairesDeclaration(nature: NatureIncident, blesses: boolean, avecTiers: boolean): string[] {
  const base = ["gestionnaire-parc", "responsable-maintenance"];
  return nature === "accident" && (blesses || avecTiers) ? [...base, "direction"] : base;
}

/* ============================================================================
 * Les rappels — la prochaine échéance de ce qui se renouvelle.
 *
 * Demande du métier du 16 septembre 2026. Jusque-là, la conformité se déduisait
 * des documents : l'échéance d'une assurance était celle du dernier scan
 * enregistré. C'était rigoureux et inutilisable — pour dire « l'assurance
 * expire en juin », il fallait enregistrer un document avec son émetteur et sa
 * pièce, alors que le métier sait la date avant d'avoir le papier.
 *
 * Le rappel porte l'échéance ; le document, quand il arrive, la prouve. Un
 * rappel par porteur et par type : renouveler avance l'échéance et note la date
 * du renouvellement, cela ne crée pas une ligne.
 *
 * Le type d'un rappel est un type de document (Paramètres › Documents) : c'est
 * là que sa validité et son porteur sont dits, et c'est là qu'on ajoute un
 * type de rappel nouveau — en cochant « donne lieu à un rappel ».
 * ==========================================================================*/

import type { DefinitionDocument } from "./parametres";
import type { TypeDocument } from "./types";

export type PorteurRappel = "vehicule" | "chauffeur";

export interface Rappel {
  id: string;
  numero: string;
  porteur: PorteurRappel;
  /** L'identifiant de table du véhicule, et sa plaque pour l'adresse de sa fiche. */
  vehiculeId: string | null;
  immatriculation: string | null;
  immatriculationAffichee: string | null;
  vehicule: string | null;
  /** L'identifiant de table du chauffeur, son nom, et l'adresse lisible de sa fiche. */
  chauffeurId: string | null;
  chauffeur: string | null;
  chauffeurAdresse: string | null;
  type: TypeDocument;
  libelle: string;
  /** La prochaine échéance, « AAAA-MM-JJ ». */
  echeance: string;
  /** Le dernier renouvellement constaté ; nul tant qu'aucun n'a été noté. */
  faitLe: string | null;
  /** Le document qui prouve le renouvellement, quand on l'a. */
  documentNumero: string | null;
  commentaire: string | null;
}

export type EtatRappel = "echu" | "bientot" | "a-jour";

export const ETAT_RAPPEL: Record<EtatRappel, { libelle: string; ton: "defavorable" | "vigilance" | "favorable" }> = {
  echu: { libelle: "Échu", ton: "defavorable" },
  bientot: { libelle: "Bientôt", ton: "vigilance" },
  "a-jour": { libelle: "À jour", ton: "favorable" },
};

/** Jours entre aujourd'hui et l'échéance ; négatif quand elle est passée. */
export function joursAvant(echeance: string, aujourdhui: string): number {
  return Math.round((Date.parse(`${echeance}T00:00:00Z`) - Date.parse(`${aujourdhui}T00:00:00Z`)) / 86_400_000);
}

/**
 * L'état d'un rappel un jour donné. « Bientôt » à trente jours : c'est le
 * délai que la Conformité emploie déjà pour les documents, et celui qu'il faut
 * pour prendre un rendez-vous de visite ou relancer un assureur.
 */
export function etatRappel(echeance: string, aujourdhui: string, seuilJours = 30): EtatRappel {
  const j = joursAvant(echeance, aujourdhui);
  if (j < 0) return "echu";
  if (j <= seuilJours) return "bientot";
  return "a-jour";
}

/**
 * La prochaine échéance que l'application propose après un renouvellement :
 * la date du renouvellement, plus la validité du type. Une proposition, que le
 * métier corrige — décision du 16 septembre 2026. Nulle quand le type n'a pas
 * de validité : on ne propose pas une date qu'on ne sait pas calculer.
 */
export function echeanceProposee(type: Pick<DefinitionDocument, "validiteMois">, faitLe: string): string | null {
  if (!type.validiteMois || !/^\d{4}-\d{2}-\d{2}$/.test(faitLe)) return null;
  const d = new Date(`${faitLe}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + type.validiteMois);
  return d.toISOString().slice(0, 10);
}

/** Les types qui donnent lieu à un rappel, pour un porteur : ce que le formulaire propose. */
export function typesRappel(types: DefinitionDocument[], porteur: PorteurRappel): DefinitionDocument[] {
  return types.filter((t) => t.rappel && t.porteur === porteur);
}

/** Du plus pressé au plus lointain — c'est l'ordre d'une liste de rappels. */
export function trierRappels<T extends { echeance: string }>(rappels: T[]): T[] {
  return [...rappels].sort((a, b) => a.echeance.localeCompare(b.echeance));
}

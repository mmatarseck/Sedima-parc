/* ============================================================================
 * Le signalement d'une panne ou d'une anomalie.
 *
 * Métier, 21 septembre 2026 : « déclarer des pannes, anomalies ou autres —
 * choisir le véhicule, mettre la date, le niveau de priorité, la description
 * du problème, le type, un champ pour plus de détails, et attacher des photos
 * ou documents ». Distinct de l'incident, qui porte l'assurance, les tiers et
 * la responsabilité : le signalement dit seulement « ceci est à réparer ».
 *
 * TROIS ÉTATS, DONT UN QUI NE S'ÉCRIT PAS. Ouvert, puis **pris en charge** dès
 * qu'un service ouvert l'inclut — cela se lit sur le service, sans écriture
 * de plus —, puis résolu à la clôture de ce service (la base le fait, 0060).
 * ==========================================================================*/

import type { Ton } from "./libelles";

export type PrioriteSignalement = "basse" | "normale" | "haute" | "critique";

export const PRIORITE_SIGNALEMENT: Record<PrioriteSignalement, { libelle: string; ton: Ton; rang: number }> = {
  critique: { libelle: "Critique", ton: "defavorable", rang: 0 },
  haute: { libelle: "Haute", ton: "defavorable", rang: 1 },
  normale: { libelle: "Normale", ton: "vigilance", rang: 2 },
  basse: { libelle: "Basse", ton: "neutre", rang: 3 },
};

export type StatutSignalementEcrit = "ouvert" | "resolu" | "annule";
export type EtatSignalement = "ouvert" | "pris-en-charge" | "resolu" | "annule";

export const ETAT_SIGNALEMENT: Record<EtatSignalement, { libelle: string; ton: Ton }> = {
  ouvert: { libelle: "Ouvert", ton: "defavorable" },
  "pris-en-charge": { libelle: "Pris en charge", ton: "vigilance" },
  resolu: { libelle: "Résolu", ton: "favorable" },
  annule: { libelle: "Annulé", ton: "neutre" },
};

export interface LigneSignalement {
  numero: string;
  /** L'immatriculation canonique : la clé des fiches. */
  vehiculeId: string;
  immatriculationAffichee: string;
  vehicule: string;
  date: string;
  priorite: PrioriteSignalement;
  systeme: string | null;
  description: string;
  details: string | null;
  kilometrage: number | null;
  pieces: string[];
  statut: StatutSignalementEcrit;
  resoluLe: string | null;
  serviceNumero: string | null;
  declarant: string | null;
  creee: boolean;
}

/** L'état lu : l'écrit, et « pris en charge » quand un service encore ouvert l'inclut. */
export function etatSignalement(s: Pick<LigneSignalement, "numero" | "statut">, services: { statut: string; signalements?: string[] }[]): EtatSignalement {
  if (s.statut !== "ouvert") return s.statut;
  const inclus = services.filter((o) => o.signalements?.includes(s.numero));
  if (inclus.some((o) => o.statut === "clos")) return "resolu";
  if (inclus.some((o) => o.statut === "planifie" || o.statut === "en-atelier")) return "pris-en-charge";
  return "ouvert";
}

/** Les signalements les plus pressants d'abord : priorité, puis ancienneté. */
export function trierSignalements<T extends Pick<LigneSignalement, "priorite" | "date">>(liste: T[]): T[] {
  return [...liste].sort((a, b) => PRIORITE_SIGNALEMENT[a.priorite].rang - PRIORITE_SIGNALEMENT[b.priorite].rang || a.date.localeCompare(b.date));
}

/* ============================================================================
 * Conformité — l'échéancier unique et ses règles d'alerte.
 *
 * Un document, une échéance, un niveau. Véhicules et chauffeurs sont lus
 * ensemble : la gestion de parc ne renouvelle pas « les assurances » puis « les
 * permis », elle traite ce qui échoit cette semaine. Les préavis sont ceux du
 * catalogue d'alertes du cadrage — J-60, J-30, J-7 — puis l'échéance dépassée.
 * ==========================================================================*/

import type { TypeDocument } from "./types";

export type NiveauEcheance = "echu" | "j7" | "j30" | "j60" | "ok" | "manquant" | "permanent";

export interface DefinitionNiveau {
  libelle: string;
  precision: string;
  ton: "defavorable" | "vigilance" | "favorable" | "neutre";
  couleur: string;
  /** Ordre de traitement : ce qui presse d'abord. */
  rang: number;
}

export const NIVEAU: Record<NiveauEcheance, DefinitionNiveau> = {
  manquant: { libelle: "Manquant", precision: "Document non enregistré — le véhicule ou le chauffeur n'est pas conforme", ton: "defavorable", couleur: "var(--color-statut-hors-service)", rang: 0 },
  echu: { libelle: "Échu", precision: "Échéance dépassée", ton: "defavorable", couleur: "var(--color-defavorable)", rang: 1 },
  j7: { libelle: "J-7", precision: "Échoit dans la semaine", ton: "defavorable", couleur: "var(--color-statut-restauration)", rang: 2 },
  j30: { libelle: "J-30", precision: "Échoit dans le mois", ton: "vigilance", couleur: "var(--color-statut-reparation)", rang: 3 },
  j60: { libelle: "J-60", precision: "Échoit dans les deux mois — à programmer", ton: "vigilance", couleur: "var(--color-statut-backup)", rang: 4 },
  ok: { libelle: "À jour", precision: "Plus de deux mois", ton: "favorable", couleur: "var(--color-statut-service)", rang: 5 },
  permanent: { libelle: "Permanent", precision: "Sans échéance", ton: "neutre", couleur: "var(--color-statut-retrait)", rang: 6 },
};

/** Les trois préavis du catalogue d'alertes, en jours. */
export const PREAVIS = { j60: 60, j30: 30, j7: 7 } as const;

export function niveauPour(joursRestants: number | null, manquant: boolean, permanent = false): NiveauEcheance {
  if (manquant) return "manquant";
  if (permanent || joursRestants === null) return "permanent";
  if (joursRestants < 0) return "echu";
  if (joursRestants <= PREAVIS.j7) return "j7";
  if (joursRestants <= PREAVIS.j30) return "j30";
  if (joursRestants <= PREAVIS.j60) return "j60";
  return "ok";
}

/** Ce qui demande une action : tout sauf « à jour » et « permanent ». */
export function estAlerte(n: NiveauEcheance): boolean {
  return n !== "ok" && n !== "permanent";
}

export type TypeEcheance = TypeDocument | "entretien" | "contre-visite" | "rendez-vous";

export interface Echeance {
  /** Clé unique de ligne. */
  cle: string;
  /** Numéro de la transaction qui la porte (document) — nul pour un entretien. */
  numero: string | null;
  sujet: "vehicule" | "chauffeur";
  sujetId: string;
  /** « AA 032 EA », « Babacar Ndiaye ». */
  sujetLibelle: string;
  /** « MITSUBISHI L200 SC · Dépôt Thiès », « Titulaire de AA 032 EA ». */
  sujetPrecision: string;
  sujetHref: string;
  type: TypeEcheance;
  libelle: string;
  numeroPiece: string | null;
  emetteur: string | null;
  echeance: string | null;
  joursRestants: number | null;
  niveau: NiveauEcheance;
  /** Pour un entretien : le repère kilométrique. */
  repere: string | null;
  site: string | null;
}

export interface CompteurNiveaux {
  manquant: number;
  echu: number;
  j7: number;
  j30: number;
  j60: number;
  ok: number;
  permanent: number;
}

export function compter(echeances: Echeance[]): CompteurNiveaux {
  const c: CompteurNiveaux = { manquant: 0, echu: 0, j7: 0, j30: 0, j60: 0, ok: 0, permanent: 0 };
  for (const e of echeances) c[e.niveau]++;
  return c;
}

/** Tri de l'échéancier : le niveau, puis la date, puis le sujet. */
export function trier(echeances: Echeance[]): Echeance[] {
  return [...echeances].sort((a, b) => NIVEAU[a.niveau].rang - NIVEAU[b.niveau].rang || (a.joursRestants ?? 1e9) - (b.joursRestants ?? 1e9) || a.sujetLibelle.localeCompare(b.sujetLibelle, "fr"));
}

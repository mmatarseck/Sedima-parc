/* ============================================================================
 * Le budget du parc — ce qu'on s'est donné, et ce qu'il en reste.
 *
 * Demande du métier du 4 septembre 2026 : « il faut prévoir le suivi de budget
 * à définir et à suivre avec les dépenses ». Dernière ligne du carnet.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * **Trois chiffres, pas deux.** C'est tout l'enjeu, et c'est ce qu'on oublie
 * partout où le suivi budgétaire se réduit à « budget contre dépensé » :
 *
 *   budget          ce qu'on s'est donné pour l'exercice ;
 *   **engagé**      ce qui est commandé et pas encore payé — le budget est
 *                   mangé **dès le bon de commande**, pas au règlement ;
 *   consommé        ce qui est sorti.
 *
 *   disponible = budget − engagé − consommé
 *
 * Sans l'engagé, on croit disposer de ce qui est déjà promis à un fournisseur,
 * et l'on redécouvre la dépense le jour de la facture. L'application connaît
 * déjà cet engagement : c'est le montant des demandes d'achat commandées et non
 * réglées, que la Caisse affiche sous « engagements en cours ».
 *
 * **Le rythme.** Un budget annuel ne dit rien en cours d'année : consommer 60 %
 * en août est bon si l'activité est linéaire, mauvais si la saison de l'aliment
 * est en septembre. Chaque enveloppe porte donc un **profil mensuel**, et
 * l'écart se mesure au **budget attendu à date**, non au budget total.
 * ==========================================================================*/

import type { Ton } from "./libelles";
import type { BusinessUnit, PosteDepense } from "./types";

/* -- L'enveloppe ----------------------------------------------------------------- */

/**
 * Une enveloppe budgétaire : un montant, pour un poste, une business unit et un
 * exercice.
 *
 * La maille poste × business unit est celle qui se défend en comité : le
 * carburant de l'Aliment ne se compense pas avec les pneumatiques de
 * l'Abattoir, même si les deux sortent du même parc. Une enveloppe sans
 * business unit vaut pour tout le parc — les assurances, par exemple, se
 * négocient en bloc.
 */
export interface Enveloppe {
  numero: string;
  /** L'année de l'exercice : « 2026 ». */
  exercice: string;
  poste: PosteDepense;
  /** Nulle quand l'enveloppe couvre tout le parc. */
  businessUnit: BusinessUnit | null;
  montant: number;
  /**
   * La saisonnalité, douze parts qui font 1. Une enveloppe sans profil se lit
   * au prorata des jours écoulés — c'est le défaut, et il est honnête tant que
   * personne n'a saisi de saisonnalité.
   */
  profil: number[] | null;
  /** Ce qui a servi à poser le montant : « réalisé 2025 + 8 % ». */
  base: string;
  commentaire: string | null;
}

/** Ce qu'une enveloppe devrait avoir consommé à une date donnée. */
export function attenduADate(e: Enveloppe, mois: number, jourDuMois: number, joursDuMois: number): number {
  if (!e.profil || e.profil.length !== 12) {
    /* Sans profil : au prorata du temps écoulé dans l'année. */
    const joursEcoules = moisEcoules(mois) + jourDuMois / joursDuMois;
    return Math.round((e.montant * joursEcoules) / 12);
  }
  const complets = e.profil.slice(0, mois - 1).reduce((s, p) => s + p, 0);
  const enCours = (e.profil[mois - 1] ?? 0) * (jourDuMois / joursDuMois);
  return Math.round(e.montant * (complets + enCours));
}

function moisEcoules(mois: number): number {
  return Math.max(0, mois - 1);
}

/* -- Le suivi ---------------------------------------------------------------------- */

export interface SuiviEnveloppe {
  enveloppe: Enveloppe;
  consomme: number;
  engage: number;
  /** budget − engagé − consommé : ce dont on dispose encore. */
  disponible: number;
  /** Ce qui aurait dû être consommé à date, profil compris. */
  attendu: number;
  /** consommé + engagé, rapporté au budget, en pourcentage. */
  tauxConsommation: number | null;
  /** L'écart au rythme attendu, en pourcentage du budget : le signal utile. */
  ecartRythmePct: number | null;
  etat: EtatBudget;
}

export type EtatBudget = "depasse" | "tendu" | "conforme" | "sous-consomme" | "sans-budget";

export const ETAT_BUDGET: Record<EtatBudget, { libelle: string; ton: Ton; precision: string }> = {
  depasse: { libelle: "Dépassé", ton: "defavorable", precision: "L'engagé et le consommé excèdent l'enveloppe de l'exercice" },
  tendu: { libelle: "Tendu", ton: "vigilance", precision: "En avance de plus de dix points sur le rythme attendu : l'enveloppe ne tiendra pas l'année" },
  conforme: { libelle: "Conforme", ton: "favorable", precision: "Au rythme prévu, à dix points près" },
  "sous-consomme": { libelle: "Sous-consommé", ton: "neutre", precision: "En retard de plus de vingt points : ou l'activité a baissé, ou des factures ne sont pas passées" },
  "sans-budget": { libelle: "Hors budget", ton: "vigilance", precision: "Des dépenses sans enveloppe : rien ne les encadre" },
};

/** Au-delà, on est en avance ou en retard sur le rythme de façon significative. */
export const SEUIL_TENDU_PCT = 10;
export const SEUIL_SOUS_CONSOMME_PCT = 20;

export function suivre(enveloppe: Enveloppe, consomme: number, engage: number, attendu: number): SuiviEnveloppe {
  const total = consomme + engage;
  const disponible = enveloppe.montant - total;
  const tauxConsommation = enveloppe.montant > 0 ? Math.round((total / enveloppe.montant) * 1000) / 10 : null;
  /* L'écart se mesure en points de budget, non en pourcentage du attendu : à
     un mois de l'exercice, une différence de quelques francs donnerait des
     centaines de pour cent et affolerait l'écran pour rien. */
  const ecartRythmePct = enveloppe.montant > 0 ? Math.round(((total - attendu) / enveloppe.montant) * 1000) / 10 : null;

  let etat: EtatBudget = "conforme";
  if (disponible < 0) etat = "depasse";
  else if (ecartRythmePct !== null && ecartRythmePct > SEUIL_TENDU_PCT) etat = "tendu";
  else if (ecartRythmePct !== null && ecartRythmePct < -SEUIL_SOUS_CONSOMME_PCT) etat = "sous-consomme";

  return { enveloppe, consomme, engage, disponible, attendu, tauxConsommation, ecartRythmePct, etat };
}

/* -- L'exercice, vu d'ensemble ------------------------------------------------------ */

export interface SyntheseBudget {
  budget: number;
  consomme: number;
  engage: number;
  disponible: number;
  attendu: number;
  /** Dépenses qu'aucune enveloppe ne couvre — le trou dans la raquette. */
  horsBudget: number;
  depassees: number;
  tendues: number;
}

export function synthetiser(suivis: SuiviEnveloppe[], horsBudget: number): SyntheseBudget {
  const budget = suivis.reduce((s, x) => s + x.enveloppe.montant, 0);
  const consomme = suivis.reduce((s, x) => s + x.consomme, 0);
  const engage = suivis.reduce((s, x) => s + x.engage, 0);
  return {
    budget,
    consomme,
    engage,
    disponible: budget - consomme - engage,
    attendu: suivis.reduce((s, x) => s + x.attendu, 0),
    horsBudget,
    depassees: suivis.filter((x) => x.etat === "depasse").length,
    tendues: suivis.filter((x) => x.etat === "tendu").length,
  };
}

/** Le profil d'une saisonnalité plate — douze mois égaux. */
export const PROFIL_PLAT: number[] = Array.from({ length: 12 }, () => 1 / 12);

/** Au-dessous, une enveloppe coûterait plus cher à tenir qu'elle ne rapporte de maîtrise. */
export const SEUIL_ENVELOPPE = 500_000;

/**
 * La saisonnalité de l'aliment : les enlèvements montent d'août à novembre,
 * retombent en saison des pluies. Elle vaut pour le carburant et les frais de
 * route, qui suivent l'activité ; pas pour l'assurance, qui se paie d'un coup.
 * C'est le profil qu'on prête à un poste sans enveloppe, ou à la synthèse d'un
 * poste : une enveloppe enregistrée porte le sien.
 */
const PROFIL_ACTIVITE = [0.075, 0.07, 0.075, 0.08, 0.085, 0.08, 0.075, 0.09, 0.095, 0.095, 0.095, 0.085];
const PROFIL_ASSURANCE = [0.5, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0];

export const PROFIL_PAR_POSTE: Partial<Record<PosteDepense, number[]>> = {
  carburant: PROFIL_ACTIVITE,
  "frais-de-route": PROFIL_ACTIVITE,
  peage: PROFIL_ACTIVITE,
  assurance: PROFIL_ASSURANCE,
};

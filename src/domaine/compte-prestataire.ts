/* ============================================================================
 * Le compte d'un prestataire — ce qu'on lui doit, ce qu'on lui a avancé, et ce
 * que valent ses services.
 *
 * Demande du métier du 4 septembre 2026 : « il faut voir les dettes
 * fournisseurs (travail effectué, paiement non encore effectif). Une avance
 * peut être payée aussi au fournisseur. L'évaluation d'un service par un
 * prestataire peut être effectuée et suivie, ce qui permettra de classer le
 * fournisseur — une pastille avec code couleur, plusieurs dimensions, quatre à
 * cinq niveaux, simple et clair. »
 *
 * ────────────────────────────────────────────────────────────────────────────
 * **La dette ne se saisit pas : elle se déduit.** C'était la première question
 * du cadrage, et elle décide de tout. L'application connaît déjà les demandes
 * d'achat commandées et non réglées, les interventions faites, les affrètements
 * livrés, les sorties de caisse. Une dette saisie à la main divergerait de ces
 * objets dès la première semaine ; une dette déduite est juste par
 * construction, et chaque ligne se remonte jusqu'au fait qui la produit.
 *
 * **L'avance, elle, est un fait nouveau** : un décaissement qui ne solde rien
 * encore. Elle doit donc s'enregistrer — et surtout **s'imputer** sur une
 * facture à venir, faute de quoi elle se perdrait et la dette serait fausse.
 * C'est le seul objet que ce module crée.
 * ==========================================================================*/

import type { Ton } from "./libelles";

/* -- Ce qu'on doit --------------------------------------------------------------- */

/** D'où vient la dette. Chaque origine renvoie à l'écran qui la porte. */
export type OrigineDette = "achat" | "intervention" | "affretement" | "mise-a-disposition" | "prestation" | "caisse";

export const ORIGINE_DETTE: Record<OrigineDette, { libelle: string; href: string }> = {
  achat: { libelle: "Demande d'achat", href: "/caisse?vue=achats" },
  intervention: { libelle: "Intervention", href: "/maintenance" },
  affretement: { libelle: "Affrètement", href: "/transporteurs?vue=affretements" },
  "mise-a-disposition": { libelle: "Mise à disposition", href: "/transporteurs?vue=mad" },
  prestation: { libelle: "Prestation", href: "/transporteurs?vue=prestations" },
  caisse: { libelle: "Sortie de caisse", href: "/caisse" },
};

export interface LigneDette {
  /** Le numéro de l'objet d'origine : c'est lui qu'on cite au fournisseur. */
  numero: string;
  origine: OrigineDette;
  date: string;
  objet: string;
  montant: number;
  /** Vrai quand la facture est reçue : la dette est alors exigible. */
  facture: boolean;
  /** Échéance déduite du délai de paiement convenu ; nulle sans délai. */
  echeance: string | null;
}

/** L'âge d'une dette décide du ton : on ne relance pas à quinze jours. */
export type AgeDette = "a-venir" | "echue" | "en-retard";

export const AGE_DETTE: Record<AgeDette, { libelle: string; ton: Ton; precision: string }> = {
  "a-venir": { libelle: "Dans les délais", ton: "favorable", precision: "L'échéance convenue n'est pas atteinte" },
  echue: { libelle: "Échue", ton: "vigilance", precision: "Le délai de paiement est dépassé, sans gravité encore" },
  "en-retard": { libelle: "En retard", ton: "defavorable", precision: "Plus de trente jours au-delà de l'échéance : le fournisseur va relancer" },
};

/** Au-delà, une dette échue devient un retard qu'il faut expliquer. */
export const JOURS_RETARD_DETTE = 30;

export function ageDette(echeance: string | null, aujourdhui: string): AgeDette {
  if (!echeance || echeance >= aujourdhui) return "a-venir";
  const jours = Math.round((Date.parse(aujourdhui) - Date.parse(echeance)) / 86_400_000);
  return jours > JOURS_RETARD_DETTE ? "en-retard" : "echue";
}

/* -- Ce qu'on a avancé ------------------------------------------------------------ */

/**
 * Une avance : un décaissement fait avant le service.
 *
 * Elle n'éteint aucune dette tant qu'elle n'est pas **imputée** sur une pièce
 * précise. Une avance qui reste ouverte des mois est un signal en soi : ou bien
 * le service n'a jamais été rendu, ou bien il l'a été et personne ne l'a
 * rapproché.
 */
export interface Avance {
  numero: string;
  prestataireNumero: string;
  date: string;
  montant: number;
  motif: string;
  /** La pièce sur laquelle l'avance a été imputée ; nulle tant qu'elle est ouverte. */
  imputeeSur: string | null;
  dateImputation: string | null;
  /** Qui a décidé — une avance engage la trésorerie du parc. */
  autorisePar: string;
}

export function avanceOuverte(a: Avance): boolean {
  return a.imputeeSur === null;
}

/** Le solde d'un prestataire : ce qu'on lui doit, moins ce qu'on lui a avancé. */
export interface SoldePrestataire {
  dette: number;
  avancesOuvertes: number;
  /** Positif : nous devons. Négatif : il nous doit un service. */
  net: number;
}

export function solde(dettes: LigneDette[], avances: Avance[]): SoldePrestataire {
  const dette = dettes.reduce((s, d) => s + d.montant, 0);
  const avancesOuvertes = avances.filter(avanceOuverte).reduce((s, a) => s + a.montant, 0);
  return { dette, avancesOuvertes, net: dette - avancesOuvertes };
}

/* -- Ce que vaut le service --------------------------------------------------------- */

/**
 * L'évaluation d'un service rendu.
 *
 * Contrairement à la notation des transporteurs, qui se calcule, celle-ci **se
 * saisit** — et c'est assumé : la qualité d'une réparation ne se déduit
 * d'aucune donnée. Elle est donc courte, faite au moment où l'on a l'avis frais
 * (à la réception du service), et sur trois critères seulement : au-delà,
 * personne ne remplit.
 */
export type CritereEvaluation = "qualite" | "delai" | "prix";

export const CRITERE_EVALUATION: Record<CritereEvaluation, { libelle: string; question: string }> = {
  qualite: { libelle: "Qualité", question: "Le travail a-t-il été bien fait ? A-t-il fallu y revenir ?" },
  delai: { libelle: "Délai", question: "Le service a-t-il été rendu dans le temps annoncé ?" },
  prix: { libelle: "Prix", question: "Le prix facturé correspond-il à ce qui était annoncé ?" },
};

export const CRITERES: CritereEvaluation[] = ["qualite", "delai", "prix"];

export interface Evaluation {
  numero: string;
  prestataireNumero: string;
  date: string;
  /** La pièce évaluée : une intervention, un affrètement, une demande d'achat. */
  pieceNumero: string;
  pieceLibelle: string;
  /** Une note de 1 à 5 par critère. */
  notes: Record<CritereEvaluation, number>;
  commentaire: string | null;
  auteur: string;
}

/** La moyenne d'une évaluation, sur cinq. */
export function moyenneEvaluation(e: Evaluation): number {
  return Math.round((CRITERES.reduce((s, c) => s + e.notes[c], 0) / CRITERES.length) * 10) / 10;
}

/* -- La notation d'un prestataire --------------------------------------------------- */

export type NiveauPrestataire = "excellent" | "bon" | "acceptable" | "fragile" | "insuffisant";

export const NIVEAU_PRESTATAIRE: Record<NiveauPrestataire, { libelle: string; seuil: number; couleur: string; ton: Ton; precision: string }> = {
  excellent: { libelle: "Excellent", seuil: 85, couleur: "var(--color-accent-tres-fonce)", ton: "favorable", precision: "Rien à redire, et l'historique le confirme" },
  bon: { libelle: "Bon", seuil: 70, couleur: "var(--color-accent)", ton: "favorable", precision: "Fiable sur la période" },
  acceptable: { libelle: "Acceptable", seuil: 55, couleur: "var(--color-vigilance)", ton: "vigilance", precision: "Un point à surveiller" },
  fragile: { libelle: "Fragile", seuil: 40, couleur: "#c2700a", ton: "vigilance", precision: "Deux dimensions faibles : à revoir avant le prochain marché" },
  insuffisant: { libelle: "Insuffisant", seuil: 0, couleur: "var(--color-defavorable)", ton: "defavorable", precision: "À ne pas reconduire sans explication" },
};

export const NIVEAUX_PRESTATAIRE: NiveauPrestataire[] = ["excellent", "bon", "acceptable", "fragile", "insuffisant"];

export function niveauPrestataire(score: number): NiveauPrestataire {
  return NIVEAUX_PRESTATAIRE.find((n) => score >= NIVEAU_PRESTATAIRE[n].seuil) ?? "insuffisant";
}

export type CleDimensionPrestataire = "qualite" | "delai" | "prix" | "reprises" | "anciennete";

export const DIMENSION_PRESTATAIRE: Record<CleDimensionPrestataire, { libelle: string; poids: number; precision: string; saisie: boolean }> = {
  qualite: { libelle: "Qualité perçue", poids: 30, precision: "Moyenne des évaluations saisies à la réception des services", saisie: true },
  delai: { libelle: "Délai tenu", poids: 20, precision: "Moyenne des évaluations sur le respect des délais annoncés", saisie: true },
  prix: { libelle: "Prix tenu", poids: 20, precision: "Moyenne des évaluations sur l'écart entre annoncé et facturé", saisie: true },
  reprises: { libelle: "Reprises", poids: 20, precision: "Part des interventions suivies d'une seconde sur le même véhicule pour le même objet, sous soixante jours", saisie: false },
  anciennete: { libelle: "Ancienneté de la relation", poids: 10, precision: "Un partenaire éprouvé vaut un partenaire nouveau ; ce n'est pas une qualité, c'est une assurance", saisie: false },
};

export const DIMENSIONS_PRESTATAIRE: CleDimensionPrestataire[] = ["qualite", "delai", "prix", "reprises", "anciennete"];

export interface ScoreDimensionPrestataire {
  cle: CleDimensionPrestataire;
  score: number | null;
  constat: string;
}

export interface NotationPrestataire {
  score: number | null;
  niveau: NiveauPrestataire | null;
  dimensions: ScoreDimensionPrestataire[];
  mesurees: number;
  /** Nombre d'évaluations qui fondent les trois premières dimensions. */
  evaluations: number;
}

/** Comme pour les transporteurs : trop peu de matière, pas de note. */
export const SEUIL_DIMENSIONS_PRESTATAIRE = 3;

export interface FaitsNotationPrestataire {
  evaluations: Evaluation[];
  /** Interventions du prestataire, et celles qui ont dû être reprises. */
  interventions: number;
  reprises: number;
  /** Mois écoulés depuis la première pièce connue ; nul si aucune. */
  ancienneteMois: number | null;
}

export function noterPrestataire(f: FaitsNotationPrestataire): NotationPrestataire {
  const surCritere = (c: CritereEvaluation): ScoreDimensionPrestataire["score"] => {
    if (f.evaluations.length === 0) return null;
    const moyenne = f.evaluations.reduce((s, e) => s + e.notes[c], 0) / f.evaluations.length;
    /* De 1 à 5 vers 0 à 100 : une note de 1 vaut zéro, pas vingt. */
    return Math.round(((moyenne - 1) / 4) * 100);
  };
  const nb = (n: number, d = 1) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  const moyenneDe = (c: CritereEvaluation) => (f.evaluations.length ? f.evaluations.reduce((s, e) => s + e.notes[c], 0) / f.evaluations.length : 0);

  const dimensions: ScoreDimensionPrestataire[] = [
    { cle: "qualite", score: surCritere("qualite"), constat: f.evaluations.length ? `${nb(moyenneDe("qualite"))} sur 5 · ${f.evaluations.length} évaluation${f.evaluations.length > 1 ? "s" : ""}` : "Aucune évaluation saisie" },
    { cle: "delai", score: surCritere("delai"), constat: f.evaluations.length ? `${nb(moyenneDe("delai"))} sur 5` : "Aucune évaluation saisie" },
    { cle: "prix", score: surCritere("prix"), constat: f.evaluations.length ? `${nb(moyenneDe("prix"))} sur 5` : "Aucune évaluation saisie" },
    {
      cle: "reprises",
      score: f.interventions === 0 ? null : Math.max(0, Math.round(100 - (f.reprises / f.interventions) * 300)),
      constat: f.interventions === 0 ? "Aucune intervention" : `${f.reprises} reprise${f.reprises > 1 ? "s" : ""} sur ${f.interventions} intervention${f.interventions > 1 ? "s" : ""}`,
    },
    {
      cle: "anciennete",
      score: f.ancienneteMois === null ? null : Math.min(100, Math.round((f.ancienneteMois / 36) * 100)),
      constat: f.ancienneteMois === null ? "Aucune pièce connue" : `${f.ancienneteMois} mois de relation`,
    },
  ];

  const mesurees = dimensions.filter((d) => d.score !== null);
  if (mesurees.length < SEUIL_DIMENSIONS_PRESTATAIRE) {
    return { score: null, niveau: null, dimensions, mesurees: mesurees.length, evaluations: f.evaluations.length };
  }
  const poids = mesurees.reduce((s, d) => s + DIMENSION_PRESTATAIRE[d.cle].poids, 0);
  const score = Math.round(mesurees.reduce((s, d) => s + d.score! * DIMENSION_PRESTATAIRE[d.cle].poids, 0) / poids);
  return { score, niveau: niveauPrestataire(score), dimensions, mesurees: mesurees.length, evaluations: f.evaluations.length };
}

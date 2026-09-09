/* ============================================================================
 * Numéro de référence des transactions.
 *
 * Décision du métier du 3 septembre 2026 : chaque transaction — plein, dépense,
 * intervention, document, relevé, affectation, incident, sanction,
 * indisponibilité — porte un numéro unique dans l'application, que l'on cite
 * dans une demande d'achat avant de la créer et de la valider, et que la
 * recherche retrouve d'un coup.
 *
 * Forme : PRÉFIXE-AAAA-NNNNN — « DEP-2026-15012 ». Le préfixe dit de quoi il
 * s'agit sans ouvrir la fiche, l'année situe, la séquence rend unique. En
 * production, la séquence vient d'une séquence PostgreSQL par type et par
 * année ; le numéro ne se recycle jamais, même si la transaction est annulée.
 * ==========================================================================*/

export type TypeTransaction =
  | "depense"
  | "plein"
  | "intervention"
  | "document"
  | "releve"
  | "transport"
  | "avance"
  | "evaluation"
  | "piece"
  | "mouvement"
  | "pneu"
  | "budget"
  | "affectation"
  | "attelage"
  | "incident"
  | "sanction"
  | "indisponibilite"
  | "statut"
  | "aptitude"
  | "visite"
  | "observation"
  | "caisse"
  | "achat"
  | "ordre"
  | "cuve"
  /* Le prestataire est une fiche de référentiel, pas une transaction : même
     modale, même trace, un numéro qui l'identifie. */
  | "prestataire"
  /* Les deux fiches elles-mêmes : pas des transactions, mais elles se modifient
     avec la même modale et la même trace. Leur « numéro » est leur identifiant. */
  | "vehicule"
  | "chauffeur"
  | "affretement"
  | "entretien"
  | "mise-a-disposition"
  | "prestation"
  | "tarif";

export interface DefinitionTypeTransaction {
  prefixe: string;
  libelle: string;
  /** Onglet de la fiche véhicule ou chauffeur qui liste ce type. */
  ongletVehicule: string | null;
  ongletChauffeur: string | null;
}

export const TYPE_TRANSACTION: Record<TypeTransaction, DefinitionTypeTransaction> = {
  depense: { prefixe: "DEP", libelle: "Dépense", ongletVehicule: "autres", ongletChauffeur: "frais" },
  plein: { prefixe: "PLN", libelle: "Plein", ongletVehicule: "carburant", ongletChauffeur: null },
  intervention: { prefixe: "INT", libelle: "Intervention", ongletVehicule: "entretien", ongletChauffeur: null },
  document: { prefixe: "DOC", libelle: "Document", ongletVehicule: "conformite", ongletChauffeur: "documents" },
  releve: { prefixe: "REL", libelle: "Relevé kilométrique", ongletVehicule: "kilometrage", ongletChauffeur: null },
  /* Une ligne du relevé de transport : un chargement parti un jour donné. À ne
     pas confondre avec le relevé kilométrique, qui porte un compteur. */
  transport: { prefixe: "TRP", libelle: "Ligne de relevé de transport", ongletVehicule: null, ongletChauffeur: null },
  /* Une avance versée à un prestataire, et l'évaluation d'un service rendu :
     deux faits que rien d'autre ne porte, donc deux transactions à part. */
  avance: { prefixe: "AVA", libelle: "Avance à un prestataire", ongletVehicule: null, ongletChauffeur: null },
  evaluation: { prefixe: "EVA", libelle: "Évaluation d'un service", ongletVehicule: null, ongletChauffeur: null },
  /* Les pièces de rechange (décisions du 9 septembre 2026) : la fiche d'une
     pièce, un mouvement du magasin, un pneu suivi un par un. */
  piece: { prefixe: "PCE", libelle: "Pièce de rechange", ongletVehicule: null, ongletChauffeur: null },
  mouvement: { prefixe: "MVT", libelle: "Mouvement de stock", ongletVehicule: "entretien", ongletChauffeur: null },
  pneu: { prefixe: "PNE", libelle: "Pneu", ongletVehicule: "entretien", ongletChauffeur: null },
  budget: { prefixe: "BUD", libelle: "Enveloppe budgétaire", ongletVehicule: null, ongletChauffeur: null },
  affectation: { prefixe: "AFF", libelle: "Affectation", ongletVehicule: "affectations", ongletChauffeur: "affectations" },
  attelage: { prefixe: "ATT", libelle: "Attelage", ongletVehicule: "affectations", ongletChauffeur: null },
  incident: { prefixe: "INC", libelle: "Incident ou accident", ongletVehicule: "journal", ongletChauffeur: "incidents" },
  sanction: { prefixe: "SAN", libelle: "Sanction", ongletVehicule: null, ongletChauffeur: "incidents" },
  indisponibilite: { prefixe: "IND", libelle: "Indisponibilité", ongletVehicule: null, ongletChauffeur: "journal" },
  statut: { prefixe: "STA", libelle: "Changement de statut", ongletVehicule: "journal", ongletChauffeur: null },
  aptitude: { prefixe: "APT", libelle: "Décision d'aptitude", ongletVehicule: null, ongletChauffeur: "identite" },
  visite: { prefixe: "VTE", libelle: "Visite technique", ongletVehicule: "conformite", ongletChauffeur: null },
  observation: { prefixe: "OBS", libelle: "Observation de visite technique", ongletVehicule: "entretien", ongletChauffeur: null },
  /* Caisse et achats ne vivent pas sur une fiche : leur écran est le journal
     lui-même, et la recherche y mène par `/caisse?vue=…&ref=…`. */
  caisse: { prefixe: "CAI", libelle: "Mouvement de caisse", ongletVehicule: null, ongletChauffeur: null },
  achat: { prefixe: "DAC", libelle: "Demande d'achat", ongletVehicule: null, ongletChauffeur: null },
  /* L'ordre de travail planifie une intervention ; une fois clos, c'est
     l'intervention INT qu'il a produite qui vit sur la fiche. */
  ordre: { prefixe: "OTR", libelle: "Ordre de travail", ongletVehicule: "entretien", ongletChauffeur: null },
  /* La cuve interne n'appartient à aucun véhicule : ses mouvements vivent sur le
     journal de la cuve, les sorties citent le plein qu'elles alimentent. */
  cuve: { prefixe: "CUV", libelle: "Mouvement de cuve", ongletVehicule: null, ongletChauffeur: null },
  prestataire: { prefixe: "PRE", libelle: "Prestataire", ongletVehicule: null, ongletChauffeur: null },
  /* Transporteurs (lot 3) : la mission confiée à un tiers, et la ligne de
     grille tarifaire qui en fixe le prix. */
  affretement: { prefixe: "AFF", libelle: "Affrètement", ongletVehicule: null, ongletChauffeur: null },
  /* Une ligne du plan d'entretien : elle se règle par véhicule, et la
     modification se trace comme toute autre. */
  entretien: { prefixe: "ENT", libelle: "Plan d'entretien", ongletVehicule: "maintenance", ongletChauffeur: null },
  "mise-a-disposition": { prefixe: "MAD", libelle: "Mise à disposition", ongletVehicule: null, ongletChauffeur: null },
  prestation: { prefixe: "PRS", libelle: "Prestation de transport", ongletVehicule: null, ongletChauffeur: null },
  tarif: { prefixe: "TAR", libelle: "Ligne de tarif", ongletVehicule: null, ongletChauffeur: null },
  vehicule: { prefixe: "VEH", libelle: "Fiche véhicule", ongletVehicule: "caracteristiques", ongletChauffeur: null },
  chauffeur: { prefixe: "CHA", libelle: "Fiche chauffeur", ongletVehicule: null, ongletChauffeur: "identite" },
};

const PAR_PREFIXE = new Map(Object.entries(TYPE_TRANSACTION).map(([type, d]) => [d.prefixe, type as TypeTransaction]));

/** « DEP-2026-15012 ». */
export function formerNumero(type: TypeTransaction, dateIso: string, sequence: number): string {
  return `${TYPE_TRANSACTION[type].prefixe}-${dateIso.slice(0, 4)}-${String(sequence).padStart(5, "0")}`;
}

/**
 * Reconnaît un numéro tel qu'on le tape : « dep 2026 15012 », « DEP-2026-15012 »,
 * « dep2026-15012 ». Retourne la forme canonique, ou null si ce n'en est pas un.
 */
export function analyserNumero(texte: string): { numero: string; type: TypeTransaction } | null {
  const m = /^\s*([A-Za-z]{3})[\s-]*(\d{4})[\s-]*(\d{1,5})\s*$/.exec(texte);
  if (!m) return null;
  const type = PAR_PREFIXE.get(m[1]!.toUpperCase());
  if (!type) return null;
  return { numero: `${m[1]!.toUpperCase()}-${m[2]}-${m[3]!.padStart(5, "0")}`, type };
}

/** Vrai si le texte ressemble au début d'un numéro : « DE », « DEP-20 », « inc 2026 ». */
export function ressembleAUnNumero(texte: string): boolean {
  return /^\s*[A-Za-z]{2,3}[\s-]*\d*[\s-]*\d*\s*$/.test(texte) && /\d/.test(texte) === true;
}

export function typeDuNumero(numero: string): TypeTransaction | null {
  return PAR_PREFIXE.get(numero.slice(0, 3).toUpperCase()) ?? null;
}

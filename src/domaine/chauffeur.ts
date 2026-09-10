/* ============================================================================
 * Chauffeurs — vues dérivées et règles.
 *
 * Le chauffeur n'est pas un utilisateur de l'application : c'est une personne
 * du référentiel, rattachée à des véhicules par des affectations datées. Tout
 * ce qui se lit sur sa liste et sa fiche — kilomètres, consommation,
 * contraventions, incidents — lui est attribué **par la période d'affectation**,
 * jamais saisi sur lui directement.
 * ==========================================================================*/

import type { DocumentFiche, EvenementJournal } from "./fiche";
import type {
  Chauffeur,
  DeclarationIncident,
  Indisponibilite,
  RoleAffectation,
  Sanction,
  Site,
  TypeDocument,
} from "./types";

/**
 * Situation d'un chauffeur, déduite — jamais saisie :
 *  - en-poste : actif, titulaire ou suppléant d'au moins un véhicule ;
 *  - disponible : actif, sans affectation en cours — c'est lui qu'on cherche
 *    quand un véhicule n'a plus de chauffeur ;
 *  - indisponible : une période d'indisponibilité est ouverte (congé, maladie,
 *    suspension de permis…), quelle que soit son affectation ;
 *  - sorti : a quitté l'entreprise ; consultable, plus affectable.
 */
export type StatutChauffeur = "en-poste" | "disponible" | "indisponible" | "sorti";

export interface DefinitionStatutChauffeur {
  libelle: string;
  couleur: string;
  precision: string;
  /** Peut conduire aujourd'hui, sous réserve de ses documents. */
  mobilisable: boolean;
}

/** Les couleurs reprennent celles des statuts de véhicule de même sens. */
export const STATUT_CHAUFFEUR: Record<StatutChauffeur, DefinitionStatutChauffeur> = {
  "en-poste": { libelle: "En poste", couleur: "var(--color-statut-service)", precision: "Affecté à un véhicule", mobilisable: true },
  disponible: { libelle: "Disponible", couleur: "var(--color-statut-backup)", precision: "Actif, sans affectation en cours", mobilisable: true },
  indisponible: { libelle: "Indisponible", couleur: "var(--color-statut-restauration)", precision: "Congé, maladie, suspension ou formation", mobilisable: false },
  sorti: { libelle: "Sorti", couleur: "var(--color-statut-retrait)", precision: "A quitté l'entreprise", mobilisable: false },
};

export const ORDRE_STATUTS_CHAUFFEUR: StatutChauffeur[] = ["en-poste", "disponible", "indisponible", "sorti"];

/** Catégories du permis sénégalais, dans l'ordre où elles se lisent. */
export const CATEGORIES_PERMIS = ["A", "B", "C", "D", "E"] as const;

/**
 * Identifiant d'adresse d'un chauffeur : « Babacar Ndiaye » → « babacar-ndiaye ».
 * Tant que la base n'est pas branchée, c'est le nom qui identifie ; demain ce
 * sera l'identifiant de la table, et l'adresse gardera la même forme lisible.
 */
export function idChauffeur(nomComplet: string): string {
  return nomComplet
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function nomComplet(c: Pick<Chauffeur, "prenom" | "nom">): string {
  return `${c.prenom} ${c.nom}`.trim();
}

export function initialesDe(nom: string | null): string {
  if (!nom) return "—";
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]!.toUpperCase())
    .join("");
}

/**
 * Statut déduit de la situation du jour. L'ordre des tests est celui de la
 * priorité : sorti prime sur tout, puis l'indisponibilité, puis l'affectation.
 */
export function statutChauffeur(c: Chauffeur, indisponibiliteCourante: Indisponibilite | null, affecte: boolean): StatutChauffeur {
  if (!c.actif) return "sorti";
  if (indisponibiliteCourante) return "indisponible";
  return affecte ? "en-poste" : "disponible";
}

/* -- Ligne de la liste ------------------------------------------------------- */

export interface VehiculeAffecte {
  vehiculeId: string;
  immatriculation: string;
  immatriculationAffichee: string;
  marque: string;
  appellation: string;
  role: RoleAffectation;
  debut: string;
}

export interface EcheanceChauffeur {
  type: TypeDocument;
  echeance: string | null;
  joursRestants: number | null;
  /** Vrai quand le document n'est pas enregistré du tout. */
  manquant: boolean;
}

export interface LigneChauffeur {
  chauffeur: Chauffeur;
  id: string;
  nomComplet: string;
  initiales: string;
  site: Site | null;
  statut: StatutChauffeur;
  indisponibilite: Indisponibilite | null;
  /** Véhicule dont il est titulaire en ce moment, s'il y en a un. */
  vehiculeTitulaire: VehiculeAffecte | null;
  /** Véhicules dont il est suppléant en ce moment. */
  suppleances: VehiculeAffecte[];
  permis: EcheanceChauffeur;
  visiteMedicale: EcheanceChauffeur;
  /** Kilomètres attribués sur 12 mois glissants, toutes affectations confondues. */
  kmDouzeMois: number | null;
  contraventionsDouzeMois: number;
  incidentsDouzeMois: number;
}

/** Vrai si un document obligatoire est échu ou manquant, ou si le chauffeur est déclaré inapte. */
export function nonConforme(l: LigneChauffeur): boolean {
  const echu = (e: EcheanceChauffeur) => e.manquant || (e.joursRestants !== null && e.joursRestants < 0);
  return echu(l.permis) || echu(l.visiteMedicale) || l.chauffeur.aptitude === "inapte";
}

/** Peut prendre le volant aujourd'hui : mobilisable, documents valides, pas inapte. */
export function peutConduire(l: LigneChauffeur): boolean {
  return STATUT_CHAUFFEUR[l.statut].mobilisable && !nonConforme(l);
}

/** Le document dont l'échéance est la plus proche, pour la colonne unique de la liste. */
export function prochaineEcheance(l: LigneChauffeur): EcheanceChauffeur {
  const rang = (e: EcheanceChauffeur) => (e.manquant ? -Infinity : (e.joursRestants ?? Infinity));
  return rang(l.permis) <= rang(l.visiteMedicale) ? l.permis : l.visiteMedicale;
}

/* -- Fiche chauffeur --------------------------------------------------------- */

export interface IdentiteChauffeur {
  dateNaissance: string | null;
  age: number | null;
  dateEmbauche: string | null;
  ancienneteAnnees: number | null;
  dateSortie: string | null;
  adresse: string | null;
  contactUrgence: string | null;
  permisNumero: string | null;
  permisDelivrance: string | null;
  permisCategories: string[];
}

/** Une période passée sur un véhicule, avec ce qu'elle a produit. */
export interface AffectationChauffeur {
  id: string;
  numero: string;
  vehiculeId: string;
  immatriculation: string;
  immatriculationAffichee: string;
  vehicule: string;
  role: RoleAffectation;
  debut: string;
  fin: string | null;
  buSite: string;
  kmParcourus: number;
  motif: string;
}

/** Consommation d'un mois sur un véhicule, attribuée au chauffeur qui le conduisait. */
export interface ConsommationChauffeur {
  /** « 2026-03 ». */
  mois: string;
  vehiculeId: string;
  immatriculationAffichee: string;
  litres: number;
  kmParcourus: number;
  litresAux100: number;
  referenceL100: number;
  ecartPct: number;
  cout: number;
}

export interface ContraventionChauffeur {
  id: string;
  numero: string;
  date: string;
  vehiculeId: string;
  immatriculationAffichee: string;
  libelle: string;
  montant: number;
  reference: string | null;
  /** Vrai quand la contravention a donné lieu à une retenue. */
  retenue: boolean;
}

export interface IncidentChauffeur {
  declaration: DeclarationIncident;
  immatriculationAffichee: string;
  vehicule: string;
  /**
   * Somme des dépenses rattachées à la déclaration — jamais saisie. **Nulle
   * quand rien ne les rattache** : en base, aucun écran ne relie une dépense
   * à une déclaration et la table n'a pas de colonne pour le dire. Un coût
   * inconnu se dit ; il ne s'affiche pas comme un coût nul.
   */
  cout: number | null;
  immobilisationJours: number;
}

export interface FraisDeRoute {
  id: string;
  numero: string;
  date: string;
  vehiculeId: string;
  immatriculationAffichee: string;
  libelle: string;
  montant: number;
  reference: string | null;
  justificatif: boolean;
}

/** Un relevé de compteur saisi pendant sa conduite, avec le verdict du contrôle. */
export interface ReleveAttribue {
  date: string;
  vehiculeId: string;
  valide: boolean;
}

export interface FicheChauffeur {
  ligne: LigneChauffeur;
  identite: IdentiteChauffeur;
  documents: DocumentFiche[];
  affectations: AffectationChauffeur[];
  consommation: ConsommationChauffeur[];
  contraventions: ContraventionChauffeur[];
  incidents: IncidentChauffeur[];
  sanctions: Sanction[];
  indisponibilites: Indisponibilite[];
  fraisDeRoute: FraisDeRoute[];
  /** Relevés saisis à la main pendant sa conduite (pleins, dépenses) — pas la balise. */
  releves: ReleveAttribue[];
  journal: EvenementJournal[];
}

/* -- Période de lecture ------------------------------------------------------ */

/**
 * Tout ce qui se lit sur la fiche se lit « sur période » : la même fiche doit
 * répondre à « ce trimestre » comme à « depuis un an ». Trois profondeurs
 * suffisent à la gestion de parc ; l'année civile viendra avec les KPI historisés.
 */
export type PeriodeMois = 3 | 6 | 12;

export const PERIODES: { valeur: PeriodeMois; libelle: string }[] = [
  { valeur: 3, libelle: "3 mois" },
  { valeur: 6, libelle: "6 mois" },
  { valeur: 12, libelle: "12 mois" },
];

/** Premier jour de la période, en ISO, à partir d'une date de référence. */
export function debutPeriode(mois: PeriodeMois, reference: Date): string {
  const d = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - mois + 1, 1));
  return d.toISOString().slice(0, 10);
}

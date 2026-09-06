/* ============================================================================
 * Prestataires — le référentiel de ceux avec qui le parc travaille.
 *
 * Garages, fournisseurs de pièces et de pneumatiques, stations, fournisseur de
 * carburant, assureurs, centres de visite technique agréés, dépanneurs,
 * transporteurs. Une fiche par prestataire, numérotée PRE, modifiable avec
 * trace comme une fiche véhicule ; un prestataire inactif reste lisible sur les
 * transactions passées mais n'est plus proposé au choix.
 *
 * Demande du métier du 3 septembre 2026. En production : table `prestataire`,
 * référencée par les interventions, ordres de travail, pleins, documents et
 * demandes d'achat.
 * ==========================================================================*/

import type { Ton } from "./libelles";

export type TypePrestataire = "garage" | "pieces" | "pneumatiques" | "station" | "carburant" | "assureur" | "centre-visite" | "depanneur" | "transporteur" | "autre";

export const TYPE_PRESTATAIRE: Record<TypePrestataire, string> = {
  garage: "Garage",
  pieces: "Pièces détachées",
  pneumatiques: "Pneumatiques",
  station: "Station-service",
  carburant: "Fournisseur de carburant",
  assureur: "Assureur",
  "centre-visite": "Centre de visite technique",
  depanneur: "Dépanneur",
  transporteur: "Transporteur",
  autre: "Autre",
};

export const TON_TYPE_PRESTATAIRE: Record<TypePrestataire, Ton> = {
  garage: "favorable",
  pieces: "neutre",
  pneumatiques: "neutre",
  station: "vigilance",
  carburant: "vigilance",
  assureur: "neutre",
  "centre-visite": "favorable",
  depanneur: "defavorable",
  transporteur: "neutre",
  autre: "neutre",
};

export interface Prestataire {
  numero: string;
  raisonSociale: string;
  type: TypePrestataire;
  contact: string | null;
  telephone: string | null;
  courriel: string | null;
  adresse: string | null;
  ville: string | null;
  /** Numéro d'identification national des entreprises et associations. */
  ninea: string | null;
  /** Délai de paiement convenu, en jours ; nul quand on paie à la commande. */
  delaiPaiementJours: number | null;
  actif: boolean;
  note: string | null;
  /** Créé dans l'application (pas dans le jeu de démonstration). */
  creee: boolean;
}

export const COULEUR_ACTIF: Record<"actif" | "inactif", string> = {
  actif: "var(--color-accent)",
  inactif: "var(--color-attenue-2)",
};

/** Les types qui interviennent sur les véhicules — ceux qu'un ordre de travail peut choisir. */
export const TYPES_GARAGE: TypePrestataire[] = ["garage", "depanneur"];

/* -- La fiche du prestataire ------------------------------------------------- */

/** Ce qu'une transaction d'un véhicule apporte à la fiche : de quel véhicule il s'agit. */
interface PorteurVehicule {
  vehiculeId: string;
  immatriculation: string;
  immatriculationAffichee: string;
}

export interface InterventionPrestataire extends PorteurVehicule {
  numero: string;
  date: string;
  type: "preventif" | "curatif";
  objet: string;
  montant: number;
  immobilisationJours: number;
  reference: string;
}

export interface PleinPrestataire extends PorteurVehicule {
  numero: string;
  date: string;
  litres: number;
  prixLitre: number;
  montant: number;
}

export interface DocumentPrestataire extends PorteurVehicule {
  numero: string;
  type: string;
  libelle: string;
  dateEffet: string | null;
  echeance: string | null;
  montant: number | null;
  numeroPiece: string | null;
}

export interface VisitePrestataire extends PorteurVehicule {
  numero: string;
  type: string;
  dateRendezVous: string;
  datePassage: string | null;
  statut: string;
  numeroPv: string | null;
}

/**
 * La fiche d'un prestataire : sa carte d'identité, et tout ce qu'il a fait
 * avec le parc — demandes d'achat, interventions, pleins, documents, visites,
 * sorties de caisse. Demande du métier du 3 septembre 2026 : « comme pour les
 * véhicules et les chauffeurs, chaque fournisseur a une page détail pour voir
 * ses statistiques entre autres ». Les statistiques s'en déduisent, rien ne se
 * saisit.
 */
export interface FichePrestataire {
  prestataire: Prestataire;
  demandes: import("./caisse").LigneAchat[];
  interventions: InterventionPrestataire[];
  pleins: PleinPrestataire[];
  depensesCaisse: import("../donnees/caisse-demo").DepenseCaisse[];
  documents: DocumentPrestataire[];
  visites: VisitePrestataire[];
}

/** Les initiales d'une raison sociale, pour l'avatar de la fiche : « La Sénégalaise de l'Automobile » → « SA ». */
export function initialesPrestataire(raisonSociale: string): string {
  const mots = raisonSociale.split(/[\s'’-]+/).filter((m) => m.length > 2 && !["les", "des", "and"].includes(m.toLowerCase()));
  return (mots.length >= 2 ? `${mots[0]![0]}${mots[1]![0]}` : raisonSociale.slice(0, 2)).toUpperCase();
}

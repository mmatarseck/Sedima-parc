/* ============================================================================
 * Libellés d'affichage et jeux de couleurs de statut.
 * Un seul endroit décide comment un état se dit et comment il se colore.
 * Les couleurs viennent de la charte §2 (tableau « Statuts »).
 * ==========================================================================*/

import type {
  Aptitude,
  BusinessUnit,
  CategorieObservation,
  GraviteObservation,
  StatutObservation,
  StatutVisite,
  TypeVisite,
  CategorieFlotte,
  CategorieVehicule,
  Chauffeur,
  MissionIncident,
  MotifImmobilisation,
  MotifIndisponibilite,
  NatureIncident,
  PosteDepense,
  Responsabilite,
  RoleAffectation,
  StatutDeclaration,
  StatutVehicule,
  TypeDocument,
  TypeIncident,
  TypeSanction,
  UsageVehicule,
} from "./types";

import { CATEGORIES_STANDARD, libelleCategorieCourant, libelleDocumentCourant, typesDocumentsCourants } from "./parametres";

export type Ton = "favorable" | "defavorable" | "vigilance" | "neutre";

/**
 * La couleur pleine d'un ton, pour les endroits qui peignent au lieu d'habiller :
 * le filet de statut en début de ligne des listes, un segment de graphique. Les
 * pastilles, elles, passent par leurs classes — fond, bordure et texte accordés.
 */
export const COULEUR_TON: Record<Ton, string> = {
  favorable: "var(--color-accent)",
  vigilance: "var(--color-vigilance)",
  defavorable: "var(--color-defavorable)",
  neutre: "var(--color-neutre)",
};

export interface DefinitionStatut {
  libelle: string;
  /** Couleur de la pastille, prise dans les tokens de statut. */
  couleur: string;
  /** Compte au numérateur du taux de disponibilité D_TDPA. */
  operationnel: boolean;
  /** Ce qu'il faut comprendre de l'état, en une ligne. */
  precision: string;
}

/**
 * Les sept statuts d'exploitation, dans l'ordre où la gestion de parc les lit :
 * du plus disponible au plus sortant.
 */
export const STATUT_VEHICULE: Record<StatutVehicule, DefinitionStatut> = {
  "en-service": {
    libelle: "En service",
    couleur: "var(--color-statut-service)",
    operationnel: true,
    precision: "Affecté et en exploitation",
  },
  "en-backup": {
    libelle: "En backup",
    couleur: "var(--color-statut-backup)",
    operationnel: true,
    precision: "Opérationnel, tenu en réserve",
  },
  "en-reparation": {
    libelle: "En réparation",
    couleur: "var(--color-statut-reparation)",
    operationnel: false,
    precision: "Au garage, retour attendu",
  },
  "en-restauration": {
    libelle: "En restauration",
    couleur: "var(--color-statut-restauration)",
    operationnel: false,
    precision: "Remise en état ou aménagement",
  },
  "hors-service": {
    libelle: "Hors service",
    couleur: "var(--color-statut-hors-service)",
    operationnel: false,
    precision: "Immobilisé, sans retour programmé",
  },
  "en-mutation": {
    libelle: "En mutation",
    couleur: "var(--color-statut-mutation)",
    operationnel: false,
    precision: "En transfert entre sites ou entités",
  },
  "retrait-en-cours": {
    libelle: "Retrait en cours",
    couleur: "var(--color-statut-retrait)",
    operationnel: false,
    precision: "Sortie du parc engagée",
  },
  "a-recevoir": {
    libelle: "À recevoir",
    couleur: "var(--color-statut-a-recevoir)",
    operationnel: false,
    precision: "Commandé, pas encore livré ni immatriculé",
  },
};

/** Ordre d'affichage, du plus disponible au plus sortant. */
export const ORDRE_STATUTS: StatutVehicule[] = [
  "en-service",
  "en-backup",
  "en-reparation",
  "en-restauration",
  "hors-service",
  "en-mutation",
  "retrait-en-cours",
  "a-recevoir",
];

export const MOTIF_IMMOBILISATION: Record<MotifImmobilisation, string> = {
  panne: "Panne",
  "maintenance-corrective": "Maintenance corrective",
  "maintenance-preventive": "Maintenance préventive",
  administratif: "Administratif",
  sinistre: "Sinistre",
  reforme: "Réforme",
};

/**
 * Les huit familles de véhicule, sous leur nom livré. Pour nommer un véhicule
 * précis, `libelleCategorie` : il tient compte des catégories ajoutées et des
 * renommages faits dans Paramètres › Véhicules.
 */
export const CATEGORIE_VEHICULE: Record<CategorieVehicule, string> = Object.fromEntries(CATEGORIES_STANDARD.map((c) => [c.id, c.libelle])) as Record<CategorieVehicule, string>;

export function libelleCategorie(v: { categorie: CategorieVehicule; categorieMetier?: string | null }): string {
  return libelleCategorieCourant(v.categorie, v.categorieMetier);
}

export const USAGE_VEHICULE: Record<UsageVehicule, string> = {
  vrac: "Vrac",
  frigorifique: "Frigorifique",
  poussins: "Poussins",
  plateau: "Plateau",
  ridelle: "Ridelle",
  citerne: "Citerne",
  benne: "Benne",
  fourgon: "Fourgon",
  tracteur: "Tracteur seul",
  utilitaire: "Utilitaire",
  autre: "Autre",
};

export const CATEGORIE_FLOTTE: Record<CategorieFlotte, string> = {
  interne: "Interne SEDIMA",
  adex: "ADEX",
  location: "Location",
  prestataire: "Prestataire",
};

/** L'énergie d'un véhicule ; le prix de chacune est réglé dans Paramètres. */
export const ENERGIE: Record<import("./types").Energie, string> = {
  gasoil: "Gasoil",
  essence: "Essence",
  electrique: "Électrique",
  hybride: "Hybride",
};

export const BUSINESS_UNIT: Record<BusinessUnit, string> = {
  aliment: "Aliment (UAB)",
  minoterie: "Minoterie",
  abattoir: "Abattoir",
  couvoir: "Couvoir",
  commercial: "Commercial",
  fermes: "Fermes",
  siege: "Siège",
};

/**
 * Les libellés des documents viennent des paramètres : le métier ajoute et
 * renomme les documents dans Paramètres › Règles des documents. Cet objet lit
 * le registre courant (alimenté à chaque lecture des paramètres) pour que
 * TYPE_DOCUMENT[type] reste l'écriture de tous les écrans.
 */
export const TYPE_DOCUMENT: Record<TypeDocument, string> = new Proxy({} as Record<TypeDocument, string>, {
  get: (_, cle) => (typeof cle === "string" ? libelleDocumentCourant(cle) : undefined),
  has: (_, cle) => typeof cle === "string" && typesDocumentsCourants().some((t) => t.id === cle),
  ownKeys: () => typesDocumentsCourants().map((t) => t.id),
  getOwnPropertyDescriptor: (_, cle) => ({ enumerable: true, configurable: true, value: libelleDocumentCourant(String(cle)) }),
});

export const POSTE_DEPENSE: Record<PosteDepense, string> = {
  carburant: "Carburant",
  "maintenance-preventive": "Maintenance préventive",
  "maintenance-curative": "Maintenance curative",
  pieces: "Pièces détachées",
  pneumatiques: "Pneumatiques",
  assurance: "Assurance",
  conformite: "Conformité",
  "frais-de-route": "Frais de route",
  peage: "Péage",
  contravention: "Contravention",
  amortissement: "Amortissement",
  salaire: "Salaire chauffeur",
  divers: "Divers",
};

/**
 * Les trois familles de charges d'un véhicule. Toute dépense en relève d'une
 * seule : c'est la maille de lecture de l'Aperçu et du tableau de bord.
 */
export type GroupeCharge = "carburant" | "maintenance" | "autres";

export const GROUPE_CHARGE: Record<GroupeCharge, string> = {
  carburant: "Carburant",
  maintenance: "Maintenance",
  autres: "Autres",
};

export function groupeDuPoste(poste: PosteDepense): GroupeCharge {
  switch (poste) {
    case "carburant":
      return "carburant";
    case "maintenance-preventive":
    case "maintenance-curative":
    case "pieces":
    case "pneumatiques":
      return "maintenance";
    default:
      return "autres";
  }
}

export const ROLE_AFFECTATION: Record<RoleAffectation, string> = {
  titulaire: "Titulaire",
  suppleant: "Suppléant",
};

/* -- Chauffeurs -------------------------------------------------------------- */

export const APTITUDE: Record<Aptitude, { libelle: string; ton: Ton }> = {
  apte: { libelle: "Apte", ton: "favorable" },
  "apte-avec-reserve": { libelle: "Apte avec réserve", ton: "vigilance" },
  inapte: { libelle: "Inapte", ton: "defavorable" },
};

export const CONTRAT_CHAUFFEUR: Record<Chauffeur["contrat"], string> = {
  salarie: "Salarié",
  interimaire: "Intérimaire",
  prestataire: "Prestataire",
};

export const MOTIF_INDISPONIBILITE: Record<MotifIndisponibilite, string> = {
  conge: "Congé",
  maladie: "Maladie",
  "suspension-permis": "Suspension de permis",
  formation: "Formation",
  autre: "Autre",
};

export const TYPE_SANCTION: Record<TypeSanction, string> = {
  avertissement: "Avertissement",
  blame: "Blâme",
  retenue: "Retenue sur salaire",
  "mise-a-pied": "Mise à pied",
};

export const NATURE_INCIDENT: Record<NatureIncident, string> = {
  accident: "Accident",
  incident: "Incident",
};

export const TYPE_INCIDENT: Record<TypeIncident, string> = {
  "panne-mecanique": "Panne mécanique",
  "panne-electrique": "Panne électrique",
  crevaison: "Crevaison",
  surchauffe: "Surchauffe",
  "defaut-freinage": "Défaut de freinage",
  "avarie-chargement": "Perte ou avarie de chargement",
  "bris-de-glace": "Bris de glace",
  "vol-vandalisme": "Vol ou vandalisme",
  "immobilisation-administrative": "Immobilisation administrative",
  "collision-tiers": "Collision avec un tiers",
  "collision-sans-tiers": "Collision sans tiers",
  renversement: "Renversement",
  "accident-chargement": "Accident au chargement",
  "accident-corporel": "Accident corporel",
  incendie: "Incendie",
  autre: "Autre",
};

export const STATUT_DECLARATION: Record<StatutDeclaration, string> = {
  declare: "Déclaré",
  qualifie: "Qualifié",
  "en-traitement": "En traitement",
  clos: "Clos",
};

export const RESPONSABILITE: Record<Responsabilite, string> = {
  sedima: "SEDIMA",
  tiers: "Tiers",
  partagee: "Partagée",
  indeterminee: "Indéterminée",
};

export const MISSION_INCIDENT: Record<MissionIncident, string> = {
  livraison: "Livraison",
  transfert: "Transfert",
  "retour-a-vide": "Retour à vide",
  "hors-mission": "Hors mission",
};

/** Classes Tailwind par ton, alignées sur le tableau « Statuts » de la charte. */
export const CLASSES_TON: Record<Ton, string> = {
  favorable: "text-favorable bg-favorable-fond border-favorable-bordure",
  defavorable: "text-defavorable bg-defavorable-fond border-defavorable-bordure",
  vigilance: "text-vigilance bg-vigilance-fond border-vigilance/20",
  neutre: "text-attenue-2 bg-neutre-fond border-bordure",
};

/**
 * Ton d'une échéance selon les jours restants.
 * Les seuils reprennent les préavis du catalogue d'alertes : J-30 puis échu.
 */
export function tonEcheance(joursRestants: number | null): Ton {
  if (joursRestants === null) return "neutre";
  if (joursRestants < 0) return "defavorable";
  if (joursRestants <= 30) return "vigilance";
  return "favorable";
}

/** « dans 26 j », « échue de 12 j », « aujourd'hui ». */
export function formulerEcheance(joursRestants: number | null): string {
  if (joursRestants === null) return "—";
  if (joursRestants < 0) return `échue de ${Math.abs(joursRestants)} j`;
  if (joursRestants === 0) return "aujourd'hui";
  return `dans ${joursRestants} j`;
}

/* -- Visites techniques ------------------------------------------------------ */

export const TYPE_VISITE: Record<TypeVisite, string> = { visite: "Visite", "contre-visite": "Contre-visite" };

export const STATUT_VISITE: Record<StatutVisite, { libelle: string; ton: Ton }> = {
  "rendez-vous": { libelle: "Rendez-vous pris", ton: "neutre" },
  acceptee: { libelle: "Acceptée", ton: "favorable" },
  refusee: { libelle: "Refusée", ton: "defavorable" },
  annulee: { libelle: "Annulée", ton: "neutre" },
};

export const CATEGORIE_OBSERVATION: Record<CategorieObservation, string> = {
  freinage: "Freinage",
  direction: "Direction",
  eclairage: "Éclairage et signalisation",
  pneumatiques: "Pneumatiques",
  pollution: "Pollution",
  carrosserie: "Carrosserie",
  vitrage: "Vitrage",
  attelage: "Attelage",
  equipements: "Équipements",
  autre: "Autre",
};

export const GRAVITE_OBSERVATION: Record<GraviteObservation, string> = { majeure: "Majeure", mineure: "Mineure" };

export const STATUT_OBSERVATION: Record<StatutObservation, { libelle: string; ton: Ton }> = {
  "a-traiter": { libelle: "À traiter", ton: "defavorable" },
  "en-cours": { libelle: "En cours", ton: "vigilance" },
  corrigee: { libelle: "Corrigée", ton: "favorable" },
};

/* ============================================================================
 * Rôles applicatifs — note de cadrage §09.
 *
 * Le rôle n'est jamais déduit par le navigateur : en production il sera résolu
 * côté serveur par une fonction `get_me()` en SECURITY DEFINER, comme dans
 * SEDIMA Opérations. Ce fichier ne porte que les libellés et le périmètre
 * affiché, jamais la décision d'autorisation.
 * ==========================================================================*/

export type Role =
  | "administrateur"
  | "gestionnaire-parc"
  | "responsable-maintenance"
  | "responsable-carburant"
  | "correspondant-site"
  | "controle-de-gestion"
  | "direction"
  | "achats"
  /** Le détenteur d'un véhicule — chauffeur ou attributaire — cadrage du 7 septembre 2026 : demandes et transferts, rien d'autre. */
  | "detenteur";

export interface DefinitionRole {
  role: Role;
  libelle: string;
  perimetre: string;
  /** Compte de démonstration, utilisable tant que Supabase n'est pas branché. */
  compteTest: string;
  initiales: string;
  nom: string;
}

export const ROLES: DefinitionRole[] = [
  {
    role: "administrateur",
    libelle: "Administrateur",
    perimetre: "Référentiels, utilisateurs, règles d'alerte",
    compteTest: "admin@sedima.test",
    initiales: "AD",
    nom: "Compte administrateur",
  },
  {
    role: "gestionnaire-parc",
    libelle: "Gestionnaire de parc",
    perimetre: "Véhicules, affectations, documents, alertes",
    compteTest: "parc@sedima.test",
    initiales: "MS",
    nom: "M. Seck",
  },
  {
    role: "responsable-maintenance",
    libelle: "Responsable maintenance",
    perimetre: "Plans, ordres de travail, garages, factures atelier",
    compteTest: "maintenance@sedima.test",
    initiales: "AB",
    nom: "Aly Bo",
  },
  {
    role: "responsable-carburant",
    libelle: "Responsable carburant",
    perimetre: "Cuve, bons de sortie, pleins",
    compteTest: "carburant@sedima.test",
    initiales: "RC",
    nom: "Responsable carburant",
  },
  {
    role: "correspondant-site",
    libelle: "Correspondant site",
    perimetre: "Relevés kilométriques et pannes, sur son site uniquement",
    compteTest: "site.thies@sedima.test",
    initiales: "CT",
    nom: "Correspondant Thiès",
  },
  {
    role: "controle-de-gestion",
    libelle: "Contrôle de gestion",
    perimetre: "Consultation et export de tous les coûts",
    compteTest: "controle@sedima.test",
    initiales: "CG",
    nom: "Contrôle de gestion",
  },
  {
    role: "direction",
    libelle: "Direction",
    perimetre: "Tableaux de bord et synthèses, en lecture",
    compteTest: "direction@sedima.test",
    initiales: "DO",
    nom: "Direction des Opérations",
  },
  {
    role: "achats",
    libelle: "Achats",
    perimetre: "Fournisseurs, contrats transporteurs, demandes d'achat",
    compteTest: "achats@sedima.test",
    initiales: "AC",
    nom: "Service achats",
  },
  {
    role: "detenteur",
    libelle: "Détenteur",
    perimetre: "Son véhicule, les demandes reçues, les transferts à signer",
    compteTest: "detenteur@sedima.test",
    initiales: "MD",
    nom: "Moustapha Diaw",
  },
];

export const ROLE_PAR_DEFAUT: Role = "gestionnaire-parc";

/**
 * Les sanctions d'un chauffeur relèvent de la relation d'emploi, pas de
 * l'exploitation : seuls ceux qui les prononcent ou en répondent les voient.
 * Pour les autres, la fiche les tait — onglet, journal, indicateur et motif
 * de classement compris. En production, la même liste devient une politique
 * RLS sur la table `sanction`.
 */
export const ROLES_VOYANT_SANCTIONS: Role[] = ["administrateur", "gestionnaire-parc", "direction"];

export function voitSanctions(role: Role | null | undefined): boolean {
  return ROLES_VOYANT_SANCTIONS.includes(trouverRole(role).role);
}

export function trouverRole(role: string | null | undefined): DefinitionRole {
  return ROLES.find((r) => r.role === role) ?? ROLES.find((r) => r.role === ROLE_PAR_DEFAUT)!;
}

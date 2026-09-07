/* ============================================================================
 * L'accès d'une personne — cadrage du 7 septembre 2026, sur le modèle du
 * formulaire de contact de Fleetio.
 *
 * Six **profils** posent les défauts ; la fiche de chaque personne peut s'en
 * écarter module par module, et chaque écart n'entre en vigueur qu'approuvé
 * par l'administrateur. Un **périmètre** — sites, business units, régimes —
 * borne ce que la personne voit. Le **détenteur** d'un véhicule (chauffeur
 * titulaire ou attributaire) est un profil réduit : ses demandes, ses
 * transferts, rien d'autre.
 *
 * Les huit rôles historiques ne disparaissent pas : chaque profil porte un
 * rôle par défaut, celui que `get_me()` rend et que les politiques RLS
 * lisent. Ce fichier ne décide d'aucune autorisation ; il décrit.
 * ==========================================================================*/

import type { Role } from "./roles";
import type { BusinessUnit, RegimeUsage, StatutVehicule } from "./types";

export type Profil = "administrateur" | "responsable" | "maintenance" | "agent-terrain" | "lecteur" | "detenteur";

export type Module = "flotte" | "releves" | "incidents" | "maintenance" | "documents" | "chauffeurs" | "couts" | "transporteurs" | "parametres" | "demandes" | "transferts";

/** Ce qu'on peut faire d'un module : rien, lire, ajouter des faits, tout gérer. */
export type Niveau = "aucun" | "lecture" | "saisie" | "gestion";

export const NIVEAUX: Niveau[] = ["aucun", "lecture", "saisie", "gestion"];

export const NIVEAU: Record<Niveau, { libelle: string; precision: string }> = {
  aucun: { libelle: "—", precision: "Le module n'apparaît pas" },
  lecture: { libelle: "Lecture", precision: "Voit et exporte" },
  saisie: { libelle: "Saisie", precision: "Ajoute des faits, ne retouche pas le passé" },
  gestion: { libelle: "Gestion", precision: "Crée, modifie, retire" },
};

export const MODULES: { module: Module; libelle: string; precision: string }[] = [
  { module: "flotte", libelle: "Flotte et fiches véhicule", precision: "La liste, la fiche, la création d'un véhicule, son statut" },
  { module: "releves", libelle: "Relevés, pleins, cuve", precision: "Compteurs, carburant, bons de sortie" },
  { module: "incidents", libelle: "Pannes, incidents, sinistres", precision: "Déclarations et dossiers" },
  { module: "maintenance", libelle: "Maintenance et ordres de travail", precision: "Plans, ordres, interventions, garages" },
  { module: "documents", libelle: "Documents et conformité", precision: "Pièces, échéances, renouvellements" },
  { module: "chauffeurs", libelle: "Chauffeurs et affectations", precision: "Fiches, affectations, planning" },
  { module: "couts", libelle: "Coûts, budget, rapports", precision: "Analyses, budget, exports" },
  { module: "transporteurs", libelle: "Transporteurs, prestataires, achats", precision: "Contrats, grilles, demandes d'achat" },
  { module: "parametres", libelle: "Paramètres, utilisateurs, clôtures", precision: "Les réglages de l'application" },
  { module: "demandes", libelle: "Demandes poussées aux détenteurs", precision: "Relevé, jauge, position, contrôle du matin" },
  { module: "transferts", libelle: "Fiches de transfert", precision: "Remise d'un véhicule, état des lieux, signatures" },
];

export interface DefinitionProfil {
  profil: Profil;
  libelle: string;
  precision: string;
  /** Le rôle historique que `get_me()` rend pour ce profil : c'est lui que les politiques lisent. */
  roleDefaut: Role;
  /** Les rôles historiques qui se rangent derrière ce profil. */
  roles: Role[];
  defauts: Record<Module, Niveau>;
  /** Les statuts que le profil peut poser sur un véhicule ; « tous » pour ne rien borner. */
  statuts: StatutVehicule[] | "tous";
  sanctions: boolean;
  /** Ce que le profil fait sur le téléphone, en une phrase. */
  mobile: string;
}

const N = (flotte: Niveau, releves: Niveau, incidents: Niveau, maintenance: Niveau, documents: Niveau, chauffeurs: Niveau, couts: Niveau, transporteurs: Niveau, parametres: Niveau, demandes: Niveau, transferts: Niveau): Record<Module, Niveau> => ({
  flotte,
  releves,
  incidents,
  maintenance,
  documents,
  chauffeurs,
  couts,
  transporteurs,
  parametres,
  demandes,
  transferts,
});

export const PROFILS: DefinitionProfil[] = [
  {
    profil: "administrateur",
    libelle: "Administrateur",
    precision: "Celui qui règle l'application et approuve les écarts d'accès",
    roleDefaut: "administrateur",
    roles: ["administrateur"],
    defauts: N("gestion", "gestion", "gestion", "gestion", "gestion", "gestion", "gestion", "gestion", "gestion", "gestion", "gestion"),
    statuts: "tous",
    sanctions: true,
    mobile: "Tout, statuts compris ; les utilisateurs se règlent au bureau",
  },
  {
    profil: "responsable",
    libelle: "Responsable",
    precision: "Gestionnaire du parc, direction des opérations",
    roleDefaut: "gestionnaire-parc",
    roles: ["gestionnaire-parc", "direction"],
    defauts: N("gestion", "gestion", "gestion", "lecture", "gestion", "gestion", "gestion", "gestion", "saisie", "gestion", "gestion"),
    statuts: "tous",
    sanctions: true,
    mobile: "Tout le parc, tous les statuts, affectation rapide, validations",
  },
  {
    profil: "maintenance",
    libelle: "Maintenance",
    precision: "Responsable et équipe atelier",
    roleDefaut: "responsable-maintenance",
    roles: ["responsable-maintenance"],
    defauts: N("saisie", "saisie", "saisie", "gestion", "lecture", "lecture", "lecture", "lecture", "aucun", "saisie", "saisie"),
    statuts: ["en-reparation", "en-service", "en-backup"],
    sanctions: false,
    mobile: "Atelier, clôture d'intervention, réparation ↔ service, panne, relevé",
  },
  {
    profil: "agent-terrain",
    libelle: "Agent terrain",
    precision: "Correspondants de site, responsable carburant, magasinier — sur leur site",
    roleDefaut: "correspondant-site",
    roles: ["correspondant-site", "responsable-carburant"],
    defauts: N("saisie", "saisie", "saisie", "aucun", "saisie", "lecture", "aucun", "aucun", "aucun", "saisie", "saisie"),
    statuts: ["en-service", "hors-service"],
    sanctions: false,
    mobile: "Son site : relevé, plein, panne avec photo, service ↔ hors service, document renouvelé",
  },
  {
    profil: "lecteur",
    libelle: "Lecteur",
    precision: "Contrôle de gestion, achats, direction générale",
    roleDefaut: "controle-de-gestion",
    roles: ["controle-de-gestion", "achats", "direction"],
    defauts: N("lecture", "lecture", "lecture", "lecture", "lecture", "lecture", "lecture", "lecture", "aucun", "lecture", "lecture"),
    statuts: [],
    sanctions: false,
    mobile: "Chiffres d'accueil, fiche rapide sans action, alertes",
  },
  {
    profil: "detenteur",
    libelle: "Détenteur",
    precision: "Chauffeur titulaire ou attributaire d'un véhicule : répond aux demandes, signe les transferts",
    roleDefaut: "detenteur",
    roles: ["detenteur"],
    defauts: N("aucun", "aucun", "aucun", "aucun", "aucun", "aucun", "aucun", "aucun", "aucun", "saisie", "saisie"),
    statuts: [],
    sanctions: false,
    mobile: "Son véhicule, les demandes reçues et leur réponse avec photo, les transferts à signer",
  },
];

export const PROFIL_PAR_DEFAUT: Profil = "agent-terrain";

export function trouverProfil(profil: string | null | undefined): DefinitionProfil {
  return PROFILS.find((p) => p.profil === profil) ?? PROFILS.find((p) => p.profil === PROFIL_PAR_DEFAUT)!;
}

/** Le profil derrière un rôle historique : direction se range avec les responsables. */
export function profilPourRole(role: Role): Profil {
  return PROFILS.find((p) => p.roles.includes(role))?.profil ?? PROFIL_PAR_DEFAUT;
}

/** Ce que la personne voit : « tous » ou une liste d'identifiants. */
export interface Perimetre {
  sites: string[] | "tous";
  businessUnits: BusinessUnit[] | "toutes";
  regimes: RegimeUsage[] | "tous";
}

export const PERIMETRE_ENTIER: Perimetre = { sites: "tous", businessUnits: "toutes", regimes: "tous" };

export interface AccesUtilisateur {
  /** Identifiant du compte (UUID en base, « u-… » en démonstration). */
  id: string;
  prenom: string;
  nom: string;
  courriel: string;
  telephone: string | null;
  fonction: string | null;
  matricule: string | null;
  /** Compte activé : la personne se connecte et reçoit des notifications. Sinon, contact seulement. */
  actif: boolean;
  profil: Profil;
  perimetre: Perimetre;
  /** Les écarts au profil, module par module ; vide quand la personne suit son profil. */
  modules: Partial<Record<Module, Niveau>>;
  /** Voit les sanctions des chauffeurs ; nul : le défaut du profil. */
  sanctions: boolean | null;
  /** Les écarts sont approuvés par l'administrateur ; tant que non, le profil seul s'applique. */
  ecartsApprouves: boolean;
  approuvePar: string | null;
  /** Pour un détenteur : le chauffeur ou l'attributaire qu'il est. */
  chauffeurId: string | null;
  attributaireId: string | null;
  creeLe: string;
  modifieLe: string | null;
}

/** Le niveau qui s'applique à la personne sur un module : son écart s'il est approuvé, sinon le défaut du profil. */
export function niveauEffectif(acces: AccesUtilisateur, module: Module): Niveau {
  const defaut = trouverProfil(acces.profil).defauts[module];
  if (!acces.ecartsApprouves) return defaut;
  return acces.modules[module] ?? defaut;
}

/** Les modules où la fiche s'écarte de son profil. */
export function ecartsDe(acces: Pick<AccesUtilisateur, "profil" | "modules" | "sanctions">): { module: Module; profil: Niveau; fiche: Niveau }[] {
  const p = trouverProfil(acces.profil);
  return MODULES.flatMap((m) => {
    const fiche = acces.modules[m.module];
    return fiche !== undefined && fiche !== p.defauts[m.module] ? [{ module: m.module, profil: p.defauts[m.module], fiche }] : [];
  });
}

export function voitSanctionsSelonAcces(acces: AccesUtilisateur): boolean {
  const p = trouverProfil(acces.profil);
  if (acces.sanctions === null || !acces.ecartsApprouves) return p.sanctions;
  return acces.sanctions;
}

/** « Tous les sites » ou « 2 sites », pour une liste. */
export function resumerPerimetre(p: Perimetre): string {
  const parts = [
    p.sites === "tous" ? "tous les sites" : `${p.sites.length} site${p.sites.length > 1 ? "s" : ""}`,
    p.businessUnits === "toutes" ? "toutes les BU" : `${p.businessUnits.length} BU`,
    p.regimes === "tous" ? "tous les régimes" : p.regimes.join(", "),
  ];
  return parts.join(" · ");
}

const PROFILS_CONNUS = new Set<string>(PROFILS.map((p) => p.profil));
const MODULES_CONNUS = new Set<string>(MODULES.map((m) => m.module));
const NIVEAUX_CONNUS = new Set<string>(NIVEAUX);

/** Une fiche lue du stockage, remise d'aplomb champ par champ. */
export function normaliserAcces(brut: unknown): AccesUtilisateur | null {
  if (!brut || typeof brut !== "object") return null;
  const b = brut as Partial<Record<keyof AccesUtilisateur, unknown>>;
  if (typeof b.id !== "string" || !b.id) return null;
  const texte = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const modules: Partial<Record<Module, Niveau>> = {};
  if (b.modules && typeof b.modules === "object") {
    for (const [k, v] of Object.entries(b.modules as Record<string, unknown>)) if (MODULES_CONNUS.has(k) && typeof v === "string" && NIVEAUX_CONNUS.has(v)) modules[k as Module] = v as Niveau;
  }
  const pb = (b.perimetre ?? {}) as Partial<Record<keyof Perimetre, unknown>>;
  const liste = <T extends string>(v: unknown, tout: "tous" | "toutes"): T[] | "tous" | "toutes" => (Array.isArray(v) ? (v.filter((x): x is T => typeof x === "string") as T[]) : tout);
  return {
    id: b.id,
    prenom: texte(b.prenom) ?? "",
    nom: texte(b.nom) ?? "",
    courriel: texte(b.courriel) ?? "",
    telephone: texte(b.telephone),
    fonction: texte(b.fonction),
    matricule: texte(b.matricule),
    actif: b.actif !== false,
    profil: typeof b.profil === "string" && PROFILS_CONNUS.has(b.profil) ? (b.profil as Profil) : PROFIL_PAR_DEFAUT,
    perimetre: {
      sites: liste<string>(pb.sites, "tous") as string[] | "tous",
      businessUnits: liste<BusinessUnit>(pb.businessUnits, "toutes") as BusinessUnit[] | "toutes",
      regimes: liste<RegimeUsage>(pb.regimes, "tous") as RegimeUsage[] | "tous",
    },
    modules,
    sanctions: typeof b.sanctions === "boolean" ? b.sanctions : null,
    ecartsApprouves: b.ecartsApprouves === true,
    approuvePar: texte(b.approuvePar),
    chauffeurId: texte(b.chauffeurId),
    attributaireId: texte(b.attributaireId),
    creeLe: texte(b.creeLe) ?? new Date().toISOString(),
    modifieLe: texte(b.modifieLe),
  };
}

/**
 * Ce que le serveur dit de la personne connectée, tel que `get_me()` le rend :
 * son profil, son périmètre, ses niveaux effectifs — écarts approuvés
 * compris — et si elle voit les sanctions. C'est ce que les écrans lisent
 * pour se montrer ou se taire ; la décision, elle, reste dans les politiques.
 */
export interface AccesCourant {
  profil: Profil;
  perimetre: Perimetre;
  niveaux: Record<Module, Niveau>;
  sanctions: boolean;
}

/** L'accès qu'un rôle historique donne à lui seul : les défauts de son profil. En démonstration, c'est tout ce qu'on a. */
export function accesDepuisRole(role: Role): AccesCourant {
  const p = trouverProfil(profilPourRole(role));
  const niveaux = { ...p.defauts };
  /* Les nuances des anciens rôles, comme `niveau_par_role` les garde en base. */
  if (role === "achats") niveaux.transporteurs = "gestion";
  if (role === "controle-de-gestion") niveaux.couts = "gestion";
  if (role === "responsable-carburant") niveaux.releves = "gestion";
  return { profil: p.profil, perimetre: { ...PERIMETRE_ENTIER }, niveaux, sanctions: p.sanctions };
}

export function nomComplet(a: Pick<AccesUtilisateur, "prenom" | "nom">): string {
  return `${a.prenom} ${a.nom}`.trim();
}

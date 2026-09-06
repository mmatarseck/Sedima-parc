/* ============================================================================
 * Réglage des alertes — qui est prévenu de quoi, et par quel canal.
 *
 * Demande du métier du 4 septembre 2026 : l'entrée « Notifications » du menu du
 * compte doit être **dédiée au réglage des notifications**.
 *
 * Le principe : l'application sait produire une dizaine de sortes d'alertes ;
 * chacun choisit **celles qu'il veut recevoir** et **par où**. Sans ce réglage,
 * un gestionnaire de parc reçoit les mêmes courriels que la direction, cesse de
 * les lire au bout d'une semaine, et l'alerte qui comptait vraiment passe avec
 * les autres.
 *
 * Trois canaux, et une règle pour chacun :
 *  - **dans l'application** — la cloche. Toujours disponible, jamais coûteuse ;
 *  - **courriel** — pour ce qu'on veut retrouver dans sa boîte le lendemain ;
 *  - **Teams** — pour ce qui demande une réaction dans l'heure.
 *
 * Le délai de prévenance ne se règle qu'une fois, pour les échéances : c'est le
 * même J-60 / J-30 / J-7 que l'échéancier de Conformité applique. Deux réglages
 * distincts pour la même chose finiraient par se contredire.
 * ==========================================================================*/

import type { Role } from "./roles";

export type Canal = "application" | "courriel" | "teams";

export const CANAL: Record<Canal, { libelle: string; precision: string }> = {
  application: { libelle: "Dans l'application", precision: "La cloche de la barre — toujours actif pour ce qui vous est adressé" },
  courriel: { libelle: "Courriel", precision: "Une fois par jour, groupé le matin" },
  teams: { libelle: "Teams", precision: "Immédiat — à réserver à ce qui ne peut pas attendre" },
};

export type FamilleAlerte =
  | "conformite"
  | "disponibilite"
  | "maintenance"
  | "incidents"
  | "achats"
  | "caisse"
  | "carburant"
  | "chauffeurs"
  | "mentions"
  | "clotures";

export interface DefinitionAlerte {
  cle: FamilleAlerte;
  libelle: string;
  /** Ce qui la déclenche, en une phrase — sans quoi personne ne sait ce qu'il coche. */
  declencheur: string;
  /** L'écran où l'on traite ce que l'alerte annonce. */
  href: string;
  /** Les rôles à qui l'alerte est proposée ; vide, elle l'est à tous. */
  roles?: Role[];
  /** Réglage de départ : ce qu'un nouveau compte reçoit sans rien toucher. */
  defaut: Canal[];
}

export const ALERTES: DefinitionAlerte[] = [
  {
    cle: "conformite",
    libelle: "Échéances de documents",
    declencheur: "Un document de véhicule ou de chauffeur approche de son terme, ou l'a dépassé",
    href: "/conformite",
    defaut: ["application", "courriel"],
  },
  {
    cle: "disponibilite",
    libelle: "Véhicule immobilisé",
    declencheur: "Un véhicule sort des opérationnels — statut déclaré ou document critique échu",
    href: "/disponibilite",
    defaut: ["application", "teams"],
  },
  {
    cle: "maintenance",
    libelle: "Entretien dû et ordres de travail",
    declencheur: "Une échéance du plan d'entretien est atteinte, ou un ordre change d'état",
    href: "/maintenance",
    defaut: ["application"],
  },
  {
    cle: "incidents",
    libelle: "Accidents et incidents",
    declencheur: "Une déclaration est enregistrée, ou son suivi avance",
    href: "/incidents",
    defaut: ["application", "teams"],
  },
  {
    cle: "achats",
    libelle: "Demandes d'achat à décider",
    declencheur: "Une demande attend votre visa, votre validation, ou change d'étape",
    href: "/caisse?vue=achats",
    defaut: ["application", "courriel"],
  },
  {
    cle: "caisse",
    libelle: "Caisse parc",
    declencheur: "Une dépense reste à régler, ou une sortie part sans justificatif",
    href: "/caisse",
    roles: ["administrateur", "direction", "controle-de-gestion", "gestionnaire-parc"],
    defaut: ["application"],
  },
  {
    cle: "carburant",
    libelle: "Carburant et cuve",
    declencheur: "La cuve passe sous le seuil, ou un véhicule dérive de sa référence",
    href: "/carburant",
    defaut: ["application"],
  },
  {
    cle: "chauffeurs",
    libelle: "Chauffeurs",
    declencheur: "Un permis ou une visite médicale arrive à terme, une aptitude change",
    href: "/chauffeurs",
    defaut: ["application", "courriel"],
  },
  {
    cle: "mentions",
    libelle: "Quand on vous cite",
    declencheur: "Quelqu'un vous nomme avec @ dans la discussion d'une fiche",
    href: "/flotte",
    defaut: ["application", "courriel"],
  },
  {
    cle: "clotures",
    libelle: "Clôtures et demandes d'approbation",
    declencheur: "Un mois est clos ou rouvert, une modification sur mois clos attend une décision",
    href: "/parametres/clotures",
    roles: ["administrateur", "direction", "controle-de-gestion", "gestionnaire-parc"],
    defaut: ["application", "courriel"],
  },
];

/** Les alertes proposées à un rôle : celles qui ne le concernent pas ne s'affichent pas. */
export function alertesPour(role: Role): DefinitionAlerte[] {
  return ALERTES.filter((a) => !a.roles || a.roles.includes(role));
}

/* -- Le réglage ---------------------------------------------------------------- */

export interface ReglageAlertes {
  /** Par famille, les canaux retenus. Une famille absente vaut « aucun canal ». */
  canaux: Partial<Record<FamilleAlerte, Canal[]>>;
  /** Jours de prévenance des échéances, du plus lointain au plus proche. */
  prevenance: number[];
  /** Silence complet : rien ne part, la cloche comprise. Le réglage est conservé. */
  silence: boolean;
}

export const PREVENANCE_DEFAUT = [60, 30, 7];

/**
 * Les règles de l'organisation, quand l'administrateur en a posé.
 *
 * `destinataires` dit, famille par famille, quels rôles la reçoivent d'office ;
 * une famille dont le rôle n'est pas destinataire n'est pas poussée à l'ouverture
 * du compte — chacun reste libre de l'activer ensuite. Une liste **vide** vaut
 * « tous les rôles » : c'est le cas des familles qui ne désignent personne en
 * particulier, et c'est le comportement d'avant ce réglage.
 */
export interface ReglesOrganisation {
  destinataires: Partial<Record<FamilleAlerte, Role[]>>;
  prevenance: number[];
}

export function reglageParDefaut(role: Role, regles?: ReglesOrganisation): ReglageAlertes {
  const proposees = alertesPour(role);
  const retenue = (a: DefinitionAlerte) => {
    if (!regles) return true;
    const roles = regles.destinataires[a.cle];
    /* Pas de règle posée, ou une règle qui ne nomme personne : la famille vaut
       pour tous — sans quoi un défaut oublié rendrait l'application muette. */
    return roles === undefined || roles.length === 0 || roles.includes(role);
  };
  return {
    canaux: Object.fromEntries(proposees.map((a) => [a.cle, retenue(a) ? a.defaut : []])),
    prevenance: regles?.prevenance?.length ? regles.prevenance : PREVENANCE_DEFAUT,
    silence: false,
  };
}

/** Vrai si l'alerte doit partir sur ce canal, silence compris. */
export function recoit(reglage: ReglageAlertes, famille: FamilleAlerte, canal: Canal): boolean {
  if (reglage.silence) return false;
  return (reglage.canaux[famille] ?? []).includes(canal);
}

/** Le nombre de familles dont au moins un canal est retenu — le résumé de l'écran. */
export function famillesActives(reglage: ReglageAlertes): number {
  return Object.values(reglage.canaux).filter((c) => (c ?? []).length > 0).length;
}

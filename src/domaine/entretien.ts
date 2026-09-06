/* ============================================================================
 * Le plan d'entretien — ce qui est prévu, avant ce qui a été fait.
 *
 * Demande du métier du 4 septembre 2026 : « prévoir un programme de maintenance
 * standard à définir par type de véhicule (au kilométrage, ou horaire), et
 * l'appliquer à un véhicule, avec possibilité de l'ajuster de façon spécifique.
 * À suivre aussi en alerte. »
 *
 * Trois objets, et c'est leur enchaînement qui fait le module :
 *
 *  1. le **programme** — un gabarit par type de véhicule : un poids lourd de
 *     vrac ne s'entretient pas comme une camionnette de livraison, et un engin
 *     de manutention ne compte pas des kilomètres mais des **heures** ;
 *  2. le **plan appliqué** — le programme rattaché à un véhicule, avec ses
 *     **ajustements** : un camion qui roule sur piste vidange plus souvent que
 *     le gabarit ne le dit, et l'atelier doit pouvoir l'écrire sans toucher au
 *     gabarit des autres ;
 *  3. l'**échéance** — ce que le plan devient une fois confronté au compteur et
 *     à l'historique : dans combien de kilomètres, dans combien de jours, et
 *     surtout **est-ce dépassé**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * **Le cas qu'on ne doit pas escamoter.** Beaucoup d'opérations n'ont *aucun*
 * passage dans l'historique : ni le graissage du châssis, ni l'huile de pont
 * n'apparaissent dans les interventions relevées. Deux lectures possibles, et
 * l'application ne peut pas trancher à la place du métier : ou bien l'opération
 * n'a jamais été faite, ou bien elle a été faite sans être écrite.
 *
 * D'où un état à part, `sans-reference` : ni « à jour » — ce serait mentir —,
 * ni « en retard » — ce serait crier au loup sur toute la flotte le premier
 * jour. Il dit ce qu'il sait : *on ne peut pas se prononcer, il faut aller
 * voir*. C'est un chiffre à poser sur la table, pas une alarme.
 * ==========================================================================*/

import type { Ton } from "./libelles";
import type { CategorieVehicule } from "./types";

/* -- Les opérations --------------------------------------------------------- */

export type GroupeOperation = "moteur" | "freinage" | "pneumatiques" | "transmission" | "securite" | "chassis";

export const GROUPE_OPERATION: Record<GroupeOperation, string> = {
  moteur: "Moteur",
  freinage: "Freinage",
  pneumatiques: "Pneumatiques",
  transmission: "Transmission",
  securite: "Sécurité",
  chassis: "Châssis et carrosserie",
};

/**
 * La périodicité d'une opération. Les trois bases coexistent et **la première
 * atteinte l'emporte** : une vidange se fait aux 15 000 km ou tous les douze
 * mois, selon ce qui arrive d'abord — un véhicule peu roulé vieillit quand
 * même. Nulle veut dire « cette base ne compte pas pour cette opération ».
 */
export interface Periodicite {
  km: number | null;
  heures: number | null;
  mois: number | null;
}

export interface OperationEntretien {
  /** Stable, il sert de clé d'ajustement et de rapprochement : « vidange-moteur ». */
  code: string;
  libelle: string;
  groupe: GroupeOperation;
  periodicite: Periodicite;
  /**
   * Ce qui, dans l'objet d'une intervention, dit qu'elle a réalisé cette
   * opération. En production l'intervention citera le code ; ici l'historique
   * est du texte libre, et c'est à lui qu'on se raccroche.
   */
  motsCles: string[];
  /** Immobilisation attendue, en heures d'atelier : de quoi remplir un ordre de travail. */
  dureeHeures: number;
  coutEstime: number;
  /** Une opération de sécurité ne se reporte pas : elle passe en retard sans délai de grâce. */
  critique: boolean;
}

export interface ProgrammeEntretien {
  code: string;
  libelle: string;
  precision: string;
  /** Les catégories auxquelles le programme s'applique par défaut. */
  categories: CategorieVehicule[];
  /** Ce que ce type de véhicule compte : des kilomètres, ou des heures. */
  base: "km" | "heures";
  operations: OperationEntretien[];
}

/* -- L'ajustement, véhicule par véhicule ------------------------------------ */

/**
 * Ce qu'un véhicule change au gabarit. Un ajustement porte toujours un
 * **motif** : une périodicité resserrée sans raison écrite se retourne contre
 * l'atelier à la première discussion de coût.
 */
export interface AjustementOperation {
  code: string;
  km?: number | null;
  heures?: number | null;
  mois?: number | null;
  /** Vrai quand l'opération ne concerne pas ce véhicule — pas de boîte sur une remorque. */
  retiree?: boolean;
  motif: string;
}

export interface PlanVehicule {
  vehiculeId: string;
  programmeCode: string;
  ajustements: AjustementOperation[];
}

/** La périodicité retenue : celle du gabarit, recouverte par l'ajustement. */
export function periodiciteAppliquee(op: OperationEntretien, ajustement: AjustementOperation | undefined): Periodicite {
  if (!ajustement) return op.periodicite;
  return {
    km: ajustement.km !== undefined ? ajustement.km : op.periodicite.km,
    heures: ajustement.heures !== undefined ? ajustement.heures : op.periodicite.heures,
    mois: ajustement.mois !== undefined ? ajustement.mois : op.periodicite.mois,
  };
}

/** Vrai si l'ajustement change réellement quelque chose au gabarit. */
export function estAjustee(op: OperationEntretien, ajustement: AjustementOperation | undefined): boolean {
  if (!ajustement) return false;
  const p = periodiciteAppliquee(op, ajustement);
  return p.km !== op.periodicite.km || p.heures !== op.periodicite.heures || p.mois !== op.periodicite.mois;
}

/** Ce qui, dans l'objet d'une intervention, désigne cette opération. */
export function reconnaitOperation(op: OperationEntretien, objet: string): boolean {
  const texte = objet.toLowerCase();
  return op.motsCles.some((mot) => texte.includes(mot));
}

/* -- L'échéance ------------------------------------------------------------- */

export type EtatEcheance = "en-retard" | "a-planifier" | "a-venir" | "sans-reference";

export const ETAT_ECHEANCE: Record<EtatEcheance, { libelle: string; precision: string; ton: Ton }> = {
  "en-retard": { libelle: "Dépassée", precision: "Le véhicule roule au-delà de la périodicité prévue", ton: "defavorable" },
  "a-planifier": { libelle: "À planifier", precision: "L'échéance arrive : à programmer à l'atelier", ton: "vigilance" },
  "a-venir": { libelle: "À venir", precision: "Rien à faire tout de suite", ton: "favorable" },
  "sans-reference": { libelle: "Aucun passage relevé", precision: "L'historique ne porte aucune trace de cette opération : à vérifier sur le véhicule", ton: "neutre" },
};

/** En deçà, l'échéance passe « à planifier ». Repris de la maintenance curative. */
export const SEUIL_KM_ECHEANCE = 1_500;
export const SEUIL_HEURES_ECHEANCE = 50;
export const SEUIL_JOURS_ECHEANCE = 21;

/** Le dernier passage relevé pour une opération. */
export interface DernierPassage {
  date: string;
  km: number | null;
  heures: number | null;
  /** Le numéro de l'intervention qui l'a réalisée — de quoi remonter à la source. */
  numero: string;
  objet: string;
}

/** L'état du véhicule au moment du calcul. */
export interface CompteursVehicule {
  km: number | null;
  heures: number | null;
  /** Moyenne des relevés : elle convertit des kilomètres restants en jours. */
  kmParJour: number;
  heuresParJour: number;
  /** Sert de repère quand aucune intervention n'a jamais été relevée. */
  miseEnService: string | null;
}

export interface EcheanceEntretien {
  /**
   * La référence de la ligne pour ce véhicule. Une ligne de plan se modifie —
   * on y ajuste une périodicité —, donc elle porte un numéro comme toute chose
   * modifiable dans l'application. Le domaine la laisse vide ; c'est la source
   * de données qui la numérote, stablement par opération.
   */
  numero: string;
  code: string;
  libelle: string;
  groupe: GroupeOperation;
  critique: boolean;
  periodicite: Periodicite;
  ajustee: boolean;
  motifAjustement: string | null;
  dernier: DernierPassage | null;
  /** Le compteur ou la date à laquelle l'opération est due. */
  dueA: { km: number | null; heures: number | null; date: string | null };
  kmRestants: number | null;
  heuresRestantes: number | null;
  joursRestants: number | null;
  /** Ce qui déclenche en premier — c'est cette base qui commande l'état. */
  base: "km" | "heures" | "mois" | null;
  etat: EtatEcheance;
  dureeHeures: number;
  coutEstime: number;
}

/**
 * Le cœur du calcul, isolé pour qu'il ne s'écrive qu'une fois : il sert au
 * calcul initial comme au recalcul, quand l'atelier vient de changer une
 * périodicité et que l'écran doit répondre sans attendre le serveur.
 */
function situer(
  periodicite: Periodicite,
  dernier: DernierPassage | null,
  compteurs: CompteursVehicule,
  aujourdhui: string,
): Pick<EcheanceEntretien, "dueA" | "kmRestants" | "heuresRestantes" | "joursRestants" | "base" | "etat"> {
  const vide = { dueA: { km: null, heures: null, date: null }, kmRestants: null, heuresRestantes: null, joursRestants: null };
  if (!dernier) return { ...vide, base: null, etat: "sans-reference" };

  const dueA: EcheanceEntretien["dueA"] = { km: null, heures: null, date: null };
  let kmRestants: number | null = null;
  let heuresRestantes: number | null = null;
  let joursRestants: number | null = null;

  if (periodicite.km !== null && dernier.km !== null && compteurs.km !== null) {
    dueA.km = dernier.km + periodicite.km;
    kmRestants = dueA.km - compteurs.km;
  }
  if (periodicite.heures !== null && dernier.heures !== null && compteurs.heures !== null) {
    dueA.heures = dernier.heures + periodicite.heures;
    heuresRestantes = dueA.heures - compteurs.heures;
  }
  if (periodicite.mois !== null) {
    dueA.date = ajouterMois(dernier.date, periodicite.mois);
    joursRestants = joursEntre(aujourdhui, dueA.date);
  }

  /* Ramener chaque base à des jours pour les comparer : c'est le temps qui
     décide de l'ordre de passage à l'atelier, pas le kilométrage. */
  const candidats: { base: "km" | "heures" | "mois"; jours: number }[] = [];
  if (kmRestants !== null) candidats.push({ base: "km", jours: kmRestants / Math.max(1, compteurs.kmParJour) });
  if (heuresRestantes !== null) candidats.push({ base: "heures", jours: heuresRestantes / Math.max(0.5, compteurs.heuresParJour) });
  if (joursRestants !== null) candidats.push({ base: "mois", jours: joursRestants });
  if (candidats.length === 0) return { ...vide, base: null, etat: "sans-reference" };

  const premier = candidats.sort((a, b) => a.jours - b.jours)[0]!;
  const depasse =
    (premier.base === "km" && (kmRestants ?? 1) <= 0) ||
    (premier.base === "heures" && (heuresRestantes ?? 1) <= 0) ||
    (premier.base === "mois" && (joursRestants ?? 1) <= 0);
  const proche =
    (kmRestants !== null && kmRestants <= SEUIL_KM_ECHEANCE) ||
    (heuresRestantes !== null && heuresRestantes <= SEUIL_HEURES_ECHEANCE) ||
    (joursRestants !== null && joursRestants <= SEUIL_JOURS_ECHEANCE);

  return { dueA, kmRestants, heuresRestantes, joursRestants, base: premier.base, etat: depasse ? "en-retard" : proche ? "a-planifier" : "a-venir" };
}

/**
 * Une échéance replacée sur une périodicité qu'on vient de changer. Sans elle,
 * l'écran afficherait la nouvelle périodicité à côté de l'ancien état, et la
 * ligne se contredirait sous les yeux de celui qui vient de la régler.
 */
export function recalculerEcheance(e: EcheanceEntretien, periodicite: Periodicite, compteurs: CompteursVehicule, aujourdhui: string): EcheanceEntretien {
  return { ...e, periodicite, ...situer(periodicite, e.dernier, compteurs, aujourdhui) };
}

function joursEntre(depuis: string, jusqua: string): number {
  return Math.round((Date.parse(`${jusqua}T00:00:00Z`) - Date.parse(`${depuis}T00:00:00Z`)) / 86_400_000);
}

function ajouterMois(date: string, mois: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + mois);
  return d.toISOString().slice(0, 10);
}

/**
 * L'échéance d'une opération : dans combien de kilomètres, d'heures, de jours,
 * et dans quel état. Chaque base est calculée pour elle-même, puis **la plus
 * pressante l'emporte** — c'est elle qui décidera de l'entrée en atelier.
 */
export function echeanceOperation(
  op: OperationEntretien,
  ajustement: AjustementOperation | undefined,
  dernier: DernierPassage | null,
  compteurs: CompteursVehicule,
  aujourdhui: string,
): EcheanceEntretien {
  const periodicite = periodiciteAppliquee(op, ajustement);
  const socle: Omit<EcheanceEntretien, "etat" | "base"> = {
    numero: "",
    code: op.code,
    libelle: op.libelle,
    groupe: op.groupe,
    critique: op.critique,
    periodicite,
    ajustee: estAjustee(op, ajustement),
    motifAjustement: ajustement?.motif ?? null,
    dernier,
    dueA: { km: null, heures: null, date: null },
    kmRestants: null,
    heuresRestantes: null,
    joursRestants: null,
    dureeHeures: op.dureeHeures,
    coutEstime: op.coutEstime,
  };

  /* Sans passage relevé, on ne calcule rien : une échéance comptée depuis la
     mise en service donnerait un retard faux de plusieurs années sur une
     opération qui a peut-être été faite sans être écrite. */
  return { ...socle, ...situer(periodicite, dernier, compteurs, aujourdhui) };
}

/** Le plan d'un véhicule, opération par opération, du plus pressant au moins. */
export function echeancesDuPlan(
  programme: ProgrammeEntretien,
  plan: PlanVehicule | null,
  passages: Map<string, DernierPassage>,
  compteurs: CompteursVehicule,
  aujourdhui: string,
): EcheanceEntretien[] {
  const parCode = new Map((plan?.ajustements ?? []).map((a) => [a.code, a]));
  return programme.operations
    .filter((op) => !parCode.get(op.code)?.retiree)
    .map((op) => echeanceOperation(op, parCode.get(op.code), passages.get(op.code) ?? null, compteurs, aujourdhui))
    .sort((a, b) => RANG_ETAT[a.etat] - RANG_ETAT[b.etat] || (a.kmRestants ?? a.joursRestants ?? 1e9) - (b.kmRestants ?? b.joursRestants ?? 1e9));
}

const RANG_ETAT: Record<EtatEcheance, number> = { "en-retard": 0, "a-planifier": 1, "sans-reference": 2, "a-venir": 3 };

/** Ce qui appelle une action : le retard et l'imminent, pas le reste. */
export function appelleUneAction(e: EcheanceEntretien): boolean {
  return e.etat === "en-retard" || e.etat === "a-planifier";
}

/** « dans 850 km », « dépassée de 1 200 km », « dans 12 jours ». */
export function libelleEcheance(e: EcheanceEntretien): string {
  if (e.etat === "sans-reference") return "Aucun passage relevé";
  const nb = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.abs(Math.round(n)));
  if (e.base === "km" && e.kmRestants !== null) return e.kmRestants <= 0 ? `Dépassée de ${nb(e.kmRestants)} km` : `Dans ${nb(e.kmRestants)} km`;
  if (e.base === "heures" && e.heuresRestantes !== null) return e.heuresRestantes <= 0 ? `Dépassée de ${nb(e.heuresRestantes)} h` : `Dans ${nb(e.heuresRestantes)} h`;
  if (e.base === "mois" && e.joursRestants !== null) return e.joursRestants <= 0 ? `Dépassée de ${nb(e.joursRestants)} jours` : `Dans ${nb(e.joursRestants)} jours`;
  return "—";
}

/** « tous les 15 000 km ou 12 mois » — la périodicité, telle qu'on la dit. */
export function libellePeriodicite(p: Periodicite): string {
  const nb = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  const morceaux: string[] = [];
  if (p.km !== null) morceaux.push(`${nb(p.km)} km`);
  if (p.heures !== null) morceaux.push(`${nb(p.heures)} h`);
  if (p.mois !== null) morceaux.push(p.mois === 1 ? "1 mois" : `${p.mois} mois`);
  if (morceaux.length === 0) return "—";
  return `Tous les ${morceaux.join(" ou ")}`;
}

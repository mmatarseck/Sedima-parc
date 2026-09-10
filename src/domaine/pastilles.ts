/* ============================================================================
 * Les pastilles du tableau de bord — l'état du moment, pas la tendance.
 *
 * Décision du métier du 8 septembre 2026 : « contrairement aux courbes, les
 * pastilles doivent en priorité montrer des informations instantanées ou
 * d'une période précédente — la veille, la semaine passée, la semaine en
 * cours — utiles par rapport à maintenant ». Et, le même jour : la référence
 * des états est **hier en fin de journée** ; le seuil du hors service est
 * **en nombre** ; les indicateurs de période restent aux courbes, jamais en
 * pastille.
 *
 * Chaque pastille se calcule sur une **situation journalière** — ce que
 * chaque véhicule et la flotte présentaient à la fin d'un jour — et se
 * compare à la même situation un jour ou une semaine plus tôt. Le rouge
 * n'apparaît qu'au seuil franchi.
 * ==========================================================================*/

import type { CleAxe, Sens } from "./tableau-bord";
import type { StatutVehicule } from "./types";

/** Ce qu'un véhicule présentait à la fin d'un jour. */
export interface FaitsVehiculeJour {
  vehiculeId: string;
  jour: string;
  engage: boolean;
  statut: StatutVehicule;
  /** Un document critique manquant ou échu ce jour-là. */
  immobiliseAdmin: boolean;
  /** Jours d'immobilisation continue à cette date ; 0 si le véhicule roule. */
  immobiliseDepuisJours: number;
  /** Documents et visites qui expirent dans les sept jours suivants. */
  echeances7: number;
  /** Documents dont l'échéance est passée à cette date. */
  echues: number;
  /** Aucun relevé kilométrique valide sur les sept jours qui précèdent. */
  sansReleve7: boolean;
  litres: number;
  carburant: number;
  /** Dépenses du jour, hors amortissement et salaires. */
  depenses: number;
  pannes: number;
  accidents: number;
  /** Opérationnel, avec un titulaire affecté et disponible ce jour-là. */
  pretACharger: boolean;
}

/**
 * Ce que la flotte présentait à la fin d'un jour, hors véhicule. Les ordres,
 * la caisse et la cuve sont nuls tant que leur module n'a pas sa table en
 * base : la pastille montre alors « — » plutôt qu'un zéro qui mentirait.
 */
export interface FaitsFlotteJour {
  jour: string;
  chauffeurs: number;
  chauffeursIndisponibles: number;
  ordresOuverts: number | null;
  /** Ordres ouverts depuis plus de quinze jours. */
  ordresAnciens: number | null;
  soldeCaisse: number | null;
  seuilCaisse: number | null;
  cuveLitres: number | null;
  /** Jours d'autonomie de la cuve au rythme des sept derniers jours ; nul sans sortie. */
  cuveJours: number | null;
  /** Jours écoulés depuis le dernier accident ; nul sans accident connu. */
  joursSansAccident: number | null;
  /** Demandes poussées aux détenteurs, échues et sans réponse à la fin du jour ; nul tant que le module n'est pas lu. */
  demandesSansReponse: number | null;
}

export interface SituationJournaliere {
  jour: string;
  vehicules: FaitsVehiculeJour[];
  flotte: FaitsFlotteJour;
}

export type Moment = "instant" | "semaine" | "7-jours";

export const MOMENT: Record<Moment, string> = { instant: "instant", semaine: "depuis lundi", "7-jours": "7 jours" };

export type Reference = "hier" | "semaine-passee" | "aucune";

/** Ce que la pastille reçoit : la situation du jour, celles qui précèdent, et la date. */
export interface ContextePastille {
  /** Les situations, du plus ancien au plus récent ; la dernière est le jour évalué. */
  jours: SituationJournaliere[];
  /** Le jour évalué : aujourd'hui, ou une date passée pour la référence et la mini-courbe. */
  jour: SituationJournaliere;
  /** Les situations depuis le lundi de la semaine du jour évalué, jour compris. */
  depuisLundi: SituationJournaliere[];
}

export interface DefinitionPastille {
  id: string;
  axe: CleAxe;
  libelle: string;
  moment: Moment;
  unite?: string;
  decimales?: number;
  reference: Reference;
  /**
   * Le seuil au-delà duquel la pastille passe au rouge ; en nombre, jamais en
   * part. La valeur livrée est un défaut : le métier la règle dans Paramètres
   * › Pastilles, et le texte se refait sur la valeur réglée.
   */
  seuil?: { sens: Sens; defaut: number; texte: (valeur: number) => string };
  /** Le texte du pied quand la pastille n'a pas de seuil réglable. */
  seuilTexte?: string;
  /** L'écran qui explique le chiffre. */
  href: string;
  calcul: (c: ContextePastille) => number | null;
  /** Ce qui complète la valeur : « / 47 engagés », « dont 2 échues ». */
  complement?: (c: ContextePastille) => string | null;
  /** Le rouge, quand il ne se lit pas sur la valeur et son seuil : une échéance passée, une caisse sous son propre seuil, un ordre trop ancien. */
  alerte?: (c: ContextePastille, seuil: number | null) => boolean;
}

/* Les textes de seuil : « Rouge dès le premier » à zéro, sinon le nombre. */
const desLePremier = (unite: string) => (v: number) => (v <= 0 ? "Rouge dès le premier" : `Seuil : ${v} ${unite}`);
const sous = (unite: string) => (v: number) => `Rouge sous ${v} ${unite}`;

const OPERATIONNELS = new Set<StatutVehicule>(["en-service", "en-backup"]);
const engagesDu = (s: SituationJournaliere) => s.vehicules.filter((v) => v.engage);
const somme = (jours: SituationJournaliere[], f: (v: FaitsVehiculeJour) => number) => jours.reduce((t, s) => t + s.vehicules.reduce((u, v) => u + f(v), 0), 0);

export const PASTILLES: DefinitionPastille[] = [
  {
    id: "p-hors-service",
    axe: "D",
    libelle: "Hors service",
    moment: "instant",
    reference: "hier",
    seuil: { sens: "inf", defaut: 5, texte: desLePremier("véhicules") },
    href: "/disponibilite",
    calcul: (c) => engagesDu(c.jour).filter((v) => !OPERATIONNELS.has(v.statut) || v.immobiliseAdmin).length,
    complement: (c) => `/ ${engagesDu(c.jour).length} engagés`,
  },
  {
    id: "p-prets",
    axe: "D",
    libelle: "Prêts à charger",
    moment: "instant",
    reference: "hier",
    seuil: { sens: "sup", defaut: 30, texte: sous("véhicules prêts") },
    href: "/disponibilite",
    calcul: (c) => engagesDu(c.jour).filter((v) => v.pretACharger && !v.immobiliseAdmin).length,
    complement: (c) => `/ ${engagesDu(c.jour).length}`,
  },
  {
    id: "p-immobilises-7",
    axe: "D",
    libelle: "Immobilisés > 7 jours",
    moment: "instant",
    reference: "semaine-passee",
    seuil: { sens: "inf", defaut: 0, texte: desLePremier("véhicules") },
    href: "/maintenance",
    calcul: (c) => engagesDu(c.jour).filter((v) => v.immobiliseDepuisJours > 7).length,
  },
  {
    id: "p-pannes-semaine",
    axe: "D",
    libelle: "Pannes",
    moment: "semaine",
    reference: "semaine-passee",
    seuil: { sens: "inf", defaut: 3, texte: desLePremier("pannes par semaine") },
    href: "/incidents",
    calcul: (c) => somme(c.depuisLundi, (v) => v.pannes),
  },
  {
    id: "p-jours-sans-accident",
    axe: "S",
    libelle: "Jours sans accident",
    moment: "instant",
    unite: "j",
    reference: "aucune",
    seuil: { sens: "sup", defaut: 7, texte: sous("jours") },
    href: "/incidents",
    calcul: (c) => c.jour.flotte.joursSansAccident,
  },
  {
    id: "p-accidents-semaine",
    axe: "S",
    libelle: "Accidents",
    moment: "semaine",
    reference: "semaine-passee",
    seuil: { sens: "inf", defaut: 0, texte: desLePremier("accidents par semaine") },
    href: "/incidents",
    calcul: (c) => somme(c.depuisLundi, (v) => v.accidents),
  },
  {
    id: "p-echeances-7",
    axe: "Q",
    libelle: "Échéances",
    moment: "7-jours",
    reference: "semaine-passee",
    seuilTexte: "Rouge dès qu'une échéance est passée",
    href: "/conformite",
    /* La valeur compte ce qui expire ; le rouge, lui, ne se déclenche que sur
       une échéance déjà passée — c'est le complément qui la dit. */
    calcul: (c) => c.jour.vehicules.reduce((t, v) => t + v.echeances7, 0),
    alerte: (c) => c.jour.vehicules.some((v) => v.echues > 0),
    complement: (c) => {
      const echues = c.jour.vehicules.reduce((t, v) => t + v.echues, 0);
      return echues ? `dont ${echues} échue${echues > 1 ? "s" : ""}` : "aucune échue";
    },
  },
  {
    id: "p-immobilises-admin",
    axe: "Q",
    libelle: "Immobilisés administrativement",
    moment: "instant",
    reference: "hier",
    seuil: { sens: "inf", defaut: 0, texte: desLePremier("véhicules") },
    href: "/conformite",
    calcul: (c) => engagesDu(c.jour).filter((v) => v.immobiliseAdmin).length,
  },
  {
    id: "p-sans-releve",
    axe: "Q",
    libelle: "Sans relevé depuis 7 jours",
    moment: "instant",
    reference: "semaine-passee",
    seuil: { sens: "inf", defaut: 5, texte: desLePremier("véhicules") },
    href: "/flotte",
    calcul: (c) => engagesDu(c.jour).filter((v) => v.sansReleve7).length,
  },
  {
    id: "p-carburant-semaine",
    axe: "C",
    libelle: "Carburant",
    moment: "semaine",
    unite: "L",
    reference: "semaine-passee",
    seuilTexte: "Pas de seuil : à lire contre la semaine passée",
    href: "/carburant",
    calcul: (c) => somme(c.depuisLundi, (v) => v.litres),
    complement: (c) => {
      const f = somme(c.depuisLundi, (v) => v.carburant);
      return f ? `${Math.round(f / 1000)} kF` : null;
    },
  },
  {
    id: "p-cuve",
    axe: "C",
    libelle: "Autonomie de la cuve",
    moment: "instant",
    unite: "j",
    reference: "hier",
    seuil: { sens: "sup", defaut: 5, texte: sous("jours d'autonomie") },
    href: "/carburant",
    calcul: (c) => c.jour.flotte.cuveJours,
    complement: (c) => (c.jour.flotte.cuveLitres === null ? null : `${Math.round(c.jour.flotte.cuveLitres).toLocaleString("fr-FR")} l en cuve`),
  },
  {
    id: "p-caisse",
    axe: "C",
    libelle: "Caisse parc",
    moment: "instant",
    unite: "kF",
    reference: "hier",
    seuilTexte: "Rouge sous le seuil de réapprovisionnement",
    href: "/caisse",
    calcul: (c) => (c.jour.flotte.soldeCaisse === null ? null : Math.round(c.jour.flotte.soldeCaisse / 1000)),
    alerte: (c) => c.jour.flotte.soldeCaisse !== null && c.jour.flotte.seuilCaisse !== null && c.jour.flotte.soldeCaisse < c.jour.flotte.seuilCaisse,
    complement: (c) => (c.jour.flotte.seuilCaisse === null ? null : `seuil ${Math.round(c.jour.flotte.seuilCaisse / 1000)} kF`),
  },
  {
    id: "p-depenses-semaine",
    axe: "C",
    libelle: "Dépenses",
    moment: "semaine",
    unite: "kF",
    reference: "semaine-passee",
    seuilTexte: "Pas de seuil : à lire contre la semaine passée",
    href: "/caisse",
    calcul: (c) => Math.round(somme(c.depuisLundi, (v) => v.depenses) / 1000),
  },
  {
    id: "p-chauffeurs-indisponibles",
    axe: "M",
    libelle: "Chauffeurs indisponibles",
    moment: "instant",
    reference: "hier",
    seuil: { sens: "inf", defaut: 3, texte: desLePremier("chauffeurs") },
    href: "/chauffeurs",
    calcul: (c) => c.jour.flotte.chauffeursIndisponibles,
    complement: (c) => `/ ${c.jour.flotte.chauffeurs}`,
  },
  {
    id: "p-ordres-ouverts",
    axe: "M",
    libelle: "Ordres de travail ouverts",
    moment: "instant",
    reference: "semaine-passee",
    seuil: { sens: "inf", defaut: 0, texte: (v) => (v <= 0 ? "Rouge dès qu'un ordre a plus de 15 jours" : `Seuil : ${v} ordres de plus de 15 jours`) },
    href: "/maintenance",
    calcul: (c) => c.jour.flotte.ordresOuverts,
    /* Le seuil compte les ordres anciens, pas les ouverts : un ordre du jour n'est pas une alerte. */
    alerte: (c, seuil) => (c.jour.flotte.ordresAnciens ?? 0) > (seuil ?? 0),
    complement: (c) => (c.jour.flotte.ordresAnciens === null ? null : c.jour.flotte.ordresAnciens ? `dont ${c.jour.flotte.ordresAnciens} de plus de 15 j` : "aucun de plus de 15 j"),
  },
  {
    id: "p-demandes-sans-reponse",
    axe: "M",
    libelle: "Demandes sans réponse",
    moment: "instant",
    reference: "hier",
    seuil: { sens: "inf", defaut: 0, texte: desLePremier("demandes") },
    href: "/demandes",
    /* Une demande poussée à un détenteur, échue et toujours sans réponse (module des demandes, 8 septembre 2026). */
    calcul: (c) => c.jour.flotte.demandesSansReponse,
  },
];

export const PASTILLE_PAR_ID = new Map(PASTILLES.map((p) => [p.id, p]));

/** Les seuils livrés, par pastille — ce que Paramètres › Pastilles règle. */
export const SEUILS_DEFAUT: Record<string, number> = Object.fromEntries(PASTILLES.filter((p) => p.seuil).map((p) => [p.id, p.seuil!.defaut]));

/** Le seuil en vigueur d'une pastille : celui réglé, sinon celui livré ; nul si elle n'en a pas. */
export function seuilDe(p: DefinitionPastille, seuils: Record<string, number> = SEUILS_DEFAUT): number | null {
  if (!p.seuil) return null;
  const v = seuils[p.id];
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : p.seuil.defaut;
}

/** Le pied de pastille : le seuil en clair, ou le texte fixe d'une pastille sans seuil. */
export function texteSeuil(p: DefinitionPastille, seuil: number | null): string {
  if (p.seuil && seuil !== null) return p.seuil.texte(seuil);
  return p.seuilTexte ?? "";
}

export const MAX_PASTILLES = 6;

/**
 * Le défaut retenu le 8 septembre 2026, porté à six le 10 septembre à la
 * demande du métier. Le sixième complète les cinq axes : D, D, Q, C, S — il
 * manquait **M**, et les chauffeurs indisponibles sont l'état du moment qui
 * s'y rattache le plus directement.
 */
export const PASTILLES_DEFAUT = ["p-hors-service", "p-prets", "p-echeances-7", "p-carburant-semaine", "p-jours-sans-accident", "p-chauffeurs-indisponibles"];

/** Une sélection relue du stockage, bornée à la rangée. Les anciens identifiants d'indicateurs de période sont ignorés. */
export function limiterPastilles(selection: string[]): string[] {
  return selection.filter((id) => PASTILLE_PAR_ID.has(id)).slice(0, MAX_PASTILLES);
}

/* -- L'évaluation --------------------------------------------------------- */

/** Le lundi de la semaine d'un jour (ISO). */
export function lundiDe(jour: string): string {
  const d = new Date(`${jour}T00:00:00Z`);
  const decalage = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - decalage);
  return d.toISOString().slice(0, 10);
}

/** Le contexte d'une pastille pour le jour d'indice `i` dans la série. */
export function contexteA(jours: SituationJournaliere[], i: number): ContextePastille | null {
  const jour = jours[i];
  if (!jour) return null;
  const lundi = lundiDe(jour.jour);
  return { jours: jours.slice(0, i + 1), jour, depuisLundi: jours.slice(0, i + 1).filter((s) => s.jour >= lundi) };
}

export interface ValeurPastille {
  definition: DefinitionPastille;
  valeur: number | null;
  complement: string | null;
  /** La valeur de référence — hier en fin de journée, ou la semaine passée au même jour. */
  reference: number | null;
  referenceTexte: string;
  /** Le seuil en vigueur, réglé ou livré ; nul pour une pastille sans seuil. */
  seuil: number | null;
  seuilTexte: string;
  /** Vrai quand le seuil est franchi. */
  alerte: boolean;
}

/**
 * Le franchissement du seuil : au sens « inf », la valeur doit rester
 * inférieure ou égale au seuil ; au sens « sup », supérieure ou égale.
 * Les seuils à zéro se lisent « rouge dès le premier ».
 */
export function seuilFranchi(p: DefinitionPastille, valeur: number | null, seuil: number | null): boolean {
  if (valeur === null || !p.seuil || seuil === null) return false;
  return p.seuil.sens === "inf" ? valeur > seuil : valeur < seuil;
}

/** Évalue une pastille au dernier jour de la série, avec sa référence et son seuil réglé. */
export function evaluerPastille(p: DefinitionPastille, jours: SituationJournaliere[], seuils: Record<string, number> = SEUILS_DEFAUT): ValeurPastille {
  const seuil = seuilDe(p, seuils);
  const dernier = jours.length - 1;
  const a = (i: number) => {
    const c = contexteA(jours, i);
    return c ? p.calcul(c) : null;
  };
  const ctx = contexteA(jours, dernier);
  const valeur = ctx ? p.calcul(ctx) : null;
  const decalage = p.reference === "hier" ? 1 : p.reference === "semaine-passee" ? 7 : 0;
  const reference = decalage ? a(dernier - decalage) : null;
  let referenceTexte = "";
  if (p.reference !== "aucune" && valeur !== null && reference !== null) {
    const decimales = p.decimales ?? 0;
    const diff = Number((valeur - reference).toFixed(decimales));
    const unite = p.unite ? ` ${p.unite}` : "";
    /* La flèche de la pastille dit déjà le sens : le texte n'a plus à écrire
       « de moins que la semaine passée » (38 caractères, qui se coupaient sur
       une carte de 151 px). Il ne garde que l'écart et la période. La phrase
       entière vit dans l'infobulle de la carte, où la place ne manque pas. */
    const ecart = `${Math.abs(diff).toLocaleString("fr-FR", { maximumFractionDigits: decimales })}${unite}`;
    referenceTexte = p.reference === "hier" ? (diff === 0 ? "comme hier" : `${ecart} · hier`) : diff === 0 ? "comme la semaine passée" : `${ecart} · sem. passée`;
  } else if (p.reference !== "aucune") referenceTexte = "pas de référence";
  const alerte = p.alerte && ctx ? p.alerte(ctx, seuil) : seuilFranchi(p, valeur, seuil);
  return { definition: p, valeur, complement: ctx && p.complement ? p.complement(ctx) : null, reference, referenceTexte, seuil, seuilTexte: texteSeuil(p, seuil), alerte };
}

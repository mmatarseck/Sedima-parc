/* ============================================================================
 * Réglages d'un rapport, par profil utilisateur.
 *
 * Demande du métier du 4 septembre 2026 : « possibilité de conserver les
 * réglages par profil utilisateur ». Un gestionnaire de parc ouvre trois
 * rapports par semaine et refait chaque fois les mêmes gestes — choisir sa
 * période, masquer six colonnes, en déplacer deux, poser deux filtres. Ces
 * gestes sont son réglage : ils doivent survivre à la fermeture de l'onglet.
 *
 * Deux niveaux, volontairement :
 *  - le **dernier état** de chaque rapport, retenu sans qu'on le demande —
 *    on rouvre le rapport comme on l'a laissé ;
 *  - des **vues enregistrées**, nommées, que l'on rappelle d'un clic —
 *    « Camions Aliment 3 mois », « Documents échus ».
 *
 * Le tout est rangé par compte : deux personnes sur le même poste n'ont pas
 * les mêmes réglages. Aujourd'hui dans le navigateur, sous une clé qui porte
 * le rôle ; demain dans une table `preference_rapport` côté Supabase, avec la
 * même forme — c'est pourquoi rien ici ne dépend du stockage local au-delà de
 * `lire` et `ecrire`.
 * ==========================================================================*/

import type { Periode } from "@/domaine/periodes";
import type { Perimetre } from "@/domaine/couts";
import type { ColonneRapport } from "@/domaine/rapports";

/** Ce qu'une facette retient : la colonne, et les valeurs cochées. */
export type Facettes = Record<string, string[]>;

export interface ReglageRapport {
  /** Les colonnes visibles, **dans l'ordre voulu** — l'ordre est un réglage à part entière. */
  colonnes: string[];
  facettes: Facettes;
  periode: Periode;
  perimetre: Perimetre;
  tri: { cle: string; sens: "asc" | "desc" } | null;
}

export interface VueEnregistree extends ReglageRapport {
  id: string;
  nom: string;
  /** Horodatage de l'enregistrement, pour trier de la plus récente à la plus ancienne. */
  date: string;
}

const CLE_ETAT = "sedima.parc.rapports.etat";
const CLE_VUES = "sedima.parc.rapports.vues";

function lire<T>(cle: string, defaut: T): T {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : defaut;
  } catch {
    return defaut;
  }
}

function ecrire(cle: string, valeur: unknown): void {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* sans stockage, le réglage ne vaut que pour la session */
  }
}

/* -- L'ordre et la visibilité des colonnes ----------------------------------- */

/**
 * L'ordre de départ : celui du catalogue, colonnes par défaut d'abord.
 * L'identifiant reste en tête — c'est lui qui nomme la ligne.
 */
export function colonnesInitiales(colonnes: ColonneRapport[], identifiant: string): string[] {
  const retenues = colonnes.filter((c) => c.parDefaut || c.cle === identifiant).map((c) => c.cle);
  return [identifiant, ...retenues.filter((c) => c !== identifiant)];
}

/**
 * Un ordre enregistré, remis d'aplomb sur le catalogue du jour : les colonnes
 * disparues sont retirées, celles apparues depuis prennent leur place à la fin
 * si elles étaient visibles par défaut. Sans cela, une colonne ajoutée après
 * coup resterait invisible pour tous ceux qui ont déjà réglé leur affichage —
 * ils croiraient à un oubli.
 */
function reconcilier(enregistrees: string[], colonnes: ColonneRapport[], identifiant: string): string[] {
  const existantes = new Set(colonnes.map((c) => c.cle));
  const retenues = enregistrees.filter((c) => existantes.has(c));
  const connues = new Set(enregistrees);
  const nouvelles = colonnes.filter((c) => !connues.has(c.cle) && c.parDefaut).map((c) => c.cle);
  const tout = [...retenues, ...nouvelles];
  return tout.includes(identifiant) ? [identifiant, ...tout.filter((c) => c !== identifiant)] : [identifiant, ...tout];
}

/* -- Le dernier état d'un rapport --------------------------------------------- */

type Etats = Record<string, ReglageRapport>;

function cleEtat(compte: string): string {
  return `${CLE_ETAT}.${compte}`;
}

export function lireEtat(compte: string, rapportId: string, colonnes: ColonneRapport[], identifiant: string, defaut: ReglageRapport): ReglageRapport {
  const etats = lire<Etats>(cleEtat(compte), {});
  const e = etats[rapportId];
  if (!e) return defaut;
  return {
    colonnes: Array.isArray(e.colonnes) && e.colonnes.length ? reconcilier(e.colonnes, colonnes, identifiant) : defaut.colonnes,
    facettes: e.facettes && typeof e.facettes === "object" ? e.facettes : {},
    periode: e.periode ?? defaut.periode,
    perimetre: e.perimetre === "complet" ? "complet" : "exploitation",
    tri: e.tri ?? null,
  };
}

export function ecrireEtat(compte: string, rapportId: string, reglage: ReglageRapport): void {
  const etats = lire<Etats>(cleEtat(compte), {});
  etats[rapportId] = reglage;
  ecrire(cleEtat(compte), etats);
}

export function oublierEtat(compte: string, rapportId: string): void {
  const etats = lire<Etats>(cleEtat(compte), {});
  delete etats[rapportId];
  ecrire(cleEtat(compte), etats);
}

/* -- Les vues enregistrées ---------------------------------------------------- */

type Vues = Record<string, VueEnregistree[]>;

function cleVues(compte: string): string {
  return `${CLE_VUES}.${compte}`;
}

export function lireVues(compte: string, rapportId: string, colonnes: ColonneRapport[], identifiant: string): VueEnregistree[] {
  const toutes = lire<Vues>(cleVues(compte), {});
  return (toutes[rapportId] ?? [])
    .filter((v) => v && typeof v.nom === "string")
    .map((v) => ({ ...v, colonnes: reconcilier(v.colonnes ?? [], colonnes, identifiant), facettes: v.facettes ?? {} }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export function enregistrerVue(compte: string, rapportId: string, nom: string, reglage: ReglageRapport): VueEnregistree {
  const toutes = lire<Vues>(cleVues(compte), {});
  const liste = toutes[rapportId] ?? [];
  const vue: VueEnregistree = { ...reglage, id: `vue-${Date.now().toString(36)}`, nom: nom.trim(), date: new Date().toISOString() };
  /* Un même nom remplace : on corrige une vue, on n'en accumule pas trois versions. */
  toutes[rapportId] = [vue, ...liste.filter((v) => v.nom.toLowerCase() !== vue.nom.toLowerCase())];
  ecrire(cleVues(compte), toutes);
  return vue;
}

export function supprimerVue(compte: string, rapportId: string, id: string): void {
  const toutes = lire<Vues>(cleVues(compte), {});
  toutes[rapportId] = (toutes[rapportId] ?? []).filter((v) => v.id !== id);
  ecrire(cleVues(compte), toutes);
}

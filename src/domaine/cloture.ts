/* ============================================================================
 * Clôture des mois et suivi des modifications.
 *
 * Décision du métier du 3 septembre 2026 :
 *  - toute transaction est modifiable, et chaque modification est tracée — qui,
 *    quand, quel champ, de quoi à quoi, et pourquoi ;
 *  - un rôle supérieur clôture un mois ; dès lors, aucune transaction datée de
 *    ce mois ne change sans son approbation. La modification devient une
 *    demande, qu'il approuve ou refuse.
 *
 * Ce fichier porte les règles ; le stockage de démonstration est dans
 * src/lib/clotures-demo.ts. En production : tables `cloture_mois`,
 * `modification` (journal d'audit, jamais purgé) et `demande_modification`,
 * avec une politique RLS qui refuse l'écriture directe sur un mois clos.
 * ==========================================================================*/

import type { Role } from "./roles";
import { trouverRole } from "./roles";
import type { TypeTransaction } from "./reference";

/** Qui peut clôturer un mois, le rouvrir, et approuver une modification sur un mois clos. */
export const ROLES_CLOTURANT: Role[] = ["direction", "administrateur"];

export function peutCloturer(role: Role | null | undefined): boolean {
  return ROLES_CLOTURANT.includes(trouverRole(role).role);
}

export interface ClotureMois {
  /** « 2026-08 ». */
  mois: string;
  closLe: string;
  closPar: string;
  closParId: string;
  commentaire: string | null;
}

/** « 2026-08-14 » → « 2026-08 ». Une date-heure ISO convient aussi. */
export function moisDe(dateIso: string): string {
  return dateIso.slice(0, 7);
}

/* -- Ce qui se modifie ------------------------------------------------------- */

/**
 * « reference » : le numéro d'une autre transaction, choisi dans l'index et
 * contrôlé — jamais un texte libre (demande du métier du 3 septembre 2026 :
 * « être sûr du rattachement »).
 */
/** « suggestion » : un texte libre, avec une liste proposée — la marque, le modèle. */
export type TypeChamp = "texte" | "texte-long" | "nombre" | "date" | "choix" | "oui-non" | "reference" | "suggestion" | "photo";

export interface ChampEdition {
  cle: string;
  libelle: string;
  type: TypeChamp;
  options?: { valeur: string; libelle: string }[];
  /** Pour un champ « suggestion » dont la liste dépend d'un autre : les modèles de la marque choisie. */
  suggestionsDe?: (saisie: Record<string, string | boolean>) => { valeur: string; libelle: string }[];
  /** Pour un champ « reference » : les types de transaction acceptés ; tous si absent. */
  references?: TypeTransaction[];
  /** Unité affichée après un nombre : « F », « km », « L ». */
  unite?: string;
  obligatoire?: boolean;
}

/** Une modification appliquée ou demandée sur un champ d'une transaction. */
export interface Modification {
  id: string;
  numero: string;
  type: TypeTransaction;
  /** ISO, à la seconde. */
  date: string;
  auteurId: string;
  auteur: string;
  initiales: string;
  champ: string;
  libelleChamp: string;
  avant: string;
  apres: string;
  motif: string;
  statut: "appliquee" | "en-attente" | "refusee";
  /** Renseigné quand la modification portait sur un mois clos. */
  moisClos: string | null;
  decideePar: string | null;
  decideeLe: string | null;
  commentaireDecision: string | null;
}

/** Une demande groupe les champs modifiés en une seule fois sur une transaction. */
export interface DemandeModification {
  id: string;
  numero: string;
  type: TypeTransaction;
  titre: string;
  href: string;
  mois: string;
  date: string;
  auteurId: string;
  auteur: string;
  initiales: string;
  motif: string;
  modifications: { champ: string; libelleChamp: string; avant: string; apres: string; valeur: unknown }[];
  statut: "en-attente" | "approuvee" | "refusee";
  decideePar: string | null;
  decideeLe: string | null;
  commentaireDecision: string | null;
}

/** Le champ qui porte la date d'une transaction — celui qui décide de son mois. */
export const CHAMP_DATE: Record<TypeTransaction, string> = {
  /* Un affrètement se rattache au mois de la mission, pas à celui de la
     facture : c'est le transport qui est la charge, la facture n'en est que
     le constat. Une ligne de grille se rattache au mois de son entrée en
     vigueur. */
  affretement: "date",
  tarif: "debut",
  /* La mise à disposition se facture au mois : son mois est le sien. */
  /* Un ajustement de plan n'est pas un fait comptable daté : il ne tombe dans
     aucun mois, et la clôture ne le concerne pas. */
  entretien: "",
  transport: "date",
  avance: "date",
  evaluation: "date",
  /* Une enveloppe couvre un exercice : elle ne tombe pas dans un mois. */
  budget: "",
  "mise-a-disposition": "mois",
  prestation: "date",
  depense: "date",
  plein: "date",
  intervention: "date",
  document: "dateEffet",
  releve: "date",
  affectation: "debut",
  attelage: "debut",
  incident: "dateHeure",
  sanction: "date",
  indisponibilite: "debut",
  statut: "debut",
  aptitude: "date",
  visite: "dateRendezVous",
  caisse: "date",
  achat: "date",
  ordre: "datePrevue",
  cuve: "date",
  /* Une fiche de prestataire n'a pas de mois : la clôture ne la concerne pas. */
  prestataire: "",
  /* Une observation est une action à suivre, pas une écriture du mois. */
  observation: "",
  /* Les fiches n'ont pas de mois : la clôture ne les concerne pas. */
  vehicule: "",
  chauffeur: "",
};

/** Une transaction créée dans l'application, en attendant la base. */
export interface Creation {
  numero: string;
  type: TypeTransaction;
  /** « vehicule:AA032EA », « chauffeur:babacar-ndiaye » — la fiche qui la porte. */
  sujet: string;
  date: string;
  auteur: string;
  valeurs: Record<string, unknown>;
}

/** Valeur affichable d'un champ, pour le journal des modifications. */
export function formaterValeur(champ: ChampEdition, valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "—";
  if (champ.type === "oui-non") return valeur ? "oui" : "non";
  if (champ.type === "photo") return "photo jointe";
  if (champ.type === "choix") return champ.options?.find((o) => o.valeur === String(valeur))?.libelle ?? String(valeur);
  if (champ.type === "date") {
    const s = String(valeur);
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }
  if (champ.type === "nombre") {
    const [entier, fraction] = String(valeur).split(".");
    return `${entier!.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${fraction ? `,${fraction}` : ""}${champ.unite ? ` ${champ.unite}` : ""}`;
  }
  return String(valeur);
}

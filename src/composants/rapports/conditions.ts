/* ============================================================================
 * Conditions chiffrées d'un rapport — « les véhicules à plus de 150 000 km ».
 *
 * Demande du métier du 3 octobre 2026. Les facettes cochent des valeurs d'un
 * vocabulaire fermé ; un kilométrage, un montant ou une date n'en ont pas — on
 * les borne : égal, supérieur, inférieur (stricts ou non), entre deux valeurs
 * ou en dehors de deux limites.
 *
 * Une condition se range parmi les facettes, sous la clé `seuil:<colonne>` et
 * la valeur `[opérateur, borne, seconde borne]`. Ainsi le dernier état, les
 * vues enregistrées et les rapports personnalisés la gardent sans rien changer
 * à leur forme : une facette de plus, simplement.
 * ==========================================================================*/

import { texteDe, type ColonneRapport, type LigneRapport, type TypeValeur } from "@/domaine/rapports";
import { date as formaterDate } from "@/lib/format";
import { formaterValeur } from "./cellules";
import type { Facettes } from "./reglages";

export const PREFIXE_SEUIL = "seuil:";

export type Operateur = "egal" | "sup" | "supeg" | "inf" | "infeg" | "entre" | "hors";

/* L'ordre est celui du menu. « Entre » et « en dehors de » ont deux bornes,
   incluses pour « entre » (métier, 3 octobre 2026 : égal à, supérieur ou égal,
   inférieur ou égal, en dehors de deux limites). */
export const OPERATEURS: Record<Operateur, { nombre: string; date: string }> = {
  egal: { nombre: "égal à", date: "le" },
  sup: { nombre: "supérieur à", date: "après le" },
  supeg: { nombre: "supérieur ou égal à", date: "à partir du" },
  inf: { nombre: "inférieur à", date: "avant le" },
  infeg: { nombre: "inférieur ou égal à", date: "jusqu'au" },
  entre: { nombre: "entre", date: "entre le" },
  hors: { nombre: "en dehors de", date: "hors de la période du" },
};

/** Les opérateurs qui demandent deux bornes. */
export const A_DEUX_BORNES: Operateur[] = ["entre", "hors"];
export interface Condition {
  cle: string;
  operateur: Operateur;
  /** Telles que saisies : un nombre, ou une date AAAA-MM-JJ. */
  a: string;
  b: string;
}

const TYPES_CHIFFRES: TypeValeur[] = ["nombre", "montant", "pourcentage", "ecart", "distance", "volume", "duree", "poids"];

/** Les colonnes qu'on borne : les chiffres et les dates. */
export function estBornable(c: ColonneRapport): boolean {
  return TYPES_CHIFFRES.includes(c.type) || c.type === "date";
}

export function estSeuil(cle: string): boolean {
  return cle.startsWith(PREFIXE_SEUIL);
}

/** « 150 000 », « 150000 », « 12,5 » → un nombre ; vide ou illisible → null. */
export function lireNombre(s: string): number | null {
  const net = s.replace(/[\s  ]/g, "").replace(",", ".");
  if (!net) return null;
  const n = Number(net);
  return Number.isFinite(n) ? n : null;
}

export function conditionsDe(facettes: Facettes): Condition[] {
  return Object.entries(facettes)
    .filter(([cle, v]) => estSeuil(cle) && v.length >= 2)
    .map(([cle, [operateur, a, b]]) => ({ cle: cle.slice(PREFIXE_SEUIL.length), operateur: operateur as Operateur, a: a ?? "", b: b ?? "" }));
}

export function poserCondition(facettes: Facettes, c: Condition): Facettes {
  return { ...facettes, [`${PREFIXE_SEUIL}${c.cle}`]: [c.operateur, c.a, c.b] };
}

export function retirerCondition(facettes: Facettes, cle: string): Facettes {
  const reste = { ...facettes };
  delete reste[`${PREFIXE_SEUIL}${cle}`];
  return reste;
}

/** Une condition complète : ses bornes se lisent, et « entre » ou « en dehors de » en ont deux. */
export function conditionValide(c: Condition, type: TypeValeur): boolean {
  const lit = (s: string) => (type === "date" ? /^\d{4}-\d{2}-\d{2}$/.test(s) : lireNombre(s) !== null);
  return lit(c.a) && (!A_DEUX_BORNES.includes(c.operateur) || lit(c.b));
}

/** Vrai quand la ligne passe la condition. Une valeur absente ne passe jamais : « plus de 150 000 km » écarte les compteurs inconnus. */
export function satisfait(ligne: LigneRapport, c: Condition, type: TypeValeur): boolean {
  const brut = ligne[c.cle] ?? null;
  /* Une date se compare en texte AAAA-MM-JJ, un chiffre en nombre : les deux s'ordonnent de même. */
  const lire = (s: string): number | string | null => (type === "date" ? (/^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null) : lireNombre(s));
  const v = type === "date" ? (typeof brut === "string" ? lire(brut) : null) : typeof brut === "number" ? brut : lireNombre(texteDe(brut));
  const a = lire(c.a);
  if (v === null || a === null) return false;
  switch (c.operateur) {
    case "egal":
      return v === a;
    case "sup":
      return v > a;
    case "supeg":
      return v >= a;
    case "inf":
      return v < a;
    case "infeg":
      return v <= a;
    default: {
      const b = lire(c.b);
      if (b === null) return false;
      const [bas, haut] = a <= b ? [a, b] : [b, a];
      const dedans = v >= bas && v <= haut;
      return c.operateur === "entre" ? dedans : !dedans;
    }
  }
}
/** « Kilométrage : supérieur à 150 000 km », pour la pastille et l'export. */
export function libelleCondition(c: Condition, colonne: ColonneRapport): string {
  const date = colonne.type === "date";
  const borne = (s: string) => (date ? formaterDate(s) : formaterValeur(lireNombre(s), colonne.type));
  const op = OPERATEURS[c.operateur][date ? "date" : "nombre"];
  return A_DEUX_BORNES.includes(c.operateur) ? `${colonne.libelle} : ${op} ${borne(c.a)} et ${borne(c.b)}` : `${colonne.libelle} : ${op} ${borne(c.a)}`;
}

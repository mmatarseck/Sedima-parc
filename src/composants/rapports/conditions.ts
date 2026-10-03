/* ============================================================================
 * Conditions chiffrées d'un rapport — « les véhicules à plus de 150 000 km ».
 *
 * Demande du métier du 3 octobre 2026. Les facettes cochent des valeurs d'un
 * vocabulaire fermé ; un kilométrage, un montant ou une date n'en ont pas — on
 * les borne : supérieur à, inférieur à, entre deux valeurs.
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

export type Operateur = "sup" | "inf" | "entre";

export const OPERATEURS: Record<Operateur, { nombre: string; date: string }> = {
  sup: { nombre: "supérieur à", date: "après le" },
  inf: { nombre: "inférieur à", date: "avant le" },
  entre: { nombre: "entre", date: "entre le" },
};

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

/** Une condition complète : ses bornes se lisent, et « entre » en a deux. */
export function conditionValide(c: Condition, type: TypeValeur): boolean {
  const lit = (s: string) => (type === "date" ? /^\d{4}-\d{2}-\d{2}$/.test(s) : lireNombre(s) !== null);
  return lit(c.a) && (c.operateur !== "entre" || lit(c.b));
}

/** Vrai quand la ligne passe la condition. Une valeur absente ne passe jamais : « plus de 150 000 km » écarte les compteurs inconnus. */
export function satisfait(ligne: LigneRapport, c: Condition, type: TypeValeur): boolean {
  const v = ligne[c.cle] ?? null;
  if (type === "date") {
    const d = typeof v === "string" ? v.slice(0, 10) : "";
    if (!d) return false;
    if (c.operateur === "sup") return d > c.a;
    if (c.operateur === "inf") return d < c.a;
    const [bas, haut] = c.a <= c.b ? [c.a, c.b] : [c.b, c.a];
    return d >= bas && d <= haut;
  }
  const n = typeof v === "number" ? v : lireNombre(texteDe(v));
  const a = lireNombre(c.a);
  if (n === null || a === null) return false;
  if (c.operateur === "sup") return n > a;
  if (c.operateur === "inf") return n < a;
  const b = lireNombre(c.b);
  if (b === null) return false;
  return n >= Math.min(a, b) && n <= Math.max(a, b);
}

/** « Kilométrage : supérieur à 150 000 km », pour la pastille et l'export. */
export function libelleCondition(c: Condition, colonne: ColonneRapport): string {
  const date = colonne.type === "date";
  const borne = (s: string) => (date ? formaterDate(s) : formaterValeur(lireNombre(s), colonne.type));
  const op = OPERATEURS[c.operateur][date ? "date" : "nombre"];
  return c.operateur === "entre" ? `${colonne.libelle} : ${op} ${borne(c.a)} et ${borne(c.b)}` : `${colonne.libelle} : ${op} ${borne(c.a)}`;
}

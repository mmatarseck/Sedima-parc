/* ============================================================================
 * Tri et filtre des tableaux — sans configuration par colonne.
 *
 * Une colonne se trie sur ce qu'elle affiche : on extrait le texte de la
 * cellule rendue, on y reconnaît une date « 28/09/2026 », un nombre « 12 890 F »
 * ou « 343 307 km », sinon une chaîne. Ainsi chaque tableau se trie et se
 * filtre dès sa création, et un écran qui veut mieux fournit sa propre clé.
 * ==========================================================================*/

import { isValidElement, type ReactNode } from "react";

/** Le texte d'un nœud React, enfants compris. */
export function texteDe(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texteDe).join(" ");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode; title?: string };
    return texteDe(props.children);
  }
  return "";
}

export type ValeurTri = number | string | null;

/** Ce que vaut un texte pour le tri : un temps, un nombre, ou lui-même. */
export function valeurDeTri(texte: string): ValeurTri {
  const t = texte.trim();
  if (!t || t === "—") return null;
  const d = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(t);
  if (d) return Date.UTC(Number(d[3]), Number(d[2]) - 1, Number(d[1]));
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const n = /^[+-]?\s*[\d\s  .,]+/.exec(t);
  if (n && /\d/.test(n[0])) {
    const brut = n[0].replace(/[\s  ]/g, "").replace(",", ".");
    const valeur = Number(brut);
    if (Number.isFinite(valeur) && brut.length >= t.replace(/[^\d.,+-]/g, "").length * 0.5) return valeur;
  }
  return t.toLowerCase();
}

export function comparer(a: ValeurTri, b: ValeurTri): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "number") return -1;
  if (typeof b === "number") return 1;
  return a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" });
}

export type SensTri = "asc" | "desc";

export interface Tri {
  cle: string;
  sens: SensTri;
}

/** Clic sur un en-tête : croissant, puis décroissant, puis plus de tri. */
export function triSuivant(courant: Tri | null, cle: string): Tri | null {
  if (!courant || courant.cle !== cle) return { cle, sens: "asc" };
  if (courant.sens === "asc") return { cle, sens: "desc" };
  return null;
}

/** Trie des lignes d'après une fonction qui rend la valeur de la colonne triée. */
export function trierLignes<T>(lignes: T[], tri: Tri | null, valeur: (l: T, cle: string) => ValeurTri): T[] {
  if (!tri) return lignes;
  const indexees = lignes.map((l, i) => ({ l, i, v: valeur(l, tri.cle) }));
  indexees.sort((x, y) => {
    // Les valeurs absentes restent en fin de liste, quel que soit le sens.
    if (x.v === null || y.v === null) return comparer(x.v, y.v) || x.i - y.i;
    const c = comparer(x.v, y.v);
    return (tri.sens === "asc" ? c : -c) || x.i - y.i;
  });
  return indexees.map((x) => x.l);
}

/** Vrai si le texte d'une ligne contient chaque mot du filtre. */
export function retientFiltre(texte: string, filtre: string): boolean {
  const mots = filtre.toLowerCase().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return true;
  const t = texte.toLowerCase();
  return mots.every((m) => t.includes(m));
}

/* ============================================================================
 * Ce qui n'est plus « la flotte » quand on la lit.
 *
 * Deux façons pour un véhicule de quitter les listes sans être effacé : être
 * **sorti** du parc — un fait daté et motivé (0046, 0047) — ou être
 * **archivé** — retiré des listes sans rien affirmer sur son sort (0054). Les
 * écrans qui taisent l'un doivent taire l'autre : c'est ce prédicat, et lui
 * seul, qu'ils consultent. Un troisième cas viendrait ici, pas dans chaque
 * liste.
 * ==========================================================================*/

import type { Vehicule } from "./types";

type Lisible = Pick<Vehicule, "statut"> & Partial<Pick<Vehicule, "archiveLe">>;

/** Archivé : retiré des listes, fiche consultable, réversible d'un clic. */
export function estArchive(v: Lisible): boolean {
  return Boolean(v.archiveLe);
}

/** Sorti du parc ou archivé : n'est plus du sujet quand on lit « la flotte ». */
export function horsParc(v: Lisible): boolean {
  return v.statut === "sorti" || estArchive(v);
}

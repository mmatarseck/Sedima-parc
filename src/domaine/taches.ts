/* ============================================================================
 * Une tâche du catalogue de maintenance (0060) : ce que dit chaque ligne d'un
 * service, sous un nom stable — la condition des rapports par tâche, par
 * système, par catégorie.
 * ==========================================================================*/

import { CATEGORIES_MAINTENANCE, systemeDe } from "./categories-maintenance";

export interface TacheService {
  numero: string;
  libelle: string;
  description: string | null;
  categorie: string | null;
  systeme: string | null;
  ensemble: string | null;
  typeDefaut: "preventif" | "curatif" | null;
  /** Les autres noms fondus à l'import : « vidange ». */
  alias: string[];
  /** Les utilisations dans notre parc — interventions affectées et services clos (0061) : l'ordre des listes. */
  utilisations: number;
  source: "fleetio" | "saisie";
  aClasser: boolean;
  actif: boolean;
  creee: boolean;
}

/** Une clé de comparaison : majuscules, sans accents ni ponctuation. */
export function cleTache(libelle: string): string {
  return libelle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** La tâche que désigne un libellé — son nom ou l'un de ses alias. */
export function tacheParLibelle<T extends Pick<TacheService, "libelle" | "alias">>(taches: T[], libelle: string): T | null {
  const k = cleTache(libelle);
  return taches.find((t) => cleTache(t.libelle) === k || t.alias.some((a) => cleTache(a) === k)) ?? null;
}

/** « Freins · Châssis » : le système, puis la catégorie, pour une liste de choix. */
export function precisionTache(t: Pick<TacheService, "categorie" | "systeme">): string {
  const s = systemeDe(t.systeme);
  const c = t.categorie ?? s?.categorie ?? null;
  return [s?.libelle, c ? CATEGORIES_MAINTENANCE[c] : null].filter(Boolean).join(" · ") || "à classer";
}

import type { AccesCourant } from "@/domaine/acces";
import type { LigneFlotte } from "@/domaine/types";

/**
 * Ce que le téléphone montre : les véhicules du périmètre de la personne —
 * sites, business units, régimes de sa fiche d'accès. En base, les
 * politiques font le même tri ; ici, c'est pour que la démonstration et
 * l'écran disent la même chose.
 */
export function dansPerimetre(l: LigneFlotte, acces: AccesCourant): boolean {
  const p = acces.perimetre;
  const v = l.vehicule;
  const site = p.sites === "tous" || v.siteId === null || p.sites.includes(v.siteId);
  const bu = p.businessUnits === "toutes" || v.businessUnit === null || p.businessUnits.includes(v.businessUnit);
  const regime = p.regimes === "tous" || p.regimes.includes(v.regime ?? "exploitation");
  return site && bu && regime;
}

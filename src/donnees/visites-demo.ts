/* Les visites techniques et leurs observations de la démonstration : celles de chaque fiche, une fois. Sans import serveur. */

import type { Parametres } from "@/domaine/parametres";
import type { ObservationVisite, VisiteTechnique } from "@/domaine/types";
import { fichePourImmatriculation } from "./fiche-demo";
import { FLOTTE } from "./parc-demo";

export function visitesDemonstration(parametres: Parametres): { visites: VisiteTechnique[]; observations: ObservationVisite[] } {
  const visites: VisiteTechnique[] = [];
  const observations: ObservationVisite[] = [];
  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation, parametres);
    if (!f) continue;
    visites.push(...f.visitesTechniques);
    observations.push(...f.observationsVisite);
  }
  return { visites, observations };
}

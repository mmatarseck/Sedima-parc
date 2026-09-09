/* ============================================================================
 * La fiche d'un transporteur — tout ce qu'il est et tout ce qu'il fait.
 *
 * Bâtie sur le modèle de la fiche véhicule et de la fiche chauffeur, comme le
 * métier l'a demandé : « sur la page des transporteurs, ça devrait être plus ou
 * moins comme la page véhicule ou chauffeur ». Le tableau qui tenait lieu de
 * module ne permettait ni de voir la flotte d'un transporteur, ni de suivre sa
 * performance, ni de savoir sur quel écrit on s'appuie pour lui parler.
 *
 * Rien ne se calcule ici qui ne se calcule déjà ailleurs : la fiche rassemble,
 * elle n'invente pas. Le rassemblement vit dans le domaine
 * (`assembler-transporteurs.ts`) ; ce module lui donne le jeu de démonstration,
 * `transporteurs.ts` lui donne la base. C'est ce qui garantit que la fiche dira
 * la même chose que l'écran Transporteurs et que les rapports, en démonstration
 * comme en production.
 * ==========================================================================*/

import type { SourceTransporteurs } from "@/domaine/assembler-transporteurs";
import { ficheTransporteurDe, listeTransporteursDe } from "@/domaine/assembler-transporteurs";
import { DATE_REFERENCE } from "./chauffeurs-demo";
import { camionsTiers, chauffeursTiers, profilTransporteur, rattachements } from "./flotte-tierce-demo";
import { listePrestataires } from "./prestataires-demo";
import { relevesTransport, semainesRelevees } from "./releve-demo";
import { affretements, grillesTarifaires, misesADisposition, prestations } from "./transporteurs-demo";

export type { ActiviteTransporteur, FicheTransporteur, LigneListeTransporteur } from "@/domaine/assembler-transporteurs";

let CACHE: SourceTransporteurs | null = null;

/** Les faits du module, tels que la démonstration les tient. */
export function sourceDemonstration(): SourceTransporteurs {
  if (CACHE) return CACHE;
  const prestataires = listePrestataires().filter((p) => p.type === "transporteur");
  CACHE = {
    prestataires,
    profils: new Map(prestataires.map((p) => [p.numero, profilTransporteur(p.raisonSociale, p.numero)])),
    camions: camionsTiers(),
    chauffeurs: chauffeursTiers(),
    grilles: grillesTarifaires(),
    rattachements: rattachements(),
    affretements: affretements(),
    misesADisposition: misesADisposition(),
    prestations: prestations(),
    livraisons: relevesTransport().filter((l) => l.transporteurNumero !== null),
    semainesPeriode: semainesRelevees().length,
    aujourdhui: DATE_REFERENCE,
  };
  return CACHE;
}

/** Les transporteurs du référentiel, avec de quoi dresser une liste. */
export function listeTransporteurs() {
  return listeTransporteursDe(sourceDemonstration());
}

export function ficheTransporteur(numero: string) {
  return ficheTransporteurDe(sourceDemonstration(), numero);
}

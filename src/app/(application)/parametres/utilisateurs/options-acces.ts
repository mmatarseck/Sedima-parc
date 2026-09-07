import type { OptionsAcces } from "@/composants/parametres/EcranAccesUtilisateur";
import { listeChauffeurs } from "@/donnees/chauffeurs-demo";
import { attributaires } from "@/donnees/parc-leger-demo";
import { sites } from "@/donnees/referentiels";

/**
 * Ce que la fiche d'accès propose : les sites (de la base quand elle est
 * branchée), les chauffeurs et les attributaires pour rattacher un
 * détenteur — encore ceux de la démonstration, comme le parc léger.
 */
export async function optionsAcces(): Promise<OptionsAcces> {
  const listeSites = await sites();
  return {
    sites: listeSites.map((s) => ({ valeur: s.id, libelle: s.libelle })),
    chauffeurs: listeChauffeurs().map((c) => ({ valeur: c.id, libelle: c.nomComplet })),
    attributaires: attributaires().map((a) => ({ valeur: a.id, libelle: a.nom })),
  };
}

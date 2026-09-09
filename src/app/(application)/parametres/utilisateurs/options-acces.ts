import type { OptionsAcces } from "@/composants/parametres/EcranAccesUtilisateur";
import { listeChauffeurs } from "@/donnees/chauffeurs-demo";
import { parcLegerServeur } from "@/donnees/parc-leger";
import { sites } from "@/donnees/referentiels";
import { parametresServeur } from "@/lib/parametres-serveur";

/**
 * Ce que la fiche d'accès propose : les sites et les attributaires (de la
 * base quand elle est branchée — l'identifiant d'un attributaire est alors
 * celui de sa table, ce que la fiche d'accès enregistre), et les chauffeurs
 * pour rattacher un détenteur — encore ceux de la démonstration.
 */
export async function optionsAcces(): Promise<OptionsAcces> {
  const [listeSites, parcLeger] = await Promise.all([sites(), parametresServeur().then(parcLegerServeur)]);
  return {
    sites: listeSites.map((s) => ({ valeur: s.id, libelle: s.libelle })),
    chauffeurs: listeChauffeurs().map((c) => ({ valeur: c.id, libelle: c.nomComplet })),
    attributaires: parcLeger.attributaires.map((a) => ({ valeur: a.id, libelle: a.nom })),
  };
}

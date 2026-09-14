import { EcranNouveauVehicule } from "@/composants/flotte/EcranNouveauVehicule";
import { titrePage } from "@/domaine/marque";
import { sites } from "@/donnees/referentiels";

export const metadata = { title: titrePage("Nouveau véhicule") };

/**
 * Les sites viennent de la base quand elle est branchée ; marque, modèle et
 * catégorie, des paramètres posés dans le navigateur.
 *
 * Le fournisseur d'achat était proposé ici : la table `vehicule` n'a pas de
 * colonne pour lui, et il se perdait à l'enregistrement (14 septembre 2026).
 * Il se note dans les notes en attendant qu'une colonne le porte.
 */
export default async function PageNouveauVehicule() {
  const listeSites = await sites();
  return <EcranNouveauVehicule contexte={{ sites: listeSites.map((s) => ({ valeur: s.id, libelle: s.libelle })) }} />;
}

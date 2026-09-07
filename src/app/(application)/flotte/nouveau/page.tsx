import { EcranNouveauVehicule } from "@/composants/flotte/EcranNouveauVehicule";
import { titrePage } from "@/domaine/marque";
import { prestataires, sites } from "@/donnees/referentiels";

export const metadata = { title: titrePage("Nouveau véhicule") };

/**
 * Sites et fournisseurs viennent de la base quand elle est branchée ; marque,
 * modèle et catégorie, des paramètres posés dans le navigateur.
 */
export default async function PageNouveauVehicule() {
  const [listeSites, listePrestataires] = await Promise.all([sites(), prestataires()]);
  return (
    <EcranNouveauVehicule
      contexte={{
        sites: listeSites.map((s) => ({ valeur: s.id, libelle: s.libelle })),
        fournisseurs: listePrestataires.filter((p) => p.actif && ["garage", "pieces", "autre", "transporteur"].includes(p.type)).map((p) => ({ valeur: p.raisonSociale, libelle: p.raisonSociale })),
      }}
    />
  );
}

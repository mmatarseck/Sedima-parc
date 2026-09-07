import { EcranVehicules, type VehiculeDuParc } from "@/composants/parametres/EcranVehicules";
import { titrePage } from "@/domaine/marque";
import { lignesFlotte } from "@/donnees/flotte";
import { parametresServeur } from "@/lib/parametres-serveur";

export const metadata = { title: titrePage("Véhicules — paramètres") };

/**
 * Paramètres › Véhicules. Le parc est lu ici, côté serveur, pour que l'écran
 * compte ce que chaque marque, modèle et catégorie porte réellement : c'est ce
 * compte qui dit ce qui peut encore se retirer, et quelles marques le parc
 * porte déjà sans que le référentiel les connaisse.
 */
export default async function PageParametresVehicules() {
  const parametres = await parametresServeur();
  const lignes = await lignesFlotte(parametres);
  const parc: VehiculeDuParc[] = lignes.map((l) => ({
    marque: l.vehicule.marque,
    modele: l.vehicule.appellation,
    categorie: l.vehicule.categorie,
    categorieMetier: l.vehicule.categorieMetier ?? null,
  }));
  return <EcranVehicules parc={parc} />;
}

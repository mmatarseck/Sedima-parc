import { EcranEtiquettesQr, type VehiculeAEtiqueter } from "@/composants/flotte/EcranEtiquettesQr";
import { titrePage } from "@/domaine/marque";
import { lignesFlotte } from "@/donnees/flotte";
import { sites } from "@/donnees/referentiels";
import { parametresServeur } from "@/lib/parametres-serveur";

export const metadata = { title: titrePage("Étiquettes QR") };

/** Les véhicules du périmètre, à étiqueter ; ceux à recevoir n'ont pas encore de plaque. */
export default async function PageEtiquettes() {
  const [parametres, listeSites] = await Promise.all([parametresServeur(), sites()]);
  const lignes = await lignesFlotte(parametres);
  const vehicules: VehiculeAEtiqueter[] = lignes
    .filter((l) => l.vehicule.statut !== "a-recevoir" && l.vehicule.immatriculation)
    .map((l) => ({ immatriculation: l.vehicule.immatriculation, immatriculationAffichee: l.vehicule.immatriculationAffichee, libelle: `${l.vehicule.marque} ${l.vehicule.appellation}`, siteId: l.vehicule.siteId, siteLibelle: l.site?.libelle ?? null, detenteur: l.chauffeurTitulaire?.nom ?? l.attributaire?.nom ?? null }));
  return <EcranEtiquettesQr vehicules={vehicules} sites={listeSites.map((s) => ({ id: s.id, libelle: s.libelle }))} />;
}

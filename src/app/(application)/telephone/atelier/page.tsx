import { EcranTelephoneAtelier } from "@/composants/telephone/EcranTelephoneAtelier";
import { titrePage } from "@/domaine/marque";
import type { StatutVehicule } from "@/domaine/types";
import { jourCourant } from "@/domaine/temps";
import { lignesFlotte } from "@/donnees/flotte";
import { travauxServeur } from "@/donnees/maintenance";
import { ordresServeur } from "@/donnees/ordres";
import { signalementsServeur } from "@/donnees/signalements";
import { parametresServeur } from "@/lib/parametres-serveur";

export const metadata = { title: titrePage("Atelier") };

/**
 * L'atelier sur le téléphone : les services et ce qui reste à planifier
 * viennent du module Maintenance — la table des services, le travail déduit du
 * parc, les pannes signalées. Le statut effectif de chaque véhicule dit s'il y
 * a un retour en service à poser.
 */
export default async function PageTelephoneAtelier() {
  const parametres = await parametresServeur();
  const lignes = await lignesFlotte(parametres);
  const statuts: Record<string, StatutVehicule> = Object.fromEntries(lignes.map((l) => [l.vehicule.id, l.statutEffectif ?? l.vehicule.statut]));
  /* Les pannes (0060) : le service qui s'ouvre d'ici les propose ; sans la migration, il s'ouvre sans elles. */
  const [ordres, travaux, signalements] = await Promise.all([ordresServeur(), travauxServeur(parametres), signalementsServeur().catch(() => [])]);
  return <EcranTelephoneAtelier ordres={ordres} travaux={travaux} signalements={signalements} statuts={statuts} aujourdhui={jourCourant()} />;
}

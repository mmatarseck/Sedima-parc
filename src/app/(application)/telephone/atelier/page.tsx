import { EcranTelephoneAtelier } from "@/composants/telephone/EcranTelephoneAtelier";
import { titrePage } from "@/domaine/marque";
import type { StatutVehicule } from "@/domaine/types";
import { jourCourant } from "@/domaine/temps";
import { lignesFlotte } from "@/donnees/flotte";
import { travauxServeur } from "@/donnees/maintenance";
import { ordresServeur } from "@/donnees/ordres";
import { parametresServeur } from "@/lib/parametres-serveur";

export const metadata = { title: titrePage("Atelier") };

/**
 * L'atelier sur le téléphone : les ordres de travail et ce qui reste à
 * planifier viennent du module Maintenance — la table des ordres, et le
 * travail déduit du parc. Le statut effectif de chaque véhicule dit s'il y a
 * un retour en service à poser.
 */
export default async function PageTelephoneAtelier() {
  const parametres = await parametresServeur();
  const lignes = await lignesFlotte(parametres);
  const statuts: Record<string, StatutVehicule> = Object.fromEntries(lignes.map((l) => [l.vehicule.id, l.statutEffectif ?? l.vehicule.statut]));
  return <EcranTelephoneAtelier ordres={await ordresServeur()} travaux={await travauxServeur(parametres)} statuts={statuts} aujourdhui={jourCourant()} />;
}

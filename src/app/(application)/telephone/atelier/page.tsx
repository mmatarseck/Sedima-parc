import { EcranTelephoneAtelier } from "@/composants/telephone/EcranTelephoneAtelier";
import { titrePage } from "@/domaine/marque";
import type { StatutVehicule } from "@/domaine/types";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { lignesFlotte } from "@/donnees/flotte";
import { ordresDeTravail, travauxAFaire } from "@/donnees/maintenance-demo";
import { parametresServeur } from "@/lib/parametres-serveur";

export const metadata = { title: titrePage("Atelier") };

/**
 * L'atelier sur le téléphone : les ordres de travail et ce qui reste à
 * planifier viennent du module Maintenance — encore le jeu de démonstration,
 * comme au bureau, tant que les ordres n'ont pas leur table. Le statut
 * effectif de chaque véhicule dit s'il y a un retour en service à poser.
 */
export default async function PageTelephoneAtelier() {
  const parametres = await parametresServeur();
  const lignes = await lignesFlotte(parametres);
  const statuts: Record<string, StatutVehicule> = Object.fromEntries(lignes.map((l) => [l.vehicule.id, l.statutEffectif ?? l.vehicule.statut]));
  return <EcranTelephoneAtelier ordres={ordresDeTravail()} travaux={travauxAFaire()} statuts={statuts} aujourdhui={DATE_REFERENCE} />;
}

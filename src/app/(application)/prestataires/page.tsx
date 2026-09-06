import { EcranPrestataires } from "@/composants/prestataires/EcranPrestataires";
import { titrePage } from "@/domaine/marque";
import { statistiquesPrestataires } from "@/donnees/caisse-demo";
import { prestataires } from "@/donnees/referentiels";

export const metadata = { title: titrePage("Prestataires") };

/**
 * Suivi › Prestataires : le référentiel des garages, fournisseurs, stations,
 * assureurs et centres agréés — et, pour chacun, ce qu'il a vendu au parc sur
 * douze mois (demandes d'achat commandées, montant, non réglé), lu sur les achats.
 *
 * Le référentiel vient de la base quand elle est branchée ; les statistiques,
 * elles, se lisent encore sur les achats de démonstration.
 */
export default async function PagePrestataires({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const [{ ref }, liste] = await Promise.all([searchParams, prestataires()]);
  return <EcranPrestataires prestataires={liste} stats={statistiquesPrestataires()} cible={ref} />;
}

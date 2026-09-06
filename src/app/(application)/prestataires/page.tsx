import { EcranPrestataires } from "@/composants/prestataires/EcranPrestataires";
import { titrePage } from "@/domaine/marque";
import { statistiquesPrestataires } from "@/donnees/caisse-demo";
import { listePrestataires } from "@/donnees/prestataires-demo";

export const metadata = { title: titrePage("Prestataires") };

/**
 * Suivi › Prestataires : le référentiel des garages, fournisseurs, stations,
 * assureurs et centres agréés — et, pour chacun, ce qu'il a vendu au parc sur
 * douze mois (demandes d'achat commandées, montant, non réglé), lu sur les achats.
 */
export default async function PagePrestataires({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  return <EcranPrestataires prestataires={listePrestataires()} stats={statistiquesPrestataires()} cible={ref} />;
}

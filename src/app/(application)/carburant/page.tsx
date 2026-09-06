import { EcranCarburant, type VueCarburant } from "@/composants/carburant/EcranCarburant";
import { titrePage } from "@/domaine/marque";
import { typeDuNumero } from "@/domaine/reference";
import { STOCK_INITIAL, consommationsMensuelles, livraisonsEtJauges, pleinsFlotte } from "@/donnees/carburant-demo";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";

export const metadata = { title: titrePage("Carburant") };

/**
 * Carburant — Lot 2, une seule entrée du rail : les pleins de la flotte, le
 * journal de la cuve interne (stock recalculé), la consommation par véhicule.
 * Un numéro cité dans une recherche (`?ref=`) choisit la vue tout seul : un CUV
 * ouvre la cuve, un PLN les pleins.
 */
export default async function PageCarburant({ searchParams }: { searchParams: Promise<{ vue?: string; ref?: string }> }) {
  const { vue, ref } = await searchParams;
  const typeCible = ref ? typeDuNumero(ref) : null;
  const vueRetenue: VueCarburant = vue === "cuve" || typeCible === "cuve" ? "cuve" : vue === "consommation" ? "consommation" : "pleins";

  return <EcranCarburant pleins={pleinsFlotte()} cuve={livraisonsEtJauges()} stockInitial={STOCK_INITIAL} consommations={consommationsMensuelles()} aujourdhui={DATE_REFERENCE} vueInitiale={vueRetenue} cible={ref} />;
}

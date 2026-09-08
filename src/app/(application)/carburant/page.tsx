import { EcranCarburant, type VueCarburant } from "@/composants/carburant/EcranCarburant";
import { titrePage } from "@/domaine/marque";
import { typeDuNumero } from "@/domaine/reference";
import { carburantServeur } from "@/donnees/carburant";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { parametresServeur } from "@/lib/parametres-serveur";
import { authentificationReelle } from "@/lib/session-demo";

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

  /* Base branchée : pleins et cuve viennent des tables, la consommation se calcule sur le parc. */
  const c = await carburantServeur(await parametresServeur());
  return <EcranCarburant pleins={c.pleins} cuve={c.cuve} stockInitial={c.stockInitial} consommations={c.consommations} aujourdhui={authentificationReelle() ? new Date().toISOString().slice(0, 10) : DATE_REFERENCE} vueInitiale={vueRetenue} cible={ref} />;
}

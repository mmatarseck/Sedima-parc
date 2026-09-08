import { EcranMaintenance, type VueMaintenance } from "@/composants/maintenance/EcranMaintenance";
import { titrePage } from "@/domaine/marque";
import { typeDuNumero } from "@/domaine/reference";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { interventionsServeur, travauxServeur } from "@/donnees/maintenance";
import { ordresServeur } from "@/donnees/ordres";
import { authentificationReelle } from "@/lib/session-demo";
import { parametresServeur } from "@/lib/parametres-serveur";

export const metadata = { title: titrePage("Maintenance") };

/**
 * Maintenance — première brique du Lot 2, une seule entrée du rail. Ce qu'il
 * reste à faire se déduit des fiches ; les ordres de travail le planifient ;
 * les interventions disent ce qui a été fait. Un numéro cité dans une recherche
 * (`?ref=`) choisit la vue tout seul.
 */
export default async function PageMaintenance({ searchParams }: { searchParams: Promise<{ vue?: string; ref?: string }> }) {
  const { vue, ref } = await searchParams;
  const typeCible = ref ? typeDuNumero(ref) : null;
  const vueRetenue: VueMaintenance = vue === "ordres" || typeCible === "ordre" ? "ordres" : vue === "interventions" || typeCible === "intervention" ? "interventions" : "afaire";

  /* Base branchée : les ordres viennent de leur table, les interventions de la
     leur, et le travail à faire se déduit du parc lu pour la liste Flotte. */
  const reel = authentificationReelle();
  const [travaux, ordres, interventions] = await Promise.all([travauxServeur(await parametresServeur()), ordresServeur(), interventionsServeur()]);
  return <EcranMaintenance travaux={travaux} ordres={ordres} interventions={interventions} aujourdhui={reel ? new Date().toISOString().slice(0, 10) : DATE_REFERENCE} vueInitiale={vueRetenue} cible={ref} />;
}

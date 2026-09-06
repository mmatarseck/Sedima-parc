import { EcranIncidents } from "@/composants/incidents/EcranIncidents";
import { titrePage } from "@/domaine/marque";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { listeIncidents } from "@/donnees/incidents-demo";

export const metadata = { title: titrePage("Incidents & sinistres") };

/**
 * Incidents & sinistres : toutes les déclarations, et le formulaire en quatre
 * étapes pour en saisir une nouvelle. Pas de bandeau de KPI : D_NPVEL et
 * D_TICV se lisent sur le tableau de bord ; ici on retrouve et on suit.
 */
export default async function PageIncidents({ searchParams }: { searchParams: Promise<{ ref?: string; declarer?: string }> }) {
  const { ref, declarer } = await searchParams;
  return <EcranIncidents lignes={listeIncidents()} aujourdhui={DATE_REFERENCE} cible={ref} declarerInitial={declarer === "1"} />;
}

import { EcranIncidents } from "@/composants/incidents/EcranIncidents";
import { titrePage } from "@/domaine/marque";
import { jourCourant } from "@/domaine/temps";
import { incidentsServeur } from "@/donnees/incidents";

export const metadata = { title: titrePage("Incidents & sinistres") };

/* Rendu à la demande : cette page lit la base avec la session des cookies. */
export const dynamic = "force-dynamic";

/**
 * Incidents & sinistres : toutes les déclarations, et le formulaire en quatre
 * étapes pour en saisir une nouvelle. Pas de bandeau de KPI : D_NPVEL et
 * D_TICV se lisent sur le tableau de bord ; ici on retrouve et on suit.
 *
 * L'écran lisait `incidents-demo` pendant que le **rapport** du même sujet
 * lisait la table (constaté le 15 septembre 2026, en vérifiant que les rapports
 * portent bien les données réelles). Les deux se contredisaient sans le dire :
 * la base ne porte aucun incident, l'écran en montrait une trentaine. Un écran
 * qui invente est pire qu'un écran vide — on prend des décisions dessus.
 */
export default async function PageIncidents({ searchParams }: { searchParams: Promise<{ ref?: string; declarer?: string }> }) {
  const [{ ref, declarer }, lignes] = await Promise.all([searchParams, incidentsServeur()]);
  return <EcranIncidents lignes={lignes} aujourdhui={jourCourant()} cible={ref} declarerInitial={declarer === "1"} />;
}

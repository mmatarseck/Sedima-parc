import { EcranClotures } from "@/composants/clotures/EcranClotures";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Clôture des mois") };

/**
 * Du mois courant jusqu'à janvier de l'année précédente, le plus récent en tête :
 * l'écran filtre par année (demande du métier du 3 septembre), il lui faut donc
 * au moins deux exercices. En production, la liste viendra des mois qui portent
 * des transactions.
 */
function moisDepuisJanvierPrecedent(reference: string): string[] {
  const [a, m] = reference.split("-").map(Number);
  const nombre = m! + 12;
  return Array.from({ length: nombre }, (_, i) => new Date(Date.UTC(a!, m! - 1 - i, 1)).toISOString().slice(0, 7));
}

export default function PageClotures() {
  return <EcranClotures mois={moisDepuisJanvierPrecedent(DATE_REFERENCE)} />;
}

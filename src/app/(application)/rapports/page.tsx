import { EcranCatalogue } from "@/composants/rapports/EcranCatalogue";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Rapports") };

/**
 * Catalogue des rapports — l'écran d'entrée du module (décision du métier du
 * 4 septembre 2026 : « Coûts & analyses » devient « Rapports », le coût n'étant
 * qu'une dimension parmi d'autres). Les rapports personnalisés, où l'on compose
 * ses propres colonnes, viendront s'ajouter au même catalogue.
 */
export default function PageRapports() {
  return <EcranCatalogue />;
}

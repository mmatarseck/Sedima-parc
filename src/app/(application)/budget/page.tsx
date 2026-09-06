import { EcranBudget } from "@/composants/budget/EcranBudget";
import { titrePage } from "@/domaine/marque";
import { donneesBudget } from "@/donnees/budget-demo";

export const metadata = { title: titrePage("Budget") };

/**
 * Le budget du parc — dernière ligne du carnet du métier du 4 septembre 2026.
 *
 * Tout se calcule côté serveur : les enveloppes dérivent du réalisé de
 * l'exercice précédent, la consommation se lit sur les dépenses des fiches, et
 * l'engagé sur les demandes d'achat commandées et non réglées.
 */
export default function PageBudget() {
  return <EcranBudget donnees={donneesBudget()} />;
}

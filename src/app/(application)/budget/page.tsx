import { EcranBudget } from "@/composants/budget/EcranBudget";
import { donneesBudgetDe } from "@/domaine/assembler-budget";
import { titrePage } from "@/domaine/marque";
import { budgetServeur } from "@/donnees/budget";

export const metadata = { title: titrePage("Budget") };

/**
 * Le budget du parc — dernière ligne du carnet du métier du 4 septembre 2026.
 *
 * Tout se calcule côté serveur : les enveloppes viennent de la table (ou, en
 * démonstration, dérivent du réalisé de l'exercice précédent), la
 * consommation se lit sur les dépenses des véhicules, et l'engagé sur les
 * demandes d'achat commandées et non réglées.
 */
export default async function PageBudget() {
  return <EcranBudget donnees={donneesBudgetDe(await budgetServeur())} />;
}

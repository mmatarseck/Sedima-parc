import { FormulaireConnexion } from "@/composants/connexion/FormulaireConnexion";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Connexion") };

export default function PageConnexion() {
  return <FormulaireConnexion />;
}

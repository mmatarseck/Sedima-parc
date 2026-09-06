import { EcranReglesDocuments } from "@/composants/parametres/EcranReglesDocuments";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Règles des documents") };

export default function PageReglesDocuments() {
  return <EcranReglesDocuments />;
}

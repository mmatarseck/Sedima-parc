import { EcranReglesAlerte } from "@/composants/parametres/EcranReglesAlerte";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Règles d'alerte") };

/**
 * Les règles de l'organisation : ce qu'un compte reçoit sans rien toucher. À ne
 * pas confondre avec « Mes notifications », qui est le réglage de chacun.
 */
export default function PageReglesAlerte() {
  return <EcranReglesAlerte />;
}

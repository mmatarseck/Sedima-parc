import { EcranEnergie } from "@/composants/parametres/EcranEnergie";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Énergie et carburant") };

export default function PageEnergie() {
  return <EcranEnergie />;
}

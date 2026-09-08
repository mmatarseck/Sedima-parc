import { EcranPersonnaliserAccueil } from "@/composants/telephone/EcranPersonnaliserAccueil";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Personnaliser l'accueil") };

export default function Page() {
  return <EcranPersonnaliserAccueil />;
}

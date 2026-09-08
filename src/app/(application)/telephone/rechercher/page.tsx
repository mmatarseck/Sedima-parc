import { EcranTelephoneRechercher } from "@/composants/telephone/EcranTelephoneRechercher";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Rechercher") };

export default function Page() {
  return <EcranTelephoneRechercher />;
}

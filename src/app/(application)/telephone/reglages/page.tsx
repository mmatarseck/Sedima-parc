import { EcranTelephoneReglages } from "@/composants/telephone/EcranTelephoneReglages";
import { titrePage } from "@/domaine/marque";
import { version as VERSION } from "../../../../../package.json";

export const metadata = { title: titrePage("Réglages") };

export default function Page() {
  return <EcranTelephoneReglages version={VERSION} />;
}

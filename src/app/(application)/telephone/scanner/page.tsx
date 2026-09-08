import { EcranTelephoneScanner } from "@/composants/telephone/EcranTelephoneScanner";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Scanner un véhicule") };

export default function PageScanner() {
  return <EcranTelephoneScanner />;
}

import { EcranTelephoneParcourir } from "@/composants/telephone/EcranTelephoneParcourir";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Parcourir") };

export default function Page() {
  return <EcranTelephoneParcourir />;
}

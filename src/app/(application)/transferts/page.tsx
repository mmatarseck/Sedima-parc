import { EcranTransferts } from "@/composants/transferts/EcranTransferts";
import { titrePage } from "@/domaine/marque";
import { transfertsServeur } from "@/donnees/transferts";

export const metadata = { title: titrePage("Fiches de transfert") };

/** Les fiches de transfert du périmètre — de la base quand elle est branchée. */
export default async function PageTransferts() {
  return <EcranTransferts initial={await transfertsServeur()} />;
}

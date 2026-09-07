import { EcranTelephoneTransferts } from "@/composants/telephone/EcranTelephoneTransferts";
import { titrePage } from "@/domaine/marque";
import { transfertsServeur } from "@/donnees/transferts";

export const metadata = { title: titrePage("Fiches de transfert") };

/** Les fiches de transfert sur le téléphone : à signer, puis complètes. */
export default async function PageTelephoneTransferts() {
  return <EcranTelephoneTransferts initial={await transfertsServeur()} />;
}

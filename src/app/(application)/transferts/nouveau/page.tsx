import { FicheTransfert } from "@/composants/transferts/FicheTransfert";
import { titrePage } from "@/domaine/marque";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { transfertsServeur } from "@/donnees/transferts";
import { parametresServeur } from "@/lib/parametres-serveur";
import { authentificationReelle } from "@/lib/session-demo";
import { optionsTransfert } from "../options-transfert";

export const metadata = { title: titrePage("Nouvelle fiche de transfert") };

export default async function PageNouveauTransfert() {
  const [parametres, transferts] = await Promise.all([parametresServeur(), transfertsServeur()]);
  const options = await optionsTransfert(parametres);
  const maintenant = authentificationReelle() ? new Date().toISOString() : `${DATE_REFERENCE}T12:00:00.000Z`;
  return <FicheTransfert initial={transferts} id={null} cibles={options.cibles} personnes={options.personnes} documents={options.documents} maintenant={maintenant} />;
}

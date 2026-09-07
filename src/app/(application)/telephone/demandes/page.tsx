import { EcranTelephoneDemandes } from "@/composants/telephone/EcranTelephoneDemandes";
import { titrePage } from "@/domaine/marque";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { demandesServeur } from "@/donnees/demandes";
import { authentificationReelle } from "@/lib/session-demo";

export const metadata = { title: titrePage("Demandes") };

/** Les demandes sur le téléphone : celles du détenteur, ou le suivi du périmètre. */
export default async function PageTelephoneDemandes() {
  const maintenant = authentificationReelle() ? new Date().toISOString() : `${DATE_REFERENCE}T12:00:00.000Z`;
  return <EcranTelephoneDemandes initial={await demandesServeur()} maintenant={maintenant} />;
}

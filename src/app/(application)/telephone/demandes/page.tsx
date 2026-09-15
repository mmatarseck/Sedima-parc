import { EcranTelephoneDemandes } from "@/composants/telephone/EcranTelephoneDemandes";
import { titrePage } from "@/domaine/marque";
import { demandesServeur } from "@/donnees/demandes";

export const metadata = { title: titrePage("Demandes") };

/** Les demandes sur le téléphone : celles du détenteur, ou le suivi du périmètre. */
export default async function PageTelephoneDemandes() {
  const maintenant = new Date().toISOString();
  return <EcranTelephoneDemandes initial={await demandesServeur()} maintenant={maintenant} />;
}

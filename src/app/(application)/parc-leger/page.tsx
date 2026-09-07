import { EcranParcLeger } from "@/composants/parc-leger/EcranParcLeger";
import { titrePage } from "@/domaine/marque";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { attributaires, forfaitsCarburant, vehiculesLegers } from "@/donnees/parc-leger-demo";

export const metadata = { title: titrePage("Parc léger") };

/**
 * Exploitation › Parc léger : les véhicules de service, de fonction et plan
 * car — qui tient quoi, dans quel état, et ce que ça coûte chaque mois.
 * Cadrage du métier du 7 septembre 2026 ; données du dossier de la Direction
 * des Opérations.
 */
export default function PageParcLeger() {
  return <EcranParcLeger vehicules={vehiculesLegers()} attributaires={attributaires()} forfaits={forfaitsCarburant()} aujourdhui={DATE_REFERENCE} />;
}

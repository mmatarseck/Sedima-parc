import { EcranTelephoneAccueil } from "@/composants/telephone/EcranTelephoneAccueil";
import { titrePage } from "@/domaine/marque";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { lignesFlotte } from "@/donnees/flotte";
import { parametresServeur } from "@/lib/parametres-serveur";

export const metadata = { title: titrePage("Téléphone") };

/**
 * L'accueil du téléphone : le périmètre de la personne, ce qu'il y a à faire,
 * les gestes. Les lignes sont celles de la Flotte ; l'écran les borne au
 * périmètre de la fiche d'accès, comme les politiques le font en base.
 */
export default async function PageTelephone() {
  const parametres = await parametresServeur();
  return <EcranTelephoneAccueil lignes={await lignesFlotte(parametres)} aujourdhui={DATE_REFERENCE} />;
}

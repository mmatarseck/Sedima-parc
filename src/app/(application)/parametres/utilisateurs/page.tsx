import { EcranUtilisateurs } from "@/composants/parametres/EcranUtilisateurs";
import { titrePage } from "@/domaine/marque";
import { accesServeur } from "@/lib/acces-serveur";

export const metadata = { title: titrePage("Utilisateurs") };

/**
 * Les personnes et leur fiche d'accès. La liste vient de la base quand elle
 * est branchée ; le navigateur ne décide jamais d'une autorisation.
 */
export default async function PageUtilisateurs() {
  return <EcranUtilisateurs initial={await accesServeur()} />;
}

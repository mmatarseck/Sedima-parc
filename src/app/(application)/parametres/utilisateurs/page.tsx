import { EcranUtilisateurs } from "@/composants/parametres/EcranUtilisateurs";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Utilisateurs et rôles") };

/**
 * Les rôles de l'application et leur périmètre. La création des comptes viendra
 * de Supabase : le navigateur ne décide jamais d'une autorisation.
 */
export default function PageUtilisateurs() {
  return <EcranUtilisateurs />;
}

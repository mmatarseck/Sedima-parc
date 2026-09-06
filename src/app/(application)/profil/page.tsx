import { EcranProfil } from "@/composants/profil/EcranProfil";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Mon profil") };

/**
 * Mon profil — identité dans l'application, renvoi au réglage des
 * notifications, et ce qu'il faut savoir de la connexion. Les entrées « Mon
 * profil » et « Identifiants et mot de passe » du menu du compte mènent ici
 * (la seconde à l'ancre #identifiants).
 */
export default function PageProfil() {
  return <EcranProfil />;
}

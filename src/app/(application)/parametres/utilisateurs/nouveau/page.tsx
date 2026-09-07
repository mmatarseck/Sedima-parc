import { EcranAccesUtilisateur } from "@/composants/parametres/EcranAccesUtilisateur";
import { titrePage } from "@/domaine/marque";
import { optionsAcces } from "../options-acces";

export const metadata = { title: titrePage("Nouvel utilisateur") };

export default async function PageNouvelUtilisateur() {
  return <EcranAccesUtilisateur initial={null} options={await optionsAcces()} />;
}

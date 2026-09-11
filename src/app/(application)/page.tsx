import { redirect } from "next/navigation";
import { TableauBordEnCache } from "@/composants/tableau/TableauBordEnCache";
import { titrePage } from "@/domaine/marque";
import { requeteDepuisUnTelephone } from "@/lib/telephone-serveur";

export const metadata = { title: titrePage("Tableau de bord") };

/**
 * Tableau de bord SQDCM — l'écran d'entrée de l'application, conforme à la
 * maquette « Parc SEDIMA » de la Direction des Opérations.
 *
 * La page ne calcule plus rien (11 septembre 2026). Le métier trouvait le
 * tableau de bord lent à charger, et demandait de ne rafraîchir les données
 * qu'à la connexion ou sur appui d'un bouton. Le calcul — deux ans de faits,
 * vingt-huit jours de situations — vit dans `/api/tableau-bord` ; l'écran
 * s'ouvre sur le dernier calcul gardé dans le navigateur et dit s'il est
 * dépassé (`TableauBordEnCache`).
 */
export default async function PageTableauBord() {
  /* Sur un téléphone, l'accueil est la vue téléphone, pas celle-ci (métier,
     10 septembre 2026). La redirection tombe avant tout calcul. */
  if (await requeteDepuisUnTelephone()) redirect("/telephone");
  return <TableauBordEnCache />;
}

import { redirect } from "next/navigation";

/** L'ancienne adresse : la clôture des mois vit dans Paramètres. */
export default function AncienneAdresseClotures() {
  redirect("/parametres/clotures");
}

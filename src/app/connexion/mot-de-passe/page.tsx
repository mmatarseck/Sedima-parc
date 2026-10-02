import { Suspense } from "react";
import { FormulaireMotDePasse } from "@/composants/connexion/FormulaireMotDePasse";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Choisir mon mot de passe") };

/* Le formulaire lit le jeton dans l'adresse : comme la page de connexion,
   il demande une frontière de suspension pour se construire. */
export default function PageMotDePasse() {
  return (
    <Suspense>
      <FormulaireMotDePasse />
    </Suspense>
  );
}

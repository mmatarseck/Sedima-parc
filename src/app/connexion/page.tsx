import { Suspense } from "react";
import { FormulaireConnexion } from "@/composants/connexion/FormulaireConnexion";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Connexion") };

/* Le formulaire lit l'adresse (`?motif=`) : à la construction, cette lecture
   demande une frontière de suspension, sans quoi la page ne se rend pas en statique. */
export default function PageConnexion() {
  return (
    <Suspense>
      <FormulaireConnexion />
    </Suspense>
  );
}

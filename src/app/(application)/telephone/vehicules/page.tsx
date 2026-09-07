import { Suspense } from "react";
import { EcranTelephoneVehicules } from "@/composants/telephone/EcranTelephoneVehicules";
import { titrePage } from "@/domaine/marque";
import { lignesFlotte } from "@/donnees/flotte";
import { parametresServeur } from "@/lib/parametres-serveur";

export const metadata = { title: titrePage("Véhicules — téléphone") };

export default async function PageTelephoneVehicules() {
  const parametres = await parametresServeur();
  const lignes = await lignesFlotte(parametres);
  /* useSearchParams veut une frontière Suspense pour le rendu statique. */
  return (
    <Suspense fallback={null}>
      <EcranTelephoneVehicules lignes={lignes} />
    </Suspense>
  );
}

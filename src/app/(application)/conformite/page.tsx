import { EcranConformite } from "@/composants/conformite/EcranConformite";
import { titrePage } from "@/domaine/marque";
import { conformiteServeur } from "@/donnees/conformite";
import { parametresServeur } from "@/lib/parametres-serveur";

export const metadata = { title: titrePage("Conformité") };

/**
 * L'échéancier unique : chaque document de chaque véhicule et de chaque
 * chauffeur, les licences, le processus de visite technique, la prochaine
 * échéance d'entretien, sur une seule liste. Base branchée, tout vient des
 * tables ; sinon, des fiches de démonstration — une seule source dans les
 * deux cas (`src/donnees/conformite.ts`).
 */
export default async function PageConformite() {
  const { echeances, aujourdhui } = await conformiteServeur(await parametresServeur());
  return <EcranConformite echeances={echeances} aujourdhui={aujourdhui} />;
}

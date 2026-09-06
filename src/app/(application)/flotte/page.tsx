import { EcranFlotte } from "@/composants/flotte/EcranFlotte";
import { lignesFlotte } from "@/donnees/flotte";
import { parametresServeur } from "@/lib/parametres-serveur";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Flotte") };

/**
 * Liste de la flotte : une ligne par véhicule.
 *
 * Pas de bandeau de KPI ici — la page sert à retrouver et à comparer des
 * véhicules, pas à lire des agrégats. Les indicateurs vivent sur le tableau de
 * bord, structurés par axe SQDCM.
 *
 * Les lignes viennent de la base quand elle est branchée (`src/donnees/flotte.ts`),
 * statut effectif et immobilisation administrative compris ; des fiches de
 * démonstration sinon.
 */
export default async function PageFlotte() {
  const parametres = await parametresServeur();
  return <EcranFlotte lignes={await lignesFlotte(parametres)} />;
}

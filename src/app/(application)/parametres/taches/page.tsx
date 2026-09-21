import { EcranTachesService } from "@/composants/parametres/EcranTachesService";
import { titrePage } from "@/domaine/marque";
import { tachesServeur } from "@/donnees/taches";

export const metadata = { title: titrePage("Catalogue des tâches") };

/** Paramètres › Catalogue des tâches de service (0060) : ce que cite chaque ligne d'un service de maintenance. */
export default async function PageTachesService() {
  return <EcranTachesService taches={await tachesServeur()} />;
}

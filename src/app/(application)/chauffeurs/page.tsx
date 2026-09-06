import { EcranChauffeurs } from "@/composants/chauffeurs/EcranChauffeurs";
import { listeChauffeurs } from "@/donnees/chauffeurs-demo";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Chauffeurs") };

/**
 * Liste des chauffeurs : une ligne par personne, sortis compris.
 *
 * Comme la Flotte, pas de bandeau de KPI : on y retrouve quelqu'un, on compare
 * des échéances et des compteurs. Ce qui s'agrège est sur la fiche et sur le
 * tableau de bord. La liste et la création vivent dans l'écran client, qui a
 * besoin du contexte d'édition.
 */
export default function PageChauffeurs() {
  return <EcranChauffeurs lignes={listeChauffeurs()} />;
}

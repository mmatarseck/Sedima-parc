import { EcranChauffeurs } from "@/composants/chauffeurs/EcranChauffeurs";
import { lignesAttributaires } from "@/domaine/parc-leger";
import { titrePage } from "@/domaine/marque";
import { lignesChauffeurs } from "@/donnees/chauffeurs";
import { parcLegerServeur } from "@/donnees/parc-leger";
import { parametresServeur } from "@/lib/parametres-serveur";

export const metadata = { title: titrePage("Chauffeurs") };

/**
 * Liste des conducteurs du parc : une ligne par personne, sortis compris.
 *
 * Deux populations en deux volets — les chauffeurs du parc, et les
 * attributaires d'un véhicule de service ou de fonction (demande du métier du
 * 14 septembre 2026). Comme la Flotte, pas de bandeau de KPI : on y retrouve
 * quelqu'un, on compare des échéances et des compteurs. Ce qui s'agrège est sur
 * la fiche et sur le tableau de bord. La liste et la création vivent dans
 * l'écran client, qui a besoin du contexte d'édition.
 *
 * Les lignes viennent de la base quand elle est branchée
 * (`src/donnees/chauffeurs.ts`, `src/donnees/parc-leger.ts`), du jeu de
 * démonstration sinon.
 */
export default async function PageChauffeurs() {
  const parametres = await parametresServeur();
  const [lignes, parcLeger] = await Promise.all([lignesChauffeurs(), parcLegerServeur(parametres)]);
  return <EcranChauffeurs lignes={lignes} attributaires={lignesAttributaires(parcLeger, parametres.parcLeger.forfaitCarburantMensuel)} />;
}

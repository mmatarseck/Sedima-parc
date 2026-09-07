import { EcranTableauBord } from "@/composants/tableau/EcranTableauBord";
import { titrePage } from "@/domaine/marque";
import { situationsServeur } from "@/donnees/situations";
import { DATE_REFERENCE, donneesTableau } from "@/donnees/tableau-bord-demo";
import { parametresServeur } from "@/lib/parametres-serveur";

export const metadata = { title: titrePage("Tableau de bord") };

/**
 * Tableau de bord SQDCM — l'écran d'entrée de l'application, conforme à la
 * maquette « Parc SEDIMA » de la Direction des Opérations.
 *
 * Les faits se calculent une fois côté serveur, à la maille véhicule × mois ;
 * l'écran filtre, cumule et affiche. Rien ne s'y saisit.
 */
export default async function PageTableauBord() {
  const d = donneesTableau();
  /* Les pastilles lisent l'état du moment : les situations journalières des
     quatre dernières semaines (décision du métier du 8 septembre 2026), et
     leurs seuils viennent des paramètres. Base branchée, les situations
     viennent de `situation_journaliere()` (0010) ; les courbes et la
     troisième rangée restent au jeu de démonstration en attendant leur
     propre lecture. */
  const [parametres, situations] = await Promise.all([parametresServeur(), situationsServeur(DATE_REFERENCE)]);
  return <EcranTableauBord mois={d.mois} vehicules={d.vehicules} faits={d.faits} flotte={d.flotte} semaine={d.semaine} flotteSemaine={d.flotteSemaine} jour={d.jour} alertes={d.alertes} aujourdhui={DATE_REFERENCE} situations={situations} seuils={parametres.pastilles.seuils} />;
}

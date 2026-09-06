import { EcranTableauBord } from "@/composants/tableau/EcranTableauBord";
import { titrePage } from "@/domaine/marque";
import { DATE_REFERENCE, donneesTableau } from "@/donnees/tableau-bord-demo";

export const metadata = { title: titrePage("Tableau de bord") };

/**
 * Tableau de bord SQDCM — l'écran d'entrée de l'application, conforme à la
 * maquette « Parc SEDIMA » de la Direction des Opérations.
 *
 * Les faits se calculent une fois côté serveur, à la maille véhicule × mois ;
 * l'écran filtre, cumule et affiche. Rien ne s'y saisit.
 */
export default function PageTableauBord() {
  const d = donneesTableau();
  return <EcranTableauBord mois={d.mois} vehicules={d.vehicules} faits={d.faits} flotte={d.flotte} semaine={d.semaine} flotteSemaine={d.flotteSemaine} jour={d.jour} aujourdhui={DATE_REFERENCE} />;
}

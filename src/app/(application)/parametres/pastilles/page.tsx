import { EcranSeuilsPastilles } from "@/composants/parametres/EcranSeuilsPastilles";
import { titrePage } from "@/domaine/marque";
import { PASTILLES, evaluerPastille } from "@/domaine/pastilles";
import { situationsServeur } from "@/donnees/situations";
import { DATE_REFERENCE } from "@/donnees/tableau-bord-demo";

export const metadata = { title: titrePage("Pastilles — paramètres") };

/**
 * Paramètres › Pastilles du tableau de bord. La valeur du jour de chaque
 * pastille est calculée ici, côté serveur, sur la situation du jour et tout le
 * parc : l'écran la montre à côté du seuil, pour que l'on voie ce qu'un
 * réglage déclenche avant de l'enregistrer.
 */
export default async function PageParametresPastilles() {
  const situations = await situationsServeur(DATE_REFERENCE);
  const valeursDuJour = Object.fromEntries(PASTILLES.map((p) => [p.id, evaluerPastille(p, situations).valeur]));
  return <EcranSeuilsPastilles valeursDuJour={valeursDuJour} />;
}

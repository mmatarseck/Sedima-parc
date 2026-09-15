import { EcranCaisseCuve } from "@/composants/parametres/EcranCaisseCuve";
import { titrePage } from "@/domaine/marque";
import { situationsServeur } from "@/donnees/situations";
import { jourCourant } from "@/domaine/temps";
import { parametresServeur } from "@/lib/parametres-serveur";

export const metadata = { title: titrePage("Caisse et cuve — paramètres") };

/**
 * Paramètres › Caisse et cuve. Le solde et le stock du jour viennent de la
 * situation journalière, aux paramètres en vigueur : l'écran les déplace du
 * nouvel écart de report pour montrer ce qu'un réglage produit.
 */
export default async function PageParametresCaisse() {
  const aujourdhui = jourCourant();
  const [parametres, situations] = await Promise.all([parametresServeur(), situationsServeur(aujourdhui, 1)]);
  const jour = situations.at(-1)?.flotte ?? null;
  return <EcranCaisseCuve soldeDuJour={jour?.soldeCaisse ?? null} stockDuJour={jour?.cuveLitres ?? null} capaciteCuve={parametres.energie.capaciteCuve} />;
}

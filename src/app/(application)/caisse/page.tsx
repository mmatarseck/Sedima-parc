import { EcranCaisse, type VueCaisse } from "@/composants/caisse/EcranCaisse";
import { titrePage } from "@/domaine/marque";
import { typeDuNumero } from "@/domaine/reference";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { achatsServeur } from "@/donnees/achats";
import { caisseServeur } from "@/donnees/caisse";
import { parametresServeur } from "@/lib/parametres-serveur";
import { authentificationReelle } from "@/lib/session-demo";
import { prestataires } from "@/donnees/referentiels";

export const metadata = { title: titrePage("Caisse & achats") };

/**
 * Caisse & achats — module F du lot 1, une seule entrée du rail.
 *
 * Le journal de caisse et les demandes d'achat partagent l'écran : ce sont les
 * deux faces du même geste, engager une dépense et la payer. Le processus
 * d'achat lui-même vit dans Sage X3 ; ici, on suit à quelle étape en est
 * chaque demande. Un numéro cité dans une recherche (`?ref=`) choisit la vue
 * tout seul.
 */
export default async function PageCaisse({ searchParams }: { searchParams: Promise<{ vue?: string; ref?: string }> }) {
  const [{ vue, ref }, liste, caisse, achats] = await Promise.all([searchParams, prestataires(), parametresServeur().then(caisseServeur), achatsServeur()]);
  /* Base branchée : le journal, les dépenses à régler et les demandes d'achat viennent des tables. */
  const reel = authentificationReelle();
  const typeCible = ref ? typeDuNumero(ref) : null;
  const vueRetenue: VueCaisse = vue === "achats" || typeCible === "achat" ? "achats" : "journal";

  return (
    <EcranCaisse
      mouvements={caisse.mouvements}
      depensesARegler={caisse.depensesARegler}
      achats={achats}
      prestataires={liste}
      soldeInitial={caisse.soldeInitial}
      aujourdhui={reel ? new Date().toISOString().slice(0, 10) : DATE_REFERENCE}
      vueInitiale={vueRetenue}
      cible={ref}
    />
  );
}

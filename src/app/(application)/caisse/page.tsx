import { EcranCaisse, type VueCaisse } from "@/composants/caisse/EcranCaisse";
import { titrePage } from "@/domaine/marque";
import { typeDuNumero } from "@/domaine/reference";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { caisseServeur } from "@/donnees/caisse";
import { demandesAchat } from "@/donnees/caisse-demo";
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
  const [{ vue, ref }, liste, caisse] = await Promise.all([searchParams, prestataires(), caisseServeur()]);
  /* Base branchée : le journal et les dépenses à régler viennent des tables ; les
     demandes d'achat n'ont pas encore la leur, l'écran n'en montre aucune. */
  const reel = authentificationReelle();
  const typeCible = ref ? typeDuNumero(ref) : null;
  const vueRetenue: VueCaisse = vue === "achats" || typeCible === "achat" ? "achats" : "journal";

  return (
    <EcranCaisse
      mouvements={caisse.mouvements}
      depensesARegler={caisse.depensesARegler}
      achats={reel ? [] : demandesAchat()}
      prestataires={liste}
      soldeInitial={caisse.soldeInitial}
      aujourdhui={reel ? new Date().toISOString().slice(0, 10) : DATE_REFERENCE}
      vueInitiale={vueRetenue}
      cible={ref}
    />
  );
}

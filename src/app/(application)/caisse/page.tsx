import { EcranCaisse, type VueCaisse } from "@/composants/caisse/EcranCaisse";
import { titrePage } from "@/domaine/marque";
import { typeDuNumero } from "@/domaine/reference";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { SOLDE_INITIAL, demandesAchat, depensesAReglier, journalCaisse } from "@/donnees/caisse-demo";
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
  const [{ vue, ref }, liste] = await Promise.all([searchParams, prestataires()]);
  const typeCible = ref ? typeDuNumero(ref) : null;
  const vueRetenue: VueCaisse = vue === "achats" || typeCible === "achat" ? "achats" : "journal";

  return (
    <EcranCaisse
      mouvements={journalCaisse()}
      depensesARegler={depensesAReglier()}
      achats={demandesAchat()}
      prestataires={liste}
      soldeInitial={SOLDE_INITIAL}
      aujourdhui={DATE_REFERENCE}
      vueInitiale={vueRetenue}
      cible={ref}
    />
  );
}

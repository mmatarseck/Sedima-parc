import { EcranBaremeSqdcm } from "@/composants/parametres/EcranBaremeSqdcm";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Barème SQDCM") };

/**
 * Le barème qui décide de la prime des chauffeurs. Il vit dans les paramètres
 * parce qu'un chauffeur doit pouvoir le lire : une prime dont la règle n'est
 * pas publique cesse d'orienter les comportements.
 */
export default function PageBaremeSqdcm() {
  return <EcranBaremeSqdcm />;
}

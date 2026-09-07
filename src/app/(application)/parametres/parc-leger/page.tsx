import { EcranParametresParcLeger } from "@/composants/parametres/EcranParcLeger";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Parc léger — paramètres") };

export default function PageParametresParcLeger() {
  return <EcranParametresParcLeger />;
}

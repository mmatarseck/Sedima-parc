import { EcranNotifications } from "@/composants/parametres/EcranNotifications";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Notifications") };

/**
 * Réglage des notifications — l'entrée « Notifications » du menu du compte
 * (demande du métier du 4 septembre 2026). Ce que chacun reçoit, et par quel
 * canal ; le réglage est propre au compte.
 */
export default function PageNotifications() {
  return <EcranNotifications />;
}

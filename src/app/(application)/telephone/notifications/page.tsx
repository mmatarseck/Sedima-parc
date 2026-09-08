import { EcranTelephoneNotifications } from "@/composants/telephone/EcranTelephoneNotifications";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Notifications") };

export default function Page() {
  return <EcranTelephoneNotifications />;
}

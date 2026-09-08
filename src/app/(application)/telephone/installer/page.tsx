import { EcranTelephoneInstaller } from "@/composants/telephone/EcranTelephoneInstaller";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Installer l'application") };

export default function Page() {
  return <EcranTelephoneInstaller />;
}

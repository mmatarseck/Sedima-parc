import { FicheTransfert } from "@/composants/transferts/FicheTransfert";
import { titrePage } from "@/domaine/marque";
import { transfertsServeur } from "@/donnees/transferts";

export const metadata = { title: titrePage("Fiche de transfert") };

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Une fiche existante : lecture, et la signature qui manque. Une fiche
 * créée en démonstration n'existe que dans le navigateur : le composant la
 * retrouve lui-même dans le stockage, la page ne peut pas la connaître.
 */
export default async function PageTransfert({ params }: Props) {
  const [{ id }, transferts] = await Promise.all([params, transfertsServeur()]);
  const maintenant = new Date().toISOString();
  return <FicheTransfert initial={transferts} id={decodeURIComponent(id)} cibles={[]} personnes={{ chauffeurs: [], attributaires: [] }} documents={[]} maintenant={maintenant} />;
}

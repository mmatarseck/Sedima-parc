import { notFound } from "next/navigation";
import { FournisseurEdition } from "@/composants/transactions/ContexteEdition";
import { FicheCamionTiers } from "@/composants/transporteurs/FicheCamionTiers";
import { afficher, normaliser } from "@/domaine/immatriculation";
import { titrePage } from "@/domaine/marque";
import { ficheCamionTiers } from "@/donnees/camions-tiers";

type Props = { params: Promise<{ immat: string }>; searchParams: Promise<{ onglet?: string }> };

export async function generateMetadata({ params }: Props) {
  const { immat } = await params;
  return { title: titrePage(afficher(normaliser(decodeURIComponent(immat)))) };
}

/* Rendu à la demande : la page lit la session dans les cookies. */
export const dynamic = "force-dynamic";

/**
 * La fiche d'un camion de transporteur, adressée par sa plaque canonique :
 * /transporteurs/camions/AA573EC (refonte du 3 octobre 2026). « AA-573-EC »
 * retrouve le même camion.
 */
export default async function PageCamionTiers({ params, searchParams }: Props) {
  const [{ immat }, { onglet }] = await Promise.all([params, searchParams]);
  const plaque = normaliser(decodeURIComponent(immat));
  const fiche = await ficheCamionTiers(plaque);
  if (!fiche) notFound();
  return (
    <FournisseurEdition sujet={`camion:${plaque}`} href={`/transporteurs/camions/${plaque}`}>
      <FicheCamionTiers fiche={fiche} ongletInitial={onglet} />
    </FournisseurEdition>
  );
}

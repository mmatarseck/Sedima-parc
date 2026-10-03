import { EcranCamionsTiers } from "@/composants/transporteurs/EcranCamionsTiers";
import { titrePage } from "@/domaine/marque";
import { listeCamionsTiers } from "@/donnees/camions-tiers";

export const metadata = { title: titrePage("Transporteurs") };

/* Rendu à la demande : cette page lit la base avec la session des cookies. */
export const dynamic = "force-dynamic";

/**
 * Transporteurs — les camions, comme la Flotte (refonte du 3 octobre 2026).
 *
 * La liste était celle des transporteurs ; le métier veut celle de leurs
 * camions, « le plus possible proche de la vue de notre propre flotte », le
 * transporteur passant en filtre. Ce que le transporteur est en propre —
 * contrat, grille, facturation, performance — se lit sur sa fiche fournisseur.
 */
export default async function PageTransporteurs() {
  return <EcranCamionsTiers lignes={await listeCamionsTiers()} />;
}

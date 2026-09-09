import { EcranPieces } from "@/composants/pieces/EcranPieces";
import { titrePage } from "@/domaine/marque";
import { piecesServeur } from "@/donnees/pieces";

export const metadata = { title: titrePage("Pièces de rechange") };

/* Rendu à la demande : la page lit la session dans les cookies. */
export const dynamic = "force-dynamic";

/**
 * Suivi › Pièces de rechange : le magasin de l'atelier central — le stock
 * déduit des mouvements, le journal, les pneus suivis un par un. Une lecture
 * (trois tables, 0029), le stock calculé côté client sur la même source que
 * les créations du navigateur ; en démonstration, le jeu du navigateur.
 */
export default async function PagePieces({ searchParams }: { searchParams: Promise<{ vue?: string; ref?: string }> }) {
  const [{ vue, ref }, source] = await Promise.all([searchParams, piecesServeur()]);
  return <EcranPieces source={source} vueInitiale={vue} cible={ref} />;
}

import { notFound } from "next/navigation";
import { FichePiece } from "@/composants/pieces/FichePiece";
import { titrePage } from "@/domaine/marque";
import { piecesServeur } from "@/donnees/pieces";

type Props = { params: Promise<{ numero: string }>; searchParams: Promise<{ onglet?: string; ref?: string }> };

export async function generateMetadata({ params }: Props) {
  const { numero } = await params;
  const piece = (await piecesServeur()).pieces.find((p) => p.numero === decodeURIComponent(numero));
  return { title: titrePage(piece ? `${piece.reference} · ${piece.designation}` : "Pièce introuvable") };
}

/* Rendu à la demande, toujours : la page lit la session dans les cookies. */
export const dynamic = "force-dynamic";

/**
 * Fiche d'une pièce, adressée par son numéro : /pieces/PCE-2026-00012. Un
 * onglet peut être visé directement (?onglet=mouvements), et un mouvement
 * précis (&ref=MVT-…). Une pièce créée dans le navigateur n'existe pas pour le
 * serveur : la fiche la retrouve elle-même dans les créations, d'où le
 * « introuvable » rendu côté client plutôt qu'un 404 quand le numéro a la
 * bonne forme.
 */
export default async function PagePiece({ params, searchParams }: Props) {
  const [{ numero }, { onglet, ref }, source] = await Promise.all([params, searchParams, piecesServeur()]);
  const cle = decodeURIComponent(numero);
  if (!/^PCE-\d{4}-\d{5}$/.test(cle)) notFound();
  return <FichePiece source={source} numero={cle} ongletInitial={onglet} cible={ref} />;
}

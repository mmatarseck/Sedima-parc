import type { ReactNode } from "react";

/* ============================================================================
 * Une liste, et la pièce de la ligne ouverte à sa droite.
 *
 * Métier, 21 septembre 2026 : « au clic d'une ligne de dépense, on rétracte la
 * vue et on voit le document à droite, dans l'app toujours ». Tant qu'aucune
 * ligne n'est ouverte, la liste a toute la largeur ; dès qu'une pièce s'ouvre,
 * la liste se replie sur une colonne étroite — à elle de ne garder que les
 * colonnes qui s'y lisent — et la pièce prend le reste, comme dans le dossier
 * des documents.
 *
 * Sous 1280 px, il n'y a pas la place de deux colonnes : la pièce passe
 * au-dessus de la liste, pour qu'un clic montre quelque chose sans défiler.
 * ==========================================================================*/

export function ListeEtPiece({ children, piece }: { children: ReactNode; piece: ReactNode | null }) {
  if (!piece) return <>{children}</>;
  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      <div className="order-last min-w-0 xl:order-first">{children}</div>
      <div className="min-w-0 xl:sticky xl:top-0">{piece}</div>
    </div>
  );
}

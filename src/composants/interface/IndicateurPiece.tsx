import { Paperclip } from "lucide-react";

/* ============================================================================
 * Le trombone d'une ligne qui porte sa pièce justificative.
 *
 * Métier, 21 septembre 2026 : « il nous faut une indication sur les lignes où
 * on a une pièce justificative attachée ». Il se pose dans la cellule qui nomme
 * la ligne — l'objet, le libellé, la source —, une colonne que ni un réglage ni
 * la liste rétractée ne masquent : on voit d'un coup d'œil quelles lignes ont
 * leur pièce, et un clic sur la ligne l'ouvre à droite.
 * ==========================================================================*/

export function IndicateurPiece({ present }: { present: boolean }) {
  if (!present) return null;
  return (
    <span className="inline-grid size-5 shrink-0 place-items-center rounded-full bg-accent-fond text-accent-fonce" title="Pièce justificative jointe — cliquer sur la ligne pour la lire">
      <Paperclip className="size-3" strokeWidth={2} aria-hidden="true" />
      <span className="sr-only">pièce jointe</span>
    </span>
  );
}

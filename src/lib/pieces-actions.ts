"use server";

import { stockDe } from "@/domaine/pieces";
import { piecesServeur } from "@/donnees/pieces";
import { authentificationReelle } from "@/lib/session-demo";

/* ============================================================================
 * Les pièces du magasin, pour le formulaire d'un service de maintenance.
 *
 * Lues à l'ouverture du formulaire, pas à chaque page : le stock se calcule sur
 * tous les mouvements, et la mise en page n'a pas à les porter pour un
 * formulaire qu'on ouvre rarement.
 *
 * LE PRIX. Métier, 21 septembre 2026 : « le prix de référence, pris au moment
 * d'enregistrer l'entrée de stock ». C'est le prix de la dernière entrée ; à
 * défaut, le prix de référence de la fiche — que la base aligne désormais sur
 * chaque entrée (0060).
 * ==========================================================================*/

export interface PieceDisponible {
  numero: string;
  reference: string;
  designation: string;
  unite: string;
  stock: number;
  prix: number | null;
}

export async function lirePiecesDisponibles(): Promise<PieceDisponible[]> {
  if (!authentificationReelle()) return [];
  try {
    const source = await piecesServeur();
    return stockDe(source.pieces.filter((p) => p.actif), source.mouvements, source.aujourdhui)
      .map((s) => ({ numero: s.piece.numero, reference: s.piece.reference, designation: s.piece.designation, unite: s.piece.unite, stock: s.quantite, prix: s.dernierPrix }))
      .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.designation.localeCompare(b.designation, "fr"));
  } catch {
    return [];
  }
}

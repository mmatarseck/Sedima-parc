/* ============================================================================
 * Les pièces de rechange, lues avec la session de l'utilisateur.
 *
 * Base branchée : les tables `piece`, `mouvement_stock` et `pneu` (0029),
 * trois lectures bornées ; le stock se déduit ensuite dans le domaine
 * (`stockDe`). Sinon, le jeu de démonstration. Les identifiants de véhicule
 * sont les immatriculations, comme partout.
 * ==========================================================================*/

import { cache } from "react";
import { afficher } from "@/domaine/immatriculation";
import type { MouvementStock, Piece, Pneu } from "@/domaine/pieces";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { DATE_REFERENCE } from "./chauffeurs-demo";
import { mouvementsDemo, piecesDemo, pneusDemo } from "./pieces-demo";

export interface SourcePieces {
  pieces: Piece[];
  mouvements: MouvementStock[];
  pneus: Pneu[];
  aujourdhui: string;
}

export interface LignePieceBase {
  numero: string;
  reference: string;
  designation: string;
  categorie: Piece["categorie"];
  unite: Piece["unite"];
  reference_constructeur: string | null;
  compatibilites: string[] | null;
  fournisseur: string | null;
  prix_reference: number | string | null;
  stock_minimum: number;
  stock_maximum: number | null;
  actif: boolean;
  commentaire: string | null;
  prestataire: { numero: string; raison_sociale: string } | null;
}

export interface LigneMouvementBase {
  numero: string;
  date: string;
  nature: MouvementStock["nature"];
  quantite: number | string;
  ecart: number | string | null;
  prix_unitaire: number | string | null;
  demande_numero: string | null;
  ordre_numero: string | null;
  intervention_numero: string | null;
  fournisseur: string | null;
  motif: string | null;
  auteur_nom: string | null;
  piece: { numero: string } | null;
  vehicule: { immatriculation: string } | null;
}

export interface LignePneuBase {
  numero: string;
  marque: string;
  dimension: string;
  numero_serie: string | null;
  etat: Pneu["etat"];
  position: string | null;
  date_pose: string | null;
  km_pose: number | null;
  date_depose: string | null;
  km_depose: number | null;
  rechapages: number;
  commentaire: string | null;
  piece: { numero: string } | null;
  vehicule: { immatriculation: string } | null;
}

const nb = (v: number | string | null): number | null => (v === null ? null : Number(v));

export function pieceDepuisLigne(l: LignePieceBase): Piece {
  return {
    numero: l.numero,
    reference: l.reference,
    designation: l.designation,
    categorie: l.categorie,
    unite: l.unite,
    referenceConstructeur: l.reference_constructeur,
    compatibilites: l.compatibilites ?? [],
    fournisseurNumero: l.prestataire?.numero ?? null,
    fournisseur: l.prestataire?.raison_sociale ?? l.fournisseur,
    prixReference: nb(l.prix_reference),
    stockMinimum: Number(l.stock_minimum),
    stockMaximum: l.stock_maximum === null ? null : Number(l.stock_maximum),
    actif: l.actif,
    commentaire: l.commentaire,
    creee: false,
  };
}

export function mouvementDepuisLigne(l: LigneMouvementBase): MouvementStock {
  return {
    numero: l.numero,
    date: l.date,
    nature: l.nature,
    pieceNumero: l.piece?.numero ?? "",
    quantite: Number(l.quantite),
    ecart: nb(l.ecart),
    prixUnitaire: nb(l.prix_unitaire),
    demandeNumero: l.demande_numero,
    ordreNumero: l.ordre_numero,
    interventionNumero: l.intervention_numero,
    vehiculeId: l.vehicule?.immatriculation ?? null,
    immatriculationAffichee: l.vehicule ? afficher(l.vehicule.immatriculation) : null,
    fournisseur: l.fournisseur,
    motif: l.motif,
    auteur: l.auteur_nom ?? "—",
    creee: false,
  };
}

export function pneuDepuisLigne(l: LignePneuBase): Pneu {
  return {
    numero: l.numero,
    pieceNumero: l.piece?.numero ?? null,
    marque: l.marque,
    dimension: l.dimension,
    numeroSerie: l.numero_serie,
    etat: l.etat,
    vehiculeId: l.vehicule?.immatriculation ?? null,
    immatriculationAffichee: l.vehicule ? afficher(l.vehicule.immatriculation) : null,
    position: l.position,
    datePose: l.date_pose,
    kmPose: l.km_pose,
    dateDepose: l.date_depose,
    kmDepose: l.km_depose,
    rechapages: Number(l.rechapages),
    commentaire: l.commentaire,
    creee: false,
  };
}

async function piecesServeurBrut(): Promise<SourcePieces> {
  if (!authentificationReelle()) return { pieces: piecesDemo(), mouvements: mouvementsDemo(), pneus: pneusDemo(), aujourdhui: DATE_REFERENCE };
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const client = await clientServeur();
  const [pieces, mouvements, pneus] = await Promise.all([
    client.from("piece").select("numero, reference, designation, categorie, unite, reference_constructeur, compatibilites, fournisseur, prix_reference, stock_minimum, stock_maximum, actif, commentaire, prestataire (numero, raison_sociale)").order("reference").limit(5000).returns<LignePieceBase[]>(),
    client.from("mouvement_stock").select("numero, date, nature, quantite, ecart, prix_unitaire, demande_numero, ordre_numero, intervention_numero, fournisseur, motif, auteur_nom, piece (numero), vehicule (immatriculation)").order("date", { ascending: false }).limit(20000).returns<LigneMouvementBase[]>(),
    client.from("pneu").select("numero, marque, dimension, numero_serie, etat, position, date_pose, km_pose, date_depose, km_depose, rechapages, commentaire, piece (numero), vehicule (immatriculation)").order("numero").limit(5000).returns<LignePneuBase[]>(),
  ]);
  /* Tables pas encore jouées : un magasin vide, pas d'erreur. */
  for (const [nom, lecture] of [["pièces", pieces], ["mouvements", mouvements], ["pneus", pneus]] as const) {
    if (lecture.error) console.warn(`Pièces de rechange — ${nom} : lecture impossible (${lecture.error.message}).`);
  }
  return { pieces: (pieces.data ?? []).map(pieceDepuisLigne), mouvements: (mouvements.data ?? []).map(mouvementDepuisLigne), pneus: (pneus.data ?? []).map(pneuDepuisLigne), aujourdhui };
}

export const piecesServeur = cache(piecesServeurBrut);

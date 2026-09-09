/* ============================================================================
 * Les pièces de rechange — le référentiel, le stock, les mouvements, les pneus.
 *
 * Décisions du gestionnaire du 9 septembre 2026, sur la proposition écrite
 * (`docs/PROPOSITION-PIECES.md`) :
 *
 *  - **un seul magasin**, l'atelier central, pour commencer : le stock se lit
 *    en tout, sans ventilation ;
 *  - **le stock se déduit des mouvements et se tient en quantités** ; la
 *    charge passe à l'achat, comme aujourd'hui (Sage X3 ne tient pas de
 *    stock de pièces) — une sortie ne crée donc **aucune dépense** : elle
 *    dit seulement quel véhicule a consommé quoi, et le prix d'achat de la
 *    dernière entrée donne une valeur indicative ;
 *  - **toute sortie est rattachée** à un ordre de travail, à une
 *    intervention ou, à défaut, à un véhicule : rien ne sort dans le vide ;
 *  - **les pneus se suivent un par un dès le départ** : un numéro, une
 *    dimension, le véhicule et la position, les kilomètres de pose et de
 *    dépose ;
 *  - pas de nouveau profil (les droits du module Maintenance), pas de QR de
 *    casier pour l'instant.
 *
 * Le parti pris reste celui du compte prestataire : **le stock ne se saisit
 * pas, il se déduit**. Un inventaire qui compte autre chose passe par une
 * régularisation, avec son motif — jamais par une quantité corrigée à la main.
 * ==========================================================================*/

import type { Creation } from "./cloture";
import type { Ton } from "./libelles";

/* -- Le référentiel ------------------------------------------------------------------ */

export type CategoriePiece = "filtration" | "lubrifiant" | "freinage" | "pneumatique" | "electricite" | "transmission" | "moteur" | "carrosserie" | "consommable" | "autre";

export const CATEGORIE_PIECE: Record<CategoriePiece, string> = {
  filtration: "Filtration",
  lubrifiant: "Lubrifiants",
  freinage: "Freinage",
  pneumatique: "Pneumatiques",
  electricite: "Électricité",
  transmission: "Transmission",
  moteur: "Moteur",
  carrosserie: "Carrosserie",
  consommable: "Consommables",
  autre: "Autre",
};

export type UnitePiece = "piece" | "litre" | "jeu" | "metre";

export const UNITE_PIECE: Record<UnitePiece, { libelle: string; court: string }> = {
  piece: { libelle: "Pièce", court: "u" },
  litre: { libelle: "Litre", court: "L" },
  jeu: { libelle: "Jeu", court: "jeu" },
  metre: { libelle: "Mètre", court: "m" },
};

export interface Piece {
  /** « PCE-2026-00012 ». */
  numero: string;
  /** La référence interne, courte, celle du casier : « FH-ACT-01 ». */
  reference: string;
  designation: string;
  categorie: CategoriePiece;
  unite: UnitePiece;
  referenceConstructeur: string | null;
  /** Les marques et modèles qu'elle sert, tels que la flotte les nomme : « Renault Kerax », « Toyota Hilux ». */
  compatibilites: string[];
  /** Le fournisseur habituel, par son numéro PRE, et le prix de référence. */
  fournisseurNumero: string | null;
  fournisseur: string | null;
  prixReference: number | null;
  /** Sous le minimum, la pièce est à réapprovisionner ; le maximum est la quantité visée. */
  stockMinimum: number;
  stockMaximum: number | null;
  actif: boolean;
  commentaire: string | null;
  /** Créée dans l'application (pas dans le jeu de démonstration). */
  creee: boolean;
}

/* -- Les mouvements ------------------------------------------------------------------ */

export type NatureMouvement = "entree" | "sortie" | "retour" | "regularisation";

export const NATURE_MOUVEMENT: Record<NatureMouvement, { libelle: string; precision: string; ton: Ton; sens: 1 | -1 | 0 }> = {
  entree: { libelle: "Entrée", precision: "Une livraison reçue, qui cite son bon de commande", ton: "favorable", sens: 1 },
  sortie: { libelle: "Sortie", precision: "Une pièce posée ou donnée à l'atelier, rattachée à un ordre, une intervention ou un véhicule", ton: "vigilance", sens: -1 },
  retour: { libelle: "Retour", precision: "Une pièce sortie et non posée, qui revient au magasin", ton: "neutre", sens: 1 },
  regularisation: { libelle: "Régularisation", precision: "Un inventaire a compté autre chose : l'écart, signé, avec son motif", ton: "defavorable", sens: 0 },
};

export interface MouvementStock {
  /** « MVT-2026-00120 ». */
  numero: string;
  date: string;
  nature: NatureMouvement;
  pieceNumero: string;
  /** Toujours positive ; le sens vient de la nature. Une régularisation porte l'écart signé dans `ecart`. */
  quantite: number;
  /** Pour une régularisation : l'écart compté, positif ou négatif. */
  ecart: number | null;
  /** Le prix unitaire payé, sur une entrée — indicatif, la charge passe à l'achat. */
  prixUnitaire: number | null;
  /** Ce que la ligne cite : la demande d'achat livrée, l'ordre de travail ou l'intervention servie, le véhicule. */
  demandeNumero: string | null;
  ordreNumero: string | null;
  interventionNumero: string | null;
  vehiculeId: string | null;
  immatriculationAffichee: string | null;
  fournisseur: string | null;
  motif: string | null;
  auteur: string;
  creee: boolean;
}

/** La quantité qu'un mouvement ajoute au stock, signée. */
export function variation(m: MouvementStock): number {
  if (m.nature === "regularisation") return m.ecart ?? 0;
  return NATURE_MOUVEMENT[m.nature].sens * m.quantite;
}

/* -- Le stock, déduit ------------------------------------------------------------------ */

export type EtatStock = "a-jour" | "sous-le-seuil" | "epuisee" | "dormante";

export const ETAT_STOCK: Record<EtatStock, { libelle: string; ton: Ton; precision: string; rang: number }> = {
  epuisee: { libelle: "Épuisée", ton: "defavorable", precision: "Plus rien en magasin", rang: 0 },
  "sous-le-seuil": { libelle: "Sous le seuil", ton: "vigilance", precision: "En dessous du minimum : à réapprovisionner", rang: 1 },
  dormante: { libelle: "Dormante", ton: "neutre", precision: "Aucun mouvement depuis six mois", rang: 2 },
  "a-jour": { libelle: "À jour", ton: "favorable", precision: "Au-dessus du minimum, et vivante", rang: 3 },
};

/** Au-delà, une pièce sans mouvement dort. */
export const JOURS_DORMANTE = 183;

export interface StockPiece {
  piece: Piece;
  quantite: number;
  etat: EtatStock;
  /** Le dernier prix d'entrée connu : la valeur indicative d'une unité. */
  dernierPrix: number | null;
  /** quantité × dernier prix ; nulle sans prix connu. */
  valeurIndicative: number | null;
  dernierMouvement: string | null;
  /** Sorties des douze derniers mois — le rythme de consommation. */
  sortiesDouzeMois: number;
  /** La quantité qui ramène au maximum quand la pièce est sous le seuil ; 0 sinon. */
  aCommander: number;
}

export function etatStock(quantite: number, minimum: number, dernierMouvement: string | null, aujourdhui: string): EtatStock {
  if (quantite <= 0) return "epuisee";
  if (quantite < minimum) return "sous-le-seuil";
  if (dernierMouvement && (Date.parse(aujourdhui) - Date.parse(dernierMouvement)) / 86_400_000 > JOURS_DORMANTE) return "dormante";
  return "a-jour";
}

/** Le stock de chaque pièce : la somme de ses mouvements, rien d'autre. */
export function stockDe(pieces: Piece[], mouvements: MouvementStock[], aujourdhui: string): StockPiece[] {
  const parPiece = new Map<string, MouvementStock[]>();
  for (const m of mouvements) parPiece.set(m.pieceNumero, [...(parPiece.get(m.pieceNumero) ?? []), m]);
  const unAn = new Date(`${aujourdhui}T00:00:00Z`);
  unAn.setUTCFullYear(unAn.getUTCFullYear() - 1);
  const depuis = unAn.toISOString().slice(0, 10);
  return pieces.map((piece) => {
    const siens = [...(parPiece.get(piece.numero) ?? [])].sort((a, b) => a.date.localeCompare(b.date) || a.numero.localeCompare(b.numero));
    const quantite = siens.reduce((t, m) => t + variation(m), 0);
    const derniereEntree = [...siens].reverse().find((m) => m.nature === "entree" && m.prixUnitaire !== null) ?? null;
    const dernierPrix = derniereEntree?.prixUnitaire ?? piece.prixReference;
    const dernierMouvement = siens.length ? siens[siens.length - 1]!.date : null;
    const etat = etatStock(quantite, piece.stockMinimum, dernierMouvement, aujourdhui);
    const cible = piece.stockMaximum ?? piece.stockMinimum;
    return {
      piece,
      quantite,
      etat,
      dernierPrix,
      valeurIndicative: dernierPrix === null ? null : Math.max(0, quantite) * dernierPrix,
      dernierMouvement,
      sortiesDouzeMois: siens.filter((m) => m.nature === "sortie" && m.date >= depuis).reduce((t, m) => t + m.quantite, 0),
      aCommander: quantite < piece.stockMinimum ? Math.max(0, cible - quantite) : 0,
    };
  });
}

/* -- Les pneus, un par un ---------------------------------------------------------- */

export type EtatPneu = "en-stock" | "monte" | "depose" | "rebute";

export const ETAT_PNEU: Record<EtatPneu, { libelle: string; ton: Ton; precision: string }> = {
  "en-stock": { libelle: "En stock", ton: "neutre", precision: "Au magasin, prêt à monter" },
  monte: { libelle: "Monté", ton: "favorable", precision: "Sur un véhicule, à sa position" },
  depose: { libelle: "Déposé", ton: "vigilance", precision: "Retiré d'un véhicule, à rechaper ou à remonter" },
  rebute: { libelle: "Rebuté", ton: "defavorable", precision: "Hors d'usage, sorti du parc" },
};

export const POSITIONS_PNEU = ["AVG", "AVD", "ARG ext.", "ARG int.", "ARD ext.", "ARD int.", "Roue de secours"] as const;

export interface Pneu {
  /** « PNE-2026-00034 ». */
  numero: string;
  /** La pièce (la dimension) qu'il incarne, quand elle est au référentiel. */
  pieceNumero: string | null;
  marque: string;
  dimension: string;
  /** Le numéro de série ou le DOT gravé sur le flanc. */
  numeroSerie: string | null;
  etat: EtatPneu;
  vehiculeId: string | null;
  immatriculationAffichee: string | null;
  position: string | null;
  datePose: string | null;
  kmPose: number | null;
  dateDepose: string | null;
  kmDepose: number | null;
  rechapages: number;
  commentaire: string | null;
  creee: boolean;
}

/** Les kilomètres qu'un pneu a faits sur le véhicule où il est, ou où il était. */
export function kmParcourus(p: Pneu, kmVehicule: number | null): number | null {
  if (p.kmPose === null) return null;
  if (p.kmDepose !== null) return Math.max(0, p.kmDepose - p.kmPose);
  if (p.etat === "monte" && kmVehicule !== null) return Math.max(0, kmVehicule - p.kmPose);
  return null;
}

/* -- Ce que le navigateur a créé, à la forme du module --------------------------------- */

const s = (x: unknown): string | null => (x === null || x === undefined || x === "" ? null : String(x));
const n = (x: unknown): number | null => {
  if (x === null || x === undefined || x === "") return null;
  const v = Number(String(x).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : null;
};

export function fabriquerPiece(c: Creation): Piece {
  const v = c.valeurs;
  return {
    numero: c.numero,
    reference: s(v.reference) ?? c.numero,
    designation: s(v.designation) ?? "",
    categorie: (s(v.categorie) as CategoriePiece) ?? "autre",
    unite: (s(v.unite) as UnitePiece) ?? "piece",
    referenceConstructeur: s(v.referenceConstructeur),
    compatibilites: (s(v.compatibilites) ?? "").split(/[;,]/).map((x) => x.trim()).filter(Boolean),
    fournisseurNumero: s(v.fournisseurNumero),
    fournisseur: s(v.fournisseur),
    prixReference: n(v.prixReference),
    stockMinimum: n(v.stockMinimum) ?? 0,
    stockMaximum: n(v.stockMaximum),
    actif: v.actif === undefined ? true : Boolean(v.actif),
    commentaire: s(v.commentaire),
    creee: true,
  };
}

export function fabriquerMouvement(c: Creation, immatriculationAffichee: (vehiculeId: string | null) => string | null): MouvementStock {
  const v = c.valeurs;
  const nature = (s(v.nature) as NatureMouvement) ?? "sortie";
  const vehiculeId = s(v.vehiculeId);
  return {
    numero: c.numero,
    date: s(v.date) ?? c.date,
    nature,
    pieceNumero: s(v.pieceNumero) ?? "",
    quantite: nature === "regularisation" ? Math.abs(n(v.ecart) ?? 0) : Math.abs(n(v.quantite) ?? 0),
    ecart: nature === "regularisation" ? (n(v.ecart) ?? 0) : null,
    prixUnitaire: n(v.prixUnitaire),
    demandeNumero: s(v.demandeNumero),
    ordreNumero: s(v.ordreNumero),
    interventionNumero: s(v.interventionNumero),
    vehiculeId,
    immatriculationAffichee: immatriculationAffichee(vehiculeId),
    fournisseur: s(v.fournisseur),
    motif: s(v.motif),
    auteur: c.auteur,
    creee: true,
  };
}

export function fabriquerPneu(c: Creation, immatriculationAffichee: (vehiculeId: string | null) => string | null): Pneu {
  const v = c.valeurs;
  const vehiculeId = s(v.vehiculeId);
  return {
    numero: c.numero,
    pieceNumero: s(v.pieceNumero),
    marque: s(v.marque) ?? "",
    dimension: s(v.dimension) ?? "",
    numeroSerie: s(v.numeroSerie),
    etat: (s(v.etat) as EtatPneu) ?? (vehiculeId ? "monte" : "en-stock"),
    vehiculeId,
    immatriculationAffichee: immatriculationAffichee(vehiculeId),
    position: s(v.position),
    datePose: s(v.datePose),
    kmPose: n(v.kmPose),
    dateDepose: s(v.dateDepose),
    kmDepose: n(v.kmDepose),
    rechapages: n(v.rechapages) ?? 0,
    commentaire: s(v.commentaire),
    creee: true,
  };
}

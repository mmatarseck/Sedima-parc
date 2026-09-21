/* ============================================================================
 * Le service de maintenance : ses lignes, sa facture, et ce que sa clôture
 * écrit.
 *
 * Métier, 21 septembre 2026 : « on doit pouvoir intégrer tout type de
 * facture — remise par ligne, remise globale, TVA 18 %, BRS 5 %, total HT,
 * total TTC ». Et : une pièce prise au magasin coûte son prix de référence.
 *
 * DEUX CHOSES DISTINCTES DANS UN SERVICE.
 *
 *   * **La facture du prestataire** : main-d'œuvre et pièces achetées, ligne
 *     par ligne, avec leurs remises ; la remise globale ; la TVA sur le total
 *     HT ; la BRS — retenue de 5 % du HT que SEDIMA verse à l'État à la place
 *     du prestataire. Le prestataire reçoit le **net à payer** (TTC − BRS) ;
 *     la charge, elle, est le **TTC** : la BRS est payée aussi, à l'État.
 *   * **Les pièces du magasin** : elles ne passent pas par la facture du
 *     garage, n'y portent ni remise ni taxe, et coûtent leur prix de
 *     référence. Payées à l'achat, elles portent ici leur coût au véhicule.
 *
 * Le coût du service = TTC de la facture + pièces du magasin.
 *
 * Tout est en francs entiers : un arrondi par montant, et l'écart d'arrondi
 * de la répartition revient à la plus grosse ligne — le total fait foi.
 * ==========================================================================*/

import type { PosteDepense } from "./types";

export type PrioriteService = "planifie" | "non-planifie" | "urgent";

export const PRIORITE_SERVICE: Record<PrioriteService, { libelle: string; ton: "neutre" | "vigilance" | "defavorable"; precision: string }> = {
  planifie: { libelle: "Planifié", ton: "neutre", precision: "Prévu à l'avance : entretien, échéance du plan" },
  "non-planifie": { libelle: "Non planifié", ton: "vigilance", precision: "Une panne ou une anomalie, sans immobiliser" },
  urgent: { libelle: "Urgent", ton: "defavorable", precision: "Le véhicule est arrêté, ou le sera" },
};

export type ModeRemise = "montant" | "pourcentage";

export interface PieceStockService {
  pieceNumero: string;
  designation: string;
  quantite: number;
  /** Le prix de référence au moment où la pièce est prise : celui de la dernière entrée de stock. */
  prixUnitaire: number;
}

export interface LigneService {
  /** Une clé d'affichage, stable pendant la saisie. */
  cle: string;
  /** La tâche du catalogue ; nulle pour une tâche écrite à la main. */
  tacheNumero: string | null;
  libelle: string;
  /** Ce que la tâche du catalogue ne dit pas : « côté gauche », « fuite au raccord arrière » (métier, 21 septembre 2026). */
  precision?: string;
  systeme: string | null;
  mainOeuvre: number;
  piecesAchetees: number;
  piecesStock: PieceStockService[];
  remiseMode: ModeRemise;
  remiseValeur: number;
}

export interface FactureService {
  lignes: LigneService[];
  /**
   * La main-d'œuvre facturée d'un seul montant, sans ventilation par tâche —
   * beaucoup de garages la donnent ainsi (métier, 21 septembre 2026). Elle
   * s'ajoute au sous-total, porte remise globale et taxes comme le reste.
   */
  mainOeuvreGlobale?: number;
  remiseMode: ModeRemise;
  remiseValeur: number;
  /** En pour cent : 18 pour la TVA, 5 pour la BRS ; 0 quand la facture n'en porte pas. */
  tvaTaux: number;
  brsTaux: number;
}

export const TAUX_TVA = 18;
export const TAUX_BRS = 5;

export interface LigneCalculee {
  cle: string;
  /** Main-d'œuvre + pièces achetées : ce que le garage facture sur la ligne. */
  facture: number;
  remise: number;
  netHT: number;
  /** Les pièces du magasin, hors facture. */
  stock: number;
  /** Ce que la ligne coûte, taxes et remise globale réparties comprises. */
  cout: number;
}

export interface TotauxService {
  lignes: LigneCalculee[];
  /** Toute la main-d'œuvre : celle des lignes et la main-d'œuvre globale. */
  mainOeuvre: number;
  mainOeuvreGlobale: number;
  /** Sa part du TTC. */
  coutMainOeuvreGlobale: number;
  piecesAchetees: number;
  remisesLignes: number;
  sousTotalHT: number;
  remiseGlobale: number;
  totalHT: number;
  tva: number;
  totalTTC: number;
  brs: number;
  netAPayer: number;
  stock: number;
  coutTotal: number;
}

const rond = (x: number) => Math.round(x);
const positif = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : 0);

function remise(base: number, mode: ModeRemise, valeur: number): number {
  const v = positif(valeur);
  return Math.min(base, rond(mode === "pourcentage" ? (base * Math.min(v, 100)) / 100 : v));
}

export function valeurStock(l: Pick<LigneService, "piecesStock">): number {
  return l.piecesStock.reduce((s, p) => s + rond(positif(p.quantite) * positif(p.prixUnitaire)), 0);
}

export function calculerService(f: FactureService): TotauxService {
  const bruts = f.lignes.map((l) => {
    const facture = rond(positif(l.mainOeuvre) + positif(l.piecesAchetees));
    const r = remise(facture, l.remiseMode, l.remiseValeur);
    return { cle: l.cle, facture, remise: r, netHT: facture - r, stock: valeurStock(l) };
  });
  const globale = rond(positif(f.mainOeuvreGlobale));
  const sousTotalHT = bruts.reduce((s, l) => s + l.netHT, 0) + globale;
  const remiseGlobale = remise(sousTotalHT, f.remiseMode, f.remiseValeur);
  const totalHT = sousTotalHT - remiseGlobale;
  const tva = rond((totalHT * positif(f.tvaTaux)) / 100);
  const totalTTC = totalHT + tva;
  const brs = rond((totalHT * positif(f.brsTaux)) / 100);
  const stock = bruts.reduce((s, l) => s + l.stock, 0);

  /* Le TTC réparti sur les lignes au prorata de leur net HT ; l'écart d'arrondi à la plus grosse. */
  const parts = [...bruts.map((l) => l.netHT), globale].map((ht) => (sousTotalHT > 0 ? rond((totalTTC * ht) / sousTotalHT) : 0));
  const ecart = totalTTC - parts.reduce((s, x) => s + x, 0);
  if (ecart !== 0 && parts.length) parts[parts.indexOf(Math.max(...parts))]! += ecart;

  return {
    lignes: bruts.map((l, i) => ({ ...l, cout: parts[i]! + l.stock })),
    mainOeuvre: f.lignes.reduce((s, l) => s + rond(positif(l.mainOeuvre)), 0) + globale,
    mainOeuvreGlobale: globale,
    coutMainOeuvreGlobale: parts[bruts.length]!,
    piecesAchetees: f.lignes.reduce((s, l) => s + rond(positif(l.piecesAchetees)), 0),
    remisesLignes: bruts.reduce((s, l) => s + l.remise, 0),
    sousTotalHT,
    remiseGlobale,
    totalHT,
    tva,
    totalTTC,
    brs,
    netAPayer: totalTTC - brs,
    stock,
    coutTotal: totalTTC + stock,
  };
}

/** Les jours d'immobilisation d'un service : du début des travaux à leur fin, bornes comprises — ou jusqu'à aujourd'hui s'il court encore. */
export function joursImmobilisation(debut: string | null | undefined, fin: string | null | undefined): number | null {
  if (!debut || !fin || fin < debut) return null;
  return Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86_400_000) + 1;
}

/* -- Ce que la clôture écrit --------------------------------------------------- */

export interface DepenseDeService {
  poste: PosteDepense;
  libelle: string;
  montant: number;
  origine: "facture" | "stock";
}

/**
 * Les dépenses d'un service clos : pour chaque ligne, la main-d'œuvre (poste
 * de maintenance préventive ou curative), les pièces achetées (poste pièces) —
 * leur part du TTC, remises et taxes comprises —, et chaque pièce du magasin à
 * son prix de référence, d'origine « stock ». La somme des dépenses est le
 * coût du service, au franc.
 */
export function depensesDuService(f: FactureService, type: "preventif" | "curatif"): DepenseDeService[] {
  const t = calculerService(f);
  const depenses: DepenseDeService[] = [];
  const posteMO: PosteDepense = type === "preventif" ? "maintenance-preventive" : "maintenance-curative";
  f.lignes.forEach((l, i) => {
    const c = t.lignes[i]!;
    const ttc = c.cout - c.stock;
    const mo = rond(positif(l.mainOeuvre));
    const pa = rond(positif(l.piecesAchetees));
    if (ttc > 0) {
      const partMO = mo + pa > 0 ? rond((ttc * mo) / (mo + pa)) : 0;
      if (partMO > 0) depenses.push({ poste: posteMO, libelle: `${l.libelle} — main-d'œuvre`, montant: partMO, origine: "facture" });
      if (ttc - partMO > 0) depenses.push({ poste: "pieces", libelle: `${l.libelle} — pièces`, montant: ttc - partMO, origine: "facture" });
    }
    for (const p of l.piecesStock) {
      const m = rond(positif(p.quantite) * positif(p.prixUnitaire));
      if (m > 0) depenses.push({ poste: "pieces", libelle: `${l.libelle} — ${p.designation} × ${p.quantite} (magasin)`, montant: m, origine: "stock" });
    }
  });
  if (t.coutMainOeuvreGlobale > 0) depenses.push({ poste: posteMO, libelle: "Main-d'œuvre globale", montant: t.coutMainOeuvreGlobale, origine: "facture" });
  return depenses;
}

/* -- Lire ce que la base ou le navigateur rend ----------------------------------- */

/** Les lignes d'un service, d'où qu'elles viennent : un tableau (la base), une chaîne JSON (une saisie). */
export function lireLignes(v: unknown): LigneService[] {
  let brut: unknown = v;
  if (typeof v === "string") {
    try {
      brut = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(brut)) return [];
  return brut
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object")
    .map((x, i) => ({
      cle: typeof x.cle === "string" ? x.cle : `l${i}`,
      tacheNumero: typeof x.tacheNumero === "string" ? x.tacheNumero : null,
      libelle: typeof x.libelle === "string" ? x.libelle : "",
      ...(typeof x.precision === "string" && x.precision.trim() ? { precision: x.precision } : {}),
      systeme: typeof x.systeme === "string" ? x.systeme : null,
      mainOeuvre: Number(x.mainOeuvre) || 0,
      piecesAchetees: Number(x.piecesAchetees) || 0,
      piecesStock: Array.isArray(x.piecesStock)
        ? (x.piecesStock as Record<string, unknown>[]).map((p) => ({ pieceNumero: String(p.pieceNumero ?? ""), designation: String(p.designation ?? ""), quantite: Number(p.quantite) || 0, prixUnitaire: Number(p.prixUnitaire) || 0 }))
        : [],
      remiseMode: x.remiseMode === "pourcentage" ? "pourcentage" : "montant",
      remiseValeur: Number(x.remiseValeur) || 0,
    }));
}

/* -- Qui clôt ------------------------------------------------------------------- */

/** Seul le responsable du parc clôt un service (métier, 21 septembre 2026) ; l'administrateur aussi. La base le vérifie de même (0060). */
export function peutCloturerService(role: string | null | undefined): boolean {
  return role === "gestionnaire-parc" || role === "administrateur";
}

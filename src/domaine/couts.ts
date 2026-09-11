/* ============================================================================
 * Coûts & analyses — le domaine du module de pilotage des coûts.
 *
 * Rien ne se saisit ici : tout se lit sur les dépenses des véhicules — toute
 * dépense est un mouvement daté rattaché à un véhicule, quelle que soit sa voie
 * de paiement (deuxième choix structurant du projet) — et sur les kilomètres et
 * les litres de leurs relevés et de leurs pleins. Le module répond à trois
 * questions : combien coûte le parc et où va l'argent (postes, mois, business
 * units) ; quels véhicules coûtent trop cher au kilomètre pour leur catégorie
 * (l'arbitrage réparer / réformer) ; qui consomme au-delà de sa référence.
 *
 * Deux périmètres, parce que la question 52 du cadrage n'est pas tranchée (le
 * coût interne inclut-il l'amortissement et l'assurance ? le référentiel KPI dit
 * non, le CDC §8.4 dit oui) : **exploitation** — ce que le parc décaisse pour
 * rouler et entretenir — et **complet** — avec l'amortissement et le salaire du
 * chauffeur. L'assurance reste dans les deux : c'est une dépense réelle du
 * véhicule. Le coût par tonne attendra les tonnages de SediLiv : ici, le coût
 * par kilomètre.
 * ==========================================================================*/

import { GROUPE_CHARGE, groupeDuPoste, type GroupeCharge, type Ton } from "./libelles";
import type { BusinessUnit, CategorieFlotte, CategorieVehicule, PosteDepense, StatutVehicule } from "./types";

export { GROUPE_CHARGE };

/* -- Périmètre --------------------------------------------------------------- */

export type Perimetre = "exploitation" | "complet";

export const PERIMETRE: Record<Perimetre, { libelle: string; precision: string }> = {
  exploitation: { libelle: "Exploitation", precision: "Carburant, maintenance, pneus, assurance, conformité, frais de route, péages, contraventions, divers" },
  complet: { libelle: "Complet", precision: "Exploitation, plus l'amortissement et le salaire du chauffeur (question 52 du cadrage)" },
};

/** Ce que le périmètre « exploitation » laisse de côté. */
export const POSTES_HORS_EXPLOITATION: PosteDepense[] = ["amortissement", "salaire"];

export function posteRetenu(poste: PosteDepense, perimetre: Perimetre): boolean {
  return perimetre === "complet" || !POSTES_HORS_EXPLOITATION.includes(poste);
}

/* -- La matière : un véhicule, mois par mois --------------------------------- */

export interface MoisVehicule {
  /** « 2026-03 ». */
  mois: string;
  km: number;
  litres: number;
  parPoste: Partial<Record<PosteDepense, number>>;
  /** Interventions curatives du mois : le signal d'un véhicule qui fatigue. */
  curatifs: number;
  /** Nul dès qu'une intervention du mois n'a pas de durée connue. */
  immobilisationJours: number | null;
}

export interface DonneesVehicule {
  vehiculeId: string;
  immatriculation: string;
  immatriculationAffichee: string;
  libelle: string;
  categorie: CategorieVehicule;
  categorieFlotte: CategorieFlotte;
  businessUnit: BusinessUnit | null;
  site: string | null;
  statut: StatutVehicule;
  /** Litres aux 100 km attendus pour la catégorie. */
  referenceL100: number;
  ageAnnees: number | null;
  mois: MoisVehicule[];
}

/* -- La période -------------------------------------------------------------- */

export type NombreMois = 3 | 6 | 12 | 24;

export const PERIODES_COUTS: { valeur: NombreMois; libelle: string }[] = [
  { valeur: 3, libelle: "3 mois" },
  { valeur: 6, libelle: "6 mois" },
  { valeur: 12, libelle: "12 mois" },
  { valeur: 24, libelle: "24 mois" },
];

/** Les N mois qui se terminent au mois d'aujourd'hui, du plus ancien au plus récent. */
export function moisDePeriode(aujourdhui: string, nombre: NombreMois): string[] {
  const [a, m] = aujourdhui.split("-").map(Number);
  const liste: string[] = [];
  for (let k = nombre - 1; k >= 0; k--) {
    const d = new Date(Date.UTC(a!, m! - 1 - k, 1));
    liste.push(d.toISOString().slice(0, 7));
  }
  return liste;
}

/* -- Bilan d'un véhicule sur la période -------------------------------------- */

export type VerdictCout = "favorable" | "neutre" | "vigilance" | "defavorable";

export const VERDICT_COUT: Record<VerdictCout, { libelle: string; precision: string; ton: Ton; couleur: string }> = {
  favorable: { libelle: "Économe", precision: "Coût au kilomètre nettement sous la médiane de sa catégorie", ton: "favorable", couleur: "var(--color-accent)" },
  neutre: { libelle: "Dans la norme", precision: "Coût au kilomètre proche de la médiane de sa catégorie", ton: "neutre", couleur: "var(--color-attenue-2)" },
  vigilance: { libelle: "À surveiller", precision: "Coût au kilomètre au-delà de la médiane de sa catégorie", ton: "vigilance", couleur: "var(--color-vigilance)" },
  defavorable: { libelle: "À arbitrer", precision: "Coût au kilomètre très au-delà de la médiane : réparer ou réformer ?", ton: "defavorable", couleur: "var(--color-defavorable)" },
};

/** Seuils du verdict, en écart à la médiane de la catégorie. À porter dans Paramètres. */
export const SEUIL_ECONOME = -0.15;
export const SEUIL_SURVEILLER = 0.15;
export const SEUIL_ARBITRER = 0.4;

export interface BilanVehicule {
  donnees: DonneesVehicule;
  km: number;
  litres: number;
  total: number;
  parGroupe: Record<GroupeCharge, number>;
  parPoste: Partial<Record<PosteDepense, number>>;
  coutParKm: number | null;
  litresAux100: number | null;
  /** Écart de la consommation à la référence de la catégorie, en pourcentage. */
  ecartL100Pct: number | null;
  curatifs: number;
  immobilisationJours: number | null;
  /** Trois derniers mois contre les trois précédents, en pourcentage ; nul sous six mois. */
  tendancePct: number | null;
  /** Écart du coût au kilomètre à la médiane de la catégorie ; posé par `qualifier`. */
  ecartCategoriePct: number | null;
  verdict: VerdictCout;
}

const GROUPES: GroupeCharge[] = ["carburant", "maintenance", "autres"];

export function bilanVehicule(d: DonneesVehicule, moisRetenus: string[], perimetre: Perimetre): BilanVehicule {
  const retenu = new Set(moisRetenus);
  const mois = d.mois.filter((m) => retenu.has(m.mois));
  const parPoste: Partial<Record<PosteDepense, number>> = {};
  const parGroupe: Record<GroupeCharge, number> = { carburant: 0, maintenance: 0, autres: 0 };
  let km = 0;
  let litres = 0;
  let curatifs = 0;
  let immobilisationJours: number | null = 0;
  for (const m of mois) {
    km += m.km;
    litres += m.litres;
    curatifs += m.curatifs;
    /* Un mois dont une durée manque rend la somme inconnue : la compléter par zéro dirait un véhicule jamais immobilisé. */
    immobilisationJours = immobilisationJours === null || m.immobilisationJours === null ? null : immobilisationJours + m.immobilisationJours;
    for (const [p, v] of Object.entries(m.parPoste) as [PosteDepense, number][]) {
      if (!posteRetenu(p, perimetre)) continue;
      parPoste[p] = (parPoste[p] ?? 0) + v;
      parGroupe[groupeDuPoste(p)] += v;
    }
  }
  const total = GROUPES.reduce((s, g) => s + parGroupe[g], 0);
  const litresAux100 = km > 0 && litres > 0 ? Math.round((litres / km) * 1000) / 10 : null;

  /* La tendance compare deux tranches de trois mois révolus : ce que coûte le
     véhicule ce trimestre contre le précédent. Le mois en cours, forcément
     incomplet, est laissé de côté — sinon toute tendance paraîtrait en baisse. */
  let tendancePct: number | null = null;
  const revolus = moisRetenus.slice(0, -1);
  if (revolus.length >= 6) {
    const cout = (liste: string[]) => mois.filter((m) => liste.includes(m.mois)).reduce((s, m) => s + (Object.entries(m.parPoste) as [PosteDepense, number][]).filter(([p]) => posteRetenu(p, perimetre)).reduce((t, [, v]) => t + v, 0), 0);
    const recents = cout(revolus.slice(-3));
    const avant = cout(revolus.slice(-6, -3));
    tendancePct = avant > 0 ? Math.round(((recents - avant) / avant) * 100) : null;
  }

  return {
    donnees: d,
    km,
    litres,
    total,
    parGroupe,
    parPoste,
    coutParKm: km > 0 ? Math.round(total / km) : null,
    litresAux100,
    ecartL100Pct: litresAux100 !== null && d.referenceL100 > 0 ? Math.round(((litresAux100 - d.referenceL100) / d.referenceL100) * 100) : null,
    curatifs,
    immobilisationJours,
    tendancePct,
    ecartCategoriePct: null,
    verdict: "neutre",
  };
}

function mediane(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 ? tri[milieu]! : (tri[milieu - 1]! + tri[milieu]!) / 2;
}

/**
 * Situe chaque véhicule dans sa catégorie : l'écart de son coût au kilomètre à
 * la médiane des véhicules de même catégorie qui ont roulé, et le verdict qui
 * en découle. Une catégorie d'un seul véhicule n'a pas de médiane : verdict neutre.
 */
export function qualifier(bilans: BilanVehicule[]): BilanVehicule[] {
  const parCategorie = new Map<CategorieVehicule, number[]>();
  for (const b of bilans) {
    if (b.coutParKm === null) continue;
    const liste = parCategorie.get(b.donnees.categorie) ?? [];
    liste.push(b.coutParKm);
    parCategorie.set(b.donnees.categorie, liste);
  }
  return bilans.map((b) => {
    const valeurs = parCategorie.get(b.donnees.categorie) ?? [];
    const med = valeurs.length >= 2 ? mediane(valeurs) : null;
    if (b.coutParKm === null || med === null || med === 0) return b;
    const ecart = (b.coutParKm - med) / med;
    const verdict: VerdictCout = ecart <= SEUIL_ECONOME ? "favorable" : ecart >= SEUIL_ARBITRER ? "defavorable" : ecart >= SEUIL_SURVEILLER ? "vigilance" : "neutre";
    return { ...b, ecartCategoriePct: Math.round(ecart * 100), verdict };
  });
}

/* -- Totaux de la flotte ------------------------------------------------------ */

export interface TotalMois {
  mois: string;
  total: number;
  parGroupe: Record<GroupeCharge, number>;
  km: number;
  litres: number;
}

export function totauxParMois(donnees: DonneesVehicule[], moisRetenus: string[], perimetre: Perimetre): TotalMois[] {
  return moisRetenus.map((mois) => {
    const t: TotalMois = { mois, total: 0, parGroupe: { carburant: 0, maintenance: 0, autres: 0 }, km: 0, litres: 0 };
    for (const d of donnees) {
      const m = d.mois.find((x) => x.mois === mois);
      if (!m) continue;
      t.km += m.km;
      t.litres += m.litres;
      for (const [p, v] of Object.entries(m.parPoste) as [PosteDepense, number][]) {
        if (!posteRetenu(p, perimetre)) continue;
        t.parGroupe[groupeDuPoste(p)] += v;
        t.total += v;
      }
    }
    return t;
  });
}

export interface LignePoste {
  poste: PosteDepense;
  groupe: GroupeCharge;
  parMois: Record<string, number>;
  total: number;
}

/** Une ligne par poste qui a coûté quelque chose, avec son montant mois par mois. */
export function lignesParPoste(donnees: DonneesVehicule[], moisRetenus: string[], perimetre: Perimetre): LignePoste[] {
  const lignes = new Map<PosteDepense, LignePoste>();
  const retenu = new Set(moisRetenus);
  for (const d of donnees) {
    for (const m of d.mois) {
      if (!retenu.has(m.mois)) continue;
      for (const [p, v] of Object.entries(m.parPoste) as [PosteDepense, number][]) {
        if (!posteRetenu(p, perimetre) || v === 0) continue;
        let l = lignes.get(p);
        if (!l) {
          l = { poste: p, groupe: groupeDuPoste(p), parMois: {}, total: 0 };
          lignes.set(p, l);
        }
        l.parMois[m.mois] = (l.parMois[m.mois] ?? 0) + v;
        l.total += v;
      }
    }
  }
  const ordre: GroupeCharge[] = ["carburant", "maintenance", "autres"];
  return [...lignes.values()].sort((a, b) => ordre.indexOf(a.groupe) - ordre.indexOf(b.groupe) || b.total - a.total);
}

/** « +12 % », « -4 % », « 0 % ». */
export function signe(pct: number | null): string {
  if (pct === null) return "—";
  return `${pct > 0 ? "+" : ""}${pct} %`;
}

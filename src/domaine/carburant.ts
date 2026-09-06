/* ============================================================================
 * Carburant — le domaine du module (Lot 2).
 *
 * Trois lectures d'une même matière, le plein :
 *
 *  - les **pleins** de toute la flotte (numéros PLN, déjà sur les fiches), avec
 *    leur source — la cuve interne ou une station — et le relevé de compteur
 *    qu'ils portent, passé au contrôle de cohérence ;
 *  - la **cuve interne** : un journal comme celui de la caisse. Une livraison
 *    l'alimente, chaque plein pris à la cuve en sort — la sortie cite le plein,
 *    elle ne se saisit pas à part —, un relevé de jauge dit ce qu'elle contient
 *    vraiment, et l'écart avec le stock théorique se calcule ;
 *  - la **consommation** par véhicule sur une période : litres, kilomètres,
 *    L/100 km contre la référence de sa catégorie, écart en pourcentage.
 *
 * Capacité de la cuve et seuils de dérive sont des constantes en attendant
 * Paramètres.
 * ==========================================================================*/

import type { PleinFiche } from "./fiche";
import type { Ton } from "./libelles";
import type { BusinessUnit } from "./types";

/* -- Pleins ------------------------------------------------------------------ */

export interface LignePlein extends PleinFiche {
  vehiculeId: string;
  immatriculation: string;
  immatriculationAffichee: string;
  vehicule: string;
  businessUnit: BusinessUnit | null;
  site: string | null;
  creee: boolean;
}

/** Vrai quand le plein est pris à la cuve interne — c'est lui qui sort du stock. */
export function estCuve(source: string): boolean {
  return /cuve/i.test(source);
}

export type EtatPlein = "cuve" | "station" | "releve-ecarte";

export function etatPlein(p: Pick<PleinFiche, "source" | "kmMotifRejet">): EtatPlein {
  if (p.kmMotifRejet) return "releve-ecarte";
  return estCuve(p.source) ? "cuve" : "station";
}

export const LIBELLE_ETAT_PLEIN: Record<EtatPlein, string> = {
  cuve: "Cuve interne",
  station: "Station",
  "releve-ecarte": "Relevé écarté",
};

export const PRECISION_ETAT_PLEIN: Record<EtatPlein, string> = {
  cuve: "Sorti du stock de la cuve, sur bon de sortie",
  station: "Payé en station, par la caisse parc",
  "releve-ecarte": "Le compteur saisi a été écarté par le contrôle de cohérence",
};

export const COULEUR_ETAT_PLEIN: Record<EtatPlein, string> = {
  cuve: "var(--color-accent)",
  station: "var(--color-attenue-2)",
  "releve-ecarte": "var(--color-vigilance)",
};

/* -- Cuve interne ------------------------------------------------------------ */

/** Contenance de la cuve interne SEDIMA — valeur de démonstration, à confirmer avec le métier et à porter dans Paramètres. */
export const CAPACITE_CUVE = 30_000;

/** Sous cette part de la capacité, la cuve est à réapprovisionner. */
export const PART_STOCK_BAS = 0.2;

export type SensCuve = "livraison" | "sortie" | "jauge";

export const SENS_CUVE: Record<SensCuve, string> = {
  livraison: "Livraison",
  sortie: "Sortie",
  jauge: "Relevé de jauge",
};

export const PRECISION_SENS_CUVE: Record<SensCuve, string> = {
  livraison: "Citerne livrée, bordereau au dossier",
  sortie: "Plein pris à la cuve, sur bon de sortie",
  jauge: "Ce que la jauge indique ; l'écart avec le stock théorique est calculé",
};

export const COULEUR_SENS_CUVE: Record<SensCuve, string> = {
  livraison: "var(--color-accent)",
  sortie: "var(--color-attenue-2)",
  jauge: "var(--color-vigilance)",
};

export const TON_SENS_CUVE: Record<SensCuve, Ton> = {
  livraison: "favorable",
  sortie: "neutre",
  jauge: "vigilance",
};

/**
 * Un mouvement du journal de la cuve.
 *
 * `litres` est la quantité livrée ou sortie ; pour un relevé de jauge, c'est le
 * stock lu. L'écart d'une jauge et le stock après chaque ligne se calculent sur
 * le journal entier, ils ne se saisissent jamais.
 */
export interface LigneCuve {
  numero: string;
  date: string;
  sens: SensCuve;
  libelle: string;
  litres: number;
  prixLitre: number | null;
  montant: number | null;
  fournisseur: string | null;
  /** Bordereau de livraison, bon de sortie. */
  piece: string | null;
  /** Le plein que la sortie alimente. */
  pleinNumero: string | null;
  vehiculeId: string | null;
  immatriculation: string | null;
  immatriculationAffichee: string | null;
  businessUnit: BusinessUnit | null;
  site: string | null;
  /** Relevé de jauge : stock lu moins stock théorique — négatif, il manque du carburant. */
  ecart: number | null;
  stockApres: number;
  enregistrePar: string;
  creee: boolean;
}

/**
 * Recalcule le stock après chaque mouvement, du plus ancien au plus récent, et
 * l'écart de chaque relevé de jauge. Un relevé recale le stock sur ce que la
 * jauge dit : c'est la réalité qui l'emporte sur le théorique.
 */
export function avecStock(mouvements: LigneCuve[], stockInitial: number): LigneCuve[] {
  const ordre: Record<SensCuve, number> = { livraison: 0, sortie: 1, jauge: 2 };
  const chronologique = [...mouvements].sort((a, b) => a.date.localeCompare(b.date) || ordre[a.sens] - ordre[b.sens] || a.numero.localeCompare(b.numero));
  let stock = stockInitial;
  return chronologique
    .map((m) => {
      if (m.sens === "livraison") stock += m.litres;
      else if (m.sens === "sortie") stock -= m.litres;
      else {
        const ecart = Math.round((m.litres - stock) * 10) / 10;
        stock = m.litres;
        return { ...m, ecart, stockApres: Math.round(stock * 10) / 10 };
      }
      return { ...m, stockApres: Math.round(stock * 10) / 10 };
    })
    .reverse();
}

/** La contenance vient des paramètres (Énergie et carburant) ; la constante n'est que le défaut. */
export function stockBas(stock: number, capacite: number = CAPACITE_CUVE): boolean {
  return stock <= capacite * PART_STOCK_BAS;
}

/* -- Consommation ------------------------------------------------------------ */

/** Au-delà de ces écarts à la référence, la consommation dérive, puis dérive fortement. */
export const SEUIL_DERIVE = 8;
export const SEUIL_DERIVE_FORTE = 15;

/** Un mois de consommation d'un véhicule — la matière de la vue par véhicule. */
export interface ConsommationMensuelleFlotte {
  vehiculeId: string;
  immatriculation: string;
  immatriculationAffichee: string;
  vehicule: string;
  businessUnit: BusinessUnit | null;
  site: string | null;
  categorie: string;
  referenceL100: number;
  /** « 2026-03 ». */
  mois: string;
  litres: number;
  kmParcourus: number;
  cout: number;
}

export interface ConsommationVehicule {
  vehiculeId: string;
  immatriculation: string;
  immatriculationAffichee: string;
  vehicule: string;
  businessUnit: BusinessUnit | null;
  site: string | null;
  categorie: string;
  referenceL100: number;
  mois: number;
  litres: number;
  kmParcourus: number;
  cout: number;
  litresAux100: number | null;
  ecartPct: number | null;
  etat: EtatConsommation;
}

export type EtatConsommation = "derive-forte" | "derive" | "conforme" | "sans-donnee";

export const LIBELLE_ETAT_CONSOMMATION: Record<EtatConsommation, string> = {
  "derive-forte": "Dérive forte",
  derive: "Dérive",
  conforme: "Conforme",
  "sans-donnee": "Sans donnée",
};

export const PRECISION_ETAT_CONSOMMATION: Record<EtatConsommation, string> = {
  "derive-forte": `Plus de ${SEUIL_DERIVE_FORTE} % au-dessus de la référence de la catégorie`,
  derive: `Entre ${SEUIL_DERIVE} et ${SEUIL_DERIVE_FORTE} % au-dessus de la référence`,
  conforme: "Dans la référence de la catégorie",
  "sans-donnee": "Pas de kilomètres ni de litres sur la période",
};

export const TON_ETAT_CONSOMMATION: Record<EtatConsommation, Ton> = {
  "derive-forte": "defavorable",
  derive: "vigilance",
  conforme: "favorable",
  "sans-donnee": "neutre",
};

export const COULEUR_ETAT_CONSOMMATION: Record<EtatConsommation, string> = {
  "derive-forte": "var(--color-defavorable)",
  derive: "var(--color-vigilance)",
  conforme: "var(--color-attenue-2)",
  "sans-donnee": "var(--color-attenue-2)",
};

export function etatConsommation(ecartPct: number | null): EtatConsommation {
  if (ecartPct === null) return "sans-donnee";
  if (ecartPct > SEUIL_DERIVE_FORTE) return "derive-forte";
  if (ecartPct > SEUIL_DERIVE) return "derive";
  return "conforme";
}

/** Agrège les mois d'un même véhicule en une ligne : litres, km, L/100 et écart à la référence. */
export function consolider(mois: ConsommationMensuelleFlotte[]): ConsommationVehicule[] {
  const parVehicule = new Map<string, ConsommationMensuelleFlotte[]>();
  for (const m of mois) parVehicule.set(m.vehiculeId, [...(parVehicule.get(m.vehiculeId) ?? []), m]);
  return [...parVehicule.values()].map((lignes) => {
    const p = lignes[0]!;
    const litres = Math.round(lignes.reduce((s, x) => s + x.litres, 0) * 10) / 10;
    const kmParcourus = lignes.reduce((s, x) => s + x.kmParcourus, 0);
    const cout = lignes.reduce((s, x) => s + x.cout, 0);
    const litresAux100 = kmParcourus > 0 && litres > 0 ? Math.round((litres / kmParcourus) * 1000) / 10 : null;
    const ecartPct = litresAux100 === null ? null : Math.round(((litresAux100 - p.referenceL100) / p.referenceL100) * 1000) / 10;
    return {
      vehiculeId: p.vehiculeId,
      immatriculation: p.immatriculation,
      immatriculationAffichee: p.immatriculationAffichee,
      vehicule: p.vehicule,
      businessUnit: p.businessUnit,
      site: p.site,
      categorie: p.categorie,
      referenceL100: p.referenceL100,
      mois: lignes.length,
      litres,
      kmParcourus,
      cout,
      litresAux100,
      ecartPct,
      etat: etatConsommation(ecartPct),
    };
  });
}

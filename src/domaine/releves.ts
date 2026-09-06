/* ============================================================================
 * Contrôle de cohérence des relevés kilométriques.
 *
 * Un relevé est recueilli à chaque plein, intervention ou dépense. C'est une
 * saisie humaine : elle se trompe — chiffre oublié, compteur d'un autre
 * véhicule, inversion. Un relevé incohérent n'est jamais supprimé (il reste
 * visible, avec son motif), mais il est **écarté** : il n'alimente ni
 * l'odomètre, ni la moyenne mensuelle, ni les échéances d'entretien.
 *
 * Trois règles, appliquées dans l'ordre chronologique contre le dernier relevé
 * retenu :
 *  1. la valeur doit être strictement positive et plausible ;
 *  2. un compteur ne recule pas ;
 *  3. la progression journalière ne dépasse pas un plafond, propre à la
 *     catégorie du véhicule.
 * ==========================================================================*/

import type { CategorieVehicule } from "./types";

export interface ReleveAControler {
  date: string;
  valeur: number;
}

export interface ResultatControle {
  valide: boolean;
  motifRejet: string | null;
}

/** Plafond de progression journalière, en km/jour, par catégorie. */
export const PLAFOND_KM_PAR_JOUR: Record<CategorieVehicule, number> = {
  camion: 900,
  tracteur: 1100,
  "semi-remorque": 1100,
  camionnette: 900,
  "vehicule-leger": 1000,
  bus: 900,
  moto: 400,
  engin: 150,
};

/** Au-delà, la valeur n'est pas un kilométrage de véhicule routier. */
export const PLAFOND_ABSOLU_KM = 2_500_000;

function joursEntre(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / (24 * 3600 * 1000);
}

function formater(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Contrôle une série de relevés. L'ordre d'entrée est indifférent ; le
 * résultat est rendu dans le même ordre que l'entrée, un verdict par relevé.
 */
export function controlerReleves<T extends ReleveAControler>(
  releves: T[],
  categorie: CategorieVehicule,
  plafondParJour: number = PLAFOND_KM_PAR_JOUR[categorie],
): (T & ResultatControle)[] {
  const indices = releves.map((_, i) => i).sort((a, b) => {
    const d = releves[a]!.date.localeCompare(releves[b]!.date);
    return d !== 0 ? d : releves[a]!.valeur - releves[b]!.valeur;
  });

  const verdicts: ResultatControle[] = releves.map(() => ({ valide: true, motifRejet: null }));
  let dernier: ReleveAControler | null = null;

  for (const i of indices) {
    const r = releves[i]!;
    let motif: string | null = null;

    if (!Number.isFinite(r.valeur) || r.valeur <= 0) {
      motif = "valeur nulle ou absente";
    } else if (r.valeur > PLAFOND_ABSOLU_KM) {
      motif = `valeur invraisemblable (${formater(r.valeur)} km)`;
    } else if (dernier && r.valeur < dernier.valeur) {
      motif = `inférieur au relevé précédent (${formater(dernier.valeur)} km le ${dernier.date})`;
    } else if (dernier) {
      const jours = Math.max(1, joursEntre(dernier.date, r.date));
      const parJour = (r.valeur - dernier.valeur) / jours;
      if (parJour > plafondParJour) {
        motif = `progression invraisemblable (${formater(Math.round(parJour))} km/jour, plafond ${formater(plafondParJour)})`;
      }
    }

    verdicts[i] = { valide: motif === null, motifRejet: motif };
    if (motif === null) dernier = r;
  }

  return releves.map((r, i) => ({ ...r, ...verdicts[i]! }));
}

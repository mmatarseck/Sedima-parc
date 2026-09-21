/* ============================================================================
 * L'amortissement d'un véhicule : linéaire, du jour de l'acquisition à la fin
 * de la durée prévue.
 *
 * Une seule règle, pour la fiche et pour les rapports — un chiffre lu dans un
 * rapport doit être celui de l'écran qui le porte.
 *
 * LE DÉPART. La comptabilité amortit depuis la **date d'acquisition** (0057).
 * Tant qu'elle n'est pas connue, la première mise en circulation en tient
 * lieu : c'est le même jour pour un véhicule acheté neuf. Pour une occasion,
 * ce ne l'est pas — un Hilux de 2019 acheté en mai 2026 n'est pas amorti
 * depuis 2023 —, et c'est pourquoi la date d'acquisition passe devant.
 * ==========================================================================*/

import type { Vehicule } from "./types";

export interface Amortissement {
  valeurNetteComptable: number | null;
  finAmortissement: string | null;
}

type Amortissable = Pick<Vehicule, "valeurAcquisition" | "dureeAmortissementAnnees" | "premiereMiseEnCirculation" | "dateAcquisition">;

export function amortissementDe(v: Amortissable, aujourdhui: string): Amortissement {
  const depart = v.dateAcquisition ?? v.premiereMiseEnCirculation;
  const duree = v.dureeAmortissementAnnees;
  const ageAnnees = depart ? (Date.parse(`${aujourdhui}T00:00:00Z`) - Date.parse(`${depart}T00:00:00Z`)) / (365.25 * 86_400_000) : null;
  return {
    valeurNetteComptable:
      v.valeurAcquisition !== null && duree && ageAnnees !== null ? Math.max(0, Math.round(v.valeurAcquisition * (1 - Math.min(1, Math.max(0, ageAnnees) / duree)))) : v.valeurAcquisition,
    finAmortissement: depart && duree ? `${Number(depart.slice(0, 4)) + duree}${depart.slice(4)}` : null,
  };
}

/* -- Le tableau d'amortissement d'une période -------------------------------- */

export interface TableauAmortissement {
  /** Le taux linéaire, en pour cent : 25 pour quatre ans. */
  tauxPct: number | null;
  /** L'amortissement cumulé à la veille du premier jour de la période. */
  cumulDebut: number | null;
  /** La dotation de la période. */
  dotation: number | null;
  /** L'amortissement cumulé au dernier jour de la période. */
  cumulFin: number | null;
  /** La valeur nette au dernier jour de la période. */
  valeurNetteFin: number | null;
  finAmortissement: string | null;
}

const JOUR = 86_400_000;
const jour = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

/**
 * Les colonnes du tableau des immobilisations de la comptabilité — cumul au
 * début, dotation, cumul à la fin, valeur nette — recalculées pour la période
 * demandée, au prorata des jours.
 *
 * C'est un **calcul**, pas l'écriture comptable : la comptabilité arrête ses
 * dotations à sa manière (au 31 août 2026, elle donne 985 743 F au Hilux
 * AB 900 JW là où le prorata des jours en donne 996 000). L'écart reste de
 * l'ordre du pour cent, et le rapport le dit.
 */
export function tableauAmortissement(v: Amortissable, debut: string, fin: string): TableauAmortissement {
  const depart = v.dateAcquisition ?? v.premiereMiseEnCirculation;
  const duree = v.dureeAmortissementAnnees;
  const valeur = v.valeurAcquisition;
  const vide = { tauxPct: duree ? Math.round((100 / duree) * 10) / 10 : null, cumulDebut: null, dotation: null, cumulFin: null, valeurNetteFin: valeur, finAmortissement: amortissementDe(v, fin).finAmortissement };
  if (valeur === null || !duree || !depart) return vide;
  /* L'amortissement cumulé au soir d'un jour donné : le jour de l'acquisition compte. */
  const cumulAu = (iso: string) => Math.round(valeur * Math.min(1, Math.max(0, (jour(iso) - jour(depart)) / JOUR + 1) / (duree * 365.25)));
  const veille = new Date(jour(debut) - JOUR).toISOString().slice(0, 10);
  const cumulDebut = cumulAu(veille);
  const cumulFin = cumulAu(fin);
  return { ...vide, cumulDebut, dotation: cumulFin - cumulDebut, cumulFin, valeurNetteFin: valeur - cumulFin };
}

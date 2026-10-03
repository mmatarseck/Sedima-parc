/* ============================================================================
 * Les chargements spécialisés et leurs capacités (0073).
 *
 * Métier, 3 octobre 2026 : un véhicule qui livre des poussins, des poulettes,
 * des œufs à couver (OAC) ou des œufs de table ne se mesure pas en tonnes,
 * mais en plateaux d'œufs, en milliers de poussins, en poulettes ou poulets
 * vifs — ces deux derniers se comptent pareil.
 * ==========================================================================*/

export type ChargementSpecial = "oeufs" | "poussins" | "volailles-vives";

export const CHARGEMENT_SPECIAL: Record<ChargementSpecial, { libelle: string; unite: string; uniteCourte: string; precision: string }> = {
  oeufs: { libelle: "Œufs (OAC, œufs de table)", unite: "plateaux", uniteCourte: "plateaux", precision: "en plateaux d'œufs" },
  poussins: { libelle: "Poussins", unite: "milliers de poussins", uniteCourte: "k poussins", precision: "en milliers de poussins" },
  "volailles-vives": { libelle: "Poulettes, poulets vifs", unite: "sujets", uniteCourte: "sujets", precision: "en nombre de poulettes ou de poulets vifs" },
};

export function estChargementSpecial(x: unknown): x is ChargementSpecial {
  return typeof x === "string" && x in CHARGEMENT_SPECIAL;
}

/** « 40 k poussins », « 1 200 plateaux » — le nombre à la française, l'unité courte. */
export function capaciteSpecialeTexte(nature: ChargementSpecial, valeur: number): string {
  const n = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(valeur).replace(/ /g, " ");
  return `${n} ${CHARGEMENT_SPECIAL[nature].uniteCourte}`;
}

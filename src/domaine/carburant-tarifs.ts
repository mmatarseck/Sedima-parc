/* ============================================================================
 * Les prix officiels du carburant au Sénégal, par date d'effet.
 *
 * Pourquoi cette table existe. Les suivis de consommation du dossier DO
 * portent des **litres**, jamais un prix : le carburant se tire sur puce à la
 * pompe, la quantité est relevée, la facturation vit ailleurs. Or la table
 * `plein` exige un prix au litre, et le tableau de bord comme la fiche
 * calculent un coût. Il fallait un prix, sans l'inventer.
 *
 * La réponse est venue du métier, le 10 septembre 2026 : « le prix du gazoil
 * et de l'essence étaient fixes sur tout 2025 et juste augmentés il y a
 * quelques mois ». Au Sénégal, ces prix ne sont pas de marché : ils sont
 * **fixés par arrêté**, publiés, et valent plafond pour toutes les stations.
 * Un prix officiel à une date n'est donc pas une estimation — c'est la donnée,
 * au même titre que les litres.
 *
 * Ce qu'il faut quand même dire, et que la fiche dit. Le prix officiel est le
 * **plafond réglementaire à la date**, pas le montant figurant sur une facture
 * : une remise négociée, une livraison en gros ou une station qui vend sous le
 * plafond s'en écartent. Un plein valorisé ainsi porte donc sa référence —
 * « Tarif officiel du 06/12/2025 » — pour qu'on ne prenne jamais un montant
 * calculé pour un montant relevé.
 *
 * Trois périodes couvrent 2025 et 2026, et le métier avait raison sur le fond
 * : le prix n'a bougé que deux fois en deux ans.
 *
 * | Période                        | Gasoil | Supercarburant |
 * | ------------------------------ | -----: | -------------: |
 * | jusqu'au 5 décembre 2025       |    755 |            990 |
 * | 6 décembre 2025 → 14 août 2026 |    680 |            920 |
 * | depuis le 15 août 2026         |    755 |            990 |
 *
 * Sources : communiqué de la Primature du 5 décembre 2025 (baisse effective le
 * 6 décembre à 18 h, arrêté de la CRSE) et l'ajustement du 15 août 2026, qui
 * ramène les tarifs à leur niveau d'avant la baisse.
 *
 * **Avant décembre 2025, la table s'arrête.** Les suivis hebdomadaires
 * remontent à mars 2022, et le prix y a connu d'autres mouvements que ceux-ci
 * — on ne les a pas établis. Charger 2022-2024 demandera de compléter cette
 * table, pas de prolonger la première ligne au hasard : `prixOfficiel` rend
 * `null` hors des périodes connues, et un plein sans prix se refuse plutôt que
 * de porter un chiffre faux.
 * ==========================================================================*/

/** Ce qu'un véhicule brûle, du point de vue du tarif. */
export type CarburantTarife = "gasoil" | "super";

export interface PeriodeTarifaire {
  /** Premier jour où le tarif s'applique, inclus. */
  debut: string;
  /** Dernier jour où il s'applique, inclus ; nul pour la période en cours. */
  fin: string | null;
  gasoil: number;
  super: number;
  /** D'où vient le chiffre, pour qu'on puisse le vérifier. */
  origine: string;
}

/**
 * Les périodes, de la plus ancienne à la plus récente.
 *
 * La baisse du 6 décembre 2025 a pris effet à 18 h ; on la fait courir au jour
 * entier. L'écart porte sur une demi-journée de pleins, il est sans effet sur
 * un coût mensuel, et une heure de bascule qu'aucun relevé ne porte serait
 * une précision feinte.
 */
export const PERIODES_TARIFAIRES: PeriodeTarifaire[] = [
  { debut: "2025-01-01", fin: "2025-12-05", gasoil: 755, super: 990, origine: "Tarif en vigueur avant la baisse du 6 décembre 2025" },
  { debut: "2025-12-06", fin: "2026-08-14", gasoil: 680, super: 920, origine: "Baisse des hydrocarbures, communiqué de la Primature du 5 décembre 2025" },
  { debut: "2026-08-15", fin: null, gasoil: 755, super: 990, origine: "Ajustement du 15 août 2026, retour au niveau d'avant décembre 2025" },
];

/** La période qui couvre un jour, ou nulle si le jour est hors de la table. */
export function periodeTarifaire(jour: string): PeriodeTarifaire | null {
  return PERIODES_TARIFAIRES.find((p) => jour >= p.debut && (p.fin === null || jour <= p.fin)) ?? null;
}

/**
 * Le prix officiel du litre à une date, en francs CFA. Nul hors des périodes
 * connues — un plein d'avant 2025 ne se valorise pas tant que la table ne
 * remonte pas jusqu'à lui.
 */
export function prixOfficiel(jour: string, carburant: CarburantTarife = "gasoil"): number | null {
  const p = periodeTarifaire(jour);
  return p ? p[carburant] : null;
}

/** La mention que porte un plein valorisé au tarif, pour ne pas le confondre avec un montant facturé. */
export function referenceTarif(jour: string): string | null {
  const p = periodeTarifaire(jour);
  return p ? `Tarif officiel du ${p.debut.slice(8, 10)}/${p.debut.slice(5, 7)}/${p.debut.slice(0, 4)}` : null;
}

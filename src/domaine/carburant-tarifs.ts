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
 * Quatre périodes couvrent 2022 à aujourd'hui, et le métier avait raison sur
 * le fond : le prix bouge rarement, et il tient des années entre deux arrêtés.
 *
 * | Période                          | Gasoil | Supercarburant |
 * | -------------------------------- | -----: | -------------: |
 * | 2022 → 6 janvier 2023            |    655 |      non établi |
 * | 7 janvier 2023 → 5 décembre 2025 |    755 |            990 |
 * | 6 décembre 2025 → 14 août 2026   |    680 |            920 |
 * | depuis le 15 août 2026           |    755 |            990 |
 *
 * Sources : le réajustement du 7 janvier 2023 (cent francs sur les deux
 * carburants) ; le communiqué de la Primature du 5 décembre 2025, baisse
 * effective le 6 décembre à 18 h par arrêté de la CRSE ; l'ajustement du
 * 15 août 2026, qui « met fin aux tarifs en vigueur depuis janvier 2023 » et
 * ramène les prix à leur niveau d'avant la baisse.
 *
 * **Hors de ces périodes, `prixOfficiel` rend `null`** — et un plein sans prix
 * ne se charge pas plutôt que de porter un chiffre faux. C'est le cas de
 * l'essence en 2022, dont on sait qu'elle a changé en juin sans savoir quel
 * jour, et de tout ce qui précède 2022.
 * ==========================================================================*/

/** Ce qu'un véhicule brûle, du point de vue du tarif. */
export type CarburantTarife = "gasoil" | "super";

export interface PeriodeTarifaire {
  /** Premier jour où le tarif s'applique, inclus. */
  debut: string;
  /** Dernier jour où il s'applique, inclus ; nul pour la période en cours. */
  fin: string | null;
  gasoil: number;
  /** Nul quand le tarif du supercarburant n est pas établi pour la période. */
  super: number | null;
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
  /* 2022, l'année où l'État a tout absorbé : le gasoil aurait dû coûter
     1 019 F au coût de revient, il est resté à 655 F toute l'année, pour
     583,5 milliards de subvention. Le supercarburant, lui, a bougé en cours
     d'année — 755 F jusqu'en juin, 890 F ensuite — mais **la date exacte du
     passage n'est pas établie**, d'où un `super` nul : on ne valorise pas un
     plein d'essence de 2022 tant qu'on ne sait pas de quel côté de juin il
     tombe. Le parc est au gasoil à 165 véhicules sur 167 ; la lacune ne coûte
     presque rien. */
  { debut: "2022-01-01", fin: "2023-01-06", gasoil: 655, super: null, origine: "Prix subventionné maintenu toute l'année 2022 ; le super a changé en juin, date non établie" },
  /* Le réajustement du 7 janvier 2023 : cent francs de plus sur les deux
     carburants. Ces tarifs ont tenu **trois ans**, jusqu'à la baisse de
     décembre 2025 — c'est ce que dit le communiqué d'août 2026, qui parle de
     mettre fin « aux tarifs en vigueur depuis janvier 2023 ». */
  { debut: "2023-01-07", fin: "2025-12-05", gasoil: 755, super: 990, origine: "Réajustement du 7 janvier 2023, en vigueur jusqu'à décembre 2025" },
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

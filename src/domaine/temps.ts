/* ============================================================================
 * Le jour où l'on est.
 *
 * Une fonction pour une chose que trente endroits écrivaient à la main, et que
 * dix-neuf autres faisaient dépendre du mode : `reel ? new Date()… :
 * DATE_REFERENCE`. Cette date de repli — le 2 septembre 2026, l'« aujourd'hui »
 * du jeu de démonstration — s'affichait en production, en toutes lettres, sur
 * le tableau de bord : « au 02/09/2026 » alors qu'on était le 15. Les écrans
 * n'ont plus à savoir d'où vient le jour ; il n'y en a qu'un.
 *
 * POURQUOI `toISOString` SUFFIT. Elle rend le jour en temps universel, ce qui
 * décalerait la date dans un pays à l'est ou à l'ouest de Greenwich. Le Sénégal
 * est à l'heure universelle toute l'année — pas de fuseau, pas d'heure d'été —
 * et le parc est au Sénégal. Le jour rendu est donc bien le jour d'ici.
 * ==========================================================================*/

/**
 * Le jour d'aujourd'hui, « AAAA-MM-JJ ».
 *
 * `jourCourant` et non `aujourdhui` : la variable `aujourdhui` traverse la
 * moitié des écrans, et une fonction du même nom s'y masquerait elle-même.
 */
export function jourCourant(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Le mois d'aujourd'hui, « AAAA-MM » — celui des clôtures et des budgets. */
export function moisCourant(): string {
  return new Date().toISOString().slice(0, 7);
}

const MOIS_COURTS = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEP", "OCT", "NOV", "DÉC"];
const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/**
 * Un mois « AAAA-MM » écrit en toutes lettres : « Septembre 2026 », ou « SEP »
 * en abrégé pour un axe de graphique.
 *
 * Il vivait dans les fixtures de démonstration, d'où quatre écrans — dont la
 * fiche chauffeur et l'assemblage des rapports — l'importaient. Lire un mois
 * n'a rien d'une donnée de démonstration, et cet import faisait entrer onze
 * cents lignes de faits inventés dans le paquet du navigateur.
 */
export function libelleMois(mois: string, court = false): string {
  const [a, m] = mois.split("-").map(Number);
  if (court) return MOIS_COURTS[m! - 1] ?? mois;
  const nom = MOIS_LONGS[m! - 1] ?? mois;
  return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${a}`;
}

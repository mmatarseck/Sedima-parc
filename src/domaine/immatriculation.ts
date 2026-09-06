/* ============================================================================
 * Normalisation des immatriculations.
 *
 * Les fichiers du parc portent trois écritures du même véhicule :
 * « AA 032 EA », « AA032EA » et « AA-032-EA ». C'est ce qui casse aujourd'hui
 * tout rapprochement entre l'inventaire, le carburant et la comptabilité.
 * La base ne stocke qu'une forme canonique ; l'affichage est reconstruit.
 * ==========================================================================*/

/** Forme canonique : majuscules, sans séparateur. « AA-032-ea » → « AA032EA ». */
export function normaliser(brut: string): string {
  return brut
    .normalize("NFKD")
    .replace(/[^0-9a-zA-Z]/g, "")
    .toUpperCase();
}

/**
 * Forme d'affichage sénégalaise : deux lettres, trois chiffres, deux lettres,
 * séparés par des espaces. « AA032EA » → « AA 032 EA ».
 * Les immatriculations qui ne suivent pas ce motif (anciennes plaques DK 6875 DF,
 * plaques à quatre chiffres) sont regroupées lettres / chiffres / lettres.
 */
export function afficher(canonique: string): string {
  const m = /^([A-Z]+)(\d+)([A-Z]*)$/.exec(canonique);
  if (!m) return canonique;
  return [m[1], m[2], m[3]].filter(Boolean).join(" ");
}

/** Vrai si les deux écritures désignent le même véhicule. */
export function memeVehicule(a: string, b: string): boolean {
  return normaliser(a) === normaliser(b);
}

/**
 * Cherche une immatriculation dans un texte libre — un libellé comptable
 * (« INJECTEUR PICK UP SECURITE DK 3033 BD ») ou un nom de facture.
 * Sert à rattacher automatiquement les 694 factures existantes à leur véhicule.
 */
export function extraireDepuisLibelle(libelle: string): string | null {
  const motif = /\b([A-Za-z]{2})[\s-]?(\d{3,4})[\s-]?([A-Za-z]{2})\b/;
  const m = motif.exec(libelle);
  if (!m) return null;
  return normaliser(m[1] + m[2] + m[3]);
}

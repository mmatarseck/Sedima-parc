/* ============================================================================
 * Le QR code d'un véhicule — demande du métier du 8 septembre 2026 : un code
 * collé sur le véhicule, imprimé avec son immatriculation, qui ouvre sa fiche
 * rapide sur le téléphone pour y prendre une action.
 *
 * Le code porte une adresse courte, `/v/<immatriculation>`, que
 * l'application redirige vers la fiche rapide : si l'adresse de
 * l'application change un jour, les étiquettes déjà collées restent bonnes
 * tant que ce chemin est servi. Ce module est pur : il vaut pour le
 * navigateur (aperçu en SVG) comme pour le serveur (étiquettes en PDF).
 * ==========================================================================*/

import { create } from "qrcode";

/** Le chemin court que le code porte, avant l'immatriculation canonique. */
export const CHEMIN_QR = "/v/";

export function urlVehicule(origine: string, immatriculation: string): string {
  return `${origine.replace(/\/$/, "")}${CHEMIN_QR}${immatriculation.replace(/[\s-]/g, "").toUpperCase()}`;
}

/** La matrice du code : `true` pour un module sombre. Correction M, la lecture tient sur une étiquette un peu abîmée. */
export function matriceQr(texte: string): boolean[][] {
  const code = create(texte, { errorCorrectionLevel: "M" });
  const taille = code.modules.size;
  const lignes: boolean[][] = [];
  for (let l = 0; l < taille; l++) {
    const ligne: boolean[] = [];
    for (let c = 0; c < taille; c++) ligne.push(code.modules.get(l, c) === 1);
    lignes.push(ligne);
  }
  return lignes;
}

/** Le tracé SVG des modules sombres, dans un repère où chaque module vaut 1, marge de calme comprise (4 modules). */
export function cheminSvgQr(matrice: boolean[][], marge = 4): { chemin: string; cote: number } {
  const taille = matrice.length;
  const parts: string[] = [];
  matrice.forEach((ligne, l) => {
    let debut = -1;
    ligne.forEach((sombre, c) => {
      if (sombre && debut < 0) debut = c;
      if ((!sombre || c === ligne.length - 1) && debut >= 0) {
        const fin = sombre && c === ligne.length - 1 ? c + 1 : c;
        parts.push(`M${debut + marge} ${l + marge}h${fin - debut}v1h-${fin - debut}z`);
        debut = -1;
      }
    });
  });
  return { chemin: parts.join(""), cote: taille + marge * 2 };
}

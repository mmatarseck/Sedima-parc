/* ============================================================================
 * Identité de l'application.
 *
 * Un seul endroit décide comment elle s'appelle : le nom apparaît dans la barre
 * d'application, sur la page de connexion, dans le titre des onglets et dans les
 * métadonnées. Le dossier du dépôt, lui, garde son nom court.
 * ==========================================================================*/

export const NOM_APPLICATION = "SEDIMA Logistique & Distribution";

/** Se lit sous le nom, en micro sur-titre. */
export const SOUS_TITRE_APPLICATION = "Gestion de flotte";

/** Suffixe des titres d'onglet : « Flotte — SEDIMA Logistique & Distribution ». */
export function titrePage(ecran: string): string {
  return `${ecran} — ${NOM_APPLICATION}`;
}

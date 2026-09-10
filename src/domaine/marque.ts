/* ============================================================================
 * Identité de l'application.
 *
 * Un seul endroit décide comment elle s'appelle : le nom apparaît dans la barre
 * d'application, sur la page de connexion, dans le titre des onglets et dans les
 * métadonnées. Le dossier du dépôt, lui, garde son nom court.
 *
 * **L'application a un nom depuis le 10 septembre 2026** (demande du métier).
 * Elle portait « SEDIMA Logistique & Distribution », qui est le nom d'une
 * direction et non celui d'un produit : on ne dit pas « ouvre SEDIMA
 * Logistique & Distribution », on dit « ouvre l'appli du parc ».
 *
 * Le nom retenu est **Parc** — signé SEDIMA, comme le sont les autres
 * applications de la maison. Ce n'est pas une invention : c'est déjà ainsi que
 * le projet se nomme partout ailleurs, dans le dépôt, dans les migrations,
 * dans le jeu de départ et dans les notes de reprise. L'interface se met
 * d'accord avec le reste plutôt que d'introduire un troisième nom.
 *
 * **Le logo ne change pas** : c'est le picto SEDIMA, `public/sedima-picto.png`
 * (métier, 10 septembre 2026). Un nom de produit n'appelle pas une marque
 * séparée quand il vit à l'intérieur d'une maison qui a la sienne.
 *
 * Pour changer le nom, il n'y a que les deux constantes ci-dessous.
 * ==========================================================================*/

/** Le nom du produit, tel qu'il s'affiche partout. */
export const NOM_APPLICATION = "SEDIMA Parc";

/** Se lit sous le nom, en micro sur-titre. */
export const SOUS_TITRE_APPLICATION = "Gestion de flotte";

/**
 * L'accroche de la page de garde.
 *
 * La première version disait « le parc qui livre l'aliment, chaque jour ». Le
 * métier l'a corrigée le 10 septembre 2026 : **le parc ne sert pas qu'à livrer
 * l'aliment.** Il porte aussi la farine et le son de blé, les poussins et les
 * œufs, les carcasses depuis les abattoirs, les équipes des fermes et du
 * couvoir, et les véhicules de service et de fonction du siège. Une accroche
 * qui n'en cite qu'un métier fait disparaître les autres.
 */
export const ACCROCHE_APPLICATION = "Tout ce qui roule pour SEDIMA, au même endroit.";

/** La phrase qui suit l'accroche, et qui dit l'étendue sans la réduire. */
export const PRECISION_APPLICATION =
  "Aliment, farine, poussins, œufs, abattoirs, fermes et couvoir : camions, citernes, frigos et véhicules de service — savoir ce qui roule, ce qui coûte et ce qui arrive à échéance.";

/** Suffixe des titres d'onglet : « Flotte — SEDIMA Parc ». */
export function titrePage(ecran: string): string {
  return `${ecran} — ${NOM_APPLICATION}`;
}

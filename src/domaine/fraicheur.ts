/* ============================================================================
 * La fraîcheur d'un calcul gardé — faut-il le refaire, le signaler, ou s'en
 * contenter ?
 *
 * Demande du métier (11 septembre 2026) : le tableau de bord ne se recalcule
 * plus à chaque ouverture, mais à la connexion ou sur appui d'un bouton, visible
 * quand les données ne sont pas à jour. Cette règle dit lequel des cas se
 * présente ; elle est pure, pour que le banc la tienne sans navigateur.
 *
 *   * **à calculer** — rien de gardé, un calcul fait pour un autre compte, ou
 *     une connexion postérieure au calcul : on recalcule sans demander ;
 *   * **autre jour** — le calcul date d'un jour précédent : les pastilles disent
 *     l'état de ce jour-là, l'écran le signale ;
 *   * **nouvelles saisies** — quelqu'un a saisi depuis le calcul : l'écran le
 *     signale et propose d'actualiser ;
 *   * **à jour** — rien n'a bougé : une ligne discrète dit de quand datent les
 *     chiffres.
 * ==========================================================================*/

export interface CalculGarde {
  /** Le compte pour qui le calcul a été fait. */
  compte: string;
  /** L'instant du calcul, en ISO. */
  calculeLe: string;
  /** Le jour que le calcul a pris pour aujourd'hui. */
  aujourdhui: string;
}

export interface Fraicheur {
  compte: string;
  /** La dernière saisie visible par ce compte ; nulle quand la base ne sait pas la dire. */
  derniereSaisie: string | null;
  aujourdhui: string;
}

export type EtatFraicheur =
  | { etat: "a-calculer"; motif: "absent" | "autre-compte" | "connexion" }
  | { etat: "autre-jour" }
  | { etat: "nouvelles-saisies"; depuis: string }
  | { etat: "a-jour" };

const instant = (iso: string) => Date.parse(iso);

export function etatFraicheur(garde: CalculGarde | null, fraicheur: Fraicheur, connexion: string | null): EtatFraicheur {
  if (!garde) return { etat: "a-calculer", motif: "absent" };
  if (garde.compte !== fraicheur.compte) return { etat: "a-calculer", motif: "autre-compte" };
  /* La connexion rafraîchit : c'est le moment que le métier a choisi. */
  if (connexion && instant(connexion) > instant(garde.calculeLe)) return { etat: "a-calculer", motif: "connexion" };
  if (garde.aujourdhui !== fraicheur.aujourdhui) return { etat: "autre-jour" };
  /* Les dates viennent de deux horloges écrites différemment — le serveur et la base : on compare des instants, pas des chaînes. */
  if (fraicheur.derniereSaisie && instant(fraicheur.derniereSaisie) > instant(garde.calculeLe)) return { etat: "nouvelles-saisies", depuis: garde.calculeLe };
  return { etat: "a-jour" };
}

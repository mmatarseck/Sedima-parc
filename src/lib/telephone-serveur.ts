/* ============================================================================
 * Reconnaître un téléphone, côté serveur.
 *
 * Le métier, le 10 septembre 2026 : « à l'ouverture de l'app mobile, on voit
 * le tableau de bord — à retirer ». C'est la suite de la décision du même
 * jour : le tableau de bord n'a pas à servir sur téléphone. Il ne suffisait
 * pas de cesser de le dessiner pour 375 px, il fallait cesser de l'ouvrir.
 *
 * Pourquoi l'agent utilisateur, et non la largeur de l'écran. La largeur n'est
 * connue que du navigateur, donc après le rendu : rediriger là-dessus voudrait
 * dire calculer tout le tableau de bord — vingt-huit jours de situations, deux
 * ans de faits — puis le jeter, et laisser le téléphone l'entrevoir au
 * passage. L'agent utilisateur arrive avec la requête ; la redirection tombe
 * avant la première lecture en base.
 *
 * Ce que ça vaut, et ce que ça ne vaut pas. Un agent utilisateur se déguise et
 * se démode ; ce n'est pas une frontière de sécurité, seulement un aiguillage
 * de confort, et il est sans conséquence quand il se trompe — les deux
 * destinations montrent les mêmes données, sous les mêmes droits. Le motif
 * couvre ce que l'on rencontre ici : Android, iPhone, iPad, et les navigateurs
 * qui s'annoncent « Mobile ». Une fenêtre de bureau rétrécie n'est pas un
 * téléphone et garde son tableau de bord.
 * ==========================================================================*/

import { headers } from "next/headers";

/** Les familles d'appareils qui doivent ouvrir sur la vue téléphone. */
const MOTIF_TELEPHONE = /android|iphone|ipod|ipad|iemobile|blackberry|opera mini|windows phone|\bmobile\b/i;

/** Vrai quand la requête vient d'un téléphone ou d'une tablette. */
export async function requeteDepuisUnTelephone(): Promise<boolean> {
  const agent = (await headers()).get("user-agent") ?? "";
  return MOTIF_TELEPHONE.test(agent);
}

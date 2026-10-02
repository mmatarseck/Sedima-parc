/* ============================================================================
 * Reconnaître un téléphone, à partir de l'agent utilisateur — et la page où il
 * entre. Partagé par le proxy, le serveur et les formulaires de connexion (voir
 * `lib/telephone-serveur.ts` pour le pourquoi de l'agent utilisateur).
 *
 * Le métier, le 2 octobre 2026 : « quand j'ouvre l'app sur mobile, j'ai la
 * page Flotte desktop ». L'accueil `/` renvoyait bien un téléphone vers sa
 * vue, mais la connexion et le proxy menaient tout le monde à `/flotte`.
 * ==========================================================================*/

/** Les familles d'appareils qui doivent ouvrir sur la vue téléphone. */
export const MOTIF_TELEPHONE = /android|iphone|ipod|ipad|iemobile|blackberry|opera mini|windows phone|\bmobile\b/i;

export function estTelephone(agent: string | null | undefined): boolean {
  return MOTIF_TELEPHONE.test(agent ?? "");
}

/** La première page après la connexion : la vue téléphone, ou la Flotte au bureau. */
export function premierePage(agent: string | null | undefined): string {
  return estTelephone(agent) ? "/telephone" : "/flotte";
}

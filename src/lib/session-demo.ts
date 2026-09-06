/* ============================================================================
 * Session de démonstration.
 *
 * Principe de non-régression repris de SEDIMA Opérations : tant que la
 * configuration Supabase est absente, l'application fonctionne en mode
 * démonstration et l'identité est choisie sur la page de garde. Dès que la
 * configuration est présente, l'authentification réelle prend le relais et ce
 * module n'est plus sollicité.
 *
 * Rien ici ne fait autorité : ce n'est pas un contrôle d'accès, seulement un
 * moyen de parcourir l'application avant que la base ne soit branchée.
 * ==========================================================================*/

import { ROLE_PAR_DEFAUT, type Role } from "@/domaine/roles";

const CLE = "sedima.parc.session-demo";

/** Vrai quand un projet Supabase est configuré : la démonstration s'efface alors. */
export function authentificationReelle(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function lireRole(): Role | null {
  try {
    const brut = localStorage.getItem(CLE);
    return brut ? (brut as Role) : null;
  } catch {
    return null;
  }
}

export function ouvrirSession(role: Role): void {
  try {
    localStorage.setItem(CLE, role);
  } catch {
    /* sans stockage, la session ne vaut que pour la page courante */
  }
}

export function fermerSession(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* rien à nettoyer */
  }
}

export { ROLE_PAR_DEFAUT };

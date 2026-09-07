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
    /* Un rôle de démonstration choisi à la main efface la fiche d'accès posée
       par le serveur : l'accès redevient celui du rôle. */
    if (!authentificationReelle()) localStorage.removeItem("sedima.parc.acces-courant");
  } catch {
    /* sans stockage, la session ne vaut que pour la page courante */
  }
}

export function fermerSession(): void {
  try {
    localStorage.removeItem(CLE);
    localStorage.removeItem(CLE_IDENTITE);
    localStorage.removeItem("sedima.parc.acces-courant");
  } catch {
    /* rien à nettoyer */
  }
}

/* -- L'identité, quand l'authentification est réelle ------------------------------
 *
 * Le rôle résolu par le serveur (`get_me()`) est posé ici par `AmorceSession`,
 * sous la même clé que la démonstration : les écrans qui lisent `lireRole()`
 * n'ont pas à savoir d'où il vient. Le nom et l'adresse viennent du profil.
 * Ce n'est toujours pas une autorisation — les politiques RLS décident — mais
 * l'affichage cesse de porter un nom de démonstration.
 */

const CLE_IDENTITE = "sedima.parc.identite";

export interface Identite {
  nom: string;
  courriel: string | null;
}

export function ecrireIdentite(identite: Identite): void {
  try {
    localStorage.setItem(CLE_IDENTITE, JSON.stringify(identite));
  } catch {
    /* sans stockage, l'identité ne vaut que pour la page courante */
  }
}

/** Nulle en démonstration : le nom est alors celui du rôle choisi. */
export function lireIdentite(): Identite | null {
  try {
    const brut = localStorage.getItem(CLE_IDENTITE);
    return brut ? (JSON.parse(brut) as Identite) : null;
  } catch {
    return null;
  }
}

/** Les initiales d'un nom affiché : « Mamadou Seck » → « MS ». */
export function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  const lettres = mots.length >= 2 ? `${mots[0]![0]}${mots[mots.length - 1]![0]}` : nom.slice(0, 2);
  return lettres.toUpperCase();
}

export { ROLE_PAR_DEFAUT };

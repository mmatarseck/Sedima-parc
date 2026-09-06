/* ============================================================================
 * Paramètres — stockage de démonstration, côté navigateur.
 *
 * Les paramètres vivent dans le navigateur ET dans un cookie : le navigateur
 * pour les écrans qui calculent chez eux (formulaires, fabriques), le cookie
 * pour que les pages rendues par le serveur (fiches, échéancier, disponibilité)
 * appliquent les mêmes règles. En production, une table `parametre` lue par
 * les deux, et une seule vérité.
 *
 * Chaque lecture alimente le registre des libellés (parametres.ts), pour que
 * TYPE_DOCUMENT nomme aussi les documents ajoutés par le métier. Le module le
 * fait dès son chargement dans le navigateur, avant le premier rendu.
 * ==========================================================================*/

import { COOKIE_PARAMETRES, appliquerLibelles, fusionnerParametres, type Parametres } from "@/domaine/parametres";

export function lireParametres(): Parametres {
  let p: Parametres;
  try {
    const brut = localStorage.getItem(COOKIE_PARAMETRES);
    p = fusionnerParametres(brut ? JSON.parse(brut) : null);
  } catch {
    p = fusionnerParametres(null);
  }
  appliquerLibelles(p);
  return p;
}

export function ecrireParametres(p: Parametres): void {
  const json = JSON.stringify(p);
  try {
    localStorage.setItem(COOKIE_PARAMETRES, json);
  } catch {
    /* sans stockage, le cookie suffit pour la session */
  }
  try {
    document.cookie = `${COOKIE_PARAMETRES}=${encodeURIComponent(json)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {
    /* pas de document : rien à faire */
  }
  appliquerLibelles(p);
}

export function reinitialiserParametres(): Parametres {
  try {
    localStorage.removeItem(COOKIE_PARAMETRES);
    document.cookie = `${COOKIE_PARAMETRES}=; path=/; max-age=0`;
  } catch {
    /* rien à nettoyer */
  }
  const p = fusionnerParametres(null);
  appliquerLibelles(p);
  return p;
}

/* Au chargement dans le navigateur : les libellés sont prêts avant l'hydratation. */
if (typeof window !== "undefined") lireParametres();

/* ============================================================================
 * Paramètres — ce que le navigateur en tient.
 *
 * En démonstration, les paramètres vivent dans le navigateur ET dans un
 * cookie : le navigateur pour les écrans qui calculent chez eux (formulaires,
 * fabriques), le cookie pour que les pages rendues par le serveur (fiches,
 * échéancier, disponibilité) appliquent les mêmes règles.
 *
 * Base branchée, une seule vérité : la table `parametre` et la table
 * `type_document`. Le serveur les lit (`parametres-serveur.ts`) et les pose
 * ici par `AmorceParametres` ; l'écriture part vers le serveur
 * (`parametres-actions.ts`), qui répond par un motif de refus s'il y en a un.
 *
 * Chaque lecture alimente le registre des libellés (parametres.ts), pour que
 * TYPE_DOCUMENT nomme aussi les documents ajoutés par le métier. Le module le
 * fait dès son chargement dans le navigateur, avant le premier rendu.
 * ==========================================================================*/

import { COOKIE_PARAMETRES, PARAMETRES_DEFAUT, appliquerLibelles, fusionnerParametres, type Parametres } from "@/domaine/parametres";
import { enregistrerParametres } from "@/lib/parametres-actions";
import { authentificationReelle } from "@/lib/session-demo";

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

/** Ce que le navigateur retient, sans rien envoyer : la valeur que le serveur a lue. */
export function poserParametres(p: Parametres): void {
  try {
    localStorage.setItem(COOKIE_PARAMETRES, JSON.stringify(p));
  } catch {
    /* sans stockage, la valeur ne vaut que pour la page courante */
  }
  appliquerLibelles(p);
}

/**
 * Enregistre. Nul quand c'est fait ; sinon le motif du refus, à afficher. En
 * démonstration, rien n'est refusé : le cookie porte la valeur au serveur.
 */
export async function ecrireParametres(p: Parametres): Promise<string | null> {
  poserParametres(p);
  if (authentificationReelle()) return enregistrerParametres(p);
  try {
    document.cookie = `${COOKIE_PARAMETRES}=${encodeURIComponent(JSON.stringify(p))}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {
    /* pas de document : rien à faire */
  }
  return null;
}

/** Les défauts, remis partout. Même contrat que `ecrireParametres`. */
export async function reinitialiserParametres(): Promise<{ parametres: Parametres; erreur: string | null }> {
  const p = fusionnerParametres(null);
  if (authentificationReelle()) {
    const erreur = await enregistrerParametres(PARAMETRES_DEFAUT);
    if (!erreur) poserParametres(p);
    return { parametres: p, erreur };
  }
  try {
    localStorage.removeItem(COOKIE_PARAMETRES);
    document.cookie = `${COOKIE_PARAMETRES}=; path=/; max-age=0`;
  } catch {
    /* rien à nettoyer */
  }
  appliquerLibelles(p);
  return { parametres: p, erreur: null };
}

/* Au chargement dans le navigateur : les libellés sont prêts avant l'hydratation. */
if (typeof window !== "undefined") lireParametres();

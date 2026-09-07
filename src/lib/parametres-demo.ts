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

import { CLES_PARAMETRES, COOKIE_PARAMETRES, PARAMETRES_DEFAUT, PREFIXE_COOKIE_PARAMETRES, TAILLE_MAX_COOKIE, appliquerLibelles, apprendreMarqueModele, encoderValeurCookie, fusionnerParametres, type Parametres } from "@/domaine/parametres";
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

const UN_AN = 60 * 60 * 24 * 365;

function poserCookie(nom: string, valeur: string | null): void {
  document.cookie = valeur === null ? `${nom}=; path=/; max-age=0` : `${nom}=${valeur}; path=/; max-age=${UN_AN}; samesite=lax`;
}

/**
 * Enregistre. Nul quand c'est fait ; sinon le motif du refus, à afficher.
 *
 * En démonstration, les cookies portent la valeur au serveur : un par clé,
 * pour ce qui diffère des défauts — un cookie unique dépassait la taille
 * admise et n'était plus écrit. Une clé trop grosse pour un cookie reste
 * dans le navigateur, et l'écran le dit.
 */
export async function ecrireParametres(p: Parametres): Promise<string | null> {
  poserParametres(p);
  if (authentificationReelle()) return enregistrerParametres(p);
  const defauts = fusionnerParametres(null);
  const tropGros: string[] = [];
  try {
    poserCookie(COOKIE_PARAMETRES, null);
    for (const cle of CLES_PARAMETRES) {
      const nom = PREFIXE_COOKIE_PARAMETRES + cle;
      if (JSON.stringify(p[cle]) === JSON.stringify(defauts[cle])) {
        poserCookie(nom, null);
        continue;
      }
      const valeur = encoderValeurCookie(p[cle]);
      if (valeur.length > TAILLE_MAX_COOKIE) {
        tropGros.push(cle);
        poserCookie(nom, null);
        continue;
      }
      poserCookie(nom, valeur);
    }
  } catch {
    /* pas de document : rien à faire */
  }
  return tropGros.length > 0 ? `Enregistré dans ce navigateur ; trop volumineux pour les pages du serveur en démonstration (${tropGros.join(", ")}) — elles gardent les défauts.` : null;
}

/**
 * Ce qu'une création de véhicule apprend au référentiel : une marque ou un
 * modèle inconnus y entrent aussitôt (demande du métier du 7 septembre 2026,
 * « au fur et à mesure qu'on crée des véhicules »). Rien n'est envoyé si
 * tout était déjà connu. Un refus du serveur n'empêche pas la création : le
 * véhicule existe, seul le référentiel n'a pas suivi, et l'écran le dit.
 */
export async function apprendreVehicule(marque: string, modele: string | null): Promise<string | null> {
  const p = lireParametres();
  const marques = apprendreMarqueModele(p.vehicules.marques, marque, modele);
  if (marques === p.vehicules.marques) return null;
  return ecrireParametres({ ...p, vehicules: { ...p.vehicules, marques } });
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
    poserCookie(COOKIE_PARAMETRES, null);
    for (const cle of CLES_PARAMETRES) poserCookie(PREFIXE_COOKIE_PARAMETRES + cle, null);
  } catch {
    /* rien à nettoyer */
  }
  appliquerLibelles(p);
  return { parametres: p, erreur: null };
}

/* Au chargement dans le navigateur : les libellés sont prêts avant l'hydratation. */
if (typeof window !== "undefined") lireParametres();

/* ============================================================================
 * Les calculs gardés dans le navigateur — le tableau de bord, d'abord.
 *
 * IndexedDB plutôt que localStorage : les faits de deux ans pèsent plusieurs
 * centaines de kilo-octets, au-delà de ce qu'un localStorage tient sans
 * broncher. Tout échoue en silence : sans stockage, l'écran recalcule, comme
 * avant.
 *
 * À la connexion, un marqueur daté dit que le prochain affichage doit
 * recalculer ; à la déconnexion, tout est effacé — sur un poste partagé, les
 * chiffres d'un compte ne restent pas pour le suivant.
 * ==========================================================================*/

const BASE = "sedima-parc-instantanes";
const MAGASIN = "instantanes";
const CLE_CONNEXION = "sedima.parc.connexion";

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open(BASE, 1);
    requete.onupgradeneeded = () => {
      if (!requete.result.objectStoreNames.contains(MAGASIN)) requete.result.createObjectStore(MAGASIN);
    };
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

export async function lireInstantane<T>(cle: string): Promise<T | null> {
  try {
    const base = await ouvrir();
    return await new Promise<T | null>((resoudre) => {
      const requete = base.transaction(MAGASIN, "readonly").objectStore(MAGASIN).get(cle);
      requete.onsuccess = () => resoudre((requete.result as T | undefined) ?? null);
      requete.onerror = () => resoudre(null);
    });
  } catch {
    return null;
  }
}

export async function ecrireInstantane<T>(cle: string, valeur: T): Promise<void> {
  try {
    const base = await ouvrir();
    await new Promise<void>((resoudre) => {
      const transaction = base.transaction(MAGASIN, "readwrite");
      transaction.objectStore(MAGASIN).put(valeur, cle);
      transaction.oncomplete = () => resoudre();
      transaction.onerror = () => resoudre();
    });
  } catch {
    /* sans stockage, le prochain affichage recalculera */
  }
}

/** À la déconnexion : rien ne reste d'un compte pour le suivant. */
export function effacerInstantanes(): void {
  try {
    indexedDB.deleteDatabase(BASE);
    localStorage.removeItem(CLE_CONNEXION);
  } catch {
    /* rien à effacer */
  }
}

/** À la connexion : le prochain affichage d'un calcul gardé le refera. */
export function marquerConnexion(): void {
  try {
    localStorage.setItem(CLE_CONNEXION, new Date().toISOString());
  } catch {
    /* sans stockage, rien n'est gardé : tout se recalcule de toute façon */
  }
}

export function lireConnexion(): string | null {
  try {
    return localStorage.getItem(CLE_CONNEXION);
  } catch {
    return null;
  }
}

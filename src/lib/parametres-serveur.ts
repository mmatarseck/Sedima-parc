import { cookies } from "next/headers";
import { COOKIE_PARAMETRES, appliquerLibelles, fusionnerParametres, type Parametres } from "@/domaine/parametres";

/**
 * Les paramètres tels que le serveur les lit — dans le cookie que l'écran
 * Paramètres écrit. Sans cookie, les défauts. À appeler dans une page rendue
 * par le serveur, avant de construire les fiches : la lecture alimente aussi
 * le registre des libellés, pour que TYPE_DOCUMENT nomme les documents ajoutés.
 */
export async function parametresServeur(): Promise<Parametres> {
  let p: Parametres;
  try {
    const jar = await cookies();
    const brut = jar.get(COOKIE_PARAMETRES)?.value;
    p = fusionnerParametres(brut ? JSON.parse(decodeURIComponent(brut)) : null);
  } catch {
    p = fusionnerParametres(null);
  }
  appliquerLibelles(p);
  return p;
}

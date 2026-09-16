"use server";

import { referentielsChoixServeur } from "@/donnees/referentiels-choix";
import type { ReferentielsChoix } from "@/lib/referentiels-navigateur";
import { parametresServeur } from "@/lib/parametres-serveur";

/* ============================================================================
 * Relire les référentiels des formulaires, à la demande du navigateur.
 *
 * La mise en page les pose à chaque rendu du serveur, et une écriture acceptée
 * redemande la page (`RafraichirApresEcriture`). Cela devrait suffire — et le
 * métier a pourtant retrouvé, le 16 septembre 2026, un chauffeur créé absent
 * de la liste d'affectation qui suivait, alors que la base le portait et que
 * le serveur le lisait. Plutôt que de parier sur ce que le rafraîchissement
 * rejoue, le navigateur demande ici les référentiels eux-mêmes et les pose :
 * une lecture directe, la même que celle de la mise en page, avec la session
 * de l'utilisateur.
 *
 * Nul quand il n'y a pas de session ou de paramètres : on ne remplace pas de
 * bons référentiels par des listes vides.
 * ==========================================================================*/
export async function relireReferentiels(): Promise<ReferentielsChoix | null> {
  try {
    const parametres = await parametresServeur();
    if (!parametres) return null;
    return await referentielsChoixServeur(parametres);
  } catch {
    return null;
  }
}

/* Les personnes que l'on peut citer dans une discussion : les comptes actifs de l'application (fiches d'accès), en base ; les identités de la démonstration sinon. Serveur seulement. */

import { cache } from "react";
import type { Personne } from "@/domaine/discussion";
import { personnesUtilisateurs } from "@/lib/discussion-demo";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";

function initialesDe(nom: string): string {
  return nom.split(/\s+/).map((m) => m[0] ?? "").join("").slice(0, 2).toUpperCase() || "??";
}

interface LigneAnnuaire {
  utilisateur_id: string;
  prenom: string | null;
  nom: string | null;
  fonction: string | null;
}

/**
 * L'annuaire passe par `annuaire()` (migration 0032) et non par
 * `accesServeur()`. La raison vaut d'être écrite : `acces_utilisateur` ne se
 * lit que pour soi-même, sauf administrateur — le sélecteur de citations était
 * donc **vide pour tout le monde**, sans erreur ni message. La fonction rend
 * le strict nécessaire pour citer quelqu'un, et rien de plus.
 */
async function personnesServeurBrut(): Promise<Personne[]> {
  if (!authentificationReelle()) return personnesUtilisateurs();
  const client = await clientServeur();
  /* `rpc` d'une fonction `returns table` rend déjà un tableau ; le typer par
     `returns<T[]>` fâche le client, qui croit à un `single()`. */
  const lecture = await client.rpc("annuaire");
  if (lecture.error) {
    console.warn(`Annuaire : lecture impossible (${lecture.error.message}).`);
    return [];
  }
  return ((lecture.data ?? []) as LigneAnnuaire[]).map((a) => {
    const nom = `${a.prenom ?? ""} ${a.nom ?? ""}`.trim() || "Compte";
    return { id: a.utilisateur_id, nom, initiales: initialesDe(nom), precision: a.fonction ?? "" };
  });
}

export const personnesServeur = cache(personnesServeurBrut);

/* Les personnes que l'on peut citer dans une discussion : les comptes actifs de l'application (fiches d'accès), en base ; les identités de la démonstration sinon. Serveur seulement. */

import { cache } from "react";
import { PROFILS } from "@/domaine/acces";
import type { Personne } from "@/domaine/discussion";
import { accesServeur } from "@/lib/acces-serveur";
import { personnesUtilisateurs } from "@/lib/discussion-demo";
import { authentificationReelle } from "@/lib/session-demo";

function initialesDe(nom: string): string {
  return nom.split(/\s+/).map((m) => m[0] ?? "").join("").slice(0, 2).toUpperCase() || "??";
}

async function personnesServeurBrut(): Promise<Personne[]> {
  if (!authentificationReelle()) return personnesUtilisateurs();
  const acces = await accesServeur();
  return acces
    .filter((a) => a.actif)
    .map((a) => {
      const nom = `${a.prenom} ${a.nom}`.trim() || a.courriel || "Compte";
      const profil = PROFILS.find((p) => p.profil === a.profil)?.libelle ?? a.profil;
      return { id: a.id, nom, initiales: initialesDe(nom), precision: a.fonction ?? profil };
    })
    .sort((x, y) => x.nom.localeCompare(y.nom, "fr"));
}

export const personnesServeur = cache(personnesServeurBrut);

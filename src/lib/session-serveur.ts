/* ============================================================================
 * La session telle que le serveur la connaît.
 *
 * En démonstration (pas de projet Supabase configuré), il n'y a pas de session
 * côté serveur : l'identité est choisie sur la page de garde et vit dans le
 * navigateur (`session-demo.ts`). Dès que la configuration est présente, c'est
 * ici que le rôle se résout — par `get_me()`, jamais par le navigateur — et le
 * nom vient du profil.
 * ==========================================================================*/

import { cache } from "react";
import type { AccesCourant } from "@/domaine/acces";
import type { Role } from "@/domaine/roles";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur, utilisateurCourant } from "@/lib/supabase";

export interface SessionServeur {
  utilisateurId: string;
  role: Role;
  siteId: string | null;
  /** La fiche d'accès rendue par `get_me()` ; nulle tant que la migration 0008 n'est pas jouée. */
  acces: AccesCourant | null;
  nom: string;
  courriel: string | null;
}

/** Ce qu'une page apprend de la session : personne, ou un compte sans profil, ou un compte. */
export type EtatSession = { etat: "demonstration" } | { etat: "anonyme" } | { etat: "sans-profil"; courriel: string | null } | { etat: "connecte"; session: SessionServeur };

/**
 * L'état de la session courante. `getUser()` revalide le jeton auprès de
 * Supabase ; `get_me()` dit si le compte a un profil actif. Un compte invité
 * dont le profil n'a pas encore été posé est « sans profil » : l'application
 * le dit plutôt que de lui montrer des listes vides.
 */
async function sessionCouranteBrut(): Promise<EtatSession> {
  if (!authentificationReelle()) return { etat: "demonstration" };
  const client = await clientServeur();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { etat: "anonyme" };
  const moi = await utilisateurCourant(client);
  if (!moi) return { etat: "sans-profil", courriel: user.email ?? null };
  const { data: profil } = await client.from("profil").select("nom").eq("utilisateur_id", moi.utilisateurId).maybeSingle<{ nom: string }>();
  return {
    etat: "connecte",
    session: { ...moi, nom: profil?.nom ?? user.email ?? "Compte", courriel: user.email ?? null },
  };
}

/** Une lecture par requête : la mise en page et la page qui appellent `sessionCourante()` partagent le même résultat (revue du 8 septembre 2026). */
export const sessionCourante = cache(sessionCouranteBrut);

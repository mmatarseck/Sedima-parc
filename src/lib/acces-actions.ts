"use server";

/* ============================================================================
 * L'enregistrement d'une fiche d'accès, côté serveur.
 *
 * Seul l'administrateur écrit — c'est lui qui approuve les écarts d'un accès
 * par rapport à son profil (décision du métier du 7 septembre 2026). Le
 * contrôle est refait ici avant d'écrire, parce qu'une fonction serveur se
 * joint par une simple requête POST ; les politiques RLS tranchent ensuite.
 *
 * Deux écritures : la fiche dans `acces_utilisateur`, et le rôle historique
 * du profil dans `profil.role` — celui que `get_me()` rend et que les
 * politiques lisent. Les deux disent la même chose.
 * ==========================================================================*/

import { revalidatePath } from "next/cache";
import { ecartsDe, normaliserAcces, trouverProfil, type AccesUtilisateur } from "@/domaine/acces";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur, utilisateurCourant } from "@/lib/supabase";

export async function enregistrerAcces(brut: AccesUtilisateur): Promise<string | null> {
  if (!authentificationReelle()) return null;
  const a = normaliserAcces(brut);
  if (!a) return "Fiche illisible.";
  const client = await clientServeur();
  const moi = await utilisateurCourant(client);
  if (!moi) return "Session absente : reconnectez-vous avant d'enregistrer.";
  if (moi.role !== "administrateur") return "Les accès se règlent par l'administrateur.";

  const maintenant = new Date().toISOString();
  /* Un écart n'est approuvé que par l'administrateur qui enregistre : la fiche
     ne peut pas s'approuver elle-même. */
  const ecarts = ecartsDe(a).length > 0 || a.sanctions !== null;
  const approuves = ecarts ? a.ecartsApprouves : true;
  const ligne = {
    utilisateur_id: a.id,
    prenom: a.prenom,
    nom: a.nom,
    courriel: a.courriel,
    telephone: a.telephone,
    fonction: a.fonction,
    matricule: a.matricule,
    actif: a.actif,
    profil: a.profil,
    perimetre: a.perimetre,
    modules: a.modules,
    sanctions: a.sanctions,
    ecarts_approuves_par: approuves && ecarts ? moi.utilisateurId : null,
    ecarts_approuves_le: approuves && ecarts ? maintenant : null,
    chauffeur_id: a.chauffeurId,
    attributaire_id: a.attributaireId,
    modifie_le: maintenant,
    modifie_par: moi.utilisateurId,
  };
  const fiche = await client.from("acces_utilisateur").upsert(ligne, { onConflict: "utilisateur_id" });
  if (fiche.error) return `Enregistrement refusé : ${fiche.error.message}`;

  const role = trouverProfil(a.profil).roleDefaut;
  const profil = await client.from("profil").upsert({ utilisateur_id: a.id, nom: `${a.prenom} ${a.nom}`.trim(), role, actif: a.actif, modifie_le: maintenant, modifie_par: moi.utilisateurId }, { onConflict: "utilisateur_id" });
  if (profil.error) return `Profil refusé : ${profil.error.message}`;

  revalidatePath("/parametres/utilisateurs");
  return null;
}

export async function retirerAcces(id: string): Promise<string | null> {
  if (!authentificationReelle()) return null;
  const client = await clientServeur();
  const moi = await utilisateurCourant(client);
  if (!moi) return "Session absente : reconnectez-vous avant de retirer.";
  if (moi.role !== "administrateur") return "Les accès se règlent par l'administrateur.";
  /* Un compte qui part garde ses traces : on le désactive, on ne l'efface pas. */
  const maintenant = new Date().toISOString();
  const fiche = await client.from("acces_utilisateur").update({ actif: false, modifie_le: maintenant, modifie_par: moi.utilisateurId }).eq("utilisateur_id", id);
  if (fiche.error) return `Retrait refusé : ${fiche.error.message}`;
  const profil = await client.from("profil").update({ actif: false, modifie_le: maintenant, modifie_par: moi.utilisateurId }).eq("utilisateur_id", id);
  if (profil.error) return `Profil refusé : ${profil.error.message}`;
  revalidatePath("/parametres/utilisateurs");
  return null;
}

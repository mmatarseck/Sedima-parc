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
 *
 * L'INVITATION (2 octobre 2026). Une fiche nouvelle a besoin d'un compte de
 * connexion : `acces_utilisateur` et `profil` pointent vers `auth.users`.
 * `inviterAcces` crée ce compte par la clé de service, écrit la fiche avec son
 * identifiant, et rend un **lien personnel** que l'administrateur envoie
 * lui-même depuis sa messagerie (métier, 2 octobre 2026) : le service de
 * courriel de Supabase ne livre qu'aux membres du projet, et aucun serveur
 * d'envoi n'est encore branché. Le lien mène à « Choisir mon mot de passe ».
 * ==========================================================================*/

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ecartsDe, normaliserAcces, trouverProfil, type AccesUtilisateur } from "@/domaine/acces";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur, clientService, utilisateurCourant } from "@/lib/supabase";

/** Ce que rend une invitation : le lien à envoyer, ou le refus. */
export type Invitation = { erreur: string } | { id: string; courriel: string; lien: string };

/** L'administrateur connecté, ou la raison du refus. */
async function administrateur(verbe: string): Promise<{ client: SupabaseClient; moi: string } | { erreur: string }> {
  const client = await clientServeur();
  const moi = await utilisateurCourant(client);
  if (!moi) return { erreur: `Session absente : reconnectez-vous avant ${verbe}.` };
  if (moi.role !== "administrateur") return { erreur: "Les accès se règlent par l'administrateur." };
  return { client, moi: moi.utilisateurId };
}

async function ecrireFiche(client: SupabaseClient, moi: string, a: AccesUtilisateur): Promise<string | null> {
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
    ecarts_approuves_par: approuves && ecarts ? moi : null,
    ecarts_approuves_le: approuves && ecarts ? maintenant : null,
    chauffeur_id: a.chauffeurId,
    attributaire_id: a.attributaireId,
    modifie_le: maintenant,
    modifie_par: moi,
  };
  const fiche = await client.from("acces_utilisateur").upsert(ligne, { onConflict: "utilisateur_id" });
  if (fiche.error) return `Enregistrement refusé : ${fiche.error.message}`;

  const role = trouverProfil(a.profil).roleDefaut;
  const profil = await client.from("profil").upsert({ utilisateur_id: a.id, nom: `${a.prenom} ${a.nom}`.trim(), role, actif: a.actif, modifie_le: maintenant, modifie_par: moi }, { onConflict: "utilisateur_id" });
  if (profil.error) return `Profil refusé : ${profil.error.message}`;

  revalidatePath("/parametres/utilisateurs");
  return null;
}

export async function enregistrerAcces(brut: AccesUtilisateur): Promise<string | null> {
  if (!authentificationReelle()) return null;
  const a = normaliserAcces(brut);
  if (!a) return "Fiche illisible.";
  const admin = await administrateur("d'enregistrer");
  if ("erreur" in admin) return admin.erreur;
  return ecrireFiche(admin.client, admin.moi, a);
}

/**
 * L'adresse publique de l'application, pour fabriquer le lien. Posée en
 * production (`NEXT_PUBLIC_URL_APPLICATION`) ; sur un aperçu, c'est l'hôte
 * de la requête — le lien mène alors à l'aperçu, qui partage la même base.
 */
async function adresseApplication(): Promise<string> {
  const posee = process.env.NEXT_PUBLIC_URL_APPLICATION;
  if (posee) return posee.replace(/\/+$/, "");
  const { headers } = await import("next/headers");
  const entetes = await headers();
  const hote = entetes.get("x-forwarded-host") ?? entetes.get("host") ?? "";
  return `${entetes.get("x-forwarded-proto") ?? "https"}://${hote}`;
}

/**
 * Le lien de « Choisir mon mot de passe ». Il porte le jeton haché, pas la
 * session : le jeton n'est consommé qu'à la validation du formulaire. Un lien
 * de connexion ouvert d'avance — l'analyse des liens d'Outlook le fait — le
 * grillerait sinon avant que la personne ne clique.
 */
async function lienMotDePasse(type: "invite" | "recovery", jeton: string): Promise<string> {
  return `${await adresseApplication()}/connexion/mot-de-passe?type=${type}&token_hash=${encodeURIComponent(jeton)}`;
}

/** Crée le compte, écrit la fiche, rend le lien d'invitation. */
export async function inviterAcces(brut: AccesUtilisateur): Promise<Invitation> {
  if (!authentificationReelle()) return { erreur: "Démonstration : aucun compte ne se crée." };
  const lue = normaliserAcces(brut);
  if (!lue) return { erreur: "Fiche illisible." };
  const admin = await administrateur("d'inviter");
  if ("erreur" in admin) return admin;

  const courriel = lue.courriel.trim().toLowerCase();
  const service = clientService();
  const { data, error } = await service.auth.admin.generateLink({ type: "invite", email: courriel });
  if (error || !data.user) {
    const existe = /already|registered|exists/i.test(error?.message ?? "");
    return { erreur: existe ? `Un compte existe déjà pour ${courriel} : ouvrez sa fiche et demandez un nouveau lien.` : `Compte refusé : ${error?.message ?? "réponse vide"}` };
  }

  const refus = await ecrireFiche(admin.client, admin.moi, { ...lue, id: data.user.id, courriel });
  if (refus) {
    /* Pas de compte sans fiche : il ne servirait qu'à se faire renvoyer de la page de garde. */
    await service.auth.admin.deleteUser(data.user.id);
    return { erreur: refus };
  }
  return { id: data.user.id, courriel, lien: await lienMotDePasse("invite", data.properties.hashed_token) };
}

/**
 * Un nouveau lien pour un compte qui existe : invitation expirée, ou mot de
 * passe oublié. C'est un lien de réinitialisation ; il mène à la même page.
 */
export async function nouveauLienAcces(id: string): Promise<Invitation> {
  if (!authentificationReelle()) return { erreur: "Démonstration : aucun lien ne se fabrique." };
  const admin = await administrateur("de demander un lien");
  if ("erreur" in admin) return admin;

  const service = clientService();
  const compte = await service.auth.admin.getUserById(id);
  const courriel = compte.data.user?.email;
  if (compte.error || !courriel) return { erreur: "Cette fiche n'a pas de compte de connexion : créez-la depuis « Nouvel utilisateur »." };
  const { data, error } = await service.auth.admin.generateLink({ type: "recovery", email: courriel });
  if (error) return { erreur: `Lien refusé : ${error.message}` };
  return { id, courriel, lien: await lienMotDePasse("recovery", data.properties.hashed_token) };
}

export async function retirerAcces(id: string): Promise<string | null> {
  if (!authentificationReelle()) return null;
  const admin = await administrateur("de retirer");
  if ("erreur" in admin) return admin.erreur;
  /* Un compte qui part garde ses traces : on le désactive, on ne l'efface pas. */
  const maintenant = new Date().toISOString();
  const fiche = await admin.client.from("acces_utilisateur").update({ actif: false, modifie_le: maintenant, modifie_par: admin.moi }).eq("utilisateur_id", id);
  if (fiche.error) return `Retrait refusé : ${fiche.error.message}`;
  const profil = await admin.client.from("profil").update({ actif: false, modifie_le: maintenant, modifie_par: admin.moi }).eq("utilisateur_id", id);
  if (profil.error) return `Profil refusé : ${profil.error.message}`;
  revalidatePath("/parametres/utilisateurs");
  return null;
}

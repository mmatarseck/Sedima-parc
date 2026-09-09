"use server";

/* ============================================================================
 * Les demandes, côté serveur : l'envoi, la réponse, l'annulation.
 *
 * Trois fonctions serveur, appelées depuis le bureau ou le téléphone. Elles
 * écrivent avec la session de l'utilisateur : les politiques de la table
 * `demande` (migration 0011) décident — pousser demande la saisie du module
 * « demandes » hors profil détenteur, répondre est réservé au destinataire,
 * annuler à la gestion. Le contrôle est refait ici avant d'écrire, parce
 * qu'une fonction serveur se joint par une simple requête POST.
 *
 * Le courriel au destinataire (décision du 7 septembre 2026 : notification
 * ou courriel, pas de SMS) attend la fonction de notification de la
 * plateforme ; la table porte tout ce qu'il faut pour l'envoyer.
 * ==========================================================================*/

import { revalidatePath } from "next/cache";
import { normaliserDemande, type Demande, type ReponseDemande } from "@/domaine/demandes";
import { authentificationReelle } from "@/lib/session-demo";
import { notifierDemandes } from "@/lib/notifications-serveur";
import { clientServeur, utilisateurCourant } from "@/lib/supabase";

function ligneDe(d: Demande, utilisateurId: string) {
  return {
    id: d.id,
    numero: d.numero,
    lot: d.lot,
    type: d.type,
    vehicule_id: d.vehicule.id,
    chauffeur_id: d.detenteur.genre === "chauffeur" ? d.detenteur.id : null,
    attributaire_id: d.detenteur.genre === "attributaire" ? d.detenteur.id : null,
    destinataire_nom: d.detenteur.nom,
    message: d.message,
    emise_le: d.emiseLe,
    emise_par: utilisateurId,
    emise_par_nom: d.emisePar,
    echeance: d.echeance,
    cree_par: utilisateurId,
  };
}

/** Envoie un lot de demandes. Nul quand c'est fait ; sinon le motif du refus, à montrer tel quel. */
export async function enregistrerDemandes(brutes: Demande[]): Promise<string | null> {
  if (!authentificationReelle()) return null;
  const demandes = brutes.map(normaliserDemande).filter((d): d is Demande => d !== null);
  if (demandes.length === 0) return "Aucune demande à envoyer.";
  const client = await clientServeur();
  const moi = await utilisateurCourant(client);
  if (!moi) return "Session absente : reconnectez-vous avant d'envoyer.";
  if (moi.role === "detenteur") return "Un détenteur répond aux demandes ; il n'en envoie pas.";
  const ecriture = await client.from("demande").insert(demandes.map((d) => ligneDe(d, moi.utilisateurId)));
  if (ecriture.error) return `Envoi refusé : ${ecriture.error.message}`;
  /* Chaque détenteur du lot est prévenu — cloche, et courriel quand la plateforme l'envoie. */
  for (const lot of new Set(demandes.map((d) => d.lot))) await notifierDemandes(client, lot);
  revalidatePath("/demandes");
  revalidatePath("/telephone");
  return null;
}

/** La réponse du détenteur. La photo est obligatoire : sans elle, rien ne s'écrit. */
export async function repondreDemande(id: string, reponse: ReponseDemande): Promise<string | null> {
  if (!authentificationReelle()) return null;
  if (!reponse.photo) return "La photo est obligatoire pour répondre.";
  const client = await clientServeur();
  const moi = await utilisateurCourant(client);
  if (!moi) return "Session absente : reconnectez-vous avant de répondre.";
  const ecriture = await client
    .from("demande")
    .update({ repondue_le: reponse.le, reponse_valeur: reponse.valeur, reponse_texte: reponse.texte, reponse_photo: reponse.photo, reponse_commentaire: reponse.commentaire, modifie_le: new Date().toISOString(), modifie_par: moi.utilisateurId })
    .eq("id", id)
    .is("repondue_le", null)
    .is("annulee_le", null)
    .select("id");
  if (ecriture.error) return `Réponse refusée : ${ecriture.error.message}`;
  if (!ecriture.data || ecriture.data.length === 0) return "Cette demande n'est plus à répondre, ou elle ne vous est pas adressée.";
  revalidatePath("/demandes");
  revalidatePath("/telephone");
  return null;
}

export async function annulerDemande(id: string): Promise<string | null> {
  if (!authentificationReelle()) return null;
  const client = await clientServeur();
  const moi = await utilisateurCourant(client);
  if (!moi) return "Session absente : reconnectez-vous avant d'annuler.";
  const ecriture = await client.from("demande").update({ annulee_le: new Date().toISOString(), annulee_par: moi.utilisateurId }).eq("id", id).is("repondue_le", null).select("id");
  if (ecriture.error) return `Annulation refusée : ${ecriture.error.message}`;
  if (!ecriture.data || ecriture.data.length === 0) return "Cette demande a déjà reçu une réponse, ou l'annulation ne vous est pas ouverte.";
  revalidatePath("/demandes");
  revalidatePath("/telephone");
  return null;
}

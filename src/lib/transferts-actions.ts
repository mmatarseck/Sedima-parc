"use server";

/* ============================================================================
 * Les fiches de transfert, côté serveur : la création, la signature,
 * l'annulation, et l'application d'une fiche complète.
 *
 * Fonctions serveur appelées du bureau ou du téléphone, avec la session de
 * l'utilisateur : les politiques de la table `transfert` (migration 0012)
 * décident. Quand la seconde signature arrive, `appliquer_transfert()` ferme
 * l'affectation en cours et ouvre celle du récipiendaire, avec les droits de
 * la fonction — le détenteur qui signe en dernier ne peut pas écrire une
 * affectation lui-même.
 * ==========================================================================*/

import { revalidatePath } from "next/cache";
import { normaliserTransfert, statutTransfert, type Signature, type Transfert } from "@/domaine/transferts";
import { notifierTransfert } from "@/lib/notifications-serveur";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur, utilisateurCourant } from "@/lib/supabase";

function ligneDe(t: Transfert, utilisateurId: string) {
  return {
    id: t.id,
    numero: t.numero,
    vehicule_id: t.vehicule.id,
    remettant_genre: t.remettant.genre,
    remettant_chauffeur_id: t.remettant.genre === "chauffeur" ? t.remettant.id : null,
    remettant_attributaire_id: t.remettant.genre === "attributaire" ? t.remettant.id : null,
    remettant_nom: t.remettant.nom,
    recipiendaire_genre: t.recipiendaire.genre,
    recipiendaire_chauffeur_id: t.recipiendaire.genre === "chauffeur" ? t.recipiendaire.id : null,
    recipiendaire_attributaire_id: t.recipiendaire.genre === "attributaire" ? t.recipiendaire.id : null,
    recipiendaire_nom: t.recipiendaire.nom,
    date: t.date,
    motif: t.motif,
    km: t.km,
    carburant: t.carburant,
    documents_a_bord: t.documentsABord,
    equipements: t.equipements,
    reserves: t.reserves,
    commentaire: t.commentaire,
    signature_remettant: t.signatureRemettant,
    signature_recipiendaire: t.signatureRecipiendaire,
    cree_par: utilisateurId,
    cree_par_nom: t.creePar,
  };
}

async function appliquerSiComplete(client: Awaited<ReturnType<typeof clientServeur>>, t: Transfert): Promise<string | null> {
  if (statutTransfert(t) !== "complete") return null;
  const r = await client.rpc("appliquer_transfert", { transfert_id: t.id });
  if (r.error) return `Fiche enregistrée, mais l'affectation n'a pas suivi : ${r.error.message}`;
  return null;
}

/** Crée une fiche, avec les signatures déjà posées sur l'écran. Nul quand c'est fait ; sinon le motif du refus. */
export async function enregistrerTransfert(brut: Transfert): Promise<string | null> {
  if (!authentificationReelle()) return null;
  const t = normaliserTransfert(brut);
  if (!t) return "Fiche illisible.";
  const client = await clientServeur();
  const moi = await utilisateurCourant(client);
  if (!moi) return "Session absente : reconnectez-vous avant d'enregistrer.";
  if (moi.role === "detenteur") return "Un détenteur signe une fiche ; il n'en crée pas.";
  const ecriture = await client.from("transfert").insert(ligneDe(t, moi.utilisateurId));
  if (ecriture.error) return `Enregistrement refusé : ${ecriture.error.message}`;
  /* Les parties qui n'ont pas signé sont prévenues — cloche, et courriel quand la plateforme l'envoie. */
  await notifierTransfert(client, t.id);
  const suite = await appliquerSiComplete(client, t);
  revalidatePath("/transferts");
  revalidatePath("/telephone");
  revalidatePath("/flotte");
  return suite;
}

/** Pose une signature — celle du remettant ou du récipiendaire. */
export async function signerTransfert(id: string, partie: "remettant" | "recipiendaire", signature: Signature): Promise<string | null> {
  if (!authentificationReelle()) return null;
  if (!signature.trace) return "La signature est vide.";
  const client = await clientServeur();
  const moi = await utilisateurCourant(client);
  if (!moi) return "Session absente : reconnectez-vous avant de signer.";
  const colonne = partie === "remettant" ? "signature_remettant" : "signature_recipiendaire";
  const ecriture = await client
    .from("transfert")
    .update({ [colonne]: signature, modifie_le: new Date().toISOString(), modifie_par: moi.utilisateurId })
    .eq("id", id)
    .is(colonne, null)
    .is("annulee_le", null)
    .select("id, numero, vehicule_id, remettant_genre, remettant_chauffeur_id, remettant_attributaire_id, remettant_nom, recipiendaire_genre, recipiendaire_chauffeur_id, recipiendaire_attributaire_id, recipiendaire_nom, date, motif, signature_remettant, signature_recipiendaire, annulee_le, appliquee_le");
  if (ecriture.error) return `Signature refusée : ${ecriture.error.message}`;
  const l = ecriture.data?.[0];
  if (!l) return "Cette fiche est déjà signée pour cette partie, ou elle ne vous est pas ouverte.";
  if (l.signature_remettant && l.signature_recipiendaire && !l.appliquee_le) {
    const r = await client.rpc("appliquer_transfert", { transfert_id: id });
    if (r.error) return `Signature posée, mais l'affectation n'a pas suivi : ${r.error.message}`;
  }
  revalidatePath("/transferts");
  revalidatePath("/telephone");
  revalidatePath("/flotte");
  return null;
}

export async function annulerTransfert(id: string): Promise<string | null> {
  if (!authentificationReelle()) return null;
  const client = await clientServeur();
  const moi = await utilisateurCourant(client);
  if (!moi) return "Session absente : reconnectez-vous avant d'annuler.";
  const ecriture = await client.from("transfert").update({ annulee_le: new Date().toISOString(), annulee_par: moi.utilisateurId }).eq("id", id).is("appliquee_le", null).select("id");
  if (ecriture.error) return `Annulation refusée : ${ecriture.error.message}`;
  if (!ecriture.data || ecriture.data.length === 0) return "Cette fiche a déjà été appliquée, ou l'annulation ne vous est pas ouverte.";
  revalidatePath("/transferts");
  return null;
}

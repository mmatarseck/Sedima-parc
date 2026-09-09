/* ============================================================================
 * Les notifications de la plateforme, côté serveur — base branchée.
 *
 * La table `notification` (0027) porte une ligne par fait et par
 * destinataire ; deux fonctions SQL la remplissent (`notifier_transfert`,
 * `notifier_demandes`), appelées par les actions serveur qui créent le fait.
 * La cloche la lit pour la personne connectée ; le courriel part groupé par
 * destinataire, tout de suite quand le fournisseur est configuré, sinon au
 * passage du matin (`/api/courriels`, planifié par Vercel) dès qu'il l'est.
 * Serveur seulement — jamais dans une page ni un composant client.
 * ==========================================================================*/

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Notification } from "@/lib/notifications-demo";
import { clientServeur, clientService } from "@/lib/supabase";
import { composerRecapitulatif, envoyerCourriel, etatCourriel } from "./courriel";

interface LigneNotification {
  id: string;
  destinataire_id: string;
  date: string;
  auteur: string;
  sujet_libelle: string;
  extrait: string;
  href: string;
  lue_le: string | null;
  courriel_statut: "a-envoyer" | "envoye" | "sans-courriel" | "echec";
}

function initialesDe(nom: string): string {
  return nom.split(/\s+/).map((m) => m[0] ?? "").join("").slice(0, 2).toUpperCase() || "SP";
}

function notificationDepuisLigne(l: LigneNotification): Notification {
  return { id: l.id, destinataire: l.destinataire_id, date: l.date, auteur: l.auteur, initiales: initialesDe(l.auteur), sujetLibelle: l.sujet_libelle, extrait: l.extrait, href: l.href, lue: l.lue_le !== null };
}

/** Les notifications de la personne connectée, les plus récentes d'abord. */
export async function mesNotificationsServeur(): Promise<Notification[]> {
  const client = await clientServeur();
  const lecture = await client.from("notification").select("id, destinataire_id, date, auteur, sujet_libelle, extrait, href, lue_le, courriel_statut").order("date", { ascending: false }).limit(50).returns<LigneNotification[]>();
  if (lecture.error) {
    console.warn(`Notifications : lecture impossible (${lecture.error.message}).`);
    return [];
  }
  return lecture.data.map(notificationDepuisLigne);
}

/** Marque lues toutes les notifications de la personne connectée, et rend la liste à jour. */
export async function marquerLuesServeur(): Promise<Notification[]> {
  const client = await clientServeur();
  const ecriture = await client.from("notification").update({ lue_le: new Date().toISOString() }).is("lue_le", null);
  if (ecriture.error) console.warn(`Notifications : marquage impossible (${ecriture.error.message}).`);
  return mesNotificationsServeur();
}

/** Prévient les parties d'une fiche de transfert qui n'ont pas encore signé ; rend le nombre de personnes prévenues. */
export async function notifierTransfert(client: SupabaseClient, transfertId: string): Promise<number> {
  const r = await client.rpc("notifier_transfert", { p_id: transfertId }).maybeSingle<number>();
  if (r.error) {
    console.warn(`Notification du transfert ${transfertId} impossible (${r.error.message}).`);
    return 0;
  }
  const n = Number(r.data ?? 0);
  if (n > 0) await envoyerCourrielsEnAttente();
  return n;
}

/** Prévient les détenteurs d'un lot de demandes ; rend le nombre de personnes prévenues. */
export async function notifierDemandes(client: SupabaseClient, lot: string): Promise<number> {
  const r = await client.rpc("notifier_demandes", { p_lot: lot }).maybeSingle<number>();
  if (r.error) {
    console.warn(`Notification du lot ${lot} impossible (${r.error.message}).`);
    return 0;
  }
  const n = Number(r.data ?? 0);
  if (n > 0) await envoyerCourrielsEnAttente();
  return n;
}

export interface BilanEnvoi {
  /** Le fournisseur est-il configuré ? Sinon, pourquoi. */
  pret: boolean;
  raison: string | null;
  destinataires: number;
  envoyees: number;
  echecs: number;
  enAttente: number;
}

/**
 * Envoie, groupées par destinataire, les notifications qui attendent leur
 * courriel. Avec la clé de service : la cloche de chacun n'est pas la
 * session de celui qui déclenche l'envoi. Ne lève jamais.
 */
export async function envoyerCourrielsEnAttente(): Promise<BilanEnvoi> {
  const etat = etatCourriel();
  const bilan: BilanEnvoi = { pret: etat.pret, raison: etat.raison, destinataires: 0, envoyees: 0, echecs: 0, enAttente: 0 };
  let service: SupabaseClient;
  try {
    service = clientService();
  } catch (x) {
    return { ...bilan, pret: false, raison: (x as Error).message };
  }
  const lecture = await service.from("notification").select("id, destinataire_id, date, auteur, sujet_libelle, extrait, href, lue_le, courriel_statut").eq("courriel_statut", "a-envoyer").order("date", { ascending: true }).limit(500).returns<LigneNotification[]>();
  if (lecture.error) return { ...bilan, raison: `Lecture des notifications impossible : ${lecture.error.message}` };
  bilan.enAttente = lecture.data.length;
  if (!etat.pret || lecture.data.length === 0) return bilan;

  const parDestinataire = new Map<string, LigneNotification[]>();
  for (const n of lecture.data) parDestinataire.set(n.destinataire_id, [...(parDestinataire.get(n.destinataire_id) ?? []), n]);
  const comptes = await service.from("acces_utilisateur").select("utilisateur_id, prenom, courriel").in("utilisateur_id", [...parDestinataire.keys()]).returns<{ utilisateur_id: string; prenom: string; courriel: string }[]>();
  const adresse = new Map((comptes.data ?? []).map((c) => [c.utilisateur_id, c]));
  bilan.destinataires = parDestinataire.size;

  for (const [destinataire, lignes] of parDestinataire) {
    const compte = adresse.get(destinataire);
    const ids = lignes.map((l) => l.id);
    if (!compte || !compte.courriel.trim()) {
      await service.from("notification").update({ courriel_statut: "sans-courriel" }).in("id", ids);
      continue;
    }
    const recapitulatif = composerRecapitulatif(compte.prenom, lignes.map((l) => ({ sujet: l.sujet_libelle, extrait: l.extrait, href: l.href, date: l.date })));
    const envoi = await envoyerCourriel({ a: compte.courriel.trim(), ...recapitulatif });
    if (envoi.envoye) {
      await service.from("notification").update({ courriel_statut: "envoye", courriel_le: new Date().toISOString(), courriel_erreur: null }).in("id", ids);
      bilan.envoyees += ids.length;
    } else {
      /* L'échec reste « à envoyer » : le passage du matin réessaiera, l'erreur est gardée pour le diagnostic. */
      await service.from("notification").update({ courriel_erreur: envoi.erreur }).in("id", ids);
      bilan.echecs += ids.length;
    }
  }
  bilan.enAttente = bilan.enAttente - bilan.envoyees;
  return bilan;
}

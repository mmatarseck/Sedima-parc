"use server";

/* ============================================================================
 * Les discussions, côté serveur : lire un fil, y publier.
 *
 * Base branchée : la table `message` (0028), lue avec la session ; la
 * publication passe par `publier_message()`, qui signe de la session et
 * prévient les comptes cités — puis le courriel part s'il est configuré.
 * En démonstration, rien ne s'écrit ici : le navigateur tient le fil.
 * ==========================================================================*/

import type { Message } from "@/domaine/discussion";
import { envoyerCourrielsEnAttente } from "@/lib/notifications-serveur";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";

interface LigneMessage {
  id: string;
  sujet: string;
  auteur_id: string;
  auteur_nom: string;
  date: string;
  texte: string;
  mentions: string[];
  mentions_libres: string[];
}

function initialesDe(nom: string): string {
  return nom.split(/\s+/).map((m) => m[0] ?? "").join("").slice(0, 2).toUpperCase() || "??";
}

function messageDepuisLigne(l: LigneMessage): Message {
  return { id: l.id, sujet: l.sujet, auteurId: l.auteur_id, auteur: l.auteur_nom, initiales: initialesDe(l.auteur_nom), date: l.date, texte: l.texte, mentions: [...(l.mentions ?? []), ...(l.mentions_libres ?? [])] };
}

/** Le fil d'une fiche, du plus ancien au plus récent ; nul en démonstration (le navigateur tient le fil). */
export async function lireMessagesServeur(sujet: string): Promise<Message[] | null> {
  if (!authentificationReelle()) return null;
  const client = await clientServeur();
  const lecture = await client.from("message").select("id, sujet, auteur_id, auteur_nom, date, texte, mentions, mentions_libres").eq("sujet", sujet).order("date", { ascending: true }).limit(500).returns<LigneMessage[]>();
  if (lecture.error) {
    console.warn(`Discussion ${sujet} : lecture impossible (${lecture.error.message}).`);
    return [];
  }
  return lecture.data.map(messageDepuisLigne);
}

/** Publie un message ; rend le message enregistré, ou le motif du refus. */
export async function publierMessage(sujet: string, libelle: string, href: string, texte: string, mentions: string[]): Promise<{ message: Message } | { refus: string }> {
  if (!authentificationReelle()) return { refus: "En démonstration, le fil vit dans le navigateur." };
  const propre = texte.trim();
  if (!propre) return { refus: "Un message vide ne se publie pas." };
  /* Les comptes cités portent leur identifiant ; les chauffeurs cités, leur clé « chauffeur:… ». */
  const comptes = mentions.filter((m) => /^[0-9a-f-]{36}$/i.test(m));
  const libres = mentions.filter((m) => !/^[0-9a-f-]{36}$/i.test(m));
  const client = await clientServeur();
  const r = await client.rpc("publier_message", { p_sujet: sujet, p_libelle: libelle, p_href: href, p_texte: propre, p_mentions: comptes, p_mentions_libres: libres }).maybeSingle<LigneMessage>();
  if (r.error || !r.data) return { refus: `Publication refusée : ${r.error?.message ?? "réponse vide"}` };
  if (comptes.length > 0) await envoyerCourrielsEnAttente();
  return { message: messageDepuisLigne(r.data) };
}

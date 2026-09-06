/* ============================================================================
 * Notifications — stockage de démonstration.
 *
 * Décision du métier du 3 septembre 2026 : une personne citée dans une
 * discussion est prévenue. Ici, la notification vit dans le navigateur, sous
 * une clé par destinataire ; au branchement, une table `notification` (destinataire,
 * sujet, texte, lien, lue) alimentée par un déclencheur sur `message`, et un
 * courriel ou un message Teams par la fonction de notification de la plateforme.
 * ==========================================================================*/

import type { Message } from "@/domaine/discussion";
import { trouverRole, type Role } from "@/domaine/roles";
import { lireRole } from "./session-demo";

export interface Notification {
  id: string;
  /** Rôle destinataire — l'identité de démonstration. */
  destinataire: string;
  /** ISO. */
  date: string;
  auteur: string;
  initiales: string;
  /** « AA 032 EA », « Babacar Ndiaye ». */
  sujetLibelle: string;
  /** Début du message, pour situer sans ouvrir. */
  extrait: string;
  /** Adresse de la fiche, discussion ouverte. */
  href: string;
  lue: boolean;
}

function cle(destinataire: string): string {
  return `sedima.parc.notifications.${destinataire}`;
}

function lire(destinataire: string): Notification[] {
  try {
    const brut = localStorage.getItem(cle(destinataire));
    return brut ? (JSON.parse(brut) as Notification[]) : [];
  } catch {
    return [];
  }
}

function ecrire(destinataire: string, liste: Notification[]): void {
  try {
    localStorage.setItem(cle(destinataire), JSON.stringify(liste.slice(0, 50)));
  } catch {
    /* sans stockage, pas de notification persistante */
  }
}

/** Ajoute une notification à un destinataire — citation, demande d'approbation, décision. */
export function ajouterNotification(destinataire: string, n: Omit<Notification, "destinataire" | "lue">): void {
  const liste = lire(destinataire);
  if (liste.some((x) => x.id === n.id)) return;
  liste.unshift({ ...n, destinataire, lue: false });
  ecrire(destinataire, liste);
}

/**
 * Prévient les personnes citées par un message. Les chauffeurs ne sont pas
 * utilisateurs : les citer les met en évidence dans le fil, sans notification.
 */
export function prevenir(message: Message, sujetLibelle: string, href: string): void {
  for (const id of message.mentions) {
    if (id.startsWith("chauffeur:")) continue;
    const destinataire = id as Role;
    // On ne se prévient pas soi-même.
    if (destinataire === message.auteurId) continue;
    const liste = lire(destinataire);
    liste.unshift({
      id: `${message.id}-${destinataire}`,
      destinataire,
      date: message.date,
      auteur: message.auteur,
      initiales: message.initiales,
      sujetLibelle,
      extrait: message.texte.length > 120 ? `${message.texte.slice(0, 117)}…` : message.texte,
      href,
      lue: false,
    });
    ecrire(destinataire, liste);
  }
}

/** Les notifications du compte connecté, de la plus récente à la plus ancienne. */
export function mesNotifications(): Notification[] {
  return lire(trouverRole(lireRole()).role);
}

export function marquerLues(): Notification[] {
  const destinataire = trouverRole(lireRole()).role;
  const liste = lire(destinataire).map((n) => ({ ...n, lue: true }));
  ecrire(destinataire, liste);
  return liste;
}

/** « il y a 5 min », « il y a 3 h », « hier », « le 28/08 ». */
export function depuis(iso: string, maintenant = new Date()): string {
  const d = new Date(iso);
  const minutes = Math.round((maintenant.getTime() - d.getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.round(heures / 24);
  if (jours === 1) return "hier";
  if (jours < 7) return `il y a ${jours} j`;
  return `le ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

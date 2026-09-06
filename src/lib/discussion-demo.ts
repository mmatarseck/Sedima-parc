/* ============================================================================
 * Fils de discussion — stockage de démonstration.
 *
 * Tant que Supabase n'est pas branché, chaque fil vit dans le navigateur, sous
 * une clé qui porte son sujet. La forme des messages est celle de
 * `src/domaine/discussion.ts` : au branchement, seul ce module change, pour
 * une table `message` avec RLS et une notification aux personnes citées.
 * ==========================================================================*/

import type { Message, Personne } from "@/domaine/discussion";
import { trouverRole } from "@/domaine/roles";
import { prevenir } from "./notifications-demo";
import { lireRole } from "./session-demo";

function cle(sujet: string): string {
  return `sedima.parc.discussion.${sujet}`;
}

/**
 * Trois messages de départ, pour que le fil ne s'ouvre pas vide : ils montrent
 * le ton attendu — court, daté, adressé à quelqu'un. Ils ne sont écrits qu'une
 * fois, au premier accès ; ensuite le fil appartient à l'équipe.
 */
function amorce(sujet: string, libelle: string, personnes: Personne[]): Message[] {
  const [type] = sujet.split(":");
  const maintenant = Date.now();
  const jour = 24 * 3600 * 1000;
  const a = (jours: number, heures: number) => new Date(maintenant - jours * jour - heures * 3600 * 1000).toISOString();
  const correspondant = personnes.find((p) => p.id === "correspondant-site") ?? null;
  const maintenance = personnes.find((p) => p.id === "responsable-maintenance") ?? null;
  const parc = personnes.find((p) => p.id === "gestionnaire-parc") ?? null;

  if (type === "vehicule") {
    return [
      {
        id: `${sujet}-1`,
        sujet,
        auteurId: "gestionnaire-parc",
        auteur: "M. Seck",
        initiales: "MS",
        date: a(6, 3),
        texte: `${maintenance ? `@${maintenance.nom} ` : ""}le chauffeur signale un bruit au freinage sur ${libelle} depuis deux jours. Peux-tu le passer au contrôle avant la tournée de vendredi ?`,
        mentions: maintenance ? [maintenance.id] : [],
      },
      {
        id: `${sujet}-2`,
        sujet,
        auteurId: "responsable-maintenance",
        auteur: "Aly Bo",
        initiales: "AB",
        date: a(5, 7),
        texte: "Vu ce matin : plaquettes avant à 30 %. Je commande, remplacement jeudi. Une journée d'immobilisation, pas plus.",
        mentions: [],
      },
      {
        id: `${sujet}-3`,
        sujet,
        auteurId: "correspondant-site",
        auteur: correspondant?.nom ?? "Correspondant site",
        initiales: correspondant?.initiales ?? "CS",
        date: a(1, 2),
        texte: `${parc ? `@${parc.nom} ` : ""}remplacement fait, le véhicule est reparti. Le relevé du compteur est saisi avec la dépense.`,
        mentions: parc ? [parc.id] : [],
      },
    ];
  }

  return [
    {
      id: `${sujet}-1`,
      sujet,
      auteurId: "gestionnaire-parc",
      auteur: "M. Seck",
      initiales: "MS",
      date: a(9, 4),
      texte: `Point fait avec ${libelle} sur la consommation du mois dernier : dérive expliquée par les tournées Thiès–Mbour en surcharge. À suivre sur le prochain relevé.`,
      mentions: [],
    },
    {
      id: `${sujet}-2`,
      sujet,
      auteurId: "direction",
      auteur: "Direction des Opérations",
      initiales: "DO",
      date: a(2, 1),
      texte: `${parc ? `@${parc.nom} ` : ""}merci de vérifier que sa visite médicale est bien programmée avant l'échéance, on ne veut pas revivre le cas du mois de mai.`,
      mentions: parc ? [parc.id] : [],
    },
  ];
}

export function lireMessages(sujet: string, libelle: string, personnes: Personne[]): Message[] {
  try {
    const brut = localStorage.getItem(cle(sujet));
    if (brut) {
      const stocke = JSON.parse(brut) as unknown;
      if (Array.isArray(stocke)) return stocke as Message[];
    }
    const depart = amorce(sujet, libelle, personnes);
    localStorage.setItem(cle(sujet), JSON.stringify(depart));
    return depart;
  } catch {
    return amorce(sujet, libelle, personnes);
  }
}

export function ajouterMessage(sujet: string, libelle: string, href: string, texte: string, mentions: string[], existants: Message[]): Message[] {
  const role = trouverRole(lireRole());
  const message: Message = {
    id: `${sujet}-${Date.now().toString(36)}`,
    sujet,
    auteurId: role.role,
    auteur: role.nom,
    initiales: role.initiales,
    date: new Date().toISOString(),
    texte,
    mentions,
  };
  const suite = [...existants, message];
  try {
    localStorage.setItem(cle(sujet), JSON.stringify(suite));
  } catch {
    /* sans stockage, le message ne vaut que pour la page courante */
  }
  // Décision du 3 septembre : les personnes citées sont prévenues.
  prevenir(message, libelle, href);
  return suite;
}

/** Les utilisateurs de l'application, tels qu'on peut les citer. */
export function personnesUtilisateurs(): Personne[] {
  return [
    { id: "gestionnaire-parc", nom: "M. Seck", initiales: "MS", precision: "Gestionnaire de parc" },
    { id: "responsable-maintenance", nom: "Aly Bo", initiales: "AB", precision: "Responsable maintenance" },
    { id: "responsable-carburant", nom: "Responsable carburant", initiales: "RC", precision: "Cuve et bons de sortie" },
    { id: "correspondant-site", nom: "Correspondant Thiès", initiales: "CT", precision: "Correspondant site" },
    { id: "controle-de-gestion", nom: "Contrôle de gestion", initiales: "CG", precision: "Coûts et exports" },
    { id: "direction", nom: "Direction des Opérations", initiales: "DO", precision: "Direction" },
    { id: "achats", nom: "Service achats", initiales: "AC", precision: "Fournisseurs et demandes d'achat" },
  ];
}

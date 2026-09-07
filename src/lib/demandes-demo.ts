/* ============================================================================
 * Les demandes, côté navigateur.
 *
 * En démonstration, la liste vit dans le stockage du navigateur, à partir
 * des demandes livrées : ce qui s'envoie, se répond ou s'annule s'y
 * enregistre, et le détenteur de démonstration est prévenu par la cloche.
 * Base branchée, l'écriture part vers le serveur (`demandes-actions.ts`),
 * qui répond par un motif de refus s'il y en a un, et la liste vient de la
 * page rendue par le serveur.
 * ==========================================================================*/

import { normaliserDemande, type Demande, type ReponseDemande } from "@/domaine/demandes";
import { TYPE_DEMANDE } from "@/domaine/demandes";
import { demandesDemo } from "@/donnees/demandes-demo";
import { annulerDemande, enregistrerDemandes, repondreDemande } from "@/lib/demandes-actions";
import { ajouterNotification } from "@/lib/notifications-demo";
import { authentificationReelle } from "@/lib/session-demo";

const CLE = "sedima.parc.demandes";

/** La liste : celle du serveur quand la base est branchée, sinon la démonstration complétée de ce que le navigateur a enregistré. */
export function lireDemandes(initial: Demande[]): Demande[] {
  if (authentificationReelle()) return initial;
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return demandesDemo().map((d) => ({ ...d }));
    return (JSON.parse(brut) as unknown[]).map(normaliserDemande).filter((d): d is Demande => d !== null);
  } catch {
    return demandesDemo().map((d) => ({ ...d }));
  }
}

function ecrireListe(liste: Demande[]): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(liste));
  } catch {
    /* sans stockage, la valeur ne vaut que pour la page courante */
  }
}

/** Envoie un lot. Nul quand c'est fait ; sinon le motif du refus. */
export async function envoyerDemandes(nouvelles: Demande[], courantes: Demande[]): Promise<string | null> {
  if (authentificationReelle()) return enregistrerDemandes(nouvelles);
  ecrireListe([...nouvelles, ...courantes]);
  /* Le détenteur de démonstration est prévenu par la cloche (décision du
     7 septembre 2026 : notification ou courriel). Une notification par lot. */
  const premiere = nouvelles[0];
  if (premiere) {
    const t = TYPE_DEMANDE[premiere.type];
    ajouterNotification("detenteur", {
      id: `demande-${premiere.lot}`,
      date: premiere.emiseLe,
      auteur: premiere.emisePar,
      initiales: premiere.emisePar.split(/\s+/).map((m) => m[0] ?? "").join("").slice(0, 2).toUpperCase() || "SP",
      sujetLibelle: t.libelle,
      extrait: premiere.message ?? t.consigne,
      href: "/telephone/demandes",
    });
  }
  return null;
}

/** La réponse du détenteur. Nul quand c'est fait ; sinon le motif du refus. */
export async function repondre(id: string, reponse: ReponseDemande, courantes: Demande[]): Promise<string | null> {
  if (authentificationReelle()) return repondreDemande(id, reponse);
  if (!reponse.photo) return "La photo est obligatoire pour répondre.";
  ecrireListe(courantes.map((d) => (d.id === id ? { ...d, reponse } : d)));
  return null;
}

export async function annuler(id: string, courantes: Demande[]): Promise<string | null> {
  if (authentificationReelle()) return annulerDemande(id);
  ecrireListe(courantes.map((d) => (d.id === id ? { ...d, annuleeLe: new Date().toISOString() } : d)));
  return null;
}

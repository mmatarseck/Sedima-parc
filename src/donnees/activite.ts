/* ============================================================================
 * L'activité des utilisateurs, lue en base (0078) : `activite_utilisateurs`,
 * réservée à l'administrateur et à la direction. Sans la migration, ou sans le
 * droit, la lecture rend son motif plutôt qu'une liste vide trompeuse.
 * ==========================================================================*/

import type { LigneActivite } from "@/domaine/activite";
import { clientServeur } from "@/lib/supabase";

interface LigneBrute {
  utilisateur_id: string;
  nom: string;
  role: string;
  actif: boolean;
  courriel: string | null;
  derniere_connexion: string | null;
  derniere_activite: string | null;
  jours_actifs: number | string;
  vues: number | string;
  vues_telephone: number | string;
  saisies: number | string;
  modifications: number | string;
  ecrans: { chemin: string; vues: number | string }[] | null;
}

export async function activiteServeur(depuis: string): Promise<{ lignes: LigneActivite[]; motif: string | null }> {
  const client = await clientServeur();
  const r = await client.rpc("activite_utilisateurs", { depuis });
  if (r.error) {
    const absente = /activite_utilisateurs|does not exist|schema cache/i.test(r.error.message);
    return { lignes: [], motif: absente ? "Le suivi de l'activité demande la migration 0078 (supabase/migrations/0078_suivi_activite.sql)." : r.error.message };
  }
  return {
    motif: null,
    lignes: ((r.data ?? []) as LigneBrute[]).map((l) => ({
      utilisateurId: l.utilisateur_id,
      nom: l.nom,
      role: l.role,
      actif: l.actif,
      courriel: l.courriel,
      derniereConnexion: l.derniere_connexion,
      derniereActivite: l.derniere_activite,
      joursActifs: Number(l.jours_actifs) || 0,
      vues: Number(l.vues) || 0,
      vuesTelephone: Number(l.vues_telephone) || 0,
      saisies: Number(l.saisies) || 0,
      modifications: Number(l.modifications) || 0,
      ecrans: (l.ecrans ?? []).map((e) => ({ chemin: e.chemin, vues: Number(e.vues) || 0 })),
    })),
  };
}

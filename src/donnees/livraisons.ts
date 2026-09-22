/* ============================================================================
 * Les livraisons de tout le parc, pour le rapport « Livraisons » (22 septembre
 * 2026 : le résumé par mois a quitté la fiche du véhicule pour les rapports).
 *
 * Lues par pages de mille ; les heures (0064) quand la migration est jouée,
 * sans elles sinon. Une lecture impossible rend une liste vide : le rapport se
 * dresse vide plutôt que de fermer la page.
 * ==========================================================================*/

import { cache } from "react";
import { clientServeur } from "@/lib/supabase";

export interface LivraisonParc {
  numero: string;
  date: string;
  /** La plaque canonique du véhicule du parc. */
  vehiculeId: string;
  client: string | null;
  poidsKg: number | null;
  heureDebut: string | null;
  heureFin: string | null;
  saisie: boolean;
}

type Ligne = { numero: string; date: string; client: string | null; poids_kg: number | string | null; source: string; heure_debut?: string | null; heure_fin?: string | null; vehicule: { immatriculation: string } | null };

async function livraisonsServeurBrut(): Promise<LivraisonParc[]> {
  try {
    const client = await clientServeur();
    const lire = async (colonnes: string) => {
      const toutes: Ligne[] = [];
      for (let de = 0; ; de += 1000) {
        const r = await client.from("livraison").select(colonnes).not("vehicule_id", "is", null).order("date", { ascending: false }).range(de, de + 999).returns<Ligne[]>();
        if (r.error) return null;
        toutes.push(...(r.data ?? []));
        if ((r.data ?? []).length < 1000) return toutes;
      }
    };
    const base = "numero, date, client, poids_kg, source, vehicule (immatriculation)";
    const lignes = (await lire(`${base}, heure_debut, heure_fin`)) ?? (await lire(base)) ?? [];
    return lignes
      .filter((l) => l.vehicule)
      .map((l) => ({ numero: l.numero, date: l.date, vehiculeId: l.vehicule!.immatriculation, client: l.client, poidsKg: l.poids_kg === null ? null : Number(l.poids_kg), heureDebut: l.heure_debut?.slice(0, 5) ?? null, heureFin: l.heure_fin?.slice(0, 5) ?? null, saisie: l.source === "saisie" }));
  } catch {
    return [];
  }
}

export const livraisonsServeur = cache(livraisonsServeurBrut);

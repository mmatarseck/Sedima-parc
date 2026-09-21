/* ============================================================================
 * Le catalogue des tâches de service (0060), lu avec la session.
 * ==========================================================================*/

import { cache } from "react";
import type { TacheService } from "@/domaine/taches";
import { clientServeur } from "@/lib/supabase";
import { lignesLues } from "./lecture";

interface LigneTacheBase {
  numero: string;
  libelle: string;
  description: string | null;
  categorie: string | null;
  systeme: string | null;
  ensemble: string | null;
  type_defaut: TacheService["typeDefaut"];
  alias: string[] | null;
  utilisations: number;
  source: TacheService["source"];
  a_classer: boolean;
  actif: boolean;
}

const COLONNES = "numero, libelle, description, categorie, systeme, ensemble, type_defaut, alias, utilisations, source, a_classer, actif";

export function tacheDepuisLigne(l: LigneTacheBase): TacheService {
  return {
    numero: l.numero,
    libelle: l.libelle,
    description: l.description,
    categorie: l.categorie,
    systeme: l.systeme,
    ensemble: l.ensemble,
    typeDefaut: l.type_defaut,
    alias: l.alias ?? [],
    utilisations: l.utilisations,
    source: l.source,
    aClasser: l.a_classer,
    actif: l.actif,
    creee: false,
  };
}

async function tachesServeurBrut(): Promise<TacheService[]> {
  const client = await clientServeur();
  const lecture = await client.from("tache_service").select(COLONNES).order("utilisations", { ascending: false }).limit(3000).returns<LigneTacheBase[]>();
  return lignesLues("Catalogue des tâches", lecture).map(tacheDepuisLigne);
}

/** Le catalogue entier, pour son écran de paramètres. */
export const tachesServeur = cache(tachesServeurBrut);

/**
 * Le catalogue pour les formulaires, lu à chaque page par la mise en page.
 * Une base qui n'a pas encore joué 0060 ne doit pas fermer toute
 * l'application : la liste est alors vide, et le journal le dit.
 */
export async function tachesPourFormulaires(): Promise<TacheService[]> {
  const client = await clientServeur();
  const lecture = await client.from("tache_service").select(COLONNES).eq("actif", true).order("utilisations", { ascending: false }).limit(3000).returns<LigneTacheBase[]>();
  if (lecture.error) {
    console.warn(`Catalogue des tâches illisible (${lecture.error.message}) : les formulaires de service le proposeront vide. La migration 0060 est-elle jouée ?`);
    return [];
  }
  return (lecture.data ?? []).map(tacheDepuisLigne);
}

/* ============================================================================
 * Les situations journalières, lues avec la session de l'utilisateur.
 *
 * Base branchée : la fonction `situation_journaliere(depuis, jusqua)` (0010)
 * rend en un JSON une situation par jour — ce que chaque véhicule et la
 * flotte présentaient à la fin du jour —, sous les noms des colonnes ; on la
 * remet sous les noms du domaine. Tant qu'elle n'est pas jouée, ou en
 * démonstration, les situations de la démonstration prennent le relais : la
 * page ne casse pas.
 *
 * Une lecture par requête (`cache`) : la page et ce qui l'accompagne
 * partagent le même résultat.
 * ==========================================================================*/

import { cache } from "react";
import type { FaitsFlotteJour, FaitsVehiculeJour, SituationJournaliere } from "@/domaine/pastilles";
import type { StatutVehicule } from "@/domaine/types";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { situationsJournalieres } from "./situation-demo";

interface VehiculeJson {
  vehicule_id: string;
  engage: boolean;
  statut: StatutVehicule;
  immobilise_admin: boolean;
  immobilise_depuis_jours: number;
  echeances7: number;
  echues: number;
  sans_releve7: boolean;
  litres: number | string;
  carburant: number | string;
  depenses: number | string;
  pannes: number;
  accidents: number;
  pret_a_charger: boolean;
}

interface FlotteJson {
  chauffeurs: number;
  chauffeurs_indisponibles: number;
  ordres_ouverts: number | null;
  ordres_anciens: number | null;
  solde_caisse: number | null;
  seuil_caisse: number | null;
  cuve_litres: number | null;
  cuve_jours: number | null;
  jours_sans_accident: number | null;
  demandes_sans_reponse?: number | null;
}

interface SituationJson {
  jour: string;
  vehicules: VehiculeJson[];
  flotte: FlotteJson;
}

/* Les sommes en base sont des numérics : ils arrivent en chaîne dans le JSON. */
const n = (v: number | string) => (typeof v === "number" ? v : Number(v));

function plusJours(jour: string, k: number): string {
  return new Date(Date.parse(`${jour}T00:00:00Z`) + k * 86_400_000).toISOString().slice(0, 10);
}

function situationDepuisJson(s: SituationJson): SituationJournaliere {
  const vehicules: FaitsVehiculeJour[] = s.vehicules.map((v) => ({
    vehiculeId: v.vehicule_id,
    jour: s.jour,
    engage: v.engage,
    statut: v.statut,
    immobiliseAdmin: v.immobilise_admin,
    immobiliseDepuisJours: v.immobilise_depuis_jours,
    echeances7: v.echeances7,
    echues: v.echues,
    sansReleve7: v.sans_releve7,
    litres: n(v.litres),
    carburant: n(v.carburant),
    depenses: n(v.depenses),
    pannes: v.pannes,
    accidents: v.accidents,
    pretACharger: v.pret_a_charger,
  }));
  const f = s.flotte;
  const flotte: FaitsFlotteJour = {
    jour: s.jour,
    chauffeurs: f.chauffeurs,
    chauffeursIndisponibles: f.chauffeurs_indisponibles,
    ordresOuverts: f.ordres_ouverts,
    ordresAnciens: f.ordres_anciens,
    soldeCaisse: f.solde_caisse,
    seuilCaisse: f.seuil_caisse,
    cuveLitres: f.cuve_litres,
    cuveJours: f.cuve_jours,
    joursSansAccident: f.jours_sans_accident,
    demandesSansReponse: f.demandes_sans_reponse ?? null,
  };
  return { jour: s.jour, vehicules, flotte };
}

/** Les situations des `profondeur` derniers jours, du plus ancien à `aujourdhui`. */
async function situationsServeurBrut(aujourdhui: string, profondeur = 28): Promise<SituationJournaliere[]> {
  if (!authentificationReelle()) return situationsJournalieres(aujourdhui, profondeur);
  const client = await clientServeur();
  const lecture = await client.rpc("situation_journaliere", { depuis: plusJours(aujourdhui, 1 - profondeur), jusqua: aujourdhui }).maybeSingle<SituationJson[]>();
  /* Fonction pas encore jouée en base : la démonstration prend le relais, comme pour le parc. */
  if (lecture.error || !Array.isArray(lecture.data)) return situationsJournalieres(aujourdhui, profondeur);
  return lecture.data.map(situationDepuisJson);
}

export const situationsServeur = cache(situationsServeurBrut);

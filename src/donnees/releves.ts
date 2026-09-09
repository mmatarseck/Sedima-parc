/* ============================================================================
 * Le relevé de transport entier, lu avec la session de l'utilisateur.
 *
 * Base branchée : `releve_transport` (0018), tous modes confondus — le parc,
 * les transporteurs, les enlèvements clients, les prestataires ponctuels —
 * sur deux ans. `lire_transporteurs()` ne rend que les lignes portées par un
 * transporteur ; les rapports d'efficacité et de destinations lisent tout.
 * Sinon, le relevé de la démonstration. La forme est celle de l'écran Relevé.
 * ==========================================================================*/

import { cache } from "react";
import { destinationTarifaire } from "@/domaine/flotte-tierce";
import { afficher } from "@/domaine/immatriculation";
import { semaineDe, type LigneReleve, type ModeExecution, type ProduitTransporte } from "@/domaine/releve-transport";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { relevesTransport } from "./releve-demo";
import { transporteursServeur } from "./transporteurs";

export interface LigneReleveBase {
  numero: string;
  date: string;
  mode: ModeExecution;
  camion_tiers_immatriculation: string | null;
  immatriculation_libre: string | null;
  chauffeur: string | null;
  origine: string;
  destination: string;
  produit: ProduitTransporte;
  tonnage: number | string;
  tonnage_pese: number | string | null;
  bon_livraison: string | null;
  prestataire: { numero: string; raison_sociale: string } | null;
  vehicule: { immatriculation: string } | null;
  affretement: { numero: string } | null;
}

async function relevesServeurBrut(): Promise<LigneReleve[]> {
  if (!authentificationReelle()) return relevesTransport();
  const client = await clientServeur();
  const depuis = new Date();
  depuis.setUTCFullYear(depuis.getUTCFullYear() - 2);
  const [lecture, transporteurs] = await Promise.all([
    client
      .from("releve_transport")
      .select("numero, date, mode, camion_tiers_immatriculation, immatriculation_libre, chauffeur, origine, destination, produit, tonnage, tonnage_pese, bon_livraison, prestataire (numero, raison_sociale), vehicule (immatriculation), affretement (numero)")
      .gte("date", depuis.toISOString().slice(0, 10))
      .order("date", { ascending: false })
      .limit(20000)
      .returns<LigneReleveBase[]>(),
    transporteursServeur(),
  ]);
  if (lecture.error) {
    console.warn(`Relevé de transport : lecture impossible (${lecture.error.message}).`);
    return [];
  }
  const rattachements = transporteurs.rattachements;
  return lecture.data.map((t) => {
    const libre = t.mode === "enlevement-client" || t.mode === "prestataire-ponctuel";
    return {
      numero: t.numero,
      date: t.date,
      semaine: semaineDe(t.date),
      mode: t.mode,
      transporteurNumero: t.prestataire?.numero ?? null,
      transporteur: t.prestataire?.raison_sociale ?? null,
      vehiculeId: t.vehicule?.immatriculation ?? null,
      camionTiersImmatriculation: t.camion_tiers_immatriculation ? afficher(t.camion_tiers_immatriculation) : null,
      immatriculationLibre: t.immatriculation_libre,
      chauffeurLibre: libre ? t.chauffeur : null,
      chauffeur: t.chauffeur,
      origine: t.origine,
      destination: t.destination,
      destinationTarifaire: destinationTarifaire(t.destination, rattachements)?.destination ?? t.destination,
      produit: t.produit,
      tonnage: Number(t.tonnage),
      tonnagePese: t.tonnage_pese === null ? null : Number(t.tonnage_pese),
      bonLivraison: t.bon_livraison,
      affretementNumero: t.affretement?.numero ?? null,
    };
  });
}

export const relevesServeur = cache(relevesServeurBrut);

/* ============================================================================
 * Les visites techniques et leurs observations, lues avec la session.
 *
 * Base branchée : `visite_technique` et `observation_visite` (0023), deux ans
 * de visites. Sinon, celles des fiches de démonstration. La forme est celle
 * de la fiche véhicule (`VisiteTechnique`, `ObservationVisite`) ; les
 * identifiants sont les numéros, et une observation cite sa visite par le
 * numéro de celle-ci.
 * ==========================================================================*/

import { cache } from "react";
import type { Parametres } from "@/domaine/parametres";
import type { ObservationVisite, VisiteTechnique } from "@/domaine/types";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { visitesDemonstration } from "./visites-demo";

export interface VisitesServeur {
  visites: VisiteTechnique[];
  observations: ObservationVisite[];
}

interface LigneVisiteBase {
  numero: string;
  type: VisiteTechnique["type"];
  centre: string;
  date_rendez_vous: string;
  heure: string | null;
  date_passage: string | null;
  statut: VisiteTechnique["statut"];
  numero_pv: string | null;
  date_limite_contre_visite: string | null;
  commentaire: string | null;
  vehicule: { immatriculation: string } | null;
}

interface LigneObservationBase {
  numero: string;
  visite_numero: string;
  libelle: string;
  categorie: ObservationVisite["categorie"];
  gravite: ObservationVisite["gravite"];
  statut: ObservationVisite["statut"];
  intervention_numero: string | null;
  corrigee_le: string | null;
  commentaire: string | null;
  vehicule: { immatriculation: string } | null;
}

async function visitesServeurBrut(parametres: Parametres): Promise<VisitesServeur> {
  if (!authentificationReelle()) return visitesDemonstration(parametres);
  const client = await clientServeur();
  const depuis = new Date();
  depuis.setUTCFullYear(depuis.getUTCFullYear() - 2);
  const [visites, observations] = await Promise.all([
    client
      .from("visite_technique")
      .select("numero, type, centre, date_rendez_vous, heure, date_passage, statut, numero_pv, date_limite_contre_visite, commentaire, vehicule (immatriculation)")
      .gte("date_rendez_vous", depuis.toISOString().slice(0, 10))
      .order("date_rendez_vous", { ascending: false })
      .limit(5000)
      .returns<LigneVisiteBase[]>(),
    client.from("observation_visite").select("numero, visite_numero, libelle, categorie, gravite, statut, intervention_numero, corrigee_le, commentaire, vehicule (immatriculation)").limit(5000).returns<LigneObservationBase[]>(),
  ]);
  /* Tables pas encore jouées : aucune visite, pas d'erreur. */
  if (visites.error) console.warn(`Visites techniques : lecture impossible (${visites.error.message}).`);
  if (observations.error) console.warn(`Observations de visite : lecture impossible (${observations.error.message}).`);
  return {
    visites: (visites.data ?? []).map((v) => ({
      id: v.numero,
      numero: v.numero,
      vehiculeId: v.vehicule?.immatriculation ?? "",
      type: v.type,
      centre: v.centre,
      dateRendezVous: v.date_rendez_vous,
      heure: v.heure,
      datePassage: v.date_passage,
      statut: v.statut,
      numeroPv: v.numero_pv,
      dateLimiteContreVisite: v.date_limite_contre_visite,
      commentaire: v.commentaire,
    })),
    observations: (observations.data ?? []).map((o) => ({
      id: o.numero,
      numero: o.numero,
      visiteId: o.visite_numero,
      vehiculeId: o.vehicule?.immatriculation ?? "",
      libelle: o.libelle,
      categorie: o.categorie,
      gravite: o.gravite,
      statut: o.statut,
      interventionNumero: o.intervention_numero,
      corrigeeLe: o.corrigee_le,
      commentaire: o.commentaire,
    })),
  };
}

export const visitesServeur = cache(visitesServeurBrut);

/* ============================================================================
 * Les incidents et sinistres, lus avec la session de l'utilisateur.
 *
 * Base branchée : la table `incident` (0001), avec le véhicule et le
 * chauffeur qu'elle cite — une lecture bornée à deux ans. Sinon, les
 * déclarations de la démonstration. La forme est celle de l'écran Incidents
 * (`LigneIncident`) : les rapports la lisent telle quelle.
 * ==========================================================================*/

import { cache } from "react";
import { idChauffeur } from "@/domaine/chauffeur";
import { afficher } from "@/domaine/immatriculation";
import type { LigneIncident } from "@/domaine/incidents";
import type { BusinessUnit } from "@/domaine/types";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { listeIncidents } from "./incidents-demo";

export interface LigneIncidentBase {
  numero: string;
  date_heure: string;
  nature: LigneIncident["nature"];
  type: LigneIncident["type"];
  lieu: string | null;
  mission: LigneIncident["mission"];
  responsabilite: LigneIncident["responsabilite"];
  statut: LigneIncident["statut"];
  blesses: boolean;
  sinistre_ouvert: boolean;
  immobilisation_jours: number | null;
  kilometrage: number | null;
  declarant: string | null;
  description: string | null;
  vehicule: { immatriculation: string; marque: string; appellation: string; business_unit: BusinessUnit | null; site: { libelle: string } | null } | null;
  chauffeur: { nom: string; prenom: string } | null;
}

/** Une déclaration telle que la table la porte, à la forme de l'écran. */
export function incidentDepuisLigne(l: LigneIncidentBase): LigneIncident {
  const v = l.vehicule;
  const nomChauffeur = l.chauffeur ? `${l.chauffeur.prenom} ${l.chauffeur.nom}` : null;
  const description = l.description ?? "";
  return {
    numero: l.numero,
    vehiculeId: v?.immatriculation ?? "",
    immatriculation: v?.immatriculation ?? "",
    immatriculationAffichee: v ? afficher(v.immatriculation) : "—",
    vehicule: v ? `${v.marque} ${v.appellation}` : "",
    businessUnit: v?.business_unit ?? null,
    site: v?.site?.libelle ?? null,
    nature: l.nature,
    type: l.type,
    dateHeure: l.date_heure.length > 16 ? l.date_heure.slice(0, 16) : l.date_heure,
    lieu: l.lieu ?? "",
    chauffeurId: nomChauffeur ? idChauffeur(nomChauffeur) : null,
    chauffeur: nomChauffeur,
    mission: l.mission,
    /* Le véhicule roule-t-il encore ? La table ne le dit pas : la description le dit, comme sur la fiche du chauffeur. */
    roulant: /non roulant/i.test(description) ? "non" : /réserve/i.test(description) ? "reserve" : "oui",
    statut: l.statut,
    responsabilite: l.responsabilite,
    blesses: l.blesses,
    sinistreOuvert: l.sinistre_ouvert,
    cout: null,
    immobilisationJours: l.immobilisation_jours,
    description,
    kilometrage: l.kilometrage,
    declarant: l.declarant ?? "Service parc",
    creee: false,
  };
}

async function incidentsServeurBrut(): Promise<LigneIncident[]> {
  if (!authentificationReelle()) return listeIncidents();
  const client = await clientServeur();
  const depuis = new Date();
  depuis.setUTCFullYear(depuis.getUTCFullYear() - 2);
  const lecture = await client
    .from("incident")
    .select("numero, date_heure, nature, type, lieu, mission, responsabilite, statut, blesses, sinistre_ouvert, immobilisation_jours, kilometrage, declarant, description, vehicule (immatriculation, marque, appellation, business_unit, site (libelle)), chauffeur (nom, prenom)")
    .gte("date_heure", depuis.toISOString())
    .order("date_heure", { ascending: false })
    .limit(5000)
    .returns<LigneIncidentBase[]>();
  if (lecture.error) {
    console.warn(`Incidents : lecture impossible (${lecture.error.message}).`);
    return [];
  }
  return lecture.data.map(incidentDepuisLigne);
}

export const incidentsServeur = cache(incidentsServeurBrut);

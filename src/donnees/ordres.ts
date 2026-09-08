/* ============================================================================
 * Les ordres de travail, lus avec la session de l'utilisateur.
 *
 * Base branchée : la table `ordre_travail` (0016), bornée par les politiques
 * au périmètre de la personne. Sinon, les ordres de la démonstration. Une
 * lecture par requête : la page Maintenance, l'atelier et l'accueil du
 * téléphone partagent le même résultat.
 * ==========================================================================*/

import { cache } from "react";
import { afficher } from "@/domaine/immatriculation";
import type { LigneOrdre } from "@/domaine/maintenance";
import type { BusinessUnit } from "@/domaine/types";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { ordresDeTravail } from "./maintenance-demo";

export interface LigneOrdreBase {
  numero: string;
  vehicule_id: string;
  type: "preventif" | "curatif";
  objet: string;
  origine_numero: string | null;
  origine_libelle: string | null;
  garage: string;
  date_prevue: string;
  immobilisation_prevue_jours: number | null;
  montant_estime: number | null;
  statut: LigneOrdre["statut"];
  date_debut: string | null;
  date_cloture: string | null;
  intervention_numero: string | null;
  commentaire: string | null;
  demandeur_nom: string | null;
  vehicule: { immatriculation: string; marque: string; appellation: string; business_unit: BusinessUnit | null; site: { libelle: string } | null } | null;
  prestataire: { raison_sociale: string } | null;
}

export function ordreDepuisLigne(l: LigneOrdreBase): LigneOrdre {
  const v = l.vehicule;
  return {
    numero: l.numero,
    /* La liste Flotte nomme un véhicule par son immatriculation : l'ordre suit, pour que les écrans se retrouvent. */
    vehiculeId: v?.immatriculation ?? l.vehicule_id,
    immatriculation: v?.immatriculation ?? l.vehicule_id,
    immatriculationAffichee: v ? afficher(v.immatriculation) : l.vehicule_id,
    vehicule: v ? `${v.marque} ${v.appellation}` : "—",
    businessUnit: v?.business_unit ?? null,
    site: v?.site?.libelle ?? null,
    type: l.type,
    objet: l.objet,
    origineNumero: l.origine_numero,
    origineLibelle: l.origine_libelle ?? (l.origine_numero ? null : "Plan d'entretien"),
    garage: l.prestataire?.raison_sociale ?? l.garage,
    datePrevue: l.date_prevue,
    immobilisationPrevueJours: l.immobilisation_prevue_jours,
    montantEstime: l.montant_estime,
    statut: l.statut,
    dateDebut: l.date_debut,
    dateCloture: l.date_cloture,
    interventionNumero: l.intervention_numero,
    commentaire: l.commentaire,
    demandeur: l.demandeur_nom ?? "—",
    creee: false,
  };
}

async function ordresServeurBrut(): Promise<LigneOrdre[]> {
  if (!authentificationReelle()) return ordresDeTravail();
  const client = await clientServeur();
  const lecture = await client
    .from("ordre_travail")
    .select("numero, vehicule_id, type, objet, origine_numero, origine_libelle, garage, date_prevue, immobilisation_prevue_jours, montant_estime, statut, date_debut, date_cloture, intervention_numero, commentaire, demandeur_nom, vehicule (immatriculation, marque, appellation, business_unit, site (libelle)), prestataire (raison_sociale)")
    .order("date_prevue", { ascending: false })
    .limit(2000)
    .returns<LigneOrdreBase[]>();
  /* Table pas encore jouée : aucun ordre, pas d'erreur. */
  if (lecture.error) return [];
  return lecture.data.map(ordreDepuisLigne);
}

export const ordresServeur = cache(ordresServeurBrut);

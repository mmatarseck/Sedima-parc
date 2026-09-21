/* ============================================================================
 * Les signalements de pannes et d'anomalies (0060), lus avec la session.
 *
 * Une lecture qui échoue arrête la page (`lecture.ts`) : mieux vaut un écran
 * qui refuse qu'une liste vide qu'on lirait « aucune panne ». La migration 0060
 * se joue donc avant le déploiement.
 * ==========================================================================*/

import { cache } from "react";
import { afficher } from "@/domaine/immatriculation";
import type { LigneSignalement } from "@/domaine/signalements";
import { clientServeur } from "@/lib/supabase";
import { lignesLues } from "./lecture";

interface LigneSignalementBase {
  numero: string;
  date: string;
  priorite: LigneSignalement["priorite"];
  systeme: string | null;
  description: string;
  details: string | null;
  kilometrage: number | null;
  pieces: string[] | null;
  statut: LigneSignalement["statut"];
  resolu_le: string | null;
  service_numero: string | null;
  declarant: string | null;
  vehicule: { immatriculation: string; marque: string; appellation: string } | null;
}

const COLONNES = "numero, date, priorite, systeme, description, details, kilometrage, pieces, statut, resolu_le, service_numero, declarant, vehicule (immatriculation, marque, appellation)";

export function signalementDepuisLigne(l: LigneSignalementBase): LigneSignalement {
  const v = l.vehicule;
  return {
    numero: l.numero,
    vehiculeId: v?.immatriculation ?? "",
    immatriculationAffichee: v ? afficher(v.immatriculation) : "—",
    vehicule: v ? `${v.marque} ${v.appellation}` : "—",
    date: l.date,
    priorite: l.priorite,
    systeme: l.systeme,
    description: l.description,
    details: l.details,
    kilometrage: l.kilometrage,
    pieces: l.pieces ?? [],
    statut: l.statut,
    resoluLe: l.resolu_le,
    serviceNumero: l.service_numero,
    declarant: l.declarant,
    creee: false,
  };
}

/** Les signalements ouverts, et ceux résolus ou annulés depuis un an. */
async function signalementsServeurBrut(): Promise<LigneSignalement[]> {
  const client = await clientServeur();
  const depuis = new Date();
  depuis.setUTCFullYear(depuis.getUTCFullYear() - 1);
  const lecture = await client
    .from("signalement")
    .select(COLONNES)
    .or(`statut.eq.ouvert,date.gte.${depuis.toISOString().slice(0, 10)}`)
    .order("date", { ascending: false })
    .limit(3000)
    .returns<LigneSignalementBase[]>();
  return lignesLues("Signalements", lecture).map(signalementDepuisLigne);
}

export const signalementsServeur = cache(signalementsServeurBrut);

/** Ceux d'un véhicule, pour sa fiche. */
export async function signalementsDuVehicule(client: Awaited<ReturnType<typeof clientServeur>>, vehiculeId: string): Promise<LigneSignalement[]> {
  const lecture = await client.from("signalement").select(COLONNES).eq("vehicule_id", vehiculeId).order("date", { ascending: false }).limit(500).returns<LigneSignalementBase[]>();
  return lignesLues("Signalements du véhicule", lecture).map(signalementDepuisLigne);
}

/* ============================================================================
 * Les ordres de travail, lus avec la session de l'utilisateur.
 *
 * Base branchée : la table `ordre_travail` (0016), bornée par les politiques
 * au périmètre de la personne. Sinon, les ordres de la démonstration. Une
 * lecture par requête : la page Maintenance, l'atelier et l'accueil du
 * téléphone partagent le même résultat.
 * ==========================================================================*/

import { lignesLues } from "./lecture";
import { cache } from "react";
import { afficher } from "@/domaine/immatriculation";
import type { LigneOrdre } from "@/domaine/maintenance";
import { lireLignes, type ModeRemise, type PrioriteService } from "@/domaine/service";
import type { BusinessUnit } from "@/domaine/types";
import { clientServeur } from "@/lib/supabase";

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

/** Les colonnes du service de maintenance (0060), lues à part. */
interface ColonnesService {
  numero: string;
  priorite: PrioriteService | null;
  date_fin: string | null;
  kilometrage: number | null;
  numero_facture: string | null;
  lignes: unknown;
  remise_mode: ModeRemise | null;
  remise_valeur: number | string | null;
  main_oeuvre_globale?: number | string | null;
  tva_taux: number | string | null;
  brs_taux: number | string | null;
  pieces: string[] | null;
  signalements: string[] | null;
}

export function serviceDepuisColonnes(o: LigneOrdre, c: ColonnesService | undefined): LigneOrdre {
  if (!c) return o;
  return {
    ...o,
    priorite: c.priorite ?? "planifie",
    dateFin: c.date_fin,
    kilometrage: c.kilometrage,
    numeroFacture: c.numero_facture,
    lignes: lireLignes(c.lignes),
    remiseMode: c.remise_mode ?? "montant",
    remiseValeur: Number(c.remise_valeur ?? 0),
    mainOeuvreGlobale: Number(c.main_oeuvre_globale ?? 0),
    tvaTaux: Number(c.tva_taux ?? 0),
    brsTaux: Number(c.brs_taux ?? 0),
    pieces: c.pieces ?? [],
    signalements: c.signalements ?? [],
  };
}

/** Ce que 0060 ajoute, lu à part : avant la migration, cette lecture échoue seule et les ordres restent entiers. */
export async function colonnesDesServices(client: Awaited<ReturnType<typeof clientServeur>>, filtre?: { vehiculeId: string }): Promise<Map<string, ColonnesService>> {
  let requete = client.from("ordre_travail").select("numero, priorite, date_fin, kilometrage, numero_facture, lignes, remise_mode, remise_valeur, tva_taux, brs_taux, pieces, signalements");
  if (filtre) requete = requete.eq("vehicule_id", filtre.vehiculeId);
  const lecture = await requete.limit(2000).returns<ColonnesService[]>();
  /* La main-d'œuvre globale (0062), lue à part : sans la migration, elle manque seule. */
  let globale = client.from("ordre_travail").select("numero, main_oeuvre_globale");
  if (filtre) globale = globale.eq("vehicule_id", filtre.vehiculeId);
  const lectureGlobale = await globale.limit(2000).returns<{ numero: string; main_oeuvre_globale: number | string | null }[]>();
  const parNumero = new Map((lectureGlobale.error ? [] : (lectureGlobale.data ?? [])).map((g) => [g.numero, g.main_oeuvre_globale]));
  return new Map((lecture.error ? [] : (lecture.data ?? [])).map((c) => [c.numero, { ...c, main_oeuvre_globale: parNumero.get(c.numero) ?? 0 }]));
}

async function ordresServeurBrut(): Promise<LigneOrdre[]> {
  const client = await clientServeur();
  const colonnes = colonnesDesServices(client);
  const lecture = await client
    .from("ordre_travail")
    .select("numero, vehicule_id, type, objet, origine_numero, origine_libelle, garage, date_prevue, immobilisation_prevue_jours, montant_estime, statut, date_debut, date_cloture, intervention_numero, commentaire, demandeur_nom, vehicule (immatriculation, marque, appellation, business_unit, site (libelle)), prestataire (raison_sociale)")
    .order("date_prevue", { ascending: false })
    .limit(2000)
    .returns<LigneOrdreBase[]>();
  /* Table pas encore jouée : aucun ordre, pas d'erreur. */
  const services = await colonnes;
  return lignesLues("Ordres de travail", lecture).map((l) => serviceDepuisColonnes(ordreDepuisLigne(l), services.get(l.numero)));
}

export const ordresServeur = cache(ordresServeurBrut);

/** Les services d'un véhicule, pour sa fiche. */
export async function servicesDuVehicule(client: Awaited<ReturnType<typeof clientServeur>>, vehiculeId: string): Promise<LigneOrdre[]> {
  const [lecture, colonnes] = await Promise.all([
    client
      .from("ordre_travail")
      .select("numero, vehicule_id, type, objet, origine_numero, origine_libelle, garage, date_prevue, immobilisation_prevue_jours, montant_estime, statut, date_debut, date_cloture, intervention_numero, commentaire, demandeur_nom, vehicule (immatriculation, marque, appellation, business_unit, site (libelle)), prestataire (raison_sociale)")
      .eq("vehicule_id", vehiculeId)
      .order("date_prevue", { ascending: false })
      .limit(500)
      .returns<LigneOrdreBase[]>(),
    colonnesDesServices(client, { vehiculeId }),
  ]);
  return lignesLues("Services du véhicule", lecture).map((l) => serviceDepuisColonnes(ordreDepuisLigne(l), colonnes.get(l.numero)));
}

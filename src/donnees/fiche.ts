/* ============================================================================
 * La fiche d'un véhicule, lue avec la session de l'utilisateur.
 *
 * Base branchée : la ligne vient de la liste Flotte (déjà bornée au
 * périmètre), les faits de `lire_fiche()` (0013), et l'assembleur du domaine
 * en fait la fiche 360°. Sinon, la fiche de démonstration. Une lecture par
 * requête.
 * ==========================================================================*/

import { cache } from "react";
import { assemblerFiche, FAITS_VIDES, type FaitsFiche } from "@/domaine/assembler-fiche";
import type { FicheVehicule } from "@/domaine/fiche";
import type { LivraisonFiche } from "@/domaine/livraisons";
import { normaliser } from "@/domaine/immatriculation";
import type { Parametres } from "@/domaine/parametres";
import type { CategorieObservation, PosteDepense, TypeDocument } from "@/domaine/types";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { DATE_REFERENCE } from "./chauffeurs-demo";
import { passagesReleves, planDuVehicule, programmeParDefaut } from "./entretien-demo";
import { fichePourImmatriculation } from "./fiche-demo";
import { lignesFlotte } from "./flotte";

export interface FicheJson {
  documents: { numero: string; type_document_id: string; date_effet: string | null; echeance: string | null; emetteur: string | null; numero_piece: string | null; montant: number | null; justificatif: boolean }[];
  licences: { numero: string; libelle: string; numero_piece: string; emetteur: string; perimetre: "flotte" | "partie"; date_effet: string; echeance: string; vehicules: number }[];
  affectations: { numero: string; chauffeur_id: string | null; chauffeur: string; role: "titulaire" | "suppleant"; debut: string; fin: string | null; motif: string }[];
  releves: { numero: string; date: string; km: number; origine: string; motif_rejet: string | null }[];
  pleins: { numero: string; date: string; litres: number | string; prix_litre: number; montant: number; km: number | null; source: string; reference: string | null; prestataire: string | null }[];
  depenses: { numero: string; date: string; poste: PosteDepense; libelle: string; montant: number; beneficiaire: string | null; reference: string | null; origine: "caisse" | "bon-de-commande" | "facture"; justificatif: boolean; km: number | null; km_motif_rejet: string | null }[];
  interventions: { numero: string; date: string; type: "preventif" | "curatif"; objet: string; garage: string | null; montant: number; immobilisation_jours: number | null; km: number | null; reference: string | null }[];
  statuts: { le: string; avant: string | null; apres: string | null; motif: string }[];
  visites?: { numero: string; type: "visite" | "contre-visite"; centre: string; date_rendez_vous: string; heure: string | null; date_passage: string | null; statut: "rendez-vous" | "acceptee" | "refusee" | "annulee"; numero_pv: string | null; date_limite_contre_visite: string | null; commentaire: string | null }[];
  observations?: { numero: string; visite_numero: string; libelle: string; categorie: CategorieObservation; gravite: "majeure" | "mineure"; statut: "a-traiter" | "en-cours" | "corrigee"; intervention_numero: string | null; corrigee_le: string | null; commentaire: string | null }[];
}

export function faitsDepuisJson(j: FicheJson): FaitsFiche {
  return {
    documents: j.documents.map((d) => ({ numero: d.numero, type: d.type_document_id as TypeDocument, dateEffet: d.date_effet, echeance: d.echeance, emetteur: d.emetteur, numeroPiece: d.numero_piece, montant: d.montant, justificatif: d.justificatif })),
    licences: j.licences.map((l) => ({ numero: l.numero, libelle: l.libelle, numeroPiece: l.numero_piece, emetteur: l.emetteur, perimetre: l.perimetre, dateEffet: l.date_effet, echeance: l.echeance, vehicules: Number(l.vehicules) })),
    affectations: j.affectations.map((a) => ({ numero: a.numero, chauffeurId: a.chauffeur_id, chauffeur: a.chauffeur, role: a.role, debut: a.debut, fin: a.fin, motif: a.motif })),
    releves: j.releves.map((r) => ({ numero: r.numero, date: r.date, km: r.km, origine: r.origine, motifRejet: r.motif_rejet })),
    pleins: j.pleins.map((p) => ({ numero: p.numero, date: p.date, litres: Number(p.litres), prixLitre: p.prix_litre, montant: p.montant, km: p.km, source: p.prestataire ?? p.source, reference: p.reference })),
    depenses: j.depenses.map((d) => ({ numero: d.numero, date: d.date, poste: d.poste, libelle: d.libelle, montant: d.montant, beneficiaire: d.beneficiaire, reference: d.reference, origine: d.origine, justificatif: d.justificatif, km: d.km, kmMotifRejet: d.km_motif_rejet })),
    interventions: j.interventions.map((i) => ({ numero: i.numero, date: i.date, type: i.type, objet: i.objet, garage: i.garage, montant: i.montant, immobilisationJours: i.immobilisation_jours, km: i.km, reference: i.reference })),
    statuts: j.statuts,
    visites: (j.visites ?? []).map((x) => ({ numero: x.numero, type: x.type, centre: x.centre, dateRendezVous: x.date_rendez_vous, heure: x.heure, datePassage: x.date_passage, statut: x.statut, numeroPv: x.numero_pv, dateLimiteContreVisite: x.date_limite_contre_visite, commentaire: x.commentaire })),
    observations: (j.observations ?? []).map((o) => ({ numero: o.numero, visiteNumero: o.visite_numero, libelle: o.libelle, categorie: o.categorie, gravite: o.gravite, statut: o.statut, interventionNumero: o.intervention_numero, corrigeeLe: o.corrigee_le, commentaire: o.commentaire })),
  };
}

interface LivraisonBase {
  numero: string;
  date: string;
  site: string;
  client: string | null;
  produits: string | null;
  poids_kg: number | string | null;
  quantites: Record<string, number> | null;
  lignes: number;
  transporteur_libelle: string | null;
  chauffeur: string | null;
  source: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Les bons de livraison du véhicule (0044). Table pas encore jouée, ou véhicule à recevoir sans identifiant : aucun bon, pas d'erreur. */
async function livraisonsDuVehicule(client: Awaited<ReturnType<typeof clientServeur>>, vehiculeId: string): Promise<LivraisonFiche[]> {
  if (!UUID.test(vehiculeId)) return [];
  const lecture = await client.from("livraison").select("numero, date, site, client, produits, poids_kg, quantites, lignes, transporteur_libelle, chauffeur, source").eq("vehicule_id", vehiculeId).order("date", { ascending: false }).limit(5000).returns<LivraisonBase[]>();
  if (lecture.error) {
    console.warn(`Livraisons ${vehiculeId} : lecture impossible (${lecture.error.message}).`);
    return [];
  }
  return lecture.data.map((l) => ({ numero: l.numero, date: l.date, site: l.site, client: l.client, produits: l.produits, poidsKg: l.poids_kg === null ? null : Number(l.poids_kg), quantites: l.quantites ?? {}, lignes: l.lignes, transporteur: l.transporteur_libelle, chauffeur: l.chauffeur, source: l.source }));
}

/**
 * La fiche de **tout** véhicule de la base — transport, service ou fonction —, par
 * immatriculation sous n'importe quelle écriture ; nulle hors périmètre.
 *
 * Les véhicules de service et de fonction en étaient exclus : ils ouvraient la
 * fiche réduite du parc léger, qui dit « ce véhicule n'est pas encore dans la
 * base » — faux pour AA-019-EA et les autres, qui y sont avec leurs documents,
 * leurs interventions et leurs dépenses (11 septembre 2026).
 */
async function ficheServeurBrut(brut: string, parametres: Parametres): Promise<FicheVehicule | null> {
  const demonstration = !authentificationReelle();
  /* La démonstration tient ses fiches de transport toutes faites. */
  const faite = demonstration ? fichePourImmatriculation(brut, parametres) : null;
  if (faite) return faite;
  const canonique = normaliser(brut);
  const lignes = await lignesFlotte(parametres);
  /* Par immatriculation, ou par numéro de lot pour un véhicule à recevoir : sans plaque encore, il a sa fiche complète comme les autres — c'est la seule fiche de l'application. */
  const ligne = lignes.find((l) => l.vehicule.immatriculation === canonique || l.vehicule.id === brut.toLowerCase()) ?? null;
  if (!ligne) return null;
  if (demonstration) {
    const d = ligne.vehicule;
    return assemblerFiche(ligne, FAITS_VIDES, parametres, DATE_REFERENCE, { programme: programmeParDefaut(d.categorie), plan: planDuVehicule(d.id, d.categorie), passages: passagesReleves });
  }
  const client = await clientServeur();
  const [lecture, livraisons] = await Promise.all([client.rpc("lire_fiche", { immat: canonique }).maybeSingle<FicheJson | null>(), livraisonsDuVehicule(client, ligne.vehicule.id)]);
  /* Fonction pas encore jouée : la fiche se dresse sur la ligne seule, sans historique — pas d'erreur. */
  if (lecture.error) console.warn(`Fiche ${canonique} : lire_fiche() indisponible (${lecture.error.message}), fiche dressée sans historique.`);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const v = ligne.vehicule;
  const plan = { programme: programmeParDefaut(v.categorie), plan: planDuVehicule(v.id, v.categorie), passages: passagesReleves };
  /* Une donnée fautive dans l'historique ne doit pas fermer la fiche : elle
     s'ouvre alors sans historique, et le journal du serveur dit pourquoi. */
  try {
    return assemblerFiche(ligne, { ...(!lecture.error && lecture.data ? faitsDepuisJson(lecture.data) : FAITS_VIDES), livraisons }, parametres, aujourdhui, plan);
  } catch (e) {
    console.error(`Fiche ${canonique} : assemblage impossible sur l'historique lu — ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
    return assemblerFiche(ligne, { ...FAITS_VIDES, livraisons }, parametres, aujourdhui, plan);
  }
}

export const ficheServeur = cache(ficheServeurBrut);

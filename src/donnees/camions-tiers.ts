/* ============================================================================
 * Les camions des transporteurs, lus avec la session de l'utilisateur (0072).
 *
 * La liste : le référentiel `camion_tiers`, son transporteur et son chauffeur
 * habituel, et ce que les trente derniers jours en disent — voyages et tonnes
 * au relevé de tonnage, carburant fourni, incidents ouverts. La fiche : tout
 * ce qui cite la plaque — relevés, livraisons, pleins, incidents, documents,
 * mises à disposition, et le journal de ses modifications.
 * ==========================================================================*/

import { cache } from "react";
import type { BusinessUnit, CategorieVehicule, StatutVehicule } from "@/domaine/types";
import type { CamionTiers, LigneCamionTiers, TypeContratCamion } from "@/domaine/camions-tiers";
import { afficher } from "@/domaine/immatriculation";
import { jourCourant } from "@/domaine/temps";
import { clientServeur } from "@/lib/supabase";
import { lignesLues } from "./lecture";

interface LigneCamionBase {
  immatriculation: string;
  categorie: CategorieVehicule;
  capacite_tonnes: number | string | null;
  actif: boolean;
  commentaire: string | null;
  cree_le: string | null;
  marque: string | null;
  modele: string | null;
  vin: string | null;
  premiere_mise_en_circulation: string | null;
  photo: string | null;
  statut: StatutVehicule;
  business_unit: BusinessUnit | null;
  type_contrat: TypeContratCamion;
  carburant_fourni: boolean;
  balise_geolocalisation: boolean;
  carte_peage_secaa: boolean;
  numero_carte_secaa: string | null;
  carte_peage_ageroute: boolean;
  numero_carte_ageroute: string | null;
  prestataire: { numero: string; raison_sociale: string } | null;
  chauffeur_tiers: { nom: string; telephone: string | null } | null;
}

const COLONNES_CAMION =
  "immatriculation, categorie, capacite_tonnes, actif, commentaire, cree_le, marque, modele, vin, premiere_mise_en_circulation, photo, statut, business_unit, type_contrat, carburant_fourni, balise_geolocalisation, carte_peage_secaa, numero_carte_secaa, carte_peage_ageroute, numero_carte_ageroute, prestataire (numero, raison_sociale), chauffeur_tiers (nom, telephone)";

function camionDepuisLigne(l: LigneCamionBase): CamionTiers {
  return {
    immatriculation: l.immatriculation,
    immatriculationAffichee: afficher(l.immatriculation),
    transporteurNumero: l.prestataire?.numero ?? "",
    transporteur: l.prestataire?.raison_sociale ?? "Transporteur",
    marque: l.marque,
    modele: l.modele,
    categorie: l.categorie,
    capaciteTonnes: l.capacite_tonnes === null ? null : Number(l.capacite_tonnes),
    vin: l.vin,
    premiereMiseEnCirculation: l.premiere_mise_en_circulation,
    photo: l.photo,
    statut: l.statut,
    businessUnit: l.business_unit,
    typeContrat: l.type_contrat,
    carburantFourni: l.carburant_fourni,
    actif: l.actif,
    commentaire: l.commentaire,
    creeLe: l.cree_le,
    chauffeur: l.chauffeur_tiers ? { nom: l.chauffeur_tiers.nom, telephone: l.chauffeur_tiers.telephone } : null,
    balise: l.balise_geolocalisation,
    carteSecaa: l.carte_peage_secaa,
    numeroCarteSecaa: l.numero_carte_secaa,
    carteAgeroute: l.carte_peage_ageroute,
    numeroCarteAgeroute: l.numero_carte_ageroute,
  };
}

function ilYA(jours: number, aujourdhui: string): string {
  const d = new Date(`${aujourdhui}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - jours);
  return d.toISOString().slice(0, 10);
}

/* -- La liste ------------------------------------------------------------------ */

async function listeCamionsTiersBrut(): Promise<LigneCamionTiers[]> {
  const client = await clientServeur();
  const aujourdhui = jourCourant();
  const depuis30 = ilYA(30, aujourdhui);
  const depuis120 = ilYA(120, aujourdhui);
  const [camions, releves, pleins, incidents] = await Promise.all([
    client.from("camion_tiers").select(COLONNES_CAMION).order("immatriculation").limit(2000).returns<LigneCamionBase[]>(),
    client
      .from("releve_transport")
      .select("camion_tiers_immatriculation, date, tonnage, chauffeur, destination")
      .not("camion_tiers_immatriculation", "is", null)
      .gte("date", depuis120)
      .order("date", { ascending: false })
      .limit(10000)
      .returns<{ camion_tiers_immatriculation: string; date: string; tonnage: number | string; chauffeur: string | null; destination: string | null }[]>(),
    client
      .from("plein")
      .select("camion_tiers_immatriculation, date, litres, montant")
      .not("camion_tiers_immatriculation", "is", null)
      .gte("date", depuis30)
      .limit(5000)
      .returns<{ camion_tiers_immatriculation: string; date: string; litres: number | string; montant: number }[]>(),
    client
      .from("incident")
      .select("camion_tiers_immatriculation, statut")
      .not("camion_tiers_immatriculation", "is", null)
      .neq("statut", "clos")
      .limit(2000)
      .returns<{ camion_tiers_immatriculation: string; statut: string }[]>(),
  ]);
  const parPlaque = <T extends { camion_tiers_immatriculation: string }>(liste: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of liste) m.set(x.camion_tiers_immatriculation, [...(m.get(x.camion_tiers_immatriculation) ?? []), x]);
    return m;
  };
  const relevesPar = parPlaque(lignesLues("Relevé des camions tiers", releves));
  const pleinsPar = parPlaque(lignesLues("Pleins des camions tiers", pleins));
  const incidentsPar = parPlaque(lignesLues("Incidents des camions tiers", incidents));
  return lignesLues("Camions des transporteurs", camions).map((l) => {
    const c = camionDepuisLigne(l);
    const rel = relevesPar.get(l.immatriculation) ?? [];
    const recents = rel.filter((r) => r.date >= depuis30);
    const pl = pleinsPar.get(l.immatriculation) ?? [];
    return {
      ...c,
      chauffeurReleve: rel.find((r) => r.chauffeur?.trim())?.chauffeur?.trim() ?? null,
      dernierVoyage: rel[0]?.date ?? null,
      derniereDestination: rel[0]?.destination ?? null,
      voyages30j: recents.length,
      tonnes30j: Math.round(recents.reduce((s, r) => s + Number(r.tonnage), 0) * 10) / 10,
      litres30j: Math.round(pl.reduce((s, p) => s + Number(p.litres), 0) * 10) / 10,
      carburant30j: pl.reduce((s, p) => s + Number(p.montant), 0),
      incidentsOuverts: (incidentsPar.get(l.immatriculation) ?? []).length,
    };
  });
}

export const listeCamionsTiers = cache(listeCamionsTiersBrut);

/* -- La fiche ------------------------------------------------------------------ */

export interface VoyageCamion {
  numero: string;
  date: string;
  origine: string | null;
  destination: string;
  produit: string | null;
  tonnage: number;
  tonnagePese: number | null;
  bonLivraison: string | null;
  chauffeur: string | null;
}

export interface LivraisonCamion {
  numero: string;
  date: string;
  site: string | null;
  client: string | null;
  poidsKg: number | null;
}

export interface PleinCamion {
  numero: string;
  date: string;
  litres: number;
  prixLitre: number;
  montant: number;
  source: string;
  reference: string | null;
  photo: string | null;
}

export interface IncidentCamion {
  numero: string;
  dateHeure: string;
  nature: string;
  type: string;
  lieu: string | null;
  statut: string;
  responsabilite: string | null;
  description: string | null;
}

export interface DocumentCamion {
  numero: string;
  type: string;
  libelle: string;
  dateEffet: string | null;
  echeance: string | null;
  emetteur: string | null;
  numeroPiece: string | null;
  fichier: string | null;
}

export interface MiseADispositionCamion {
  numero: string;
  mois: string;
  joursCalendaires: number;
  joursPanne: number | null;
  joursRoules: number | null;
  prixJour: number;
  carburantLitres: number | null;
  carburantMontant: number | null;
  tonnes: number | null;
  statut: string;
}

export interface TraceCamion {
  date: string;
  champ: string;
  avant: string | null;
  apres: string | null;
  motif: string | null;
}

export interface FicheCamionTiers {
  camion: CamionTiers;
  voyages: VoyageCamion[];
  livraisons: LivraisonCamion[];
  pleins: PleinCamion[];
  incidents: IncidentCamion[];
  documents: DocumentCamion[];
  misesADisposition: MiseADispositionCamion[];
  journal: TraceCamion[];
  aujourdhui: string;
}

const n = (x: number | string | null | undefined): number | null => (x === null || x === undefined || x === "" ? null : Number(x));

async function ficheCamionTiersBrut(plaque: string): Promise<FicheCamionTiers | null> {
  const client = await clientServeur();
  const camion = await client.from("camion_tiers").select(COLONNES_CAMION).eq("immatriculation", plaque).maybeSingle<LigneCamionBase>();
  if (camion.error) throw new Error(`Camion ${plaque} : ${camion.error.message}`);
  if (!camion.data) return null;
  const [voyages, livraisons, pleins, incidents, documents, mads, journal] = await Promise.all([
    client.from("releve_transport").select("numero, date, origine, destination, produit, tonnage, tonnage_pese, bon_livraison, chauffeur").eq("camion_tiers_immatriculation", plaque).order("date", { ascending: false }).limit(2000),
    client.from("livraison").select("numero, date, site, client, poids_kg").eq("camion_tiers_immatriculation", plaque).order("date", { ascending: false }).limit(2000),
    client.from("plein").select("numero, date, litres, prix_litre, montant, source, reference, photo").eq("camion_tiers_immatriculation", plaque).order("date", { ascending: false }).limit(2000),
    client.from("incident").select("numero, date_heure, nature, type, lieu, statut, responsabilite, description").eq("camion_tiers_immatriculation", plaque).order("date_heure", { ascending: false }).limit(500),
    client.from("document").select("numero, type_document_id, date_effet, echeance, emetteur, numero_piece, fichier, type_document (libelle)").eq("camion_tiers_immatriculation", plaque).order("echeance", { ascending: false }).limit(500),
    client.from("mise_a_disposition").select("numero, mois, jours_calendaires, jours_panne, jours_roules, prix_jour, carburant_litres, carburant_montant, tonnes_transportees, statut").eq("immatriculation", plaque).order("mois", { ascending: false }).limit(200),
    client.from("modification").select("cree_le, libelle_champ, avant, apres, motif").eq("table_cible", "camion_tiers").eq("numero", plaque).order("cree_le", { ascending: false }).limit(200),
  ]);
  type R = Record<string, unknown>;
  const lire = (quoi: string, r: { data: unknown; error: { message: string } | null }) => lignesLues(quoi, r as { data: R[] | null; error: { message: string } | null });
  return {
    camion: camionDepuisLigne(camion.data),
    voyages: lire("Relevé du camion", voyages).map((v) => ({
      numero: String(v.numero),
      date: String(v.date),
      origine: (v.origine as string | null) ?? null,
      destination: String(v.destination ?? "—"),
      produit: (v.produit as string | null) ?? null,
      tonnage: Number(v.tonnage),
      tonnagePese: n(v.tonnage_pese as number | null),
      bonLivraison: (v.bon_livraison as string | null) ?? null,
      chauffeur: (v.chauffeur as string | null) ?? null,
    })),
    livraisons: lire("Livraisons du camion", livraisons).map((v) => ({ numero: String(v.numero), date: String(v.date), site: (v.site as string | null) ?? null, client: (v.client as string | null) ?? null, poidsKg: n(v.poids_kg as number | null) })),
    pleins: lire("Pleins du camion", pleins).map((v) => ({
      numero: String(v.numero),
      date: String(v.date),
      litres: Number(v.litres),
      prixLitre: Number(v.prix_litre),
      montant: Number(v.montant),
      source: String(v.source ?? ""),
      reference: (v.reference as string | null) ?? null,
      photo: (v.photo as string | null) ?? null,
    })),
    incidents: lire("Incidents du camion", incidents).map((v) => ({
      numero: String(v.numero),
      dateHeure: String(v.date_heure),
      nature: String(v.nature),
      type: String(v.type),
      lieu: (v.lieu as string | null) ?? null,
      statut: String(v.statut),
      responsabilite: (v.responsabilite as string | null) ?? null,
      description: (v.description as string | null) ?? null,
    })),
    documents: lire("Documents du camion", documents).map((v) => ({
      numero: String(v.numero),
      type: String(v.type_document_id),
      libelle: (v.type_document as { libelle: string } | null)?.libelle ?? String(v.type_document_id),
      dateEffet: (v.date_effet as string | null) ?? null,
      echeance: (v.echeance as string | null) ?? null,
      emetteur: (v.emetteur as string | null) ?? null,
      numeroPiece: (v.numero_piece as string | null) ?? null,
      fichier: (v.fichier as string | null) ?? null,
    })),
    misesADisposition: lire("Mises à disposition du camion", mads).map((v) => ({
      numero: String(v.numero),
      mois: String(v.mois),
      joursCalendaires: Number(v.jours_calendaires),
      joursPanne: n(v.jours_panne as number | null),
      joursRoules: n(v.jours_roules as number | null),
      prixJour: Number(v.prix_jour),
      carburantLitres: n(v.carburant_litres as number | null),
      carburantMontant: n(v.carburant_montant as number | null),
      tonnes: n(v.tonnes_transportees as number | null),
      statut: String(v.statut ?? ""),
    })),
    journal: lire("Journal du camion", journal).map((v) => ({ date: String(v.cree_le), champ: String(v.libelle_champ ?? ""), avant: (v.avant as string | null) ?? null, apres: (v.apres as string | null) ?? null, motif: (v.motif as string | null) ?? null })),
    aujourdhui: jourCourant(),
  };
}

export const ficheCamionTiers = cache(ficheCamionTiersBrut);

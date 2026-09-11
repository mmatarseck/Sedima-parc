/* ============================================================================
 * Le module Transporteurs, lu avec la session de l'utilisateur.
 *
 * Base branchée : `lire_transporteurs(depuis)` (0025) rend en une requête les
 * faits bruts du module — prestataires transporteurs et profils, flotte
 * tierce, grilles, rattachements, affrètements, mises à disposition,
 * prestations, relevé de transport des tiers, jours relevés — et ce module
 * les met à la forme du domaine. La liste et la fiche s'assemblent ensuite
 * avec les mêmes règles qu'en démonstration (`assembler-transporteurs.ts`).
 * Sans la fonction, la liste porte les transporteurs du référentiel, sans
 * activité : le module se lit, il ne compte rien.
 *
 * Les plaques : la base tient la forme canonique (« AA312CT »), les écrans
 * la forme lisible (« AA-312-CT ») ; on reconstruit l'affichage à la lecture,
 * comme pour le parc.
 * ==========================================================================*/

import { cache } from "react";
import type { SourceTransporteurs } from "@/domaine/assembler-transporteurs";
import type { CamionTiers, ChauffeurTiers, ModeRemuneration, ProfilTransporteur, RattachementLocalite } from "@/domaine/flotte-tierce";
import { destinationTarifaire } from "@/domaine/flotte-tierce";
import { afficher } from "@/domaine/immatriculation";
import type { Prestataire } from "@/domaine/prestataires";
import type { LigneReleve, ModeExecution, ProduitTransporte } from "@/domaine/releve-transport";
import { semaineDe } from "@/domaine/releve-transport";
import type { Affretement, ConventionFacturation, FamilleMad, LigneTarif, MiseADisposition, MotifAffretement, Prestation, SourceTarif, StatutAffretement, UnitePrestation, UniteTarif } from "@/domaine/transporteurs";
import type { BusinessUnit, CategorieVehicule } from "@/domaine/types";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { sourceDemonstration } from "./fiche-transporteur-demo";
import { prestataireDepuisLigne, prestataires, type LignePrestataire } from "./referentiels";

/* -- Ce que la fonction rend ------------------------------------------------------ */

export interface TransporteursJson {
  transporteurs: (LignePrestataire & {
    id: string;
    profil: {
      forme: ProfilTransporteur["forme"];
      sous_contrat: boolean;
      reference_contrat: string | null;
      debut_contrat: string | null;
      fin_contrat: string | null;
      modes: ModeRemuneration[];
      camions_engages: number | null;
      commentaire: string | null;
      /** Absent d'une base restée en deçà de 0039. */
      regime_fiscal?: ProfilTransporteur["regimeFiscal"];
    } | null;
  })[];
  chauffeurs_tiers: { id: string; prestataire_id: string; nom: string; telephone: string | null; actif: boolean }[];
  camions_tiers: { immatriculation: string; prestataire_id: string; categorie: CategorieVehicule; capacite_tonnes: number | string | null; chauffeur_habituel_id: string | null; actif: boolean; commentaire: string | null }[];
  lignes_tarif: { numero: string; prestataire_id: string; origine: string; destination: string; categorie: CategorieVehicule | null; unite: UniteTarif; prix: number; minimum: number | null; debut: string; fin: string | null; source: SourceTarif; commentaire: string | null }[];
  tarifs_journaliers: { numero: string; prestataire_id: string; famille: FamilleMad; prix_jour: number; debut: string; fin: string | null; source: SourceTarif; convention: ConventionFacturation; commentaire: string | null }[];
  rattachements: { localite: string; destination: string; origine: "convenu" | "usage"; motif: string | null; date: string | null }[];
  affretements: {
    numero: string;
    date: string;
    prestataire_id: string;
    origine: string;
    destination: string;
    business_unit: BusinessUnit | null;
    categorie_demandee: CategorieVehicule;
    immatriculation_externe: string | null;
    chauffeur_externe: string | null;
    tonnage_prevu: number | string;
    tonnage_livre: number | string | null;
    distance_km: number;
    motif: MotifAffretement | null;
    vehicule_remplace: string | null;
    statut: StatutAffretement;
    montant_convenu: number | string;
    montant_facture: number | string | null;
    prix_exceptionnel: number | null;
    complement_tarif: number | null;
    motif_tarif: string | null;
    date_livraison: string | null;
    date_facture: string | null;
    date_reglement: string | null;
    reference_facture: string | null;
    numero_demande_x3: string | null;
    numero_bon_commande: string | null;
    demandeur: string;
    commentaire: string | null;
  }[];
  mises_a_disposition: {
    numero: string;
    mois: string;
    prestataire_id: string;
    immatriculation: string;
    famille: FamilleMad;
    jours_calendaires: number;
    jours_panne: number;
    jours_roules: number | null;
    prix_jour: number;
    convention: ConventionFacturation;
    carburant_litres: number | string;
    carburant_montant: number | string;
    km_parcourus: number | null;
    tonnes_transportees: number | string | null;
    statut: StatutAffretement;
    montant_facture: number | string | null;
    date_facture: string | null;
    date_reglement: string | null;
    reference_facture: string | null;
    numero_demande_x3: string | null;
    commentaire: string | null;
  }[];
  prestations: {
    numero: string;
    date: string;
    prestataire_id: string;
    libelle: string;
    business_unit: BusinessUnit | null;
    unite: UnitePrestation;
    quantite: number | string;
    prix_unitaire: number;
    convention: ConventionFacturation;
    statut: StatutAffretement;
    montant_facture: number | string | null;
    date_facture: string | null;
    date_reglement: string | null;
    reference_facture: string | null;
    numero_demande_x3: string | null;
    commentaire: string | null;
  }[];
  releves_transport: {
    numero: string;
    date: string;
    mode: ModeExecution;
    prestataire_id: string | null;
    vehicule_id: string | null;
    camion_tiers_immatriculation: string | null;
    immatriculation_libre: string | null;
    chauffeur: string | null;
    origine: string;
    destination: string;
    produit: ProduitTransporte;
    tonnage: number | string;
    tonnage_pese: number | string | null;
    bon_livraison: string | null;
    affretement_numero: string | null;
  }[];
  jours_releves: string[];
}

export const TRANSPORTEURS_VIDE: TransporteursJson = {
  transporteurs: [],
  chauffeurs_tiers: [],
  camions_tiers: [],
  lignes_tarif: [],
  tarifs_journaliers: [],
  rattachements: [],
  affretements: [],
  mises_a_disposition: [],
  prestations: [],
  releves_transport: [],
  jours_releves: [],
};

/* -- La mise à la forme du domaine — pure, pour le banc d'essai ------------------- */

const nb = (v: number | string): number => Number(v);
const nbOuNul = (v: number | string | null | undefined): number | null => (v === null || v === undefined ? null : Number(v));
const plaque = (canonique: string | null): string | null => (canonique ? afficher(canonique) : null);

/** Les faits rendus par la base, à la forme que le module assemble. */
export function sourceDepuisJson(j: TransporteursJson, aujourdhui: string): SourceTransporteurs {
  const prestataires: Prestataire[] = [];
  const profils = new Map<string, ProfilTransporteur>();
  const numeroParId = new Map<string, string>();
  const nomParId = new Map<string, string>();
  for (const t of j.transporteurs) {
    prestataires.push(prestataireDepuisLigne(t));
    numeroParId.set(t.id, t.numero);
    nomParId.set(t.id, t.raison_sociale);
    if (t.profil) {
      profils.set(t.numero, {
        numero: t.numero,
        forme: t.profil.forme,
        sousContrat: t.profil.sous_contrat,
        referenceContrat: t.profil.reference_contrat,
        debutContrat: t.profil.debut_contrat,
        finContrat: t.profil.fin_contrat,
        modes: t.profil.modes,
        camionsEngages: t.profil.camions_engages,
        regimeFiscal: t.profil.regime_fiscal ?? "a-confirmer",
        commentaire: t.profil.commentaire,
      });
    }
  }
  const numero = (id: string | null): string => (id ? (numeroParId.get(id) ?? "") : "");
  const nom = (id: string | null): string => (id ? (nomParId.get(id) ?? "") : "");
  /* Le régime vit sur le profil du transporteur ; chaque mission le porte, pour que ses coûts se lisent hors taxe ou TTC. */
  const regimeDe = (id: string | null): ProfilTransporteur["regimeFiscal"] => profils.get(numero(id))?.regimeFiscal ?? "a-confirmer";

  const chauffeurs: ChauffeurTiers[] = j.chauffeurs_tiers.map((c) => ({ id: c.id, nom: c.nom, telephone: c.telephone, transporteurNumero: numero(c.prestataire_id), actif: c.actif }));
  const camions: CamionTiers[] = j.camions_tiers.map((c) => ({
    immatriculation: c.immatriculation,
    immatriculationAffichee: afficher(c.immatriculation),
    transporteurNumero: numero(c.prestataire_id),
    categorie: c.categorie,
    capaciteTonnes: nbOuNul(c.capacite_tonnes),
    chauffeurHabituelId: c.chauffeur_habituel_id,
    actif: c.actif,
    commentaire: c.commentaire,
  }));
  const grilles: LigneTarif[] = j.lignes_tarif.map((l) => ({
    numero: l.numero,
    transporteurNumero: numero(l.prestataire_id),
    transporteur: nom(l.prestataire_id),
    origine: l.origine,
    destination: l.destination,
    categorie: l.categorie,
    unite: l.unite,
    prix: nb(l.prix),
    minimum: nbOuNul(l.minimum),
    debut: l.debut,
    fin: l.fin,
    source: l.source,
    commentaire: l.commentaire,
  }));
  const rattachements: RattachementLocalite[] = j.rattachements.map((r) => ({ localite: r.localite, destination: r.destination, origine: r.origine, motif: r.motif, auteur: null, date: r.date }));

  const affretements: Affretement[] = j.affretements.map((a) => ({
    numero: a.numero,
    date: a.date,
    transporteurNumero: numero(a.prestataire_id),
    transporteur: nom(a.prestataire_id),
    origine: a.origine,
    destination: a.destination,
    businessUnit: a.business_unit,
    categorieDemandee: a.categorie_demandee,
    immatriculationExterne: plaque(a.immatriculation_externe),
    chauffeurExterne: a.chauffeur_externe,
    tonnagePrevu: nb(a.tonnage_prevu),
    tonnageLivre: nbOuNul(a.tonnage_livre),
    distanceKm: nb(a.distance_km),
    motif: a.motif,
    vehiculeRemplaceId: a.vehicule_remplace,
    statut: a.statut,
    montantConvenu: nb(a.montant_convenu),
    montantFacture: nbOuNul(a.montant_facture),
    prixExceptionnel: nbOuNul(a.prix_exceptionnel),
    complementTarif: nbOuNul(a.complement_tarif),
    motifTarif: a.motif_tarif,
    dateLivraison: a.date_livraison,
    dateFacture: a.date_facture,
    dateReglement: a.date_reglement,
    referenceFacture: a.reference_facture,
    numeroDemandeX3: a.numero_demande_x3,
    numeroBonCommande: a.numero_bon_commande,
    demandeur: a.demandeur,
    commentaire: a.commentaire,
    creee: false,
    regime: regimeDe(a.prestataire_id),
  }));
  const misesADisposition: MiseADisposition[] = j.mises_a_disposition.map((m) => ({
    numero: m.numero,
    mois: m.mois,
    transporteurNumero: numero(m.prestataire_id),
    transporteur: nom(m.prestataire_id),
    immatriculation: afficher(m.immatriculation),
    famille: m.famille,
    joursCalendaires: nb(m.jours_calendaires),
    joursPanne: nb(m.jours_panne),
    joursRoules: nbOuNul(m.jours_roules),
    prixJour: nb(m.prix_jour),
    convention: m.convention,
    carburantLitres: nb(m.carburant_litres),
    carburantMontant: nb(m.carburant_montant),
    kmParcourus: nbOuNul(m.km_parcourus),
    tonnesTransportees: nbOuNul(m.tonnes_transportees),
    statut: m.statut,
    montantFacture: nbOuNul(m.montant_facture),
    dateFacture: m.date_facture,
    dateReglement: m.date_reglement,
    referenceFacture: m.reference_facture,
    numeroDemandeX3: m.numero_demande_x3,
    commentaire: m.commentaire,
    regime: regimeDe(m.prestataire_id),
  }));
  const prestations: Prestation[] = j.prestations.map((p) => ({
    numero: p.numero,
    date: p.date,
    transporteurNumero: numero(p.prestataire_id),
    transporteur: nom(p.prestataire_id),
    libelle: p.libelle,
    businessUnit: p.business_unit,
    unite: p.unite,
    quantite: nb(p.quantite),
    prixUnitaire: nb(p.prix_unitaire),
    convention: p.convention,
    statut: p.statut,
    montantFacture: nbOuNul(p.montant_facture),
    dateFacture: p.date_facture,
    dateReglement: p.date_reglement,
    referenceFacture: p.reference_facture,
    numeroDemandeX3: p.numero_demande_x3,
    commentaire: p.commentaire,
    regime: regimeDe(p.prestataire_id),
  }));
  const livraisons: LigneReleve[] = j.releves_transport.map((t) => {
    const libre = t.mode === "enlevement-client" || t.mode === "prestataire-ponctuel";
    return {
      numero: t.numero,
      date: t.date,
      semaine: semaineDe(t.date),
      mode: t.mode,
      transporteurNumero: t.prestataire_id ? numero(t.prestataire_id) : null,
      transporteur: t.prestataire_id ? nom(t.prestataire_id) : null,
      vehiculeId: t.vehicule_id,
      camionTiersImmatriculation: plaque(t.camion_tiers_immatriculation),
      immatriculationLibre: t.immatriculation_libre,
      chauffeurLibre: libre ? t.chauffeur : null,
      chauffeur: t.chauffeur,
      origine: t.origine,
      destination: t.destination,
      /* La destination tarifaire est celle de la grille quand la localité y
         figure, sinon celle à laquelle elle est rattachée — comme le relevé. */
      destinationTarifaire: destinationTarifaire(t.destination, rattachements)?.destination ?? t.destination,
      produit: t.produit,
      tonnage: nb(t.tonnage),
      tonnagePese: nbOuNul(t.tonnage_pese),
      bonLivraison: t.bon_livraison,
      affretementNumero: t.affretement_numero,
    };
  });

  return {
    prestataires,
    profils,
    camions,
    chauffeurs,
    grilles,
    rattachements,
    affretements,
    misesADisposition,
    prestations,
    livraisons,
    semainesPeriode: new Set(j.jours_releves.map((d) => semaineDe(d))).size,
    aujourdhui,
  };
}

/* -- Ce que les pages appellent --------------------------------------------------- */

/** Cinquante-deux semaines : la période du relevé, celle sur laquelle un coût à la tonne se lit. */
export function depuisPour(aujourdhui: string): string {
  const d = new Date(`${aujourdhui}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 364);
  return d.toISOString().slice(0, 10);
}

async function transporteursServeurBrut(): Promise<SourceTransporteurs> {
  if (!authentificationReelle()) return sourceDemonstration();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const client = await clientServeur();
  const lecture = await client.rpc("lire_transporteurs", { depuis: depuisPour(aujourdhui) }).maybeSingle<TransporteursJson | null>();
  if (lecture.error || !lecture.data) {
    /* Fonction pas encore jouée : les transporteurs du référentiel, sans activité. */
    if (lecture.error) console.warn(`Transporteurs : lire_transporteurs() indisponible (${lecture.error.message}).`);
    const tous = await prestataires().catch((e: unknown) => {
      console.warn(`Transporteurs : référentiel illisible (${e instanceof Error ? e.message : String(e)}).`);
      return [] as Prestataire[];
    });
    return { ...sourceDepuisJson(TRANSPORTEURS_VIDE, aujourdhui), prestataires: tous.filter((p) => p.type === "transporteur") };
  }
  return sourceDepuisJson(lecture.data, aujourdhui);
}

export const transporteursServeur = cache(transporteursServeurBrut);

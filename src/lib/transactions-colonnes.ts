/* ============================================================================
 * Ce qu'une transaction saisie dans l'application devient en base : la table,
 * et les colonnes que ses valeurs remplissent.
 *
 * Vingt types ont leur table — relevé, plein, dépense, document, incident,
 * affectation, intervention, indisponibilité, sanction (0001), l'ordre de
 * travail (0016), le mouvement de caisse et celui de la cuve (0017), la
 * demande d'achat (0022), la visite technique et son observation (0023), et
 * le transport confié à des tiers (0002) : la ligne de relevé de transport,
 * la ligne de grille, l'affrètement, la mise à disposition, la prestation —
 * et le statut d'un véhicule s'écrit sur sa ligne avec sa trace. Ce qui n'a
 * pas de table reste dans le navigateur, et `tableDe` le dit.
 *
 * Ce module est pur — pas de base, pas de navigateur — pour se vérifier seul
 * et servir la fonction serveur comme les tests.
 * ==========================================================================*/

import type { TypeTransaction } from "@/domaine/reference";
import { PRODUIT_TRANSPORTE, type ProduitTransporte } from "@/domaine/releve-transport";

export type TableBranchee =
  | "releve_kilometrique"
  | "plein"
  | "depense"
  | "document"
  | "incident"
  | "affectation"
  | "intervention"
  | "indisponibilite"
  | "sanction"
  | "ordre_travail"
  | "mouvement_caisse"
  | "mouvement_cuve"
  | "demande_achat"
  | "visite_technique"
  | "observation_visite"
  | "releve_transport"
  | "ligne_tarif"
  | "affretement"
  | "mise_a_disposition"
  | "prestation"
  | "avance_prestataire"
  | "evaluation_prestataire";

const TABLES: Partial<Record<TypeTransaction, TableBranchee>> = {
  releve: "releve_kilometrique",
  plein: "plein",
  depense: "depense",
  document: "document",
  incident: "incident",
  affectation: "affectation",
  intervention: "intervention",
  indisponibilite: "indisponibilite",
  sanction: "sanction",
  ordre: "ordre_travail",
  caisse: "mouvement_caisse",
  cuve: "mouvement_cuve",
  achat: "demande_achat",
  visite: "visite_technique",
  observation: "observation_visite",
  transport: "releve_transport",
  tarif: "ligne_tarif",
  affretement: "affretement",
  "mise-a-disposition": "mise_a_disposition",
  prestation: "prestation",
  avance: "avance_prestataire",
  evaluation: "evaluation_prestataire",
};

/** La table d'un type ; nulle tant qu'il n'en a pas. Le statut est à part : il s'écrit sur le véhicule. */
export function tableDe(type: TypeTransaction): TableBranchee | null {
  return TABLES[type] ?? null;
}

/** Les identifiants résolus par le serveur avant l'écriture. */
export interface Rattachement {
  vehiculeId: string | null;
  chauffeurId: string | null;
  prestataireId: string | null;
  /** Le camion du référentiel tiers, par sa plaque canonique — nul quand la plaque n'y est pas : elle reste alors libre. */
  camionTiers?: string | null;
  /** L'affrètement que cite une ligne de relevé, résolu par son numéro. */
  affretementId?: string | null;
}

/**
 * Le produit transporté, tel que la base le nomme. L'écran laisse le champ
 * libre et pré-remplit « Aliment volaille » : on reconnaît le libellé comme la
 * clé, sans accent ni casse, et l'aliment reste le produit par défaut — c'est
 * lui que le parc porte neuf fois sur dix.
 */
export function produitDepuis(brut: unknown): ProduitTransporte {
  const t = texte(brut);
  if (!t) return "aliment";
  const simple = (x: string) =>
    x
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const cherche = simple(t);
  for (const [cle, d] of Object.entries(PRODUIT_TRANSPORTE)) {
    if (simple(cle) === cherche || simple(d.libelle) === cherche) return cle as ProduitTransporte;
  }
  return "aliment";
}

const texte = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const nombre = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const booleen = (v: unknown): boolean => v === true || v === "oui" || v === "true";

/** « 2026-09-02T08:00 » ou « 2026-09-02 » → un horodatage complet, en UTC comme tout le jeu de données. */
export function horodatage(brut: unknown): string | null {
  const t = texte(brut);
  if (!t) return null;
  if (t.length <= 10) return `${t}T08:00:00.000Z`;
  if (/Z$|[+-]\d\d:\d\d$/.test(t)) return t;
  return `${t.length === 16 ? `${t}:00` : t}.000Z`;
}

/**
 * La ligne à insérer pour une création. Nulle quand une valeur obligatoire
 * manque — le motif dit laquelle, pour que l'écran puisse le montrer.
 */
export function ligneCreation(type: TypeTransaction, numero: string, valeurs: Record<string, unknown>, r: Rattachement): { ligne: Record<string, unknown> } | { refus: string } {
  const v = valeurs;
  switch (type) {
    case "releve": {
      const km = nombre(v.valeur);
      if (!r.vehiculeId) return { refus: "relevé sans véhicule" };
      if (km === null) return { refus: "relevé sans compteur" };
      return { ligne: { numero, vehicule_id: r.vehiculeId, date: texte(v.date), km: Math.round(km), origine: "saisie" } };
    }
    case "plein": {
      const litres = nombre(v.litres);
      const montant = nombre(v.montant);
      if (!r.vehiculeId) return { refus: "plein sans véhicule" };
      if (!litres || litres <= 0 || montant === null) return { refus: "plein sans litres ou sans montant" };
      const prixLitre = nombre(v.prixLitre) ?? Math.round(montant / litres);
      return { ligne: { numero, vehicule_id: r.vehiculeId, chauffeur_id: r.chauffeurId, prestataire_id: r.prestataireId, date: texte(v.date), litres, prix_litre: Math.max(1, Math.round(prixLitre)), montant: Math.round(montant), km: nombre(v.km), plein_complet: true, source: texte(v.source) ?? "station", reference: texte(v.reference), photo: texte(v.photo) } };
    }
    case "depense": {
      const montant = nombre(v.montant);
      const libelle = texte(v.libelle);
      if (montant === null || !libelle) return { refus: "dépense sans montant ou sans libellé" };
      if (!r.vehiculeId && !texte(v.beneficiaire)) return { refus: "dépense sans véhicule ni bénéficiaire" };
      return { ligne: { numero, vehicule_id: r.vehiculeId, chauffeur_id: r.chauffeurId, prestataire_id: r.prestataireId, date: texte(v.date), poste: texte(v.poste) ?? "divers", libelle, montant: Math.round(montant), beneficiaire: texte(v.beneficiaire), reference: texte(v.reference), origine: texte(v.origine) ?? "caisse", justificatif: booleen(v.justificatif) || Boolean(texte(v.photo)), km: nombre(v.km), photo: texte(v.photo) } };
    }
    case "document": {
      const typeDoc = texte(v.type);
      if (!typeDoc) return { refus: "document sans type" };
      if (!r.vehiculeId && !r.chauffeurId) return { refus: "document sans porteur" };
      return { ligne: { numero, type_document_id: typeDoc, vehicule_id: r.vehiculeId, chauffeur_id: r.vehiculeId ? null : r.chauffeurId, date_effet: texte(v.dateEffet), echeance: texte(v.echeance), emetteur: texte(v.emetteur), numero_piece: texte(v.numeroPiece), montant: nombre(v.montant), justificatif: booleen(v.justificatif) } };
    }
    case "incident": {
      const dateHeure = horodatage(v.dateHeure);
      if (!r.vehiculeId) return { refus: "incident sans véhicule" };
      if (!dateHeure) return { refus: "incident sans date" };
      const roulant = texte(v.roulant);
      const description = [texte(v.description), roulant === "non" ? "Véhicule non roulant." : roulant === "reserve" ? "Véhicule roulant avec réserve." : null].filter(Boolean).join(" ") || null;
      return { ligne: { numero, vehicule_id: r.vehiculeId, chauffeur_id: r.chauffeurId, date_heure: dateHeure, nature: texte(v.nature) ?? "incident", type: texte(v.type) ?? "autre", lieu: texte(v.lieu), mission: texte(v.mission), responsabilite: texte(v.responsabilite), statut: texte(v.statut) ?? "declare", kilometrage: nombre(v.kilometrage), description } };
    }
    case "affectation": {
      if (!r.vehiculeId || !r.chauffeurId) return { refus: "affectation sans véhicule ou sans chauffeur" };
      return { ligne: { numero, vehicule_id: r.vehiculeId, chauffeur_id: r.chauffeurId, role: texte(v.role) ?? "titulaire", debut: texte(v.debut), fin: texte(v.fin), motif: texte(v.motif) ?? "Saisie dans l'application" } };
    }
    case "intervention": {
      if (!r.vehiculeId) return { refus: "intervention sans véhicule" };
      if (!texte(v.objet)) return { refus: "intervention sans objet" };
      return { ligne: { numero, vehicule_id: r.vehiculeId, prestataire_id: r.prestataireId, date: texte(v.date), type: texte(v.type) ?? "curatif", objet: texte(v.objet), montant: Math.round(nombre(v.montant) ?? 0), immobilisation_jours: Math.round(nombre(v.immobilisationJours) ?? 0), km: nombre(v.km), reference: texte(v.reference) } };
    }
    case "indisponibilite": {
      if (!r.chauffeurId) return { refus: "indisponibilité sans chauffeur" };
      return { ligne: { numero, chauffeur_id: r.chauffeurId, motif: texte(v.motif) ?? "autre", debut: texte(v.debut), fin: texte(v.fin), commentaire: texte(v.commentaire) } };
    }
    case "ordre": {
      if (!r.vehiculeId) return { refus: "ordre de travail sans véhicule" };
      if (!texte(v.objet)) return { refus: "ordre de travail sans objet" };
      return { ligne: { numero, vehicule_id: r.vehiculeId, type: texte(v.type) ?? "curatif", objet: texte(v.objet), origine_numero: texte(v.origineNumero), origine_libelle: texte(v.origineLibelle), prestataire_id: r.prestataireId, garage: texte(v.garage) ?? "—", date_prevue: texte(v.datePrevue), immobilisation_prevue_jours: nombre(v.immobilisationPrevueJours), montant_estime: nombre(v.montantEstime), statut: texte(v.statut) ?? "planifie", date_debut: texte(v.dateDebut), date_cloture: texte(v.dateCloture), intervention_numero: texte(v.interventionNumero), commentaire: texte(v.commentaire), demandeur_nom: texte(v.demandeur) } };
    }
    case "caisse": {
      /* Une sortie cite la dépense qu'elle règle ; sans dépense, c'est un approvisionnement. */
      const montant = nombre(v.montant);
      const depenseNumero = texte(v.depenseNumero);
      if (!montant || montant <= 0) return { refus: "mouvement de caisse sans montant" };
      if (!texte(v.libelle)) return { refus: "mouvement de caisse sans libellé" };
      return { ligne: { numero, date: texte(v.date), sens: depenseNumero ? "sortie" : (texte(v.sens) ?? "entree"), libelle: texte(v.libelle), montant: Math.round(montant), beneficiaire: texte(v.beneficiaire), piece: texte(v.piece), justificatif: booleen(v.justificatif), depense_numero: depenseNumero, enregistre_par: texte(v.enregistrePar) } };
    }
    case "cuve": {
      /* Une livraison porte un libellé ; un relevé de jauge n'en a pas, il dit ce que la cuve contient. */
      const litres = nombre(v.litres);
      const prixLitre = nombre(v.prixLitre);
      if (litres === null || litres < 0) return { refus: "mouvement de cuve sans litres" };
      const livraison = Boolean(texte(v.libelle));
      const montant = nombre(v.montant) ?? (prixLitre !== null ? Math.round(litres * prixLitre) : null);
      return { ligne: { numero, date: texte(v.date), sens: livraison ? "livraison" : "jauge", libelle: texte(v.libelle) ?? "Relevé de jauge", litres: Math.round(litres * 10) / 10, prix_litre: livraison && prixLitre !== null ? Math.round(prixLitre) : null, montant: livraison && montant !== null ? Math.round(montant) : null, fournisseur: livraison ? texte(v.fournisseur) : null, prestataire_id: livraison ? r.prestataireId : null, piece: texte(v.piece), commentaire: texte(v.commentaire), enregistre_par: texte(v.enregistrePar) } };
    }
    case "achat": {
      /* Une demande cite toujours ce qui la motive : c'est la règle du métier, pas une convention. */
      const montantEstime = nombre(v.montantEstime);
      if (!texte(v.objet)) return { refus: "demande d'achat sans objet" };
      if (montantEstime === null || montantEstime < 0) return { refus: "demande d'achat sans montant estimé" };
      if (!texte(v.origineNumero)) return { refus: "demande d'achat sans transaction d'origine" };
      return { ligne: { numero, date: texte(v.date), objet: texte(v.objet), poste: texte(v.poste) ?? "divers", montant_estime: Math.round(montantEstime), prestataire_id: r.prestataireId, fournisseur: texte(v.fournisseur), urgence: texte(v.urgence) ?? "normale", origine_numero: texte(v.origineNumero), origine_libelle: texte(v.origineLibelle), vehicule_id: r.vehiculeId, demandeur_nom: texte(v.demandeur), demandeur_role: texte(v.demandeurRole), etape: texte(v.etape) ?? "soumise", commentaire_decision: texte(v.commentaireDecision) } };
    }
    case "visite": {
      if (!r.vehiculeId) return { refus: "visite technique sans véhicule" };
      if (!texte(v.centre)) return { refus: "visite technique sans centre" };
      const rendezVous = texte(v.dateRendezVous) ?? texte(v.date);
      if (!rendezVous) return { refus: "visite technique sans date de rendez-vous" };
      return { ligne: { numero, vehicule_id: r.vehiculeId, type: texte(v.type) ?? "visite", centre: texte(v.centre), date_rendez_vous: rendezVous, heure: texte(v.heure), date_passage: texte(v.datePassage), statut: texte(v.statut) ?? "rendez-vous", numero_pv: texte(v.numeroPv), date_limite_contre_visite: texte(v.dateLimiteContreVisite), commentaire: texte(v.commentaire) } };
    }
    case "observation": {
      /* L'observation cite la visite qui l'a produite, par son numéro. */
      if (!r.vehiculeId) return { refus: "observation sans véhicule" };
      if (!texte(v.visiteId)) return { refus: "observation sans visite technique" };
      if (!texte(v.libelle)) return { refus: "observation sans libellé" };
      return { ligne: { numero, visite_numero: texte(v.visiteId), vehicule_id: r.vehiculeId, libelle: texte(v.libelle), categorie: texte(v.categorie) ?? "autre", gravite: texte(v.gravite) ?? "mineure", statut: texte(v.statut) ?? "a-traiter", intervention_numero: texte(v.interventionNumero), corrigee_le: texte(v.corrigeeLe), commentaire: texte(v.commentaire) } };
    }
    case "transport": {
      /* Une ligne du relevé : un chargement parti un jour donné. Le mode dit
         qui a transporté — le transporteur du référentiel quand la fiche le
         porte, le parc quand un véhicule est cité, un ponctuel sinon. */
      const tonnage = nombre(v.tonnage);
      const date = texte(v.date);
      if (!date) return { refus: "livraison sans date" };
      if (!texte(v.destination)) return { refus: "livraison sans destination" };
      if (tonnage === null || tonnage < 0) return { refus: "livraison sans tonnage" };
      const camionTiers = r.camionTiers ?? null;
      const mode = texte(v.mode) ?? (r.prestataireId ? "transporteur" : r.vehiculeId ? "parc" : "prestataire-ponctuel");
      if (mode === "transporteur" && !r.prestataireId) return { refus: "livraison sans transporteur" };
      if (mode === "parc" && !r.vehiculeId) return { refus: "livraison du parc sans véhicule" };
      const plaqueLibre = texte(v.immatriculationLibre) ?? texte(v.camion) ?? texte(v.immatriculation);
      return {
        ligne: {
          numero,
          date,
          mode,
          prestataire_id: r.prestataireId,
          vehicule_id: mode === "parc" ? r.vehiculeId : null,
          camion_tiers_immatriculation: camionTiers,
          immatriculation_libre: camionTiers ? null : plaqueLibre,
          chauffeur: texte(v.chauffeur) ?? texte(v.chauffeurLibre),
          origine: texte(v.origine) ?? "UAB",
          destination: texte(v.destination),
          produit: produitDepuis(v.produit),
          tonnage: Math.round(tonnage * 100) / 100,
          tonnage_pese: nombre(v.tonnagePese) === null ? null : Math.round(nombre(v.tonnagePese)! * 100) / 100,
          bon_livraison: texte(v.bonLivraison),
          affretement_id: r.affretementId ?? null,
        },
      };
    }
    case "tarif": {
      /* Une ligne de grille — le plus souvent une exception promue en règle.
         Le prix est net ; il vaut pour toute catégorie de porteur. */
      const prix = nombre(v.prix);
      if (!r.prestataireId) return { refus: "ligne de tarif sans transporteur" };
      if (!texte(v.origine) || !texte(v.destination)) return { refus: "ligne de tarif sans trajet" };
      if (prix === null || prix < 0) return { refus: "ligne de tarif sans prix" };
      const minimum = nombre(v.minimum);
      return {
        ligne: {
          numero,
          prestataire_id: r.prestataireId,
          origine: texte(v.origine),
          destination: texte(v.destination),
          categorie: texte(v.categorie),
          unite: texte(v.unite) ?? "tonne",
          prix: Math.round(prix),
          minimum: minimum === null ? null : Math.round(minimum),
          debut: texte(v.debut) ?? texte(v.date),
          fin: texte(v.fin),
          source: texte(v.source) ?? "accord-verbal",
          commentaire: texte(v.commentaire),
        },
      };
    }
    case "affretement": {
      /* La mission confiée à un tiers. L'exception tarifaire porte son motif,
         ou elle n'existe pas : c'est la règle de la base, on la dit avant elle. */
      const tonnagePrevu = nombre(v.tonnagePrevu) ?? nombre(v.tonnage);
      if (!r.prestataireId) return { refus: "affrètement sans transporteur" };
      if (!texte(v.date)) return { refus: "affrètement sans date" };
      if (!texte(v.origine) || !texte(v.destination)) return { refus: "affrètement sans trajet" };
      if (tonnagePrevu === null || tonnagePrevu < 0) return { refus: "affrètement sans tonnage prévu" };
      if (!texte(v.motif)) return { refus: "affrètement sans motif" };
      if (!texte(v.demandeur)) return { refus: "affrètement sans demandeur" };
      const prixExceptionnel = nombre(v.prixExceptionnel);
      const complement = nombre(v.complementTarif);
      if ((prixExceptionnel !== null || complement !== null) && !texte(v.motifTarif)) return { refus: "exception tarifaire sans motif" };
      const tonnageLivre = nombre(v.tonnageLivre);
      const montantFacture = nombre(v.montantFacture);
      return {
        ligne: {
          numero,
          date: texte(v.date),
          prestataire_id: r.prestataireId,
          origine: texte(v.origine),
          destination: texte(v.destination),
          business_unit: texte(v.businessUnit),
          categorie_demandee: texte(v.categorieDemandee) ?? "camion",
          immatriculation_externe: r.camionTiers ?? null,
          chauffeur_externe: texte(v.chauffeurExterne) ?? texte(v.chauffeur),
          tonnage_prevu: Math.round(tonnagePrevu * 100) / 100,
          tonnage_livre: tonnageLivre === null ? null : Math.round(tonnageLivre * 100) / 100,
          distance_km: Math.round(nombre(v.distanceKm) ?? 0),
          motif: texte(v.motif),
          vehicule_remplace_id: r.vehiculeId,
          statut: texte(v.statut) ?? "demande",
          montant_convenu: Math.round(nombre(v.montantConvenu) ?? 0),
          montant_facture: montantFacture === null ? null : Math.round(montantFacture),
          prix_exceptionnel: prixExceptionnel === null ? null : Math.round(prixExceptionnel),
          complement_tarif: complement === null ? null : Math.round(complement),
          motif_tarif: texte(v.motifTarif),
          date_livraison: texte(v.dateLivraison),
          date_facture: texte(v.dateFacture),
          date_reglement: texte(v.dateReglement),
          reference_facture: texte(v.referenceFacture),
          numero_demande_x3: texte(v.numeroDemandeX3),
          numero_bon_commande: texte(v.numeroBonCommande),
          demandeur: texte(v.demandeur),
          commentaire: texte(v.commentaire),
        },
      };
    }
    case "mise-a-disposition": {
      /* Un mois de camion tiers. Le camion est celui du référentiel, ou ce
         n'est pas une mise à disposition : on ne loue pas une plaque inconnue. */
      const prixJour = nombre(v.prixJour);
      const joursCalendaires = nombre(v.joursCalendaires);
      const mois = texte(v.mois) ?? texte(v.date)?.slice(0, 7) ?? null;
      if (!r.prestataireId) return { refus: "mise à disposition sans transporteur" };
      if (!mois || !/^\d{4}-\d{2}$/.test(mois)) return { refus: "mise à disposition sans mois" };
      if (!r.camionTiers) return { refus: "mise à disposition sans camion du référentiel" };
      if (!texte(v.famille)) return { refus: "mise à disposition sans famille de produit" };
      if (joursCalendaires === null || joursCalendaires < 1 || joursCalendaires > 31) return { refus: "mise à disposition sans jours calendaires" };
      if (prixJour === null || prixJour < 0) return { refus: "mise à disposition sans prix journalier" };
      const roules = nombre(v.joursRoules);
      const km = nombre(v.kmParcourus);
      const tonnes = nombre(v.tonnesTransportees);
      const montantFacture = nombre(v.montantFacture);
      return {
        ligne: {
          numero,
          mois,
          prestataire_id: r.prestataireId,
          immatriculation: r.camionTiers,
          famille: texte(v.famille),
          jours_calendaires: Math.round(joursCalendaires),
          jours_panne: Math.max(0, Math.round(nombre(v.joursPanne) ?? 0)),
          jours_roules: roules === null ? null : Math.max(0, Math.round(roules)),
          prix_jour: Math.round(prixJour),
          convention: texte(v.convention) ?? "inconnue",
          carburant_litres: Math.round((nombre(v.carburantLitres) ?? 0) * 100) / 100,
          carburant_montant: Math.round(nombre(v.carburantMontant) ?? 0),
          km_parcourus: km === null ? null : Math.round(km),
          tonnes_transportees: tonnes === null ? null : Math.round(tonnes * 100) / 100,
          statut: texte(v.statut) ?? "confirme",
          montant_facture: montantFacture === null ? null : Math.round(montantFacture),
          date_facture: texte(v.dateFacture),
          date_reglement: texte(v.dateReglement),
          reference_facture: texte(v.referenceFacture),
          numero_demande_x3: texte(v.numeroDemandeX3),
          commentaire: texte(v.commentaire),
        },
      };
    }
    case "prestation": {
      /* Ce que le parc achète en transport hors grille : une quantité, un prix unitaire, une convention. */
      const quantite = nombre(v.quantite);
      const prixUnitaire = nombre(v.prixUnitaire);
      if (!r.prestataireId) return { refus: "prestation sans transporteur" };
      if (!texte(v.date)) return { refus: "prestation sans date" };
      if (!texte(v.libelle)) return { refus: "prestation sans libellé" };
      if (!texte(v.unite)) return { refus: "prestation sans unité" };
      if (quantite === null || quantite < 0) return { refus: "prestation sans quantité" };
      if (prixUnitaire === null || prixUnitaire < 0) return { refus: "prestation sans prix unitaire" };
      const montantFacture = nombre(v.montantFacture);
      return {
        ligne: {
          numero,
          date: texte(v.date),
          prestataire_id: r.prestataireId,
          libelle: texte(v.libelle),
          business_unit: texte(v.businessUnit),
          unite: texte(v.unite),
          quantite: Math.round(quantite * 100) / 100,
          prix_unitaire: Math.round(prixUnitaire),
          convention: texte(v.convention) ?? "inconnue",
          statut: texte(v.statut) ?? "confirme",
          montant_facture: montantFacture === null ? null : Math.round(montantFacture),
          date_facture: texte(v.dateFacture),
          date_reglement: texte(v.dateReglement),
          reference_facture: texte(v.referenceFacture),
          numero_demande_x3: texte(v.numeroDemandeX3),
          commentaire: texte(v.commentaire),
        },
      };
    }
    case "avance": {
      /* Un décaissement fait avant le service : il engage la trésorerie, il dit qui l'a décidé. */
      const montant = nombre(v.montant);
      if (!r.prestataireId) return { refus: "avance sans prestataire" };
      if (!texte(v.date)) return { refus: "avance sans date" };
      if (montant === null || montant <= 0) return { refus: "avance sans montant" };
      if (!texte(v.motif)) return { refus: "avance sans motif" };
      if (!texte(v.autorisePar)) return { refus: "avance sans autorisation" };
      return { ligne: { numero, prestataire_id: r.prestataireId, date: texte(v.date), montant: Math.round(montant), motif: texte(v.motif), imputee_sur: texte(v.imputeeSur), date_imputation: texte(v.dateImputation), autorise_par: texte(v.autorisePar) } };
    }
    case "evaluation": {
      /* Trois notes de 1 à 5 sur la pièce évaluée ; l'auteur est la personne de la session. */
      const note = (x: unknown) => {
        const n = nombre(x);
        return n === null ? null : Math.round(n);
      };
      const qualite = note(v.qualite);
      const delai = note(v.delai);
      const prix = note(v.prix);
      if (!r.prestataireId) return { refus: "évaluation sans prestataire" };
      if (!texte(v.date)) return { refus: "évaluation sans date" };
      if (!texte(v.pieceNumero)) return { refus: "évaluation sans pièce évaluée" };
      if ([qualite, delai, prix].some((n) => n === null || n < 1 || n > 5)) return { refus: "évaluation sans les trois notes de 1 à 5" };
      if (!texte(v.auteur)) return { refus: "évaluation sans auteur" };
      return { ligne: { numero, prestataire_id: r.prestataireId, date: texte(v.date), piece_numero: texte(v.pieceNumero), piece_libelle: texte(v.pieceLibelle) ?? texte(v.pieceNumero), qualite, delai, prix, commentaire: texte(v.commentaire), auteur: texte(v.auteur) } };
    }
    case "sanction": {
      if (!r.chauffeurId) return { refus: "sanction sans chauffeur" };
      if (!texte(v.motif)) return { refus: "sanction sans motif" };
      return { ligne: { numero, chauffeur_id: r.chauffeurId, date: texte(v.date), type: texte(v.type) ?? "avertissement", motif: texte(v.motif), jours: nombre(v.jours) } };
    }
    default:
      return { refus: `pas de table pour ${type}` };
  }
}

/* Les champs qu'une modification peut changer, et leur colonne. Ce qui n'y est
   pas (le véhicule d'une dépense, la nature d'un incident) se corrige en
   annulant et ressaisissant, comme le bureau le fait. */
const COLONNES: Partial<Record<TypeTransaction, Record<string, string>>> = {
  releve: { date: "date", valeur: "km" },
  plein: { date: "date", litres: "litres", prixLitre: "prix_litre", montant: "montant", reference: "reference", km: "km", source: "source", photo: "photo" },
  depense: { date: "date", poste: "poste", libelle: "libelle", montant: "montant", beneficiaire: "beneficiaire", reference: "reference", km: "km", justificatif: "justificatif", origine: "origine", photo: "photo" },
  document: { numeroPiece: "numero_piece", emetteur: "emetteur", dateEffet: "date_effet", echeance: "echeance", montant: "montant" },
  incident: { dateHeure: "date_heure", lieu: "lieu", mission: "mission", kilometrage: "kilometrage", responsabilite: "responsabilite", statut: "statut", description: "description" },
  affectation: { debut: "debut", fin: "fin", motif: "motif" },
  intervention: { date: "date", type: "type", objet: "objet", km: "km", immobilisationJours: "immobilisation_jours", montant: "montant", reference: "reference" },
  indisponibilite: { motif: "motif", debut: "debut", fin: "fin", commentaire: "commentaire" },
  sanction: { date: "date", type: "type", jours: "jours", motif: "motif" },
  caisse: { date: "date", libelle: "libelle", montant: "montant", beneficiaire: "beneficiaire", piece: "piece", justificatif: "justificatif" },
  cuve: { date: "date", libelle: "libelle", litres: "litres", prixLitre: "prix_litre", montant: "montant", fournisseur: "fournisseur", piece: "piece", commentaire: "commentaire" },
  achat: { date: "date", objet: "objet", poste: "poste", montantEstime: "montant_estime", fournisseur: "fournisseur", urgence: "urgence", etape: "etape", visaPar: "visa_par", visaLe: "visa_le", validePar: "valide_par", valideeLe: "validee_le", numeroDemandeX3: "numero_demande_x3", numeroBonCommande: "numero_bon_commande", montantEngage: "montant_engage", dateLivraison: "date_livraison", dateFacture: "date_facture", montantReel: "montant_reel", dateReglement: "date_reglement", depenseNumero: "depense_numero", commentaireDecision: "commentaire_decision" },
  visite: { type: "type", centre: "centre", dateRendezVous: "date_rendez_vous", heure: "heure", datePassage: "date_passage", statut: "statut", numeroPv: "numero_pv", dateLimiteContreVisite: "date_limite_contre_visite", commentaire: "commentaire" },
  observation: { libelle: "libelle", categorie: "categorie", gravite: "gravite", statut: "statut", interventionNumero: "intervention_numero", corrigeeLe: "corrigee_le", commentaire: "commentaire" },
  ordre: { datePrevue: "date_prevue", objet: "objet", garage: "garage", immobilisationPrevueJours: "immobilisation_prevue_jours", montantEstime: "montant_estime", statut: "statut", dateDebut: "date_debut", dateCloture: "date_cloture", interventionNumero: "intervention_numero", commentaire: "commentaire" },
  /* Le relevé : ce que le pont bascule ou le bon de livraison corrigent après
     coup. Le camion et le transporteur se fixent à la saisie. */
  transport: { date: "date", destination: "destination", produit: "produit", tonnage: "tonnage", tonnagePese: "tonnage_pese", bonLivraison: "bon_livraison", chauffeur: "chauffeur", origine: "origine" },
  tarif: { prix: "prix", minimum: "minimum", debut: "debut", fin: "fin", source: "source", commentaire: "commentaire" },
  /* Un affrètement : ce qui reste modifiable après coup. Le transporteur et le
     trajet se fixent à la commande — on n'échange pas un transporteur en cours
     de mission, on annule et on recommande. */
  affretement: { date: "date", tonnageLivre: "tonnage_livre", statut: "statut", chauffeurExterne: "chauffeur_externe", montantFacture: "montant_facture", prixExceptionnel: "prix_exceptionnel", complementTarif: "complement_tarif", motifTarif: "motif_tarif", dateLivraison: "date_livraison", dateFacture: "date_facture", dateReglement: "date_reglement", referenceFacture: "reference_facture", numeroDemandeX3: "numero_demande_x3", numeroBonCommande: "numero_bon_commande", commentaire: "commentaire" },
  "mise-a-disposition": { joursPanne: "jours_panne", joursRoules: "jours_roules", carburantLitres: "carburant_litres", carburantMontant: "carburant_montant", kmParcourus: "km_parcourus", tonnesTransportees: "tonnes_transportees", statut: "statut", montantFacture: "montant_facture", dateFacture: "date_facture", dateReglement: "date_reglement", referenceFacture: "reference_facture", numeroDemandeX3: "numero_demande_x3", commentaire: "commentaire" },
  prestation: { date: "date", libelle: "libelle", quantite: "quantite", prixUnitaire: "prix_unitaire", statut: "statut", montantFacture: "montant_facture", dateFacture: "date_facture", dateReglement: "date_reglement", referenceFacture: "reference_facture", numeroDemandeX3: "numero_demande_x3", commentaire: "commentaire" },
  /* L'avance s'impute après coup : c'est sa vie même. */
  avance: { date: "date", montant: "montant", motif: "motif", imputeeSur: "imputee_sur", dateImputation: "date_imputation", autorisePar: "autorise_par" },
  evaluation: { date: "date", qualite: "qualite", delai: "delai", prix: "prix", commentaire: "commentaire" },
};

const NUMERIQUES = new Set([
  "km", "litres", "prix_litre", "montant", "kilometrage", "immobilisation_jours", "jours", "immobilisation_prevue_jours", "montant_estime", "montant_engage", "montant_reel",
  "tonnage", "tonnage_pese", "tonnage_livre", "prix", "minimum", "montant_facture", "prix_exceptionnel", "complement_tarif", "jours_panne", "jours_roules", "carburant_litres", "carburant_montant", "km_parcourus", "tonnes_transportees", "quantite", "prix_unitaire",
  "qualite", "delai",
]);
/* Les colonnes qui gardent leurs décimales : des litres, des tonnes, des quantités. */
const DECIMALES = new Set(["litres", "tonnage", "tonnage_pese", "tonnage_livre", "carburant_litres", "tonnes_transportees", "quantite"]);
const BOOLEENS = new Set(["justificatif"]);
const HORODATES = new Set(["date_heure"]);
const PRODUITS = new Set(["produit"]);

/** Les colonnes qu'une modification change ; vide quand rien de ce qui a changé n'a de colonne. */
export function colonnesModification(type: TypeTransaction, diffs: { champ: string; valeur: unknown }[]): Record<string, unknown> {
  const carte = COLONNES[type];
  if (!carte) return {};
  const ligne: Record<string, unknown> = {};
  for (const d of diffs) {
    const colonne = carte[d.champ];
    if (!colonne) continue;
    if (NUMERIQUES.has(colonne)) {
      const n = nombre(d.valeur);
      ligne[colonne] = n === null ? null : DECIMALES.has(colonne) ? Math.round(n * 100) / 100 : Math.round(n);
    } else if (BOOLEENS.has(colonne)) ligne[colonne] = booleen(d.valeur);
    else if (HORODATES.has(colonne)) ligne[colonne] = horodatage(d.valeur);
    else if (PRODUITS.has(colonne)) ligne[colonne] = produitDepuis(d.valeur);
    else ligne[colonne] = texte(d.valeur);
  }
  return ligne;
}

/** Le sujet d'une création, décomposé : « vehicule:AA032EA » → { genre, cle } ; « transporteur:PRE-2026-00021 » est un prestataire. */
export function decomposerSujet(sujet: string): { genre: "vehicule" | "chauffeur" | "prestataire" | "autre"; cle: string } {
  const [genre, ...reste] = sujet.split(":");
  const cle = reste.join(":");
  if (genre === "vehicule" && cle) return { genre: "vehicule", cle };
  if (genre === "chauffeur" && cle) return { genre: "chauffeur", cle };
  if ((genre === "transporteur" || genre === "prestataire") && cle) return { genre: "prestataire", cle };
  return { genre: "autre", cle: sujet };
}

export const EST_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** L'immatriculation canonique d'un sujet : sans espace ni tiret, en capitales. */
export function immatriculationCanonique(cle: string): string {
  return cle.replace(/[\s-]/g, "").toUpperCase();
}

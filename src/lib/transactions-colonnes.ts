/* ============================================================================
 * Ce qu'une transaction saisie dans l'application devient en base : la table,
 * et les colonnes que ses valeurs remplissent.
 *
 * Dix types ont leur table — relevé, plein, dépense, document, incident,
 * affectation, intervention, indisponibilité, sanction (0001) et l'ordre de
 * travail (0016) — et le statut d'un véhicule s'écrit sur sa ligne avec sa
 * trace. Les autres (caisse, cuve, visite, observation, achat…) attendent
 * leur table : ils restent dans le navigateur, et `tableDe` le dit.
 *
 * Ce module est pur — pas de base, pas de navigateur — pour se vérifier seul
 * et servir la fonction serveur comme les tests.
 * ==========================================================================*/

import type { TypeTransaction } from "@/domaine/reference";

export type TableBranchee = "releve_kilometrique" | "plein" | "depense" | "document" | "incident" | "affectation" | "intervention" | "indisponibilite" | "sanction" | "ordre_travail";

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
  ordre: { datePrevue: "date_prevue", objet: "objet", garage: "garage", immobilisationPrevueJours: "immobilisation_prevue_jours", montantEstime: "montant_estime", statut: "statut", dateDebut: "date_debut", dateCloture: "date_cloture", interventionNumero: "intervention_numero", commentaire: "commentaire" },
};

const NUMERIQUES = new Set(["km", "litres", "prix_litre", "montant", "kilometrage", "immobilisation_jours", "jours", "immobilisation_prevue_jours", "montant_estime"]);
const BOOLEENS = new Set(["justificatif"]);
const HORODATES = new Set(["date_heure"]);

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
      ligne[colonne] = n === null ? null : colonne === "litres" ? n : Math.round(n);
    } else if (BOOLEENS.has(colonne)) ligne[colonne] = booleen(d.valeur);
    else if (HORODATES.has(colonne)) ligne[colonne] = horodatage(d.valeur);
    else ligne[colonne] = texte(d.valeur);
  }
  return ligne;
}

/** Le sujet d'une création, décomposé : « vehicule:AA032EA » → { genre, cle }. */
export function decomposerSujet(sujet: string): { genre: "vehicule" | "chauffeur" | "autre"; cle: string } {
  const [genre, ...reste] = sujet.split(":");
  const cle = reste.join(":");
  if (genre === "vehicule" && cle) return { genre: "vehicule", cle };
  if (genre === "chauffeur" && cle) return { genre: "chauffeur", cle };
  return { genre: "autre", cle: sujet };
}

export const EST_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** L'immatriculation canonique d'un sujet : sans espace ni tiret, en capitales. */
export function immatriculationCanonique(cle: string): string {
  return cle.replace(/[\s-]/g, "").toUpperCase();
}

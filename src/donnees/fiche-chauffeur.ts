/* ============================================================================
 * La fiche d'un chauffeur, lue avec la session de l'utilisateur.
 *
 * Base branchée : la ligne vient de la liste Chauffeurs (déjà bornée au
 * périmètre), les faits de `lire_fiche_chauffeur()` (0015), et l'assembleur
 * du domaine en fait la fiche. Sinon, la fiche de démonstration. Une lecture
 * par requête.
 * ==========================================================================*/

import { createHash } from "node:crypto";
import { cache } from "react";
import { assemblerFicheChauffeur, type FaitsFicheChauffeur } from "@/domaine/assembler-fiche-chauffeur";
import type { FicheChauffeur } from "@/domaine/chauffeur";
import { afficher } from "@/domaine/immatriculation";
import type { BusinessUnit, CategorieVehicule, DeclarationIncident, Indisponibilite, Sanction, TypeDocument } from "@/domaine/types";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { lignesChauffeurs } from "./chauffeurs";
import { fichePourChauffeur, fichesChauffeurs } from "./chauffeurs-demo";

interface FicheChauffeurJson {
  chauffeur: { adresse: string | null; contact_urgence: string | null; permis_delivrance: string | null };
  documents: { numero: string; type_document_id: string; date_effet: string | null; echeance: string | null; emetteur: string | null; numero_piece: string | null; montant: number | null; justificatif: boolean }[];
  affectations: { numero: string; role: "titulaire" | "suppleant"; debut: string; fin: string | null; motif: string; vehicule: { id: string; immatriculation: string; marque: string; appellation: string; categorie: CategorieVehicule; business_unit: BusinessUnit | null; site: string | null } }[];
  indisponibilites: { id: string; numero: string; motif: Indisponibilite["motif"]; debut: string; fin: string | null; commentaire: string | null }[];
  sanctions: { id: string; numero: string; date: string; type: Sanction["type"]; motif: string; jours: number | null; incident_numero: string | null; depense_numero: string | null }[];
  incidents: { numero: string; nature: "incident" | "accident"; type: string; date_heure: string; lieu: string | null; mission: DeclarationIncident["mission"]; responsabilite: DeclarationIncident["responsabilite"]; statut: DeclarationIncident["statut"]; blesses: boolean; sinistre_ouvert: boolean; immobilisation_jours: number | null; kilometrage: number | null; description: string | null; vehicule: { id: string; immatriculation: string; marque: string; appellation: string; site_id: string | null } }[];
  pleins: { numero: string; vehicule_id: string; date: string; litres: number | string; montant: number; km: number | null }[];
  depenses: { numero: string; vehicule_id: string | null; date: string; poste: string; libelle: string; montant: number; reference: string | null; justificatif: boolean }[];
  releves: { vehicule_id: string; date: string; km: number; origine: string; valide: boolean; attribue: boolean }[];
}

/* Le même UUID que le seed forme pour un identifiant de démonstration. */
function uuidDeterministe(etiquette: string): string {
  const h = createHash("sha1").update(`sedima-parc:${etiquette}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function faitsChauffeurDepuisJson(j: FicheChauffeurJson, id: string): FaitsFicheChauffeur {
  return {
    adresse: j.chauffeur.adresse,
    contactUrgence: j.chauffeur.contact_urgence,
    permisDelivrance: j.chauffeur.permis_delivrance,
    documents: j.documents.map((d) => ({ numero: d.numero, type: d.type_document_id as TypeDocument, dateEffet: d.date_effet, echeance: d.echeance, emetteur: d.emetteur, numeroPiece: d.numero_piece, montant: d.montant, justificatif: d.justificatif })),
    affectations: j.affectations.map((a) => ({ numero: a.numero, role: a.role, debut: a.debut, fin: a.fin, motif: a.motif, vehicule: { id: a.vehicule.id, immatriculation: a.vehicule.immatriculation, immatriculationAffichee: afficher(a.vehicule.immatriculation), marque: a.vehicule.marque, appellation: a.vehicule.appellation, categorie: a.vehicule.categorie, businessUnit: a.vehicule.business_unit, site: a.vehicule.site } })),
    indisponibilites: j.indisponibilites.map((n) => ({ id: n.id, numero: n.numero, chauffeurId: id, motif: n.motif, debut: n.debut, fin: n.fin, commentaire: n.commentaire })),
    sanctions: j.sanctions.map((s) => ({ id: s.id, numero: s.numero, chauffeurId: id, date: s.date, type: s.type, motif: s.motif, jours: s.jours, incidentId: s.incident_numero, depenseId: s.depense_numero, incidentNumero: s.incident_numero, depenseNumero: s.depense_numero })),
    incidents: j.incidents.map((i) => ({ numero: i.numero, nature: i.nature, type: i.type, dateHeure: i.date_heure, lieu: i.lieu, mission: i.mission, responsabilite: i.responsabilite, statut: i.statut, blesses: i.blesses, sinistreOuvert: i.sinistre_ouvert, immobilisationJours: i.immobilisation_jours, kilometrage: i.kilometrage, description: i.description, vehicule: { id: i.vehicule.id, immatriculation: i.vehicule.immatriculation, immatriculationAffichee: afficher(i.vehicule.immatriculation), marque: i.vehicule.marque, appellation: i.vehicule.appellation, siteId: i.vehicule.site_id } })),
    pleins: j.pleins.map((p) => ({ numero: p.numero, vehiculeId: p.vehicule_id, date: p.date, litres: Number(p.litres), montant: p.montant, km: p.km })),
    depenses: j.depenses.map((d) => ({ numero: d.numero, vehiculeId: d.vehicule_id, date: d.date, poste: d.poste, libelle: d.libelle, montant: d.montant, reference: d.reference, justificatif: d.justificatif })),
    releves: j.releves.map((r) => ({ vehiculeId: r.vehicule_id, date: r.date, km: r.km, origine: r.origine, valide: r.valide, attribue: r.attribue })),
  };
}

/** La fiche d'un chauffeur par son identifiant d'adresse (« moustapha-diaw ») ; nulle hors périmètre. */
async function ficheChauffeurServeurBrut(id: string): Promise<FicheChauffeur | null> {
  if (!authentificationReelle()) return fichePourChauffeur(id);
  const lignes = await lignesChauffeurs();
  const ligne = lignes.find((l) => l.id === id) ?? null;
  if (!ligne) return null;
  const client = await clientServeur();
  const lecture = await client.rpc("lire_fiche_chauffeur", { identifiant: id, uuid_devine: uuidDeterministe(`chauffeur:${id}`) }).maybeSingle<FicheChauffeurJson | null>();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  /* Fonction pas encore jouée : la fiche se dresse sur la ligne seule. */
  const faits = !lecture.error && lecture.data ? faitsChauffeurDepuisJson(lecture.data, id) : { adresse: null, contactUrgence: null, permisDelivrance: null, documents: [], affectations: [], indisponibilites: [], sanctions: [], incidents: [], pleins: [], depenses: [], releves: [] };
  return assemblerFicheChauffeur(ligne, faits, aujourdhui);
}

export const ficheChauffeurServeur = cache(ficheChauffeurServeurBrut);

interface FicheChauffeurEnListe {
  id: string;
  identifiant: string;
  fiche: FicheChauffeurJson | null;
}

const FAITS_VIDES: FaitsFicheChauffeur = { adresse: null, contactUrgence: null, permisDelivrance: null, documents: [], affectations: [], indisponibilites: [], sanctions: [], incidents: [], pleins: [], depenses: [], releves: [] };

/**
 * Toutes les fiches du périmètre, pour ce qui compare les chauffeurs entre
 * eux — le classement du mois, la moyenne des kilomètres de la cohorte.
 * Base branchée : `lire_fiches_chauffeurs()` (0020) rend d'un coup ce que
 * `lire_fiche_chauffeur()` rend pour un seul ; chaque fiche s'assemble sur
 * la ligne de la liste qui porte le même identifiant.
 */
async function fichesChauffeursServeurBrut(): Promise<FicheChauffeur[]> {
  if (!authentificationReelle()) return fichesChauffeurs();
  const lignes = await lignesChauffeurs();
  const client = await clientServeur();
  const lecture = await client.rpc("lire_fiches_chauffeurs").maybeSingle<FicheChauffeurEnListe[] | null>();
  if (lecture.error) console.warn(`Fiches chauffeurs : lire_fiches_chauffeurs() indisponible (${lecture.error.message}), classement sans historique.`);
  const parIdentifiant = new Map((Array.isArray(lecture.data) ? lecture.data : []).map((f) => [f.identifiant, f.fiche]));
  const aujourdhui = new Date().toISOString().slice(0, 10);
  return lignes.map((ligne) => {
    const j = parIdentifiant.get(ligne.id) ?? null;
    return assemblerFicheChauffeur(ligne, j ? faitsChauffeurDepuisJson(j, ligne.id) : FAITS_VIDES, aujourdhui);
  });
}

export const fichesChauffeursServeur = cache(fichesChauffeursServeurBrut);

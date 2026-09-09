/* ============================================================================
 * Le module Prestataires, lu avec la session de l'utilisateur.
 *
 * Base branchée : `lire_prestataires(depuis)` (0026) rend en une requête le
 * référentiel et ce que les transactions disent de chaque prestataire —
 * interventions, pleins, sorties de caisse, documents émis, visites
 * techniques, avances, évaluations ; les demandes d'achat viennent de
 * `achatsServeur()` et le transport tiers de `transporteursServeur()`, déjà
 * à la forme du domaine. Ce module rapporte chaque fait à un numéro PRE —
 * par la clé quand la table la porte, par le nom sinon (émetteur d'un
 * document, centre d'une visite, source d'un plein, bénéficiaire d'une
 * dépense) — et la fiche, le compte et la liste s'assemblent avec les mêmes
 * règles qu'en démonstration (`assembler-prestataires.ts`).
 * ==========================================================================*/

import { cache } from "react";
import type { SourcePrestataires } from "@/domaine/assembler-prestataires";
import type { Avance, Evaluation } from "@/domaine/compte-prestataire";
import { afficher } from "@/domaine/immatriculation";
import { TYPE_DOCUMENT } from "@/domaine/libelles";
import type { Prestataire } from "@/domaine/prestataires";
import type { PosteDepense } from "@/domaine/types";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { achatsServeur } from "./achats";
import { depenseCaisseDepuisLigne, type LigneDepenseCaisseBase } from "./caisse";
import { sourcePrestatairesDemo } from "./compte-prestataire-demo";
import { prestatairePour } from "./prestataires-demo";
import { prestataireDepuisLigne, type LignePrestataire } from "./referentiels";
import { transporteursServeur } from "./transporteurs";

/* -- Ce que la fonction rend ------------------------------------------------------ */

export interface PrestatairesJson {
  prestataires: (LignePrestataire & { id: string })[];
  interventions: { numero: string; prestataire_id: string; date: string; type: "preventif" | "curatif"; objet: string; montant: number | string; immobilisation_jours: number; reference: string | null; immatriculation: string | null }[];
  pleins: { numero: string; prestataire_id: string | null; source: string; date: string; litres: number | string; prix_litre: number; montant: number | string; immatriculation: string | null }[];
  depenses: (LigneDepenseCaisseBase & { prestataire_id: string | null; poste: PosteDepense })[];
  documents: { numero: string; type_document_id: string; date_effet: string | null; echeance: string | null; emetteur: string; numero_piece: string | null; montant: number | string | null; immatriculation: string | null }[];
  visites: { numero: string; type: string; centre: string; date_rendez_vous: string; date_passage: string | null; statut: string; numero_pv: string | null; immatriculation: string | null }[];
  avances: { numero: string; prestataire_id: string; date: string; montant: number | string; motif: string; imputee_sur: string | null; date_imputation: string | null; autorise_par: string }[];
  evaluations: { numero: string; prestataire_id: string; date: string; piece_numero: string; piece_libelle: string; qualite: number; delai: number; prix: number; commentaire: string | null; auteur: string }[];
}

export const PRESTATAIRES_VIDE: PrestatairesJson = { prestataires: [], interventions: [], pleins: [], depenses: [], documents: [], visites: [], avances: [], evaluations: [] };

/* -- La mise à la forme du domaine — pure, pour le banc d'essai ------------------- */

const nb = (v: number | string): number => Number(v);

/**
 * Les faits rendus par la base, rapportés à leur prestataire et à la forme que
 * le module assemble. Les achats et le transport sont passés déjà lus.
 */
export function sourceDepuisJson(j: PrestatairesJson, achats: SourcePrestataires["demandes"], transport: Pick<SourcePrestataires, "affretements" | "misesADisposition" | "prestations">, aujourdhui: string): SourcePrestataires {
  const prestataires: Prestataire[] = j.prestataires.map(prestataireDepuisLigne);
  const numeroParId = new Map(j.prestataires.map((p) => [p.id, p.numero]));
  /* Par la clé quand elle est là, par le nom sinon — le même rapprochement que la démonstration. */
  const numeroDe = (id: string | null, nom: string | null): string | null => (id ? (numeroParId.get(id) ?? null) : (prestatairePour(nom, prestataires)?.numero ?? null));
  const porteur = (immatriculation: string | null) => ({ vehiculeId: immatriculation ?? "", immatriculation: immatriculation ?? "", immatriculationAffichee: immatriculation ? afficher(immatriculation) : "—" });

  const interventions: SourcePrestataires["interventions"] = [];
  for (const i of j.interventions) {
    const numero = numeroDe(i.prestataire_id, null);
    if (!numero) continue;
    interventions.push({ prestataireNumero: numero, numero: i.numero, date: i.date, type: i.type, objet: i.objet, montant: nb(i.montant), immobilisationJours: nb(i.immobilisation_jours), reference: i.reference ?? "", ...porteur(i.immatriculation) });
  }
  const pleins: SourcePrestataires["pleins"] = [];
  for (const x of j.pleins) {
    const numero = numeroDe(x.prestataire_id, x.source);
    if (!numero) continue;
    pleins.push({ prestataireNumero: numero, numero: x.numero, date: x.date, litres: nb(x.litres), prixLitre: nb(x.prix_litre), montant: nb(x.montant), ...porteur(x.immatriculation) });
  }
  const depensesCaisse: SourcePrestataires["depensesCaisse"] = [];
  for (const d of j.depenses) {
    const numero = numeroDe(d.prestataire_id, d.beneficiaire);
    if (!numero) continue;
    depensesCaisse.push({ prestataireNumero: numero, ...depenseCaisseDepuisLigne(d) });
  }
  const documents: SourcePrestataires["documents"] = [];
  for (const c of j.documents) {
    const numero = numeroDe(null, c.emetteur);
    if (!numero) continue;
    documents.push({ prestataireNumero: numero, numero: c.numero, type: c.type_document_id, libelle: TYPE_DOCUMENT[c.type_document_id as keyof typeof TYPE_DOCUMENT] ?? c.type_document_id, dateEffet: c.date_effet, echeance: c.echeance, montant: c.montant === null ? null : nb(c.montant), numeroPiece: c.numero_piece, ...porteur(c.immatriculation) });
  }
  const visites: SourcePrestataires["visites"] = [];
  for (const t of j.visites) {
    const numero = numeroDe(null, t.centre);
    if (!numero) continue;
    visites.push({ prestataireNumero: numero, numero: t.numero, type: t.type, dateRendezVous: t.date_rendez_vous, datePassage: t.date_passage, statut: t.statut, numeroPv: t.numero_pv, ...porteur(t.immatriculation) });
  }
  const avances: Avance[] = [];
  for (const a of j.avances) {
    const numero = numeroDe(a.prestataire_id, null);
    if (!numero) continue;
    avances.push({ numero: a.numero, prestataireNumero: numero, date: a.date, montant: nb(a.montant), motif: a.motif, imputeeSur: a.imputee_sur, dateImputation: a.date_imputation, autorisePar: a.autorise_par });
  }
  const evaluations: Evaluation[] = [];
  for (const e of j.evaluations) {
    const numero = numeroDe(e.prestataire_id, null);
    if (!numero) continue;
    evaluations.push({ numero: e.numero, prestataireNumero: numero, date: e.date, pieceNumero: e.piece_numero, pieceLibelle: e.piece_libelle, notes: { qualite: nb(e.qualite), delai: nb(e.delai), prix: nb(e.prix) }, commentaire: e.commentaire, auteur: e.auteur });
  }

  /* Le transport vient de la source des transporteurs, qui porte ses propres
     prestataires : on ne prend que ses missions. */
  return { prestataires, demandes: achats, interventions, pleins, depensesCaisse, documents, visites, affretements: transport.affretements, misesADisposition: transport.misesADisposition, prestations: transport.prestations, avances, evaluations, aujourdhui };
}

/* -- Ce que les pages appellent --------------------------------------------------- */

/** Deux ans de pleins et de sorties de caisse : ce que la fiche montre au plus long. */
export function depuisPour(aujourdhui: string): string {
  const d = new Date(`${aujourdhui}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 2);
  return d.toISOString().slice(0, 10);
}

async function prestatairesServeurBrut(): Promise<SourcePrestataires> {
  if (!authentificationReelle()) return sourcePrestatairesDemo();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const client = await clientServeur();
  const [lecture, achats, transport] = await Promise.all([client.rpc("lire_prestataires", { depuis: depuisPour(aujourdhui) }).maybeSingle<PrestatairesJson | null>(), achatsServeur(), transporteursServeur()]);
  /* Fonction pas encore jouée : le référentiel seul, sans activité. */
  if (lecture.error || !lecture.data) {
    if (lecture.error) console.warn(`Prestataires : lire_prestataires() indisponible (${lecture.error.message}).`);
    const source = sourceDepuisJson(PRESTATAIRES_VIDE, achats, transport, aujourdhui);
    const tous = await client.from("prestataire").select("numero, raison_sociale, type, contact, telephone, courriel, adresse, ville, ninea, delai_paiement_jours, actif, note").order("numero").returns<LignePrestataire[]>();
    return { ...source, prestataires: (tous.data ?? []).map(prestataireDepuisLigne) };
  }
  return sourceDepuisJson(lecture.data, achats, transport, aujourdhui);
}

export const prestatairesServeur = cache(prestatairesServeurBrut);

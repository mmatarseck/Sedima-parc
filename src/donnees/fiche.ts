/* ============================================================================
 * La fiche d'un véhicule, lue avec la session de l'utilisateur.
 *
 * Base branchée : la ligne vient de la liste Flotte (déjà bornée au
 * périmètre), les faits de `lire_fiche()` (0013), et l'assembleur du domaine
 * en fait la fiche 360°. Sinon, la fiche de démonstration. Une lecture par
 * requête.
 * ==========================================================================*/

import { lignesLues } from "./lecture";
import { cache } from "react";
import { assemblerFiche, FAITS_VIDES, type FaitsFiche } from "@/domaine/assembler-fiche";
import { incidentsDuVehicule } from "./incidents";
import { rappelsDuVehicule } from "./rappels";
import type { AttelageFiche, FicheVehicule, PieceDossier } from "@/domaine/fiche";
import type { LivraisonFiche } from "@/domaine/livraisons";
import { normaliser } from "@/domaine/immatriculation";
import type { Parametres } from "@/domaine/parametres";
import type { CategorieObservation, PosteDepense, TypeDocument } from "@/domaine/types";
import { clientServeur } from "@/lib/supabase";
import { passagesReleves, planDuVehicule, programmeParDefaut } from "./entretien-demo";
import { lignesFlotte, parcServeur } from "./flotte";

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
  return lignesLues("Livraisons du véhicule", lecture).map((l) => ({ numero: l.numero, date: l.date, site: l.site, client: l.client, produits: l.produits, poidsKg: l.poids_kg === null ? null : Number(l.poids_kg), quantites: l.quantites ?? {}, lignes: l.lignes, transporteur: l.transporteur_libelle, chauffeur: l.chauffeur, source: l.source }));
}

interface AttelageBase {
  numero: string;
  tracteur_id: string;
  remorque_id: string;
  debut: string;
  fin: string | null;
  permanent: boolean;
  motif: string | null;
}

/**
 * Les attelages du véhicule (0050), vus de son côté.
 *
 * Une requête à part, comme pour les livraisons : `lire_fiche()` ne les
 * projette pas, et réécrire la fonction entière pour deux colonnes coûterait
 * plus qu'une lecture bornée au véhicule.
 *
 * ELLE NE JOINT RIEN. La première version demandait à PostgREST d'imbriquer les
 * deux véhicules — et `attelage` porte **deux** clés étrangères vers
 * `vehicule`, ce qui rend l'imbrication ambiguë et la requête fragile ; le banc
 * SQL ne pouvait pas le voir. Or la fiche a déjà toute la flotte sous la main,
 * plaque et modèle compris : on lit les couples, on nomme l'autre moitié ici.
 * Une jointure de moins, et plus rien à lever d'ambiguïté.
 *
 * Le véhicule est d'un côté **ou** de l'autre — d'où le `or` sur les deux clés
 * — et c'est ici qu'on sait lequel : la fiche reçoit son rôle et l'autre moitié
 * déjà nommée, elle n'a plus à démêler.
 */
async function attelagesDuVehicule(
  client: Awaited<ReturnType<typeof clientServeur>>,
  vehiculeId: string,
  flotte: { vehicule: { id: string; immatriculation: string; immatriculationAffichee: string; marque: string; appellation: string } }[],
): Promise<{ attelages: AttelageFiche[]; illisible: boolean }> {
  if (!UUID.test(vehiculeId)) return { attelages: [], illisible: false };
  const lecture = await client
    .from("attelage")
    .select("numero, tracteur_id, remorque_id, debut, fin, permanent, motif")
    .or(`tracteur_id.eq.${vehiculeId},remorque_id.eq.${vehiculeId}`)
    .limit(500)
    .returns<AttelageBase[]>();
  if (lecture.error) {
    /* Table pas encore jouée, ou lecture refusée. On le dit à la fiche : « aucun
       attelage » et « je n'ai pas pu lire » ne sont pas la même phrase, et la
       seconde ne doit pas se déguiser en première. */
    console.warn(`Attelages ${vehiculeId} : lecture impossible (${lecture.error.message}).`);
    return { attelages: [], illisible: true };
  }
  const parId = new Map(flotte.map((l) => [l.vehicule.id, l.vehicule]));
  const attelages = lecture.data.flatMap((a) => {
    const tracteurIci = a.tracteur_id === vehiculeId;
    const autreId = tracteurIci ? a.remorque_id : a.tracteur_id;
    const autre = parId.get(autreId);
    /* L'autre moitié hors périmètre de l'utilisateur : la ligne ne dirait rien
       d'utile, et inventer un tiret vaudrait moins que le silence. */
    if (!autre) return [];
    return [
      {
        numero: a.numero,
        role: tracteurIci ? ("tracteur" as const) : ("remorque" as const),
        autreId,
        autreImmatriculation: autre.immatriculation,
        autreImmatriculationAffichee: autre.immatriculationAffichee,
        autreVehicule: `${autre.marque} ${autre.appellation}`.trim(),
        debut: a.debut,
        fin: a.fin,
        permanent: a.permanent,
        motif: a.motif,
      },
    ];
  });
  return { attelages, illisible: false };
}

/**
 * La pièce jointe de chaque document du véhicule, par numéro. `lire_fiche()` ne
 * projette pas la colonne `fichier` : la réécrire entière pour elle coûterait
 * plus qu'une requête bornée au véhicule, et un document dont on ne peut pas
 * ouvrir la pièce ne prouve rien le jour du contrôle.
 */
async function piecesJointesDuVehicule(client: Awaited<ReturnType<typeof clientServeur>>, vehiculeId: string): Promise<Map<string, string>> {
  if (!UUID.test(vehiculeId)) return new Map();
  const lecture = await client.from("document").select("numero, fichier").eq("vehicule_id", vehiculeId).not("fichier", "is", null).limit(2000).returns<{ numero: string; fichier: string }[]>();
  /* Un dossier qu.on ne peut pas lire ne se montre pas vide : « aucune pièce »
     est ce que dit un véhicule sans scan, et les deux ne se confondent pas. */
  return new Map(lignesLues("Pièces jointes du véhicule", lecture).map((d) => [d.numero, d.fichier]));
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
  const canonique = normaliser(brut);
  const lignes = await lignesFlotte(parametres);
  /* Par immatriculation, ou par numéro de lot pour un véhicule à recevoir : sans plaque encore, il a sa fiche complète comme les autres — c'est la seule fiche de l'application. */
  const ligne = lignes.find((l) => l.vehicule.immatriculation === canonique || l.vehicule.id === brut.toLowerCase()) ?? null;
  if (!ligne) return null;
  const client = await clientServeur();
  /*
   * L'IDENTIFIANT DE LA TABLE, ET NON CELUI DE LA LIGNE.
   *
   * `vehiculeDepuisLaBase()` donne à un véhicule son **immatriculation** comme
   * identifiant : c'est elle qui adresse sa fiche, et c'est voulu. Mais les
   * lectures annexes filtrent sur `vehicule_id`, une colonne d'UUID. On leur
   * passait `ligne.vehicule.id` — donc une plaque —, et leur garde-fou
   * `UUID.test()` les faisait abandonner **sans rien dire** : livraisons,
   * pièces jointes et attelages rendaient toujours vide.
   *
   * Personne ne pouvait le voir : « aucune pièce au dossier » est exactement ce
   * qu'affiche un véhicule sans scan. C'est ce qui a fait chercher les
   * soixante-quatorze cartes grises attachées le 15 septembre 2026, et ce qui
   * faisait dire à la fiche d'AA-053-AP qu'elle n'avait pas d'attelage.
   *
   * Le parc est déjà lu et mis en cache : la plaque y donne l'identifiant.
   */
  const parc = await parcServeur();
  const vehiculeId = parc.vehicules.find((v) => v.immatriculation === ligne.vehicule.immatriculation)?.id ?? null;
  const [lecture, livraisons, piecesJointes, attelages, incidents, rappels, piecesHorsDocuments] = await Promise.all([
    client.rpc("lire_fiche", { immat: canonique }).maybeSingle<FicheJson | null>(),
    vehiculeId ? livraisonsDuVehicule(client, vehiculeId) : Promise.resolve([]),
    vehiculeId ? piecesJointesDuVehicule(client, vehiculeId) : Promise.resolve(new Map<string, string>()),
    vehiculeId ? attelagesDuVehicule(client, vehiculeId, lignes) : Promise.resolve({ attelages: [], illisible: false }),
    vehiculeId ? incidentsDuVehicule(client, vehiculeId) : Promise.resolve([]),
    vehiculeId ? rappelsDuVehicule(client, vehiculeId, parametres) : Promise.resolve([]),
    vehiculeId ? piecesDuVehicule(client, vehiculeId) : Promise.resolve([]),
  ]);
  /* Fonction pas encore jouée : la fiche se dresse sur la ligne seule, sans historique — pas d'erreur. */
  if (lecture.error) console.warn(`Fiche ${canonique} : lire_fiche() indisponible (${lecture.error.message}), fiche dressée sans historique.`);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const v = ligne.vehicule;
  const plan = { programme: programmeParDefaut(v.categorie), plan: planDuVehicule(v.id, v.categorie), passages: passagesReleves };
  /* Une donnée fautive dans l'historique ne doit pas fermer la fiche : elle
     s'ouvre alors sans historique, et le journal du serveur dit pourquoi. */
  try {
    const faits = !lecture.error && lecture.data ? faitsDepuisJson(lecture.data) : FAITS_VIDES;
    /* La pièce jointe d'un document vient d'une lecture à part : `lire_fiche()`
       ne la projette pas, et réécrire la fonction entière pour une colonne
       coûterait plus qu'une requête bornée au véhicule. */
    const documents = faits.documents.map((d) => ({ ...d, fichier: piecesJointes.get(d.numero) ?? null }));
    /* Les documents qui portent un scan rejoignent le dossier, avec les pièces
       des visites, des interventions, des dépenses et des pleins. */
    const libelles = new Map(parametres.documents.types.map((t) => [t.id, t.libelle]));
    const pieces: PieceDossier[] = [
      ...documents
        .filter((d): d is typeof d & { fichier: string } => Boolean(d.fichier))
        .map((d) => ({
          numero: d.numero,
          famille: familleDuDocument(d.type),
          libelle: libelles.get(d.type) ?? d.type,
          precision: [d.numeroPiece, d.emetteur, d.echeance ? `échéance ${d.echeance.slice(8, 10)}/${d.echeance.slice(5, 7)}/${d.echeance.slice(0, 4)}` : null].filter(Boolean).join(" · ") || "sans référence",
          date: d.dateEffet,
          fichier: d.fichier,
        })),
      ...piecesHorsDocuments,
    ];
    return assemblerFiche(ligne, { ...faits, documents, livraisons, incidents, rappels, pieces, attelages: attelages.attelages, attelagesIllisibles: attelages.illisible }, parametres, aujourdhui, plan);
  } catch (e) {
    console.error(`Fiche ${canonique} : assemblage impossible sur l'historique lu — ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
    return assemblerFiche(ligne, { ...FAITS_VIDES, livraisons, incidents, rappels, pieces: piecesHorsDocuments, attelages: attelages.attelages, attelagesIllisibles: attelages.illisible }, parametres, aujourdhui, plan);
  }
}

export const ficheServeur = cache(ficheServeurBrut);

/* -- Les pièces du dossier, hors documents -----------------------------------
 *
 * Le dossier d'un véhicule montre trois familles (16 septembre 2026) : le
 * réglementaire, les visites techniques, ce qui a coûté. Les documents portent
 * les deux premières ; la troisième vit sur les lignes qui ont coûté — la
 * facture d'une intervention, la photo d'une dépense ou d'un plein — et le
 * procès-verbal d'une visite sur la visite elle-même (0053).
 *
 * Quatre requêtes bornées au véhicule, en parallèle. `lire_fiche()` ne
 * projette aucun fichier : réécrire la fonction pour quatre colonnes coûterait
 * plus que ces lectures, qui ne rendent que les lignes qui portent un fichier.
 * ------------------------------------------------------------------------- */

interface FichierBase {
  numero: string;
  date: string | null;
  fichier: string;
}

async function piecesDuVehicule(client: Awaited<ReturnType<typeof clientServeur>>, vehiculeId: string): Promise<PieceDossier[]> {
  const [visites, interventions, depenses, pleins] = await Promise.all([
    client.from("visite_technique").select("numero, date_passage, date_rendez_vous, centre, numero_pv, fichier").eq("vehicule_id", vehiculeId).not("fichier", "is", null).limit(500).returns<(FichierBase & { date_passage: string | null; date_rendez_vous: string; centre: string; numero_pv: string | null })[]>(),
    client.from("intervention").select("numero, date, objet, montant, fichier, prestataire (raison_sociale)").eq("vehicule_id", vehiculeId).not("fichier", "is", null).limit(2000).returns<(FichierBase & { objet: string; montant: number; prestataire: { raison_sociale: string } | null })[]>(),
    client.from("depense").select("numero, date, libelle, beneficiaire, montant, photo").eq("vehicule_id", vehiculeId).not("photo", "is", null).limit(5000).returns<{ numero: string; date: string; libelle: string; beneficiaire: string | null; montant: number; photo: string }[]>(),
    client.from("plein").select("numero, date, litres, montant, photo").eq("vehicule_id", vehiculeId).not("photo", "is", null).limit(5000).returns<{ numero: string; date: string; litres: number | string; montant: number; photo: string }[]>(),
  ]);
  const francs = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} F`;
  return [
    ...lignesLues("Procès-verbaux de visite", visites).map((v): PieceDossier => ({ numero: v.numero, famille: "visite", libelle: "Procès-verbal de visite technique", precision: [v.centre, v.numero_pv ? `PV ${v.numero_pv}` : null].filter(Boolean).join(" · "), date: v.date_passage ?? v.date_rendez_vous, fichier: v.fichier })),
    ...lignesLues("Factures d'intervention", interventions).map((i): PieceDossier => ({ numero: i.numero, famille: "cout", libelle: `Intervention · ${i.objet}`, precision: [i.prestataire?.raison_sociale ?? null, francs(i.montant)].filter(Boolean).join(" · "), date: i.date, fichier: i.fichier })),
    ...lignesLues("Pièces des dépenses", depenses).map((d): PieceDossier => ({ numero: d.numero, famille: "cout", libelle: `Dépense · ${d.libelle}`, precision: [d.beneficiaire, francs(d.montant)].filter(Boolean).join(" · "), date: d.date, fichier: d.photo })),
    ...lignesLues("Pièces des pleins", pleins).map((p): PieceDossier => ({ numero: p.numero, famille: "cout", libelle: `Plein · ${Number(p.litres).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} L`, precision: francs(p.montant), date: p.date, fichier: p.photo })),
  ];
}

/** La famille d'un document, d'après son type : les visites d'un côté, tout le reste est réglementaire. */
function familleDuDocument(type: string): PieceDossier["famille"] {
  return type === "visite-technique" ? "visite" : "reglementaire";
}

"use server";

/* ============================================================================
 * Les transactions saisies dans l'application, écrites en base.
 *
 * Jusqu'ici, tout ce que la modale de transaction, la fiche rapide ou
 * l'atelier enregistraient vivait dans le navigateur. Base branchée, ces deux
 * fonctions serveur écrivent la même chose dans la table du type — relevé,
 * plein, dépense, document, incident, affectation, intervention,
 * indisponibilité, sanction, et le transport tiers : ligne de relevé, ligne
 * de grille, affrètement, mise à disposition, prestation — et le statut d'un
 * véhicule sur sa ligne, avec
 * sa trace dans `modification` (c'est elle que `situation_journaliere()` lit
 * pour rendre le statut d'un jour passé). Les politiques RLS décident, avec la
 * session de l'utilisateur.
 *
 * Le numéro : celui que le navigateur a formé, sauf s'il existe déjà — deux
 * postes peuvent numéroter en même temps — ; la base donne alors le suivant,
 * et le navigateur renumérote sa copie.
 *
 * Les identifiants : la démonstration nomme un véhicule par son
 * immatriculation et un chauffeur par un identifiant lisible ; le seed les a
 * transposés en UUID déterministes (sha1 de « sedima-parc:chauffeur:… »). On
 * retrouve donc un véhicule par son immatriculation, un chauffeur par son
 * UUID ou par cette transposition.
 * ==========================================================================*/

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { Creation } from "@/domaine/cloture";
import { afficher } from "@/domaine/immatriculation";
import { TYPE_TRANSACTION, formerNumero, type TypeTransaction } from "@/domaine/reference";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur, utilisateurCourant } from "@/lib/supabase";
import { EST_UUID, colonnesModification, decomposerSujet, immatriculationCanonique, ligneCreation, tableDe, type Rattachement } from "@/lib/transactions-colonnes";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResultatEcriture = { issue: "ecrite"; numero: string } | { issue: "refusee"; motif: string } | { issue: "hors-base" };

/* Le même UUID que le seed forme pour un identifiant de démonstration. */
function uuidDeterministe(etiquette: string): string {
  const h = createHash("sha1").update(`sedima-parc:${etiquette}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function vehiculeIdDe(client: SupabaseClient, cle: unknown): Promise<string | null> {
  if (typeof cle !== "string" || !cle) return null;
  if (EST_UUID.test(cle)) return cle;
  const immat = immatriculationCanonique(cle);
  const r = await client.from("vehicule").select("id").eq("immatriculation", immat).maybeSingle<{ id: string }>();
  if (r.data) return r.data.id;
  /* Un identifiant de démonstration transposé par le seed. */
  const devine = uuidDeterministe(`vehicule:${cle}`);
  const d = await client.from("vehicule").select("id").eq("id", devine).maybeSingle<{ id: string }>();
  return d.data?.id ?? null;
}

async function chauffeurIdDe(client: SupabaseClient, cle: unknown): Promise<string | null> {
  if (typeof cle !== "string" || !cle) return null;
  if (EST_UUID.test(cle)) return cle;
  const devine = uuidDeterministe(`chauffeur:${cle}`);
  const d = await client.from("chauffeur").select("id").eq("id", devine).maybeSingle<{ id: string }>();
  return d.data?.id ?? null;
}

async function prestataireIdDe(client: SupabaseClient, nom: unknown): Promise<string | null> {
  if (typeof nom !== "string" || !nom.trim()) return null;
  const r = await client.from("prestataire").select("id").ilike("raison_sociale", nom.trim()).limit(1).maybeSingle<{ id: string }>();
  return r.data?.id ?? null;
}

/** Un prestataire par son numéro (« PRE-2026-00012 ») — la demande d'achat le cite ainsi. */
async function prestataireIdParNumero(client: SupabaseClient, numero: unknown): Promise<string | null> {
  if (typeof numero !== "string" || !numero.trim()) return null;
  const r = await client.from("prestataire").select("id").eq("numero", numero.trim()).limit(1).maybeSingle<{ id: string }>();
  return r.data?.id ?? null;
}

/** Un camion du référentiel tiers, par sa plaque telle qu'on l'écrit ; nul quand la plaque n'y est pas — elle restera libre. */
async function camionTiersDe(client: SupabaseClient, plaque: unknown): Promise<string | null> {
  if (typeof plaque !== "string" || !plaque.trim()) return null;
  const canonique = immatriculationCanonique(plaque.replace(/^tiers:/, ""));
  const r = await client.from("camion_tiers").select("immatriculation").eq("immatriculation", canonique).maybeSingle<{ immatriculation: string }>();
  return r.data?.immatriculation ?? null;
}

async function affretementIdDe(client: SupabaseClient, numero: unknown): Promise<string | null> {
  if (typeof numero !== "string" || !numero.trim()) return null;
  const r = await client.from("affretement").select("id").eq("numero", numero.trim()).maybeSingle<{ id: string }>();
  return r.data?.id ?? null;
}

/** Le libellé de la pièce qu'une évaluation cite, lu sur sa table : ce que l'écran affichera en face de la note. */
async function libellePieceDe(client: SupabaseClient, numero: unknown): Promise<string | null> {
  if (typeof numero !== "string" || !numero.trim()) return null;
  const n = numero.trim();
  const prefixe = n.slice(0, 3).toUpperCase();
  if (prefixe === "INT") {
    const r = await client.from("intervention").select("objet, vehicule (immatriculation)").eq("numero", n).maybeSingle<{ objet: string; vehicule: { immatriculation: string } | null }>();
    return r.data ? `${r.data.objet}${r.data.vehicule ? ` — ${afficher(r.data.vehicule.immatriculation)}` : ""}` : null;
  }
  if (prefixe === "DAC") {
    const r = await client.from("demande_achat").select("objet").eq("numero", n).maybeSingle<{ objet: string }>();
    return r.data?.objet ?? null;
  }
  if (prefixe === "AFF") {
    const r = await client.from("affretement").select("origine, destination").eq("numero", n).maybeSingle<{ origine: string; destination: string }>();
    return r.data ? `${r.data.origine} → ${r.data.destination}` : null;
  }
  if (prefixe === "MAD") {
    const r = await client.from("mise_a_disposition").select("immatriculation, mois").eq("numero", n).maybeSingle<{ immatriculation: string; mois: string }>();
    return r.data ? `${afficher(r.data.immatriculation)} · ${r.data.mois}` : null;
  }
  if (prefixe === "PRS") {
    const r = await client.from("prestation").select("libelle").eq("numero", n).maybeSingle<{ libelle: string }>();
    return r.data?.libelle ?? null;
  }
  return null;
}

async function rattacher(client: SupabaseClient, c: Creation): Promise<Rattachement> {
  const s = decomposerSujet(c.sujet);
  const v = c.valeurs;
  const vehiculeId = (await vehiculeIdDe(client, v.vehiculeId)) ?? (s.genre === "vehicule" ? await vehiculeIdDe(client, s.cle) : null);
  const chauffeurId = (await chauffeurIdDe(client, v.chauffeurId)) ?? (s.genre === "chauffeur" ? await chauffeurIdDe(client, s.cle) : null);
  /* Le prestataire : par son numéro quand la fiche le porte — la fiche
     transporteur porte le sien dans son sujet —, par son nom sinon. */
  const prestataireId =
    (await prestataireIdParNumero(client, v.prestataireNumero)) ??
    (await prestataireIdParNumero(client, v.transporteurNumero)) ??
    (s.genre === "prestataire" ? await prestataireIdParNumero(client, s.cle) : null) ??
    (await prestataireIdDe(client, v.garage ?? v.prestataire ?? v.fournisseur ?? v.beneficiaire ?? v.transporteur));
  /* Le camion du transporteur, s'il est au référentiel ; l'affrètement que cite une ligne de relevé. */
  const transport = c.type === "transport" || c.type === "affretement" || c.type === "mise-a-disposition";
  const camionTiers = transport ? await camionTiersDe(client, v.camion ?? v.immatriculationExterne ?? v.immatriculation ?? v.camionTiersImmatriculation) : null;
  const affretementId = c.type === "transport" ? await affretementIdDe(client, v.affretementNumero) : null;
  /* La demande d'achat nomme qui demande : la personne de la session (son rôle est posé par l'écriture, qui la connaît). */
  if (c.type === "achat" && !v.demandeur) v.demandeur = c.auteur;
  /* Le journal de caisse et celui de la cuve nomment qui enregistre : la personne de la session. */
  if ((c.type === "caisse" || c.type === "cuve") && !v.enregistrePar) v.enregistrePar = c.auteur;
  /* Le demandeur d'un ordre ou d'un affrètement : la personne qui le crée, telle que le navigateur la nomme. */
  if ((c.type === "ordre" || c.type === "affretement") && !v.demandeur) v.demandeur = c.auteur;
  /* L'auteur d'une évaluation, et le libellé de la pièce qu'elle juge, lu sur sa table. */
  if (c.type === "evaluation") {
    if (!v.auteur) v.auteur = c.auteur;
    if (!v.pieceLibelle) v.pieceLibelle = (await libellePieceDe(client, v.pieceNumero)) ?? undefined;
  }
  return { vehiculeId, chauffeurId, prestataireId, camionTiers, affretementId };
}

/** Le numéro suivant du type pour l'année, d'après ce que la table porte déjà. */
async function numeroSuivant(client: SupabaseClient, table: string, type: TypeTransaction, numero: string): Promise<string> {
  const prefixe = `${TYPE_TRANSACTION[type].prefixe}-${numero.split("-")[1]}-`;
  const r = await client.from(table).select("numero").like("numero", `${prefixe}%`).order("numero", { ascending: false }).limit(1).maybeSingle<{ numero: string }>();
  const dernier = r.data ? Number(r.data.numero.slice(prefixe.length)) || 0 : 0;
  return formerNumero(type, `${numero.split("-")[1]}-01-01`, dernier + 1);
}

/** Écrit une création. Le numéro rendu est celui que la base a retenu. */
export async function ecrireCreation(c: Creation): Promise<ResultatEcriture> {
  if (!authentificationReelle()) return { issue: "hors-base" };
  const client = await clientServeur();
  const moi = await utilisateurCourant(client);
  if (!moi) return { issue: "refusee", motif: "Session absente : reconnectez-vous." };

  if (c.type === "statut") return poserStatut(client, moi.utilisateurId, c);
  const table = tableDe(c.type);
  if (!table) return { issue: "hors-base" };

  const r = await rattacher(client, c);
  if (c.type === "achat" && !c.valeurs.demandeurRole) c.valeurs.demandeurRole = moi.role;
  const prep = ligneCreation(c.type, c.numero, c.valeurs, r);
  if ("refus" in prep) return { issue: "refusee", motif: `Non enregistré en base : ${prep.refus}.` };
  const ligne = { ...prep.ligne, cree_par: moi.utilisateurId };

  let ecriture = await client.from(table).insert(ligne);
  let numero = c.numero;
  if (ecriture.error && ecriture.error.code === "23505") {
    numero = await numeroSuivant(client, table, c.type, c.numero);
    ecriture = await client.from(table).insert({ ...ligne, numero });
  }
  if (ecriture.error) return { issue: "refusee", motif: `Non enregistré en base : ${ecriture.error.message}` };
  revalidatePath("/", "layout");
  return { issue: "ecrite", numero };
}

/* Le statut d'un véhicule : sa ligne change, et la trace garde l'avant. */
async function poserStatut(client: SupabaseClient, utilisateurId: string, c: Creation): Promise<ResultatEcriture> {
  const s = decomposerSujet(c.sujet);
  const vehiculeId = (await vehiculeIdDe(client, c.valeurs.vehiculeId)) ?? (s.genre === "vehicule" ? await vehiculeIdDe(client, s.cle) : null);
  if (!vehiculeId) return { issue: "refusee", motif: "Non enregistré en base : véhicule introuvable." };
  const statut = typeof c.valeurs.statut === "string" ? c.valeurs.statut : null;
  if (!statut) return { issue: "refusee", motif: "Non enregistré en base : statut absent." };
  const avant = await client.from("vehicule").select("immatriculation, statut").eq("id", vehiculeId).maybeSingle<{ immatriculation: string; statut: string }>();
  if (!avant.data) return { issue: "refusee", motif: "Non enregistré en base : véhicule introuvable." };
  const maintenant = new Date().toISOString();
  const maj = await client.from("vehicule").update({ statut, modifie_le: maintenant, modifie_par: utilisateurId }).eq("id", vehiculeId);
  if (maj.error) return { issue: "refusee", motif: `Statut refusé : ${maj.error.message}` };
  const motif = [typeof c.valeurs.motif === "string" ? c.valeurs.motif : null, typeof c.valeurs.commentaire === "string" ? c.valeurs.commentaire : null].filter(Boolean).join(" — ") || `Statut posé (${c.numero})`;
  const trace = await client.from("modification").insert({ table_cible: "vehicule", numero: avant.data.immatriculation, champ: "statut", libelle_champ: "Statut", avant: avant.data.statut, apres: statut, motif, statut: "appliquee", cree_par: utilisateurId });
  if (trace.error) return { issue: "refusee", motif: `Statut posé, mais sans trace : ${trace.error.message}` };
  revalidatePath("/", "layout");
  return { issue: "ecrite", numero: c.numero };
}

/** Écrit une modification : la ligne change, et chaque champ changé laisse sa trace. */
export async function ecrireModification(e: { numero: string; type: TypeTransaction; motif: string; diffs: { champ: string; libelleChamp: string; avant: string; apres: string; valeur: unknown }[] }): Promise<ResultatEcriture> {
  if (!authentificationReelle()) return { issue: "hors-base" };
  const table = tableDe(e.type);
  if (!table) return { issue: "hors-base" };
  const client = await clientServeur();
  const moi = await utilisateurCourant(client);
  if (!moi) return { issue: "refusee", motif: "Session absente : reconnectez-vous." };

  const colonnes = colonnesModification(e.type, e.diffs);
  if (Object.keys(colonnes).length > 0) {
    /* Le relevé n'a pas de colonnes de modification : il se corrige rarement, et la trace suffit. */
    const horodate = table === "releve_kilometrique" ? {} : { modifie_le: new Date().toISOString(), modifie_par: moi.utilisateurId };
    const maj = await client.from(table).update({ ...colonnes, ...horodate }).eq("numero", e.numero).select("numero");
    if (maj.error) return { issue: "refusee", motif: `Modification refusée : ${maj.error.message}` };
    if (!maj.data || maj.data.length === 0) return { issue: "refusee", motif: `Modification non appliquée : ${e.numero} n'est pas en base.` };
  }
  const trace = await client.from("modification").insert(e.diffs.map((d) => ({ table_cible: table, numero: e.numero, champ: d.champ, libelle_champ: d.libelleChamp, avant: d.avant, apres: d.apres, motif: e.motif, statut: "appliquee", cree_par: moi.utilisateurId })));
  if (trace.error) return { issue: "refusee", motif: `Modifiée, mais sans trace : ${trace.error.message}` };
  revalidatePath("/", "layout");
  return { issue: "ecrite", numero: e.numero };
}

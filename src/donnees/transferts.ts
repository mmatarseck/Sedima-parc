/* ============================================================================
 * Les fiches de transfert, lues avec la session de l'utilisateur.
 *
 * Base branchée : la table `transfert` (0012), bornée par les politiques au
 * périmètre de la personne — et, pour une partie, à ses fiches. Sinon, les
 * fiches de la démonstration. Une lecture par requête.
 * ==========================================================================*/

import { cache } from "react";
import type { EquipementTransfert, ReserveTransfert, Signature, Transfert } from "@/domaine/transferts";
import type { TypeDocument } from "@/domaine/types";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { transfertsDemo } from "./transferts-demo";

interface LigneTransfert {
  id: string;
  numero: string;
  vehicule_id: string;
  remettant_genre: Transfert["remettant"]["genre"];
  remettant_chauffeur_id: string | null;
  remettant_attributaire_id: string | null;
  remettant_nom: string;
  recipiendaire_genre: Transfert["recipiendaire"]["genre"];
  recipiendaire_chauffeur_id: string | null;
  recipiendaire_attributaire_id: string | null;
  recipiendaire_nom: string;
  date: string;
  motif: string;
  km: number | null;
  carburant: number | null;
  documents_a_bord: string[];
  equipements: EquipementTransfert[];
  reserves: ReserveTransfert[];
  commentaire: string | null;
  signature_remettant: Signature | null;
  signature_recipiendaire: Signature | null;
  annulee_le: string | null;
  appliquee_le: string | null;
  cree_le: string;
  cree_par_nom: string | null;
  vehicule: { immatriculation: string; marque: string; appellation: string; site_id: string | null } | null;
}

function afficher(immatriculation: string): string {
  const m = immatriculation.match(/^([A-Z]{2})(\d{3,4})([A-Z]{2})$/);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : immatriculation;
}

function transfertDepuisLigne(l: LigneTransfert): Transfert {
  return {
    id: l.id,
    numero: l.numero,
    vehicule: { id: l.vehicule_id, immatriculation: l.vehicule ? afficher(l.vehicule.immatriculation) : l.vehicule_id, libelle: l.vehicule ? `${l.vehicule.marque} ${l.vehicule.appellation}` : "", siteId: l.vehicule?.site_id ?? null },
    remettant: { genre: l.remettant_genre, id: l.remettant_chauffeur_id ?? l.remettant_attributaire_id, nom: l.remettant_nom },
    recipiendaire: { genre: l.recipiendaire_genre, id: l.recipiendaire_chauffeur_id ?? l.recipiendaire_attributaire_id, nom: l.recipiendaire_nom },
    date: l.date,
    motif: l.motif,
    km: l.km,
    carburant: l.carburant,
    documentsABord: l.documents_a_bord as TypeDocument[],
    equipements: l.equipements ?? [],
    reserves: l.reserves ?? [],
    commentaire: l.commentaire,
    signatureRemettant: l.signature_remettant,
    signatureRecipiendaire: l.signature_recipiendaire,
    annuleeLe: l.annulee_le,
    appliquee: l.appliquee_le !== null,
    creeLe: l.cree_le,
    creePar: l.cree_par_nom ?? "",
  };
}

async function transfertsServeurBrut(): Promise<Transfert[]> {
  if (!authentificationReelle()) return transfertsDemo();
  const client = await clientServeur();
  const lecture = await client
    .from("transfert")
    .select("id, numero, vehicule_id, remettant_genre, remettant_chauffeur_id, remettant_attributaire_id, remettant_nom, recipiendaire_genre, recipiendaire_chauffeur_id, recipiendaire_attributaire_id, recipiendaire_nom, date, motif, km, carburant, documents_a_bord, equipements, reserves, commentaire, signature_remettant, signature_recipiendaire, annulee_le, appliquee_le, cree_le, cree_par_nom, vehicule (immatriculation, marque, appellation, site_id)")
    .order("date", { ascending: false })
    .limit(1000)
    .returns<LigneTransfert[]>();
  /* Table pas encore jouée : rien à montrer, pas d'erreur. */
  if (lecture.error) {
    console.warn(`Transferts : lecture impossible (${lecture.error.message}).`);
    return [];
  }
  return lecture.data.map(transfertDepuisLigne);
}

export const transfertsServeur = cache(transfertsServeurBrut);

/* ============================================================================
 * Les demandes, lues avec la session de l'utilisateur.
 *
 * Base branchée : la table `demande` (0011), que les politiques bornent au
 * périmètre de la personne — et, pour un détenteur, à ce qui lui est
 * adressé. Sinon, les demandes de la démonstration. Une lecture par requête.
 * ==========================================================================*/

import { cache } from "react";
import type { Demande, TypeDemande } from "@/domaine/demandes";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { demandesDemo } from "./demandes-demo";

interface LigneDemande {
  id: string;
  numero: string;
  lot: string;
  type: TypeDemande;
  vehicule_id: string;
  chauffeur_id: string | null;
  attributaire_id: string | null;
  destinataire_nom: string;
  message: string | null;
  emise_le: string;
  emise_par_nom: string | null;
  echeance: string;
  repondue_le: string | null;
  reponse_valeur: number | string | null;
  reponse_texte: string | null;
  reponse_photo: string | null;
  reponse_commentaire: string | null;
  annulee_le: string | null;
  vehicule: { immatriculation: string; marque: string; appellation: string; site_id: string | null } | null;
}

function afficher(immatriculation: string): string {
  const m = immatriculation.match(/^([A-Z]{2})(\d{3,4})([A-Z]{2})$/);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : immatriculation;
}

function demandeDepuisLigne(l: LigneDemande): Demande {
  return {
    id: l.id,
    numero: l.numero,
    lot: l.lot,
    type: l.type,
    vehicule: { id: l.vehicule_id, immatriculation: l.vehicule ? afficher(l.vehicule.immatriculation) : l.vehicule_id, libelle: l.vehicule ? `${l.vehicule.marque} ${l.vehicule.appellation}` : "", siteId: l.vehicule?.site_id ?? null },
    detenteur: l.chauffeur_id ? { genre: "chauffeur", id: l.chauffeur_id, nom: l.destinataire_nom } : { genre: "attributaire", id: l.attributaire_id ?? "", nom: l.destinataire_nom },
    message: l.message,
    emiseLe: l.emise_le,
    emisePar: l.emise_par_nom ?? "",
    echeance: l.echeance,
    reponse: l.repondue_le ? { le: l.repondue_le, valeur: l.reponse_valeur === null ? null : Number(l.reponse_valeur), texte: l.reponse_texte, photo: l.reponse_photo, commentaire: l.reponse_commentaire } : null,
    annuleeLe: l.annulee_le,
  };
}

async function demandesServeurBrut(): Promise<Demande[]> {
  if (!authentificationReelle()) return demandesDemo();
  const client = await clientServeur();
  const lecture = await client
    .from("demande")
    .select("id, numero, lot, type, vehicule_id, chauffeur_id, attributaire_id, destinataire_nom, message, emise_le, emise_par_nom, echeance, repondue_le, reponse_valeur, reponse_texte, reponse_photo, reponse_commentaire, annulee_le, vehicule (immatriculation, marque, appellation, site_id)")
    .order("emise_le", { ascending: false })
    .limit(2000)
    .returns<LigneDemande[]>();
  /* Table pas encore jouée : rien à montrer, pas d'erreur — l'écran dit « aucune demande ». */
  if (lecture.error) {
    console.warn(`Demandes : lecture impossible (${lecture.error.message}).`);
    return [];
  }
  return lecture.data.map(demandeDepuisLigne);
}

export const demandesServeur = cache(demandesServeurBrut);

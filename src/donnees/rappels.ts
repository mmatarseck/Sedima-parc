/* ============================================================================
 * Les rappels, lus avec la session de l'utilisateur (0053).
 *
 * Trois lectures, un seul convertisseur : tous les rappels pour la Conformité,
 * ceux d'un véhicule pour sa fiche, ceux d'un chauffeur pour la sienne. Les
 * trois disent donc la même chose — c'est la règle apprise sur les incidents.
 *
 * Le libellé du type vient des paramètres, relus à chaque requête : un type
 * renommé dans Paramètres › Documents se renomme partout d'un coup.
 * ==========================================================================*/

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { idChauffeur } from "@/domaine/chauffeur";
import { afficher } from "@/domaine/immatriculation";
import type { Parametres } from "@/domaine/parametres";
import type { Rappel } from "@/domaine/rappels";
import { clientServeur } from "@/lib/supabase";
import { parametresServeur } from "@/lib/parametres-serveur";
import { lignesLues } from "./lecture";

interface LigneRappelBase {
  id: string;
  numero: string;
  vehicule_id: string | null;
  chauffeur_id: string | null;
  type_document_id: string;
  echeance: string;
  fait_le: string | null;
  document_numero: string | null;
  commentaire: string | null;
  vehicule: { immatriculation: string; marque: string; appellation: string } | null;
  chauffeur: { nom: string; prenom: string } | null;
}

const CHAMPS_RAPPEL = "id, numero, vehicule_id, chauffeur_id, type_document_id, echeance, fait_le, document_numero, commentaire, vehicule (immatriculation, marque, appellation), chauffeur (nom, prenom)";

function humaniser(id: string): string {
  return id.replace(/^doc-/, "").replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function rappelDepuisLigne(l: LigneRappelBase, parametres: Parametres): Rappel {
  const type = parametres.documents.types.find((t) => t.id === l.type_document_id);
  const nomChauffeur = l.chauffeur ? `${l.chauffeur.prenom} ${l.chauffeur.nom}`.trim() : null;
  return {
    id: l.id,
    numero: l.numero,
    porteur: l.vehicule_id ? "vehicule" : "chauffeur",
    vehiculeId: l.vehicule_id,
    immatriculation: l.vehicule?.immatriculation ?? null,
    immatriculationAffichee: l.vehicule ? afficher(l.vehicule.immatriculation) : null,
    vehicule: l.vehicule ? `${l.vehicule.marque} ${l.vehicule.appellation}` : null,
    chauffeurId: l.chauffeur_id,
    chauffeur: nomChauffeur,
    chauffeurAdresse: nomChauffeur ? idChauffeur(nomChauffeur) : null,
    type: l.type_document_id,
    /* Un type retiré des paramètres garde un nom lisible : le rappel, lui, est toujours là. */
    libelle: type?.libelle ?? humaniser(l.type_document_id),
    echeance: l.echeance,
    faitLe: l.fait_le,
    documentNumero: l.document_numero,
    commentaire: l.commentaire,
  };
}

async function rappelsServeurBrut(): Promise<Rappel[]> {
  const [client, parametres] = await Promise.all([clientServeur(), parametresServeur()]);
  const lecture = await client.from("rappel").select(CHAMPS_RAPPEL).order("echeance").limit(5000).returns<LigneRappelBase[]>();
  return lignesLues("Rappels", lecture).map((l) => rappelDepuisLigne(l, parametres));
}

/** Tous les rappels du périmètre, du plus pressé au plus lointain. */
export const rappelsServeur = cache(rappelsServeurBrut);

/** Les rappels d'un véhicule, par l'identifiant de sa table — jamais sa plaque. */
export async function rappelsDuVehicule(client: SupabaseClient, vehiculeId: string, parametres: Parametres): Promise<Rappel[]> {
  const lecture = await client.from("rappel").select(CHAMPS_RAPPEL).eq("vehicule_id", vehiculeId).order("echeance").limit(200).returns<LigneRappelBase[]>();
  return lignesLues("Rappels du véhicule", lecture).map((l) => rappelDepuisLigne(l, parametres));
}

/** Les rappels d'un chauffeur, par l'identifiant de sa table. */
export async function rappelsDuChauffeur(client: SupabaseClient, chauffeurId: string, parametres: Parametres): Promise<Rappel[]> {
  const lecture = await client.from("rappel").select(CHAMPS_RAPPEL).eq("chauffeur_id", chauffeurId).order("echeance").limit(200).returns<LigneRappelBase[]>();
  return lignesLues("Rappels du chauffeur", lecture).map((l) => rappelDepuisLigne(l, parametres));
}

/**
 * Les rappels d'un chauffeur, par l'adresse de sa fiche (« babacar-ndiaye »).
 *
 * La ligne d'un chauffeur porte cette adresse comme identifiant, pas celui de
 * la table — c'est le piège qui a caché les pièces jointes des véhicules
 * pendant une journée. Plutôt que de deviner un UUID, on lit les rappels qui
 * portent un chauffeur, avec son nom, et on retient ceux dont le nom donne
 * cette adresse. Quelques dizaines de lignes au plus : moins qu'une résolution
 * de plus à maintenir.
 */
export async function rappelsDuChauffeurParAdresse(client: SupabaseClient, adresse: string, parametres: Parametres): Promise<Rappel[]> {
  const lecture = await client.from("rappel").select(CHAMPS_RAPPEL).not("chauffeur_id", "is", null).order("echeance").limit(2000).returns<LigneRappelBase[]>();
  return lignesLues("Rappels des chauffeurs", lecture)
    .map((l) => rappelDepuisLigne(l, parametres))
    .filter((r) => r.chauffeurAdresse === adresse);
}

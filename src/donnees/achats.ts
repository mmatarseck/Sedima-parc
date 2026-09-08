/* ============================================================================
 * Les demandes d'achat, lues avec la session de l'utilisateur.
 *
 * Base branchée : la table `demande_achat` (0022) avec le véhicule et le
 * prestataire joints ; en démonstration, les demandes du jeu. Le budget, le
 * compte des prestataires et les rapports lisent encore la démonstration :
 * ils attendent leur propre branchement.
 * ==========================================================================*/

import { cache } from "react";
import { lienOrigine, type LigneAchat } from "@/domaine/caisse";
import { afficher } from "@/domaine/immatriculation";
import type { Role } from "@/domaine/roles";
import type { BusinessUnit, PosteDepense } from "@/domaine/types";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { demandesAchat } from "./caisse-demo";

export interface LigneAchatBase {
  numero: string;
  date: string;
  objet: string;
  poste: PosteDepense;
  montant_estime: number;
  fournisseur: string | null;
  urgence: LigneAchat["urgence"];
  origine_numero: string;
  origine_libelle: string | null;
  demandeur_nom: string | null;
  demandeur_role: Role | null;
  etape: LigneAchat["etape"];
  visa_par: string | null;
  visa_le: string | null;
  valide_par: string | null;
  validee_le: string | null;
  numero_demande_x3: string | null;
  numero_bon_commande: string | null;
  montant_engage: number | null;
  date_livraison: string | null;
  date_facture: string | null;
  montant_reel: number | null;
  date_reglement: string | null;
  depense_numero: string | null;
  commentaire_decision: string | null;
  vehicule: { immatriculation: string; business_unit: BusinessUnit | null; site: { libelle: string } | null } | null;
  prestataire: { numero: string; raison_sociale: string } | null;
}

export function achatDepuisLigne(l: LigneAchatBase): LigneAchat {
  const v = l.vehicule;
  const immat = v?.immatriculation ?? null;
  return {
    numero: l.numero,
    date: l.date,
    objet: l.objet,
    poste: l.poste,
    montantEstime: Number(l.montant_estime),
    prestataireNumero: l.prestataire?.numero ?? null,
    fournisseur: l.prestataire?.raison_sociale ?? l.fournisseur,
    urgence: l.urgence,
    origineNumero: l.origine_numero,
    origineLibelle: l.origine_libelle,
    origineHref: lienOrigine(l.origine_numero, immat),
    vehiculeId: immat,
    immatriculation: immat,
    immatriculationAffichee: immat ? afficher(immat) : null,
    businessUnit: v?.business_unit ?? null,
    site: v?.site?.libelle ?? null,
    demandeur: l.demandeur_nom ?? "—",
    demandeurRole: l.demandeur_role ?? "gestionnaire-parc",
    etape: l.etape,
    visaPar: l.visa_par,
    visaLe: l.visa_le,
    validePar: l.valide_par,
    valideeLe: l.validee_le,
    numeroDemandeX3: l.numero_demande_x3,
    numeroBonCommande: l.numero_bon_commande,
    montantEngage: l.montant_engage === null ? null : Number(l.montant_engage),
    dateLivraison: l.date_livraison,
    dateFacture: l.date_facture,
    montantReel: l.montant_reel === null ? null : Number(l.montant_reel),
    dateReglement: l.date_reglement,
    depenseNumero: l.depense_numero,
    commentaireDecision: l.commentaire_decision,
    creee: false,
  };
}

async function achatsServeurBrut(): Promise<LigneAchat[]> {
  if (!authentificationReelle()) return demandesAchat();
  const client = await clientServeur();
  const lecture = await client
    .from("demande_achat")
    .select("numero, date, objet, poste, montant_estime, fournisseur, urgence, origine_numero, origine_libelle, demandeur_nom, demandeur_role, etape, visa_par, visa_le, valide_par, validee_le, numero_demande_x3, numero_bon_commande, montant_engage, date_livraison, date_facture, montant_reel, date_reglement, depense_numero, commentaire_decision, vehicule (immatriculation, business_unit, site (libelle)), prestataire (numero, raison_sociale)")
    .order("date", { ascending: false })
    .limit(3000)
    .returns<LigneAchatBase[]>();
  /* Table pas encore jouée : aucune demande, pas d'erreur. */
  if (lecture.error) {
    console.warn(`Demandes d'achat : lecture impossible (${lecture.error.message}).`);
    return [];
  }
  return lecture.data.map(achatDepuisLigne);
}

export const achatsServeur = cache(achatsServeurBrut);

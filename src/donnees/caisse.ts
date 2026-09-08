/* ============================================================================
 * La caisse parc, lue avec la session de l'utilisateur.
 *
 * Base branchée : le journal vient de `mouvement_caisse` (0017), les dépenses
 * à régler sont celles de la table `depense` payées par la caisse qu'aucune
 * sortie ne cite encore, le solde de départ et le seuil sont le paramètre
 * « caisse ». Le solde de chaque ligne se déduit, comme en démonstration.
 * Les demandes d'achat n'ont pas encore de table : base branchée, l'écran
 * n'en montre aucune.
 * ==========================================================================*/

import { cache } from "react";
import { avecSolde, type LigneMouvement, type SensCaisse } from "@/domaine/caisse";
import { afficher } from "@/domaine/immatriculation";
import type { BusinessUnit, PosteDepense } from "@/domaine/types";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { SOLDE_INITIAL, depensesAReglier, journalCaisse, type DepenseCaisse } from "./caisse-demo";

/** Le seuil sous lequel la caisse appelle un réapprovisionnement, faute de paramètre. */
export const SEUIL_CAISSE_DEFAUT = 200_000;

export interface ParametresCaisse {
  soldeInitial: number;
  seuil: number;
}

/** La valeur du paramètre « caisse », remise d'aplomb champ par champ. */
export function parametresCaisseDepuis(valeur: unknown): ParametresCaisse {
  const v = (valeur && typeof valeur === "object" ? valeur : {}) as Record<string, unknown>;
  const n = (x: unknown, defaut: number) => (typeof x === "number" && Number.isFinite(x) ? x : typeof x === "string" && x.trim() && Number.isFinite(Number(x)) ? Number(x) : defaut);
  return { soldeInitial: n(v.solde_initial, SOLDE_INITIAL), seuil: n(v.seuil, SEUIL_CAISSE_DEFAUT) };
}

export interface LigneCaisseBase {
  numero: string;
  date: string;
  sens: SensCaisse;
  libelle: string;
  montant: number;
  beneficiaire: string | null;
  piece: string | null;
  justificatif: boolean;
  depense_numero: string | null;
  enregistre_par: string | null;
}

export interface LigneDepenseCaisseBase {
  numero: string;
  date: string;
  libelle: string;
  montant: number;
  poste: PosteDepense;
  beneficiaire: string | null;
  reference: string | null;
  justificatif: boolean;
  vehicule: { immatriculation: string; business_unit: BusinessUnit | null; site: { libelle: string } | null } | null;
}

export function depenseCaisseDepuisLigne(d: LigneDepenseCaisseBase): DepenseCaisse {
  const v = d.vehicule;
  return {
    numero: d.numero,
    date: d.date,
    libelle: d.libelle,
    montant: Number(d.montant),
    poste: d.poste,
    beneficiaire: d.beneficiaire,
    reference: d.reference,
    justificatif: d.justificatif,
    /* Une dépense sans véhicule (frais d'un chauffeur) reste dans la caisse : elle n'ouvre simplement aucune fiche. */
    vehiculeId: v?.immatriculation ?? "",
    immatriculation: v?.immatriculation ?? "",
    immatriculationAffichee: v ? afficher(v.immatriculation) : "—",
    businessUnit: v?.business_unit ?? null,
    site: v?.site?.libelle ?? null,
  };
}

/** Le journal, solde déduit sur chaque ligne ; une sortie retrouve son véhicule par la dépense qu'elle cite. */
export function journalDepuisLaBase(mouvements: LigneCaisseBase[], depenses: DepenseCaisse[], soldeInitial: number): LigneMouvement[] {
  const parNumero = new Map(depenses.map((d) => [d.numero, d]));
  const lignes: LigneMouvement[] = mouvements.map((m) => {
    const d = m.depense_numero ? (parNumero.get(m.depense_numero) ?? null) : null;
    return {
      numero: m.numero,
      date: m.date,
      sens: m.sens,
      libelle: m.libelle,
      montant: Number(m.montant),
      beneficiaire: m.beneficiaire,
      piece: m.piece,
      justificatif: m.justificatif,
      depenseNumero: m.depense_numero,
      poste: d?.poste ?? null,
      vehiculeId: d?.vehiculeId || null,
      immatriculation: d?.immatriculation || null,
      immatriculationAffichee: d && d.immatriculation ? d.immatriculationAffichee : null,
      businessUnit: d?.businessUnit ?? null,
      site: d?.site ?? null,
      soldeApres: 0,
      enregistrePar: m.enregistre_par ?? "—",
      creee: false,
    };
  });
  return avecSolde(lignes, soldeInitial);
}

/** Les dépenses payées par la caisse qu'aucune sortie ne règle encore, les plus récentes en premier. */
export function aReglerDepuisLaBase(depenses: DepenseCaisse[], mouvements: LigneCaisseBase[]): DepenseCaisse[] {
  const reglees = new Set(mouvements.map((m) => m.depense_numero).filter((n): n is string => n !== null));
  return depenses.filter((d) => !reglees.has(d.numero)).sort((a, b) => b.date.localeCompare(a.date) || b.numero.localeCompare(a.numero));
}

export interface CaisseServeur {
  mouvements: LigneMouvement[];
  depensesARegler: DepenseCaisse[];
  soldeInitial: number;
  seuil: number;
}

async function caisseServeurBrut(): Promise<CaisseServeur> {
  if (!authentificationReelle()) return { mouvements: journalCaisse(), depensesARegler: depensesAReglier(), soldeInitial: SOLDE_INITIAL, seuil: SEUIL_CAISSE_DEFAUT };
  const client = await clientServeur();
  const [mouvements, depenses, parametre] = await Promise.all([
    client.from("mouvement_caisse").select("numero, date, sens, libelle, montant, beneficiaire, piece, justificatif, depense_numero, enregistre_par").order("date", { ascending: false }).limit(5000).returns<LigneCaisseBase[]>(),
    client.from("depense").select("numero, date, libelle, montant, poste, beneficiaire, reference, justificatif, vehicule (immatriculation, business_unit, site (libelle))").eq("origine", "caisse").order("date", { ascending: false }).limit(5000).returns<LigneDepenseCaisseBase[]>(),
    client.from("parametre").select("valeur").eq("cle", "caisse").maybeSingle<{ valeur: unknown }>(),
  ]);
  /* Table pas encore jouée : un journal vide, pas d'erreur. */
  if (mouvements.error) console.warn(`Caisse : lecture impossible (${mouvements.error.message}).`);
  if (depenses.error) console.warn(`Dépenses de caisse : lecture impossible (${depenses.error.message}).`);
  const p = parametresCaisseDepuis(parametre.data?.valeur);
  const lignesCaisse = mouvements.data ?? [];
  const lignesDepenses = (depenses.data ?? []).map(depenseCaisseDepuisLigne);
  return { mouvements: journalDepuisLaBase(lignesCaisse, lignesDepenses, p.soldeInitial), depensesARegler: aReglerDepuisLaBase(lignesDepenses, lignesCaisse), soldeInitial: p.soldeInitial, seuil: p.seuil };
}

export const caisseServeur = cache(caisseServeurBrut);

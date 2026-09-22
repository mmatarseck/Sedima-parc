/* ============================================================================
 * La caisse parc, lue avec la session de l'utilisateur.
 *
 * Base branchée : le journal vient de `mouvement_caisse` (0017), les dépenses
 * à régler sont celles de la table `depense` payées par la caisse qu'aucune
 * sortie ne cite encore, le solde de départ et le seuil viennent des
 * paramètres (Paramètres › Caisse et cuve). Le solde de chaque ligne se
 * déduit, comme en démonstration.
 * Les demandes d'achat n'ont pas encore de table : base branchée, l'écran
 * n'en montre aucune.
 * ==========================================================================*/

import { lignesLues } from "./lecture";
import { cache } from "react";
import { avecSolde, type LigneMouvement, type SensCaisse } from "@/domaine/caisse";
import { afficher } from "@/domaine/immatriculation";
import type { Parametres } from "@/domaine/parametres";
import type { BusinessUnit, PosteDepense } from "@/domaine/types";
import { clientServeur } from "@/lib/supabase";
import { calculerService, lireLignes } from "@/domaine/service";
import type { DepenseCaisse } from "./caisse-demo";

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

/**
 * Ce qui attend la caisse, et qu'aucune sortie ne cite encore, le plus récent en premier :
 * les dépenses payées par la caisse, les pleins pris en station, les services réglés par la
 * caisse (0063). Une dépense écrite par la clôture d'un service (sa référence cite l'OTR) se
 * règle avec son service, pas seule.
 */
export function aReglerDepuisLaBase(depenses: DepenseCaisse[], mouvements: LigneCaisseBase[]): DepenseCaisse[] {
  const reglees = new Set(mouvements.map((m) => m.depense_numero).filter((n): n is string => n !== null));
  return depenses.filter((d) => !reglees.has(d.numero) && !(d.objet !== "service" && /\bOTR-/.test(d.reference ?? ""))).sort((a, b) => b.date.localeCompare(a.date) || b.numero.localeCompare(a.numero));
}

export interface CaisseServeur {
  mouvements: LigneMouvement[];
  depensesARegler: DepenseCaisse[];
  soldeInitial: number;
  seuil: number;
}

async function caisseServeurBrut(parametres: Parametres): Promise<CaisseServeur> {
  const p = parametres.caisse;
  const client = await clientServeur();
  const [mouvements, depenses] = await Promise.all([
    client.from("mouvement_caisse").select("numero, date, sens, libelle, montant, beneficiaire, piece, justificatif, depense_numero, enregistre_par").order("date", { ascending: false }).limit(5000).returns<LigneCaisseBase[]>(),
    client.from("depense").select("numero, date, libelle, montant, poste, beneficiaire, reference, justificatif, vehicule (immatriculation, business_unit, site (libelle))").eq("origine", "caisse").order("date", { ascending: false }).limit(5000).returns<LigneDepenseCaisseBase[]>(),
  ]);
  const lignesCaisse = lignesLues("Mouvements de caisse", mouvements);
  const lignesDepenses = [...lignesLues("Dépenses de caisse", depenses).map(depenseCaisseDepuisLigne), ...(await pleinsEtServicesARegler(client))];
  return { mouvements: journalDepuisLaBase(lignesCaisse, lignesDepenses, p.soldeInitial), depensesARegler: aReglerDepuisLaBase(lignesDepenses, lignesCaisse), soldeInitial: p.soldeInitial, seuil: p.seuil };
}

export const caisseServeur = cache(caisseServeurBrut);

/**
 * Les pleins pris en station des quatre-vingt-dix derniers jours — la cuve interne ne se paie
 * pas en caisse — et les services dont le règlement est « caisse » (0063). Sans 0063, les
 * services manquent seuls.
 */
async function pleinsEtServicesARegler(client: Awaited<ReturnType<typeof clientServeur>>): Promise<DepenseCaisse[]> {
  const depuis = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const vehicule = (v: { immatriculation: string; business_unit: BusinessUnit | null; site: { libelle: string } | null } | null) => ({
    vehiculeId: v?.immatriculation ?? "",
    immatriculation: v?.immatriculation ?? "",
    immatriculationAffichee: v ? afficher(v.immatriculation) : "—",
    businessUnit: v?.business_unit ?? null,
    site: v?.site?.libelle ?? null,
  });
  type V = { immatriculation: string; business_unit: BusinessUnit | null; site: { libelle: string } | null } | null;
  const [pleins, services] = await Promise.all([
    /* Seul un plein remboursable attend la caisse (0065) ; sans la migration, tous ceux de station. */
    (async () => {
      const lire = (remboursables: boolean) => {
        const q = client.from("plein").select("numero, date, litres, montant, source, reference, photo, vehicule (immatriculation, business_unit, site (libelle))").gte("date", depuis).not("source", "ilike", "%cuve%");
        return (remboursables ? q.eq("remboursable", true) : q).order("date", { ascending: false }).limit(2000).returns<{ numero: string; date: string; litres: number; montant: number; source: string | null; reference: string | null; photo: string | null; vehicule: V }[]>();
      };
      const r = await lire(true);
      return r.error ? lire(false) : r;
    })(),
    client.from("ordre_travail").select("numero, date_prevue, objet, garage, statut, lignes, remise_mode, remise_valeur, tva_taux, brs_taux, main_oeuvre_globale, montant_estime, numero_facture, vehicule (immatriculation, business_unit, site (libelle))").eq("mode_reglement", "caisse").neq("statut", "annule").limit(1000).returns<{ numero: string; date_prevue: string; objet: string; garage: string | null; statut: string; lignes: unknown; remise_mode: "montant" | "pourcentage" | null; remise_valeur: number | null; tva_taux: number | null; brs_taux: number | null; main_oeuvre_globale: number | null; montant_estime: number | null; numero_facture: string | null; vehicule: V }[]>(),
  ]);
  const deCarburant: DepenseCaisse[] = (pleins.error ? [] : (pleins.data ?? [])).map((p) => ({
    numero: p.numero,
    objet: "carburant",
    date: p.date,
    libelle: `Plein de ${Number(p.litres)} L — ${p.source ?? "station"}`,
    montant: Number(p.montant),
    poste: "carburant",
    beneficiaire: p.source,
    reference: p.reference,
    justificatif: Boolean(p.photo),
    ...vehicule(p.vehicule),
  }));
  const deServices: DepenseCaisse[] = (services.error ? [] : (services.data ?? [])).map((o) => {
    const lignes = lireLignes(o.lignes);
    const t = lignes.length || o.main_oeuvre_globale ? calculerService({ lignes, mainOeuvreGlobale: Number(o.main_oeuvre_globale ?? 0), remiseMode: o.remise_mode ?? "montant", remiseValeur: Number(o.remise_valeur ?? 0), tvaTaux: Number(o.tva_taux ?? 0), brsTaux: Number(o.brs_taux ?? 0) }) : null;
    return {
      numero: o.numero,
      objet: "service",
      date: o.date_prevue,
      libelle: `Service — ${o.objet}`,
      /* Ce que la caisse verse au garage : le net à payer, BRS retenue. */
      montant: t ? t.netAPayer : Number(o.montant_estime ?? 0),
      poste: "maintenance-curative",
      beneficiaire: o.garage,
      reference: o.numero_facture,
      justificatif: Boolean(o.numero_facture),
      ...vehicule(o.vehicule),
    };
  });
  return [...deCarburant, ...deServices];
}

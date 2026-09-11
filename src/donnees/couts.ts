/* ============================================================================
 * Les coûts mensuels de chaque véhicule, lus avec la session de l'utilisateur.
 *
 * C'est la matière des rapports de coûts (par véhicule, par poste, par
 * business unit, par catégorie) et des indicateurs de douze mois. Base
 * branchée : les dépenses de deux ans avec leur poste (une lecture bornée),
 * les consommations mensuelles déjà calculées pour Carburant, et les
 * interventions ; le tout mis au mois, véhicule par véhicule, à la forme que
 * le domaine des coûts attend (`DonneesVehicule`). Sinon, les coûts de la
 * démonstration.
 * ==========================================================================*/

import { cache } from "react";
import { REFERENCE_L100 } from "@/domaine/assembler-fiche";
import type { ConsommationMensuelleFlotte } from "@/domaine/carburant";
import type { DonneesVehicule, MoisVehicule } from "@/domaine/couts";
import type { LigneInterventionFlotte } from "@/domaine/maintenance";
import { depensesForfaitsDe, type DepenseForfait } from "@/domaine/parc-leger";
import type { Parametres } from "@/domaine/parametres";
import type { CategorieVehicule, LigneFlotte, PosteDepense } from "@/domaine/types";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { carburantServeur } from "./carburant";
import { donneesCouts } from "./couts-demo";
import { lignesFlotte } from "./flotte";
import { interventionsServeur } from "./maintenance";
import { parcLegerServeur } from "./parc-leger";

/** Une dépense telle que les coûts la lisent : sa date, son poste, son montant, son véhicule. */
export interface LigneDepenseCout {
  date: string;
  poste: PosteDepense;
  montant: number | string;
  vehicule: { immatriculation: string } | null;
}

/** Les vingt-quatre mois qui se terminent au mois d'aujourd'hui. */
function moisServis(aujourdhui: string): string[] {
  const [a, m] = aujourdhui.split("-").map(Number);
  const liste: string[] = [];
  for (let k = 23; k >= 0; k--) liste.push(new Date(Date.UTC(a!, m! - 1 - k, 1)).toISOString().slice(0, 7));
  return liste;
}

/**
 * Les coûts de chaque véhicule depuis ce que la base a rendu — pure, pour le
 * banc d'essai. Le parc léger apporte ses forfaits carburant en dépense de
 * carburant, sur chaque véhicule de fonction en circulation.
 */
export function donneesCoutsDepuisLaBase(lignes: LigneFlotte[], depenses: LigneDepenseCout[], consommations: ConsommationMensuelleFlotte[], interventions: LigneInterventionFlotte[], aujourdhui: string, forfaits: DepenseForfait[] = []): DonneesVehicule[] {
  const mois = moisServis(aujourdhui);
  const retenu = new Set(mois);
  const parVehicule = new Map<string, Map<string, MoisVehicule>>();
  const de = (immat: string, m: string): MoisVehicule => {
    let parMois = parVehicule.get(immat);
    if (!parMois) {
      parMois = new Map();
      parVehicule.set(immat, parMois);
    }
    let x = parMois.get(m);
    if (!x) {
      x = { mois: m, km: 0, litres: 0, parPoste: {}, curatifs: 0, immobilisationJours: 0 };
      parMois.set(m, x);
    }
    return x;
  };
  for (const d of depenses) {
    if (!d.vehicule) continue;
    const m = d.date.slice(0, 7);
    if (!retenu.has(m)) continue;
    const x = de(d.vehicule.immatriculation, m);
    x.parPoste[d.poste] = (x.parPoste[d.poste] ?? 0) + Number(d.montant);
  }
  for (const f of forfaits) {
    if (!retenu.has(f.mois)) continue;
    const x = de(f.immatriculation, f.mois);
    x.parPoste.carburant = (x.parPoste.carburant ?? 0) + f.montant;
  }
  for (const c of consommations) {
    if (!retenu.has(c.mois)) continue;
    const x = de(c.vehiculeId, c.mois);
    x.km += c.kmParcourus;
    x.litres += c.litres;
  }
  for (const i of interventions) {
    const m = i.date.slice(0, 7);
    if (!retenu.has(m)) continue;
    const x = de(i.vehiculeId, m);
    if (i.type === "curatif") x.curatifs += 1;
    x.immobilisationJours = x.immobilisationJours === null || i.immobilisationJours === null ? null : x.immobilisationJours + i.immobilisationJours;
  }
  const resultat: DonneesVehicule[] = [];
  for (const l of lignes) {
    const v = l.vehicule;
    if (v.statut === "a-recevoir") continue;
    const parMois = parVehicule.get(v.id) ?? new Map<string, MoisVehicule>();
    const mec = v.premiereMiseEnCirculation;
    resultat.push({
      vehiculeId: v.id,
      immatriculation: v.immatriculation,
      immatriculationAffichee: v.immatriculationAffichee,
      libelle: `${v.marque} ${v.appellation}`,
      categorie: v.categorie,
      categorieFlotte: v.categorieFlotte,
      businessUnit: v.businessUnit,
      site: l.site?.libelle ?? null,
      statut: l.statutEffectif ?? v.statut,
      referenceL100: REFERENCE_L100[v.categorie as CategorieVehicule] ?? 20,
      ageAnnees: mec ? Math.round(((Date.parse(aujourdhui) - Date.parse(mec)) / (365.25 * 86_400_000)) * 10) / 10 : null,
      mois: mois.map((m) => parMois.get(m) ?? { mois: m, km: 0, litres: 0, parPoste: {}, curatifs: 0, immobilisationJours: 0 }),
    });
  }
  return resultat;
}

async function coutsServeurBrut(parametres: Parametres): Promise<DonneesVehicule[]> {
  if (!authentificationReelle()) return donneesCouts();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const client = await clientServeur();
  const [lignes, depenses, carburant, interventions, parcLeger] = await Promise.all([
    lignesFlotte(parametres),
    client
      .from("depense")
      .select("date, poste, montant, vehicule (immatriculation)")
      .not("vehicule_id", "is", null)
      .gte("date", `${moisServis(aujourdhui)[0]}-01`)
      .limit(20000)
      .returns<LigneDepenseCout[]>(),
    carburantServeur(parametres),
    interventionsServeur(),
    parcLegerServeur(parametres),
  ]);
  if (depenses.error) console.warn(`Coûts : dépenses illisibles (${depenses.error.message}).`);
  return donneesCoutsDepuisLaBase(lignes, depenses.data ?? [], carburant.consommations, interventions, aujourdhui, depensesForfaitsDe(parcLeger, aujourdhui, parametres.parcLeger.forfaitCarburantMensuel));
}

export const coutsServeur = cache(coutsServeurBrut);

/* ============================================================================
 * Le carburant, lu avec la session de l'utilisateur.
 *
 * Base branchée : les pleins de toute la flotte viennent de la table `plein`
 * avec le véhicule et la station ; le journal de la cuve de `mouvement_cuve`
 * (0017) — livraisons et relevés de jauge —, ses sorties étant les pleins pris
 * à la cuve, que l'écran reconstruit comme en démonstration ; le stock de
 * départ vient des paramètres (Paramètres › Caisse et cuve). La consommation
 * par véhicule et par mois
 * se calcule sur les pleins et les relevés du parc lu pour la liste Flotte.
 * ==========================================================================*/

import { cache } from "react";
import { REFERENCE_L100 } from "@/domaine/assembler-fiche";
import { estCuve, type ConsommationMensuelleFlotte, type LigneCuve, type LignePlein, type SensCuve } from "@/domaine/carburant";
import { afficher } from "@/domaine/immatriculation";
import { CATEGORIE_VEHICULE } from "@/domaine/libelles";
import type { Parametres } from "@/domaine/parametres";
import type { BusinessUnit, CategorieVehicule } from "@/domaine/types";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { consommationsMensuelles, livraisonsEtJauges, pleinsFlotte } from "./carburant-demo";
import { parcServeur, type ParcBrut } from "./flotte";

/* -- Pleins -------------------------------------------------------------------- */

export interface LignePleinBase {
  numero: string;
  vehicule_id: string;
  date: string;
  litres: number | string;
  prix_litre: number;
  montant: number;
  km: number | null;
  source: string;
  reference: string | null;
  vehicule: { immatriculation: string; marque: string; appellation: string; business_unit: BusinessUnit | null; site: { libelle: string } | null } | null;
  prestataire: { raison_sociale: string } | null;
}

export function pleinDepuisLigne(l: LignePleinBase): LignePlein {
  const v = l.vehicule;
  return {
    id: l.numero,
    numero: l.numero,
    date: l.date,
    /* Un plein à la cuve reste « cuve » même si une station est nommée par erreur : c'est la source qui sort du stock. */
    source: estCuve(l.source) ? l.source : (l.prestataire?.raison_sociale ?? l.source),
    litres: Number(l.litres),
    prixLitre: l.prix_litre,
    montant: Number(l.montant),
    reference: l.reference ?? "",
    km: l.km,
    kmMotifRejet: null,
    vehiculeId: v?.immatriculation ?? l.vehicule_id,
    immatriculation: v?.immatriculation ?? l.vehicule_id,
    immatriculationAffichee: v ? afficher(v.immatriculation) : l.vehicule_id,
    vehicule: v ? `${v.marque} ${v.appellation}` : "—",
    businessUnit: v?.business_unit ?? null,
    site: v?.site?.libelle ?? null,
    creee: false,
  };
}

/* -- Cuve --------------------------------------------------------------------- */

export interface LigneCuveBase {
  numero: string;
  date: string;
  sens: SensCuve;
  libelle: string;
  litres: number | string;
  prix_litre: number | null;
  montant: number | null;
  fournisseur: string | null;
  piece: string | null;
  commentaire: string | null;
  enregistre_par: string | null;
  prestataire: { raison_sociale: string } | null;
}

export function cuveDepuisLigne(l: LigneCuveBase): LigneCuve {
  return {
    numero: l.numero,
    date: l.date,
    sens: l.sens,
    libelle: l.libelle,
    litres: Number(l.litres),
    prixLitre: l.prix_litre,
    montant: l.montant === null ? null : Number(l.montant),
    fournisseur: l.prestataire?.raison_sociale ?? l.fournisseur,
    piece: l.piece,
    pleinNumero: null,
    vehiculeId: null,
    immatriculation: null,
    immatriculationAffichee: null,
    businessUnit: null,
    site: null,
    ecart: null,
    stockApres: 0,
    enregistrePar: l.enregistre_par ?? "—",
    creee: false,
  };
}

/* -- Consommation par véhicule et par mois --------------------------------------- */

function moisRelatif(aujourdhui: string, delta: number): string {
  const d = new Date(`${aujourdhui.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

/** Le compteur à une date, lu sur des points (date, km) croissants : le dernier point avant, sinon le premier après. */
function kmVers(points: { date: string; km: number }[], date: string): number | null {
  let avant: number | null = null;
  for (const p of points) {
    if (p.date <= date) avant = p.km;
    else return avant ?? p.km;
  }
  return avant;
}

/**
 * Les douze derniers mois clos de chaque véhicule qui a fait le plein : litres,
 * coût, kilomètres parcourus entre le premier et le dernier compteur connu du
 * mois — sur les relevés valides et les compteurs des pleins.
 */
export function consommationsDepuisLaBase(pleins: LignePlein[], parc: ParcBrut, aujourdhui: string): ConsommationMensuelleFlotte[] {
  const parImmat = new Map(parc.vehicules.map((v) => [v.immatriculation, v]));
  const pointsParVehicule = new Map<string, { date: string; km: number }[]>();
  const uuidParImmat = new Map(parc.vehicules.map((v) => [v.immatriculation, v.id]));
  for (const r of parc.releves) {
    const liste = pointsParVehicule.get(r.vehicule_id) ?? [];
    liste.push({ date: r.date, km: r.km });
    pointsParVehicule.set(r.vehicule_id, liste);
  }
  for (const p of pleins) {
    const uuid = uuidParImmat.get(p.immatriculation);
    if (!uuid || p.km === null) continue;
    const liste = pointsParVehicule.get(uuid) ?? [];
    liste.push({ date: p.date, km: p.km });
    pointsParVehicule.set(uuid, liste);
  }
  /* Croissants dans le temps et dans les kilomètres : un compteur qui recule est écarté. */
  for (const [uuid, liste] of pointsParVehicule) {
    liste.sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);
    const propres: { date: string; km: number }[] = [];
    for (const p of liste) if (propres.length === 0 || p.km >= propres[propres.length - 1]!.km) propres.push(p);
    pointsParVehicule.set(uuid, propres);
  }
  const mois: string[] = [];
  for (let delta = -12; delta <= -1; delta++) mois.push(moisRelatif(aujourdhui, delta));
  const lignes: ConsommationMensuelleFlotte[] = [];
  const parVehicule = new Map<string, LignePlein[]>();
  for (const p of pleins) parVehicule.set(p.immatriculation, [...(parVehicule.get(p.immatriculation) ?? []), p]);
  for (const [immat, liste] of parVehicule) {
    const v = parImmat.get(immat);
    if (!v) continue;
    const uuid = v.id;
    const points = pointsParVehicule.get(uuid) ?? [];
    const site = v.site_id ? (parc.sites.get(v.site_id)?.libelle ?? null) : null;
    for (const m of mois) {
      const duMois = liste.filter((p) => p.date.startsWith(m));
      if (duMois.length === 0) continue;
      const debut = kmVers(points, `${m}-01`);
      const fin = kmVers(points, `${moisRelatif(m + "-01", 1)}-01`);
      const km = debut !== null && fin !== null && fin > debut ? fin - debut : 0;
      lignes.push({
        vehiculeId: immat,
        immatriculation: immat,
        immatriculationAffichee: afficher(immat),
        vehicule: `${v.marque} ${v.appellation}`,
        businessUnit: v.business_unit,
        site,
        categorie: CATEGORIE_VEHICULE[v.categorie as CategorieVehicule] ?? v.categorie,
        referenceL100: REFERENCE_L100[v.categorie as CategorieVehicule] ?? 20,
        mois: m,
        litres: Math.round(duMois.reduce((s, p) => s + p.litres, 0) * 10) / 10,
        kmParcourus: km,
        cout: duMois.reduce((s, p) => s + p.montant, 0),
      });
    }
  }
  return lignes;
}

/* -- Ce que la page appelle -------------------------------------------------- */

export interface CarburantServeur {
  pleins: LignePlein[];
  cuve: LigneCuve[];
  stockInitial: number;
  consommations: ConsommationMensuelleFlotte[];
}

async function carburantServeurBrut(parametres: Parametres): Promise<CarburantServeur> {
  const stockInitial = parametres.cuve.stockInitial;
  if (!authentificationReelle()) return { pleins: pleinsFlotte(), cuve: livraisonsEtJauges(), stockInitial, consommations: consommationsMensuelles() };
  const client = await clientServeur();
  const [pleins, cuve, parc] = await Promise.all([
    client.from("plein").select("numero, vehicule_id, date, litres, prix_litre, montant, km, source, reference, vehicule (immatriculation, marque, appellation, business_unit, site (libelle)), prestataire (raison_sociale)").order("date", { ascending: false }).limit(5000).returns<LignePleinBase[]>(),
    client.from("mouvement_cuve").select("numero, date, sens, libelle, litres, prix_litre, montant, fournisseur, piece, commentaire, enregistre_par, prestataire (raison_sociale)").order("date", { ascending: false }).limit(5000).returns<LigneCuveBase[]>(),
    parcServeur(),
  ]);
  if (pleins.error) console.warn(`Pleins : lecture impossible (${pleins.error.message}).`);
  /* Table pas encore jouée : une cuve sans livraison, pas d'erreur. */
  if (cuve.error) console.warn(`Cuve : lecture impossible (${cuve.error.message}).`);
  const lignesPleins = (pleins.data ?? []).map(pleinDepuisLigne);
  return {
    pleins: lignesPleins,
    cuve: (cuve.data ?? []).map(cuveDepuisLigne),
    stockInitial,
    consommations: consommationsDepuisLaBase(lignesPleins, parc, parc.aujourdhui),
  };
}

export const carburantServeur = cache(carburantServeurBrut);

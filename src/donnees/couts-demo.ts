/* ============================================================================
 * Coûts & analyses — données de démonstration.
 *
 * Une seule vérité : la matière du module est relue sur les fiches véhicules —
 * leurs dépenses (toutes voies de paiement), les kilomètres et les litres de
 * leur consommation mensuelle, leurs interventions curatives. Rien n'est
 * inventé pour l'analyse ; ce que la fiche dit, le module l'additionne. Les
 * dépenses créées dans l'application ne sont pas encore comptées (même limite
 * que l'Aperçu des fiches : en production, elles seront des lignes comme les
 * autres).
 * ==========================================================================*/

import type { DonneesVehicule, MoisVehicule } from "@/domaine/couts";
import type { PosteDepense } from "@/domaine/types";
import { fichePourImmatriculation } from "./fiche-demo";
import { FLOTTE } from "./parc-demo";

/** Date de référence du jeu de démonstration, comme dans les autres modules. */
const AUJOURDHUI = "2026-09-02";
/** Profondeur servie au module : deux ans, pour comparer une période à la précédente. */
const PROFONDEUR_MOIS = 24;

let CACHE: DonneesVehicule[] | null = null;

export function donneesCouts(): DonneesVehicule[] {
  if (CACHE) return CACHE;
  const [a, m] = AUJOURDHUI.split("-").map(Number);
  const moisServis: string[] = [];
  for (let k = PROFONDEUR_MOIS - 1; k >= 0; k--) moisServis.push(new Date(Date.UTC(a!, m! - 1 - k, 1)).toISOString().slice(0, 7));
  const retenu = new Set(moisServis);

  CACHE = FLOTTE.flatMap((l) => {
    const f = fichePourImmatriculation(l.vehicule.immatriculation);
    if (!f) return [];
    const v = l.vehicule;
    const parMois = new Map<string, MoisVehicule>();
    const de = (mois: string): MoisVehicule => {
      let x = parMois.get(mois);
      if (!x) {
        x = { mois, km: 0, litres: 0, parPoste: {}, curatifs: 0, immobilisationJours: 0 };
        parMois.set(mois, x);
      }
      return x;
    };
    for (const d of f.depenses) {
      const mois = d.date.slice(0, 7);
      if (!retenu.has(mois)) continue;
      const x = de(mois);
      x.parPoste[d.poste as PosteDepense] = (x.parPoste[d.poste as PosteDepense] ?? 0) + d.montant;
    }
    for (const c of f.carburant) {
      if (!retenu.has(c.mois)) continue;
      const x = de(c.mois);
      x.km += c.kmParcourus;
      x.litres += c.litres;
    }
    for (const i of f.interventions) {
      const mois = i.date.slice(0, 7);
      if (!retenu.has(mois)) continue;
      const x = de(mois);
      if (i.type === "curatif") x.curatifs += 1;
      x.immobilisationJours += i.immobilisationJours;
    }
    const miseEnCirculation = v.premiereMiseEnCirculation ?? null;
    return [
      {
        vehiculeId: v.id,
        immatriculation: v.immatriculation,
        immatriculationAffichee: v.immatriculationAffichee,
        libelle: `${v.marque} ${v.appellation}`,
        categorie: v.categorie,
        categorieFlotte: v.categorieFlotte,
        businessUnit: v.businessUnit,
        site: l.site?.libelle ?? null,
        statut: l.statutEffectif ?? v.statut,
        referenceL100: f.referenceL100,
        ageAnnees: miseEnCirculation ? Math.round(((Date.parse(AUJOURDHUI) - Date.parse(miseEnCirculation)) / (365.25 * 86_400_000)) * 10) / 10 : null,
        mois: moisServis.map((mois) => parMois.get(mois) ?? { mois, km: 0, litres: 0, parPoste: {}, curatifs: 0, immobilisationJours: 0 }),
      } satisfies DonneesVehicule,
    ];
  });
  return CACHE;
}

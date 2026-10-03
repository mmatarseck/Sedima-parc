/* ============================================================================
 * Les camions des transporteurs, suivis comme la flotte (0072).
 *
 * Demande du métier du 3 octobre 2026 : « la vue doit présenter la liste des
 * véhicules transporteurs, avec la marque, modèle, etc., chauffeur affecté,
 * statut, type de contrat… comme pour notre propre flotte. Le nom du
 * transporteur aussi, qui passera en filtre. » Et la fiche de chacun : carburant,
 * incidents et accidents, volumes transportés, conformité administrative.
 *
 * Un camion de transporteur n'est pas un véhicule du parc : pas d'affectation
 * à un chauffeur SEDIMA, pas d'entretien, pas d'amortissement. Il a son
 * transporteur, son contrat, son chauffeur habituel chez le transporteur — et
 * ce que SEDIMA lui confie et lui fournit.
 * ==========================================================================*/

import type { BusinessUnit, CategorieVehicule, StatutVehicule } from "./types";
import type { ChargementSpecial } from "./chargement";

export type TypeContratCamion = "voyage" | "mise-a-disposition" | "forfait";

export const TYPE_CONTRAT: Record<TypeContratCamion, { libelle: string; court: string }> = {
  voyage: { libelle: "Au voyage (grille à la tonne)", court: "Au voyage" },
  "mise-a-disposition": { libelle: "Mise à disposition (au jour)", court: "Mise à disposition" },
  forfait: { libelle: "Forfait", court: "Forfait" },
};

export interface CamionTiers {
  immatriculation: string;
  immatriculationAffichee: string;
  transporteurNumero: string;
  transporteur: string;
  marque: string | null;
  modele: string | null;
  categorie: CategorieVehicule;
  capaciteTonnes: number | null;
  vin: string | null;
  premiereMiseEnCirculation: string | null;
  photo: string | null;
  statut: StatutVehicule;
  businessUnit: BusinessUnit | null;
  typeContrat: TypeContratCamion;
  carburantFourni: boolean;
  /** Faux quand le camion ne roule plus pour SEDIMA : il reste consultable. */
  actif: boolean;
  commentaire: string | null;
  creeLe: string | null;
  /** Le chauffeur habituel, chez le transporteur. */
  chauffeur: { nom: string; telephone: string | null } | null;
  balise: boolean;
  carteSecaa: boolean;
  numeroCarteSecaa: string | null;
  carteAgeroute: boolean;
  numeroCarteAgeroute: string | null;
  /** Chargement spécialisé et sa capacité hors tonnes (0073). */
  chargementSpecial: ChargementSpecial | null;
  capaciteSpeciale: number | null;
}

/** Une ligne de la liste : le camion, et ce que ses trente derniers jours disent de lui. */
export interface LigneCamionTiers extends CamionTiers {
  /** Le chauffeur du dernier voyage au relevé, quand aucun n'est affecté. */
  chauffeurReleve: string | null;
  dernierVoyage: string | null;
  derniereDestination: string | null;
  voyages30j: number;
  tonnes30j: number;
  litres30j: number;
  carburant30j: number;
  incidentsOuverts: number;
}

/** Le libellé du véhicule : « Mercedes Actros », ou la catégorie quand la marque manque. */
export function libelleCamion(c: Pick<CamionTiers, "marque" | "modele" | "categorie" | "capaciteTonnes">): string {
  const nom = [c.marque, c.modele].filter(Boolean).join(" ");
  if (nom) return nom;
  const familles: Partial<Record<CategorieVehicule, string>> = { camion: "Camion", tracteur: "Plateau", camionnette: "Camionnette", "vehicule-leger": "Véhicule léger", engin: "Engin" };
  return `${familles[c.categorie] ?? "Camion"}${c.capaciteTonnes ? ` ${c.capaciteTonnes} t` : ""}`;
}

/** Le chauffeur à afficher : celui qu'on a affecté, sinon celui du dernier voyage. */
export function chauffeurAffiche(l: Pick<LigneCamionTiers, "chauffeur" | "chauffeurReleve">): { nom: string; source: "affecte" | "releve" } | null {
  if (l.chauffeur) return { nom: l.chauffeur.nom, source: "affecte" };
  if (l.chauffeurReleve) return { nom: l.chauffeurReleve, source: "releve" };
  return null;
}

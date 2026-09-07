/* ============================================================================
 * Le parc léger — véhicules de service, de fonction et plan car.
 *
 * Cadrage du métier, 7 septembre 2026. Le parc ne se limite pas aux véhicules
 * de transport de marchandises : il suit aussi les véhicules légers remis aux
 * agents de terrain (**service**) et ceux attribués à des personnes selon leur
 * niveau de responsabilité (**fonction**). Parmi ces derniers, le **plan car** :
 * l'attributaire paie une mensualité définie et, au terme de la période, le
 * véhicule lui est cédé. Le parc les suit parce que la maintenance est à sa
 * charge, et parce que le carburant de ces personnes est un **forfait mensuel**
 * sur carte, absorbé directement en charge.
 *
 * Ce que ça change, et ce que ça ne change pas : ces véhicules n'entrent pas
 * dans les charges de livraison (coût à la tonne, externalisation), mais
 * entrent dans les charges de maintenance et de carburant du parc. Le régime
 * d'usage porte cette distinction ; il est distinct de la catégorie de flotte
 * (qui dit qui possède) et de la catégorie de véhicule (qui dit ce qu'est
 * l'engin). La mensualité du plan car ne se suit pas ici : c'est une donnée
 * de paie, suivie aux RH — même partage que pour les sanctions (Q69). Le parc
 * retient la durée et la date de cession.
 * ==========================================================================*/

import type { BusinessUnit, RegimeUsage } from "./types";
import type { Ton } from "./libelles";

/** Ce que le véhicule fait pour l'entreprise : livrer, servir un agent, ou équiper une personne. Défini avec le véhicule (`types.ts`). */
export type { RegimeUsage };

export const REGIME_USAGE: Record<RegimeUsage, { libelle: string; precision: string }> = {
  exploitation: { libelle: "Exploitation", precision: "Livraison et transport — compte dans le coût à la tonne" },
  service: { libelle: "Service", precision: "Remis à un agent de terrain ou à un pool pour faire le travail" },
  fonction: { libelle: "Fonction", precision: "Attribué à une personne selon son niveau de responsabilité" },
};

/** L'état d'un véhicule léger tel que le dossier parc le tient. */
export type EtatLeger = "actif" | "pool" | "panne" | "a-reformer" | "a-recevoir";

export const ETAT_LEGER: Record<EtatLeger, { libelle: string; precision: string; ton: Ton }> = {
  actif: { libelle: "Actif", precision: "Attribué et en circulation", ton: "favorable" },
  pool: { libelle: "Pool", precision: "Disponible pour les missions d'un service ou d'un site", ton: "neutre" },
  panne: { libelle: "En panne", precision: "Immobilisé, réparation à décider ou en cours", ton: "vigilance" },
  "a-reformer": { libelle: "À réformer", precision: "Sortie de parc décidée ou proposée", ton: "defavorable" },
  "a-recevoir": { libelle: "À recevoir", precision: "Commandé, pas encore livré", ton: "neutre" },
};

/** Une personne à qui un véhicule est attribué — qui n'est pas un chauffeur. */
export interface Attributaire {
  id: string;
  nom: string;
  fonction: string | null;
  departement: string | null;
  /** La BU de l'agent : c'est elle qui porte la charge au budget (décision du 7 septembre 2026). */
  businessUnit: BusinessUnit | null;
}

/**
 * Le plan car d'un véhicule de fonction : une durée, une cession au terme.
 * La mensualité que paie l'attributaire **ne se suit pas ici** (décision du
 * métier, 7 septembre 2026) : c'est une donnée de paie. Le parc ne retient que
 * ce qui le concerne — quand le véhicule cesse d'être à lui.
 */
export interface PlanCar {
  /** Durée en mois ; nulle quand elle suit le paramètre. */
  dureeMois: number | null;
  /** Premier mois du plan, « AAAA-MM » ; nul tant que le dossier ne l'a pas dit. */
  debut: string | null;
  statut: "en-cours" | "cede";
}

export interface VehiculeLeger {
  /** Immatriculation canonique — ou un identifiant « lot-2-07 » tant que le véhicule n'est pas immatriculé. */
  id: string;
  immatriculation: string | null;
  immatriculationAffichee: string;
  marque: string;
  modele: string;
  annee: number | null;
  kilometrage: number | null;
  categorie: "vehicule-leger" | "camionnette" | "moto" | "bus";
  regime: RegimeUsage;
  etat: EtatLeger;
  attributaireId: string | null;
  /** Le pool ou le service quand personne n'est nommé : « Pool DACI · DSI · CG », « Sécurité ». */
  pool: string | null;
  departement: string | null;
  businessUnit: BusinessUnit | null;
  planCar: PlanCar | null;
  /** Le lot du plan de cascade 2026 : « Lot 1 - 03 ». */
  lot: string | null;
  commentaire: string | null;
}

/** Où en est un plan car, à la règle des paramètres. */
export interface EcheancierPlanCar {
  dureeMois: number;
  /** Mois écoulés depuis le début, bornés à la durée ; nul sans date de début. */
  moisEcoules: number | null;
  /** « AAAA-MM » de la cession prévue ; nul sans date de début. */
  cessionPrevue: string | null;
}

function ajouterMois(mois: string, n: number): string {
  const [a, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1 + n, 1)).toISOString().slice(0, 7);
}

/**
 * L'échéancier d'un plan car : la durée propre au dossier, ou celle des
 * paramètres. Sans date de début, on connaît la durée mais pas la cession —
 * et l'écran le dit plutôt que d'inventer une date.
 */
export function echeancierPlanCar(p: PlanCar, dureeDefaut: number, aujourdhui: string): EcheancierPlanCar {
  const dureeMois = p.dureeMois ?? dureeDefaut;
  if (!p.debut) return { dureeMois, moisEcoules: null, cessionPrevue: null };
  const [a0, m0] = p.debut.split("-").map(Number);
  const [a1, m1] = aujourdhui.slice(0, 7).split("-").map(Number);
  const ecoules = Math.max(0, (a1! - a0!) * 12 + (m1! - m0!) + 1);
  return { dureeMois, moisEcoules: p.statut === "cede" ? dureeMois : Math.min(dureeMois, ecoules), cessionPrevue: ajouterMois(p.debut, dureeMois - 1) };
}

/** Un identifiant lisible d'attributaire, à partir du nom : « Assane Gueye » → « assane-gueye ». */
export function idAttributaire(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Le forfait carburant mensuel d'un attributaire de véhicule de fonction. */
export interface ForfaitCarburant {
  attributaireId: string;
  /** Montant mensuel en francs ; nul quand il suit le paramètre. */
  montantMensuel: number | null;
  carte: string | null;
}

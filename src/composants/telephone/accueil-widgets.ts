/* ============================================================================
 * Les widgets de l'accueil du téléphone — refonte du 8 septembre 2026, sur le
 * modèle de l'accueil personnalisable de Fleetio Go : chacun choisit ce que
 * son accueil montre, et dans quel ordre. Le réglage vit dans le navigateur,
 * sous une clé qui porte le rôle, comme les colonnes des listes.
 * ==========================================================================*/

import type { Module } from "@/domaine/acces";
import { trouverRole } from "@/domaine/roles";
import { lireRole } from "@/lib/session-demo";

export type CleWidget = "raccourcis" | "a-faire" | "mon-vehicule" | "recents" | "demandes" | "transferts" | "atelier" | "alertes" | "parc";

export interface DefinitionWidget {
  cle: CleWidget;
  libelle: string;
  precision: string;
  /** Le module qu'il faut voir pour que le widget ait un sens ; absent : toujours. */
  module?: Module;
  /** Réservé au détenteur, ou caché au détenteur. */
  detenteur?: "seulement" | "jamais";
}

export const WIDGETS: DefinitionWidget[] = [
  { cle: "raccourcis", libelle: "Raccourcis", precision: "Scanner, relevé, plein, panne, chercher, atelier" },
  { cle: "mon-vehicule", libelle: "Mon véhicule", precision: "Le véhicule qui vous est remis", detenteur: "seulement" },
  { cle: "a-faire", libelle: "À faire aujourd'hui", precision: "Échéances, immobilisés, relevés, demandes, fiches à signer" },
  { cle: "parc", libelle: "Le parc en chiffres", precision: "Disponibles et immobilisés sur votre périmètre", module: "flotte", detenteur: "jamais" },
  { cle: "recents", libelle: "Véhicules récents", precision: "Les fiches ouvertes dernièrement", module: "flotte", detenteur: "jamais" },
  { cle: "demandes", libelle: "Demandes", precision: "Celles qui attendent une réponse", module: "demandes" },
  { cle: "transferts", libelle: "Fiches de transfert", precision: "Celles qui attendent une signature", module: "transferts" },
  { cle: "atelier", libelle: "Atelier", precision: "En atelier, planifiés, à planifier", module: "maintenance", detenteur: "jamais" },
  { cle: "alertes", libelle: "Alertes", precision: "Documents et visites qui arrivent à échéance", module: "documents", detenteur: "jamais" },
];

export interface ReglageAccueil {
  /** Les widgets affichés, dans l'ordre. */
  ordre: CleWidget[];
}

export const REGLAGE_ACCUEIL_DEFAUT: ReglageAccueil = { ordre: ["raccourcis", "mon-vehicule", "a-faire", "parc", "demandes", "transferts", "atelier", "recents", "alertes"] };

function cle(): string {
  return `sedima.parc.telephone.accueil.${trouverRole(lireRole()).role}`;
}

export function lireReglageAccueil(): ReglageAccueil {
  try {
    const brut = localStorage.getItem(cle());
    if (!brut) return REGLAGE_ACCUEIL_DEFAUT;
    const lu = JSON.parse(brut) as Partial<ReglageAccueil>;
    const connus = new Set(WIDGETS.map((w) => w.cle));
    const ordre = Array.isArray(lu.ordre) ? lu.ordre.filter((c): c is CleWidget => typeof c === "string" && connus.has(c as CleWidget)) : [];
    return { ordre };
  } catch {
    return REGLAGE_ACCUEIL_DEFAUT;
  }
}

export function ecrireReglageAccueil(r: ReglageAccueil): void {
  try {
    localStorage.setItem(cle(), JSON.stringify(r));
  } catch {
    /* sans stockage, le réglage ne vaut que pour la page */
  }
}

/* Les fiches ouvertes dernièrement, les cinq plus récentes, pour le widget « Véhicules récents ». */
const CLE_RECENTS = "sedima.parc.telephone.recents";

export interface VehiculeRecent {
  id: string;
  immatriculation: string;
  libelle: string;
  le: string;
}

export function lireRecents(): VehiculeRecent[] {
  try {
    const brut = localStorage.getItem(CLE_RECENTS);
    return brut ? (JSON.parse(brut) as VehiculeRecent[]) : [];
  } catch {
    return [];
  }
}

export function noterRecent(v: Omit<VehiculeRecent, "le">): void {
  try {
    const liste = [{ ...v, le: new Date().toISOString() }, ...lireRecents().filter((x) => x.id !== v.id)].slice(0, 5);
    localStorage.setItem(CLE_RECENTS, JSON.stringify(liste));
  } catch {
    /* rien */
  }
}

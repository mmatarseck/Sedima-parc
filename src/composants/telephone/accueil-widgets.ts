/* ============================================================================
 * Les widgets de l'accueil du téléphone — refonte du 8 septembre 2026, sur le
 * modèle de l'accueil personnalisable de Fleetio Go : chacun choisit ce que
 * son accueil montre, et dans quel ordre. Le réglage vit dans le navigateur,
 * sous une clé qui porte le rôle, comme les colonnes des listes.
 * ==========================================================================*/

import { trouverProfil, type AccesCourant, type Module, type Niveau } from "@/domaine/acces";
import { peutCloturer } from "@/domaine/cloture";
import { trouverRole } from "@/domaine/roles";
import { lireRole } from "@/lib/session-demo";

export type CleWidget = "raccourcis" | "a-faire" | "mon-vehicule" | "recents" | "demandes" | "transferts" | "atelier" | "alertes" | "parc";

/* -- Les raccourcis : les gestes de la journée, selon la personne -------------
 *
 * Demande du métier du 8 septembre 2026 : « l'utilisateur doit avoir comme
 * raccourci sur le tableau de bord toutes les actions qu'il est censé faire
 * durant sa journée ». Le catalogue est celui des profils (`PROFILS[].mobile`),
 * et chaque geste ne s'affiche qu'à qui peut l'accomplir : un raccourci
 * « Relevé » offert à un lecteur promettrait une saisie que le serveur
 * refuse. Le niveau exigé est donc celui de l'action, pas « voit le module ».
 * ------------------------------------------------------------------------- */

export type CleRaccourci = "scanner" | "releve" | "plein" | "panne" | "statut" | "document" | "atelier" | "pieces" | "demander" | "demandes" | "repondre" | "transfert" | "signer" | "affecter" | "valider" | "chercher";

export interface Raccourci {
  cle: CleRaccourci;
  libelle: string;
  href: string;
  /** Le module et le niveau qu'il faut pour que le geste soit possible ; absent : toujours. */
  module?: Module;
  minimum?: Niveau;
  /** Réservé au détenteur, ou caché au détenteur. */
  detenteur?: "seulement" | "jamais";
  /** Le geste demande un droit qui n'est pas un niveau de module. */
  condition?: (acces: AccesCourant) => boolean;
}

const RANG: Record<Niveau, number> = { aucun: 0, lecture: 1, saisie: 2, gestion: 3 };

export const RACCOURCIS: Raccourci[] = [
  { cle: "scanner", libelle: "Scanner", href: "/telephone/scanner" },
  { cle: "releve", libelle: "Relevé", href: "/telephone/vehicules?geste=releve", module: "releves", minimum: "saisie", detenteur: "jamais" },
  { cle: "plein", libelle: "Plein", href: "/telephone/vehicules?geste=plein", module: "releves", minimum: "saisie", detenteur: "jamais" },
  { cle: "panne", libelle: "Panne", href: "/telephone/vehicules?geste=panne", module: "incidents", minimum: "saisie", detenteur: "jamais" },
  /* Poser un statut n'est pas un niveau de module : c'est la liste des statuts du profil. */
  { cle: "statut", libelle: "Statut", href: "/telephone/vehicules?geste=statut", detenteur: "jamais", condition: (a) => trouverProfil(a.profil).statuts === "tous" || trouverProfil(a.profil).statuts.length > 0 },
  { cle: "document", libelle: "Document", href: "/telephone/vehicules?geste=document", module: "documents", minimum: "saisie", detenteur: "jamais" },
  { cle: "atelier", libelle: "Atelier", href: "/telephone/atelier", module: "maintenance", minimum: "lecture", detenteur: "jamais" },
  /* Sortir une pièce pour le véhicule qu'on répare, recevoir une livraison : l'écran est en lecture seule sous la saisie. */
  { cle: "pieces", libelle: "Pièces", href: "/telephone/pieces", module: "maintenance", minimum: "saisie", detenteur: "jamais" },
  { cle: "demander", libelle: "Demander", href: "/demandes?nouvelle", module: "demandes", minimum: "saisie", detenteur: "jamais" },
  { cle: "demandes", libelle: "Demandes", href: "/telephone/demandes", module: "demandes", minimum: "lecture", detenteur: "jamais", condition: (a) => RANG[a.niveaux.demandes] < RANG.saisie },
  { cle: "repondre", libelle: "Répondre", href: "/telephone/demandes", module: "demandes", minimum: "saisie", detenteur: "seulement" },
  { cle: "transfert", libelle: "Transfert", href: "/transferts/nouveau", module: "transferts", minimum: "saisie", detenteur: "jamais" },
  { cle: "signer", libelle: "Signer", href: "/telephone/transferts", module: "transferts", minimum: "saisie", detenteur: "seulement" },
  { cle: "affecter", libelle: "Affecter", href: "/affectations?nouvelle", module: "chauffeurs", minimum: "gestion", detenteur: "jamais" },
  /* Approuver ce qui touche un mois clos : le droit est celui de la clôture, porté par le rôle. */
  { cle: "valider", libelle: "Valider", href: "/clotures", detenteur: "jamais", condition: () => peutCloturer(lireRole()) },
  { cle: "chercher", libelle: "Chercher", href: "/telephone/vehicules", module: "flotte", minimum: "lecture", detenteur: "jamais" },
];

/** Les raccourcis que la personne peut accomplir, dans l'ordre de la journée. */
export function raccourcisPour(acces: AccesCourant): Raccourci[] {
  const detenteur = acces.profil === "detenteur";
  return RACCOURCIS.filter((r) => {
    if (r.detenteur === "seulement" && !detenteur) return false;
    if (r.detenteur === "jamais" && detenteur) return false;
    if (r.module && RANG[acces.niveaux[r.module]] < RANG[r.minimum ?? "lecture"]) return false;
    return r.condition ? r.condition(acces) : true;
  });
}

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
  { cle: "raccourcis", libelle: "Raccourcis", precision: "Les gestes de votre journée : relevé, plein, panne, statut, pièces, demandes, transferts…" },
  { cle: "mon-vehicule", libelle: "Mon véhicule", precision: "Le véhicule qui vous est remis", detenteur: "seulement" },
  { cle: "a-faire", libelle: "À faire aujourd'hui", precision: "Demandes, fiches à signer, échéances, immobilisés, relevés, atelier, approbations" },
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

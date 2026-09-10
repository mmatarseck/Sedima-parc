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

export type CleWidget = "raccourcis" | "a-faire" | "mon-vehicule" | "recents" | "transferts" | "atelier" | "alertes" | "parc";

/* -- Les raccourcis : les gestes de la journée, selon la personne -------------
 *
 * Demande du métier du 8 septembre 2026 : « l'utilisateur doit avoir comme
 * raccourci sur le tableau de bord toutes les actions qu'il est censé faire
 * durant sa journée ». Le catalogue est celui des profils (`PROFILS[].mobile`),
 * et chaque geste ne s'affiche qu'à qui peut l'accomplir : un raccourci
 * « Relevé » offert à un lecteur promettrait une saisie que le serveur
 * refuse. Le niveau exigé est donc celui de l'action, pas « voit le module ».
 * ------------------------------------------------------------------------- */

export type CleRaccourci = "scanner" | "releve" | "plein" | "panne" | "statut" | "document" | "atelier" | "pieces" | "transfert" | "signer" | "affecter" | "valider" | "chercher";

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

/**
 * **Deux lignes, pas plus** (métier, 10 septembre 2026 : « garder par défaut
 * le juste nécessaire, pas plus de deux lignes ; l'utilisateur peut
 * sélectionner ce qu'il veut voir, ou revenir par défaut »).
 *
 * Un administrateur avait treize gestes, soit quatre lignes qui repoussaient
 * « À faire aujourd'hui » sous la ligne de flottaison — l'écran s'ouvrait sur
 * un menu au lieu de s'ouvrir sur le travail du jour.
 */
export const MAX_RACCOURCIS = 8;

/**
 * Les huit gestes d'ouverture, par profil, dans l'ordre où la journée les
 * demande. Ce n'est pas une question de droits — le choix offre tous les
 * gestes permis — mais de **première utilité**.
 *
 * Un geste que le profil n'a pas le droit d'accomplir est écarté ensuite, et
 * la rangée se complète alors avec les suivants de `RACCOURCIS` : une liste
 * trop courte vaut mieux qu'une liste qui ment, et une rangée à trous serait
 * pire que les deux.
 */
const RACCOURCIS_PAR_PROFIL: Record<string, CleRaccourci[]> = {
  /* Le terrain saisit : ce qu'on relève, ce qu'on remplit, ce qu'on signale. */
  "agent-terrain": ["scanner", "releve", "plein", "panne", "statut", "document", "chercher", "atelier"],
  /* L'atelier vit sur ses ordres et ses pièces. */
  maintenance: ["scanner", "atelier", "pieces", "panne", "statut", "releve", "document", "chercher"],
  /* Le responsable arbitre : il ouvre, il affecte, il valide. */
  responsable: ["scanner", "chercher", "affecter", "transfert", "valider", "atelier", "statut", "releve"],
  administrateur: ["scanner", "chercher", "affecter", "transfert", "valider", "atelier", "statut", "releve"],
  /* Le lecteur ne saisit rien : il cherche et il lit. */
  lecteur: ["scanner", "chercher", "atelier"],
  /* Le détenteur n'a que trois gestes, et ils tiennent sur une ligne. */
  detenteur: ["scanner", "signer"],
};

/**
 * La rangée d'ouverture : le défaut du profil, borné à deux lignes, complété
 * par les gestes permis qui n'y étaient pas si le défaut ne suffit pas.
 */
export function raccourcisDefaut(acces: AccesCourant): CleRaccourci[] {
  const permis = raccourcisPour(acces);
  const possible = new Set(permis.map((r) => r.cle));
  const voulus = (RACCOURCIS_PAR_PROFIL[acces.profil] ?? []).filter((c) => possible.has(c));
  const complement = permis.map((r) => r.cle).filter((c) => !voulus.includes(c));
  return [...voulus, ...complement].slice(0, MAX_RACCOURCIS);
}

/**
 * Ce que la rangée montre vraiment : le choix de la personne s'il existe,
 * sinon le défaut de son profil. Le choix est filtré par ce qu'elle a le
 * droit de faire — un accès retiré depuis doit disparaître de l'écran, même
 * si la personne l'avait coché.
 */
export function raccourcisAffiches(acces: AccesCourant, reglage: ReglageAccueil): Raccourci[] {
  const permis = raccourcisPour(acces);
  const cles = reglage.raccourcis ?? raccourcisDefaut(acces);
  const retenus = new Set(cles.slice(0, MAX_RACCOURCIS));
  return permis.filter((r) => retenus.has(r.cle));
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
  { cle: "raccourcis", libelle: "Raccourcis", precision: "Les gestes de votre journée : relevé, plein, panne, statut, pièces, transferts…" },
  { cle: "mon-vehicule", libelle: "Mon véhicule", precision: "Le véhicule qui vous est remis", detenteur: "seulement" },
  { cle: "a-faire", libelle: "À faire aujourd'hui", precision: "Demandes, fiches à signer, échéances, immobilisés, relevés, atelier, approbations" },
  { cle: "parc", libelle: "Le parc en chiffres", precision: "Disponibles et immobilisés sur votre périmètre", module: "flotte", detenteur: "jamais" },
  { cle: "recents", libelle: "Véhicules récents", precision: "Les fiches ouvertes dernièrement", module: "flotte", detenteur: "jamais" },
  { cle: "transferts", libelle: "Fiches de transfert", precision: "Celles qui attendent une signature", module: "transferts" },
  { cle: "atelier", libelle: "Atelier", precision: "En atelier, planifiés, à planifier", module: "maintenance", detenteur: "jamais" },
  { cle: "alertes", libelle: "Alertes", precision: "Documents et visites qui arrivent à échéance", module: "documents", detenteur: "jamais" },
];

export interface ReglageAccueil {
  /** Les widgets affichés, dans l'ordre. */
  ordre: CleWidget[];
  /**
   * Les gestes choisis pour la rangée du haut. **Absent tant que la personne
   * n'a rien choisi** — et c'est ce qui permet de revenir au défaut : on ne
   * range pas une copie du défaut, on retire le réglage. Un défaut qui change
   * profite alors à qui n'a jamais touché à rien.
   */
  raccourcis?: CleRaccourci[];
}

export const REGLAGE_ACCUEIL_DEFAUT: ReglageAccueil = { ordre: ["raccourcis", "mon-vehicule", "a-faire", "parc", "transferts", "atelier", "recents", "alertes"] };

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
    /* Les gestes ne sont relus que si la personne en a choisi : `undefined`
       veut dire « le défaut du profil », et ce n'est pas la même chose qu'une
       liste vide, qui veut dire « aucun geste ». */
    const gestes = new Set(RACCOURCIS.map((r) => r.cle));
    const raccourcis = Array.isArray(lu.raccourcis) ? lu.raccourcis.filter((c): c is CleRaccourci => typeof c === "string" && gestes.has(c as CleRaccourci)).slice(0, MAX_RACCOURCIS) : undefined;
    return raccourcis ? { ordre, raccourcis } : { ordre };
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

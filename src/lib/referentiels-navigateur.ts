/* ============================================================================
 * Les référentiels dont les formulaires ont besoin, côté navigateur.
 *
 * POURQUOI CE MODULE EXISTE. Les listes déroulantes des formulaires — le
 * chauffeur d'une affectation, la remorque d'un attelage, le site d'un
 * véhicule, le garage d'une intervention — se construisaient sur les fixtures
 * de démonstration. Base branchée, elles proposaient donc des chauffeurs et des
 * camions qui n'existent pas : l'écriture les refusait ensuite faute de
 * pouvoir résoudre l'identifiant, et l'utilisateur ne comprenait pas pourquoi.
 *
 * COMMENT. Le serveur lit les référentiels dans la mise en page et les pose ici
 * (`AmorceReferentiels`), comme il le fait déjà des paramètres. `champs.ts` les
 * lit **de façon synchrone** au moment d'ouvrir une modale — c'est ce que sa
 * forme impose, et c'est ce que `lireParametres()` fait depuis toujours.
 *
 * En mémoire et non dans `localStorage` : cent soixante-douze véhicules et
 * trente-six chauffeurs n'ont rien à faire dans un stockage de quelques
 * méga-octets, et la mise en page les repose à chaque rendu — donc à chaque
 * chargement de page comme à chaque navigation.
 *
 * Tant qu'ils ne sont pas posés, les listes sont vides : un choix vide se voit,
 * une liste de faux noms ne se voit pas.
 * ==========================================================================*/

import type { TypePrestataire } from "@/domaine/prestataires";
import type { StatutChauffeur } from "@/domaine/chauffeur";
import type { BusinessUnit, CategorieVehicule, Site, StatutVehicule } from "@/domaine/types";

export interface VehiculeChoix {
  /** L'identifiant de la base : c'est lui que l'écriture attend. */
  id: string;
  immatriculation: string;
  immatriculationAffichee: string;
  marque: string;
  appellation: string;
  categorie: CategorieVehicule;
  siteId: string | null;
  /* Ce que la recherche globale affiche sous le nom, pour situer d'un coup d'œil. */
  statut: StatutVehicule;
  businessUnit: BusinessUnit | null;
  site: string | null;
  vin: string | null;
}

export interface ReferentielsChoix {
  vehicules: VehiculeChoix[];
  chauffeurs: { id: string; nomComplet: string; actif: boolean; statut: StatutChauffeur; site: string | null; matriculeRh: string | null; telephone: string | null; vehicule: string | null }[];
  sites: Site[];
  /** Les personnes qui tiennent un véhicule de service ou de fonction. */
  attributaires: { id: string; nom: string; fonction: string | null; actif: boolean }[];
  prestataires: { numero: string; raisonSociale: string; ville: string | null; type: TypePrestataire; actif: boolean }[];
  /** Les camions des transporteurs, pour le planning des affectations. */
  camionsTiers: { immatriculation: string; immatriculationAffichee: string; transporteurNumero: string; actif: boolean }[];
  chauffeursTiers: { id: string; nom: string; transporteurNumero: string; actif: boolean }[];
  /** Le catalogue des tâches de maintenance (0060), celles qu'on propose : actives. */
  taches: { numero: string; libelle: string; categorie: string | null; systeme: string | null; typeDefaut: "preventif" | "curatif" | null; alias: string[] }[];
}

export const REFERENTIELS_VIDES: ReferentielsChoix = {
  vehicules: [],
  chauffeurs: [],
  sites: [],
  attributaires: [],
  prestataires: [],
  camionsTiers: [],
  chauffeursTiers: [],
  taches: [],
};

let courants: ReferentielsChoix = REFERENTIELS_VIDES;

/** Ce que le serveur a lu, posé pour les formulaires. */
export function poserReferentiels(r: ReferentielsChoix): void {
  courants = r;
}

/** Ce dont les listes de choix disposent. Vide tant que la mise en page n'a rien posé. */
export function lireReferentiels(): ReferentielsChoix {
  return courants;
}

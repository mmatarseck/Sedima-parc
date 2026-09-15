/* ============================================================================
 * Les listes de choix des formulaires, tirées du référentiel réel.
 *
 * Elles se construisaient sur les fixtures de démonstration : base branchée,
 * un formulaire d'affectation proposait des chauffeurs qui n'existent pas, et
 * l'écriture refusait ensuite la ligne faute de retrouver l'identifiant.
 * Personne ne pouvait comprendre le refus depuis l'écran.
 *
 * Tout vient désormais de ce que le serveur a posé dans la mise en page
 * (`src/lib/referentiels-navigateur.ts`). Les créations faites dans
 * l'application et pas encore confirmées par la base s'y ajoutent, là où le
 * formulaire sait les lire — un prestataire créé à l'instant doit être
 * choisissable dans la foulée.
 * ==========================================================================*/

import type { Creation } from "@/domaine/cloture";
import type { TypePrestataire } from "@/domaine/prestataires";
import type { CategorieVehicule } from "@/domaine/types";
import { lireReferentiels } from "@/lib/referentiels-navigateur";
import { RETRAIT_CHAUFFEUR } from "@/lib/transactions-colonnes";

export { RETRAIT_CHAUFFEUR };

export interface Option {
  valeur: string;
  libelle: string;
}

export const optionsSites = (): Option[] => lireReferentiels().sites.map((s) => ({ valeur: s.id, libelle: s.libelle }));

export const optionsChauffeurs = (): Option[] =>
  lireReferentiels()
    .chauffeurs.filter((c) => c.actif)
    .map((c) => ({ valeur: c.id, libelle: c.nomComplet }));

export const optionsVehicules = (filtre?: (categorie: CategorieVehicule) => boolean): Option[] =>
  lireReferentiels()
    .vehicules.filter((v) => (filtre ? filtre(v.categorie) : true))
    .map((v) => ({ valeur: v.id, libelle: `${v.immatriculationAffichee} · ${v.marque} ${v.appellation}` }));

/**
 * À qui l'on attribue un véhicule de service ou de fonction.
 *
 * Trois natures de choix dans une seule liste, et c'est voulu : le métier pense
 * « qui tient ce véhicule maintenant ? », pas « quelle opération vais-je
 * faire ». Retirer l'attribution et la donner à quelqu'un d'autre sont la même
 * question posée au même endroit.
 */
export const optionsAttribution = (): Option[] => [
  { valeur: "", libelle: "Personne — retirer l'attribution" },
  { valeur: "pool", libelle: "Un pool ou un service (à nommer)" },
  ...lireReferentiels()
    .attributaires.filter((a) => a.actif)
    .map((a) => ({ valeur: a.id, libelle: a.fonction ? `${a.nom} · ${a.fonction}` : a.nom })),
];

/**
 * Ce qu'on peut faire du chauffeur d'un véhicule : en mettre un, en changer,
 * ou n'en laisser aucun.
 *
 * « On doit pouvoir supprimer une affectation de véhicule et le laisser sans
 * chauffeur » (métier, 15 septembre 2026). Jusque-là le champ n'acceptait qu'un
 * nom : un camion qui perdait son conducteur gardait le sien à l'écran, et les
 * kilomètres du mois continuaient de lui être rattachés.
 *
 * LE RETRAIT EST UNE VALEUR, PAS UN CHAMP VIDE. « retirer » se choisit ; un
 * champ laissé vide ne retire rien. C'est ce qui distingue le geste voulu de
 * l'étourderie — et le champ peut rester obligatoire, donc le formulaire refuse
 * d'être envoyé sans qu'on ait dit ce qu'on voulait.
 */
export const optionsAffectation = (avecTiers = false): Option[] => [
  { valeur: RETRAIT_CHAUFFEUR, libelle: "Personne — retirer le chauffeur" },
  ...optionsChauffeurs(),
  ...(avecTiers ? optionsChauffeursTiers() : []),
];

function raisonSocialeDe(numero: string): string {
  return lireReferentiels().prestataires.find((p) => p.numero === numero)?.raisonSociale ?? numero;
}

/*
 * Le planning des affectations couvre aussi les camions et les chauffeurs des
 * transporteurs (demande du métier du 5 septembre 2026). Les deux référentiels
 * se proposent donc dans le même choix — le parc d'abord, les tiers ensuite,
 * marqués de leur transporteur : personne ne doit programmer un camion tiers en
 * croyant affecter un camion à nous.
 */
export const optionsChauffeursTiers = (): Option[] =>
  lireReferentiels()
    .chauffeursTiers.filter((c) => c.actif)
    .map((c) => ({ valeur: c.id, libelle: `${c.nom} · ${raisonSocialeDe(c.transporteurNumero)} (tiers)` }));

export const optionsCamionsTiers = (): Option[] =>
  lireReferentiels()
    .camionsTiers.filter((c) => c.actif)
    .map((c) => ({ valeur: `tiers:${c.immatriculation}`, libelle: `${c.immatriculationAffichee} · ${raisonSocialeDe(c.transporteurNumero)} (tiers)` }));

/** Les fiches prestataire créées dans l'application, pas encore relues depuis la base. */
function creees(lireCreations?: (sujet: string) => Creation[]) {
  if (!lireCreations) return [];
  return lireCreations("prestataires")
    .filter((c) => c.type === "prestataire")
    .map(prestataireCree);
}

/** Un prestataire créé dans l'application, pas encore relu depuis la base. */
function prestataireCree(c: Creation): { numero: string; raisonSociale: string; ville: string | null; type: TypePrestataire; actif: boolean } {
  const v = c.valeurs;
  return {
    numero: c.numero,
    raisonSociale: String(v.raisonSociale ?? "—"),
    ville: v.ville ? String(v.ville) : null,
    type: (v.type as TypePrestataire) ?? "autre",
    actif: true,
  };
}

/** Les prestataires d'un ou plusieurs types, désignés par leur raison sociale. */
export function optionsPrestataires(types: TypePrestataire[], lireCreations?: (sujet: string) => Creation[]): Option[] {
  return [...creees(lireCreations), ...lireReferentiels().prestataires]
    .filter((p) => p.actif && types.includes(p.type))
    .map((p) => ({ valeur: p.raisonSociale, libelle: `${p.raisonSociale}${p.ville ? ` · ${p.ville}` : ""}` }));
}

/**
 * Les mêmes, désignés par leur **numéro** PRE — ce que portent les commandes et
 * les factures, pour que les statistiques par prestataire tiennent sur une clé
 * et non sur un nom. Tous les types, sauf ceux demandés.
 */
export function optionsPrestatairesParNumero(lireCreations?: (sujet: string) => Creation[], types?: TypePrestataire[]): Option[] {
  return [...creees(lireCreations), ...lireReferentiels().prestataires]
    .filter((p) => p.actif && (!types || types.includes(p.type)))
    .sort((a, b) => a.raisonSociale.localeCompare(b.raisonSociale, "fr"))
    .map((p) => ({ valeur: p.numero, libelle: `${p.raisonSociale}${p.ville ? ` · ${p.ville}` : ""}` }));
}

/**
 * Les garages, pour le champ « Garage » d'une intervention.
 *
 * Ils étaient une liste de six noms écrite en dur dans les fixtures. Ce sont
 * les prestataires de type garage, et rien d'autre : un garage qui ouvre se
 * saisit au référentiel, pas dans le code.
 */
export const optionsGarages = (lireCreations?: (sujet: string) => Creation[]): Option[] => optionsPrestataires(["garage"], lireCreations);

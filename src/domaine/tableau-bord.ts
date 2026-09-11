/* ============================================================================
 * Tableau de bord SQDCM — le référentiel d'indicateurs du parc.
 *
 * Conforme à la maquette « Parc SEDIMA » validée par la Direction des
 * Opérations : cinq axes, **trente-huit indicateurs disponibles**, dont les
 * **six du référentiel DO** — D_TDPA, D_TICV, D_NPVEL, C_CDM_SEDI, C_CDM_TR,
 * C_TED_EXT — affichés par défaut parce qu'ils tiennent sur une seule ligne.
 * Les autres portent la mention « proposé » et s'ajoutent depuis « Choisir les
 * indicateurs » ; la sélection est mémorisée par compte.
 *
 * **Le score d'un axe est la part de ses indicateurs affichés qui tiennent leur
 * cible** — la règle de la maquette, et non un barème à tolérance : elle se
 * refait de tête, ce qui est la première qualité d'un tableau de bord. Un axe
 * dont aucun indicateur n'est affiché est grisé et ne montre pas de score.
 *
 * **Rien ne se saisit ici.** Chaque valeur se calcule sur des faits
 * enregistrés ailleurs, et chaque pastille porte le lien vers l'écran où elle
 * se vérifie ligne à ligne. Les indicateurs dont la source n'est pas branchée
 * — télématique, tonnages et livraisons de SediLiv, pont bascule, RH — sont
 * déclarés tels quels : ils s'affichent « source à brancher », restent
 * sélectionnables pour que le métier voie la cible visée, et **ne comptent pas
 * dans le score**. C'est la seule façon honnête de montrer un référentiel plus
 * large que ce que l'application sait mesurer aujourd'hui.
 * ==========================================================================*/

import type { BusinessUnit, CategorieFlotte, CategorieVehicule } from "./types";

/* -- Les cinq axes ------------------------------------------------------------ */

export type CleAxe = "S" | "Q" | "D" | "C" | "M";

export interface Axe {
  cle: CleAxe;
  nom: string;
  sous: string;
  /** Variable CSS de la couleur de l'axe, telle que la maquette la pose. */
  teinte: string;
}

/* La maquette donne une teinte par axe. Les siennes viennent de sa propre
   palette ; ici, les cinq couleurs sortent de la charte SEDIMA, où le vert
   reste réservé à ce qui va bien. */
export const AXES: Axe[] = [
  { cle: "S", nom: "Sécurité", sous: "Accidents, infractions, comportement de conduite", teinte: "var(--color-defavorable)" },
  { cle: "Q", nom: "Qualité", sous: "Intégrité du produit livré et conformité des véhicules", teinte: "var(--color-statut-service)" },
  { cle: "D", nom: "Livraison", sous: "Disponibilité du parc et tenue du plan de livraison", teinte: "var(--color-accent)" },
  { cle: "C", nom: "Coût", sous: "Coût de la tonne livrée et maîtrise des charges", teinte: "var(--color-vigilance)" },
  { cle: "M", nom: "Morale", sous: "Satisfaction client et engagement des équipes", teinte: "var(--color-encre)" },
];

/* -- Les faits ---------------------------------------------------------------- */

/** Ce qu'un véhicule a produit dans un mois. La maille la plus fine servie par le serveur. */
export interface FaitsVehiculeMois {
  vehiculeId: string;
  mois: string;
  /** Jours du mois écoulés — le mois en cours est plus court. */
  jours: number;
  engage: boolean;
  transportSpecial: boolean;
  km: number;
  litres: number;
  /** Litres attendus : référence L/100 de la catégorie × kilomètres ÷ 100. */
  litresReference: number;
  joursImmobilises: number;
  /** Vrai si un document critique échu immobilisait le véhicule à la fin du mois. */
  nonConforme: boolean;
  /**
   * Vrai si une opération du plan d'entretien est dépassée, faux si toutes sont
   * à jour. **Nul quand on ne sait pas** : une opération sans passage relevé, ou
   * une période passée — le plan ne garde pas l'historique de son état.
   */
  entretienEnRetard: boolean | null;
  accidents: number;
  accidentsCorporels: number;
  pannesEnMission: number;
  avariesChargement: number;
  contraventions: number;
  montantContraventions: number;
  interventionsPreventives: number;
  interventionsCuratives: number;
  immobilisationInterventions: number;
  nombreInterventions: number;
  /** Interventions curatives dont la durée d'immobilisation n'est pas connue : tant qu'il en reste, la disponibilité ne se calcule pas. */
  curativesSansDuree: number;
  /** Véhicules immobilisés depuis une date inconnue : la disponibilité ne se calcule pas non plus (0041). */
  immobilisationsSansDebut: number;
  cout: number;
  coutMaintenance: number;
  coutCuratif: number;
}

/** L'identité d'un véhicule, pour filtrer sans recharger. */
export interface VehiculeTableau {
  id: string;
  immatriculation: string;
  immatriculationAffichee: string;
  libelle: string;
  categorie: CategorieVehicule;
  categorieFlotte: CategorieFlotte;
  businessUnit: BusinessUnit | null;
  site: string | null;
}

/** Ce que la flotte produit hors véhicule, mois par mois. */
export interface FaitsFlotteMois {
  mois: string;
  /** Jours d'indisponibilité des chauffeurs (congé, maladie, suspension, formation). */
  joursIndisponibiliteChauffeurs: number;
  /** Jours-chauffeurs théoriques du mois. */
  joursChauffeurs: number;
  /** Coût du transport confié à des tiers — module Transporteurs. */
  coutTransportTiers: number;
  /*
   * Le détail des trois modèles, parce que le total ne dit pas ce qu'il faut
   * négocier : un affrètement se discute au tarif, une mise à disposition au
   * contrat, une prestation hors grille se formalise. L'anneau du tableau de
   * bord les distingue pour cette raison.
   */
  coutAffretements: number;
  coutMisesADisposition: number;
  coutPrestations: number;
  /** La TVA que portent ces coûts, pour les lire TTC ; nulle sous retenue à la source. */
  taxeTransportTiers: number;
  /**
   * Tonnes confiées à des tiers — relevé de transport. **Nulles quand le relevé
   * ne couvre pas toute la période** : un demi-mois de tonnes rapporté à un mois
   * de coûts doublerait le coût à la tonne (voir `releveCouvre`).
   */
  tonnesTiers: number | null;
  /** Tonnes portées par le parc sur le mois — relevé de transport ; nulles de même. */
  tonnesInternes: number | null;
}

/** Ce qui se lit au jour dit, et non sur une période. */
export interface SituationJour {
  /** Solde de la caisse parc, en francs ; nul quand la caisse n'a aucun mouvement. */
  soldeCaisse: number | null;
  /** Seuil de réapprovisionnement de la caisse. */
  seuilReapprovisionnement: number;
  /** Véhicules prêts à charger aujourd'hui, et engagés. */
  pretsACharger: number;
  engages: number;
  /** Jours écoulés depuis le dernier accident déclaré. */
  joursSansAccident: number | null;
  /** Montant des demandes d'achat commandées et non encore réglées. */
  engagementsEnCours: number;
  /** Délai moyen entre la demande d'achat et son règlement, en jours. */
  cycleAchatJours: number | null;
  /** Véhicules de transport spécial et ceux dont le certificat de salubrité est valide. */
  vehiculesSpeciaux: number;
  vehiculesSpeciauxConformes: number;
}

/** Les faits d'une période, tous véhicules retenus confondus. */
export interface Cumul {
  nombreMois: number;
  /**
   * Durée nominale de la période, en jours : sept pour la semaine, la longueur
   * du mois pour le mois en cours, 365 pour l'année. C'est elle qui met les
   * cibles mensuelles à l'échelle — et non les jours déjà écoulés, sans quoi
   * la cible du mois s'effondrerait le 2 du mois.
   */
  joursPeriode: number;
  vehicules: number;
  engages: number;
  joursVehicules: number;
  km: number;
  litres: number;
  litresReference: number;
  joursImmobilises: number;
  /** Moyenne mensuelle des véhicules non conformes en fin de mois. */
  nonConformes: number;
  /** Moyenne mensuelle des véhicules dont l'entretien est en retard. */
  entretienEnRetard: number;
  /** Véhicules engagés dont on ne sait pas si l'entretien est à jour. */
  planInconnus: number;
  accidents: number;
  accidentsCorporels: number;
  pannesEnMission: number;
  avariesChargement: number;
  contraventions: number;
  montantContraventions: number;
  interventionsPreventives: number;
  interventionsCuratives: number;
  immobilisationInterventions: number;
  nombreInterventions: number;
  /** Interventions curatives dont la durée d'immobilisation n'est pas connue : tant qu'il en reste, la disponibilité ne se calcule pas. */
  curativesSansDuree: number;
  /** Véhicules immobilisés depuis une date inconnue : la disponibilité ne se calcule pas non plus (0041). */
  immobilisationsSansDebut: number;
  cout: number;
  coutMaintenance: number;
  coutCuratif: number;
  /** Jours d'immobilisation des seuls véhicules de transport spécial. */
  joursImmobilisesSpeciaux: number;
  curativesSansDureeSpeciaux: number;
  immobilisationsSansDebutSpeciaux: number;
  joursIndisponibiliteChauffeurs: number;
  joursChauffeurs: number;
  /** Coût du transport tiers sur la période — module Transporteurs. */
  coutTransportTiers: number;
  taxeTransportTiers: number;
  /** Nulles dès qu'un mois de la période n'est pas couvert par le relevé. */
  tonnesTiers: number | null;
  /** Tonnes portées par le parc, relevé de transport à l'appui. */
  tonnesInternes: number | null;
  jour: SituationJour;
}

export function cumuler(faits: FaitsVehiculeMois[], flotte: FaitsFlotteMois[], jour: SituationJour, joursNominaux?: number): Cumul {
  const mois = new Set(faits.map((f) => f.mois));
  const nombreMois = Math.max(1, mois.size);
  const vehicules = new Set(faits.map((f) => f.vehiculeId));
  const somme = (lire: (f: FaitsVehiculeMois) => number) => faits.reduce((s, f) => s + lire(f), 0);
  /* À défaut de durée nominale, la somme des jours écoulés fait l'affaire. */
  const joursParMois = new Map<string, number>();
  for (const f of faits) if (!joursParMois.has(f.mois)) joursParMois.set(f.mois, f.jours);
  return {
    nombreMois: mois.size,
    joursPeriode: joursNominaux ?? [...joursParMois.values()].reduce((s, j) => s + j, 0),
    vehicules: vehicules.size,
    /* Le parc engagé est un état, pas un cumul : on le moyenne sur les mois. */
    engages: Math.round(faits.filter((f) => f.engage).length / nombreMois),
    joursVehicules: somme((f) => (f.engage ? f.jours : 0)),
    km: somme((f) => f.km),
    litres: somme((f) => f.litres),
    litresReference: somme((f) => f.litresReference),
    joursImmobilises: somme((f) => (f.engage ? f.joursImmobilises : 0)),
    nonConformes: Math.round((faits.filter((f) => f.engage && f.nonConforme).length / nombreMois) * 10) / 10,
    entretienEnRetard: Math.round((faits.filter((f) => f.engage && f.entretienEnRetard).length / nombreMois) * 10) / 10,
    planInconnus: Math.round((faits.filter((f) => f.engage && f.entretienEnRetard === null).length / nombreMois) * 10) / 10,
    accidents: somme((f) => f.accidents),
    accidentsCorporels: somme((f) => f.accidentsCorporels),
    pannesEnMission: somme((f) => f.pannesEnMission),
    avariesChargement: somme((f) => f.avariesChargement),
    contraventions: somme((f) => f.contraventions),
    montantContraventions: somme((f) => f.montantContraventions),
    interventionsPreventives: somme((f) => f.interventionsPreventives),
    interventionsCuratives: somme((f) => f.interventionsCuratives),
    immobilisationInterventions: somme((f) => f.immobilisationInterventions),
    nombreInterventions: somme((f) => f.nombreInterventions),
    curativesSansDuree: somme((f) => (f.engage ? f.curativesSansDuree : 0)),
    immobilisationsSansDebut: somme((f) => (f.engage ? f.immobilisationsSansDebut : 0)),
    cout: somme((f) => f.cout),
    coutMaintenance: somme((f) => f.coutMaintenance),
    coutCuratif: somme((f) => f.coutCuratif),
    joursImmobilisesSpeciaux: somme((f) => (f.transportSpecial ? f.joursImmobilises : 0)),
    curativesSansDureeSpeciaux: somme((f) => (f.transportSpecial ? f.curativesSansDuree : 0)),
    immobilisationsSansDebutSpeciaux: somme((f) => (f.transportSpecial ? f.immobilisationsSansDebut : 0)),
    joursIndisponibiliteChauffeurs: flotte.reduce((s, f) => s + f.joursIndisponibiliteChauffeurs, 0),
    joursChauffeurs: flotte.reduce((s, f) => s + f.joursChauffeurs, 0),
    coutTransportTiers: flotte.reduce((s, f) => s + f.coutTransportTiers, 0),
    taxeTransportTiers: flotte.reduce((s, f) => s + f.taxeTransportTiers, 0),
    /* Un mois sans tonnes rend le cumul inconnu : le compléter par zéro fausserait tout ratio. */
    tonnesTiers: flotte.some((f) => f.tonnesTiers === null) ? null : flotte.reduce((s, f) => s + (f.tonnesTiers ?? 0), 0),
    tonnesInternes: flotte.some((f) => f.tonnesInternes === null) ? null : flotte.reduce((s, f) => s + (f.tonnesInternes ?? 0), 0),
    jour,
  };
}

/* -- Le registre --------------------------------------------------------------- */

export type Sens = "inf" | "sup";

export interface DefinitionIndicateur {
  /** L'identifiant de la maquette : « d1 », « c3 »… La sélection est faite de ces clés. */
  id: string;
  axe: CleAxe;
  libelle: string;
  unite?: string;
  /** Le code du référentiel DO, quand l'indicateur en fait partie. */
  code?: string;
  /** La cible, telle que la maquette l'écrit. */
  cibleTexte: string;
  /** La cible chiffrée, quand elle en a une : elle décide de la conformité. */
  cible?: { sens: Sens; valeur: number };
  /**
   * La figure qui convient à la dimension.
   *
   * **Un flux se lit en barres, un état en courbe.** Trois accidents en mars et
   * un en avril ne se relient pas d'un trait : il n'existe pas d'instant entre
   * les deux où l'on aurait mesuré « deux accidents ». Un taux de disponibilité,
   * lui, existe à tout moment — la courbe dit vrai. Faute de quoi le graphique
   * invente une continuité que la mesure n'a pas.
   *
   * Par défaut, la courbe : c'est le cas le plus fréquent.
   */
  forme?: "courbe" | "barres";
  /**
   * Vrai quand la cible vaut pour un mois et doit suivre la période : cinq
   * pannes tolérées par mois, ce n est pas cinq par an. La maquette est écrite
   * pour le mois en cours ; l application, elle, doit tenir les trois périodes.
   */
  parMois?: boolean;
  /** Décimales à afficher. */
  decimales?: number;
  /** L'écran où la valeur se vérifie, ligne à ligne. */
  href: string;
  /**
   * Vrai quand l'indicateur lit la situation du jour et non la période : il ne
   * se met pas en courbe, il serait plat.
   */
  instantane?: boolean;
  /**
   * Pourquoi l'indicateur n'a pas de valeur aujourd'hui. Renseigné, il
   * s'affiche « source à brancher » et ne compte pas dans le score.
   */
  aVenir?: string;
  calcul?: (c: Cumul) => number | null;
}

const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

/**
 * Les trente-huit indicateurs de la maquette, dans l'ordre où la Direction des
 * Opérations les a posés. Libellés et cibles sont repris mot pour mot ; ce qui
 * est ajouté ici, c'est le calcul sur les données de l'application, ou la
 * raison pour laquelle il n'existe pas encore.
 */
export const INDICATEURS: DefinitionIndicateur[] = [
  /* ---- S — Sécurité ---- */
  { id: "s1", axe: "S", libelle: "Accidents de circulation", forme: "barres", cibleTexte: "Cible 0", cible: { sens: "inf", valeur: 0 }, href: "/incidents", calcul: (c) => c.accidents },
  {
    id: "s2",
    axe: "S",
    libelle: "Taux de fréquence des accidents",
    unite: "/100 000 km",
    cibleTexte: "Cible ≤ 1,0",
    cible: { sens: "inf", valeur: 1 },
    decimales: 1,
    href: "/incidents",
    calcul: (c) => (c.km > 0 ? Math.round((c.accidents / c.km) * 100_000 * 10) / 10 : null),
  },
  { id: "s3", axe: "S", libelle: "Contraventions", forme: "barres", cibleTexte: "Cible ≤ 5 par mois", cible: { sens: "inf", valeur: 5 }, parMois: true, href: "/couts?vue=postes", calcul: (c) => c.contraventions },
  { id: "s4", axe: "S", libelle: "Score de conduite télématique", unite: "/100", cibleTexte: "Cible ≥ 80 · source Teltonika", cible: { sens: "sup", valeur: 80 }, href: "/", aVenir: "Télématique Teltonika — lot 3" },
  { id: "s5", axe: "S", libelle: "Véhicules non conformes en circulation", forme: "barres", cibleTexte: "Cible 0 · VT ou assurance échue", cible: { sens: "inf", valeur: 0 }, decimales: 1, href: "/conformite", calcul: (c) => c.nonConformes },
  { id: "s6", axe: "S", libelle: "Jours sans accident", unite: "j", cibleTexte: "Le plus haut possible", instantane: true, href: "/incidents", calcul: (c) => c.jour.joursSansAccident },

  /* ---- Q — Qualité ---- */
  { id: "q1", axe: "Q", libelle: "Livraisons sans incident qualité", unite: "%", cibleTexte: "Cible ≥ 98 %", cible: { sens: "sup", valeur: 98 }, href: "/", aVenir: "Livraisons SediLiv — lot 3" },
  { id: "q2", axe: "Q", libelle: "Incidents produit à la livraison", forme: "barres", cibleTexte: "Casse, manquant, écart quantité", cible: { sens: "inf", valeur: 0 }, href: "/incidents", calcul: (c) => c.avariesChargement },
  { id: "q3", axe: "Q", libelle: "Écarts de pesée hors tolérance", unite: "%", cibleTexte: "Cible ≤ 1 % · pont bascule", cible: { sens: "inf", valeur: 1 }, href: "/", aVenir: "Pont bascule — non branché" },
  { id: "q4", axe: "Q", libelle: "Ruptures de chaîne du froid", cibleTexte: "Cible 0 · camions frigo", cible: { sens: "inf", valeur: 0 }, href: "/", aVenir: "Télématique frigorifique — lot 3" },
  {
    id: "q5",
    axe: "Q",
    libelle: "Conformité des véhicules spéciaux",
    unite: "%",
    cibleTexte: "Revêtement, propreté, désinfection",
    cible: { sens: "sup", valeur: 100 },
    decimales: 1,
    instantane: true,
    href: "/conformite",
    calcul: (c) => pct(c.jour.vehiculesSpeciauxConformes, c.jour.vehiculesSpeciaux),
  },
  { id: "q6", axe: "Q", libelle: "Réclamations qualité transport", cibleTexte: "Cible ≤ 5 par mois", cible: { sens: "inf", valeur: 5 }, parMois: true, href: "/", aVenir: "Réclamations clients SediLiv — lot 3" },

  /* ---- D — Livraison ---- */
  {
    id: "d1",
    axe: "D",
    code: "D_TDPA",
    libelle: "Taux de disponibilité du parc",
    unite: "%",
    cibleTexte: "Cible ≥ 90 %",
    cible: { sens: "sup", valeur: 90 },
    decimales: 1,
    href: "/disponibilite",
    /* Une panne dont la durée n'est pas relevée ne compte pour aucun jour : le taux sortirait à 100 %. Tant qu'il en reste sur la période, on ne sait pas. */
    calcul: (c) => (c.curativesSansDuree > 0 || c.immobilisationsSansDebut > 0 || c.joursVehicules <= 0 ? null : Math.round((1 - c.joursImmobilises / c.joursVehicules) * 1000) / 10),
  },
  {
    id: "d2",
    axe: "D",
    code: "D_TICV",
    libelle: "Indisponibilité des véhicules spéciaux",
    unite: "h",
    /* Des heures cumulées dans le mois : un flux. */
    forme: "barres",
    cibleTexte: "Cible ≤ 250 h par mois",
    cible: { sens: "inf", valeur: 250 },
    parMois: true,
    href: "/maintenance?vue=ordres",
    calcul: (c) => (c.curativesSansDureeSpeciaux > 0 || c.immobilisationsSansDebutSpeciaux > 0 ? null : c.joursImmobilisesSpeciaux * 24),
  },
  { id: "d3", axe: "D", code: "D_NPVEL", libelle: "Pannes de véhicules en ligne", forme: "barres", cibleTexte: "Cible ≤ 5 par mois · en mission", cible: { sens: "inf", valeur: 5 }, parMois: true, href: "/incidents", calcul: (c) => c.pannesEnMission },
  { id: "d4", axe: "D", libelle: "Taux de service OTIF", unite: "%", cibleTexte: "Cible ≥ 95 % · réalisé vs plan", cible: { sens: "sup", valeur: 95 }, href: "/", aVenir: "Plan de livraison SediLiv — lot 3" },
  { id: "d5", axe: "D", libelle: "Taux de remplissage des camions", unite: "%", cibleTexte: "Cible ≥ 85 %", cible: { sens: "sup", valeur: 85 }, href: "/", aVenir: "Tonnages SediLiv — lot 3" },
  {
    id: "d6",
    axe: "D",
    libelle: "Respect du plan préventif",
    unite: "%",
    cibleTexte: "Cible ≥ 90 %",
    cible: { sens: "sup", valeur: 90 },
    decimales: 1,
    href: "/maintenance?vue=afaire",
    /* Un véhicule dont on ignore l'état ne compte pas pour à jour : tant qu'il en reste, le taux ne se calcule pas. */
    calcul: (c) => (c.planInconnus > 0 || c.engages <= 0 ? null : Math.round((1 - c.entretienEnRetard / c.engages) * 1000) / 10),
  },
  {
    id: "d7",
    axe: "D",
    libelle: "Immobilisation moyenne au garage",
    unite: "j",
    cibleTexte: "Cible ≤ 7 j",
    cible: { sens: "inf", valeur: 7 },
    decimales: 1,
    href: "/maintenance?vue=interventions",
    calcul: (c) => (c.nombreInterventions > 0 ? Math.round((c.immobilisationInterventions / c.nombreInterventions) * 10) / 10 : null),
  },
  { id: "d8", axe: "D", libelle: "Kilomètres à vide", unite: "%", cibleTexte: "Cible ≤ 15 %", cible: { sens: "inf", valeur: 15 }, href: "/", aVenir: "Missions SediLiv — lot 3" },
  { id: "d9", axe: "D", libelle: "Véhicules prêts à charger", cibleTexte: "Sur les véhicules engagés", instantane: true, href: "/disponibilite", calcul: (c) => c.jour.pretsACharger },
  { id: "d10", axe: "D", libelle: "Véhicules bloqués faute de pièce", cibleTexte: "En attente de réception", cible: { sens: "inf", valeur: 0 }, href: "/maintenance?vue=ordres", aVenir: "Réception des pièces — suivie dans Sage X3" },

  /* ---- C — Coût ---- */
  /*
   * Les deux coûts à la tonne, **alimentés le 5 septembre 2026** par le relevé
   * de transport. Ils attendaient les tonnages de SediLiv ; le relevé les porte,
   * et le plan d'action du compte rendu ADEX du 10 avril demandait précisément
   * de « partager les coûts de transport (F/tonne) par transporteur ».
   *
   * Le coût du parc rapporté à ses tonnes est le **terme de comparaison** de
   * tout le module : c'est lui qui dit si confier une tonne à un tiers coûte
   * plus ou moins cher que la porter soi-même. Sans lui, on ne pouvait
   * qu'observer une dépense ; avec lui, on peut arbitrer.
   */
  {
    id: "c1",
    axe: "C",
    code: "C_CDM_SEDI",
    libelle: "Coût de transport — flotte SEDIMA",
    unite: "F/t",
    cibleTexte: "Cible ≤ 14 000 · charges du parc rapportées aux tonnes portées",
    cible: { sens: "inf", valeur: 14_000 },
    href: "/releve",
    /* Un coût nul sur un mois à peine commencé n'est pas « le transport est
       gratuit » : c'est « on n'a pas encore mesuré ». On n'affiche rien. */
    calcul: (c) => (c.tonnesInternes !== null && c.tonnesInternes > 0 && c.cout > 0 ? Math.round(c.cout / c.tonnesInternes) : null),
  },
  {
    id: "c2",
    axe: "C",
    code: "C_CDM_TR",
    libelle: "Coût de transport — tiers",
    unite: "F/t",
    cibleTexte: "Cible ≤ 16 000 · coût net rapporté aux tonnes confiées",
    cible: { sens: "inf", valeur: 16_000 },
    href: "/releve",
    calcul: (c) => (c.tonnesTiers !== null && c.tonnesTiers > 0 && c.coutTransportTiers > 0 ? Math.round(c.coutTransportTiers / c.tonnesTiers) : null),
  },
  /*
   * Alimenté depuis le module Transporteurs (4 septembre 2026).
   *
   * **Question 71, résolue le 5 septembre 2026.** Le référentiel DO définit
   * C_TED_EXT sur les **tonnes**. Faute de tonnages, l'application le calculait
   * en coût de transport, et disait qu'elle le faisait. Le **relevé de
   * transport** porte désormais les tonnes des deux côtés — le parc et les
   * tiers —, et l'indicateur se calcule sur la base juste.
   *
   * Le coût reste le filet : sur une période sans tonnage relevé, mieux vaut un
   * taux en coût, dûment annoncé, que pas de taux du tout. Les deux bases
   * convergent — 52,8 % en tonnes contre 55,4 % en coût sur douze mois —, ce
   * qui donne rétrospectivement raison à l'approximation.
   */
  {
    id: "c3",
    axe: "C",
    code: "C_TED_EXT",
    libelle: "Taux d'externalisation",
    unite: "%",
    cibleTexte: "Cible ≤ 35 % · en tonnes livrées",
    cible: { sens: "inf", valeur: 35 },
    decimales: 1,
    href: "/transporteurs",
    calcul: (c) => {
      /* La base juste : les tonnes, dès qu'elles sont relevées des deux côtés. */
      if (c.tonnesInternes !== null && c.tonnesTiers !== null && c.tonnesInternes + c.tonnesTiers > 0) return Math.round((c.tonnesTiers / (c.tonnesInternes + c.tonnesTiers)) * 1000) / 10;
      /* À défaut, le coût. Un taux a besoin de ses deux termes : sur les premiers
         jours d'un mois, la location des véhicules tiers court déjà quand le parc
         n'a pas encore enregistré de dépense, et le rapport vaudrait 100 % par
         construction. Mieux vaut ne rien afficher que d'afficher cela. */
      if (c.cout <= 0) return null;
      const total = c.coutTransportTiers + c.cout;
      return total > 0 ? Math.round((c.coutTransportTiers / total) * 1000) / 10 : null;
    },
  },
  {
    id: "c13",
    axe: "C",
    code: "C_CDM_TR_REEL",
    libelle: "Coût du transport tiers",
    unite: "F",
    /* Une dépense du mois : elle se pose, elle ne se relie pas. */
    forme: "barres",
    cibleTexte: "Ce que le parc confie à des transporteurs",
    href: "/transporteurs",
    calcul: (c) => (c.coutTransportTiers > 0 ? c.coutTransportTiers : null),
  },
  { id: "c4", axe: "C", libelle: "Coût kilométrique complet", unite: "F/km", cibleTexte: "Toutes charges incluses", href: "/couts", calcul: (c) => (c.km > 0 ? Math.round(c.cout / c.km) : null) },
  {
    id: "c5",
    axe: "C",
    libelle: "Consommation moyenne du parc",
    unite: "L/100",
    cibleTexte: "Contre la référence des catégories",
    decimales: 1,
    href: "/couts?vue=carburant",
    calcul: (c) => (c.km > 0 && c.litres > 0 ? Math.round((c.litres / c.km) * 1000) / 10 : null),
  },
  { id: "c6", axe: "C", libelle: "Écarts de facturation détectés", unite: "F", cibleTexte: "Récupérés sur transporteurs", href: "/couts", aVenir: "Facturation transporteurs — lot 3" },
  { id: "c7", axe: "C", libelle: "Dépenses de parc", unite: "F", forme: "barres", cibleTexte: "Sur la période retenue", href: "/couts?vue=postes", calcul: (c) => c.cout },
  {
    id: "c8",
    axe: "C",
    libelle: "Part du curatif dans la maintenance",
    unite: "%",
    cibleTexte: "Cible ≤ 40 %",
    cible: { sens: "inf", valeur: 40 },
    decimales: 1,
    href: "/couts?vue=postes",
    calcul: (c) => pct(c.coutCuratif, c.coutMaintenance),
  },
  { id: "c9", axe: "C", libelle: "Solde de la caisse parc", unite: "F", cibleTexte: "Seuil de réappro 200 kF", cible: { sens: "sup", valeur: 200_000 }, instantane: true, href: "/caisse", calcul: (c) => c.jour.soldeCaisse },
  { id: "c10", axe: "C", libelle: "Cycle achat DA → paiement", unite: "j", cibleTexte: "Cible ≤ 30 j", cible: { sens: "inf", valeur: 30 }, instantane: true, href: "/caisse?vue=achats", calcul: (c) => c.jour.cycleAchatJours },
  { id: "c11", axe: "C", libelle: "Engagements en cours", unite: "F", cibleTexte: "Commandé non payé", instantane: true, href: "/caisse?vue=achats", calcul: (c) => c.jour.engagementsEnCours },
  { id: "c12", axe: "C", libelle: "Écarts de rapprochement à trois voies", cibleTexte: "Cible 0", cible: { sens: "inf", valeur: 0 }, href: "/caisse?vue=achats", aVenir: "Rapprochement tenu dans Sage X3" },

  /* ---- M — Morale ---- */
  { id: "m1", axe: "M", libelle: "Satisfaction client à la livraison", unite: "/5", cibleTexte: "Cible ≥ 4,5", cible: { sens: "sup", valeur: 4.5 }, href: "/", aVenir: "Enquête client — non branchée" },
  { id: "m2", axe: "M", libelle: "Réclamations liées au transport", cibleTexte: "Cible ≤ 8 par mois", cible: { sens: "inf", valeur: 8 }, parMois: true, href: "/", aVenir: "Réclamations clients SediLiv — lot 3" },
  { id: "m3", axe: "M", libelle: "Formations sécurité routière à jour", unite: "%", cibleTexte: "Cible 100 %", cible: { sens: "sup", valeur: 100 }, href: "/chauffeurs", aVenir: "Suivi des formations — source RH" },
  {
    id: "m4",
    axe: "M",
    libelle: "Absentéisme chauffeurs",
    unite: "%",
    cibleTexte: "Cible ≤ 4 % · source RH",
    cible: { sens: "inf", valeur: 4 },
    decimales: 1,
    href: "/chauffeurs",
    calcul: (c) => pct(c.joursIndisponibiliteChauffeurs, c.joursChauffeurs),
  },
];

/** Les six indicateurs du référentiel DO — la sélection par défaut de la maquette. */
export const SELECTION_DEFAUT = ["d1", "d2", "d3", "c1", "c2", "c3"];

/**
 * La rangée de pastilles du tableau de bord refondu (7 septembre 2026) : cinq
 * au plus, sur une seule ligne, quels que soient les axes. Au-delà, le choix
 * se grise ; il faut en décocher une pour en prendre une autre.
 */
export const MAX_PASTILLES = 5;
export const PASTILLES_DEFAUT = ["d1", "c2", "c3", "d3", "s1"];

/** Une sélection relue du stockage, bornée à la rangée. */
export function limiterPastilles(selection: string[]): string[] {
  return selection.filter((id) => INDICATEURS.some((d) => d.id === id)).slice(0, MAX_PASTILLES);
}

/**
 * Trois indicateurs par axe au maximum — règle du métier du 3 septembre au soir.
 * Un axe qui en montre davantage ne se lit plus d'un coup d'œil, et le tableau
 * de bord cesse d'être un tableau de bord.
 */
export const MAX_PAR_AXE = 3;

/**
 * Borne une sélection à trois par axe, dans l'ordre du référentiel. Sert à
 * relire une sélection enregistrée avant que la règle n'existe.
 */
export function limiter(selection: string[]): string[] {
  const garde: string[] = [];
  for (const axe of AXES) {
    const surLAxe = selection.filter((id) => INDICATEUR_PAR_ID.get(id)?.axe === axe.cle);
    garde.push(...surLAxe.slice(0, MAX_PAR_AXE));
  }
  return garde;
}

/** Ce qui est déjà retenu sur un axe, dans l'ordre du référentiel. */
export function selectionDeAxe(selection: string[], axe: CleAxe): string[] {
  return INDICATEURS.filter((d) => d.axe === axe && selection.includes(d.id)).map((d) => d.id);
}

/**
 * Ajoute ou retire un indicateur en tenant la limite de trois par axe : au-delà,
 * le plus anciennement retenu de l'axe cède sa place. La case ne se refuse
 * jamais en silence — c'est le plus ancien qui sort, pas le nouveau qui échoue.
 */
export function basculer(selection: string[], id: string): string[] {
  const d = INDICATEUR_PAR_ID.get(id);
  if (!d) return selection;
  if (selection.includes(id)) return selection.filter((x) => x !== id);
  const surLAxe = selection.filter((x) => INDICATEUR_PAR_ID.get(x)?.axe === d.axe);
  const aRetirer = surLAxe.length >= MAX_PAR_AXE ? surLAxe.slice(0, surLAxe.length - MAX_PAR_AXE + 1) : [];
  return [...selection.filter((x) => !aRetirer.includes(x)), id];
}

export const INDICATEUR_PAR_ID = new Map(INDICATEURS.map((i) => [i.id, i]));

/**
 * Les indicateurs qui se suivent dans le temps : alimentés, et calculés sur la
 * période et non sur la situation du jour.
 */
export const INDICATEURS_COURBE = INDICATEURS.filter((d) => d.calcul !== undefined && !d.aVenir && !d.instantane);

/**
 * Douze courbes au plus. La grille en pose deux par ligne : douze tiennent en
 * six lignes, ce qui reste parcourable d'un défilement. Au-delà, on
 * n'observe plus une flotte, on feuillette un rapport.
 */
/* Huit depuis le 7 septembre 2026 au soir (demande du métier) : deux rangées
   de quatre, une échelle par courbe. Quatre courbes tiennent sur un écran ;
   au-delà, la page défile, et c'est un choix. */
export const MAX_COURBES = 8;

/** Les courbes proposées d'emblée : disponibilité, coût, consommation, accidents. */
export const COURBES_DEFAUT = ["d1", "c4", "c5", "s1"];

/* -- Évaluation ---------------------------------------------------------------- */

/**
 * L'état d'un indicateur.
 *
 * `non-alimente` et `sans-donnee` ne disent pas la même chose et ne doivent
 * pas se confondre : le premier veut dire « la source n'est pas branchée »
 * (télématique, tonnages SediLiv, pont bascule), le second « la source est
 * branchée, mais la période ne porte rien ». Les mêler ferait passer un module
 * livré pour un module manquant — c'est arrivé au taux d'externalisation le
 * jour de sa mise en service.
 */
export type EtatIndicateur = "ok" | "ko" | "sans-cible" | "non-alimente" | "sans-donnee";

export interface ValeurIndicateur {
  definition: DefinitionIndicateur;
  valeur: number | null;
  etat: EtatIndicateur;
  /** La cible mise à l échelle de la période ; nulle quand l indicateur n en a pas. */
  cible: number | null;
}

/** Jours d un mois moyen — le pas auquel les cibles mensuelles sont écrites. */
const JOURS_PAR_MOIS = 30.44;

/**
 * La cible effective sur la période observée. Une cible mensuelle suit la
 * durée : sur une semaine on en tolère un quart, sur un an douze fois plus.
 */
export function cibleEffective(d: DefinitionIndicateur, joursPeriode: number): number | null {
  if (!d.cible) return null;
  if (!d.parMois || d.cible.valeur === 0) return d.cible.valeur;
  const facteur = Math.max(joursPeriode, 1) / JOURS_PAR_MOIS;
  const mise = d.cible.valeur * facteur;
  return mise >= 10 ? Math.round(mise) : Math.round(mise * 10) / 10;
}

export function evaluerIndicateur(d: DefinitionIndicateur, cumul: Cumul): ValeurIndicateur {
  if (d.aVenir || !d.calcul) return { definition: d, valeur: null, etat: "non-alimente", cible: null };
  const valeur = d.calcul(cumul);
  if (valeur === null) return { definition: d, valeur: null, etat: "sans-donnee", cible: null };
  const cible = cibleEffective(d, cumul.joursPeriode);
  if (cible === null) return { definition: d, valeur, etat: "sans-cible", cible: null };
  const tenue = d.cible!.sens === "inf" ? valeur <= cible : valeur >= cible;
  return { definition: d, valeur, etat: tenue ? "ok" : "ko", cible };
}

export interface AxeEvalue {
  axe: Axe;
  /** Les indicateurs affichés de cet axe, dans l'ordre du référentiel. */
  indicateurs: ValeurIndicateur[];
  /**
   * Part des indicateurs affichés qui tiennent leur cible, en points.
   * Nul quand l'axe n'a aucun indicateur affiché ou aucun de mesurable.
   */
  score: number | null;
  /** Combien d'indicateurs affichés attendent encore leur source. */
  nonAlimentes: number;
}

/**
 * Le score d'un axe, à la règle de la maquette : la part des indicateurs
 * affichés qui tiennent leur cible. Ceux qui n'ont pas de source branchée, et
 * ceux qui n'ont pas de cible chiffrée, sont écartés du calcul — on ne note
 * pas ce qu'on ne mesure pas.
 */
export function evaluerAxes(cumul: Cumul, selection: string[]): AxeEvalue[] {
  return AXES.map((axe) => {
    const indicateurs = INDICATEURS.filter((d) => d.axe === axe.cle && selection.includes(d.id)).map((d) => evaluerIndicateur(d, cumul));
    const notes = indicateurs.filter((v) => v.etat === "ok" || v.etat === "ko");
    return {
      axe,
      indicateurs,
      score: notes.length ? Math.round((100 * notes.filter((v) => v.etat === "ok").length) / notes.length) : null,
      nonAlimentes: indicateurs.filter((v) => v.etat === "non-alimente").length,
    };
  });
}

/** La couleur d'un score, aux seuils de la maquette : 80 et 50. */
export function couleurScore(score: number | null): string {
  if (score === null) return "var(--color-attenue-2)";
  return score >= 80 ? "var(--color-favorable)" : score >= 50 ? "var(--color-vigilance)" : "var(--color-defavorable)";
}

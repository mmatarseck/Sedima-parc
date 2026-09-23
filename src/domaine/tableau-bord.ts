/* ============================================================================
 * Tableau de bord SQDCM — le référentiel d'indicateurs du parc.
 *
 * Conforme à la maquette « Parc SEDIMA » validée par la Direction des
 * Opérations : cinq axes, dont les **six indicateurs du référentiel DO** —
 * D_TDPA, D_TICV, D_NPVEL, C_CDM_SEDI, C_CDM_TR, C_TED_EXT. Depuis le
 * 8 septembre 2026, ces indicateurs de période vivent **en courbes** (huit au
 * plus, choisies par compte) ; la rangée du haut est faite de pastilles de
 * l'état du moment (`pastilles.ts`). Le score par axe de la maquette et la
 * sélection à cinq, qui n'étaient plus lus, ont été retirés le 23 septembre 2026.
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
  /** Toutes les charges du mois, **carburant des pleins compris** (audit du 23 septembre 2026 : la fiche du véhicule les comptait, le tableau de bord non). */
  cout: number;
  coutMaintenance: number;
  coutCuratif: number;
  /** La part du coût qui vient des pleins. */
  coutCarburant?: number;
  /** Tonnes livrées par ce véhicule dans le mois, bons de livraison à l'appui (0044) ; nulles quand les bons ne couvrent pas le mois. */
  tonnesLivrees?: number | null;
}

/** L'identité d'un véhicule, pour filtrer sans recharger. */
export interface VehiculeTableau {
  /** L'immatriculation : c'est la clé des faits mensuels. */
  id: string;
  /** L'identifiant en base : c'est la clé des situations journalières, que les filtres doivent aussi reconnaître. */
  uuid?: string;
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
  /**
   * D'où viennent les tonnes du mois. Les **bons de livraison** (0044) couvrent
   * toutes les usines — aliment, minoterie, abattoir — quand le relevé de
   * transport ne tient que l'aliment de l'UAB ; rapporter les charges de tout
   * le parc aux seules tonnes de l'UAB gonflait le coût à la tonne (audit du
   * 23 septembre 2026). Les bons font foi quand ils couvrent le mois, le relevé
   * sinon.
   */
  sourceTonnes?: "livraisons" | "releve" | null;
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
  /**
   * Les registres tenus. Un registre sans aucune ligne n'est pas encore tenu, et
   * ses comptes ne sont pas des zéros : les courbes qui en vivent disent « — »
   * (11 septembre 2026, même règle que la carte grise).
   */
  registres: { incidents: boolean; contraventions: boolean; indisponibilites: boolean; salubrite?: boolean };
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
  coutCarburant: number;
  /*
   * **Les ratios au kilomètre ne se font que sur les véhicules dont on connaît
   * les kilomètres** (audit du 23 septembre 2026). Le compteur n'est relevé que
   * sur une poignée de véhicules ; diviser les litres et les charges de *tout*
   * le parc par ces seuls kilomètres donnait 443 L/100 km et 1 434 F/km. Chaque
   * terme ci-dessous ne retient que les véhicules-mois qui ont des kilomètres.
   */
  /** Charges des véhicules-mois dont les kilomètres sont connus. */
  coutSurKm: number;
  /** Litres des véhicules-mois dont les kilomètres **et** les litres sont connus. */
  litresSurKm: number;
  /** Les kilomètres qui leur correspondent. */
  kmAvecLitres: number;
  accidentsSurKm: number;
  /** Tonnes livrées par les véhicules retenus, bons à l'appui ; nulles si les bons ne couvrent pas la période. */
  tonnesLivrees: number | null;
  /** Coût du carburant des seuls véhicules-mois qui ont livré. */
  carburantLivreurs: number;
  /** Tonnes de ces mêmes véhicules-mois. */
  tonnesLivreurs: number;
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
  /** Vrai quand les tonnes de chaque mois de la période viennent des bons de livraison, toutes usines. */
  tonnesDesBons: boolean;
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
    litres: Math.round(somme((f) => f.litres) * 10) / 10,
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
    coutCarburant: somme((f) => f.coutCarburant ?? 0),
    coutSurKm: somme((f) => (f.km > 0 ? f.cout : 0)),
    litresSurKm: Math.round(somme((f) => (f.km > 0 && f.litres > 0 ? f.litres : 0)) * 10) / 10,
    kmAvecLitres: somme((f) => (f.km > 0 && f.litres > 0 ? f.km : 0)),
    accidentsSurKm: somme((f) => (f.km > 0 ? f.accidents : 0)),
    /* Un seul véhicule-mois sans bons suffit à rendre le total inconnu : un zéro y serait une absence de mesure. */
    tonnesLivrees: faits.some((f) => f.tonnesLivrees === null || f.tonnesLivrees === undefined) ? null : Math.round(somme((f) => f.tonnesLivrees ?? 0) * 10) / 10,
    carburantLivreurs: somme((f) => ((f.tonnesLivrees ?? 0) > 0 ? (f.coutCarburant ?? 0) : 0)),
    tonnesLivreurs: somme((f) => ((f.tonnesLivrees ?? 0) > 0 ? (f.tonnesLivrees ?? 0) : 0)),
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
    tonnesDesBons: flotte.length > 0 && flotte.every((f) => f.sourceTonnes === "livraisons"),
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
  { id: "s1", axe: "S", libelle: "Accidents de circulation", forme: "barres", cibleTexte: "Cible 0", cible: { sens: "inf", valeur: 0 }, href: "/incidents", calcul: (c) => (c.jour.registres.incidents ? c.accidents : null) },
  {
    id: "s2",
    axe: "S",
    libelle: "Taux de fréquence des accidents",
    unite: "/100 000 km",
    cibleTexte: "Cible ≤ 1,0",
    cible: { sens: "inf", valeur: 1 },
    decimales: 1,
    href: "/incidents",
    /* Les accidents des seuls véhicules dont on connaît les kilomètres : ceux des autres n'ont pas de dénominateur. */
    calcul: (c) => (c.km > 0 && c.jour.registres.incidents ? Math.round((c.accidentsSurKm / c.km) * 100_000 * 10) / 10 : null),
  },
  { id: "s3", axe: "S", libelle: "Contraventions", forme: "barres", cibleTexte: "Cible ≤ 5 par mois", cible: { sens: "inf", valeur: 5 }, parMois: true, href: "/couts?vue=postes", calcul: (c) => (c.jour.registres.contraventions ? c.contraventions : null) },
  { id: "s4", axe: "S", libelle: "Score de conduite télématique", unite: "/100", cibleTexte: "Cible ≥ 80 · source Teltonika", cible: { sens: "sup", valeur: 80 }, href: "/", aVenir: "Télématique Teltonika — lot 3" },
  { id: "s5", axe: "S", libelle: "Véhicules non conformes en circulation", forme: "barres", cibleTexte: "Cible 0 · VT ou assurance échue", cible: { sens: "inf", valeur: 0 }, decimales: 1, href: "/conformite", calcul: (c) => c.nonConformes },
  { id: "s6", axe: "S", libelle: "Jours sans accident", unite: "j", cibleTexte: "Le plus haut possible", instantane: true, href: "/incidents", calcul: (c) => c.jour.joursSansAccident },

  /* ---- Q — Qualité ---- */
  { id: "q1", axe: "Q", libelle: "Livraisons sans incident qualité", unite: "%", cibleTexte: "Cible ≥ 98 %", cible: { sens: "sup", valeur: 98 }, href: "/", aVenir: "Livraisons SediLiv — lot 3" },
  { id: "q2", axe: "Q", libelle: "Incidents produit à la livraison", forme: "barres", cibleTexte: "Casse, manquant, écart quantité", cible: { sens: "inf", valeur: 0 }, href: "/incidents", calcul: (c) => (c.jour.registres.incidents ? c.avariesChargement : null) },
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
    /* Aucun certificat de salubrité au parc : le registre n'est pas tenu, et 0 % n'est pas une mesure (audit du 23 septembre 2026). */
    calcul: (c) => (c.jour.registres.salubrite === false ? null : pct(c.jour.vehiculesSpeciauxConformes, c.jour.vehiculesSpeciaux)),
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
  { id: "d3", axe: "D", code: "D_NPVEL", libelle: "Pannes de véhicules en ligne", forme: "barres", cibleTexte: "Cible ≤ 5 par mois · en mission", cible: { sens: "inf", valeur: 5 }, parMois: true, href: "/incidents", calcul: (c) => (c.jour.registres.incidents ? c.pannesEnMission : null) },
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
  /*
   * Ce que le parc livre, sur les bons de Sage X3 (0044) — 16 771 bons de
   * novembre 2025 à août 2026, que le tableau de bord ne lisait pas (audit du
   * 23 septembre 2026). Ils suivent les filtres : chaque bon porte le camion.
   */
  { id: "d11", axe: "D", libelle: "Tonnes livrées par le parc", unite: "t", forme: "barres", cibleTexte: "Bons de livraison portés par un véhicule du parc", href: "/rapports", calcul: (c) => (c.tonnesLivrees !== null && c.tonnesLivrees > 0 ? Math.round(c.tonnesLivrees) : null) },
  {
    id: "d12",
    axe: "D",
    libelle: "Tonnes livrées par véhicule engagé",
    unite: "t/mois",
    cibleTexte: "Le rendement du parc engagé, par mois",
    decimales: 1,
    href: "/rapports",
    calcul: (c) => (c.tonnesLivrees !== null && c.tonnesLivrees > 0 && c.engages > 0 ? Math.round((c.tonnesLivrees / c.engages / Math.max(1, c.nombreMois)) * 10) / 10 : null),
  },

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
    cibleTexte: "Cible ≤ 14 000 · charges du parc, carburant compris, rapportées aux tonnes des bons de livraison",
    cible: { sens: "inf", valeur: 14_000 },
    href: "/releve",
    /* Un coût nul sur un mois à peine commencé n'est pas « le transport est
       gratuit » : c'est « on n'a pas encore mesuré ». On n'affiche rien. */
    /* Les charges de tout le parc ne se rapportent qu'aux tonnes de tout le parc :
       le relevé de transport ne tient que l'aliment de l'UAB, et le rapport
       sortait deux à trois fois trop haut. Seuls les bons de livraison, qui
       couvrent toutes les usines, font le dénominateur (audit du 23 septembre 2026). */
    calcul: (c) => (c.tonnesDesBons && c.tonnesInternes !== null && c.tonnesInternes > 0 && c.cout > 0 ? Math.round(c.cout / c.tonnesInternes) : null),
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
      /* Et l'inverse : un mois commencé où les coûts des tiers ne sont pas encore
         saisis sortait à 0 %, « dans la cible » (audit du 23 septembre 2026). */
      if (c.cout <= 0 || c.coutTransportTiers <= 0) return null;
      return Math.round((c.coutTransportTiers / (c.coutTransportTiers + c.cout)) * 1000) / 10;
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
  { id: "c4", axe: "C", libelle: "Coût kilométrique complet", unite: "F/km", cibleTexte: "Toutes charges incluses, carburant compris · véhicules au compteur relevé", href: "/couts", calcul: (c) => (c.km > 0 ? Math.round(c.coutSurKm / c.km) : null) },
  {
    id: "c5",
    axe: "C",
    libelle: "Consommation moyenne du parc",
    unite: "L/100",
    cibleTexte: "Véhicules au compteur relevé · contre la référence des catégories",
    decimales: 1,
    href: "/couts?vue=carburant",
    calcul: (c) => (c.kmAvecLitres > 0 && c.litresSurKm > 0 ? Math.round((c.litresSurKm / c.kmAvecLitres) * 1000) / 10 : null),
  },
  /*
   * Le carburant rapporté aux tonnes livrées, comme l'Aperçu de la fiche
   * véhicule (22 septembre 2026), mais pour le parc. Il se passe du compteur,
   * rarement relevé : les bons de livraison donnent le dénominateur. Seuls les
   * véhicules-mois qui ont livré comptent — un véhicule de service qui fait le
   * plein sans livrer n'a rien à diviser.
   */
  {
    id: "c14",
    axe: "C",
    libelle: "Carburant par tonne livrée",
    unite: "F/t",
    cibleTexte: "Pleins des véhicules livreurs, rapportés à leurs tonnes",
    href: "/couts?vue=carburant",
    calcul: (c) => (c.tonnesLivreurs > 0 && c.carburantLivreurs > 0 ? Math.round(c.carburantLivreurs / c.tonnesLivreurs) : null),
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
    calcul: (c) => (c.jour.registres.indisponibilites ? pct(c.joursIndisponibiliteChauffeurs, c.joursChauffeurs) : null),
  },
];

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

/*
 * Les courbes proposées d'emblée. Jusqu'au 23 septembre 2026 : disponibilité,
 * coût au kilomètre, consommation, accidents — quatre courbes vides en
 * production (durées d'immobilisation, compteurs et registre des incidents non
 * tenus). Le défaut montre désormais ce que la base sait dire : le coût à la
 * tonne du parc, le taux d'externalisation (deux indicateurs DO), les tonnes
 * livrées et les dépenses. Les quatre autres restent à un clic.
 */
export const COURBES_DEFAUT = ["c1", "c3", "d11", "c7"];

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

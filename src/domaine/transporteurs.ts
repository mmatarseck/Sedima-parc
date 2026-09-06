/* ============================================================================
 * Transporteurs — ce que le parc confie à des tiers.
 *
 * Module du lot 3 (CDC §8, note de cadrage §05). Quand le parc ne suffit pas —
 * pointe d'activité, véhicule immobilisé, zone hors périmètre —, la mission est
 * **affrétée** chez un transporteur. Ce module tient ces missions : à qui, pour
 * quoi, à quel prix convenu, à quel prix facturé, et **avec quel écart**.
 *
 * Trois choses en découlent, et ce sont elles qui justifient le module :
 *  1. le **coût du transport tiers**, que personne ne sait chiffrer aujourd'hui ;
 *  2. le **taux d'externalisation** (C_TED_EXT du référentiel DO), l'un des six
 *     indicateurs qui attendaient leur source ;
 *  3. l'**écart entre le convenu et le facturé**, qui est la seule façon de
 *     tenir un transporteur à son prix.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * **Question 42 — largement répondue par le dossier de la Direction des
 * Opérations.** « Les grilles tarifaires transporteurs sont-elles formalisées
 * par écrit ? » Oui : `61. Gestion Parc/BOCAR/M.SECK/TARIF TRANSPOTEURS.xlsx`
 * tient un tarif à la tonne par destination et par transporteur, plus des
 * forfaits (poulets, phosphate, pick-up, cargo) et les mises à disposition ADEX.
 *
 * Ce qui reste à trancher n'est donc plus l'existence de la grille, mais son
 * **statut** : un tableur tenu par la gestion de parc n'est pas un contrat
 * signé. Chaque ligne porte sa `source` — `contrat`, `accord-verbal`,
 * `a-confirmer` — et l'écran compte celles qui ne reposent sur rien d'opposable.
 * C'est le chiffre à poser sur la table.
 *
 * **La mécanique de prix, elle, est vérifiée** sur les factures 2026
 * (`62. Transport & Flotte Automobile/Données Finance/FACTURES DES
 * TRANSPORTEURS 2026.xlsx`, 593 lignes de voyage) :
 *   prix de grille × 1,05 = prix facturé, puis **5 % de retenue à la source**
 *   (BRS) → le transporteur touche **net le prix de la grille**.
 * Confronté à la grille : 56 lignes sur 57 concordent, et 319 lignes sur 319
 * vérifient net = TTC × 0,95. C'est ce qui rend le contrôle de facture possible.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ce que ce module **ne fait pas** : la facturation elle-même. Comme pour les
 * achats, le processus vit dans Sage X3 (décision du 3 septembre) ; on relève
 * ici la référence, la date et le montant, et l'on rattache le coût au parc.
 * ==========================================================================*/

import type { Ton } from "./libelles";
import type { BusinessUnit, CategorieVehicule } from "./types";
import { destinationTarifaire, type RattachementLocalite } from "./flotte-tierce";

/* -- Pourquoi on affrète ------------------------------------------------------- */

export type MotifAffretement = "pointe" | "aucun-disponible" | "vehicule-immobilise" | "hors-perimetre" | "capacite-particuliere";

export const MOTIF_AFFRETEMENT: Record<MotifAffretement, string> = {
  pointe: "Pointe d'activité",
  "aucun-disponible": "Aucun véhicule disponible",
  "vehicule-immobilise": "Véhicule immobilisé",
  "hors-perimetre": "Zone hors périmètre",
  "capacite-particuliere": "Capacité particulière",
};

/**
 * Le motif n'est pas décoratif : il dit si l'externalisation était **subie** ou
 * **choisie**. Trois affrètements par mois pour « véhicule immobilisé » ne se
 * corrigent pas en négociant un tarif, mais en réparant le parc.
 */
export const MOTIF_SUBI: Record<MotifAffretement, boolean> = {
  pointe: false,
  "aucun-disponible": true,
  "vehicule-immobilise": true,
  "hors-perimetre": false,
  "capacite-particuliere": false,
};

/* -- Où en est la mission ------------------------------------------------------ */

export type StatutAffretement = "demande" | "confirme" | "en-cours" | "livre" | "facture" | "regle" | "annule";

export const STATUT_AFFRETEMENT: Record<StatutAffretement, string> = {
  demande: "Demandé",
  confirme: "Confirmé",
  "en-cours": "En cours",
  livre: "Livré",
  facture: "Facturé",
  regle: "Réglé",
  annule: "Annulé",
};

export const TON_STATUT_AFFRETEMENT: Record<StatutAffretement, Ton> = {
  demande: "neutre",
  confirme: "neutre",
  "en-cours": "vigilance",
  livre: "favorable",
  facture: "vigilance",
  regle: "favorable",
  annule: "defavorable",
};

/** L'ordre du circuit, pour trier et pour dessiner l'avancement. */
export const CIRCUIT_AFFRETEMENT: StatutAffretement[] = ["demande", "confirme", "en-cours", "livre", "facture", "regle"];

/** Vrai tant que la mission n'est ni réglée ni annulée : c'est ce qui reste à suivre. */
export function enCours(statut: StatutAffretement): boolean {
  return statut !== "regle" && statut !== "annule";
}

/** Vrai dès que la prestation est faite : c'est à partir de là qu'on doit de l'argent. */
export function prestationFaite(statut: StatutAffretement): boolean {
  return statut === "livre" || statut === "facture" || statut === "regle";
}

/* -- Les grilles tarifaires ----------------------------------------------------- */

export type UniteTarif = "tonne" | "forfait" | "km";

export const UNITE_TARIF: Record<UniteTarif, { libelle: string; suffixe: string }> = {
  tonne: { libelle: "À la tonne", suffixe: "F/t" },
  forfait: { libelle: "Au forfait", suffixe: "F" },
  km: { libelle: "Au kilomètre", suffixe: "F/km" },
};

/** D'où vient le prix — le cœur de la question 42. */
export type SourceTarif = "contrat" | "accord-verbal" | "a-confirmer";

export const SOURCE_TARIF: Record<SourceTarif, { libelle: string; ton: Ton; precision: string }> = {
  contrat: { libelle: "Contrat signé", ton: "favorable", precision: "Opposable au transporteur : un écart se conteste" },
  "accord-verbal": { libelle: "Accord verbal", ton: "vigilance", precision: "Pratiqué et constaté, mais rien d'écrit — un écart se discute, il ne se conteste pas" },
  "a-confirmer": { libelle: "À confirmer", ton: "defavorable", precision: "Reconstitué depuis les factures passées — à faire valider par le métier" },
};

export interface LigneTarif {
  numero: string;
  transporteurNumero: string;
  transporteur: string;
  origine: string;
  destination: string;
  /** Nulle quand le tarif vaut pour toute catégorie de porteur. */
  categorie: CategorieVehicule | null;
  unite: UniteTarif;
  prix: number;
  /** Montant plancher facturé quel que soit le tonnage ; nul s'il n'y en a pas. */
  minimum: number | null;
  debut: string;
  /** Nulle quand la ligne court toujours. */
  fin: string | null;
  source: SourceTarif;
  commentaire: string | null;
}

/* -- L'affrètement --------------------------------------------------------------- */

export interface Affretement {
  numero: string;
  date: string;
  transporteurNumero: string;
  transporteur: string;
  origine: string;
  destination: string;
  businessUnit: BusinessUnit | null;
  categorieDemandee: CategorieVehicule;
  /** L'immatriculation du camion du transporteur, quand elle est relevée. */
  immatriculationExterne: string | null;
  chauffeurExterne: string | null;
  tonnagePrevu: number;
  /** Nul tant que la mission n'est pas livrée. */
  tonnageLivre: number | null;
  distanceKm: number;
  motif: MotifAffretement;
  /** Le véhicule du parc que l'affrètement remplace, quand il y en a un. */
  vehiculeRemplaceId: string | null;
  statut: StatutAffretement;
  /** Ce dont on est convenu à la commande — de la grille, ou négocié. */
  montantConvenu: number;
  /** Ce que la facture porte ; nul avant. */
  montantFacture: number | null;
  /*
   * L'exception tarifaire de cette mission. Nulle dans l'immense majorité des
   * cas : la grille et le rattachement de la localité suffisent. Quand elle est
   * posée, elle porte son motif — sans quoi personne ne saura, six mois plus
   * tard, si elle méritait de devenir une ligne de grille.
   */
  prixExceptionnel: number | null;
  complementTarif: number | null;
  motifTarif: string | null;
  dateLivraison: string | null;
  dateFacture: string | null;
  dateReglement: string | null;
  referenceFacture: string | null;
  numeroDemandeX3: string | null;
  numeroBonCommande: string | null;
  demandeur: string;
  commentaire: string | null;
  creee: boolean;
}

/* -- La retenue à la source (BRS) -------------------------------------------------
   Relevée sur toutes les factures transporteurs 2026 : SEDIMA retient 5 % du
   montant facturé et les reverse au Trésor. La grille étant négociée **net**,
   la facture majore d'autant — le transporteur touche le prix convenu. */

export const TAUX_BRS = 0.05;

export interface MontantsAffretement {
  /** Ce que la grille dit que le transporteur doit toucher. */
  attenduNet: number | null;
  /** Ce que la facture porte, retenue comprise. */
  factureTtc: number | null;
  /** Les 5 % retenus et reversés au Trésor. */
  retenue: number | null;
  /** Ce que le transporteur touche vraiment. */
  nettoye: number | null;
}

/** Le prix qu'une facture doit porter pour que le transporteur touche `net`. */
export function factureDepuisNet(net: number): number {
  return Math.round(net / (1 - TAUX_BRS));
}

/** Les montants d'une mission, du dû au net — la seule lecture qui permette de contrôler. */
export function montantsDe(a: Pick<Affretement, "montantFacture" | "montantConvenu" | "statut">, attendu: number | null): MontantsAffretement {
  const factureTtc = a.statut === "annule" ? null : a.montantFacture;
  const retenue = factureTtc === null ? null : Math.round(factureTtc * TAUX_BRS);
  return {
    attenduNet: attendu,
    factureTtc,
    retenue,
    nettoye: factureTtc === null || retenue === null ? null : factureTtc - retenue,
  };
}

/* -- Le tarif applicable --------------------------------------------------------- */

/**
 * La ligne de tarif qui s'applique à une mission : même transporteur, même
 * trajet, catégorie compatible, et en vigueur à la date de la mission. La plus
 * **précise** l'emporte — une ligne posée pour une catégorie donnée passe avant
 * une ligne « toutes catégories », sans quoi le tarif du tracteur s'appliquerait
 * à la camionnette.
 *
 * **Le rattachement des localités** (brainstorm du 5 septembre 2026). Les
 * contrats fixent un prix par destination — Thiès, Touba, Kaolack — mais on
 * livre à Bayakh, Niakhirate, Kaniac : sur les 245 libellés du relevé
 * hebdomadaire, une quinzaine seulement figure dans la grille. Rapprocher les
 * seuls libellés exacts, comme on le faisait, déclarait « hors grille » la
 * majorité des livraisons et fabriquait autant de faux écarts de facturation.
 *
 * On cherche donc la destination littérale, puis, à défaut, **la destination
 * tarifaire à laquelle la localité est rattachée**. Le rattachement est une
 * décision écrite, datée et signée : c'est ce qui rend l'écart discutable.
 */
export function tarifApplicable(
  grilles: LigneTarif[],
  a: Pick<Affretement, "transporteurNumero" | "origine" | "destination" | "categorieDemandee" | "date">,
  rattachements: RattachementLocalite[] = [],
): LigneTarif | null {
  const direct = ligneDeGrille(grilles, a, a.destination);
  if (direct) return direct;
  const rattachee = destinationTarifaire(a.destination, rattachements);
  return rattachee ? ligneDeGrille(grilles, a, rattachee.destination) : null;
}

function ligneDeGrille(
  grilles: LigneTarif[],
  a: Pick<Affretement, "transporteurNumero" | "origine" | "categorieDemandee" | "date">,
  destination: string,
): LigneTarif | null {
  const candidates = grilles.filter(
    (t) =>
      t.transporteurNumero === a.transporteurNumero &&
      t.origine === a.origine &&
      t.destination === destination &&
      (t.categorie === null || t.categorie === a.categorieDemandee) &&
      t.debut <= a.date &&
      (t.fin === null || t.fin >= a.date),
  );
  if (candidates.length === 0) return null;
  return candidates.sort((x, y) => Number(y.categorie !== null) - Number(x.categorie !== null) || y.debut.localeCompare(x.debut))[0]!;
}

/**
 * Ce que la mission devrait coûter. Nul sans grille applicable **et** sans prix
 * exceptionnel — car alors on ne sait rien, et un écart ne se mesure pas.
 *
 * **L'exception tarifaire** (brainstorm du 5 septembre 2026) s'applique ici, et
 * non ailleurs, parce qu'elle change ce qu'on **attend** : l'écart doit se
 * mesurer contre le prix convenu pour cette mission-là, pas contre un tarif de
 * grille dont on savait d'avance qu'il ne s'appliquait pas.
 *
 * Deux formes, et elles ne se confondent pas :
 *  - le **prix exceptionnel** remplace le prix unitaire de la grille — c'est un
 *    F/tonne, un F/km ou un forfait selon l'unité de la ligne ;
 *  - le **complément** est un montant qui s'ajoute au total : un détour, une
 *    attente au déchargement, un accès difficile.
 */
export function montantAttendu(
  tarif: LigneTarif | null,
  a: Pick<Affretement, "tonnagePrevu" | "tonnageLivre" | "distanceKm"> & Partial<Pick<Affretement, "prixExceptionnel" | "complementTarif">>,
): number | null {
  const prixUnitaire = a.prixExceptionnel ?? tarif?.prix ?? null;
  if (prixUnitaire === null) return null;
  const tonnes = a.tonnageLivre ?? a.tonnagePrevu;
  /* Sans ligne de grille, un prix exceptionnel se lit au tonnage : c'est
     l'unité de presque toute la grille, et celle du relevé de la DO. */
  const unite = tarif?.unite ?? "tonne";
  const brut = unite === "tonne" ? prixUnitaire * tonnes : unite === "km" ? prixUnitaire * a.distanceKm : prixUnitaire;
  return Math.round(Math.max(brut, tarif?.minimum ?? 0) + (a.complementTarif ?? 0));
}

export interface EcartFacturation {
  montant: number;
  pct: number;
  /** Ce à quoi on compare : la grille quand elle existe, le convenu sinon. */
  reference: "grille" | "convenu";
}

/**
 * L'écart entre ce qui est facturé et ce qui était dû. On compare **à la
 * grille** quand il y en a une — c'est elle qui fait foi —, au montant convenu
 * sinon. Rendre nul plutôt que zéro quand rien n'est facturé : un écart de zéro
 * dit « la facture est juste », l'absence dit « il n'y a pas encore de facture ».
 */
export function ecartFacturation(a: Pick<Affretement, "montantConvenu" | "montantFacture" | "statut">, attendu: number | null): EcartFacturation | null {
  const m = montantsDe(a, attendu);
  if (m.nettoye === null) return null;
  const reference = attendu ?? a.montantConvenu;
  if (reference <= 0) return null;
  /* On compare **net à net** : le transporteur touche le net, et c'est ce net
     que la grille fixe. Comparer le TTC à la grille ferait apparaître un écart
     de 5 % sur chaque facture juste — et personne ne regarderait plus la colonne. */
  const montant = m.nettoye - reference;
  return { montant, pct: Math.round((montant / reference) * 1000) / 10, reference: attendu === null ? "convenu" : "grille" };
}

/** Au-delà, l'écart n'est plus un arrondi : il se discute avec le transporteur. */
export const SEUIL_ECART_PCT = 5;

export function tonEcart(e: EcartFacturation | null): Ton {
  if (!e) return "neutre";
  if (Math.abs(e.pct) <= SEUIL_ECART_PCT) return "favorable";
  return e.montant > 0 ? "defavorable" : "vigilance";
}

/** Le coût retenu d'une mission : le facturé s'il existe, le convenu sinon. */
export function coutAffretement(a: Pick<Affretement, "montantConvenu" | "montantFacture" | "statut">): number {
  if (a.statut === "annule") return 0;
  /* Le coût du parc est le montant **facturé**, retenue comprise : les 5 %
     sortent de la trésorerie de SEDIMA, même s'ils vont au Trésor et non au
     transporteur. Retenir le net minorerait le coût de transport de 5 %. */
  return a.montantFacture ?? factureDepuisNet(a.montantConvenu);
}

/* -- Le taux d'externalisation (C_TED_EXT) ---------------------------------------- */

export type BaseExternalisation = "cout" | "tonnes" | "missions";

export const BASE_EXTERNALISATION: Record<BaseExternalisation, { libelle: string; precision: string }> = {
  cout: { libelle: "En coût", precision: "Coût du transport tiers rapporté au coût de transport total" },
  tonnes: { libelle: "En tonnes", precision: "Tonnes confiées à des tiers rapportées aux tonnes transportées — attend les livraisons SediLiv" },
  missions: { libelle: "En missions", precision: "Missions affrétées rapportées aux missions du parc — attend les livraisons SediLiv" },
};

/**
 * Le taux d'externalisation, en pourcentage.
 *
 * **Arbitrage à faire valider par le métier** : le référentiel DO définit
 * C_TED_EXT sur les **tonnes**, mais les tonnages internes viennent de SediLiv
 * et manquent encore. On l'alimente donc **en coût de transport** — ce que
 * l'application sait mesurer aujourd'hui —, et l'indicateur le dit. Le jour où
 * les tonnages arriveront, la base changera sans que le calcul bouge : c'est
 * pourquoi elle est un paramètre et non une hypothèse enfouie.
 *
 * À porter aux questions ouvertes, à côté de la question 54 qui met déjà la
 * cible de 35 % en doute face au modèle transport 2026 (~60 %).
 */
export function tauxExternalisation(externe: number, interne: number): number | null {
  const total = externe + interne;
  return total > 0 ? Math.round((externe / total) * 1000) / 10 : null;
}

/* ============================================================================
 * La convention de facturation — qui supporte les 5 %
 *
 * La retenue à la source est la même pour tous. Ce qui change d'un transporteur
 * à l'autre, et que **rien n'écrit**, c'est le prix sur lequel on l'applique :
 *
 *  - Dème facture 147 368 F pour un prix de grille de 140 000 : la facture est
 *    majorée, la retenue prélevée dessus, et le transporteur touche ses
 *    140 000. C'est la mécanique vérifiée sur 319 lignes.
 *  - Mouhamed Sy facture 1 464 000 F et touche 1 390 800 : la retenue est
 *    prélevée **sur le prix convenu**. Dame Ndoye et Aïssata Gaye de même.
 *
 * Même taux, même Trésor, mais dans le second cas **le transporteur touche 5 %
 * de moins que le prix affiché**. Sur les prestations relevées, l'écart annuel
 * se compte en millions. Ce n'est pas une erreur de calcul : c'est une clause
 * absente. Chaque ligne porte donc la convention qu'on lui connaît, et
 * `inconnue` quand aucune facture ne permet de trancher (question 72).
 * ==========================================================================*/

export type ConventionFacturation = "net-majore" | "brut-retenu" | "inconnue";

export const CONVENTION_FACTURATION: Record<ConventionFacturation, { libelle: string; precision: string; ton: Ton }> = {
  "net-majore": { libelle: "Prix net, facture majorée", precision: "La facture ajoute les 5 % : le transporteur touche le prix convenu", ton: "favorable" },
  "brut-retenu": { libelle: "Prix brut, retenue déduite", precision: "Les 5 % sont pris sur le prix convenu : le transporteur touche 5 % de moins", ton: "vigilance" },
  inconnue: { libelle: "Convention à confirmer", precision: "Aucune facture ne permet encore de dire sur quel prix la retenue s'applique", ton: "defavorable" },
};

/** Ce que la facture porte pour un prix convenu, selon la convention. */
export function factureSelonConvention(prix: number, convention: ConventionFacturation): number {
  return convention === "brut-retenu" ? prix : factureDepuisNet(prix);
}

/** Ce que le transporteur touche vraiment pour un prix convenu. */
export function netSelonConvention(prix: number, convention: ConventionFacturation): number {
  return convention === "brut-retenu" ? prix - Math.round(prix * TAUX_BRS) : prix;
}

/* ============================================================================
 * Les mises à disposition — le modèle ADEX
 *
 * Un second modèle, qui n'est pas l'affrètement : ADEX ne vend pas un voyage
 * mais un **véhicule à la journée**. La feuille « ADEX » du tableur de la
 * Direction des Opérations pose un prix par jour selon ce que le camion porte,
 * et une note qui tient lieu de contrat : « Tous les véhicules ADEX sont des
 * mises à disposition payable 6 jours sur 7 sauf en cas de panne avec dotation
 * carburant. »
 *
 * Trois conséquences, et ce sont elles qui commandent le calcul :
 *  1. **on paie six jours sur sept**, roulé ou non — le jour immobile est payé,
 *     et c'est le premier gisement d'économies du parc ;
 *  2. **la panne suspend le paiement** — encore faut-il l'avoir relevée ;
 *  3. **le carburant est à la charge de SEDIMA**, servi à sa propre cuve : il
 *     n'apparaît sur aucune facture ADEX, si bien que le coût vrai d'une mise à
 *     disposition reste invisible tant qu'on ne l'y rattache pas.
 *
 * Le compte rendu « Présentation ADEX — Externalisation du transport »
 * (`62. Transport & Flotte Automobile/Données Finance`) va déjà dans ce sens :
 * le contrat de mise à disposition y est dit « inadapté et à revoir »,
 * l'approvisionnement carburant depuis la pompe SEDIMA « non maîtrisé », et le
 * plan d'action demande un contrat « hors mise à disposition, couvrant toutes
 * charges, articulé au km, à la tonne ou à la mU ». Le coût complet ci-dessous
 * est ce qui rend cette négociation chiffrable.
 * ==========================================================================*/

export type FamilleMad = "aliments" | "oeufs" | "son-de-ble";

export const FAMILLE_MAD: Record<FamilleMad, { libelle: string; precision: string }> = {
  aliments: { libelle: "Aliments, farines, poulets", precision: "Le porteur lourd de la mise à disposition" },
  oeufs: { libelle: "Œufs", precision: "Camionnette dédiée aux plateaux, tournées courtes" },
  "son-de-ble": { libelle: "Transfert de son de blé", precision: "Navette entre l'UAB et les dépôts" },
};

/** « Payable 6 jours sur 7 » — la note du tableur, devenue règle de calcul. */
export const JOURS_PAYES_SUR_SEPT = 6;

/** Le prix journalier convenu, par transporteur et par famille de produit. */
export interface TarifJournalier {
  numero: string;
  transporteurNumero: string;
  transporteur: string;
  famille: FamilleMad;
  prixJour: number;
  debut: string;
  fin: string | null;
  source: SourceTarif;
  convention: ConventionFacturation;
  commentaire: string | null;
}

/** Un mois de mise à disposition, véhicule par véhicule. */
export interface MiseADisposition {
  numero: string;
  /** Le mois servi, en « AAAA-MM » : la mise à disposition se facture au mois. */
  mois: string;
  transporteurNumero: string;
  transporteur: string;
  /** L'immatriculation du véhicule mis à disposition — celle du tiers. */
  immatriculation: string;
  famille: FamilleMad;
  /** Les jours du mois : c'est sur eux que se calculent les six septièmes. */
  joursCalendaires: number;
  /** Les jours d'immobilisation déclarés, qui ne se paient pas. */
  joursPanne: number;
  /** Les jours où le véhicule a réellement tourné ; nul quand ce n'est pas relevé. */
  joursRoules: number | null;
  prixJour: number;
  convention: ConventionFacturation;
  /** La dotation servie à la cuve SEDIMA, en litres, et ce qu'elle a coûté. */
  carburantLitres: number;
  carburantMontant: number;
  /** Ce que le véhicule a parcouru et porté — nul tant que SediLiv ne le dit pas. */
  kmParcourus: number | null;
  tonnesTransportees: number | null;
  statut: StatutAffretement;
  montantFacture: number | null;
  dateFacture: string | null;
  dateReglement: string | null;
  referenceFacture: string | null;
  numeroDemandeX3: string | null;
  commentaire: string | null;
}

/** Les jours dus : six sur sept, la panne déduite. */
export function joursDus(m: Pick<MiseADisposition, "joursCalendaires" | "joursPanne">): number {
  return Math.max(0, Math.round((m.joursCalendaires * JOURS_PAYES_SUR_SEPT) / 7) - m.joursPanne);
}

/**
 * Les jours payés que personne n'a roulés. C'est le chiffre qui justifie de
 * rouvrir le contrat : il ne se lit sur aucune facture, puisque la facture est
 * juste — elle porte bien six jours sur sept.
 */
export function joursPayesNonRoules(m: Pick<MiseADisposition, "joursCalendaires" | "joursPanne" | "joursRoules">): number | null {
  return m.joursRoules === null ? null : Math.max(0, joursDus(m) - m.joursRoules);
}

/** Le net dû au transporteur pour le mois. */
export function attenduMad(m: Pick<MiseADisposition, "joursCalendaires" | "joursPanne" | "prixJour" | "convention">): number {
  return netSelonConvention(joursDus(m) * m.prixJour, m.convention);
}

export interface CoutMad {
  /** Ce qui sort vers le transporteur, retenue comprise. */
  location: number;
  /** Ce qui sort à la cuve, et qu'aucune facture ADEX ne porte. */
  carburant: number;
  total: number;
}

/**
 * Le coût complet d'un mois de mise à disposition. La facture ADEX ne porte que
 * la location ; le carburant, servi à la cuve, en représente encore un sixième,
 * et c'est ce qui sépare le prix affiché de ce que le véhicule coûte au parc.
 */
export function coutMiseADisposition(m: Pick<MiseADisposition, "joursCalendaires" | "joursPanne" | "prixJour" | "convention" | "montantFacture" | "statut" | "carburantMontant">): CoutMad {
  if (m.statut === "annule") return { location: 0, carburant: 0, total: 0 };
  const location = m.montantFacture ?? factureSelonConvention(joursDus(m) * m.prixJour, m.convention);
  return { location, carburant: m.carburantMontant, total: location + m.carburantMontant };
}

/** Le coût complet ramené au jour, au km, à la tonne — les trois bases du futur contrat. */
export function ramenerCoutMad(m: MiseADisposition): { parJour: number | null; parKm: number | null; parTonne: number | null } {
  const total = coutMiseADisposition(m).total;
  const jours = joursDus(m);
  return {
    parJour: jours > 0 ? Math.round(total / jours) : null,
    parKm: m.kmParcourus && m.kmParcourus > 0 ? Math.round(total / m.kmParcourus) : null,
    parTonne: m.tonnesTransportees && m.tonnesTransportees > 0 ? Math.round(total / m.tonnesTransportees) : null,
  };
}

/* ============================================================================
 * Les prestations hors grille
 *
 * Tout ce que le parc achète en transport et que la grille à la tonne ne couvre
 * pas : la livraison d'œufs et de farine au voyage (Mouhamed Sy), le transport
 * du personnel des abattoirs à la rotation (Dame Ndoye), les liaisons Gambie et
 * Casamance (Aïssata Gaye), les forfaits pick-up et cargo.
 *
 * Elles ont deux traits communs, et ce sont deux angles morts :
 *  - **aucune grille ne leur répond**, donc aucun écart ne se calcule ; seule
 *    l'arithmétique de la retenue est vérifiable ;
 *  - **elles ne se comptent pas en tonnes**, si bien qu'elles échappent au
 *    tonnage transporté tout en pesant sur le coût de transport.
 * ==========================================================================*/

export type UnitePrestation = "voyage" | "rotation" | "sac" | "jour" | "mois";

export const UNITE_PRESTATION: Record<UnitePrestation, { libelle: string; suffixe: string }> = {
  voyage: { libelle: "Au voyage", suffixe: "F/voyage" },
  rotation: { libelle: "À la rotation", suffixe: "F/rotation" },
  sac: { libelle: "Au sac", suffixe: "F/sac" },
  jour: { libelle: "À la journée", suffixe: "F/jour" },
  mois: { libelle: "Au mois", suffixe: "F/mois" },
};

export interface Prestation {
  numero: string;
  date: string;
  transporteurNumero: string;
  transporteur: string;
  libelle: string;
  businessUnit: BusinessUnit | null;
  unite: UnitePrestation;
  quantite: number;
  prixUnitaire: number;
  convention: ConventionFacturation;
  statut: StatutAffretement;
  montantFacture: number | null;
  dateFacture: string | null;
  dateReglement: string | null;
  referenceFacture: string | null;
  numeroDemandeX3: string | null;
  commentaire: string | null;
}

export interface MontantsPrestation {
  /** Quantité × prix unitaire : le prix convenu, avant toute retenue. */
  convenu: number;
  /** Ce que la facture devrait porter, selon la convention du transporteur. */
  attenduTtc: number;
  factureTtc: number | null;
  retenue: number | null;
  /** Ce que le transporteur touche vraiment. */
  net: number | null;
}

export function montantsPrestation(p: Pick<Prestation, "quantite" | "prixUnitaire" | "convention" | "montantFacture" | "statut">): MontantsPrestation {
  const convenu = Math.round(p.quantite * p.prixUnitaire);
  const factureTtc = p.statut === "annule" ? null : p.montantFacture;
  const retenue = factureTtc === null ? null : Math.round(factureTtc * TAUX_BRS);
  return {
    convenu,
    attenduTtc: factureSelonConvention(convenu, p.convention),
    factureTtc,
    retenue,
    net: factureTtc === null || retenue === null ? null : factureTtc - retenue,
  };
}

/** Le coût d'une prestation pour le parc : le facturé s'il existe, l'attendu sinon. */
export function coutPrestation(p: Pick<Prestation, "quantite" | "prixUnitaire" | "convention" | "montantFacture" | "statut">): number {
  if (p.statut === "annule") return 0;
  const m = montantsPrestation(p);
  return m.factureTtc ?? m.attenduTtc;
}

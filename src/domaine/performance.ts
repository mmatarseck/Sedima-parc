/* ============================================================================
 * Performance des chauffeurs — indicateurs SQDCM, score, prime et classement.
 *
 * Le modèle est celui du registre KPI de SEDIMA Opérations : un indicateur a un
 * code, un pilier (S, Q, D, C, M), une catégorie (résultat, performance,
 * signal), une règle de conformité et un objectif. Ce qui est propre au
 * chauffeur : chaque indicateur se calcule sur une période, à partir des faits
 * que les fiches rattachent déjà à l'affectation — kilomètres, consommation,
 * contraventions, incidents, indisponibilités, sanctions.
 *
 * Trois usages : lire la performance sur la fiche, asseoir la prime variable
 * sur un barème explicite, désigner le chauffeur du mois. Les objectifs, les
 * poids et le barème sont des paramètres — ils ont vocation à vivre dans
 * Paramètres, pas dans le code.
 * ==========================================================================*/

import type { FicheChauffeur } from "./chauffeur";
import { nombre } from "@/lib/format";

export type Pilier = "S" | "Q" | "D" | "C" | "M";

export const PILIERS: { code: Pilier; libelle: string; anglais: string; poids: number; precision: string }[] = [
  { code: "S", libelle: "Sécurité", anglais: "Safety", poids: 30, precision: "Accidents, infractions, aptitude à conduire" },
  { code: "Q", libelle: "Qualité", anglais: "Quality", poids: 15, precision: "Chargement, justificatifs, relevés" },
  { code: "D", libelle: "Délais", anglais: "Delivery", poids: 20, precision: "Présence, pannes en mission, activité" },
  { code: "C", libelle: "Coûts", anglais: "Cost", poids: 25, precision: "Consommation, frais, coût des incidents" },
  { code: "M", libelle: "Morale", anglais: "Morale", poids: 10, precision: "Discipline, formation, polyvalence" },
];

export type CategorieKpi = "resultat" | "performance" | "signal";
export type RegleConformite = "inf_egal" | "sup_egal";

export const CATEGORIE_KPI: Record<CategorieKpi, string> = { resultat: "Résultat", performance: "Performance", signal: "Signal" };

export interface DefinitionKpiChauffeur {
  code: string;
  nom: string;
  pilier: Pilier;
  categorie: CategorieKpi;
  regle: RegleConformite;
  unite: string;
  /** Objectif sur la période — pour les compteurs, il est ramené à la période. */
  objectif: number;
  /**
   * Écart à l'objectif au-delà duquel le score de l'indicateur tombe à zéro.
   * Entre les deux, le score descend en droite ligne : c'est ce qui rend le
   * barème lisible par le chauffeur lui-même.
   */
  tolerance: number;
  /** Vrai pour un compteur : l'objectif et la tolérance valent pour douze mois et se proratisent. */
  compteur: boolean;
  definition: string;
  formule: string;
  source: string;
  /** Réservé aux rôles qui voient les sanctions (voir `roles.ts`). */
  confidentiel?: boolean;
  /**
   * Indicateur retenu au barème mais pas encore alimenté : sa source n'est pas
   * branchée (tonnages de SediLiv). Il s'affiche « à venir » et ne compte pas.
   */
  prevu?: boolean;
}

/**
 * Le registre. Les codes suivent la convention de SEDIMA Opérations
 * (pilier_libellé) avec le préfixe CH pour « chauffeur », afin de ne jamais
 * les confondre avec les KPI de département.
 */
export const KPI_CHAUFFEUR: DefinitionKpiChauffeur[] = [
  /* ---- S — Sécurité ---- */
  {
    code: "S_CH_ACCR",
    nom: "Accidents responsables",
    pilier: "S",
    categorie: "resultat",
    regle: "inf_egal",
    unite: "#",
    objectif: 0,
    tolerance: 1,
    compteur: true,
    definition: "Accidents déclarés dont la responsabilité présumée est SEDIMA ou partagée, le chauffeur étant au volant.",
    formule: "Σ déclarations nature = accident, responsabilité ∈ {SEDIMA, partagée}",
    source: "Déclarations d'incident",
  },
  {
    code: "S_CH_ACC",
    nom: "Accidents, toutes responsabilités",
    pilier: "S",
    categorie: "performance",
    regle: "inf_egal",
    unite: "#",
    objectif: 0,
    tolerance: 1,
    compteur: true,
    definition: "Tous les accidents déclarés avec le chauffeur au volant, y compris ceux dont un tiers est responsable. Au-delà d'un accident sur la période, le chauffeur est éliminé du classement avec le minimum de points.",
    formule: "Σ déclarations nature = accident — éliminatoire si > 1",
    source: "Déclarations d'incident",
  },
  {
    code: "S_CH_INF",
    nom: "Infractions routières",
    pilier: "S",
    categorie: "performance",
    regle: "inf_egal",
    unite: "#",
    objectif: 1,
    tolerance: 3,
    compteur: true,
    definition: "Contraventions reçues sur les véhicules conduits pendant la période d'affectation.",
    formule: "Σ dépenses poste = contravention, attribuées au conducteur",
    source: "Dépenses véhicule",
  },
  {
    code: "S_CH_APT",
    nom: "Aptitude à conduire",
    pilier: "S",
    categorie: "resultat",
    regle: "sup_egal",
    unite: "%",
    objectif: 100,
    tolerance: 100,
    compteur: false,
    definition: "Permis et visite médicale valides, et aucune inaptitude prononcée. Un document échu ou manquant ramène l'indicateur à zéro : il n'y a pas de demi-aptitude.",
    formule: "100 si permis valide ET visite médicale valide ET aptitude ≠ inapte, sinon 0",
    source: "Documents et aptitude du chauffeur",
  },

  /* ---- Q — Qualité ---- */
  {
    code: "Q_CH_AVAR",
    nom: "Avaries de chargement",
    pilier: "Q",
    categorie: "resultat",
    regle: "inf_egal",
    unite: "#",
    objectif: 0,
    tolerance: 2,
    compteur: true,
    definition: "Pertes ou avaries de chargement et accidents au chargement ou déchargement.",
    formule: "Σ déclarations type ∈ {avarie-chargement, accident-chargement}",
    source: "Déclarations d'incident",
  },
  {
    code: "Q_CH_JUST",
    nom: "Justificatifs de frais fournis",
    pilier: "Q",
    categorie: "performance",
    regle: "sup_egal",
    unite: "%",
    objectif: 95,
    tolerance: 40,
    compteur: false,
    definition: "Part des frais de route versés au chauffeur qui sont couverts par un justificatif.",
    formule: "frais avec justificatif ÷ frais versés × 100",
    source: "Caisse parc",
  },
  {
    code: "Q_CH_RELV",
    nom: "Relevés kilométriques cohérents",
    pilier: "Q",
    categorie: "signal",
    regle: "sup_egal",
    unite: "%",
    objectif: 98,
    tolerance: 20,
    compteur: false,
    definition: "Part des relevés de compteur saisis pendant sa conduite (pleins, dépenses) que le contrôle de cohérence a retenus.",
    formule: "relevés retenus ÷ relevés saisis × 100, hors balise",
    source: "Relevés kilométriques",
  },

  /* ---- D — Délais ---- */
  {
    code: "D_CH_PRES",
    nom: "Présence",
    pilier: "D",
    categorie: "resultat",
    regle: "sup_egal",
    unite: "%",
    objectif: 92,
    tolerance: 25,
    compteur: false,
    definition: "Part des jours de la période où le chauffeur était mobilisable — hors congés, maladie et suspension. La formation ne compte pas comme une absence.",
    formule: "(jours période − jours indisponibles hors formation) ÷ jours période × 100",
    source: "Indisponibilités",
  },
  {
    code: "D_CH_PANM",
    nom: "Pannes en mission",
    pilier: "D",
    categorie: "performance",
    regle: "inf_egal",
    unite: "#",
    objectif: 1,
    tolerance: 4,
    compteur: true,
    definition: "Pannes en ligne survenues en livraison ou en transfert avec le chauffeur au volant — la part chauffeur de D_NPVEL.",
    formule: "Σ déclarations nature = incident, mission ∈ {livraison, transfert}",
    source: "Déclarations d'incident",
  },
  {
    code: "D_CH_TON",
    nom: "Volume transporté",
    pilier: "D",
    categorie: "resultat",
    regle: "sup_egal",
    unite: "t",
    objectif: 90,
    tolerance: 60,
    compteur: false,
    definition: "Tonnes livrées rapportées à la moyenne des chauffeurs de la même catégorie de véhicule. Alimenté par les livraisons de SediLiv ; jusque-là, l'activité kilométrique en tient lieu.",
    formule: "tonnes du chauffeur ÷ tonnes moyennes de la catégorie × 100",
    source: "SediLiv — livraisons (à brancher)",
    prevu: true,
  },
  {
    code: "D_CH_ACT",
    nom: "Activité kilométrique",
    pilier: "D",
    categorie: "signal",
    regle: "sup_egal",
    unite: "%",
    objectif: 90,
    tolerance: 60,
    compteur: false,
    definition: "Kilomètres parcourus rapportés à la moyenne des chauffeurs en poste sur la même période. En attendant les tonnages livrés de SediLiv.",
    formule: "km du chauffeur ÷ km moyen des chauffeurs en poste × 100",
    source: "Consommation attribuée",
  },

  /* ---- C — Coûts ---- */
  {
    code: "C_CH_CONS",
    nom: "Écart de consommation",
    pilier: "C",
    categorie: "resultat",
    regle: "inf_egal",
    unite: "%",
    objectif: 5,
    tolerance: 20,
    compteur: false,
    definition: "Écart entre la consommation réelle et la référence du véhicule conduit, pondérée par les kilomètres de chaque véhicule.",
    formule: "(L/100 réel − L/100 référence) ÷ L/100 référence × 100",
    source: "Pleins et relevés",
  },
  {
    code: "C_CH_FRAIS",
    nom: "Frais de route aux 100 km",
    pilier: "C",
    categorie: "performance",
    regle: "inf_egal",
    unite: "F/100 km",
    objectif: 4000,
    tolerance: 4000,
    compteur: false,
    definition: "Frais de route versés rapportés aux kilomètres parcourus.",
    formule: "Σ frais de route ÷ km × 100",
    source: "Caisse parc",
  },
  {
    code: "C_CH_CPT",
    nom: "Coût par tonne transportée",
    pilier: "C",
    categorie: "performance",
    regle: "inf_egal",
    unite: "F/t",
    objectif: 6500,
    tolerance: 3000,
    compteur: false,
    definition: "Carburant, frais de route et coût des incidents rapportés aux tonnes livrées — la part chauffeur de C_CDM_SEDI. Alimenté par les livraisons de SediLiv.",
    formule: "(carburant + frais de route + incidents) ÷ tonnes livrées",
    source: "SediLiv — livraisons (à brancher)",
    prevu: true,
  },
  {
    code: "C_CH_INC",
    nom: "Coût des incidents",
    pilier: "C",
    categorie: "signal",
    regle: "inf_egal",
    unite: "F",
    objectif: 0,
    tolerance: 1_500_000,
    compteur: true,
    definition: "Somme des dépenses rattachées aux incidents et accidents déclarés avec le chauffeur au volant, franchise comprise.",
    formule: "Σ dépenses des déclarations",
    source: "Déclarations d'incident",
  },

  /* ---- M — Morale ---- */
  {
    code: "M_CH_SANC",
    nom: "Sanctions",
    pilier: "M",
    categorie: "resultat",
    regle: "inf_egal",
    unite: "#",
    objectif: 0,
    tolerance: 2,
    compteur: true,
    definition: "Avertissements, blâmes, retenues et mises à pied prononcés sur la période.",
    formule: "Σ sanctions",
    source: "Sanctions",
    confidentiel: true,
  },
  {
    code: "M_CH_FORM",
    nom: "Formation suivie",
    pilier: "M",
    categorie: "performance",
    regle: "sup_egal",
    unite: "j",
    objectif: 1,
    tolerance: 1,
    compteur: true,
    definition: "Jours de formation suivis — éco-conduite, arrimage, sécurité.",
    formule: "Σ jours d'indisponibilité motif = formation",
    source: "Indisponibilités",
  },
  {
    code: "M_CH_POLY",
    nom: "Polyvalence",
    pilier: "M",
    categorie: "signal",
    regle: "sup_egal",
    unite: "#",
    objectif: 2,
    tolerance: 2,
    compteur: false,
    definition: "Nombre de véhicules distincts conduits sur la période. Un chauffeur polyvalent se remplace et remplace.",
    formule: "Σ véhicules distincts des affectations actives",
    source: "Affectations",
  },
];

/* -- Barème de prime ---------------------------------------------------------- */

export interface TranchePrime {
  cle: "excellent" | "bon" | "acceptable" | "insuffisant";
  libelle: string;
  /** Score minimal pour entrer dans la tranche. */
  seuil: number;
  /** Part de la prime variable versée. */
  partPct: number;
}

/**
 * Quatre tranches, à seuils ronds, pour qu'un chauffeur sache où il en est sans
 * calculatrice. Un chauffeur non classable — accident responsable, sanction
 * lourde, trop peu de kilomètres — ne perçoit rien sur la période.
 */
export const BAREME_PRIME: TranchePrime[] = [
  { cle: "excellent", libelle: "Excellent", seuil: 90, partPct: 100 },
  { cle: "bon", libelle: "Bon", seuil: 75, partPct: 75 },
  { cle: "acceptable", libelle: "Acceptable", seuil: 60, partPct: 50 },
  { cle: "insuffisant", libelle: "Insuffisant", seuil: 0, partPct: 0 },
];

/** Kilomètres minimaux par mois pour être classé : en dessous, la période ne dit rien. */
export const KM_MINIMAL_PAR_MOIS = 300;

/* -- Évaluation --------------------------------------------------------------- */

export interface ValeurKpi {
  definition: DefinitionKpiChauffeur;
  valeur: number | null;
  /** Objectif ramené à la période, pour les compteurs. */
  objectif: number;
  conforme: boolean | null;
  /** 0 à 100 ; nul quand l'indicateur ne se calcule pas sur la période. */
  score: number | null;
  precision: string;
}

export interface EvaluationPilier {
  pilier: Pilier;
  score: number | null;
  kpis: ValeurKpi[];
}

export interface EvaluationChauffeur {
  chauffeurId: string;
  debut: string;
  fin: string;
  /** Mois couverts, pour proratiser les compteurs. */
  mois: number;
  kmParcourus: number;
  piliers: EvaluationPilier[];
  /** Moyenne pondérée des piliers ; nul si aucun pilier ne se calcule. */
  score: number | null;
  classable: boolean;
  /** Pourquoi le chauffeur n'est pas classé — à ne montrer qu'aux rôles habilités s'il s'agit d'une sanction. */
  motifNonClassable: string | null;
  motifConfidentiel: boolean;
  tranche: TranchePrime;
}

export interface ContexteEvaluation {
  /** Kilomètres moyens des chauffeurs en poste sur la même période, pour D_CH_ACT. */
  kmMoyenCohorte: number | null;
}

function joursEntre(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (24 * 3600 * 1000)) + 1;
}

/** Jours de [debut, fin] compris dans [depuis, jusqua]. */
function joursDans(debut: string, fin: string | null, depuis: string, jusqua: string): number {
  const d = debut > depuis ? debut : depuis;
  const f = (fin ?? jusqua) < jusqua ? (fin ?? jusqua) : jusqua;
  if (f < d) return 0;
  return joursEntre(d, f);
}

function arrondi(v: number, decimales = 0): number {
  const k = 10 ** decimales;
  return Math.round(v * k) / k;
}

/**
 * Score d'un indicateur : 100 quand l'objectif est tenu, puis une descente en
 * droite ligne jusqu'à zéro à la tolérance. Rien de plus savant — le chauffeur
 * doit pouvoir refaire le calcul sur son bulletin.
 */
export function scoreKpi(d: { regle: RegleConformite }, valeur: number, objectif: number, tolerance: number): { conforme: boolean; score: number } {
  const ecart = d.regle === "inf_egal" ? valeur - objectif : objectif - valeur;
  if (ecart <= 0) return { conforme: true, score: 100 };
  return { conforme: false, score: Math.max(0, arrondi(100 - (100 * ecart) / Math.max(tolerance, 1e-9))) };
}

/**
 * Évalue un chauffeur sur [debut, fin]. Tout vient de la fiche : rien n'est
 * saisi « pour la performance », ce qui interdit de la maquiller.
 */
export function evaluer(fiche: FicheChauffeur, debut: string, fin: string, contexte: ContexteEvaluation): EvaluationChauffeur {
  const jours = Math.max(1, joursEntre(debut, fin));
  /* Les mois se comptent en mois de calendrier touchés : d'octobre à septembre,
     douze — pas 11,07. C'est ce que le chauffeur comprend, et ce qui ramène
     l'objectif annuel d'un compteur à un entier sur douze mois. */
  const [aD, mD] = debut.split("-").map(Number);
  const [aF, mF] = fin.split("-").map(Number);
  const mois = Math.max(1, aF! * 12 + mF! - (aD! * 12 + mD!) + 1);
  const prorata = mois / 12;

  const dans = (d: string) => d >= debut && d <= fin;
  const consommation = fiche.consommation.filter((c) => `${c.mois}-01` >= debut.slice(0, 7) + "-01" && `${c.mois}-01` <= fin);
  const contraventions = fiche.contraventions.filter((c) => dans(c.date));
  const incidents = fiche.incidents.filter((i) => dans(i.declaration.dateHeure.slice(0, 10)));
  const sanctions = fiche.sanctions.filter((s) => dans(s.date));
  const frais = fiche.fraisDeRoute.filter((f) => dans(f.date));
  const releves = fiche.releves.filter((r) => dans(r.date));
  const affectations = fiche.affectations.filter((a) => a.debut <= fin && (a.fin === null || a.fin >= debut));

  const km = consommation.reduce((s, c) => s + c.kmParcourus, 0);
  const litres = consommation.reduce((s, c) => s + c.litres, 0);
  const referenceKm = consommation.reduce((s, c) => s + c.referenceL100 * c.kmParcourus, 0);

  const accidents = incidents.filter((i) => i.declaration.nature === "accident");
  const accidentsResponsables = accidents.filter((i) => i.declaration.responsabilite === "sedima" || i.declaration.responsabilite === "partagee");
  const avaries = incidents.filter((i) => i.declaration.type === "avarie-chargement" || i.declaration.type === "accident-chargement");
  const pannesMission = incidents.filter((i) => i.declaration.nature === "incident" && (i.declaration.mission === "livraison" || i.declaration.mission === "transfert"));
  /* Un coût inconnu ne vaut pas zéro : des déclarations dont aucune dépense
     n'est rattachée font taire le signal, au lieu d'annoncer un chauffeur
     sans suites. Aucune déclaration, en revanche, coûte bien zéro. */
  const coutsConnus = incidents.filter((i) => i.cout !== null);
  const coutIncidents = !incidents.length ? 0 : coutsConnus.length ? coutsConnus.reduce((s, i) => s + (i.cout ?? 0), 0) : null;

  const joursAbsents = fiche.indisponibilites.filter((i) => i.motif !== "formation").reduce((s, i) => s + joursDans(i.debut, i.fin, debut, fin), 0);
  const joursFormation = fiche.indisponibilites.filter((i) => i.motif === "formation").reduce((s, i) => s + joursDans(i.debut, i.fin, debut, fin), 0);

  const permisOk = !fiche.ligne.permis.manquant && (fiche.ligne.permis.joursRestants ?? 0) >= 0;
  const visiteOk = !fiche.ligne.visiteMedicale.manquant && (fiche.ligne.visiteMedicale.joursRestants ?? 0) >= 0;
  const inapte = fiche.ligne.chauffeur.aptitude === "inapte";

  const montantFrais = frais.reduce((s, f) => s + f.montant, 0);
  const fraisJustifies = frais.filter((f) => f.justificatif).reduce((s, f) => s + f.montant, 0);

  const vehiculesDistincts = new Set(affectations.map((a) => a.vehiculeId)).size;

  /** Valeur brute par code ; `null` quand l'indicateur ne se calcule pas. */
  const brut: Record<string, { valeur: number | null; precision: string }> = {
    S_CH_ACCR: { valeur: accidentsResponsables.length, precision: accidentsResponsables.length ? accidentsResponsables.map((i) => i.declaration.dateHeure.slice(0, 10)).join(", ") : "aucun" },
    S_CH_ACC: { valeur: accidents.length, precision: accidents.length ? `${accidents.length - accidentsResponsables.length} imputable${accidents.length - accidentsResponsables.length > 1 ? "s" : ""} à un tiers` : "aucun" },
    S_CH_INF: { valeur: contraventions.length, precision: contraventions.length ? `${contraventions.filter((c) => c.retenue).length} avec retenue` : "aucune" },
    S_CH_APT: {
      valeur: permisOk && visiteOk && !inapte ? 100 : 0,
      precision: inapte ? "déclaré inapte" : permisOk && visiteOk ? "permis et visite médicale valides" : !permisOk ? "permis échu ou manquant" : "visite médicale échue",
    },
    Q_CH_AVAR: { valeur: avaries.length, precision: avaries.length ? "voir Incidents & sanctions" : "aucune" },
    Q_CH_JUST: { valeur: montantFrais > 0 ? arrondi((fraisJustifies / montantFrais) * 100, 1) : null, precision: montantFrais > 0 ? `${frais.filter((f) => !f.justificatif).length} versement${frais.filter((f) => !f.justificatif).length > 1 ? "s" : ""} sans justificatif` : "aucun frais versé" },
    Q_CH_RELV: { valeur: releves.length > 0 ? arrondi((releves.filter((r) => r.valide).length / releves.length) * 100, 1) : null, precision: releves.length > 0 ? `${releves.filter((r) => !r.valide).length} écarté${releves.filter((r) => !r.valide).length > 1 ? "s" : ""} sur ${releves.length}` : "aucun relevé saisi" },
    D_CH_PRES: { valeur: arrondi(((jours - joursAbsents) / jours) * 100, 1), precision: `${joursAbsents} j d'absence sur ${jours}` },
    D_CH_PANM: { valeur: pannesMission.length, precision: pannesMission.length ? `${incidents.length - accidents.length - pannesMission.length} hors mission` : "aucune" },
    D_CH_ACT: { valeur: contexte.kmMoyenCohorte && km > 0 ? arrondi((km / contexte.kmMoyenCohorte) * 100) : null, precision: contexte.kmMoyenCohorte ? `${nombre(arrondi(km))} km contre ${nombre(arrondi(contexte.kmMoyenCohorte))} km en moyenne` : "pas de cohorte" },
    C_CH_CONS: { valeur: km > 0 && referenceKm > 0 ? arrondi(((litres / km) * 100 - referenceKm / km) / (referenceKm / km) * 100, 1) : null, precision: km > 0 ? `${nombre((litres / km) * 100, 1)} L/100 contre ${nombre(referenceKm / km, 1)} en référence` : "aucun kilomètre attribué" },
    C_CH_FRAIS: { valeur: km > 0 ? arrondi((montantFrais / km) * 100) : null, precision: km > 0 ? `${nombre(arrondi(montantFrais))} F sur ${nombre(arrondi(km))} km` : "aucun kilomètre attribué" },
    C_CH_INC: { valeur: coutIncidents, precision: !incidents.length ? "aucune déclaration" : coutIncidents === null ? `${incidents.length} déclaration${incidents.length > 1 ? "s" : ""}, aucune dépense rattachée` : `${incidents.length} déclaration${incidents.length > 1 ? "s" : ""}` },
    M_CH_SANC: { valeur: sanctions.length, precision: sanctions.length ? sanctions.map((s) => s.type).join(", ") : "aucune" },
    M_CH_FORM: { valeur: joursFormation, precision: joursFormation ? "voir Journal" : "aucune formation" },
    M_CH_POLY: { valeur: vehiculesDistincts, precision: vehiculesDistincts ? affectations.map((a) => a.immatriculationAffichee).filter((v, i, t) => t.indexOf(v) === i).join(", ") : "aucune affectation" },
  };

  const piliers: EvaluationPilier[] = PILIERS.map((p) => {
    const kpis: ValeurKpi[] = KPI_CHAUFFEUR.filter((d) => d.pilier === p.code).map((d) => {
      const { valeur, precision } = brut[d.code] ?? { valeur: null, precision: "" };
      const objectif = d.compteur ? arrondi(d.objectif * prorata, 2) : d.objectif;
      const tolerance = d.compteur ? Math.max(d.tolerance * prorata, 0.5) : d.tolerance;
      if (valeur === null) return { definition: d, valeur: null, objectif, conforme: null, score: null, precision };
      const { conforme, score } = scoreKpi(d, valeur, objectif, tolerance);
      return { definition: d, valeur, objectif, conforme, score, precision };
    });
    const calcules = kpis.filter((k) => k.score !== null);
    return { pilier: p.code, score: calcules.length ? arrondi(calcules.reduce((s, k) => s + (k.score ?? 0), 0) / calcules.length) : null, kpis };
  });

  const ponderes = piliers.filter((p) => p.score !== null);
  const poidsTotal = ponderes.reduce((s, p) => s + PILIERS.find((x) => x.code === p.pilier)!.poids, 0);
  const score = ponderes.length ? arrondi(ponderes.reduce((s, p) => s + (p.score ?? 0) * PILIERS.find((x) => x.code === p.pilier)!.poids, 0) / poidsTotal) : null;

  /* ---- Classable ? Les cas éliminatoires, dans l'ordre de gravité. ----
     Règle du métier (3 septembre 2026) : plus d'un accident sur la période,
     quelle qu'en soit la responsabilité, élimine avec le minimum de points — le
     score tombe à zéro. Un seul accident responsable pèse lourd (l'indicateur
     S_CH_ACCR tombe à zéro) mais ne suffit pas à éliminer. */
  let motifNonClassable: string | null = null;
  let motifConfidentiel = false;
  let scoreFinal = score;
  if (accidents.length > 1) {
    motifNonClassable = `${accidents.length} accidents sur la période — minimum de points`;
    scoreFinal = 0;
  } else if (sanctions.some((s) => s.type === "blame" || s.type === "mise-a-pied")) {
    motifNonClassable = "sanction lourde sur la période";
    motifConfidentiel = true;
  } else if (inapte) motifNonClassable = "déclaré inapte";
  else if (!permisOk || !visiteOk) motifNonClassable = "documents de conduite non valides";
  else if (km < KM_MINIMAL_PAR_MOIS * mois) motifNonClassable = `moins de ${nombre(KM_MINIMAL_PAR_MOIS * mois)} km sur la période`;
  else if (!fiche.ligne.chauffeur.actif) motifNonClassable = "sorti des effectifs";

  const classable = motifNonClassable === null && scoreFinal !== null;
  const tranche = classable ? BAREME_PRIME.find((t) => (scoreFinal ?? 0) >= t.seuil)! : BAREME_PRIME[BAREME_PRIME.length - 1]!;

  return { chauffeurId: fiche.ligne.id, debut, fin, mois, kmParcourus: arrondi(km), piliers, score: scoreFinal, classable, motifNonClassable, motifConfidentiel, tranche };
}

/* -- Classement --------------------------------------------------------------- */

export interface LigneClassement {
  rang: number | null;
  evaluation: EvaluationChauffeur;
  /** Rang du mois précédent, pour l'évolution. */
  rangPrecedent: number | null;
}

function derniersJourDuMois(mois: string): string {
  const [a, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(a!, m!, 0)).toISOString().slice(0, 10);
}

/** Kilomètres moyens des chauffeurs qui ont roulé sur la période — la cohorte de D_CH_ACT. */
export function kmMoyen(fiches: FicheChauffeur[], debut: string, fin: string): number | null {
  const kms = fiches
    .map((f) => f.consommation.filter((c) => `${c.mois}-01` >= debut.slice(0, 7) + "-01" && `${c.mois}-01` <= fin).reduce((s, c) => s + c.kmParcourus, 0))
    .filter((k) => k > 0);
  return kms.length ? kms.reduce((s, k) => s + k, 0) / kms.length : null;
}

/**
 * Classement d'un mois. Ordre : score, puis pilier Sécurité, puis kilomètres —
 * à score égal, le plus sûr passe devant, puis celui qui a le plus roulé. Les
 * non classables sont listés après, sans rang.
 */
export function classer(fiches: FicheChauffeur[], mois: string): LigneClassement[] {
  const [a, m] = mois.split("-").map(Number);
  const precedent = new Date(Date.UTC(a!, m! - 2, 1)).toISOString().slice(0, 7);

  const evaluerMois = (quel: string) => {
    const d = `${quel}-01`;
    const f = derniersJourDuMois(quel);
    const contexte = { kmMoyenCohorte: kmMoyen(fiches, d, f) };
    return fiches.map((fiche) => evaluer(fiche, d, f, contexte));
  };

  const trier = (liste: EvaluationChauffeur[]) =>
    [...liste].sort((x, y) => {
      if (x.classable !== y.classable) return x.classable ? -1 : 1;
      const dScore = (y.score ?? -1) - (x.score ?? -1);
      if (dScore !== 0) return dScore;
      const sx = x.piliers.find((p) => p.pilier === "S")?.score ?? -1;
      const sy = y.piliers.find((p) => p.pilier === "S")?.score ?? -1;
      if (sy !== sx) return sy - sx;
      return y.kmParcourus - x.kmParcourus;
    });

  const rangs = (liste: EvaluationChauffeur[]) => {
    const r = new Map<string, number>();
    let rang = 0;
    for (const e of liste) if (e.classable) r.set(e.chauffeurId, ++rang);
    return r;
  };

  const courant = trier(evaluerMois(mois));
  const rangsPrecedents = rangs(trier(evaluerMois(precedent)));
  const rangsCourants = rangs(courant);

  return courant.map((evaluation) => ({
    rang: rangsCourants.get(evaluation.chauffeurId) ?? null,
    evaluation,
    rangPrecedent: rangsPrecedents.get(evaluation.chauffeurId) ?? null,
  }));
}

/** « 2026-08 » → « Août 2026 ». */
export function libelleMoisLong(mois: string): string {
  const longs = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const [a, m] = mois.split("-").map(Number);
  const nom = longs[m! - 1] ?? mois;
  return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${a}`;
}

/* ============================================================================
 * Performance des chauffeurs — six indicateurs, un score, la prime, le classement.
 *
 * Refonte du 22 septembre 2026 (métier) : « garder le score calculable en
 * automatique avec les données disponibles ; pas besoin des piliers SQDCM ni de
 * leur répartition ; garder le score global et la liste des indicateurs avec
 * leur score — pas plus de six ; voir le mois en cours ; l'évolution mensuelle
 * sur l'Aperçu ».
 *
 * Donc : six indicateurs tirés des faits que les fiches rattachent déjà à
 * l'affectation, plus les événements saisis à la main (0066) pour ce que
 * l'application ne peut pas déduire. Le score est la **moyenne simple** des
 * indicateurs calculables : un indicateur sans donnée ne compte pas, il ne
 * vaut pas zéro. Les objectifs des compteurs sont donnés **par mois** et se
 * multiplient par le nombre de mois lus.
 * ==========================================================================*/

import type { FicheChauffeur } from "./chauffeur";
import { NATURE_EVENEMENT } from "./evenements-chauffeur";
import { nombre } from "@/lib/format";

export type RegleConformite = "inf_egal" | "sup_egal";

export interface DefinitionKpiChauffeur {
  code: string;
  nom: string;
  regle: RegleConformite;
  unite: string;
  /** Objectif — par mois pour un compteur. */
  objectif: number;
  /** Écart à l'objectif où le score tombe à zéro — par mois pour un compteur. */
  tolerance: number;
  /** Vrai pour un compteur : objectif et tolérance se multiplient par les mois lus. */
  compteur: boolean;
  definition: string;
  source: string;
  /** Réservé aux rôles qui voient les sanctions (voir `roles.ts`). */
  confidentiel?: boolean;
}

/** Les six indicateurs, dans l'ordre où la fiche les montre. */
export const KPI_CHAUFFEUR: DefinitionKpiChauffeur[] = [
  {
    code: "ACC",
    nom: "Accidents responsables",
    regle: "inf_egal",
    unite: "#",
    objectif: 0,
    tolerance: 1,
    compteur: true,
    definition: "Accidents déclarés, le chauffeur au volant, dont la responsabilité est SEDIMA ou partagée. Plus d'un accident sur la période, quelle qu'en soit la responsabilité, élimine du classement.",
    source: "Déclarations d'incident",
  },
  {
    code: "INF",
    nom: "Infractions routières",
    regle: "inf_egal",
    unite: "#",
    objectif: 0,
    tolerance: 2,
    compteur: true,
    definition: "Contraventions reçues sur les véhicules conduits pendant l'affectation.",
    source: "Contraventions",
  },
  {
    code: "INC",
    nom: "Pannes et avaries en mission",
    regle: "inf_egal",
    unite: "#",
    objectif: 0,
    tolerance: 3,
    compteur: true,
    definition: "Pannes en livraison ou en transfert, pertes et avaries de chargement, le chauffeur au volant.",
    source: "Déclarations d'incident",
  },
  {
    code: "CONS",
    nom: "Écart de consommation",
    regle: "inf_egal",
    unite: "%",
    objectif: 5,
    tolerance: 20,
    compteur: false,
    definition: "Écart entre la consommation réelle et la référence des véhicules conduits, pondérée par les kilomètres. Ne se calcule que si les kilomètres sont connus.",
    source: "Pleins et relevés",
  },
  {
    code: "PRES",
    nom: "Présence",
    regle: "sup_egal",
    unite: "%",
    objectif: 92,
    tolerance: 25,
    compteur: false,
    definition: "Part des jours de la période où le chauffeur était mobilisable — hors congés, maladie, suspension. La formation n'est pas une absence.",
    source: "Indisponibilités",
  },
  {
    code: "DISC",
    nom: "Discipline",
    regle: "inf_egal",
    unite: "#",
    objectif: 0,
    tolerance: 2,
    compteur: true,
    definition: "Événements négatifs de la période — cas disciplinaires, retards ou absences injustifiées, plaintes — et sanctions, moins les événements positifs (félicitations, formations). Jamais sous zéro.",
    source: "Événements du chauffeur",
    confidentiel: true,
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

/** Quatre tranches à seuils ronds, pour qu'un chauffeur sache où il en est sans calculatrice. */
export const BAREME_PRIME: TranchePrime[] = [
  { cle: "excellent", libelle: "Excellent", seuil: 90, partPct: 100 },
  { cle: "bon", libelle: "Bon", seuil: 75, partPct: 75 },
  { cle: "acceptable", libelle: "Acceptable", seuil: 60, partPct: 50 },
  { cle: "insuffisant", libelle: "Insuffisant", seuil: 0, partPct: 0 },
];

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

export interface EvaluationChauffeur {
  chauffeurId: string;
  debut: string;
  fin: string;
  /** Mois de calendrier touchés, pour les compteurs. */
  mois: number;
  kmParcourus: number;
  kpis: ValeurKpi[];
  /** Moyenne des indicateurs calculables ; nul si aucun ne se calcule. */
  score: number | null;
  classable: boolean;
  /** Pourquoi le chauffeur n'est pas classé — à ne montrer qu'aux rôles habilités s'il s'agit d'une sanction. */
  motifNonClassable: string | null;
  motifConfidentiel: boolean;
  tranche: TranchePrime;
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
 * droite ligne jusqu'à zéro à la tolérance — le chauffeur doit pouvoir refaire
 * le calcul lui-même.
 */
export function scoreKpi(d: { regle: RegleConformite }, valeur: number, objectif: number, tolerance: number): { conforme: boolean; score: number } {
  const ecart = d.regle === "inf_egal" ? valeur - objectif : objectif - valeur;
  if (ecart <= 0) return { conforme: true, score: 100 };
  return { conforme: false, score: Math.max(0, arrondi(100 - (100 * ecart) / Math.max(tolerance, 1e-9))) };
}

/**
 * Évalue un chauffeur sur [debut, fin]. Tout vient de la fiche — faits du parc
 * et événements saisis —, rien n'est saisi « pour la performance ».
 */
export function evaluer(fiche: FicheChauffeur, debut: string, fin: string): EvaluationChauffeur {
  const jours = Math.max(1, joursEntre(debut, fin));
  const [aD, mD] = debut.split("-").map(Number);
  const [aF, mF] = fin.split("-").map(Number);
  const mois = Math.max(1, aF! * 12 + mF! - (aD! * 12 + mD!) + 1);

  const dans = (d: string) => d >= debut && d <= fin;
  const consommation = fiche.consommation.filter((c) => `${c.mois}-01` >= debut.slice(0, 7) + "-01" && `${c.mois}-01` <= fin);
  const contraventions = fiche.contraventions.filter((c) => dans(c.date));
  const incidents = fiche.incidents.filter((i) => dans(i.declaration.dateHeure.slice(0, 10)));
  const sanctions = fiche.sanctions.filter((s) => dans(s.date));
  const evenements = (fiche.evenements ?? []).filter((e) => dans(e.date));
  const affectations = fiche.affectations.filter((a) => a.debut <= fin && (a.fin === null || a.fin >= debut));

  const km = consommation.reduce((s, c) => s + c.kmParcourus, 0);
  const litres = consommation.reduce((s, c) => s + c.litres, 0);
  const referenceKm = consommation.reduce((s, c) => s + c.referenceL100 * c.kmParcourus, 0);

  const accidents = incidents.filter((i) => i.declaration.nature === "accident");
  const responsables = accidents.filter((i) => i.declaration.responsabilite === "sedima" || i.declaration.responsabilite === "partagee");
  const enMission = incidents.filter(
    (i) => (i.declaration.nature === "incident" && (i.declaration.mission === "livraison" || i.declaration.mission === "transfert")) || i.declaration.type === "avarie-chargement" || i.declaration.type === "accident-chargement",
  );
  const joursAbsents = fiche.indisponibilites.filter((i) => i.motif !== "formation").reduce((s, i) => s + joursDans(i.debut, i.fin, debut, fin), 0);

  const negatifs = evenements.filter((e) => NATURE_EVENEMENT[e.nature].effet === "negatif").length;
  const positifs = evenements.filter((e) => NATURE_EVENEMENT[e.nature].effet === "positif").length;
  const discipline = Math.max(0, negatifs + sanctions.length - positifs);

  const permisOk = !fiche.ligne.permis.manquant && (fiche.ligne.permis.joursRestants ?? 0) >= 0;
  const visiteOk = !fiche.ligne.visiteMedicale.manquant && (fiche.ligne.visiteMedicale.joursRestants ?? 0) >= 0;
  const inapte = fiche.ligne.chauffeur.aptitude === "inapte";

  const s = (n: number, un: string, plusieurs = `${un}s`) => `${n} ${n > 1 ? plusieurs : un}`;
  const brut: Record<string, { valeur: number | null; precision: string }> = {
    ACC: { valeur: responsables.length, precision: accidents.length ? `${s(accidents.length, "accident")} déclaré${accidents.length > 1 ? "s" : ""}, ${responsables.length} responsable${responsables.length > 1 ? "s" : ""}` : "aucun accident" },
    INF: { valeur: contraventions.length, precision: contraventions.length ? `${contraventions.filter((c) => c.retenue).length} avec retenue` : "aucune" },
    INC: { valeur: enMission.length, precision: enMission.length ? "voir Incidents" : "aucune" },
    CONS: { valeur: km > 0 && referenceKm > 0 ? arrondi((((litres / km) * 100 - referenceKm / km) / (referenceKm / km)) * 100, 1) : null, precision: km > 0 ? `${nombre((litres / km) * 100, 1)} L/100 contre ${nombre(referenceKm / km, 1)} en référence` : "kilomètres non connus" },
    PRES: { valeur: arrondi(((jours - joursAbsents) / jours) * 100, 1), precision: `${joursAbsents} j d'absence sur ${jours}` },
    DISC: { valeur: discipline, precision: negatifs || positifs || sanctions.length ? [negatifs ? s(negatifs, "événement négatif", "événements négatifs") : null, sanctions.length ? s(sanctions.length, "sanction") : null, positifs ? s(positifs, "positif", "positifs") : null].filter(Boolean).join(" · ") : "rien à signaler" },
  };

  const kpis: ValeurKpi[] = KPI_CHAUFFEUR.map((d) => {
    const { valeur, precision } = brut[d.code] ?? { valeur: null, precision: "" };
    const objectif = d.compteur ? d.objectif * mois : d.objectif;
    const tolerance = d.compteur ? d.tolerance * mois : d.tolerance;
    if (valeur === null) return { definition: d, valeur: null, objectif, conforme: null, score: null, precision };
    const { conforme, score } = scoreKpi(d, valeur, objectif, tolerance);
    return { definition: d, valeur, objectif, conforme, score, precision };
  });

  const calcules = kpis.filter((k) => k.score !== null);
  const score = calcules.length ? arrondi(calcules.reduce((t, k) => t + (k.score ?? 0), 0) / calcules.length) : null;

  /* ---- Classable ? Les cas éliminatoires, dans l'ordre de gravité. ----
     Plus d'un accident sur la période élimine avec le minimum de points (métier,
     3 septembre 2026). Il faut avoir conduit — une affectation sur la période —
     pour être classé : les kilomètres, rarement connus, n'en décident plus. */
  let motifNonClassable: string | null = null;
  let motifConfidentiel = false;
  let scoreFinal = score;
  if (accidents.length > 1) {
    motifNonClassable = `${accidents.length} accidents sur la période — minimum de points`;
    scoreFinal = 0;
  } else if (sanctions.some((x) => x.type === "blame" || x.type === "mise-a-pied")) {
    motifNonClassable = "sanction lourde sur la période";
    motifConfidentiel = true;
  } else if (inapte) motifNonClassable = "déclaré inapte";
  else if (!permisOk || !visiteOk) motifNonClassable = "documents de conduite non valides";
  else if (affectations.length === 0) motifNonClassable = "aucune affectation sur la période";
  else if (!fiche.ligne.chauffeur.actif) motifNonClassable = "sorti des effectifs";

  const classable = motifNonClassable === null && scoreFinal !== null;
  const tranche = classable ? BAREME_PRIME.find((t) => (scoreFinal ?? 0) >= t.seuil)! : BAREME_PRIME[BAREME_PRIME.length - 1]!;

  return { chauffeurId: fiche.ligne.id, debut, fin, mois, kmParcourus: arrondi(km), kpis, score: scoreFinal, classable, motifNonClassable, motifConfidentiel, tranche };
}

/** Le premier et le dernier jour d'un mois. */
export function bornesDuMois(mois: string): { debut: string; fin: string } {
  const [a, m] = mois.split("-").map(Number);
  return { debut: `${mois}-01`, fin: new Date(Date.UTC(a!, m!, 0)).toISOString().slice(0, 10) };
}

/** Le score de chaque mois, du plus ancien au plus récent — l'évolution de l'Aperçu. */
export function scoresMensuels(fiche: FicheChauffeur, moisListe: string[], aujourdhui: string): { mois: string; score: number | null }[] {
  return moisListe.map((m) => {
    const { debut, fin } = bornesDuMois(m);
    if (debut > aujourdhui) return { mois: m, score: null };
    return { mois: m, score: evaluer(fiche, debut, fin < aujourdhui ? fin : aujourdhui).score };
  });
}

/* -- Classement --------------------------------------------------------------- */

export interface LigneClassement {
  rang: number | null;
  evaluation: EvaluationChauffeur;
  /** Rang du mois précédent, pour l'évolution. */
  rangPrecedent: number | null;
}

/**
 * Classement d'un mois. Ordre : score, puis accidents, puis kilomètres — à
 * score égal, le plus sûr passe devant. Les non classables suivent, sans rang.
 */
export function classer(fiches: FicheChauffeur[], mois: string): LigneClassement[] {
  const [a, m] = mois.split("-").map(Number);
  const precedent = new Date(Date.UTC(a!, m! - 2, 1)).toISOString().slice(0, 7);

  const evaluerMois = (quel: string) => {
    const { debut, fin } = bornesDuMois(quel);
    return fiches.map((fiche) => evaluer(fiche, debut, fin));
  };

  const securite = (e: EvaluationChauffeur) => e.kpis.find((k) => k.definition.code === "ACC")?.score ?? -1;
  const trier = (liste: EvaluationChauffeur[]) =>
    [...liste].sort((x, y) => {
      if (x.classable !== y.classable) return x.classable ? -1 : 1;
      const dScore = (y.score ?? -1) - (x.score ?? -1);
      if (dScore !== 0) return dScore;
      if (securite(y) !== securite(x)) return securite(y) - securite(x);
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

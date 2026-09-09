/* ============================================================================
 * Le budget, assemblé depuis une source de faits.
 *
 * Les enveloppes se posent ; la consommation et l'engagement se lisent — sur
 * les dépenses des véhicules et sur les demandes d'achat commandées et non
 * réglées. Ce module tient l'arithmétique, **pure** : il reçoit les
 * enveloppes de l'exercice, les dépenses depuis son ouverture et les demandes
 * d'achat, et rend la liste des postes, la synthèse et la page d'un poste.
 * La démonstration lui donne le jeu du navigateur (`budget-demo.ts`, où les
 * enveloppes dérivent du réalisé), la base lui donne la table `enveloppe`
 * (0002) et les dépenses de l'exercice (`donnees/budget.ts`).
 * ==========================================================================*/

import { attenduADate, PROFIL_PAR_POSTE, SEUIL_ENVELOPPE, suivre, synthetiser, type Enveloppe, type SuiviEnveloppe, type SyntheseBudget } from "./budget";
import type { LigneAchat } from "./caisse";
import type { BusinessUnit, PosteDepense } from "./types";

/* -- Ce qu'il faut savoir pour dresser le budget ------------------------------ */

/** Une dépense qui a mangé un poste, avec le véhicule qui la porte. */
export interface DepenseBudget {
  numero: string;
  date: string;
  poste: PosteDepense;
  libelle: string;
  montant: number;
  beneficiaire: string | null;
  origine: "caisse" | "bon-de-commande" | "facture";
  justificatif: boolean;
  businessUnit: BusinessUnit | null;
  immatriculation: string;
  immatriculationAffichee: string;
  vehicule: string;
}

export interface SourceBudget {
  /** L'année de l'exercice : « 2026 ». */
  exercice: string;
  aujourdhui: string;
  /** Les enveloppes de l'exercice. */
  enveloppes: Enveloppe[];
  /** Les dépenses payées depuis l'ouverture de l'exercice, chacune sur la business unit de son véhicule. */
  depenses: DepenseBudget[];
  /** Les demandes d'achat, la business unit déjà résolue par le véhicule. */
  demandes: LigneAchat[];
}

/* -- Ce que les pages lisent --------------------------------------------------- */

/**
 * Un poste budgétaire, toutes business units confondues.
 *
 * **Une ligne par poste, pas par couple poste × business unit** — décision du
 * métier du 5 septembre 2026. La maille fine reste celle des enveloppes, et
 * c'est bien elle qui se défend en comité : le carburant de l'Aliment ne se
 * compense pas avec les pneumatiques de l'Abattoir. Mais la liste, elle, se lit
 * par poste : le filtre par business unit vit **dans** la page du poste.
 */
export interface SuiviPoste {
  poste: PosteDepense;
  /** Le détail par business unit — c'est la maille des enveloppes. */
  parBu: SuiviEnveloppe[];
  /** Le cumul, calculé comme une enveloppe : même arithmétique, mêmes états. */
  cumul: SuiviEnveloppe;
}

export interface DonneesBudget {
  exercice: string;
  /** Tous les postes de l'exercice — ceux qui portent une enveloppe **et** ceux qui dépensent sans. */
  postes: SuiviPoste[];
  synthese: SyntheseBudget;
  /** Les couples poste × business unit qui dépensent sans enveloppe. */
  horsBudget: { poste: PosteDepense; businessUnit: BusinessUnit | null; montant: number }[];
}

/** Un engagement en cours : commandé, pas encore réglé. */
export interface EngagementBudget {
  numero: string;
  date: string;
  objet: string;
  montant: number;
  fournisseur: string | null;
  prestataireNumero: string | null;
  bonCommande: string;
  businessUnit: BusinessUnit | null;
  immatriculationAffichee: string | null;
}

export interface FichePoste {
  poste: PosteDepense;
  exercice: string;
  aujourdhui: string;
  suivi: SuiviPoste;
  depenses: DepenseBudget[];
  engagements: EngagementBudget[];
  /** Le mois par mois de l'exercice : cumul consommé et cumul attendu. */
  parMois: { mois: string; consomme: number; attendu: number }[];
}

/* -- L'arithmétique -------------------------------------------------------------- */

function cle(poste: PosteDepense, bu: BusinessUnit | null): string {
  return `${poste}|${bu ?? "*"}`;
}

function decomposer(k: string): { poste: PosteDepense; businessUnit: BusinessUnit | null } {
  const [poste, bu] = k.split("|") as [PosteDepense, string];
  return { poste, businessUnit: bu === "*" ? null : (bu as BusinessUnit) };
}

/** Ce qui a été dépensé depuis le début de l'exercice, par poste et business unit. */
function consommeDe(s: SourceBudget): Map<string, number> {
  const parCle = new Map<string, number>();
  const debut = `${s.exercice}-01-01`;
  for (const d of s.depenses) {
    if (d.date < debut || d.date > s.aujourdhui) continue;
    const k = cle(d.poste, d.businessUnit);
    parCle.set(k, (parCle.get(k) ?? 0) + d.montant);
  }
  return parCle;
}

/** Une demande engage le budget dès le bon de commande, jusqu'au règlement. */
function engage(d: LigneAchat, exercice: string): boolean {
  return d.numeroBonCommande !== null && d.dateReglement === null && d.etape !== "refusee" && d.date.slice(0, 4) === exercice;
}

function montantEngage(d: LigneAchat): number {
  return d.montantReel ?? d.montantEngage ?? d.montantEstime;
}

/**
 * L'engagé : commandé, pas encore réglé. C'est le chiffre que le suivi
 * budgétaire oublie le plus souvent, et celui qui fait les mauvaises
 * surprises : à partir du bon, le budget est mangé.
 */
function engagementsDe(s: SourceBudget): Map<string, number> {
  const parCle = new Map<string, number>();
  for (const d of s.demandes) {
    if (!engage(d, s.exercice)) continue;
    const k = cle(d.poste, d.businessUnit);
    parCle.set(k, (parCle.get(k) ?? 0) + montantEngage(d));
  }
  return parCle;
}

/** L'enveloppe fictive d'un couple hors budget : zéro franc, et la raison écrite. */
function enveloppeAbsente(exercice: string, poste: PosteDepense, businessUnit: BusinessUnit | null): Enveloppe {
  return {
    numero: "",
    exercice,
    poste,
    businessUnit,
    montant: 0,
    profil: PROFIL_PAR_POSTE[poste] ?? null,
    base: `aucune enveloppe — le réalisé annualisé était sous le seuil de ${SEUIL_ENVELOPPE.toLocaleString("fr-FR")} F`,
    commentaire: null,
  };
}

/**
 * Le suivi d'un couple sans enveloppe. On ne passe pas par `suivre()`, qui
 * conclurait « dépassé » — vrai arithmétiquement, faux pour le lecteur : rien
 * n'a été dépassé, rien n'a été prévu.
 */
function suiviSansBudget(exercice: string, poste: PosteDepense, bu: BusinessUnit | null, consomme: number, engage: number): SuiviEnveloppe {
  return { enveloppe: enveloppeAbsente(exercice, poste, bu), consomme, engage, disponible: 0, attendu: 0, tauxConsommation: null, ecartRythmePct: null, etat: "sans-budget" };
}

/** La base commune des enveloppes d'un poste, ou le renvoi au détail. */
function basesAccordees(parBu: SuiviEnveloppe[]): string {
  const bases = new Set(parBu.filter((x) => x.enveloppe.montant > 0).map((x) => x.enveloppe.base));
  if (bases.size === 1) return [...bases][0]!;
  if (bases.size === 0) return "aucune enveloppe sur ce poste";
  return "plusieurs bases selon la business unit — voir la ventilation";
}

/** Le jour de lecture, décomposé pour l'attendu à date. */
function calendrier(s: SourceBudget): { mois: number; jour: number; joursDuMois: number } {
  const mois = Number(s.aujourdhui.slice(5, 7));
  const jour = Number(s.aujourdhui.slice(8, 10));
  return { mois, jour, joursDuMois: new Date(Date.UTC(Number(s.exercice), mois, 0)).getUTCDate() };
}

/** Le cumul d'un poste, jugé comme une enveloppe — sans quoi l'état de la ligne et celui de ses parties ne diraient pas la même chose. */
export function cumulDuPoste(exercice: string, poste: PosteDepense, parBu: SuiviEnveloppe[]): SuiviEnveloppe {
  const budget = parBu.reduce((t, x) => t + x.enveloppe.montant, 0);
  const consomme = parBu.reduce((t, x) => t + x.consomme, 0);
  const engage = parBu.reduce((t, x) => t + x.engage, 0);
  const synthetique: Enveloppe = {
    numero: "",
    exercice,
    poste,
    businessUnit: null,
    montant: budget,
    profil: PROFIL_PAR_POSTE[poste] ?? null,
    /* La base du poste est celle de ses enveloppes quand elles s'accordent ;
       sinon on renvoie au détail plutôt que d'en inventer une. */
    base: basesAccordees(parBu),
    commentaire: null,
  };
  return budget > 0
    ? suivre(synthetique, consomme, engage, parBu.reduce((t, x) => t + x.attendu, 0))
    : { ...suiviSansBudget(exercice, poste, null, consomme, engage), enveloppe: synthetique };
}

/** Le suivi d'une enveloppe à la date de lecture. */
export function suiviDe(s: SourceBudget, e: Enveloppe, consomme: number, engage: number): SuiviEnveloppe {
  const { mois, jour, joursDuMois } = calendrier(s);
  return suivre(e, consomme, engage, attenduADate(e, mois, jour, joursDuMois));
}

export function donneesBudgetDe(s: SourceBudget): DonneesBudget {
  const consomme = consommeDe(s);
  const engagements = engagementsDe(s);

  /* Le suivi à la maille fine : une entrée par enveloppe. */
  const fins = s.enveloppes.map((e) => {
    const k = cle(e.poste, e.businessUnit);
    return suiviDe(s, e, consomme.get(k) ?? 0, engagements.get(k) ?? 0);
  });

  /*
   * Ce qui se dépense ou s'engage sans enveloppe. Le montant compte moins que
   * la liste : un couple qui apparaît ici deux exercices de suite doit être
   * budgété. **L'engagé compte autant que le consommé pour entrer dans cette
   * liste** : un engagement invisible est exactement la mauvaise surprise que
   * ce suivi doit empêcher.
   */
  const couvertes = new Set(s.enveloppes.map((e) => cle(e.poste, e.businessUnit)));
  const horsBudget: DonneesBudget["horsBudget"] = [];
  for (const k of new Set([...consomme.keys(), ...engagements.keys()])) {
    if (couvertes.has(k)) continue;
    const montantConsomme = consomme.get(k) ?? 0;
    if (montantConsomme <= 0 && (engagements.get(k) ?? 0) <= 0) continue;
    horsBudget.push({ ...decomposer(k), montant: montantConsomme });
  }
  horsBudget.sort((a, b) => b.montant - a.montant);

  const tousFins = [...fins, ...horsBudget.map((h) => suiviSansBudget(s.exercice, h.poste, h.businessUnit, h.montant, engagements.get(cle(h.poste, h.businessUnit)) ?? 0))];

  const parPoste = new Map<PosteDepense, SuiviEnveloppe[]>();
  for (const x of tousFins) {
    const liste = parPoste.get(x.enveloppe.poste) ?? [];
    liste.push(x);
    parPoste.set(x.enveloppe.poste, liste);
  }

  const postes: SuiviPoste[] = [...parPoste.entries()].map(([poste, parBu]) => {
    parBu.sort((a, b) => b.enveloppe.montant - a.enveloppe.montant || b.consomme - a.consomme);
    return { poste, parBu, cumul: cumulDuPoste(s.exercice, poste, parBu) };
  });
  postes.sort((a, b) => b.cumul.enveloppe.montant - a.cumul.enveloppe.montant || b.cumul.consomme - a.cumul.consomme);

  return {
    exercice: s.exercice,
    postes,
    /* La synthèse ne porte que sur les enveloppes : additionner un budget nul
       fausserait le disponible et les taux. */
    synthese: synthetiser(fins, horsBudget.reduce((t, h) => t + h.montant, 0)),
    horsBudget,
  };
}

/**
 * Le détail d'un poste budgétaire : ce qui l'a consommé, dépense par dépense.
 * Demande du métier du 5 septembre 2026 : « on doit pouvoir rentrer sur un
 * poste et voir les dépenses qui l'ont impacté ». Un budget qui ne se justifie
 * pas ligne à ligne ne se discute pas.
 */
export function fichePosteDe(s: SourceBudget, cleUrl: string, donnees: DonneesBudget = donneesBudgetDe(s)): FichePoste | null {
  const suivi = donnees.postes.find((p) => p.poste === cleUrl);
  if (!suivi) return null;
  const poste = suivi.poste;
  const debut = `${s.exercice}-01-01`;
  const recent = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);

  const depenses = s.depenses.filter((d) => d.poste === poste && d.date >= debut && d.date <= s.aujourdhui).sort(recent);
  const engagements: EngagementBudget[] = s.demandes
    .filter((d) => engage(d, s.exercice) && d.poste === poste)
    .map((d) => ({
      numero: d.numero,
      date: d.date,
      objet: d.objet,
      montant: montantEngage(d),
      fournisseur: d.fournisseur,
      prestataireNumero: d.prestataireNumero,
      bonCommande: d.numeroBonCommande!,
      businessUnit: d.businessUnit,
      immatriculationAffichee: d.immatriculationAffichee,
    }))
    .sort(recent);

  /* Le mois par mois : le consommé cumulé contre le rythme attendu du profil.
     C'est la lecture qui explique un écart — un budget d'assurance payé en
     deux fois n'est pas « en avance », il est à sa date. */
  const { mois: moisCourant, jour: jourCourant } = calendrier(s);
  const parMois: FichePoste["parMois"] = [];
  let cumul = 0;
  for (let m = 1; m <= moisCourant; m += 1) {
    const etiquette = `${s.exercice}-${String(m).padStart(2, "0")}`;
    cumul += depenses.filter((d) => d.date.slice(0, 7) === etiquette).reduce((t, d) => t + d.montant, 0);
    const joursDuMoisM = new Date(Date.UTC(Number(s.exercice), m, 0)).getUTCDate();
    const jourM = m === moisCourant ? jourCourant : joursDuMoisM;
    parMois.push({ mois: etiquette, consomme: cumul, attendu: attenduADate(suivi.cumul.enveloppe, m, jourM, joursDuMoisM) });
  }

  return { poste, exercice: s.exercice, aujourdhui: s.aujourdhui, suivi, depenses, engagements, parMois };
}

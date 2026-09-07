/* ============================================================================
 * Les enveloppes budgétaires et leur consommation.
 *
 * **Les montants ne sont pas inventés : ils sont dérivés du réalisé.** Chaque
 * enveloppe 2026 part de ce que le poste a coûté en 2025, majoré d'une marge
 * qui dépend de ce qu'on en attend — la maintenance d'un parc vieillissant
 * augmente, le carburant suit les prix, l'assurance se négocie. Chaque
 * enveloppe porte donc sa `base`, en clair, et c'est cette phrase qui se
 * discute en comité, pas le chiffre.
 *
 * La **consommation** et l'**engagement**, eux, ne s'écrivent nulle part ici :
 * ils se lisent sur les dépenses des fiches et sur les demandes d'achat. Un
 * budget dont le consommé serait saisi à la main ne servirait à rien — il
 * dirait ce qu'on veut bien lui dire.
 * ==========================================================================*/

import type { Enveloppe, SuiviEnveloppe, SyntheseBudget } from "@/domaine/budget";
import { attenduADate, suivre, synthetiser } from "@/domaine/budget";
import { formerNumero } from "@/domaine/reference";
import type { BusinessUnit, PosteDepense } from "@/domaine/types";
import { demandesAchat } from "./caisse-demo";
import { DATE_REFERENCE } from "./chauffeurs-demo";
import { fichePourImmatriculation } from "./fiche-demo";
import { FLOTTE } from "./parc-demo";
import { depensesForfaits } from "./parc-leger-demo";
import { PARAMETRES_DEFAUT } from "@/domaine/parametres";

const EXERCICE = DATE_REFERENCE.slice(0, 4);

/** Les forfaits carburant du parc léger, en dépenses mensuelles — cadrage du 7 septembre 2026. */
const forfaits = () => depensesForfaits(DATE_REFERENCE, PARAMETRES_DEFAUT.parcLeger.forfaitCarburantMensuel);

/* -- Le réalisé, poste par poste et business unit par business unit ---------------- */

function cle(poste: PosteDepense, bu: BusinessUnit | null): string {
  return `${poste}|${bu ?? "*"}`;
}

/**
 * Les dépenses d'une période, ventilées par poste et par business unit.
 *
 * La période est bornée par des **dates**, non par une année civile : la base
 * du budget se prend sur douze mois glissants. Prendre « l'année précédente »
 * donnait une base de quatre mois — l'historique ne remonte pas plus haut — et
 * des enveloppes trois fois trop petites, donc un budget dépassé de 340 % dès
 * l'ouverture de l'écran. Une base tronquée est pire qu'une base absente : elle
 * a l'apparence d'un chiffre.
 */
function realise(depuis: string, jusqua: string): Map<string, number> {
  const parCle = new Map<string, number>();
  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation);
    if (!f) continue;
    const bu = l.vehicule.businessUnit;
    for (const d of f.depenses) {
      if (d.date < depuis || d.date > jusqua) continue;
      const k = cle(d.poste, bu);
      parCle.set(k, (parCle.get(k) ?? 0) + d.montant);
    }
  }
  /* Le parc léger : les forfaits carburant, sur la BU de l'agent. */
  for (const d of forfaits()) {
    if (d.date < depuis || d.date > jusqua) continue;
    const k = cle(d.poste, d.businessUnit);
    parCle.set(k, (parCle.get(k) ?? 0) + d.montant);
  }
  return parCle;
}

const DEBUT_EXERCICE = `${EXERCICE}-01-01`;

/** Les douze mois qui précèdent l'exercice — la base des enveloppes. */
const DEBUT_BASE = (() => {
  const d = new Date(`${DEBUT_EXERCICE}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
})();

/** Combien de mois d'une fenêtre portent réellement des dépenses. */
function moisAvecDepenses(depuis: string, jusqua: string): number {
  const mois = new Set<string>();
  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation);
    if (!f) continue;
    for (const d of f.depenses) if (d.date >= depuis && d.date <= jusqua) mois.add(d.date.slice(0, 7));
  }
  for (const d of forfaits()) if (d.date >= depuis && d.date <= jusqua) mois.add(d.mois);
  return mois.size;
}

let CACHE_REALISE: Map<string, number> | null = null;
/** Ce qui a été dépensé depuis le début de l'exercice. */
function realiseCourant(): Map<string, number> {
  if (!CACHE_REALISE) CACHE_REALISE = realise(DEBUT_EXERCICE, DATE_REFERENCE);
  return CACHE_REALISE;
}

/* -- Les enveloppes ---------------------------------------------------------------- */

/**
 * La marge appliquée au réalisé de l'exercice précédent, poste par poste, et ce
 * qui la justifie. C'est la seule part du budget qui relève d'un arbitrage — le
 * reste est de l'arithmétique.
 */
const MARGE: Partial<Record<PosteDepense, { taux: number; raison: string }>> = {
  carburant: { taux: 1.06, raison: "réalisé annualisé de la période précédente + 6 % — hausse d'activité, prix du gasoil stable depuis mars" },
  "maintenance-preventive": { taux: 1.15, raison: "réalisé annualisé de la période précédente + 15 % — le plan d'entretien passe en suivi réel" },
  "maintenance-curative": { taux: 0.9, raison: "réalisé annualisé de la période précédente − 10 % — objectif de bascule du curatif vers le préventif" },
  pieces: { taux: 1.08, raison: "réalisé annualisé de la période précédente + 8 % — importation et change" },
  pneumatiques: { taux: 1.12, raison: "réalisé annualisé de la période précédente + 12 % — renouvellement de six trains" },
  assurance: { taux: 1.0, raison: "réalisé annualisé de la période précédente — prime négociée en bloc, inchangée" },
  conformite: { taux: 1.05, raison: "réalisé annualisé de la période précédente + 5 %" },
  "frais-de-route": { taux: 1.1, raison: "réalisé annualisé de la période précédente + 10 % — nouveau barème des frais de déplacement" },
  peage: { taux: 1.05, raison: "réalisé annualisé de la période précédente + 5 %" },
  contravention: { taux: 0.5, raison: "réalisé annualisé de la période précédente − 50 % — une contravention budgétée n'est pas une contravention acceptée" },
};

const MARGE_DEFAUT = { taux: 1.05, raison: "réalisé annualisé de la période précédente + 5 %" };

/** Au-dessous, une enveloppe coûterait plus cher à tenir qu'elle ne rapporte de maîtrise. */
export const SEUIL_ENVELOPPE = 500_000;

/**
 * La saisonnalité de l'aliment : les enlèvements montent d'août à novembre,
 * retombent en saison des pluies. Elle vaut pour le carburant et les frais de
 * route, qui suivent l'activité ; pas pour l'assurance, qui se paie d'un coup.
 */
const PROFIL_ACTIVITE = [0.075, 0.07, 0.075, 0.08, 0.085, 0.08, 0.075, 0.09, 0.095, 0.095, 0.095, 0.085];
const PROFIL_ASSURANCE = [0.5, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0];

const PROFIL: Partial<Record<PosteDepense, number[]>> = {
  carburant: PROFIL_ACTIVITE,
  "frais-de-route": PROFIL_ACTIVITE,
  peage: PROFIL_ACTIVITE,
  assurance: PROFIL_ASSURANCE,
};

let CACHE_ENVELOPPES: Enveloppe[] | null = null;

/**
 * Les enveloppes de l'exercice. Une par couple poste × business unit dont le
 * réalisé de l'an dernier dépasse un seuil : au-dessous, l'enveloppe coûterait
 * plus cher à suivre qu'elle ne rapporte de maîtrise.
 */
export function enveloppes(): Enveloppe[] {
  if (CACHE_ENVELOPPES) return CACHE_ENVELOPPES;
  /*
   * **La base est annualisée.** L'historique des dépenses ne remonte qu'à
   * douze mois glissants : la fenêtre qui précède l'exercice n'en porte que
   * quatre, et une enveloppe bâtie dessus vaudrait le tiers de ce qu'il faut —
   * l'écran annoncerait 340 % de consommation dès son ouverture.
   *
   * On ramène donc le réalisé de la fenêtre à douze mois. C'est une
   * approximation, elle est écrite sur chaque enveloppe, et elle disparaîtra le
   * jour où l'application aura deux exercices d'historique. Le jeu de
   * démonstration doit dire ce qu'il extrapole.
   */
  const anPasse = realise(DEBUT_BASE, DEBUT_EXERCICE);
  const moisCouverts = moisAvecDepenses(DEBUT_BASE, DEBUT_EXERCICE);
  const annualisation = moisCouverts > 0 ? 12 / moisCouverts : 1;
  const lignes: Enveloppe[] = [];
  let rang = 0;

  for (const [k, brut] of [...anPasse.entries()].sort((a, b) => b[1] - a[1])) {
    const montantPasse = brut * annualisation;
    if (montantPasse < SEUIL_ENVELOPPE) continue;
    const [poste, bu] = k.split("|") as [PosteDepense, string];
    const marge = MARGE[poste] ?? MARGE_DEFAUT;
    rang += 1;
    lignes.push({
      numero: formerNumero("budget", `${EXERCICE}-01-01`, rang),
      exercice: EXERCICE,
      poste,
      businessUnit: bu === "*" ? null : (bu as BusinessUnit),
      /* Arrondi au dix millier : un budget au franc près donne une précision
         que la prévision n'a pas. */
      montant: Math.round((montantPasse * marge.taux) / 10_000) * 10_000,
      profil: PROFIL[poste] ?? null,
      base: marge.raison,
      commentaire: null,
    });
  }

  /*
   * **Les postes que la fenêtre de base ignore.**
   *
   * Le carburant ne portait aucune enveloppe : ses dépenses ne commencent qu'en
   * janvier de l'exercice, la fenêtre de base n'en voit donc pas un franc, et le
   * premier poste du parc — 141 M F — tombait en « hors budget ». Un budget de
   * flotte sans ligne carburant n'est pas un budget.
   *
   * Quand un poste consomme sans base historique, l'enveloppe se dérive de son
   * propre rythme : le réalisé depuis le début de l'exercice, annualisé. C'est
   * l'approximation déjà retenue pour les autres, appliquée à une autre fenêtre,
   * et chaque ligne l'écrit. « Hors budget » retrouve alors son sens : un poste
   * trop petit pour mériter une enveloppe, non un poste qu'on a oublié.
   */
  const couvertes = new Set(lignes.map((l) => cle(l.poste, l.businessUnit)));
  const enCours = realiseCourant();
  const moisEnCours = moisAvecDepenses(DEBUT_EXERCICE, DATE_REFERENCE);
  const annualisationEnCours = moisEnCours > 0 ? 12 / moisEnCours : 1;
  const manquantes: Enveloppe[] = [];

  for (const [k, brut] of [...enCours.entries()].sort((a, b) => b[1] - a[1])) {
    if (couvertes.has(k)) continue;
    const montantAnnuel = brut * annualisationEnCours;
    if (montantAnnuel < SEUIL_ENVELOPPE) continue;
    const [poste, bu] = k.split("|") as [PosteDepense, string];
    rang += 1;
    manquantes.push({
      numero: formerNumero("budget", `${EXERCICE}-01-01`, rang),
      exercice: EXERCICE,
      poste,
      businessUnit: bu === "*" ? null : (bu as BusinessUnit),
      montant: Math.round(montantAnnuel / 10_000) * 10_000,
      profil: PROFIL[poste] ?? null,
      base: `réalisé de l'exercice en cours, annualisé sur ${moisEnCours} mois — l'historique ne remonte pas avant l'ouverture de ce poste`,
      commentaire: null,
    });
  }
  lignes.push(...manquantes);

  CACHE_ENVELOPPES = lignes;
  return lignes;
}

/* -- Ce qui est engagé ------------------------------------------------------------- */

/**
 * L'engagé : commandé, pas encore réglé.
 *
 * C'est le chiffre que le suivi budgétaire oublie le plus souvent, et celui qui
 * fait les mauvaises surprises. Une demande d'achat validée mais sans bon de
 * commande n'engage rien — le fournisseur n'a rien reçu ; à partir du bon, le
 * budget est mangé.
 */
function engagements(): Map<string, number> {
  const parCle = new Map<string, number>();
  const buParVehicule = new Map(FLOTTE.map((l) => [l.vehicule.id, l.vehicule.businessUnit]));
  for (const d of demandesAchat()) {
    if (d.numeroBonCommande === null || d.dateReglement !== null || d.etape === "refusee") continue;
    if (d.date.slice(0, 4) !== EXERCICE) continue;
    const bu = d.businessUnit ?? (d.vehiculeId ? (buParVehicule.get(d.vehiculeId) ?? null) : null);
    const montant = d.montantReel ?? d.montantEngage ?? d.montantEstime;
    const k = cle(d.poste, bu);
    parCle.set(k, (parCle.get(k) ?? 0) + montant);
  }
  return parCle;
}

/* -- Le suivi, poste par poste ------------------------------------------------------ */

/**
 * Un poste budgétaire, toutes business units confondues.
 *
 * **Une ligne par poste, pas par couple poste × business unit** — décision du
 * métier du 5 septembre 2026. La maille fine reste celle des enveloppes, et
 * c'est bien elle qui se défend en comité : le carburant de l'Aliment ne se
 * compense pas avec les pneumatiques de l'Abattoir. Mais la liste, elle, se lit
 * par poste : quatre lignes de carburant côte à côte n'apprennent rien qu'une
 * ligne et sa ventilation n'apprennent mieux. Le filtre par business unit vit
 * donc **dans** la page du poste.
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
  /**
   * Tous les postes de l'exercice — ceux qui portent une enveloppe **et** ceux
   * qui dépensent sans. Les seconds vivaient dans un tableau à part ; le métier
   * a demandé de les ramener dans la liste : un poste hors budget n'est pas
   * d'une autre nature, c'est un poste dont le budget vaut zéro, et l'on veut
   * ouvrir sa page comme celle des autres.
   */
  postes: SuiviPoste[];
  synthese: SyntheseBudget;
  /** Les couples poste × business unit qui dépensent sans enveloppe. */
  horsBudget: { poste: PosteDepense; businessUnit: BusinessUnit | null; montant: number }[];
}

/** L'enveloppe fictive d'un couple hors budget : zéro franc, et la raison écrite. */
function enveloppeAbsente(poste: PosteDepense, businessUnit: BusinessUnit | null): Enveloppe {
  return {
    numero: "",
    exercice: EXERCICE,
    poste,
    businessUnit,
    montant: 0,
    profil: PROFIL[poste] ?? null,
    base: `aucune enveloppe — le réalisé annualisé était sous le seuil de ${SEUIL_ENVELOPPE.toLocaleString("fr-FR")} F`,
    commentaire: null,
  };
}

/**
 * Le suivi d'un couple sans enveloppe. On ne passe pas par `suivre()`, qui
 * conclurait « dépassé » — vrai arithmétiquement, faux pour le lecteur : rien
 * n'a été dépassé, rien n'a été prévu.
 */
function suiviSansBudget(poste: PosteDepense, bu: BusinessUnit | null, consomme: number, engage: number): SuiviEnveloppe {
  return { enveloppe: enveloppeAbsente(poste, bu), consomme, engage, disponible: 0, attendu: 0, tauxConsommation: null, ecartRythmePct: null, etat: "sans-budget" };
}

/** La base commune des enveloppes d'un poste, ou le renvoi au détail. */
function basesAccordees(parBu: SuiviEnveloppe[]): string {
  const bases = new Set(parBu.filter((s) => s.enveloppe.montant > 0).map((s) => s.enveloppe.base));
  if (bases.size === 1) return [...bases][0]!;
  if (bases.size === 0) return "aucune enveloppe sur ce poste";
  return "plusieurs bases selon la business unit — voir la ventilation";
}

let CACHE_BUDGET: DonneesBudget | null = null;

export function donneesBudget(): DonneesBudget {
  if (CACHE_BUDGET) return CACHE_BUDGET;

  const consomme = realiseCourant();
  const engage = engagements();
  const mois = Number(DATE_REFERENCE.slice(5, 7));
  const jour = Number(DATE_REFERENCE.slice(8, 10));
  const joursDuMois = new Date(Date.UTC(Number(EXERCICE), mois, 0)).getUTCDate();

  /* Le suivi à la maille fine : une entrée par enveloppe. */
  const fins = enveloppes().map((e) => {
    const k = cle(e.poste, e.businessUnit);
    return suivre(e, consomme.get(k) ?? 0, engage.get(k) ?? 0, attenduADate(e, mois, jour, joursDuMois));
  });

  /*
   * Ce qui se dépense ou s'engage sans enveloppe. Le montant compte moins que
   * la liste : un couple qui apparaît ici deux exercices de suite doit être
   * budgété.
   *
   * **L'engagé compte autant que le consommé pour entrer dans cette liste.**
   * Cinq bons de commande vivaient hors de tout écran parce que leur poste
   * n'avait encore produit aucune dépense : un engagement invisible est
   * exactement la mauvaise surprise que ce suivi doit empêcher.
   */
  const couvertes = new Set(enveloppes().map((e) => cle(e.poste, e.businessUnit)));
  const horsBudget: DonneesBudget["horsBudget"] = [];
  for (const k of new Set([...consomme.keys(), ...engage.keys()])) {
    if (couvertes.has(k)) continue;
    const montantConsomme = consomme.get(k) ?? 0;
    if (montantConsomme <= 0 && (engage.get(k) ?? 0) <= 0) continue;
    const [poste, bu] = k.split("|") as [PosteDepense, string];
    horsBudget.push({ poste, businessUnit: bu === "*" ? null : (bu as BusinessUnit), montant: montantConsomme });
  }
  horsBudget.sort((a, b) => b.montant - a.montant);

  const tousFins = [...fins, ...horsBudget.map((h) => suiviSansBudget(h.poste, h.businessUnit, h.montant, engage.get(cle(h.poste, h.businessUnit)) ?? 0))];

  /* Le regroupement par poste. Le cumul se calcule avec `suivre()` sur une
     enveloppe synthétique : un poste se juge comme une enveloppe, sans quoi
     l'état de la ligne et celui de ses parties ne diraient pas la même chose. */
  const parPoste = new Map<PosteDepense, SuiviEnveloppe[]>();
  for (const s of tousFins) {
    const liste = parPoste.get(s.enveloppe.poste) ?? [];
    liste.push(s);
    parPoste.set(s.enveloppe.poste, liste);
  }

  const postes: SuiviPoste[] = [...parPoste.entries()].map(([poste, parBu]) => {
    parBu.sort((a, b) => b.enveloppe.montant - a.enveloppe.montant || b.consomme - a.consomme);
    const budget = parBu.reduce((s, x) => s + x.enveloppe.montant, 0);
    const totalConsomme = parBu.reduce((s, x) => s + x.consomme, 0);
    const totalEngage = parBu.reduce((s, x) => s + x.engage, 0);
    const synthetique: Enveloppe = {
      numero: "",
      exercice: EXERCICE,
      poste,
      businessUnit: null,
      montant: budget,
      profil: PROFIL[poste] ?? null,
      /* La base du poste est celle de ses enveloppes quand elles s'accordent ;
         sinon on renvoie au détail plutôt que d'en inventer une. */
      base: basesAccordees(parBu),
      commentaire: null,
    };
    const cumul =
      budget > 0
        ? suivre(
            synthetique,
            totalConsomme,
            totalEngage,
            parBu.reduce((s, x) => s + x.attendu, 0),
          )
        : { ...suiviSansBudget(poste, null, totalConsomme, totalEngage), enveloppe: synthetique };
    return { poste, parBu, cumul };
  });

  postes.sort((a, b) => b.cumul.enveloppe.montant - a.cumul.enveloppe.montant || b.cumul.consomme - a.cumul.consomme);

  CACHE_BUDGET = {
    exercice: EXERCICE,
    postes,
    /* La synthèse ne porte que sur les enveloppes : additionner un budget nul
       fausserait le disponible et les taux. */
    synthese: synthetiser(
      fins,
      horsBudget.reduce((s, h) => s + h.montant, 0),
    ),
    horsBudget,
  };
  return CACHE_BUDGET;
}

/* -- La page d'un poste budgétaire -------------------------------------------------- */

/** Une dépense qui a mangé le poste, avec le véhicule qui la porte. */
export interface DepenseBudget {
  numero: string;
  date: string;
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
  suivi: SuiviPoste;
  depenses: DepenseBudget[];
  engagements: EngagementBudget[];
  /** Le mois par mois de l'exercice : cumul consommé et cumul attendu. */
  parMois: { mois: string; consomme: number; attendu: number }[];
}

/**
 * Le détail d'un poste budgétaire : ce qui l'a consommé, dépense par dépense.
 *
 * Demande du métier du 5 septembre 2026 : « on doit pouvoir rentrer sur un
 * poste et voir la fiche du poste de dépense avec les dépenses qui l'ont
 * impacté ». Un budget qui ne se justifie pas ligne à ligne ne se discute pas :
 * on ne peut ni contester un dépassement, ni le comprendre. Le filtre par
 * business unit s'applique ici, sur cette page, et non dans la liste.
 */
export function fichePoste(cleUrl: string): FichePoste | null {
  const suivi = donneesBudget().postes.find((p) => p.poste === cleUrl);
  if (!suivi) return null;
  const poste = suivi.poste;

  const depenses: DepenseBudget[] = [];
  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation);
    if (!f) continue;
    for (const d of f.depenses) {
      if (d.poste !== poste || d.date < DEBUT_EXERCICE || d.date > DATE_REFERENCE) continue;
      depenses.push({
        numero: d.numero,
        date: d.date,
        libelle: d.libelle,
        montant: d.montant,
        beneficiaire: d.beneficiaire,
        origine: d.origine,
        justificatif: d.justificatif,
        businessUnit: l.vehicule.businessUnit,
        immatriculation: l.vehicule.immatriculation,
        immatriculationAffichee: l.vehicule.immatriculationAffichee,
        vehicule: `${l.vehicule.marque} ${l.vehicule.appellation}`,
      });
    }
  }
  /* Les forfaits carburant du parc léger : une ligne par véhicule de fonction et par mois. */
  for (const d of forfaits()) {
    if (d.poste !== poste || d.date < DEBUT_EXERCICE || d.date > DATE_REFERENCE) continue;
    depenses.push({
      numero: d.numero,
      date: d.date,
      libelle: d.libelle,
      montant: d.montant,
      beneficiaire: d.beneficiaire,
      origine: d.origine,
      justificatif: d.justificatif,
      businessUnit: d.businessUnit,
      immatriculation: d.immatriculation,
      immatriculationAffichee: d.immatriculationAffichee,
      vehicule: d.vehicule,
    });
  }
  depenses.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const buParVehicule = new Map(FLOTTE.map((l) => [l.vehicule.id, l.vehicule.businessUnit]));
  const engagements: EngagementBudget[] = [];
  for (const d of demandesAchat()) {
    if (d.numeroBonCommande === null || d.dateReglement !== null || d.etape === "refusee") continue;
    if (d.date.slice(0, 4) !== EXERCICE || d.poste !== poste) continue;
    engagements.push({
      numero: d.numero,
      date: d.date,
      objet: d.objet,
      montant: d.montantReel ?? d.montantEngage ?? d.montantEstime,
      fournisseur: d.fournisseur,
      prestataireNumero: d.prestataireNumero,
      bonCommande: d.numeroBonCommande,
      businessUnit: d.businessUnit ?? (d.vehiculeId ? (buParVehicule.get(d.vehiculeId) ?? null) : null),
      immatriculationAffichee: d.immatriculationAffichee,
    });
  }
  engagements.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  /* Le mois par mois : le consommé cumulé contre le rythme attendu du profil.
     C'est la lecture qui explique un écart — un budget d'assurance payé en
     deux fois n'est pas « en avance », il est à sa date. */
  const moisCourant = Number(DATE_REFERENCE.slice(5, 7));
  const parMois: FichePoste["parMois"] = [];
  let cumul = 0;
  for (let m = 1; m <= moisCourant; m += 1) {
    const etiquette = `${EXERCICE}-${String(m).padStart(2, "0")}`;
    cumul += depenses.filter((d) => d.date.slice(0, 7) === etiquette).reduce((s, d) => s + d.montant, 0);
    const joursDuMoisM = new Date(Date.UTC(Number(EXERCICE), m, 0)).getUTCDate();
    const jourM = m === moisCourant ? Number(DATE_REFERENCE.slice(8, 10)) : joursDuMoisM;
    parMois.push({ mois: etiquette, consomme: cumul, attendu: attenduADate(suivi.cumul.enveloppe, m, jourM, joursDuMoisM) });
  }

  return { poste, suivi, depenses, engagements, parMois };
}

/** Les postes adressables — pour le rendu statique des pages. */
export function postesBudgetaires(): string[] {
  return donneesBudget().postes.map((p) => p.poste);
}


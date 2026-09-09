/* ============================================================================
 * Les enveloppes budgétaires et leur consommation — données de démonstration.
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
 *
 * L'arithmétique du suivi vit dans le domaine (`assembler-budget.ts`) ; ce
 * module lui donne le jeu du navigateur — les enveloppes dérivées, les
 * dépenses des fiches, les forfaits du parc léger, les demandes d'achat —,
 * `donnees/budget.ts` lui donne la base. Les fonctions `donneesBudget()` et
 * `fichePoste()` restent, pour les rapports de démonstration.
 * ==========================================================================*/

import { donneesBudgetDe, fichePosteDe, type DepenseBudget, type DonneesBudget, type FichePoste, type SourceBudget } from "@/domaine/assembler-budget";
import { PROFIL_PAR_POSTE, SEUIL_ENVELOPPE, type Enveloppe } from "@/domaine/budget";
import { formerNumero } from "@/domaine/reference";
import type { BusinessUnit, PosteDepense } from "@/domaine/types";
import { demandesAchat } from "./caisse-demo";
import { DATE_REFERENCE } from "./chauffeurs-demo";
import { fichePourImmatriculation } from "./fiche-demo";
import { FLOTTE } from "./parc-demo";
import { depensesForfaits } from "./parc-leger-demo";
import { PARAMETRES_DEFAUT } from "@/domaine/parametres";

export type { DepenseBudget, DonneesBudget, EngagementBudget, FichePoste, SuiviPoste } from "@/domaine/assembler-budget";
export { SEUIL_ENVELOPPE } from "@/domaine/budget";

const EXERCICE = DATE_REFERENCE.slice(0, 4);
const DEBUT_EXERCICE = `${EXERCICE}-01-01`;

/** Les forfaits carburant du parc léger, en dépenses mensuelles — cadrage du 7 septembre 2026. */
const forfaits = () => depensesForfaits(DATE_REFERENCE, PARAMETRES_DEFAUT.parcLeger.forfaitCarburantMensuel);

/* -- Les dépenses, à la forme du budget --------------------------------------------- */

let CACHE_DEPENSES: DepenseBudget[] | null = null;

/**
 * Toutes les dépenses des fiches, chacune sur la business unit de son
 * véhicule, et les forfaits carburant du parc léger — deux ans, la fenêtre
 * de base des enveloppes comprise.
 */
function depensesBudget(): DepenseBudget[] {
  if (CACHE_DEPENSES) return CACHE_DEPENSES;
  const liste: DepenseBudget[] = [];
  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation);
    if (!f) continue;
    const v = l.vehicule;
    for (const d of f.depenses) {
      liste.push({
        numero: d.numero,
        date: d.date,
        poste: d.poste,
        libelle: d.libelle,
        montant: d.montant,
        beneficiaire: d.beneficiaire,
        origine: d.origine,
        justificatif: d.justificatif,
        businessUnit: v.businessUnit,
        immatriculation: v.immatriculation,
        immatriculationAffichee: v.immatriculationAffichee,
        vehicule: `${v.marque} ${v.appellation}`,
      });
    }
  }
  /* Le parc léger : les forfaits carburant, sur la BU de l'agent. */
  for (const d of forfaits()) {
    liste.push({ numero: d.numero, date: d.date, poste: d.poste, libelle: d.libelle, montant: d.montant, beneficiaire: d.beneficiaire, origine: d.origine, justificatif: d.justificatif, businessUnit: d.businessUnit, immatriculation: d.immatriculation, immatriculationAffichee: d.immatriculationAffichee, vehicule: d.vehicule });
  }
  CACHE_DEPENSES = liste;
  return liste;
}

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
  for (const d of depensesBudget()) {
    if (d.date < depuis || d.date > jusqua) continue;
    const k = cle(d.poste, d.businessUnit);
    parCle.set(k, (parCle.get(k) ?? 0) + d.montant);
  }
  return parCle;
}

/** Les douze mois qui précèdent l'exercice — la base des enveloppes. */
const DEBUT_BASE = (() => {
  const d = new Date(`${DEBUT_EXERCICE}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
})();

/** Combien de mois d'une fenêtre portent réellement des dépenses. */
function moisAvecDepenses(depuis: string, jusqua: string): number {
  const mois = new Set<string>();
  for (const d of depensesBudget()) if (d.date >= depuis && d.date <= jusqua) mois.add(d.date.slice(0, 7));
  return mois.size;
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
      profil: PROFIL_PAR_POSTE[poste] ?? null,
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
  const enCours = realise(DEBUT_EXERCICE, DATE_REFERENCE);
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
      profil: PROFIL_PAR_POSTE[poste] ?? null,
      base: `réalisé de l'exercice en cours, annualisé sur ${moisEnCours} mois — l'historique ne remonte pas avant l'ouverture de ce poste`,
      commentaire: null,
    });
  }
  lignes.push(...manquantes);

  CACHE_ENVELOPPES = lignes;
  return lignes;
}

/* -- La source de la démonstration --------------------------------------------------- */

let CACHE_SOURCE: SourceBudget | null = null;

/**
 * Ce que le budget assemble, tel que la démonstration le tient : les
 * enveloppes dérivées, les dépenses des fiches et les forfaits, les demandes
 * d'achat — chacune sur la business unit de son véhicule quand elle n'en
 * porte pas.
 */
export function sourceBudgetDemo(): SourceBudget {
  if (CACHE_SOURCE) return CACHE_SOURCE;
  const buParVehicule = new Map(FLOTTE.map((l) => [l.vehicule.id, l.vehicule.businessUnit]));
  CACHE_SOURCE = {
    exercice: EXERCICE,
    aujourdhui: DATE_REFERENCE,
    enveloppes: enveloppes(),
    depenses: depensesBudget(),
    demandes: demandesAchat().map((d) => (d.businessUnit || !d.vehiculeId ? d : { ...d, businessUnit: buParVehicule.get(d.vehiculeId) ?? null })),
  };
  return CACHE_SOURCE;
}

/* -- Ce que les rapports de démonstration appellent encore ----------------------------- */

let CACHE_BUDGET: DonneesBudget | null = null;

export function donneesBudget(): DonneesBudget {
  if (!CACHE_BUDGET) CACHE_BUDGET = donneesBudgetDe(sourceBudgetDemo());
  return CACHE_BUDGET;
}

export function fichePoste(cleUrl: string): FichePoste | null {
  return fichePosteDe(sourceBudgetDemo(), cleUrl, donneesBudget());
}

/** Les postes adressables. */
export function postesBudgetaires(): string[] {
  return donneesBudget().postes.map((p) => p.poste);
}

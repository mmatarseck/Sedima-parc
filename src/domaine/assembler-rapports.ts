/* ============================================================================
 * Les lignes de chaque rapport standard, assemblées depuis une source de faits.
 *
 * Une seule règle : **un rapport ne calcule rien de neuf**. Il lit ce que les
 * modules calculent déjà — le bilan de coûts, la consommation, les ordres de
 * travail, le classement SQDCM — et le met en table. Un chiffre lu dans un
 * rapport doit être le même que celui de l'écran qui le porte, sinon le
 * rapport devient une deuxième vérité et personne ne sait laquelle croire.
 *
 * **La période est dans l'adresse**, et elle seule est appliquée ici : les
 * autres filtres sont des facettes posées sur les colonnes, dans l'écran. Un
 * rapport se partage donc par son lien, et le calcul reste juste — filtrer une
 * catégorie ne doit pas déplacer la médiane à laquelle on la compare.
 *
 * Chaque ligne porte **toutes** les colonnes déclarées au catalogue, y compris
 * celles qui ne s'affichent pas d'emblée : c'est le choix des colonnes qui
 * décide de ce qu'on regarde, pas le constructeur.
 *
 * La source vient de la démonstration ou de la base — mêmes formes, mêmes
 * lignes (`SourceRapports`, plus bas).
 * ==========================================================================*/

import { bilanVehicule, qualifier, VERDICT_COUT, type BilanVehicule, type Perimetre } from "@/domaine/couts";
import { conducteurDuJour, etatDisponibilite, ETAT_DISPONIBILITE } from "@/domaine/disponibilite";
import { ETAPE_ACHAT, SENS_CAISSE, TON_ETAPE_ACHAT, URGENCE_ACHAT, coutDe } from "@/domaine/caisse";
import { LIBELLE_ETAT_PLEIN, SENS_CUVE, etatPlein } from "@/domaine/carburant";
import { NATURE_TRAVAIL, STATUT_ORDRE, TON_URGENCE_TRAVAIL, URGENCE_TRAVAIL } from "@/domaine/maintenance";
import { STATUT_CHAUFFEUR, nonConforme } from "@/domaine/chauffeur";
import { ROULANT, TON_STATUT_DECLARATION } from "@/domaine/incidents";
import { BAREME_PRIME, classer } from "@/domaine/performance";
import { TYPE_PRESTATAIRE } from "@/domaine/prestataires";
import {
  CONVENTION_FACTURATION,
  FAMILLE_MAD,
  UNITE_PRESTATION,
  coutMiseADisposition,
  joursDus,
  joursPayesNonRoules,
  montantsPrestation,
  ramenerCoutMad,
  MOTIF_AFFRETEMENT,
  MOTIF_SUBI,
  SOURCE_TARIF,
  STATUT_AFFRETEMENT,
  TON_STATUT_AFFRETEMENT,
  UNITE_TARIF,
  coutAffretement,
  ecartFacturation,
  montantAttendu,
  montantsDe,
  prestationFaite,
  tarifApplicable,
} from "@/domaine/transporteurs";
import { dansLaPeriode, moisCouverts, resoudrePeriode, type Periode } from "@/domaine/periodes";
import { definitionDocument, PARAMETRES_DEFAUT, type Parametres } from "@/domaine/parametres";
import {
  APTITUDE,
  BUSINESS_UNIT,
  CATEGORIE_FLOTTE,
  CATEGORIE_VEHICULE,
  CONTRAT_CHAUFFEUR,
  ENERGIE,
  GROUPE_CHARGE,
  MISSION_INCIDENT,
  MOTIF_INDISPONIBILITE,
  NATURE_INCIDENT,
  POSTE_DEPENSE,
  RESPONSABILITE,
  ROLE_AFFECTATION,
  STATUT_DECLARATION,
  STATUT_VEHICULE,
  TYPE_DOCUMENT,
  TYPE_INCIDENT,
  TYPE_SANCTION,
  TYPE_VISITE,
  STATUT_VISITE,
  USAGE_VEHICULE,
  groupeDuPoste,
  type Ton,
} from "@/domaine/libelles";
import type { LigneRapport, ValeurEtat } from "@/domaine/rapports";
import type { ObservationVisite, PosteDepense, StatutVehicule, Vehicule, VisiteTechnique, LigneFlotte } from "@/domaine/types";
import { donneesBudgetDe, fichePosteDe, type DonneesBudget, type SourceBudget } from "@/domaine/assembler-budget";
import { ancienneteMois, comptePrestataireDe, resumesDe, type SourcePrestataires } from "@/domaine/assembler-prestataires";
import { profilParDefaut, type SourceTransporteurs } from "@/domaine/assembler-transporteurs";
import { statistiquesParPrestataire, type LigneAchat, type LigneMouvement } from "@/domaine/caisse";
import { moisDePeriode, type DonneesVehicule } from "@/domaine/couts";
import type { LigneCuve, LignePlein } from "@/domaine/carburant";
import type { FicheChauffeur, LigneChauffeur } from "@/domaine/chauffeur";
import type { Echeance } from "@/domaine/conformite";
import type { AffectationFiche, IdentiteFiche, IndicateursFiche } from "@/domaine/fiche";
import type { ImmobilisationAdministrative } from "@/domaine/documents";
import type { LigneIncident } from "@/domaine/incidents";
import type { LigneInterventionFlotte, LigneOrdre, LigneTravail } from "@/domaine/maintenance";
import { MODE_EXECUTION, PRODUIT_TRANSPORTE, ecartPesee, type LigneReleve } from "@/domaine/releve-transport";
import { MODE_REMUNERATION } from "@/domaine/flotte-tierce";
import { ETAT_BUDGET } from "@/domaine/budget";
import { NIVEAU_PRESTATAIRE, ageDette, avanceOuverte } from "@/domaine/compte-prestataire";
import { ETAT_LEGER, REGIME_USAGE, depensesForfaitsDe, echeancierPlanCar, type SourceParcLeger } from "@/domaine/parc-leger";
import { libelleMois } from "@/donnees/fiche-demo";


/* -- Ce qu'il faut savoir pour dresser un rapport ------------------------------ */

/**
 * Tout ce que les rapports lisent, déjà à la forme des écrans qui le portent :
 * un rapport ne calcule rien de neuf, il met en table. La démonstration
 * donne le jeu du navigateur (`rapports-demo.ts`), la base ce que chaque
 * lecteur rend (`donnees/rapports.ts`) — les mêmes formes des deux côtés.
 *
 * Le parc léger vient du dossier de démonstration ou des tables 0004 (`parcLeger`).
 */
/**
 * Ce que la fiche d'un véhicule apporte aux rapports de la flotte : son
 * identité, ses indicateurs de douze mois, son immobilisation administrative,
 * sa prochaine échéance. La démonstration les lit sur la fiche ; la base les
 * dérive des lecteurs déjà lus (`resumesFicheDepuisLaSource`).
 */
export interface ResumeFiche {
  identite: IdentiteFiche;
  indicateurs: Pick<IndicateursFiche, "coutDouzeMois" | "coutParKm" | "consommationL100" | "disponibilitePct">;
  immobilisation: ImmobilisationAdministrative | null;
  /** « Visite technique · 12 sept. », « Vidange · ≈ 357 000 km ». */
  prochaineEcheance: string | null;
  /** Documents manquants, échus ou bientôt échus. */
  documentsATraiter: number;
}

export interface SourceRapports {
  aujourdhui: string;
  lignes: LigneFlotte[];
  /** Ce que la fiche de chaque véhicule apporte, par identifiant de véhicule. */
  resumesFiche: Map<string, ResumeFiche>;
  /** Les affectations de chaque véhicule, par identifiant de véhicule. */
  affectations: Map<string, AffectationFiche[]>;
  /** L'échéancier de la Conformité : documents des véhicules et des chauffeurs, entretiens, visites. */
  echeances: Echeance[];
  visites: VisiteTechnique[];
  observations: ObservationVisite[];
  couts: DonneesVehicule[];
  pleins: LignePlein[];
  cuve: LigneCuve[];
  interventions: LigneInterventionFlotte[];
  ordres: LigneOrdre[];
  travaux: LigneTravail[];
  incidents: LigneIncident[];
  chauffeurs: LigneChauffeur[];
  fichesChauffeurs: FicheChauffeur[];
  achats: LigneAchat[];
  journal: LigneMouvement[];
  prestataires: SourcePrestataires;
  transporteurs: SourceTransporteurs;
  /** Tout le relevé de transport, parc et tiers confondus. */
  releves: LigneReleve[];
  budget: SourceBudget;
  /** Le parc léger : ses véhicules, ses attributaires, ses forfaits — le dossier en démonstration, les tables en base. */
  parcLeger: SourceParcLeger;
}

/** Le budget assemblé une fois par source — trois rapports le lisent. */
const BUDGETS = new WeakMap<SourceBudget, DonneesBudget>();
function budgetDe(s: SourceRapports): DonneesBudget {
  let d = BUDGETS.get(s.budget);
  if (!d) {
    d = donneesBudgetDe(s.budget);
    BUDGETS.set(s.budget, d);
  }
  return d;
}

/* -- Le contexte d'un rapport -------------------------------------------------- */

export interface ContexteRapport {
  periode: Periode;
  perimetre: Perimetre;
}

export const CONTEXTE_PAR_DEFAUT: ContexteRapport = { periode: { preset: "12-mois", debut: null, fin: null }, perimetre: "exploitation" };

/* -- Outils ------------------------------------------------------------------- */

const etat = (libelle: string, ton: Ton, rang?: number): ValeurEtat => ({ libelle, ton, rang });

function joursEntre(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return Math.round((new Date(b.slice(0, 10)).getTime() - new Date(a.slice(0, 10)).getTime()) / (24 * 3600 * 1000));
}

function arrondir(x: number | null | undefined, decimales = 1): number | null {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  const f = 10 ** decimales;
  return Math.round(x * f) / f;
}

const tonStatut = (statut: StatutVehicule): Ton => (STATUT_VEHICULE[statut].operationnel ? "favorable" : "defavorable");

/** Les véhicules de transport — les rapports de la flotte ne comptent pas le parc léger, qui a les siens. */
function parcTransport(s: SourceRapports): LigneFlotte[] {
  return s.lignes.filter((l) => !l.vehicule.regime || l.vehicule.regime === "exploitation");
}

/** Ce qu'un véhicule apporte à toute ligne qui le cite — les colonnes communes. */
function situation(s: SourceRapports, vehiculeId: string): LigneRapport {
  const l = s.lignes.find((x) => x.vehicule.id === vehiculeId);
  if (!l) return {};
  const v = l.vehicule;
  return {
    immatriculationCanonique: v.immatriculation,
    immatriculation: v.immatriculationAffichee,
    vehicule: `${v.marque} ${v.appellation}`,
    marque: v.marque,
    categorie: CATEGORIE_VEHICULE[v.categorie],
    categorieFlotte: CATEGORIE_FLOTTE[v.categorieFlotte],
    usage: USAGE_VEHICULE[v.usage],
    energie: v.energie ? ENERGIE[v.energie] : null,
    businessUnit: v.businessUnit ? BUSINESS_UNIT[v.businessUnit] : null,
    site: l.site?.libelle ?? null,
  };
}

/* -- Flotte ------------------------------------------------------------------- */

/* -- Ce que la fiche d'un véhicule apporte, relu sur la source -------------------- */

/** L'immobilisation administrative d'un véhicule, telle que la ligne de flotte la porte : le statut effectif et les pièces en cause. */
function immobilisationDe(l: LigneFlotte): { statut: StatutVehicule; motif: string } | null {
  const pieces = (l.immobilisationAdministrative ?? []).filter((d) => d.etat === "echu" || d.etat === "manquant");
  if (pieces.length === 0 || !l.statutEffectif || l.statutEffectif === l.vehicule.statut) return null;
  return { statut: l.statutEffectif, motif: pieces.map((d) => `${TYPE_DOCUMENT[d.type]} ${d.etat === "manquant" ? "manquante" : "échue"}`).join(", ") };
}

/** La valeur nette comptable et la fin d'amortissement, comme la fiche les calcule. */
function amortissementDe(v: Vehicule, aujourdhui: string): { valeurNetteComptable: number | null; finAmortissement: string | null } {
  const mec = v.premiereMiseEnCirculation;
  const duree = v.dureeAmortissementAnnees;
  const ageAnnees = mec ? (Date.parse(`${aujourdhui}T00:00:00Z`) - Date.parse(`${mec}T00:00:00Z`)) / (365.25 * 86_400_000) : null;
  return {
    valeurNetteComptable: v.valeurAcquisition !== null && duree && ageAnnees !== null ? Math.max(0, Math.round(v.valeurAcquisition * (1 - Math.min(1, ageAnnees / duree)))) : v.valeurAcquisition,
    finAmortissement: mec && duree ? `${Number(mec.slice(0, 4)) + duree}${mec.slice(4)}` : null,
  };
}

/** Les échéances d'un véhicule, les plus proches d'abord ; les pièces manquantes n'ont pas d'échéance, elles ont un retard. */
function echeancesDuVehicule(s: SourceRapports, v: Vehicule): Echeance[] {
  return s.echeances.filter((e) => e.sujet === "vehicule" && (e.sujetId === v.id || e.sujetId === v.immatriculation)).sort((a, b) => (a.joursRestants ?? 1e9) - (b.joursRestants ?? 1e9));
}

const DOCUMENT_A_TRAITER = new Set<Echeance["niveau"]>(["manquant", "echu", "j7", "j30", "j60"]);

/** Un document d'échéancier, hors entretien et visite. */
function estDocument(e: Echeance): boolean {
  return e.type !== "entretien" && e.type !== "contre-visite" && e.type !== "rendez-vous";
}

/** Les indicateurs de douze mois d'un véhicule, comme la fiche les calcule : coût au kilomètre, consommation, disponibilité. */
function indicateursDe(couts: DonneesVehicule[], vehiculeId: string, aujourdhui: string): { coutParKm: number | null; consommationL100: number | null; disponibilitePct: number | null } | null {
  const d = couts.find((x) => x.vehiculeId === vehiculeId);
  if (!d) return null;
  const b = bilanVehicule(d, moisDePeriode(aujourdhui, 12), "complet");
  return { coutParKm: b.coutParKm, consommationL100: b.litresAux100, disponibilitePct: b.immobilisationJours === null ? null : Math.max(0, Math.min(100, Math.round((1 - b.immobilisationJours / 365) * 100))) };
}

/**
 * Ce que la fiche apporte, dérivé de ce que la base a déjà rendu : l'identité
 * depuis le véhicule (amortissement calculé comme sur la fiche), les
 * indicateurs depuis les coûts, l'immobilisation depuis la ligne de flotte,
 * l'échéance et les documents à traiter depuis l'échéancier.
 */
export function resumesFicheDepuisLaSource(s: Omit<SourceRapports, "resumesFiche">): Map<string, ResumeFiche> {
  const resultat = new Map<string, ResumeFiche>();
  for (const l of s.lignes) {
    const v = l.vehicule;
    const immobilisation = immobilisationDe(l);
    const echeances = echeancesDuVehicule({ ...s, resumesFiche: resultat }, v);
    const echeance = echeances.find((e) => e.echeance !== null || e.repere !== null) ?? null;
    const indicateurs = indicateursDe(s.couts, v.id, s.aujourdhui);
    resultat.set(v.id, {
      identite: {
        typeModele: v.typeModele,
        premiereMiseEnCirculation: v.premiereMiseEnCirculation,
        dateImmatriculation: v.dateImmatriculation,
        region: l.site?.region ?? "Dakar",
        puissanceCv: v.puissanceCv,
        cylindree: v.cylindree,
        ptac: v.ptac,
        ptra: v.ptra,
        poidsVide: v.poidsVide,
        chargeUtile: v.chargeUtile,
        energie: v.energie,
        capaciteReservoir: v.capaciteReservoir,
        utilisation: USAGE_VEHICULE[v.usage] ?? "—",
        regimePropriete: v.categorieFlotte === "interne" ? "Propriété SEDIMA" : v.categorieFlotte === "adex" ? "Mise à disposition ADEX" : "Location",
        entite: v.businessUnit ? BUSINESS_UNIT[v.businessUnit] : "SEDIMA SA",
        valeurAcquisition: v.valeurAcquisition,
        dureeAmortissementAnnees: v.dureeAmortissementAnnees,
        ...amortissementDe(v, s.aujourdhui),
        gpsActif: false,
      },
      indicateurs: { coutDouzeMois: l.coutDouzeMois, coutParKm: indicateurs?.coutParKm ?? null, consommationL100: indicateurs?.consommationL100 ?? null, disponibilitePct: indicateurs?.disponibilitePct ?? null },
      immobilisation: immobilisation ? { statut: immobilisation.statut, motif: "administratif", documents: (l.immobilisationAdministrative ?? []).filter((d) => d.etat === "echu" || d.etat === "manquant") } : null,
      prochaineEcheance: echeance ? `${echeance.libelle} · ${echeance.repere ?? echeance.echeance}` : null,
      documentsATraiter: echeances.filter((e) => estDocument(e) && DOCUMENT_A_TRAITER.has(e.niveau)).length,
    });
  }
  return resultat;
}

function detailsVehicules(s: SourceRapports): LigneRapport[] {
  return parcTransport(s).map((l) => {
    const v = l.vehicule;
    const r = s.resumesFiche.get(v.id) ?? null;
    const identite = r?.identite ?? null;
    const immobilisation = r?.immobilisation ?? null;
    const statutEffectif = immobilisation?.statut ?? v.statut;
    const mec = identite?.premiereMiseEnCirculation ?? v.premiereMiseEnCirculation;
    return {
      ...situation(s, v.id),
      appellation: v.appellation,
      typeModele: identite?.typeModele ?? v.typeModele,
      vin: v.vin,
      statut: etat(STATUT_VEHICULE[statutEffectif].libelle, tonStatut(statutEffectif)),
      statutSaisi: etat(STATUT_VEHICULE[v.statut].libelle, tonStatut(v.statut)),
      immobilisationMotif: immobilisation ? immobilisation.documents.map((d) => `${TYPE_DOCUMENT[d.type]} ${d.etat === "manquant" ? "manquante" : "échue"}`).join(", ") : null,
      transportSpecial: v.transportSpecial,
      engage: v.engage,
      chauffeur: l.chauffeurTitulaire?.nom ?? null,
      suppleants: l.nombreSuppleants,
      kilometrage: l.kilometrage,
      dateKilometrage: l.dateKilometrage,
      miseEnCirculation: mec,
      dateImmatriculation: identite?.dateImmatriculation ?? v.dateImmatriculation,
      age: mec ? arrondir((joursEntre(mec, s.aujourdhui) ?? 0) / 365.25) : null,
      chargeUtile: identite?.chargeUtile ?? v.chargeUtile,
      ptac: identite?.ptac ?? v.ptac,
      ptra: identite?.ptra ?? v.ptra,
      poidsVide: identite?.poidsVide ?? v.poidsVide,
      puissanceCv: identite?.puissanceCv ?? v.puissanceCv,
      cylindree: identite?.cylindree ?? v.cylindree,
      capaciteReservoir: identite?.capaciteReservoir ?? v.capaciteReservoir,
      valeurAcquisition: identite?.valeurAcquisition ?? v.valeurAcquisition,
      valeurNetteComptable: identite?.valeurNetteComptable ?? null,
      dureeAmortissement: identite?.dureeAmortissementAnnees ?? v.dureeAmortissementAnnees,
      finAmortissement: identite?.finAmortissement ?? null,
      coutDouzeMois: r?.indicateurs.coutDouzeMois ?? l.coutDouzeMois,
      coutParKm: r?.indicateurs.coutParKm ?? null,
      consommationL100: arrondir(r?.indicateurs.consommationL100),
      disponibilite: r?.indicateurs.disponibilitePct ?? null,
      prochaineEcheance: r?.prochaineEcheance ?? null,
      documentsATraiter: r?.documentsATraiter ?? 0,
      attelage: l.attelageCourant ? `${l.attelageCourant.role === "tracteur" ? "tire" : "tirée par"} ${l.attelageCourant.immatriculationAffichee}` : null,
      region: identite?.region ?? l.site?.region ?? null,
      commentaire: v.commentaire,
    };
  });
}

function affectations(s: SourceRapports): LigneRapport[] {
  const chauffeurs = new Map(s.chauffeurs.map((c) => [c.id, c]));
  return parcTransport(s).map((l) => {
    const v = l.vehicule;
    const statutEffectif = s.resumesFiche.get(v.id)?.immobilisation?.statut ?? v.statut;
    const enCours = (s.affectations.get(v.id) ?? []).filter((a) => a.fin === null && a.chauffeurId);
    const titulaire = enCours.find((a) => a.role === "titulaire") ?? null;
    const suppleants = enCours.filter((a) => a.role === "suppleant");
    const c = titulaire?.chauffeurId ? (chauffeurs.get(titulaire.chauffeurId) ?? null) : null;
    return {
      ...situation(s, v.id),
      statut: etat(STATUT_VEHICULE[statutEffectif].libelle, tonStatut(statutEffectif)),
      couverture: titulaire
        ? suppleants.length
          ? etat("Titulaire et suppléant", "favorable", 0)
          : etat("Titulaire seul", "neutre", 1)
        : suppleants.length
          ? etat("Suppléant seul", "vigilance", 2)
          : etat("Sans conducteur", "defavorable", 3),
      titulaire: titulaire?.chauffeur ?? null,
      depuis: titulaire?.debut ?? null,
      anciennete: joursEntre(titulaire?.debut ?? null, s.aujourdhui),
      statutTitulaire: c ? etat(STATUT_CHAUFFEUR[c.statut].libelle, c.statut === "en-poste" ? "favorable" : c.statut === "indisponible" ? "vigilance" : "neutre") : null,
      aptitudeTitulaire: c ? etat(APTITUDE[c.chauffeur.aptitude].libelle, APTITUDE[c.chauffeur.aptitude].ton) : null,
      suppleant: suppleants.map((a) => a.chauffeur).filter(Boolean).join(", ") || null,
      nombreSuppleants: suppleants.length,
      kmTitulaire: titulaire?.kmParcourus ?? null,
      motif: titulaire?.motif ?? null,
      telephone: c?.chauffeur.telephone ?? null,
    };
  });
}

function disponibilite(s: SourceRapports): LigneRapport[] {
  const chauffeurs = new Map(s.chauffeurs.map((c) => [c.id, c]));
  return parcTransport(s).map((l) => {
    const v = l.vehicule;
    /* La même règle que la fiche et que l'écran Disponibilité : les documents
       critiques en cause décident du statut effectif. */
    const r = s.resumesFiche.get(v.id) ?? null;
    const immobilisation = r?.immobilisation ?? null;
    const statutEffectif = immobilisation?.statut ?? v.statut;
    const conducteur = conducteurDuJour(s.affectations.get(v.id) ?? [], chauffeurs, s.aujourdhui);
    const { etat: e, motif } = etatDisponibilite({ engage: v.engage, statutEffectif, conducteur, immobilisation });
    return {
      ...situation(s, v.id),
      etat: etat(
        ETAT_DISPONIBILITE[e].libelle,
        e === "pret" ? "favorable" : e === "immobilise" ? "defavorable" : e === "hors-perimetre" ? "neutre" : "vigilance",
        e === "pret" ? 0 : e === "hors-perimetre" ? 3 : e === "immobilise" ? 2 : 1,
      ),
      statut: etat(STATUT_VEHICULE[statutEffectif].libelle, tonStatut(statutEffectif)),
      statutSaisi: etat(STATUT_VEHICULE[v.statut].libelle, tonStatut(v.statut)),
      conducteur: conducteur?.nom ?? null,
      roleConducteur: conducteur ? ROLE_AFFECTATION[conducteur.role] : null,
      motif,
      immobilisationMotif: immobilisation ? immobilisation.documents.map((d) => `${TYPE_DOCUMENT[d.type]} ${d.etat === "manquant" ? "manquante" : "échue"}`).join(", ") : null,
      engage: v.engage,
      transportSpecial: v.transportSpecial,
      chargeUtile: r?.identite.chargeUtile ?? v.chargeUtile,
      kilometrage: l.kilometrage,
    };
  });
}

function sansIntervention(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  const mois = new Set(moisCouverts(debut, fin));
  const interventions = s.interventions;
  const lignes: LigneRapport[] = [];
  for (const l of parcTransport(s)) {
    const v = l.vehicule;
    if (interventions.some((i) => i.vehiculeId === v.id && dansLaPeriode(i.date, debut, fin))) continue;
    const statutEffectif = s.resumesFiche.get(v.id)?.immobilisation?.statut ?? v.statut;
    const derniere = interventions.filter((i) => i.vehiculeId === v.id).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
    const donnees = s.couts.find((d) => d.vehiculeId === v.id) ?? null;
    const dernierPlein = s.pleins.filter((p) => p.vehiculeId === v.id).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
    const prochain = l.prochaineEcheanceEntretien;
    lignes.push({
      ...situation(s, v.id),
      statut: etat(STATUT_VEHICULE[statutEffectif].libelle, tonStatut(statutEffectif)),
      derniereIntervention: derniere?.date ?? null,
      joursDepuis: derniere ? joursEntre(derniere.date, s.aujourdhui) : null,
      objetDerniere: derniere?.objet ?? null,
      garageDernier: derniere?.garage ?? null,
      kmPeriode: donnees ? donnees.mois.filter((m) => mois.has(m.mois)).reduce((t, m) => t + m.km, 0) : null,
      kilometrage: l.kilometrage,
      dernierPlein: dernierPlein?.date ?? null,
      prochainEntretien: prochain ? `${prochain.libelle}${prochain.kmRestants !== null ? ` — dans ${prochain.kmRestants} km` : ""}` : null,
    });
  }
  return lignes;
}

/* -- Coûts -------------------------------------------------------------------- */

/** Les bilans de la période, qualifiés sur toute la flotte — la même lecture que Coûts. */
function bilans(s: SourceRapports, c: ContexteRapport): BilanVehicule[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  return qualifier(s.couts.map((d) => bilanVehicule(d, moisCouverts(debut, fin), c.perimetre)));
}

function coutsParVehicule(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  return bilans(s, c).map((b) => {
    const d = b.donnees;
    return {
      ...situation(s, d.vehiculeId),
      statut: etat(STATUT_VEHICULE[d.statut].libelle, tonStatut(d.statut)),
      km: b.km,
      carburant: b.parGroupe.carburant,
      maintenance: b.parGroupe.maintenance,
      autres: b.parGroupe.autres,
      total: b.total,
      coutParKm: b.coutParKm,
      coutKmCarburant: b.km > 0 ? Math.round(b.parGroupe.carburant / b.km) : null,
      coutKmMaintenance: b.km > 0 ? Math.round(b.parGroupe.maintenance / b.km) : null,
      ecartCategorie: arrondir(b.ecartCategoriePct),
      verdict: etat(VERDICT_COUT[b.verdict].libelle, VERDICT_COUT[b.verdict].ton, b.ecartCategoriePct ?? 0),
      tendance: arrondir(b.tendancePct),
      litres: Math.round(b.litres),
      l100: arrondir(b.litresAux100),
      referenceL100: d.referenceL100,
      ecartL100: arrondir(b.ecartL100Pct),
      curatifs: b.curatifs,
      immobilisation: b.immobilisationJours,
      age: arrondir(d.ageAnnees),
      valeurAcquisition: s.lignes.find((x) => x.vehicule.id === d.vehiculeId)?.vehicule.valeurAcquisition ?? null,
    };
  });
}

function coutsParPoste(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  const mois = moisCouverts(debut, fin);
  const retenus = new Set(mois);
  const liste = bilans(s, c);
  const parPoste = new Map<PosteDepense, number>();
  const vehicules = new Map<PosteDepense, Set<string>>();
  const parMois = new Map<PosteDepense, Map<string, number>>();
  for (const b of liste) {
    for (const [poste, montant] of Object.entries(b.parPoste) as [PosteDepense, number][]) {
      parPoste.set(poste, (parPoste.get(poste) ?? 0) + montant);
      const vus = vehicules.get(poste) ?? new Set<string>();
      vus.add(b.donnees.vehiculeId);
      vehicules.set(poste, vus);
    }
  }
  for (const b of liste) {
    for (const m of b.donnees.mois) {
      if (!retenus.has(m.mois)) continue;
      for (const [poste, montant] of Object.entries(m.parPoste) as [PosteDepense, number][]) {
        if (!parPoste.has(poste)) continue;
        const serie = parMois.get(poste) ?? new Map<string, number>();
        serie.set(m.mois, (serie.get(m.mois) ?? 0) + montant);
        parMois.set(poste, serie);
      }
    }
  }
  const total = [...parPoste.values()].reduce((t, x) => t + x, 0);
  /*
   * **Le dernier mois révolu, jamais le mois en cours.** Au 2 septembre, le
   * mois courant porte deux jours de dépenses : le comparer à une moyenne de
   * douze mois annonçait « −100 % » sur le carburant, ce qui se lit comme un
   * effondrement alors que le mois vient de commencer. On prend donc le dernier
   * mois complet de la fenêtre, et la colonne dit lequel.
   */
  const moisCourant = s.aujourdhui.slice(0, 7);
  const revolus = mois.filter((m) => m < moisCourant);
  const dernierMois = (revolus.length > 0 ? revolus[revolus.length - 1] : mois[mois.length - 1])!;
  return [...parPoste.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([poste, montant]) => {
      const serie = parMois.get(poste) ?? new Map<string, number>();
      const moyenne = montant / Math.max(1, mois.length);
      const duDernier = serie.get(dernierMois) ?? 0;
      const fort = [...serie.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
      const nbVehicules = vehicules.get(poste)?.size ?? 0;
      return {
        poste: POSTE_DEPENSE[poste],
        groupe: GROUPE_CHARGE[groupeDuPoste(poste)],
        total: montant,
        part: total > 0 ? arrondir((montant / total) * 100) : null,
        moyenneMois: Math.round(moyenne),
        dernierMois: duDernier,
        quandDernier: libelleMois(dernierMois),
        evolution: moyenne > 0 ? arrondir(((duDernier - moyenne) / moyenne) * 100) : null,
        moisLePlusFort: fort ? fort[1] : null,
        quandLePlusFort: fort ? libelleMois(fort[0]) : null,
        vehicules: nbVehicules,
        parVehicule: nbVehicules > 0 ? Math.round(montant / nbVehicules) : null,
      };
    });
}

function coutsParBusinessUnit(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const liste = bilans(s, c);
  const total = liste.reduce((t, b) => t + b.total, 0);
  const parBu = new Map<string, BilanVehicule[]>();
  for (const b of liste) {
    const cle = b.donnees.businessUnit ? BUSINESS_UNIT[b.donnees.businessUnit] : "Non rattaché";
    parBu.set(cle, [...(parBu.get(cle) ?? []), b]);
  }
  return [...parBu.entries()]
    .map(([businessUnit, bs]) => {
      const km = bs.reduce((t, b) => t + b.km, 0);
      const litres = bs.reduce((t, b) => t + b.litres, 0);
      const somme = bs.reduce((t, b) => t + b.total, 0);
      return {
        businessUnit,
        vehicules: bs.length,
        km,
        carburant: bs.reduce((t, b) => t + b.parGroupe.carburant, 0),
        maintenance: bs.reduce((t, b) => t + b.parGroupe.maintenance, 0),
        autres: bs.reduce((t, b) => t + b.parGroupe.autres, 0),
        total: somme,
        part: total > 0 ? arrondir((somme / total) * 100) : null,
        coutParKm: km > 0 ? Math.round(somme / km) : null,
        litres: Math.round(litres),
        l100: km > 0 ? arrondir((litres / km) * 100) : null,
        curatifs: bs.reduce((t, b) => t + b.curatifs, 0),
        immobilisation: bs.some((b) => b.immobilisationJours === null) ? null : bs.reduce((t, b) => t + (b.immobilisationJours ?? 0), 0),
        parVehicule: bs.length > 0 ? Math.round(somme / bs.length) : null,
      };
    })
    .sort((a, b) => (b.total as number) - (a.total as number));
}

function coutsParCategorie(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const liste = bilans(s, c);
  const parCategorie = new Map<string, BilanVehicule[]>();
  for (const b of liste) {
    const cle = CATEGORIE_VEHICULE[b.donnees.categorie];
    parCategorie.set(cle, [...(parCategorie.get(cle) ?? []), b]);
  }
  return [...parCategorie.entries()]
    .map(([categorie, bs]) => {
      const avecCout = bs.filter((b) => b.coutParKm !== null).sort((a, b) => a.coutParKm! - b.coutParKm!);
      const median = avecCout.length ? avecCout[Math.floor(avecCout.length / 2)]!.coutParKm! : null;
      const km = bs.reduce((t, b) => t + b.km, 0);
      const litres = bs.reduce((t, b) => t + b.litres, 0);
      const plusCher = avecCout[avecCout.length - 1] ?? null;
      return {
        categorie,
        vehicules: bs.length,
        km,
        total: bs.reduce((t, b) => t + b.total, 0),
        coutParKmMedian: median,
        coutParKmMin: avecCout.length ? avecCout[0]!.coutParKm : null,
        coutParKmMax: plusCher?.coutParKm ?? null,
        vehiculeMax: plusCher ? `${plusCher.donnees.immatriculationAffichee} · ${plusCher.donnees.libelle}` : null,
        litres: Math.round(litres),
        l100: km > 0 ? arrondir((litres / km) * 100) : null,
        referenceL100: bs[0]?.donnees.referenceL100 ?? null,
        aArbitrer: median === null ? 0 : bs.filter((b) => b.coutParKm !== null && b.coutParKm > median).length,
        immobilisation: bs.some((b) => b.immobilisationJours === null) ? null : bs.reduce((t, b) => t + (b.immobilisationJours ?? 0), 0),
      };
    })
    .sort((a, b) => (b.total as number) - (a.total as number));
}

/* -- Carburant ---------------------------------------------------------------- */

function pleins(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  const tous = s.pleins;
  /* Les kilomètres parcourus depuis le plein précédent du même véhicule : c'est
     eux qui donnent la consommation réelle d'un plein à l'autre. Le calcul se
     fait sur toute la série, pas sur la période — sinon le premier plein
     affiché n'aurait jamais de précédent. */
  const dernier = new Map<string, number>();
  const ecarts = new Map<string, number | null>();
  for (const p of [...tous].sort((a, b) => a.date.localeCompare(b.date))) {
    const avant = dernier.get(p.vehiculeId);
    ecarts.set(p.numero, avant !== undefined && p.km !== null && p.km > avant ? p.km - avant : null);
    if (p.km !== null) dernier.set(p.vehiculeId, p.km);
  }
  return tous
    .filter((p) => dansLaPeriode(p.date, debut, fin))
    .map((p) => {
      const parcourus = ecarts.get(p.numero) ?? null;
      const e = etatPlein(p);
      return {
        ...situation(s, p.vehiculeId),
        date: p.date,
        provenance: etat(LIBELLE_ETAT_PLEIN[e], e === "cuve" ? "favorable" : e === "station" ? "neutre" : "vigilance"),
        source: p.source,
        litres: arrondir(p.litres),
        prixLitre: p.prixLitre,
        montant: p.montant,
        km: p.km,
        kmParcourus: parcourus,
        l100: parcourus && parcourus > 0 ? arrondir((p.litres / parcourus) * 100) : null,
        reference: p.reference,
        releve: p.kmMotifRejet ? `Écarté — ${p.kmMotifRejet}` : p.km === null ? "Non relevé" : "Retenu",
        numero: p.numero,
        creee: p.creee,
      };
    });
}

function consommation(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  const mois = moisCouverts(debut, fin);
  const parVehicule = new Map<string, { litres: number; montant: number; nombre: number }>();
  for (const p of s.pleins) {
    if (!dansLaPeriode(p.date, debut, fin)) continue;
    const x = parVehicule.get(p.vehiculeId) ?? { litres: 0, montant: 0, nombre: 0 };
    parVehicule.set(p.vehiculeId, { litres: x.litres + p.litres, montant: x.montant + p.montant, nombre: x.nombre + 1 });
  }
  return s.couts
    .map((d) => {
      const b = bilanVehicule(d, mois, c.perimetre);
      const ecart = b.ecartL100Pct;
      const p = parVehicule.get(d.vehiculeId) ?? { litres: 0, montant: 0, nombre: 0 };
      return {
        ...situation(s, d.vehiculeId),
        statut: etat(STATUT_VEHICULE[d.statut].libelle, tonStatut(d.statut)),
        km: b.km,
        litres: Math.round(b.litres),
        l100: arrondir(b.litresAux100),
        reference: d.referenceL100,
        ecart: arrondir(ecart),
        verdict:
          ecart === null
            ? etat("Sans mesure", "neutre", 0)
            : ecart >= 15
              ? etat("Dérive", "defavorable", 3)
              : ecart >= 8
                ? etat("À surveiller", "vigilance", 2)
                : etat("Dans la référence", "favorable", 1),
        cout: b.parGroupe.carburant,
        coutParKm: b.km > 0 ? Math.round(b.parGroupe.carburant / b.km) : null,
        prixMoyen: p.litres > 0 ? Math.round(p.montant / p.litres) : null,
        pleins: p.nombre,
        moyenneParPlein: p.nombre > 0 ? arrondir(p.litres / p.nombre) : null,
      };
    })
    .filter((l) => (l.km as number) !== 0 || (l.litres as number) !== 0);
}

function cuve(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  return s.cuve
    .filter((m) => dansLaPeriode(m.date, debut, fin))
    .map((m) => ({
      date: m.date,
      numero: m.numero,
      sens: etat(SENS_CUVE[m.sens], m.sens === "livraison" ? "favorable" : m.sens === "jauge" ? "neutre" : "vigilance"),
      libelle: m.libelle,
      entree: m.sens === "livraison" ? arrondir(m.litres) : null,
      sortie: m.sens === "sortie" ? arrondir(m.litres) : null,
      stock: Math.round(m.stockApres),
      ecart: arrondir(m.ecart),
      montant: m.montant,
      prixLitre: m.prixLitre,
      fournisseur: m.fournisseur,
      piece: m.piece,
      immatriculationCanonique: m.immatriculation,
      immatriculation: m.immatriculationAffichee,
      pleinNumero: m.pleinNumero,
      enregistrePar: m.enregistrePar,
    }));
}

/* -- Maintenance -------------------------------------------------------------- */

function interventions(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  return s.interventions
    .filter((i) => dansLaPeriode(i.date, debut, fin))
    .map((i) => ({
      ...situation(s, i.vehiculeId),
      date: i.date,
      type: i.type === "preventif" ? etat("Préventif", "favorable", 0) : etat("Curatif", "vigilance", 1),
      objet: i.objet,
      garage: i.garage,
      km: i.km,
      cout: i.montant,
      immobilisation: i.immobilisationJours,
      coutParJour: i.immobilisationJours !== null && i.immobilisationJours > 0 ? Math.round(i.montant / i.immobilisationJours) : null,
      reference: i.reference,
      numero: i.numero,
      creee: i.creee,
    }));
}

function ordres(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  const TON: Record<string, Ton> = { planifie: "neutre", "en-atelier": "vigilance", clos: "favorable", annule: "defavorable" };
  const RANG: Record<string, number> = { "en-atelier": 0, planifie: 1, clos: 2, annule: 3 };
  return s.ordres
    .filter((o) => dansLaPeriode(o.datePrevue, debut, fin))
    .map((o) => ({
      ...situation(s, o.vehiculeId),
      numero: o.numero,
      date: o.datePrevue,
      statut: etat(STATUT_ORDRE[o.statut], TON[o.statut] ?? "neutre", RANG[o.statut] ?? 9),
      type: o.type === "preventif" ? etat("Préventif", "favorable", 0) : etat("Curatif", "vigilance", 1),
      objet: o.objet,
      garage: o.garage,
      montant: o.montantEstime,
      immobilisationPrevue: o.immobilisationPrevueJours,
      dateDebut: o.dateDebut,
      dateCloture: o.dateCloture,
      delaiCloture: joursEntre(o.dateDebut, o.dateCloture),
      origineNumero: o.origineNumero,
      origineLibelle: o.origineLibelle,
      interventionNumero: o.interventionNumero,
      demandeur: o.demandeur,
      commentaire: o.commentaire,
    }));
}

function aFaire(s: SourceRapports): LigneRapport[] {
  return s.travaux.map((t) => ({
    ...situation(s, t.vehiculeId),
    origine: NATURE_TRAVAIL[t.nature],
    urgence: etat(URGENCE_TRAVAIL[t.urgence], TON_URGENCE_TRAVAIL[t.urgence], t.joursRestants ?? 9999),
    type: t.type === "preventif" ? etat("Préventif", "favorable", 0) : etat("Curatif", "vigilance", 1),
    libelle: t.objet,
    echeance: t.echeance,
    kmRestants: t.kmRestants,
    joursRestants: t.joursRestants,
    ordreNumero: t.ordreNumero,
    origineNumero: t.origineNumero,
  }));
}

/* -- Conformité --------------------------------------------------------------- */

/** L'état d'un document tel que le rapport le dit, depuis le niveau de l'échéancier. */
const ETAT_DOCUMENT: Record<Echeance["niveau"], { cle: string; libelle: string; ton: Ton; rang: number }> = {
  manquant: { cle: "manquant", libelle: "Manquant", ton: "defavorable", rang: 0 },
  echu: { cle: "echu", libelle: "Échu", ton: "defavorable", rang: 1 },
  j7: { cle: "bientot", libelle: "Bientôt échu", ton: "vigilance", rang: 2 },
  j30: { cle: "bientot", libelle: "Bientôt échu", ton: "vigilance", rang: 2 },
  j60: { cle: "bientot", libelle: "Bientôt échu", ton: "vigilance", rang: 2 },
  ok: { cle: "a-jour", libelle: "À jour", ton: "favorable", rang: 3 },
  permanent: { cle: "permanent", libelle: "Permanent", ton: "favorable", rang: 4 },
};

/**
 * Les documents du parc, lus sur l'échéancier de la Conformité — la même
 * source que l'écran : les véhicules **et** ceux qui les conduisent, un même
 * rapport, une même table.
 */
function documents(s: SourceRapports, parametres: Parametres): LigneRapport[] {
  const parVehicule = new Map(s.lignes.map((l) => [l.vehicule.id, l]));
  const parImmat = new Map(s.lignes.map((l) => [l.vehicule.immatriculation, l]));
  const parChauffeur = new Map(s.chauffeurs.map((c) => [c.id, c]));
  return s.echeances
    .filter(estDocument)
    .map((e) => {
      const def = definitionDocument(e.type, parametres);
      const l = e.sujet === "vehicule" ? (parVehicule.get(e.sujetId) ?? parImmat.get(e.sujetId) ?? null) : null;
      const chauffeur = e.sujet === "chauffeur" ? (parChauffeur.get(e.sujetId) ?? null) : null;
      const situe = l ? situation(s, l.vehicule.id) : {};
      const x = ETAT_DOCUMENT[e.niveau];
      return {
        porteur: e.sujetLibelle,
        typePorteur: e.sujet === "vehicule" ? "Véhicule" : "Chauffeur",
        document: e.libelle,
        etat: etat(x.libelle, x.ton, x.rang),
        echeance: e.echeance,
        joursRestants: e.joursRestants,
        /* L'échéancier ne porte ni la date d'effet ni le montant : la fiche du véhicule les a. */
        dateEffet: null,
        critique: e.sujet === "chauffeur" ? true : Boolean(def?.critique),
        emetteur: e.emetteur,
        numeroPiece: e.numeroPiece ?? (e.sujet === "chauffeur" && e.type === "permis" ? (chauffeur?.chauffeur.permisNumero ?? null) : null),
        montant: null,
        justificatif: e.niveau !== "manquant",
        categorie: situe.categorie ?? null,
        businessUnit: situe.businessUnit ?? null,
        site: e.site ?? situe.site ?? chauffeur?.site?.libelle ?? null,
        validite: def?.validiteMois ?? null,
      };
    });
}

/* -- Incidents ---------------------------------------------------------------- */

function incidents(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  return s.incidents
    .filter((i) => dansLaPeriode(i.dateHeure, debut, fin))
    .map((i) => ({
      ...situation(s, i.vehiculeId),
      date: i.dateHeure.slice(0, 10),
      heure: i.dateHeure.length > 10 ? i.dateHeure.slice(11, 16) : null,
      nature: i.nature === "accident" ? etat(NATURE_INCIDENT.accident, "defavorable", 0) : etat(NATURE_INCIDENT[i.nature], "vigilance", 1),
      type: TYPE_INCIDENT[i.type],
      chauffeur: i.chauffeur,
      lieu: i.lieu,
      mission: i.mission ? MISSION_INCIDENT[i.mission] : null,
      responsabilite: i.responsabilite ? RESPONSABILITE[i.responsabilite] : null,
      roulant: etat(ROULANT[i.roulant], i.roulant === "oui" ? "favorable" : i.roulant === "non" ? "defavorable" : "vigilance"),
      blesses: i.blesses,
      sinistreOuvert: i.sinistreOuvert,
      cout: i.cout,
      immobilisation: i.immobilisationJours,
      statut: etat(STATUT_DECLARATION[i.statut], TON_STATUT_DECLARATION[i.statut]),
      kilometrage: i.kilometrage,
      declarant: i.declarant,
      numero: i.numero,
      description: i.description,
    }));
}

/* -- Chauffeurs --------------------------------------------------------------- */

function chauffeurs(s: SourceRapports): LigneRapport[] {
  return s.chauffeurs.map((c) => {
    const ch = c.chauffeur;
    const conforme = !nonConforme(c);
    return {
      chauffeurId: c.id,
      nom: c.nomComplet,
      matricule: ch.matriculeRh,
      statut: etat(STATUT_CHAUFFEUR[c.statut].libelle, c.statut === "en-poste" ? "favorable" : c.statut === "disponible" ? "neutre" : "vigilance"),
      aptitude: etat(APTITUDE[ch.aptitude].libelle, APTITUDE[ch.aptitude].ton),
      conformite: conforme ? etat("Conforme", "favorable", 1) : etat("Non conforme", "defavorable", 0),
      vehicule: c.vehiculeTitulaire?.immatriculationAffichee ?? null,
      suppleances: c.suppleances.map((s) => s.immatriculationAffichee).join(", ") || null,
      site: c.site?.libelle ?? null,
      contrat: CONTRAT_CHAUFFEUR[ch.contrat],
      permis: ch.permisCategories.join(" · ") || null,
      permisNumero: ch.permisNumero,
      permisEcheance: c.permis.echeance,
      visiteMedicale: c.visiteMedicale.echeance,
      kmDouzeMois: c.kmDouzeMois,
      contraventions: c.contraventionsDouzeMois,
      incidents: c.incidentsDouzeMois,
      indisponibilite: c.indisponibilite ? MOTIF_INDISPONIBILITE[c.indisponibilite.motif] : null,
      embauche: ch.dateEmbauche,
      anciennete: ch.dateEmbauche ? arrondir((joursEntre(ch.dateEmbauche, s.aujourdhui) ?? 0) / 365.25) : null,
      telephone: ch.telephone,
      aptitudeMotif: ch.aptitudeMotif,
    };
  });
}

function performance(s: SourceRapports): LigneRapport[] {
  /* Le mois révolu : celui sur lequel le métier prime, jamais le mois en cours. */
  const [a, m] = s.aujourdhui.split("-").map(Number);
  const moisRevolu = new Date(Date.UTC(a!, m! - 2, 1)).toISOString().slice(0, 7);
  const lignes = s.chauffeurs;
  const sites = new Map(lignes.map((c) => [c.id, c.site?.libelle ?? null]));
  const vehicules = new Map(lignes.map((c) => [c.id, c.vehiculeTitulaire?.immatriculationAffichee ?? null]));
  const noms = new Map(lignes.map((c) => [c.id, c.nomComplet]));
  return classer(s.fichesChauffeurs, moisRevolu).map((l) => {
    const e = l.evaluation;
    const pilier = (code: string) => e.piliers.find((p) => p.pilier === code)?.score ?? null;
    const tranche = BAREME_PRIME.find((t) => t.cle === e.tranche.cle) ?? e.tranche;
    const gagne = l.rangPrecedent !== null && l.rang !== null ? l.rangPrecedent - l.rang : null;
    return {
      chauffeurId: e.chauffeurId,
      rang: l.rang,
      nom: noms.get(e.chauffeurId) ?? e.chauffeurId,
      vehicule: vehicules.get(e.chauffeurId) ?? null,
      site: sites.get(e.chauffeurId) ?? null,
      score: e.score === null ? null : Math.round(e.score),
      tranche: etat(tranche.libelle, tranche.partPct >= 75 ? "favorable" : tranche.partPct > 0 ? "vigilance" : "defavorable", tranche.seuil),
      prime: e.classable ? tranche.partPct : 0,
      securite: pilier("S"),
      qualite: pilier("Q"),
      delai: pilier("D"),
      cout: pilier("C"),
      moral: pilier("M"),
      km: Math.round(e.kmParcourus),
      rangPrecedent: l.rangPrecedent,
      evolution: gagne === null ? null : gagne > 0 ? `+${gagne} place${gagne > 1 ? "s" : ""}` : gagne < 0 ? `${gagne} place${gagne < -1 ? "s" : ""}` : "Stable",
      classable: e.classable,
      eliminatoire: e.classable ? null : e.motifConfidentiel ? "Motif confidentiel" : e.motifNonClassable,
    };
  });
}

/* -- Achats & caisse ---------------------------------------------------------- */

function demandes(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  const TON_URGENCE: Record<string, Ton> = { immobilisant: "defavorable", urgente: "vigilance", normale: "neutre" };
  return s.achats
    .filter((d) => dansLaPeriode(d.date, debut, fin))
    .map((d) => {
      const facture = d.montantReel ?? (d.etape === "reglee" ? coutDe(d).montant : null);
      return {
        ...(d.vehiculeId ? situation(s, d.vehiculeId) : {}),
        numero: d.numero,
        date: d.date,
        objet: d.objet,
        etape: etat(ETAPE_ACHAT[d.etape], TON_ETAPE_ACHAT[d.etape]),
        urgence: etat(URGENCE_ACHAT[d.urgence], TON_URGENCE[d.urgence] ?? "neutre"),
        poste: POSTE_DEPENSE[d.poste],
        fournisseur: d.fournisseur,
        montantEstime: d.montantEstime,
        montantEngage: d.montantEngage,
        montantReel: facture,
        ecartEstimation: facture !== null && d.montantEstime > 0 ? arrondir(((facture - d.montantEstime) / d.montantEstime) * 100) : null,
        numeroDemandeX3: d.numeroDemandeX3,
        numeroBonCommande: d.numeroBonCommande,
        demandeur: d.demandeur,
        visaPar: d.visaPar,
        visaLe: d.visaLe,
        validePar: d.validePar,
        valideeLe: d.valideeLe,
        dateLivraison: d.dateLivraison,
        dateFacture: d.dateFacture,
        dateReglement: d.dateReglement,
        delaiTotal: joursEntre(d.date, d.dateReglement),
        origineNumero: d.origineNumero,
        depenseNumero: d.depenseNumero,
      };
    });
}

function caisse(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  return s.journal
    .filter((m) => dansLaPeriode(m.date, debut, fin))
    .map((m) => ({
      ...(m.vehiculeId ? situation(s, m.vehiculeId) : {}),
      date: m.date,
      numero: m.numero,
      sens: etat(SENS_CAISSE[m.sens], m.sens === "entree" ? "favorable" : "neutre"),
      libelle: m.libelle,
      entree: m.sens === "entree" ? m.montant : null,
      sortie: m.sens === "sortie" ? m.montant : null,
      solde: m.soldeApres,
      poste: m.poste ? POSTE_DEPENSE[m.poste] : null,
      beneficiaire: m.beneficiaire,
      justificatif: m.sens === "entree" ? etat("Sans objet", "neutre", 2) : m.justificatif ? etat("Fourni", "favorable", 1) : etat("Manquant", "vigilance", 0),
      piece: m.piece,
      depenseNumero: m.depenseNumero,
      enregistrePar: m.enregistrePar,
      creee: m.creee,
    }));
}

/* -- Prestataires ------------------------------------------------------------- */

function prestataires(s: SourceRapports): LigneRapport[] {
  /* Les mêmes statistiques que la liste Prestataires : douze mois glissants,
     demandes commandées ou au-delà. Un rapport ne recompte pas. */
  const depuis = new Date(Date.parse(s.aujourdhui) - 365 * 86_400_000).toISOString().slice(0, 10);
  const stats = Object.fromEntries(statistiquesParPrestataire(s.achats, depuis));
  return s.prestataires.prestataires.map((p) => {
    const s = stats[p.numero];
    return {
      numero: p.numero,
      nom: p.raisonSociale,
      type: TYPE_PRESTATAIRE[p.type],
      actif: p.actif ? etat("Actif", "favorable", 0) : etat("Inactif", "neutre", 1),
      ville: p.ville,
      demandes: s?.demandes ?? 0,
      montant: s?.montant ?? 0,
      enAttente: s?.montantEnAttente ?? 0,
      nombreEnAttente: s?.enAttente ?? 0,
      delai: s?.delaiReglementJours ?? null,
      refusees: s?.refusees ?? 0,
      panierMoyen: s && s.demandes > 0 ? Math.round(s.montant / s.demandes) : null,
      contact: p.contact,
      telephone: p.telephone,
      courriel: p.courriel,
      adresse: p.adresse,
      ninea: p.ninea,
      delaiPaiement: p.delaiPaiementJours,
      note: p.note,
    };
  });
}

/* -- Transporteurs ------------------------------------------------------------- */

/** Les missions de la période, chacune confrontée à sa grille. */
function missionsDe(s: SourceRapports, c: ContexteRapport) {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  const grilles = s.transporteurs.grilles;
  const rattachementsLocalites = s.transporteurs.rattachements;
  return s.transporteurs.affretements
    .filter((a) => dansLaPeriode(a.date, debut, fin))
    .map((a) => {
      const tarif = tarifApplicable(grilles, a, rattachementsLocalites);
      return { a, tarif, attendu: montantAttendu(tarif, a) };
    });
}

function affretementsRapport(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  return missionsDe(s, c).map(({ a, tarif, attendu }) => {
    const m = montantsDe(a, attendu);
    const e = ecartFacturation(a, attendu);
    return {
      numero: a.numero,
      date: a.date,
      transporteur: a.transporteur,
      origine: a.origine,
      destination: a.destination,
      businessUnit: a.businessUnit ? BUSINESS_UNIT[a.businessUnit] : null,
      motif: a.motif ? MOTIF_AFFRETEMENT[a.motif] : "Non relevé",
      subi: a.motif ? MOTIF_SUBI[a.motif] : false,
      categorie: CATEGORIE_VEHICULE[a.categorieDemandee],
      tonnage: a.tonnageLivre ?? a.tonnagePrevu,
      distance: a.distanceKm,
      tarif: tarif ? `${tarif.prix} ${UNITE_TARIF[tarif.unite].suffixe}` : null,
      baseTarif: tarif ? etat(SOURCE_TARIF[tarif.source].libelle, SOURCE_TARIF[tarif.source].ton) : etat("Hors grille", "defavorable", -1),
      duNet: attendu,
      factureTtc: m.factureTtc,
      retenue: m.retenue,
      net: m.nettoye,
      ecart: e ? e.pct : null,
      statut: etat(STATUT_AFFRETEMENT[a.statut], TON_STATUT_AFFRETEMENT[a.statut]),
      dateLivraison: a.dateLivraison,
      dateFacture: a.dateFacture,
      dateReglement: a.dateReglement,
      referenceFacture: a.referenceFacture,
      numeroDemandeX3: a.numeroDemandeX3,
      immatriculationExterne: a.immatriculationExterne,
      chauffeurExterne: a.chauffeurExterne,
      demandeur: a.demandeur,
    };
  });
}

function activiteTransporteurs(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const missions = missionsDe(s, c);
  const grilles = s.transporteurs.grilles;
  return s.transporteurs.prestataires
    .map((t) => {
      const siennes = missions.filter((m) => m.a.transporteurNumero === t.numero);
      const ecarts = siennes.map((m) => ecartFacturation(m.a, m.attendu)).filter((e): e is NonNullable<typeof e> => e !== null);
      const grille = grilles.filter((g) => g.transporteurNumero === t.numero);
      const source = grille.some((g) => g.source === "a-confirmer") ? "a-confirmer" : grille.some((g) => g.source === "accord-verbal") ? "accord-verbal" : grille.length ? "contrat" : null;
      const cout = siennes.reduce((t, m) => t + coutAffretement(m.a), 0);
      return {
        numero: t.numero,
        transporteur: t.raisonSociale,
        ville: t.ville,
        missions: siennes.length,
        tonnes: siennes.filter((m) => prestationFaite(m.a.statut)).reduce((t, m) => t + (m.a.tonnageLivre ?? m.a.tonnagePrevu), 0),
        cout,
        du: siennes.filter((m) => m.a.statut === "livre" || m.a.statut === "facture").reduce((t, m) => t + coutAffretement(m.a), 0),
        ecartMoyen: ecarts.length ? arrondir(ecarts.reduce((t, e) => t + e.pct, 0) / ecarts.length) : null,
        horsTolerance: ecarts.filter((e) => Math.abs(e.pct) > 5).length,
        subies: siennes.filter((m) => m.a.motif !== null && MOTIF_SUBI[m.a.motif]).length,
        baseTarif: source ? etat(SOURCE_TARIF[source].libelle, SOURCE_TARIF[source].ton) : etat("Aucune grille", "defavorable", -1),
        lignesGrille: grille.length,
        panier: siennes.length ? Math.round(cout / siennes.length) : null,
      };
    })
    .filter((t) => (t.missions as number) > 0 || (t.lignesGrille as number) > 0)
    .sort((a, b) => (b.cout as number) - (a.cout as number));
}

function misesRapport(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  /* La mise à disposition se date de son mois : on retient le mois dès qu'il
     touche la période, sans quoi un rapport « ce mois-ci » ne rendrait rien. */
  return s.transporteurs.misesADisposition
    .filter((m) => `${m.mois}-01` <= fin && `${m.mois}-${String(m.joursCalendaires).padStart(2, "0")}` >= debut)
    .map((m) => {
      const cout = coutMiseADisposition(m);
      const ramene = ramenerCoutMad(m);
      return {
        numero: m.numero,
        mois: m.mois,
        transporteur: m.transporteur,
        immatriculation: m.immatriculation,
        famille: FAMILLE_MAD[m.famille].libelle,
        prixJour: m.prixJour,
        joursDus: joursDus(m),
        joursRoules: m.joursRoules,
        joursPerdus: joursPayesNonRoules(m),
        joursPanne: m.joursPanne,
        location: cout.location,
        carburantLitres: m.carburantLitres,
        carburantMontant: cout.carburant,
        total: cout.total,
        tonnes: m.tonnesTransportees,
        parJour: ramene.parJour,
        parTonne: ramene.parTonne,
        statut: etat(STATUT_AFFRETEMENT[m.statut], TON_STATUT_AFFRETEMENT[m.statut]),
        convention: etat(CONVENTION_FACTURATION[m.convention].libelle, CONVENTION_FACTURATION[m.convention].ton),
        dateFacture: m.dateFacture,
        dateReglement: m.dateReglement,
        referenceFacture: m.referenceFacture,
        numeroDemandeX3: m.numeroDemandeX3,
        commentaire: m.commentaire,
      };
    });
}

function prestationsRapport(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  return s.transporteurs.prestations
    .filter((p) => dansLaPeriode(p.date, debut, fin))
    .map((p) => {
      const m = montantsPrestation(p);
      return {
        numero: p.numero,
        date: p.date,
        transporteur: p.transporteur,
        libelle: p.libelle,
        businessUnit: p.businessUnit ? BUSINESS_UNIT[p.businessUnit] : null,
        unite: UNITE_PRESTATION[p.unite].libelle,
        quantite: p.quantite,
        prixUnitaire: p.prixUnitaire,
        convenu: m.convenu,
        factureTtc: m.factureTtc,
        retenue: m.retenue,
        net: m.net,
        convention: etat(CONVENTION_FACTURATION[p.convention].libelle, CONVENTION_FACTURATION[p.convention].ton),
        statut: etat(STATUT_AFFRETEMENT[p.statut], TON_STATUT_AFFRETEMENT[p.statut]),
        dateFacture: p.dateFacture,
        dateReglement: p.dateReglement,
        referenceFacture: p.referenceFacture,
        numeroDemandeX3: p.numeroDemandeX3,
        commentaire: p.commentaire,
      };
    });
}

/** Le relevé de transport, chargement par chargement. */
function releveRapport(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  const immatParc = new Map(s.lignes.map((l) => [l.vehicule.id, l.vehicule.immatriculationAffichee]));
  return s.releves
    .filter((l) => dansLaPeriode(l.date, debut, fin))
    .map((l) => ({
      numero: l.numero,
      date: l.date,
      semaine: l.semaine,
      mode: etat(MODE_EXECUTION[l.mode].libelle, MODE_EXECUTION[l.mode].ton),
      transporteur: l.transporteur ?? "SEDIMA",
      camion: l.camionTiersImmatriculation ?? l.immatriculationLibre ?? (l.vehiculeId ? (immatParc.get(l.vehiculeId) ?? null) : null),
      /* La distinction du brainstorm : un camion du référentiel se suit, une
         immatriculation notée à la volée ne renvoie à rien. */
      suivi: l.camionTiersImmatriculation !== null || l.vehiculeId !== null,
      chauffeur: l.chauffeur,
      origine: l.origine,
      destination: l.destination,
      destinationTarifaire: l.destinationTarifaire,
      produit: PRODUIT_TRANSPORTE[l.produit].libelle,
      tonnage: l.tonnage,
      tonnagePese: l.tonnagePese,
      ecartPesee: ecartPesee(l),
      bonLivraison: l.bonLivraison,
      affretement: l.affretementNumero,
    }));
}

/**
 * L'efficacité du transport : le franc à la tonne livrée.
 *
 * Demande du métier du 5 septembre 2026. C'est **la** comparaison du chantier
 * transporteurs : elle met le parc SEDIMA sur la même ligne que les tiers,
 * parce qu'un taux d'externalisation ne se pilote pas sans savoir lequel des
 * deux porte la tonne au meilleur prix. Le coût du parc est celui des bilans
 * véhicules ; celui d'un tiers, ses affrètements, ses mises à disposition et
 * ses prestations de la période.
 */
function efficaciteTransport(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  const lignes = s.releves.filter((l) => dansLaPeriode(l.date, debut, fin));

  /* Le coût du parc : la somme des bilans véhicules sur la même fenêtre. C'est
     le coût complet — carburant, maintenance, tout — puisque c'est à lui que
     le prix d'un tiers se compare. */
  const coutParc = bilans(s, c).reduce((t, b) => t + b.total, 0);

  const coutTiers = new Map<string, number>();
  const ajouter = (nom: string | null, montant: number) => {
    if (!nom) return;
    coutTiers.set(nom, (coutTiers.get(nom) ?? 0) + montant);
  };
  for (const a of s.transporteurs.affretements) if (dansLaPeriode(a.date, debut, fin)) ajouter(a.transporteur, coutAffretement(a));
  for (const m of s.transporteurs.misesADisposition) if (`${m.mois}-15` >= debut && `${m.mois}-15` <= fin) ajouter(m.transporteur, coutMiseADisposition(m).total);
  for (const p of s.transporteurs.prestations) if (dansLaPeriode(p.date, debut, fin)) ajouter(p.transporteur, montantsPrestation(p).factureTtc ?? 0);

  const profils = new Map(s.transporteurs.prestataires.map((t) => [t.raisonSociale, (s.transporteurs.profils.get(t.numero) ?? profilParDefaut(t.numero))]));
  const numeros = new Map(s.transporteurs.prestataires.map((t) => [t.raisonSociale, t.numero]));

  /*
   * L'enlèvement client ne se compare pas au reste : le client vient avec son
   * camion, la tonne ne nous coûte rien, et l'afficher à 0 F la tonne face au
   * parc ferait croire à une piste d'économie qui n'en est pas une. Il garde
   * donc une ligne — les tonnes sont bien sorties de l'usine — mais sa nature
   * le dit, et son coût reste vide plutôt que nul.
   */
  const parNom = new Map<string, typeof lignes>();
  for (const l of lignes) {
    const nom = l.mode === "enlevement-client" ? "Enlèvements clients" : (l.transporteur ?? "SEDIMA");
    const liste = parNom.get(nom) ?? [];
    liste.push(l);
    parNom.set(nom, liste);
  }

  const tonnesDe = (liste: typeof lignes) => liste.reduce((t, l) => t + (l.tonnagePese ?? l.tonnage), 0);
  const tonnesTotales = tonnesDe(lignes);
  const coutTotal = coutParc + [...coutTiers.values()].reduce((t, x) => t + x, 0);
  const parcTonnes = tonnesDe(parNom.get("SEDIMA") ?? []);
  const referenceParc = parcTonnes > 0 ? coutParc / parcTonnes : null;

  return [...parNom.entries()]
    .map(([nom, liste]) => {
      const parc = nom === "SEDIMA";
      const client = nom === "Enlèvements clients";
      const tonnes = tonnesDe(liste);
      const cout = client ? null : parc ? coutParc : (coutTiers.get(nom) ?? 0);
      const coutTonne = cout !== null && tonnes > 0 ? Math.round(cout / tonnes) : null;
      const profil = profils.get(nom) ?? null;
      const peses = liste.filter((l) => l.tonnagePese !== null);
      const ecarts = peses.map((l) => ecartPesee(l)).filter((e): e is number => e !== null);
      return {
        numero: numeros.get(nom) ?? null,
        transporteur: nom,
        nature: client ? etat("Enlèvement client", "neutre", 2) : parc ? etat("Parc SEDIMA", "favorable", 0) : etat("Tiers", "neutre", 1),
        tonnes: arrondir(tonnes),
        chargements: liste.length,
        cout,
        coutTonne,
        /* L'écart se lit contre le parc : c'est la référence que le métier a
           sous les yeux quand il arbitre entre faire et faire faire. */
        ecartReference: parc || client || referenceParc === null || coutTonne === null ? null : arrondir(((coutTonne - referenceParc) / referenceParc) * 100),
        partTonnes: tonnesTotales > 0 ? arrondir((tonnes / tonnesTotales) * 100) : null,
        partCout: cout !== null && coutTotal > 0 ? arrondir((cout / coutTotal) * 100) : null,
        camions: new Set(liste.map((l) => l.camionTiersImmatriculation ?? l.immatriculationLibre ?? l.vehiculeId).filter(Boolean)).size,
        tonnesParChargement: liste.length ? arrondir(tonnes / liste.length) : null,
        destinations: new Set(liste.map((l) => l.destination)).size,
        partPesee: liste.length ? arrondir((peses.length / liste.length) * 100) : null,
        ecartPeseeMoyen: ecarts.length ? arrondir(ecarts.reduce((t, e) => t + e, 0) / ecarts.length) : null,
        contrat: parc || client
          ? etat("Sans objet", "neutre", 2)
          : profil?.sousContrat
            ? etat("Sous contrat", "favorable", 0)
            : etat("Sans écrit", "vigilance", 1),
        modes: parc || client ? null : (profil?.modes.map((m) => MODE_REMUNERATION[m].libelle).join(", ") ?? null),
      };
    })
    .sort((a, b) => (b.tonnes as number) - (a.tonnes as number));
}

/** Le coût de la tonne par destination — et si la grille la connaît. */
function destinationsTransport(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  const lignes = s.releves.filter((l) => dansLaPeriode(l.date, debut, fin));
  const grilles = s.transporteurs.grilles;

  const parDestination = new Map<string, typeof lignes>();
  for (const l of lignes) {
    const liste = parDestination.get(l.destination) ?? [];
    liste.push(l);
    parDestination.set(l.destination, liste);
  }

  return [...parDestination.entries()]
    .map(([destination, liste]) => {
      const tonnes = liste.reduce((t, l) => t + (l.tonnagePese ?? l.tonnage), 0);
      const tarifaire = liste.find((l) => l.destinationTarifaire)?.destinationTarifaire ?? null;
      /* Le tarif de grille : la médiane des lignes qui servent cette
         destination, faute de mieux — plusieurs transporteurs, plusieurs prix. */
      const tarifs = tarifaire ? grilles.filter((g) => g.destination === tarifaire).map((g) => g.prix) : [];
      const dates = liste.map((l) => l.date).sort();
      return {
        destination,
        destinationTarifaire: tarifaire,
        rattachee: tarifaire !== null,
        tonnes: arrondir(tonnes),
        chargements: liste.length,
        transporteurs: new Set(liste.map((l) => l.transporteur ?? "SEDIMA")).size,
        partParc: liste.length ? arrondir((liste.filter((l) => l.mode === "parc").length / liste.length) * 100) : null,
        tarifGrille: tarifs.length ? Math.round(tarifs.reduce((t, p) => t + p, 0) / tarifs.length) : null,
        tonnesParChargement: liste.length ? arrondir(tonnes / liste.length) : null,
        produits: [...new Set(liste.map((l) => PRODUIT_TRANSPORTE[l.produit].libelle))].join(", "),
        premier: dates[0] ?? null,
        dernier: dates[dates.length - 1] ?? null,
      };
    })
    .sort((a, b) => (b.tonnes as number) - (a.tonnes as number));
}

/* -- Budget -------------------------------------------------------------------- */

function budgetPostes(s: SourceRapports): LigneRapport[] {
  return budgetDe(s).postes.map((p) => {
    const s = p.cumul;
    return {
      cle: p.poste,
      poste: POSTE_DEPENSE[p.poste],
      etat: etat(ETAT_BUDGET[s.etat].libelle, ETAT_BUDGET[s.etat].ton, ["depasse", "tendu", "sans-budget", "conforme", "sous-consomme"].indexOf(s.etat)),
      budget: s.enveloppe.montant,
      consomme: s.consomme,
      engage: s.engage,
      disponible: s.enveloppe.montant > 0 ? s.disponible : null,
      avancement: s.tauxConsommation,
      attendu: s.attendu,
      ecartRythme: s.ecartRythmePct,
      businessUnits: p.parBu.length,
      enveloppes: p.parBu.filter((x) => x.enveloppe.montant > 0).length,
      sansEnveloppe: p.parBu.filter((x) => x.enveloppe.montant === 0).length,
      saisonnalite: s.enveloppe.profil !== null,
      base: s.enveloppe.base,
    };
  });
}

function budgetEnveloppes(s: SourceRapports): LigneRapport[] {
  return budgetDe(s).postes.flatMap((p) =>
    p.parBu.map((s) => ({
      poste: POSTE_DEPENSE[p.poste],
      businessUnit: s.enveloppe.businessUnit ? BUSINESS_UNIT[s.enveloppe.businessUnit] : "Tout le parc",
      etat: etat(ETAT_BUDGET[s.etat].libelle, ETAT_BUDGET[s.etat].ton, ["depasse", "tendu", "sans-budget", "conforme", "sous-consomme"].indexOf(s.etat)),
      budget: s.enveloppe.montant,
      consomme: s.consomme,
      engage: s.engage,
      disponible: s.enveloppe.montant > 0 ? s.disponible : null,
      avancement: s.tauxConsommation,
      attendu: s.attendu,
      ecartRythme: s.ecartRythmePct,
      numero: s.enveloppe.numero || null,
      saisonnalite: s.enveloppe.profil !== null,
      base: s.enveloppe.base,
    })),
  );
}

function budgetEngagements(s: SourceRapports): LigneRapport[] {
  const budget = budgetDe(s);
  const budgetes = new Set(budget.postes.filter((p) => p.cumul.enveloppe.montant > 0).map((p) => p.poste));
  return budget.postes
    .flatMap((p) => fichePosteDe(s.budget, p.poste, budget)?.engagements.map((g) => ({ p, g })) ?? [])
    .map(({ p, g }) => ({
      date: g.date,
      objet: g.objet,
      poste: POSTE_DEPENSE[p.poste],
      businessUnit: g.businessUnit ? BUSINESS_UNIT[g.businessUnit] : null,
      fournisseur: g.fournisseur,
      montant: g.montant,
      bonCommande: g.bonCommande,
      immatriculation: g.immatriculationAffichee,
      age: joursEntre(g.date, s.aujourdhui),
      budgete: budgetes.has(p.poste),
      numero: g.numero,
    }))
    .sort((a, b) => (b.montant as number) - (a.montant as number));
}

/* -- Conformité, les autres angles --------------------------------------------- */

function conformiteVehicules(s: SourceRapports, parametres: Parametres): LigneRapport[] {
  return parcTransport(s).map((l) => {
    const v = l.vehicule;
    const docs = echeancesDuVehicule(s, v).filter(estDocument);
    const cle = (e: Echeance) => ETAT_DOCUMENT[e.niveau].cle;
    const compte = (etats: string[]) => docs.filter((d) => etats.includes(cle(d))).length;
    /* L'immobilisation est celle de la fiche : les documents critiques en cause, licence de la flotte comprise. */
    const critiques = docs.filter((d) => definitionDocument(d.type, parametres)?.critique);
    const immobilise = (s.resumesFiche.get(v.id)?.immobilisation ?? null) !== null || critiques.some((d) => cle(d) === "echu" || cle(d) === "manquant");
    /* La prochaine échéance : la pièce datée la plus proche, manquantes mises
       à part — une pièce absente n'a pas d'échéance, elle a un retard. */
    const prochaine = docs.find((d) => d.echeance !== null && d.joursRestants !== null) ?? null;
    const echues = compte(["echu"]);
    const manquantes = compte(["manquant"]);
    return {
      ...situation(s, v.id),
      statut: etat(STATUT_VEHICULE[v.statut].libelle, tonStatut(v.statut)),
      conformite: immobilise
        ? etat("Immobilisé", "defavorable", 0)
        : echues + manquantes > 0
          ? etat("Non conforme", "defavorable", 1)
          : compte(["bientot"]) > 0
            ? etat("Échéance proche", "vigilance", 2)
            : etat("Conforme", "favorable", 3),
      documents: docs.length,
      aJour: compte(["a-jour", "permanent"]),
      bientot: compte(["bientot"]),
      echues,
      manquantes,
      prochaine: prochaine?.libelle ?? null,
      prochaineDate: prochaine?.echeance ?? null,
      joursRestants: prochaine?.joursRestants ?? null,
      immobilise,
      /* Le coût des documents vit sur la fiche ; l'échéancier ne le porte pas. */
      coutDocuments: null,
    };
  });
}

function visitesTechniques(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  const lignes: LigneRapport[] = [];
  for (const l of parcTransport(s)) {
    for (const v of s.visites.filter((x) => x.vehiculeId === l.vehicule.id)) {
      if (!dansLaPeriode(v.dateRendezVous, debut, fin)) continue;
      const observations = s.observations.filter((o) => o.visiteId === v.id || o.visiteId === v.numero);
      lignes.push({
        ...situation(s, l.vehicule.id),
        type: TYPE_VISITE[v.type],
        statut: etat(STATUT_VISITE[v.statut].libelle, STATUT_VISITE[v.statut].ton),
        dateRendezVous: v.dateRendezVous,
        datePassage: v.datePassage,
        centre: v.centre,
        attente: joursEntre(v.dateRendezVous, v.datePassage),
        dateLimiteContreVisite: v.dateLimiteContreVisite,
        observations: observations.length,
        majeures: observations.filter((o) => o.gravite === "majeure").length,
        numeroPv: v.numeroPv,
        commentaire: v.commentaire,
      });
    }
  }
  return lignes.sort((a, b) => String(b.dateRendezVous).localeCompare(String(a.dateRendezVous)));
}

/* -- Sinistralité --------------------------------------------------------------- */

function sinistraliteVehicules(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  const retenus = s.incidents.filter((i) => dansLaPeriode(i.dateHeure, debut, fin));
  const km = new Map(bilans(s, c).map((b) => [b.donnees.vehiculeId, b.km]));
  return parcTransport(s).map((l) => {
    const siens = retenus.filter((i) => i.vehiculeId === l.vehicule.id);
    const dates = siens.map((i) => i.dateHeure.slice(0, 10)).sort();
    const kmPeriode = km.get(l.vehicule.id) ?? 0;
    const responsables = siens.filter((i) => i.responsabilite === "sedima" || i.responsabilite === "partagee").length;
    return {
      ...situation(s, l.vehicule.id),
      statut: etat(STATUT_VEHICULE[l.vehicule.statut].libelle, tonStatut(l.vehicule.statut)),
      incidents: siens.length,
      accidents: siens.filter((i) => i.nature === "accident").length,
      cout: siens.reduce((t, i) => t + (i.cout ?? 0), 0),
      immobilisation: siens.reduce((t, i) => t + (i.immobilisationJours ?? 0), 0),
      partResponsable: siens.length ? arrondir((responsables / siens.length) * 100) : null,
      blesses: siens.filter((i) => i.blesses).length,
      sinistres: siens.filter((i) => i.sinistreOuvert).length,
      ouverts: siens.filter((i) => i.statut !== "clos").length,
      dernier: dates.length ? dates[dates.length - 1]! : null,
      kmDouzeMois: kmPeriode,
      incidentsPar10000: kmPeriode > 0 ? arrondir((siens.length / kmPeriode) * 10_000, 2) : null,
    };
  }).sort((a, b) => (b.incidents as number) - (a.incidents as number));
}

function sinistraliteChauffeurs(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  const dans = (d: string) => dansLaPeriode(d, debut, fin);
  const lignes = new Map(s.chauffeurs.map((x) => [x.id, x]));
  return s.fichesChauffeurs
    .map((f) => {
      const l = lignes.get(f.ligne.id);
      const incidents = f.incidents.filter((i) => dans(i.declaration.dateHeure));
      const contraventions = f.contraventions.filter((x) => dans(x.date));
      const sanctions = f.sanctions.filter((s) => dans(s.date));
      const dates = incidents.map((i) => i.declaration.dateHeure.slice(0, 10)).sort();
      const km = l?.kmDouzeMois ?? null;
      return {
        chauffeurId: f.ligne.id,
        nom: f.ligne.nomComplet,
        vehicule: l?.vehiculeTitulaire?.immatriculationAffichee ?? null,
        incidents: incidents.length,
        accidents: incidents.filter((i) => i.declaration.nature === "accident").length,
        responsables: incidents.filter((i) => i.declaration.responsabilite === "sedima" || i.declaration.responsabilite === "partagee").length,
        /* Des déclarations sans une seule dépense rattachée laissent la
           colonne vide : elle ne dit pas qu'un chauffeur n'a rien coûté,
           elle dit qu'on l'ignore. Aucune déclaration coûte bien zéro. */
        cout: !incidents.length ? 0 : incidents.some((i) => i.cout !== null) ? incidents.reduce((t, i) => t + (i.cout ?? 0), 0) : null,
        immobilisation: incidents.reduce((t, i) => t + i.immobilisationJours, 0),
        contraventions: contraventions.length,
        coutContraventions: contraventions.reduce((t, x) => t + x.montant, 0),
        sanctions: sanctions.length,
        joursMiseAPied: sanctions.reduce((t, x) => t + (x.jours ?? 0), 0),
        dernier: dates.length ? dates[dates.length - 1]! : null,
        km,
        incidentsPar10000: km && km > 0 ? arrondir((incidents.length / km) * 10_000, 2) : null,
        statut: etat(STATUT_CHAUFFEUR[f.ligne.statut].libelle, f.ligne.statut === "en-poste" ? "favorable" : f.ligne.statut === "disponible" ? "neutre" : "vigilance"),
        site: f.ligne.site?.libelle ?? null,
      };
    })
    .sort((a, b) => (b.incidents as number) - (a.incidents as number));
}

/* -- Chauffeurs, les autres angles ---------------------------------------------- */

function disciplineChauffeurs(s: SourceRapports): LigneRapport[] {
  /* Douze mois glissants : une indisponibilité de l'an dernier ne dit plus rien
     de la disponibilité d'aujourd'hui. */
  const debut = new Date(Date.parse(s.aujourdhui) - 365 * 86_400_000).toISOString().slice(0, 10);
  return s.fichesChauffeurs
    .map((f) => {
      const indispos = f.indisponibilites.filter((i) => (i.fin ?? s.aujourdhui) >= debut);
      const jours = indispos.reduce((t, i) => t + (joursEntre(i.debut < debut ? debut : i.debut, i.fin ?? s.aujourdhui) ?? 0), 0);
      const sanctions = [...f.sanctions].sort((a, b) => b.date.localeCompare(a.date));
      const courante = f.ligne.indisponibilite;
      return {
        chauffeurId: f.ligne.id,
        nom: f.ligne.nomComplet,
        matricule: f.ligne.chauffeur.matriculeRh,
        statut: etat(STATUT_CHAUFFEUR[f.ligne.statut].libelle, f.ligne.statut === "en-poste" ? "favorable" : f.ligne.statut === "disponible" ? "neutre" : "vigilance"),
        disponible: courante ? etat("Indisponible", "defavorable", 0) : etat("Disponible", "favorable", 1),
        motifIndisponibilite: courante ? MOTIF_INDISPONIBILITE[courante.motif] : null,
        indisponibleDepuis: courante?.debut ?? null,
        joursIndisponible: jours,
        episodes: indispos.length,
        contraventions: f.ligne.contraventionsDouzeMois,
        sanctions: f.sanctions.length,
        joursMiseAPied: f.sanctions.reduce((t, x) => t + (x.jours ?? 0), 0),
        derniereSanction: sanctions[0] ? `${TYPE_SANCTION[sanctions[0].type]} — ${sanctions[0].motif}` : null,
        derniereSanctionDate: sanctions[0]?.date ?? null,
        contrat: CONTRAT_CHAUFFEUR[f.ligne.chauffeur.contrat],
        site: f.ligne.site?.libelle ?? null,
      };
    })
    .sort((a, b) => (b.joursIndisponible as number) - (a.joursIndisponible as number));
}

function fraisDeRoute(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  return s.fichesChauffeurs
    .flatMap((f) =>
      f.fraisDeRoute
        .filter((x) => dansLaPeriode(x.date, debut, fin))
        .map((x) => ({
          chauffeurId: f.ligne.id,
          date: x.date,
          chauffeur: f.ligne.nomComplet,
          libelle: x.libelle,
          montant: x.montant,
          vehicule: x.immatriculationAffichee,
          justificatif: x.justificatif,
          poste: POSTE_DEPENSE["frais-de-route"],
          beneficiaire: f.ligne.nomComplet,
          site: f.ligne.site?.libelle ?? null,
          numero: x.numero,
        })),
    )
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/* -- Achats, le cycle ------------------------------------------------------------ */

function cycleAchats(s: SourceRapports, c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  const delais = new Map(s.prestataires.prestataires.map((p) => [p.numero, p.delaiPaiementJours]));
  return s.achats
    .filter((d) => dansLaPeriode(d.date, debut, fin))
    .map((d) => {
      const cout = coutDe(d);
      const convenu = d.prestataireNumero ? (delais.get(d.prestataireNumero) ?? null) : null;
      const paiement = joursEntre(d.dateFacture, d.dateReglement);
      return {
        date: d.date,
        objet: d.objet,
        fournisseur: d.fournisseur,
        etape: etat(ETAPE_ACHAT[d.etape], TON_ETAPE_ACHAT[d.etape]),
        montant: cout.montant,
        versVisa: joursEntre(d.date, d.visaLe),
        versValidation: joursEntre(d.visaLe, d.valideeLe),
        versCommande: joursEntre(d.valideeLe ?? d.visaLe, d.numeroBonCommande ? (d.dateLivraison ?? d.dateFacture ?? s.aujourdhui) : null),
        versLivraison: joursEntre(d.valideeLe, d.dateLivraison),
        versFacture: joursEntre(d.dateLivraison, d.dateFacture),
        versReglement: paiement,
        total: joursEntre(d.date, d.dateReglement),
        /* L'âge ne vaut que pour ce qui n'est pas clos : une demande réglée
           n'a pas d'âge, elle a une durée. */
        age: d.dateReglement === null ? joursEntre(d.date, s.aujourdhui) : null,
        delaiTenu:
          d.dateReglement === null
            ? etat("En cours", "neutre", 2)
            : convenu === null || paiement === null
              ? etat("Sans délai convenu", "neutre", 3)
              : paiement <= convenu
                ? etat("Tenu", "favorable", 0)
                : etat(`Dépassé de ${paiement - convenu} j`, "defavorable", 1),
        urgence: URGENCE_ACHAT[d.urgence],
        demandeur: d.demandeur,
        immatriculation: d.immatriculationAffichee,
        businessUnit: d.businessUnit ? BUSINESS_UNIT[d.businessUnit] : null,
        numero: d.numero,
      };
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/* -- Prestataires, les autres angles --------------------------------------------- */

function comptesPrestataires(s: SourceRapports): LigneRapport[] {
  return s.prestataires.prestataires
    .map((p) => {
      const compte = comptePrestataireDe(s.prestataires, p.numero);
      const dettes = compte?.dettes ?? [];
      const av = compte?.avances ?? [];
      const echues = dettes.filter((d) => ageDette(d.echeance, s.aujourdhui) !== "a-venir");
      const retards = echues.map((d) => joursEntre(d.echeance, s.aujourdhui) ?? 0);
      const ouvertes = av.filter(avanceOuverte);
      const du = dettes.reduce((t, d) => t + d.montant, 0);
      const nonSoldees = ouvertes.reduce((t, a) => t + a.montant, 0);
      return {
        numero: p.numero,
        nom: p.raisonSociale,
        type: TYPE_PRESTATAIRE[p.type],
        pieces: dettes.length,
        du,
        echu: echues.reduce((t, d) => t + d.montant, 0),
        piecesEchues: echues.length,
        retardMax: retards.length ? Math.max(...retards) : null,
        avances: av.reduce((t, a) => t + a.montant, 0),
        avancesNonSoldees: nonSoldees,
        solde: du - nonSoldees,
        delaiPaiement: p.delaiPaiementJours,
        anciennete: ancienneteMois(dettes.map((d) => d.date), s.aujourdhui),
        ville: p.ville,
        telephone: p.telephone,
      };
    })
    .filter((l) => (l.pieces as number) > 0 || (l.avances as number) > 0)
    .sort((a, b) => (b.du as number) - (a.du as number));
}

function notationPrestataires(s: SourceRapports): LigneRapport[] {
  /* Le montant se prend sur **tout** ce que le prestataire a facturé au parc —
     interventions, demandes d'achat, sorties de caisse. Les seules demandes
     d'achat auraient affiché « 0 F » en face de dix-sept interventions : le
     garage qui n'est jamais passé par un bon de commande aurait eu l'air de
     n'avoir rien coûté. */
  /* Le même résumé que le référentiel Prestataires — activité, note, ancienneté
     transport compris : une note qui varie selon l'écran ne vaut rien. */
  const resumes = resumesDe(s.prestataires);
  return s.prestataires.prestataires
    .map((p) => {
      const r = resumes[p.numero];
      const compte = comptePrestataireDe(s.prestataires, p.numero);
      const evals = compte?.evaluations ?? [];
      const note = r?.note ?? null;
      const dernieres = [...evals].sort((a, b) => b.date.localeCompare(a.date));
      return {
        numero: p.numero,
        nom: p.raisonSociale,
        type: TYPE_PRESTATAIRE[p.type],
        niveau: note?.niveau ? etat(NIVEAU_PRESTATAIRE[note.niveau].libelle, NIVEAU_PRESTATAIRE[note.niveau].ton, note.score ?? 0) : etat("Non noté", "neutre", -1),
        note: note?.score ?? null,
        evaluations: evals.length,
        qualite: r?.qualite ?? null,
        delai: r?.delai ?? null,
        prix: r?.prix ?? null,
        reprises: r?.reprises ?? 0,
        interventions: compte?.faits.interventions ?? 0,
        anciennete: r?.anciennete ?? null,
        montant: r?.montant ?? 0,
        derniereEvaluation: dernieres[0]?.date ?? null,
        commentaire: dernieres[0]?.commentaire ?? null,
      };
    })
    .filter((l) => (l.interventions as number) > 0 || (l.evaluations as number) > 0)
    .sort((a, b) => ((b.note as number) ?? -1) - ((a.note as number) ?? -1));
}

/* -- L'aiguillage -------------------------------------------------------------- */

/**
 * Les lignes d'un rapport. Un identifiant inconnu ne renvoie rien plutôt que de
 * lever : la page dira « rapport introuvable », et l'application tient debout.
 */
export function construireRapportDe(s: SourceRapports, id: string, c: ContexteRapport = CONTEXTE_PAR_DEFAUT, parametres: Parametres = PARAMETRES_DEFAUT): LigneRapport[] {
  switch (id) {
    case "flotte-details":
      return detailsVehicules(s);
    case "flotte-affectations":
      return affectations(s);
    case "flotte-disponibilite":
      return disponibilite(s);
    case "flotte-sans-intervention":
      return sansIntervention(s, c);
    case "couts-vehicule":
      return coutsParVehicule(s, c);
    case "couts-poste-mois":
      return coutsParPoste(s, c);
    case "couts-business-unit":
      return coutsParBusinessUnit(s, c);
    case "couts-categorie":
      return coutsParCategorie(s, c);
    case "carburant-pleins":
      return pleins(s, c);
    case "carburant-consommation":
      return consommation(s, c);
    case "carburant-cuve":
      return cuve(s, c);
    case "maintenance-interventions":
      return interventions(s, c);
    case "maintenance-ordres":
      return ordres(s, c);
    case "maintenance-a-faire":
      return aFaire(s);
    case "conformite-documents":
      return documents(s, parametres);
    case "incidents-declarations":
      return incidents(s, c);
    case "chauffeurs-details":
      return chauffeurs(s);
    case "chauffeurs-performance":
      return performance(s);
    case "achats-demandes":
      return demandes(s, c);
    case "caisse-journal":
      return caisse(s, c);
    case "prestataires-activite":
      return prestataires(s);
    case "transporteurs-affretements":
      return affretementsRapport(s, c);
    case "transport-releve":
      return releveRapport(s, c);
    case "transporteurs-activite":
      return activiteTransporteurs(s, c);
    case "transporteurs-mises-a-disposition":
      return misesRapport(s, c);
    case "transporteurs-prestations":
      return prestationsRapport(s, c);
    case "transporteurs-efficacite":
      return efficaciteTransport(s, c);
    case "transport-destinations":
      return destinationsTransport(s, c);
    case "budget-postes":
      return budgetPostes(s);
    case "budget-enveloppes":
      return budgetEnveloppes(s);
    case "budget-engagements":
      return budgetEngagements(s);
    case "conformite-vehicule":
      return conformiteVehicules(s, parametres);
    case "conformite-visites":
      return visitesTechniques(s, c);
    case "incidents-vehicule":
      return sinistraliteVehicules(s, c);
    case "incidents-chauffeur":
      return sinistraliteChauffeurs(s, c);
    case "chauffeurs-discipline":
      return disciplineChauffeurs(s);
    case "chauffeurs-frais":
      return fraisDeRoute(s, c);
    case "achats-cycle":
      return cycleAchats(s, c);
    case "prestataires-comptes":
      return comptesPrestataires(s);
    case "prestataires-evaluations":
      return notationPrestataires(s);
    case "parc-leger-inventaire":
      return inventaireLeger(s, parametres);
    case "parc-leger-attributaires":
      return attributairesLeger(s, parametres);
    case "parc-leger-plan-car":
      return planCarLeger(s, parametres);
    case "parc-leger-forfaits":
      return forfaitsLeger(s, c, parametres);
    case "parc-leger-charges-bu":
      return chargesLegerParBu(s, c, parametres);
    case "parc-leger-renouvellement":
      return renouvellementLeger(s);
    case "parc-leger-immobilises":
      return immobilisesLeger(s);
    case "parc-leger-pool":
      return poolLeger(s);
    default:
      return [];
  }
}

/* -- Le parc léger ------------------------------------------------------------
   Cadrage du 7 septembre 2026. Les lignes viennent de l'inventaire du dossier
   DO (`parc-leger-demo.ts`) ; les forfaits, de la même fabrique que le budget
   et les coûts. Le régime d'usage et l'état se lisent en pastilles ; la BU
   est celle de l'agent. */

const tonEtatLeger = (e: keyof typeof ETAT_LEGER): ValeurEtat => etat(ETAT_LEGER[e].libelle, ETAT_LEGER[e].ton, ["actif", "pool", "a-recevoir", "panne", "a-reformer"].indexOf(e));

function inventaireLeger(s: SourceRapports, parametres: Parametres): LigneRapport[] {
  const parId = new Map(s.parcLeger.attributaires.map((a) => [a.id, a]));
  const forfaitPar = new Map(s.parcLeger.forfaits.map((f) => [f.attributaireId, f.montantMensuel ?? parametres.parcLeger.forfaitCarburantMensuel]));
  return s.parcLeger.vehicules.map((v) => {
    const a = v.attributaireId ? (parId.get(v.attributaireId) ?? null) : null;
    return {
      immatriculation: v.immatriculationAffichee,
      immatriculationCanonique: v.immatriculation,
      vehicule: `${v.marque} ${v.modele}`,
      marque: v.marque,
      modele: v.modele,
      annee: v.annee === null ? null : String(v.annee),
      km: v.kilometrage,
      categorie: CATEGORIE_VEHICULE[v.categorie],
      regime: REGIME_USAGE[v.regime].libelle,
      etat: tonEtatLeger(v.etat),
      attributaire: a?.nom ?? v.pool,
      fonction: a?.fonction ?? null,
      departement: v.departement,
      businessUnit: v.businessUnit ? BUSINESS_UNIT[v.businessUnit] : null,
      planCar: v.planCar !== null,
      forfait: a && forfaitPar.has(a.id) && (v.etat === "actif" || v.etat === "a-recevoir") ? forfaitPar.get(a.id)! : null,
      lot: v.lot,
      observation: v.commentaire,
    };
  });
}

function attributairesLeger(s: SourceRapports, parametres: Parametres): LigneRapport[] {
  const vehicules = s.parcLeger.vehicules;
  const forfaitPar = new Map(s.parcLeger.forfaits.map((f) => [f.attributaireId, f.montantMensuel ?? parametres.parcLeger.forfaitCarburantMensuel]));
  return s.parcLeger.attributaires.map((a) => {
    const tenus = vehicules.filter((v) => v.attributaireId === a.id);
    const forfait = forfaitPar.get(a.id) ?? null;
    return {
      nom: a.nom,
      fonction: a.fonction,
      departement: a.departement,
      businessUnit: a.businessUnit ? BUSINESS_UNIT[a.businessUnit] : null,
      vehicules: tenus.length,
      immatriculations: tenus.map((v) => v.immatriculationAffichee).join(", ") || null,
      regime: [...new Set(tenus.map((v) => REGIME_USAGE[v.regime].libelle))].join(", ") || null,
      planCar: tenus.some((v) => v.planCar !== null),
      forfait,
      chargeAnnuelle: forfait === null ? null : forfait * 12,
    };
  });
}

function planCarLeger(s: SourceRapports, parametres: Parametres): LigneRapport[] {
  const parId = new Map(s.parcLeger.attributaires.map((a) => [a.id, a]));
  const forfaitPar = new Map(s.parcLeger.forfaits.map((f) => [f.attributaireId, f.montantMensuel ?? parametres.parcLeger.forfaitCarburantMensuel]));
  return s.parcLeger.vehicules
    .filter((v) => v.planCar !== null)
    .map((v) => {
      const a = v.attributaireId ? (parId.get(v.attributaireId) ?? null) : null;
      const e = echeancierPlanCar(v.planCar!, parametres.parcLeger.planCarDureeMois, s.aujourdhui);
      return {
        immatriculation: v.immatriculationAffichee,
        immatriculationCanonique: v.immatriculation,
        vehicule: `${v.marque} ${v.modele}`,
        attributaire: a?.nom ?? null,
        fonction: a?.fonction ?? null,
        businessUnit: v.businessUnit ? BUSINESS_UNIT[v.businessUnit] : null,
        dureeMois: e.dureeMois,
        debut: v.planCar!.debut ?? "à renseigner",
        moisEcoules: e.moisEcoules,
        cessionPrevue: e.cessionPrevue ?? "début à renseigner",
        statut: v.planCar!.statut === "cede" ? etat("Cédé", "neutre", 1) : etat("En cours", "favorable", 0),
        forfait: a ? (forfaitPar.get(a.id) ?? null) : null,
      };
    });
}

function forfaitsLeger(s: SourceRapports, c: ContexteRapport, parametres: Parametres): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  const parId = new Map(s.parcLeger.attributaires.map((a) => [a.id, a]));
  const parVehicule = new Map(s.parcLeger.vehicules.map((v) => [v.id, v]));
  const parCarte = new Map<string, { montant: number; mois: Set<string>; forfait: number; vehiculeId: string }>();
  for (const d of depensesForfaitsDe(s.parcLeger, s.aujourdhui, parametres.parcLeger.forfaitCarburantMensuel)) {
    if (!dansLaPeriode(d.date, debut, fin)) continue;
    const v = parVehicule.get(d.vehiculeId);
    const cle = v?.attributaireId ?? d.vehiculeId;
    const x = parCarte.get(cle) ?? { montant: 0, mois: new Set<string>(), forfait: d.montant, vehiculeId: d.vehiculeId };
    x.montant += d.montant;
    x.mois.add(d.mois);
    parCarte.set(cle, x);
  }
  return [...parCarte.entries()].map(([cle, x]) => {
    const a = parId.get(cle) ?? null;
    const v = parVehicule.get(x.vehiculeId)!;
    return {
      attributaire: a?.nom ?? v.pool ?? "—",
      fonction: a?.fonction ?? null,
      immatriculation: v.immatriculationAffichee,
      immatriculationCanonique: v.immatriculation,
      vehicule: `${v.marque} ${v.modele}`,
      departement: v.departement,
      businessUnit: v.businessUnit ? BUSINESS_UNIT[v.businessUnit] : null,
      forfait: x.forfait,
      mois: x.mois.size,
      montant: x.montant,
    };
  });
}

function chargesLegerParBu(s: SourceRapports, c: ContexteRapport, parametres: Parametres): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, s.aujourdhui);
  const vehicules = s.parcLeger.vehicules.filter((v) => v.regime !== "exploitation");
  const forfaitPar = new Map(s.parcLeger.forfaits.map((f) => [f.attributaireId, f.montantMensuel ?? parametres.parcLeger.forfaitCarburantMensuel]));
  const parBu = new Map<string, { vehicules: number; service: number; fonction: number; cartes: Set<string>; forfaitMensuel: number; montant: number }>();
  const de = (bu: string) => {
    let x = parBu.get(bu);
    if (!x) {
      x = { vehicules: 0, service: 0, fonction: 0, cartes: new Set(), forfaitMensuel: 0, montant: 0 };
      parBu.set(bu, x);
    }
    return x;
  };
  for (const v of vehicules) {
    const bu = v.businessUnit ? BUSINESS_UNIT[v.businessUnit] : "Sans BU";
    const x = de(bu);
    x.vehicules += 1;
    if (v.regime === "service") x.service += 1;
    if (v.regime === "fonction") x.fonction += 1;
    if (v.attributaireId && forfaitPar.has(v.attributaireId) && (v.etat === "actif" || v.etat === "a-recevoir") && !x.cartes.has(v.attributaireId)) {
      x.cartes.add(v.attributaireId);
      x.forfaitMensuel += forfaitPar.get(v.attributaireId)!;
    }
  }
  for (const d of depensesForfaitsDe(s.parcLeger, s.aujourdhui, parametres.parcLeger.forfaitCarburantMensuel)) {
    if (!dansLaPeriode(d.date, debut, fin)) continue;
    de(d.businessUnit ? BUSINESS_UNIT[d.businessUnit] : "Sans BU").montant += d.montant;
  }
  const total = [...parBu.values()].reduce((t, x) => t + x.montant, 0);
  return [...parBu.entries()]
    .sort((a, b) => b[1].montant - a[1].montant)
    .map(([bu, x]) => ({ businessUnit: bu, vehicules: x.vehicules, service: x.service, fonction: x.fonction, cartes: x.cartes.size, forfaitMensuel: x.forfaitMensuel, montant: x.montant, part: total > 0 ? arrondir((x.montant / total) * 100) : null }));
}

function renouvellementLeger(s: SourceRapports): LigneRapport[] {
  const parId = new Map(s.parcLeger.attributaires.map((a) => [a.id, a]));
  return s.parcLeger.vehicules
    .filter((v) => v.lot !== null)
    .sort((a, b) => a.lot!.localeCompare(b.lot!) || a.etat.localeCompare(b.etat))
    .map((v) => {
      const a = v.attributaireId ? (parId.get(v.attributaireId) ?? null) : null;
      return {
        lot: v.lot,
        vehicule: `${v.immatriculation ? v.immatriculationAffichee + " · " : ""}${v.marque} ${v.modele}`,
        etat: tonEtatLeger(v.etat),
        beneficiaire: a?.nom ?? v.pool ?? null,
        fonction: a?.fonction ?? null,
        departement: v.departement,
        businessUnit: v.businessUnit ? BUSINESS_UNIT[v.businessUnit] : null,
        regime: REGIME_USAGE[v.regime].libelle,
        devenir: v.commentaire,
      };
    });
}

function immobilisesLeger(s: SourceRapports): LigneRapport[] {
  return s.parcLeger.vehicules
    .filter((v) => v.etat === "panne" || v.etat === "a-reformer")
    .map((v) => ({
      immatriculation: v.immatriculationAffichee,
      immatriculationCanonique: v.immatriculation,
      vehicule: `${v.marque} ${v.modele}`,
      annee: v.annee === null ? null : String(v.annee),
      km: v.kilometrage,
      etat: tonEtatLeger(v.etat),
      departement: v.departement,
      businessUnit: v.businessUnit ? BUSINESS_UNIT[v.businessUnit] : null,
      ancienDetenteur: v.commentaire?.match(/ancien véhicule d[e'’]\s*([^—,.]+)/i)?.[1]?.trim() ?? null,
      motif: v.commentaire,
    }));
}

function poolLeger(s: SourceRapports): LigneRapport[] {
  return s.parcLeger.vehicules
    .filter((v) => v.etat === "pool")
    .map((v) => ({
      immatriculation: v.immatriculationAffichee,
      immatriculationCanonique: v.immatriculation,
      vehicule: `${v.marque} ${v.modele}`,
      categorie: CATEGORIE_VEHICULE[v.categorie],
      pool: v.pool ?? v.departement,
      departement: v.departement,
      businessUnit: v.businessUnit ? BUSINESS_UNIT[v.businessUnit] : null,
      etat: tonEtatLeger(v.etat),
      observation: v.commentaire,
    }));
}

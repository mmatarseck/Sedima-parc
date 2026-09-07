/* ============================================================================
 * Les lignes de chaque rapport standard, construites depuis les fiches.
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
 * Au branchement, une vue Supabase par rapport, bornée par les mêmes dates.
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
import type { PosteDepense, StatutVehicule } from "@/domaine/types";
import { demandesAchat, journalCaisse, statistiquesPrestataires } from "./caisse-demo";
import { livraisonsEtJauges, pleinsFlotte } from "./carburant-demo";
import { DATE_REFERENCE, fichesChauffeurs, listeChauffeurs } from "./chauffeurs-demo";
import { donneesCouts } from "./couts-demo";
import { fichePourImmatriculation, libelleMois } from "./fiche-demo";
import { listeIncidents } from "./incidents-demo";
import { interventionsFlotte, ordresDeTravail, travauxAFaire } from "./maintenance-demo";
import { FLOTTE } from "./parc-demo";
import { listePrestataires } from "./prestataires-demo";
import { affretements as tousAffretements, grillesTarifaires, misesADisposition, prestations as toutesPrestations, transporteurs as listeTransporteurs } from "./transporteurs-demo";
import { profilTransporteur, rattachements as rattachementsLocalitesDe } from "./flotte-tierce-demo";
import { MODE_EXECUTION, PRODUIT_TRANSPORTE, ecartPesee } from "@/domaine/releve-transport";
import { MODE_REMUNERATION } from "@/domaine/flotte-tierce";
import { ETAT_BUDGET } from "@/domaine/budget";
import { donneesBudget, fichePoste } from "./budget-demo";
import { NIVEAU_PRESTATAIRE, ageDette, avanceOuverte, noterPrestataire } from "@/domaine/compte-prestataire";
import { activiteTransport, ancienneteMois, avancesDe, dettesDe, evaluationsDe, repriseDe } from "./compte-prestataire-demo";
import { fichePrestataire } from "./fiche-prestataire-demo";
import { relevesTransport } from "./releve-demo";
import { ETAT_LEGER, REGIME_USAGE, echeancierPlanCar } from "@/domaine/parc-leger";
import { attributaires as tousAttributaires, depensesForfaits, forfaitsCarburant, vehiculesLegers } from "./parc-leger-demo";

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

/** Ce qu'un véhicule apporte à toute ligne qui le cite — les colonnes communes. */
function situation(vehiculeId: string): LigneRapport {
  const l = FLOTTE.find((x) => x.vehicule.id === vehiculeId);
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

function detailsVehicules(parametres: Parametres): LigneRapport[] {
  return FLOTTE.map((l) => {
    const v = l.vehicule;
    const f = fichePourImmatriculation(v.immatriculation, parametres);
    const immobilisation = f?.immobilisationAdministrative ?? null;
    const statutEffectif = immobilisation?.statut ?? v.statut;
    const identite = f?.identite;
    const mec = identite?.premiereMiseEnCirculation ?? v.premiereMiseEnCirculation;
    const aTraiter = (f?.documents ?? []).filter((d) => d.etat === "manquant" || d.etat === "echu" || d.etat === "bientot").length;
    const echeance = f?.echeances[0] ?? null;
    return {
      ...situation(v.id),
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
      age: mec ? arrondir((joursEntre(mec, DATE_REFERENCE) ?? 0) / 365.25) : null,
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
      coutDouzeMois: f?.indicateurs.coutDouzeMois ?? l.coutDouzeMois,
      coutParKm: f?.indicateurs.coutParKm ?? null,
      consommationL100: arrondir(f?.indicateurs.consommationL100),
      disponibilite: f?.indicateurs.disponibilitePct ?? null,
      prochaineEcheance: echeance ? `${echeance.libelle} · ${echeance.repere}` : null,
      documentsATraiter: aTraiter,
      attelage: l.attelageCourant ? `${l.attelageCourant.role === "tracteur" ? "tire" : "tirée par"} ${l.attelageCourant.immatriculationAffichee}` : null,
      region: identite?.region ?? l.site?.region ?? null,
      commentaire: v.commentaire,
    };
  });
}

function affectations(parametres: Parametres): LigneRapport[] {
  const chauffeurs = new Map(listeChauffeurs().map((c) => [c.id, c]));
  return FLOTTE.map((l) => {
    const v = l.vehicule;
    const f = fichePourImmatriculation(v.immatriculation, parametres);
    const statutEffectif = f?.immobilisationAdministrative?.statut ?? v.statut;
    const enCours = (f?.affectations ?? []).filter((a) => a.fin === null && a.chauffeurId);
    const titulaire = enCours.find((a) => a.role === "titulaire") ?? null;
    const suppleants = enCours.filter((a) => a.role === "suppleant");
    const c = titulaire?.chauffeurId ? (chauffeurs.get(titulaire.chauffeurId) ?? null) : null;
    return {
      ...situation(v.id),
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
      anciennete: joursEntre(titulaire?.debut ?? null, DATE_REFERENCE),
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

function disponibilite(parametres: Parametres): LigneRapport[] {
  const chauffeurs = new Map(listeChauffeurs().map((c) => [c.id, c]));
  return FLOTTE.map((l) => {
    const v = l.vehicule;
    const f = fichePourImmatriculation(v.immatriculation, parametres);
    const immobilisation = f?.immobilisationAdministrative ?? null;
    const statutEffectif = immobilisation?.statut ?? v.statut;
    const conducteur = conducteurDuJour(f?.affectations ?? [], chauffeurs, DATE_REFERENCE);
    const { etat: e, motif } = etatDisponibilite({ engage: v.engage, statutEffectif, conducteur, immobilisation });
    return {
      ...situation(v.id),
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
      chargeUtile: f?.identite.chargeUtile ?? v.chargeUtile,
      kilometrage: l.kilometrage,
    };
  });
}

function sansIntervention(c: ContexteRapport, parametres: Parametres): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  const mois = new Set(moisCouverts(debut, fin));
  const interventions = interventionsFlotte();
  const lignes: LigneRapport[] = [];
  for (const l of FLOTTE) {
    const v = l.vehicule;
    if (interventions.some((i) => i.vehiculeId === v.id && dansLaPeriode(i.date, debut, fin))) continue;
    const f = fichePourImmatriculation(v.immatriculation, parametres);
    const statutEffectif = f?.immobilisationAdministrative?.statut ?? v.statut;
    const derniere = interventions.filter((i) => i.vehiculeId === v.id).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
    const donnees = donneesCouts().find((d) => d.vehiculeId === v.id) ?? null;
    lignes.push({
      ...situation(v.id),
      statut: etat(STATUT_VEHICULE[statutEffectif].libelle, tonStatut(statutEffectif)),
      derniereIntervention: derniere?.date ?? null,
      joursDepuis: derniere ? joursEntre(derniere.date, DATE_REFERENCE) : null,
      objetDerniere: derniere?.objet ?? null,
      garageDernier: derniere?.garage ?? null,
      kmPeriode: donnees ? donnees.mois.filter((m) => mois.has(m.mois)).reduce((s, m) => s + m.km, 0) : null,
      kilometrage: l.kilometrage,
      dernierPlein: f?.pleins[0]?.date ?? null,
      prochainEntretien: f?.prochaineIntervention ? `${f.prochaineIntervention.libelle} — dans ${f.prochaineIntervention.kmRestants} km` : null,
    });
  }
  return lignes;
}

/* -- Coûts -------------------------------------------------------------------- */

/** Les bilans de la période, qualifiés sur toute la flotte — la même lecture que Coûts. */
function bilans(c: ContexteRapport): BilanVehicule[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  return qualifier(donneesCouts().map((d) => bilanVehicule(d, moisCouverts(debut, fin), c.perimetre)));
}

function coutsParVehicule(c: ContexteRapport): LigneRapport[] {
  return bilans(c).map((b) => {
    const d = b.donnees;
    return {
      ...situation(d.vehiculeId),
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
      valeurAcquisition: FLOTTE.find((x) => x.vehicule.id === d.vehiculeId)?.vehicule.valeurAcquisition ?? null,
    };
  });
}

function coutsParPoste(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  const mois = moisCouverts(debut, fin);
  const retenus = new Set(mois);
  const liste = bilans(c);
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
  const total = [...parPoste.values()].reduce((s, x) => s + x, 0);
  /*
   * **Le dernier mois révolu, jamais le mois en cours.** Au 2 septembre, le
   * mois courant porte deux jours de dépenses : le comparer à une moyenne de
   * douze mois annonçait « −100 % » sur le carburant, ce qui se lit comme un
   * effondrement alors que le mois vient de commencer. On prend donc le dernier
   * mois complet de la fenêtre, et la colonne dit lequel.
   */
  const moisCourant = DATE_REFERENCE.slice(0, 7);
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

function coutsParBusinessUnit(c: ContexteRapport): LigneRapport[] {
  const liste = bilans(c);
  const total = liste.reduce((s, b) => s + b.total, 0);
  const parBu = new Map<string, BilanVehicule[]>();
  for (const b of liste) {
    const cle = b.donnees.businessUnit ? BUSINESS_UNIT[b.donnees.businessUnit] : "Non rattaché";
    parBu.set(cle, [...(parBu.get(cle) ?? []), b]);
  }
  return [...parBu.entries()]
    .map(([businessUnit, bs]) => {
      const km = bs.reduce((s, b) => s + b.km, 0);
      const litres = bs.reduce((s, b) => s + b.litres, 0);
      const somme = bs.reduce((s, b) => s + b.total, 0);
      return {
        businessUnit,
        vehicules: bs.length,
        km,
        carburant: bs.reduce((s, b) => s + b.parGroupe.carburant, 0),
        maintenance: bs.reduce((s, b) => s + b.parGroupe.maintenance, 0),
        autres: bs.reduce((s, b) => s + b.parGroupe.autres, 0),
        total: somme,
        part: total > 0 ? arrondir((somme / total) * 100) : null,
        coutParKm: km > 0 ? Math.round(somme / km) : null,
        litres: Math.round(litres),
        l100: km > 0 ? arrondir((litres / km) * 100) : null,
        curatifs: bs.reduce((s, b) => s + b.curatifs, 0),
        immobilisation: bs.reduce((s, b) => s + b.immobilisationJours, 0),
        parVehicule: bs.length > 0 ? Math.round(somme / bs.length) : null,
      };
    })
    .sort((a, b) => (b.total as number) - (a.total as number));
}

function coutsParCategorie(c: ContexteRapport): LigneRapport[] {
  const liste = bilans(c);
  const parCategorie = new Map<string, BilanVehicule[]>();
  for (const b of liste) {
    const cle = CATEGORIE_VEHICULE[b.donnees.categorie];
    parCategorie.set(cle, [...(parCategorie.get(cle) ?? []), b]);
  }
  return [...parCategorie.entries()]
    .map(([categorie, bs]) => {
      const avecCout = bs.filter((b) => b.coutParKm !== null).sort((a, b) => a.coutParKm! - b.coutParKm!);
      const median = avecCout.length ? avecCout[Math.floor(avecCout.length / 2)]!.coutParKm! : null;
      const km = bs.reduce((s, b) => s + b.km, 0);
      const litres = bs.reduce((s, b) => s + b.litres, 0);
      const plusCher = avecCout[avecCout.length - 1] ?? null;
      return {
        categorie,
        vehicules: bs.length,
        km,
        total: bs.reduce((s, b) => s + b.total, 0),
        coutParKmMedian: median,
        coutParKmMin: avecCout.length ? avecCout[0]!.coutParKm : null,
        coutParKmMax: plusCher?.coutParKm ?? null,
        vehiculeMax: plusCher ? `${plusCher.donnees.immatriculationAffichee} · ${plusCher.donnees.libelle}` : null,
        litres: Math.round(litres),
        l100: km > 0 ? arrondir((litres / km) * 100) : null,
        referenceL100: bs[0]?.donnees.referenceL100 ?? null,
        aArbitrer: median === null ? 0 : bs.filter((b) => b.coutParKm !== null && b.coutParKm > median).length,
        immobilisation: bs.reduce((s, b) => s + b.immobilisationJours, 0),
      };
    })
    .sort((a, b) => (b.total as number) - (a.total as number));
}

/* -- Carburant ---------------------------------------------------------------- */

function pleins(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  const tous = pleinsFlotte();
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
        ...situation(p.vehiculeId),
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

function consommation(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  const mois = moisCouverts(debut, fin);
  const parVehicule = new Map<string, { litres: number; montant: number; nombre: number }>();
  for (const p of pleinsFlotte()) {
    if (!dansLaPeriode(p.date, debut, fin)) continue;
    const x = parVehicule.get(p.vehiculeId) ?? { litres: 0, montant: 0, nombre: 0 };
    parVehicule.set(p.vehiculeId, { litres: x.litres + p.litres, montant: x.montant + p.montant, nombre: x.nombre + 1 });
  }
  return donneesCouts()
    .map((d) => {
      const b = bilanVehicule(d, mois, c.perimetre);
      const ecart = b.ecartL100Pct;
      const p = parVehicule.get(d.vehiculeId) ?? { litres: 0, montant: 0, nombre: 0 };
      return {
        ...situation(d.vehiculeId),
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

function cuve(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  return livraisonsEtJauges()
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

function interventions(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  return interventionsFlotte()
    .filter((i) => dansLaPeriode(i.date, debut, fin))
    .map((i) => ({
      ...situation(i.vehiculeId),
      date: i.date,
      type: i.type === "preventif" ? etat("Préventif", "favorable", 0) : etat("Curatif", "vigilance", 1),
      objet: i.objet,
      garage: i.garage,
      km: i.km,
      cout: i.montant,
      immobilisation: i.immobilisationJours,
      coutParJour: i.immobilisationJours > 0 ? Math.round(i.montant / i.immobilisationJours) : null,
      reference: i.reference,
      numero: i.numero,
      creee: i.creee,
    }));
}

function ordres(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  const TON: Record<string, Ton> = { planifie: "neutre", "en-atelier": "vigilance", clos: "favorable", annule: "defavorable" };
  const RANG: Record<string, number> = { "en-atelier": 0, planifie: 1, clos: 2, annule: 3 };
  return ordresDeTravail()
    .filter((o) => dansLaPeriode(o.datePrevue, debut, fin))
    .map((o) => ({
      ...situation(o.vehiculeId),
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

function aFaire(): LigneRapport[] {
  return travauxAFaire().map((t) => ({
    ...situation(t.vehiculeId),
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

function documents(parametres: Parametres): LigneRapport[] {
  const lignes: LigneRapport[] = [];
  const TON: Record<string, Ton> = { "a-jour": "favorable", permanent: "favorable", bientot: "vigilance", echu: "defavorable", manquant: "defavorable" };
  const RANG: Record<string, number> = { manquant: 0, echu: 1, bientot: 2, "a-jour": 3, permanent: 4 };
  const LIBELLE: Record<string, string> = { "a-jour": "À jour", bientot: "Bientôt échu", echu: "Échu", manquant: "Manquant", permanent: "Permanent" };

  for (const l of FLOTTE) {
    const v = l.vehicule;
    const f = fichePourImmatriculation(v.immatriculation, parametres);
    const situe = situation(v.id);
    for (const d of f?.documents ?? []) {
      const def = definitionDocument(d.type, parametres);
      lignes.push({
        porteur: v.immatriculationAffichee,
        typePorteur: "Véhicule",
        document: TYPE_DOCUMENT[d.type],
        etat: etat(LIBELLE[d.etat] ?? d.etat, TON[d.etat] ?? "neutre", RANG[d.etat] ?? 9),
        echeance: d.echeance,
        joursRestants: d.joursRestants,
        dateEffet: d.dateEffet,
        critique: Boolean(def?.critique),
        emetteur: d.emetteur,
        numeroPiece: d.numeroPiece,
        montant: d.montant,
        justificatif: d.justificatif,
        categorie: situe.categorie ?? null,
        businessUnit: situe.businessUnit ?? null,
        site: situe.site ?? null,
        validite: def?.validiteMois ?? null,
      });
    }
  }
  /* Les chauffeurs portent leurs propres pièces : permis et visite médicale.
     La conformité du parc est celle des véhicules **et** de ceux qui les
     conduisent — un même rapport, une même table. */
  for (const c of listeChauffeurs()) {
    for (const [type, e] of [["permis", c.permis] as const, ["visite-medicale", c.visiteMedicale] as const]) {
      const cle = e.manquant ? "manquant" : e.joursRestants !== null && e.joursRestants < 0 ? "echu" : e.joursRestants !== null && e.joursRestants <= 60 ? "bientot" : "a-jour";
      lignes.push({
        porteur: c.nomComplet,
        typePorteur: "Chauffeur",
        document: TYPE_DOCUMENT[type],
        etat: etat(LIBELLE[cle]!, TON[cle]!, RANG[cle]!),
        echeance: e.echeance,
        joursRestants: e.joursRestants,
        dateEffet: null,
        critique: true,
        emetteur: null,
        numeroPiece: type === "permis" ? c.chauffeur.permisNumero : null,
        montant: null,
        justificatif: !e.manquant,
        categorie: null,
        businessUnit: null,
        site: c.site?.libelle ?? null,
        validite: definitionDocument(type, parametres)?.validiteMois ?? null,
      });
    }
  }
  return lignes;
}

/* -- Incidents ---------------------------------------------------------------- */

function incidents(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  return listeIncidents()
    .filter((i) => dansLaPeriode(i.dateHeure, debut, fin))
    .map((i) => ({
      ...situation(i.vehiculeId),
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

function chauffeurs(): LigneRapport[] {
  return listeChauffeurs().map((c) => {
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
      anciennete: ch.dateEmbauche ? arrondir((joursEntre(ch.dateEmbauche, DATE_REFERENCE) ?? 0) / 365.25) : null,
      telephone: ch.telephone,
      aptitudeMotif: ch.aptitudeMotif,
    };
  });
}

function performance(): LigneRapport[] {
  /* Le mois révolu : celui sur lequel le métier prime, jamais le mois en cours. */
  const [a, m] = DATE_REFERENCE.split("-").map(Number);
  const moisRevolu = new Date(Date.UTC(a!, m! - 2, 1)).toISOString().slice(0, 7);
  const lignes = listeChauffeurs();
  const sites = new Map(lignes.map((c) => [c.id, c.site?.libelle ?? null]));
  const vehicules = new Map(lignes.map((c) => [c.id, c.vehiculeTitulaire?.immatriculationAffichee ?? null]));
  const noms = new Map(lignes.map((c) => [c.id, c.nomComplet]));
  return classer(fichesChauffeurs(), moisRevolu).map((l) => {
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

function demandes(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  const TON_URGENCE: Record<string, Ton> = { immobilisant: "defavorable", urgente: "vigilance", normale: "neutre" };
  return demandesAchat()
    .filter((d) => dansLaPeriode(d.date, debut, fin))
    .map((d) => {
      const facture = d.montantReel ?? (d.etape === "reglee" ? coutDe(d).montant : null);
      return {
        ...(d.vehiculeId ? situation(d.vehiculeId) : {}),
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

function caisse(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  return journalCaisse()
    .filter((m) => dansLaPeriode(m.date, debut, fin))
    .map((m) => ({
      ...(m.vehiculeId ? situation(m.vehiculeId) : {}),
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

function prestataires(): LigneRapport[] {
  /* Les mêmes statistiques que la liste Prestataires : douze mois glissants,
     demandes commandées ou au-delà. Un rapport ne recompte pas. */
  const stats = statistiquesPrestataires();
  return listePrestataires().map((p) => {
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
function missionsDe(c: ContexteRapport) {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  const grilles = grillesTarifaires();
  const rattachementsLocalites = rattachementsLocalitesDe();
  return tousAffretements()
    .filter((a) => dansLaPeriode(a.date, debut, fin))
    .map((a) => {
      const tarif = tarifApplicable(grilles, a, rattachementsLocalites);
      return { a, tarif, attendu: montantAttendu(tarif, a) };
    });
}

function affretementsRapport(c: ContexteRapport): LigneRapport[] {
  return missionsDe(c).map(({ a, tarif, attendu }) => {
    const m = montantsDe(a, attendu);
    const e = ecartFacturation(a, attendu);
    return {
      numero: a.numero,
      date: a.date,
      transporteur: a.transporteur,
      origine: a.origine,
      destination: a.destination,
      businessUnit: a.businessUnit ? BUSINESS_UNIT[a.businessUnit] : null,
      motif: MOTIF_AFFRETEMENT[a.motif],
      subi: MOTIF_SUBI[a.motif],
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

function activiteTransporteurs(c: ContexteRapport): LigneRapport[] {
  const missions = missionsDe(c);
  const grilles = grillesTarifaires();
  return listeTransporteurs()
    .map((t) => {
      const siennes = missions.filter((m) => m.a.transporteurNumero === t.numero);
      const ecarts = siennes.map((m) => ecartFacturation(m.a, m.attendu)).filter((e): e is NonNullable<typeof e> => e !== null);
      const grille = grilles.filter((g) => g.transporteurNumero === t.numero);
      const source = grille.some((g) => g.source === "a-confirmer") ? "a-confirmer" : grille.some((g) => g.source === "accord-verbal") ? "accord-verbal" : grille.length ? "contrat" : null;
      const cout = siennes.reduce((s, m) => s + coutAffretement(m.a), 0);
      return {
        numero: t.numero,
        transporteur: t.raisonSociale,
        ville: t.ville,
        missions: siennes.length,
        tonnes: siennes.filter((m) => prestationFaite(m.a.statut)).reduce((s, m) => s + (m.a.tonnageLivre ?? m.a.tonnagePrevu), 0),
        cout,
        du: siennes.filter((m) => m.a.statut === "livre" || m.a.statut === "facture").reduce((s, m) => s + coutAffretement(m.a), 0),
        ecartMoyen: ecarts.length ? arrondir(ecarts.reduce((s, e) => s + e.pct, 0) / ecarts.length) : null,
        horsTolerance: ecarts.filter((e) => Math.abs(e.pct) > 5).length,
        subies: siennes.filter((m) => MOTIF_SUBI[m.a.motif]).length,
        baseTarif: source ? etat(SOURCE_TARIF[source].libelle, SOURCE_TARIF[source].ton) : etat("Aucune grille", "defavorable", -1),
        lignesGrille: grille.length,
        panier: siennes.length ? Math.round(cout / siennes.length) : null,
      };
    })
    .filter((t) => (t.missions as number) > 0 || (t.lignesGrille as number) > 0)
    .sort((a, b) => (b.cout as number) - (a.cout as number));
}

function misesRapport(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  /* La mise à disposition se date de son mois : on retient le mois dès qu'il
     touche la période, sans quoi un rapport « ce mois-ci » ne rendrait rien. */
  return misesADisposition()
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

function prestationsRapport(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  return toutesPrestations()
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
function releveRapport(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  const immatParc = new Map(FLOTTE.map((l) => [l.vehicule.id, l.vehicule.immatriculationAffichee]));
  return relevesTransport()
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
function efficaciteTransport(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  const lignes = relevesTransport().filter((l) => dansLaPeriode(l.date, debut, fin));

  /* Le coût du parc : la somme des bilans véhicules sur la même fenêtre. C'est
     le coût complet — carburant, maintenance, tout — puisque c'est à lui que
     le prix d'un tiers se compare. */
  const coutParc = bilans(c).reduce((s, b) => s + b.total, 0);

  const coutTiers = new Map<string, number>();
  const ajouter = (nom: string | null, montant: number) => {
    if (!nom) return;
    coutTiers.set(nom, (coutTiers.get(nom) ?? 0) + montant);
  };
  for (const a of tousAffretements()) if (dansLaPeriode(a.date, debut, fin)) ajouter(a.transporteur, coutAffretement(a));
  for (const m of misesADisposition()) if (`${m.mois}-15` >= debut && `${m.mois}-15` <= fin) ajouter(m.transporteur, coutMiseADisposition(m).total);
  for (const p of toutesPrestations()) if (dansLaPeriode(p.date, debut, fin)) ajouter(p.transporteur, montantsPrestation(p).factureTtc ?? 0);

  const profils = new Map(listeTransporteurs().map((t) => [t.raisonSociale, profilTransporteur(t.raisonSociale, t.numero)]));
  const numeros = new Map(listeTransporteurs().map((t) => [t.raisonSociale, t.numero]));

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

  const tonnesDe = (liste: typeof lignes) => liste.reduce((s, l) => s + (l.tonnagePese ?? l.tonnage), 0);
  const tonnesTotales = tonnesDe(lignes);
  const coutTotal = coutParc + [...coutTiers.values()].reduce((s, x) => s + x, 0);
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
        ecartPeseeMoyen: ecarts.length ? arrondir(ecarts.reduce((s, e) => s + e, 0) / ecarts.length) : null,
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
function destinationsTransport(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  const lignes = relevesTransport().filter((l) => dansLaPeriode(l.date, debut, fin));
  const grilles = grillesTarifaires();

  const parDestination = new Map<string, typeof lignes>();
  for (const l of lignes) {
    const liste = parDestination.get(l.destination) ?? [];
    liste.push(l);
    parDestination.set(l.destination, liste);
  }

  return [...parDestination.entries()]
    .map(([destination, liste]) => {
      const tonnes = liste.reduce((s, l) => s + (l.tonnagePese ?? l.tonnage), 0);
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
        tarifGrille: tarifs.length ? Math.round(tarifs.reduce((s, p) => s + p, 0) / tarifs.length) : null,
        tonnesParChargement: liste.length ? arrondir(tonnes / liste.length) : null,
        produits: [...new Set(liste.map((l) => PRODUIT_TRANSPORTE[l.produit].libelle))].join(", "),
        premier: dates[0] ?? null,
        dernier: dates[dates.length - 1] ?? null,
      };
    })
    .sort((a, b) => (b.tonnes as number) - (a.tonnes as number));
}

/* -- Budget -------------------------------------------------------------------- */

function budgetPostes(): LigneRapport[] {
  return donneesBudget().postes.map((p) => {
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

function budgetEnveloppes(): LigneRapport[] {
  return donneesBudget().postes.flatMap((p) =>
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

function budgetEngagements(): LigneRapport[] {
  const budget = donneesBudget();
  const budgetes = new Set(budget.postes.filter((p) => p.cumul.enveloppe.montant > 0).map((p) => p.poste));
  return budget.postes
    .flatMap((p) => fichePoste(p.poste)?.engagements.map((g) => ({ p, g })) ?? [])
    .map(({ p, g }) => ({
      date: g.date,
      objet: g.objet,
      poste: POSTE_DEPENSE[p.poste],
      businessUnit: g.businessUnit ? BUSINESS_UNIT[g.businessUnit] : null,
      fournisseur: g.fournisseur,
      montant: g.montant,
      bonCommande: g.bonCommande,
      immatriculation: g.immatriculationAffichee,
      age: joursEntre(g.date, DATE_REFERENCE),
      budgete: budgetes.has(p.poste),
      numero: g.numero,
    }))
    .sort((a, b) => (b.montant as number) - (a.montant as number));
}

/* -- Conformité, les autres angles --------------------------------------------- */

function conformiteVehicules(parametres: Parametres): LigneRapport[] {
  return FLOTTE.map((l) => {
    const v = l.vehicule;
    const f = fichePourImmatriculation(v.immatriculation, parametres);
    const docs = f?.documents ?? [];
    const compte = (etats: string[]) => docs.filter((d) => etats.includes(d.etat)).length;
    const critiques = docs.filter((d) => definitionDocument(d.type, parametres)?.critique);
    const immobilise = critiques.some((d) => d.etat === "echu" || d.etat === "manquant");
    /* La prochaine échéance : la pièce datée la plus proche, manquantes mises
       à part — une pièce absente n'a pas d'échéance, elle a un retard. */
    const datees = docs.filter((d) => d.echeance !== null && d.joursRestants !== null).sort((a, b) => (a.joursRestants ?? 0) - (b.joursRestants ?? 0));
    const prochaine = datees[0] ?? null;
    const echues = compte(["echu"]);
    const manquantes = compte(["manquant"]);
    return {
      ...situation(v.id),
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
      prochaine: prochaine ? TYPE_DOCUMENT[prochaine.type] : null,
      prochaineDate: prochaine?.echeance ?? null,
      joursRestants: prochaine?.joursRestants ?? null,
      immobilise,
      coutDocuments: docs.reduce((s, d) => s + (d.montant ?? 0), 0),
    };
  });
}

function visitesTechniques(c: ContexteRapport, parametres: Parametres): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  const lignes: LigneRapport[] = [];
  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation, parametres);
    for (const v of f?.visitesTechniques ?? []) {
      if (!dansLaPeriode(v.dateRendezVous, debut, fin)) continue;
      const observations = (f?.observationsVisite ?? []).filter((o) => o.visiteId === v.id);
      lignes.push({
        ...situation(l.vehicule.id),
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

function sinistraliteVehicules(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  const retenus = listeIncidents().filter((i) => dansLaPeriode(i.dateHeure, debut, fin));
  const km = new Map(bilans(c).map((b) => [b.donnees.vehiculeId, b.km]));
  return FLOTTE.map((l) => {
    const siens = retenus.filter((i) => i.vehiculeId === l.vehicule.id);
    const dates = siens.map((i) => i.dateHeure.slice(0, 10)).sort();
    const kmPeriode = km.get(l.vehicule.id) ?? 0;
    const responsables = siens.filter((i) => i.responsabilite === "sedima" || i.responsabilite === "partagee").length;
    return {
      ...situation(l.vehicule.id),
      statut: etat(STATUT_VEHICULE[l.vehicule.statut].libelle, tonStatut(l.vehicule.statut)),
      incidents: siens.length,
      accidents: siens.filter((i) => i.nature === "accident").length,
      cout: siens.reduce((s, i) => s + (i.cout ?? 0), 0),
      immobilisation: siens.reduce((s, i) => s + (i.immobilisationJours ?? 0), 0),
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

function sinistraliteChauffeurs(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  const dans = (d: string) => dansLaPeriode(d, debut, fin);
  const lignes = new Map(listeChauffeurs().map((x) => [x.id, x]));
  return fichesChauffeurs()
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
        cout: incidents.reduce((s, i) => s + i.cout, 0),
        immobilisation: incidents.reduce((s, i) => s + i.immobilisationJours, 0),
        contraventions: contraventions.length,
        coutContraventions: contraventions.reduce((s, x) => s + x.montant, 0),
        sanctions: sanctions.length,
        joursMiseAPied: sanctions.reduce((s, x) => s + (x.jours ?? 0), 0),
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

function disciplineChauffeurs(): LigneRapport[] {
  /* Douze mois glissants : une indisponibilité de l'an dernier ne dit plus rien
     de la disponibilité d'aujourd'hui. */
  const debut = new Date(Date.parse(DATE_REFERENCE) - 365 * 86_400_000).toISOString().slice(0, 10);
  return fichesChauffeurs()
    .map((f) => {
      const indispos = f.indisponibilites.filter((i) => (i.fin ?? DATE_REFERENCE) >= debut);
      const jours = indispos.reduce((s, i) => s + (joursEntre(i.debut < debut ? debut : i.debut, i.fin ?? DATE_REFERENCE) ?? 0), 0);
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
        joursMiseAPied: f.sanctions.reduce((s, x) => s + (x.jours ?? 0), 0),
        derniereSanction: sanctions[0] ? `${TYPE_SANCTION[sanctions[0].type]} — ${sanctions[0].motif}` : null,
        derniereSanctionDate: sanctions[0]?.date ?? null,
        contrat: CONTRAT_CHAUFFEUR[f.ligne.chauffeur.contrat],
        site: f.ligne.site?.libelle ?? null,
      };
    })
    .sort((a, b) => (b.joursIndisponible as number) - (a.joursIndisponible as number));
}

function fraisDeRoute(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  return fichesChauffeurs()
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

function cycleAchats(c: ContexteRapport): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  const delais = new Map(listePrestataires().map((p) => [p.numero, p.delaiPaiementJours]));
  return demandesAchat()
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
        versCommande: joursEntre(d.valideeLe ?? d.visaLe, d.numeroBonCommande ? (d.dateLivraison ?? d.dateFacture ?? DATE_REFERENCE) : null),
        versLivraison: joursEntre(d.valideeLe, d.dateLivraison),
        versFacture: joursEntre(d.dateLivraison, d.dateFacture),
        versReglement: paiement,
        total: joursEntre(d.date, d.dateReglement),
        /* L'âge ne vaut que pour ce qui n'est pas clos : une demande réglée
           n'a pas d'âge, elle a une durée. */
        age: d.dateReglement === null ? joursEntre(d.date, DATE_REFERENCE) : null,
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

function comptesPrestataires(): LigneRapport[] {
  return listePrestataires()
    .map((p) => {
      const dettes = dettesDe(p.numero);
      const av = avancesDe(p.numero);
      const echues = dettes.filter((d) => ageDette(d.echeance, DATE_REFERENCE) !== "a-venir");
      const retards = echues.map((d) => joursEntre(d.echeance, DATE_REFERENCE) ?? 0);
      const ouvertes = av.filter(avanceOuverte);
      const du = dettes.reduce((s, d) => s + d.montant, 0);
      const nonSoldees = ouvertes.reduce((s, a) => s + a.montant, 0);
      return {
        numero: p.numero,
        nom: p.raisonSociale,
        type: TYPE_PRESTATAIRE[p.type],
        pieces: dettes.length,
        du,
        echu: echues.reduce((s, d) => s + d.montant, 0),
        piecesEchues: echues.length,
        retardMax: retards.length ? Math.max(...retards) : null,
        avances: av.reduce((s, a) => s + a.montant, 0),
        avancesNonSoldees: nonSoldees,
        solde: du - nonSoldees,
        delaiPaiement: p.delaiPaiementJours,
        anciennete: ancienneteMois(dettes.map((d) => d.date)),
        ville: p.ville,
        telephone: p.telephone,
      };
    })
    .filter((l) => (l.pieces as number) > 0 || (l.avances as number) > 0)
    .sort((a, b) => (b.du as number) - (a.du as number));
}

function notationPrestataires(): LigneRapport[] {
  /* Le montant se prend sur **tout** ce que le prestataire a facturé au parc —
     interventions, demandes d'achat, sorties de caisse. Les seules demandes
     d'achat auraient affiché « 0 F » en face de dix-sept interventions : le
     garage qui n'est jamais passé par un bon de commande aurait eu l'air de
     n'avoir rien coûté. */
  const debut = new Date(Date.parse(DATE_REFERENCE) - 365 * 86_400_000).toISOString().slice(0, 10);
  return listePrestataires()
    .map((p) => {
      const fiche = fichePrestataire(p.numero);
      const evals = evaluationsDe(p.numero);
      const interventions = fiche?.interventions ?? [];
      /* L'ancienneté se prend sur **toutes** les traces, transport compris :
         sinon la note d'ADEX ne dirait pas la même chose ici et sur le
         référentiel prestataires, et une note qui varie selon l'écran ne vaut
         rien. */
      const transport = activiteTransport(p.raisonSociale, "0000-01-01");
      const note = noterPrestataire({
        evaluations: evals,
        interventions: interventions.length,
        reprises: repriseDe(interventions.map((i) => ({ date: i.date, objet: i.objet, vehiculeId: i.vehiculeId }))),
        ancienneteMois: ancienneteMois([...interventions.map((i) => i.date), ...(fiche?.demandes ?? []).map((d) => d.date), ...(fiche?.pleins ?? []).map((x) => x.date), ...transport.dates]),
      });
      const moyenne = (critere: "qualite" | "delai" | "prix") => (evals.length ? arrondir(evals.reduce((s, e) => s + e.notes[critere], 0) / evals.length) : null);
      const dernieres = [...evals].sort((a, b) => b.date.localeCompare(a.date));
      return {
        numero: p.numero,
        nom: p.raisonSociale,
        type: TYPE_PRESTATAIRE[p.type],
        niveau: note.niveau ? etat(NIVEAU_PRESTATAIRE[note.niveau].libelle, NIVEAU_PRESTATAIRE[note.niveau].ton, note.score ?? 0) : etat("Non noté", "neutre", -1),
        note: note.score,
        evaluations: evals.length,
        qualite: moyenne("qualite"),
        delai: moyenne("delai"),
        prix: moyenne("prix"),
        reprises: repriseDe(interventions.map((i) => ({ date: i.date, objet: i.objet, vehiculeId: i.vehiculeId }))),
        interventions: interventions.length,
        anciennete: ancienneteMois([...interventions.map((i) => i.date), ...(fiche?.demandes ?? []).map((d) => d.date), ...transport.dates]),
        montant:
          interventions.filter((i) => i.date >= debut).reduce((s, i) => s + i.montant, 0) +
          (fiche?.demandes ?? []).filter((d) => d.date >= debut).reduce((s, d) => s + coutDe(d).montant, 0) +
          (fiche?.depensesCaisse ?? []).filter((d) => d.date >= debut).reduce((s, d) => s + d.montant, 0) +
          /* Un transporteur ne passe pas par les demandes d'achat : ce qu'il
             coûte vit dans ses affrètements, ses mises à disposition et ses
             prestations. Sans cela, ADEX afficherait « 0 F ». */
          activiteTransport(p.raisonSociale, debut).montant,
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
export function construireRapport(id: string, c: ContexteRapport = CONTEXTE_PAR_DEFAUT, parametres: Parametres = PARAMETRES_DEFAUT): LigneRapport[] {
  switch (id) {
    case "flotte-details":
      return detailsVehicules(parametres);
    case "flotte-affectations":
      return affectations(parametres);
    case "flotte-disponibilite":
      return disponibilite(parametres);
    case "flotte-sans-intervention":
      return sansIntervention(c, parametres);
    case "couts-vehicule":
      return coutsParVehicule(c);
    case "couts-poste-mois":
      return coutsParPoste(c);
    case "couts-business-unit":
      return coutsParBusinessUnit(c);
    case "couts-categorie":
      return coutsParCategorie(c);
    case "carburant-pleins":
      return pleins(c);
    case "carburant-consommation":
      return consommation(c);
    case "carburant-cuve":
      return cuve(c);
    case "maintenance-interventions":
      return interventions(c);
    case "maintenance-ordres":
      return ordres(c);
    case "maintenance-a-faire":
      return aFaire();
    case "conformite-documents":
      return documents(parametres);
    case "incidents-declarations":
      return incidents(c);
    case "chauffeurs-details":
      return chauffeurs();
    case "chauffeurs-performance":
      return performance();
    case "achats-demandes":
      return demandes(c);
    case "caisse-journal":
      return caisse(c);
    case "prestataires-activite":
      return prestataires();
    case "transporteurs-affretements":
      return affretementsRapport(c);
    case "transport-releve":
      return releveRapport(c);
    case "transporteurs-activite":
      return activiteTransporteurs(c);
    case "transporteurs-mises-a-disposition":
      return misesRapport(c);
    case "transporteurs-prestations":
      return prestationsRapport(c);
    case "transporteurs-efficacite":
      return efficaciteTransport(c);
    case "transport-destinations":
      return destinationsTransport(c);
    case "budget-postes":
      return budgetPostes();
    case "budget-enveloppes":
      return budgetEnveloppes();
    case "budget-engagements":
      return budgetEngagements();
    case "conformite-vehicule":
      return conformiteVehicules(parametres);
    case "conformite-visites":
      return visitesTechniques(c, parametres);
    case "incidents-vehicule":
      return sinistraliteVehicules(c);
    case "incidents-chauffeur":
      return sinistraliteChauffeurs(c);
    case "chauffeurs-discipline":
      return disciplineChauffeurs();
    case "chauffeurs-frais":
      return fraisDeRoute(c);
    case "achats-cycle":
      return cycleAchats(c);
    case "prestataires-comptes":
      return comptesPrestataires();
    case "prestataires-evaluations":
      return notationPrestataires();
    case "parc-leger-inventaire":
      return inventaireLeger(parametres);
    case "parc-leger-attributaires":
      return attributairesLeger(parametres);
    case "parc-leger-plan-car":
      return planCarLeger(parametres);
    case "parc-leger-forfaits":
      return forfaitsLeger(c, parametres);
    case "parc-leger-charges-bu":
      return chargesLegerParBu(c, parametres);
    case "parc-leger-renouvellement":
      return renouvellementLeger();
    case "parc-leger-immobilises":
      return immobilisesLeger();
    case "parc-leger-pool":
      return poolLeger();
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

function inventaireLeger(parametres: Parametres): LigneRapport[] {
  const parId = new Map(tousAttributaires().map((a) => [a.id, a]));
  const forfaitPar = new Map(forfaitsCarburant().map((f) => [f.attributaireId, f.montantMensuel ?? parametres.parcLeger.forfaitCarburantMensuel]));
  return vehiculesLegers().map((v) => {
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

function attributairesLeger(parametres: Parametres): LigneRapport[] {
  const vehicules = vehiculesLegers();
  const forfaitPar = new Map(forfaitsCarburant().map((f) => [f.attributaireId, f.montantMensuel ?? parametres.parcLeger.forfaitCarburantMensuel]));
  return tousAttributaires().map((a) => {
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

function planCarLeger(parametres: Parametres): LigneRapport[] {
  const parId = new Map(tousAttributaires().map((a) => [a.id, a]));
  const forfaitPar = new Map(forfaitsCarburant().map((f) => [f.attributaireId, f.montantMensuel ?? parametres.parcLeger.forfaitCarburantMensuel]));
  return vehiculesLegers()
    .filter((v) => v.planCar !== null)
    .map((v) => {
      const a = v.attributaireId ? (parId.get(v.attributaireId) ?? null) : null;
      const e = echeancierPlanCar(v.planCar!, parametres.parcLeger.planCarDureeMois, DATE_REFERENCE);
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

function forfaitsLeger(c: ContexteRapport, parametres: Parametres): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  const parId = new Map(tousAttributaires().map((a) => [a.id, a]));
  const parVehicule = new Map(vehiculesLegers().map((v) => [v.id, v]));
  const parCarte = new Map<string, { montant: number; mois: Set<string>; forfait: number; vehiculeId: string }>();
  for (const d of depensesForfaits(DATE_REFERENCE, parametres.parcLeger.forfaitCarburantMensuel)) {
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

function chargesLegerParBu(c: ContexteRapport, parametres: Parametres): LigneRapport[] {
  const { debut, fin } = resoudrePeriode(c.periode, DATE_REFERENCE);
  const vehicules = vehiculesLegers().filter((v) => v.regime !== "exploitation");
  const forfaitPar = new Map(forfaitsCarburant().map((f) => [f.attributaireId, f.montantMensuel ?? parametres.parcLeger.forfaitCarburantMensuel]));
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
  for (const d of depensesForfaits(DATE_REFERENCE, parametres.parcLeger.forfaitCarburantMensuel)) {
    if (!dansLaPeriode(d.date, debut, fin)) continue;
    de(d.businessUnit ? BUSINESS_UNIT[d.businessUnit] : "Sans BU").montant += d.montant;
  }
  const total = [...parBu.values()].reduce((s, x) => s + x.montant, 0);
  return [...parBu.entries()]
    .sort((a, b) => b[1].montant - a[1].montant)
    .map(([bu, x]) => ({ businessUnit: bu, vehicules: x.vehicules, service: x.service, fonction: x.fonction, cartes: x.cartes.size, forfaitMensuel: x.forfaitMensuel, montant: x.montant, part: total > 0 ? arrondir((x.montant / total) * 100) : null }));
}

function renouvellementLeger(): LigneRapport[] {
  const parId = new Map(tousAttributaires().map((a) => [a.id, a]));
  return vehiculesLegers()
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

function immobilisesLeger(): LigneRapport[] {
  return vehiculesLegers()
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

function poolLeger(): LigneRapport[] {
  return vehiculesLegers()
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

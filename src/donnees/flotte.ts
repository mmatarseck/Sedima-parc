/* ============================================================================
 * La flotte telle que la liste la lit : une ligne par véhicule, augmentée de
 * ce qui se calcule — titulaire, compteur, échéances, coût, immobilisation.
 *
 * Base branchée : les véhicules et leurs transactions sont lus en base, et
 * les dérivations sont celles du domaine (`immobilisationAdministrative`,
 * `echeancesDuPlan`…), les mêmes que la démonstration applique à ses fiches.
 * Démonstration : la liste vient du jeu de données et de ses fiches, comme
 * avant.
 *
 * Les identifiants restent ceux de l'application — l'immatriculation
 * canonique pour un véhicule, l'identifiant lisible pour un chauffeur — pour
 * que les adresses et les fiches ne changent pas de clé. L'UUID de la base ne
 * sort pas d'ici.
 *
 * Ce que la base ne porte pas encore et que la ligne laisse vide : l'attelage
 * courant (pas de table `attelage`), les ajustements du plan d'entretien
 * (`plan_vehicule` est vide). La date de référence est celle du jour.
 * ==========================================================================*/

import { cache } from "react";
import { exigeDocument, immobilisationAdministrative } from "@/domaine/documents";
import { echeancesDuPlan, type CompteursVehicule, type EcheanceEntretien } from "@/domaine/entretien";
import type { EtatDocument } from "@/domaine/fiche";
import { afficher } from "@/domaine/immatriculation";
import { idChauffeur } from "@/domaine/chauffeur";
import type { Parametres } from "@/domaine/parametres";
import type { EcheanceVehicule, LigneFlotte, PosteDepense, Site, TypeDocument, Vehicule } from "@/domaine/types";
import { joursRestants } from "@/lib/format";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { passagesReleves, programmeParDefaut } from "./entretien-demo";

export { ligneLegere } from "./flotte-demo";
import { ligneLegere, lignesFlotteDemonstration } from "./flotte-demo";

interface LigneVehicule {
  id: string;
  immatriculation: string;
  vin: string | null;
  marque: string;
  appellation: string;
  type_modele: string | null;
  categorie: Vehicule["categorie"];
  categorie_metier: string | null;
  categorie_flotte: Vehicule["categorieFlotte"];
  usage: Vehicule["usage"];
  transport_special: boolean;
  energie: Vehicule["energie"];
  business_unit: Vehicule["businessUnit"];
  site_id: string | null;
  statut: Vehicule["statut"];
  engage: boolean;
  premiere_mise_en_circulation: string | null;
  date_immatriculation: string | null;
  puissance_cv: number | null;
  cylindree: number | null;
  ptac: number | null;
  ptra: number | null;
  poids_vide: number | null;
  charge_utile: number | null;
  capacite_reservoir: number | null;
  valeur_acquisition: number | null;
  duree_amortissement_annees: number | null;
  photo: string | null;
  commentaire: string | null;
  regime: Vehicule["regime"];
}

interface LigneAttribution {
  vehicule_id: string;
  attributaire_id: string | null;
  pool: string | null;
  plan_car: boolean;
  fin: string | null;
}

interface LigneAttributaire {
  id: string;
  nom: string;
  fonction: string | null;
}

interface LigneSite {
  id: string;
  code: string;
  libelle: string;
  region: string;
  type: Site["type"];
}

interface LigneChauffeurCourt {
  id: string;
  nom: string;
  prenom: string;
}

interface LigneAffectation {
  vehicule_id: string;
  chauffeur_id: string;
  role: "titulaire" | "suppleant";
  debut: string;
  fin: string | null;
  /** Le numéro et le motif, quand lire_parc() les rend : les rapports d'affectation les lisent. */
  numero?: string;
  motif?: string | null;
}

interface LigneDocument {
  vehicule_id: string | null;
  type_document_id: string;
  date_effet: string | null;
  echeance: string | null;
}

interface LigneLicence {
  id: string;
  perimetre: "flotte" | "partie";
  echeance: string;
}

interface LigneLicenceVehicule {
  licence_id: string;
  vehicule_id: string;
}

interface LigneReleve {
  vehicule_id: string;
  date: string;
  km: number;
}

interface LigneDepense {
  vehicule_id: string | null;
  date: string;
  montant: number;
  km: number | null;
  km_motif_rejet: string | null;
  /** Le poste, quand lire_parc() le rend : les coûts par poste des rapports le lisent. */
  poste?: PosteDepense;
}

interface LignePlein {
  vehicule_id: string;
  date: string;
  km: number | null;
}

interface LigneIntervention {
  vehicule_id: string;
  numero: string;
  date: string;
  objet: string;
  km: number | null;
}

/** Ce que la liste et, demain, la fiche lisent d'un coup. */
export interface ParcBrut {
  aujourdhui: string;
  vehicules: LigneVehicule[];
  sites: Map<string, Site>;
  chauffeurs: Map<string, LigneChauffeurCourt>;
  affectations: LigneAffectation[];
  documents: LigneDocument[];
  licences: LigneLicence[];
  licencesVehicules: LigneLicenceVehicule[];
  releves: LigneReleve[];
  depenses: LigneDepense[];
  pleins: LignePlein[];
  interventions: LigneIntervention[];
  /** Le parc léger (0004) : qui tient chaque véhicule de service ou de fonction. */
  attributions: LigneAttribution[];
  attributaires: Map<string, LigneAttributaire>;
  /** Les véhicules commandés, pas encore reçus ni immatriculés. */
  aRecevoir: LigneARecevoir[];
}

interface LigneARecevoir {
  id: string;
  lot: string;
  marque: string;
  modele: string;
  categorie: Vehicule["categorie"];
  regime: Vehicule["regime"];
  attributaire_id: string | null;
  pool: string | null;
  business_unit: Vehicule["businessUnit"];
  commentaire: string | null;
  recu_le: string | null;
}

/**
 * Tout d'une table, par pages : Supabase plafonne une réponse à mille lignes,
 * et une liste tronquée en silence vaudrait un compteur faux.
 */
async function tout<T>(quoi: string, page: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const TAILLE = 1000;
  const lignes: T[] = [];
  for (let de = 0; ; de += TAILLE) {
    const r = await page(de, de + TAILLE - 1);
    if (r.error) throw new Error(`Lecture de ${quoi} : ${r.error.message}`);
    const paquet = r.data ?? [];
    lignes.push(...paquet);
    if (paquet.length < TAILLE) return lignes;
  }
}

function ilYADouzeMois(aujourdhui: string): string {
  const d = new Date(`${aujourdhui}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

/** Ce que `lire_parc()` (0009) rend d'un coup, sous les noms des tables. */
interface ParcJson {
  vehicules: LigneVehicule[];
  sites: LigneSite[];
  chauffeurs: LigneChauffeurCourt[];
  affectations: LigneAffectation[];
  documents: LigneDocument[];
  licences: LigneLicence[];
  licences_vehicules: LigneLicenceVehicule[];
  releves: LigneReleve[];
  depenses: LigneDepense[];
  pleins: LignePlein[];
  interventions: LigneIntervention[];
  attributions: LigneAttribution[];
  attributaires: LigneAttributaire[];
  a_recevoir: LigneARecevoir[];
}

/**
 * Le parc et ses transactions récentes, lus avec la session de l'utilisateur.
 *
 * En une requête depuis la revue de performance du 8 septembre 2026 : la
 * fonction `lire_parc()` rend tout en un JSON, sans pagination, à 0,5 s
 * l'aller-retour depuis Dakar. Tant qu'elle n'est pas jouée en base, les
 * quatorze lectures d'avant prennent le relais — la page ne casse pas.
 */
export async function lireParc(client: SupabaseClient, aujourdhui: string): Promise<ParcBrut> {
  const depuis = ilYADouzeMois(aujourdhui);
  const enUn = await client.rpc("lire_parc", { depuis }).maybeSingle<ParcJson>();
  if (!enUn.error && enUn.data) {
    const j = enUn.data;
    return {
      aujourdhui,
      attributions: j.attributions,
      attributaires: new Map(j.attributaires.map((a) => [a.id, a])),
      aRecevoir: j.a_recevoir,
      vehicules: j.vehicules,
      sites: new Map(j.sites.map((s) => [s.id, { id: s.id, code: s.code, libelle: s.libelle, region: s.region, type: s.type }])),
      chauffeurs: new Map(j.chauffeurs.map((c) => [c.id, c])),
      affectations: j.affectations,
      documents: j.documents,
      licences: j.licences,
      licencesVehicules: j.licences_vehicules,
      releves: j.releves,
      depenses: j.depenses,
      pleins: j.pleins,
      interventions: j.interventions,
    };
  }
  return lireParcEnQuatorze(client, aujourdhui, depuis);
}

async function lireParcEnQuatorze(client: SupabaseClient, aujourdhui: string, depuis: string): Promise<ParcBrut> {
  const [vehicules, sites, chauffeurs, affectations, documents, licences, licencesVehicules, releves, depenses, pleins, interventions, attributions, attributaires, aRecevoir] = await Promise.all([
    /* Tout le parc, transport et léger : la liste Flotte les réunit depuis le
       7 septembre 2026, et c'est le régime qui les distingue. */
    tout<LigneVehicule>("véhicules", (de, a) => client.from("vehicule").select("*").order("immatriculation").range(de, a)),
    tout<LigneSite>("sites", (de, a) => client.from("site").select("id, code, libelle, region, type").range(de, a)),
    tout<LigneChauffeurCourt>("chauffeurs", (de, a) => client.from("chauffeur").select("id, nom, prenom").range(de, a)),
    tout<LigneAffectation>("affectations", (de, a) => client.from("affectation").select("vehicule_id, chauffeur_id, role, debut, fin").range(de, a)),
    tout<LigneDocument>("documents", (de, a) => client.from("document").select("vehicule_id, type_document_id, date_effet, echeance").not("vehicule_id", "is", null).range(de, a)),
    tout<LigneLicence>("licences", (de, a) => client.from("licence_transport").select("id, perimetre, echeance").range(de, a)),
    tout<LigneLicenceVehicule>("périmètres de licence", (de, a) => client.from("licence_vehicule").select("licence_id, vehicule_id").range(de, a)),
    tout<LigneReleve>("relevés", (de, a) => client.from("releve_kilometrique").select("vehicule_id, date, km").is("motif_rejet", null).gte("date", depuis).range(de, a)),
    tout<LigneDepense>("dépenses", (de, a) => client.from("depense").select("vehicule_id, date, montant, km, km_motif_rejet").gte("date", depuis).range(de, a)),
    tout<LignePlein>("pleins", (de, a) => client.from("plein").select("vehicule_id, date, km").gte("date", depuis).range(de, a)),
    tout<LigneIntervention>("interventions", (de, a) => client.from("intervention").select("vehicule_id, numero, date, objet, km").range(de, a)),
    tout<LigneAttribution>("attributions", (de, a) => client.from("attribution_legere").select("vehicule_id, attributaire_id, pool, plan_car, fin").is("fin", null).range(de, a)),
    tout<LigneAttributaire>("attributaires", (de, a) => client.from("attributaire").select("id, nom, fonction").range(de, a)),
    tout<LigneARecevoir>("véhicules à recevoir", (de, a) => client.from("vehicule_a_recevoir").select("id, lot, marque, modele, categorie, regime, attributaire_id, pool, business_unit, commentaire, recu_le").is("recu_le", null).range(de, a)),
  ]);
  return {
    aujourdhui,
    attributions,
    attributaires: new Map(attributaires.map((a) => [a.id, a])),
    aRecevoir,
    vehicules,
    sites: new Map(sites.map((s) => [s.id, { id: s.id, code: s.code, libelle: s.libelle, region: s.region, type: s.type }])),
    chauffeurs: new Map(chauffeurs.map((c) => [c.id, c])),
    affectations,
    documents,
    licences,
    licencesVehicules,
    releves,
    depenses,
    pleins,
    interventions,
  };
}

/* -- Les dérivations ---------------------------------------------------------- */

export function vehiculeDepuisLaBase(v: LigneVehicule): Vehicule {
  return {
    id: v.immatriculation,
    immatriculation: v.immatriculation,
    immatriculationAffichee: afficher(v.immatriculation),
    vin: v.vin,
    marque: v.marque,
    appellation: v.appellation,
    typeModele: v.type_modele,
    categorie: v.categorie,
    categorieMetier: v.categorie_metier ?? null,
    categorieFlotte: v.categorie_flotte,
    transportSpecial: v.transport_special,
    usage: v.usage,
    engage: v.engage,
    premiereMiseEnCirculation: v.premiere_mise_en_circulation,
    dateImmatriculation: v.date_immatriculation,
    puissanceCv: v.puissance_cv,
    cylindree: v.cylindree,
    ptac: v.ptac,
    ptra: v.ptra,
    poidsVide: v.poids_vide,
    chargeUtile: v.charge_utile,
    energie: v.energie,
    capaciteReservoir: v.capacite_reservoir,
    businessUnit: v.business_unit,
    siteId: v.site_id,
    statut: v.statut,
    valeurAcquisition: v.valeur_acquisition,
    dureeAmortissementAnnees: v.duree_amortissement_annees,
    commentaire: v.commentaire,
    photo: v.photo,
    regime: v.regime ?? "exploitation",
  };
}

/** Une affectation en cours à la date donnée. */
export function enCours(a: { debut: string; fin: string | null }, aujourdhui: string): boolean {
  return a.debut <= aujourdhui && (a.fin === null || a.fin >= aujourdhui);
}

function etatDocument(jours: number | null, manquant: boolean, permanent: boolean): EtatDocument {
  if (manquant) return "manquant";
  if (permanent) return "permanent";
  if (jours === null) return "a-jour";
  if (jours < 0) return "echu";
  if (jours <= 30) return "bientot";
  return "a-jour";
}

interface DocumentSuivi {
  type: TypeDocument;
  etat: EtatDocument;
  echeance: string | null;
  joursRestants: number | null;
}

/**
 * Les documents d'un véhicule, un par type suivi : le plus récent de chaque
 * type enregistré, puis les types exigés que rien ne porte, marqués manquants.
 * La licence de transport vient de la flotte : celle qui couvre le véhicule et
 * échoit le plus tôt.
 */
function documentsDuVehicule(v: Vehicule, uuid: string, parc: ParcBrut, parametres: Parametres): DocumentSuivi[] {
  const ref = new Date(`${parc.aujourdhui}T00:00:00Z`);
  const suivis: DocumentSuivi[] = [];
  const parType = new Map<string, LigneDocument>();
  for (const d of parc.documents) {
    if (d.vehicule_id !== uuid) continue;
    const courant = parType.get(d.type_document_id);
    if (!courant || (d.echeance ?? d.date_effet ?? "") > (courant.echeance ?? courant.date_effet ?? "")) parType.set(d.type_document_id, d);
  }
  for (const [type, d] of parType) {
    const definition = parametres.documents.types.find((t) => t.id === type);
    const permanent = (definition?.validiteMois ?? null) === null && d.echeance === null;
    const jours = joursRestants(d.echeance, ref);
    suivis.push({ type, etat: etatDocument(jours, false, permanent), echeance: d.echeance, joursRestants: jours });
  }

  if (exigeDocument("licence-transport", v, parametres)) {
    const couvrantes = parc.licences
      .filter((l) => l.perimetre === "flotte" || parc.licencesVehicules.some((lv) => lv.licence_id === l.id && lv.vehicule_id === uuid))
      .sort((a, b) => a.echeance.localeCompare(b.echeance));
    const licence = couvrantes[0] ?? null;
    const jours = licence ? joursRestants(licence.echeance, ref) : null;
    suivis.push({ type: "licence-transport", etat: etatDocument(jours, licence === null, false), echeance: licence?.echeance ?? null, joursRestants: jours });
  }

  for (const t of parametres.documents.types) {
    if (t.porteur !== "vehicule" || !exigeDocument(t.id, v, parametres) || suivis.some((s) => s.type === t.id)) continue;
    suivis.push({ type: t.id, etat: "manquant", echeance: null, joursRestants: null });
  }
  return suivis;
}

/** Le dernier compteur relevé, toutes sources confondues : relevé, dépense, plein. */
function dernierCompteur(uuid: string, parc: ParcBrut): { km: number; date: string } | null {
  let meilleur: { km: number; date: string } | null = null;
  const retenir = (km: number | null, date: string) => {
    if (km === null || km <= 0) return;
    if (!meilleur || date > meilleur.date || (date === meilleur.date && km > meilleur.km)) meilleur = { km, date };
  };
  for (const r of parc.releves) if (r.vehicule_id === uuid) retenir(r.km, r.date);
  for (const d of parc.depenses) if (d.vehicule_id === uuid && d.km_motif_rejet === null) retenir(d.km, d.date);
  for (const p of parc.pleins) if (p.vehicule_id === uuid) retenir(p.km, p.date);
  return meilleur;
}

/** Faute de deux points assez écartés, ce rythme par défaut — un ordre de grandeur, pas une mesure. */
const RYTHME_PAR_DEFAUT = 100;

/** Le rythme du véhicule, en kilomètres par jour, lu sur ses relevés de l'année ; `null` quand ils ne le disent pas. */
function rythmeMesure(uuid: string, parc: ParcBrut): number | null {
  const points = [
    ...parc.releves.filter((r) => r.vehicule_id === uuid).map((r) => ({ date: r.date, km: r.km })),
    ...parc.depenses.filter((d) => d.vehicule_id === uuid && d.km !== null && d.km_motif_rejet === null).map((d) => ({ date: d.date, km: d.km! })),
    ...parc.pleins.filter((p) => p.vehicule_id === uuid && p.km !== null).map((p) => ({ date: p.date, km: p.km! })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  if (points.length < 2) return null;
  const premier = points[0]!;
  const dernier = points[points.length - 1]!;
  const jours = (Date.parse(`${dernier.date}T00:00:00Z`) - Date.parse(`${premier.date}T00:00:00Z`)) / 86_400_000;
  if (jours < 7 || dernier.km <= premier.km) return null;
  return Math.max(1, Math.round((dernier.km - premier.km) / jours));
}

/** Toutes les échéances du plan d'entretien d'un véhicule, confrontées à ses interventions en base ; la liste en garde la première, la Maintenance celles qui appellent une action. */
export function echeancesEntretienDeLaBase(v: Vehicule, uuid: string, compteur: { km: number; date: string } | null, parc: ParcBrut, rythme?: number | null): EcheanceEntretien[] {
  const programme = programmeParDefaut(v.categorie);
  const interventions = parc.interventions.filter((i) => i.vehicule_id === uuid).map((i) => ({ numero: i.numero, date: i.date, objet: i.objet, km: i.km }));
  const compteurs: CompteursVehicule = {
    km: compteur?.km ?? null,
    heures: null,
    /* Le rythme se mesure une fois par véhicule et se passe de main en main :
       le relire ici coûterait un parcours de tous les relevés du parc. */
    kmParJour: (rythme === undefined ? rythmeMesure(uuid, parc) : rythme) ?? RYTHME_PAR_DEFAUT,
    heuresParJour: 0.5,
    miseEnService: v.premiereMiseEnCirculation,
  };
  return echeancesDuPlan(programme, { vehiculeId: v.id, programmeCode: programme.code, ajustements: [] }, passagesReleves(programme, interventions, 0, null, parc.aujourdhui), compteurs, parc.aujourdhui);
}

function planEntretienDeLaBase(v: Vehicule, uuid: string, compteur: { km: number; date: string } | null, parc: ParcBrut): { prochaine: LigneFlotte["prochaineEcheanceEntretien"]; etat: "en-retard" | "a-jour" | "inconnu" } {
  const rythme = rythmeMesure(uuid, parc);
  const echeances = echeancesEntretienDeLaBase(v, uuid, compteur, parc, rythme);
  const premiere = echeances.find((e) => e.kmRestants !== null || e.joursRestants !== null) ?? null;
  /* Le rythme suit l'échéance : la Conformité en tire des jours à partir des
     kilomètres restants, et doit le faire au rythme du véhicule, pas au sien. */
  const prochaine = premiere ? { libelle: premiere.libelle, kmRestants: premiere.kmRestants, joursRestants: premiere.joursRestants, kmParJour: rythme } : null;
  /* L'état se juge sur toutes les opérations. Un retard connu est un fait ; mais une opération sans passage relevé ne dit pas qu'elle est à jour — une échéance comptée depuis la mise en service inventerait un retard, une absence de relevé inventerait une conformité. */
  const etat = echeances.some((e) => e.etat === "en-retard") ? "en-retard" : echeances.length > 0 && echeances.every((e) => e.etat !== "sans-reference") ? "a-jour" : "inconnu";
  return { prochaine, etat };
}

/** La ligne de la liste, dérivée des lignes brutes. */
export function ligneDepuisLaBase(brut: LigneVehicule, parc: ParcBrut, parametres: Parametres): LigneFlotte {
  const v = vehiculeDepuisLaBase(brut);
  const courantes = parc.affectations.filter((a) => a.vehicule_id === brut.id && enCours(a, parc.aujourdhui));
  const titulaire = courantes.find((a) => a.role === "titulaire") ?? null;
  const chauffeur = titulaire ? (parc.chauffeurs.get(titulaire.chauffeur_id) ?? null) : null;
  const nomTitulaire = chauffeur ? `${chauffeur.prenom} ${chauffeur.nom}` : null;

  const compteur = dernierCompteur(brut.id, parc);
  const planEntretien = v.regime === "exploitation" ? planEntretienDeLaBase(v, brut.id, compteur, parc) : null;
  /* Les documents et le plan d'entretien des véhicules de service et de
     fonction ne sont pas encore tenus dans la base : les déclarer manquants
     immobiliserait tout le parc léger d'un coup, à tort. Ils se jugent sur
     l'exploitation seule tant que leurs pièces ne sont pas enregistrées. */
  const exploitation = v.regime === "exploitation";
  const documents = exploitation ? documentsDuVehicule(v, brut.id, parc, parametres) : [];
  const dates = documents.filter((d): d is DocumentSuivi & { echeance: string; joursRestants: number } => d.echeance !== null && d.joursRestants !== null).sort((a, b) => a.joursRestants - b.joursRestants);
  const conformite: EcheanceVehicule | null = dates[0] ? { type: dates[0].type, echeance: dates[0].echeance, joursRestants: dates[0].joursRestants } : null;
  const immobilisation = exploitation ? immobilisationAdministrative(v, documents, parametres) : null;
  const cout = parc.depenses.filter((d) => d.vehicule_id === brut.id).reduce((s, d) => s + d.montant, 0);

  /* Qui tient un véhicule léger : l'attribution en cours, personne ou pool. */
  const attribution = exploitation ? null : (parc.attributions.find((a) => a.vehicule_id === brut.id) ?? null);
  const personne = attribution?.attributaire_id ? (parc.attributaires.get(attribution.attributaire_id) ?? null) : null;
  const attributaire = personne
    ? { nom: personne.nom, fonction: personne.fonction, pool: false, planCar: attribution?.plan_car === true }
    : attribution?.pool
      ? { nom: attribution.pool, fonction: null, pool: true, planCar: false }
      : null;

  return {
    vehicule: v,
    chauffeurTitulaire: nomTitulaire ? { id: idChauffeur(nomTitulaire), nom: nomTitulaire } : null,
    nombreSuppleants: courantes.filter((a) => a.role === "suppleant").length,
    site: brut.site_id ? (parc.sites.get(brut.site_id) ?? null) : null,
    kilometrage: compteur?.km ?? null,
    dateKilometrage: compteur?.date ?? null,
    prochaineEcheanceConformite: conformite,
    prochaineEcheanceEntretien: planEntretien?.prochaine ?? null,
    etatPlanEntretien: planEntretien?.etat ?? null,
    coutDouzeMois: cout > 0 ? cout : null,
    attelageCourant: null,
    statutEffectif: immobilisation?.statut ?? v.statut,
    immobilisationAdministrative: immobilisation?.documents ?? [],
    attributaire,
  };
}

/* -- Ce que la page appelle -------------------------------------------------- */

/** Le parc brut, lu une fois par requête : la liste Flotte et la Maintenance (travaux à faire) le partagent. */
export const parcServeur = cache(async (): Promise<ParcBrut> => lireParc(await clientServeur(), new Date().toISOString().slice(0, 10)));

/** Les lignes de la liste Flotte, statut effectif et immobilisation compris. */
async function lignesFlotteBrut(parametres: Parametres): Promise<LigneFlotte[]> {
  /* La démonstration : les fiches, et le parc léger du dossier (`flotte-demo.ts`). */
  if (!authentificationReelle()) return lignesFlotteDemonstration(parametres);
  const parc = await parcServeur();
  return [...parc.vehicules.map((v) => ligneDepuisLaBase(v, parc, parametres)), ...lignesARecevoir(parc)];
}

/** Les véhicules à recevoir en lignes de la Flotte : sous leur numéro de lot, sans compteur ni coût, avec le bénéficiaire prévu. */
export function lignesARecevoir(parc: ParcBrut): LigneFlotte[] {
  return parc.aRecevoir.map((r) => {
    const a = r.attributaire_id ? (parc.attributaires.get(r.attributaire_id) ?? null) : null;
    return ligneLegere(
      {
        id: r.lot.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        immatriculation: null,
        immatriculationAffichee: `${r.lot} — à immatriculer`,
        marque: r.marque,
        modele: r.modele,
        annee: null,
        kilometrage: null,
        categorie: r.categorie as "vehicule-leger" | "camionnette" | "moto" | "bus",
        regime: r.regime ?? "service",
        etat: "a-recevoir",
        attributaireId: null,
        pool: a ? null : r.pool,
        departement: null,
        businessUnit: r.business_unit,
        planCar: null,
        lot: r.lot,
        commentaire: r.commentaire,
      },
      null,
      a ? { nom: a.nom, fonction: a.fonction } : null,
    );
  });
}

/** Une lecture par requête : la liste, le téléphone et Paramètres › Véhicules partagent le même parc quand ils sont rendus ensemble. */
export const lignesFlotte = cache(lignesFlotteBrut);

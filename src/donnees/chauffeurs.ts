/* ============================================================================
 * Les chauffeurs tels que la liste les lit : une ligne par personne, sortis
 * compris, avec le statut déduit, le véhicule tenu, les échéances et les
 * compteurs de l'année.
 *
 * Base branchée : les chauffeurs, leurs affectations, indisponibilités,
 * documents et incidents sont lus en base ; les règles sont celles du domaine
 * (`statutChauffeur`, `idChauffeur`). Démonstration : la liste du jeu de
 * données, comme avant.
 *
 * L'identifiant d'un chauffeur reste l'identifiant lisible dérivé de son nom,
 * celui des adresses (/chauffeurs/babacar-ndiaye) ; l'UUID ne sort pas d'ici.
 *
 * Les kilomètres de l'année sont **attribués au titulaire** : la progression
 * du compteur de son véhicule pendant son affectation, hors jours
 * d'indisponibilité. La démonstration confie ces jours-là au suppléant ;
 * cette attribution fine viendra avec la fiche, qui a besoin des relevés
 * jour par jour. Les contraventions sont les dépenses de ce poste sur le
 * véhicule tenu, attribuées de la même façon.
 * ==========================================================================*/

import { idChauffeur, initialesDe, nomComplet, statutChauffeur, type EcheanceChauffeur, type LigneChauffeur, type VehiculeAffecte } from "@/domaine/chauffeur";
import type { Chauffeur, Indisponibilite, Site } from "@/domaine/types";
import { joursRestants } from "@/lib/format";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listeChauffeurs } from "./chauffeurs-demo";
import { afficher } from "@/domaine/immatriculation";

interface LigneChauffeurBase {
  id: string;
  matricule_rh: string | null;
  nom: string;
  prenom: string;
  contrat: Chauffeur["contrat"];
  site_id: string | null;
  telephone: string | null;
  permis_numero: string | null;
  permis_categories: string[];
  permis_echeance: string | null;
  visite_medicale_echeance: string | null;
  aptitude: Chauffeur["aptitude"];
  aptitude_motif: string | null;
  aptitude_date: string | null;
  date_naissance: string | null;
  date_embauche: string | null;
  date_sortie: string | null;
}

interface LigneSite {
  id: string;
  code: string;
  libelle: string;
  region: string;
  type: Site["type"];
}

interface LigneVehiculeCourt {
  id: string;
  immatriculation: string;
  marque: string;
  appellation: string;
}

interface LigneAffectation {
  vehicule_id: string;
  chauffeur_id: string;
  role: "titulaire" | "suppleant";
  debut: string;
  fin: string | null;
}

interface LigneIndisponibilite {
  id: string;
  numero: string;
  chauffeur_id: string;
  motif: Indisponibilite["motif"];
  debut: string;
  fin: string | null;
  commentaire: string | null;
}

interface LigneDocument {
  chauffeur_id: string;
  type_document_id: string;
  echeance: string | null;
}

interface LigneIncident {
  chauffeur_id: string | null;
  date_heure: string;
}

interface LigneReleve {
  vehicule_id: string;
  date: string;
  km: number;
}

interface LigneDepense {
  vehicule_id: string | null;
  date: string;
  poste: string;
  km: number | null;
  km_motif_rejet: string | null;
}

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

function enCours(a: { debut: string; fin: string | null }, jour: string): boolean {
  return a.debut <= jour && (a.fin === null || a.fin >= jour);
}

function ilYADouzeMois(aujourdhui: string): string {
  const d = new Date(`${aujourdhui}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function chauffeurDepuisLaBase(c: LigneChauffeurBase, aujourdhui: string): Chauffeur {
  return {
    id: idChauffeur(`${c.prenom} ${c.nom}`),
    matriculeRh: c.matricule_rh,
    nom: c.nom,
    prenom: c.prenom,
    contrat: c.contrat,
    siteId: c.site_id,
    permisNumero: c.permis_numero,
    permisCategories: c.permis_categories ?? [],
    permisEcheance: c.permis_echeance,
    visiteMedicaleEcheance: c.visite_medicale_echeance,
    telephone: c.telephone,
    aptitude: c.aptitude,
    aptitudeMotif: c.aptitude_motif,
    aptitudeDate: c.aptitude_date,
    dateNaissance: c.date_naissance,
    dateEmbauche: c.date_embauche,
    dateSortie: c.date_sortie,
    actif: c.date_sortie === null || c.date_sortie > aujourdhui,
  };
}

/**
 * Les kilomètres du compteur d'un véhicule entre deux dates, lus sur ses
 * relevés valides : la différence entre le dernier relevé de la fenêtre et le
 * dernier relevé qui la précède (ou le premier de la fenêtre, faute de mieux).
 */
function kmEntre(points: { date: string; km: number }[], debut: string, fin: string): number {
  const avant = points.filter((p) => p.date < debut);
  const dedans = points.filter((p) => p.date >= debut && p.date <= fin);
  if (dedans.length === 0) return 0;
  const depart = avant.length > 0 ? avant[avant.length - 1]!.km : dedans[0]!.km;
  const arrivee = dedans[dedans.length - 1]!.km;
  return Math.max(0, arrivee - depart);
}

/** Les jours d'une fenêtre que les indisponibilités couvrent, en part de la fenêtre. */
function partIndisponible(indisponibilites: LigneIndisponibilite[], debut: string, fin: string): number {
  const d0 = Date.parse(`${debut}T00:00:00Z`);
  const d1 = Date.parse(`${fin}T00:00:00Z`);
  const total = (d1 - d0) / 86_400_000 + 1;
  if (total <= 0) return 0;
  let couverts = 0;
  for (const i of indisponibilites) {
    const a = Math.max(d0, Date.parse(`${i.debut}T00:00:00Z`));
    const b = Math.min(d1, i.fin ? Date.parse(`${i.fin}T00:00:00Z`) : d1);
    if (b >= a) couverts += (b - a) / 86_400_000 + 1;
  }
  return Math.min(1, couverts / total);
}

/** Ce que la liste lit d'un coup. */
export interface ChauffeursBrut {
  aujourdhui: string;
  chauffeurs: LigneChauffeurBase[];
  sites: LigneSite[];
  vehicules: LigneVehiculeCourt[];
  affectations: LigneAffectation[];
  indisponibilites: LigneIndisponibilite[];
  documents: LigneDocument[];
  incidents: LigneIncident[];
  releves: LigneReleve[];
  depenses: LigneDepense[];
}

/** Les chauffeurs et ce qui les entoure, lus avec la session de l'utilisateur. */
export async function lireChauffeurs(client: SupabaseClient, aujourdhui: string): Promise<ChauffeursBrut> {
  const depuis = ilYADouzeMois(aujourdhui);
  const [chauffeurs, sites, vehicules, affectations, indisponibilites, documents, incidents, releves, depenses] = await Promise.all([
    tout<LigneChauffeurBase>("chauffeurs", (de, a) => client.from("chauffeur").select("*").range(de, a)),
    tout<LigneSite>("sites", (de, a) => client.from("site").select("id, code, libelle, region, type").range(de, a)),
    tout<LigneVehiculeCourt>("véhicules", (de, a) => client.from("vehicule").select("id, immatriculation, marque, appellation").range(de, a)),
    tout<LigneAffectation>("affectations", (de, a) => client.from("affectation").select("vehicule_id, chauffeur_id, role, debut, fin").range(de, a)),
    tout<LigneIndisponibilite>("indisponibilités", (de, a) => client.from("indisponibilite").select("id, numero, chauffeur_id, motif, debut, fin, commentaire").range(de, a)),
    tout<LigneDocument>("documents des chauffeurs", (de, a) => client.from("document").select("chauffeur_id, type_document_id, echeance").not("chauffeur_id", "is", null).range(de, a)),
    tout<LigneIncident>("incidents", (de, a) => client.from("incident").select("chauffeur_id, date_heure").gte("date_heure", `${depuis}T00:00:00Z`).range(de, a)),
    tout<LigneReleve>("relevés", (de, a) => client.from("releve_kilometrique").select("vehicule_id, date, km").is("motif_rejet", null).range(de, a)),
    tout<LigneDepense>("dépenses", (de, a) => client.from("depense").select("vehicule_id, date, poste, km, km_motif_rejet").gte("date", depuis).range(de, a)),
  ]);
  return { aujourdhui, chauffeurs, sites, vehicules, affectations, indisponibilites, documents, incidents, releves, depenses };
}

/** Les lignes de la liste, dérivées des lignes brutes. */
export function lignesDepuisLaBase(brut: ChauffeursBrut): LigneChauffeur[] {
  const { aujourdhui, chauffeurs, sites, vehicules, affectations, indisponibilites, documents, incidents, releves, depenses } = brut;
  const depuis = ilYADouzeMois(aujourdhui);
  const siteParId = new Map(sites.map((s) => [s.id, { id: s.id, code: s.code, libelle: s.libelle, region: s.region, type: s.type } as Site]));
  const vehiculeParId = new Map(vehicules.map((v) => [v.id, v]));
  const ref = new Date(`${aujourdhui}T00:00:00Z`);

  /* Les points de compteur d'un véhicule : relevés et dépenses qui en portent un. */
  const pointsParVehicule = new Map<string, { date: string; km: number }[]>();
  const ajouter = (vehiculeId: string | null, date: string, km: number | null) => {
    if (!vehiculeId || km === null || km <= 0) return;
    const liste = pointsParVehicule.get(vehiculeId) ?? [];
    liste.push({ date, km });
    pointsParVehicule.set(vehiculeId, liste);
  };
  for (const r of releves) ajouter(r.vehicule_id, r.date, r.km);
  for (const d of depenses) if (d.km_motif_rejet === null) ajouter(d.vehicule_id, d.date, d.km);
  for (const liste of pointsParVehicule.values()) liste.sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);

  const lignes: LigneChauffeur[] = chauffeurs.map((brut) => {
    const chauffeur = chauffeurDepuisLaBase(brut, aujourdhui);
    const siennes = affectations.filter((a) => a.chauffeur_id === brut.id);
    const courantes = siennes.filter((a) => enCours(a, aujourdhui));
    const affecte = (a: LigneAffectation): VehiculeAffecte | null => {
      const v = vehiculeParId.get(a.vehicule_id);
      return v ? { vehiculeId: v.immatriculation, immatriculation: v.immatriculation, immatriculationAffichee: afficher(v.immatriculation), marque: v.marque, appellation: v.appellation, role: a.role, debut: a.debut } : null;
    };
    const titulaire = courantes.find((a) => a.role === "titulaire");
    const indisposSiennes = indisponibilites.filter((i) => i.chauffeur_id === brut.id);
    const indispoCourante = indisposSiennes.find((i) => enCours(i, aujourdhui)) ?? null;

    const echeance = (type: string, colonne: string | null): EcheanceChauffeur => {
      const doc = documents.find((d) => d.chauffeur_id === brut.id && d.type_document_id === type);
      const date = doc?.echeance ?? colonne;
      return { type, echeance: date, joursRestants: joursRestants(date, ref), manquant: !doc };
    };

    /* Les kilomètres de l'année : la progression du compteur de chaque véhicule
       tenu comme titulaire, sur la part de la fenêtre où il était affecté et disponible. */
    let km = 0;
    for (const a of siennes.filter((x) => x.role === "titulaire")) {
      const debut = a.debut > depuis ? a.debut : depuis;
      const fin = a.fin && a.fin < aujourdhui ? a.fin : aujourdhui;
      if (fin < debut) continue;
      const points = pointsParVehicule.get(a.vehicule_id) ?? [];
      km += Math.round(kmEntre(points, debut, fin) * (1 - partIndisponible(indisposSiennes, debut, fin)));
    }

    const contraventions = depenses.filter(
      (d) => d.poste === "contravention" && d.vehicule_id !== null && siennes.some((a) => a.role === "titulaire" && a.vehicule_id === d.vehicule_id && enCours(a, d.date)),
    ).length;

    return {
      chauffeur,
      id: chauffeur.id,
      nomComplet: nomComplet(chauffeur),
      initiales: initialesDe(nomComplet(chauffeur)),
      site: brut.site_id ? (siteParId.get(brut.site_id) ?? null) : null,
      /* En poste dès qu'une affectation court, titulaire ou suppléant : un
         suppléant désigné est mobilisé, pas seulement disponible. */
      statut: statutChauffeur(chauffeur, indispoCourante ? { id: indispoCourante.id, numero: indispoCourante.numero, chauffeurId: chauffeur.id, motif: indispoCourante.motif, debut: indispoCourante.debut, fin: indispoCourante.fin, commentaire: indispoCourante.commentaire } : null, courantes.length > 0),
      indisponibilite: indispoCourante ? { id: indispoCourante.id, numero: indispoCourante.numero, chauffeurId: chauffeur.id, motif: indispoCourante.motif, debut: indispoCourante.debut, fin: indispoCourante.fin, commentaire: indispoCourante.commentaire } : null,
      vehiculeTitulaire: titulaire ? affecte(titulaire) : null,
      suppleances: courantes.filter((a) => a.role === "suppleant").map(affecte).filter((x): x is VehiculeAffecte => x !== null),
      permis: echeance("permis", brut.permis_echeance),
      visiteMedicale: echeance("visite-medicale", brut.visite_medicale_echeance),
      kmDouzeMois: km > 0 ? km : null,
      contraventionsDouzeMois: contraventions,
      incidentsDouzeMois: incidents.filter((i) => i.chauffeur_id === brut.id).length,
    };
  });

  const ordre = { "en-poste": 0, disponible: 1, indisponible: 2, sorti: 3 } as const;
  return lignes.sort((a, b) => ordre[a.statut] - ordre[b.statut] || a.chauffeur.nom.localeCompare(b.chauffeur.nom, "fr"));
}

/** Les lignes de la liste Chauffeurs, dans l'ordre statut puis nom. */
export async function lignesChauffeurs(): Promise<LigneChauffeur[]> {
  if (!authentificationReelle()) return listeChauffeurs();
  return lignesDepuisLaBase(await lireChauffeurs(await clientServeur(), new Date().toISOString().slice(0, 10)));
}

/* ============================================================================
 * Le module Prestataires, assemblé depuis une source de faits.
 *
 * La fiche d'un prestataire, son compte (dettes déduites, avances,
 * évaluations, notation) et le résumé de chacun sur la liste ne calculent
 * rien qui ne se lise ailleurs : ils rassemblent ce que les transactions
 * disent de lui. Ce module tient ce rassemblement, **pur** — il reçoit les
 * faits déjà rapportés à un numéro de prestataire et rend la fiche, le compte
 * et les résumés. La démonstration lui donne le jeu du navigateur
 * (`compte-prestataire-demo.ts`), la base ce que `lire_prestataires()` (0026)
 * rend avec les achats et le transport déjà lus (`donnees/prestataires.ts`).
 *
 * **La dette ne se saisit pas : elle se déduit** (cadrage du 4 septembre
 * 2026). Une demande d'achat livrée ou facturée, un affrètement livré, une
 * mise à disposition facturée : le service est rendu, l'argent n'est pas
 * sorti. Un règlement saisi là-bas éteint la dette ici sans double saisie.
 * ==========================================================================*/

import type { DepenseCaisse } from "../donnees/caisse-demo";
import { coutDe, phaseDe, type LigneAchat } from "./caisse";
import { ageDette, avanceOuverte, noterPrestataire, type Avance, type Evaluation, type FaitsNotationPrestataire, type LigneDette, type NotationPrestataire } from "./compte-prestataire";
import { POSTE_DEPENSE } from "./libelles";
import type { DocumentPrestataire, FichePrestataire, InterventionPrestataire, PleinPrestataire, Prestataire, VisitePrestataire } from "./prestataires";
import { coutAffretement, coutMiseADisposition, coutPrestation, type Affretement, type MiseADisposition, type Prestation } from "./transporteurs";

/* -- Ce qu'il faut savoir pour dresser le module ------------------------------ */

/** Un fait rapporté à son prestataire, par le numéro PRE. */
export type De<T> = T & { prestataireNumero: string };

export interface SourcePrestataires {
  prestataires: Prestataire[];
  /** Toutes les demandes d'achat : elles citent le prestataire par son numéro. */
  demandes: LigneAchat[];
  interventions: De<InterventionPrestataire>[];
  pleins: De<PleinPrestataire>[];
  depensesCaisse: De<DepenseCaisse>[];
  documents: De<DocumentPrestataire>[];
  visites: De<VisitePrestataire>[];
  affretements: Affretement[];
  misesADisposition: MiseADisposition[];
  prestations: Prestation[];
  avances: Avance[];
  evaluations: Evaluation[];
  aujourdhui: string;
}

/* -- Les règles, une fois pour toutes ------------------------------------------- */

/**
 * Les reprises : deux interventions sur le même véhicule, pour le même objet,
 * à moins de soixante jours. C'est le seul indice de qualité que l'application
 * sache lire sans qu'on lui dise rien — et il est têtu : une reprise coûte deux
 * fois, elle immobilise deux fois, et elle se voit dans l'historique.
 */
export const JOURS_REPRISE = 60;

export function repriseDe(interventions: { date: string; objet: string; vehiculeId: string }[]): number {
  let reprises = 0;
  const triees = [...interventions].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < triees.length; i++) {
    const precedente = triees.slice(0, i).find(
      (p) => p.vehiculeId === triees[i]!.vehiculeId && motsClesCommuns(p.objet, triees[i]!.objet) && (Date.parse(triees[i]!.date) - Date.parse(p.date)) / 86_400_000 <= JOURS_REPRISE,
    );
    if (precedente) reprises += 1;
  }
  return reprises;
}

/** Deux objets d'intervention parlent-ils de la même chose ? */
function motsClesCommuns(a: string, b: string): boolean {
  const mots = (t: string) =>
    new Set(
      t
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .split(/[^a-z0-9]+/)
        .filter((m) => m.length > 4),
    );
  const ma = mots(a);
  for (const m of mots(b)) if (ma.has(m)) return true;
  return false;
}

/** Les mois écoulés depuis la première pièce connue d'un prestataire. */
export function ancienneteMois(dates: string[], aujourdhui: string): number | null {
  const premieres = dates.filter(Boolean).sort();
  if (premieres.length === 0) return null;
  const debut = new Date(`${premieres[0]}T00:00:00Z`);
  const fin = new Date(`${aujourdhui}T00:00:00Z`);
  return Math.max(0, Math.round((fin.getTime() - debut.getTime()) / (30.44 * 86_400_000)));
}

function echeanceDe(date: string, delaiJours: number | null): string | null {
  if (delaiJours === null) return null;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delaiJours);
  return d.toISOString().slice(0, 10);
}

/* -- Les faits d'un prestataire, regroupés une fois ------------------------------ */

interface FaitsDe {
  prestataire: Prestataire;
  demandes: LigneAchat[];
  interventions: De<InterventionPrestataire>[];
  pleins: De<PleinPrestataire>[];
  depensesCaisse: De<DepenseCaisse>[];
  documents: De<DocumentPrestataire>[];
  visites: De<VisitePrestataire>[];
  affretements: Affretement[];
  misesADisposition: MiseADisposition[];
  prestations: Prestation[];
  avances: Avance[];
  evaluations: Evaluation[];
}

function regrouper<T>(liste: T[], cle: (x: T) => string | null): Map<string, T[]> {
  const par = new Map<string, T[]>();
  for (const x of liste) {
    const k = cle(x);
    if (!k) continue;
    const siens = par.get(k);
    if (siens) siens.push(x);
    else par.set(k, [x]);
  }
  return par;
}

/** Les faits de chaque prestataire, regroupés une fois pour toute la liste. */
export function faitsParPrestataire(s: SourcePrestataires): (p: Prestataire) => FaitsDe {
  const demandes = regrouper(s.demandes, (d) => d.prestataireNumero);
  const interventions = regrouper(s.interventions, (x) => x.prestataireNumero);
  const pleins = regrouper(s.pleins, (x) => x.prestataireNumero);
  const caisse = regrouper(s.depensesCaisse, (x) => x.prestataireNumero);
  const documents = regrouper(s.documents, (x) => x.prestataireNumero);
  const visites = regrouper(s.visites, (x) => x.prestataireNumero);
  const affretements = regrouper(s.affretements, (a) => a.transporteurNumero);
  const mad = regrouper(s.misesADisposition, (m) => m.transporteurNumero);
  const prestations = regrouper(s.prestations, (p) => p.transporteurNumero);
  const avances = regrouper(s.avances, (a) => a.prestataireNumero);
  const evaluations = regrouper(s.evaluations, (e) => e.prestataireNumero);
  const recent = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);
  return (p) => ({
    prestataire: p,
    demandes: [...(demandes.get(p.numero) ?? [])].sort(recent),
    interventions: [...(interventions.get(p.numero) ?? [])].sort(recent),
    pleins: [...(pleins.get(p.numero) ?? [])].sort(recent),
    depensesCaisse: [...(caisse.get(p.numero) ?? [])].sort(recent),
    documents: [...(documents.get(p.numero) ?? [])].sort((a, b) => (b.dateEffet ?? "").localeCompare(a.dateEffet ?? "")),
    visites: [...(visites.get(p.numero) ?? [])].sort((a, b) => b.dateRendezVous.localeCompare(a.dateRendezVous)),
    affretements: affretements.get(p.numero) ?? [],
    misesADisposition: mad.get(p.numero) ?? [],
    prestations: prestations.get(p.numero) ?? [],
    avances: [...(avances.get(p.numero) ?? [])].sort(recent),
    evaluations: [...(evaluations.get(p.numero) ?? [])].sort(recent),
  });
}

/* -- Ce qu'on lui doit ------------------------------------------------------------ */

/**
 * Ce que l'on doit à un prestataire : le travail fait et non encore réglé.
 *
 * La règle est la même partout : **la prestation est faite, l'argent n'est pas
 * sorti**. Une demande d'achat commandée mais non livrée n'est pas une dette,
 * c'est un engagement ; une facture réglée n'en est plus une.
 */
function dettesDesFaits(f: FaitsDe): LigneDette[] {
  const delai = f.prestataire.delaiPaiementJours;
  const lignes: LigneDette[] = [];
  for (const d of f.demandes) {
    /* Livrée, facturée : le service est rendu. Réglée : la dette est éteinte. */
    if (d.etape !== "livree" && d.etape !== "facturee") continue;
    const depuis = d.dateFacture ?? d.dateLivraison ?? d.date;
    lignes.push({ numero: d.numero, origine: "achat", date: depuis, objet: d.objet, montant: d.montantReel ?? d.montantEngage ?? d.montantEstime, facture: d.etape === "facturee", echeance: echeanceDe(depuis, delai) });
  }
  for (const a of f.affretements) {
    if (a.statut !== "livre" && a.statut !== "facture") continue;
    const depuis = a.dateFacture ?? a.dateLivraison ?? a.date;
    lignes.push({ numero: a.numero, origine: "affretement", date: depuis, objet: `${a.origine} → ${a.destination}`, montant: coutAffretement(a), facture: a.statut === "facture", echeance: echeanceDe(depuis, delai) });
  }
  for (const m of f.misesADisposition) {
    if (m.statut !== "livre" && m.statut !== "facture") continue;
    const depuis = `${m.mois}-28`;
    lignes.push({ numero: m.numero, origine: "mise-a-disposition", date: depuis, objet: `${m.immatriculation} · ${m.mois}`, montant: coutMiseADisposition(m).total, facture: m.statut === "facture", echeance: echeanceDe(depuis, delai) });
  }
  for (const x of f.prestations) {
    if (x.statut !== "livre" && x.statut !== "facture") continue;
    lignes.push({ numero: x.numero, origine: "prestation", date: x.date, objet: x.libelle, montant: coutPrestation(x), facture: x.statut === "facture", echeance: echeanceDe(x.date, delai) });
  }
  return lignes.sort((a, b) => a.date.localeCompare(b.date));
}

/* -- Ce qu'un transporteur a facturé au parc -------------------------------------- */

export interface ActiviteTransport {
  /** Affrètements, mises à disposition et prestations confondus. */
  missions: number;
  montant: number;
  dates: string[];
}

/**
 * L'activité de transport d'un prestataire, depuis une date. Un transporteur
 * ne passe pas par les demandes d'achat : ce qu'il fait et ce qu'il coûte vit
 * dans ses affrètements, ses mises à disposition et ses prestations.
 */
function activiteTransportDesFaits(f: FaitsDe, depuis: string, aujourdhui: string): ActiviteTransport {
  const dates: string[] = [];
  let montant = 0;
  let missions = 0;
  for (const a of f.affretements) {
    if (a.date < depuis) continue;
    montant += coutAffretement(a);
    missions += 1;
    dates.push(a.date);
  }
  for (const m of f.misesADisposition) {
    /* La mise à disposition se facture au mois : on la date au milieu du mois,
       sans dépasser aujourd'hui — une activité datée dans le futur ferait dire
       au référentiel que le transporteur a roulé la semaine prochaine. */
    const jour = [`${m.mois}-15`, aujourdhui].sort()[0]!;
    if (jour < depuis) continue;
    montant += coutMiseADisposition(m).total;
    missions += 1;
    dates.push(jour);
  }
  for (const p of f.prestations) {
    if (p.date < depuis) continue;
    montant += coutPrestation(p);
    missions += 1;
    dates.push(p.date);
  }
  return { missions, montant, dates: dates.sort() };
}

/** L'activité de transport d'un prestataire par son numéro, depuis une date. */
export function activiteTransportDe(s: SourcePrestataires, numero: string, depuis: string): ActiviteTransport {
  const p = s.prestataires.find((x) => x.numero === numero);
  if (!p) return { missions: 0, montant: 0, dates: [] };
  return activiteTransportDesFaits(faitsParPrestataire(s)(p), depuis, s.aujourdhui);
}

/* -- Ce que les pages appellent ------------------------------------------------- */

/** La fiche d'un prestataire par son numéro PRE ; nulle quand il n'est pas au référentiel. */
export function fichePrestataireDe(s: SourcePrestataires, numero: string): FichePrestataire | null {
  const prestataire = s.prestataires.find((p) => p.numero === numero);
  if (!prestataire) return null;
  const f = faitsParPrestataire(s)(prestataire);
  return { prestataire, demandes: f.demandes, interventions: f.interventions, pleins: f.pleins, depensesCaisse: f.depensesCaisse, documents: f.documents, visites: f.visites };
}

/** Le compte d'un prestataire : ce qu'on lui doit, ce qu'on lui a avancé, ce que valent ses services — et de quoi le noter. */
export interface ComptePrestataire {
  dettes: LigneDette[];
  avances: Avance[];
  evaluations: Evaluation[];
  /** Ce qui ne se saisit pas et fonde la note avec les évaluations : interventions, reprises, ancienneté. */
  faits: Omit<FaitsNotationPrestataire, "evaluations">;
  /** L'activité de transport sur toute la relation : le transporteur se lit ici aussi. */
  transport: ActiviteTransport;
}

/**
 * Le compte et la note se calculent sur **toute** la relation, jamais sur une
 * période : une dette de l'an dernier reste une dette, et une note fondée sur
 * trois mois ne vaudrait rien.
 */
export function comptePrestataireDe(s: SourcePrestataires, numero: string): ComptePrestataire | null {
  const prestataire = s.prestataires.find((p) => p.numero === numero);
  if (!prestataire) return null;
  const f = faitsParPrestataire(s)(prestataire);
  const transport = activiteTransportDesFaits(f, "0000-01-01", s.aujourdhui);
  return {
    dettes: dettesDesFaits(f),
    avances: f.avances,
    evaluations: f.evaluations,
    faits: {
      interventions: f.interventions.length,
      reprises: repriseDe(f.interventions),
      ancienneteMois: ancienneteMois([...f.interventions.map((i) => i.date), ...f.demandes.map((d) => d.date), ...f.pleins.map((x) => x.date), ...transport.dates], s.aujourdhui),
    },
    transport,
  };
}

/** La note d'un prestataire, sur ses évaluations et ce qui se calcule. */
export function notationDe(c: ComptePrestataire, evaluations: Evaluation[] = c.evaluations): NotationPrestataire {
  return noterPrestataire({ ...c.faits, evaluations });
}

/** Le résumé d'un prestataire sur la liste : activité, compte, notation. */
export interface ResumePrestataire {
  note: NotationPrestataire;
  /** Prestations sur douze mois glissants, transport compris. */
  interventions: number;
  interventionsTotal: number;
  demandes: number;
  pleins: number;
  litres: number;
  documents: number;
  visites: number;
  vehicules: number;
  postes: string;
  /** Tout ce qu'il a facturé au parc sur douze mois : interventions, achats, caisse, transport. */
  montant: number;
  premiere: string | null;
  derniere: string | null;
  anciennete: number | null;
  evaluations: number;
  qualite: number | null;
  delai: number | null;
  prix: number | null;
  reprises: number;
  du: number;
  pieces: number;
  echu: number;
  piecesEchues: number;
  retardMax: number | null;
  avances: number;
  avancesNonSoldees: number;
  solde: number;
}

/**
 * Le résumé de chaque prestataire, calculé une fois pour toute la liste.
 * L'activité se compte sur douze mois glissants : un garage qui n'a rien fait
 * depuis un an n'est pas un garage actif, quoi qu'en dise la case « actif ».
 */
export function resumesDe(s: SourcePrestataires): Record<string, ResumePrestataire> {
  const faits = faitsParPrestataire(s);
  const debut = new Date(Date.parse(s.aujourdhui) - 365 * 86_400_000).toISOString().slice(0, 10);
  const recent = <T extends { date: string }>(l: T[]) => l.filter((x) => x.date >= debut);
  const resumes: Record<string, ResumePrestataire> = {};
  for (const p of s.prestataires) {
    const f = faits(p);
    const dettes = dettesDesFaits(f);
    const ouvertes = f.avances.filter(avanceOuverte);
    const echues = dettes.filter((d) => ageDette(d.echeance, s.aujourdhui) !== "a-venir");
    const retards = echues.map((d) => Math.round((Date.parse(s.aujourdhui) - Date.parse(d.echeance ?? s.aujourdhui)) / 86_400_000));
    const reprises = repriseDe(f.interventions);
    const transport = activiteTransportDesFaits(f, debut, s.aujourdhui);
    const transportTout = activiteTransportDesFaits(f, "0000-01-01", s.aujourdhui);
    const dates = [...f.interventions.map((i) => i.date), ...f.demandes.map((d) => d.date), ...f.pleins.map((v) => v.date), ...f.depensesCaisse.map((d) => d.date), ...transportTout.dates].sort();
    const du = dettes.reduce((t, d) => t + d.montant, 0);
    const nonSoldees = ouvertes.reduce((t, a) => t + a.montant, 0);
    const moyenne = (critere: "qualite" | "delai" | "prix") => (f.evaluations.length ? Math.round((f.evaluations.reduce((t, e) => t + e.notes[critere], 0) / f.evaluations.length) * 10) / 10 : null);
    const anciennete = ancienneteMois(dates, s.aujourdhui);
    resumes[p.numero] = {
      note: noterPrestataire({ evaluations: f.evaluations, interventions: f.interventions.length, reprises, ancienneteMois: anciennete }),
      interventions: recent(f.interventions).length + transport.missions,
      interventionsTotal: f.interventions.length + transportTout.missions,
      demandes: recent(f.demandes).length,
      pleins: recent(f.pleins).length,
      litres: recent(f.pleins).reduce((t, v) => t + v.litres, 0),
      documents: f.documents.length,
      visites: f.visites.length,
      vehicules: new Set(f.interventions.map((i) => i.vehiculeId)).size,
      postes: [...new Set(f.demandes.map((d) => POSTE_DEPENSE[d.poste]))].sort().join(", "),
      montant: recent(f.interventions).reduce((t, i) => t + i.montant, 0) + recent(f.demandes).reduce((t, d) => t + coutDe(d).montant, 0) + recent(f.depensesCaisse).reduce((t, d) => t + d.montant, 0) + transport.montant,
      premiere: dates[0] ?? null,
      derniere: dates.length ? dates[dates.length - 1]! : null,
      anciennete,
      evaluations: f.evaluations.length,
      qualite: moyenne("qualite"),
      delai: moyenne("delai"),
      prix: moyenne("prix"),
      reprises,
      du,
      pieces: dettes.length,
      echu: echues.reduce((t, d) => t + d.montant, 0),
      piecesEchues: echues.length,
      retardMax: retards.length ? Math.max(...retards) : null,
      avances: f.avances.reduce((t, a) => t + a.montant, 0),
      avancesNonSoldees: nonSoldees,
      solde: du - nonSoldees,
    };
  }
  return resumes;
}

/** Les demandes commandées d'un prestataire : ce qui compte comme un achat, hors validation et refus. */
export function achatsCommandes(demandes: LigneAchat[]): LigneAchat[] {
  return demandes.filter((d) => phaseDe(d.etape) !== "validation" && d.etape !== "refusee");
}

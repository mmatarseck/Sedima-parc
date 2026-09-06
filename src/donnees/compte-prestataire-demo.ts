/* ============================================================================
 * Le compte d'un prestataire : dettes déduites, avances et évaluations.
 *
 * **La dette ne s'invente pas ici, elle se lit ailleurs.** Chaque ligne vient
 * d'un objet que l'application tient déjà : une demande d'achat commandée et non
 * réglée, un affrètement livré, une mise à disposition facturée. C'est ce qui
 * garantit qu'elle dira toujours la même chose que la Caisse et le module
 * Transporteurs — et qu'un règlement saisi là-bas éteint la dette ici, sans
 * qu'aucune double saisie ne soit nécessaire.
 *
 * Les **avances** et les **évaluations**, elles, sont des faits nouveaux, qui
 * n'existent nulle part ailleurs : elles sont donc écrites ici, en attendant
 * leur saisie dans l'application.
 * ==========================================================================*/

import type { Avance, Evaluation, LigneDette } from "@/domaine/compte-prestataire";
import { formerNumero } from "@/domaine/reference";
import { coutAffretement, coutMiseADisposition, coutPrestation } from "@/domaine/transporteurs";
import { demandesAchat } from "./caisse-demo";
import { DATE_REFERENCE } from "./chauffeurs-demo";
import { fichePrestataire } from "./fiche-prestataire-demo";
import { listePrestataires } from "./prestataires-demo";
import { affretements, misesADisposition, prestations } from "./transporteurs-demo";

/* -- Les dettes, déduites ---------------------------------------------------------- */

function echeanceDe(date: string, delaiJours: number | null): string | null {
  if (delaiJours === null) return null;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delaiJours);
  return d.toISOString().slice(0, 10);
}

/**
 * Ce que l'on doit à un prestataire : le travail fait et non encore réglé.
 *
 * La règle est la même partout : **la prestation est faite, l'argent n'est pas
 * sorti**. Une demande d'achat commandée mais non livrée n'est pas une dette,
 * c'est un engagement ; une facture réglée n'en est plus une.
 */
export function dettesDe(prestataireNumero: string): LigneDette[] {
  const p = listePrestataires().find((x) => x.numero === prestataireNumero);
  const delai = p?.delaiPaiementJours ?? null;
  const lignes: LigneDette[] = [];

  for (const d of demandesAchat()) {
    if (d.prestataireNumero !== prestataireNumero) continue;
    /* Livrée, facturée : le service est rendu. Réglée : la dette est éteinte. */
    if (d.etape !== "livree" && d.etape !== "facturee") continue;
    const montant = d.montantReel ?? d.montantEngage ?? d.montantEstime;
    const depuis = d.dateFacture ?? d.dateLivraison ?? d.date;
    lignes.push({
      numero: d.numero,
      origine: "achat",
      date: depuis,
      objet: d.objet,
      montant,
      facture: d.etape === "facturee",
      echeance: echeanceDe(depuis, delai),
    });
  }

  for (const a of affretements()) {
    if (a.transporteurNumero !== prestataireNumero) continue;
    if (a.statut !== "livre" && a.statut !== "facture") continue;
    lignes.push({
      numero: a.numero,
      origine: "affretement",
      date: a.dateFacture ?? a.dateLivraison ?? a.date,
      objet: `${a.origine} → ${a.destination}`,
      montant: coutAffretement(a),
      facture: a.statut === "facture",
      echeance: echeanceDe(a.dateFacture ?? a.dateLivraison ?? a.date, delai),
    });
  }

  for (const m of misesADisposition()) {
    if (m.transporteurNumero !== prestataireNumero) continue;
    if (m.statut !== "livre" && m.statut !== "facture") continue;
    const depuis = `${m.mois}-28`;
    lignes.push({
      numero: m.numero,
      origine: "mise-a-disposition",
      date: depuis,
      objet: `${m.immatriculation} · ${m.mois}`,
      montant: coutMiseADisposition(m).total,
      facture: m.statut === "facture",
      echeance: echeanceDe(depuis, delai),
    });
  }

  for (const x of prestations()) {
    if (x.transporteurNumero !== prestataireNumero) continue;
    if (x.statut !== "livre" && x.statut !== "facture") continue;
    lignes.push({
      numero: x.numero,
      origine: "prestation",
      date: x.date,
      objet: x.libelle,
      montant: coutPrestation(x),
      facture: x.statut === "facture",
      echeance: echeanceDe(x.date, delai),
    });
  }

  return lignes.sort((a, b) => a.date.localeCompare(b.date));
}

/* -- Les avances ------------------------------------------------------------------- */

/*
 * Quatre avances, dont **deux encore ouvertes** — c'est le cas qui compte. Une
 * avance qui traîne dit l'une de deux choses : ou le service n'a jamais été
 * rendu, ou il l'a été et personne ne l'a rapproché. Dans les deux cas il faut
 * aller voir, et c'est pourquoi l'écran les met en avant.
 */
const AVANCES: { prestataire: string; date: string; montant: number; motif: string; imputeeSur: string | null; dateImputation: string | null; autorisePar: string }[] = [
  {
    prestataire: "La Sénégalaise de l'Automobile",
    date: "2026-06-02",
    montant: 1_500_000,
    motif: "Acompte sur commande de pièces moteur — révision du Magnum 520",
    imputeeSur: "DA-2026-00041",
    dateImputation: "2026-06-28",
    autorisePar: "Direction des Opérations",
  },
  {
    prestataire: "TATA Pikine",
    date: "2026-07-14",
    montant: 900_000,
    motif: "Avance sur commande de pneumatiques, délai d'importation",
    imputeeSur: null,
    dateImputation: null,
    autorisePar: "Direction des Opérations",
  },
  {
    prestataire: "ADEX Express",
    date: "2026-08-01",
    montant: 5_000_000,
    motif: "Avance sur la mise à disposition du mois d'août",
    imputeeSur: null,
    dateImputation: null,
    autorisePar: "Direction générale",
  },
  {
    prestataire: "First Garage",
    date: "2026-03-11",
    montant: 450_000,
    motif: "Acompte sur réfection de boîte de vitesses",
    imputeeSur: "INT-2026-01004",
    dateImputation: "2026-04-02",
    autorisePar: "Gestionnaire de parc",
  },
];

let CACHE_AVANCES: Avance[] | null = null;

export function avances(): Avance[] {
  if (CACHE_AVANCES) return CACHE_AVANCES;
  const parNom = new Map(listePrestataires().map((p) => [p.raisonSociale, p.numero]));
  CACHE_AVANCES = AVANCES.map((a, rang) => ({
    numero: formerNumero("avance", a.date, rang + 1),
    prestataireNumero: parNom.get(a.prestataire) ?? "",
    date: a.date,
    montant: a.montant,
    motif: a.motif,
    imputeeSur: a.imputeeSur,
    dateImputation: a.dateImputation,
    autorisePar: a.autorisePar,
  })).filter((a) => a.prestataireNumero !== "");
  return CACHE_AVANCES;
}

export function avancesDe(prestataireNumero: string): Avance[] {
  return avances()
    .filter((a) => a.prestataireNumero === prestataireNumero)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/* -- Les évaluations ---------------------------------------------------------------- */

/*
 * Des évaluations telles que l'atelier les porterait à la réception d'un
 * service : trois notes et une phrase. On en pose sur les prestataires les plus
 * sollicités, en laissant volontairement les autres sans évaluation — c'est le
 * cas le plus fréquent au démarrage, et l'écran doit savoir le dire.
 */
const EVALUATIONS: { prestataire: string; date: string; piece: string; libelle: string; qualite: number; delai: number; prix: number; commentaire: string | null; auteur: string }[] = [
  { prestataire: "La Sénégalaise de l'Automobile", date: "2026-06-16", piece: "INT-2026-01012", libelle: "Vidange et filtres — AA 032 EA", qualite: 5, delai: 4, prix: 4, commentaire: "Travail propre, véhicule rendu le jour même.", auteur: "Gestionnaire de parc" },
  { prestataire: "La Sénégalaise de l'Automobile", date: "2026-04-08", piece: "INT-2026-01008", libelle: "Freinage — AA 236 MR", qualite: 4, delai: 5, prix: 4, commentaire: null, auteur: "Gestionnaire de parc" },
  { prestataire: "La Sénégalaise de l'Automobile", date: "2026-02-19", piece: "INT-2026-01003", libelle: "Suspension — AA 285 PT", qualite: 4, delai: 4, prix: 3, commentaire: "Devis dépassé de 12 % sans prévenir.", auteur: "Responsable atelier" },
  { prestataire: "First Garage", date: "2026-04-02", piece: "INT-2026-01004", libelle: "Boîte de vitesses — AA 565 GA", qualite: 2, delai: 1, prix: 3, commentaire: "Trois semaines d'immobilisation au lieu d'une, et la boîte a dû être reprise.", auteur: "Responsable atelier" },
  { prestataire: "First Garage", date: "2026-05-27", piece: "INT-2026-01009", libelle: "Reprise boîte — AA 565 GA", qualite: 3, delai: 3, prix: 2, commentaire: "Reprise facturée, ce qui n'aurait pas dû l'être.", auteur: "Responsable atelier" },
  { prestataire: "Garage SEDIMA", date: "2026-05-05", piece: "INT-2026-01007", libelle: "Batterie — AA 032 EA", qualite: 4, delai: 5, prix: 5, commentaire: null, auteur: "Gestionnaire de parc" },
  { prestataire: "TATA Pikine", date: "2026-07-30", piece: "DA-2026-00052", libelle: "Pneumatiques 315/80 R22.5", qualite: 4, delai: 2, prix: 4, commentaire: "Six semaines de délai, annoncées à trois.", auteur: "Responsable carburant" },
  { prestataire: "ADEX Express", date: "2026-08-20", piece: "MAD-2026-00006", libelle: "Mise à disposition — juillet", qualite: 4, delai: 4, prix: 3, commentaire: "Service régulier ; le contrat à la journée reste inadapté.", auteur: "Direction des Opérations" },
];

let CACHE_EVALUATIONS: Evaluation[] | null = null;

/**
 * Les évaluations, **rattachées à de vraies interventions**.
 *
 * Les références écrites plus haut sont indicatives : les interventions du jeu
 * de démonstration sont engendrées par véhicule, et un numéro inventé
 * n'aurait mené nulle part. On rattache donc chaque évaluation à une
 * intervention réelle du prestataire, la plus proche de sa date — sans quoi la
 * colonne « Pièce » aurait pointé dans le vide, ce qui est pire que de ne rien
 * afficher.
 */
export function evaluations(): Evaluation[] {
  if (CACHE_EVALUATIONS) return CACHE_EVALUATIONS;
  const parNom = new Map(listePrestataires().map((p) => [p.raisonSociale, p.numero]));
  const dejaPrises = new Set<string>();
  CACHE_EVALUATIONS = EVALUATIONS.map((e, rang) => {
    const numero = parNom.get(e.prestataire) ?? "";
    const fiche = numero ? fichePrestataire(numero) : null;
    const candidates = (fiche?.interventions ?? []).filter((i) => !dejaPrises.has(i.numero)).sort((a, b) => Math.abs(Date.parse(a.date) - Date.parse(e.date)) - Math.abs(Date.parse(b.date) - Date.parse(e.date)));
    const piece = candidates[0] ?? null;
    if (piece) dejaPrises.add(piece.numero);
    return {
      numero: formerNumero("evaluation", piece?.date ?? e.date, rang + 1),
      prestataireNumero: numero,
      /* L'évaluation se fait à la réception : le lendemain du service. */
      date: piece ? decalerJour(piece.date, 1) : e.date,
      pieceNumero: piece?.numero ?? e.piece,
      pieceLibelle: piece ? `${piece.objet} — ${piece.immatriculationAffichee}` : e.libelle,
      notes: { qualite: e.qualite, delai: e.delai, prix: e.prix },
      commentaire: e.commentaire,
      auteur: e.auteur,
    };
  }).filter((e) => e.prestataireNumero !== "");
  return CACHE_EVALUATIONS;
}

function decalerJour(date: string, jours: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

export function evaluationsDe(prestataireNumero: string): Evaluation[] {
  return evaluations()
    .filter((e) => e.prestataireNumero === prestataireNumero)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/* -- Ce qu'il faut pour noter --------------------------------------------------------- */

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
      (p) =>
        p.vehiculeId === triees[i]!.vehiculeId &&
        motsClesCommuns(p.objet, triees[i]!.objet) &&
        (Date.parse(triees[i]!.date) - Date.parse(p.date)) / 86_400_000 <= JOURS_REPRISE,
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
export function ancienneteMois(dates: string[]): number | null {
  const premieres = dates.filter(Boolean).sort();
  if (premieres.length === 0) return null;
  const debut = new Date(`${premieres[0]}T00:00:00Z`);
  const fin = new Date(`${DATE_REFERENCE}T00:00:00Z`);
  return Math.max(0, Math.round((fin.getTime() - debut.getTime()) / (30.44 * 86_400_000)));
}

/* -- Ce qu'un transporteur a facturé au parc ---------------------------------------- */

export interface ActiviteTransport {
  /** Affrètements, mises à disposition et prestations confondus. */
  missions: number;
  montant: number;
  dates: string[];
}

/**
 * L'activité de transport d'un prestataire, depuis une date.
 *
 * Un transporteur ne passe pas par les demandes d'achat : ce qu'il fait et ce
 * qu'il coûte vit dans ses affrètements, ses mises à disposition et ses
 * prestations. Sans cette lecture, le référentiel affichait « — » en face
 * d'ADEX, qui pèse pourtant deux cents millions.
 */
export function activiteTransport(raisonSociale: string, depuis: string): ActiviteTransport {
  const dates: string[] = [];
  let montant = 0;
  let missions = 0;
  for (const a of affretements()) {
    if (a.transporteur !== raisonSociale || a.date < depuis) continue;
    montant += coutAffretement(a);
    missions += 1;
    dates.push(a.date);
  }
  for (const m of misesADisposition()) {
    /* La mise à disposition se facture au mois : on la date au milieu du mois,
       sans dépasser aujourd'hui — une activité datée dans le futur ferait dire
       au référentiel que le transporteur a roulé la semaine prochaine. */
    const jour = [`${m.mois}-15`, DATE_REFERENCE].sort()[0]!;
    if (m.transporteur !== raisonSociale || jour < depuis) continue;
    montant += coutMiseADisposition(m).total;
    missions += 1;
    dates.push(jour);
  }
  for (const p of prestations()) {
    if (p.transporteur !== raisonSociale || p.date < depuis) continue;
    montant += coutPrestation(p);
    missions += 1;
    dates.push(p.date);
  }
  return { missions, montant, dates: dates.sort() };
}

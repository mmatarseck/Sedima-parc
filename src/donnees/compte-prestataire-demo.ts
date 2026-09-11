/* ============================================================================
 * Le compte d'un prestataire — données de démonstration.
 *
 * **La dette ne s'invente pas ici, elle se lit ailleurs.** Chaque ligne vient
 * d'un objet que l'application tient déjà : une demande d'achat commandée et non
 * réglée, un affrètement livré, une mise à disposition facturée. C'est ce qui
 * garantit qu'elle dira toujours la même chose que la Caisse et le module
 * Transporteurs — et qu'un règlement saisi là-bas éteint la dette ici, sans
 * qu'aucune double saisie ne soit nécessaire.
 *
 * Les **avances** et les **évaluations**, elles, sont des faits nouveaux, qui
 * n'existent nulle part ailleurs : elles sont écrites ici pour la
 * démonstration, et en table (0002) en production.
 *
 * Le rassemblement — dettes déduites, activité de transport, notation — vit
 * dans le domaine (`assembler-prestataires.ts`) ; ce module lui donne le jeu
 * du navigateur, `donnees/prestataires.ts` lui donne la base. Les fonctions
 * `dettesDe`, `avancesDe`, `evaluationsDe`, `activiteTransport`, `repriseDe`
 * et `ancienneteMois` restent, pour les rapports de démonstration.
 * ==========================================================================*/

import { activiteTransportDe, ancienneteMois as ancienneteMoisDe, comptePrestataireDe, repriseDe as repriseDesInterventions, type ActiviteTransport, type SourcePrestataires } from "@/domaine/assembler-prestataires";
import type { Avance, Evaluation, LigneDette } from "@/domaine/compte-prestataire";
import { formerNumero } from "@/domaine/reference";
import { demandesAchat } from "./caisse-demo";
import { DATE_REFERENCE } from "./chauffeurs-demo";
import { fichePrestataire } from "./fiche-prestataire-demo";
import { listePrestataires } from "./prestataires-demo";
import { affretements, misesADisposition, prestations } from "./transporteurs-demo";

export { JOURS_REPRISE } from "@/domaine/assembler-prestataires";
export type { ActiviteTransport } from "@/domaine/assembler-prestataires";

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

/* -- Les évaluations ---------------------------------------------------------------- */

/*
 * Des évaluations telles que l'atelier les porterait à la réception d'un
 * service : trois notes et une phrase. On en pose sur les prestataires les plus
 * sollicités, en laissant volontairement les autres sans évaluation — c'est le
 * cas le plus fréquent au démarrage, et l'écran doit savoir le dire.
 */
const EVALUATIONS: { prestataire: string; date: string; piece: string; libelle: string; qualite: number; delai: number; prix: number; commentaire: string | null; auteur: string }[] = [
  { prestataire: "La Sénégalaise de l'Automobile", date: "2026-06-16", piece: "INT-2026-01012", libelle: "Vidange et filtres — AA-032-EA", qualite: 5, delai: 4, prix: 4, commentaire: "Travail propre, véhicule rendu le jour même.", auteur: "Gestionnaire de parc" },
  { prestataire: "La Sénégalaise de l'Automobile", date: "2026-04-08", piece: "INT-2026-01008", libelle: "Freinage — AA-236-MR", qualite: 4, delai: 5, prix: 4, commentaire: null, auteur: "Gestionnaire de parc" },
  { prestataire: "La Sénégalaise de l'Automobile", date: "2026-02-19", piece: "INT-2026-01003", libelle: "Suspension — AA-285-PT", qualite: 4, delai: 4, prix: 3, commentaire: "Devis dépassé de 12 % sans prévenir.", auteur: "Responsable atelier" },
  { prestataire: "First Garage", date: "2026-04-02", piece: "INT-2026-01004", libelle: "Boîte de vitesses — AA-565-GA", qualite: 2, delai: 1, prix: 3, commentaire: "Trois semaines d'immobilisation au lieu d'une, et la boîte a dû être reprise.", auteur: "Responsable atelier" },
  { prestataire: "First Garage", date: "2026-05-27", piece: "INT-2026-01009", libelle: "Reprise boîte — AA-565-GA", qualite: 3, delai: 3, prix: 2, commentaire: "Reprise facturée, ce qui n'aurait pas dû l'être.", auteur: "Responsable atelier" },
  { prestataire: "Garage SEDIMA", date: "2026-05-05", piece: "INT-2026-01007", libelle: "Batterie — AA-032-EA", qualite: 4, delai: 5, prix: 5, commentaire: null, auteur: "Gestionnaire de parc" },
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

/* -- La source de la démonstration --------------------------------------------------- */

let CACHE_SOURCE: SourcePrestataires | null = null;

/** Les faits du module, tels que la démonstration les tient : chaque fiche relue, rapportée à son numéro. */
export function sourcePrestatairesDemo(): SourcePrestataires {
  if (CACHE_SOURCE) return CACHE_SOURCE;
  const prestataires = listePrestataires();
  const source: SourcePrestataires = {
    prestataires,
    demandes: demandesAchat(),
    interventions: [],
    pleins: [],
    depensesCaisse: [],
    documents: [],
    visites: [],
    affretements: affretements(),
    misesADisposition: misesADisposition(),
    prestations: prestations(),
    avances: avances(),
    evaluations: evaluations(),
    aujourdhui: DATE_REFERENCE,
  };
  for (const p of prestataires) {
    const f = fichePrestataire(p.numero);
    if (!f) continue;
    for (const x of f.interventions) source.interventions.push({ ...x, prestataireNumero: p.numero });
    for (const x of f.pleins) source.pleins.push({ ...x, prestataireNumero: p.numero });
    for (const x of f.depensesCaisse) source.depensesCaisse.push({ ...x, prestataireNumero: p.numero });
    for (const x of f.documents) source.documents.push({ ...x, prestataireNumero: p.numero });
    for (const x of f.visites) source.visites.push({ ...x, prestataireNumero: p.numero });
  }
  CACHE_SOURCE = source;
  return source;
}

/* -- Ce que les rapports de démonstration appellent encore ----------------------------- */

export function dettesDe(prestataireNumero: string): LigneDette[] {
  return comptePrestataireDe(sourcePrestatairesDemo(), prestataireNumero)?.dettes ?? [];
}

export function avancesDe(prestataireNumero: string): Avance[] {
  return avances()
    .filter((a) => a.prestataireNumero === prestataireNumero)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function evaluationsDe(prestataireNumero: string): Evaluation[] {
  return evaluations()
    .filter((e) => e.prestataireNumero === prestataireNumero)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export const repriseDe = repriseDesInterventions;

/** Les mois écoulés depuis la première pièce connue d'un prestataire, à la date de la démonstration. */
export function ancienneteMois(dates: string[]): number | null {
  return ancienneteMoisDe(dates, DATE_REFERENCE);
}

/** L'activité de transport d'un prestataire par sa raison sociale, depuis une date. */
export function activiteTransport(raisonSociale: string, depuis: string): ActiviteTransport {
  const s = sourcePrestatairesDemo();
  const p = s.prestataires.find((x) => x.raisonSociale === raisonSociale);
  return p ? activiteTransportDe(s, p.numero, depuis) : { missions: 0, montant: 0, dates: [] };
}

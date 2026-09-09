/* ============================================================================
 * Le module Transporteurs, assemblé depuis une source de faits.
 *
 * La liste des transporteurs et la fiche de chacun ne calculent rien qui ne
 * se calcule déjà ailleurs : elles rassemblent. Ce module tient ce
 * rassemblement, **pur** — il reçoit les faits (prestataires, profils, flotte
 * tierce, grilles, missions, relevé) et rend les lignes de la liste et la
 * fiche. La démonstration lui donne le jeu du navigateur, la base lui donne
 * ce que `lire_transporteurs()` (0025) rend : les deux dressent la même
 * liste, avec les mêmes règles, et c'est ce qui garantit qu'un chiffre lu
 * sur l'écran de démonstration se retrouve en production.
 * ==========================================================================*/

import type { CamionTiers, ChauffeurTiers, ProfilTransporteur, RattachementLocalite } from "./flotte-tierce";
import { camionsDe, capaciteTotale, chauffeursDe } from "./flotte-tierce";
import type { FaitsNotation, NotationTransporteur } from "./notation-transporteur";
import { mediane, noter } from "./notation-transporteur";
import type { Prestataire } from "./prestataires";
import type { LigneReleve } from "./releve-transport";
import { ecartPesee } from "./releve-transport";
import type { Affretement, LigneTarif, MiseADisposition, Prestation } from "./transporteurs";
import { coutAffretement, coutMiseADisposition, coutPrestation, ecartFacturation, montantAttendu, prestationFaite, tarifApplicable } from "./transporteurs";

/* -- Ce qu'il faut savoir pour dresser le module ------------------------------ */

export interface SourceTransporteurs {
  /** Les prestataires de type transporteur, actifs ou non. */
  prestataires: Prestataire[];
  /** Le profil de chacun, par numéro ; un transporteur sans profil reçoit le profil par défaut. */
  profils: Map<string, ProfilTransporteur>;
  camions: CamionTiers[];
  chauffeurs: ChauffeurTiers[];
  grilles: LigneTarif[];
  rattachements: RattachementLocalite[];
  affretements: Affretement[];
  misesADisposition: MiseADisposition[];
  prestations: Prestation[];
  /** Les lignes du relevé de transport portées par un transporteur. */
  livraisons: LigneReleve[];
  /** Le nombre de semaines que le relevé couvre, tous modes confondus : le dénominateur de la régularité. */
  semainesPeriode: number;
  /** La date du jour, pour pré-remplir une saisie et borner l'historique. */
  aujourdhui: string;
}

/** Ce qu'un transporteur sans profil enregistré est censé être : un particulier payé à la tonne, sans écrit. */
export function profilParDefaut(numero: string): ProfilTransporteur {
  return { numero, forme: "particulier", sousContrat: false, referenceContrat: null, debutContrat: null, finContrat: null, modes: ["tonne"], camionsEngages: null, commentaire: null };
}

export interface ActiviteTransporteur {
  missions: number;
  /** Tonnes effectivement livrées — les missions annulées n'y sont pas. */
  tonnes: number;
  cout: number;
  /** Ce qui est fait et pas encore réglé. */
  restantDu: number;
  ecartMoyen: number | null;
  horsTolerance: number;
  /** Missions confiées faute de véhicule disponible ou immobilisé. */
  subies: number;
  /** Coût ramené à la tonne : la comparaison que réclame le compte rendu ADEX. */
  coutParTonne: number | null;
}

export interface FicheTransporteur {
  prestataire: Prestataire;
  profil: ProfilTransporteur;
  camions: CamionTiers[];
  chauffeurs: ChauffeurTiers[];
  capaciteTonnes: number | null;
  grille: LigneTarif[];
  affretements: (Affretement & { attendu: number | null })[];
  misesADisposition: MiseADisposition[];
  prestations: Prestation[];
  /** Le relevé de transport de ce transporteur — ses chargements, jour par jour. */
  livraisons: LigneReleve[];
  activite: ActiviteTransporteur;
  notation: NotationTransporteur;
  /** La date du jour, pour pré-remplir une saisie. */
  aujourdhui: string;
}

export interface LigneListeTransporteur {
  prestataire: Prestataire;
  profil: ProfilTransporteur;
  camions: number;
  chauffeurs: number;
  capaciteTonnes: number | null;
  activite: ActiviteTransporteur;
  notation: NotationTransporteur;
}

/* -- Les faits d'un transporteur, regroupés une fois ---------------------------- */

interface FaitsDe {
  affretements: Affretement[];
  misesADisposition: MiseADisposition[];
  prestations: Prestation[];
  livraisons: LigneReleve[];
  grille: LigneTarif[];
}

function regrouper<T>(liste: T[], cle: (x: T) => string | null): Map<string, T[]> {
  const par = new Map<string, T[]>();
  for (const x of liste) {
    const k = cle(x);
    if (k === null) continue;
    const siens = par.get(k);
    if (siens) siens.push(x);
    else par.set(k, [x]);
  }
  return par;
}

/** Les faits de chaque transporteur, regroupés une fois pour toute la liste. */
function faitsParTransporteur(s: SourceTransporteurs): (numero: string) => FaitsDe {
  const aff = regrouper(s.affretements, (a) => a.transporteurNumero);
  const mad = regrouper(s.misesADisposition, (m) => m.transporteurNumero);
  const pres = regrouper(s.prestations, (p) => p.transporteurNumero);
  const liv = regrouper(s.livraisons, (l) => l.transporteurNumero);
  const gri = regrouper(s.grilles, (g) => g.transporteurNumero);
  return (numero) => ({
    affretements: aff.get(numero) ?? [],
    misesADisposition: mad.get(numero) ?? [],
    prestations: pres.get(numero) ?? [],
    livraisons: liv.get(numero) ?? [],
    grille: gri.get(numero) ?? [],
  });
}

/** Ce que le transporteur a représenté sur la période servie. */
function activiteDe(s: SourceTransporteurs, f: FaitsDe): { activite: ActiviteTransporteur; attendus: (number | null)[]; ecartsPct: number[] } {
  const attendus = f.affretements.map((a) => montantAttendu(tarifApplicable(s.grilles, a, s.rattachements), a));
  const ecarts = f.affretements.map((a, i) => ecartFacturation(a, attendus[i] ?? null)).filter((e): e is NonNullable<typeof e> => e !== null);
  const cout =
    f.affretements.reduce((t, a) => t + coutAffretement(a), 0) +
    f.misesADisposition.reduce((t, m) => t + coutMiseADisposition(m).total, 0) +
    f.prestations.reduce((t, p) => t + coutPrestation(p), 0);
  const tonnes =
    f.affretements.filter((a) => prestationFaite(a.statut)).reduce((t, a) => t + (a.tonnageLivre ?? a.tonnagePrevu), 0) +
    f.misesADisposition.reduce((t, m) => t + (m.tonnesTransportees ?? 0), 0);
  const restant = (statut: string) => statut === "livre" || statut === "facture";

  return {
    attendus,
    ecartsPct: ecarts.map((e) => e.pct),
    activite: {
      missions: f.affretements.length + f.misesADisposition.length + f.prestations.length,
      tonnes,
      cout,
      restantDu:
        f.affretements.filter((a) => restant(a.statut)).reduce((t, a) => t + coutAffretement(a), 0) +
        f.misesADisposition.filter((m) => restant(m.statut)).reduce((t, m) => t + coutMiseADisposition(m).total, 0) +
        f.prestations.filter((p) => restant(p.statut)).reduce((t, p) => t + coutPrestation(p), 0),
      ecartMoyen: ecarts.length ? Math.round((ecarts.reduce((t, e) => t + e.pct, 0) / ecarts.length) * 10) / 10 : null,
      horsTolerance: ecarts.filter((e) => Math.abs(e.pct) > 5).length,
      subies: f.affretements.filter((a) => a.motif === "aucun-disponible" || a.motif === "vehicule-immobilise").length,
      /* Le coût à la tonne n'a de sens que s'il y a des tonnes : une prestation
         au sac ou un transport de personnel n'en porte pas, et le rapporter à
         zéro donnerait un infini qui ne veut rien dire. */
      coutParTonne: tonnes > 0 ? Math.round(cout / tonnes) : null,
    },
  };
}

/** Les faits d'un transporteur, rassemblés pour le noter. */
function faitsNotation(s: SourceTransporteurs, f: FaitsDe, profil: ProfilTransporteur, activite: ActiviteTransporteur, ecartsPct: number[], medianeCout: number | null): FaitsNotation {
  /* Le tonnage se contrôle sur le relevé, pas sur l'affrètement : c'est là que
     le pont bascule pose son chiffre. */
  const peses = f.livraisons.map((l) => ecartPesee(l)).filter((e): e is number => e !== null);
  const semaines = new Set(f.livraisons.map((l) => l.semaine));
  return {
    ecartPrixMoyenPct: ecartsPct.length ? Math.round((ecartsPct.reduce((t, e) => t + e, 0) / ecartsPct.length) * 10) / 10 : null,
    missionsTarifees: ecartsPct.length,
    ecartPeseeMoyenPct: peses.length ? Math.round((peses.reduce((t, e) => t + e, 0) / peses.length) * 10) / 10 : null,
    chargementsPeses: peses.length,
    sousContrat: profil.sousContrat,
    partGrilleOpposable: f.grille.length ? f.grille.filter((g) => g.source === "contrat").length / f.grille.length : null,
    semainesActives: semaines.size,
    semainesPeriode: s.semainesPeriode,
    coutParTonne: activite.coutParTonne,
    medianeCoutParTonne: medianeCout,
  };
}

/* -- Ce que les pages appellent ------------------------------------------------- */

/** Les transporteurs du référentiel, avec de quoi dresser une liste — les plus coûteux d'abord. */
export function listeTransporteursDe(s: SourceTransporteurs): LigneListeTransporteur[] {
  const faits = faitsParTransporteur(s);
  const calculs = s.prestataires.map((p) => {
    const f = faits(p.numero);
    return { p, f, ...activiteDe(s, f) };
  });
  /* La médiane du coût à la tonne, tous transporteurs confondus : le repère
     de la dimension « coût », qui ne juge jamais dans l'absolu. */
  const medianeCout = mediane(calculs.map((c) => c.activite.coutParTonne).filter((v): v is number => v !== null));
  return calculs
    .map(({ p, f, activite, ecartsPct }) => {
      const profil = s.profils.get(p.numero) ?? profilParDefaut(p.numero);
      const camions = camionsDe(s.camions, p.numero);
      return {
        prestataire: p,
        profil,
        camions: camions.length,
        chauffeurs: chauffeursDe(s.chauffeurs, p.numero).length,
        capaciteTonnes: capaciteTotale(camions),
        activite,
        notation: noter(faitsNotation(s, f, profil, activite, ecartsPct, medianeCout)),
      };
    })
    .sort((a, b) => b.activite.cout - a.activite.cout);
}

/** La fiche d'un transporteur, par son numéro de prestataire ; nulle s'il n'en est pas un. */
export function ficheTransporteurDe(s: SourceTransporteurs, numero: string): FicheTransporteur | null {
  const prestataire = s.prestataires.find((p) => p.numero === numero && p.type === "transporteur");
  if (!prestataire) return null;
  const faits = faitsParTransporteur(s);
  const f = faits(numero);
  const { activite, attendus, ecartsPct } = activiteDe(s, f);
  const medianeCout = mediane(s.prestataires.map((p) => activiteDe(s, faits(p.numero)).activite.coutParTonne).filter((v): v is number => v !== null));
  const profil = s.profils.get(numero) ?? profilParDefaut(numero);
  const camions = camionsDe(s.camions, numero);

  return {
    prestataire,
    profil,
    camions,
    chauffeurs: chauffeursDe(s.chauffeurs, numero),
    capaciteTonnes: capaciteTotale(camions),
    grille: f.grille,
    affretements: f.affretements.map((a, i) => ({ ...a, attendu: attendus[i] ?? null })).sort((a, b) => b.date.localeCompare(a.date)),
    misesADisposition: [...f.misesADisposition].sort((a, b) => b.mois.localeCompare(a.mois)),
    prestations: [...f.prestations].sort((a, b) => b.date.localeCompare(a.date)),
    livraisons: [...f.livraisons].sort((a, b) => b.date.localeCompare(a.date)),
    activite,
    notation: noter(faitsNotation(s, f, profil, activite, ecartsPct, medianeCout)),
    aujourdhui: s.aujourdhui,
  };
}

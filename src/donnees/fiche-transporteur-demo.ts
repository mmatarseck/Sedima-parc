/* ============================================================================
 * La fiche d'un transporteur — tout ce qu'il est et tout ce qu'il fait.
 *
 * Bâtie sur le modèle de la fiche véhicule et de la fiche chauffeur, comme le
 * métier l'a demandé : « sur la page des transporteurs, ça devrait être plus ou
 * moins comme la page véhicule ou chauffeur ». Le tableau qui tenait lieu de
 * module ne permettait ni de voir la flotte d'un transporteur, ni de suivre sa
 * performance, ni de savoir sur quel écrit on s'appuie pour lui parler.
 *
 * Rien ne se calcule ici qui ne se calcule déjà ailleurs : la fiche rassemble,
 * elle n'invente pas. C'est ce qui garantit qu'elle dira la même chose que
 * l'écran Transporteurs et que les rapports.
 * ==========================================================================*/

import type { CamionTiers, ChauffeurTiers, ProfilTransporteur } from "@/domaine/flotte-tierce";
import { camionsDe, capaciteTotale, chauffeursDe } from "@/domaine/flotte-tierce";
import type { Prestataire } from "@/domaine/prestataires";
import type { Affretement, LigneTarif, MiseADisposition, Prestation } from "@/domaine/transporteurs";
import { coutAffretement, coutMiseADisposition, coutPrestation, ecartFacturation, montantAttendu, prestationFaite, tarifApplicable } from "@/domaine/transporteurs";
import { camionsTiers, chauffeursTiers, profilTransporteur, rattachements } from "./flotte-tierce-demo";
import type { FaitsNotation, NotationTransporteur } from "@/domaine/notation-transporteur";
import { mediane, noter } from "@/domaine/notation-transporteur";
import { ecartPesee } from "@/domaine/releve-transport";
import type { LigneReleve } from "@/domaine/releve-transport";
import { DATE_REFERENCE } from "./chauffeurs-demo";
import { relevesTransport, semainesRelevees } from "./releve-demo";
import { listePrestataires } from "./prestataires-demo";
import { affretements, grillesTarifaires, misesADisposition, prestations } from "./transporteurs-demo";

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

/** Les faits d'un transporteur, rassemblés pour le noter. */
function faitsNotation(numero: string, activite: ActiviteTransporteur, medianeCout: number | null): FaitsNotation {
  const grilles = grillesTarifaires().filter((g) => g.transporteurNumero === numero);
  const siens = affretements().filter((a) => a.transporteurNumero === numero);
  const rattache = rattachements();
  const ecarts = siens
    .map((a) => ecartFacturation(a, montantAttendu(tarifApplicable(grillesTarifaires(), a, rattache), a)))
    .filter((e): e is NonNullable<typeof e> => e !== null);

  /* Le tonnage se contrôle sur le relevé, pas sur l'affrètement : c'est là que
     le pont bascule pose son chiffre. */
  const lignes = relevesTransport().filter((l) => l.transporteurNumero === numero);
  const peses = lignes.map((l) => ecartPesee(l)).filter((e): e is number => e !== null);
  const semaines = new Set(lignes.map((l) => l.semaine));

  return {
    ecartPrixMoyenPct: ecarts.length ? Math.round((ecarts.reduce((s, e) => s + e.pct, 0) / ecarts.length) * 10) / 10 : null,
    missionsTarifees: ecarts.length,
    ecartPeseeMoyenPct: peses.length ? Math.round((peses.reduce((s, e) => s + e, 0) / peses.length) * 10) / 10 : null,
    chargementsPeses: peses.length,
    sousContrat: false,
    partGrilleOpposable: grilles.length ? grilles.filter((g) => g.source === "contrat").length / grilles.length : null,
    semainesActives: semaines.size,
    semainesPeriode: semainesRelevees().length,
    coutParTonne: activite.coutParTonne,
    medianeCoutParTonne: medianeCout,
  };
}

/** La médiane du coût à la tonne, tous transporteurs confondus. */
function medianeCoutTonne(): number | null {
  return mediane(
    listePrestataires()
      .filter((p) => p.type === "transporteur")
      .map((p) => activiteDe(p.numero).coutParTonne)
      .filter((v): v is number => v !== null),
  );
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

/** Les transporteurs du référentiel, avec de quoi dresser une liste. */
export function listeTransporteurs(): {
  prestataire: Prestataire;
  profil: ProfilTransporteur;
  camions: number;
  chauffeurs: number;
  capaciteTonnes: number | null;
  activite: ActiviteTransporteur;
  notation: NotationTransporteur;
}[] {
  const tousCamions = camionsTiers();
  const tousChauffeurs = chauffeursTiers();
  const medianeCout = medianeCoutTonne();
  return listePrestataires()
    .filter((p) => p.type === "transporteur")
    .map((p) => {
      const camions = camionsDe(tousCamions, p.numero);
      return {
        prestataire: p,
        profil: profilTransporteur(p.raisonSociale, p.numero),
        camions: camions.length,
        chauffeurs: chauffeursDe(tousChauffeurs, p.numero).length,
        capaciteTonnes: capaciteTotale(camions),
        activite: activiteDe(p.numero),
        notation: noter({ ...faitsNotation(p.numero, activiteDe(p.numero), medianeCout), sousContrat: profilTransporteur(p.raisonSociale, p.numero).sousContrat }),
      };
    })
    .sort((a, b) => b.activite.cout - a.activite.cout);
}

/** Ce que le transporteur a représenté sur les douze mois servis. */
function activiteDe(numero: string): ActiviteTransporteur {
  const grilles = grillesTarifaires();
  const siens = affretements().filter((a) => a.transporteurNumero === numero);
  const attendus = siens.map((a) => montantAttendu(tarifApplicable(grilles, a, rattachements()), a));
  const ecarts = siens.map((a, i) => ecartFacturation(a, attendus[i] ?? null)).filter((e): e is NonNullable<typeof e> => e !== null);
  const mises = misesADisposition().filter((m) => m.transporteurNumero === numero);
  const presta = prestations().filter((p) => p.transporteurNumero === numero);

  const cout = siens.reduce((s, a) => s + coutAffretement(a), 0) + mises.reduce((s, m) => s + coutMiseADisposition(m).total, 0) + presta.reduce((s, p) => s + coutPrestation(p), 0);
  const tonnes =
    siens.filter((a) => prestationFaite(a.statut)).reduce((s, a) => s + (a.tonnageLivre ?? a.tonnagePrevu), 0) + mises.reduce((s, m) => s + (m.tonnesTransportees ?? 0), 0);

  return {
    missions: siens.length + mises.length + presta.length,
    tonnes,
    cout,
    restantDu:
      siens.filter((a) => a.statut === "livre" || a.statut === "facture").reduce((s, a) => s + coutAffretement(a), 0) +
      mises.filter((m) => m.statut === "livre" || m.statut === "facture").reduce((s, m) => s + coutMiseADisposition(m).total, 0) +
      presta.filter((p) => p.statut === "livre" || p.statut === "facture").reduce((s, p) => s + coutPrestation(p), 0),
    ecartMoyen: ecarts.length ? Math.round((ecarts.reduce((s, e) => s + e.pct, 0) / ecarts.length) * 10) / 10 : null,
    horsTolerance: ecarts.filter((e) => Math.abs(e.pct) > 5).length,
    subies: siens.filter((a) => a.motif === "aucun-disponible" || a.motif === "vehicule-immobilise").length,
    /* Le coût à la tonne n'a de sens que s'il y a des tonnes : une prestation
       au sac ou un transport de personnel n'en porte pas, et le rapporter à
       zéro donnerait un infini qui ne veut rien dire. */
    coutParTonne: tonnes > 0 ? Math.round(cout / tonnes) : null,
  };
}

export function ficheTransporteur(numero: string): FicheTransporteur | null {
  const prestataire = listePrestataires().find((p) => p.numero === numero && p.type === "transporteur");
  if (!prestataire) return null;
  const grilles = grillesTarifaires();
  const camions = camionsDe(camionsTiers(), numero);
  const siens = affretements().filter((a) => a.transporteurNumero === numero);

  return {
    prestataire,
    profil: profilTransporteur(prestataire.raisonSociale, numero),
    camions,
    chauffeurs: chauffeursDe(chauffeursTiers(), numero),
    capaciteTonnes: capaciteTotale(camions),
    grille: grilles.filter((g) => g.transporteurNumero === numero),
    affretements: siens.map((a) => ({ ...a, attendu: montantAttendu(tarifApplicable(grilles, a, rattachements()), a) })).sort((a, b) => b.date.localeCompare(a.date)),
    misesADisposition: misesADisposition()
      .filter((m) => m.transporteurNumero === numero)
      .sort((a, b) => b.mois.localeCompare(a.mois)),
    prestations: prestations()
      .filter((p) => p.transporteurNumero === numero)
      .sort((a, b) => b.date.localeCompare(a.date)),
    livraisons: relevesTransport()
      .filter((l) => l.transporteurNumero === numero)
      .sort((a, b) => b.date.localeCompare(a.date)),
    aujourdhui: DATE_REFERENCE,
    activite: activiteDe(numero),
    notation: noter({ ...faitsNotation(numero, activiteDe(numero), medianeCoutTonne()), sousContrat: profilTransporteur(prestataire.raisonSociale, numero).sousContrat }),
  };
}

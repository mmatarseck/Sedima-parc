/* ============================================================================
 * Les demandes de la démonstration : un lot de relevés de compteur parti
 * avant-hier à tous les titulaires, dont trois n'ont pas répondu ; un
 * contrôle du matin parti aujourd'hui aux camions de Keur Massar. Le
 * détenteur de démonstration (Moustapha Diaw, AA 032 EA, Thiès) a une
 * demande à répondre : c'est ce que le téléphone montre.
 * ==========================================================================*/

import type { Demande } from "@/domaine/demandes";
import { DATE_REFERENCE } from "./chauffeurs-demo";
import { FLOTTE } from "./parc-demo";

function plusJours(jour: string, n: number): string {
  return new Date(Date.parse(`${jour}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Une heure de réponse, à `minutes` minutes du début de la matinée. Composer
 * l'horodatage à la main coûtait cher : `07:${10 + i * 3}` a donné « 13:61 »
 * dès que le parc a compté assez de titulaires, et la base a refusé
 * l'insertion entière — les demandes ont disparu du seed sans un mot
 * (10 septembre 2026). Une date se calcule, elle ne se concatène pas.
 */
function heureDeReponse(jour: string, minutes: number): string {
  return new Date(Date.parse(`${jour}T07:00:00Z`) + minutes * 60_000).toISOString();
}

let CACHE: Demande[] | null = null;

export function demandesDemo(): Demande[] {
  if (CACHE) return CACHE;
  const avantHier = plusJours(DATE_REFERENCE, -2);
  const titulaires = FLOTTE.filter((l) => l.vehicule.engage && l.chauffeurTitulaire).sort((a, b) => a.vehicule.immatriculation.localeCompare(b.vehicule.immatriculation));
  const liste: Demande[] = [];
  let n = 0;
  const numero = () => `DEM-${DATE_REFERENCE.slice(0, 4)}-${String(++n).padStart(4, "0")}`;

  /* Lot 1 : le relevé de fin de mois, à tous les titulaires, échéance le soir même. */
  titulaires.forEach((l, i) => {
    const v = l.vehicule;
    const c = l.chauffeurTitulaire!;
    /* Trois sur quinze n'ont pas répondu — dont le détenteur de démonstration. */
    const sansReponse = c.id === "moustapha-diaw" || i % 5 === 3;
    const km = l.kilometrage ?? 120_000 + i * 7_350;
    liste.push({
      id: `dem-${n + 1}`,
      numero: numero(),
      lot: `lot-${avantHier}-releve`,
      type: "releve-compteur",
      vehicule: { id: v.id, immatriculation: v.immatriculationAffichee, libelle: `${v.marque} ${v.appellation}`, siteId: v.siteId },
      detenteur: { genre: "chauffeur", id: c.id, nom: c.nom },
      message: "Relevé de fin de mois : le compteur avant le premier départ.",
      emiseLe: `${avantHier}T07:30:00.000Z`,
      emisePar: "M. Seck",
      echeance: `${avantHier}T18:00:00.000Z`,
      reponse: sansReponse ? null : { le: heureDeReponse(avantHier, 70 + i * 3), valeur: km + 40 + i * 9, texte: null, photo: `compteur-${v.immatriculation}.jpg`, commentaire: i % 4 === 0 ? "Compteur photographié moteur tournant." : null },
      annuleeLe: null,
    });
  });

  /* Lot 2 : le contrôle du matin des camions de Keur Massar, parti à 6 h 30, à répondre avant 9 h. */
  titulaires
    .filter((l) => l.vehicule.siteId === "s-km")
    .slice(0, 5)
    .forEach((l, i) => {
      const v = l.vehicule;
      const c = l.chauffeurTitulaire!;
      liste.push({
        id: `dem-${n + 1}`,
        numero: numero(),
        lot: `lot-${DATE_REFERENCE}-controle`,
        type: "controle-matin",
        vehicule: { id: v.id, immatriculation: v.immatriculationAffichee, libelle: `${v.marque} ${v.appellation}`, siteId: v.siteId },
        detenteur: { genre: "chauffeur", id: c.id, nom: c.nom },
        message: null,
        emiseLe: `${DATE_REFERENCE}T06:30:00.000Z`,
        emisePar: "Responsable Carburant",
        echeance: `${DATE_REFERENCE}T09:00:00.000Z`,
        reponse: i < 2 ? { le: heureDeReponse(DATE_REFERENCE, 5 + i * 12), valeur: null, texte: i === 1 ? "Feu de gabarit arrière droit hors service" : "ok", photo: `controle-${v.immatriculation}.jpg`, commentaire: null } : null,
        annuleeLe: null,
      });
    });

  CACHE = liste;
  return liste;
}

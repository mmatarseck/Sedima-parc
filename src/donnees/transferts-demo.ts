/* ============================================================================
 * Les fiches de transfert de la démonstration : une remise complète le mois
 * dernier (AA-977-MR, du pool à Talla Diène) et une remise du jour qui
 * attend la signature du récipiendaire — AA-032-EA rendue à Moustapha Diaw
 * par le correspondant de Thiès au retour d'atelier. C'est celle que le
 * détenteur de démonstration signe sur son téléphone.
 * ==========================================================================*/

import type { Transfert } from "@/domaine/transferts";
import { EQUIPEMENTS_STANDARD } from "@/domaine/transferts";
import { DATE_REFERENCE } from "./chauffeurs-demo";
import { FLOTTE } from "./parc-demo";

/* Un tracé de signature minimal, en PNG : un point — ce que la démonstration montre à la place d'une vraie signature. */
const TRACE_DEMO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function plusJours(jour: string, n: number): string {
  return new Date(Date.parse(`${jour}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

let CACHE: Transfert[] | null = null;

export function transfertsDemo(): Transfert[] {
  if (CACHE) return CACHE;
  const vehicule = (immat: string) => {
    const l = FLOTTE.find((x) => x.vehicule.immatriculation === immat);
    return l ? { id: l.vehicule.id, immatriculation: l.vehicule.immatriculationAffichee, libelle: `${l.vehicule.marque} ${l.vehicule.appellation}`, siteId: l.vehicule.siteId, km: l.kilometrage } : null;
  };
  const ilYAUnMois = plusJours(DATE_REFERENCE, -31);
  const equipements = (absents: string[] = []) => EQUIPEMENTS_STANDARD.map((e) => ({ libelle: e, present: !absents.includes(e) }));
  const liste: Transfert[] = [];

  const v1 = vehicule("AA977MR");
  if (v1) {
    liste.push({
      id: "trf-1",
      numero: `TRF-${DATE_REFERENCE.slice(0, 4)}-0001`,
      vehicule: { id: v1.id, immatriculation: v1.immatriculation, libelle: v1.libelle, siteId: v1.siteId },
      remettant: { genre: "parc", id: null, nom: "Dépôt Keur Massar" },
      recipiendaire: { genre: "chauffeur", id: "talla-diene", nom: "Talla Diène" },
      date: `${ilYAUnMois}T08:15:00.000Z`,
      motif: "Nouvelle affectation",
      km: (v1.km ?? 350_000) - 4_120,
      carburant: 50,
      documentsABord: ["carte-grise", "assurance", "visite-technique"],
      equipements: equipements(["Trousse de secours"]),
      reserves: [{ texte: "Rayure sur l'aile arrière gauche, antérieure à la remise", photo: "reserve-AA977MR-aile.jpg" }],
      commentaire: null,
      signatureRemettant: { nom: "Responsable Carburant", le: `${ilYAUnMois}T08:20:00.000Z`, trace: TRACE_DEMO },
      signatureRecipiendaire: { nom: "Talla Diène", le: `${ilYAUnMois}T08:22:00.000Z`, trace: TRACE_DEMO },
      annuleeLe: null,
      appliquee: true,
      creeLe: `${ilYAUnMois}T08:10:00.000Z`,
      creePar: "Responsable Carburant",
    });
  }

  const v2 = vehicule("AA032EA");
  if (v2) {
    liste.push({
      id: "trf-2",
      numero: `TRF-${DATE_REFERENCE.slice(0, 4)}-0002`,
      vehicule: { id: v2.id, immatriculation: v2.immatriculation, libelle: v2.libelle, siteId: v2.siteId },
      remettant: { genre: "parc", id: null, nom: "Dépôt Thiès" },
      recipiendaire: { genre: "chauffeur", id: "moustapha-diaw", nom: "Moustapha Diaw" },
      date: `${DATE_REFERENCE}T09:40:00.000Z`,
      motif: "Retour d'atelier",
      km: v2.km ?? 343_500,
      carburant: 25,
      documentsABord: ["carte-grise", "assurance", "visite-technique"],
      equipements: equipements(),
      reserves: [],
      commentaire: "Plaquettes de frein remplacées, pneus avant neufs.",
      signatureRemettant: { nom: "Correspondant Thiès", le: `${DATE_REFERENCE}T09:45:00.000Z`, trace: TRACE_DEMO },
      signatureRecipiendaire: null,
      annuleeLe: null,
      appliquee: false,
      creeLe: `${DATE_REFERENCE}T09:35:00.000Z`,
      creePar: "Correspondant Thiès",
    });
  }

  CACHE = liste;
  return liste;
}

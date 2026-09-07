/* ============================================================================
 * La fiche de transfert — cadrage mobile du 7 septembre 2026.
 *
 * Toute remise d'un véhicule à un chauffeur ou à un récipiendaire
 * s'accompagne d'une fiche : compteur, carburant, documents à bord,
 * équipements, réserves avec photos, et la signature de celui qui remet et
 * de celui qui reçoit. Complète — les deux signatures posées —, elle ouvre
 * l'affectation qui suit et ferme la précédente.
 *
 * Une fiche est un fait daté, comme une demande : les deux parties y sont
 * figées avec leur nom au moment de la remise. Ce fichier décrit et
 * calcule ; il ne décide d'aucune autorisation.
 * ==========================================================================*/

import type { TypeDocument } from "./types";

/** Qui remet ou reçoit : un chauffeur, un attributaire, le parc lui-même (dépôt, atelier), ou un tiers nommé. */
export interface PartieTransfert {
  genre: "chauffeur" | "attributaire" | "parc" | "tiers";
  id: string | null;
  nom: string;
}

export interface Signature {
  nom: string;
  /** ISO, à l'heure. */
  le: string;
  /** Le tracé, en image PNG encodée (data URL). */
  trace: string;
}

export interface EquipementTransfert {
  libelle: string;
  present: boolean;
}

export interface ReserveTransfert {
  texte: string;
  /** La photo, obligatoire : son nom tant que le stockage n'est pas là. */
  photo: string | null;
}

export type StatutTransfert = "a-signer" | "signee-remettant" | "signee-recipiendaire" | "complete" | "annulee";

export const STATUT_TRANSFERT: Record<StatutTransfert, { libelle: string; ton: "favorable" | "defavorable" | "vigilance" | "neutre" }> = {
  "a-signer": { libelle: "À signer", ton: "vigilance" },
  "signee-remettant": { libelle: "Signée par le remettant", ton: "vigilance" },
  "signee-recipiendaire": { libelle: "Signée par le récipiendaire", ton: "vigilance" },
  complete: { libelle: "Complète", ton: "favorable" },
  annulee: { libelle: "Annulée", ton: "neutre" },
};

export interface Transfert {
  id: string;
  /** « TRF-2026-0003 ». */
  numero: string;
  vehicule: { id: string; immatriculation: string; libelle: string; siteId: string | null };
  remettant: PartieTransfert;
  recipiendaire: PartieTransfert;
  /** La date de la remise, ISO à l'heure. */
  date: string;
  /** Le motif de la remise : nouvelle affectation, retour d'atelier, congé du titulaire… */
  motif: string;
  km: number | null;
  /** Le niveau du réservoir, en part : 0, 25, 50, 75, 100. */
  carburant: number | null;
  documentsABord: TypeDocument[];
  equipements: EquipementTransfert[];
  reserves: ReserveTransfert[];
  commentaire: string | null;
  signatureRemettant: Signature | null;
  signatureRecipiendaire: Signature | null;
  annuleeLe: string | null;
  /** Vrai quand l'affectation qui suit a été ouverte et la précédente fermée. */
  appliquee: boolean;
  creeLe: string;
  creePar: string;
}

/** Les équipements que l'on vérifie à chaque remise ; le métier en ajoute sur la fiche. */
export const EQUIPEMENTS_STANDARD: string[] = ["Roue de secours", "Cric et manivelle", "Triangle de signalisation", "Extincteur", "Trousse de secours", "Gilet fluorescent", "Carte carburant", "Double des clés", "Sangles et bâche"];

export const NIVEAUX_CARBURANT: { valeur: number; libelle: string }[] = [
  { valeur: 0, libelle: "Vide" },
  { valeur: 25, libelle: "1/4" },
  { valeur: 50, libelle: "1/2" },
  { valeur: 75, libelle: "3/4" },
  { valeur: 100, libelle: "Plein" },
];

export function statutTransfert(t: Transfert): StatutTransfert {
  if (t.annuleeLe) return "annulee";
  if (t.signatureRemettant && t.signatureRecipiendaire) return "complete";
  if (t.signatureRemettant) return "signee-remettant";
  if (t.signatureRecipiendaire) return "signee-recipiendaire";
  return "a-signer";
}

/** « TRF-2026-0003 » : le numéro suivant, sur l'année de la date donnée. */
export function numeroTransfertSuivant(existants: Transfert[], date: string): string {
  const annee = date.slice(0, 4);
  const n = existants.filter((t) => t.numero.startsWith(`TRF-${annee}-`)).reduce((max, t) => Math.max(max, Number(t.numero.slice(-4)) || 0), 0) + 1;
  return `TRF-${annee}-${String(n).padStart(4, "0")}`;
}

export function libellePartie(p: PartieTransfert): string {
  if (p.genre === "parc") return p.nom ? `Parc · ${p.nom}` : "Parc";
  return p.nom;
}

/** Ce qu'une fiche complète déclenche : l'affectation du récipiendaire chauffeur, à la date de la remise. */
export function affectationSuivante(t: Transfert): { vehiculeId: string; chauffeurId: string; debut: string; motif: string } | null {
  if (t.recipiendaire.genre !== "chauffeur" || !t.recipiendaire.id) return null;
  return { vehiculeId: t.vehicule.id, chauffeurId: t.recipiendaire.id, debut: t.date.slice(0, 10), motif: `Fiche de transfert ${t.numero} — ${t.motif}` };
}

const GENRES = new Set(["chauffeur", "attributaire", "parc", "tiers"]);

function normaliserPartie(brut: unknown): PartieTransfert | null {
  if (!brut || typeof brut !== "object") return null;
  const b = brut as Partial<PartieTransfert>;
  if (typeof b.genre !== "string" || !GENRES.has(b.genre)) return null;
  return { genre: b.genre, id: typeof b.id === "string" && b.id ? b.id : null, nom: typeof b.nom === "string" ? b.nom.trim() : "" };
}

function normaliserSignature(brut: unknown): Signature | null {
  if (!brut || typeof brut !== "object") return null;
  const b = brut as Partial<Signature>;
  if (typeof b.le !== "string" || typeof b.trace !== "string" || !b.trace) return null;
  return { nom: typeof b.nom === "string" ? b.nom : "", le: b.le, trace: b.trace };
}

/** Une fiche lue du stockage, remise d'aplomb champ par champ ; nulle sans identifiant, véhicule ou parties. */
export function normaliserTransfert(brut: unknown): Transfert | null {
  if (!brut || typeof brut !== "object") return null;
  const b = brut as Partial<Record<keyof Transfert, unknown>>;
  if (typeof b.id !== "string" || !b.id || !b.vehicule || typeof b.vehicule !== "object") return null;
  const v = b.vehicule as Partial<Transfert["vehicule"]>;
  const remettant = normaliserPartie(b.remettant);
  const recipiendaire = normaliserPartie(b.recipiendaire);
  if (typeof v.id !== "string" || !remettant || !recipiendaire) return null;
  const texte = (x: unknown): string | null => (typeof x === "string" && x.trim() ? x : null);
  const nombre = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
  const equipements: EquipementTransfert[] = Array.isArray(b.equipements) ? b.equipements.flatMap((e) => (e && typeof e === "object" && typeof (e as EquipementTransfert).libelle === "string" ? [{ libelle: (e as EquipementTransfert).libelle, present: Boolean((e as EquipementTransfert).present) }] : [])) : [];
  const reserves: ReserveTransfert[] = Array.isArray(b.reserves) ? b.reserves.flatMap((r) => (r && typeof r === "object" && typeof (r as ReserveTransfert).texte === "string" ? [{ texte: (r as ReserveTransfert).texte, photo: texte((r as ReserveTransfert).photo) }] : [])) : [];
  return {
    id: b.id,
    numero: texte(b.numero) ?? b.id,
    vehicule: { id: v.id, immatriculation: texte(v.immatriculation) ?? v.id, libelle: texte(v.libelle) ?? "", siteId: texte(v.siteId) },
    remettant,
    recipiendaire,
    date: texte(b.date) ?? new Date(0).toISOString(),
    motif: texte(b.motif) ?? "Remise du véhicule",
    km: nombre(b.km),
    carburant: nombre(b.carburant),
    documentsABord: Array.isArray(b.documentsABord) ? (b.documentsABord.filter((d) => typeof d === "string") as TypeDocument[]) : [],
    equipements,
    reserves,
    commentaire: texte(b.commentaire),
    signatureRemettant: normaliserSignature(b.signatureRemettant),
    signatureRecipiendaire: normaliserSignature(b.signatureRecipiendaire),
    annuleeLe: texte(b.annuleeLe),
    appliquee: Boolean(b.appliquee),
    creeLe: texte(b.creeLe) ?? texte(b.date) ?? new Date(0).toISOString(),
    creePar: texte(b.creePar) ?? "",
  };
}

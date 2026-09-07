/* ============================================================================
 * Les demandes poussées aux détenteurs — cadrage mobile du 7 septembre 2026.
 *
 * Le parc pousse une demande ciblée au détenteur d'un véhicule — le chauffeur
 * titulaire ou l'attributaire — : un relevé de compteur en premier, puis la
 * jauge, la position, le contrôle du matin. Elle part à une personne, à
 * plusieurs, ou à tous les détenteurs d'un site ; le détenteur répond depuis
 * son téléphone, photo à l'appui ; le parc suit qui a répondu et qui tarde.
 *
 * Une demande est un fait daté : ce qui a été demandé, à qui, pour quand, et
 * ce qui a été répondu. Le nom du destinataire y est figé au moment de
 * l'envoi, comme sur un courrier — le titulaire peut changer ensuite, la
 * demande reste adressée à qui l'a reçue. Ce fichier décrit et calcule ; il
 * ne décide d'aucune autorisation.
 * ==========================================================================*/

export type TypeDemande = "releve-compteur" | "jauge-carburant" | "position" | "controle-matin";

/** Ce que la réponse porte : un compteur, une part de réservoir, un texte, ou un contrôle « tout est bon / réserve ». */
export type FormeReponse = "km" | "pourcentage" | "texte" | "controle";

export interface DefinitionTypeDemande {
  type: TypeDemande;
  libelle: string;
  /** Ce que le détenteur lit sur son téléphone. */
  consigne: string;
  reponse: FormeReponse;
  unite: string | null;
}

export const TYPES_DEMANDE: DefinitionTypeDemande[] = [
  { type: "releve-compteur", libelle: "Relevé de compteur", consigne: "Photographiez le compteur et saisissez le kilométrage affiché.", reponse: "km", unite: "km" },
  { type: "jauge-carburant", libelle: "Jauge de carburant", consigne: "Photographiez la jauge et indiquez le niveau du réservoir.", reponse: "pourcentage", unite: "%" },
  { type: "position", libelle: "Position du véhicule", consigne: "Où est le véhicule en ce moment ? Une photo du lieu et un mot.", reponse: "texte", unite: null },
  { type: "controle-matin", libelle: "Contrôle du matin", consigne: "Pneus, niveaux, feux, propreté : tout est bon, ou signalez ce qui ne l'est pas.", reponse: "controle", unite: null },
];

export const TYPE_DEMANDE = Object.fromEntries(TYPES_DEMANDE.map((t) => [t.type, t])) as Record<TypeDemande, DefinitionTypeDemande>;

export type StatutDemande = "a-repondre" | "en-retard" | "repondue" | "annulee";

export const STATUT_DEMANDE: Record<StatutDemande, { libelle: string; ton: "favorable" | "defavorable" | "vigilance" | "neutre" }> = {
  "a-repondre": { libelle: "À répondre", ton: "vigilance" },
  "en-retard": { libelle: "En retard", ton: "defavorable" },
  repondue: { libelle: "Répondue", ton: "favorable" },
  annulee: { libelle: "Annulée", ton: "neutre" },
};

/** Qui reçoit : le chauffeur titulaire, ou l'attributaire d'un véhicule de service ou de fonction. */
export interface Detenteur {
  genre: "chauffeur" | "attributaire";
  id: string;
  nom: string;
}

export interface ReponseDemande {
  /** ISO, à l'heure. */
  le: string;
  /** Le compteur ou la part de réservoir ; nul pour un texte ou un contrôle. */
  valeur: number | null;
  /** La position, ou la réserve d'un contrôle ; « ok » pour un contrôle sans réserve. */
  texte: string | null;
  /** La photo obligatoire (décision du 7 septembre 2026) : son nom tant que le stockage n'est pas là, son adresse ensuite. */
  photo: string | null;
  commentaire: string | null;
}

export interface Demande {
  id: string;
  /** « DEM-2026-0007 ». */
  numero: string;
  /** Les demandes parties ensemble portent le même lot : c'est l'unité de suivi. */
  lot: string;
  type: TypeDemande;
  vehicule: { id: string; immatriculation: string; libelle: string; siteId: string | null };
  detenteur: Detenteur;
  message: string | null;
  /** ISO, à l'heure. */
  emiseLe: string;
  emisePar: string;
  /** ISO, à l'heure : au-delà, sans réponse, la demande est en retard. */
  echeance: string;
  reponse: ReponseDemande | null;
  annuleeLe: string | null;
}

export function statutDemande(d: Demande, maintenant: string): StatutDemande {
  if (d.annuleeLe) return "annulee";
  if (d.reponse) return "repondue";
  return d.echeance < maintenant ? "en-retard" : "a-repondre";
}

/** « DEM-2026-0007 » : le numéro suivant, sur l'année de la date donnée. */
export function numeroDemandeSuivant(existants: Demande[], date: string): string {
  const annee = date.slice(0, 4);
  const n = existants.filter((d) => d.numero.startsWith(`DEM-${annee}-`)).reduce((max, d) => Math.max(max, Number(d.numero.slice(-4)) || 0), 0) + 1;
  return `DEM-${annee}-${String(n).padStart(4, "0")}`;
}

/** Le compte d'un lot : parties, répondues, en retard. */
export function resumerLot(demandes: Demande[], maintenant: string): { total: number; repondues: number; enRetard: number; aRepondre: number; annulees: number } {
  const r = { total: demandes.length, repondues: 0, enRetard: 0, aRepondre: 0, annulees: 0 };
  for (const d of demandes) {
    const s = statutDemande(d, maintenant);
    if (s === "repondue") r.repondues++;
    else if (s === "en-retard") r.enRetard++;
    else if (s === "a-repondre") r.aRepondre++;
    else r.annulees++;
  }
  return r;
}

/** La réponse en clair : « 343 620 km », « 3/4 de réservoir », « Dépôt de Thiès », « Tout est bon ». */
export function libelleReponse(d: Demande): string | null {
  const r = d.reponse;
  if (!r) return null;
  const t = TYPE_DEMANDE[d.type];
  switch (t.reponse) {
    case "km":
      return r.valeur === null ? "—" : `${r.valeur.toLocaleString("fr-FR")} km`;
    case "pourcentage":
      return r.valeur === null ? "—" : `${r.valeur} % du réservoir`;
    case "controle":
      return r.texte === "ok" || !r.texte ? "Tout est bon" : `Réserve : ${r.texte}`;
    default:
      return r.texte ?? "—";
  }
}

const TYPES_CONNUS = new Set<string>(TYPES_DEMANDE.map((t) => t.type));

/** Une demande lue du stockage, remise d'aplomb champ par champ ; nulle si elle n'a ni identifiant ni véhicule. */
export function normaliserDemande(brut: unknown): Demande | null {
  if (!brut || typeof brut !== "object") return null;
  const b = brut as Partial<Record<keyof Demande, unknown>>;
  if (typeof b.id !== "string" || !b.id || !b.vehicule || typeof b.vehicule !== "object" || !b.detenteur || typeof b.detenteur !== "object") return null;
  const texte = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
  const v = b.vehicule as Partial<Demande["vehicule"]>;
  const det = b.detenteur as Partial<Detenteur>;
  if (typeof v.id !== "string" || typeof det.id !== "string") return null;
  let reponse: ReponseDemande | null = null;
  if (b.reponse && typeof b.reponse === "object") {
    const r = b.reponse as Partial<ReponseDemande>;
    if (typeof r.le === "string") reponse = { le: r.le, valeur: typeof r.valeur === "number" && Number.isFinite(r.valeur) ? r.valeur : null, texte: texte(r.texte), photo: texte(r.photo), commentaire: texte(r.commentaire) };
  }
  return {
    id: b.id,
    numero: texte(b.numero) ?? b.id,
    lot: texte(b.lot) ?? b.id,
    type: typeof b.type === "string" && TYPES_CONNUS.has(b.type) ? (b.type as TypeDemande) : "releve-compteur",
    vehicule: { id: v.id, immatriculation: texte(v.immatriculation) ?? v.id, libelle: texte(v.libelle) ?? "", siteId: texte(v.siteId) },
    detenteur: { genre: det.genre === "attributaire" ? "attributaire" : "chauffeur", id: det.id, nom: texte(det.nom) ?? "" },
    message: texte(b.message),
    emiseLe: texte(b.emiseLe) ?? new Date(0).toISOString(),
    emisePar: texte(b.emisePar) ?? "",
    echeance: texte(b.echeance) ?? texte(b.emiseLe) ?? new Date(0).toISOString(),
    reponse,
    annuleeLe: texte(b.annuleeLe),
  };
}

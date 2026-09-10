/* ============================================================================
 * Données de démonstration.
 *
 * Les véhicules, marques, chauffeurs et sites sont réels : ils viennent de
 * « Parc Automobiles Sedima - Inventaire.xlsx » et de « SITUATION PARC SEDIMA
 * LOURDS.xlsx ». Les échéances, coûts et kilométrages manquants sont en
 * revanche illustratifs — l'inventaire de référence n'est pas encore figé.
 *
 * Ce fichier disparaît dès que Supabase est branché.
 * ==========================================================================*/

import type {
  Attelage,
  LicenceTransport,
  BusinessUnit,
  CategorieFlotte,
  CategorieVehicule,
  LigneFlotte,
  Site,
  StatutVehicule,
  TypeDocument,
  UsageVehicule,
} from "@/domaine/types";
import { afficher, normaliser } from "@/domaine/immatriculation";
import type { Energie } from "@/domaine/types";
import { idChauffeur } from "@/domaine/chauffeur";

export const SITES: Site[] = [
  /* L'usine d'aliment est au siège de Rufisque, non à Diamniadio : correction
     du métier du 4 septembre 2026, qui demande de ne retenir que « UAB » comme
     libellé. Le site Diamniadio a donc disparu du référentiel, et les deux
     véhicules qui y étaient rattachés ont rejoint l'UAB. */
  { id: "s-uab", code: "UAB", libelle: "UAB", region: "Dakar", type: "usine" },
  { id: "s-km", code: "KM", libelle: "Keur Massar", region: "Dakar", type: "depot" },
  { id: "s-abat", code: "ABAT", libelle: "Abattoirs", region: "Dakar", type: "abattoir" },
  { id: "s-siege", code: "SIEGE", libelle: "Siège Rufisque", region: "Dakar", type: "siege" },
  { id: "s-thies", code: "THIES", libelle: "Dépôt Thiès", region: "Thiès", type: "depot" },
  { id: "s-mbour", code: "MBOUR", libelle: "Dépôt Mbour", region: "Thiès", type: "depot" },
  { id: "s-gormack", code: "GORMACK", libelle: "Garage Gormack Rufisque", region: "Dakar", type: "garage" },
  { id: "s-pikine", code: "PIKINE", libelle: "TATA Pikine", region: "Dakar", type: "garage" },
  { id: "s-anec", code: "ANEC", libelle: "ANEC Pikine", region: "Dakar", type: "garage" },
];

const siteParId = new Map(SITES.map((s) => [s.id, s]));

type Brut = {
  immat: string;
  energie?: Energie;
  marque: string;
  appellation: string;
  categorie: CategorieVehicule;
  flotte?: CategorieFlotte;
  special?: boolean;
  engage?: boolean;
  bu: BusinessUnit;
  site: string;
  statut: StatutVehicule;
  chauffeur?: string;
  suppleants?: number;
  km?: number;
  conformite?: { type: TypeDocument; jours: number };
  entretienKm?: number;
  cout?: number;
  vin?: string;
  commentaire?: string;
};

const BRUT: Brut[] = [
  { immat: "AA985MR", marque: "TATA", appellation: "LPT1618TC", categorie: "camion", bu: "aliment", site: "s-km", statut: "en-service", chauffeur: "Babacar Ndiaye", conformite: { type: "assurance", jours: 118 }, entretienKm: 4200, cout: 6_200_000 },
  { immat: "AA977MR", marque: "RENAULT", appellation: "Ridelle 20T", categorie: "camion", bu: "aliment", site: "s-km", statut: "en-service", chauffeur: "Talla Diène", km: 357_899, conformite: { type: "visite-technique", jours: 96 }, entretienKm: 900, cout: 9_400_000 },
  { immat: "AA236MR", marque: "RENAULT", appellation: "Magnum 520", categorie: "camion", bu: "aliment", site: "s-km", statut: "en-service", chauffeur: "Cheikh Sarr", km: 492_050, conformite: { type: "visite-technique", jours: 8 }, entretienKm: 6100, cout: 11_800_000 },
  { immat: "AA285PT", marque: "RENAULT", appellation: "Kerax", categorie: "camion", bu: "aliment", site: "s-km", statut: "en-service", chauffeur: "Badji Kadji", conformite: { type: "assurance", jours: 61 }, entretienKm: 8400, cout: 8_700_000 },
  { immat: "AA105VA", marque: "RENAULT", appellation: "Kerax 12T", categorie: "camion", bu: "aliment", site: "s-km", statut: "en-service", chauffeur: "Djibril Ndoye", conformite: { type: "assurance", jours: 74 }, entretienKm: 3300, cout: 7_300_000 },
  { immat: "AA768JV", marque: "IVECO", appellation: "AT260 vrac 18T", categorie: "camion", special: true, bu: "aliment", site: "s-km", statut: "en-service", chauffeur: "Birago Wane", km: 234_789, conformite: { type: "visite-technique", jours: 52 }, entretienKm: 5700, cout: 6_800_000 },
  { immat: "AA633JL", marque: "RENAULT", appellation: "Premium 43T", categorie: "tracteur", special: true, bu: "aliment", site: "s-km", statut: "en-service", chauffeur: "Libasse Diop", suppleants: 1, conformite: { type: "assurance", jours: 44 }, entretienKm: 7900, cout: 8_100_000 },
  { immat: "AB932EF", marque: "FAW", appellation: "CA4250 vrac 30T", categorie: "tracteur", special: true, bu: "aliment", site: "s-uab", statut: "en-restauration", conformite: { type: "licence-transport", jours: -3 }, cout: 0, commentaire: "Revêtement alimentaire en cours" },
  { immat: "AB551HS", marque: "JAC", appellation: "HFC9640ZXC 34,5T", categorie: "semi-remorque", special: true, bu: "aliment", site: "s-uab", statut: "en-restauration", conformite: { type: "visite-technique", jours: -12 }, cout: 0, commentaire: "Revêtement alimentaire en cours" },
  { immat: "AA737ZW", marque: "RENAULT", appellation: "Premium plateau 35T", categorie: "tracteur", bu: "aliment", site: "s-gormack", statut: "hors-service", chauffeur: "Boubacar Dieng", conformite: { type: "visite-technique", jours: -21 }, cout: 7_600_000, commentaire: "En réparation pour visite technique" },
  { immat: "AA180CQ", marque: "TATA", appellation: "Premium frigo 19T", categorie: "camion", special: true, bu: "abattoir", site: "s-anec", statut: "hors-service", chauffeur: "Mamadou Diop", km: 685_099, conformite: { type: "assurance", jours: -12 }, cout: 14_200_000, commentaire: "Groupe froid en réparation" },
  { immat: "AA565GA", marque: "TATA", appellation: "LPT1618TC", categorie: "camion", bu: "minoterie", site: "s-pikine", statut: "en-reparation", chauffeur: "Mory Djitte", km: 245_675, conformite: { type: "assurance", jours: 83 }, cout: 7_100_000, commentaire: "Boîte de vitesses" },
  { immat: "AA568GA", marque: "TATA", appellation: "LPT1618TC", categorie: "camion", bu: "minoterie", site: "s-siege", statut: "en-mutation", chauffeur: "Serigne Mbaye Fall", km: 104_135, conformite: { type: "assurance", jours: 129 }, entretienKm: 5900, cout: 3_400_000 },
  { immat: "AA093VA", marque: "TATA", appellation: "LPT1618TC", categorie: "camion", bu: "abattoir", site: "s-abat", statut: "en-service", chauffeur: "Maguette Samb", km: 230_750, conformite: { type: "visite-technique", jours: 41 }, entretienKm: 2100, cout: 5_200_000 },
  { immat: "AA032EA", marque: "MITSUBISHI", appellation: "L200 SC", categorie: "camionnette", bu: "commercial", site: "s-thies", statut: "en-service", chauffeur: "Moustapha Diaw", vin: "MMBJNKL30MH021847", km: 343_500, conformite: { type: "visite-technique", jours: 26 }, entretienKm: 6500, cout: 4_800_000 },
  { immat: "AA990DZ", marque: "MITSUBISHI", appellation: "L200 SC", categorie: "camionnette", bu: "commercial", site: "s-siege", statut: "en-backup", chauffeur: "Khalifa Ndiaye", km: 186_554, conformite: { type: "assurance", jours: 152 }, entretienKm: 4800, cout: 2_900_000 },
  { immat: "DK6875DF", marque: "MITSUBISHI", appellation: "L200 SC", categorie: "camionnette", bu: "commercial", site: "s-thies", statut: "en-reparation", chauffeur: "Amadou Baldé", km: 267_900, conformite: { type: "assurance", jours: 67 }, cout: 5_900_000, commentaire: "Réparation moteur, 61 jours d'immobilisation" },
  /* Le parc ne roule pas tout entier : le chariot élévateur de l'UAB travaille
     en heures, pas en kilomètres. Hors périmètre de disponibilité (engage:
     faux), il a bien un plan d'entretien, et c'est le seul à compteur horaire. */
  { immat: "AA412UB", marque: "TOYOTA", appellation: "Chariot élévateur 8FBE20", categorie: "engin", energie: "electrique", engage: false, bu: "aliment", site: "s-uab", statut: "en-service", cout: 1_850_000, commentaire: "Chariot électrique, manutention des sacs à l'UAB" },
  { immat: "DK2347BD", marque: "MITSUBISHI", appellation: "L200 DC", categorie: "camionnette", engage: false, bu: "commercial", site: "s-thies", statut: "retrait-en-cours", conformite: { type: "visite-technique", jours: -5 }, cout: 3_100_000, commentaire: "Moteur à changer" },
];

/**
 * VIN illustratif, stable par véhicule : les trois premiers caractères disent
 * le constructeur (WMI), les quatorze suivants sont tirés de l'immatriculation.
 * L'inventaire de référence apportera les vrais.
 */
const WMI: Record<string, string> = { TATA: "MAT", RENAULT: "VF6", IVECO: "ZCF", FAW: "LFW", JAC: "LJ1", MITSUBISHI: "MMB" };
function vinDemo(canonique: string, marque: string): string {
  let h = 7;
  for (const ch of canonique) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const alphabet = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  let suite = "";
  for (let i = 0; i < 14; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    suite += alphabet[h % alphabet.length];
  }
  return `${WMI[marque] ?? "XXX"}${suite}`;
}

/**
 * L'usage, déduit de l'appellation en démonstration (« vrac 18T », « frigo 19T »,
 * « plateau 35T ») ; en production, un champ saisi à la création du véhicule.
 */
function usageDe(b: Brut): UsageVehicule {
  const a = b.appellation.toLowerCase();
  if (a.includes("vrac")) return "vrac";
  if (a.includes("frigo")) return "frigorifique";
  if (a.includes("plateau")) return "plateau";
  if (a.includes("ridelle")) return "ridelle";
  if (a.includes("citerne")) return "citerne";
  if (a.includes("benne")) return "benne";
  if (b.categorie === "camionnette" || b.categorie === "vehicule-leger" || b.categorie === "moto") return "utilitaire";
  if (b.categorie === "tracteur") return "tracteur";
  if (b.categorie === "semi-remorque") return b.special ? "vrac" : "plateau";
  if (b.special) return "poussins";
  return "fourgon";
}

function ligne(b: Brut): LigneFlotte {
  const canonique = normaliser(b.immat);
  return {
    vehicule: {
      id: canonique,
      immatriculation: canonique,
      immatriculationAffichee: afficher(canonique),
      vin: b.vin ?? vinDemo(canonique, b.marque),
      marque: b.marque,
      appellation: b.appellation,
      typeModele: null,
      categorie: b.categorie,
      categorieFlotte: b.flotte ?? "interne",
      transportSpecial: b.special ?? false,
      usage: usageDe(b),
      engage: b.engage ?? true,
      premiereMiseEnCirculation: null,
      dateImmatriculation: null,
      puissanceCv: null,
      cylindree: null,
      ptac: null,
      ptra: null,
      poidsVide: null,
      chargeUtile: null,
      /* L'énergie vient de l'inventaire ; gasoil à défaut, la flotte étant presque entièrement diesel. */
      energie: b.energie ?? "gasoil",
      capaciteReservoir: null,
      businessUnit: b.bu,
      siteId: b.site,
      statut: b.statut,
      valeurAcquisition: null,
      dureeAmortissementAnnees: null,
      commentaire: b.commentaire ?? null,
    },
    chauffeurTitulaire: b.chauffeur ? { id: idChauffeur(b.chauffeur), nom: b.chauffeur } : null,
    nombreSuppleants: b.suppleants ?? 0,
    site: siteParId.get(b.site) ?? null,
    kilometrage: b.km ?? null,
    dateKilometrage: b.km ? "2026-08-31" : null,
    prochaineEcheanceConformite: b.conformite
      ? { type: b.conformite.type, echeance: "", joursRestants: b.conformite.jours }
      : null,
    prochaineEcheanceEntretien: b.entretienKm
      ? { libelle: "Vidange", kmRestants: b.entretienKm, joursRestants: null, kmParJour: null }
      : null,
    coutDouzeMois: b.cout ?? null,
    attelageCourant: null,
  };
}

/**
 * Licences de transport : une pour toute la flotte, une pour les véhicules de
 * vrac alimentaire — celle-ci échue depuis trois jours, ce qui rend les quatre
 * véhicules non conformes d'un coup. Numérotées comme des documents, sans rang
 * de véhicule puisqu'elles n'en ont pas.
 */
export const LICENCES: LicenceTransport[] = [
  { id: "lic-flotte", numero: "DOC-2025-00001", libelle: "Transport public de marchandises", numeroPiece: "LT-2025-01170", emetteur: "Ministère des Transports", perimetre: "flotte", vehiculeIds: [], dateEffet: "2025-02-10", echeance: "2027-02-09" },
  { id: "lic-vrac", numero: "DOC-2024-00002", libelle: "Transport de vrac alimentaire", numeroPiece: "LT-2024-00488", emetteur: "Ministère des Transports", perimetre: "partie", vehiculeIds: ["AB932EF", "AB551HS", "AA633JL", "AA768JV"], dateEffet: "2024-08-30", echeance: "2026-08-30" },
];

/**
 * Attelages de démonstration. Le seul semi-remorque du parc est attelé en
 * permanence au Premium 43T ; il l'a été un mois au plateau pendant une
 * immobilisation. Les numéros suivent la convention des transactions.
 */
export const ATTELAGES: Attelage[] = [
  { id: "att-1", numero: "ATT-2025-00001", tracteurId: "AA633JL", remorqueId: "AB551HS", debut: "2025-03-01", fin: null, permanent: true, motif: "Attelage de référence — vrac aliment" },
  { id: "att-2", numero: "ATT-2026-00002", tracteurId: "AA737ZW", remorqueId: "AB551HS", debut: "2026-01-10", fin: "2026-02-20", permanent: false, motif: "Prêt pendant l'immobilisation du Premium 43T" },
];

const AUJOURDHUI_PARC = "2026-09-02";

/** L'attelage en cours d'un véhicule, vu de son côté. */
export function attelageCourant(vehiculeId: string): LigneFlotte["attelageCourant"] {
  const a = ATTELAGES.find((x) => (x.tracteurId === vehiculeId || x.remorqueId === vehiculeId) && x.debut <= AUJOURDHUI_PARC && (x.fin === null || x.fin >= AUJOURDHUI_PARC));
  if (!a) return null;
  const autre = a.tracteurId === vehiculeId ? a.remorqueId : a.tracteurId;
  return { immatriculation: autre, immatriculationAffichee: afficher(autre), role: a.tracteurId === vehiculeId ? "tracteur" : "remorque" };
}

export const FLOTTE: LigneFlotte[] = BRUT.map(ligne).map((l) => ({ ...l, attelageCourant: attelageCourant(l.vehicule.id) }));

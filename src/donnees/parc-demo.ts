/* ============================================================================
 * Le référentiel du parc de transport — **une vraie donnée d'entreprise**,
 * malgré le suffixe « -demo » que ce fichier porte encore.
 *
 * Ne pas s'y tromper : ce fichier ne disparaîtra pas quand Supabase sera
 * branché, **il est la source du seed** (`npm run generer-seed` →
 * `supabase/seed-parties/*.sql`). Le supprimer viderait la base. Le suffixe
 * vient de l'époque où tout était décor ; le partage des rôles est écrit dans
 * `docs/DONNEES-REELLES.md`.
 *
 * Ce qui est réel : les véhicules, leurs plaques, marques, catégories, sites,
 * statuts et chauffeurs. Ils viennent des listes 2026 du dossier DO —
 * `SITUATION PARC SEDIMA LOURDS` (genre, âge, site, activité, état) et
 * `AFFECTATION LOURDS` (chauffeur), toutes deux du 3 septembre 2026 —
 * recoupées le 7 septembre (`docs/RAPPROCHEMENT-PARC.md`) et complétées le
 * 10 septembre : les dix-sept unités opérationnelles qui manquaient, la
 * plaque DK 6875 BF corrigée, les statuts alignés sur la situation.
 *
 * Ce qui reste illustratif, faute de source : les kilométrages, les coûts et
 * les jours d'échéance des véhicules déjà présents. Les véhicules ajoutés le
 * 10 septembre n'en portent pas — un compteur se relève, il ne se devine pas.
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
  /* Les sites du parc lourd, ajoutés le 10 septembre 2026 avec les 17 unités
     qui manquaient : ils viennent des colonnes « SITES » de
     `SITUATION PARC SEDIMA LOURDS` et `AFFECTATION LOURDS` (3 septembre 2026). */
  { id: "s-minoterie", code: "MINOT", libelle: "Minoterie", region: "Dakar", type: "usine" },
  { id: "s-touba", code: "TOUBA", libelle: "Dépôt Touba", region: "Diourbel", type: "depot" },
  { id: "s-zig", code: "ZIG", libelle: "Dépôt Ziguinchor", region: "Ziguinchor", type: "depot" },
  { id: "s-karaouni", code: "KARA1", libelle: "Karaouni 1", region: "Dakar", type: "ferme" },
  /* Le couvoir n'a pas de type à lui dans le référentiel : « ferme » est le
     plus proche, et le libellé dit ce qu'il est. */
  { id: "s-notto", code: "NOTTO", libelle: "Couvoir Notto", region: "Thiès", type: "ferme" },
  { id: "s-ndiakhirate", code: "NDIAK", libelle: "Ndiakhirate", region: "Dakar", type: "ferme" },
  { id: "s-fermes", code: "FERMES", libelle: "Fermes", region: "Thiès", type: "ferme" },
  { id: "s-djily", code: "DJILY", libelle: "Garage Djily Dalifort", region: "Dakar", type: "garage" },
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
  { immat: "AA285PT", marque: "RENAULT", appellation: "Kerax", categorie: "camion", bu: "aliment", site: "s-km", statut: "en-service", chauffeur: "Bathie Kandji", conformite: { type: "assurance", jours: 61 }, entretienKm: 8400, cout: 8_700_000 },
  { immat: "AA105VA", marque: "RENAULT", appellation: "Kerax 12T", categorie: "camion", bu: "aliment", site: "s-km", statut: "en-service", chauffeur: "Djibril Ndoye", conformite: { type: "assurance", jours: 74 }, entretienKm: 3300, cout: 7_300_000 },
  { immat: "AA768JV", marque: "IVECO", appellation: "AT260 vrac 18T", categorie: "camion", special: true, bu: "aliment", site: "s-uab", statut: "en-service", chauffeur: "Ablaye Diop", km: 234_789, conformite: { type: "visite-technique", jours: 52 }, entretienKm: 5700, cout: 6_800_000 },
  { immat: "AA633JL", marque: "RENAULT", appellation: "Premium 43T", categorie: "tracteur", special: true, bu: "aliment", site: "s-km", statut: "en-service", chauffeur: "Ass Guèye", suppleants: 1, conformite: { type: "assurance", jours: 44 }, entretienKm: 7900, cout: 8_100_000 },
  /* Statuts et sites alignés sur la situation 2026 le 10 septembre : elle les
     dit tous opérationnels, et les quatre frigos aux Abattoirs. Ce qui vivait
     ici — « hors service », « en restauration », « en mutation » — venait du
     jeu de démonstration et contredisait le dossier. Les mentions du
     classeur passent en commentaire, à leur juste place. */
  { immat: "AB932EF", marque: "FAW", appellation: "CA4250 vrac 30T", categorie: "tracteur", special: true, bu: "aliment", site: "s-uab", statut: "en-service", chauffeur: "Ass Guèye", suppleants: 2, conformite: { type: "licence-transport", jours: -3 }, cout: 0 },
  { immat: "AB551HS", marque: "JAC", appellation: "HFC9640ZXC 34,5T", categorie: "semi-remorque", special: true, bu: "aliment", site: "s-uab", statut: "en-service", conformite: { type: "visite-technique", jours: -12 }, cout: 0 },
  { immat: "AA737ZW", marque: "RENAULT", appellation: "Premium plateau 35T", categorie: "tracteur", bu: "aliment", site: "s-uab", statut: "en-service", chauffeur: "Boubacar Dieng", suppleants: 1, conformite: { type: "visite-technique", jours: -21 }, cout: 7_600_000 },
  { immat: "AA180CQ", marque: "TATA", appellation: "Premium frigo 19T", categorie: "camion", special: true, bu: "abattoir", site: "s-abat", statut: "en-service", chauffeur: "Mamadou Diop", km: 685_099, conformite: { type: "assurance", jours: -12 }, cout: 14_200_000 },
  { immat: "AA565GA", marque: "TATA", appellation: "LPT1618TC", categorie: "camion", bu: "abattoir", site: "s-abat", statut: "en-service", chauffeur: "Mory Djitte", km: 245_675, conformite: { type: "assurance", jours: 83 }, cout: 7_100_000, commentaire: "Mutation en cours (situation 2026)" },
  { immat: "AA568GA", marque: "TATA", appellation: "LPT1618TC", categorie: "camion", bu: "abattoir", site: "s-abat", statut: "en-service", chauffeur: "Serigne Mbaye Fall", km: 104_135, conformite: { type: "assurance", jours: 129 }, entretienKm: 5900, cout: 3_400_000 },
  { immat: "AA093VA", marque: "TATA", appellation: "LPT1618TC", categorie: "camion", special: true, bu: "abattoir", site: "s-abat", statut: "en-service", chauffeur: "Maguette Samb", km: 230_750, conformite: { type: "visite-technique", jours: 41 }, entretienKm: 2100, cout: 5_200_000, commentaire: "Moteur du groupe froid (situation 2026)" },
  { immat: "AA032EA", marque: "MITSUBISHI", appellation: "L200 SC", categorie: "camionnette", bu: "commercial", site: "s-thies", statut: "en-service", chauffeur: "Moustapha Diaw", vin: "MMBJNKL30MH021847", km: 343_500, conformite: { type: "visite-technique", jours: 26 }, entretienKm: 6500, cout: 4_800_000 },
  { immat: "AA990DZ", marque: "MITSUBISHI", appellation: "L200 SC", categorie: "camionnette", bu: "commercial", site: "s-siege", statut: "en-backup", chauffeur: "Khalifa Ndiaye", km: 186_554, conformite: { type: "assurance", jours: 152 }, entretienKm: 4800, cout: 2_900_000 },
  /* La plaque était fausse : toutes les listes 2026 — situation, affectation,
     suivi administratif, assurance, attestation, puce carburant — disent
     DK 6875 BF. Corrigée le 10 septembre 2026. La situation le dit
     opérationnel, à l'UAB et à la minoterie, avec Amadou Baldé et Cheikh
     Thiaw. */
  { immat: "DK6875BF", marque: "MITSUBISHI", appellation: "L200 SC", categorie: "camionnette", bu: "aliment", site: "s-uab", statut: "en-service", chauffeur: "Amadou Baldé", suppleants: 1, km: 267_900, conformite: { type: "assurance", jours: 67 }, cout: 5_900_000 },
  /* Le parc ne roule pas tout entier : le chariot élévateur de l'UAB travaille
     en heures, pas en kilomètres. Hors périmètre de disponibilité (engage:
     faux), il a bien un plan d'entretien, et c'est le seul à compteur horaire. */
  { immat: "AA412UB", marque: "TOYOTA", appellation: "Chariot élévateur 8FBE20", categorie: "engin", energie: "electrique", engage: false, bu: "aliment", site: "s-uab", statut: "en-service", cout: 1_850_000, commentaire: "Chariot électrique, manutention des sacs à l'UAB" },
  /* DK 2347 BD a quitté la flotte de transport le 10 septembre 2026 : il y
     figurait en double, et le plan d'affectation le donne à Sidy Ndao — c'est
     un véhicule léger, il vit dans `parc-leger-demo.ts`. */

  /* -- Les dix-sept unités opérationnelles qui manquaient (10 septembre 2026)
   *
   * Elles viennent de `SITUATION PARC SEDIMA LOURDS` (genre, âge, site,
   * activité) et de `AFFECTATION LOURDS` (chauffeur), toutes deux du
   * 3 septembre 2026. Le rapprochement du 7 septembre les avait listées ; le
   * dossier ne portant ni kilométrage ni coût pour elles, ces champs restent
   * absents plutôt qu'inventés — un compteur se relèvera, il ne se devine pas.
   *
   * L'unité de business pour « ŒUFS » (Karaouni) est posée à `fermes` faute
   * de mieux : **à confirmer avec le métier.**
   * ---------------------------------------------------------------------- */

  { immat: "AA927CA", marque: "RENAULT", appellation: "Tracteur vrac 27T", categorie: "tracteur", special: true, bu: "aliment", site: "s-uab", statut: "en-service", chauffeur: "Birago Wane", suppleants: 2 },
  { immat: "AA053AP", marque: "CUBAS SEGRES", appellation: "Citerne vrac 27T", categorie: "semi-remorque", special: true, bu: "aliment", site: "s-uab", statut: "en-service" },
  { immat: "AA713VE", marque: "LECITRAILER", appellation: "Plateau nu 35T", categorie: "semi-remorque", bu: "aliment", site: "s-uab", statut: "en-service" },
  { immat: "AB681HE", marque: "SEDIMA", appellation: "Camion 10T neuf", categorie: "camion", bu: "minoterie", site: "s-minoterie", statut: "en-service", chauffeur: "Omar Cissé", commentaire: "Neuf, pas encore assuré au 3 septembre 2026" },
  { immat: "AA291PT", marque: "TATA", appellation: "Ridelle 10T", categorie: "camion", bu: "aliment", site: "s-touba", statut: "en-service", chauffeur: "Demba Sy" },
  { immat: "AA281PT", marque: "TATA", appellation: "Ridelle 10T", categorie: "camion", bu: "aliment", site: "s-thies", statut: "en-service", chauffeur: "Gora Diop" },
  { immat: "AA920VA", marque: "TATA", appellation: "Ridelle 5T", categorie: "camion", bu: "couvoir", site: "s-touba", statut: "en-service", chauffeur: "Abdou Lakhat Thiam", commentaire: "Entretien chez TATA" },
  { immat: "AA605TR", marque: "TATA", appellation: "Ridelle 5T", categorie: "camion", bu: "aliment", site: "s-uab", statut: "en-service", chauffeur: "Abdourahim Djité" },
  { immat: "AA359AH", marque: "TATA", appellation: "Frigo 5T", categorie: "camion", special: true, bu: "abattoir", site: "s-abat", statut: "en-service", chauffeur: "Samba Thioub" },
  { immat: "AA186CQ", marque: "RENAULT", appellation: "Frigo 5T", categorie: "camion", special: true, bu: "abattoir", site: "s-abat", statut: "en-reparation", chauffeur: "Cheikh Ba", commentaire: "En cours de réparation" },
  { immat: "AA783BN", marque: "TATA", appellation: "Frigo 5T", categorie: "camion", special: true, bu: "abattoir", site: "s-zig", statut: "en-service", chauffeur: "Aly Touré" },
  { immat: "AA226SX", marque: "TATA", appellation: "Fourgon 10T", categorie: "camion", bu: "fermes", site: "s-karaouni", statut: "en-service", chauffeur: "Ndiaga Guèye" },
  { immat: "AA433AJ", marque: "PEUGEOT", appellation: "Boxer", categorie: "camionnette", bu: "fermes", site: "s-karaouni", statut: "en-reparation", commentaire: "Changement de moteur en cours — la situation le porte à la fois en opérationnel et en panne, à trancher" },
  { immat: "AA235MR", marque: "RENAULT", appellation: "Frigo 5T", categorie: "camion", special: true, bu: "fermes", site: "s-karaouni", statut: "en-reparation", chauffeur: "Ousmane Diarra", commentaire: "En cours de réparation" },
  { immat: "AA300PT", marque: "RENAULT", appellation: "Aubineau 40 000 poussins", categorie: "camion", special: true, bu: "couvoir", site: "s-notto", statut: "en-service", chauffeur: "Bakary Diatta", suppleants: 2 },
  { immat: "AA898PZ", marque: "TATA", appellation: "Fourgon 5T", categorie: "camion", bu: "couvoir", site: "s-notto", statut: "en-service", chauffeur: "Bougouma Diop" },
  { immat: "AA277PT", marque: "TATA", appellation: "Ridelle 5T", categorie: "camion", bu: "couvoir", site: "s-ndiakhirate", statut: "en-service", chauffeur: "Abdourahim Djité" },
  { immat: "AA905CW", marque: "RENAULT", appellation: "Tracteur plateau 35T", categorie: "tracteur", bu: "abattoir", site: "s-abat", statut: "en-service", chauffeur: "Saliou Ngom" },
  { immat: "AA214XK", marque: "TRAILOR", appellation: "Plateau 35T", categorie: "semi-remorque", bu: "abattoir", site: "s-abat", statut: "en-service" },
  { immat: "AA350JN", marque: "RENAULT", appellation: "Kerax tracteur citerne", categorie: "tracteur", bu: "fermes", site: "s-fermes", statut: "en-service", chauffeur: "Fallou Ndiaye" },
  { immat: "AA909CW", marque: "CODER", appellation: "Citerne à eau", categorie: "semi-remorque", bu: "fermes", site: "s-fermes", statut: "en-service" },
  { immat: "DK9839BK", marque: "MITSUBISHI", appellation: "L200 pick-up", categorie: "camionnette", bu: "siege", site: "s-siege", statut: "en-service", commentaire: "Opérationnel au suivi administratif, sans chauffeur nommé" },

  /* -- Les seize unités non opérationnelles (10 septembre 2026)
   *
   * Elles viennent des trois autres onglets de `SITUATION PARC SEDIMA
   * LOURDS` : « PANNES », « REPARATION EN COURS », « A REFORMER ». Elles
   * comptent : un camion en panne pèse sur la disponibilité, et c'est
   * précisément ce que la pastille « hors service maintenant » doit voir.
   *
   * Les véhicules **à réformer** sortent du périmètre de disponibilité
   * (`engage: false`), comme DK 2347 BD avant eux : ils quittent la flotte,
   * les compter parmi les engagés fausserait le taux.
   * ---------------------------------------------------------------------- */

  /* En panne — à Keur Massar sauf mention. */
  { immat: "DK6874BF", marque: "MITSUBISHI", appellation: "L200 pick-up", categorie: "camionnette", bu: "aliment", site: "s-km", statut: "hors-service", commentaire: "En panne — réimmatriculé AA 335 HK d'après l'état des pannes, à confirmer" },
  { immat: "AA761JV", marque: "IVECO", appellation: "Citerne vrac", categorie: "camion", special: true, bu: "aliment", site: "s-km", statut: "hors-service", commentaire: "En panne" },
  { immat: "AA769JV", marque: "IVECO", appellation: "Citerne vrac", categorie: "semi-remorque", special: true, bu: "aliment", site: "s-km", statut: "hors-service", commentaire: "En panne — semi de AA 633 JL d'après les licences" },
  { immat: "AA217FF", marque: "RENAULT", appellation: "Camion vrac 20T", categorie: "camion", special: true, bu: "aliment", site: "s-siege", statut: "hors-service", commentaire: "En panne — décision de le transformer en 20 T" },
  { immat: "DK2507BD", marque: "MAN", appellation: "Frigo 10T", categorie: "camion", special: true, bu: "fermes", site: "s-km", statut: "hors-service", commentaire: "En panne — transport des œufs" },

  /* En réparation — garage Gormack, Rufisque. */
  { immat: "DK4003AG", marque: "RENAULT", appellation: "Benne", categorie: "camion", bu: "aliment", site: "s-gormack", statut: "en-reparation", commentaire: "En réparation" },
  { immat: "DK7619BG", marque: "RENAULT", appellation: "Plateau nu 35T", categorie: "semi-remorque", bu: "aliment", site: "s-gormack", statut: "en-reparation", commentaire: "En réparation" },
  { immat: "DL5941D", marque: "RENAULT", appellation: "Plateau nu 35T", categorie: "semi-remorque", bu: "aliment", site: "s-gormack", statut: "en-reparation", commentaire: "En réparation" },

  /* À réformer — hors du périmètre de disponibilité. */
  { immat: "DK7376AC", marque: "RENAULT", appellation: "Frigo", categorie: "camion", special: true, engage: false, bu: "abattoir", site: "s-siege", statut: "retrait-en-cours", commentaire: "À réformer — sur la liste de vente 2025" },
  { immat: "DK9361BB", marque: "IVECO", appellation: "Citerne vrac", categorie: "semi-remorque", special: true, engage: false, bu: "aliment", site: "s-km", statut: "retrait-en-cours", commentaire: "À réformer — sur la liste de vente 2025" },
  { immat: "DK3143BC", marque: "RENAULT", appellation: "Frigo", categorie: "camion", special: true, engage: false, bu: "abattoir", site: "s-djily", statut: "retrait-en-cours", commentaire: "À réformer — sur la liste de vente 2025" },
  { immat: "DK3142BC", marque: "RENAULT", appellation: "Frigo", categorie: "camion", special: true, engage: false, bu: "abattoir", site: "s-km", statut: "retrait-en-cours", commentaire: "À réformer — sur la liste de vente 2025" },
  { immat: "AA318AM", marque: "RENAULT", appellation: "Frigo", categorie: "camion", special: true, engage: false, bu: "abattoir", site: "s-km", statut: "retrait-en-cours", commentaire: "À réformer — sur la liste de vente 2025" },
  { immat: "AA654AS", marque: "RENAULT", appellation: "Tracteur", categorie: "tracteur", engage: false, bu: "aliment", site: "s-km", statut: "retrait-en-cours", commentaire: "À réformer — ex TH 6065 S, sur la liste de vente 2025" },
  { immat: "DK7620BG", marque: "RENAULT", appellation: "Tracteur", categorie: "tracteur", engage: false, bu: "aliment", site: "s-djily", statut: "retrait-en-cours", commentaire: "À réformer" },
  { immat: "DK9619BB", marque: "RENAULT", appellation: "Tracteur", categorie: "tracteur", engage: false, bu: "aliment", site: "s-gormack", statut: "retrait-en-cours", commentaire: "À réformer — le dossier note une nouvelle plaque, à confirmer" },
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

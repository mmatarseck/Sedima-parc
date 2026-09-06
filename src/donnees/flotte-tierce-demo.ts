/* ============================================================================
 * La flotte tierce, telle que le relevé de la Direction des Opérations la tient.
 *
 * **Les immatriculations et les chauffeurs de ce fichier sont réels** : ils
 * sortent de `RECAP TONNAGE HEBDOMMADAIRE.xlsx`, treize semaines de juin à
 * septembre 2026, où chaque ligne porte un transporteur, un chauffeur nommé, un
 * camion immatriculé et un numéro de téléphone. Trente-huit camions y sont
 * relevés, répartis sur sept lignes — dont SEDIMA, qui est le parc, et
 * « AUTRES », qui est la ligne des transports ponctuels.
 *
 * Ce qui n'en sort pas et qui est donc **estimé** : les capacités en tonnes
 * (déduites des tonnages portés dans le relevé), l'état actif, et les profils
 * de contrat — c'est la question 42, toujours ouverte. Chaque approximation est
 * signalée à sa ligne.
 *
 * En production : tables `camion_tiers`, `chauffeur_tiers`, `profil_transporteur`
 * et `rattachement_localite`, alimentées par la saisie du relevé hebdomadaire.
 * ==========================================================================*/

import type { CamionTiers, ChauffeurTiers, ProfilTransporteur, RattachementLocalite } from "@/domaine/flotte-tierce";
import { normaliser } from "@/domaine/immatriculation";
import { listePrestataires } from "./prestataires-demo";

/* -- Ce que le relevé porte, transporteur par transporteur ------------------- */

/**
 * Une ligne du relevé : le nom tel qu'il y est écrit, le prestataire auquel il
 * correspond dans le référentiel, ses camions et ses chauffeurs.
 *
 * `SEDIMA` n'y figure pas : c'est le parc, il est suivi dans Flotte. Le relevé
 * le compte parmi les transporteurs — et il a raison de le faire, c'est la vue
 * unifiée que le compte rendu ADEX réclame — mais dupliquer ici les cinq
 * camions du parc en ferait des fiches concurrentes de celles de la Flotte.
 */
const RELEVE: { nomReleve: string; prestataire: string; camions: string[]; chauffeurs: { nom: string; telephone: string | null }[] }[] = [
  {
    nomReleve: "A DIENG",
    prestataire: "Abdou Dieng",
    camions: ["AA 312 CT", "AA 860 VN", "AA 383 GZ", "AA 317 CT", "AB 287 GR", "AA 314 CT", "AB 417 JW", "AB 495 JX", "AA 116 VN", "AB 273 GR"],
    chauffeurs: [
      { nom: "Cheick Ibra", telephone: "774566779" },
      { nom: "Khadime", telephone: "773696797" },
      { nom: "Serigne Fallou", telephone: "785267503" },
      { nom: "Modou Mbaye", telephone: "775017758" },
      { nom: "Assane Sow", telephone: "772394693" },
      { nom: "Ibrahima Ndiaye", telephone: "771446559" },
      { nom: "Pape Diouf", telephone: "773066651" },
      { nom: "Moustapha Fall", telephone: "769050481" },
    ],
  },
  {
    nomReleve: "A KANE",
    prestataire: "Abdou Kane",
    camions: ["AA 490 KS", "AB 380 SN", "AB 277 BL", "AA 624 JA", "AA 872 DY", "AA 579 ST", "AA 585 HQ"],
    chauffeurs: [
      { nom: "Serigne Diop", telephone: "761350565" },
      { nom: "Ousmane Ba", telephone: "773901523" },
      { nom: "Mor Talla Sène", telephone: "710977756" },
      { nom: "Abdoulaye Faye", telephone: "774494317" },
      { nom: "Cheikh Gueye", telephone: "765870132" },
      { nom: "Samba Diallo", telephone: "770756526" },
      { nom: "Alioune Badara", telephone: "766196850" },
    ],
  },
  {
    nomReleve: "ADEX",
    prestataire: "ADEX Express",
    /* Sept camions au relevé hebdomadaire, neuf sur les factures de mise à
       disposition : les deux camions à œufs (AA 567 EC, AA 076 BP) ne passent
       pas par le relevé de tonnage de l'aliment, mais ils roulent pour nous et
       se facturent au mois. Sans eux, cinq cents chargements et vingt-quatre mois
       de mise à disposition perdaient leur camion à l'entrée en base. */
    camions: ["AA 569 EC", "AA 918 NT", "AA 658 JS", "AA 014 SR", "AA 571 EC", "AA 573 EC", "AA 269 NW", "AA 567 EC", "AA 076 BP"],
    chauffeurs: [
      { nom: "Alpha", telephone: "772003138" },
      { nom: "Demba Ka", telephone: "773977508" },
      { nom: "Mamadou Sarr", telephone: "778715362" },
      { nom: "Babacar Thiam", telephone: "771284744" },
      { nom: "Lamine Sy", telephone: "777826569" },
      { nom: "Ndiaga Mbengue", telephone: "779930347" },
      { nom: "Saliou Diagne", telephone: "770340290" },
    ],
  },
  {
    nomReleve: "DR WADE",
    prestataire: "Dr Wade Transport",
    camions: ["AA 839 SN", "AA 700 JG", "AB 700 JG"],
    chauffeurs: [
      { nom: "Bathie Cissé", telephone: "775363472" },
      { nom: "Malick Ndour", telephone: "762231571" },
    ],
  },
  {
    nomReleve: "SOKHNA DIOP",
    prestataire: "Sokhna Diop",
    camions: ["AA 909 AZ", "AA 479 GX"],
    chauffeurs: [
      { nom: "Elimaane", telephone: "774484678" },
      { nom: "Cheikh Sow", telephone: "775116054" },
    ],
  },
  {
    /* La ligne « AUTRES » du relevé : les transports ponctuels, hors contrat.
       Elle a son propre bon de commande — « BONCDE2 · 2026 DIVERS TRANSPORT
       ROUTE » — ce qui confirme que la comptabilité la traite déjà comme un
       ensemble et non comme des cas isolés. */
    nomReleve: "AUTRES",
    prestataire: "Abdou K. Diop",
    camions: ["AA 118 CB", "AA 772 AZ", "AA 271 LW", "AB 975 FC"],
    chauffeurs: [
      { nom: "Pape Ndiaye", telephone: "775052044" },
      { nom: "Ibou Sarr", telephone: "773821078" },
    ],
  },
];

/** Capacité utile estimée d'après les tonnages portés au relevé, en tonnes. */
const CAPACITE_ESTIMEE: Record<string, number> = {
  "AA 872 DY": 40,
  "AB 277 BL": 40,
  "AA 624 JA": 40,
  "AA 312 CT": 35,
  "AA 569 EC": 35,
  "AA 571 EC": 35,
  "AA 573 EC": 35,
  "AA 918 NT": 22,
  "AA 490 KS": 12,
  "AB 380 SN": 7.5,
  "AA 658 JS": 3,
};

let CACHE_CAMIONS: CamionTiers[] | null = null;
let CACHE_CHAUFFEURS: ChauffeurTiers[] | null = null;

function numeroDe(raisonSociale: string): string | null {
  return listePrestataires().find((p) => p.raisonSociale === raisonSociale)?.numero ?? null;
}

export function chauffeursTiers(): ChauffeurTiers[] {
  if (CACHE_CHAUFFEURS) return CACHE_CHAUFFEURS;
  const liste: ChauffeurTiers[] = [];
  for (const r of RELEVE) {
    const numero = numeroDe(r.prestataire);
    if (!numero) continue;
    r.chauffeurs.forEach((c, rang) => {
      liste.push({ id: `${numero}-CH${String(rang + 1).padStart(2, "0")}`, nom: c.nom, telephone: c.telephone, transporteurNumero: numero, actif: true });
    });
  }
  CACHE_CHAUFFEURS = liste;
  return liste;
}

export function camionsTiers(): CamionTiers[] {
  if (CACHE_CAMIONS) return CACHE_CAMIONS;
  const chauffeurs = chauffeursTiers();
  const liste: CamionTiers[] = [];
  for (const r of RELEVE) {
    const numero = numeroDe(r.prestataire);
    if (!numero) continue;
    const siens = chauffeurs.filter((c) => c.transporteurNumero === numero);
    r.camions.forEach((immat, rang) => {
      const capacite = CAPACITE_ESTIMEE[immat] ?? null;
      liste.push({
        immatriculation: normaliser(immat),
        immatriculationAffichee: immat,
        transporteurNumero: numero,
        /* Un porteur au-dessous de 15 t, un tracteur au-delà : le relevé ne dit
           pas le type, le tonnage porté le laisse deviner. */
        categorie: capacite !== null && capacite >= 30 ? "tracteur" : "camion",
        capaciteTonnes: capacite,
        chauffeurHabituelId: siens[rang % Math.max(1, siens.length)]?.id ?? null,
        actif: true,
        commentaire: capacite === null ? "Capacité non relevée" : null,
      });
    });
  }
  CACHE_CAMIONS = liste;
  return liste;
}

/* -- Les profils ------------------------------------------------------------- */

/*
 * Aucun de ces profils n'est certifié : la question 42 — « quel statut donner
 * aux grilles ? » — reste ouverte, et elle vaut aussi pour les contrats. Ce qui
 * est écrit ici est ce que l'exploitation tient pour vrai, à confirmer par les
 * pièces. Le compte rendu ADEX du 10 avril 2025 en donne un point ferme : le
 * contrat ADEX existe, il porte sur une mise à disposition, et il est jugé
 * « inadapté et à revoir ».
 */
const PROFILS: Record<string, Omit<ProfilTransporteur, "numero">> = {
  "ADEX Express": {
    forme: "societe",
    sousContrat: true,
    referenceContrat: "Contrat de mise à disposition — à revoir (CR du 10/04/2025)",
    debutContrat: "2024-01-01",
    finContrat: null,
    modes: ["journee"],
    camionsEngages: 7,
    commentaire: "Plan d'action de la réunion du 10 avril : nouveau contrat hors mise à disposition, articulé au km, à la tonne ou au mU.",
  },
  "Abdou Kane": { forme: "particulier", sousContrat: false, referenceContrat: null, debutContrat: null, finContrat: null, modes: ["tonne"], camionsEngages: 7, commentaire: "Client SEDIMA — transport compensé sur les achats." },
  "Abdou Dieng": { forme: "particulier", sousContrat: false, referenceContrat: null, debutContrat: null, finContrat: null, modes: ["tonne"], camionsEngages: 10, commentaire: "Client SEDIMA — le plus gros porteur du relevé." },
  "Sokhna Diop": { forme: "particulier", sousContrat: false, referenceContrat: null, debutContrat: null, finContrat: null, modes: ["tonne"], camionsEngages: 2, commentaire: "Cliente SEDIMA — transport compensé." },
  "Moussa Kane": { forme: "particulier", sousContrat: false, referenceContrat: null, debutContrat: null, finContrat: null, modes: ["tonne"], camionsEngages: null, commentaire: null },
  "Abdou K. Diop": { forme: "particulier", sousContrat: false, referenceContrat: null, debutContrat: null, finContrat: null, modes: ["tonne", "mission"], camionsEngages: 4, commentaire: "Rattaché à la ligne « AUTRES » du relevé et au bon de commande « divers transport route »." },
  "Dr Wade Transport": { forme: "societe", sousContrat: false, referenceContrat: null, debutContrat: null, finContrat: null, modes: ["tonne"], camionsEngages: 3, commentaire: null },
  "Dème Transport": { forme: "societe", sousContrat: false, referenceContrat: null, debutContrat: null, finContrat: null, modes: ["mission"], camionsEngages: null, commentaire: "Transfert de poulets vers l'abattoir, au voyage." },
  "Djily Transport": { forme: "societe", sousContrat: false, referenceContrat: null, debutContrat: null, finContrat: null, modes: ["tonne"], camionsEngages: null, commentaire: null },
  "Mouhamed Sy": { forme: "particulier", sousContrat: false, referenceContrat: null, debutContrat: null, finContrat: null, modes: ["mission"], camionsEngages: null, commentaire: "Œufs et farine, prix au sac — hors grille à la tonne." },
  "Dame Ndoye": { forme: "particulier", sousContrat: false, referenceContrat: null, debutContrat: null, finContrat: null, modes: ["mission"], camionsEngages: null, commentaire: "Transport du personnel des abattoirs." },
  K2SBT: { forme: "societe", sousContrat: false, referenceContrat: null, debutContrat: null, finContrat: null, modes: ["mission"], camionsEngages: null, commentaire: "Livraison d'œufs." },
  "Aïssata Gaye": { forme: "particulier", sousContrat: false, referenceContrat: null, debutContrat: null, finContrat: null, modes: ["tonne"], camionsEngages: null, commentaire: "Liaisons Gambie et Casamance." },
};

const PROFIL_DEFAUT: Omit<ProfilTransporteur, "numero"> = {
  forme: "particulier",
  sousContrat: false,
  referenceContrat: null,
  debutContrat: null,
  finContrat: null,
  modes: ["tonne"],
  camionsEngages: null,
  commentaire: null,
};

export function profilTransporteur(raisonSociale: string, numero: string): ProfilTransporteur {
  return { numero, ...(PROFILS[raisonSociale] ?? PROFIL_DEFAUT) };
}

/* -- Les rattachements de localités ------------------------------------------ */

/*
 * Ceux que l'usage a déjà fixés. Sur les 245 libellés du relevé hebdomadaire,
 * une quinzaine seulement figure dans la grille : tout le reste se rattache.
 * Les plus fréquents sont écrits ici ; les autres se rattacheront à la première
 * livraison, et le choix se retiendra.
 */
export function rattachements(): RattachementLocalite[] {
  const usage = (localite: string, destination: string, motif: string): RattachementLocalite => ({
    localite,
    destination,
    origine: "usage",
    motif,
    auteur: "Exploitation transport",
    date: "2026-06-15",
  });
  return [
    usage("BAYAKH", "Notto", "Sur l'axe de Notto, même distance à dix kilomètres près"),
    usage("BAMBILOR", "Dakar", "Périphérie de Dakar, tarif urbain"),
    usage("BAMBI", "Dakar", "Abréviation de Bambilor sur le relevé"),
    usage("GOROM", "Dakar", "Gorom, périphérie de Rufisque"),
    usage("NIAKHIRATE", "Dakar", "Axe Rufisque"),
    usage("NIAGUE", "Dakar", "Axe Rufisque"),
    usage("SANGALKAM", "Dakar", "Périphérie"),
    usage("MALIKA", "Dakar", "Banlieue"),
    usage("MLK", "Dakar", "Abréviation de Malika"),
    usage("THIAROYE", "Dakar", "Banlieue"),
    usage("PARCELLE", "Dakar", "Parcelles Assainies"),
    usage("PIKINE", "Dakar", "Banlieue"),
    usage("DENI", "Dakar", "Deni Biram Ndao"),
    usage("KEUR MASSAR", "Dakar", "Banlieue"),
    usage("KMASSAR", "Dakar", "Abréviation de Keur Massar"),
    usage("YEUMBEUL", "Dakar", "Banlieue"),
    usage("OUAKAM", "Dakar", "Dakar centre"),
    usage("TIV PEUL", "Tivaouane", "Tivaouane Peulh — à ne pas confondre avec Tivaouane, mais facturé au même tarif"),
    usage("KANIAC", "Thiès", "Axe de Thiès"),
    usage("BENTEGNE", "Thiès", "Axe de Thiès"),
    usage("BANDIA", "Thiès", "Axe de Thiès"),
    usage("NIAR", "Thiès", "Axe de Thiès"),
    usage("NIACOU", "Thiès", "Niacourab, axe de Thiès"),
    usage("NIACOURAP", "Thiès", "Axe de Thiès"),
    usage("WAYEMBAM", "Thiès", "Axe de Thiès"),
    usage("NOFLAYE", "Dakar", "Axe Rufisque"),
    usage("MBORO", "Tivaouane", "Axe de Tivaouane"),
    usage("BEER", "Tivaouane", "Beer Thialane, axe de Tivaouane"),
    usage("LOULY", "Mbour", "Axe de Mbour"),
    usage("NGEKHOKH", "Mbour", "Axe de Mbour"),
    usage("THIADIAYE", "Mbour", "Axe de Mbour"),
    usage("ZIG", "Ziguinchor", "Abréviation courante"),
    usage("ST LOUIS", "Saint-Louis", "Abréviation courante"),
    usage("POUT", "Thiès", "Axe de Thiès, avant Thiès"),
    usage("DOUGAR", "Thiès", "Axe de Thiès"),
    usage("KISSANE", "Thiès", "Axe de Thiès"),
    usage("NDAM LO", "Touba", "Axe de Touba"),
    usage("GADIAGA", "Thiès", "Axe de Thiès"),
    usage("NDOYENE", "Thiès", "Axe de Thiès"),
    usage("DARA", "Louga", "Dara Djolof, axe de Louga"),
  ];
}

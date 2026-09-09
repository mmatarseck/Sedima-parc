/* ============================================================================
 * Pièces de rechange — données de démonstration.
 *
 * Une quarantaine de pièces plausibles pour la flotte (filtres, huiles,
 * freinage, batteries, courroies, pneus), leurs entrées depuis les
 * fournisseurs du référentiel, et les sorties qui expliquent les
 * interventions déjà en démonstration : une vidange sort son filtre et son
 * huile, un remplacement de batterie sa batterie, une permutation de pneus
 * rien. Quelques pneus suivis un par un sur deux camions.
 *
 * Rien de tout cela n'entre au seed : en production le référentiel se
 * saisit ou s'importe, et le stock initial se pose par une régularisation.
 * ==========================================================================*/

import { formerNumero } from "@/domaine/reference";
import type { CategoriePiece, MouvementStock, Piece, Pneu, UnitePiece } from "@/domaine/pieces";
import { DATE_REFERENCE } from "./chauffeurs-demo";
import { interventionsFlotte } from "./maintenance-demo";
import { FLOTTE } from "./parc-demo";
import { listePrestataires } from "./prestataires-demo";

type Brut = [reference: string, designation: string, categorie: CategoriePiece, unite: UnitePiece, constructeur: string | null, compatibilites: string, fournisseur: string, prix: number, minimum: number, maximum: number];

const BRUT: Brut[] = [
  /* -- Filtration -- */
  ["FH-RVI-01", "Filtre à huile Renault Kerax / Premium", "filtration", "piece", "7420843764", "Renault Kerax; Renault Premium; Renault Magnum", "SENEMECA", 18_500, 6, 20],
  ["FH-TATA-01", "Filtre à huile TATA LPT 1618", "filtration", "piece", "253409130103", "TATA LPT1618TC", "TATA Pikine", 9_800, 4, 12],
  ["FH-L200-01", "Filtre à huile Mitsubishi L200", "filtration", "piece", "MD360935", "Mitsubishi L200", "CFAO Motors", 6_500, 6, 24],
  ["FH-HILUX-01", "Filtre à huile Toyota Hilux", "filtration", "piece", "90915-YZZD4", "Toyota Hilux", "CFAO Motors", 7_200, 4, 16],
  ["FA-RVI-01", "Filtre à air Renault Kerax / Premium", "filtration", "piece", "5010230842", "Renault Kerax; Renault Premium", "SENEMECA", 42_000, 3, 8],
  ["FA-L200-01", "Filtre à air Mitsubishi L200", "filtration", "piece", "1500A023", "Mitsubishi L200", "CFAO Motors", 14_500, 4, 12],
  ["FG-RVI-01", "Filtre à gasoil Renault (séparateur)", "filtration", "piece", "7421380483", "Renault Kerax; Renault Premium; Renault Magnum", "SENEMECA", 27_000, 4, 12],
  ["FG-TATA-01", "Filtre à gasoil TATA", "filtration", "piece", "278607130132", "TATA LPT1618TC; TATA Premium", "TATA Pikine", 11_000, 4, 12],
  ["FG-L200-01", "Filtre à gasoil Mitsubishi L200", "filtration", "piece", "1770A053", "Mitsubishi L200", "CFAO Motors", 16_800, 4, 12],
  /* -- Lubrifiants -- */
  ["HM-15W40", "Huile moteur 15W40 (fût 208 L, au litre)", "lubrifiant", "litre", null, "Renault Kerax; Renault Premium; Renault Magnum; TATA LPT1618TC; IVECO AT260", "SENEMECA", 3_900, 150, 400],
  ["HM-5W30", "Huile moteur 5W30 (bidon 5 L, au litre)", "lubrifiant", "litre", null, "Mitsubishi L200; Toyota Hilux", "CFAO Motors", 6_200, 40, 120],
  ["HB-80W90", "Huile de boîte et de pont 80W90 (au litre)", "lubrifiant", "litre", null, "Renault Kerax; Renault Premium; TATA LPT1618TC", "SENEMECA", 4_400, 40, 100],
  ["LR-G12", "Liquide de refroidissement G12 (au litre)", "lubrifiant", "litre", null, "Tous", "Espace Auto Sénégal", 2_800, 40, 120],
  ["GR-EP2", "Graisse EP2 (cartouche 400 g)", "consommable", "piece", null, "Tous", "Espace Auto Sénégal", 3_200, 10, 30],
  /* -- Freinage -- */
  ["FR-GARN-RVI", "Garnitures de frein Renault Kerax (jeu essieu)", "freinage", "jeu", "5001860998", "Renault Kerax; Renault Premium", "SENEMECA", 165_000, 2, 6],
  ["FR-GARN-TATA", "Garnitures de frein TATA LPT (jeu essieu)", "freinage", "jeu", "264242200105", "TATA LPT1618TC", "TATA Pikine", 98_000, 2, 6],
  ["FR-PLAQ-L200", "Plaquettes de frein avant Mitsubishi L200 (jeu)", "freinage", "jeu", "4605A458", "Mitsubishi L200", "CFAO Motors", 38_000, 3, 10],
  ["FR-PLAQ-HILUX", "Plaquettes de frein avant Toyota Hilux (jeu)", "freinage", "jeu", "04465-0K160", "Toyota Hilux", "CFAO Motors", 41_000, 2, 8],
  ["FR-DISQ-L200", "Disque de frein avant Mitsubishi L200", "freinage", "piece", "MR569949", "Mitsubishi L200", "CFAO Motors", 52_000, 2, 6],
  /* -- Électricité -- */
  ["BAT-12V-60", "Batterie 12 V 60 Ah", "electricite", "piece", "Varta E11", "Mitsubishi L200; Toyota Hilux", "Espace Auto Sénégal", 71_500, 2, 6],
  ["BAT-12V-180", "Batterie 12 V 180 Ah poids lourd", "electricite", "piece", "Varta N180", "Renault Kerax; Renault Premium; Renault Magnum; TATA LPT1618TC; IVECO AT260", "Espace Auto Sénégal", 185_000, 2, 6],
  ["AMP-H7", "Ampoule H7 24 V", "electricite", "piece", null, "Renault Kerax; Renault Premium; TATA LPT1618TC", "Établissements Diagne & Frères", 2_600, 10, 30],
  ["AMP-H4", "Ampoule H4 12 V", "electricite", "piece", null, "Mitsubishi L200; Toyota Hilux", "Établissements Diagne & Frères", 1_900, 10, 30],
  ["FUS-ASS", "Assortiment de fusibles (boîte)", "electricite", "piece", null, "Tous", "Établissements Diagne & Frères", 4_500, 3, 10],
  ["ALT-RVI", "Alternateur Renault Premium 28 V", "electricite", "piece", "7421429793", "Renault Premium; Renault Magnum", "SENEMECA", 425_000, 1, 2],
  /* -- Transmission, moteur -- */
  ["COU-ALT-RVI", "Courroie d'accessoires Renault", "transmission", "piece", "7420778433", "Renault Kerax; Renault Premium", "SENEMECA", 34_000, 2, 6],
  ["COU-DIST-L200", "Courroie de distribution Mitsubishi L200 (kit)", "transmission", "jeu", "MD327394", "Mitsubishi L200", "CFAO Motors", 96_000, 1, 4],
  ["EMB-KIT-L200", "Kit d'embrayage Mitsubishi L200", "transmission", "jeu", "MR953717", "Mitsubishi L200", "CFAO Motors", 215_000, 1, 3],
  ["INJ-RVI", "Injecteur Renault DXi 11", "moteur", "piece", "7421582101", "Renault Kerax; Renault Premium; Renault Magnum", "SENEMECA", 310_000, 1, 4],
  ["BOU-PRE", "Bougie de préchauffage Mitsubishi L200", "moteur", "piece", "MD365224", "Mitsubishi L200", "CFAO Motors", 8_900, 4, 16],
  ["DUR-RAD", "Durite de radiateur supérieure Renault Kerax", "moteur", "piece", "5010514516", "Renault Kerax", "SENEMECA", 28_000, 1, 4],
  ["THERM-RVI", "Thermostat Renault DXi", "moteur", "piece", "7420813574", "Renault Kerax; Renault Premium; Renault Magnum", "SENEMECA", 46_000, 1, 3],
  /* -- Carrosserie, consommables -- */
  ["RET-AVG", "Rétroviseur gauche Mitsubishi L200", "carrosserie", "piece", "7632A459", "Mitsubishi L200", "CFAO Motors", 68_000, 1, 2],
  ["BAL-ESS", "Balais d'essuie-glace 600 mm (paire)", "consommable", "jeu", null, "Tous", "Établissements Diagne & Frères", 7_500, 4, 12],
  ["SAN-ARR", "Sangle d'arrimage 8 m 5 t", "consommable", "piece", null, "Tous", "Établissements Diagne & Frères", 12_500, 6, 20],
  ["EXT-2KG", "Extincteur 2 kg à poudre", "consommable", "piece", null, "Tous", "Établissements Diagne & Frères", 22_000, 2, 6],
  /* -- Pneumatiques -- */
  ["PN-315-80-22", "Pneu 315/80 R22.5 (poids lourd)", "pneumatique", "piece", "Michelin X Multi Z", "Renault Kerax; Renault Premium; Renault Magnum; IVECO AT260; FAW CA4250", "Pneus Plus Dakar", 285_000, 4, 12],
  ["PN-12-22", "Pneu 12 R22.5 (TATA)", "pneumatique", "piece", "Apollo Endurace", "TATA LPT1618TC; TATA Premium", "Pneus Plus Dakar", 215_000, 2, 8],
  ["PN-265-65-17", "Pneu 265/65 R17 (pick-up)", "pneumatique", "piece", "Bridgestone Dueler", "Mitsubishi L200; Toyota Hilux", "Pneus Plus Dakar", 98_000, 4, 12],
  ["PN-205-70-15", "Pneu 205/70 R15 (camionnette)", "pneumatique", "piece", "Dunlop", "Camionnette", "Pneus Plus Dakar", 62_000, 2, 8],
];

/** Le premier mois d'entrées : le magasin vit depuis le début de l'année précédente. */
const DEBUT = "2025-09";

let CACHE: { pieces: Piece[]; mouvements: MouvementStock[]; pneus: Pneu[] } | null = null;

/** Une suite déterministe : le jeu est le même à chaque chargement. */
function graine(texte: string): () => number {
  let h = 2166136261;
  for (const c of texte) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function construire() {
  if (CACHE) return CACHE;
  const prestataires = new Map(listePrestataires().map((p) => [p.raisonSociale, p.numero]));
  const pieces: Piece[] = BRUT.map(([reference, designation, categorie, unite, constructeur, compatibilites, fournisseur, prix, minimum, maximum], i) => ({
    numero: formerNumero("piece", "2025-09-01", i + 1),
    reference,
    designation,
    categorie,
    unite,
    referenceConstructeur: constructeur,
    compatibilites: compatibilites.split(";").map((x) => x.trim()),
    fournisseurNumero: prestataires.get(fournisseur) ?? null,
    fournisseur,
    prixReference: prix,
    stockMinimum: minimum,
    stockMaximum: maximum,
    actif: true,
    commentaire: null,
    creee: false,
  }));
  const parReference = new Map(pieces.map((p) => [p.reference, p]));
  const alea = graine("pieces");
  const mouvements: MouvementStock[] = [];
  let rang = 0;
  const ajouter = (m: Omit<MouvementStock, "numero" | "creee" | "auteur"> & { auteur?: string }) => {
    rang += 1;
    mouvements.push({ ...m, numero: formerNumero("mouvement", m.date, rang), auteur: m.auteur ?? "Chef d'atelier", creee: false });
  };

  /* Les entrées : chaque pièce reçoit, au premier mois, de quoi tenir, puis
     une ou deux livraisons dans l'année, au prix de référence à quelques
     pour cent près — le prix bouge, le stock se déduit quand même. */
  for (const p of pieces) {
    const cible = p.stockMaximum ?? p.stockMinimum * 2;
    ajouter({ date: `${DEBUT}-0${1 + Math.floor(alea() * 8)}`, nature: "entree", pieceNumero: p.numero, quantite: cible, ecart: null, prixUnitaire: Math.round((p.prixReference ?? 0) * (0.94 + alea() * 0.1)), demandeNumero: null, ordreNumero: null, interventionNumero: null, vehiculeId: null, immatriculationAffichee: null, fournisseur: p.fournisseur, motif: "Stock initial de l'atelier", auteur: "Gestionnaire de parc" });
    const livraisons = 1 + Math.floor(alea() * 2);
    for (let k = 0; k < livraisons; k++) {
      const mois = 2 + Math.floor(alea() * 9);
      const date = new Date(Date.UTC(2025, 8 + mois, 1 + Math.floor(alea() * 26))).toISOString().slice(0, 10);
      if (date > DATE_REFERENCE) continue;
      ajouter({ date, nature: "entree", pieceNumero: p.numero, quantite: Math.max(1, Math.round(cible / 2)), ecart: null, prixUnitaire: Math.round((p.prixReference ?? 0) * (0.95 + alea() * 0.12)), demandeNumero: `DAC-${date.slice(0, 4)}-${String(100 + Math.floor(alea() * 60)).padStart(5, "0")}`, ordreNumero: null, interventionNumero: null, vehiculeId: null, immatriculationAffichee: null, fournisseur: p.fournisseur, motif: null, auteur: "Chef d'atelier" });
    }
  }

  /* Les sorties : ce que les interventions de la démonstration ont consommé,
     d'après leur objet et la marque du véhicule. */
  const marqueDe = (vehiculeId: string) => FLOTTE.find((l) => l.vehicule.id === vehiculeId)?.vehicule.marque?.toUpperCase() ?? "";
  const filtres = (marque: string) => (marque.includes("RENAULT") ? ["FH-RVI-01", "FG-RVI-01"] : marque.includes("TATA") ? ["FH-TATA-01", "FG-TATA-01"] : marque.includes("MITSUBISHI") ? ["FH-L200-01", "FG-L200-01"] : marque.includes("TOYOTA") ? ["FH-HILUX-01"] : ["FH-RVI-01"]);
  const huile = (marque: string) => (marque.includes("MITSUBISHI") || marque.includes("TOYOTA") ? ["HM-5W30", 6] : ["HM-15W40", 28]) as [string, number];
  const freins = (marque: string) => (marque.includes("RENAULT") ? "FR-GARN-RVI" : marque.includes("TATA") ? "FR-GARN-TATA" : marque.includes("MITSUBISHI") ? "FR-PLAQ-L200" : "FR-PLAQ-HILUX");
  const batterie = (marque: string) => (marque.includes("MITSUBISHI") || marque.includes("TOYOTA") ? "BAT-12V-60" : "BAT-12V-180");
  for (const i of interventionsFlotte()) {
    if (i.date < DEBUT || i.date > DATE_REFERENCE) continue;
    const objet = i.objet.toLowerCase();
    const marque = marqueDe(i.vehiculeId);
    const sorties: [string, number][] = [];
    if (objet.includes("vidange")) {
      for (const f of filtres(marque)) sorties.push([f, 1]);
      sorties.push(huile(marque));
    }
    if (objet.includes("frein")) sorties.push([freins(marque), 1]);
    if (objet.includes("batterie")) sorties.push([batterie(marque), 1]);
    if (objet.includes("courroie")) sorties.push([marque.includes("MITSUBISHI") ? "COU-DIST-L200" : "COU-ALT-RVI", 1]);
    if (objet.includes("injecteur")) sorties.push(["INJ-RVI", 2]);
    if (objet.includes("embrayage")) sorties.push(["EMB-KIT-L200", 1]);
    if (objet.includes("refroidissement") || objet.includes("durite")) sorties.push(["DUR-RAD", 1], ["LR-G12", 12]);
    for (const [reference, quantite] of sorties) {
      const p = parReference.get(reference);
      if (!p) continue;
      ajouter({ date: i.date, nature: "sortie", pieceNumero: p.numero, quantite, ecart: null, prixUnitaire: null, demandeNumero: null, ordreNumero: null, interventionNumero: i.numero, vehiculeId: i.vehiculeId, immatriculationAffichee: i.immatriculationAffichee, fournisseur: null, motif: i.objet, auteur: "Chef d'atelier" });
    }
  }
  /* Le magasin ne descend jamais sous zéro : quand les sorties de la
     démonstration dépassent ce qui est entré, une livraison la veille remet
     la pièce à sa cible — c'est ce qu'un atelier fait : il commande. Une pièce
     peut donc tomber à zéro (épuisée), jamais en dessous. */
  for (const p of pieces) {
    const cible = Math.max(1, p.stockMaximum ?? p.stockMinimum * 2);
    const siens = mouvements.filter((m) => m.pieceNumero === p.numero).sort((a, b) => a.date.localeCompare(b.date) || a.numero.localeCompare(b.numero));
    let stock = 0;
    for (const m of siens) {
      if (m.nature === "sortie" && stock - m.quantite < 0) {
        const quantite = Math.max(Math.ceil(cible / 2), m.quantite - stock);
        const veille = new Date(Date.parse(m.date) - 86_400_000).toISOString().slice(0, 10);
        ajouter({ date: veille, nature: "entree", pieceNumero: p.numero, quantite, ecart: null, prixUnitaire: Math.round((p.prixReference ?? 0) * (0.97 + alea() * 0.08)), demandeNumero: `DAC-${veille.slice(0, 4)}-${String(200 + Math.floor(alea() * 60)).padStart(5, "0")}`, ordreNumero: null, interventionNumero: null, vehiculeId: null, immatriculationAffichee: null, fournisseur: p.fournisseur, motif: "Réapprovisionnement avant intervention", auteur: "Chef d'atelier" });
        stock += quantite;
      }
      stock += m.nature === "sortie" ? -m.quantite : m.nature === "regularisation" ? (m.ecart ?? 0) : m.quantite;
    }
  }
  /* Un retour et une régularisation, pour que l'écran les montre. */
  const plaquettes = parReference.get("FR-PLAQ-L200")!;
  ajouter({ date: "2026-07-22", nature: "retour", pieceNumero: plaquettes.numero, quantite: 1, ecart: null, prixUnitaire: null, demandeNumero: null, ordreNumero: null, interventionNumero: null, vehiculeId: null, immatriculationAffichee: null, fournisseur: null, motif: "Jeu sorti par erreur, non posé", auteur: "Chef d'atelier" });
  const ampoules = parReference.get("AMP-H7")!;
  ajouter({ date: "2026-08-30", nature: "regularisation", pieceNumero: ampoules.numero, quantite: 3, ecart: -3, prixUnitaire: null, demandeNumero: null, ordreNumero: null, interventionNumero: null, vehiculeId: null, immatriculationAffichee: null, fournisseur: null, motif: "Inventaire du 30 août : trois ampoules manquantes au casier", auteur: "Gestionnaire de parc" });
  /* L'inventaire du 30 août a aussi trouvé un casier vide et un casier bien
     entamé : une pièce épuisée, une sous le seuil — ce que l'écran doit savoir
     montrer, et ce qu'une demande d'achat viendra corriger. */
  const stockCourant = (numero: string) => mouvements.filter((m) => m.pieceNumero === numero).reduce((s, m) => s + (m.nature === "sortie" ? -m.quantite : m.nature === "regularisation" ? (m.ecart ?? 0) : m.quantite), 0);
  const thermostat = parReference.get("THERM-RVI")!;
  if (stockCourant(thermostat.numero) > 0) ajouter({ date: "2026-08-30", nature: "regularisation", pieceNumero: thermostat.numero, quantite: stockCourant(thermostat.numero), ecart: -stockCourant(thermostat.numero), prixUnitaire: null, demandeNumero: null, ordreNumero: null, interventionNumero: null, vehiculeId: null, immatriculationAffichee: null, fournisseur: null, motif: "Inventaire du 30 août : casier vide, thermostats introuvables", auteur: "Gestionnaire de parc" });
  const graisse = parReference.get("GR-EP2")!;
  if (stockCourant(graisse.numero) > 3) ajouter({ date: "2026-08-30", nature: "regularisation", pieceNumero: graisse.numero, quantite: stockCourant(graisse.numero) - 3, ecart: 3 - stockCourant(graisse.numero), prixUnitaire: null, demandeNumero: null, ordreNumero: null, interventionNumero: null, vehiculeId: null, immatriculationAffichee: null, fournisseur: null, motif: "Inventaire du 30 août : trois cartouches au casier, le reste parti sans sortie", auteur: "Gestionnaire de parc" });
  mouvements.sort((a, b) => b.date.localeCompare(a.date) || b.numero.localeCompare(a.numero));

  /* Les pneus, un par un : deux camions Renault suivis, quatre pneus au magasin, un déposé. */
  const pneus: Pneu[] = [];
  const pn315 = parReference.get("PN-315-80-22")!;
  const pn265 = parReference.get("PN-265-65-17")!;
  let rangPneu = 0;
  const pneu = (p: Omit<Pneu, "numero" | "creee">) => {
    rangPneu += 1;
    pneus.push({ ...p, numero: formerNumero("pneu", p.datePose ?? "2026-01-15", rangPneu), creee: false });
  };
  const camions = FLOTTE.filter((l) => l.vehicule.marque.toUpperCase().includes("RENAULT") && l.vehicule.categorie === "camion").slice(0, 2);
  const positions = ["AVG", "AVD", "ARG ext.", "ARG int.", "ARD ext.", "ARD int."];
  for (const l of camions) {
    const km = l.kilometrage ?? 300_000;
    positions.forEach((position, k) => {
      const pose = k < 2 ? "2026-03-12" : "2025-11-04";
      pneu({ pieceNumero: pn315.numero, marque: "Michelin", dimension: "315/80 R22.5", numeroSerie: `DOT ${k < 2 ? "1026" : "3825"}-${l.vehicule.immatriculation.slice(-3)}${k}`, etat: "monte", vehiculeId: l.vehicule.id, immatriculationAffichee: l.vehicule.immatriculationAffichee, position, datePose: pose, kmPose: Math.max(0, km - (k < 2 ? 38_000 : 61_000)), dateDepose: null, kmDepose: null, rechapages: k < 2 ? 0 : 1, commentaire: null });
    });
  }
  for (let k = 0; k < 4; k++) pneu({ pieceNumero: k < 2 ? pn315.numero : pn265.numero, marque: k < 2 ? "Michelin" : "Bridgestone", dimension: k < 2 ? "315/80 R22.5" : "265/65 R17", numeroSerie: `DOT 2226-S${k}`, etat: "en-stock", vehiculeId: null, immatriculationAffichee: null, position: null, datePose: null, kmPose: null, dateDepose: null, kmDepose: null, rechapages: 0, commentaire: null });
  pneu({ pieceNumero: pn315.numero, marque: "Michelin", dimension: "315/80 R22.5", numeroSerie: "DOT 0524-D1", etat: "depose", vehiculeId: null, immatriculationAffichee: camions[0]?.vehicule.immatriculationAffichee ?? null, position: null, datePose: "2025-05-20", kmPose: 240_000, dateDepose: "2026-03-12", kmDepose: 302_000, rechapages: 1, commentaire: "Usure à 2 mm — à rechaper ou à rebuter" });

  CACHE = { pieces, mouvements, pneus };
  return CACHE;
}

export function piecesDemo(): Piece[] {
  return construire().pieces;
}

export function mouvementsDemo(): MouvementStock[] {
  return construire().mouvements;
}

export function pneusDemo(): Pneu[] {
  return construire().pneus;
}

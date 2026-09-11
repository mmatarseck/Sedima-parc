/* ============================================================================
 * Fabrique `supabase/livraison-parties/` — les livraisons réelles, rattachées
 * aux véhicules qui les ont portées.
 *
 * Demande du métier (11 septembre 2026) : « préparer aussi les données de
 * livraison et associer aux différents véhicules ».
 *
 * LES SOURCES. Sage X3 écrit, sur chaque bon de livraison, le nom du chauffeur
 * et la plaque du camion (« Nom Chauff client », « Mat. Véhicule client »).
 * Trois fichiers du dossier DO les portent, sans se recouvrir :
 *
 *   * **EXTRACTION_YLIV 2026 ALL** — toutes les usines, du 1er janvier au
 *     8 juillet 2026. Les états mensuels UAB de janvier à mai en sont tirés :
 *     leurs bons y sont tous (1 059 sur 1 059 en janvier, 1 228 sur 1 228 en
 *     mai) ; ils ne servent ici que de contrôle.
 *   * **ETAT LIVRAISONS MENSUELLES AOUT 2026** — l'UAB, du 3 au 31 août ;
 *     l'extraction s'arrête avant.
 *   * **LIVRAISON NOVEMBRE 2025** et **SITUATION LIVRAISONS DECEMBRE 2025** —
 *     l'UAB, extraits de X3 avec les mêmes colonnes.
 *
 * Restent sans source : 2025 avant novembre (l'extraction annuelle n'a ni
 * plaque ni chauffeur), et du 9 juillet au 2 août 2026.
 *
 * CE QU'ON CHARGE. Une ligne par **bon de livraison**, pas par article : c'est
 * le bon qui monte dans un camion. Seuls les bons qui portent une plaque sont
 * gardés — sans plaque, rien à rattacher.
 *
 * LE POIDS. L'extraction YLIV compte en **unités de stock**, pas en kilos : une
 * ligne « KG » d'aliment y compte des sacs. Comparée ligne à ligne aux états
 * mensuels qui en sont tirés (3 753 lignes, janvier et mai), elle vaut ×50 pour
 * les aliments volaille, ×40 pour les aliments ruminants et bétail, ×1 pour le
 * vrac. La minoterie écrit la taille du sac dans la désignation ; l'abattoir
 * compte ses kilos en kilos, et ses poulets à l'unité, que leur calibre pèse.
 * Aucun camion ne charge plus de 45 t : une ligne qui les dépasserait était
 * déjà en kilos. Un bon dont aucune ligne ne se pèse garde un poids **nul**.
 * Les extractions X3 de 2025 et l'état d'août sont déjà en kilos.
 *
 * LE RATTACHEMENT se fait en base, au moment de l'insertion, par la plaque :
 * un véhicule du parc d'abord, puis un camion tiers et son transporteur. Le
 * libellé du bon ne sert qu'à défaut — un préfixe de transporteur (« AK/ »
 * pour Abdou Kane), un enlèvement par le client. La base a le dernier mot :
 * une plaque renommée depuis n'est pas rattachée par erreur.
 *
 * Lancer : npx tsx scripts/charger-livraisons.mts
 * ==========================================================================*/

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";
import { normaliser } from "../src/domaine/immatriculation";

const DO = "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/63. Logistique Usines/";
const projet = process.cwd();

const texte = (c: Cellule) => (c === null || c === undefined ? "" : String(c).trim());
const echappe = (s: string) => s.replace(/'/g, "''");
const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const PLAQUE = /^[A-Z]{2}\d{3,4}[A-Z]{1,2}$/;

/* -- 1. Le référentiel : le parc et les camions tiers ----------------------- */

const lire = (f: string) => readFileSync(join(projet, f), "utf8");
const parc = new Set<string>();
for (const f of ["supabase/seed.sql", "supabase/aligner-referentiel.sql"]) {
  for (const b of lire(f).matchAll(/insert into vehicule \([^)]*\) values[\s\S]*?\non conflict[^;]*;/g)) {
    for (const m of b[0].matchAll(/^\s+\('[0-9a-f-]{36}', '([A-Z]{2}\d{3,4}[A-Z]{1,2})'/gm)) parc.add(m[1]!);
  }
}
const numeroDe = new Map<string, string>();
for (const m of lire("supabase/seed.sql").matchAll(/\('([0-9a-f-]{36})', '(PRE-\d{4}-\d{5})'/g)) numeroDe.set(m[1]!, m[2]!);
const tiers = new Map<string, string>();
for (const b of lire("supabase/seed.sql").matchAll(/insert into camion_tiers \([^)]*\) values[\s\S]*?\non conflict[^;]*;/g)) {
  for (const m of b[0].matchAll(/^\s+\('([A-Z0-9]+)', '([0-9a-f-]{36})'/gm)) tiers.set(m[1]!, numeroDe.get(m[2]!) ?? "?");
}
for (const m of lire("supabase/releve-parties/releve-01-camions.sql").matchAll(/^\s+\('([A-Z0-9]+)', \(select id from prestataire where numero = '(PRE-\d{4}-\d{5})'\)/gm)) tiers.set(m[1]!, m[2]!);
if (parc.size < 100 || tiers.size < 40) throw new Error(`référentiel mal lu : ${parc.size} véhicules, ${tiers.size} camions tiers`);

/* -- 2. Les libellés : transporteur, client, chauffeur ---------------------- */

/**
 * Les préfixes et noms de transporteurs que les bons écrivent. Chacun est
 * vérifié sur les camions connus qu'il conduit : « MD/ » et « SD/ » conduisent
 * ceux de Sokhna Diop (270 bons sur 282), « DW/ » ceux de Dr Wade (1 000 sur
 * 1 028). « MAMADOU DIOP » seul n'y est pas : c'est aussi un chauffeur de
 * l'abattoir. DJILY non plus : son camion DK 4430 AB est rattaché à un autre
 * transporteur au référentiel, et c'est la plaque qui décide.
 */
const TRANSPORTEURS: [RegExp, string][] = [
  [/^(AK|ABDOU KANE|A KANE)\b/, "PRE-2026-00021"],
  [/^(AD|ABDOU DIENG|A DIENG)\b/, "PRE-2026-00022"],
  [/^(MD|SD|SOKHNA DIOP)\b/, "PRE-2026-00023"],
  [/^(MK|MOUSSA KANE)\b/, "PRE-2026-00024"],
  [/^(DW|DR WADE)\b/, "PRE-2026-00027"],
  [/^ADEX\b/, "PRE-2026-00033"],
];
/** « LUI MEME », « LUIMEMZ », « LIUI MEME », « ENELEVEMENT »… : le client est venu chercher sa marchandise. */
const CLIENT = /^(L+I?U+I*M+E+M+[EZ]*|CLIENTLUI|EN?E?LE?VE?MENT)/;
const LOCATION = /^(LOCATION|LOCAT|LOC)\b/;

interface Lecture {
  mode: "transporteur" | "client" | "inconnu";
  prestataire: string | null;
  transporteur: string | null;
  chauffeur: string | null;
}

/** Ce que dit le libellé du bon. Dans les états mensuels, il nomme le transporteur ; dans X3, le chauffeur, précédé du transporteur. */
function lireLibelle(brut: string, colonneTransporteur: string): Lecture {
  const l = sansAccents(brut);
  const [avant, apres] = l.includes("/") ? [l.slice(0, l.indexOf("/")).trim(), l.slice(l.indexOf("/") + 1).trim()] : [l, ""];
  if (CLIENT.test(l.replace(/[\s-]/g, ""))) return { mode: "client", prestataire: null, transporteur: "Client lui-même", chauffeur: apres || null };
  if (LOCATION.test(l)) return { mode: "transporteur", prestataire: null, transporteur: "Location", chauffeur: apres || null };
  for (const source of [avant, sansAccents(colonneTransporteur)]) {
    const t = TRANSPORTEURS.find(([motif]) => motif.test(source));
    if (t) return { mode: "transporteur", prestataire: t[1], transporteur: source, chauffeur: apres || null };
  }
  if (l === "SEDIMA") return { mode: "inconnu", prestataire: null, transporteur: "SEDIMA", chauffeur: null };
  return { mode: "inconnu", prestataire: null, transporteur: null, chauffeur: l || null };
}

/**
 * Les plaques mal tapées, corrigées avec leur preuve : le transporteur du bon
 * possède le camion à un caractère près, et la plaque écrite n'existe nulle
 * part ailleurs.
 */
const CORRECTIONS: Record<string, { plaque: string; preuve: string }> = {
  DL7179E: { plaque: "DK7179E", preuve: "« DL » n'est pas une série ; DK 7179 E est un camion d'Abdou Dieng, transporteur du bon" },
  DL7179EC: { plaque: "DK7179E", preuve: "même camion, une lettre de trop" },
  DL3970E: { plaque: "DK3970E", preuve: "« DL » n'est pas une série" },
  AB292FX: { plaque: "AA292FX", preuve: "AA 292 FX est un camion d'Abdou Dieng, transporteur du bon" },
  AB118CB: { plaque: "AA118CB", preuve: "AA 118 CB roule avec AA 772 AZ, AA 271 LW et AB 975 FC, que les mêmes bons attribuent au même transporteur" },
  AB118GB: { plaque: "AA118CB", preuve: "même chauffeur (Bara Fall) que AA 118 CB" },
  AA271ZW: { plaque: "AA271LW", preuve: "même chauffeur (Mbaye Fam) que AA 271 LW" },
  AA277BL: { plaque: "AB277BL", preuve: "AB 277 BL est un camion d'Abdou Kane, transporteur du bon" },
};

/* -- 3. Le poids ------------------------------------------------------------ */

const TAILLE = /(\d+(?:[.,]\d+)?) ?(KG|G)\b/;
const CHARGE_MAXIMALE_KG = 45_000;

/** Le poids d'une ligne et l'unité sous laquelle sa quantité se lit. */
function poidsLigne(enKilos: boolean, site: string, unite: string, designation: string, quantite: number): { poids: number | null; unite: string } {
  const u = unite.toUpperCase();
  if (!Number.isFinite(quantite) || quantite <= 0) return { poids: null, unite: u.toLowerCase() || "?" };
  if (u === "VRA") return { poids: quantite, unite: "kg" };
  if (enKilos) return u === "KG" ? { poids: quantite, unite: "kg" } : { poids: null, unite: u.toLowerCase() };
  const d = sansAccents(designation);
  const m = TAILLE.exec(d);
  const taille = m ? Number(m[1]!.replace(",", ".")) * (m[2] === "G" ? 0.001 : 1) : null;
  if (u === "UN" || u === "UNI") return /CALIBRE/.test(d) && taille ? { poids: quantite * taille, unite: "unités" } : { poids: null, unite: "unités" };
  if (u !== "KG" && u !== "SAC") return { poids: null, unite: u.toLowerCase() };
  /* L'abattoir compte ses kilos en kilos. */
  if (site === "NDIAR ABATTOIR") return u === "KG" ? { poids: quantite, unite: "kg" } : { poids: null, unite: "sacs" };
  if (/VRAC|\bMAIS\b|TOURTEAU|SON DE BLE/.test(d)) return { poids: quantite, unite: "kg" };
  const facteur = taille ?? (/RUMINANT|DIOURGUI|BETAIL|VACHE/.test(d) ? 40 : 50);
  const poids = quantite * facteur;
  return poids > CHARGE_MAXIMALE_KG ? { poids: quantite, unite: "kg" } : { poids, unite: "sacs" };
}

/* -- 4. Les bons ------------------------------------------------------------ */

interface Bon {
  numero: string;
  date: string;
  site: string;
  client: string;
  produits: Set<string>;
  quantites: Map<string, number>;
  poids: number;
  pese: boolean;
  lignes: number;
  plaqueSource: string;
  libelle: string;
  colonneTransporteur: string;
  source: string;
}

interface LigneSource {
  numero: string;
  date: string;
  site: string;
  client: string;
  produit: string;
  unite: string;
  quantite: number;
  plaque: string;
  libelle: string;
  transporteur: string;
}

const bons = new Map<string, Bon>();
const ecartes: Record<string, number> = {};
const ecarte = (raison: string) => (ecartes[raison] = (ecartes[raison] ?? 0) + 1);
const plaquesDivergentes: string[] = [];

function ajouter(source: string, enKilos: boolean, l: LigneSource) {
  if (!l.numero) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(l.date)) return ecarte(`${source} : date illisible`);
  if (!l.plaque) return ecarte(`${source} : ligne sans plaque`);
  const deja = bons.get(l.numero);
  if (deja && deja.source !== source) return ecarte(`${source} : bon déjà lu dans ${deja.source}`);
  const bon: Bon = deja ?? { numero: l.numero, date: l.date, site: l.site || "Non précisé", client: l.client, produits: new Set(), quantites: new Map(), poids: 0, pese: false, lignes: 0, plaqueSource: l.plaque, libelle: l.libelle, colonneTransporteur: l.transporteur, source };
  if (deja && normaliser(deja.plaqueSource) !== normaliser(l.plaque)) plaquesDivergentes.push(`${l.numero} : ${deja.plaqueSource} / ${l.plaque}`);
  const p = poidsLigne(enKilos, bon.site, l.unite, l.produit, l.quantite);
  bon.lignes++;
  if (l.produit) bon.produits.add(l.produit);
  if (Number.isFinite(l.quantite) && l.quantite > 0) bon.quantites.set(p.unite, (bon.quantites.get(p.unite) ?? 0) + l.quantite);
  if (p.poids !== null) {
    bon.poids += p.poids;
    bon.pese = true;
  }
  bons.set(l.numero, bon);
}

/** L'en-tête d'une feuille : la ligne qui porte « No livraison », où qu'elle soit. */
function colonnes(lignes: Cellule[][]): { debut: number; col: (nom: string) => number; entete: string[] } {
  const debut = lignes.findIndex((l) => l.map(texte).includes("No livraison"));
  if (debut < 0) throw new Error("en-tête introuvable");
  const entete = lignes[debut]!.map((c) => texte(c).replace(/\s+/g, " "));
  return { debut, entete, col: (nom) => entete.indexOf(nom) };
}

/* L'extraction X3 de 2026. */
{
  const f = lireClasseur(DO + "634. Suivi des Livraisons Usines/EXTRACTION_YLIV 2026 ALL.xlsx")[0]!;
  const { debut, col } = colonnes(f.lignes);
  const c = { bl: col("No livraison"), date: col("Date expédition"), site: col("Nom Site"), client: col("Nom client livré"), produit: col("Désignation 1"), unite: col("Unité vente"), quantite: col("Quantité livrée US"), plaque: col("Mat. Véhicule client"), libelle: col("Nom Chauff client") };
  if (Object.values(c).some((i) => i < 0)) throw new Error(`YLIV : colonne absente ${JSON.stringify(c)}`);
  for (const l of f.lignes.slice(debut + 1)) {
    ajouter("YLIV 2026", false, { numero: texte(l[c.bl]), date: texte(l[c.date]), site: texte(l[c.site]), client: texte(l[c.client]), produit: texte(l[c.produit]), unite: texte(l[c.unite]), quantite: Number(l[c.quantite]), plaque: texte(l[c.plaque]), libelle: texte(l[c.libelle]), transporteur: "" });
  }
}

/* Les extractions X3 de novembre et décembre 2025 : la feuille complète de décembre est « Feuil1 ». */
for (const [source, fichier, feuille] of [
  ["X3 novembre 2025", "Distribution - UAB/2025/LIVRAISON NOVEMBRE 2025.xlsx", "Feuil1"],
  ["X3 décembre 2025", "Distribution - UAB/2025/SITUATION LIVRAISONS DECEMBRE 2025.xlsx", "Feuil1"],
] as const) {
  const f = lireClasseur(DO + fichier).find((x) => x.nom === feuille)!;
  const { debut, col, entete } = colonnes(f.lignes);
  const iClient = col("Client");
  const c = { bl: col("No livraison"), date: col("Date livraison"), produit: col("Désignation"), unite: col("Unité vente"), quantite: col("Quantité livrée"), plaque: col("Mat. Véhicule client"), libelle: col("Nom Chauff client"), transporteur: col("Transporteur"), site: entete.findIndex((x) => x.startsWith("Site exp")) };
  if (Object.values(c).some((i) => i < 0) || iClient < 0) throw new Error(`${source} : colonne absente ${JSON.stringify(c)}`);
  for (const l of f.lignes.slice(debut + 1)) {
    /* Le nom du client suit son code, dans une colonne sans titre. */
    ajouter(source, true, { numero: texte(l[c.bl]), date: texte(l[c.date]), site: texte(l[c.site]) === "212" ? "UAB" : texte(l[c.site]), client: texte(l[iClient + 1]) || texte(l[iClient]), produit: texte(l[c.produit]), unite: texte(l[c.unite]), quantite: Number(l[c.quantite]), plaque: texte(l[c.plaque]), libelle: texte(l[c.libelle]), transporteur: texte(l[c.transporteur]) });
  }
}

/* L'état d'août 2026 de l'UAB. */
{
  const f = lireClasseur(DO + "Distribution - UAB/ETAT LIVRAISONS MENSUELLES AOUT 2026.xlsx").find((x) => x.nom === "LIVRAISONS")!;
  const { debut, col } = colonnes(f.lignes);
  const c = { bl: col("No livraison"), client: col("Raison sociale"), date: col("Date livraison"), produit: col("Désignation"), quantite: col("Quantité livrée"), unite: col("Unité vente"), libelle: col("Nom Chauff client"), plaque: col("Mat. Véhicule client") };
  if (Object.values(c).some((i) => i < 0)) throw new Error(`août : colonne absente ${JSON.stringify(c)}`);
  for (const l of f.lignes.slice(debut + 1)) {
    ajouter("État UAB août 2026", true, { numero: texte(l[c.bl]), date: texte(l[c.date]), site: "UAB", client: texte(l[c.client]), produit: texte(l[c.produit]), unite: texte(l[c.unite]), quantite: Number(l[c.quantite]), plaque: texte(l[c.plaque]), libelle: texte(l[c.libelle]), transporteur: "" });
  }
}

/* -- 5. Le contrôle du poids contre les états mensuels ---------------------- */

const controles: string[] = [];
for (const [mois, fichier] of [
  ["janvier 2026", "Distribution - UAB/2026/Archives/LIVRAISONS MENSUELLES JANVIER 2026.xlsx"],
  ["mai 2026", "Distribution - UAB/2026/Archives/ETAT LIVRAISONS MENSUELLES MAI 2026.xlsx"],
] as const) {
  const f = lireClasseur(DO + fichier).find((x) => x.nom.startsWith("LIVRAISON"))!;
  const { debut, col } = colonnes(f.lignes);
  const [cBl, cQ, cU] = [col("No livraison"), col("Quantité livrée"), col("Unité vente")];
  const etat = new Map<string, number>();
  for (const l of f.lignes.slice(debut + 1)) {
    if (!["KG", "VRA"].includes(texte(l[cU]))) continue;
    etat.set(texte(l[cBl]), (etat.get(texte(l[cBl])) ?? 0) + (Number(l[cQ]) || 0));
  }
  let kgEtat = 0;
  let kgCharge = 0;
  let ecarts = 0;
  let communs = 0;
  for (const [bl, kg] of etat) {
    const b = bons.get(bl);
    if (!b) continue;
    communs++;
    kgEtat += kg;
    kgCharge += b.poids;
    if (Math.abs(b.poids - kg) > Math.max(50, kg * 0.02)) ecarts++;
  }
  controles.push(`${mois} : ${communs} bons communs, ${Math.round(kgEtat / 1000)} t à l'état, ${Math.round(kgCharge / 1000)} t chargées (${Math.round((kgCharge / kgEtat) * 1000) / 10} %), ${ecarts} bons à plus de 2 % d'écart`);
}

/* -- 6. Le rattachement ----------------------------------------------------- */

const decompte = { parc: 0, tiers: 0, transporteur: 0, client: 0, inconnu: 0, corrigees: 0, illisibles: 0 };
const libellesSansTransporteur = new Map<string, number>();
const desaccords = new Map<string, number>();
const plaquesInconnues = new Map<string, { bons: number; kg: number; libelles: Set<string> }>();

interface Ligne {
  bon: Bon;
  plaque: string | null;
  plaqueSource: string | null;
  lecture: Lecture;
  poids: number | null;
}

const lignes: Ligne[] = [...bons.values()]
  .sort((a, b) => a.date.localeCompare(b.date) || a.numero.localeCompare(b.numero))
  .map((bon) => {
    let plaque: string | null = normaliser(bon.plaqueSource);
    let plaqueSource: string | null = null;
    const correction = CORRECTIONS[plaque];
    if (correction) {
      plaqueSource = bon.plaqueSource;
      plaque = correction.plaque;
      decompte.corrigees++;
    }
    if (!PLAQUE.test(plaque)) {
      plaqueSource = bon.plaqueSource;
      plaque = null;
      decompte.illisibles++;
    }
    const lecture = lireLibelle(bon.libelle, bon.colonneTransporteur);
    const poids = bon.pese ? bon.poids : null;
    if (plaque && parc.has(plaque)) decompte.parc++;
    else if (plaque && tiers.has(plaque)) {
      decompte.tiers++;
      if (lecture.prestataire && lecture.prestataire !== tiers.get(plaque)) {
        const k = `${plaque} (camion de ${tiers.get(plaque)}) écrit « ${lecture.transporteur} » (${lecture.prestataire})`;
        desaccords.set(k, (desaccords.get(k) ?? 0) + 1);
      }
    } else {
      decompte[lecture.mode]++;
      if (lecture.mode === "inconnu") libellesSansTransporteur.set(sansAccents(bon.libelle), (libellesSansTransporteur.get(sansAccents(bon.libelle)) ?? 0) + 1);
      if (plaque && lecture.mode !== "client") {
        const x = plaquesInconnues.get(plaque) ?? { bons: 0, kg: 0, libelles: new Set<string>() };
        x.bons++;
        x.kg += poids ?? 0;
        x.libelles.add(sansAccents(bon.libelle));
        plaquesInconnues.set(plaque, x);
      }
    }
    return { bon, plaque, plaqueSource, lecture, poids };
  });

/* -- 7. Les fichiers -------------------------------------------------------- */

const dossier = join(projet, "supabase/livraison-parties");
rmSync(dossier, { recursive: true, force: true });
mkdirSync(dossier, { recursive: true });

const sql = (v: string | null) => (v === null || v === "" ? "null" : `'${echappe(v)}'`);
const tronque = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const valeurs = (x: Ligne) => {
  const q = JSON.stringify(Object.fromEntries([...x.bon.quantites].map(([u, n]) => [u, Math.round(n * 1000) / 1000])));
  return `  (${sql(x.bon.numero)}, '${x.bon.date}', ${sql(tronque(x.bon.site, 60))}, ${sql(tronque(x.bon.client, 120))}, ${sql(tronque([...x.bon.produits].join(" · "), 240))}, ${x.poids === null ? "null" : Math.round(x.poids * 10) / 10}, '${echappe(q)}', ${x.bon.lignes}, '${x.lecture.mode}', ${sql(x.lecture.prestataire)}, ${sql(x.plaque)}, ${sql(x.plaqueSource)}, ${sql(x.lecture.transporteur)}, ${sql(x.lecture.chauffeur)}, ${sql(x.bon.source)})`;
};

const PAQUET = 3000;
const parties = Math.ceil(lignes.length / PAQUET);
for (let p = 0; p < parties; p++) {
  const paquet = lignes.slice(p * PAQUET, (p + 1) * PAQUET);
  const tonnes = paquet.reduce((s, x) => s + (x.poids ?? 0), 0) / 1000;
  writeFileSync(
    join(dossier, `livraisons-${String(p + 1).padStart(2, "0")}.sql`),
    `-- ============================================================================
-- SEDIMA Parc — les livraisons réelles, partie ${p + 1} sur ${parties}.
--
-- **Ce n'est pas une migration.** Chargement tiré des extractions Sage X3 des
-- livraisons (dossier DO, 63. Logistique Usines). Voir docs/LIVRAISONS-REELLES.md.
--
-- ${paquet.length} bons, ${Math.round(tonnes)} t pesées, du ${paquet[0]!.bon.date} au ${paquet.at(-1)!.bon.date}.
--
-- Le rattachement se fait ici, par la plaque : un véhicule du parc, sinon un
-- camion tiers et son transporteur ; le libellé du bon ne vaut qu'à défaut.
--
-- REJOUABLE : \`on conflict do nothing\`. À jouer après la migration 0044.
-- ============================================================================

insert into livraison (numero, date, site, client, produits, poids_kg, quantites, lignes, mode, vehicule_id, camion_tiers_immatriculation, prestataire_id, immatriculation, immatriculation_source, transporteur_libelle, chauffeur, source)
select v.numero, v.date::date, v.site, v.client, v.produits, v.poids_kg::numeric, v.quantites::jsonb, v.lignes::int,
       case when ve.id is not null then 'parc' when ct.immatriculation is not null then 'transporteur' else v.mode end,
       ve.id,
       ct.immatriculation,
       case when ve.id is null then coalesce(ct.prestataire_id, p.id) end,
       v.immatriculation, v.immatriculation_source, v.transporteur_libelle, v.chauffeur, v.source
  from (values
${paquet.map(valeurs).join(",\n")}
  ) as v(numero, date, site, client, produits, poids_kg, quantites, lignes, mode, prestataire_numero, immatriculation, immatriculation_source, transporteur_libelle, chauffeur, source)
  left join vehicule ve on ve.immatriculation = v.immatriculation
  left join camion_tiers ct on ct.immatriculation = v.immatriculation and ve.id is null
  left join prestataire p on p.numero = v.prestataire_numero
on conflict (numero) do nothing;
`,
  );
}

/* -- 8. Le compte rendu ----------------------------------------------------- */

const tonnes = (f: (x: Ligne) => boolean) => Math.round(lignes.filter(f).reduce((s, x) => s + (x.poids ?? 0), 0) / 1000);
const auParc = (x: Ligne) => !!x.plaque && parc.has(x.plaque);
const auTiers = (x: Ligne) => !!x.plaque && !parc.has(x.plaque) && tiers.has(x.plaque);
console.log(`${lignes.length} bons, du ${lignes[0]!.bon.date} au ${lignes.at(-1)!.bon.date}, en ${parties} fichier(s) ; ${tonnes(() => true)} t pesées, ${lignes.filter((x) => x.poids === null).length} bons sans poids`);
console.log(`référentiel lu : ${parc.size} véhicules du parc, ${tiers.size} camions tiers`);
console.log(`rattachés au parc : ${decompte.parc} bons, ${new Set(lignes.filter(auParc).map((x) => x.plaque)).size} véhicules, ${tonnes(auParc)} t`);
console.log(`rattachés à un camion tiers : ${decompte.tiers} bons, ${new Set(lignes.filter(auTiers).map((x) => x.plaque)).size} camions, ${tonnes(auTiers)} t`);
console.log(`transporteur par le libellé seul : ${decompte.transporteur} ; client lui-même : ${decompte.client} ; inconnu : ${decompte.inconnu}`);
console.log(`plaques corrigées : ${decompte.corrigees} bons ; illisibles : ${decompte.illisibles} ; plaques divergentes dans un même bon : ${plaquesDivergentes.length}`);
console.log("\ncontrôle du poids :");
for (const c of controles) console.log(`  ${c}`);
console.log("\npar mois et par site :");
const parMois = new Map<string, { bons: number; parc: number; tiers: number; t: number }>();
for (const x of lignes) {
  const k = `${x.bon.date.slice(0, 7)} ${x.bon.site}`;
  const e = parMois.get(k) ?? { bons: 0, parc: 0, tiers: 0, t: 0 };
  e.bons++;
  if (auParc(x)) e.parc++;
  else if (auTiers(x)) e.tiers++;
  e.t += (x.poids ?? 0) / 1000;
  parMois.set(k, e);
}
for (const [m, e] of [...parMois].sort()) console.log(`  ${m.padEnd(24)} ${String(e.bons).padStart(5)} bons  ${String(e.parc).padStart(5)} parc  ${String(e.tiers).padStart(5)} tiers  ${String(Math.round(e.t)).padStart(6)} t`);
console.log("\nécartés :", ecartes);
console.log("\nle libellé contredit le propriétaire du camion au référentiel :");
for (const [k, n] of [...desaccords].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${n.toString().padStart(4)}  ${k}`);
console.log("\nplaques hors référentiel, hors enlèvement client (les 20 plus lourdes) :");
for (const [p, x] of [...plaquesInconnues].sort((a, b) => b[1].kg - a[1].kg).slice(0, 20)) console.log(`  ${p.padEnd(10)} ${String(x.bons).padStart(4)} bons ${String(Math.round(x.kg / 1000)).padStart(5)} t  ${[...x.libelles].slice(0, 4).join(" / ")}`);
console.log("\nlibellés sans transporteur reconnu (les 20 plus fréquents) :");
console.log("  " + [...libellesSansTransporteur].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, n]) => `${k || "∅"}=${n}`).join(", "));

/* ============================================================================
 * Fabrique `supabase/grand-livre-2026/` — ce que la comptabilité dit du parc.
 *
 * Source : `RECAP 31082026.xlsx`, dossier DO « 2. Stratégie, Budget, Objectifs /
 * 21. Budget / 212. Budget 2027 / Fichiers de travail ». C'est un extrait du
 * grand livre Sage X3 du 1er janvier au 31 août 2026, plus le tableau des
 * immobilisations « matériel de transport ». Métier, 18 septembre 2026 :
 * « des données utiles jusqu'à fin août 2026, avec le prix d'achat des
 * véhicules, l'amortissement, en plus des coûts de transport, de maintenance ».
 *
 * CE QU'ON EN TIRE.
 *
 *   * **AMORTS** (186 immobilisations) → la valeur d'acquisition, la date
 *     d'acquisition, la durée d'amortissement et la référence d'immobilisation
 *     de chaque véhicule que l'on sait reconnaître. Trois preuves, par ordre
 *     de force : la plaque écrite dans la désignation ; le numéro de châssis ;
 *     un rapprochement relu à la main (`RAPPROCHEMENTS`, plus bas), retenu
 *     seulement quand le modèle est unique au parc ou quand N immobilisations
 *     identiques répondent à N véhicules identiques — auquel cas peu importe
 *     laquelle va à qui, la valeur, la date et la durée sont les mêmes.
 *     Un moteur, une boîte, une caisse frigorifique immobilisés ne sont pas
 *     le prix d'achat du véhicule qui les porte : ils restent dehors.
 *   * **62421 ENT VEHIC** et **60541 FRES VEHIC** (entretien et fournitures
 *     des véhicules) → des `depense`, et pour l'entretien rattaché à un
 *     véhicule, l'`intervention` jumelle — la règle de `charger-maintenance`.
 *   * **CARBURANT SIEGE** → les livraisons de gasoil à la cuve du siège,
 *     dans `mouvement_cuve`, qui était vide.
 *
 * CE QU'ON NE CHARGE PAS DEUX FOIS. Le grand livre et les bons de commande
 * racontent le même achat. Une écriture dont le bon (`BC26010032`) est déjà en
 * base (`CMD2-26010032`) est écartée — 72 bons, aux mêmes montants à quelques
 * francs près. Les écritures des journaux de caisse (CAISP, CAISS) sont des
 * totaux de quinzaine : la caisse parc est déjà chargée dépense par dépense.
 * Un avoir sur un bon de l'exercice se déduit de la facture qu'il corrige ;
 * les avoirs et remboursements sur un bon antérieur (SICAS sur décembre 2025,
 * Bamba Taïf sur BC17320) annulent des écritures que la base ne porte pas, et
 * restent dehors — une dépense négative fausserait les graphiques.
 *
 * CE QU'ON NE CHARGE PAS DU TOUT. **TRANSPORTEURS** est un cumul par
 * transporteur au 31 août, sans date ni pièce : on ne fabrique pas de
 * prestations datées à partir d'un total. Le script le confronte à la base et
 * rend l'écart. La **manutention** (6671) n'est pas une matière du parc.
 *
 * Il lit la base (lecture seule, clé de service, jamais affichée) pour
 * connaître la flotte réelle, les prestataires et les bons déjà chargés ; il
 * n'y écrit rien. Il fabrique du SQL relisable, à jouer dans le SQL Editor.
 *
 * Lancer : npx tsx scripts/charger-grand-livre.mts
 * ==========================================================================*/

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";
import { cleFournisseur } from "./noms-fournisseurs.mts";

const CLASSEUR =
  "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/2. Stratégie, Budget, Objectifs/21. Budget/212. Budget 2027/Fichiers de travail/RECAP 31082026.xlsx";
const projet = process.cwd();

const texte = (c: Cellule | undefined) => (c === null || c === undefined ? "" : String(c).trim());
const nombre = (c: Cellule | undefined): number => {
  const n = typeof c === "number" ? c : Number(texte(c).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const echappe = (s: string) => s.replace(/'/g, "''");
const fr = (n: number) => Math.round(n).toLocaleString("fr-FR");
/** Une date du classeur : déjà ISO si le lecteur l'a reconnue, sinon un numéro de série Excel. */
const dateIso = (c: Cellule | undefined): string | null => {
  const t = texte(c);
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const n = Number(t);
  return Number.isFinite(n) && n > 20000 && n < 80000 ? new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86_400_000).toISOString().slice(0, 10) : null;
};
const couper160 = (s: string) => (s.length > 160 ? `${s.slice(0, 157)}…` : s);

/* -- 1. La base, en lecture seule ------------------------------------------- */

function chargerEnvLocal(): void {
  let contenu: string;
  try {
    contenu = readFileSync(join(projet, ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const ligne of contenu.split(/\r?\n/)) {
    if (ligne.trimStart().startsWith("#")) continue;
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(ligne);
    if (!m) continue;
    const valeur = m[2]!.trim().replace(/^(['"])(.*)\1$/, "$2");
    if (valeur && process.env[m[1]!] === undefined) process.env[m[1]!] = valeur;
  }
}
chargerEnvLocal();
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !cleService) {
  console.error("Il manque l'adresse du projet ou la clé de service dans l'environnement ou `.env.local`.");
  process.exit(2);
}
const pg = createClient(url, cleService, { auth: { persistSession: false, autoRefreshToken: false } });

async function tout<T>(table: string, colonnes: string): Promise<T[]> {
  const lignes: T[] = [];
  for (let i = 0; ; i += 1000) {
    const r = await pg.from(table).select(colonnes).range(i, i + 999);
    if (r.error) throw new Error(`${table} illisible : ${r.error.message}`);
    lignes.push(...(r.data as T[]));
    if (r.data.length < 1000) return lignes;
  }
}

type VehiculeBase = { immatriculation: string; vin: string | null; marque: string; appellation: string; valeur_acquisition: number | null };
const flotte = await tout<VehiculeBase>("vehicule", "immatriculation,vin,marque,appellation,valeur_acquisition");
const parPlaque = new Map(flotte.map((v) => [v.immatriculation, v]));
const parVin = new Map(flotte.filter((v) => v.vin).map((v) => [v.vin!.toUpperCase(), v]));
/** Les quatre à six derniers signes d'une plaque (« 4922BB »), quand ils ne désignent qu'un véhicule : le grand livre écrit « AA4922BB » pour DK 4922 BB. */
const parQueue = new Map<string, string | null>();
for (const v of flotte) {
  const q = /^[A-Z]{2}(\d{3,4}[A-Z]{1,2})$/.exec(v.immatriculation)?.[1];
  if (q) parQueue.set(q, parQueue.has(q) ? null : v.immatriculation);
}

const prestataires = await tout<{ raison_sociale: string }>("prestataire", "raison_sociale");
const clesPrestataires = new Set(prestataires.map((p) => cleFournisseur(p.raison_sociale)));

const bonsEnBase = new Set<string>();
for (const t of ["depense", "intervention"]) {
  for (const d of await tout<{ reference: string | null }>(t, "reference")) {
    const m = /CMD\d?-(\d{5,9})/.exec(d.reference ?? "");
    if (m) bonsEnBase.add(m[1]!);
  }
}

/* -- 2. Les plaques dans un libellé ------------------------------------------ */

const RE_PLAQUE = /(?<![A-Z0-9])(?:([A-Z]{2})[\s-]?(\d{3})[\s-]?([A-Z]{2})|([A-Z]{2})[\s-]?(\d{4})[\s-]?([A-Z]{1,2}))(?![A-Z0-9])/g;

/** Les plaques que le grand livre écrit de travers, et que rien ne redresse seul. Relues le 18 septembre 2026. */
const PLAQUES_CORRIGEES: [RegExp, string][] = [
  [/\bAA106EN\b/g, "AA106NE"], // le Coaster du personnel, lettres interverties
  [/\bAA09VA\b/g, "AA093VA"], // Tata LPT1618 des abattoirs, un chiffre sauté
  [/\bDK9649\b(?!\s?BG)/g, "DK9649BG"], // Kia Sorento, série oubliée
];

/** Les véhicules du parc qu'un libellé nomme, dans l'ordre où il les nomme. */
function plaquesDe(libelle: string): { plaques: string[]; redressees: string[] } {
  /* « VEHAA898PZ » : le mot collé à la plaque la cache ; on le décolle. */
  let t = libelle.toUpperCase().replace(/VEH(?:ICULE)?S?(?=[A-Z]{2}\s?\d{3})/g, "VEH ");
  for (const [faux, juste] of PLAQUES_CORRIGEES) t = t.replace(faux, juste);
  const plaques: string[] = [];
  const redressees: string[] = [];
  for (const m of t.matchAll(RE_PLAQUE)) {
    const lue = m[1] ? `${m[1]}${m[2]}${m[3]}` : `${m[4]}${m[5]}${m[6]}`;
    let plaque: string | null = parPlaque.has(lue) ? lue : null;
    if (!plaque) {
      const q = parQueue.get(lue.slice(2));
      if (q) {
        plaque = q;
        redressees.push(`${lue} → ${q}`);
      }
    }
    if (plaque && !plaques.includes(plaque)) plaques.push(plaque);
  }
  return { plaques, redressees };
}

/* -- 3. Le classeur ---------------------------------------------------------- */

const feuilles = lireClasseur(CLASSEUR);
const feuille = (nom: string) => {
  const f = feuilles.find((x) => x.nom.trim() === nom);
  if (!f) throw new Error(`feuille « ${nom} » introuvable`);
  return f.lignes;
};

/* -- 4. Les immobilisations -------------------------------------------------- */

/**
 * Les rapprochements relus à la main, le 18 septembre 2026 : l'immobilisation
 * ne porte pas de plaque, mais le parc n'a qu'un candidat — ou autant de
 * candidats identiques que d'immobilisations identiques. La preuve est écrite
 * à côté, et passe dans le SQL.
 */
const RAPPROCHEMENTS: Record<string, { plaques: string[]; preuve: string }> = {
  "IMM-201-01213": { plaques: ["DK6067AM"], preuve: "Toyota Hilux acquis le 30/09/2011 ; mise en circulation le 06/10/2011" },
  "IMM-201-01214": { plaques: ["DK5241AN"], preuve: "Toyota Hilux CFAO acquis le 23/04/2012 ; mise en circulation le même jour" },
  "IMM-201-01217": { plaques: ["DK5077AS"], preuve: "Kia Sorento acquis le 30/09/2013 ; Kia KU814D mis en circulation le 01/10/2013" },
  "IMM-201-01218": { plaques: ["DK6153AS"], preuve: "deux Citroën identiques acquises le 15/10/2013, deux mises en circulation ce jour-là" },
  "IMM-201-01219": { plaques: ["DK6154AS"], preuve: "deux Citroën identiques acquises le 15/10/2013, deux mises en circulation ce jour-là" },
  "IMM-201-01221": { plaques: ["AB741AP"], preuve: "Kia Sorento acquis le 10/12/2014 ; mise en circulation le même jour" },
  "IMM-201-01222": { plaques: ["AA139HP"], preuve: "seul Range Rover du parc ; mise en circulation le 29/01/2015" },
  "IMM-201-01224": { plaques: ["AA301PT"], preuve: "bus Toyota Coaster acquis le 24/02/2015 ; Toyota HZB50L mis en circulation le 13/02/2015" },
  "IMM-201-01233": { plaques: ["DK9181BB"], preuve: "seule Chrysler du parc" },
  "IMM-201-01227": { plaques: ["AA226SX"], preuve: "Tata 10 T acquis le 31/05/2016 ; Tata fourgon 10 T mis en circulation le 01/06/2016" },
  "IMM-201-01229": { plaques: ["AB098JC"], preuve: "deux L200 identiques acquis le 31/05/2016, deux mis en circulation le 20/05/2016" },
  "IMM-201-01230": { plaques: ["DK1307BB"], preuve: "deux L200 identiques acquis le 31/05/2016, deux mis en circulation le 20/05/2016" },
  "IMM-201-01319": { plaques: ["DK4922BB", "DK4923BB"], preuve: "« 2 Renault Duster » : les deux seuls Duster du parc, valeur partagée par moitié" },
  "IMM-201-01234": { plaques: ["DK2507BD"], preuve: "seul MAN du parc — transport d'œufs" },
  "IMM-201-01235": { plaques: ["DK0082BD"], preuve: "seule Lexus du parc" },
  "IMM-201-01236": { plaques: ["DK2346BD"], preuve: "cinq L200 identiques acquis le 28/02/2017, cinq L200 immatriculés DK 23xx/30xx BD en février-mars 2017" },
  "IMM-201-01237": { plaques: ["DK2347BD"], preuve: "cinq L200 identiques acquis le 28/02/2017, cinq L200 immatriculés DK 23xx/30xx BD en février-mars 2017" },
  "IMM-201-01238": { plaques: ["DK2348BD"], preuve: "cinq L200 identiques acquis le 28/02/2017, cinq L200 immatriculés DK 23xx/30xx BD en février-mars 2017" },
  "IMM-201-01239": { plaques: ["DK3032BD"], preuve: "cinq L200 identiques acquis le 28/02/2017, cinq L200 immatriculés DK 23xx/30xx BD en février-mars 2017" },
  "IMM-201-01240": { plaques: ["DK3033BD"], preuve: "cinq L200 identiques acquis le 28/02/2017, cinq L200 immatriculés DK 23xx/30xx BD en février-mars 2017" },
  "IMM-201-01241": { plaques: ["DK0099BD"], preuve: "Hyundai ix35 Caetano acquis le 19/05/2017 ; seul ix35 sans immobilisation nommée" },
  "IMM-201-01320": { plaques: ["DK4424BF", "DK4517BF"], preuve: "« 2 C-Élysée commercial » acquises le 30/10/2017 ; deux C-Élysée mises en circulation le 16/11/2017, valeur partagée par moitié" },
  "IMM-201-01248": { plaques: ["DK1870BG"], preuve: "seule Hyundai Creta du parc ; mise en circulation le 07/02/2018" },
  "IMM-201-01253": { plaques: ["AA300PT"], preuve: "seul camion Aubineau du parc (40 000 poussins)" },
  "IMM-201-01254": { plaques: ["AA296PT"], preuve: "minibus CFAO acquis le 29/06/2018 ; Toyota Hiace mis en circulation le 13/06/2018" },
  "IMM-201-01257": { plaques: ["DK9839BK"], preuve: "deux L200 identiques acquis le 03/12/2018 ; DK 9839 BK et DK 9840 BK, plaques qui se suivent" },
  "IMM-201-01258": { plaques: ["DK9840BK"], preuve: "deux L200 identiques acquis le 03/12/2018 ; DK 9839 BK et DK 9840 BK, plaques qui se suivent" },
  "IMM-201-01262": { plaques: ["AA053AP"], preuve: "seule citerne vrac CUBAS du parc" },
  "IMM-201-01325": { plaques: ["DK5679BL"], preuve: "deux Citroën identiques acquises le 28/02/2019 ; deux C-Élysée mises en circulation le 13/02/2019" },
  "IMM-201-01326": { plaques: ["DK5680BL"], preuve: "deux Citroën identiques acquises le 28/02/2019 ; deux C-Élysée mises en circulation le 13/02/2019" },
  "IMM-201-01264": { plaques: ["DK9046AT"], preuve: "seul Mitsubishi ASX du parc" },
  "IMM-201-01267": { plaques: ["DK5347BM"], preuve: "Ford acquis le 16/12/2019 ; Ford Ecosport immatriculé le 23/12/2019" },
  "IMM-201-01279": { plaques: ["AA485DR"], preuve: "Mercedes GL acquis le 06/05/2021 ; seul Mercedes GLE du parc immatriculé en 2021" },
  "IMM-201-01280": { plaques: ["AA099DZ"], preuve: "Hyundai Santa Fe Caetano acquis le 21/06/2021 ; mise en circulation le 23/06/2021" },
  "IMM-201-01339": { plaques: ["AA019EA"], preuve: "Berlingo identiques acquis le 06/07/2021 ; AA 019 EA et AA 200 EA mis en circulation fin juin 2021" },
  "IMM-201-01341": { plaques: ["AA200EA"], preuve: "Berlingo identiques acquis le 06/07/2021 ; AA 019 EA et AA 200 EA mis en circulation fin juin 2021" },
  "IMM-201-01342": { plaques: ["AA021EA"], preuve: "C-Élysée acquise le 06/07/2021 ; seule C-Élysée mise en circulation le 28/06/2021" },
  "IMM-201-01349": { plaques: ["AA106NE"], preuve: "bus Toyota du personnel acquis le 26/06/2023 ; Coaster mis en circulation le 21/06/2023" },
  "IMM-201-01360": { plaques: ["AA877YM"], preuve: "deux Suzuki Burgman identiques acquis le 17/04/2025 ; deux motos Suzuki du 21/03/2025" },
  "IMM-201-01361": { plaques: ["AA923YM"], preuve: "deux Suzuki Burgman identiques acquis le 17/04/2025 ; deux motos Suzuki du 21/03/2025" },
  "IMM-201-01364": { plaques: ["AB932EF"], preuve: "seul tracteur FAW du parc ; mise en circulation le 16/10/2025" },
  "IMM-201-01367": { plaques: ["AB716FK"], preuve: "Santa Fe 2021 acquis le 15/12/2025 ; immatriculé le 18/12/2025" },
  "IMM-201-01562": { plaques: ["AB936PT"], preuve: "seule Mercedes GLE 450 du parc" },
  "IMM-201-01564": { plaques: ["AB681HE"], preuve: "camion 7-10 T caisse fermée de la minoterie acquis le 29/01/2026 ; seul camion 10 T neuf de la minoterie, mis en circulation le 27/03/2026" },
  "IMM-201-01573": { plaques: ["AB361JL"], preuve: "camion benne 8×4 Sinotruk acquis le 27/05/2026 ; HOWO ZZ3317 mis en circulation le 05/06/2026" },
};

/** Ce qui s'immobilise sur un véhicule sans être son prix d'achat. */
const COMPOSANT = /\b(MOTEUR|BOITE|CAISSE FRIGO|CAISSES? FRIGO|GROUPE|CARROSSERIE|GERBEUR|CHARIOT|CHARGEUR|CATERPIL+AR|MACHINE)\b/;

interface Acquisition {
  plaque: string;
  reference: string;
  designation: string;
  date: string;
  valeur: number;
  duree: number;
  preuve: string;
}
const acquisitions: Acquisition[] = [];
const immosSansVehicule: string[] = [];
const immosComposants: string[] = [];
const plaquesHorsParc: string[] = [];
let nImmos = 0;
let totalBilan = 0;
let totalDotation = 0;

for (const l of feuille("AMORTS")) {
  const reference = texte(l[0]);
  if (!/^IMMO?-/.test(reference)) continue;
  nImmos++;
  const designation = texte(l[2]).replace(/Â°/g, "°").replace(/Å/g, "Œ");
  const date = dateIso(l[3]);
  const valeur = Math.round(nombre(l[4]));
  const duree = Math.round(nombre(l[9]));
  totalBilan += valeur;
  totalDotation += nombre(l[6]);
  const resume = `${reference} · ${designation} · ${date} · ${fr(valeur)} F`;
  if (!date || valeur <= 0 || duree <= 0) {
    immosSansVehicule.push(`${resume} — date, valeur ou durée illisible`);
    continue;
  }
  if (COMPOSANT.test(designation.toUpperCase())) {
    immosComposants.push(resume);
    continue;
  }
  let plaques: string[] = [];
  let preuve = "";
  const lues = plaquesDe(designation);
  if (lues.plaques.length) {
    plaques = lues.plaques;
    preuve = `plaque écrite dans la désignation${lues.redressees.length ? ` (${lues.redressees.join(", ")})` : ""}`;
  } else {
    const vin = [...designation.toUpperCase().matchAll(/[A-HJ-NPR-Z0-9]{17}/g)].map((m) => parVin.get(m[0])).find(Boolean);
    if (vin) {
      plaques = [vin.immatriculation];
      preuve = "numéro de châssis écrit dans la désignation";
    } else if (RAPPROCHEMENTS[reference]) {
      plaques = RAPPROCHEMENTS[reference]!.plaques.filter((p) => parPlaque.has(p));
      preuve = RAPPROCHEMENTS[reference]!.preuve;
    }
  }
  if (!plaques.length) {
    const citee = designation.toUpperCase().match(/\b[A-Z]{2}[\s-]?\d{3,4}[\s-]?[A-Z]{2}\b/);
    if (citee && !/\d{3}HP/.test(citee[0])) plaquesHorsParc.push(resume);
    else immosSansVehicule.push(resume);
    continue;
  }
  const part = Math.round(valeur / plaques.length);
  for (const plaque of plaques) {
    acquisitions.push({ plaque, reference, designation, date, valeur: part, duree, preuve: plaques.length > 1 ? `${preuve} — ${fr(valeur)} F pour ${plaques.length} véhicules` : preuve });
  }
}

/* Un véhicule n'a qu'un prix d'achat : deux immobilisations pour la même plaque, et l'on n'en retient aucune. */
const conflits: string[] = [];
const parVehicule = new Map<string, Acquisition[]>();
for (const a of acquisitions) parVehicule.set(a.plaque, [...(parVehicule.get(a.plaque) ?? []), a]);
const retenues: Acquisition[] = [];
for (const [plaque, liste] of parVehicule) {
  if (liste.length > 1) conflits.push(`${plaque} : ${liste.map((a) => `${a.reference} (${fr(a.valeur)} F)`).join(" et ")}`);
  else retenues.push(liste[0]!);
}
retenues.sort((a, b) => a.date.localeCompare(b.date) || a.plaque.localeCompare(b.plaque));

/* -- 5. L'entretien et les fournitures --------------------------------------- */

/** Le début d'un libellé, réduit à sa clé → la raison sociale du référentiel (existante, ou à créer). */
const FOURNISSEURS: [prefixe: string, raisonSociale: string, type: string][] = [
  ["TATAINTERNATIONAL", "TATA INTERNATIONAL / UNITECH", "garage"],
  ["GIENDIAYE", "GIE NDIAYE ET FRERES", "pieces"],
  ["SICAS", "SICAS", "pneumatiques"],
  ["SSPI", "SSPI - STE SENEGALAISE DE PRODUITS IND.", "pneumatiques"],
  ["TSA", "TSA - TECHNIQUE SECURITE AUTO", "garage"],
  ["LASA", "LA SENEGALAISE DE L'AUTOMOBILE", "garage"],
  ["LASENEGALAISE", "LA SENEGALAISE DE L'AUTOMOBILE", "garage"],
  ["ABDOUKHADREDIOP", "ABDOU KHADRE DIOP", "transporteur"],
  ["ETSTOUBADAROUSALAM", "ETS TOUBA DAROU SALAM", "pieces"],
  ["ANEC", "ANEC ENERGIE", "garage"],
  ["FOUTAPOIDSLOURD", "FOUTA POIDS LOURDS", "pieces"],
  ["GENERALTRADINGSERVICE", "GENERAL TRADING SERVICES", "pieces"],
  ["GETS", "GENERAL TRADING SERVICES", "pieces"],
  ["FIRSTGARAGE", "FIRST GARAGE SENEGAL", "pieces"],
  ["FIRSTGARARGE", "FIRST GARAGE SENEGAL", "pieces"],
  ["MOUSSASENE", "MOUSSA SENE", "garage"],
  ["CFAO", "CFAO", "garage"],
  ["BAYEMALICKSAMB", "BAYE MALICK SAMB", "pieces"],
  ["SALIKHOUSAMBE", "SALIKHOU SAMBE", "garage"],
  ["STARPNEU", "STAR PNEUS - MATAR GUEYE", "pneumatiques"],
  ["CAETANO", "CAETANO FORMULA SENEGAL", "garage"],
  ["MAMADOUKANE", "MAMADOU KANE", "pieces"],
  ["WAKEURCHEIKHISSADIENE", "WAKEUR CHEIKH ISSA DIENE", "pieces"],
  /* Ceux que le référentiel ne connaît pas encore, et qui reviennent. */
  ["COKIAUTOMOBILE", "COKI AUTOMOBILE", "pieces"],
  ["SOPENABYDIA", "SOPE NABY DIA ET FRERES", "garage"],
  ["DIAETFRERES", "SOPE NABY DIA ET FRERES", "garage"],
  ["DIAFRERES", "SOPE NABY DIA ET FRERES", "garage"],
  ["MBAYEYERI", "MBAYE YERI", "garage"],
  ["CARROSSERIEFALL", "CARROSSERIE FALL ET FRERES", "garage"],
  ["EMGUNIVERSALAUTO", "EMG UNIVERSAL AUTO", "garage"],
];

function fournisseurDe(libelle: string): { nom: string; type: string } | null {
  const k = libelle.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const f = FOURNISSEURS.find(([prefixe]) => k.startsWith(prefixe));
  return f ? { nom: f[1], type: f[2] } : null;
}

/** Le poste, lu dans le libellé ; la feuille donne le défaut. */
function posteDe(libelle: string, feuilleFournitures: boolean): { poste: string; type: "preventif" | "curatif" } {
  const t = libelle.toUpperCase();
  if (/\bPNEUS?\b/.test(t)) return { poste: "pneumatiques", type: "curatif" };
  if (feuilleFournitures) return { poste: "pieces", type: "curatif" };
  if (/\bENTRETIEN AUX\b|\bVIDANGE\b|\bREVISIONS?\b|\d\s?KMS?\b/.test(t)) return { poste: "maintenance-preventive", type: "preventif" };
  if (/\bPIECES?\b|\bBATTERIE|\bMOTEUR (PREMIUM|MAGNUM)|\bBOITE VITESSE\b|\bRADIATEUR\b|\bNOYAU\b|\bPLAQUETTE/.test(t) && !/\bREPARAT|\bCHANGE?R?MENT\b|\bMAIN/.test(t)) return { poste: "pieces", type: "curatif" };
  return { poste: "maintenance-curative", type: "curatif" };
}

interface Ecriture {
  cle: string;
  date: string;
  piece: string;
  libelle: string;
  montant: number;
  plaque: string | null;
  multi: boolean;
  fournisseur: { nom: string; type: string } | null;
  poste: string;
  type: "preventif" | "curatif";
  bon: string | null;
  entretien: boolean;
  avoir?: string;
}
const ecritures: Ecriture[] = [];
const ecartes: Record<string, { n: number; m: number }> = {};
const ecarte = (raison: string, m: number) => {
  ecartes[raison] = { n: (ecartes[raison]?.n ?? 0) + 1, m: (ecartes[raison]?.m ?? 0) + m };
};
const redressements = new Set<string>();
const avoirs: { bon: string; piece: string; montant: number }[] = [];
const avoirsDeduits: string[] = [];
const totauxFeuille: Record<string, number> = {};

/* Une même pièce comptable peut porter des lignes dans les deux comptes : le rang court sur les deux feuilles. */
const rangs = new Map<string, number>();
for (const [nomFeuille, fournitures] of [["62421 ENT VEHIC", false], ["60541 FRES VEHIC", true]] as const) {
  for (const l of feuille(nomFeuille).slice(1)) {
    const date = dateIso(l[0]);
    const piece = texte(l[1]);
    if (!date || !piece) continue;
    const journal = texte(l[4]);
    const libelle = texte(l[5]).replace(/\s+/g, " ");
    const montant = Math.round(nombre(l[6]) - nombre(l[7]));
    totauxFeuille[nomFeuille] = (totauxFeuille[nomFeuille] ?? 0) + montant;
    const rang = (rangs.get(piece) ?? 0) + 1;
    rangs.set(piece, rang);
    if (/^CAIS/.test(journal)) {
      ecarte("journal de caisse — la caisse parc est déjà chargée dépense par dépense", montant);
      continue;
    }
    const bon = /\bBC\s?(\d{5,9})\b/.exec(libelle.toUpperCase())?.[1] ?? null;
    if (montant <= 0) {
      /* Un avoir sur un bon de l'exercice se déduit de la facture qu'il corrige ;
         un avoir ou un remboursement sur un bon antérieur annule une écriture
         que la base ne porte pas, et reste dehors. */
      if (bon && !/^(25|1)/.test(bon)) avoirs.push({ bon, piece, montant });
      else ecarte("avoir ou remboursement sur un exercice antérieur", montant);
      continue;
    }
    if (bon && bonsEnBase.has(bon)) {
      ecarte("bon de commande déjà en base (CMD2-…)", montant);
      continue;
    }
    const { plaques, redressees } = plaquesDe(libelle);
    for (const r of redressees) redressements.add(r);
    const p = posteDe(libelle, fournitures);
    ecritures.push({
      cle: `${piece}-${rang}`,
      date,
      piece,
      libelle,
      montant,
      plaque: plaques[0] ?? null,
      multi: plaques.length > 1,
      fournisseur: fournisseurDe(libelle),
      poste: p.poste,
      type: p.type,
      bon,
      entretien: !fournitures,
    });
  }
}
for (const a of avoirs) {
  const cible = ecritures.filter((e) => e.bon === a.bon && e.montant > -a.montant).sort((x, y) => y.montant - x.montant)[0];
  if (!cible) {
    ecarte("avoir sans facture à corriger dans l'extrait", a.montant);
    continue;
  }
  cible.montant += a.montant;
  cible.avoir = a.piece;
  avoirsDeduits.push(`${a.piece} (${fr(a.montant)} F) déduit de ${cible.piece}`);
}
ecritures.sort((a, b) => a.date.localeCompare(b.date) || a.cle.localeCompare(b.cle));

/* -- 6. La cuve du siège ------------------------------------------------------ */

interface Livraison { date: string; piece: string; litres: number; montant: number; libelle: string; facture: string }
const livraisons: Livraison[] = [];
const cuveIllisibles: string[] = [];
for (const l of feuille("CARBURANT SIEGE").slice(1)) {
  const date = dateIso(l[0]);
  const piece = texte(l[1]);
  if (!date || !piece) continue;
  const libelle = texte(l[5]).replace(/\s+/g, " ");
  const montant = Math.round(nombre(l[6]) - nombre(l[7]));
  const litres = Number(/(\d{3,6})\s?L\b/.exec(libelle.toUpperCase())?.[1] ?? 0);
  if (!litres || montant <= 0) {
    cuveIllisibles.push(`${piece} · ${libelle} · ${fr(montant)} F`);
    continue;
  }
  livraisons.push({ date, piece, litres, montant, libelle, facture: texte(l[8]).replace(/\s+/g, " ") });
}

/* -- 7. Les transporteurs : confrontation, sans chargement -------------------- */

const caGrandLivre = feuille("TRANSPORTEURS")
  .slice(1)
  .map((l) => ({ nom: texte(l[0]), montant: Math.round(nombre(l[1])) }))
  .filter((x) => x.nom && !/^TOTAL/i.test(x.nom) && x.montant > 0);
const prestations2026 = (await pg.from("prestation").select("quantite,prix_unitaire,montant_facture").gte("date", "2026-01-01").lte("date", "2026-08-31").limit(5000)).data ?? [];
const totalPrestationsBase = prestations2026.reduce((s, x) => s + Math.round(x.montant_facture ?? (x.quantite ?? 0) * (x.prix_unitaire ?? 0)), 0);

/* -- 8. Le SQL ---------------------------------------------------------------- */

const dossier = join(projet, "supabase/grand-livre-2026");
rmSync(dossier, { recursive: true, force: true });
mkdirSync(dossier, { recursive: true });

const enTete = (titre: string, precision: string) => `-- ============================================================================
-- SEDIMA Parc — grand livre 2026 : ${titre}.
--
-- **Ce n'est pas une migration.** C'est un chargement de données, tiré de
-- \`RECAP 31082026.xlsx\` (dossier DO, Budget 2027 / Fichiers de travail) :
-- l'extrait du grand livre Sage X3 du 1er janvier au 31 août 2026 et le
-- tableau des immobilisations « matériel de transport ».
-- Fabriqué par \`scripts/charger-grand-livre.mts\` — voir docs/GRAND-LIVRE-2026.md.
--
-- ${precision}
--
-- REJOUABLE. À jouer **dans l'ordre des fichiers**, après la migration 0057.
-- ============================================================================

`;
const vehiculeSql = (plaque: string | null) => (plaque ? `(select id from vehicule where immatriculation = '${plaque}')` : "null");
const prestataireSql = (nom: string | null) =>
  nom ? `(select id from prestataire where upper(regexp_replace(raison_sociale, '[^A-Za-z0-9]', '', 'g')) = '${cleFournisseur(nom)}' limit 1)` : "null";

/* 01 — les fournisseurs que le référentiel ne connaît pas */
const aCreer = new Map<string, { nom: string; type: string }>();
for (const e of ecritures) if (e.fournisseur && !clesPrestataires.has(cleFournisseur(e.fournisseur.nom))) aCreer.set(cleFournisseur(e.fournisseur.nom), e.fournisseur);
if (livraisons.length && !clesPrestataires.has(cleFournisseur("EDK OIL"))) aCreer.set(cleFournisseur("EDK OIL"), { nom: "EDK OIL", type: "carburant" });
const lignesPrestataires = [...aCreer.values()].map(
  (f, i) => `  ('PRE-2026-6${String(i + 1).padStart(4, "0")}', '${echappe(f.nom)}', '${f.type}', true, 'Créé le 18 septembre 2026 depuis le grand livre 2026 (RECAP 31082026).')`,
);
writeFileSync(
  join(dossier, "grand-livre-01-prestataires.sql"),
  enTete("les fournisseurs", `${lignesPrestataires.length} fournisseurs que le grand livre nomme et que le référentiel ne connaissait pas.\n-- Un nom déjà présent (à la graphie près) n'est pas recréé.`) +
    (lignesPrestataires.length
      ? `insert into prestataire (numero, raison_sociale, type, actif, note)\nselect x.numero, x.raison_sociale, x.type::type_prestataire, x.actif, x.note\n  from (values\n${lignesPrestataires.join(",\n")}\n  ) as x (numero, raison_sociale, type, actif, note)\n where not exists (select 1 from prestataire p where upper(regexp_replace(p.raison_sociale, '[^A-Za-z0-9]', '', 'g')) = upper(regexp_replace(x.raison_sociale, '[^A-Za-z0-9]', '', 'g')))\non conflict (numero) do nothing;\n`
      : "-- Rien à créer.\n"),
  "utf8",
);

/* 02 — les acquisitions */
const lignesAcquisitions = retenues.map(
  (a) => `  -- ${a.designation.replace(/\s+/g, " ").slice(0, 70)} · ${a.preuve}\n  ('${a.plaque}', ${a.valeur}, '${a.date}'::date, ${a.duree}, '${echappe(a.reference)}')`,
);
writeFileSync(
  join(dossier, "grand-livre-02-acquisitions.sql"),
  enTete(
    "le prix d'achat des véhicules",
    `${retenues.length} véhicules reçoivent leur valeur d'acquisition, leur date d'acquisition, leur durée\n-- d'amortissement et leur référence d'immobilisation. Chaque ligne dit sa preuve.\n--\n-- LE GARDE-FOU. Une valeur déjà saisie à la main n'est jamais écrasée : la\n-- ligne n'est écrite que si \`valeur_acquisition\` est vide, ou si elle vient\n-- déjà de cette même immobilisation (rejeu).`,
  ) +
    `with source (immatriculation, valeur, date_acquisition, duree, reference) as (values\n${lignesAcquisitions.join(",\n")}\n)\n` +
    `update vehicule v\n   set valeur_acquisition = s.valeur,\n       date_acquisition = s.date_acquisition,\n       duree_amortissement_annees = s.duree,\n       reference_immobilisation = s.reference\n  from source s\n where v.immatriculation = s.immatriculation\n   and (v.valeur_acquisition is null or v.reference_immobilisation = s.reference);\n\n-- Ce que la flotte porte après le passage.\nselect count(*) filter (where valeur_acquisition is not null) as vehicules_valorises,\n       sum(valeur_acquisition) as valeur_totale,\n       count(*) as vehicules\n  from vehicule;\n`,
  "utf8",
);

/* 03 et 04 — les interventions et les dépenses */
const lignesInterventions: string[] = [];
const lignesDepenses: string[] = [];
for (const e of ecritures) {
  const note = `${e.multi ? " · écriture couvrant plusieurs véhicules" : ""}${e.avoir ? ` · avoir ${e.avoir} déduit` : ""}`;
  const reference = `${e.bon ? `CMD2-${e.bon} · ` : ""}${e.piece}${note}`;
  const beneficiaire = e.fournisseur?.nom ?? "Fournisseurs divers";
  if (e.entretien && e.plaque) {
    lignesInterventions.push(
      `  ('INT-GL-${e.cle}', ${vehiculeSql(e.plaque)}, ${prestataireSql(e.fournisseur?.nom ?? null)}, '${e.date}', '${e.type}', '${echappe(couper160(e.libelle))}', ${e.montant}, null, null, '${echappe(reference)}')`,
    );
  }
  lignesDepenses.push(
    `  ('DEP-GL-${e.cle}', ${vehiculeSql(e.plaque)}, ${prestataireSql(e.fournisseur?.nom ?? null)}, '${e.date}', '${e.poste}', '${echappe(couper160(e.libelle))}', ${e.montant}, '${echappe(beneficiaire)}', 'facture', true, '${echappe(reference)}')`,
  );
}
writeFileSync(
  join(dossier, "grand-livre-03-interventions.sql"),
  enTete("les interventions", `${lignesInterventions.length} travaux d'atelier : les écritures d'entretien (compte 62421) rattachées à un véhicule\n-- du parc. La référence porte le bon de commande quand l'écriture le cite, et toujours la pièce comptable.`) +
    `insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference) values\n${lignesInterventions.join(",\n")}\non conflict (numero) do nothing;\n`,
  "utf8",
);
writeFileSync(
  join(dossier, "grand-livre-04-depenses.sql"),
  enTete(
    "les dépenses",
    `${lignesDepenses.length} dépenses : entretien (62421) et fournitures (60541) des véhicules, hors bons déjà\n-- chargés, hors journaux de caisse, hors remboursements. Une écriture sans véhicule reconnu reste\n-- une dépense du parc, au nom de son fournisseur.`,
  ) +
    `insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, origine, justificatif, reference) values\n${lignesDepenses.join(",\n")}\non conflict (numero) do nothing;\n`,
  "utf8",
);

/* 05 — la cuve */
const lignesCuve = livraisons.map(
  (x) =>
    `  ('CUV-GL-${x.piece}', '${x.date}', 'livraison', '${echappe(couper160(x.libelle))}', ${x.litres}, ${Math.round(x.montant / x.litres)}, ${x.montant}, 'EDK OIL', ${prestataireSql("EDK OIL")}, '${echappe(x.piece)}', '${echappe(x.facture)}', 'Grand livre 2026')`,
);
writeFileSync(
  join(dossier, "grand-livre-05-cuve.sql"),
  enTete("les livraisons de gasoil à la cuve du siège", `${livraisons.length} livraisons EDK OIL, ${fr(livraisons.reduce((s, x) => s + x.litres, 0))} litres, ${fr(livraisons.reduce((s, x) => s + x.montant, 0))} F. Les litres\n-- sont lus dans le libellé (« 7000L GASOIL ») ; le prix du litre est le montant divisé par les litres.`) +
    `insert into mouvement_cuve (numero, date, sens, libelle, litres, prix_litre, montant, fournisseur, prestataire_id, piece, commentaire, enregistre_par) values\n${lignesCuve.join(",\n")}\non conflict (numero) do nothing;\n`,
  "utf8",
);

/* -- 9. Le rapport ------------------------------------------------------------ */

const somme = (xs: { montant: number }[]) => xs.reduce((s, x) => s + x.montant, 0);
const rapport: string[] = [];
const dire = (s = "") => {
  rapport.push(s);
  console.log(s);
};
dire(`IMMOBILISATIONS — ${nImmos} lignes, ${fr(totalBilan)} F au bilan, dotation janvier-août ${fr(totalDotation)} F`);
dire(`  ${retenues.length} véhicules valorisés, ${fr(retenues.reduce((s, a) => s + a.valeur, 0))} F`);
dire(`    dont par la plaque ou le châssis : ${retenues.filter((a) => /^(plaque|numéro)/.test(a.preuve)).length} ; par rapprochement relu : ${retenues.filter((a) => !/^(plaque|numéro)/.test(a.preuve)).length}`);
dire(`  ${immosComposants.length} composants ou engins (moteur, boîte, caisse frigo, chariot…), laissés dehors`);
dire(`  ${plaquesHorsParc.length} immobilisations dont la plaque n'est pas dans la flotte :`);
for (const x of plaquesHorsParc) dire(`    ${x}`);
if (conflits.length) {
  dire(`  ${conflits.length} véhicules à deux immobilisations, non valorisés :`);
  for (const x of conflits) dire(`    ${x}`);
}
dire(`  ${immosSansVehicule.length} immobilisations sans véhicule reconnu (liste dans docs/GRAND-LIVRE-2026.md)`);
dire();
for (const [f, t] of Object.entries(totauxFeuille)) dire(`${f} — ${fr(t)} F au grand livre`);
dire(`  ${ecritures.length} écritures retenues, ${fr(somme(ecritures))} F — ${lignesInterventions.length} interventions, ${lignesDepenses.length} dépenses`);
dire(`    avec véhicule : ${ecritures.filter((e) => e.plaque).length} (${fr(somme(ecritures.filter((e) => e.plaque)))} F) ; sans : ${ecritures.filter((e) => !e.plaque).length} (${fr(somme(ecritures.filter((e) => !e.plaque)))} F)`);
const parPoste: Record<string, { n: number; m: number }> = {};
for (const e of ecritures) parPoste[e.poste] = { n: (parPoste[e.poste]?.n ?? 0) + 1, m: (parPoste[e.poste]?.m ?? 0) + e.montant };
for (const [p, v] of Object.entries(parPoste).sort((a, b) => b[1].m - a[1].m)) dire(`    ${p.padEnd(24)} ${String(v.n).padStart(4)}  ${fr(v.m).padStart(12)} F`);
dire(`  écartées :`);
for (const [r, v] of Object.entries(ecartes).sort((a, b) => b[1].n - a[1].n)) dire(`    ${String(v.n).padStart(4)} × ${r} — ${fr(v.m)} F`);
if (avoirsDeduits.length) dire(`  avoirs déduits : ${avoirsDeduits.join(" ; ")}`);
if (redressements.size) dire(`  plaques redressées : ${[...redressements].join(" ; ")}`);
dire(`  ${lignesPrestataires.length} fournisseurs créés : ${[...aCreer.values()].map((f) => f.nom).join(", ")}`);
dire();
dire(`CUVE — ${livraisons.length} livraisons, ${fr(livraisons.reduce((s, x) => s + x.litres, 0))} L, ${fr(somme(livraisons))} F${cuveIllisibles.length ? ` ; ${cuveIllisibles.length} illisibles` : ""}`);
dire();
dire(`TRANSPORTEURS (non chargé) — grand livre : ${fr(somme(caGrandLivre))} F sur ${caGrandLivre.length} transporteurs ; prestations 2026 en base : ${fr(totalPrestationsBase)} F`);

writeFileSync(join(dossier, "rapport.txt"), [...rapport, "", "IMMOBILISATIONS SANS VÉHICULE RECONNU", ...immosSansVehicule, "", "COMPOSANTS ET ENGINS", ...immosComposants, "", "VÉHICULES VALORISÉS", ...retenues.map((a) => `${a.plaque} · ${a.reference} · ${a.date} · ${fr(a.valeur)} F · ${a.duree} ans · ${a.preuve}`), "", "CA TRANSPORTEURS AU 31/08/2026 (grand livre)", ...caGrandLivre.map((x) => `${x.nom} · ${fr(x.montant)} F`)].join("\n"), "utf8");
console.log(`\nsupabase/grand-livre-2026/ — 5 fichiers SQL et rapport.txt`);

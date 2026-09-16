/* ============================================================================
 * Pose sur chaque véhicule la police d'assurance 2026, depuis la fiche de
 * renouvellement.
 *
 * « BOCAR/M.SECK/FICHE RENOUVELLEMENT ASSURANCES 2026.xlsx » — deux feuilles
 * (SEDIMA SA, SEDIMA Abattoirs), « Du 1er janvier 2026 » : une ligne par
 * véhicule assuré, sa plaque, sa marque, ses valeurs neuve et vénale, et une
 * croix « tous risques ». La prime par véhicule n'est pas remplie. C'est la
 * liste de ce que la police collective couvre cette année (relevé du
 * 16 septembre 2026).
 *
 * CE QU'ON ÉCRIT. Un `document` de type « assurance » par véhicule de la
 * liste qui n'en a pas encore pour 2026 : effet au 1er janvier, échéance au
 * 31 décembre, émetteur AXA Sénégal — celui des attestations déposées. Le
 * numéro « DOC-2026-P… » dit son origine ; la feuille, la formule et la
 * valeur vénale restent au compte rendu — la ligne n'a pas de commentaire. Sans pièce : les
 * attestations individuelles se déposent par `attacher-assurances.mts` quand
 * elles arrivent, et complètent alors cette ligne. Sans montant : la prime
 * n'est pas sur la fiche.
 *
 * CE QU'ON NE TOUCHE PAS. Un véhicule qui a déjà une ligne d'assurance
 * couvrant 2026 la garde — même sans pièce. Une plaque hors référentiel est
 * dite et passée. Un véhicule sorti ou archivé est passé.
 *
 * IL N'ÉCRIT RIEN SANS `--appliquer`. Les clés viennent de l'environnement ou
 * de `.env.local`, jamais d'un argument, jamais affichées.
 *
 * Lancer :  npx tsx scripts/charger-assurances-2026.mts              (à blanc)
 *           npx tsx scripts/charger-assurances-2026.mts --appliquer  (écrit)
 * ==========================================================================*/

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { lireClasseur } from "./lire-xlsx.mts";

const CLASSEUR = "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/61. Gestion Parc/BOCAR/M.SECK/FICHE RENOUVELLEMENT ASSURANCES 2026.xlsx";
const APPLIQUER = process.argv.includes("--appliquer");
const EFFET = "2026-01-01";
const ECHEANCE = "2026-12-31";
const EMETTEUR = "AXA Sénégal";

function chargerEnvLocal(): void {
  let texte: string;
  try {
    texte = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const ligne of texte.split(/\r?\n/)) {
    if (ligne.trimStart().startsWith("#")) continue;
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(ligne);
    if (!m) continue;
    const valeur = m[2]!.trim().replace(/^(['"])(.*)\1$/, "$2");
    if (valeur && process.env[m[1]!] === undefined) process.env[m[1]!] = valeur;
  }
}

chargerEnvLocal();
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !cle) {
  console.error("Il manque l'adresse du projet ou la clé de service dans l'environnement ou `.env.local`.");
  process.exit(2);
}
const pg = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });

function plaqueDe(s: string): string | null {
  const m = /(AA|AB|DK|DL|TH)\s?-?\s?(\d{3,4})\s?-?\s?([A-Z]{1,2})\b/i.exec(s);
  return m ? `${m[1]}${m[2]}${m[3]}`.toUpperCase() : null;
}

interface LigneFiche {
  plaque: string;
  feuille: string;
  marque: string;
  type: string;
  valeurVenale: number | null;
  tousRisques: boolean;
}

const lignes: LigneFiche[] = [];
for (const feuille of lireClasseur(CLASSEUR)) {
  const nomFeuille = /ABATTOIR/i.test(feuille.nom) ? "SEDIMA Abattoirs" : "SEDIMA SA";
  for (const l of feuille.lignes) {
    const plaque = plaqueDe(String(l[3] ?? ""));
    if (!plaque) continue;
    const venale = Number(String(l[9] ?? "").replace(/\s/g, ""));
    lignes.push({ plaque, feuille: nomFeuille, marque: String(l[1] ?? "").trim(), type: String(l[2] ?? "").trim(), valeurVenale: Number.isFinite(venale) && venale > 0 ? venale : null, tousRisques: String(l[17] ?? "").trim().toLowerCase() === "x" });
  }
}
console.log(`${lignes.length} véhicule(s) sur la fiche de renouvellement 2026${APPLIQUER ? "" : " — essai à blanc, rien ne sera écrit"}\n`);

const vehicules = await pg.from("vehicule").select("id, immatriculation, statut, archive_le").limit(2000).returns<{ id: string; immatriculation: string; statut: string; archive_le: string | null }[]>();
if (vehicules.error) {
  console.error(`Véhicules illisibles : ${vehicules.error.message}`);
  process.exit(1);
}
const parPlaque = new Map(vehicules.data.map((v) => [v.immatriculation, v]));
const existants = await pg.from("document").select("numero, vehicule_id, date_effet, echeance, fichier").eq("type_document_id", "assurance").limit(2000).returns<{ numero: string; vehicule_id: string; date_effet: string | null; echeance: string | null; fichier: string | null }[]>();
if (existants.error) {
  console.error(`Documents illisibles : ${existants.error.message}`);
  process.exit(1);
}
const couverts = new Set(existants.data.filter((d) => d.echeance && d.echeance >= "2026-06-30" && (!d.date_effet || d.date_effet <= "2026-12-31")).map((d) => d.vehicule_id));

let crees = 0;
let deja = 0;
const horsReferentiel: string[] = [];
const horsParc: string[] = [];
const vus = new Set<string>();
for (const l of lignes) {
  if (vus.has(l.plaque)) continue;
  vus.add(l.plaque);
  const v = parPlaque.get(l.plaque);
  if (!v) {
    horsReferentiel.push(`${l.plaque} (${l.marque} ${l.type}, ${l.feuille})`);
    continue;
  }
  if (v.statut === "sorti" || v.archive_le) {
    horsParc.push(l.plaque);
    continue;
  }
  if (couverts.has(v.id)) {
    deja++;
    continue;
  }
  console.log(`  ${l.plaque.padEnd(8)} ${l.feuille.padEnd(17)} ${l.tousRisques ? "tous risques" : "RC          "}  ${l.marque} ${l.type}`);
  if (!APPLIQUER) {
    crees++;
    continue;
  }
  const numero = `DOC-2026-P${String(crees + 1).padStart(4, "0")}-${l.plaque}`;
  const ins = await pg.from("document").insert({ numero, type_document_id: "assurance", vehicule_id: v.id, date_effet: EFFET, echeance: ECHEANCE, emetteur: EMETTEUR, justificatif: false });
  if (ins.error) {
    console.error(`    ${l.plaque} : ligne non créée (${ins.error.message})`);
    continue;
  }
  crees++;
}

console.log();
console.log(`${APPLIQUER ? "Créées" : "À créer"} : ${crees} · déjà couvertes en 2026 : ${deja} · sorties ou archivées : ${horsParc.length}`);
if (horsReferentiel.length) console.log(`${horsReferentiel.length} plaque(s) hors référentiel :\n  ${horsReferentiel.join("\n  ")}`);

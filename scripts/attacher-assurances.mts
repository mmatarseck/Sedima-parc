/* ============================================================================
 * Attache à chaque véhicule son attestation ou sa carte brune d'assurance.
 *
 * Demande du métier du 16 septembre 2026 : « déposer aussi les factures et
 * autres par véhicule ; pour des fichiers qui concernent plusieurs véhicules,
 * diviser pour donner à chaque véhicule sa pièce, même s'il faut la répéter ».
 *
 * CE QUE LE DISQUE PORTE. Dans « MALICK/Admnistrative », des PDF nommés par
 * plaque — « ASSURANCE AB 551 HS.pdf », « carte-brune-AA 783 BN.pdf » — et
 * quatre PDF de police collective, sans plaque dans le nom. Aucune facture de
 * garage scannée nulle part : les dossiers CAISSE et CARBURANT sont des
 * registres Excel, déjà chargés en dépenses.
 *
 * COMMENT. Une pièce par plaque devient un document d'assurance sur le
 * véhicule : la ligne vide qui l'attendait est complétée si elle existe, une
 * ligne est créée sinon. Une pièce collective est répétée sur chaque plaque
 * que `PARTAGES` lui donne — c'est le métier qui dit lesquelles, ce script ne
 * lit pas l'intérieur des PDF. Une plaque absente du référentiel est dite et
 * passée ; un véhicule qui a déjà sa pièce est laissé tel quel.
 *
 * IL N'ÉCRIT RIEN SANS `--deposer`. À blanc, il dit exactement ce qu'il
 * ferait, pièce par pièce. Les clés viennent de l'environnement ou de
 * `.env.local`, jamais d'un argument, jamais du code, jamais affichées.
 *
 * Lancer :  npx tsx scripts/attacher-assurances.mts            (à blanc)
 *           npx tsx scripts/attacher-assurances.mts --deposer  (dépose)
 * ==========================================================================*/

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const DOSSIER = "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/61. Gestion Parc/MALICK/Admnistrative";
/** Ce que le seau « pieces » accepte (0014, élargi au PDF par 0049). */
const PLAFOND = 5 * 1024 * 1024;
const DEPOSER = process.argv.includes("--deposer");

/**
 * Les pièces collectives, et les plaques qu'elles couvrent. Vide tant que le
 * métier ne l'a pas dit : ce script ne devine pas ce qu'un PDF contient.
 * Exemple : "ASSURANCE 2026/SEDIMA Incp 03 TOYOTA 2026.pdf": ["AB123CD", "AB124CD"]
 */
const PARTAGES: Record<string, string[]> = {};

/* Une seule année de police compte : la courante. Les attestations 2024 se
   listent pour mémoire, elles ne se déposent pas — elles diraient au dossier
   qu'un véhicule est assuré par une police échue. */
const ANNEE_DEPOSEE = "ASSURANCE 2026";

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

/** La plaque lue dans un nom de fichier, canonique : « carte-brune-AB 551 HS.pdf » → « AB551HS ». */
function plaqueDuNom(nom: string): string | null {
  const m = /(AA|AB|DK|DL)[ -]?(\d{3,4})[ -]?([A-Z]{1,2})\b/i.exec(nom);
  return m ? `${m[1]}${m[2]}${m[3]}`.toUpperCase() : null;
}

function marcher(dossier: string, prefixe = ""): string[] {
  const resultat: string[] = [];
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const relatif = prefixe ? `${prefixe}/${e.name}` : e.name;
    if (e.isDirectory()) resultat.push(...marcher(join(dossier, e.name), relatif));
    else if (/\.pdf$/i.test(e.name)) resultat.push(relatif);
  }
  return resultat.sort();
}

interface Piece {
  fichier: string;
  plaques: string[];
  nature: "attestation" | "carte-brune" | "police";
}

const pieces: Piece[] = [];
const memoire: string[] = [];
for (const f of marcher(DOSSIER)) {
  const plaque = plaqueDuNom(f);
  const nature: Piece["nature"] = /carte[ -]?brune/i.test(f) ? "carte-brune" : /assurance|attestation/i.test(f) ? "attestation" : "police";
  if (!f.startsWith(`${ANNEE_DEPOSEE}/`)) {
    if (plaque || /assurance/i.test(f)) memoire.push(f);
    continue;
  }
  if (plaque) pieces.push({ fichier: f, plaques: [plaque], nature });
  else if (PARTAGES[f]?.length) pieces.push({ fichier: f, plaques: PARTAGES[f]!, nature: "police" });
  else memoire.push(`${f}  (collective, aucune plaque donnée dans PARTAGES)`);
}

console.log(`${pieces.length} pièce(s) d'assurance ${ANNEE_DEPOSEE} au dossier${DEPOSER ? "" : " — essai à blanc, rien ne sera déposé"}\n`);
if (memoire.length) {
  console.log("Laissées de côté :");
  for (const m of memoire) console.log(`  ${m}`);
  console.log();
}

const vehicules = await pg.from("vehicule").select("id, immatriculation").limit(2000).returns<{ id: string; immatriculation: string }[]>();
if (vehicules.error) {
  console.error(`Véhicules illisibles : ${vehicules.error.message}`);
  process.exit(1);
}
const idParPlaque = new Map(vehicules.data.map((v) => [v.immatriculation, v.id]));
const jour = new Date().toISOString().slice(0, 10);
const utilisateur = null;

let deposees = 0;
let completees = 0;
let creees = 0;
const horsReferentiel = new Set<string>();
const dejaLa: string[] = [];
const tropLourdes: string[] = [];

for (const p of pieces) {
  const chemin = join(DOSSIER, p.fichier);
  const poids = statSync(chemin).size;
  for (const plaque of p.plaques) {
    const vehiculeId = idParPlaque.get(plaque);
    if (!vehiculeId) {
      horsReferentiel.add(plaque);
      continue;
    }
    /* Une carte brune et une attestation sont deux pièces : chacune sa ligne. */
    const existants = await pg.from("document").select("numero, fichier, numero_piece, emetteur").eq("vehicule_id", vehiculeId).eq("type_document_id", "assurance").limit(20).returns<{ numero: string; fichier: string | null; numero_piece: string | null; emetteur: string | null }[]>();
    if (existants.error) {
      console.error(`  ${plaque} : documents illisibles (${existants.error.message})`);
      continue;
    }
    const cible = p.nature === "carte-brune" ? `${plaque}-carte-brune` : plaque;
    const dejaAttachee = existants.data.some((d) => d.fichier && d.fichier.includes(cible.toLowerCase()));
    if (dejaAttachee) {
      dejaLa.push(`${plaque} · ${p.nature}`);
      continue;
    }
    if (poids > PLAFOND) {
      tropLourdes.push(`${p.fichier} : ${Math.round(poids / 1024)} Ko`);
      continue;
    }
    const cheminSeau = `documents/2026/09/${jour}-${cible.toLowerCase()}-assurance.pdf`;
    const vide = existants.data.find((d) => !d.fichier && !d.numero_piece && !d.emetteur);
    const geste = p.nature === "carte-brune" || !vide ? "créer" : "compléter";
    console.log(`  ${plaque.padEnd(8)} ${p.nature.padEnd(12)} ${geste.padEnd(9)} ← ${p.fichier} (${Math.round(poids / 1024)} Ko)`);
    if (!DEPOSER) continue;

    const octets = readFileSync(chemin);
    const depot = await pg.storage.from("pieces").upload(cheminSeau, octets, { contentType: "application/pdf", upsert: false });
    if (depot.error && !/already exists/i.test(depot.error.message)) {
      console.error(`    dépôt refusé : ${depot.error.message}`);
      continue;
    }
    const ref = `pieces/${cheminSeau}`;
    if (geste === "compléter" && vide) {
      const maj = await pg.from("document").update({ fichier: ref, justificatif: true, emetteur: "AXA Sénégal", date_effet: "2026-01-01", echeance: "2026-12-31" }).eq("numero", vide.numero);
      if (maj.error) {
        console.error(`    ligne non complétée : ${maj.error.message}`);
        continue;
      }
      completees++;
    } else {
      const numero = `DOC-2026-A${String(creees + completees + 1).padStart(4, "0")}-${plaque}`;
      const ins = await pg.from("document").insert({ numero, type_document_id: "assurance", vehicule_id: vehiculeId, fichier: ref, justificatif: true, emetteur: "AXA Sénégal", date_effet: "2026-01-01", echeance: "2026-12-31", numero_piece: p.nature === "carte-brune" ? "Carte brune" : null, cree_par: utilisateur });
      if (ins.error) {
        console.error(`    ligne non créée : ${ins.error.message}`);
        continue;
      }
      creees++;
    }
    deposees++;
  }
}

console.log();
if (DEPOSER) console.log(`${deposees} pièce(s) déposée(s) : ${completees} ligne(s) complétée(s), ${creees} créée(s).`);
if (dejaLa.length) console.log(`${dejaLa.length} déjà attachée(s) : ${dejaLa.join(", ")}`);
if (horsReferentiel.size) console.log(`${horsReferentiel.size} plaque(s) hors référentiel : ${[...horsReferentiel].join(", ")}`);
if (tropLourdes.length) console.log(`${tropLourdes.length} trop lourde(s) pour le seau (5 Mo) :\n  ${tropLourdes.join("\n  ")}`);

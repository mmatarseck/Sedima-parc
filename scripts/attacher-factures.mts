/* ============================================================================
 * Attache à chaque dépense le bon de commande ou la facture qui la justifie.
 *
 * Demande du métier du 16 septembre 2026 : « déposer aussi les factures et
 * autres par véhicule — les DA en PDF et les factures sont dans le dossier »,
 * puis, en pointant une ligne de l'atelier : « rattacher le document lié ».
 *
 * CE QUE LE DISQUE PORTE. « 61. Gestion Parc/Maintenance/BON DE COMMANDES »,
 * 1 026 PDF nommés par leur numéro — « BC15665 FIRST GARAGE AA 485 DR.pdf »,
 * « BONCDE2 - 2026-08 SSPI CMD2-26080069.pdf ». Le dossier « Factures » voisin
 * porte les mêmes fichiers.
 *
 * LA CLÉ, ET ELLE EST CERTAINE. Les dépenses chargées depuis les bons de
 * commande portent ce numéro en référence — « BC15665 », « CMD2-26080069 ». Le
 * même numéro dans le nom du PDF désigne la même pièce : la ligne reçoit son
 * fichier. SUR LA DÉPENSE SEULEMENT : le métier l'a demandé ainsi le
 * 16 septembre au soir — « les factures dans chaque ligne de dépense
 * équivalente » —, et l'intervention née du même bon n'en porte pas de copie.
 * Une dépense de caisse, elle, cite un récapitulatif Excel et une ligne : son
 * justificatif est un reçu papier, il n'est pas sur le disque — il se
 * photographie depuis la ligne, dans l'application.
 *
 * Un PDF qui nomme plusieurs numéros va à chaque ligne ; une ligne qui a déjà
 * son fichier est laissée telle quelle ; un PDF sans numéro connu est listé,
 * pas deviné.
 *
 * IL N'ÉCRIT RIEN SANS `--deposer`. Les clés viennent de l'environnement ou de
 * `.env.local`, jamais d'un argument, jamais affichées.
 *
 * Lancer :  npx tsx scripts/attacher-factures.mts            (à blanc)
 *           npx tsx scripts/attacher-factures.mts --deposer  (dépose)
 * ==========================================================================*/

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const DOSSIER = "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/61. Gestion Parc/Maintenance/BON DE COMMANDES";
const PLAFOND = 5 * 1024 * 1024;
const DEPOSER = process.argv.includes("--deposer");

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

/** Les numéros de pièce qu'un texte porte : « BC15665 », « CMD2-26080069 » — canoniques, sans espace ni tiret entre lettres et chiffres. */
function numerosDe(texte: string): string[] {
  const vus = new Set<string>();
  /* Le numéro peut coller au nom qui suit — « BC12966STAR PNEUS » — : on ne
     demande pas de frontière après les chiffres, seulement qu'ils s'arrêtent. */
  for (const m of texte.toUpperCase().matchAll(/\b(BC)[ _-]?(\d{4,6})(?!\d)/g)) vus.add(`${m[1]}${m[2]}`);
  for (const m of texte.toUpperCase().matchAll(/\b(CMD\d)[ _-]?(\d{6,10})(?!\d)/g)) vus.add(`${m[1]}-${m[2]}`);
  return [...vus];
}

const fichiers = readdirSync(DOSSIER).filter((f) => /\.pdf$/i.test(f)).sort();

const [depenses] = await Promise.all([
  pg.from("depense").select("numero, reference, vehicule_id, photo, libelle").eq("origine", "bon-de-commande").not("reference", "is", null).limit(5000).returns<{ numero: string; reference: string; vehicule_id: string | null; photo: string | null; libelle: string }[]>(),
]);
if (depenses.error) {
  console.error(`Lecture impossible : ${depenses.error.message}`);
  process.exit(1);
}

interface Porteuse {
  table: "depense" | "intervention";
  numero: string;
  colonne: "photo" | "fichier";
  dejaAttache: boolean;
  libelle: string;
}
const porteusesParNumero = new Map<string, Porteuse[]>();
const ranger = (cle: string, p: Porteuse) => {
  const liste = porteusesParNumero.get(cle) ?? [];
  liste.push(p);
  porteusesParNumero.set(cle, liste);
};
for (const d of depenses.data) for (const n of numerosDe(d.reference)) ranger(n, { table: "depense", numero: d.numero, colonne: "photo", dejaAttache: Boolean(d.photo), libelle: d.libelle });

console.log(`${fichiers.length} PDF au dossier · ${depenses.data.length} dépenses de bon de commande référencées en base${DEPOSER ? "" : " — essai à blanc, rien ne sera déposé"}\n`);

let aDeposer = 0;
let deposees = 0;
let dejaLa = 0;
const sansLigne: string[] = [];
const sansNumero: string[] = [];
const tropLourds: string[] = [];
const jour = new Date().toISOString().slice(0, 10);

for (const f of fichiers) {
  const numeros = numerosDe(f);
  if (numeros.length === 0) {
    sansNumero.push(f);
    continue;
  }
  const porteuses = numeros.flatMap((n) => porteusesParNumero.get(n) ?? []);
  if (porteuses.length === 0) {
    sansLigne.push(f);
    continue;
  }
  const poids = statSync(join(DOSSIER, f)).size;
  if (poids > PLAFOND) {
    tropLourds.push(`${f} : ${Math.round(poids / 1024)} Ko`);
    continue;
  }
  for (const p of porteuses) {
    if (p.dejaAttache) {
      dejaLa++;
      continue;
    }
    aDeposer++;
    if (aDeposer <= 12) console.log(`  ${p.numero.padEnd(16)} ${p.table.padEnd(12)} ← ${f}`);
    if (!DEPOSER) continue;
    const cheminSeau = `documents/2026/09/${jour}-${p.numero.toLowerCase()}.pdf`;
    const depot = await pg.storage.from("pieces").upload(cheminSeau, readFileSync(join(DOSSIER, f)), { contentType: "application/pdf", upsert: false });
    if (depot.error && !/already exists/i.test(depot.error.message)) {
      console.error(`    dépôt refusé pour ${p.numero} : ${depot.error.message}`);
      continue;
    }
    const maj = await pg.from(p.table).update({ [p.colonne]: `pieces/${cheminSeau}`, ...(p.table === "depense" ? { justificatif: true } : {}) }).eq("numero", p.numero);
    if (maj.error) {
      console.error(`    ligne ${p.numero} non mise à jour : ${maj.error.message}`);
      continue;
    }
    deposees++;
  }
}

console.log(`${aDeposer > 12 ? `  … et ${aDeposer - 12} autre(s)\n` : ""}`);
console.log(`${aDeposer} pièce(s) à rattacher${DEPOSER ? ` · ${deposees} déposée(s)` : ""} · ${dejaLa} déjà attachée(s)`);
console.log(`${sansLigne.length} PDF dont le numéro n'est sur aucune ligne en base · ${sansNumero.length} PDF sans numéro de pièce dans le nom`);
if (tropLourds.length) console.log(`${tropLourds.length} trop lourd(s) pour le seau :\n  ${tropLourds.join("\n  ")}`);
if (sansLigne.length) console.log(`\nSans ligne, les premiers :\n  ${sansLigne.slice(0, 8).join("\n  ")}`);
if (sansNumero.length) console.log(`\nSans numéro, les premiers :\n  ${sansNumero.slice(0, 8).join("\n  ")}`);

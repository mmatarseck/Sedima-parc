/* ============================================================================
 * Attache à chaque licence de transport le scan qui la porte.
 *
 * Le dossier « MALICK/CARTE GRISE VEHICULES » tient, à côté des cartes grises,
 * vingt scans nommés par plaque — « LICENCE AA 053 AP.pdf », « Licence AA 235
 * MR.pdf », un .docx. Les licences elles-mêmes sont en base depuis
 * `charger-conformite.mts` (0003 : `licence_transport`, et le lien
 * `licence_vehicule`) ; il ne leur manquait que la pièce. Elle se lit ensuite
 * au dossier du véhicule, famille réglementaire (16 septembre 2026).
 *
 * COMMENT. La plaque du nom désigne le véhicule ; ses licences se lisent par le
 * lien ; celle qui reçoit le scan est la première sans pièce, la plus récente
 * d'abord. Un .docx ne porte que des images : ses pages sortent en un PDF, comme
 * pour les cartes grises — le seau ne le prend pas tel quel. Un véhicule sans
 * licence en base est dit et passé.
 *
 * IL N'ÉCRIT RIEN SANS `--deposer`. Les clés viennent de l'environnement ou de
 * `.env.local`, jamais d'un argument, jamais affichées.
 *
 * Lancer :  npx tsx scripts/attacher-licences.mts            (à blanc)
 *           npx tsx scripts/attacher-licences.mts --deposer  (dépose)
 * ==========================================================================*/

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { composerSousPlafond, pages } from "./scans-cartes-grises.mts";

const DOSSIER = "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/61. Gestion Parc/MALICK/CARTE GRISE VEHICULES";
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

function plaqueDuNom(nom: string): string | null {
  const m = /(AA|AB|DK|DL|TH)\s?-?(\d{3,4})\s?-?([A-Z]{1,2})\b/i.exec(nom);
  return m ? `${m[1]}${m[2]}${m[3]}`.toUpperCase() : null;
}

const fichiers = readdirSync(DOSSIER).filter((f) => /^licence/i.test(f));
console.log(`${fichiers.length} scan(s) de licence au dossier${DEPOSER ? "" : " — essai à blanc, rien ne sera déposé"}\n`);

const vehicules = await pg.from("vehicule").select("id, immatriculation").limit(2000).returns<{ id: string; immatriculation: string }[]>();
if (vehicules.error) {
  console.error(`Véhicules illisibles : ${vehicules.error.message}`);
  process.exit(1);
}
const idParPlaque = new Map(vehicules.data.map((v) => [v.immatriculation, v.id]));
const jour = new Date().toISOString().slice(0, 10);

let deposees = 0;
const laisses: string[] = [];
for (const f of fichiers.sort()) {
  const plaque = plaqueDuNom(f);
  const vehiculeId = plaque ? idParPlaque.get(plaque) : undefined;
  if (!plaque || !vehiculeId) {
    laisses.push(`${f} : ${plaque ? `${plaque} hors référentiel` : "plaque illisible"}`);
    continue;
  }
  const liens = await pg.from("licence_vehicule").select("licence_transport (id, numero, numero_piece, echeance, fichier)").eq("vehicule_id", vehiculeId).limit(20).returns<{ licence_transport: { id: string; numero: string; numero_piece: string | null; echeance: string | null; fichier: string | null } | null }[]>();
  const licences = (liens.data ?? []).map((l) => l.licence_transport).filter((l): l is NonNullable<typeof l> => Boolean(l)).sort((a, b) => (b.echeance ?? "").localeCompare(a.echeance ?? ""));
  if (licences.length === 0) {
    laisses.push(`${f} : ${plaque} sans licence en base`);
    continue;
  }
  const dejaAttachee = licences.find((l) => l.fichier && l.fichier.includes(plaque.toLowerCase()));
  if (dejaAttachee) {
    laisses.push(`${f} : déjà attachée (${dejaAttachee.numero})`);
    continue;
  }
  const cible = licences.find((l) => !l.fichier) ?? null;
  if (!cible) {
    laisses.push(`${f} : ${plaque} — ses ${licences.length} licence(s) portent déjà une pièce`);
    continue;
  }
  const chemin = join(DOSSIER, f);
  const poids = statSync(chemin).size;
  if (poids > PLAFOND) {
    laisses.push(`${f} : trop lourd pour le seau (${Math.round(poids / 1024)} Ko)`);
    continue;
  }
  /* Un .docx ne porte que des images (le seau ne le prend pas tel quel) : ses
     pages sortent en un PDF, comme pour les cartes grises. */
  const docx = /\.docx$/i.test(f);
  const cheminSeau = `documents/2026/09/${jour}-${plaque.toLowerCase()}-licence.pdf`;
  console.log(`  ${plaque.padEnd(8)} → ${cible.numero}${cible.numero_piece ? ` (n° ${cible.numero_piece})` : ""}  ← ${f} (${Math.round(poids / 1024)} Ko${docx ? ", recomposé en PDF" : ""})`);
  if (!DEPOSER) continue;
  let octets: Uint8Array = readFileSync(chemin);
  if (docx) {
    const images = await pages(chemin);
    const { pdf, posees, palier } = await composerSousPlafond(images, `Licence de transport ${plaque}`);
    if (posees === 0) {
      console.error(`    aucune image lisible dans le .docx`);
      continue;
    }
    if (palier) console.log(`    réencodé pour tenir sous le plafond : ${palier}`);
    octets = pdf;
  }
  const depot = await pg.storage.from("pieces").upload(cheminSeau, octets, { contentType: "application/pdf", upsert: false });
  if (depot.error && !/already exists/i.test(depot.error.message)) {
    console.error(`    dépôt refusé : ${depot.error.message}`);
    continue;
  }
  const maj = await pg.from("licence_transport").update({ fichier: `pieces/${cheminSeau}`, modifie_le: new Date().toISOString() }).eq("id", cible.id);
  if (maj.error) {
    console.error(`    licence non complétée : ${maj.error.message}`);
    continue;
  }
  deposees++;
}

console.log();
if (DEPOSER) console.log(`${deposees} pièce(s) attachée(s).`);
if (laisses.length) console.log(`Laissés de côté :\n  ${laisses.join("\n  ")}`);

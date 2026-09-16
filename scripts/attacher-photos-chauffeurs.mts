/* ============================================================================
 * Attache à chaque chauffeur sa photo, depuis « MALICK/PHOTO CHAUFFEURS ».
 *
 * Trente-neuf photos nommées par la personne — « GUIRANE GAYE.jpeg » —,
 * relevées le 16 septembre 2026. Le nom du fichier se rapproche du prénom et
 * du nom en base, sans accent ni casse ; deux graphies connues sont corrigées
 * ci-dessous. Une photo dont personne ne porte le nom est dite et passée : ce
 * script ne devine pas qui est sur l'image.
 *
 * La photo est réduite avant dépôt (1 280 px de côté au plus, JPEG) comme le
 * fait le navigateur, et va au dossier « chauffeurs » du seau ; la fiche n'en
 * garde que la référence (0055).
 *
 * IL N'ÉCRIT RIEN SANS `--deposer`. Les clés viennent de l'environnement ou de
 * `.env.local`, jamais d'un argument, jamais affichées.
 *
 * Lancer :  npx tsx scripts/attacher-photos-chauffeurs.mts            (à blanc)
 *           npx tsx scripts/attacher-photos-chauffeurs.mts --deposer  (dépose)
 * ==========================================================================*/

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const DOSSIER = "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/61. Gestion Parc/MALICK/PHOTO CHAUFFEURS";
const DEPOSER = process.argv.includes("--deposer");

/** Le nom du fichier → le nom en base, quand la graphie diffère (métier, 16 septembre 2026). */
const GRAPHIES: Record<string, string> = {
  "MORY DJITE": "MORY DJITTE",
  "SAMBA THIOUBOU": "SAMBA THIOUB",
};

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

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const chauffeurs = await pg.from("chauffeur").select("id, prenom, nom, photo").limit(1000).returns<{ id: string; prenom: string; nom: string; photo: string | null }[]>();
if (chauffeurs.error) {
  console.error(`Chauffeurs illisibles : ${chauffeurs.error.message}`);
  process.exit(1);
}
const parNom = new Map(chauffeurs.data.map((c) => [norm(`${c.prenom} ${c.nom}`), c]));
const photos = readdirSync(DOSSIER).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
console.log(`${photos.length} photo(s) au dossier${DEPOSER ? "" : " — essai à blanc, rien ne sera déposé"}\n`);

const jour = new Date().toISOString().slice(0, 10);
let deposees = 0;
const laissees: string[] = [];
for (const f of photos) {
  const brut = norm(f.replace(/\.[a-z]+$/i, ""));
  const nom = GRAPHIES[brut] ?? brut;
  const c = parNom.get(nom);
  if (!c) {
    laissees.push(`${f} : personne ne porte ce nom en base`);
    continue;
  }
  if (c.photo) {
    laissees.push(`${f} : ${c.prenom} ${c.nom} a déjà une photo`);
    continue;
  }
  const chemin = join(DOSSIER, f);
  console.log(`  ${f.padEnd(26)} → ${c.prenom} ${c.nom} (${Math.round(statSync(chemin).size / 1024)} Ko)`);
  if (!DEPOSER) continue;
  const reduite = await sharp(readFileSync(chemin)).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
  const slug = `${c.prenom} ${c.nom}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const cheminSeau = `chauffeurs/${jour.slice(0, 4)}/${jour.slice(5, 7)}/${jour}-${slug}.jpg`;
  const depot = await pg.storage.from("pieces").upload(cheminSeau, reduite, { contentType: "image/jpeg", upsert: true });
  if (depot.error) {
    console.error(`    dépôt refusé : ${depot.error.message}`);
    continue;
  }
  const maj = await pg.from("chauffeur").update({ photo: `pieces/${cheminSeau}`, modifie_le: new Date().toISOString() }).eq("id", c.id);
  if (maj.error) {
    console.error(`    fiche non complétée : ${maj.error.message}`);
    continue;
  }
  deposees++;
}

console.log();
if (DEPOSER) console.log(`${deposees} photo(s) attachée(s).`);
if (laissees.length) console.log(`Laissées de côté :\n  ${laissees.join("\n  ")}`);

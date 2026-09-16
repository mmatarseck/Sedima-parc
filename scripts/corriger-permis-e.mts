/* ============================================================================
 * Le « E » seul des permis devient la remorque de la plus haute catégorie.
 *
 * Décision du métier du 16 septembre 2026 (« tout corriger comme suggéré »),
 * sur la règle proposée la veille. Trente-six chauffeurs portent un « E » seul,
 * hérité d'un modèle de permis à cinq lettres : sur la carte sénégalaise, la
 * remorque se lit BE, C1E, CE ou DE, selon le véhicule tracteur.
 *
 * LA RÈGLE, ET CE QU'ELLE SUPPOSE. « E » devient la remorque de la plus haute
 * catégorie détenue : CE avec un C ou un C1, sinon DE avec un D, sinon BE avec
 * un B. Un chauffeur qui tient C et D reçoit CE — c'est un parc de camions, et
 * c'est le tracteur le plus probable ; c'est une déduction, pas une lecture de
 * carte, et le commentaire de la trace le dit. Un « E » sans aucune base reste
 * tel quel : rien ne permet de le lire.
 *
 * À blanc par défaut ; `--appliquer` pour écrire. Chaque changement laisse une
 * ligne dans `modification`, au nom de la règle.
 * ==========================================================================*/

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const APPLIQUER = process.argv.includes("--appliquer");

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

/** La remorque qui va avec ce que le chauffeur tient déjà ; nulle sans base. */
function remorqueDe(categories: string[]): string | null {
  const a = new Set(categories.map((c) => c.toUpperCase()));
  if (a.has("C") || a.has("C1")) return "CE";
  if (a.has("D")) return "DE";
  if (a.has("B")) return "BE";
  return null;
}

const lecture = await pg.from("chauffeur").select("id, nom, prenom, permis_categories").limit(2000).returns<{ id: string; nom: string; prenom: string; permis_categories: string[] | null }[]>();
if (lecture.error) {
  console.error(`Chauffeurs illisibles : ${lecture.error.message}`);
  process.exit(1);
}

let vus = 0;
let changes = 0;
let sansBase = 0;
for (const c of lecture.data) {
  const avant = c.permis_categories ?? [];
  if (!avant.includes("E")) continue;
  vus++;
  const remorque = remorqueDe(avant);
  if (!remorque) {
    sansBase++;
    console.log(`  ${`${c.prenom} ${c.nom}`.padEnd(28)} ${avant.join(" · ").padEnd(14)} → inchangé : « E » sans catégorie de base`);
    continue;
  }
  const apres = [...avant.filter((x) => x !== "E" && x !== remorque), remorque];
  console.log(`  ${`${c.prenom} ${c.nom}`.padEnd(28)} ${avant.join(" · ").padEnd(14)} → ${apres.join(" · ")}`);
  if (!APPLIQUER) continue;
  const maj = await pg.from("chauffeur").update({ permis_categories: apres, modifie_le: new Date().toISOString() }).eq("id", c.id);
  if (maj.error) {
    console.error(`    non appliqué : ${maj.error.message}`);
    continue;
  }
  await pg.from("modification").insert({ table_cible: "chauffeur", numero: c.id, champ: "permis_categories", libelle_champ: "Catégories de permis", avant: avant.join(" · "), apres: apres.join(" · "), motif: "Règle du 16 septembre 2026 : « E » seul devient la remorque de la plus haute catégorie détenue — déduction, pas lecture de carte", statut: "appliquee" });
  changes++;
}
console.log(`\n${vus} chauffeur(s) avec un « E » seul · ${APPLIQUER ? `${changes} corrigé(s)` : `${vus - sansBase} à corriger`} · ${sansBase} sans base, laissé(s) tel(s) quel(s)${APPLIQUER ? "" : "\n(à blanc — `--appliquer` pour écrire)"}`);

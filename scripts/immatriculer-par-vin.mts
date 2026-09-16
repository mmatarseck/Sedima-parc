/* ============================================================================
 * Donne aux véhicules entrés sous une clé entre parenthèses leur clé prévue :
 * « VIN » suivi du numéro de châssis.
 *
 * Le 16 septembre 2026, quatre véhicules neufs ont été créés avec un
 * provisoire tapé « (NOUVEAU VRAC 1) »… ; le SQL relisable
 * (`supabase/correctif-plaques-provisoires.sql`) n'a pas pu être joué depuis
 * l'éditeur. Ce script fait la même chose, avec les mêmes garde-fous : la clé
 * commence par « ( », le châssis est là, la clé cible n'est prise par personne.
 * Le journal des modifications, qui cite l'ancienne clé, suit.
 *
 * IL N'ÉCRIT RIEN SANS `--appliquer`. Les clés viennent de l'environnement ou
 * de `.env.local`, jamais d'un argument, jamais affichées.
 *
 * Lancer :  npx tsx scripts/immatriculer-par-vin.mts              (à blanc)
 *           npx tsx scripts/immatriculer-par-vin.mts --appliquer  (écrit)
 * ==========================================================================*/

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { normaliser, provisoireDepuisVin } from "../src/domaine/immatriculation";

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

interface Ligne {
  id: string;
  immatriculation: string;
  vin: string | null;
  marque: string;
  appellation: string;
}

const lus = await pg.from("vehicule").select("id, immatriculation, vin, marque, appellation").like("immatriculation", "(%").limit(50).returns<Ligne[]>();
if (lus.error) {
  console.error(`Véhicules illisibles : ${lus.error.message}`);
  process.exit(1);
}
console.log(`${lus.data.length} véhicule(s) sous une clé entre parenthèses${APPLIQUER ? "" : " — essai à blanc, rien ne sera écrit"}\n`);

let faits = 0;
for (const v of lus.data) {
  if (!v.vin || normaliser(v.vin).length < 6) {
    console.log(`  ${v.immatriculation.padEnd(24)} ${v.marque} ${v.appellation} : sans châssis, laissé tel quel`);
    continue;
  }
  const cible = provisoireDepuisVin(v.vin);
  const prise = await pg.from("vehicule").select("id").eq("immatriculation", cible).neq("id", v.id).maybeSingle<{ id: string }>();
  if (prise.data) {
    console.log(`  ${v.immatriculation.padEnd(24)} → ${cible} : clé déjà prise, laissé tel quel`);
    continue;
  }
  const traces = await pg.from("modification").select("id", { count: "exact", head: true }).eq("table_cible", "vehicule").eq("numero", v.immatriculation);
  console.log(`  ${v.immatriculation.padEnd(24)} → ${cible}   (${v.marque} ${v.appellation}, ${traces.count ?? 0} trace(s) de journal)`);
  if (!APPLIQUER) continue;

  if ((traces.count ?? 0) > 0) {
    const j = await pg.from("modification").update({ numero: cible }).eq("table_cible", "vehicule").eq("numero", v.immatriculation);
    if (j.error) {
      console.error(`    journal non renommé : ${j.error.message}`);
      continue;
    }
  }
  const maj = await pg.from("vehicule").update({ immatriculation: cible, modifie_le: new Date().toISOString() }).eq("id", v.id);
  if (maj.error) {
    console.error(`    clé non changée : ${maj.error.message}`);
    continue;
  }
  faits++;
}

console.log();
if (APPLIQUER) console.log(`${faits} véhicule(s) posé(s) sur leur châssis.`);
const reste = await pg.from("vehicule").select("id", { count: "exact", head: true }).like("immatriculation", "(%");
console.log(`Clés entre parenthèses restantes : ${reste.count ?? "?"}`);

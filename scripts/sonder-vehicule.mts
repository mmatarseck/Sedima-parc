/* ============================================================================
 * Sonde un véhicule de la base réelle : sa ligne, et tout ce qui la cite.
 *
 * En lecture seule — elle n'écrit rien, jamais. Elle sert avant une
 * suppression ou un archivage : dire ce que la ligne porte et combien de
 * lignes filles chaque table tient sur elle, pour que le SQL qu'on relit
 * ensuite ne devine rien.
 *
 * Les clés viennent de l'environnement ou de `.env.local`, jamais d'un
 * argument, jamais affichées.
 *
 * Lancer :  npx tsx scripts/sonder-vehicule.mts <motif>
 *           le motif se cherche dans l'immatriculation et le commentaire (ilike).
 * ==========================================================================*/

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

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
const motif = process.argv[2];
if (!motif) {
  console.error("Donnez un motif : npx tsx scripts/sonder-vehicule.mts <motif>");
  process.exit(2);
}
const pg = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });

/* Les tables qui portent un `vehicule_id` — celles que 0001 et les migrations
   suivantes ont créées. Une table absente de la base est dite et passée. */
const TABLES_FILLES = ["affectation", "attelage", "depense", "document", "incident", "intervention", "livraison", "ordre_travail", "plein", "rappel", "visite_technique", "observation", "indisponibilite", "attribution_legere", "demande", "transfert", "kilometrage", "assurance", "pneumatique", "piece_posee", "photo"];

/* Les véhicules attendus — ils n'ont pas encore de ligne `vehicule`, mais la liste Flotte les affiche « à immatriculer ». */
const attendus = await pg.from("vehicule_a_recevoir").select("*").ilike("lot", `%${motif}%`).limit(20);
if (attendus.error) console.log(`véhicules à recevoir illisibles : ${attendus.error.message}
`);
else if (attendus.data.length) {
  console.log(`${attendus.data.length} véhicule(s) à recevoir pour « ${motif} »`);
  for (const a of attendus.data as Record<string, unknown>[]) console.log(`  ${Object.entries(a).filter(([, x]) => x !== null).map(([k, x]) => `${k}=${String(x)}`).join("  ")}`);
  console.log();
}

const v = await pg.from("vehicule").select("*").or(`immatriculation.ilike.%${motif}%,commentaire.ilike.%${motif}%`).limit(20);
if (v.error) {
  console.error(`Véhicules illisibles : ${v.error.message}`);
  process.exit(1);
}
console.log(`${v.data.length} véhicule(s) pour « ${motif} »\n`);
for (const ligne of v.data as Record<string, unknown>[]) {
  console.log(`${String(ligne.immatriculation)}  (${String(ligne.id)})`);
  for (const [k, val] of Object.entries(ligne)) if (val !== null && val !== false && k !== "id" && k !== "immatriculation") console.log(`  ${k}: ${String(val)}`);
  const filles: string[] = [];
  for (const t of TABLES_FILLES) {
    const r = await pg.from(t).select("*", { count: "exact", head: true }).eq("vehicule_id", ligne.id as string);
    if (r.error) {
      if (!/does not exist|relation|schema cache/i.test(r.error.message)) filles.push(`${t}: illisible (${r.error.message})`);
      continue;
    }
    if ((r.count ?? 0) > 0) filles.push(`${t}: ${r.count}`);
  }
  const modifs = await pg.from("modification").select("*", { count: "exact", head: true }).eq("table_cible", "vehicule").eq("numero", ligne.immatriculation as string);
  if (!modifs.error && (modifs.count ?? 0) > 0) filles.push(`modification (journal): ${modifs.count}`);
  console.log(filles.length ? `  ↳ référencé par ${filles.join(", ")}` : "  ↳ rien ne le référence");
  console.log();
}

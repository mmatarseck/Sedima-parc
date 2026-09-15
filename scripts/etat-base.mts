/* ============================================================================
 * Ce que la base contient, en lecture seule.
 *
 * Écrit le 15 septembre 2026, après avoir découvert que l'application tournait
 * sur son jeu de démonstration sans que rien ne le dise : le serveur de
 * développement avait démarré avant que `.env.local` ne porte les clés, et Next
 * ne relit ce fichier qu'au démarrage. Les écrans montraient alors des faits
 * inventés avec l'aplomb des vrais.
 *
 * Ce script répond aux trois questions qu'on se pose alors :
 *
 *   * la base est-elle joignable, et la clé valide ?
 *   * quelqu'un peut-il s'y connecter — y a-t-il au moins un profil ?
 *   * qu'y a-t-il dedans, table par table ?
 *
 * IL N'ÉCRIT RIEN. Pas un `insert`, pas un `update` : il compte et il affiche.
 * C'est la seule raison pour laquelle il peut prendre la clé de service sans
 * cérémonie.
 *
 * Il n'affiche jamais de clé, ni d'adresse complète : le projet est nommé par
 * son seul identifiant, ce qui suffit à vérifier qu'on regarde la bonne base.
 *
 * Lancer : npx tsx scripts/etat-base.mts
 * ==========================================================================*/

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

/** Ce que `.env.local` pose, sans écraser ce que le shell a déjà dit. */
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
  console.error("Voir l'en-tête de scripts/attacher-cartes-grises.mts : mêmes variables, même provenance.");
  process.exit(2);
}

const projet = /https:\/\/([^.]+)\./.exec(url)?.[1] ?? "inconnu";
console.log(`Projet Supabase « ${projet} »\n`);

const pg = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });

/** Combien de lignes, ou ce qui a empêché de les compter. */
async function compter(table: string): Promise<number | string> {
  const r = await pg.from(table).select("*", { count: "exact", head: true });
  if (r.error) return r.error.message.includes("does not exist") ? "table absente" : r.error.message;
  return r.count ?? 0;
}

/* -- 1. Qui peut se connecter --------------------------------------------- */

const profils = await pg.from("profil").select("nom, role, actif").order("nom").limit(50).returns<{ nom: string; role: string; actif: boolean }[]>();
if (profils.error) {
  console.log(`Profils : illisibles — ${profils.error.message}`);
} else if (profils.data.length === 0) {
  console.log("⚠ Aucun profil : personne ne peut ouvrir l'application en mode réel.");
  console.log("  Un compte Supabase ne suffit pas — il lui faut une ligne dans `profil`.");
} else {
  const actifs = profils.data.filter((p) => p.actif);
  console.log(`${profils.data.length} profil(s), dont ${actifs.length} actif(s) :`);
  for (const p of profils.data.slice(0, 12)) console.log(`  ${p.actif ? " " : "×"} ${p.nom} · ${p.role}`);
}

/* -- 2. Ce que le référentiel porte --------------------------------------- */

const REFERENTIEL = ["vehicule", "chauffeur", "site", "prestataire", "attributaire", "attelage", "affectation", "attribution_legere"];
const FAITS = ["releve_kilometrique", "plein", "depense", "intervention", "incident", "document", "visite_technique", "ordre_travail", "mouvement_caisse", "demande_achat", "livraison", "piece", "pneu", "ajustement_entretien"];

console.log("\nRéférentiel");
for (const t of REFERENTIEL) console.log(`  ${t.padEnd(22)} ${await compter(t)}`);
console.log("\nFaits");
for (const t of FAITS) console.log(`  ${t.padEnd(22)} ${await compter(t)}`);

/* -- 3. Deux vérifications qui ont coûté cher ------------------------------ */

const cartes = await pg.from("document").select("*", { count: "exact", head: true }).eq("type_document_id", "carte-grise").not("fichier", "is", null);
console.log(`\nCartes grises avec leur pièce jointe : ${cartes.error ? cartes.error.message : (cartes.count ?? 0)}`);

const attelages = await pg.from("attelage").select("numero").is("fin", null).limit(20).returns<{ numero: string }[]>();
if (attelages.error) console.log(`Attelages en cours : ${attelages.error.message}`);
else console.log(`Attelages en cours : ${attelages.data.length}${attelages.data.length ? ` (${attelages.data.map((a) => a.numero).join(", ")})` : " — supabase/attelages.sql n'a pas été joué"}`);

/* ============================================================================
 * Rejouer les lectures annexes de la fiche contre la base réelle, en lecture
 * seule.
 *
 * POURQUOI. Les bancs rejouent les migrations dans PGlite et n'adressent jamais
 * PostgREST : ce qu'ils ne voient pas, c'est une colonne nommée de travers dans
 * un `select`, ou une imbrication ambiguë. Deux défauts de cette famille ont
 * atteint l'écran en deux jours — les attelages le 15 septembre 2026, le garage
 * d'une intervention le 16 — chacun sous la forme d'une page en erreur que rien
 * ne pouvait prévoir avant de la charger.
 *
 * Cette sonde envoie chaque requête telle que le code l'écrit, sur un véhicule
 * réel, et dit laquelle échoue et pourquoi. Elle n'écrit rien. Elle n'affiche
 * ni clé ni adresse : la même discipline que `etat-base.mts`.
 *
 * Lancer : npx tsx scripts/sonder-lectures.mts [plaque]
 * (SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans
 * l'environnement ou `.env.local` — jamais en argument, jamais dans le code.)
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
const pg = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });

const plaque = (process.argv[2] ?? "AA032EA").toUpperCase().replace(/[^A-Z0-9]/g, "");
const v = await pg.from("vehicule").select("id").eq("immatriculation", plaque).maybeSingle<{ id: string }>();
if (!v.data) {
  console.error(`Véhicule ${plaque} introuvable.`);
  process.exit(2);
}
const uuid = v.data.id;

/* Les requêtes, telles que `src/donnees/fiche.ts`, `rappels.ts` et
   `conformite.ts` les écrivent. Quand l'une d'elles change là-bas, elle change
   ici — c'est le prix d'une sonde qui dit la vérité. */
const CHAMPS_RAPPEL = "id, numero, vehicule_id, chauffeur_id, type_document_id, echeance, fait_le, document_numero, commentaire, vehicule (immatriculation, marque, appellation), chauffeur (nom, prenom)";
const CHAMPS_INCIDENT = "numero, date_heure, nature, type, lieu, mission, responsabilite, statut, blesses, sinistre_ouvert, immobilisation_jours, kilometrage, declarant, description, vehicule (immatriculation, marque, appellation, business_unit, site (libelle)), chauffeur (nom, prenom)";

const lectures: [string, () => PromiseLike<{ error: { message: string } | null; data?: unknown }>][] = [
  ["livraisons du véhicule", () => pg.from("livraison").select("numero, date, site, client, produits, poids_kg, quantites, lignes, transporteur_libelle, chauffeur, source").eq("vehicule_id", uuid).limit(50)],
  ["pièces jointes des documents", () => pg.from("document").select("numero, fichier").eq("vehicule_id", uuid).not("fichier", "is", null).limit(50)],
  ["attelages", () => pg.from("attelage").select("numero, tracteur_id, remorque_id, debut, fin, permanent, motif").or(`tracteur_id.eq.${uuid},remorque_id.eq.${uuid}`).limit(50)],
  ["incidents du véhicule", () => pg.from("incident").select(CHAMPS_INCIDENT).eq("vehicule_id", uuid).limit(50)],
  ["rappels du véhicule", () => pg.from("rappel").select(CHAMPS_RAPPEL).eq("vehicule_id", uuid).limit(50)],
  ["rappels des chauffeurs", () => pg.from("rappel").select(CHAMPS_RAPPEL).not("chauffeur_id", "is", null).limit(50)],
  ["rappels (Conformité)", () => pg.from("rappel").select("numero, vehicule_id, chauffeur_id, type_document_id, echeance, fait_le, document_numero, chauffeur (nom, prenom)").limit(50)],
  ["PV de visite (dossier)", () => pg.from("visite_technique").select("numero, date_passage, date_rendez_vous, centre, numero_pv, fichier").eq("vehicule_id", uuid).not("fichier", "is", null).limit(50)],
  ["photos des dépenses (ligne)", () => pg.from("depense").select("numero, photo").eq("vehicule_id", uuid).not("photo", "is", null).limit(50)],
  ["lire_fiche()", () => pg.rpc("lire_fiche", { immat: plaque }).maybeSingle()],
];

let echecs = 0;
console.log(`Lectures annexes de la fiche, sur ${plaque} :\n`);
for (const [nom, lire] of lectures) {
  const r = await lire();
  const n = Array.isArray(r.data) ? `${r.data.length} ligne(s)` : r.data ? "rendu" : "vide";
  console.log(`${r.error ? "ÉCHEC" : "ok   "} ${nom.padEnd(36)} ${r.error ? r.error.message : n}`);
  if (r.error) echecs++;
}
console.log(echecs ? `\n${echecs} lecture(s) en échec : la page qui les porte tombera en erreur.` : "\nToutes les lectures passent.");
process.exit(echecs ? 1 : 0);

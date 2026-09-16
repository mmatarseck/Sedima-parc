/* ============================================================================
 * Attache à chaque demande d'achat le bon de commande Sage X3 scanné.
 *
 * « Maintenance/BON DE COMMANDES » et « Maintenance/Factures » tiennent les
 * mêmes mille PDF (à onze près), nommés par le numéro du bon — « BC15586
 * FOUTA POIDS LOURDS.PDF », « BC 15849 MODOU DIOP APM AA633JL.pdf ». Deux
 * cent dix d'entre eux justifient déjà une dépense (`attacher-factures.mts`,
 * 16 septembre 2026). Ceux-ci répondent à une **demande d'achat** par son
 * `numero_bon_commande` : c'est là que le bon se lit, à côté de l'étape et du
 * montant engagé (0055).
 *
 * Un numéro qui ne répond à aucune demande est compté, pas deviné : les bons
 * d'avant 2023 n'ont pas de demande en base. Un PDF au-delà du plafond du seau
 * est nommé et laissé.
 *
 * IL N'ÉCRIT RIEN SANS `--deposer`. Les clés viennent de l'environnement ou de
 * `.env.local`, jamais d'un argument, jamais affichées.
 *
 * Lancer :  npx tsx scripts/attacher-bons-commande.mts            (à blanc)
 *           npx tsx scripts/attacher-bons-commande.mts --deposer  (dépose)
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

/** Le numéro du bon dans un nom de fichier : « BC15586 … », « BC 15849 … », « 02184 … ». */
function numeroDuNom(nom: string): string | null {
  const m = /BC\s?-?\s?(\d{4,6})/i.exec(nom) ?? /^(\d{5})\b/.exec(nom);
  return m ? m[1]! : null;
}

const demandes = await pg.from("demande_achat").select("id, numero, numero_bon_commande, fournisseur, fichier").not("numero_bon_commande", "is", null).limit(5000).returns<{ id: string; numero: string; numero_bon_commande: string; fournisseur: string | null; fichier: string | null }[]>();
if (demandes.error) {
  console.error(`Demandes d'achat illisibles : ${demandes.error.message}`);
  process.exit(1);
}
const parBon = new Map<string, (typeof demandes.data)[number][]>();
for (const d of demandes.data) {
  const n = d.numero_bon_commande.replace(/\D/g, "");
  if (n) parBon.set(n, [...(parBon.get(n) ?? []), d]);
}

const fichiers = readdirSync(DOSSIER).filter((f) => /\.pdf$/i.test(f)).sort();
console.log(`${fichiers.length} PDF au dossier, ${parBon.size} demandes d'achat avec un numéro de bon${DEPOSER ? "" : " — essai à blanc, rien ne sera déposé"}\n`);

const jour = new Date().toISOString().slice(0, 10);
let deposes = 0;
let sansNumero = 0;
let sansDemande = 0;
let dejaLa = 0;
const tropLourds: string[] = [];
const doublons: string[] = [];
const vus = new Set<string>();
for (const f of fichiers) {
  const n = numeroDuNom(f);
  if (!n) {
    sansNumero++;
    continue;
  }
  const cibles = parBon.get(n);
  if (!cibles) {
    sansDemande++;
    continue;
  }
  if (vus.has(n)) {
    doublons.push(`${f} (bon ${n} déjà servi par un autre fichier)`);
    continue;
  }
  vus.add(n);
  const cible = cibles.find((d) => !d.fichier) ?? null;
  if (!cible) {
    dejaLa++;
    continue;
  }
  const chemin = join(DOSSIER, f);
  const poids = statSync(chemin).size;
  if (poids > PLAFOND) {
    tropLourds.push(`${f} : ${Math.round(poids / 1024)} Ko`);
    continue;
  }
  if (!DEPOSER) {
    deposes++;
    continue;
  }
  const cheminSeau = `documents/${jour.slice(0, 4)}/${jour.slice(5, 7)}/${jour}-bc-${n}.pdf`;
  const depot = await pg.storage.from("pieces").upload(cheminSeau, readFileSync(chemin), { contentType: "application/pdf", upsert: false });
  if (depot.error && !/already exists/i.test(depot.error.message)) {
    console.error(`  ${f} : dépôt refusé (${depot.error.message})`);
    continue;
  }
  const maj = await pg.from("demande_achat").update({ fichier: `pieces/${cheminSeau}`, modifie_le: new Date().toISOString() }).eq("id", cible.id);
  if (maj.error) {
    console.error(`  ${f} : demande non complétée (${maj.error.message})`);
    continue;
  }
  deposes++;
  if (deposes % 50 === 0) console.log(`  … ${deposes} déposés`);
}

console.log();
console.log(`${DEPOSER ? "Déposés" : "À déposer"} : ${deposes} · déjà attachés : ${dejaLa} · sans numéro dans le nom : ${sansNumero} · sans demande d'achat : ${sansDemande}`);
if (doublons.length) console.log(`${doublons.length} doublon(s) de numéro laissé(s) :\n  ${doublons.slice(0, 10).join("\n  ")}${doublons.length > 10 ? "\n  …" : ""}`);
if (tropLourds.length) console.log(`${tropLourds.length} trop lourd(s) pour le seau (5 Mo) :\n  ${tropLourds.join("\n  ")}`);

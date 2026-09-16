/* ============================================================================
 * Rattache les bons de commande et factures scannés à leur véhicule.
 *
 * Demande du métier du 16 septembre 2026 : « déposer aussi les factures et
 * autres par véhicule ; les DA en PDF et les factures sont dans le dossier ».
 *
 * CE QUE LE DISQUE PORTE. « 61. Gestion Parc/Maintenance/BON DE COMMANDES » :
 * 1 026 PDF — « BC15665 FIRST GARAGE AA 485 DR.pdf », « Bon de Commande -
 * BC17709 SECAA.pdf », « BONCDE2 - 2026-08 SSPI CMD2-26080069.pdf ». Le
 * dossier « Factures » voisin porte les mêmes 1 015 fichiers : une seule
 * source.
 *
 * COMMENT ON RETROUVE LE VÉHICULE, ET DANS CET ORDRE.
 *   1. la plaque dans le nom du fichier — certaine ;
 *   2. sinon, le numéro de BC dans le nom, que les demandes d'achat portent en
 *      base (`numero_bon_commande`) : la demande dit son véhicule — certaine
 *      aussi, mais seulement si la demande en a un ;
 *   3. sinon, rien : le fichier est listé, pas deviné.
 *
 * À BLANC, TOUJOURS, POUR L'INSTANT. Ce script ne dépose rien : il mesure ce
 * qui se rattache tout seul, et sur quelle ligne la pièce irait — la demande
 * d'achat qui porte le BC. La ligne porteuse n'a pas encore de colonne pour un
 * fichier ; c'est la décision qui reste à prendre avant d'écrire.
 *
 * Il n'affiche ni clé ni adresse. Les clés viennent de l'environnement ou de
 * `.env.local`.
 *
 * Lancer : npx tsx scripts/attacher-factures.mts
 * ==========================================================================*/

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const DOSSIER = "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/61. Gestion Parc/Maintenance/BON DE COMMANDES";
const PLAFOND = 5 * 1024 * 1024;

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
  const m = /(AA|AB|DK|DL)[ -]?(\d{3,4})[ -]?([A-Z]{1,2})\b/i.exec(nom);
  return m ? `${m[1]}${m[2]}${m[3]}`.toUpperCase() : null;
}
function bcDuNom(nom: string): string | null {
  const m = /\bBC[ _-]?(\d{4,6})\b/i.exec(nom);
  return m ? m[1] : null;
}

const fichiers = readdirSync(DOSSIER).filter((f) => /\.pdf$/i.test(f)).sort();

const [vehicules, demandes] = await Promise.all([
  pg.from("vehicule").select("id, immatriculation").limit(2000).returns<{ id: string; immatriculation: string }[]>(),
  pg.from("demande_achat").select("numero, numero_bon_commande, vehicule_id, objet").limit(5000).returns<{ numero: string; numero_bon_commande: string | null; vehicule_id: string | null; objet: string }[]>(),
]);
if (vehicules.error || demandes.error) {
  console.error(`Lecture impossible : ${vehicules.error?.message ?? demandes.error?.message}`);
  process.exit(1);
}
const idParPlaque = new Map(vehicules.data.map((v) => [v.immatriculation, v.id]));
const plaqueParId = new Map(vehicules.data.map((v) => [v.id, v.immatriculation]));
const demandeParBc = new Map<string, { numero: string; vehicule_id: string | null; objet: string }>();
for (const d of demandes.data) {
  const bc = String(d.numero_bon_commande ?? "").replace(/\D/g, "");
  if (bc) demandeParBc.set(bc, d);
}

type Sort = "plaque" | "bc" | "bc-sans-vehicule" | "bc-inconnu" | "rien";
const comptes: Record<Sort, number> = { plaque: 0, bc: 0, "bc-sans-vehicule": 0, "bc-inconnu": 0, rien: 0 };
const parVehicule = new Map<string, number>();
const exemples: Record<Sort, string[]> = { plaque: [], bc: [], "bc-sans-vehicule": [], "bc-inconnu": [], rien: [] };
let tropLourds = 0;

for (const f of fichiers) {
  const poids = statSync(join(DOSSIER, f)).size;
  if (poids > PLAFOND) tropLourds++;
  const plaque = plaqueDuNom(f);
  const bc = bcDuNom(f);
  let sort: Sort;
  let vehiculeId: string | null = null;
  if (plaque && idParPlaque.has(plaque)) {
    sort = "plaque";
    vehiculeId = idParPlaque.get(plaque)!;
  } else if (bc && demandeParBc.has(bc)) {
    const d = demandeParBc.get(bc)!;
    if (d.vehicule_id) {
      sort = "bc";
      vehiculeId = d.vehicule_id;
    } else sort = "bc-sans-vehicule";
  } else if (bc) sort = "bc-inconnu";
  else sort = "rien";
  comptes[sort]++;
  if (exemples[sort].length < 4) exemples[sort].push(f);
  if (vehiculeId) parVehicule.set(vehiculeId, (parVehicule.get(vehiculeId) ?? 0) + 1);
}

console.log(`${fichiers.length} PDF au dossier — essai à blanc, rien n'est déposé\n`);
const ligne = (sort: Sort, libelle: string) => {
  console.log(`  ${String(comptes[sort]).padStart(5)}  ${libelle}`);
  for (const e of exemples[sort]) console.log(`           ex. ${e}`);
};
ligne("plaque", "rattachés par la plaque du nom");
ligne("bc", "rattachés par le BC, via la demande d'achat qui nomme son véhicule");
ligne("bc-sans-vehicule", "BC connu en base, mais la demande d'achat n'a pas de véhicule");
ligne("bc-inconnu", "BC lu dans le nom, absent des demandes d'achat");
ligne("rien", "ni plaque ni BC dans le nom");
console.log(`\n${parVehicule.size} véhicule(s) recevraient des pièces ; les cinq mieux servis :`);
for (const [id, n] of [...parVehicule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) console.log(`  ${plaqueParId.get(id) ?? id}  ${n}`);
if (tropLourds) console.log(`\n${tropLourds} fichier(s) au-dessus des 5 Mo du seau.`);

/* ============================================================================
 * Met les chauffeurs à l'heure des listes RH : matricule, contrat, permis,
 * téléphone — et crée ceux que les listes connaissent et que la base ignore.
 *
 * Demande du métier du 16 septembre 2026 : « rechercher les matricules et les
 * types de contrat des chauffeurs, et mettre à jour ».
 *
 * LES SOURCES, dans le dossier DO :
 *   * « MALICK/LISTE CHAUFFEURS SEDIMA 2025.xlsx » — la liste RH : matricule,
 *     prénom, nom, catégorie, nature du contrat (CDI, CDD, journalier),
 *     entité. C'est elle qui tranche quand deux listes divergent.
 *   * « MALICK/FICHE POINTAGE/LISTE DES CHAUFFEURS.xlsx » — la liste du parc :
 *     matricule, permis (« C/CE », « C1E/B »), nature du contrat, véhicule.
 *   * « MALICK/Avance Tabaski.xlsx » — matricule et téléphone ; elle ne sert
 *     qu'à compléter un téléphone manquant, jamais à créer quelqu'un : elle
 *     compte aussi du personnel qui n'est pas chauffeur.
 *
 * CE QU'ON CORRIGE. Les matricules « SED-nnnn » de la base viennent du jeu de
 * démonstration ; les vrais sont ceux des listes, à cinq chiffres. Le contrat
 * suit la liste RH (0056 : cdi, cdd, journalier). Le permis et le téléphone ne
 * se remplissent que s'ils sont vides — on ne remplace pas une saisie.
 *
 * LES NOMS SE RAPPROCHENT sans accent ni casse, et par une table d'alias pour
 * les graphies qui diffèrent d'une liste à l'autre (« Talla Diena » / « Talla
 * Diène »). Un nom des listes officielles que la base ignore devient un
 * chauffeur — c'est la liste RH qui dit qui conduit pour SEDIMA. Un chauffeur
 * de la base qu'aucune liste ne connaît est nommé au compte rendu, pas touché.
 *
 * IL N'ÉCRIT RIEN SANS `--appliquer`. Les clés viennent de l'environnement ou
 * de `.env.local`, jamais d'un argument, jamais affichées.
 *
 * Lancer :  npx tsx scripts/charger-chauffeurs-rh.mts              (à blanc)
 *           npx tsx scripts/charger-chauffeurs-rh.mts --appliquer  (écrit)
 * ==========================================================================*/

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CATEGORIES_PERMIS } from "../src/domaine/chauffeur";
import { lireClasseur } from "./lire-xlsx.mts";

const BASE = "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/61. Gestion Parc/";
const APPLIQUER = process.argv.includes("--appliquer");

/** Nom des listes → nom en base, quand la graphie diffère. Clés et valeurs normalisées. */
const ALIAS: Record<string, string> = {
  "TALLA DIENA": "TALLA DIENE",
  "LIBASSE DJENE LAYE DIOP": "LIBASSE DIOP",
  "LIBASSE DIENE DIOP": "LIBASSE DIOP",
  "ABDOU LAHAT THIAM": "ABDOU LAKHAT THIAM",
  "BAYE SAMBA THIOUB": "SAMBA THIOUB",
  "BAGOUMA DIOP": "BOUGOUMA DIOP",
  "ABDOURAHIM DJITTE": "ABDOURAHIM DJITE",
  "ASSE GUEYE": "ASS GUEYE",
  "MAWA DIENG": "MAWO DIENG",
  "BACCARI DIATTA": "BAKARY DIATTA",
  "MORY DJITE": "MORY DJITTE",
  /* Même matricule dans les deux listes, même prénom usuel : le « Papa » de la liste RH est le Moustapha Diaw de la base. */
  "PAPA MOUSTAPHA DIAW": "MOUSTAPHA DIAW",
};

const CONTRAT: Record<string, "cdi" | "cdd" | "journalier"> = { CDI: "cdi", CDD: "cdd", JOURNALIER: "journalier" };

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
const canon = (nom: string) => ALIAS[norm(nom)] ?? norm(nom);
const casse = (s: string) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
    .join(" ");
const texte = (x: unknown) => (x === null || x === undefined ? null : String(x).trim() || null);
const matriculeDe = (x: unknown) => {
  const t = texte(x);
  return t && /^\d{4,6}$/.test(t) ? t : null;
};
/** « C/CE », « C1E/B », « B/LEGER », « D/PERSONNEL » → les catégories connues. */
const permisDe = (x: unknown): string[] =>
  (texte(x) ?? "")
    .toUpperCase()
    .split(/[\/\s,;-]+/)
    .filter((t) => (CATEGORIES_PERMIS as readonly string[]).includes(t));

interface Releve {
  prenom: string;
  nom: string;
  source: "rh" | "pointage" | "tabaski";
  matricule: string | null;
  contrat: "cdi" | "cdd" | "journalier" | null;
  permis: string[];
  telephone: string | null;
}
const releves = new Map<string, Releve[]>();
const poser = (prenom: string, nom: string, r: Omit<Releve, "prenom" | "nom">) => {
  const k = canon(`${prenom} ${nom}`);
  releves.set(k, [...(releves.get(k) ?? []), { prenom, nom, ...r }]);
};

for (const l of lireClasseur(BASE + "MALICK/LISTE CHAUFFEURS SEDIMA 2025.xlsx")[0]!.lignes.slice(2)) {
  if (!texte(l[1]) || !texte(l[2])) continue;
  poser(texte(l[1])!, texte(l[2])!, { source: "rh", matricule: matriculeDe(l[0]), contrat: CONTRAT[norm(texte(l[5]) ?? "")] ?? null, permis: [], telephone: null });
}
for (const l of lireClasseur(BASE + "MALICK/FICHE POINTAGE/LISTE DES CHAUFFEURS.xlsx")[0]!.lignes.slice(3)) {
  if (!texte(l[2]) || !texte(l[3])) continue;
  poser(texte(l[2])!, texte(l[3])!, { source: "pointage", matricule: matriculeDe(l[1]), contrat: CONTRAT[norm(texte(l[6]) ?? "")] ?? null, permis: permisDe(l[5]), telephone: null });
}
for (const l of lireClasseur(BASE + "MALICK/Avance Tabaski.xlsx")[0]!.lignes.slice(2)) {
  const complet = texte(l[1]);
  if (!complet) continue;
  const mots = complet.split(/\s+/);
  poser(mots.slice(0, -1).join(" "), mots.at(-1)!, { source: "tabaski", matricule: matriculeDe(l[2]), contrat: null, permis: [], telephone: texte(l[3]) });
}

/** Ce que les listes disent d'une personne, la liste RH d'abord. */
function synthese(arr: Releve[]) {
  const ordre = (s: Releve["source"]) => (s === "rh" ? 0 : s === "pointage" ? 1 : 2);
  const tries = [...arr].sort((a, b) => ordre(a.source) - ordre(b.source));
  const matricules = [...new Set(tries.map((r) => r.matricule).filter((m): m is string => Boolean(m)))];
  const contrats = [...new Set(tries.map((r) => r.contrat).filter((c): c is NonNullable<Releve["contrat"]> => Boolean(c)))];
  return {
    matricule: matricules[0] ?? null,
    matriculesEnConflit: matricules.length > 1 ? matricules : null,
    contrat: contrats[0] ?? null,
    contratsEnConflit: contrats.length > 1 ? contrats : null,
    permis: [...new Set(tries.flatMap((r) => r.permis))],
    telephone: tries.map((r) => r.telephone).find(Boolean) ?? null,
    officielle: tries.some((r) => r.source !== "tabaski"),
    prenom: tries[0]!.prenom,
    nom: tries[0]!.nom,
  };
}

const chauffeurs = await pg.from("chauffeur").select("id, prenom, nom, matricule_rh, contrat, telephone, permis_categories, date_sortie").limit(1000).returns<{ id: string; prenom: string; nom: string; matricule_rh: string | null; contrat: string; telephone: string | null; permis_categories: string[] | null; date_sortie: string | null }[]>();
if (chauffeurs.error) {
  console.error(`Chauffeurs illisibles : ${chauffeurs.error.message}`);
  process.exit(1);
}
const enBase = new Map(chauffeurs.data.map((c) => [norm(`${c.prenom} ${c.nom}`), c]));
console.log(`${chauffeurs.data.length} chauffeurs en base · ${releves.size} personnes sur les listes${APPLIQUER ? "" : " — essai à blanc, rien ne sera écrit"}\n`);

let misAJour = 0;
let crees = 0;
const inchanges: string[] = [];
const conflits: string[] = [];
const horsListes: string[] = [];
const vus = new Set<string>();

console.log("Mises à jour :");
for (const c of chauffeurs.data) {
  const k = norm(`${c.prenom} ${c.nom}`);
  vus.add(k);
  const arr = releves.get(k);
  if (!arr) {
    horsListes.push(`${c.prenom} ${c.nom}${c.date_sortie ? " (sorti)" : ""} — matricule ${c.matricule_rh ?? "—"}, ${c.contrat}`);
    continue;
  }
  const s = synthese(arr);
  if (s.matriculesEnConflit) conflits.push(`${c.prenom} ${c.nom} : matricules ${s.matriculesEnConflit.join(" / ")} — la liste RH l'emporte (${s.matricule})`);
  if (s.contratsEnConflit) conflits.push(`${c.prenom} ${c.nom} : contrats ${s.contratsEnConflit.join(" / ")} — la liste RH l'emporte (${s.contrat})`);
  const maj: Record<string, unknown> = {};
  if (s.matricule && s.matricule !== c.matricule_rh) maj.matricule_rh = s.matricule;
  if (s.contrat && s.contrat !== c.contrat) maj.contrat = s.contrat;
  if (!c.telephone && s.telephone) maj.telephone = s.telephone;
  if ((!c.permis_categories || c.permis_categories.length === 0) && s.permis.length) maj.permis_categories = s.permis;
  if (Object.keys(maj).length === 0) {
    inchanges.push(`${c.prenom} ${c.nom}`);
    continue;
  }
  console.log(`  ${(c.prenom + " " + c.nom).padEnd(26)} ${Object.entries(maj).map(([k2, v]) => `${k2}: ${c[k2 as keyof typeof c] ?? "—"} → ${Array.isArray(v) ? v.join("·") : String(v)}`).join(" · ")}`);
  if (!APPLIQUER) {
    misAJour++;
    continue;
  }
  const r = await pg.from("chauffeur").update({ ...maj, modifie_le: new Date().toISOString() }).eq("id", c.id);
  if (r.error) {
    console.error(`    refusé : ${r.error.message}`);
    continue;
  }
  misAJour++;
}

console.log("\nCréations (listes officielles seulement) :");
for (const [k, arr] of releves) {
  if (vus.has(k)) continue;
  const s = synthese(arr);
  if (!s.officielle) continue;
  const prenom = casse(s.prenom);
  const nom = s.nom.toUpperCase() === s.nom ? casse(s.nom) : s.nom;
  console.log(`  ${(prenom + " " + nom).padEnd(26)} matricule ${s.matricule ?? "—"} · ${s.contrat ?? "contrat inconnu"}${s.permis.length ? ` · permis ${s.permis.join("·")}` : ""}${s.telephone ? ` · ${s.telephone}` : ""}`);
  if (!APPLIQUER) {
    crees++;
    continue;
  }
  const ins = await pg.from("chauffeur").insert({ prenom, nom, matricule_rh: s.matricule, contrat: s.contrat ?? "cdi", telephone: s.telephone, permis_categories: s.permis, aptitude: "apte" });
  if (ins.error) {
    console.error(`    refusé : ${ins.error.message}`);
    continue;
  }
  crees++;
}

console.log();
console.log(`${APPLIQUER ? "Mis à jour" : "À mettre à jour"} : ${misAJour} · ${APPLIQUER ? "créés" : "à créer"} : ${crees} · déjà à jour : ${inchanges.length}`);
if (conflits.length) console.log(`\nDivergences entre listes (tranchées par la liste RH) :\n  ${conflits.join("\n  ")}`);
if (horsListes.length) console.log(`\nEn base, mais sur aucune liste — non touchés, à trancher (démonstration ? sortis ?) :\n  ${horsListes.join("\n  ")}`);

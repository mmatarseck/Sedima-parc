/* ============================================================================
 * Vérification de la charte du projet.
 *
 * Ce que ce script cherche, ce sont les manquements que la relecture humaine
 * laisse passer parce qu'ils sont diffus : une dépendance de graphique glissée
 * dans le package, un bouton sans action, un `any` posé pour faire taire le
 * compilateur, un fichier sans commentaire d'en-tête. Rien qu'un compilateur ne
 * sache dire, et rien qu'un relecteur ne remarque au dixième fichier.
 *
 * Il ne remplace ni `tsc` ni la relecture : il tient la charte, c'est tout.
 *
 *   npm run verifier-charte
 *
 * Sortie : la liste des manquements, un par ligne, et un code de sortie non nul
 * s'il en reste un — de quoi le brancher sur une intégration continue.
 * ==========================================================================*/

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const RACINE = process.cwd();

interface Manquement {
  fichier: string;
  ligne: number | null;
  regle: string;
  detail: string;
}

const manquements: Manquement[] = [];
const noter = (fichier: string, ligne: number | null, regle: string, detail: string) => manquements.push({ fichier: relative(RACINE, fichier).replace(/\\/g, "/"), ligne, regle, detail });

function fichiers(dossier: string, extensions: string[]): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) return e.name === "node_modules" || e.name.startsWith(".") ? [] : fichiers(chemin, extensions);
    return extensions.some((x) => e.name.endsWith(x)) ? [chemin] : [];
  });
}

const ligneDe = (source: string, index: number) => source.slice(0, index).split("\n").length;

/* -- 1. Les dépendances interdites ------------------------------------------------
   La charte proscrit les bibliothèques de graphiques et de classeurs : les
   graphiques sont en SVG à la main, le classeur est écrit par `lib/xlsx.ts`.
   Une dépendance ajoutée « pour aller vite » emporte un style qui n'est pas le
   nôtre, et pèse plus que ce qu'elle rend. */
const INTERDITES = ["recharts", "chart.js", "chartjs", "victory", "nivo", "d3", "apexcharts", "xlsx", "exceljs", "sheetjs", "moment", "lodash"];

function verifierDependances() {
  const paquet = JSON.parse(readFileSync(join(RACINE, "package.json"), "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const toutes = { ...paquet.dependencies, ...paquet.devDependencies };
  for (const nom of Object.keys(toutes)) {
    if (INTERDITES.some((x) => nom === x || nom.startsWith(`${x}-`) || nom.startsWith(`@${x}/`))) {
      noter("package.json", null, "dépendance interdite", `« ${nom} » — les graphiques sont en SVG, les classeurs dans lib/xlsx.ts`);
    }
  }
  /* Un script déclaré qui ne pointe sur rien casse au premier appel. */
  const scripts = (JSON.parse(readFileSync(join(RACINE, "package.json"), "utf8")) as { scripts?: Record<string, string> }).scripts ?? {};
  for (const [nom, commande] of Object.entries(scripts)) {
    const m = /(?:^|\s)((?:scripts|src)\/[\w./-]+)/.exec(commande);
    if (!m) continue;
    try {
      readFileSync(join(RACINE, m[1]!));
    } catch {
      noter("package.json", null, "script mort", `« ${nom} » appelle ${m[1]}, qui n'existe pas`);
    }
  }
}

/* -- 2. Les boutons sans action ---------------------------------------------------
   Un bouton qui ne fait rien est pire qu'un bouton absent : il promet. Les
   seules exceptions sont les cibles de survol ou de focus, qui portent alors un
   `aria-label` et pas de libellé cliquable. */
function verifierBoutons(source: string, fichier: string) {
  const re = /<button\b[\s\S]*?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const balise = m[0];
    if (/onClick|onPointerDown|onMouseDown|type="submit"/.test(balise)) continue;
    if (balise.includes("aria-label")) continue; // cible de survol assumée
    noter(fichier, ligneDe(source, m.index), "bouton sans action", balise.replace(/\s+/g, " ").slice(0, 90));
  }
}

/* -- 3. Le vocabulaire du code en français ----------------------------------------
   Les identifiants anglais s'infiltrent par copier-coller. On ne cherche que les
   plus courants : le but est de tenir la pente, pas de traquer l'exhaustif. */
/* « onSubmit » et « onChange » sont des attributs du DOM, pas du vocabulaire
   de projet : on ne les cherche pas. */
const ANGLICISMES = ["handleClick", "handleChange", "handleSubmit", "isLoading", "setLoading", "getData", "fetchData", "itemList", "currentUser", "userName", "totalCount"];

function verifierVocabulaire(source: string, fichier: string) {
  for (const mot of ANGLICISMES) {
    const i = source.indexOf(mot);
    if (i >= 0) noter(fichier, ligneDe(source, i), "vocabulaire", `« ${mot} » — le code du projet est en français`);
  }
}

/* -- 4. Les échappatoires du typage -----------------------------------------------
   `any` et `@ts-ignore` font taire le compilateur sans régler ce qu'il signale.
   `as unknown as` reste toléré : il sert à passer un objet de fiche à la modale,
   et il est écrit à dessein. */
function verifierTypage(source: string, fichier: string) {
  for (const re of [/\bas any\b/g, /:\s*any\b/g, /@ts-ignore/g, /@ts-nocheck/g]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) noter(fichier, ligneDe(source, m.index), "typage", `« ${m[0].trim()} » — préférer un type, ou unknown et une garde`);
  }
}

/* -- 5. Les fichiers sans en-tête -------------------------------------------------
   Chaque module du domaine et des données porte un commentaire d'en-tête qui dit
   ce qu'il fait et **pourquoi il est ainsi**. C'est ce commentaire qui rend le
   projet relisible six mois plus tard. */
function verifierEnTete(source: string, fichier: string) {
  const debut = source.slice(0, 400);
  if (!debut.includes("/*") && !debut.includes("/**")) noter(fichier, 1, "en-tête", "aucun commentaire d'en-tête : dire ce que le module fait, et pourquoi il est ainsi");
}

/* -- 6. Les restes de mise au point ------------------------------------------------ */
function verifierResidus(source: string, fichier: string) {
  for (const re of [/console\.log\(/g, /\bdebugger\b/g, /\bTODO\b/g, /\bFIXME\b/g]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) noter(fichier, ligneDe(source, m.index), "résidu", `« ${m[0]} » laissé dans le code`);
  }
}

/* -- Exécution -------------------------------------------------------------------- */

verifierDependances();

const sources = fichiers(join(RACINE, "src"), [".ts", ".tsx"]);
for (const fichier of sources) {
  const source = readFileSync(fichier, "utf8");
  if (fichier.endsWith(".tsx")) verifierBoutons(source, fichier);
  verifierVocabulaire(source, fichier);
  verifierTypage(source, fichier);
  verifierResidus(source, fichier);
  if (/[\\/](domaine|donnees)[\\/]/.test(fichier)) verifierEnTete(source, fichier);
}

const parRegle = new Map<string, Manquement[]>();
for (const m of manquements) parRegle.set(m.regle, [...(parRegle.get(m.regle) ?? []), m]);

if (manquements.length === 0) {
  console.log(`Charte tenue — ${sources.length} fichiers vérifiés, aucun manquement.`);
  process.exit(0);
}

console.log(`${manquements.length} manquement${manquements.length > 1 ? "s" : ""} sur ${sources.length} fichiers :\n`);
for (const [regle, liste] of [...parRegle.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`— ${regle} (${liste.length})`);
  for (const m of liste.slice(0, 20)) console.log(`    ${m.fichier}${m.ligne ? `:${m.ligne}` : ""}  ${m.detail}`);
  if (liste.length > 20) console.log(`    … et ${liste.length - 20} autres`);
  console.log("");
}
process.exit(1);

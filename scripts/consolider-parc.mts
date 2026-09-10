/* Le parc réel, consolidé depuis les listes du dossier DO.
 *
 * Les cinq listes 2026 font référence (voir `docs/RAPPROCHEMENT-PARC.md`) :
 * situation des lourds, affectation des lourds, suivi administratif, parc
 * léger, assurance. Elles se recoupent par la plaque. Ce script les fusionne
 * en un seul enregistrement par véhicule, dit d'où vient chaque fait, et
 * **signale les désaccords au lieu de choisir en silence** — c'est le métier
 * qui tranche, pas le script.
 *
 * Entrée : le dossier où `extraire.ps1` a déposé un JSON par feuille.
 * Sortie : `<dossier>/parc-consolide.json` et un rapport à l'écran.
 *
 * Lancer : npx tsx scripts/consolider-parc.mts <dossier des extraits>
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const racine = process.argv[2];
if (!racine) {
  console.error("Usage : npx tsx scripts/consolider-parc.mts <dossier des extraits>");
  process.exit(2);
}

type Cellule = string | number | null;
type Feuille = Cellule[][];

/** Lit une feuille extraite ; le nom peut porter des espaces en fin, comme dans le classeur. */
function feuille(sousDossier: string, nom: string): Feuille {
  const dossier = join(racine, sousDossier);
  if (!existsSync(dossier)) return [];
  const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".json"));
  const exact = fichiers.find((f) => f.slice(0, -5).trim().toUpperCase() === nom.trim().toUpperCase());
  if (!exact) return [];
  return JSON.parse(readFileSync(join(dossier, exact), "utf8")) as Feuille;
}

const texte = (c: Cellule): string => (c === null || c === undefined ? "" : String(c).trim());

/** La plaque, réduite à ce qui l'identifie : majuscules, sans espace ni tiret. */
function plaque(c: Cellule): string {
  return texte(c).toUpperCase().replace(/[\s\-_.]/g, "");
}

/**
 * La forme d'une immatriculation sénégalaise : deux lettres, trois ou quatre
 * chiffres, une ou deux lettres — « AA 236 MR », « DK 6875 BF », « TH 6065 S ».
 * Le filtre compte : la colonne des plaques de l'assurance porte aussi des
 * mots (« ALMADIES », « DJILAKH A VERIFIER ») qui ne sont pas des véhicules.
 */
const FORME_PLAQUE = /^[A-Z]{2}\d{3,4}[A-Z]{1,2}$/;

/** Une cellule peut porter deux plaques : « AA 927 CA/AA 053 AP » — un tracteur et sa semi. */
function plaques(c: Cellule): string[] {
  return texte(c)
    .split(/[/+]/)
    .map((p) => plaque(p))
    .filter((p) => FORME_PLAQUE.test(p));
}

/** Une date Excel est un nombre de jours depuis le 30 décembre 1899. */
function dateExcel(c: Cellule): string | null {
  if (typeof c === "number" && c > 20_000 && c < 60_000) return new Date(Date.UTC(1899, 11, 30) + c * 86_400_000).toISOString().slice(0, 10);
  const t = texte(c);
  const fr = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t);
  if (fr) return `${fr[3]}-${fr[2]!.padStart(2, "0")}-${fr[1]!.padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}

/** L'âge « 20 ANS », « 14 et 7 ANS », « NEUF » → l'année de mise en circulation, par rang de plaque. */
function anneesDe(c: Cellule, combien: number, annee: number): (number | null)[] {
  const t = texte(c).toUpperCase();
  if (/NEUF/.test(t)) return Array.from({ length: combien }, () => annee);
  const ages = [...t.matchAll(/(\d+)/g)].map((m) => Number(m[1]));
  return Array.from({ length: combien }, (_, i) => {
    const age = ages[i] ?? ages[0];
    return age === undefined || age > 60 ? null : annee - age;
  });
}

interface Fait<T> {
  valeur: T;
  source: string;
}

interface Vehicule {
  plaque: string;
  affichee: string;
  entite: Fait<string> | null;
  genre: Fait<string> | null;
  annee: Fait<number> | null;
  site: Fait<string>[];
  activite: Fait<string> | null;
  etat: Fait<string>[];
  attele: string | null;
  chauffeur: Fait<string> | null;
  telephone: string | null;
  visite: Fait<string> | null;
  assurance: Fait<string> | null;
  licence: Fait<string> | null;
  commentaire: string[];
  sources: string[];
}

const parc = new Map<string, Vehicule>();
const ANNEE = 2026;

function obtenir(p: string, affichee: string, source: string): Vehicule {
  let v = parc.get(p);
  if (!v) {
    v = { plaque: p, affichee, entite: null, genre: null, annee: null, site: [], activite: null, etat: [], attele: null, chauffeur: null, telephone: null, visite: null, assurance: null, licence: null, commentaire: [], sources: [] };
    parc.set(p, v);
  }
  if (!v.sources.includes(source)) v.sources.push(source);
  return v;
}

/* -- 1. La situation des lourds : le référentiel des véhicules de transport -- */

for (const [onglet, etat] of [
  ["VEHICULES OPERATIONELS", "opérationnel"],
  ["PANNES", "en panne"],
  ["REPARATION EN COURS", "en réparation"],
  ["A REFORMER", "à réformer"],
] as const) {
  const lignes = feuille("lourds", onglet);
  /* L'en-tête est la ligne qui porte « IMMATRICUL » ; ce qui précède est un titre. */
  const rangEntete = lignes.findIndex((l) => l.some((c) => /IMMATRICUL/i.test(texte(c))));
  if (rangEntete < 0) continue;
  const entete = lignes[rangEntete]!.map((c) => texte(c).toUpperCase());
  const col = (motif: RegExp) => entete.findIndex((e) => motif.test(e));
  const cImmat = col(/IMMATRICUL/);
  const cGenre = col(/GENRE|TONNAGE|DESIGNATION|VEHICULE/);
  const cAge = col(/AGE/);
  const cSite = col(/SITE|LIEU|GARAGE/);
  const cActivite = col(/ACTIVITE/);
  const cEntite = col(/ENTITE|STE|SOCIETE/);
  const cComm = col(/COMMENTAIRE|OBSERVATION/);
  for (const ligne of lignes.slice(rangEntete + 1)) {
    const liste = plaques(ligne[cImmat] ?? null);
    if (!liste.length) continue;
    const annees = anneesDe(cAge >= 0 ? (ligne[cAge] ?? null) : null, liste.length, ANNEE);
    liste.forEach((p, rang) => {
      const v = obtenir(p, texte(ligne[cImmat]).split(/[/+]/)[rang]?.trim() ?? p, `situation:${onglet}`);
      v.etat.push({ valeur: etat, source: `situation:${onglet}` });
      if (cGenre >= 0 && texte(ligne[cGenre])) v.genre ??= { valeur: texte(ligne[cGenre]), source: "situation" };
      if (cEntite >= 0 && texte(ligne[cEntite])) v.entite ??= { valeur: texte(ligne[cEntite]), source: "situation" };
      const a = annees[rang];
      if (a) v.annee ??= { valeur: a, source: "situation (âge)" };
      if (cSite >= 0 && texte(ligne[cSite])) v.site.push({ valeur: texte(ligne[cSite]), source: "situation" });
      if (cActivite >= 0 && texte(ligne[cActivite])) v.activite ??= { valeur: texte(ligne[cActivite]), source: "situation" };
      if (cComm >= 0 && texte(ligne[cComm])) v.commentaire.push(texte(ligne[cComm]));
      /* L'attelage : chaque plaque de la cellule cite l'autre. */
      if (liste.length > 1) v.attele = liste.filter((x) => x !== p).join(" + ");
    });
  }
}

/* -- 2. L'affectation des lourds : le chauffeur et le site ------------------- */

{
  const lignes = feuille("affectation-lourds", "VEHICULES");
  const rangEntete = lignes.findIndex((l) => l.some((c) => /IMMATRICUL/i.test(texte(c))));
  if (rangEntete >= 0) {
    const entete = lignes[rangEntete]!.map((c) => texte(c).toUpperCase());
    const cImmat = entete.findIndex((e) => /IMMATRICUL/.test(e));
    const cChauff = entete.findIndex((e) => /CHAUFFEUR/.test(e));
    const cTel = entete.findIndex((e) => /TELEPHONE/.test(e));
    const cSite = entete.findIndex((e) => /SITE/.test(e));
    for (const ligne of lignes.slice(rangEntete + 1)) {
      for (const p of plaques(ligne[cImmat] ?? null)) {
        const v = obtenir(p, texte(ligne[cImmat]), "affectation");
        if (cChauff >= 0 && texte(ligne[cChauff])) v.chauffeur ??= { valeur: texte(ligne[cChauff]), source: "affectation" };
        if (cTel >= 0 && texte(ligne[cTel])) v.telephone ??= texte(ligne[cTel]);
        if (cSite >= 0 && texte(ligne[cSite])) v.site.push({ valeur: texte(ligne[cSite]), source: "affectation" });
      }
    }
  }
}

/* -- 3. Le suivi administratif : les échéances ------------------------------- */

for (const onglet of ["LOURS", "LEGERS"]) {
  const lignes = feuille("suivi-admin", onglet);
  const rangEntete = lignes.findIndex((l) => l.some((c) => /MATRICULE|IMMATRICUL/i.test(texte(c))));
  if (rangEntete < 0) continue;
  const entete = lignes[rangEntete]!.map((c) => texte(c).toUpperCase());
  const cImmat = entete.findIndex((e) => /MATRICULE|IMMATRICUL/.test(e));
  const cVisite = entete.findIndex((e) => /VISITE/.test(e));
  const cAssur = entete.findIndex((e) => /ASSURANCE/.test(e));
  const cLic = entete.findIndex((e) => /LICENCE/.test(e));
  const cEtat = entete.findIndex((e) => /ETAT/.test(e));
  const cObs = entete.findIndex((e) => /OBSERVATION/.test(e));
  for (const ligne of lignes.slice(rangEntete + 1)) {
    for (const p of plaques(ligne[cImmat] ?? null)) {
      const v = obtenir(p, texte(ligne[cImmat]), `suivi:${onglet}`);
      const d = (i: number) => (i >= 0 ? dateExcel(ligne[i] ?? null) : null);
      const visite = d(cVisite);
      const assurance = d(cAssur);
      const licence = d(cLic);
      if (visite) v.visite ??= { valeur: visite, source: "suivi administratif" };
      if (assurance) v.assurance ??= { valeur: assurance, source: "suivi administratif" };
      if (licence) v.licence ??= { valeur: licence, source: "suivi administratif" };
      if (cEtat >= 0 && texte(ligne[cEtat])) v.etat.push({ valeur: texte(ligne[cEtat]).toLowerCase(), source: "suivi administratif" });
      if (cObs >= 0 && texte(ligne[cObs])) v.commentaire.push(texte(ligne[cObs]));
    }
  }
}

/* -- 4. Le parc léger --------------------------------------------------------- */

for (const onglet of ["PARC LEGERS", "ALMADIE", "MOTO", "CAR-PLAN"]) {
  const lignes = feuille("legers", onglet);
  const rangEntete = lignes.findIndex((l) => l.some((c) => /IMMAT/i.test(texte(c))));
  if (rangEntete < 0) continue;
  const entete = lignes[rangEntete]!.map((c) => texte(c).toUpperCase());
  const cImmat = entete.findIndex((e) => /IMMAT/.test(e));
  const cMarque = entete.findIndex((e) => /MARQUE/.test(e));
  const cGenre = entete.findIndex((e) => /GENRE|MODELE/.test(e));
  const cAff = entete.findIndex((e) => /AFFECTATION|ATTRIBUTAIRE|NOM/.test(e));
  const cDep = entete.findIndex((e) => /DEPARTEMENT/.test(e));
  for (const ligne of lignes.slice(rangEntete + 1)) {
    for (const p of plaques(ligne[cImmat] ?? null)) {
      const v = obtenir(p, texte(ligne[cImmat]), `léger:${onglet}`);
      const marque = cMarque >= 0 ? texte(ligne[cMarque]) : "";
      const genre = cGenre >= 0 ? texte(ligne[cGenre]) : "";
      if (marque || genre) v.genre ??= { valeur: `${marque} ${genre}`.trim(), source: `léger:${onglet}` };
      if (cAff >= 0 && texte(ligne[cAff]) && !/^NO?N? ?AFFECTE/i.test(texte(ligne[cAff]))) v.chauffeur ??= { valeur: texte(ligne[cAff]), source: `léger:${onglet}` };
      if (cDep >= 0 && texte(ligne[cDep])) v.activite ??= { valeur: texte(ligne[cDep]), source: `léger:${onglet}` };
    }
  }
}

/* -- 5. L'assurance : la plaque assurée, et jusqu'à quand -------------------- */

for (const onglet of ["ASSURANCE SEDIMA SA 2026", "ASSURANCE SEDIMA ABATTOIRS 2026"]) {
  const lignes = feuille("assurances", onglet);
  const rangEntete = lignes.findIndex((l) => l.filter((c) => texte(c)).length > 3 && l.some((c) => /IMMATRICUL|MATRICULE/i.test(texte(c))));
  if (rangEntete < 0) continue;
  const entete = lignes[rangEntete]!.map((c) => texte(c).toUpperCase());
  const cImmat = entete.findIndex((e) => /IMMATRICUL|MATRICULE/.test(e));
  const cGenre = entete.findIndex((e) => /GENRE|MARQUE|VEHICULE/.test(e));
  for (const ligne of lignes.slice(rangEntete + 1)) {
    for (const p of plaques(ligne[cImmat] ?? null)) {
      const v = obtenir(p, texte(ligne[cImmat]), `assurance:${onglet.includes("ABATTOIRS") ? "Abattoirs" : "SA"}`);
      if (cGenre >= 0 && texte(ligne[cGenre])) v.genre ??= { valeur: texte(ligne[cGenre]), source: "assurance" };
    }
  }
}

/* -- 6. Le rapport ------------------------------------------------------------ */

const tous = [...parc.values()].sort((a, b) => a.plaque.localeCompare(b.plaque));
const dansSituation = tous.filter((v) => v.sources.some((s) => s.startsWith("situation")));
const dansLeger = tous.filter((v) => v.sources.some((s) => s.startsWith("léger")));
const assuresSeuls = tous.filter((v) => v.sources.every((s) => s.startsWith("assurance")));

console.log(`\n${tous.length} plaques distinctes, réunies depuis ${new Set(tous.flatMap((v) => v.sources)).size} feuilles.`);
console.log(`  lourds (situation)        ${dansSituation.length}`);
console.log(`  légers                    ${dansLeger.length}`);
console.log(`  vus par la seule assurance ${assuresSeuls.length}`);

/* Les désaccords : plusieurs sources, plusieurs réponses. */
const desaccords: string[] = [];
for (const v of tous) {
  const etats = new Set(v.etat.map((e) => e.valeur.toLowerCase().replace(/é/g, "e")));
  if (etats.size > 1) desaccords.push(`${v.affichee} — état : ${v.etat.map((e) => `${e.valeur} (${e.source})`).join(" contre ")}`);
  const sites = new Set(v.site.map((s) => s.valeur.toUpperCase()));
  if (sites.size > 1) desaccords.push(`${v.affichee} — site : ${[...sites].join(" contre ")}`);
}

console.log(`\n${desaccords.length} désaccord(s) entre sources :`);
for (const d of desaccords.slice(0, 40)) console.log(`  ${d}`);
if (desaccords.length > 40) console.log(`  … et ${desaccords.length - 40} autres, tous dans le JSON.`);

/* Les plaques qui ne tiennent qu'à une source : à confirmer avant de charger. */
const seules = tous.filter((v) => v.sources.length === 1);
console.log(`\n${seules.length} plaque(s) ne tenant qu'à une source :`);
for (const v of seules.slice(0, 30)) console.log(`  ${v.affichee.padEnd(14)} ${v.sources[0]}`);
if (seules.length > 30) console.log(`  … et ${seules.length - 30} autres.`);

/* Les plaques qui ne diffèrent que d'une lettre. Deux plaques consécutives sont
   normales dans un parc acheté par lots : ce qui trahit la faute de saisie,
   c'est que les deux voisines **ne partagent aucune source** et qu'au moins
   l'une ne tient qu'à un seul classeur. Le dossier en connaît trois :
   AB 930 BB/BV, DK 9723 BD/BG, DK 9181 BB/BD. */
const voisines: string[] = [];
for (let i = 0; i < tous.length; i++) {
  for (let k = i + 1; k < tous.length; k++) {
    const a = tous[i]!;
    const b = tous[k]!;
    if (a.plaque.length !== b.plaque.length) continue;
    let ecarts = 0;
    for (let n = 0; n < a.plaque.length && ecarts < 2; n++) if (a.plaque[n] !== b.plaque[n]) ecarts++;
    if (ecarts !== 1) continue;
    const communes = a.sources.filter((s) => b.sources.includes(s));
    if (communes.length > 0) continue;
    if (a.sources.length > 1 && b.sources.length > 1) continue;
    voisines.push(`${a.affichee} (${a.sources.join(", ")}) ≈ ${b.affichee} (${b.sources.join(", ")})`);
  }
}
console.log(`\n${voisines.length} paire(s) suspecte(s) de plaques à un caractère près, sans source commune :`);
for (const v of voisines) console.log(`  ${v}`);

const sortie = join(racine, "parc-consolide.json");
writeFileSync(sortie, JSON.stringify({ genere: new Date().toISOString(), vehicules: tous, desaccords }, null, 2), "utf8");
console.log(`\nÉcrit : ${sortie}`);

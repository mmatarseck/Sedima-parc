/* ============================================================================
 * Lire un classeur Excel sans Excel.
 *
 * Le projet extrayait jusqu'ici les classeurs du dossier DO par Excel en COM
 * (`extraire-classeurs.ps1`). Ça marche, mais ça demande Excel installé,
 * disponible, et sans boîte de dialogue ouverte — le 10 septembre 2026, COM a
 * rendu « Unable to get the Open property of the Workbooks class » et
 * l'extraction s'est arrêtée là.
 *
 * Or un `.xlsx` est une archive ZIP de fichiers XML, et Node sait déjà tout ce
 * qu'il faut : `inflateRawSync` pour les entrées compressées, et rien du tout
 * pour celles qui sont stockées. Trois cents lignes remplacent la dépendance à
 * Excel, et la lecture devient **de nature** en lecture seule : on ne peut pas
 * abîmer un classeur qu'on ne fait que dézipper.
 *
 * Ce que ce lecteur sait faire, et ce qu'il ignore volontairement : il rend les
 * **valeurs** des cellules — nombres, chaînes, dates converties depuis le
 * calendrier Excel — feuille par feuille, sous forme de tableau de lignes. Il
 * ignore la mise en forme, les formules (il lit leur dernier résultat calculé,
 * qu'Excel range à côté), les images et les tableaux croisés. C'est exactement
 * ce dont une extraction de données a besoin.
 * ==========================================================================*/

import { inflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";

export type Cellule = string | number | null;
export type Feuille = { nom: string; lignes: Cellule[][] };

/* -- 1. Le ZIP ------------------------------------------------------------ */

/** Une entrée de l'archive, décompressée. */
function entrees(archive: Buffer): Map<string, Buffer> {
  const fichiers = new Map<string, Buffer>();
  /* On lit le répertoire central, en fin d'archive : c'est lui qui fait foi
     sur les noms et les positions, les en-têtes locaux pouvant mentir sur les
     tailles quand le producteur a écrit en flux. */
  const fin = trouverFinRepertoire(archive);
  if (fin < 0) throw new Error("archive illisible : fin de répertoire central introuvable");
  let position = archive.readUInt32LE(fin + 16);
  const nombre = archive.readUInt16LE(fin + 10);
  for (let i = 0; i < nombre; i++) {
    if (archive.readUInt32LE(position) !== 0x02014b50) throw new Error("entrée de répertoire central attendue");
    const methode = archive.readUInt16LE(position + 10);
    const tailleCompressee = archive.readUInt32LE(position + 20);
    const longueurNom = archive.readUInt16LE(position + 28);
    const longueurExtra = archive.readUInt16LE(position + 30);
    const longueurCommentaire = archive.readUInt16LE(position + 32);
    const debutLocal = archive.readUInt32LE(position + 42);
    const nom = archive.toString("utf8", position + 46, position + 46 + longueurNom);
    /* L'en-tête local répète le nom et l'extra, dont les longueurs peuvent
       différer de celles du répertoire central : on relit les siennes. */
    const nomLocal = archive.readUInt16LE(debutLocal + 26);
    const extraLocal = archive.readUInt16LE(debutLocal + 28);
    const debutDonnees = debutLocal + 30 + nomLocal + extraLocal;
    const brut = archive.subarray(debutDonnees, debutDonnees + tailleCompressee);
    fichiers.set(nom, methode === 0 ? brut : inflateRawSync(brut));
    position += 46 + longueurNom + longueurExtra + longueurCommentaire;
  }
  return fichiers;
}

/** La signature de fin de répertoire central, cherchée depuis la fin. */
function trouverFinRepertoire(a: Buffer): number {
  for (let i = a.length - 22; i >= 0 && i > a.length - 65_558; i--) if (a.readUInt32LE(i) === 0x06054b50) return i;
  return -1;
}

/* -- 2. Le XML ------------------------------------------------------------ */

const ENTITES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
const decoder = (s: string) => s.replace(/&(?:amp|lt|gt|quot|apos);/g, (e) => ENTITES[e]!).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));

/** Le texte d'un fragment, `<t>` compris — une chaîne partagée peut être en morceaux. */
function texteDe(fragment: string): string {
  let sortie = "";
  for (const m of fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) sortie += decoder(m[1]!);
  return sortie;
}

/* -- 3. Le classeur ------------------------------------------------------- */

/** Une date Excel : un nombre de jours depuis le 30 décembre 1899. */
function dateExcel(n: number): string {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86_400_000).toISOString().slice(0, 10);
}

/** La colonne d'une référence « BK12 », en index depuis zéro. */
function colonneDe(reference: string): number {
  const lettres = /^([A-Z]+)/.exec(reference)?.[1] ?? "A";
  let n = 0;
  for (const c of lettres) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Les feuilles d'un classeur, dans l'ordre du classeur.
 *
 * `datesEnTexte` : les cellules dont le format est une date sortent en
 * « AAAA-MM-JJ » plutôt qu'en nombre de jours. Le repérage se fait sur le
 * format de nombre, comme Excel lui-même — un nombre n'est une date que parce
 * qu'on le regarde comme telle.
 */
export function lireClasseur(chemin: string): Feuille[] {
  const zip = entrees(readFileSync(chemin));
  const lire = (nom: string) => zip.get(nom)?.toString("utf8") ?? "";

  /* Les chaînes partagées : les textes du classeur, rangés une fois. */
  const partagees: string[] = [];
  for (const m of lire("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)) partagees.push(texteDe(m[1]!));

  /* Les formats qui sont des dates : ceux de la liste standard d'Excel, et
     ceux que le classeur définit avec un jour, un mois ou une année dedans. */
  const styles = lire("xl/styles.xml");
  const formatsDate = new Set<number>([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
  for (const m of styles.matchAll(/<numFmt[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) {
    const code = decoder(m[2]!);
    if (/[dmyhs]/i.test(code) && !/[#0]/.test(code.replace(/\[[^\]]*\]/g, ""))) formatsDate.add(Number(m[1]));
  }
  const styleEstDate: boolean[] = [];
  const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? "";
  for (const m of cellXfs.matchAll(/<xf\b[^>]*\/?>/g)) styleEstDate.push(formatsDate.has(Number(/numFmtId="(\d+)"/.exec(m[0]!)?.[1] ?? "0")));

  /* Le nom et le fichier de chaque feuille. */
  const relations = new Map<string, string>();
  for (const m of lire("xl/_rels/workbook.xml.rels").matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) relations.set(m[1]!, m[2]!.replace(/^\/?xl\//, ""));

  const feuilles: Feuille[] = [];
  for (const m of lire("xl/workbook.xml").matchAll(/<sheet\b[^>]*\/?>/g)) {
    const nom = decoder(/name="([^"]*)"/.exec(m[0]!)?.[1] ?? "");
    const identifiant = /r:id="([^"]+)"/.exec(m[0]!)?.[1] ?? "";
    const cible = relations.get(identifiant);
    if (!cible) continue;
    feuilles.push({ nom, lignes: lireFeuille(lire(`xl/${cible}`), partagees, styleEstDate) });
  }
  return feuilles;
}

function lireFeuille(xml: string, partagees: string[], styleEstDate: boolean[]): Cellule[][] {
  const lignes: Cellule[][] = [];
  for (const ligne of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cellules: Cellule[] = [];
    /* Les attributs se lisent **paresseusement**, et c'est tout sauf un
       détail. Avec `([^>]*)` gourmand, une cellule vide auto-fermée —
       `<c r="AH2" s="6"/>` — laissait le moteur avaler la barre oblique dans
       les attributs, prendre la branche `>` et courir jusqu'au premier
       `</c>` venu : quatre cellules vides étaient absorbées d'un coup, et la
       valeur de la cinquième atterrissait dans la colonne de la première.
       Les colonnes se décalaient donc en silence, d'autant de rangs qu'il y
       avait de cellules vides à la suite (10 septembre 2026). */
    for (const c of ligne[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributs = c[1]!;
      const corps = c[2] ?? "";
      const colonne = colonneDe(/r="([A-Z]+\d+)"/.exec(attributs)?.[1] ?? "A1");
      while (cellules.length < colonne) cellules.push(null);
      const type = /t="([^"]+)"/.exec(attributs)?.[1] ?? "n";
      const style = Number(/s="(\d+)"/.exec(attributs)?.[1] ?? "-1");
      let valeur: Cellule = null;
      if (type === "inlineStr") valeur = texteDe(corps) || null;
      else {
        const brut = /<v>([\s\S]*?)<\/v>/.exec(corps)?.[1];
        if (brut !== undefined) {
          if (type === "s") valeur = partagees[Number(brut)] ?? null;
          else if (type === "str" || type === "e") valeur = decoder(brut) || null;
          else if (type === "b") valeur = brut === "1" ? "VRAI" : "FAUX";
          else {
            const n = Number(brut);
            /* Une date n'est une date que si son format le dit, et si le
               nombre tombe dans la plage des dates plausibles : le prix d'un
               litre porte parfois un style hérité d'une colonne voisine. */
            valeur = styleEstDate[style] === true && n > 20_000 && n < 80_000 ? dateExcel(n) : n;
          }
        }
      }
      cellules.push(valeur);
    }
    lignes.push(cellules);
  }
  return lignes;
}

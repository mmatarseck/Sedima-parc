/* ============================================================================
 * Lire les scans de cartes grises du dossier DO, et en faire un PDF par
 * véhicule.
 *
 * Le dossier `MALICK/CARTE GRISE VEHICULES` tient une centaine de scans : des
 * PDF pour la plupart, une douzaine de .docx où quelqu'un a collé deux photos
 * dans un document Word. Un véhicule a souvent deux fichiers — recto et verso —
 * et la fiche n'a qu'une pièce jointe par document : il faut donc remonter les
 * pages en un seul PDF.
 *
 * Ce module ne fait que ça, sans toucher à la base : `attacher-cartes-grises`
 * s'en sert pour déposer, `tester-attachement-cartes` pour vérifier que tout le
 * dossier se relit — l'un ne pouvant servir de banc à l'autre puisqu'il écrit.
 * ==========================================================================*/

import { readFileSync, readdirSync } from "node:fs";
import { inflateSync, inflateRawSync } from "node:zlib";
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { normaliser, afficher } from "../src/domaine/immatriculation";

export const DOSSIER =
  "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/61. Gestion Parc/MALICK/CARTE GRISE VEHICULES";

/** Ce que le seau « pieces » accepte (0014, élargi au PDF par 0049) : 5 Mo. */
export const PLAFOND = 5 * 1024 * 1024;

/* -- Sortir les pages d'un scan -------------------------------------------- */

/** Les entrées d'une archive ZIP — un .docx en est une. */
function entreesZip(archive: Buffer): Map<string, Buffer> {
  const fichiers = new Map<string, Buffer>();
  let fin = archive.length - 22;
  while (fin >= 0 && archive.readUInt32LE(fin) !== 0x06054b50) fin--;
  if (fin < 0) return fichiers;
  let position = archive.readUInt32LE(fin + 16);
  const nombre = archive.readUInt16LE(fin + 10);
  for (let i = 0; i < nombre; i++) {
    if (archive.readUInt32LE(position) !== 0x02014b50) break;
    const methode = archive.readUInt16LE(position + 10);
    const taille = archive.readUInt32LE(position + 20);
    const ln = archive.readUInt16LE(position + 28);
    const le = archive.readUInt16LE(position + 30);
    const lc = archive.readUInt16LE(position + 32);
    const local = archive.readUInt32LE(position + 42);
    const nom = archive.toString("utf8", position + 46, position + 46 + ln);
    const debut = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28);
    const brut = archive.subarray(debut, debut + taille);
    try {
      fichiers.set(nom, methode === 0 ? brut : inflateRawSync(brut));
    } catch {
      /* entrée illisible : les autres restent lisibles */
    }
    position += 46 + ln + le + lc;
  }
  return fichiers;
}

/** Les images d'un scan, dans l'ordre où le document les porte. */
export async function pages(chemin: string): Promise<Buffer[]> {
  if (chemin.toLowerCase().endsWith(".docx")) {
    return [...entreesZip(readFileSync(chemin))]
      .filter(([nom]) => /^word\/media\/.*\.(jpe?g|png)$/i.test(nom))
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([, octets]) => octets);
  }
  const doc = await PDFDocument.load(readFileSync(chemin), { ignoreEncryption: true, updateMetadata: false });
  const trouvees: Buffer[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const filtre = String(obj.dict.get(PDFName.of("Filter")));
    if (String(obj.dict.get(PDFName.of("Subtype"))) !== "/Image" || !filtre.includes("DCTDecode")) continue;
    let octets = Buffer.from(obj.contents);
    if (filtre.includes("FlateDecode")) {
      try {
        octets = inflateSync(octets);
      } catch {
        continue;
      }
    }
    if (octets[0] === 0xff && octets[1] === 0xd8) trouvees.push(octets);
  }
  return trouvees;
}

/**
 * Une image détachée de ce qui l'entoure.
 *
 * Un Buffer Node est souvent une **vue** sur un tampon plus grand : une entrée
 * ZIP rangée sans compression pointe dans le .docx entier, et les petits
 * tampons sortent d'une réserve commune. pdf-lib lit `.buffer` sans tenir
 * compte de `byteOffset` : il cherche alors l'en-tête JPEG à l'octet 0 du
 * document et conclut « SOI not found » sur une image parfaitement valide.
 * Huit cartes grises restaient ainsi sans pièce.
 */
function autonome(image: Buffer): Uint8Array {
  return image.byteOffset === 0 && image.byteLength === image.buffer.byteLength ? image : new Uint8Array(image);
}

/**
 * Un PDF d'une page par image, chaque page à la taille de la sienne.
 *
 * On **réemballe** les images, on ne les réencode pas : sans bibliothèque
 * d'images, Node ne sait pas recompresser, et en écrire une ici serait un autre
 * métier. Le gain vient de ce qu'on jette — l'enveloppe d'origine, ses polices,
 * ses miniatures : un scan de 217 Ko sort à 217 Ko, un de 7 Mo sort à 7 Mo.
 * Ceux qui dépassent le plafond du seau sont donc nommés, pas tronqués.
 *
 * Une page illisible ne fait pas tomber le document : elle est comptée et dite.
 */
export async function composer(images: Buffer[], titre: string): Promise<{ pdf: Uint8Array; posees: number; ecartees: number }> {
  const doc = await PDFDocument.create();
  doc.setTitle(titre);
  doc.setSubject("Carte grise — dossier de gestion du parc SEDIMA");
  let posees = 0;
  let ecartees = 0;
  for (const brute of images) {
    const image = autonome(brute);
    let incorporee;
    try {
      incorporee = image[0] === 0x89 ? await doc.embedPng(image) : await doc.embedJpg(image);
    } catch {
      /* JPEG progressif, CMYK, image tronquée : pdf-lib ne sait pas la lire. */
      try {
        incorporee = await doc.embedPng(image);
      } catch {
        ecartees++;
        continue;
      }
    }
    const page = doc.addPage([incorporee.width, incorporee.height]);
    page.drawImage(incorporee, { x: 0, y: 0, width: incorporee.width, height: incorporee.height });
    posees++;
  }
  return { pdf: await doc.save(), posees, ecartees };
}

/* -- Alléger un scan trop lourd --------------------------------------------- */

/**
 * Les paliers d'allègement, du plus fidèle au plus économe.
 *
 * Une carte grise se lit à l'œil et s'imprime au besoin : 2200 pixels de large
 * suffisent largement pour un document de 8,5 cm sur 5,4. Les scans du dossier
 * montent à trois fois cela, sans y gagner en lisibilité — c'est du gaspillage
 * de stockage, pas de la précision.
 */
const PALIERS = [
  { largeur: 2400, qualite: 82 },
  { largeur: 2000, qualite: 75 },
  { largeur: 1600, qualite: 70 },
];

/**
 * Un scan trop lourd, réencodé jusqu'à passer sous le plafond — ou nul si on
 * n'y arrive pas.
 *
 * On ne réencode **que** ce qui dépasse. Réencoder tout le dossier ferait
 * perdre de la qualité à soixante-quatorze documents déjà légers pour rien :
 * un scan de 217 Ko n'a aucune raison d'être retouché. Ici il s'agit du seul
 * cas où l'alternative serait de ne rien déposer du tout.
 *
 * `sharp` arrive avec Next ; s'il venait à manquer, la fonction rend nul et le
 * document est nommé au compte rendu comme avant, jamais tronqué.
 */
async function alleger(images: Buffer[], titre: string, plafond: number): Promise<{ pdf: Uint8Array; posees: number; ecartees: number; palier: string } | null> {
  let sharp: typeof import("sharp");
  try {
    sharp = (await import("sharp")).default;
  } catch {
    return null;
  }
  for (const { largeur, qualite } of PALIERS) {
    const reduites = await Promise.all(
      images.map((image) =>
        sharp(image)
          .rotate() /* l'orientation EXIF devient une vraie rotation : pdf-lib ne la lit pas */
          .resize({ width: largeur, withoutEnlargement: true })
          .jpeg({ quality: qualite, mozjpeg: true })
          .toBuffer(),
      ),
    );
    const compose = await composer(reduites, titre);
    if (compose.pdf.byteLength <= plafond) return { ...compose, palier: `${largeur} px, qualité ${qualite}` };
  }
  return null;
}

/**
 * Le PDF d'un scan, allégé seulement s'il le faut.
 *
 * C'est la porte d'entrée : elle compose d'abord tel quel, et ne réencode que
 * si le résultat dépasse le plafond du seau.
 */
export async function composerSousPlafond(images: Buffer[], titre: string, plafond = PLAFOND): Promise<{ pdf: Uint8Array; posees: number; ecartees: number; palier: string | null }> {
  const direct = await composer(images, titre);
  if (direct.pdf.byteLength <= plafond || direct.posees === 0) return { ...direct, palier: null };
  const allege = await alleger(images, titre, plafond);
  return allege ?? { ...direct, palier: null };
}

/* -- Les cartes du dossier, par plaque -------------------------------------- */

export interface Carte {
  /** Canonique : `AB060KT`. */
  plaque: string;
  /** Telle qu'on l'écrit : `AB-060-KT`. */
  ecrite: string;
  fichiers: string[];
}

/**
 * Les noms de fichiers qui mentent, et ce que la carte dit vraiment.
 *
 * Le nom de fichier n'est pas une source : c'est ce que quelqu'un a tapé en
 * scannant. Trois se sont révélés faux au dépôt du 14 septembre 2026, et les
 * cartes ont été relues à l'écran pour trancher — la carte fait foi, pas le
 * nom :
 *
 *   * `AA 093 VAA` porte **AA-093-VA** (un A de trop ; la licence du même
 *     véhicule, au même dossier, l'écrit correctement). Le véhicule est au
 *     parc, et c'est cette faute de frappe qui l'a privé de sa pièce — et de
 *     ses caractéristiques lors de la lecture des cartes ;
 *   * `AA 903 JW` porte **AB-903-JW** : un doublon du scan déjà nommé
 *     correctement, et non un second véhicule ;
 *   * `AB 077 BP` porte **AB-077-FP** — un autocar Force Motors de 24 places
 *     qui n'est pas au référentiel. Il y entre par la corbeille « hors parc »
 *     du compte rendu, pas en silence.
 *
 * La confusion AA/AB revient deux fois sur trois : les deux séries coexistent
 * au Sénégal et se ressemblent à l'œil.
 */
const PLAQUES_CORRIGEES: Record<string, string> = {
  AA093VAA: "AA093VA",
  AA903JW: "AB903JW",
  AB077BP: "AB077FP",
};

export function cartesDuDossier(): Carte[] {
  const parPlaque = new Map<string, Carte>();
  for (const f of readdirSync(DOSSIER).sort()) {
    /* Les licences de transport, l'assurance et les pièces personnelles ne sont
       pas des cartes grises : elles ont leur propre type de document, et leur
       chargement est un autre travail. */
    const m = /^CARTE(?: GRISE)?\s+([A-Z]{2}\s*\d{3,4}\s*[A-Z]{1,3})/i.exec(f);
    if (!m) continue;
    const lue = normaliser(m[1]!);
    const plaque = PLAQUES_CORRIGEES[lue] ?? lue;
    const connue = parPlaque.get(plaque) ?? { plaque, ecrite: afficher(plaque), fichiers: [] };
    connue.fichiers.push(f);
    parPlaque.set(plaque, connue);
  }
  return [...parPlaque.values()].sort((a, b) => a.plaque.localeCompare(b.plaque));
}

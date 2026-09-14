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

/* -- Les cartes du dossier, par plaque -------------------------------------- */

export interface Carte {
  /** Canonique : `AB060KT`. */
  plaque: string;
  /** Telle qu'on l'écrit : `AB-060-KT`. */
  ecrite: string;
  fichiers: string[];
}

export function cartesDuDossier(): Carte[] {
  const parPlaque = new Map<string, Carte>();
  for (const f of readdirSync(DOSSIER).sort()) {
    /* Les licences de transport, l'assurance et les pièces personnelles ne sont
       pas des cartes grises : elles ont leur propre type de document, et leur
       chargement est un autre travail. */
    const m = /^CARTE(?: GRISE)?\s+([A-Z]{2}\s*\d{3,4}\s*[A-Z]{1,3})/i.exec(f);
    if (!m) continue;
    const plaque = normaliser(m[1]!);
    const connue = parPlaque.get(plaque) ?? { plaque, ecrite: afficher(plaque), fichiers: [] };
    connue.fichiers.push(f);
    parPlaque.set(plaque, connue);
  }
  return [...parPlaque.values()].sort((a, b) => a.plaque.localeCompare(b.plaque));
}

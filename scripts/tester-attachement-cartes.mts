/* Ce que donnent les scans de cartes grises, avant d'approcher la base.
 *
 * `attacher-cartes-grises.mts` dépose ; ce banc-ci vérifie la moitié du travail
 * qui ne dépend de rien — lire les scans du dossier DO et les recomposer :
 *
 *   * que **chaque plaque du dossier rend au moins une page**. C'est la
 *     vérification qui compte : une image refusée sort du lot en silence, et
 *     le véhicule reste sans pièce sans que personne le sache. Huit .docx sont
 *     passés par là — leurs JPEG étaient valides, mais rangés sans compression
 *     dans l'archive, donc lus comme une vue décalée que pdf-lib jugeait
 *     dépourvue d'en-tête ;
 *   * qu'aucune page n'est perdue en chemin : autant de pages posées que
 *     d'images trouvées ;
 *   * que le PDF sorti est bien un PDF, et qu'il tient sous le plafond du seau.
 *
 * Il ne lit que des fichiers et n'écrit rien. Il a besoin du dossier DO : sans
 * lui, il le dit et s'arrête sans échouer — tout le monde n'a pas le partage.
 *
 * Lancer : npx tsx scripts/tester-attachement-cartes.mts */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { cartesDuDossier, composerSousPlafond, pages, DOSSIER, PLAFOND } from "./scans-cartes-grises.mts";

if (!existsSync(DOSSIER)) {
  console.log(`Dossier des cartes grises absent de ce poste — banc ignoré.\n  ${DOSSIER}`);
  process.exit(0);
}

const echecs: string[] = [];
const alerte = (m: string) => echecs.push(m);

const cartes = cartesDuDossier();
if (cartes.length < 70) alerte(`${cartes.length} plaques reconnues au dossier : la lecture des noms de fichiers a régressé.`);

let octets = 0;
let pagesPosees = 0;
const lourds: string[] = [];
const partiels: string[] = [];
const alleges: string[] = [];

for (const c of cartes) {
  const images = (await Promise.all(c.fichiers.map((f) => pages(join(DOSSIER, f))))).flat();
  if (images.length === 0) {
    alerte(`${c.ecrite} : aucune image tirée de ${c.fichiers.join(", ")}`);
    continue;
  }
  const { pdf, posees, ecartees, palier } = await composerSousPlafond(images, `Carte grise ${c.ecrite}`);
  if (palier) alleges.push(`${c.ecrite} (${palier})`);
  if (posees === 0) {
    alerte(`${c.ecrite} : ${images.length} image(s) trouvée(s), aucune posée.`);
    continue;
  }
  if (ecartees > 0) partiels.push(`${c.ecrite} ${posees}/${images.length}`);
  if (Buffer.from(pdf.subarray(0, 5)).toString() !== "%PDF-") alerte(`${c.ecrite} : la sortie n'est pas un PDF.`);
  if (pdf.byteLength > PLAFOND) lourds.push(`${c.ecrite} ${(pdf.byteLength / 1024 / 1024).toFixed(1)} Mo`);
  octets += pdf.byteLength;
  pagesPosees += posees;
}

const deposables = cartes.length - echecs.length - lourds.length;
console.log(`${cartes.length} plaques · ${pagesPosees} pages · ${deposables} PDF déposables, ${(octets / 1024 / 1024).toFixed(1)} Mo au total`);

/* Le réemballage ne recompresse pas : seul ce qui dépasse le plafond est
   réencodé, et le banc dit lequel et à quel palier — sans quoi une perte de
   qualité passerait inaperçue. Un scan qui resterait trop lourd même réencodé
   est un constat, pas une régression : il est dit, pas compté en échec. */
if (alleges.length) console.log(`\nRéencodés pour tenir sous les 5 Mo du seau : ${alleges.join(", ")}`);
if (lourds.length) console.log(`À traiter à la main, trop lourds même réencodés : ${lourds.join(", ")}`);
if (partiels.length) console.log(`Partiellement lisibles, le reste est posé : ${partiels.join(", ")}`);

if (echecs.length) {
  console.error(`\n${echecs.length} anomalie(s) :\n  ${echecs.join("\n  ")}`);
  process.exit(1);
}
console.log("\nToutes les plaques du dossier rendent une pièce.");

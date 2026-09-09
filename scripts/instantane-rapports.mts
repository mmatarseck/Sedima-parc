/* Photographie des rapports de démonstration : chaque rapport, contexte par
 * défaut et période « 12 mois », écrit en JSON — pour vérifier qu'un
 * remaniement ne change pas une ligne. Lancer : npx tsx scripts/instantane-rapports.mts <dossier> [comparer] */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RAPPORTS } from "../src/domaine/rapports";
import { PARAMETRES_DEFAUT } from "../src/domaine/parametres";
import { construireRapport, CONTEXTE_PAR_DEFAUT } from "../src/donnees/rapports-demo";

const dossier = process.argv[2] ?? ".";
const comparer = process.argv[3] === "comparer";
mkdirSync(dossier, { recursive: true });
let ecarts = 0;
for (const r of RAPPORTS) {
  const lignes = construireRapport(r.id, CONTEXTE_PAR_DEFAUT, PARAMETRES_DEFAUT);
  const texte = JSON.stringify(lignes);
  const chemin = join(dossier, `${r.id}.json`);
  if (comparer) {
    const avant = readFileSync(chemin, "utf8");
    const meme = avant === texte;
    if (!meme) ecarts++;
    console.log(`${meme ? "ok " : "ÉCHEC"} ${r.id} : ${lignes.length} lignes${meme ? "" : ` (avant ${JSON.parse(avant).length})`}`);
  } else {
    writeFileSync(chemin, texte);
    console.log(`${r.id} : ${lignes.length} lignes`);
  }
}
console.log(comparer ? (ecarts ? `${ecarts} rapport(s) changé(s)` : "aucun écart") : "photographié");
process.exit(ecarts ? 1 : 0);

/* Aperçu de classeurs : pour chaque feuille, ses dimensions et ses premières
 * lignes non vides. Sert à reconnaître une source avant d'écrire son
 * chargement — rien n'est écrit, rien n'est chargé.
 *
 * Lancer : npx tsx scripts/apercu-classeurs.mts <lignes> <classeur.xlsx> [...] */
import { lireClasseur } from "./lire-xlsx.mts";

const [brut, ...fichiers] = process.argv.slice(2);
const n = Number(brut) || 8;
for (const f of fichiers) {
  console.log(`\n########## ${f}`);
  try {
    for (const feuille of lireClasseur(f)) {
      const pleines = feuille.lignes.filter((l) => l.some((c) => String(c ?? "").trim() !== ""));
      console.log(`\n--- feuille « ${feuille.nom} » : ${pleines.length} lignes non vides`);
      for (const l of pleines.slice(0, n)) console.log("   ", l.map((c) => String(c ?? "").trim().slice(0, 28)).join(" | ").slice(0, 400));
    }
  } catch (e) {
    console.log("   illisible :", (e as Error).message);
  }
}

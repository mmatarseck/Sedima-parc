/* Une lecture qui échoue arrête la page ; une lecture vide rend une liste vide.
 *
 * Quinze lecteurs avertissaient dans le journal du serveur puis rendaient zéro
 * (corrigé le 15 septembre 2026). Un rapport affichait alors « 0 dépense » là
 * où la vérité était « je n'ai pas pu regarder », et personne ne pouvait faire
 * la différence. Ce banc tient les deux moitiés de la règle, et vérifie qu'il
 * ne reste aucun lecteur muet dans `src/donnees`.
 *
 * Lancer : npx tsx scripts/tester-lectures-muettes.mts */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ErreurLecture, lignesLues } from "../src/donnees/lecture";

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => { console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`); if (!ok) echecs++; };

/* -- La règle elle-même ---------------------------------------------------- */

attendu("des lignes lues passent telles quelles", lignesLues("Essais", { data: [1, 2, 3], error: null }).length === 3);
attendu("une lecture vide rend une liste vide, sans bruit", lignesLues("Essais", { data: [], error: null }).length === 0);
attendu("une lecture nulle sans erreur rend une liste vide", lignesLues("Essais", { data: null, error: null }).length === 0);

let leve: unknown = null;
try { lignesLues("Dépenses de caisse", { data: null, error: { message: "permission denied for table depense" } }); } catch (e) { leve = e; }
attendu("une lecture en erreur lève au lieu de rendre zéro", leve instanceof ErreurLecture);
attendu(
  `le message nomme ce qu'on lisait et pourquoi (${leve instanceof Error ? leve.message : "—"})`,
  leve instanceof Error && leve.message.includes("Dépenses de caisse") && leve.message.includes("permission denied"),
);
/* Une erreur accompagnée de données n'est pas une demi-réussite : PostgREST ne
   rend pas les deux, et si cela arrivait, la lecture reste suspecte. */
let leveAvecDonnees = false;
try { lignesLues("Essais", { data: [1], error: { message: "réseau" } }); } catch { leveAvecDonnees = true; }
attendu("une erreur l'emporte sur des données partielles", leveAvecDonnees);

/* -- Plus aucun lecteur muet ----------------------------------------------- */
/* Le motif interdit : avertir puis rendre une liste vide. On le cherche dans
   tous les lecteurs, pour qu'un nouveau ne réintroduise pas le défaut. */

const dossier = join(process.cwd(), "src/donnees");
/* Ces quatre-là sont des **détours**, pas des silences : la fonction d'un coup
   n'est pas jouée, on relit ailleurs et on rend les mêmes données — ou bien
   l'écran porte lui-même le mot « illisible » (les attelages d'une fiche). */
const TOLERES = new Map<string, string[]>([
  ["fiche.ts", ["Attelages", "lire_fiche() indisponible"]],
  ["fiche-chauffeur.ts", ["lire_fiches_chauffeurs() indisponible"]],
  ["prestataires.ts", ["lire_prestataires() indisponible"]],
  ["tableau-bord.ts", ["lire_tableau() indisponible"]],
  ["transporteurs.ts", ["lire_transporteurs() indisponible"]],
]);

const muets: string[] = [];
for (const f of readdirSync(dossier).filter((x) => x.endsWith(".ts") && !x.endsWith("-demo.ts"))) {
  const texte = readFileSync(join(dossier, f), "utf8");
  for (const ligne of texte.split("\n")) {
    if (!ligne.includes("console.warn")) continue;
    const tolere = (TOLERES.get(f) ?? []).some((motif) => ligne.includes(motif));
    if (!tolere) muets.push(`${f} : ${ligne.trim().slice(0, 80)}`);
  }
}
attendu(`aucun lecteur ne se contente d'avertir${muets.length ? ` — ${muets.join(" | ")}` : ""}`, muets.length === 0);

/* Et la règle est bien employée : autant de lecteurs l'appellent qu'on en a repris. */
const appelants = readdirSync(dossier).filter((f) => f.endsWith(".ts") && readFileSync(join(dossier, f), "utf8").includes("lignesLues("));
attendu(`la règle sert dans ${appelants.length} lecteurs`, appelants.length >= 15);

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);

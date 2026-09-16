/* L'atelier montre une ligne par fait : une intervention et la dépense née du
 * même bon de commande — jumelles par leur suffixe — se lisent ensemble.
 * Décision du métier du 16 septembre 2026 (« A » : fusionner à l'affichage).
 * Lancer : npx tsx scripts/tester-atelier.mts */
import { apparierAtelier, suffixeDe } from "../src/domaine/atelier";

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => { console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`); if (!ok) echecs++; };

attendu("le suffixe d'INT-C-00034 est C-00034", suffixeDe("INT-C-00034") === "C-00034");
attendu("celui de DEP-R-00002 est R-00002", suffixeDe("DEP-R-00002") === "R-00002");
attendu("une dépense de caisse n'a pas de suffixe d'atelier", suffixeDe("DEP-CP-03881") === "CP-03881" && suffixeDe("CAI-2026-00001") === null);

const interventions = [{ numero: "INT-C-00034", montant: 85000 }, { numero: "INT-R-00002", montant: 120000 }, { numero: "INT-2026-90001", montant: 5000 }];
const depenses = [{ numero: "DEP-C-00034", montant: 85000 }, { numero: "DEP-R-00002", montant: 120000 }, { numero: "DEP-CP-03881", montant: 10000 }, { numero: "DEP-R-00099", montant: 1 }];
const r = apparierAtelier(interventions, depenses);
attendu(`deux paires (${r.paires.map((p) => p.intervention.numero).join(", ")})`, r.paires.length === 2 && r.paires.every((p) => suffixeDe(p.intervention.numero) === suffixeDe(p.depense.numero)));
attendu("l'intervention saisie dans l'application reste seule", r.interventionsSeules.length === 1 && r.interventionsSeules[0]!.numero === "INT-2026-90001");
attendu("la dépense de caisse et la dépense sans intervention restent seules", r.depensesSeules.map((d) => d.numero).sort().join(",") === "DEP-CP-03881,DEP-R-00099");
attendu("rien ne se perd : lignes fusionnées + seules = interventions + dépenses − paires", r.paires.length + r.interventionsSeules.length + r.depensesSeules.length === interventions.length + depenses.length - r.paires.length);

/* Deux interventions au même suffixe : la dépense ne se donne qu'une fois. */
const double = apparierAtelier([{ numero: "INT-C-00034" }, { numero: "INT-C-00034" }], [{ numero: "DEP-C-00034" }]);
attendu("une dépense ne se compte qu'une fois, même face à un doublon d'intervention", double.paires.length === 1 && double.interventionsSeules.length === 1);

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);

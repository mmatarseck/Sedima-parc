/* ============================================================================
 * Banc des rapports de maintenance du 3 octobre 2026 : le respect du plan
 * préventif, et les pièces par tâche. Pur : la source de démonstration,
 * recouverte des quelques lignes que chaque contrôle demande.
 *
 *   node --import tsx --import ./scripts/rendu/hook.mjs scripts/tester-rapports-maintenance.mts
 * ==========================================================================*/

import { construireRapportDe, passageALHeure, passagesDeLOperation, type SourceRapports } from "../src/domaine/assembler-rapports";
import { RAPPORTS } from "../src/domaine/rapports";
import { PROGRAMMES } from "../src/donnees/entretien-demo";
import { sourceRapportsDemo } from "../src/donnees/rapports-demo";

let echecs = 0;
function attendu(libelle: string, ok: boolean) {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
}

const demo = sourceRapportsDemo();
attendu("les deux rapports sont au catalogue, famille maintenance", ["maintenance-plan-preventif", "maintenance-pieces-taches"].every((id) => RAPPORTS.find((r) => r.id === id)?.famille === "maintenance"));

/* -- Le respect du plan ------------------------------------------------------- */

const leger = PROGRAMMES.find((p) => p.code === "leger")!;
const vidange = leger.operations.find((o) => o.code === "vidange-moteur")!; // 10 000 km ou 12 mois
attendu("à l'heure : 9 000 km et 10 mois après le précédent", passageALHeure(vidange, { date: "2025-01-01", km: 50_000 }, { date: "2025-11-01", km: 59_000 }));
attendu("à l'heure : 10 800 km, dans la tolérance de 10 %", passageALHeure(vidange, { date: "2025-01-01", km: 50_000 }, { date: "2025-11-01", km: 60_800 }));
attendu("en retard : 12 000 km après le précédent", !passageALHeure(vidange, { date: "2025-01-01", km: 50_000 }, { date: "2025-11-01", km: 62_000 }));
attendu("en retard : 15 mois après, même sans kilométrage", !passageALHeure(vidange, { date: "2025-01-01", km: null }, { date: "2026-04-01", km: null }));
attendu(
  "un passage se reconnaît à la tâche du catalogue, ou à l'objet",
  passagesDeLOperation({ ...vidange, tacheLibelle: "Remplacement de l'huile moteur et du filtre" }, [
    { numero: "A", date: "2026-01-01", objet: "Entretien", km: null, taches: ["Remplacement de l'huile moteur et du filtre"] },
    { numero: "B", date: "2025-01-01", objet: "Vidange + filtres", km: null },
    { numero: "C", date: "2025-06-01", objet: "Freins", km: null },
  ]).map((p) => p.numero).join() === "B,A",
);

/* Un véhicule de la démonstration, rendu léger : il suit le programme « leger ». */
const base = demo.lignes[0]!;
const ligne = { ...base, vehicule: { ...base.vehicule, categorie: "vehicule-leger" as const, marque: "Essai", appellation: "Léger", engage: true } };
const v = ligne.vehicule;
const intervention = (numero: string, date: string, km: number) => ({ numero, date, type: "preventif" as const, objet: "Vidange moteur", garage: "—", km, immobilisationJours: null, montant: 50_000, reference: numero, vehiculeId: v.id, immatriculation: v.immatriculation, immatriculationAffichee: v.immatriculationAffichee, vehicule: `${v.marque} ${v.appellation}`, businessUnit: v.businessUnit, site: null, creee: false });
const source: SourceRapports = {
  ...demo,
  aujourdhui: "2026-10-03",
  lignes: [{ ...ligne, kilometrage: 75_000 }],
  /* 2024 : premier passage, non jugé ; 2025 : à l'heure ; 2026 : 13 000 km après, en retard. */
  interventions: [intervention("INT-1", "2024-03-01", 40_000), intervention("INT-2", "2025-01-15", 49_000), intervention("INT-3", "2026-01-10", 62_000)],
  programmes: PROGRAMMES,
};
const plan = construireRapportDe(source, "maintenance-plan-preventif", { periode: { preset: "tout", debut: null, fin: null }, perimetre: "exploitation" } as never);
const ligneVidange = plan.find((l) => l.operation === "Vidange moteur et filtres");
attendu(
  `respect du plan : 3 passages, le premier non jugé, 1 à l'heure, 1 en retard, l'échéance dépassée compte en oubli → 33 % (${ligneVidange?.passages}, ${ligneVidange?.aLHeure}, ${ligneVidange?.enRetard}, ${ligneVidange?.respect} %, ${(ligneVidange?.etat as { libelle?: string } | undefined)?.libelle})`,
  ligneVidange?.passages === 3 && ligneVidange.aLHeure === 1 && ligneVidange.enRetard === 1 && ligneVidange.respect === 33 && (ligneVidange.etat as { libelle: string }).libelle === "Dépassée" && ligneVidange.dernierNumero === "INT-3",
);
attendu("une ligne par opération du programme du véhicule", plan.length === leger.operations.length);

/* -- Les pièces par tâche ------------------------------------------------------ */

const service = (numero: string, statut: string, lignes: unknown[]) => ({ ...demo.ordres[0]!, numero, statut, immatriculation: numero === "OTR-2" ? "AA111AA" : "AA222BB", datePrevue: "2026-09-20", dateCloture: "2026-09-21", lignes }) as never;
const filtre = { cle: "f", tacheNumero: null, libelle: "Remplacement du filtre à huile", systeme: null, mainOeuvre: 5_000, remiseMode: "montant", remiseValeur: 0 };
const pieces = construireRapportDe(
  {
    ...demo,
    aujourdhui: "2026-10-03",
    ordres: [
      service("OTR-1", "clos", [{ ...filtre, piecesAchetees: 0, piecesStock: [{ pieceNumero: "PCE-12", designation: "Filtre à huile", quantite: 2, prixUnitaire: 4_500 }] }]),
      service("OTR-2", "clos", [{ ...filtre, piecesAchetees: 12_000, piecesStock: [{ pieceNumero: "PCE-12", designation: "Filtre à huile", quantite: 1, prixUnitaire: 4_500 }] }]),
      service("OTR-3", "planifie", [{ ...filtre, piecesAchetees: 99_000, piecesStock: [] }]),
    ],
  },
  "maintenance-pieces-taches",
  { periode: { preset: "tout", debut: null, fin: null }, perimetre: "exploitation" } as never,
);
const magasin = pieces.find((p) => p.reference === "PCE-12");
const achat = pieces.find((p) => (p.origine as { libelle: string }).libelle === "Achat");
attendu(`pièces : le filtre du magasin cumulé sur deux services, 3 unités, 13 500 F (${magasin?.quantite}, ${magasin?.valeur}, ${magasin?.services} services)`, magasin?.quantite === 3 && magasin.valeur === 13_500 && magasin.services === 2 && magasin.vehicules === 2);
attendu(`pièces achetées : une ligne à part, sans quantité, 12 000 F ; le service non clos n'entre pas (${pieces.length} lignes)`, achat?.valeur === 12_000 && achat.quantite === null && pieces.length === 2);

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
if (echecs) process.exit(1);

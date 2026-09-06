/* ============================================================================
 * Les programmes d'entretien et leur application aux véhicules.
 *
 * **Les périodicités reprennent celles que la fiche affichait déjà** — vidange
 * aux 15 000 km sur un porteur, aux 10 000 sur un léger, graissage aux 5 000,
 * boîte et pont aux 60 000, courroie aux 100 000 — mais elles cessent d'être du
 * texte : elles se comptent, se confrontent au compteur et à l'historique, et
 * ressortent en échéance.
 *
 * Quatre programmes, parce que quatre familles s'entretiennent différemment :
 * le porteur et le tracteur, la remorque (aucun moteur, tout le freinage), le
 * léger, et l'engin — le seul qui compte des **heures**.
 *
 * En production : tables `programme_entretien`, `operation_entretien` et
 * `plan_vehicule`, les deux premières tenues aux Paramètres par le responsable
 * de parc, la troisième par l'atelier véhicule par véhicule.
 * ==========================================================================*/

import type { AjustementOperation, DernierPassage, OperationEntretien, PlanVehicule, ProgrammeEntretien } from "@/domaine/entretien";
import { reconnaitOperation } from "@/domaine/entretien";
import type { CategorieVehicule } from "@/domaine/types";

/* -- Les gabarits ----------------------------------------------------------- */

const op = (
  code: string,
  libelle: string,
  groupe: OperationEntretien["groupe"],
  periodicite: Partial<OperationEntretien["periodicite"]>,
  motsCles: string[],
  dureeHeures: number,
  coutEstime: number,
  critique = false,
): OperationEntretien => ({
  code,
  libelle,
  groupe,
  periodicite: { km: periodicite.km ?? null, heures: periodicite.heures ?? null, mois: periodicite.mois ?? null },
  motsCles,
  dureeHeures,
  coutEstime,
  critique,
});

export const PROGRAMMES: ProgrammeEntretien[] = [
  {
    code: "porteur-lourd",
    libelle: "Poids lourd — porteur et tracteur",
    precision: "Vrac, sacherie et traction. Périodicités resserrées : la piste et la surcharge usent plus vite que la route.",
    categories: ["camion", "tracteur"],
    base: "km",
    operations: [
      op("vidange-moteur", "Vidange moteur et filtres", "moteur", { km: 15_000, mois: 12 }, ["vidange"], 3, 118_500),
      op("filtres-air-gasoil", "Filtre à air et filtre à gasoil", "moteur", { km: 30_000, mois: 12 }, ["filtre à air", "filtre à gasoil", "filtres"], 2, 62_000),
      op("graissage-chassis", "Graissage du châssis", "chassis", { km: 5_000, mois: 2 }, ["graissage"], 1, 18_000),
      op("garnitures-frein", "Contrôle des garnitures de frein", "freinage", { km: 30_000, mois: 6 }, ["frein", "garniture", "plaquette"], 4, 245_000, true),
      op("boite-pont", "Huile de boîte et de pont", "transmission", { km: 60_000, mois: 24 }, ["boîte", "pont"], 4, 195_000),
      op("pneumatiques", "Contrôle des pneumatiques", "pneumatiques", { mois: 1 }, ["pneu", "permutation"], 1, 12_000, true),
      op("suspension-direction", "Contrôle suspension et direction", "securite", { km: 45_000, mois: 12 }, ["suspension", "direction", "amortisseur"], 3, 165_000, true),
    ],
  },
  {
    code: "remorque",
    libelle: "Semi-remorque",
    precision: "Pas de moteur : tout se joue sur le freinage, les pneumatiques et le châssis.",
    categories: ["semi-remorque"],
    base: "km",
    operations: [
      op("garnitures-frein", "Contrôle des garnitures de frein", "freinage", { km: 30_000, mois: 6 }, ["frein", "garniture", "plaquette"], 4, 210_000, true),
      op("graissage-chassis", "Graissage du châssis et de la sellette", "chassis", { km: 5_000, mois: 2 }, ["graissage", "sellette"], 1, 15_000),
      op("pneumatiques", "Contrôle des pneumatiques", "pneumatiques", { mois: 1 }, ["pneu", "permutation"], 1, 12_000, true),
      op("moyeux", "Graissage et jeu des moyeux", "chassis", { km: 60_000, mois: 24 }, ["moyeu", "roulement"], 4, 145_000),
      op("feux-signalisation", "Feux et signalisation", "securite", { mois: 3 }, ["feu", "signalisation", "éclairage"], 1, 25_000, true),
    ],
  },
  {
    code: "leger",
    libelle: "Véhicule léger et camionnette",
    precision: "Livraison, liaison et direction. Le kilométrage tombe vite, la courroie décide de la longévité.",
    categories: ["camionnette", "vehicule-leger", "bus", "moto"],
    base: "km",
    operations: [
      op("vidange-moteur", "Vidange moteur et filtres", "moteur", { km: 10_000, mois: 12 }, ["vidange"], 2, 62_000),
      op("filtre-air", "Filtre à air", "moteur", { km: 20_000, mois: 12 }, ["filtre à air", "filtres"], 1, 28_000),
      op("plaquettes-frein", "Contrôle des plaquettes de frein", "freinage", { km: 20_000, mois: 12 }, ["frein", "plaquette"], 2, 85_000, true),
      op("courroie-distribution", "Courroie de distribution", "moteur", { km: 100_000, mois: 60 }, ["courroie", "distribution"], 6, 320_000, true),
      op("permutation-pneus", "Permutation des pneus", "pneumatiques", { km: 15_000, mois: 6 }, ["pneu", "permutation"], 1, 15_000),
      op("climatisation", "Entretien de la climatisation", "chassis", { mois: 12 }, ["clim"], 2, 45_000),
    ],
  },
  {
    code: "engin",
    libelle: "Engin de manutention",
    precision: "Il ne roule pas, il travaille : c'est le compteur horaire qui commande, jamais le kilométrage.",
    categories: ["engin"],
    base: "heures",
    operations: [
      op("vidange-moteur", "Vidange moteur et filtres", "moteur", { heures: 500, mois: 12 }, ["vidange"], 3, 95_000),
      op("hydraulique", "Huile et filtres hydrauliques", "transmission", { heures: 1_000, mois: 24 }, ["hydraulique"], 4, 185_000),
      op("graissage-chassis", "Graissage général", "chassis", { heures: 250, mois: 2 }, ["graissage"], 1, 18_000),
      op("freins-engin", "Contrôle du freinage", "freinage", { heures: 1_000, mois: 12 }, ["frein"], 3, 120_000, true),
      op("securite-levage", "Contrôle du dispositif de levage", "securite", { heures: 1_000, mois: 12 }, ["levage", "mât", "fourche"], 4, 210_000, true),
    ],
  },
];

const PAR_CODE = new Map(PROGRAMMES.map((p) => [p.code, p]));

export function programmeParCode(code: string): ProgrammeEntretien | null {
  return PAR_CODE.get(code) ?? null;
}

/** Le gabarit qu'une catégorie reçoit par défaut. Le léger sert de filet. */
export function programmeParDefaut(categorie: CategorieVehicule): ProgrammeEntretien {
  return PROGRAMMES.find((p) => p.categories.includes(categorie)) ?? PROGRAMMES.find((p) => p.code === "leger")!;
}

/* -- Les ajustements, véhicule par véhicule --------------------------------- */

/*
 * Trois véhicules s'écartent du gabarit, et chacun dit pourquoi. C'est la
 * moitié de la demande du métier : le programme est standard, mais un véhicule
 * qui travaille autrement que les autres doit pouvoir s'en écarter **par
 * écrit**. Sans motif, une périodicité resserrée passe pour une erreur de
 * saisie à la première revue de coûts.
 */
const AJUSTEMENTS: Record<string, AjustementOperation[]> = {
  /* Une camionnette commerciale qui tourne sur piste : le gabarit léger prévoit
     10 000 km entre deux vidanges, la poussière n'attend pas jusque-là. */
  AA032EA: [
    { code: "vidange-moteur", km: 7_500, motif: "Tournées sur piste latéritique : poussière permanente, vidange resserrée sur avis du garage" },
    { code: "permutation-pneus", km: 10_000, motif: "Usure avant marquée sur les tournées de Thiès" },
  ],
  /* Un porteur dont le moteur a été refait : on resserre le temps du rodage,
     puis on reviendra au gabarit — d'où le motif, qui dit jusqu'à quand. */
  AA985MR: [{ code: "vidange-moteur", km: 12_000, motif: "Moteur reconditionné en 2025 — périodicité intermédiaire le temps du rodage" }],
  /* Le cas d'école du retrait : une opération qui n'a aucun sens sur ce
     véhicule-là. Un chariot électrique n'a pas de moteur à vidanger. */
  AA412UB: [{ code: "vidange-moteur", retiree: true, motif: "Chariot électrique : aucun moteur thermique à vidanger" }],
};

/** Le plan appliqué à un véhicule : son gabarit, et ce qu'il en change. */
export function planDuVehicule(vehiculeId: string, categorie: CategorieVehicule): PlanVehicule {
  return {
    vehiculeId,
    programmeCode: programmeParDefaut(categorie).code,
    ajustements: AJUSTEMENTS[vehiculeId] ?? [],
  };
}

/* -- Le rapprochement avec l'historique ------------------------------------- */

/**
 * Le dernier passage de chaque opération, reconnu dans les interventions.
 *
 * L'historique est du **texte libre** : « Vidange + permutation pneus » vaut
 * pour deux opérations, et rien ne dit que le graissage a été fait. On retient
 * la plus récente intervention dont l'objet cite l'opération ; les opérations
 * qu'aucune intervention ne cite restent sans référence, et l'écran le dit
 * plutôt que de les déclarer à jour.
 */
export function passagesReleves(
  programme: ProgrammeEntretien,
  interventions: { numero: string; date: string; objet: string; km: number | null }[],
  heuresParJour: number,
  compteurHeures: number | null,
  aujourdhui: string,
): Map<string, DernierPassage> {
  const passages = new Map<string, DernierPassage>();
  const triees = [...interventions].sort((a, b) => b.date.localeCompare(a.date));
  for (const operation of programme.operations) {
    const trouvee = triees.find((i) => reconnaitOperation(operation, i.objet));
    if (!trouvee) continue;
    /* Le compteur horaire n'est pas relevé à l'intervention : on le reconstitue
       depuis la date, faute de mieux, et le jour où l'atelier le saisira ce
       calcul disparaîtra. */
    const heures =
      compteurHeures === null ? null : Math.max(0, Math.round(compteurHeures - (Date.parse(`${aujourdhui}T00:00:00Z`) - Date.parse(`${trouvee.date}T00:00:00Z`)) / 86_400_000 * heuresParJour));
    /* Sur un programme horaire, le kilométrage de l'intervention n'a pas de
       sens — un chariot élévateur n'en compte pas. On ne le retient pas plutôt
       que de l'afficher à côté d'heures. */
    const km = programme.base === "heures" ? null : trouvee.km;
    passages.set(operation.code, { date: trouvee.date, km, heures, numero: trouvee.numero, objet: trouvee.objet });
  }
  return passages;
}

/* Les deux rapports du 21 septembre 2026 : « Immobilisations et
 * amortissements » (les colonnes du tableau de la comptabilité, refaites
 * depuis les fiches) et « Renouvellement 2026 » (les seuls véhicules neufs,
 * immatriculés pour la première fois en 2026).
 * Lancer : npx tsx scripts/tester-immobilisations.mts */
import { tableauAmortissement } from "../src/domaine/amortissement";
import { construireRapportDe } from "../src/domaine/assembler-rapports";
import { RAPPORTS } from "../src/domaine/rapports";
import { sourceRapportsDemo } from "../src/donnees/rapports-demo";

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

/* -- Le tableau d'une période ------------------------------------------------ */

/* Le Hilux AB 900 JW du grand livre : 24 250 000 F, quatre ans, acquis le 3 juillet 2026 ; la comptabilité lui donne 985 743 F de dotation au 31 août. */
const hilux = tableauAmortissement({ valeurAcquisition: 24_250_000, dureeAmortissementAnnees: 4, premiereMiseEnCirculation: "2026-07-03", dateAcquisition: "2026-07-03" }, "2026-01-01", "2026-08-31");
attendu(`un achat en cours d'exercice : rien au début, dotation proche de la comptabilité (${hilux.dotation})`, hilux.cumulDebut === 0 && Math.abs((hilux.dotation ?? 0) - 985_743) / 985_743 < 0.02);
attendu("la valeur nette est la valeur moins le cumul, et le taux est 25 %", hilux.valeurNetteFin === 24_250_000 - hilux.cumulFin! && hilux.tauxPct === 25 && hilux.finAmortissement === "2030-07-03");

/* Le Berlingo de 2021, cinq ans : 10 990 000 F, cumul début 9 878 789, dotation 740 807 (huit mois) à la comptabilité. */
const berlingo = tableauAmortissement({ valeurAcquisition: 10_990_000, dureeAmortissementAnnees: 5, premiereMiseEnCirculation: "2021-06-28", dateAcquisition: "2021-07-06" }, "2026-01-01", "2026-08-31");
attendu(`en fin de vie : le cumul au début suit la comptabilité (${berlingo.cumulDebut})`, Math.abs((berlingo.cumulDebut ?? 0) - 9_878_789) / 9_878_789 < 0.02);
attendu(`la dotation s'arrête à la valeur : tout est amorti au 31 août (${berlingo.dotation})`, berlingo.cumulFin === 10_990_000 && berlingo.valeurNetteFin === 0 && berlingo.dotation === 10_990_000 - berlingo.cumulDebut!);

const ancien = tableauAmortissement({ valeurAcquisition: 80_000_000, dureeAmortissementAnnees: 4, premiereMiseEnCirculation: "2015-01-29", dateAcquisition: "2015-01-21" }, "2026-01-01", "2026-08-31");
attendu("amorti de longue date : dotation nulle, valeur nette nulle", ancien.dotation === 0 && ancien.valeurNetteFin === 0 && ancien.cumulDebut === 80_000_000);
const inconnu = tableauAmortissement({ valeurAcquisition: null, dureeAmortissementAnnees: null, premiereMiseEnCirculation: "2020-01-01", dateAcquisition: null }, "2026-01-01", "2026-08-31");
attendu("sans valeur, rien ne se calcule — et rien ne s'invente", inconnu.dotation === null && inconnu.cumulFin === null && inconnu.valeurNetteFin === null);

/* -- Les rapports, sur la démonstration --------------------------------------- */

const s = sourceRapportsDemo();
attendu("les deux rapports sont au catalogue", RAPPORTS.some((r) => r.id === "couts-immobilisations") && RAPPORTS.some((r) => r.id === "parc-leger-renouvellement"));

/* Trois véhicules de la flotte reçoivent un prix : un neuf, une occasion, un amorti. */
const internes = s.lignes.filter((l) => l.vehicule.categorieFlotte === "interne");
const [neuf, occasion, vieux] = internes;
Object.assign(neuf!.vehicule, { valeurAcquisition: 20_000_000, dureeAmortissementAnnees: 4, dateAcquisition: "2026-03-01", referenceImmobilisation: "IMM-TEST-1" });
Object.assign(occasion!.vehicule, { valeurAcquisition: 12_000_000, dureeAmortissementAnnees: 4, premiereMiseEnCirculation: "2017-01-01", dateAcquisition: "2025-07-01" });
Object.assign(vieux!.vehicule, { valeurAcquisition: 9_000_000, dureeAmortissementAnnees: 4, dateAcquisition: "2012-01-01" });

const immos = construireRapportDe(s, "couts-immobilisations", { periode: { preset: "personnalisee", debut: "2026-01-01", fin: "2026-08-31" }, perimetre: "exploitation" });
attendu(`une ligne par véhicule en propriété (${immos.length})`, immos.length === internes.filter((l) => !l.vehicule.archiveLe).length && immos.length > 3);
const ligne = (plaque: string) => immos.find((l) => l.immatriculationCanonique === plaque)!;
const etatDe = (l: Record<string, unknown>) => (l.etatAmortissement as { libelle: string }).libelle;
attendu("le neuf : référence, dotation positive, en cours", ligne(neuf!.vehicule.id).reference === "IMM-TEST-1" && (ligne(neuf!.vehicule.id).dotation as number) > 0 && etatDe(ligne(neuf!.vehicule.id)) === "En cours");
attendu("l'occasion s'amortit depuis son achat, pas depuis 2017", (ligne(occasion!.vehicule.id).valeurNette as number) > 8_000_000);
attendu("l'amorti : valeur nette nulle, dit « Amorti »", ligne(vieux!.vehicule.id).valeurNette === 0 && etatDe(ligne(vieux!.vehicule.id)) === "Amorti");
const sansPrix = immos.filter((l) => l.valeurAcquisition === null);
attendu(`ce qui manque se voit : ${sansPrix.length} véhicules « à valoriser », sans montant inventé`, sansPrix.length > 0 && sansPrix.every((l) => etatDe(l) === "À valoriser" && l.dotation === null && l.valeurNette === null));
const colonnes = RAPPORTS.find((r) => r.id === "couts-immobilisations")!.colonnes.map((c) => c.cle);
attendu("chaque colonne du tableau de la comptabilité a sa colonne", ["reference", "businessUnit", "vehicule", "dateAcquisition", "valeurAcquisition", "cumulDebut", "dotation", "cumulFin", "finAmortissement", "duree", "taux", "valeurNette"].every((c) => colonnes.includes(c)));
attendu("et chaque colonne déclarée est servie", colonnes.every((c) => c in ligne(neuf!.vehicule.id)));

/* Le renouvellement : neuf, immatriculé, de 2026 — et rien d'autre. */
const legers = s.parcLeger.vehicules;
const avecLot = legers.filter((v) => v.lot !== null).length;
const renouvellement = construireRapportDe(s, "parc-leger-renouvellement");
const attendus = legers.filter((v) => v.immatriculation !== null && v.annee === 2026);
attendu(`seuls les véhicules de 2026 qui ont leur plaque (${renouvellement.length} sur ${avecLot} lignes de cascade)`, renouvellement.length === attendus.length && renouvellement.length < avecLot);
attendu("aucune occasion, aucun véhicule sans plaque", renouvellement.every((l) => l.immatriculationCanonique && attendus.some((v) => v.immatriculation === l.immatriculationCanonique)));
const colonnesR = RAPPORTS.find((r) => r.id === "parc-leger-renouvellement")!.colonnes.map((c) => c.cle);
attendu("chaque colonne du renouvellement est servie", renouvellement.length === 0 || colonnesR.every((c) => c in renouvellement[0]!));

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);

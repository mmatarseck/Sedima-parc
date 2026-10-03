/* ============================================================================
 * Banc du point du matin — les attelages comptés comme une seule unité.
 *
 * Métier, 3 octobre 2026 : « les groupes tracteur-remorque doivent être
 * présentés comme un seul véhicule (une seule capacité utile) ». Pur : aucune
 * base, des lignes de disponibilité écrites à la main.
 *
 *   node --import tsx scripts/tester-point-du-matin.mts
 * ==========================================================================*/

import type { LigneDisponibilite } from "../src/domaine/disponibilite";
import { avecAttelages, pointDuMatin, texteCourriel } from "../src/domaine/point-du-matin";

let echecs = 0;
function attendu(libelle: string, ok: boolean) {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
}

function ligne(immatriculation: string, modif: Partial<LigneDisponibilite>): LigneDisponibilite {
  return {
    vehiculeId: immatriculation,
    immatriculation,
    immatriculationAffichee: `${immatriculation.slice(0, 2)}-${immatriculation.slice(2, 5)}-${immatriculation.slice(5)}`,
    marque: "RENAULT",
    appellation: "",
    categorie: "camion",
    categorieFlotte: "lourd" as never,
    businessUnit: "aliment",
    regime: "exploitation",
    attributaire: null,
    usage: "plateau",
    transportSpecial: false,
    site: null,
    statutSaisi: "en-service",
    statutEffectif: "en-service",
    immobilisation: null,
    engage: true,
    chargeUtile: 10_000,
    conducteur: null,
    attelage: null,
    etat: "sans-conducteur",
    motif: null,
    ...modif,
  };
}

const chauffeur = { id: "c1", nom: "Gora Diop", role: "titulaire" as const, empechement: null, telephone: null };

/* Un plateau attelé, prêt : 31 t au tracteur, 31 t à la semi — 31 t, pas 62. */
const tracteur = ligne("AA737ZW", { categorie: "tracteur", chargeUtile: 31_000, conducteur: chauffeur, etat: "pret", attelage: { immatriculation: "AA713VE", role: "tracteur" } });
const semi = ligne("AA713VE", { categorie: "semi-remorque", chargeUtile: 31_000, attelage: { immatriculation: "AA737ZW", role: "remorque" } });
/* Un vrac dont le tracteur est en réparation : la semi ne roule pas seule. */
const tracteurArrete = ligne("AA927CA", { categorie: "tracteur", usage: "vrac", chargeUtile: 31_000, statutSaisi: "en-reparation", statutEffectif: "en-reparation", etat: "immobilise", attelage: { immatriculation: "AA053AP", role: "tracteur" } });
/* La base porte aussi l'attelage inversé (ATT-2025-90001) : la semi s'y dit tracteur. */
const semiVrac = ligne("AA053AP", { categorie: "semi-remorque", usage: "vrac", chargeUtile: 29_060, attelage: { immatriculation: "AA927CA", role: "tracteur" } });
/* Un vrac dont la semi est en panne : l'unité est immobilisée. */
const tracteurPret = ligne("AB932EF", { categorie: "tracteur", usage: "vrac", chargeUtile: 16_150, conducteur: chauffeur, etat: "pret", attelage: { immatriculation: "AB551HS", role: "tracteur" } });
const semiEnPanne = ligne("AB551HS", { categorie: "semi-remorque", usage: "vrac", chargeUtile: 24_320, statutSaisi: "en-panne" as never, statutEffectif: "en-reparation", etat: "immobilise", attelage: { immatriculation: "AB932EF", role: "remorque" } });
/* Un porteur seul, prêt. */
const porteur = ligne("AA100AA", { chargeUtile: 10_000, conducteur: chauffeur, etat: "pret" });

const parc = [semi, tracteur, semiVrac, tracteurArrete, tracteurPret, semiEnPanne, porteur];
const reduits = avecAttelages(parc);
attendu(`sept plaques, quatre unités (${reduits.length})`, reduits.length === 4);
attendu("l'unité porte la plaque du tracteur, jamais celle de la semi", reduits.map((l) => l.immatriculation).sort().join() === ["AA100AA", "AA737ZW", "AA927CA", "AB932EF"].sort().join());

const point = pointDuMatin(parc, [], "2026-10-03");
const sedima = point.bus.flatMap((b) => b.groupes).filter((g) => !g.tiers);
const prets = sedima.flatMap((g) => g.disponibles);
const plateau = prets.find((v) => v.immatriculation === "AA737ZW");
attendu(`le plateau attelé : une ligne, deux plaques, 31 t (${plateau?.immatriculationAffichee}, ${plateau?.capaciteTonnes} t)`, plateau?.immatriculationAffichee === "AA-737-ZW + AA-713-VE" && plateau.capaciteTonnes === 31 && plateau.remorque?.immatriculation === "AA713VE");
attendu(`prêts : le plateau et le porteur, 41 t en tout (${prets.length}, ${point.capacites.tonnes} t)`, prets.length === 2 && point.capacites.tonnes === 41 && point.totalVehicules === 2);
attendu("la semi n'apparaît pas « sans chauffeur »", sedima.every((g) => g.sansChauffeur.length === 0));
const vrac = point.immobilises.find((i) => i.immatriculation === "AA927CA");
attendu(`tracteur en réparation : l'unité immobilisée une fois, attelage inversé compris (${vrac?.immatriculationAffichee} — ${vrac?.motif})`, vrac?.immatriculationAffichee === "AA-927-CA + AA-053-AP" && point.immobilises.filter((i) => i.immatriculationAffichee.includes("AA-053-AP")).length === 1);
const panne = point.immobilises.find((i) => i.immatriculation === "AB932EF");
attendu(`semi en panne : l'unité immobilisée, le motif nomme la semi (${panne?.motif})`, panne?.motif.startsWith("semi AB-551-HS") === true && !prets.some((v) => v.immatriculation === "AB932EF"));
attendu("le courriel cite l'unité sous ses deux plaques", texteCourriel(point, "samedi 3 octobre 2026").includes("AA-737-ZW + AA-713-VE 31 t"));

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
if (echecs) process.exit(1);

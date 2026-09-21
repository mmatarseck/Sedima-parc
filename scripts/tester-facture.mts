/* La saisie d'une facture (métier, 21 septembre 2026) : l'en-tête une fois, les
 * lignes autant qu'il en faut, la pièce jointe sur chacune — depuis la fiche
 * véhicule ou la page Maintenance. Et plus aucun bouton qui ouvre un fichier
 * hors de l'application.
 * Lancer : node --import tsx --import ./scripts/rendu/hook.mjs scripts/tester-facture.mts */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { OuvrirPiece } from "../src/composants/interface/OuvrirPiece";
import { VisionneusePiece } from "../src/composants/interface/VisionneusePiece";
import { fabriquerDepense } from "../src/composants/transactions/fabriques";
import { FormulaireFacture, cleFacture, ecrituresDeLaFacture, type EntreeFacture } from "../src/composants/transactions/FormulaireFacture";
import { apparierAtelier, cleFactureDe } from "../src/domaine/atelier";
import type { Creation } from "../src/domaine/cloture";
import { ligneCreation } from "../src/lib/transactions-colonnes";

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

/* -- Ce que la facture écrit ---------------------------------------------------- */

const cle = cleFacture("2026-09-21", "k3f9");
attendu(`la clé de facture se lit dans une référence (${cle})`, cle === "FAC-260921-K3F9" && cleFactureDe(`F-2031 · ${cle}`) === cle && cleFactureDe("BC15526") === null);

const base: EntreeFacture = {
  mode: "atelier",
  date: "2026-09-21",
  fournisseur: "TATA INTERNATIONAL / UNITECH",
  numeroFacture: "F-2031",
  km: 245_300,
  origine: "facture",
  fichier: "pieces/documents/2026/09/2026-09-21-abc.pdf",
  type: "curatif",
  objet: "Embrayage et freins",
  immobilisationJours: 3,
  lignes: [
    { poste: "maintenance-curative", libelle: "Main d'œuvre", montant: 150_000 },
    { poste: "pieces", libelle: "Kit embrayage", montant: 420_000 },
    { poste: "pieces", libelle: "Plaquettes AV", montant: 65_000 },
  ],
  cle,
};
const atelier = ecrituresDeLaFacture(base);
attendu(`atelier : une intervention, puis une dépense par ligne (${atelier.map((e) => e.type).join(", ")})`, atelier.length === 4 && atelier[0]!.type === "intervention" && atelier.slice(1).every((e) => e.type === "depense"));
attendu("l'intervention porte le total, le garage, le compteur, l'immobilisation et l'objet", atelier[0]!.valeurs.montant === 635_000 && atelier[0]!.valeurs.garage === base.fournisseur && atelier[0]!.valeurs.km === 245_300 && atelier[0]!.valeurs.immobilisationJours === 3 && atelier[0]!.valeurs.objet === "Embrayage et freins");
attendu("chaque ligne porte la pièce jointe, le fournisseur, l'origine et la même référence", atelier.slice(1).every((e) => e.valeurs.photo === base.fichier && e.valeurs.beneficiaire === base.fournisseur && e.valeurs.origine === "facture" && e.valeurs.reference === `F-2031 · ${cle}` && e.valeurs.justificatif === true));
attendu("le compteur n'est relevé qu'une fois, sur l'intervention", atelier.slice(1).every((e) => e.valeurs.km === null));

const autres = ecrituresDeLaFacture({ ...base, mode: "autres", numeroFacture: "", lignes: [{ poste: "peage", libelle: "Péage Diamniadio", montant: 3_000 }, { poste: "frais-de-route", libelle: "Frais de mission", montant: 25_000 }] });
attendu("autres : des dépenses seules, sans intervention", autres.length === 2 && autres.every((e) => e.type === "depense"));
attendu("le compteur se lit sur la première ligne seulement, la clé seule sert de référence", autres[0]!.valeurs.km === 245_300 && autres[1]!.valeurs.km === null && autres[0]!.valeurs.reference === cle);

/* -- Ce que la base en reçoit ----------------------------------------------------- */

const r = { vehiculeId: "v-1", chauffeurId: null, prestataireId: "p-1" };
const ligneInt = ligneCreation("intervention", "INT-2026-90001", atelier[0]!.valeurs, r);
const ligneDep = ligneCreation("depense", "DEP-2026-90007", atelier[2]!.valeurs, r);
attendu("l'intervention s'écrit, au total de la facture", "ligne" in ligneInt && ligneInt.ligne.montant === 635_000 && ligneInt.ligne.prestataire_id === "p-1");
attendu("la dépense s'écrit avec sa pièce jointe et son justificatif", "ligne" in ligneDep && ligneDep.ligne.photo === base.fichier && ligneDep.ligne.justificatif === true && ligneDep.ligne.poste === "pieces");

/* -- Ce que l'atelier en montre ---------------------------------------------------- */

const depenses = [
  { numero: "DEP-2026-90005", reference: `F-2031 · ${cle}`, montant: 150_000 },
  { numero: "DEP-2026-90006", reference: `F-2031 · ${cle}`, montant: 420_000 },
  { numero: "DEP-2026-90007", reference: `F-2031 · ${cle}`, montant: 65_000 },
  { numero: "DEP-C-00034", reference: "BC1", montant: 85_000 },
  { numero: "DEP-2026-90008", reference: null, montant: 9_000 },
];
const interventions = [
  { numero: "INT-2026-90008", reference: `F-2031 · ${cle}` },
  { numero: "INT-C-00034", reference: "BC1" },
];
const a = apparierAtelier(interventions, depenses);
const facture = a.paires.find((p) => p.intervention.numero === "INT-2026-90008");
attendu(`la facture saisie fait une ligne d'atelier avec ses ${facture?.lignes.length ?? 0} lignes`, facture?.lignes.length === 3 && facture.lignes.reduce((s, d) => s + d.montant, 0) === 635_000);
attendu("la clé passe devant le suffixe : DEP-2026-90008 reste seule malgré le même suffixe", a.depensesSeules.map((d) => d.numero).join() === "DEP-2026-90008");
attendu("les paires des chargements se font toujours par le suffixe", a.paires.some((p) => p.intervention.numero === "INT-C-00034" && p.depense.numero === "DEP-C-00034" && p.lignes.length === 1));

const creation: Creation = { numero: "DEP-2026-90005", type: "depense", sujet: "vehicule:AA565GA", date: "2026-09-21T10:00:00Z", valeurs: atelier[1]!.valeurs } as unknown as Creation;
attendu("une dépense tout juste créée garde sa pièce jointe dans la fiche", fabriquerDepense(creation).photo === base.fichier && fabriquerDepense(creation).justificatif === true);

/* -- Le formulaire ------------------------------------------------------------------ */

const libelles = (html: string) => [...html.matchAll(/class="label-champ">([^<]+)/g)].map((m) => m[1]!.replace(/&#x27;/g, "'").trim());
const depuisMaintenance = renderToString(React.createElement(FormulaireFacture, { mode: "atelier", onFermer: () => {}, onEnregistre: () => {} }));
const champsA = libelles(depuisMaintenance);
attendu(`depuis la page Maintenance, on choisit le véhicule (${champsA.join(" · ")})`, champsA.includes("Véhicule"));
attendu("l'atelier demande le fournisseur, la date, le compteur, la nature, l'objet et la facture", ["Garage ou fournisseur", "Date de la facture", "Kilométrage au compteur", "Nature", "Objet de l'intervention", "La facture"].every((c) => champsA.includes(c)));
attendu("et des lignes de dépense, qu'on ajoute", depuisMaintenance.includes("Les lignes de dépense") && depuisMaintenance.includes("Ajouter une ligne"));
const depuisFiche = renderToString(React.createElement(FormulaireFacture, { mode: "autres", vehicule: { immatriculation: "AA565GA", immatriculationAffichee: "AA-565-GA", libelle: "TATA LPT1618TC" }, onFermer: () => {}, onEnregistre: () => {} }));
const champsB = libelles(depuisFiche);
attendu(`depuis la fiche, le véhicule est celui de la fiche (${champsB.join(" · ")})`, !champsB.includes("Véhicule") && depuisFiche.includes("AA-565-GA"));
attendu("une dépense autre demande sa pièce justificative, sans objet d'atelier", champsB.includes("La pièce justificative") && !champsB.includes("Objet de l'intervention"));

/* -- Plus rien ne s'ouvre hors de l'application ------------------------------------- */

const visionneuse = renderToString(React.createElement(VisionneusePiece, { fichier: "pieces/documents/x.pdf", libelle: "Facture", onFermer: () => {} }));
attendu("le cadre de la pièce n'offre plus d'onglet", !visionneuse.includes("Ouvrir dans un onglet") && !visionneuse.includes("_blank"));
const bouton = renderToString(React.createElement(OuvrirPiece, { fichier: "pieces/documents/x.pdf" }));
attendu("« Voir » ouvre la pièce dans l'application", bouton.includes("Voir") && !bouton.includes("_blank"));

function fichiers(d: string): string[] {
  return readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? fichiers(join(d, f)) : /\.tsx?$/.test(f) ? [join(d, f)] : []));
}
/* Seules restent les étiquettes QR : un PDF que l'application fabrique pour l'imprimer, pas une pièce jointe. */
const dehors = fichiers("src").filter((f) => {
  const t = readFileSync(f, "utf8");
  return /window\.open\(|target="_blank"/.test(t) && !/etiquettes|PanneauQr|EtiquettesQr/.test(f);
});
attendu(`aucun autre écran n'ouvre un fichier dans un onglet${dehors.length ? ` (${dehors.join(", ")})` : ""}`, dehors.length === 0);

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);

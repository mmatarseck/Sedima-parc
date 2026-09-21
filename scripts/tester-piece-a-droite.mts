/* La facture d'une dépense s'ouvre à droite de la liste, qui se rétracte
 * (métier, 21 septembre 2026). Ce banc rend les trois pièces du mécanisme —
 * le tableau, la mise en page, le cadre — et vérifie que la facture suit bien
 * la dépense jusqu'à la fiche : l'assemblage la laissait tomber.
 * Lancer : node --import tsx --import ./scripts/rendu/hook.mjs scripts/tester-piece-a-droite.mts */
import React from "react";
import { renderToString } from "react-dom/server";
import { TableauSimple } from "../src/composants/interface/Carte";
import { ListeEtPiece } from "../src/composants/interface/ListeEtPiece";
import { VisionneusePiece, estImage } from "../src/composants/interface/VisionneusePiece";
import { CHAMPS, champsCreation } from "../src/composants/transactions/champs";
import { assemblerFiche, FAITS_VIDES } from "../src/domaine/assembler-fiche";
import { PARAMETRES_DEFAUT } from "../src/domaine/parametres";
import { passagesReleves, planDuVehicule, programmeParDefaut } from "../src/donnees/entretien-demo";
import { sourceRapportsDemo } from "../src/donnees/rapports-demo";

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

type Ligne = { id: string; date: string; libelle: string; tiers: string; montant: number };
const lignes: Ligne[] = [
  { id: "DEP-1", date: "2026-01-05", libelle: "Boîte de vitesses", tiers: "COKI", montant: 1_000_000 },
  { id: "DEP-2", date: "2026-02-11", libelle: "Réparation", tiers: "TATA", montant: 1_073_800 },
];
const colonnes = [
  { cle: "date", libelle: "Date", rendu: (l: Ligne) => l.date },
  { cle: "libelle", libelle: "Libellé", rendu: (l: Ligne) => l.libelle },
  { cle: "tiers", libelle: "Fournisseur", rendu: (l: Ligne) => l.tiers },
  { cle: "montant", libelle: "Montant", rendu: (l: Ligne) => String(l.montant) },
];
const enTetes = (html: string) => [...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[1]!.replace(/<[^>]+>/g, "").trim()).filter(Boolean);

/* -- Le tableau ---------------------------------------------------------------- */

const pleine = renderToString(React.createElement(TableauSimple<Ligne>, { colonnes, lignes, cle: (l) => l.id, surLigne: () => {}, filtrable: false }));
attendu(`pleine largeur : toutes les colonnes (${enTetes(pleine).join(", ")})`, ["Date", "Libellé", "Fournisseur", "Montant"].every((c) => enTetes(pleine).some((e) => e.includes(c))));
attendu("une ligne cliquable le montre au curseur, et aucune n'est marquée ouverte", pleine.includes("cursor-pointer") && !pleine.includes("aria-current"));

const retractee = renderToString(React.createElement(TableauSimple<Ligne>, { colonnes, lignes, cle: (l) => l.id, surLigne: () => {}, ouverte: "DEP-2", seulement: ["date", "libelle", "montant"], filtrable: false }));
attendu(`rétractée : seules les colonnes qui s'y lisent (${enTetes(retractee).join(", ")})`, enTetes(retractee).length === 3 && !enTetes(retractee).some((e) => e.includes("Fournisseur")));
attendu("la ligne ouverte est marquée, et elle seule", (retractee.match(/aria-current="true"/g) ?? []).length === 1 && /<tr[^>]*aria-current="true"[^>]*>[\s\S]*?Réparation/.test(retractee));

const inerte = renderToString(React.createElement(TableauSimple<Ligne>, { colonnes, lignes, cle: (l) => l.id, filtrable: false }));
attendu("un tableau sans clic reste ce qu'il était", !inerte.includes("cursor-pointer"));

/* -- La mise en page ------------------------------------------------------------ */

const seule = renderToString(React.createElement(ListeEtPiece, { piece: null }, React.createElement("p", null, "LISTE")));
attendu("sans pièce ouverte, la liste garde toute la largeur", seule.includes("LISTE") && !seule.includes("grid"));
const deux = renderToString(React.createElement(ListeEtPiece, { piece: React.createElement("p", null, "PIECE") }, React.createElement("p", null, "LISTE")));
attendu("une pièce ouverte : deux colonnes, la liste étroite à gauche, la pièce à droite", deux.includes("xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]") && deux.indexOf("LISTE") < deux.indexOf("PIECE"));
attendu("sur un écran étroit, la pièce passe au-dessus de la liste", deux.includes("order-last") && deux.includes("xl:order-first"));

/* -- Le cadre ------------------------------------------------------------------- */

const vide = renderToString(React.createElement(VisionneusePiece, { fichier: null, libelle: "Réparation", precision: "11 févr. · TATA", vide: "Aucune facture n'est attachée à cette ligne.", onFermer: () => {} }));
attendu("une ligne sans facture le dit, au lieu d'un cadre blanc", vide.includes("Aucune facture") && vide.includes("Réparation"));
attendu("le cadre se referme, et n'offre pas d'onglet pour une pièce absente", vide.includes("Refermer la pièce") && !vide.includes("Ouvrir dans un onglet"));
attendu("une image se montre en image, un PDF dans son cadre", estImage("pieces/documents/2026/09/recu.JPG") && !estImage("pieces/documents/2026/09/facture.pdf"));

/* -- La facture suit la dépense jusqu'à la fiche ---------------------------------- */

const ligne = sourceRapportsDemo().lignes[0]!;
const fiche = assemblerFiche(
  ligne,
  {
    ...FAITS_VIDES,
    depenses: [
      { numero: "DEP-R-00002", date: "2026-01-15", poste: "maintenance-curative", libelle: "Entretien", montant: 643_678, beneficiaire: null, reference: "BC15526 · facture répartie — part 1/5 de 3 218 378 F, à parts égales", origine: "bon-de-commande", justificatif: true, km: null, kmMotifRejet: null, photo: "pieces/documents/2026/09/2026-09-16-dep-r-00002.pdf" },
      { numero: "DEP-CP-1", date: "2026-01-16", poste: "peage", libelle: "Péage", montant: 3_000, beneficiaire: null, reference: null, origine: "caisse", justificatif: false, km: null, kmMotifRejet: null },
    ],
  },
  PARAMETRES_DEFAUT,
  "2026-09-21",
  { programme: programmeParDefaut(ligne.vehicule.categorie), plan: planDuVehicule(ligne.vehicule.id, ligne.vehicule.categorie), passages: passagesReleves },
);
attendu("la facture attachée arrive sur la dépense de la fiche", fiche.depenses.find((d) => d.numero === "DEP-R-00002")?.photo === "pieces/documents/2026/09/2026-09-16-dep-r-00002.pdf");
attendu("une dépense sans facture n'en invente pas", (fiche.depenses.find((d) => d.numero === "DEP-CP-1")?.photo ?? null) === null);

/* -- La facture se joint depuis la modification ----------------------------------- */

attendu("la modification d'une dépense propose la facture, sans l'exiger", CHAMPS.depense.some((c) => c.cle === "photo" && !c.obligatoire));
const creation = champsCreation("depense").filter((c) => c.cle === "photo");
attendu("la saisie garde un seul champ de pièce, obligatoire", creation.length === 1 && creation[0]!.obligatoire === true);

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);

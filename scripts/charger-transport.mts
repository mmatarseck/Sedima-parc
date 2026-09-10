/* ============================================================================
 * Fabrique `supabase/transport-parties/` — la location et le transport réels.
 *
 * Troisième et dernière veine du classeur d'extraction des bons de commande du
 * dossier DO. Le carburant est chargé, la maintenance aussi ; restent les
 * **229 bons de la famille « Location & transport »**, que le chargement de la
 * maintenance avait laissés de côté parce qu'ils ne sont pas de l'atelier.
 *
 * Ce sont 595 millions de francs sur quatre exercices, et le module
 * Transporteurs est vide depuis la purge : c'est la matière qui manque au
 * tableau de bord pour que « Où passe l'argent du transport » dise autre chose
 * que zéro.
 *
 * CE QU'ILS SONT, ET OÙ ILS VONT.
 *
 *   * **Location véhicule** (147) et **Transport / prestation** (55) sont des
 *     services achetés à un tiers : ils deviennent des `prestation`. Le
 *     transporteur facture une somme pour un mois de location ou pour des
 *     voyages ; c'est exactement ce que cette table décrit.
 *   * **Frais de mission & péage** (25) ne sont pas des prestations de
 *     transport mais des frais du parc. Ils deviennent des `depense`, avec le
 *     fournisseur en bénéficiaire — la contrainte `depense_tracable` accepte
 *     une dépense sans véhicule à condition qu'elle cite quelqu'un.
 *   * **Carburant** (2) est déjà chargé par ailleurs, et deux bons de plus
 *     compteraient double.
 *
 * POURQUOI PAS `mise_a_disposition`. C'eût été le rangement naturel d'une
 * location de camion, et il a été écarté : cette table demande une
 * immatriculation de camion tiers, un mois servi, des jours calendaires et un
 * prix par jour. Le bon ne donne ni plaque — douze sur deux cent vingt-neuf —
 * ni jours ni prix unitaire. Il aurait fallu inventer quatre valeurs pour en
 * ranger une ; la prestation les demande toutes.
 *
 * CE QU'ON DIT DE LA QUANTITÉ. Un bon facture une somme, pas un décompte : le
 * détail des jours ou des voyages est sur la facture PDF, que l'extraction n'a
 * pas dépliée. La quantité vaut donc **un**, et le prix unitaire porte le
 * montant. L'unité dit la nature du service — un mois pour une location, un
 * voyage pour un transport —, et le commentaire répète que le décompte n'est
 * pas connu. Mieux vaut une quantité franchement forfaitaire qu'un décompte
 * inventé.
 *
 * Lancer : npx tsx scripts/charger-transport.mts
 * ==========================================================================*/

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";
import { cleFournisseur, nomPropre } from "./noms-fournisseurs.mts";

const CLASSEUR =
  "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/62. Transport & Flotte Automobile/61. Gestion Parc/Maintenance/SEDIMA_Maintenance_Parc_Bons_de_commande.xlsx";
const projet = process.cwd();

const texte = (c: Cellule) => (c === null || c === undefined ? "" : String(c).trim());
const entier = (c: Cellule): number | null => {
  const n = typeof c === "number" ? c : Number(texte(c).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : null;
};
const echappe = (s: string) => s.replace(/'/g, "''");

const cle = cleFournisseur;

/* -- 1. Les prestataires déjà connus ---------------------------------------- */

const seed = readFileSync(join(projet, "supabase/seed.sql"), "utf8");
const dejaLa = new Set<string>();
for (const m of seed.matchAll(/'PRE-\d{4}-\d{5}', '((?:[^']|'')*)'/g)) dejaLa.add(cle(m[1]!.replace(/''/g, "'")));
/* Ceux que le chargement de la maintenance vient de créer comptent aussi :
   sans quoi on créerait deux fois le même garage, sous deux numéros. */
const maintenance = join(projet, "supabase/maintenance-parties/maintenance-01-prestataires.sql");
try {
  for (const m of readFileSync(maintenance, "utf8").matchAll(/'PRE-\d{4}-\d{5}', '((?:[^']|'')*)'/g)) dejaLa.add(cle(m[1]!.replace(/''/g, "'")));
} catch {
  console.warn("maintenance-01-prestataires.sql absent : les fournisseurs communs seront créés en double.");
}

/* -- 2. Le classeur --------------------------------------------------------- */

const commandes = lireClasseur(CLASSEUR).find((f) => f.nom === "Commandes");
if (!commandes) throw new Error("feuille « Commandes » introuvable");
const entete = commandes.lignes[0]!.map((c) => texte(c));
const col = (nom: string) => {
  const i = entete.indexOf(nom);
  if (i < 0) throw new Error(`colonne « ${nom} » introuvable`);
  return i;
};
const [cNumero, cDate, cFournisseur, cFamille, cCategorie, cObjet, cDesignations, cMontant, cDoublon, cRetenu] = [
  "N° commande", "Date émission", "Fournisseur (normalisé)", "Famille de dépense", "Catégorie de dépense",
  "Objet / Remarques D.A", "Désignations", "Montant TTC", "Doublon", "Retenu pour totaux",
].map(col);

interface Bon {
  numero: string;
  date: string;
  fournisseur: string;
  categorie: string;
  libelle: string;
  montant: number;
}

const prestations: Bon[] = [];
const frais: Bon[] = [];
const ecartes: Record<string, number> = {};
const ecarte = (r: string) => (ecartes[r] = (ecartes[r] ?? 0) + 1);

for (const l of commandes.lignes.slice(1)) {
  const numero = texte(l[cNumero]);
  if (!numero) continue;
  if (texte(l[cFamille]) !== "Location & transport") continue;
  if (texte(l[cDoublon]) !== "" || texte(l[cRetenu]) === "Non") {
    ecarte("bon marqué doublon ou exclu des totaux par l'extraction");
    continue;
  }
  const fournisseur = nomPropre(texte(l[cFournisseur]));
  if (!fournisseur) {
    ecarte("aucun fournisseur nommé — une prestation sans prestataire n'en est pas une");
    continue;
  }
  const date = texte(l[cDate]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    ecarte("date d'émission absente ou illisible");
    continue;
  }
  const montant = entier(l[cMontant]);
  if (montant === null || montant <= 0) {
    ecarte("montant absent ou nul");
    continue;
  }
  const brut = texte(l[cObjet]) || texte(l[cDesignations]) || texte(l[cCategorie]);
  const bon: Bon = { numero, date, fournisseur, categorie: texte(l[cCategorie]), libelle: brut.length > 160 ? `${brut.slice(0, 157)}…` : brut, montant };
  if (bon.categorie === "Location véhicule" || bon.categorie === "Transport / prestation") prestations.push(bon);
  else if (bon.categorie === "Frais de mission & péage") frais.push(bon);
  else ecarte(`catégorie « ${bon.categorie || "—"} » : déjà chargée ailleurs, ou hors sujet`);
}
const parDate = (a: Bon, b: Bon) => a.date.localeCompare(b.date) || a.numero.localeCompare(b.numero);
prestations.sort(parDate);
frais.sort(parDate);

/* -- 3. Les transporteurs qui manquent -------------------------------------- */

const nouveaux = new Map<string, string>();
for (const b of [...prestations, ...frais]) {
  const k = cle(b.fournisseur);
  if (!dejaLa.has(k) && !nouveaux.has(k)) nouveaux.set(k, b.fournisseur);
}
const lignesPrestataires = [...nouveaux.values()].map((nom, i) =>
  `  ('PRE-2026-8${String(i + 1).padStart(4, "0")}', '${echappe(nom)}', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.')`,
);

/* -- 4. Les écritures -------------------------------------------------------- */

const idPrestataire = (nom: string) =>
  `(select id from prestataire where upper(regexp_replace(raison_sociale, '[^A-Za-z0-9]', '', 'g')) = '${cle(nom)}' limit 1)`;

/* L'unité dit la nature du service, jamais un décompte : le bon facture une
   somme, et le détail des jours ou des voyages reste sur la facture PDF. */
const UNITE: Record<string, string> = { "Location véhicule": "mois", "Transport / prestation": "voyage" };
const FORFAIT = "Bon de commande facturé au forfait : le décompte des jours ou des voyages est sur la facture, non dans l''extraction.";

/* Un bon de commande n'est pas une facture, et l'extraction ne dit rien du
   règlement. Le premier jet posait la date du bon en date de facture, sans
   règlement : trois ans de bons passaient pour 552 M F de dette. Un bon retenu
   dans les totaux de dépense est une dépense faite : il est rangé réglé, sans
   date de facture ni de règlement, et son numéro reste cité en commentaire. */
const lignesPrestation = prestations.map(
  (b, i) =>
    `  ('PRS-R-${String(i + 1).padStart(5, "0")}', '${b.date}', ${idPrestataire(b.fournisseur)}, '${echappe(b.libelle)}', '${UNITE[b.categorie]}', 1, ${b.montant}, 'inconnue', 'regle', ${b.montant}, null, null, 'Bon de commande ${echappe(b.numero)}. ${FORFAIT}')`,
);

/* Un péage ou un frais de mission n'a pas de véhicule nommé ; il cite donc son
   bénéficiaire, ce que la contrainte `depense_tracable` exige. */
const POSTE: Record<string, string> = { "Frais de mission & péage": "peage" };
const lignesFrais = frais.map(
  (b, i) =>
    `  ('DEP-T-${String(i + 1).padStart(5, "0")}', ${idPrestataire(b.fournisseur)}, '${b.date}', '${POSTE[b.categorie] ?? "divers"}', '${echappe(b.libelle)}', ${b.montant}, '${echappe(b.fournisseur)}', 'bon-de-commande', true, '${echappe(b.numero)}')`,
);

/* -- 5. Les fichiers --------------------------------------------------------- */

const dossier = join(projet, "supabase/transport-parties");
rmSync(dossier, { recursive: true, force: true });
mkdirSync(dossier, { recursive: true });

const enTete = (titre: string, corps: string) => `-- ============================================================================
-- SEDIMA Parc — location et transport réels : ${titre}.
--
-- **Ce n'est pas une migration.** Chargement tiré du classeur d'extraction des
-- bons de commande du dossier DO — famille « Location & transport », que le
-- chargement de la maintenance avait laissée de côté.
--
${corps}
--
-- REJOUABLE : \`on conflict do nothing\`. À jouer **dans l'ordre des fichiers**,
-- les transporteurs d'abord.
-- ============================================================================

`;

writeFileSync(
  join(dossier, "transport-01-prestataires.sql"),
  enTete(
    "les transporteurs",
    `-- ${lignesPrestataires.length} transporteurs que le référentiel ne connaissait pas. Ceux que le\n-- chargement de la maintenance vient de créer ne sont pas recréés ici : un\n-- fournisseur qui répare et qui loue reste un seul prestataire.`,
  ) + `insert into prestataire (numero, raison_sociale, type, actif, note) values\n${lignesPrestataires.join(",\n")}\non conflict (numero) do nothing;\n`,
  "utf8",
);

writeFileSync(
  join(dossier, "transport-02-prestations.sql"),
  enTete(
    "les prestations",
    `-- ${lignesPrestation.length} services achetés à des tiers : locations de camions et de bus,\n-- transports facturés au voyage. La quantité vaut **un** et le prix unitaire\n-- porte le montant : le bon facture une somme, et le décompte des jours ou des\n-- voyages est sur la facture PDF que l'extraction n'a pas dépliée. Mieux vaut\n-- un forfait assumé qu'un décompte inventé — le commentaire de chaque ligne le\n-- répète.`,
  ) +
    `insert into prestation (numero, date, prestataire_id, libelle, unite, quantite, prix_unitaire, convention, statut, montant_facture, date_facture, reference_facture, commentaire) values\n${lignesPrestation.join(",\n")}\non conflict (numero) do nothing;\n`,
  "utf8",
);

writeFileSync(
  join(dossier, "transport-03-frais.sql"),
  enTete(
    "les frais de mission et de péage",
    `-- ${lignesFrais.length} frais qui ne sont pas des prestations de transport mais des charges du\n-- parc. Ils n'ont pas de véhicule nommé et citent donc leur bénéficiaire, ce\n-- que la contrainte \`depense_tracable\` exige : une dépense sans véhicule doit\n-- rester traçable.`,
  ) +
    `insert into depense (numero, prestataire_id, date, poste, libelle, montant, beneficiaire, origine, justificatif, reference) values\n${lignesFrais.join(",\n")}\non conflict (numero) do nothing;\n`,
  "utf8",
);

/* -- 6. Le rapport ---------------------------------------------------------- */

const somme = (l: Bon[]) => l.reduce((s, b) => s + b.montant, 0);
const parAn = (l: Bon[]) =>
  Object.entries(
    l.reduce<Record<string, { n: number; m: number }>>((a, b) => {
      const an = b.date.slice(0, 4);
      a[an] = { n: (a[an]?.n ?? 0) + 1, m: (a[an]?.m ?? 0) + b.montant };
      return a;
    }, {}),
  ).sort();

console.log(`${lignesPrestation.length} prestations, ${Math.round(somme(prestations) / 1e6)} M F TTC`);
console.log(`  ${parAn(prestations).map(([a, v]) => `${a} : ${v.n} bons ${Math.round(v.m / 1e6)} M`).join(" · ")}`);
console.log(`${lignesFrais.length} frais de mission et de péage, ${Math.round(somme(frais) / 1e6)} M F`);
console.log(`${lignesPrestataires.length} transporteurs créés`);
console.log(`  écartés :`);
for (const [r, n] of Object.entries(ecartes).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)} × ${r}`);
console.log(`supabase/transport-parties/ — 3 fichiers`);

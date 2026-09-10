/* ============================================================================
 * Fabrique `supabase/maintenance-parties/` — la maintenance réelle du parc.
 *
 * Après le carburant, la matière suivante. Le dossier DO porte un classeur
 * d'extraction des bons de commande — « 62. Transport & Flotte Automobile /
 * 61. Gestion Parc / Maintenance » — bâti sur 694 factures PDF, de novembre
 * 2023 à septembre 2026. Il donne ce qui manquait à l'application : des
 * **interventions datées, chiffrées et attribuées**.
 *
 * CE QU'ON CHARGE, ET CE QU'ON LAISSE.
 *
 * Le classeur mêle quatre familles de dépense. Une seule est de la
 * maintenance de parc :
 *
 *   * **Maintenance & réparation** (440 bons) — entretiens, réparations,
 *     pièces, pneumatiques, carrosserie. C'est ce qu'on charge.
 *   * *Location & transport* (229) — de l'affrètement et de la location, qui
 *     relèvent du module Transporteurs et non de l'atelier.
 *   * *Administratif & divers* (23) et *Acquisition de véhicules* (2) — ni
 *     l'un ni l'autre n'est une intervention.
 *
 * Sont aussi écartés : les bons marqués **doublon** par l'extraction, ceux que
 * la colonne « Retenu pour totaux » exclut, et ceux dont l'immatriculation
 * n'est pas lisible ou n'appartient pas au parc. Un bon couvrant plusieurs
 * véhicules est rattaché à sa plaque principale, comme le classeur le fait
 * lui-même — c'est écrit dans son propre avertissement.
 *
 * DEUX ÉCRITURES PAR BON, ET C'EST VOULU. Le modèle de l'application veut
 * qu'une intervention d'atelier et sa dépense soient deux faits distincts :
 * l'une décrit un travail, l'autre un décaissement. Le jeu de départ le fait
 * déjà — 290 interventions pour autant de dépenses de maintenance —, et le
 * coût d'un véhicule se calcule sur les **dépenses**, jamais sur les
 * interventions. Charger l'un sans l'autre laisserait soit l'atelier vide,
 * soit le coût à zéro. Les deux portent le même numéro de bon en référence.
 *
 * LES FOURNISSEURS. Le classeur en nomme une cinquantaine — TATA, CFAO,
 * KHELCOM… — qui ne sont pas dans le référentiel des prestataires. On les
 * crée, avec le type que leur catégorie de dépense indique. Une intervention
 * sans garage vaut la moitié d'une intervention.
 *
 * Lancer : npx tsx scripts/charger-maintenance.mts
 * ==========================================================================*/

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";
import { cleFournisseur, nomPropre } from "./noms-fournisseurs.mts";
import { normaliser } from "../src/domaine/immatriculation";

const CLASSEUR =
  "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/62. Transport & Flotte Automobile/61. Gestion Parc/Maintenance/SEDIMA_Maintenance_Parc_Bons_de_commande.xlsx";
const projet = process.cwd();
const TAILLE_PARTIE = 250 * 1024;

const texte = (c: Cellule) => (c === null || c === undefined ? "" : String(c).trim());
const entier = (c: Cellule): number | null => {
  const n = typeof c === "number" ? c : Number(texte(c).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : null;
};
const echappe = (s: string) => s.replace(/'/g, "''");

/**
 * Le poste de dépense et le type d'intervention, par catégorie du classeur.
 *
 * « Entretien » est le seul préventif : on y va parce que le compteur le dit.
 * Tout le reste est curatif — on y va parce que quelque chose est cassé, usé
 * ou froissé. Le poste, lui, distingue la main-d'œuvre des fournitures, parce
 * que le tableau de bord les lit séparément.
 */
const CATEGORIES: Record<string, { poste: string; type: "preventif" | "curatif"; prestataire: string }> = {
  Entretien: { poste: "maintenance-preventive", type: "preventif", prestataire: "garage" },
  /* La vidange est le geste préventif par excellence : on y va parce que le
     compteur le dit, pas parce que quelque chose est cassé. */
  "Vidange & lubrifiants": { poste: "maintenance-preventive", type: "preventif", prestataire: "garage" },
  Réparation: { poste: "maintenance-curative", type: "curatif", prestataire: "garage" },
  "Carrosserie & peinture": { poste: "maintenance-curative", type: "curatif", prestataire: "garage" },
  "Main d'œuvre": { poste: "maintenance-curative", type: "curatif", prestataire: "garage" },
  "Remorquage & assistance": { poste: "maintenance-curative", type: "curatif", prestataire: "depanneur" },
  "Pièces détachées": { poste: "pieces", type: "curatif", prestataire: "pieces" },
  Batterie: { poste: "pieces", type: "curatif", prestataire: "pieces" },
  /* Un outil acheté pour un véhicule nommé reste une fourniture de ce
     véhicule : c'est ainsi que le bon l'impute, et on ne le redresse pas. */
  "Outillage & petit matériel": { poste: "pieces", type: "curatif", prestataire: "pieces" },
  Pneumatiques: { poste: "pneumatiques", type: "curatif", prestataire: "pneumatiques" },
};

/* -- 1. Le parc et les prestataires déjà en base ---------------------------- */

const seed = readFileSync(join(projet, "supabase/seed.sql"), "utf8");
const parc = new Set<string>();
for (const b of seed.matchAll(/insert into vehicule \([^)]*\) values[\s\S]*?\non conflict do nothing;/g)) {
  for (const m of b[0].matchAll(/'([A-Z]{2}\d{3,4}[A-Z]{1,2})'/g)) parc.add(m[1]!);
}
/** Le nom d'un prestataire, réduit à ce qui l'identifie : majuscules, sans ponctuation ni espaces. */

const cle = cleFournisseur;
const dejaLa = new Set<string>();
for (const m of seed.matchAll(/'PRE-\d{4}-\d{5}', '((?:[^']|'')*)'/g)) dejaLa.add(cle(m[1]!.replace(/''/g, "'")));

/* -- 2. Le classeur --------------------------------------------------------- */

const commandes = lireClasseur(CLASSEUR).find((f) => f.nom === "Commandes");
if (!commandes) throw new Error("feuille « Commandes » introuvable");
const entete = commandes.lignes[0]!.map((c) => texte(c));
const col = (nom: string) => {
  const i = entete.indexOf(nom);
  if (i < 0) throw new Error(`colonne « ${nom} » introuvable`);
  return i;
};
const cNumero = col("N° commande");
const cDate = col("Date émission");
const cFournisseur = col("Fournisseur (normalisé)");
const cImmat = col("Immatriculation");
const cFamille = col("Famille de dépense");
const cCategorie = col("Catégorie de dépense");
const cObjet = col("Objet / Remarques D.A");
const cDesignations = col("Désignations");
const cMontant = col("Montant TTC");
const cDoublon = col("Doublon");
const cRetenu = col("Retenu pour totaux");
const cNbVehicules = col("Nb véhicules");

interface Bon {
  numero: string;
  date: string;
  immatriculation: string;
  fournisseur: string;
  categorie: string;
  objet: string;
  montant: number;
  multi: boolean;
}

const bons: Bon[] = [];
const ecartes: Record<string, number> = {};
const ecarte = (raison: string) => (ecartes[raison] = (ecartes[raison] ?? 0) + 1);

for (const l of commandes.lignes.slice(1)) {
  const numero = texte(l[cNumero]);
  if (!numero) continue;
  if (texte(l[cFamille]) !== "Maintenance & réparation") {
    ecarte(`famille « ${texte(l[cFamille]) || "—"} », pas de la maintenance de parc`);
    continue;
  }
  if (texte(l[cDoublon]) !== "" || texte(l[cRetenu]) === "Non") {
    ecarte("bon marqué doublon ou exclu des totaux par l'extraction");
    continue;
  }
  const immat = normaliser(texte(l[cImmat]));
  if (!/^[A-Z]{2}\d{3,4}[A-Z]{1,2}$/.test(immat)) {
    ecarte("aucune immatriculation lisible sur le bon");
    continue;
  }
  if (!parc.has(immat)) {
    ecarte("immatriculation hors du parc de l'application");
    continue;
  }
  const date = texte(l[cDate]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    ecarte("date d'émission absente ou illisible");
    continue;
  }
  const categorie = texte(l[cCategorie]);
  if (!CATEGORIES[categorie]) {
    ecarte(`catégorie « ${categorie || "—"} » sans correspondance`);
    continue;
  }
  const montant = entier(l[cMontant]);
  if (montant === null || montant <= 0) {
    ecarte("montant absent ou nul");
    continue;
  }
  const objet = texte(l[cObjet]) || texte(l[cDesignations]) || categorie;
  bons.push({
    numero,
    date,
    immatriculation: immat,
    fournisseur: nomPropre(texte(l[cFournisseur])) || "Fournisseur non nommé",
    categorie,
    objet: objet.length > 160 ? `${objet.slice(0, 157)}…` : objet,
    montant,
    multi: (entier(l[cNbVehicules]) ?? 1) > 1,
  });
}
bons.sort((a, b) => a.date.localeCompare(b.date) || a.numero.localeCompare(b.numero));

/* -- 3. Les prestataires qui manquent --------------------------------------- */

const nouveaux = new Map<string, string>();
for (const b of bons) {
  const k = cle(b.fournisseur);
  if (dejaLa.has(k) || nouveaux.has(k)) continue;
  nouveaux.set(k, b.fournisseur);
}
const typeDe = new Map<string, string>();
for (const b of bons) {
  const k = cle(b.fournisseur);
  if (!nouveaux.has(k) || typeDe.has(k)) continue;
  typeDe.set(k, CATEGORIES[b.categorie]!.prestataire);
}

const lignesPrestataires = [...nouveaux.entries()].map(([k, nom], i) =>
  `  ('PRE-2026-9${String(i + 1).padStart(4, "0")}', '${echappe(nom)}', '${typeDe.get(k) ?? "autre"}', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.')`,
);

/* -- 4. Les interventions et leurs dépenses --------------------------------- */

const lignesIntervention: string[] = [];
const lignesDepense: string[] = [];
bons.forEach((b, i) => {
  const n = String(i + 1).padStart(5, "0");
  const c = CATEGORIES[b.categorie]!;
  const vehicule = `(select id from vehicule where immatriculation = '${b.immatriculation}')`;
  /* Le fournisseur se retrouve sur son nom **normalisé**, pas sur sa graphie.
     C'est la même règle qui décide, plus haut, s'il faut le créer : le
     classeur écrit « TATA PIKINE » là où le référentiel porte « TATA Pikine »,
     et une comparaison exacte laissait l'intervention sans garage — le banc
     l'a vu. Une clé de rapprochement doit être la même des deux côtés. */
  const prestataire = `(select id from prestataire where upper(regexp_replace(raison_sociale, '[^A-Za-z0-9]', '', 'g')) = '${cle(b.fournisseur)}' limit 1)`;
  const note = b.multi ? " · bon couvrant plusieurs véhicules" : "";
  lignesIntervention.push(
    `  ('INT-R-${n}', ${vehicule}, ${prestataire}, '${b.date}', '${c.type}', '${echappe(b.objet)}', ${b.montant}, 0, null, '${echappe(b.numero)}${note}')`,
  );
  lignesDepense.push(
    `  ('DEP-R-${n}', ${vehicule}, ${prestataire}, '${b.date}', '${c.poste}', '${echappe(b.objet)}', ${b.montant}, 'bon-de-commande', true, '${echappe(b.numero)}${note}')`,
  );
});

/* -- 5. Les fichiers, coupés pour le SQL Editor ----------------------------- */

const dossier = join(projet, "supabase/maintenance-parties");
rmSync(dossier, { recursive: true, force: true });
mkdirSync(dossier, { recursive: true });

const enTete = (titre: string, precision: string) => `-- ============================================================================
-- SEDIMA Parc — maintenance réelle : ${titre}.
--
-- **Ce n'est pas une migration.** C'est un chargement de données, tiré du
-- classeur d'extraction des bons de commande du dossier DO — 694 factures
-- PDF, de novembre 2023 à septembre 2026.
--
-- ${precision}
--
-- REJOUABLE : \`on conflict do nothing\`. Un second passage n'ajoute rien.
-- À jouer **dans l'ordre des fichiers** : les prestataires d'abord, puisque
-- les interventions et les dépenses les citent par leur raison sociale.
-- ============================================================================

`;

const fichiers: { nom: string; contenu: string }[] = [];

fichiers.push({
  nom: "maintenance-01-prestataires.sql",
  contenu:
    enTete(
      "les fournisseurs",
      `${lignesPrestataires.length} garages, magasins de pièces et pneumaticiens que le référentiel\n-- ne connaissait pas. Leur type vient de la catégorie de dépense de leur\n-- premier bon. Une intervention sans garage vaut la moitié d'une intervention.`,
    ) + `insert into prestataire (numero, raison_sociale, type, actif, note) values\n${lignesPrestataires.join(",\n")}\non conflict (numero) do nothing;\n`,
});

/** Coupe une liste de lignes en parties d'environ 250 ko, jamais au milieu d'une ligne. */
function couper(lignes: string[]): string[][] {
  const paquets: string[][] = [[]];
  let poids = 0;
  for (const l of lignes) {
    if (poids > TAILLE_PARTIE && paquets[paquets.length - 1]!.length > 0) {
      paquets.push([]);
      poids = 0;
    }
    paquets[paquets.length - 1]!.push(l);
    poids += Buffer.byteLength(l, "utf8") + 2;
  }
  return paquets;
}

couper(lignesIntervention).forEach((paquet, i, tout) => {
  fichiers.push({
    nom: `maintenance-${String(i + 2).padStart(2, "0")}-interventions.sql`,
    contenu:
      enTete(
        `les interventions${tout.length > 1 ? ` (${i + 1} sur ${tout.length})` : ""}`,
        `Un travail d'atelier : entretien préventif ou intervention curative, avec\n-- son garage, son objet et son montant TTC. La référence porte le numéro du\n-- bon de commande, pour retrouver la facture.`,
      ) +
      `insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference) values\n${paquet.join(",\n")}\non conflict (numero) do nothing;\n`,
  });
});

const decalage = fichiers.length + 1;
couper(lignesDepense).forEach((paquet, i, tout) => {
  fichiers.push({
    nom: `maintenance-${String(decalage + i).padStart(2, "0")}-depenses.sql`,
    contenu:
      enTete(
        `les dépenses${tout.length > 1 ? ` (${i + 1} sur ${tout.length})` : ""}`,
        `Le décaissement de chaque intervention. Le coût d'un véhicule se calcule\n-- sur les **dépenses**, jamais sur les interventions : charger l'une sans\n-- l'autre laisserait soit l'atelier vide, soit le coût à zéro. Même numéro de\n-- bon en référence des deux côtés.`,
      ) +
      `insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, origine, justificatif, reference) values\n${paquet.join(",\n")}\non conflict (numero) do nothing;\n`,
  });
});

for (const f of fichiers) writeFileSync(join(dossier, f.nom), f.contenu, "utf8");

/* -- 6. Le rapport ---------------------------------------------------------- */

const total = bons.reduce((s, b) => s + b.montant, 0);
const parAnnee = bons.reduce<Record<string, { n: number; m: number }>>((a, b) => {
  const an = b.date.slice(0, 4);
  a[an] = { n: (a[an]?.n ?? 0) + 1, m: (a[an]?.m ?? 0) + b.montant };
  return a;
}, {});
const parType = bons.reduce<Record<string, number>>((a, b) => ({ ...a, [b.categorie]: (a[b.categorie] ?? 0) + 1 }), {});

console.log(`${bons.length} bons retenus, ${new Set(bons.map((b) => b.immatriculation)).size} véhicules, ${Math.round(total / 1e6)} M F TTC`);
console.log(`  du ${bons[0]?.date} au ${bons.at(-1)?.date}`);
for (const [an, v] of Object.entries(parAnnee).sort()) console.log(`    ${an} : ${v.n} bons, ${Math.round(v.m / 1e6)} M F`);
console.log(`  par catégorie : ${Object.entries(parType).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(", ")}`);
console.log(`  ${lignesPrestataires.length} prestataires créés`);
console.log(`  écartés :`);
for (const [r, n] of Object.entries(ecartes).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)} × ${r}`);
console.log(`supabase/maintenance-parties/ — ${fichiers.length} fichiers`);

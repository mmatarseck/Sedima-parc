/* Fabrique `supabase/aligner-referentiel.sql` à partir du seed déjà généré.
 *
 * Le seed pose partout `on conflict do nothing` : il ajoute ce qui manque et
 * ne touche jamais à ce qui existe. C'est le bon comportement pour un rejeu
 * — on ne veut pas qu'un seed écrase le travail saisi dans l'application.
 * Mais quand le référentiel lui-même a été corrigé à la source (statuts
 * réalignés, plaque fausse, sites), un rejeu laisse la base à moitié à jour.
 *
 * Ce script reprend les trois `insert` du référentiel — sites, véhicules,
 * chauffeurs — et remplace leur clause de conflit par une mise à jour des
 * seules colonnes descriptives. Les identifiants et les dates de création ne
 * bougent pas ; rien n'est effacé.
 *
 * Lancer : npx tsx scripts/aligner-referentiel.mts
 * Vérifier : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-alignement.mts
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const projet = process.cwd();
const dossier = join(projet, "supabase/seed-parties");
const texte = readdirSync(dossier).filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(join(dossier, f), "utf8")).join("\n");

/* Les colonnes qu'on remet à jour, par table : ce qui décrit, jamais ce qui identifie. */
const ALIGNER: Record<string, { cle: string; colonnes: string[] }> = {
  site: { cle: "code", colonnes: ["libelle", "region", "type"] },
  vehicule: { cle: "immatriculation", colonnes: ["marque", "appellation", "type_modele", "categorie", "categorie_flotte", "usage", "transport_special", "engage_au_parc", "business_unit", "site_id", "statut", "regime", "commentaire"] },
  chauffeur: { cle: "matricule_rh", colonnes: ["nom", "prenom", "contrat", "site_id"] },
};

const morceaux: string[] = [];
for (const [table, regle] of Object.entries(ALIGNER)) {
  const motif = new RegExp(`insert into ${table} \\(([^)]*)\\) values[\\s\\S]*?\\non conflict do nothing;`, "g");
  for (const m of texte.matchAll(motif)) {
    const colonnes = m[1]!.split(",").map((c) => c.trim());
    const majs = regle.colonnes.filter((c) => colonnes.includes(c));
    if (!colonnes.includes(regle.cle) || majs.length === 0) {
      console.log(`  ${table} : clé ou colonnes absentes, ignoré`);
      continue;
    }
    const corps = m[0]!.replace(/\non conflict do nothing;$/, "");
    morceaux.push(`${corps}\non conflict (${regle.cle}) do update set\n  ${majs.map((c) => `${c} = excluded.${c}`).join(",\n  ")};`);
    console.log(`  ${table} : ${majs.length} colonne(s) réalignée(s) sur ${regle.cle}`);
  }
}

const entete = `-- ============================================================================
-- SEDIMA Parc — aligner le référentiel déjà chargé sur sa source.
--
-- **Ce n'est pas une migration, et ce n'est pas le seed.** Le seed pose partout
-- \`on conflict do nothing\` : il ajoute ce qui manque et ne touche jamais à ce
-- qui existe — le bon comportement pour un rejeu, car un seed ne doit pas
-- écraser ce qui a été saisi dans l'application.
--
-- Mais le référentiel a été corrigé à la source le 10 septembre 2026 : dix-sept
-- unités lourdes ajoutées, une plaque fausse remplacée, les statuts des seize
-- lourds connus réalignés sur la situation 2026, huit sites nouveaux. Rejouer
-- le seed ajoute les nouveaux et **laisse les anciens tels quels**.
--
-- Ce script remet à jour les seules colonnes descriptives — libellé, marque,
-- statut, site, régime, commentaire — des lignes déjà présentes. Les
-- identifiants, les dates de création et tout ce qui a été saisi dans
-- l'application ne bougent pas.
--
-- ORDRE : 1. les douze parties du seed, 2. ce script.
--
-- Ce script ne supprime rien et ne peut rien casser : il n'écrit que des
-- \`insert ... on conflict do update\`. La plaque fausse DK 6875 DF est traitée
-- à part, par \`supabase/plaque-dk6875.sql\`, parce que supprimer un véhicule
-- cascade dans quinze tables.
-- ============================================================================

`;

/* La plaque fausse n'est PAS traitée ici, et c'est une correction du
 * 10 septembre 2026, après un échec en production.
 *
 * Le premier jet finissait par `delete from vehicule where immatriculation =
 * 'DK6875DF'`. Joué dans le SQL Editor, il a buté sur la contrainte
 * `depense_tracable` : la ligne portait des dépenses, et la clé étrangère
 * `on delete set null` de `depense` a voulu les délier, produisant une dépense
 * sans véhicule ni bénéficiaire — que la contrainte refuse, à juste titre.
 *
 * L'échec a rendu un service : supprimer un véhicule cascade dans quinze
 * tables et délie dans six autres. Ce n'est pas une opération à glisser en
 * pied d'un script d'alignement, et l'erreur a fait retomber toute la
 * transaction, alignement compris. La plaque a désormais son propre script,
 * `supabase/plaque-dk6875.sql`, avec son inventaire préalable.
 */
const pied = "\n";

writeFileSync(join(projet, "supabase/aligner-referentiel.sql"), entete + morceaux.join("\n\n") + pied, "utf8");
console.log(`\nsupabase/aligner-referentiel.sql — ${morceaux.length} instruction(s)`);

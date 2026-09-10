/* ============================================================================
 * Le correctif des chargements, après le défaut du lecteur de classeurs.
 *
 * CE QUI S'EST PASSÉ. `lire-xlsx.mts` lisait les attributs d'une cellule avec
 * un motif **gourmand** : `<c([^>]*)(?:\/>|>…<\/c>)`. Sur une cellule vide
 * auto-fermée — `<c r="AH2" s="6"/>` — le moteur avalait la barre oblique
 * dans les attributs, prenait la branche `>` et courait jusqu'au premier
 * `</c>` venu. Quatre cellules vides à la suite étaient absorbées d'un coup,
 * et la valeur de la cinquième atterrissait dans la colonne de la première.
 *
 * Les colonnes se décalaient donc **en silence**, d'autant de rangs qu'il y
 * avait de cellules vides consécutives. Rien ne plantait ; les valeurs
 * arrivaient juste ailleurs.
 *
 * CE QUE ÇA A COÛTÉ. Peu, et il faut le dire précisément plutôt que de
 * s'excuser en gros :
 *
 *   * **Carburant** — 8 lignes fausses sur 5 871 chargées, 7 manquantes. Les
 *     suivis hebdomadaires ont peu de colonnes et peu de vides ; le décalage
 *     n'y mordait presque pas.
 *   * **Maintenance** — 3 lignes fausses sur 259 chargées, et **42
 *     manquantes**. Le classeur des bons a quarante colonnes dont beaucoup de
 *     vides : le décalage y faisait rater l'immatriculation ou le montant, et
 *     le bon était écarté au lieu d'être chargé de travers. Une erreur qui
 *     fait perdre une ligne vaut mieux qu'une erreur qui en fabrique une
 *     fausse, mais ce n'est pas une consolation.
 *
 * CE SCRIPT ne recharge pas tout : il compare ce qui a été généré avant le
 * correctif à ce qui l'est après, et n'écrit que la différence — les lignes à
 * retirer, les lignes à ajouter. Rejouer 1,1 Mo pour quinze lignes serait
 * disproportionné, et surtout risqué : un rechargement complet demande
 * d'effacer d'abord, donc de toucher à des lignes justes.
 *
 * Lancer : npx tsx scripts/corriger-chargements.mts <dossier des générations d'avant>
 * ==========================================================================*/

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const avant = process.argv[2];
if (!avant || !existsSync(avant)) {
  console.error("Usage : npx tsx scripts/corriger-chargements.mts <dossier contenant carb-avant/ et maintenance-avant/>");
  process.exit(2);
}
const projet = process.cwd();

/** Les lignes d'insertion d'un dossier de parties, indexées par leur clé naturelle. */
function lignesDe(dossier: string, motif: RegExp, cleDe: (m: RegExpExecArray) => string): Map<string, { numero: string; ligne: string }> {
  const sortie = new Map<string, { numero: string; ligne: string }>();
  /* Deux lignes peuvent partager leur clé naturelle sans être la même : un
     camion qui fait deux fois cent litres le même jour, cela arrive et c'est
     vrai. Un simple `Map` en écrasait une, et le correctif rendait une ligne
     de moins que la cible — le banc l'a vu. On numérote donc les répétitions :
     la première occurrence, la deuxième, et ainsi de suite. */
  const vues = new Map<string, number>();
  if (!existsSync(dossier)) return sortie;
  for (const f of readdirSync(dossier).filter((x) => x.endsWith(".sql")).sort()) {
    for (const l of readFileSync(join(dossier, f), "utf8").split("\n")) {
      const m = motif.exec(l);
      if (!m) continue;
      const base = cleDe(m);
      const rang = (vues.get(base) ?? 0) + 1;
      vues.set(base, rang);
      sortie.set(`${base}#${rang}`, { numero: m[1]!, ligne: l.replace(/,$/, "") });
    }
  }
  return sortie;
}

/* La clé naturelle d'un plein : le véhicule, le jour, les litres. Elle ne
   dépend pas de la numérotation, qui a bougé entre les deux générations. */
const MOTIF_PLEIN = /\('(PLN-R-\d+)', \(select id from vehicule where immatriculation = '([A-Z0-9]+)'\), '(\d{4}-\d{2}-\d{2})', ([\d.]+),/;
const MOTIF_INTERVENTION = /\('(INT-R-\d+)', \(select id from vehicule where immatriculation = '([A-Z0-9]+)'\).*?'(\d{4}-\d{2}-\d{2})', '\w+', '.*?', (\d+),/;
const MOTIF_DEPENSE = /\('(DEP-R-\d+)', \(select id from vehicule where immatriculation = '([A-Z0-9]+)'\).*?'(\d{4}-\d{2}-\d{2})', '[\w-]+', '.*?', (\d+),/;
const cle3 = (m: RegExpExecArray) => `${m[2]}|${m[3]}|${m[4]}`;

interface Correctif {
  titre: string;
  table: string;
  colonnes: string;
  aRetirer: string[];
  aAjouter: string[];
  prefixe: string;
}

const correctifs: Correctif[] = [];

function comparer(titre: string, table: string, colonnes: string, prefixe: string, dossierAvant: string, dossierApres: string, motif: RegExp): void {
  const a = lignesDe(dossierAvant, motif, cle3);
  const b = lignesDe(dossierApres, motif, cle3);
  const aRetirer = [...a.entries()].filter(([k]) => !b.has(k)).map(([, v]) => v.numero);
  /* Les lignes nouvelles reprennent un préfixe de numéro qui ne peut heurter
     l'existant : la numérotation d'origine n'est pas rejouable, puisqu'elle a
     glissé d'un cran à chaque ligne gagnée ou perdue. */
  const aAjouter = [...b.entries()]
    .filter(([k]) => !a.has(k))
    .map(([, v], i) => v.ligne.replace(/^(\s*\(')[A-Z]+-R-\d+/, `$1${prefixe}${String(i + 1).padStart(5, "0")}`));
  correctifs.push({ titre, table, colonnes, aRetirer, aAjouter, prefixe });
  console.log(`${titre} : ${aRetirer.length} à retirer, ${aAjouter.length} à ajouter (sur ${b.size} lignes justes)`);
}

comparer(
  "carburant",
  "plein",
  "numero, vehicule_id, date, litres, prix_litre, montant, km, plein_complet, source, reference",
  "PLN-C-",
  join(avant, "carb-avant"),
  join(projet, "supabase/carburant-parties"),
  MOTIF_PLEIN,
);
comparer(
  "interventions",
  "intervention",
  "numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference",
  "INT-C-",
  join(avant, "maintenance-avant"),
  join(projet, "supabase/maintenance-parties"),
  MOTIF_INTERVENTION,
);
comparer(
  "dépenses de maintenance",
  "depense",
  "numero, vehicule_id, prestataire_id, date, poste, libelle, montant, origine, justificatif, reference",
  "DEP-C-",
  join(avant, "maintenance-avant"),
  join(projet, "supabase/maintenance-parties"),
  MOTIF_DEPENSE,
);

/* -- Le fichier ------------------------------------------------------------- */

const bloc = (c: Correctif) => {
  const morceaux: string[] = [`-- ---- ${c.titre} : ${c.aRetirer.length} ligne(s) retirée(s), ${c.aAjouter.length} ajoutée(s) ----`];
  if (c.aRetirer.length) morceaux.push(`delete from ${c.table} where numero in (${c.aRetirer.map((n) => `'${n}'`).join(", ")});`);
  if (c.aAjouter.length) morceaux.push(`insert into ${c.table} (${c.colonnes}) values\n${c.aAjouter.join(",\n")}\non conflict (numero) do nothing;`);
  return morceaux.join("\n\n");
};

const total = correctifs.reduce((s, c) => s + c.aRetirer.length + c.aAjouter.length, 0);
const sortie = `-- ============================================================================
-- SEDIMA Parc — correctif des chargements réels.
--
-- **Ce n'est pas une migration**, et ce n'est pas un rechargement : c'est la
-- **différence** entre ce qui a été chargé et ce qui aurait dû l'être.
--
-- POURQUOI. Le lecteur de classeurs lisait les attributs d'une cellule avec un
-- motif gourmand. Sur une cellule vide auto-fermée — \`<c r="AH2" s="6"/>\` —
-- il avalait la barre oblique, prenait la mauvaise branche et courait jusqu'au
-- premier \`</c>\` venu : quatre cellules vides à la suite étaient absorbées
-- d'un coup, et la valeur de la cinquième atterrissait dans la colonne de la
-- première. Les colonnes se décalaient en silence, d'autant de rangs qu'il y
-- avait de vides consécutifs.
--
-- CE QUE ÇA A COÛTÉ, précisément :
--
--   * carburant — peu : les suivis hebdomadaires ont cinq colonnes et peu de
--     vides, le décalage n'y mordait presque pas ;
--   * maintenance — davantage : le classeur des bons a quarante colonnes dont
--     beaucoup de vides. Le décalage y faisait rater l'immatriculation ou le
--     montant, et le bon était **écarté** au lieu d'être chargé de travers.
--     D'où des lignes manquantes plutôt que des lignes fausses — ce qui est le
--     moins mauvais des deux, sans être une consolation.
--
-- ${total} lignes en tout. À jouer une fois, dans l'ordre, après les chargements
-- précédents. Les suppressions ne visent que des numéros de ces chargements —
-- rien de saisi dans l'application n'est touché.
-- ============================================================================

begin;

${correctifs.map(bloc).join("\n\n")}

commit;


-- ---------------------------------------------------------------------------
-- Vérification.
-- ---------------------------------------------------------------------------

select 'pleins' as quoi, count(*)::int as lignes, round(sum(litres))::int as litres from plein where numero like 'PLN-%'
union all select 'interventions', count(*)::int, sum(montant)::int from intervention
union all select 'dépenses maintenance', count(*)::int, sum(montant)::int from depense where numero like 'DEP-%';
`;

writeFileSync(join(projet, "supabase/correctif-chargements.sql"), sortie, "utf8");
console.log(`\nsupabase/correctif-chargements.sql — ${total} lignes`);

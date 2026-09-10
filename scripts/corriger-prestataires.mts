/* ============================================================================
 * Le complément des prestataires, après le correctif des chargements.
 *
 * Le correctif ne portait que sur les interventions, les dépenses et les
 * pleins. Or la régénération avait aussi rendu des **fournisseurs** que la
 * première version n'avait pas trouvés : le décalage de colonnes leur faisait
 * rater leur bon, et ils n'étaient donc jamais créés.
 *
 * Neuf garages et magasins manquaient au référentiel, et
 * `transport-02-prestations.sql` en citait un — « FOURNISSEURS DIVERS ». La
 * prestation tombait sur un `prestataire_id` nul, que la table refuse à juste
 * titre : « null value in column "prestataire_id" of relation "prestation"
 * violates not-null constraint ».
 *
 * La leçon, pour la prochaine fois : **un correctif doit couvrir tout ce que
 * la régénération a changé**, pas seulement les tables auxquelles on pensait.
 * Un référentiel manquant ne se voit qu'au moment où quelque chose le cite.
 *
 * Lancer : npx tsx scripts/corriger-prestataires.mts <dossier des générations d'avant>
 * ==========================================================================*/

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleFournisseur, nomPropre } from "./noms-fournisseurs.mts";

const avant = process.argv[2];
if (!avant || !existsSync(avant)) {
  console.error("Usage : npx tsx scripts/corriger-prestataires.mts <dossier contenant maintenance-avant/>");
  process.exit(2);
}
const projet = process.cwd();

/** Les raisons sociales d'un fichier d'insertion de prestataires. */
const MOTIF = /'(PRE-\d{4}-\d{5})', '((?:[^']|'')*)', '([a-z-]+)'/g;
function nomsDe(chemin: string): string[] {
  if (!existsSync(chemin)) return [];
  return [...readFileSync(chemin, "utf8").matchAll(MOTIF)].map((m) => m[2]!.replace(/''/g, "'"));
}

/* Ce que la base porte déjà : le jeu de départ, et **les fichiers réellement
   joués** — pas ceux qu'on vient de régénérer. La nuance est tout le sujet :
   un fichier régénéré porte d'autres numéros, et le rejouer créerait le même
   fournisseur une seconde fois sous un numéro neuf, que `on conflict (numero)`
   ne rattraperait pas. Le dossier passé en argument contient donc les fichiers
   tels qu'ils ont été collés dans le SQL Editor, repris du dépôt s'il le
   faut. */
const connus = new Set<string>();
for (const m of readFileSync(join(projet, "supabase/seed.sql"), "utf8").matchAll(MOTIF)) connus.add(cleFournisseur(m[2]!.replace(/''/g, "'")));
for (const f of readdirSync(join(avant, "joues")).filter((x) => x.endsWith(".sql"))) {
  for (const n of nomsDe(join(avant, "joues", f))) connus.add(cleFournisseur(n));
}
console.log(`${connus.size} prestataires déjà en base`);

/* -- Les noms à reprendre ---------------------------------------------------
 *
 * Le nettoyage des noms est arrivé **après** le premier chargement : la base
 * porte « MBAGNICK GAYE I PROFORMA » et « GARAYA TRANSPORT IR PROFORMA », que
 * les fichiers régénérés cherchent désormais sous « MBAGNICK GAYE » et
 * « GARAYA TRANSPORT ». Sans reprise, ces prestations tomberaient à leur tour
 * sur un prestataire introuvable, et créer les noms propres à côté ferait
 * deux fiches pour un seul transporteur.
 *
 * On renomme donc en place, sur le nom exact tel qu'il est en base.
 * ------------------------------------------------------------------------ */

const echappe = (s: string) => s.replace(/'/g, "''");
const renommages: { avant: string; apres: string }[] = [];
for (const f of readdirSync(join(avant, "joues")).filter((x) => x.endsWith(".sql"))) {
  for (const nom of nomsDe(join(avant, "joues", f))) {
    const propre = nomPropre(nom);
    if (propre !== nom && propre.length > 2) renommages.push({ avant: nom, apres: propre });
  }
}
for (const r of renommages) connus.add(cleFournisseur(r.apres));

/* Ce que les fichiers régénérés demandent, et qui n'est ni en base ni renommé. */
const manquants: string[] = [];
for (const fichier of ["supabase/maintenance-parties/maintenance-01-prestataires.sql", "supabase/transport-parties/transport-01-prestataires.sql"]) {
  for (const ligne of readFileSync(join(projet, fichier), "utf8").split("\n")) {
    const m = /'(PRE-\d{4}-\d{5})', '((?:[^']|'')*)', '([a-z-]+)'/.exec(ligne);
    if (!m) continue;
    const k = cleFournisseur(m[2]!.replace(/''/g, "'"));
    if (connus.has(k)) continue;
    connus.add(k);
    /* **Renumérotés.** Les fichiers régénérés reprennent la même série que
       ceux qui ont été joués — `PRE-2026-9xxxx` pour la maintenance — mais
       plus dans le même ordre : le numéro 90038 désigne ici un fournisseur et
       là un autre. Le garder ferait taire l'insertion sous `on conflict
       (numero) do nothing`, et le fournisseur manquerait toujours. C'est
       exactement ce qui est arrivé à « FOURNISSEURS DIVERS ». La série 7xxxx
       n'est employée nulle part. */
    manquants.push(ligne.replace(/,$/, "").replace(/'PRE-\d{4}-\d{5}'/, `'PRE-2026-7${String(manquants.length + 1).padStart(4, "0")}'`));
  }
}

const sortie = `-- ============================================================================
-- SEDIMA Parc — les prestataires qui manquaient.
--
-- **Ce n'est pas une migration.** Le correctif des chargements ne portait que
-- sur les interventions, les dépenses et les pleins ; la régénération avait
-- aussi rendu des **fournisseurs** que la première version n'avait pas
-- trouvés, le décalage de colonnes leur faisant rater leur bon.
--
-- ${manquants.length} garages, magasins et transporteurs manquaient donc au référentiel, et
-- \`transport-02-prestations.sql\` en citait un : la prestation tombait sur un
-- \`prestataire_id\` nul, que la table refuse à juste titre.
--
-- À jouer **avant** \`transport-02-prestations.sql\`.
-- ============================================================================

-- ---- ${renommages.length} nom(s) repris : le nettoyage est arrivé après le chargement ----
${renommages.map((r) => `update prestataire set raison_sociale = '${echappe(r.apres)}' where raison_sociale = '${echappe(r.avant)}';`).join("\n")}

-- ---- ${manquants.length} fournisseur(s) que la première version n'avait pas trouvés ----
insert into prestataire (numero, raison_sociale, type, actif, note) values
${manquants.join(",\n")}
on conflict (numero) do nothing;


-- ---------------------------------------------------------------------------
-- Vérification : plus aucune prestation ne devrait manquer son prestataire.
-- ---------------------------------------------------------------------------

select count(*) as prestataires from prestataire;
`;

writeFileSync(join(projet, "supabase/correctif-prestataires.sql"), sortie, "utf8");
console.log(`${manquants.length} prestataires à ajouter`);
console.log("supabase/correctif-prestataires.sql écrit");

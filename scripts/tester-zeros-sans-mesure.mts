/* Les zéros sans mesure : ce que 0037 corrige, vérifié.
 *
 * Le rapport du tableau de bord sur les données réelles a montré trois
 * affirmations sans mesure derrière :
 *
 *   * **toute la flotte immobilisée**, parce que la carte grise est critique et
 *     que le parc n'en a enregistré aucune ;
 *   * **une caisse de 1 500 kF et une cuve de 9 000 l**, le solde reporté et le
 *     stock de départ du jeu de démonstration, sans un seul mouvement ;
 *   * **552 M F de factures à régler**, trois ans de bons de commande pris pour
 *     des factures impayées.
 *
 * Ce banc vérifie :
 *
 *   * côté domaine, qu'un type non suivi n'est ni exigé ni immobilisant, que
 *     l'information survit à la normalisation des paramètres, et qu'un type
 *     suivi reste exigé ;
 *   * côté base, qu'un type sans aucune pièce immobilise **exactement** comme
 *     s'il n'était pas critique — ni plus, ni moins ;
 *   * qu'une caisse ou une cuve sans mouvement sort nulle, et non au défaut ;
 *   * que l'ancien chargement du transport, suivi du correctif, donne ligne à
 *     ligne le nouveau chargement, que le correctif est rejouable, et que les
 *     bons ne comptent plus comme factures à régler.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-zeros-sans-mesure.mts */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { exigeDocument, immobilisationAdministrative } from "../src/domaine/documents";
import { PARAMETRES_DEFAUT, fusionnerParametres } from "../src/domaine/parametres";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();
const MOI = "00000000-0000-0000-0000-000000000001";

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

/* -- 1. Le domaine ------------------------------------------------------------ */

const camion = { categorie: "camion" as const, transportSpecial: false, statut: "en-service" as const };
const aJour = [
  { type: "assurance", etat: "a-jour" as const },
  { type: "visite-technique", etat: "a-jour" as const },
  { type: "licence-transport", etat: "a-jour" as const },
];
const nonSuivie = fusionnerParametres({
  documents: { types: PARAMETRES_DEFAUT.documents.types.map((t) => (t.id === "carte-grise" ? { ...t, suivi: false } : t)) },
});
attendu("la normalisation garde un type non suivi", nonSuivie.documents.types.find((t) => t.id === "carte-grise")?.suivi === false);
attendu("un type suivi ne reçoit aucun drapeau", nonSuivie.documents.types.find((t) => t.id === "assurance")?.suivi === undefined);
attendu("une carte grise non suivie n'est pas exigée d'un camion", !exigeDocument("carte-grise", camion, nonSuivie));
attendu("l'assurance, suivie, reste exigée", exigeDocument("assurance", camion, nonSuivie));
attendu("un camion à jour de ses pièces suivies n'est pas immobilisé", immobilisationAdministrative(camion, aJour, nonSuivie) === null);
attendu(
  "sans le drapeau, la carte grise absente immobilise toujours — la règle n'est pas retirée, elle attend la première pièce",
  immobilisationAdministrative(camion, aJour, PARAMETRES_DEFAUT) !== null,
);
attendu(
  "un type non suivi mais échu en liste n'immobilise pas non plus",
  immobilisationAdministrative(camion, [...aJour, { type: "carte-grise", etat: "echu" as const }], nonSuivie) === null,
);

/* -- 2. La base, sur le jeu de départ ---------------------------------------- */

const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key);
  insert into auth.users values ('${MOI}');
  create function auth.uid() returns uuid language sql stable as $$ select '${MOI}'::uuid $$;`);
for (const r of ["anon", "authenticated", "service_role"]) {
  try {
    await pg.exec(`create role ${r}`);
  } catch {}
}
for (const m of readdirSync(join(projet, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
await pg.exec(`insert into profil (utilisateur_id, nom, role, actif) values ('${MOI}', 'Banc', 'administrateur', true) on conflict do nothing;`);
for (const p of readdirSync(join(projet, "supabase/seed-parties")).filter((f) => f.endsWith(".sql")).sort()) {
  const texte = readFileSync(join(projet, "supabase/seed-parties", p), "utf8");
  let courant: string[] = [];
  for (const ligne of texte.split("\n")) {
    courant.push(ligne);
    if (!/^on conflict .*;$/.test(ligne.trim())) continue;
    try {
      await pg.exec(courant.join("\n"));
    } catch {}
    courant = [];
  }
}

const un = async <T>(sql: string): Promise<T> => (await pg.query(sql)).rows[0] as T;
const suivis = async () => new Set((await pg.query<{ type_document_id: string }>(`select type_document_id from types_document_suivis()`)).rows.map((r) => r.type_document_id));
const immobilises = async () =>
  (await un<{ n: number }>(
    `select count(*)::int as n from jsonb_array_elements(situation_journaliere(current_date, current_date)->0->'vehicules') v where (v->>'immobilise_admin')::boolean`,
  )).n;
const flotte = async () => (await un<{ f: Record<string, unknown> }>(`select situation_journaliere(current_date, current_date)->0->'flotte' as f`)).f;

const typesDepart = await suivis();
attendu(`le jeu de départ suit ${typesDepart.size} types (${[...typesDepart].sort().join(", ")})`, typesDepart.has("assurance") && typesDepart.has("carte-grise"));

const avant = await immobilises();
await pg.exec(`begin; delete from document where type_document_id = 'carte-grise';`);
const sansPiece = await immobilises();
const typesSans = await suivis();
await pg.exec(`update type_document set critique = false where id = 'carte-grise';`);
const nonCritique = await immobilises();
const engages = (await un<{ n: number }>(
  `select count(*)::int as n from vehicule where statut not in ('en-mutation', 'retrait-en-cours', 'a-recevoir')`,
)).n;
await pg.exec(`rollback;`);
attendu("sans aucune carte grise, le type sort des types suivis", !typesSans.has("carte-grise"));
attendu(
  `sans aucune carte grise : ${sansPiece} immobilisés, exactement comme si elle n'était pas critique (${nonCritique}) — et non ${engages} (avant l'effacement : ${avant})`,
  sansPiece === nonCritique && sansPiece < engages,
);
attendu("le retour arrière rend les cartes grises", (await suivis()).has("carte-grise") && (await immobilises()) === avant);

const tenue = await flotte();
attendu(`caisse et cuve tenues : ${tenue.solde_caisse} F, ${tenue.cuve_litres} l`, tenue.solde_caisse !== null && tenue.cuve_litres !== null);
await pg.exec(`begin; truncate mouvement_caisse, mouvement_cuve cascade;`);
const vide = await flotte();
await pg.exec(`rollback;`);
attendu(
  `sans mouvement, caisse et cuve sortent nulles (${vide.solde_caisse}, ${vide.cuve_litres}, autonomie ${vide.cuve_jours}) et le seuil reste lu (${vide.seuil_caisse})`,
  vide.solde_caisse === null && vide.cuve_litres === null && vide.cuve_jours === null && vide.seuil_caisse !== null,
);

/* -- 3. Le transport : ancien chargement + correctif = nouveau chargement ---- */

const purge = readFileSync(join(projet, "supabase/purge-demonstration.sql"), "utf8");
await pg.exec(purge.slice(purge.indexOf("begin;"), purge.indexOf("commit;") + 7));

const parties = join(projet, "supabase/transport-parties");
const correctif = join(projet, "supabase/correctif-reglement-transport.sql");
if (!existsSync(parties) || !existsSync(correctif)) {
  console.log("chargement du transport ou correctif absent — partie 3 sautée.");
  process.exit(echecs === 0 ? 0 : 1);
}
const sansVerification = (t: string) => (t.indexOf("-- Vérification") < 0 ? t : t.slice(0, t.indexOf("-- Vérification")));
const fichiers = readdirSync(parties).filter((f) => f.endsWith(".sql")).sort();
const nouveau = readFileSync(join(parties, fichiers.find((f) => f.includes("prestations"))!), "utf8");

/* L'état de la production : le fichier tel qu'il a été joué — la date du bon en
   date de facture, son numéro en référence —, reconstruit depuis le nouveau. */
let reconstruites = 0;
const ancien = nouveau
  .split("\n")
  .map((ligne) => {
    const date = /^\s*\('PRS-R-\d+', '(\d{4}-\d{2}-\d{2})'/.exec(ligne)?.[1];
    if (!date) return ligne;
    const suite = ligne.replace(/'regle', (\d+), null, null, 'Bon de commande ((?:[^']|'')*?)\. /, (_, montant: string, bon: string) => `'facture', ${montant}, '${date}', '${bon}', '`);
    if (suite !== ligne) reconstruites++;
    return suite;
  })
  .join("\n");
attendu(`${reconstruites} bons reconstruits dans leur état joué`, reconstruites > 100);

/* Le transport cite des fournisseurs que la maintenance a créés : elle passe d'abord, comme en production. */
const maintenance = join(projet, "supabase/maintenance-parties");
if (existsSync(maintenance)) for (const f of readdirSync(maintenance).filter((x) => x.endsWith(".sql")).sort()) await pg.exec(sansVerification(readFileSync(join(maintenance, f), "utf8")));
for (const f of fichiers) await pg.exec(sansVerification(f.includes("prestations") ? ancien : readFileSync(join(parties, f), "utf8")));

const aRegler = async () => (await flotte()).tiers_factures as number;
const facturesAvant = await aRegler();
attendu(`avant le correctif, le tableau compte ${facturesAvant} factures à régler — le défaut, reproduit`, facturesAvant >= reconstruites);

const texteCorrectif = sansVerification(readFileSync(correctif, "utf8"));
await pg.exec(texteCorrectif);
const facturesApres = await aRegler();
attendu(`après le correctif : ${facturesApres} facture à régler`, facturesApres === facturesAvant - reconstruites);

const photo = async () =>
  JSON.stringify((await pg.query(`select numero, statut, date_facture, date_reglement, reference_facture, commentaire, montant_facture from prestation where numero like 'PRS-R-%' order by numero`)).rows);
const corrige = await photo();
await pg.exec(texteCorrectif);
attendu("le correctif est rejouable : un second passage ne change rien", (await photo()) === corrige);

await pg.exec(`delete from prestation where numero like 'PRS-R-%';`);
await pg.exec(sansVerification(nouveau));
attendu("ligne à ligne, l'ancien chargement corrigé est le nouveau chargement", (await photo()) === corrige);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

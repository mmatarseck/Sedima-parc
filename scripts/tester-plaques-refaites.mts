/* Un véhicule réimmatriculé n'est pas deux véhicules.
 *
 * `supabase/correctif-plaques-refaites.sql` renomme une fiche quand la nouvelle
 * plaque n'en a pas, et fond les deux quand elles existent. Ce banc le joue sur
 * le référentiel de production et vérifie ce qui compte vraiment :
 *
 *   * qu'**aucune ligne ne se perd** — la somme de ce que portaient les deux
 *     fiches se retrouve sur la survivante, table par table ;
 *   * que le renommage ne déplace rien d'autre : même identifiant, même
 *     historique, une plaque de plus au bon endroit ;
 *   * que la fiche fondue passe à « sorti », datée, et dit où elle est allée ;
 *   * que les deux fiches se citent l'une l'autre, pour qu'on retrouve le fil ;
 *   * que le fichier est rejouable.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-plaques-refaites.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

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
  let courant: string[] = [];
  for (const ligne of readFileSync(join(projet, "supabase/seed-parties", p), "utf8").split("\n")) {
    courant.push(ligne);
    if (!/^on conflict .*;$/.test(ligne.trim())) continue;
    try {
      await pg.exec(courant.join("\n"));
    } catch {}
    courant = [];
  }
}
const purge = readFileSync(join(projet, "supabase/purge-demonstration.sql"), "utf8");
await pg.exec(purge.slice(purge.indexOf("begin;"), purge.indexOf("commit;") + 7));
const jouer = async (f: string) => {
  const t = readFileSync(join(projet, "supabase", f), "utf8");
  const fin = t.indexOf("-- ---------------------------------------------------------------------------\n-- Vérification");
  await pg.exec(fin < 0 ? t : t.slice(0, fin));
};
const dossier = async (d: string) => {
  for (const f of readdirSync(join(projet, "supabase", d)).filter((x) => x.endsWith(".sql")).sort()) await jouer(`${d}/${f}`);
};

/* Tout le référentiel et tous les chargements réels : la fusion doit être
   éprouvée sur ce qui pend vraiment aux véhicules, pas sur des fiches vides. */
await pg.exec(readFileSync(join(projet, "supabase/aligner-referentiel.sql"), "utf8"));
await jouer("vehicules-manquants.sql");
await jouer("caracteristiques-vehicules.sql");
await jouer("conformite.sql");
await dossier("maintenance-parties");
await dossier("achats-parties");
await dossier("carburant-parties");
await dossier("caisse-parties");
await dossier("pneus-parties");

const un = async <T>(sql: string): Promise<T> => (await pg.query(sql)).rows[0] as T;

/** Ce qu'une fiche porte, table par table. */
async function charge(plaque: string) {
  return await un<Record<string, number>>(`select
      (select count(*)::int from depense d      join vehicule v on v.id = d.vehicule_id where v.immatriculation = '${plaque}') as depenses,
      (select count(*)::int from plein p        join vehicule v on v.id = p.vehicule_id where v.immatriculation = '${plaque}') as pleins,
      (select count(*)::int from intervention i join vehicule v on v.id = i.vehicule_id where v.immatriculation = '${plaque}') as interventions,
      (select count(*)::int from pneu n         join vehicule v on v.id = n.vehicule_id where v.immatriculation = '${plaque}') as pneus,
      (select count(*)::int from document x     join vehicule v on v.id = x.vehicule_id where v.immatriculation = '${plaque}') as documents,
      (select count(*)::int from demande_achat a join vehicule v on v.id = a.vehicule_id where v.immatriculation = '${plaque}') as achats`);
}
const somme = (a: Record<string, number>, b: Record<string, number>) => Object.fromEntries(Object.keys(a).map((k) => [k, (a[k] ?? 0) + (b[k] ?? 0)]));
const egales = (a: Record<string, number>, b: Record<string, number>) => Object.keys(a).every((k) => a[k] === b[k]);
const dire = (x: Record<string, number>) => Object.entries(x).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(", ") || "rien";

/* -- Avant --------------------------------------------------------------- */

const avant = {
  dk1306: await charge("DK1306BB"),
  dk2348: await charge("DK2348BD"),
  ab078: await charge("AB078JS"),
  dk7485: await charge("DK7485BK"),
  ab364: await charge("AB364HK"),
};
const idDk1306 = (await un<{ id: string | null }>(`select (select id from vehicule where immatriculation = 'DK1306BB') as id`)).id;
console.log(`    avant : DK-1306-BB ${dire(avant.dk1306)} · DK-2348-BD ${dire(avant.dk2348)} · AB-078-JS ${dire(avant.ab078)}`);

attendu("les trois anciennes plaques sont bien au référentiel", idDk1306 !== null && (await un<{ n: number }>(`select count(*)::int as n from vehicule where immatriculation in ('DK2348BD', 'DK7485BK')`)).n === 2);
attendu("AB 098 JC n'a pas encore de fiche", (await un<{ n: number }>(`select count(*)::int as n from vehicule where immatriculation = 'AB098JC'`)).n === 0);

/* -- Le correctif --------------------------------------------------------- */

await jouer("correctif-plaques-refaites.sql");

/* A. Le renommage : même identifiant, même charge, une plaque de plus. */
const ab098 = await un<{ id: string; statut: string; commentaire: string | null }>(`select id, statut, commentaire from vehicule where immatriculation = 'AB098JC'`);
attendu(`DK-1306-BB est devenue AB-098-JC, sans changer d'identifiant`, ab098?.id === idDk1306);
attendu("l'ancienne plaque ne subsiste pas en double", (await un<{ n: number }>(`select count(*)::int as n from vehicule where immatriculation = 'DK1306BB'`)).n === 0);
const apresAb098 = await charge("AB098JC");
attendu(`un renommage ne déplace rien : ${dire(apresAb098)}`, egales(avant.dk1306, apresAb098));
attendu("la fiche dit d'où vient sa plaque", (ab098?.commentaire ?? "").includes("anciennement DK-1306-BB"));
attendu("un véhicule renommé reste au parc — il n'est pas sorti", ab098?.statut !== "sorti");

/* B. Les fusions : rien ne se perd, la survivante porte tout. */
for (const [ancienne, nouvelle, avantA, avantB] of [
  ["DK2348BD", "AB078JS", avant.dk2348, avant.ab078],
  ["DK7485BK", "AB364HK", avant.dk7485, avant.ab364],
] as const) {
  const apres = await charge(nouvelle);
  const reste = await charge(ancienne);
  attendu(`${nouvelle} porte tout ce que les deux fiches portaient (${dire(apres)})`, egales(somme(avantA, avantB), apres));
  attendu(`${ancienne} ne porte plus rien (${dire(reste)})`, Object.values(reste).every((n) => n === 0));
  const fondue = await un<{ statut: string; date_sortie: string | null; motif_sortie: string | null; engage: boolean; commentaire: string | null }>(
    `select statut, date_sortie::text, motif_sortie, engage, commentaire from vehicule where immatriculation = '${ancienne}'`,
  );
  attendu(`${ancienne} est sortie, datée et motivée (${fondue?.statut}, ${fondue?.date_sortie}, ${fondue?.motif_sortie})`, fondue?.statut === "sorti" && Boolean(fondue.date_sortie) && Boolean(fondue.motif_sortie) && fondue.engage === false);
  attendu(`${ancienne} dit dans quelle fiche elle a été fondue`, (fondue?.commentaire ?? "").includes("historique fondu"));
  const survivante = await un<{ commentaire: string | null }>(`select commentaire from vehicule where immatriculation = '${nouvelle}'`);
  attendu(`${nouvelle} dit quelle plaque elle portait avant`, (survivante?.commentaire ?? "").includes("Anciennement"));
}

/* Rien n'a été détaché au passage : aucune ligne orpheline créée. */
const orphelines = await un<{ depenses: number; pleins: number; pneus: number }>(`select
    (select count(*)::int from depense where vehicule_id is null and beneficiaire is null) as depenses,
    (select count(*)::int from plein where vehicule_id is null) as pleins,
    (select count(*)::int from pneu where vehicule_id is null and etat = 'monte') as pneus`);
attendu(`la fusion ne détache rien (${orphelines.depenses} dépenses, ${orphelines.pleins} pleins, ${orphelines.pneus} pneus orphelins)`, orphelines.depenses === 0 && orphelines.pleins === 0 && orphelines.pneus === 0);

/* Rejouable. */
await jouer("correctif-plaques-refaites.sql");
const rejoue = await charge("AB078JS");
attendu("rejouable : le fichier rejoué ne déplace rien de plus", egales(somme(avant.dk2348, avant.ab078), rejoue));
const doublons = await un<{ n: number }>(`select count(*)::int as n from (select commentaire from vehicule where commentaire like '%Anciennement%Anciennement%') d`);
attendu("rejouable : le commentaire ne se répète pas", doublons.n === 0);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

/* Un tracteur et une semi qui roulent ensemble.
 *
 * La migration 0050 donne enfin une table aux attelages, et
 * `supabase/attelages.sql` y pose les cinq du parc lourd, lus sur
 * `SITUATION PARC SEDIMA LOURDS`. Ce banc joue les deux sur le référentiel de
 * production et vérifie :
 *
 *   * que les cinq attelages entrent, **tracteur d'un côté, semi-remorque de
 *     l'autre** — c'est la seule erreur qu'un chargement par plaques peut
 *     faire sans qu'on la voie ;
 *   * que la base **refuse** ce qu'un écran pourrait laisser passer : un
 *     véhicule attelé à lui-même, une période à l'envers, un tracteur qui
 *     tirerait deux semis à la fois, une semi tirée par deux tracteurs ;
 *   * qu'un attelage **clos** libère les deux véhicules, et que l'historique
 *     d'un même couple reste possible — sans quoi on ne pourrait pas
 *     réatteler ce qu'on a dételé ;
 *   * que `lire_parc()` rend les attelages en cours, et eux seuls : c'est ce
 *     que la liste Flotte affiche ;
 *   * que le fichier est rejouable.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-attelages.mts */
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
await pg.exec(readFileSync(join(projet, "supabase/aligner-referentiel.sql"), "utf8"));

const jouer = async (f: string) => {
  const t = readFileSync(join(projet, "supabase", f), "utf8");
  /* La relecture finale de chaque fichier est un `select` d'inspection : elle
     n'a pas sa place dans un banc, qui interroge lui-même. */
  const fin = t.indexOf("-- Ce que le fichier a posé");
  await pg.exec(fin < 0 ? t : t.slice(0, fin));
};
const un = async <T,>(sql: string): Promise<T | null> => ((await pg.query<T>(sql)).rows[0] ?? null);
const compte = async (sql: string) => (await un<{ n: number }>(`select count(*)::int as n from ${sql}`))!.n;
/** Vrai quand la base a refusé l'écriture — c'est ce qu'on attend d'elle. */
const refuse = async (sql: string): Promise<boolean> => {
  try {
    await pg.exec(sql);
    return false;
  } catch {
    return true;
  }
};
const idDe = async (plaque: string) => (await un<{ id: string }>(`select id from vehicule where immatriculation = '${plaque}'`))!.id;

/* -- 1. Les cinq attelages du parc lourd ---------------------------------- */

attendu("aucun attelage avant le chargement", (await compte("attelage")) === 0);
await jouer("attelages.sql");

const charges = (
  await pg.query<{ numero: string; tracteur: string; remorque: string; cat_t: string; cat_r: string; permanent: boolean; fin: string | null }>(`
  select a.numero, t.immatriculation as tracteur, r.immatriculation as remorque,
         t.categorie::text as cat_t, r.categorie::text as cat_r, a.permanent, a.fin::text
    from attelage a join vehicule t on t.id = a.tracteur_id join vehicule r on r.id = a.remorque_id
   order by a.numero`)
).rows;

attendu(`les cinq attelages du parc lourd sont chargés (${charges.length})`, charges.length === 5);
for (const a of charges) console.log(`    ${a.numero} : ${a.tracteur} (${a.cat_t}) + ${a.remorque} (${a.cat_r})`);

/* Le contrôle qui compte : un chargement par plaques peut inverser les deux
   colonnes sans que rien ne proteste, et la fiche dirait alors qu'une citerne
   tracte un Renault. */
const inverses = charges.filter((a) => a.cat_t !== "tracteur" || a.cat_r !== "semi-remorque");
attendu(`chaque attelage a bien un tracteur et une semi-remorque${inverses.length ? ` — inversés : ${inverses.map((a) => a.numero).join(", ")}` : ""}`, inverses.length === 0);
attendu("les cinq sont permanents et ouverts : ce sont les attelages de référence du parc", charges.every((a) => a.permanent && a.fin === null));
attendu("aucun véhicule n'apparaît deux fois", new Set(charges.flatMap((a) => [a.tracteur, a.remorque])).size === 10);

await jouer("attelages.sql");
attendu("rejouable : le fichier rejoué n'ajoute rien", (await compte("attelage")) === 5);

/* -- 2. Ce que la base refuse --------------------------------------------- */

const tracteur = await idDe("AA927CA");
const semi = await idDe("AA053AP");
const autreSemi = await idDe("AA713VE");
/* Une semi qu'aucun attelage ne tient : celles des cinq du parc sont prises,
   et s'en servir ferait échouer le contrôle pour la mauvaise raison. */
const semiLibre = (await un<{ id: string; immatriculation: string }>(
  `select id, immatriculation from vehicule where categorie = 'semi-remorque'
     and id not in (select remorque_id from attelage where fin is null) order by immatriculation limit 1`,
))!;
const autreTracteur = await idDe("AA737ZW");

attendu(
  "un véhicule ne s'attelle pas à lui-même",
  await refuse(`insert into attelage (numero, tracteur_id, remorque_id, debut) values ('ATT-TEST-1', '${tracteur}', '${tracteur}', '2026-09-14')`),
);
attendu(
  "une fin antérieure au début est refusée",
  await refuse(`insert into attelage (numero, tracteur_id, remorque_id, debut, fin) values ('ATT-TEST-2', '${tracteur}', '${autreSemi}', '2026-09-14', '2026-09-01')`),
);
attendu(
  "un tracteur ne tire pas deux semi-remorques à la fois",
  await refuse(`insert into attelage (numero, tracteur_id, remorque_id, debut) values ('ATT-TEST-3', '${tracteur}', '${autreSemi}', '2026-09-14')`),
);
attendu(
  "une semi-remorque n'est pas tirée par deux tracteurs à la fois",
  await refuse(`insert into attelage (numero, tracteur_id, remorque_id, debut) values ('ATT-TEST-4', '${autreTracteur}', '${semi}', '2026-09-14')`),
);
attendu("aucun de ces refus n'a laissé de ligne", (await compte("attelage")) === 5);

/* -- 3. Dételer libère les deux véhicules --------------------------------- */

await pg.exec(`update attelage set fin = '2026-09-20' where numero = 'ATT-2026-00001'`);
attendu(
  `une fois dételé, le tracteur peut en tirer une autre (${semiLibre.immatriculation})`,
  !(await refuse(`insert into attelage (numero, tracteur_id, remorque_id, debut) values ('ATT-TEST-5', '${tracteur}', '${semiLibre.id}', '2026-09-21')`)),
);
/* Sans quoi on ne pourrait jamais réatteler ce qu'on a dételé : l'historique
   d'un même couple est la normalité, pas une anomalie. */
attendu(
  "le même couple peut se réatteler plus tard — c'est l'historique",
  !(await refuse(`insert into attelage (numero, tracteur_id, remorque_id, debut, fin) values ('ATT-TEST-6', '${tracteur}', '${semi}', '2026-09-01', '2026-09-10')`)),
);

/* -- 4. Ce que la liste Flotte lit ---------------------------------------- */

const parc = await un<{ n: number; total: number }>(`
  select jsonb_array_length(lire_parc('2025-09-14')->'attelages') as n,
         (select count(*)::int from attelage) as total`);
attendu(`lire_parc() rend les attelages en cours, et eux seuls (${parc?.n} sur ${parc?.total} lignes)`, parc?.n === (await compte("attelage where fin is null")));
const formes = await un<{ n: number }>(`select count(*)::int as n from jsonb_array_elements(lire_parc('2025-09-14')->'attelages') e where e ? 'tracteur_id' and e ? 'remorque_id'`);
attendu("chaque attelage rendu nomme ses deux véhicules", formes?.n === parc?.n);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

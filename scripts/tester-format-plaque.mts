/* Les plaques au tiret (métier, 11 septembre 2026).
 *
 * « Les nouveaux matricules sont formatés XX-YYY-ZZ, les anciens XX-YYYY-ZZ. »
 * Ce banc vérifie :
 *
 *   * l'affichage du domaine : nouvelles et anciennes plaques, plaque à une
 *     lettre finale, ce qui n'est pas une plaque ;
 *   * que toute écriture — espaces, tirets, minuscules — revient à la même clé,
 *     et qu'une plaque au tiret se lit encore dans un libellé ;
 *   * que la base affiche pareil (`plaque_affichee`, 0045), et que la migration
 *     passe au tiret les textes que l'application avait écrits avec des espaces,
 *     sans toucher la clé ni le libellé d'un document source ;
 *   * que plus aucun littéral de l'application n'écrit une plaque à espaces.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-format-plaque.mts */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { afficher, extraireDepuisLibelle, memeVehicule, normaliser } from "../src/domaine/immatriculation";

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

/* -- 1. Le domaine ------------------------------------------------------------ */

const cas: [string, string][] = [
  ["AB060KT", "AB-060-KT"],
  ["AA032EA", "AA-032-EA"],
  ["DK4923BB", "DK-4923-BB"],
  ["DK7179E", "DK-7179-E"],
  ["TH8174K", "TH-8174-K"],
  ["CHARIOT", "CHARIOT"],
];
for (const [cle, attendue] of cas) attendu(`${cle} s'affiche ${afficher(cle)}`, afficher(cle) === attendue);
attendu("« ab 060 kt », « AB-060-KT » et « AB060KT » sont la même clé", normaliser("ab 060 kt") === "AB060KT" && normaliser("AB-060-KT") === "AB060KT" && memeVehicule("AB-060-KT", "AB 060 KT"));
attendu("l'affichage revient à la clé", cas.every(([cle]) => normaliser(afficher(cle)) === cle));
attendu("une plaque au tiret se lit dans un libellé", extraireDepuisLibelle("ENTRETIEN DU VEHICULE DK-4923-BB AUX 90000 KM") === "DK4923BB" && extraireDepuisLibelle("PNEUS AA-032-EA") === "AA032EA");

/* -- 2. Le code ---------------------------------------------------------------- */

const projet = process.cwd();
const restes: string[] = [];
const parcourir = (d: string) => {
  for (const x of readdirSync(d)) {
    const p = join(d, x);
    if (statSync(p).isDirectory()) parcourir(p);
    else if (/\.(ts|tsx)$/.test(x) && !p.endsWith(join("domaine", "immatriculation.ts"))) {
      readFileSync(p, "utf8").split("\n").forEach((l, i) => {
        if (/\b[A-Z]{2} \d{3,4} [A-Z]{1,2}\b/.test(l)) restes.push(`${p.slice(projet.length + 1)}:${i + 1}`);
      });
    }
  }
};
parcourir(join(projet, "src"));
attendu(`aucune plaque à espaces dans le code de l'application (${restes.slice(0, 5).join(", ") || "aucune"})`, restes.length === 0);

/* -- 3. La base ----------------------------------------------------------------- */

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const MOI = "00000000-0000-0000-0000-000000000001";
const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key);
  insert into auth.users values ('${MOI}');
  create function auth.uid() returns uuid language sql stable as $$ select '${MOI}'::uuid $$;`);
for (const r of ["anon", "authenticated", "service_role"]) {
  try {
    await pg.exec(`create role ${r}`);
  } catch {}
}
const migrations = readdirSync(join(projet, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
for (const m of migrations.filter((f) => f < "0045")) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
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
const un = async <T>(sql: string): Promise<T> => (await pg.query(sql)).rows[0] as T;

/* Des textes écrits avant la décision, à espaces. */
const v = await un<{ id: string; immatriculation: string }>(`select id, immatriculation from vehicule order by immatriculation limit 1`);
await pg.exec(`update vehicule set commentaire = 'Remplace DK 5679 BL, à réformer' where id = '${v.id}'`);
const libelleSource = await un<{ numero: string; libelle: string } | undefined>(`select numero, libelle from depense where libelle ~ '[A-Z]{2} [0-9]{3,4} [A-Z]{2}' limit 1`);
const sujetAvant = await un<{ n: number }>(`select count(*)::int as n from notification where sujet_libelle ~ '[A-Z]{2} [0-9]{3,4} [A-Z]{1,2}'`);
const libres = await un<{ n: number }>(`select count(*)::int as n from releve_transport where immatriculation_libre ~ '^[A-Z]{2} [0-9]{3,4} [A-Z]{1,2}$'`);
const avantAvant = await un<{ d: string }>(`select plaque_affichee('AB060KT') as d`);
attendu(`avant 0045, la base écrit ${avantAvant.d}`, avantAvant.d === "AB 060 KT");

const sql = readFileSync(join(projet, "supabase/migrations", migrations.find((f) => f.startsWith("0045"))!), "utf8");
await pg.exec(sql);
await pg.exec(sql);

const base = (await pg.query<{ cle: string; affichee: string }>(`select cle, plaque_affichee(cle) as affichee from (values ${cas.map(([c]) => `('${c}')`).join(", ")}) as x(cle)`)).rows;
attendu(`plaque_affichee rend le même format que le domaine (${base.map((b) => b.affichee).join(", ")})`, base.every((b) => b.affichee === afficher(b.cle)));
const commentaire = await un<{ commentaire: string; immatriculation: string }>(`select commentaire, immatriculation from vehicule where id = '${v.id}'`);
attendu(`un commentaire écrit par l'application passe au tiret (« ${commentaire.commentaire} ») ; la clé ne bouge pas (${commentaire.immatriculation})`, commentaire.commentaire === "Remplace DK-5679-BL, à réformer" && commentaire.immatriculation === v.immatriculation);
const restesSujets = await un<{ n: number }>(`select count(*)::int as n from notification where sujet_libelle ~ '\\m[A-Z]{2} [0-9]{3,4} [A-Z]{1,2}\\M'`);
attendu(`les sujets de notification passent au tiret (${sujetAvant.n} → ${restesSujets.n} à espaces)`, restesSujets.n === 0);
const restesLibres = await un<{ n: number; tirets: number }>(`select count(*) filter (where immatriculation_libre ~ '^[A-Z]{2} [0-9]{3,4} [A-Z]{1,2}$')::int as n, count(*) filter (where immatriculation_libre ~ '^[A-Z]{2}-[0-9]{3,4}-[A-Z]{1,2}$')::int as tirets from releve_transport`);
attendu(`les plaques libres du relevé passent au tiret (${libres.n} à espaces → ${restesLibres.n} ; ${restesLibres.tirets} au tiret)`, restesLibres.n === 0 && restesLibres.tirets >= libres.n);
if (libelleSource) {
  const apres = await un<{ libelle: string }>(`select libelle from depense where numero = '${libelleSource.numero}'`);
  attendu(`le libellé d'un document source garde son écriture (« ${apres.libelle.slice(0, 50)} »)`, apres.libelle === libelleSource.libelle);
}
const cles = await un<{ n: number }>(`select count(*)::int as n from vehicule where immatriculation !~ '^[A-Z0-9]+$'`);
attendu("toutes les clés de véhicule restent sans séparateur", cles.n === 0);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

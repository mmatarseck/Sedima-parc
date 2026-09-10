/* La conformité réelle : visites techniques et licences, chargées.
 *
 * `supabase/conformite.sql` verse 113 visites techniques et 31 licences de
 * transport, tirées des deux fiches de suivi 2026 du dossier DO.
 *
 * Ce banc les charge sur une base à l'état de la production et vérifie :
 *
 *   * chaque pièce trouve son véhicule ;
 *   * **l'échéance suit toujours le passage**, et de douze mois exactement —
 *     c'est la règle que `type_document` énonce, et le chargement l'applique
 *     plutôt que d'inventer une date ;
 *   * une licence ne peut pas expirer avant d'être délivrée, ce que la table
 *     exige déjà mais qu'il vaut mieux voir échouer ici qu'en production ;
 *   * chaque licence porte exactement un véhicule ;
 *   * un véhicule n'a qu'une pièce de chaque sorte : c'est la dernière qui
 *     vaut, et deux visites valides pour un même camion se contrediraient ;
 *   * le chargement est rejouable.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-conformite-reelle.mts */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();
const MOI = "00000000-0000-0000-0000-000000000001";

const fichier = join(projet, "supabase/conformite.sql");
if (!existsSync(fichier)) {
  console.log("supabase/conformite.sql absent — lancez d'abord charger-conformite.");
  process.exit(0);
}

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
const purge = readFileSync(join(projet, "supabase/purge-demonstration.sql"), "utf8");
await pg.exec(purge.slice(purge.indexOf("begin;"), purge.indexOf("commit;") + 7));

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};
const un = async <T>(sql: string): Promise<T | undefined> => (await pg.query(sql)).rows[0] as T | undefined;

const avant = await un<{ v: number; l: number }>(
  `select (select count(*) from document where type_document_id = 'visite-technique')::int as v, (select count(*) from licence_transport where numero like 'LIC-R-%')::int as l`,
);
/* Le jeu de départ porte déjà deux licences de flotte : on ne compte que les
   nôtres, celles dont le numéro commence par « LIC-R- ». */
attendu(`la base part sans visite ni licence chargée (${avant?.v}, ${avant?.l})`, avant?.v === 0 && avant?.l === 0);

const sql = readFileSync(fichier, "utf8");
const jouer = () => pg.exec(sql.slice(0, sql.indexOf("-- Vérification")));
await jouer();

const visites = await un<{ n: number; echues: number; du: string; au: string }>(
  `select count(*)::int as n, count(*) filter (where echeance < current_date)::int as echues, min(date_effet)::text as du, max(date_effet)::text as au
     from document where type_document_id = 'visite-technique'`,
);
attendu(`${visites?.n} visites techniques, ${visites?.echues} échues, passages du ${visites?.du} au ${visites?.au}`, (visites?.n ?? 0) > 50);

const licences = await un<{ n: number; echues: number }>(
  `select count(*)::int as n, count(*) filter (where echeance < current_date)::int as echues from licence_transport where numero like 'LIC-R-%'`,
);
attendu(`${licences?.n} licences, ${licences?.echues} échues`, (licences?.n ?? 0) > 20);

/* -- Chaque pièce est complète et cohérente -------------------------------- */

const orphelines = await un<{ n: number }>(
  `select count(*)::int as n from document d left join vehicule v on v.id = d.vehicule_id where d.type_document_id = 'visite-technique' and v.id is null`,
);
attendu("chaque visite trouve son véhicule", (orphelines?.n ?? 1) === 0);

const malDatees = await un<{ n: number }>(
  `select count(*)::int as n from document
    where type_document_id = 'visite-technique'
      and echeance <> (date_effet + interval '12 months')::date`,
);
attendu("l'échéance d'une visite tombe douze mois après son passage, sans exception", (malDatees?.n ?? 1) === 0);

/* Le contrôle qui a manqué au premier jet. La fiche titre sa colonne « date
   de visite », et le chargement l'a crue : les passages sortaient jusqu'en
   2027. Une visite technique ne se passe pas l'an prochain ; un passage daté
   dans le futur veut dire qu'on a pris une échéance pour un passage. */
const passagesFuturs = await un<{ n: number }>(
  `select count(*)::int as n from document where type_document_id = 'visite-technique' and date_effet > current_date`,
);
attendu("aucun passage n'est daté dans le futur : la colonne est bien lue comme une échéance", (passagesFuturs?.n ?? 1) === 0);

const licenceAlEnvers = await un<{ n: number }>(`select count(*)::int as n from licence_transport where echeance <= date_effet`);
attendu("aucune licence n'expire avant d'être délivrée", (licenceAlEnvers?.n ?? 1) === 0);

const rattachements = await un<{ n: number; sansVehicule: number }>(
  `select (select count(*) from licence_vehicule lv join licence_transport l on l.id = lv.licence_id where l.numero like 'LIC-R-%')::int as n,
          (select count(*) from licence_transport l where l.numero like 'LIC-R-%' and not exists (select 1 from licence_vehicule lv where lv.licence_id = l.id))::int as "sansVehicule"`,
);
attendu(`les ${rattachements?.n} licences portent chacune leur véhicule`, rattachements?.n === licences?.n && rattachements?.sansVehicule === 0);

const doublons = await un<{ n: number }>(
  `select count(*)::int as n from (select vehicule_id from document where type_document_id = 'visite-technique' group by 1 having count(*) > 1) t`,
);
attendu("aucun véhicule ne porte deux visites : c'est la dernière qui vaut", (doublons?.n ?? 1) === 0);

/* -- Ce que la Conformité verra -------------------------------------------- */

const parAn = (await pg.query<{ an: string; n: number }>(
  `select to_char(echeance, 'YYYY') as an, count(*)::int as n from document where type_document_id = 'visite-technique' group by 1 order by 1`,
)).rows;
console.log(`     échéances des visites : ${parAn.map((x) => `${x.an} ${x.n}`).join(" · ")}`);

/* -- Rejouable -------------------------------------------------------------- */

await jouer();
const apres = await un<{ v: number; l: number }>(
  `select (select count(*) from document where type_document_id = 'visite-technique')::int as v, (select count(*) from licence_transport where numero like 'LIC-R-%')::int as l`,
);
attendu("un second passage n'ajoute rien", apres?.v === visites?.n && apres?.l === licences?.n);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

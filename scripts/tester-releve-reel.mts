/* Le relevé de transport réel, chargé.
 *
 * `supabase/releve-parties/` verse les voyages du relevé de tonnage
 * hebdomadaire de la Direction des Opérations, et les camions de transporteurs
 * que le référentiel ne connaissait pas.
 *
 * Ce banc les charge sur une base à l'état de la production et vérifie :
 *
 *   * que chaque voyage écrit entre en base — `on conflict do nothing` tait un
 *     numéro en double, et c'est ainsi qu'une prestation s'est déjà perdue ;
 *   * qu'un camion de transporteur roule pour **son** transporteur : un voyage
 *     qui cite un camion tiers cite le prestataire à qui ce camion appartient ;
 *   * qu'aucun camion du parc n'est compté chez les tiers, ce qui gonflerait la
 *     part externalisée ;
 *   * que chaque camion ajouté au référentiel porte au moins un voyage ;
 *   * qu'aucune destination n'est vide ;
 *   * que le tableau de bord lit les tonnes : sur la dernière semaine chargée,
 *     la situation journalière rend le tonnage total et la part des tiers ;
 *   * que le chargement est rejouable.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-releve-reel.mts */
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

const dossier = join(projet, "supabase/releve-parties");
if (!existsSync(dossier)) {
  console.log("supabase/releve-parties absent — lancez d'abord charger-releve-transport.");
  process.exit(0);
}
const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".sql")).sort();

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
const un = async <T>(sql: string): Promise<T> => (await pg.query(sql)).rows[0] as T;

const avant = await un<{ r: number; c: number }>(`select (select count(*) from releve_transport)::int as r, (select count(*) from camion_tiers)::int as c`);
attendu(`la base part sans relevé (${avant.r}) et avec ${avant.c} camions tiers`, avant.r === 0 && avant.c > 0);

const textes = fichiers.map((f) => readFileSync(join(dossier, f), "utf8"));
const jouer = async () => {
  for (const t of textes) await pg.exec(t.slice(0, t.indexOf("-- Vérification") < 0 ? t.length : t.indexOf("-- Vérification")));
};
await jouer();

/* -- Rien ne se perd --------------------------------------------------------- */

const ecrits = textes.reduce((s, t) => s + (t.match(/^ {2}\('TRP-2026-\d{5}'/gm)?.length ?? 0), 0);
const camionsEcrits = textes.reduce((s, t) => s + (t.includes("insert into camion_tiers") ? (t.match(/^ {2}\('[A-Z0-9]+', \(select id from prestataire/gm)?.length ?? 0) : 0), 0);
const apres = await un<{ r: number; t: number; c: number }>(
  `select (select count(*) from releve_transport)::int as r, (select coalesce(sum(tonnage), 0) from releve_transport)::float as t, (select count(*) from camion_tiers)::int as c`,
);
attendu(`${apres.r} voyages en base pour ${ecrits} écrits, ${Math.round(apres.t)} t`, apres.r === ecrits && ecrits > 500);
attendu(`${apres.c - avant.c} camions ajoutés au référentiel pour ${camionsEcrits} écrits`, apres.c - avant.c === camionsEcrits);

const parMode = (await pg.query<{ mode: string; n: number; t: number }>(`select mode::text, count(*)::int as n, sum(tonnage)::float as t from releve_transport group by 1 order by 1`)).rows;
console.log(`     ${parMode.map((m) => `${m.mode} ${m.n} voyages ${Math.round(m.t)} t`).join(" · ")}`);

/* -- Chaque camion roule pour les siens ------------------------------------- */

const proprietaire = await un<{ n: number }>(
  `select count(*)::int as n from releve_transport r join camion_tiers c on c.immatriculation = r.camion_tiers_immatriculation where c.prestataire_id <> r.prestataire_id`,
);
attendu("un voyage qui cite un camion tiers cite le transporteur à qui ce camion appartient", proprietaire.n === 0);

const parcChezLesTiers = await un<{ n: number }>(
  `select count(*)::int as n from releve_transport r
    where r.mode <> 'parc' and exists (select 1 from vehicule v where v.immatriculation in (r.camion_tiers_immatriculation, r.immatriculation_libre))`,
);
attendu("aucun camion du parc n'est compté chez les tiers", parcChezLesTiers.n === 0);

const parcSansVehicule = await un<{ n: number }>(`select count(*)::int as n from releve_transport where mode = 'parc' and vehicule_id is null`);
attendu("chaque voyage du parc cite son véhicule", parcSansVehicule.n === 0);

const camionsSansVoyage = await un<{ n: number }>(
  `select count(*)::int as n from camion_tiers c where c.commentaire like '%relevé de tonnage hebdomadaire%'
     and not exists (select 1 from releve_transport r where r.camion_tiers_immatriculation = c.immatriculation)`,
);
attendu("chaque camion ajouté porte au moins un voyage", camionsSansVoyage.n === 0);

const destinations = await un<{ vides: number; nonPrecisees: number }>(
  `select count(*) filter (where trim(destination) = '')::int as vides, count(*) filter (where destination = 'Non précisée')::int as "nonPrecisees" from releve_transport`,
);
attendu(`aucune destination vide (${destinations.nonPrecisees} « Non précisée »)`, destinations.vides === 0);

/* -- Ce que le tableau de bord en tire -------------------------------------- */

const dernier = (await un<{ d: string }>(`select max(date)::text as d from releve_transport`)).d;
const semaine = await un<{ total: number; tiers: number }>(
  `select sum(tonnage)::float as total, (sum(tonnage) filter (where mode <> 'parc'))::float as tiers
     from releve_transport where date between '${dernier}'::date - 6 and '${dernier}'::date`,
);
const flotte = (await un<{ f: Record<string, unknown> }>(`select situation_journaliere('${dernier}', '${dernier}')->0->'flotte' as f`)).f;
attendu(
  `au ${dernier}, la situation rend ${flotte.tonnage7} t sur 7 jours dont ${flotte.tiers_tonnage7} t aux tiers (relevé : ${Math.round(semaine.total * 10) / 10} et ${Math.round(semaine.tiers * 10) / 10})`,
  Math.abs(Number(flotte.tonnage7) - semaine.total) < 0.11 && Math.abs(Number(flotte.tiers_tonnage7) - semaine.tiers) < 0.11,
);
const part = Number(flotte.tiers_tonnage7) / Number(flotte.tonnage7);
attendu(`part confiée aux tiers sur la semaine : ${Math.round(part * 1000) / 10} %`, part > 0.5 && part < 1);

/* -- Rejouable ---------------------------------------------------------------- */

await jouer();
const encore = await un<{ r: number; c: number }>(`select (select count(*) from releve_transport)::int as r, (select count(*) from camion_tiers)::int as c`);
attendu("un second passage n'ajoute rien", encore.r === apres.r && encore.c === apres.c);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

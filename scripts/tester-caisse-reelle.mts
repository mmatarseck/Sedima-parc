/* La caisse parc réelle, 2025-2026.
 *
 * `supabase/caisse-parties/` charge les récapitulatifs de quinzaine de la
 * caisse parc. Ce banc les joue sur le référentiel de production et vérifie :
 *
 *   * que les dépenses et les mouvements annoncés entrent, et que le chargement
 *     est rejouable ;
 *   * que chaque sortie cite une dépense de caisse qui existe, du même montant,
 *     et qu'aucune dépense chargée ne reste « à régler » ;
 *   * que le solde de la base retombe sur le reste écrit au dernier
 *     récapitulatif : 29 653 F au 31 août 2026 ;
 *   * que les amendes forfaitaires entrent au registre des contraventions, et
 *     que la caisse est désormais tenue pour la situation journalière.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-caisse-reelle.mts */
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

const un = async <T>(sql: string): Promise<T> => (await pg.query(sql)).rows[0] as T;
const dossier = join(projet, "supabase/caisse-parties");
const parties = readdirSync(dossier).filter((f) => f.endsWith(".sql")).sort();
const annonce = parties.map((f) => /-- (\d+) dépenses, (\d+) mouvements/.exec(readFileSync(join(dossier, f), "utf8"))!).reduce((s, m) => ({ depenses: s.depenses + Number(m[1]), mouvements: s.mouvements + Number(m[2]) }), { depenses: 0, mouvements: 0 });

const tenueAvant = await un<{ tenue: boolean }>(`select exists (select 1 from mouvement_caisse) as tenue`);
attendu("avant le chargement, la caisse n'est pas tenue", !tenueAvant.tenue);

for (const f of parties) await pg.exec(readFileSync(join(dossier, f), "utf8"));
const compte = async () => un<{ depenses: number; mouvements: number }>(`select (select count(*)::int from depense where numero like 'DEP-CP-%') as depenses, (select count(*)::int from mouvement_caisse where numero like 'CAI-CP-%') as mouvements`);
const c1 = await compte();
attendu(`${c1.depenses} dépenses et ${c1.mouvements} mouvements entrés (${annonce.depenses} et ${annonce.mouvements} annoncés)`, c1.depenses === annonce.depenses && c1.mouvements === annonce.mouvements && c1.depenses > 3000);
for (const f of parties) await pg.exec(readFileSync(join(dossier, f), "utf8"));
const c2 = await compte();
attendu("rejouable : les fichiers rejoués n'ajoutent rien", c2.depenses === c1.depenses && c2.mouvements === c1.mouvements);

const liens = await un<{ sorties: number; orphelines: number; ecarts: number; hors_caisse: number }>(`select
    count(*) filter (where m.sens = 'sortie')::int as sorties,
    count(*) filter (where m.sens = 'sortie' and d.numero is null)::int as orphelines,
    count(*) filter (where m.sens = 'sortie' and d.montant <> m.montant)::int as ecarts,
    count(*) filter (where m.sens = 'sortie' and d.origine <> 'caisse')::int as hors_caisse
  from mouvement_caisse m left join depense d on d.numero = m.depense_numero where m.numero like 'CAI-CP-%'`);
attendu(`chaque sortie cite sa dépense de caisse, du même montant (${liens.sorties} sorties : ${liens.orphelines} orphelines, ${liens.ecarts} écarts, ${liens.hors_caisse} hors caisse)`, liens.orphelines === 0 && liens.ecarts === 0 && liens.hors_caisse === 0);
const aRegler = await un<{ n: number }>(`select count(*)::int as n from depense d where d.numero like 'DEP-CP-%' and not exists (select 1 from mouvement_caisse m where m.depense_numero = d.numero)`);
attendu(`aucune dépense chargée ne reste à régler (${aRegler.n})`, aRegler.n === 0);

const soldes = (await pg.query<{ jour: string; solde: number }>(`select jour::text, solde_caisse(jour)::float as solde from (values ('2025-01-20'::date), ('2026-08-12'::date), ('2026-08-31'::date)) as x(jour)`)).rows;
console.log("    " + soldes.map((s) => `${s.jour} : ${s.solde} F`).join(" · "));
const final = soldes.find((s) => s.jour === "2026-08-31")!;
const aout1a = soldes.find((s) => s.jour === "2026-08-12")!;
attendu(`le solde retombe sur le reste écrit au récapitulatif : 29 653 F au 31/08/2026 (${final.solde}), 64 599 F au 12/08/2026 (${aout1a.solde})`, final.solde === 29653 && aout1a.solde === 64599);
const negatifs = await un<{ n: number }>(`select count(*)::int as n from (select distinct date from mouvement_caisse) j where solde_caisse(j.date) < 0`);
attendu(`le solde n'est jamais négatif à la clôture d'un jour (${negatifs.n})`, negatifs.n === 0);

const amendes = await un<{ n: number; mois: number }>(`select count(*)::int as n, count(distinct to_char(date, 'YYYY-MM'))::int as mois from depense where numero like 'DEP-CP-%' and poste = 'contravention'`);
attendu(`les amendes entrent au registre des contraventions : ${amendes.n} sur ${amendes.mois} mois`, amendes.n > 500 && amendes.mois > 12);
const tracables = await un<{ n: number }>(`select count(*)::int as n from depense where numero like 'DEP-CP-%' and vehicule_id is null and beneficiaire is null`);
attendu("chaque dépense sans véhicule nomme quelqu'un", tracables.n === 0);
const vehicules = await un<{ n: number; distincts: number }>(`select count(vehicule_id)::int as n, count(distinct vehicule_id)::int as distincts from depense where numero like 'DEP-CP-%'`);
attendu(`${vehicules.n} dépenses rattachées à ${vehicules.distincts} véhicules par la plaque du libellé`, vehicules.n > 1500 && vehicules.distincts > 40);
const parametre = await un<{ solde: string }>(`select valeur->>'soldeInitial' as solde from parametre where cle = 'caisse'`);
attendu(`le solde reporté est remis à zéro (${parametre.solde})`, parametre.solde === "0");

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

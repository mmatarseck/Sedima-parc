/* La fraîcheur du tableau de bord gardé.
 *
 * Le tableau de bord ne se recalcule plus à chaque ouverture : il se garde dans
 * le navigateur, et se refait à la connexion ou sur demande (11 septembre 2026).
 * Ce banc vérifie :
 *
 *   * la règle — rien de gardé, un autre compte ou une connexion récente font
 *     recalculer ; un autre jour ou une saisie postérieure font signaler ; sinon
 *     les données sont à jour — et qu'elle compare des instants, pas des
 *     chaînes écrites par deux horloges ;
 *   * la fonction `derniere_saisie()` (0043) : elle rend une date sur le jeu de
 *     départ, et avance dès qu'une saisie a lieu.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-fraicheur.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { etatFraicheur } from "../src/domaine/fraicheur";

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

/* -- 1. La règle ------------------------------------------------------------- */

const garde = { compte: "u1", calculeLe: "2026-09-11T08:42:00.000Z", aujourdhui: "2026-09-11" };
const frais = (x: Partial<{ compte: string; derniereSaisie: string | null; aujourdhui: string }>) => ({ compte: "u1", derniereSaisie: "2026-09-11T08:00:00+00:00", aujourdhui: "2026-09-11", ...x });

attendu("rien de gardé : on calcule", etatFraicheur(null, frais({}), null).etat === "a-calculer");
attendu("un calcul fait pour un autre compte : on recalcule", JSON.stringify(etatFraicheur(garde, frais({ compte: "u2" }), null)) === JSON.stringify({ etat: "a-calculer", motif: "autre-compte" }));
attendu("une connexion postérieure au calcul : on recalcule", JSON.stringify(etatFraicheur(garde, frais({}), "2026-09-11T09:00:00.000Z")) === JSON.stringify({ etat: "a-calculer", motif: "connexion" }));
attendu("une connexion antérieure ne force rien", etatFraicheur(garde, frais({}), "2026-09-11T07:00:00.000Z").etat === "a-jour");
attendu("un calcul d'un jour passé : signalé", etatFraicheur(garde, frais({ aujourdhui: "2026-09-12" }), null).etat === "autre-jour");
attendu("une saisie après le calcul : signalée", etatFraicheur(garde, frais({ derniereSaisie: "2026-09-11T08:43:10.5+00:00" }), null).etat === "nouvelles-saisies");
attendu("une saisie avant le calcul : à jour", etatFraicheur(garde, frais({}), null).etat === "a-jour");
/* 09:42+01:00 est 08:42 UTC : deux écritures du même instant ne font pas une saisie nouvelle. */
attendu("les instants se comparent, pas les chaînes", etatFraicheur(garde, frais({ derniereSaisie: "2026-09-11T09:42:00+01:00" }), null).etat === "a-jour");
attendu("une base qui ne sait pas dire la dernière saisie laisse à jour", etatFraicheur(garde, frais({ derniereSaisie: null }), null).etat === "a-jour");

/* -- 2. La fonction ------------------------------------------------------------ */

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();
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
const derniere = async () => ((await pg.query(`select derniere_saisie()::text as d`)).rows[0] as { d: string | null }).d;
const avant = await derniere();
attendu(`le jeu de départ a une dernière saisie (${avant})`, avant !== null);
const sansDate = (await pg.query(`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' and table_name not in (select table_name from information_schema.columns where table_schema = 'public' and column_name in ('cree_le', 'modifie_le')) order by 1`)).rows.map((r) => (r as { table_name: string }).table_name);
console.log(`   (tables sans cree_le ni modifie_le, que la fonction ne peut pas lire : ${sansDate.join(", ") || "aucune"})`);
await pg.exec(`update vehicule set modifie_le = now() + interval '1 day' where id = (select id from vehicule limit 1)`);
const apres = await derniere();
attendu(`une saisie la fait avancer (${apres})`, apres !== null && avant !== null && Date.parse(apres) > Date.parse(avant));

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

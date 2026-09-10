/* Fabrique `supabase/plaque-dk6875.sql` — l'inventaire puis le traitement de
 * la plaque écrite deux fois.
 *
 * Toutes les listes 2026 disent DK 6875 BF ; le référentiel de l'application
 * portait DK 6875 DF. Le seed a chargé la bonne ligne ; l'ancienne est restée
 * à côté, avec l'histoire qui lui était attachée.
 *
 * Le premier jet réglait ça d'un `delete` en pied du script d'alignement. En
 * production il a buté sur `depense_tracable`, et c'était heureux : supprimer
 * un véhicule cascade dans quinze tables et délie dans six autres. On ne
 * supprime pas une ligne dont on n'a pas compté les enfants.
 *
 * L'erreur nommait la dépense `DEP-2026-17020`, identifiant
 * `e880746d-87a4-4146-a1a0-076a4af71484`. C'est **une ligne du seed lui-même**,
 * qu'on retrouve telle quelle dans `seed-02.sql`, où elle est rattachée à
 * DK 6875 BF. En production elle est restée sur DK 6875 DF : l'ancien jeu de
 * départ l'y avait posée, et le rejeu, avec son `on conflict do nothing`, a vu
 * l'identifiant déjà présent et n'a rien touché.
 *
 * C'est la troisième conséquence du `do nothing`, et on ne l'avait pas vue :
 * il ne laisse pas seulement le référentiel dans son état d'avant, il laisse
 * aussi **les transactions accrochées à l'ancienne ligne**. Elle disparaît
 * avec la purge, qui vide `depense` ; d'où l'ordre imposé plus bas.
 *
 * D'où ce script en deux parties, sur le modèle de `purge-demonstration.sql` :
 * un inventaire en lecture seule à lire d'abord, puis le traitement.
 *
 * La liste des tables n'est pas écrite à la main : elle est lue dans le
 * catalogue d'une base PGlite montée avec les migrations. Une migration qui
 * ajoutera demain une table pointant sur `vehicule` sera reprise sans que
 * personne ait à y penser.
 *
 * Piège rencontré ici même : `pg_constraint.confdeltype` est du type `"char"`,
 * et un `case ... when 'c'` sans `::text` ne filtre rien sans se plaindre. Le
 * script sortait alors avec zéro garde-fou, ce qui est pire que pas de script
 * du tout. Le banc compte les gardes, justement pour ça.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/plaque-dk6875.mts */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();

const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
for (const r of ["anon", "authenticated", "service_role"]) {
  try {
    await pg.exec(`create role ${r}`);
  } catch {}
}
for (const m of readdirSync(join(projet, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
  await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
}

/* Toute colonne qui pointe sur `vehicule`, avec ce que devient la ligne fille
 * quand le véhicule disparaît. `cascade` efface, `set null` délie. */
type Lien = { table: string; colonne: string; suppression: string };
const liens = (
  await pg.query<Lien>(`
    select c.conrelid::regclass::text as table, a.attname as colonne,
      case c.confdeltype::text when 'c' then 'cascade' when 'n' then 'set null' else 'refus' end as suppression
    from pg_constraint c
    join unnest(c.conkey) with ordinality as k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f' and c.confrelid = 'vehicule'::regclass
    order by 1, 2`)
).rows;

const efface = liens.filter((l) => l.suppression === "cascade");
const delie = liens.filter((l) => l.suppression === "set null");
const refuse = liens.filter((l) => l.suppression === "refus");
console.log(`${liens.length} lien(s) vers vehicule : ${efface.length} en cascade, ${delie.length} déliés, ${refuse.length} bloquants`);

const compte = liens
  .map((l) => `  select '${l.table}' as table_liee, '${l.colonne}' as colonne, '${l.suppression}' as a_la_suppression,
    count(*) filter (where ${l.colonne} = ancienne.id)::int as ancienne_DF,
    count(*) filter (where ${l.colonne} = nouvelle.id)::int as nouvelle_BF
  from ${l.table}, ancienne, nouvelle`)
  .join("\n  union all\n");

const sql = `-- ============================================================================
-- SEDIMA Parc — la plaque écrite deux fois : DK 6875 DF et DK 6875 BF.
--
-- Toutes les listes 2026 disent **DK 6875 BF**. Le référentiel de
-- l'application portait **DK 6875 DF**. Le seed a chargé la bonne ligne ;
-- l'ancienne est restée à côté, avec l'histoire qui lui était attachée.
--
-- **Ce n'est pas une migration, et ça ne se joue pas d'un bloc.** Supprimer un
-- véhicule cascade dans ${efface.length} tables et délie dans ${delie.length} autres. Un premier jet
-- l'avait glissé en pied du script d'alignement ; en production il a buté sur
-- la contrainte \`depense_tracable\` — la ligne portait des dépenses, les délier
-- produisait une dépense sans véhicule ni bénéficiaire — et l'échec a fait
-- retomber tout l'alignement avec lui.
--
-- La dépense qui a bloqué, \`DEP-2026-17020\`, est une ligne du seed : l'ancien
-- jeu de départ l'avait posée sur DK 6875 DF, et le rejeu, avec son
-- \`on conflict do nothing\`, a vu l'identifiant déjà là et ne l'a pas déplacée.
-- Le \`do nothing\` ne laisse pas que le référentiel dans son état d'avant : il
-- laisse aussi les transactions accrochées à l'ancienne ligne. La purge les
-- emporte — d'où l'ordre imposé ci-dessous.
--
-- ORDRE : 1. les douze parties du seed, 2. \`aligner-referentiel.sql\`,
--         3. \`purge-demonstration.sql\`, 4. ce script.
--
-- PARTIE 1 : l'inventaire, en lecture seule. À lire avant tout.
-- PARTIE 2 : le traitement, dans une transaction. À ne jouer qu'après la purge
--            \`purge-demonstration.sql\`, et après avoir lu la partie 1.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- PARTIE 1 — Inventaire (lecture seule, ne modifie rien).
--
-- Une ligne par table qui pointe sur un véhicule, avec ce qu'elle porte pour
-- chacune des deux plaques. Les lignes à zéro partout sont masquées.
--
-- Comment lire : la colonne \`ancienne_DF\` dit ce qu'on perdrait en supprimant
-- l'ancienne ligne. Si elle est à zéro partout, la partie 2 ne détruit rien.
-- Si elle porte des \`affectation\`, \`document\` ou \`licence_vehicule\` après la
-- purge, il faut décider au cas par cas avant de continuer.
-- ---------------------------------------------------------------------------

with ancienne as (select id from vehicule where immatriculation = 'DK6875DF'),
     nouvelle as (select id from vehicule where immatriculation = 'DK6875BF')
select * from (
${compte}
) t
where ancienne_DF > 0 or nouvelle_BF > 0
order by ancienne_DF desc, table_liee;


-- ---------------------------------------------------------------------------
-- PARTIE 2 — Le traitement.
--
-- Le principe : **on ne fusionne pas deux histoires**. La ligne DK 6875 BF
-- vient d'être chargée depuis les listes 2026 ; c'est elle qui reste. La ligne
-- DK 6875 DF n'existait que par une faute de frappe du référentiel, et tout ce
-- qu'elle porte a été fabriqué par l'ancien jeu de départ sous cette faute.
--
-- Les trois garde-fous, dans l'ordre :
--   1. la bonne ligne doit exister, sinon on ne supprime rien ;
--   2. l'ancienne ne doit plus porter aucune dépense, sinon la contrainte
--      \`depense_tracable\` fera échouer la transaction comme en production —
--      c'est le signe que la purge n'a pas été jouée ;
--   3. tout est dans une transaction : au moindre refus, rien ne bouge.
--
-- Si la deuxième garde bloque, jouez d'abord \`supabase/purge-demonstration.sql\`.
-- ---------------------------------------------------------------------------

begin;

do $$
declare
  ancienne uuid;
  nouvelle uuid;
  restes   int;
begin
  select id into ancienne from vehicule where immatriculation = 'DK6875DF';
  select id into nouvelle from vehicule where immatriculation = 'DK6875BF';

  if ancienne is null then
    raise notice 'DK 6875 DF absente : rien à faire, la correction a déjà eu lieu.';
    return;
  end if;

  if nouvelle is null then
    raise exception 'DK 6875 BF absente : jouez d''abord les douze parties du seed.';
  end if;

${[...delie, ...refuse]
  .map(
    (l) => `  select count(*)::int into restes from ${l.table} where ${l.colonne} = ancienne;
  if restes > 0 then
    raise exception '${l.table} porte encore % ligne(s) sur DK 6875 DF ; jouez d''abord purge-demonstration.sql.', restes;
  end if;
`,
  )
  .join("\n")}
  delete from vehicule where id = ancienne;
  raise notice 'DK 6875 DF supprimée. DK 6875 BF conservée.';
end $$;

commit;


-- ---------------------------------------------------------------------------
-- Vérification, après coup.
-- ---------------------------------------------------------------------------

select immatriculation, marque, appellation, statut
from vehicule
where immatriculation in ('DK6875DF', 'DK6875BF');
`;

writeFileSync(join(projet, "supabase/plaque-dk6875.sql"), sql, "utf8");
console.log(`supabase/plaque-dk6875.sql — inventaire de ${liens.length} table(s), ${delie.length + refuse.length} garde(s) avant suppression`);

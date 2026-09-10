-- ============================================================================
-- SEDIMA Parc — la plaque écrite deux fois : DK 6875 DF et DK 6875 BF.
--
-- Toutes les listes 2026 disent **DK 6875 BF**. Le référentiel de
-- l'application portait **DK 6875 DF**. Le seed a chargé la bonne ligne ;
-- l'ancienne est restée à côté, avec l'histoire qui lui était attachée.
--
-- **Ce n'est pas une migration, et ça ne se joue pas d'un bloc.** Supprimer un
-- véhicule cascade dans 15 tables et délie dans 6 autres. Un premier jet
-- l'avait glissé en pied du script d'alignement ; en production il a buté sur
-- la contrainte `depense_tracable` — la ligne portait des dépenses, les délier
-- produisait une dépense sans véhicule ni bénéficiaire — et l'échec a fait
-- retomber tout l'alignement avec lui.
--
-- La dépense qui a bloqué, `DEP-2026-17020`, est une ligne du seed : l'ancien
-- jeu de départ l'avait posée sur DK 6875 DF, et le rejeu, avec son
-- `on conflict do nothing`, a vu l'identifiant déjà là et ne l'a pas déplacée.
-- Le `do nothing` ne laisse pas que le référentiel dans son état d'avant : il
-- laisse aussi les transactions accrochées à l'ancienne ligne. La purge les
-- emporte — d'où l'ordre imposé ci-dessous.
--
-- ORDRE : 1. les douze parties du seed, 2. `aligner-referentiel.sql`,
--         3. `purge-demonstration.sql`, 4. ce script.
--
-- PARTIE 1 : l'inventaire, en lecture seule. À lire avant tout.
-- PARTIE 2 : le traitement, dans une transaction. À ne jouer qu'après la purge
--            `purge-demonstration.sql`, et après avoir lu la partie 1.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- PARTIE 1 — Inventaire (lecture seule, ne modifie rien).
--
-- Une ligne par table qui pointe sur un véhicule, avec ce qu'elle porte pour
-- chacune des deux plaques. Les lignes à zéro partout sont masquées.
--
-- Comment lire : la colonne `ancienne_DF` dit ce qu'on perdrait en supprimant
-- l'ancienne ligne. Si elle est à zéro partout, la partie 2 ne détruit rien.
-- Si elle porte des `affectation`, `document` ou `licence_vehicule` après la
-- purge, il faut décider au cas par cas avant de continuer.
-- ---------------------------------------------------------------------------

with ancienne as (select id from vehicule where immatriculation = 'DK6875DF'),
     nouvelle as (select id from vehicule where immatriculation = 'DK6875BF')
select * from (
  select 'affectation' as table_liee, 'vehicule_id' as colonne, 'cascade' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from affectation, ancienne, nouvelle
  union all
  select 'affretement' as table_liee, 'vehicule_remplace_id' as colonne, 'set null' as a_la_suppression,
    count(*) filter (where vehicule_remplace_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_remplace_id = nouvelle.id)::int as nouvelle_BF
  from affretement, ancienne, nouvelle
  union all
  select 'ajustement_entretien' as table_liee, 'vehicule_id' as colonne, 'cascade' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from ajustement_entretien, ancienne, nouvelle
  union all
  select 'attribution_legere' as table_liee, 'vehicule_id' as colonne, 'cascade' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from attribution_legere, ancienne, nouvelle
  union all
  select 'demande' as table_liee, 'vehicule_id' as colonne, 'cascade' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from demande, ancienne, nouvelle
  union all
  select 'demande_achat' as table_liee, 'vehicule_id' as colonne, 'set null' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from demande_achat, ancienne, nouvelle
  union all
  select 'depense' as table_liee, 'vehicule_id' as colonne, 'set null' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from depense, ancienne, nouvelle
  union all
  select 'document' as table_liee, 'vehicule_id' as colonne, 'cascade' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from document, ancienne, nouvelle
  union all
  select 'incident' as table_liee, 'vehicule_id' as colonne, 'cascade' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from incident, ancienne, nouvelle
  union all
  select 'intervention' as table_liee, 'vehicule_id' as colonne, 'cascade' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from intervention, ancienne, nouvelle
  union all
  select 'licence_vehicule' as table_liee, 'vehicule_id' as colonne, 'cascade' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from licence_vehicule, ancienne, nouvelle
  union all
  select 'mouvement_stock' as table_liee, 'vehicule_id' as colonne, 'set null' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from mouvement_stock, ancienne, nouvelle
  union all
  select 'observation_visite' as table_liee, 'vehicule_id' as colonne, 'cascade' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from observation_visite, ancienne, nouvelle
  union all
  select 'ordre_travail' as table_liee, 'vehicule_id' as colonne, 'cascade' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from ordre_travail, ancienne, nouvelle
  union all
  select 'plan_vehicule' as table_liee, 'vehicule_id' as colonne, 'cascade' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from plan_vehicule, ancienne, nouvelle
  union all
  select 'plein' as table_liee, 'vehicule_id' as colonne, 'cascade' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from plein, ancienne, nouvelle
  union all
  select 'pneu' as table_liee, 'vehicule_id' as colonne, 'set null' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from pneu, ancienne, nouvelle
  union all
  select 'releve_kilometrique' as table_liee, 'vehicule_id' as colonne, 'cascade' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from releve_kilometrique, ancienne, nouvelle
  union all
  select 'releve_transport' as table_liee, 'vehicule_id' as colonne, 'set null' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from releve_transport, ancienne, nouvelle
  union all
  select 'transfert' as table_liee, 'vehicule_id' as colonne, 'cascade' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from transfert, ancienne, nouvelle
  union all
  select 'vehicule_a_recevoir' as table_liee, 'vehicule_id' as colonne, 'refus' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from vehicule_a_recevoir, ancienne, nouvelle
  union all
  select 'visite_technique' as table_liee, 'vehicule_id' as colonne, 'cascade' as a_la_suppression,
    count(*) filter (where vehicule_id = ancienne.id)::int as ancienne_DF,
    count(*) filter (where vehicule_id = nouvelle.id)::int as nouvelle_BF
  from visite_technique, ancienne, nouvelle
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
--      `depense_tracable` fera échouer la transaction comme en production —
--      c'est le signe que la purge n'a pas été jouée ;
--   3. tout est dans une transaction : au moindre refus, rien ne bouge.
--
-- Si la deuxième garde bloque, jouez d'abord `supabase/purge-demonstration.sql`.
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

  select count(*)::int into restes from affretement where vehicule_remplace_id = ancienne;
  if restes > 0 then
    raise exception 'affretement porte encore % ligne(s) sur DK 6875 DF ; jouez d''abord purge-demonstration.sql.', restes;
  end if;

  select count(*)::int into restes from demande_achat where vehicule_id = ancienne;
  if restes > 0 then
    raise exception 'demande_achat porte encore % ligne(s) sur DK 6875 DF ; jouez d''abord purge-demonstration.sql.', restes;
  end if;

  select count(*)::int into restes from depense where vehicule_id = ancienne;
  if restes > 0 then
    raise exception 'depense porte encore % ligne(s) sur DK 6875 DF ; jouez d''abord purge-demonstration.sql.', restes;
  end if;

  select count(*)::int into restes from mouvement_stock where vehicule_id = ancienne;
  if restes > 0 then
    raise exception 'mouvement_stock porte encore % ligne(s) sur DK 6875 DF ; jouez d''abord purge-demonstration.sql.', restes;
  end if;

  select count(*)::int into restes from pneu where vehicule_id = ancienne;
  if restes > 0 then
    raise exception 'pneu porte encore % ligne(s) sur DK 6875 DF ; jouez d''abord purge-demonstration.sql.', restes;
  end if;

  select count(*)::int into restes from releve_transport where vehicule_id = ancienne;
  if restes > 0 then
    raise exception 'releve_transport porte encore % ligne(s) sur DK 6875 DF ; jouez d''abord purge-demonstration.sql.', restes;
  end if;

  select count(*)::int into restes from vehicule_a_recevoir where vehicule_id = ancienne;
  if restes > 0 then
    raise exception 'vehicule_a_recevoir porte encore % ligne(s) sur DK 6875 DF ; jouez d''abord purge-demonstration.sql.', restes;
  end if;

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

-- 0071 — Le plein d'un camion de transporteur mis à disposition (Adex).
--
-- Métier, 2 et 3 octobre 2026 : « nous devons pouvoir suivre le carburant mis
-- dans les véhicules d'Adex, vu que c'est une mise à disposition » — plein par
-- plein, et c'est SEDIMA qui fournit le carburant (cuve ou station).
--
--   1. Un plein vise un véhicule du parc **ou** un camion du référentiel des
--      transporteurs, jamais les deux, jamais aucun.
--   2. La lecture d'un plein de camion tiers suit le droit de lecture des
--      transporteurs ; celle d'un plein du parc ne change pas.
--   3. Le carburant du mois de la mise à disposition se tient seul : chaque
--      plein écrit, modifié ou retiré sur un camion tiers recalcule les litres
--      et le montant de la fiche du mois (`mise_a_disposition`, même plaque,
--      même `AAAA-MM`) — c'est elle que le coût de la mise à disposition, le
--      tableau de bord et les rapports lisent (location + carburant). Une fiche
--      créée après ses pleins les reprend à sa création. Un mois sans aucun plein
--      saisi garde ce qu'on a écrit à la main.
--
-- Ce que ça ne change pas : la consommation et les coûts du parc se calculent
-- véhicule par véhicule — un plein sans véhicule du parc n'y entre pas ; le
-- stock de la cuve compte toutes les sorties « cuve », celles d'Adex comprises,
-- et c'est voulu.
--
-- Rejouable.

-- 1. Le porteur du plein --------------------------------------------------------
alter table plein alter column vehicule_id drop not null;
alter table plein add column if not exists camion_tiers_immatriculation text
  references camion_tiers (immatriculation) on update cascade;
alter table plein drop constraint if exists plein_un_seul_porteur;
alter table plein add constraint plein_un_seul_porteur
  check ((vehicule_id is null) <> (camion_tiers_immatriculation is null));
create index if not exists plein_camion_tiers_date on plein (camion_tiers_immatriculation, date)
  where camion_tiers_immatriculation is not null;

comment on column plein.camion_tiers_immatriculation is 'Le camion de transporteur (mise à disposition) qui a reçu le plein, à la place d''un véhicule du parc (0071).';

-- 2. La lecture -------------------------------------------------------------------
drop policy if exists lecture_plein on plein;
create policy lecture_plein on plein for select using (
  vehicule_id in (select vehicule.id from vehicule)
  or (camion_tiers_immatriculation is not null and (select peut('transporteurs', 'lecture')))
);

-- 3. Le carburant du mois de la mise à disposition ---------------------------------
create or replace function recalculer_carburant_mad(plaque text, mois_vise text) returns void
language sql security definer set search_path = public as $$
  update mise_a_disposition d
     set carburant_litres = s.litres, carburant_montant = s.montant, modifie_le = now()
    from (select coalesce(sum(p.litres), 0) as litres, coalesce(sum(p.montant), 0)::bigint as montant
            from plein p
           where p.camion_tiers_immatriculation = plaque and to_char(p.date, 'YYYY-MM') = mois_vise) s
   where d.immatriculation = plaque and d.mois = mois_vise
     and (d.carburant_litres, d.carburant_montant) is distinct from (s.litres, s.montant)
$$;

create or replace function carburant_mad_apres_plein() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.camion_tiers_immatriculation is not null then
    perform recalculer_carburant_mad(old.camion_tiers_immatriculation, to_char(old.date, 'YYYY-MM'));
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.camion_tiers_immatriculation is not null then
    perform recalculer_carburant_mad(new.camion_tiers_immatriculation, to_char(new.date, 'YYYY-MM'));
  end if;
  return null;
end
$$;

drop trigger if exists carburant_mad_apres_plein on plein;
create trigger carburant_mad_apres_plein after insert or update or delete on plein
  for each row execute function carburant_mad_apres_plein();

-- Une fiche du mois créée après ses pleins les reprend : seulement s'il y en a.
create or replace function carburant_mad_a_la_creation() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  litres numeric;
  montant bigint;
begin
  select sum(p.litres), sum(p.montant)::bigint into litres, montant
    from plein p
   where p.camion_tiers_immatriculation = new.immatriculation and to_char(p.date, 'YYYY-MM') = new.mois;
  if litres is not null then
    new.carburant_litres := litres;
    new.carburant_montant := montant;
  end if;
  return new;
end
$$;

drop trigger if exists carburant_mad_a_la_creation on mise_a_disposition;
create trigger carburant_mad_a_la_creation before insert on mise_a_disposition
  for each row execute function carburant_mad_a_la_creation();

-- Personne n'appelle ces fonctions directement (0068) : les déclencheurs les
-- exécutent sans que PostgreSQL vérifie `execute`.
do $$
declare
  f record;
  r text;
begin
  for f in
    select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('recalculer_carburant_mad', 'carburant_mad_apres_plein', 'carburant_mad_a_la_creation')
  loop
    execute format('revoke execute on function %s from public', f.signature);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke execute on function %s from %I', f.signature, r);
      end if;
    end loop;
  end loop;
end
$$;

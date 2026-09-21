-- ============================================================================
-- SEDIMA Parc — 0060 : signalements, catalogue des tâches, services de
-- maintenance.
--
-- Décisions du métier du 21 septembre 2026, sur docs/PROPOSITION-MAINTENANCE.md :
--
--   1. le signalement d'une panne est distinct de l'incident ;
--   2. le service de maintenance remplace l'ordre de travail, et en reprend
--      les lignes — c'est la même table, enrichie ;
--   3. une facture de toute forme : remise par ligne, remise globale, TVA 18 %,
--      BRS 5 %, total HT, total TTC ;
--   4. un catalogue des tâches classé comme Fleetio (catégorie, système,
--      ensemble) ;
--   5. une pièce du magasin coûte son prix de référence, posé par la dernière
--      entrée de stock ;
--   6. seul le responsable du parc clôt un service.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Le catalogue des tâches de service
-- ---------------------------------------------------------------------------

create table if not exists tache_service (
  id           uuid primary key default gen_random_uuid(),
  numero       text not null unique,
  libelle      text not null,
  description  text,
  -- La classification de Fleetio (codes VMRS) : la catégorie est le chiffre
  -- des dizaines du système — 013 Freins est en catégorie 1, Châssis.
  categorie    text check (categorie is null or categorie ~ '^[0-9]$'),
  systeme      text check (systeme is null or systeme ~ '^[0-9]{3}$'),
  ensemble     text check (ensemble is null or ensemble ~ '^[0-9]{3}$'),
  type_defaut  text check (type_defaut is null or type_defaut in ('preventif', 'curatif')),
  -- Les autres noms de la même tâche, fondus à l'import : « vidange » est
  -- « Remplacement de l'huile moteur et du filtre ».
  alias        text[] not null default '{}',
  -- Le nombre d'utilisations dans l'historique Fleetio : l'ordre de la liste.
  utilisations integer not null default 0,
  source       text not null default 'saisie' check (source in ('fleetio', 'saisie')),
  -- Vrai pour une tâche que l'import n'a pas su classer : à revoir.
  a_classer    boolean not null default false,
  actif        boolean not null default true,
  cree_le      timestamptz not null default now(),
  cree_par     uuid references auth.users (id),
  modifie_le   timestamptz,
  modifie_par  uuid references auth.users (id)
);
create unique index if not exists tache_service_libelle on tache_service (lower(libelle));
comment on table tache_service is 'Le catalogue des tâches de maintenance : chaque ligne d''un service en cite une.';

-- ---------------------------------------------------------------------------
-- 2. Le signalement d'une panne ou d'une anomalie
-- ---------------------------------------------------------------------------

create table if not exists signalement (
  id           uuid primary key default gen_random_uuid(),
  numero       text not null unique,
  vehicule_id  uuid not null references vehicule (id) on delete cascade,
  date         date not null,
  priorite     text not null default 'normale' check (priorite in ('basse', 'normale', 'haute', 'critique')),
  -- Le système concerné, dans la classification du catalogue.
  systeme      text check (systeme is null or systeme ~ '^[0-9]{3}$'),
  description  text not null,
  details      text,
  kilometrage  integer check (kilometrage is null or kilometrage >= 0),
  pieces       text[] not null default '{}',
  -- « Pris en charge » ne s'écrit pas : il se lit sur le service ouvert qui
  -- l'inclut. Résolu, il l'est par la clôture de ce service, ou à la main.
  statut       text not null default 'ouvert' check (statut in ('ouvert', 'resolu', 'annule')),
  resolu_le    date,
  service_numero text,
  declarant    text,
  cree_le      timestamptz not null default now(),
  cree_par     uuid references auth.users (id),
  modifie_le   timestamptz,
  modifie_par  uuid references auth.users (id)
);
create index if not exists signalement_ouverts on signalement (vehicule_id) where statut = 'ouvert';
comment on table signalement is 'Les pannes et anomalies signalées : ce qu''un service de maintenance réparera.';

-- ---------------------------------------------------------------------------
-- 3. Le service de maintenance — l'ordre de travail, enrichi
-- ---------------------------------------------------------------------------

alter table ordre_travail add column if not exists priorite       text not null default 'planifie';
alter table ordre_travail add column if not exists date_fin       date;
alter table ordre_travail add column if not exists kilometrage    integer;
alter table ordre_travail add column if not exists numero_facture text;
-- Les lignes de la facture : tâche, main-d'œuvre, pièces achetées, pièces du
-- magasin, remise de ligne. Un tableau JSON, lu et calculé par
-- `domaine/service.ts` ; la clôture en tire les dépenses.
alter table ordre_travail add column if not exists lignes         jsonb not null default '[]'::jsonb;
alter table ordre_travail add column if not exists remise_mode    text not null default 'montant';
alter table ordre_travail add column if not exists remise_valeur  numeric(14, 2) not null default 0;
-- Les taux en pour cent, 0 quand la facture n'en porte pas : TVA 18, BRS 5.
alter table ordre_travail add column if not exists tva_taux       numeric(5, 2) not null default 0;
alter table ordre_travail add column if not exists brs_taux       numeric(5, 2) not null default 0;
alter table ordre_travail add column if not exists pieces         text[] not null default '{}';
alter table ordre_travail add column if not exists signalements   text[] not null default '{}';
alter table ordre_travail add column if not exists cloture_par    uuid references auth.users (id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ordre_priorite') then
    alter table ordre_travail add constraint ordre_priorite check (priorite in ('planifie', 'non-planifie', 'urgent'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ordre_remise_mode') then
    alter table ordre_travail add constraint ordre_remise_mode check (remise_mode in ('montant', 'pourcentage'));
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Seul le responsable du parc clôt un service
-- ---------------------------------------------------------------------------

create or replace function peut_cloturer_service() returns boolean
language sql stable as $$
  select mon_role() in ('gestionnaire-parc', 'administrateur')
$$;

-- Un déclencheur et non une politique : une politique ne compare pas l'avant
-- et l'après. La clôture se signe, et résout les signalements du service.
create or replace function garder_cloture_service() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.statut = 'clos' and old.statut is distinct from 'clos' then
    if not peut_cloturer_service() then
      raise exception 'Seul le responsable du parc clôt un service de maintenance.' using errcode = '42501';
    end if;
    new.cloture_par := auth.uid();
    new.date_cloture := coalesce(new.date_cloture, current_date);
    update signalement
       set statut = 'resolu', resolu_le = new.date_cloture, service_numero = new.numero
     where numero = any(new.signalements) and statut = 'ouvert';
  end if;
  return new;
end
$$;

drop trigger if exists garder_cloture_service on ordre_travail;
create trigger garder_cloture_service before update on ordre_travail
  for each row execute function garder_cloture_service();

-- Le responsable du parc gère la maintenance : il lisait seulement. La
-- direction garde la lecture.
create or replace function niveau_par_role(r role_applicatif, m text) returns text
language sql immutable as $$
  select case
    when r is null then 'aucun'
    when r = 'administrateur' then 'gestion'
    when r = 'gestionnaire-parc' then
      case m when 'parametres' then 'saisie' else 'gestion' end
    when r = 'direction' then
      case m when 'maintenance' then 'lecture' when 'parametres' then 'saisie' else 'gestion' end
    when r = 'responsable-maintenance' then
      case m
        when 'maintenance' then 'gestion'
        when 'flotte' then 'saisie' when 'releves' then 'saisie' when 'incidents' then 'saisie'
        when 'demandes' then 'saisie' when 'transferts' then 'saisie'
        when 'parametres' then 'aucun'
        else 'lecture' end
    when r = 'correspondant-site' then
      case m
        when 'flotte' then 'saisie' when 'releves' then 'saisie' when 'incidents' then 'saisie'
        when 'documents' then 'saisie' when 'demandes' then 'saisie' when 'transferts' then 'saisie'
        when 'chauffeurs' then 'lecture'
        else 'aucun' end
    when r = 'responsable-carburant' then
      case m
        when 'releves' then 'gestion'
        when 'flotte' then 'saisie' when 'incidents' then 'saisie'
        when 'documents' then 'saisie' when 'demandes' then 'saisie' when 'transferts' then 'saisie'
        when 'chauffeurs' then 'lecture'
        else 'aucun' end
    when r = 'controle-de-gestion' then
      case m when 'couts' then 'gestion' when 'parametres' then 'aucun' else 'lecture' end
    when r = 'achats' then
      case m when 'transporteurs' then 'gestion' when 'parametres' then 'aucun' else 'lecture' end
    when r = 'detenteur' then
      case m when 'demandes' then 'saisie' when 'transferts' then 'saisie' else 'aucun' end
    else 'aucun' end
$$;

-- ---------------------------------------------------------------------------
-- 5. Le prix de référence d'une pièce suit sa dernière entrée de stock
-- ---------------------------------------------------------------------------

create or replace function prix_reference_a_l_entree() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.nature = 'entree' and new.prix_unitaire is not null and new.prix_unitaire > 0 then
    update piece set prix_reference = new.prix_unitaire, modifie_le = now() where id = new.piece_id;
  end if;
  return new;
end
$$;

drop trigger if exists prix_reference_a_l_entree on mouvement_stock;
create trigger prix_reference_a_l_entree after insert on mouvement_stock
  for each row execute function prix_reference_a_l_entree();

-- ---------------------------------------------------------------------------
-- 6. Qui lit, qui écrit
-- ---------------------------------------------------------------------------

alter table tache_service enable row level security;
alter table signalement enable row level security;

drop policy if exists lecture_tache on tache_service;
create policy lecture_tache on tache_service for select using ((select peut('maintenance', 'lecture')));
drop policy if exists ecriture_tache on tache_service;
create policy ecriture_tache on tache_service for insert with check ((select peut('maintenance', 'saisie')));
drop policy if exists ecriture_tache_gestion on tache_service;
create policy ecriture_tache_gestion on tache_service for update using ((select peut('maintenance', 'gestion'))) with check ((select peut('maintenance', 'gestion')));
drop policy if exists ecriture_tache_retrait on tache_service;
create policy ecriture_tache_retrait on tache_service for delete using ((select peut('maintenance', 'gestion')));

drop policy if exists lecture_signalement on signalement;
create policy lecture_signalement on signalement for select using ((select peut('maintenance', 'lecture')) and vehicule_id in (select id from vehicule));
drop policy if exists ecriture_signalement on signalement;
create policy ecriture_signalement on signalement for insert with check ((select peut('maintenance', 'saisie')) or (select peut('incidents', 'saisie')));
drop policy if exists ecriture_signalement_gestion on signalement;
create policy ecriture_signalement_gestion on signalement for update using ((select peut('maintenance', 'gestion'))) with check ((select peut('maintenance', 'gestion')));
drop policy if exists ecriture_signalement_retrait on signalement;
create policy ecriture_signalement_retrait on signalement for delete using ((select peut('maintenance', 'gestion')));

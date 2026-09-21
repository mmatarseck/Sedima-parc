-- ============================================================================
-- 0061 — Les tâches de chaque intervention, et les utilisations comptées sur
-- notre parc.
--
-- Métier, 21 septembre 2026 : le nombre d'utilisations venu de Fleetio n'a
-- pas de sens pour SEDIMA ; il faut compter dans notre propre flotte, en
-- affectant chaque intervention déjà faite à la bonne tâche du catalogue, ou
-- à « Travaux non détaillés (Divers) ».
--
-- Une intervention peut couvrir plusieurs tâches (un embrayage et des
-- plaquettes). Le lien est une table. L'origine dit d'où il vient :
-- « historique » pour l'affectation des interventions passées, « saisie » pour
-- un lien posé dans l'application.
--
-- tache_service.utilisations devient le compte de notre parc : interventions
-- affectées, plus lignes des services clos. Il se recompte à chaque
-- affectation et à chaque clôture de service.
--
-- Rejouable.
-- ============================================================================

create table if not exists intervention_tache (
  intervention_id uuid not null references intervention (id) on delete cascade,
  tache_id        uuid not null references tache_service (id) on delete cascade,
  origine         text not null default 'saisie' check (origine in ('historique', 'saisie')),
  cree_le         timestamptz not null default now(),
  primary key (intervention_id, tache_id)
);

create index if not exists intervention_tache_tache on intervention_tache (tache_id);

comment on table intervention_tache is 'Les tâches du catalogue qu''une intervention a couvertes.';
comment on column tache_service.utilisations is 'Le nombre d''utilisations dans notre parc : interventions affectées et lignes des services clos.';

alter table intervention_tache enable row level security;

drop policy if exists lecture_intervention_tache on intervention_tache;
create policy lecture_intervention_tache on intervention_tache for select using (intervention_id in (select id from intervention));
drop policy if exists saisie_intervention_tache on intervention_tache;
create policy saisie_intervention_tache on intervention_tache for insert with check ((select peut('maintenance', 'saisie')));
drop policy if exists retrait_intervention_tache on intervention_tache;
create policy retrait_intervention_tache on intervention_tache for delete using ((select peut('maintenance', 'gestion')));

create or replace function recompter_utilisations_taches() returns void
language sql security definer set search_path = public as $$
  update tache_service t
     set utilisations = coalesce((select count(*) from intervention_tache it where it.tache_id = t.id), 0)
                      + coalesce((select count(distinct o.id)
                                    from ordre_travail o, jsonb_array_elements(o.lignes) l
                                   where o.statut = 'clos'
                                     and (lower(l ->> 'libelle') = lower(t.libelle) or l ->> 'libelle' = any (t.alias))), 0)
   where t.utilisations is distinct from
         coalesce((select count(*) from intervention_tache it where it.tache_id = t.id), 0)
       + coalesce((select count(distinct o.id)
                     from ordre_travail o, jsonb_array_elements(o.lignes) l
                    where o.statut = 'clos'
                      and (lower(l ->> 'libelle') = lower(t.libelle) or l ->> 'libelle' = any (t.alias))), 0);
$$;

create or replace function recompter_apres_affectation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recompter_utilisations_taches();
  return null;
end;
$$;

drop trigger if exists recompter_apres_affectation on intervention_tache;
create trigger recompter_apres_affectation after insert or delete on intervention_tache
  for each statement execute function recompter_apres_affectation();

create or replace function recompter_apres_cloture() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.statut = 'clos' and old.statut is distinct from 'clos' then
    perform recompter_utilisations_taches();
  end if;
  return null;
end;
$$;

drop trigger if exists recompter_apres_cloture on ordre_travail;
create trigger recompter_apres_cloture after update of statut on ordre_travail
  for each row execute function recompter_apres_cloture();

select recompter_utilisations_taches();

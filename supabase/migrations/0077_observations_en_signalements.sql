-- ============================================================================
-- 0077 — Les observations de visite technique deviennent des signalements.
--
-- Proposition de maintenance, lot 1 : « les observations de visite technique
-- existantes deviennent des signalements de même nature : une seule liste de
-- ce qu'il faut réparer ». Le métier, 3 octobre 2026 : « observations de
-- visite technique ».
--
-- Jusqu'ici une observation (0023) vivait à part : sa ligne dans « À faire »,
-- son statut tenu à la main, sans lien avec le service qui la répare. Désormais :
--
--   * relever une observation non corrigée ouvre un signalement qui la cite
--     (`signalement.observation_numero`) : « SIG-OBS-… », la description
--     « Visite technique : … », la priorité haute si elle est majeure, normale
--     sinon, le système déduit de sa catégorie ;
--   * le service qui inclut ce signalement le résout à sa clôture (0060) ; le
--     signalement résolu marque l'observation corrigée, à la même date, avec le
--     numéro du service ;
--   * une observation marquée corrigée à la main résout son signalement ;
--   * les observations déjà en base, non corrigées, reçoivent le leur.
--
-- Les déclencheurs sont `security definer` : qui relève une observation (droit
-- des documents ou de la maintenance) n'a pas forcément celui d'écrire un
-- signalement, et le lien ne doit pas dépendre du rôle.
--
-- Rejouable.
-- ============================================================================

alter table signalement add column if not exists observation_numero text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'signalement_observation_fk') then
    alter table signalement add constraint signalement_observation_fk foreign key (observation_numero) references observation_visite (numero) on delete set null;
  end if;
end $$;
create unique index if not exists signalement_observation on signalement (observation_numero) where observation_numero is not null;
comment on column signalement.observation_numero is 'L''observation de visite technique que ce signalement porte (0077) ; sa résolution la corrige.';

-- Le système du catalogue qu'une catégorie d'observation désigne.
create or replace function systeme_observation(categorie text) returns text
language sql immutable set search_path = public as $$
  select case categorie
    when 'freinage' then '013'
    when 'direction' then '015'
    when 'eclairage' then '034'
    when 'pneumatiques' then '017'
    when 'pollution' then '043'
    when 'carrosserie' then '002'
    when 'vitrage' then '002'
    when 'attelage' then '014'
    when 'equipements' then '050'
    else null
  end
$$;

create or replace function signaler_observation(o observation_visite) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into signalement (numero, vehicule_id, date, priorite, systeme, description, details, statut, declarant, observation_numero)
  select 'SIG-' || o.numero,
         o.vehicule_id,
         coalesce(v.date_passage, v.date_rendez_vous, o.cree_le::date, current_date),
         case o.gravite when 'majeure' then 'haute' else 'normale' end,
         systeme_observation(o.categorie),
         'Visite technique : ' || o.libelle,
         concat_ws(' · ', 'Observation ' || o.numero || ' de la visite ' || o.visite_numero || coalesce(' (PV ' || v.numero_pv || ')', ''), 'gravité ' || o.gravite, nullif(o.commentaire, '')),
         'ouvert',
         coalesce('Centre ' || nullif(v.centre, ''), 'Visite technique'),
         o.numero
    from visite_technique v
   where v.numero = o.visite_numero
  on conflict do nothing;
end
$$;

create or replace function observation_vers_signalement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.statut <> 'corrigee' then
      perform signaler_observation(new);
    end if;
  elsif new.statut = 'corrigee' and old.statut is distinct from 'corrigee' then
    update signalement
       set statut = 'resolu', resolu_le = coalesce(new.corrigee_le, current_date), service_numero = coalesce(service_numero, new.intervention_numero)
     where observation_numero = new.numero and statut = 'ouvert';
  end if;
  return null;
end
$$;

drop trigger if exists observation_vers_signalement on observation_visite;
create trigger observation_vers_signalement
  after insert or update of statut on observation_visite
  for each row execute function observation_vers_signalement();

create or replace function signalement_vers_observation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.observation_numero is not null and new.statut = 'resolu' and old.statut is distinct from 'resolu' then
    update observation_visite
       set statut = 'corrigee', corrigee_le = coalesce(new.resolu_le, current_date), intervention_numero = coalesce(intervention_numero, new.service_numero)
     where numero = new.observation_numero and statut <> 'corrigee';
  end if;
  return null;
end
$$;

drop trigger if exists signalement_vers_observation on signalement;
create trigger signalement_vers_observation
  after update of statut on signalement
  for each row execute function signalement_vers_observation();

-- Les observations déjà relevées, non corrigées, reçoivent leur signalement.
do $$
declare o observation_visite;
begin
  for o in select * from observation_visite x where x.statut <> 'corrigee' and not exists (select 1 from signalement s where s.observation_numero = x.numero) loop
    perform signaler_observation(o);
  end loop;
end $$;

select count(*) as observations_ouvertes, count(s.numero) as avec_signalement
  from observation_visite o left join signalement s on s.observation_numero = o.numero
 where o.statut <> 'corrigee';

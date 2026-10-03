-- 0069 — Balise et cartes péage sur le véhicule ; date d'ouverture de la caisse.
--
-- Demandes du métier du 2 octobre 2026 :
--
--   1. « Pour chaque véhicule, un champ pour noter s'il est équipé d'une balise
--      de géolocalisation ou pas. Aussi, s'il a une carte péage SECAA et/ou une
--      carte péage Agéroute, avec le numéro de la carte à renseigner. »
--   2. « Caisse : nettoyer les 82 à régler. Il nous faut pouvoir prendre un
--      point de départ avec un solde de départ, et commencer à suivre avec
--      rigueur à partir de cette date les entrées et sorties. »
--
-- Pour la caisse, le solde de départ existait (parametre « caisse »,
-- `soldeInitial`) ; il manquait la date. Elle se range au même endroit,
-- `dateOuverture` (AAAA-MM-JJ), réglée dans Paramètres › Caisse et cuve. Le
-- journal ne compte que les mouvements datés de ce jour ou après, le solde
-- partant du report ; l'application écarte de même ce qui « attend la caisse »
-- avant l'ouverture. Sans date posée, rien ne change.
--
-- Rejouable.

-- 1. Le véhicule ------------------------------------------------------------------
alter table vehicule add column if not exists balise_geolocalisation boolean not null default false;
alter table vehicule add column if not exists carte_peage_secaa boolean not null default false;
alter table vehicule add column if not exists numero_carte_secaa text;
alter table vehicule add column if not exists carte_peage_ageroute boolean not null default false;
alter table vehicule add column if not exists numero_carte_ageroute text;

comment on column vehicule.balise_geolocalisation is 'Équipé d''une balise de géolocalisation (0069).';
comment on column vehicule.carte_peage_secaa is 'Porte une carte péage SECAA (autoroute à péage Dakar–AIBD–Thiès–Mbour) (0069).';
comment on column vehicule.numero_carte_secaa is 'Numéro de la carte péage SECAA (0069).';
comment on column vehicule.carte_peage_ageroute is 'Porte une carte péage Agéroute (0069).';
comment on column vehicule.numero_carte_ageroute is 'Numéro de la carte péage Agéroute (0069).';

-- 2. La date d'ouverture de la caisse ------------------------------------------------
-- Le solde d'un jour : le report, et les seuls mouvements datés de l'ouverture
-- à ce jour.
create or replace function solde_caisse(jour date) returns bigint
language sql stable set search_path = public as $$
  select coalesce((select (valeur->>'soldeInitial')::bigint from parametre where cle = 'caisse'), 1500000)
       + coalesce((select sum(case when sens = 'entree' then montant else -montant end)
                     from mouvement_caisse
                    where date <= jour
                      and date >= coalesce((select nullif(valeur->>'dateOuverture', '')::date from parametre where cle = 'caisse'), '-infinity'::date)), 0)
$$;

-- La situation journalière (0042) lit les mouvements de caisse dans une seule
-- expression. Plutôt que de recopier ses 17 500 caractères — et de risquer d'en
-- altérer un —, on relit sa définition en place et on ne change que cette
-- ligne. Sans effet si elle est déjà changée, ou si la définition a bougé : un
-- avis le dit alors, et rien n'est écrit.
do $$
declare
  definition text;
  ancien constant text := 'from mouvement_caisse c where c.date <= jusqua';
  nouveau constant text := 'from mouvement_caisse c where c.date <= jusqua and c.date >= coalesce((select nullif(valeur->>''dateOuverture'', '''')::date from parametre where cle = ''caisse''), ''-infinity''::date)';
begin
  select pg_get_functiondef('public.situation_journaliere(date, date)'::regprocedure) into definition;
  if position('dateOuverture' in definition) > 0 then
    return;
  end if;
  if position(ancien in definition) = 0 then
    raise notice '0069 : situation_journaliere ne lit plus la caisse comme en 0042 — date d''ouverture non appliquée au tableau de bord.';
    return;
  end if;
  execute replace(definition, ancien, nouveau);
end
$$;

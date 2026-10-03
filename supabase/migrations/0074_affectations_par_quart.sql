-- 0074 — Les affectations par quart : matin et soir, avec leurs heures de relève.
--
-- Métier, 3 octobre 2026 : « pour certains véhicules, surtout les vracs qui
-- travaillent en 2 quarts, on doit pouvoir faire les affectations en quart de
-- matin et en quart de soir, de façon récurrente, en indiquant les heures de
-- relève ».
--
--   1. Une affectation porte un quart — matin ou soir — ou aucun (la journée
--      entière, comme jusqu'ici), et pour un quart ses heures de prise et de
--      relève. Elle vaut chaque jour de sa période : c'est la récurrence.
--   2. Un véhicule garde un seul titulaire à la fois, **par quart** : un
--      titulaire du matin et un titulaire du soir coexistent ; un titulaire de
--      journée exclut les deux. La contrainte d'exclusion le dit en base.
--   3. Les lectures du parc, de la fiche et des chauffeurs rendent le quart et
--      ses heures.
--
-- Rejouable.

alter table affectation add column if not exists quart text;
alter table affectation add column if not exists heure_debut time;
alter table affectation add column if not exists heure_fin time;

alter table affectation drop constraint if exists affectation_quart;
alter table affectation add constraint affectation_quart check (
  (quart is null and heure_debut is null and heure_fin is null)
  or (quart in ('matin', 'soir') and heure_debut is not null and heure_fin is not null)
);

comment on column affectation.quart is 'Quart de travail (0074) : matin ou soir ; nul pour la journée entière.';
comment on column affectation.heure_debut is 'Heure de prise du quart (0074).';
comment on column affectation.heure_fin is 'Heure de relève du quart (0074).';

-- Un titulaire par véhicule et par quart : la journée [1,3) recouvre le matin
-- [1,2) et le soir [2,3), qui ne se recouvrent pas entre eux.
alter table affectation drop constraint if exists affectation_un_seul_titulaire;
alter table affectation add constraint affectation_un_seul_titulaire exclude using gist (
  vehicule_id with =,
  daterange(debut, coalesce(fin, 'infinity'::date), '[]') with &&,
  (case quart when 'matin' then int4range(1, 2) when 'soir' then int4range(2, 3) else int4range(1, 3) end) with &&
) where (role = 'titulaire');

-- Les lectures rendent le quart et ses heures — même geste que la 0069 : on
-- corrige la définition en place, sur le texte exact.
do $$
declare
  f text;
  def text;
  avant constant text := '''role'', a.role, ''debut'', a.debut, ''fin'', a.fin';
  apres constant text := '''role'', a.role, ''quart'', a.quart, ''heure_debut'', a.heure_debut, ''heure_fin'', a.heure_fin, ''debut'', a.debut, ''fin'', a.fin';
begin
  foreach f in array array['lire_parc', 'lire_fiche', 'lire_chauffeurs', 'lire_fiche_chauffeur'] loop
    def := pg_get_functiondef(f::regproc);
    if position(apres in def) > 0 then
      continue;
    elsif position(avant in def) > 0 then
      execute replace(def, avant, apres);
    else
      raise exception '% : texte attendu introuvable', f;
    end if;
  end loop;
end
$$;

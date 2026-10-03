-- 0073 — Les capacités qui ne se comptent pas en tonnes.
--
-- Métier, 3 octobre 2026 : « les véhicules destinés à la livraison de
-- poussins, de poulettes, d'OAC ou d'œufs de table ont des capacités
-- alternatives, pas en tonnes mais en nombre de plateaux d'œufs, de milliers
-- de poussins, de poulettes ou poulets vifs (ces deux derniers sont pareils en
-- termes de capacité) ».
--
-- Un véhicule du parc ou un camion de transporteur porte donc, à côté de sa
-- charge utile, sa nature de chargement spécialisé et sa capacité dans l'unité
-- de cette nature :
--   - oeufs            : œufs à couver (OAC) et œufs de table, en plateaux ;
--   - poussins         : en milliers de poussins ;
--   - volailles-vives  : poulettes et poulets vifs, en nombre de sujets.
-- Les deux vont ensemble : une capacité sans nature ne se lirait pas.
--
-- Point de départ : l'Aubineau AA-300-PT, « 40 000 poussins » à son
-- appellation. Les autres se renseignent sur leur fiche.
--
-- Rejouable.

do $$
declare
  t text;
begin
  foreach t in array array['vehicule', 'camion_tiers'] loop
    execute format('alter table %I add column if not exists chargement_special text', t);
    execute format('alter table %I add column if not exists capacite_speciale numeric(10, 1)', t);
    execute format('alter table %I drop constraint if exists %I', t, t || '_chargement_special');
    execute format($f$alter table %I add constraint %I check (
      (chargement_special is null or chargement_special in ('oeufs', 'poussins', 'volailles-vives'))
      and (capacite_speciale is null or (capacite_speciale > 0 and chargement_special is not null))
    )$f$, t, t || '_chargement_special');
  end loop;
end
$$;

comment on column vehicule.chargement_special is 'Chargement spécialisé (0073) : oeufs (plateaux), poussins (milliers), volailles-vives (sujets).';
comment on column vehicule.capacite_speciale is 'Capacité dans l''unité du chargement spécialisé (0073).';
comment on column camion_tiers.chargement_special is 'Chargement spécialisé (0073) : oeufs (plateaux), poussins (milliers), volailles-vives (sujets).';
comment on column camion_tiers.capacite_speciale is 'Capacité dans l''unité du chargement spécialisé (0073).';

update vehicule set chargement_special = 'poussins', capacite_speciale = 40
 where immatriculation = 'AA300PT' and chargement_special is null;

-- ============================================================================
-- SEDIMA Parc — 0047 : ce qu'une sortie de parc laisse écrit.
--
-- Le statut « sorti » (0046) dit que le véhicule a quitté le parc ; ces deux
-- colonnes disent **quand** et **pourquoi**. Sans elles, un véhicule sorti en
-- 2023 et un sorti hier se ressembleraient, et le motif se perdrait dans le
-- journal des modifications — lisible, mais pas interrogeable.
--
-- Le motif est un texte contrôlé plutôt qu'une énumération : le vocabulaire
-- d'une sortie de parc s'allonge avec l'usage (une fin de location, une
-- restitution de leasing), et un `check` se modifie sans toucher au type.
--
-- La contrainte tient l'invariant : un véhicule sorti porte sa date. Elle ne
-- regarde pas les autres statuts — un véhicule en retrait peut déjà porter la
-- date prévue de sa sortie sans être sorti.
-- ============================================================================

alter table vehicule add column if not exists date_sortie  date;
alter table vehicule add column if not exists motif_sortie text
  check (motif_sortie is null or motif_sortie in ('cede', 'reforme', 'detruit', 'vole', 'fin-de-location', 'autre'));

comment on column vehicule.date_sortie  is 'Le jour où le véhicule a quitté le parc ; exigée dès que le statut est « sorti ».';
comment on column vehicule.motif_sortie is 'Pourquoi il est sorti : cédé, réformé, détruit, volé, fin de location, autre.';

alter table vehicule drop constraint if exists sortie_datee;
alter table vehicule add  constraint sortie_datee check (statut <> 'sorti' or date_sortie is not null);

-- Les sorties se lisent par date : « qu'est-ce qui est sorti cette année ».
create index if not exists vehicule_date_sortie_idx on vehicule (date_sortie desc) where date_sortie is not null;

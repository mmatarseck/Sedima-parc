-- ============================================================================
-- SEDIMA Parc — 0044 : les livraisons, rattachées aux véhicules qui les portent.
--
-- Demande du métier (11 septembre 2026) : « préparer les données de livraison
-- et associer aux différents véhicules ».
--
-- Sage X3 écrit, sur chaque bon de livraison, la plaque du camion et le nom
-- du chauffeur. Le relevé de transport (`releve_transport`) compte des
-- voyages et des tonnes par camion et par jour ; le bon de livraison est une
-- autre maille — un voyage en porte plusieurs, pour plusieurs clients. Les
-- deux ne se mélangent pas : le relevé reste la source des tonnes du tableau
-- de bord, et la livraison dit, véhicule par véhicule, ce qui a été livré,
-- à qui et quand.
--
-- UNE LIGNE PAR BON. Le poids ne compte que les unités en kilos ; un bon en
-- sacs ou en unités garde ses quantités (`quantites`), et son poids reste
-- **nul** — inconnu, pas zéro.
--
-- LE RATTACHEMENT : un véhicule du parc, ou un camion tiers et son
-- transporteur, ou un enlèvement par le client. La plaque lue reste écrite
-- (`immatriculation`), et l'écriture du bon quand elle a été corrigée
-- (`immatriculation_source`).
-- ============================================================================

create table if not exists livraison (
  id                            uuid primary key default gen_random_uuid(),
  -- Le numéro du bon dans Sage X3 : « BL26080000031 ».
  numero                        text not null unique,
  date                          date not null,
  -- L'usine ou le site d'expédition : UAB, MINOTERIE, NDIAR ABATTOIR…
  site                          text not null,
  client                        text,
  produits                      text,
  poids_kg                      numeric(12, 1) check (poids_kg is null or poids_kg >= 0),
  quantites                     jsonb not null default '{}'::jsonb,
  lignes                        integer not null default 1 check (lignes > 0),
  mode                          text not null check (mode in ('parc', 'transporteur', 'client', 'inconnu')),
  vehicule_id                   uuid references vehicule (id) on delete set null,
  camion_tiers_immatriculation  text references camion_tiers (immatriculation) on delete set null,
  prestataire_id                uuid references prestataire (id) on delete set null,
  immatriculation               text,
  immatriculation_source        text,
  transporteur_libelle          text,
  chauffeur                     text,
  source                        text not null,
  cree_le                       timestamptz not null default now(),
  cree_par                      uuid references auth.users (id),
  modifie_le                    timestamptz,
  modifie_par                   uuid references auth.users (id),
  constraint livraison_parc check (mode <> 'parc' or vehicule_id is not null)
);

create index if not exists livraison_vehicule on livraison (vehicule_id, date desc) where vehicule_id is not null;
create index if not exists livraison_camion on livraison (camion_tiers_immatriculation, date desc) where camion_tiers_immatriculation is not null;
create index if not exists livraison_prestataire on livraison (prestataire_id, date desc) where prestataire_id is not null;
create index if not exists livraison_date on livraison (date);

comment on table livraison is 'Les bons de livraison Sage X3, un par ligne, rattachés au véhicule du parc ou au camion tiers qui les a portés. Le poids est nul quand le bon n''est pas en kilos.';

alter table livraison enable row level security;

-- Se lit avec les relevés ; celle d'un véhicule du parc, si l'on voit le véhicule.
drop policy if exists lecture_livraison on livraison;
create policy lecture_livraison on livraison for select using (
  (select peut('releves', 'lecture')) and (vehicule_id is null or vehicule_id in (select id from vehicule))
);
drop policy if exists ecriture_livraison on livraison;
create policy ecriture_livraison on livraison for insert with check ((select peut('releves', 'saisie')));
drop policy if exists correction_livraison on livraison;
create policy correction_livraison on livraison for update using ((select peut('releves', 'saisie'))) with check ((select peut('releves', 'saisie')));

drop trigger if exists livraison_horodatage on livraison;
create trigger livraison_horodatage before update on livraison for each row execute function marquer_modification();

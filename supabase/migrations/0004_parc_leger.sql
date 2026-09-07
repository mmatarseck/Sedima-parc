-- ============================================================================
-- SEDIMA Parc — 0004 : le parc léger — véhicules de service, de fonction, plan car.
--
-- Cadrage du métier du 7 septembre 2026. Le parc ne se limite pas aux
-- véhicules de transport : il suit aussi les véhicules légers remis aux agents
-- de terrain (service) et ceux attribués à des personnes selon leur niveau de
-- responsabilité (fonction), dont ceux d'un plan car — cédés à l'attributaire
-- au terme d'une durée. Le parc les suit parce que leur maintenance est à sa
-- charge et parce que le carburant de leurs attributaires est un forfait
-- mensuel absorbé en charge, sur la BU de l'agent.
--
-- Ce que la base retient :
--
--   * un **régime d'usage** sur chaque véhicule — exploitation, service,
--     fonction. Seule l'exploitation entre dans les charges de livraison ;
--     tout le parc entre dans la maintenance et le carburant ;
--   * l'**attributaire** : la personne qui tient un véhicule et qui n'est pas
--     un chauffeur — nom, fonction, département, BU ;
--   * l'**attribution** d'un véhicule léger à une personne ou à un pool, avec
--     le plan car quand il y en a un : durée, début, statut. La mensualité
--     que paie l'attributaire **n'est pas ici** : c'est une donnée de paie ;
--   * le **forfait carburant** d'un attributaire, en montant mensuel — nul
--     quand il suit le paramètre ;
--   * les **véhicules à recevoir** — commandés, pas encore immatriculés — qui
--     ne peuvent pas entrer dans `vehicule` sans immatriculation.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Le régime d'usage
-- ---------------------------------------------------------------------------

create type regime_usage as enum ('exploitation', 'service', 'fonction');

alter table vehicule add column regime regime_usage not null default 'exploitation';
create index on vehicule (regime);

comment on column vehicule.regime is 'Exploitation (livraison), service (agent de terrain ou pool) ou fonction (attribué à une personne). Seule l''exploitation compte dans le coût à la tonne.';

-- ---------------------------------------------------------------------------
-- 2. Les attributaires
-- ---------------------------------------------------------------------------

create table attributaire (
  id            uuid primary key default gen_random_uuid(),
  nom           text not null,
  fonction      text,
  departement   text,
  -- La BU de l'agent : c'est elle qui porte la charge au budget.
  business_unit business_unit,
  matricule_rh  text,
  actif         boolean not null default true,
  cree_le       timestamptz not null default now(),
  cree_par      uuid references auth.users (id),
  modifie_le    timestamptz,
  modifie_par   uuid references auth.users (id)
);

create unique index on attributaire (lower(nom));

-- ---------------------------------------------------------------------------
-- 3. Les attributions et le plan car
-- ---------------------------------------------------------------------------

create table attribution_legere (
  id                  uuid primary key default gen_random_uuid(),
  vehicule_id         uuid not null references vehicule (id) on delete cascade,
  attributaire_id     uuid references attributaire (id),
  -- Le pool ou le service quand personne n'est nommé : « DACI · DSI · CG », « Sécurité ».
  pool                text,
  debut               date,
  fin                 date,
  plan_car            boolean not null default false,
  -- Durée propre au dossier ; nulle quand elle suit le paramètre « parc-leger ».
  plan_car_duree_mois integer check (plan_car_duree_mois is null or plan_car_duree_mois > 0),
  -- Premier mois du plan, en « AAAA-MM » ; nul tant que le dossier ne l'a pas dit.
  plan_car_debut      text check (plan_car_debut is null or plan_car_debut ~ '^\d{4}-\d{2}$'),
  plan_car_statut     text not null default 'en-cours' check (plan_car_statut in ('en-cours', 'cede')),
  commentaire         text,
  cree_le             timestamptz not null default now(),
  cree_par            uuid references auth.users (id),
  modifie_le          timestamptz,
  modifie_par         uuid references auth.users (id),
  -- Une attribution nomme quelqu'un, ou un pool, jamais rien.
  constraint attribution_un_porteur check (attributaire_id is not null or pool is not null),
  -- Le plan car ne se conçoit que pour une personne nommée.
  constraint plan_car_nomme check (not plan_car or attributaire_id is not null)
);

-- Un véhicule n'a qu'une attribution en cours à la fois.
create unique index attribution_legere_courante on attribution_legere (vehicule_id) where fin is null;
create index on attribution_legere (attributaire_id);

-- ---------------------------------------------------------------------------
-- 4. Le forfait carburant
-- ---------------------------------------------------------------------------

create table forfait_carburant (
  attributaire_id uuid primary key references attributaire (id) on delete cascade,
  -- Nul : le montant suit le paramètre « parc-leger » (150 000 F par mois au cadrage).
  montant_mensuel bigint check (montant_mensuel is null or montant_mensuel >= 0),
  carte           text,
  debut           date,
  fin             date,
  modifie_le      timestamptz,
  modifie_par     uuid references auth.users (id)
);

-- ---------------------------------------------------------------------------
-- 5. Les véhicules à recevoir
-- ---------------------------------------------------------------------------

create table vehicule_a_recevoir (
  id              uuid primary key default gen_random_uuid(),
  lot             text not null unique,
  marque          text not null,
  modele          text not null,
  categorie       categorie_vehicule not null,
  regime          regime_usage not null default 'service',
  attributaire_id uuid references attributaire (id),
  pool            text,
  business_unit   business_unit,
  commentaire     text,
  -- Renseigné à la réception : le véhicule entre alors dans `vehicule` et cette ligne se ferme.
  recu_le         date,
  vehicule_id     uuid references vehicule (id),
  cree_le         timestamptz not null default now(),
  cree_par        uuid references auth.users (id)
);

-- ---------------------------------------------------------------------------
-- 6. Horodatage et politiques
-- ---------------------------------------------------------------------------

create trigger attributaire_horodatage before update on attributaire for each row execute function marquer_modification();
create trigger attribution_legere_horodatage before update on attribution_legere for each row execute function marquer_modification();
create trigger forfait_carburant_horodatage before update on forfait_carburant for each row execute function marquer_modification();

alter table attributaire        enable row level security;
alter table attribution_legere  enable row level security;
alter table forfait_carburant   enable row level security;
alter table vehicule_a_recevoir enable row level security;

-- Lecture par tout compte ; écriture par ceux qui écrivent le parc.
create policy lecture_attributaire        on attributaire        for select using (mon_role() is not null);
create policy lecture_attribution_legere  on attribution_legere  for select using (mon_role() is not null);
create policy lecture_forfait_carburant   on forfait_carburant   for select using (mon_role() is not null);
create policy lecture_vehicule_a_recevoir on vehicule_a_recevoir for select using (mon_role() is not null);

create policy ecriture_attributaire        on attributaire        for all using (peut_ecrire_parc()) with check (peut_ecrire_parc());
create policy ecriture_attribution_legere  on attribution_legere  for all using (peut_ecrire_parc()) with check (peut_ecrire_parc());
create policy ecriture_forfait_carburant   on forfait_carburant   for all using (peut_ecrire_parc()) with check (peut_ecrire_parc());
create policy ecriture_vehicule_a_recevoir on vehicule_a_recevoir for all using (peut_ecrire_parc()) with check (peut_ecrire_parc());

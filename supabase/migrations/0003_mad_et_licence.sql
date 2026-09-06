-- ============================================================================
-- SEDIMA Parc — 0003 : ce que le premier passage du seed a appris à la base.
--
-- Deux règles du code que 0001 et 0002 ne portaient pas encore, révélées en
-- versant le jeu de démonstration : la base refusait des lignes que
-- l'application tient pour justes.
--
--   1. Une **mise à disposition** peut porter sur un mois entamé. 0002
--      exigeait 28 à 31 jours calendaires — vrai du mois échu, pas du mois en
--      cours, où l'écran Transporteurs ne compte que les jours écoulés : compter
--      le mois plein ferait porter à deux jours de septembre le coût de trente
--      (src/donnees/transporteurs-demo.ts). Au moins un jour, au plus trente et un.
--
--   2. La **licence de transport** est portée par la flotte, ou par une partie
--      de la flotte, jamais par un véhicule seul (décision du métier,
--      3 septembre 2026 — src/domaine/types.ts, LicenceTransport). 0001 la
--      déclarait bien comme type de document à porteur « flotte », mais ne lui
--      donnait aucune table : le seed la recopiait sur chaque véhicule couvert,
--      et l'unicité du numéro n'en gardait qu'un. Elle a maintenant sa table et
--      son périmètre ; chaque véhicule couvert l'affiche parmi ses documents,
--      l'échéancier ne la compte qu'une fois.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Mise à disposition : le mois en cours
-- ---------------------------------------------------------------------------

alter table mise_a_disposition
  drop constraint mise_a_disposition_jours_calendaires_check,
  add constraint mise_a_disposition_jours_calendaires_check
    check (jours_calendaires between 1 and 31);

-- ---------------------------------------------------------------------------
-- 2. Licence de transport
-- ---------------------------------------------------------------------------

create table licence_transport (
  id           uuid primary key default gen_random_uuid(),
  numero       text not null unique,
  libelle      text not null,
  numero_piece text not null,
  emetteur     text not null,
  -- « flotte » : tout le parc, sans ligne de périmètre ; « partie » : les
  -- véhicules listés dans licence_vehicule, et eux seuls.
  perimetre    text not null check (perimetre in ('flotte', 'partie')),
  date_effet   date not null,
  echeance     date not null check (echeance > date_effet),
  fichier      text,
  cree_le      timestamptz not null default now(),
  cree_par     uuid references auth.users (id),
  modifie_le   timestamptz,
  modifie_par  uuid references auth.users (id)
);

create table licence_vehicule (
  licence_id  uuid not null references licence_transport (id) on delete cascade,
  vehicule_id uuid not null references vehicule (id) on delete cascade,
  primary key (licence_id, vehicule_id)
);

create index on licence_transport (echeance);

-- Une licence de flotte ne liste personne ; une licence partielle liste ses
-- véhicules. La contrainte ne peut pas lire une autre table : c'est un
-- déclencheur, sur les deux tables, qui tient la règle.
create or replace function licence_perimetre_coherent() returns trigger
language plpgsql as $$
declare p text;
begin
  select perimetre into p from licence_transport where id = new.licence_id;
  if p = 'flotte' then
    raise exception 'La licence % couvre toute la flotte : elle ne liste pas de véhicule.', new.licence_id
      using errcode = 'check_violation';
  end if;
  return new;
end
$$;

create trigger licence_vehicule_perimetre before insert or update on licence_vehicule
  for each row execute function licence_perimetre_coherent();

-- Le passage de « partie » à « flotte » vide le périmètre : les lignes n'ont
-- plus de sens, et les laisser ferait mentir la première lecture.
create or replace function licence_flotte_sans_perimetre() returns trigger
language plpgsql as $$
begin
  if new.perimetre = 'flotte' then
    delete from licence_vehicule where licence_id = new.id;
  end if;
  return new;
end
$$;

create trigger licence_transport_perimetre after update of perimetre on licence_transport
  for each row execute function licence_flotte_sans_perimetre();

create trigger licence_transport_horodatage before update on licence_transport
  for each row execute function marquer_modification();

-- Lecture par tout compte ; écriture par ceux qui écrivent le parc — la
-- licence est un document du parc, elle suit la règle des documents.
alter table licence_transport enable row level security;
alter table licence_vehicule  enable row level security;

create policy lecture_licence  on licence_transport for select using (mon_role() is not null);
create policy ecriture_licence on licence_transport for all using (peut_ecrire_parc()) with check (peut_ecrire_parc());
create policy lecture_licence_vehicule  on licence_vehicule for select using (mon_role() is not null);
create policy ecriture_licence_vehicule on licence_vehicule for all using (peut_ecrire_parc()) with check (peut_ecrire_parc());

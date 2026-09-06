-- ============================================================================
-- SEDIMA Parc — 0002 : transporteurs, entretien, compte fournisseur, budget,
-- rapports personnalisés.
--
-- Tout ce que 0001 avait laissé de côté parce qu'il dépend du socle. Les
-- règles portées ici sont celles que le code applique déjà sur le jeu de
-- démonstration ; la base ne les réinvente pas, elle les rend opposables :
--
--   * une **exception tarifaire** porte un motif, ou elle n'existe pas ;
--   * un **rattachement de localité** dit s'il est convenu ou d'usage ;
--   * un **ajustement d'entretien** porte un motif — une périodicité resserrée
--     sans raison écrite se retourne contre l'atelier à la première discussion
--     de coût ;
--   * une **enveloppe** se tient par poste et business unit, et dit sur quelle
--     base elle a été posée.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Énumérations
-- ---------------------------------------------------------------------------

create type forme_transporteur    as enum ('societe', 'particulier');
create type mode_remuneration      as enum ('tonne', 'journee', 'mission');
create type unite_tarif            as enum ('tonne', 'forfait', 'km');
create type source_tarif           as enum ('contrat', 'accord-verbal', 'a-confirmer');
create type convention_facturation as enum ('net-majore', 'brut-retenu', 'inconnue');
create type motif_affretement      as enum ('pointe', 'aucun-disponible', 'vehicule-immobilise', 'hors-perimetre', 'capacite-particuliere');
create type statut_affretement     as enum ('demande', 'confirme', 'en-cours', 'livre', 'facture', 'regle', 'annule');
create type famille_mad            as enum ('aliments', 'oeufs', 'son-de-ble');
create type unite_prestation       as enum ('voyage', 'rotation', 'sac', 'jour', 'mois');
create type mode_execution         as enum ('parc', 'transporteur', 'enlevement-client', 'prestataire-ponctuel');
create type produit_transporte     as enum ('aliment', 'son-de-ble', 'poussins', 'poulets', 'oeufs', 'phosphate', 'personnel', 'autre');
create type origine_rattachement   as enum ('convenu', 'usage');
create type groupe_operation       as enum ('moteur', 'freinage', 'pneumatiques', 'transmission', 'securite', 'chassis');
create type critere_evaluation     as enum ('qualite', 'delai', 'prix');

-- ---------------------------------------------------------------------------
-- 2. Le transporteur — un prestataire, complété
-- ---------------------------------------------------------------------------

-- Le profil ne double pas l'identité du prestataire, il la complète : forme,
-- contrat, modes de rémunération. Un transporteur peut en cumuler deux.
create table profil_transporteur (
  prestataire_id     uuid primary key references prestataire (id) on delete cascade,
  forme              forme_transporteur not null default 'societe',
  sous_contrat       boolean not null default false,
  reference_contrat  text,
  debut_contrat      date,
  fin_contrat        date,
  modes              mode_remuneration[] not null default '{tonne}',
  camions_engages    integer check (camions_engages is null or camions_engages >= 0),
  commentaire        text,
  cree_le            timestamptz not null default now(),
  cree_par           uuid references auth.users (id),
  modifie_le         timestamptz,
  modifie_par        uuid references auth.users (id),
  -- Un contrat écrit porte une référence, ou ce n'est pas un contrat écrit.
  constraint contrat_ecrit_reference check (not sous_contrat or reference_contrat is not null)
);

create table chauffeur_tiers (
  id             uuid primary key default gen_random_uuid(),
  prestataire_id uuid not null references prestataire (id) on delete cascade,
  nom            text not null,
  -- La donnée la plus utile de toutes : c'est par lui que l'exploitation joint
  -- le camion en route.
  telephone      text,
  actif          boolean not null default true,
  cree_le        timestamptz not null default now(),
  cree_par       uuid references auth.users (id),
  modifie_le     timestamptz,
  modifie_par    uuid references auth.users (id)
);

create index on chauffeur_tiers (prestataire_id);

-- Un camion tiers n'entre pas dans `vehicule` : ni carte grise à notre nom, ni
-- entretien à notre charge, ni valeur à amortir. Ce qu'on en suit, c'est ce
-- qu'il fait pour nous.
create table camion_tiers (
  immatriculation       text primary key,
  prestataire_id        uuid not null references prestataire (id) on delete cascade,
  categorie             categorie_vehicule not null default 'camion',
  capacite_tonnes       numeric(6, 1) check (capacite_tonnes is null or capacite_tonnes > 0),
  chauffeur_habituel_id uuid references chauffeur_tiers (id) on delete set null,
  actif                 boolean not null default true,
  commentaire           text,
  cree_le               timestamptz not null default now(),
  cree_par              uuid references auth.users (id),
  modifie_le            timestamptz,
  modifie_par           uuid references auth.users (id)
);

create index on camion_tiers (prestataire_id);

-- ---------------------------------------------------------------------------
-- 3. Les prix : grille, tarif journalier, rattachements
-- ---------------------------------------------------------------------------

-- Une ligne de grille : le prix que le transporteur **touche net** ; la facture
-- le majore de la retenue à la source.
create table ligne_tarif (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null unique,
  prestataire_id uuid not null references prestataire (id) on delete cascade,
  origine        text not null,
  destination    text not null,
  -- Nulle quand le tarif vaut pour toute catégorie de porteur.
  categorie      categorie_vehicule,
  unite          unite_tarif not null default 'tonne',
  prix           integer not null check (prix >= 0),
  minimum        integer check (minimum is null or minimum >= 0),
  debut          date not null,
  fin            date,
  source         source_tarif not null default 'accord-verbal',
  commentaire    text,
  cree_le        timestamptz not null default now(),
  cree_par       uuid references auth.users (id),
  modifie_le     timestamptz,
  modifie_par    uuid references auth.users (id),
  constraint ligne_tarif_periode check (fin is null or fin >= debut)
);

create index on ligne_tarif (prestataire_id, origine, destination, debut);

create table tarif_journalier (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null unique,
  prestataire_id uuid not null references prestataire (id) on delete cascade,
  famille        famille_mad not null,
  prix_jour      integer not null check (prix_jour >= 0),
  debut          date not null,
  fin            date,
  source         source_tarif not null default 'accord-verbal',
  convention     convention_facturation not null default 'inconnue',
  commentaire    text,
  cree_le        timestamptz not null default now(),
  cree_par       uuid references auth.users (id)
);

-- La mémoire des localités : « BAYAKH » se facture comme « Thiès ». Convenu
-- avec le transporteur, ou décidé à l'usage par l'exploitation — le premier
-- s'oppose, le second se discute.
create table rattachement_localite (
  localite_normalisee text primary key,
  localite            text not null,
  destination         text not null,
  origine             origine_rattachement not null default 'usage',
  motif               text,
  cree_le             timestamptz not null default now(),
  cree_par            uuid references auth.users (id),
  modifie_le          timestamptz,
  modifie_par         uuid references auth.users (id)
);

-- ---------------------------------------------------------------------------
-- 4. Ce que le parc confie : affrètements, mises à disposition, prestations
-- ---------------------------------------------------------------------------

create table affretement (
  id                       uuid primary key default gen_random_uuid(),
  numero                   text not null unique,
  date                     date not null,
  prestataire_id           uuid not null references prestataire (id),
  origine                  text not null,
  destination              text not null,
  business_unit            business_unit,
  categorie_demandee       categorie_vehicule not null default 'camion',
  immatriculation_externe  text references camion_tiers (immatriculation) on delete set null,
  chauffeur_externe        text,
  tonnage_prevu            numeric(8, 2) not null check (tonnage_prevu >= 0),
  tonnage_livre            numeric(8, 2) check (tonnage_livre is null or tonnage_livre >= 0),
  distance_km              integer not null default 0,
  motif                    motif_affretement not null,
  vehicule_remplace_id     uuid references vehicule (id) on delete set null,
  statut                   statut_affretement not null default 'demande',
  montant_convenu          bigint not null default 0,
  montant_facture          bigint,
  -- L'exception tarifaire de cette mission. Nulle dans l'immense majorité des
  -- cas. Quand elle est posée, elle porte son motif — la contrainte l'impose —
  -- sans quoi personne ne saura, six mois plus tard, si elle méritait de
  -- devenir une ligne de grille.
  prix_exceptionnel        integer check (prix_exceptionnel is null or prix_exceptionnel >= 0),
  complement_tarif         integer,
  motif_tarif              text,
  -- Renseigné quand l'exception a été reprise en ligne de grille.
  promue_en                uuid references ligne_tarif (id) on delete set null,
  date_livraison           date,
  date_facture             date,
  date_reglement           date,
  reference_facture        text,
  numero_demande_x3        text,
  numero_bon_commande      text,
  demandeur                text not null,
  commentaire              text,
  cree_le                  timestamptz not null default now(),
  cree_par                 uuid references auth.users (id),
  modifie_le               timestamptz,
  modifie_par              uuid references auth.users (id),
  constraint exception_motivee check ((prix_exceptionnel is null and complement_tarif is null) or motif_tarif is not null)
);

create index on affretement (prestataire_id, date);
create index on affretement (statut);

create table mise_a_disposition (
  id                  uuid primary key default gen_random_uuid(),
  numero              text not null unique,
  -- Le mois servi, en « AAAA-MM » : la mise à disposition se facture au mois.
  mois                text not null check (mois ~ '^\d{4}-\d{2}$'),
  prestataire_id      uuid not null references prestataire (id),
  immatriculation     text not null references camion_tiers (immatriculation),
  famille             famille_mad not null,
  jours_calendaires   integer not null check (jours_calendaires between 28 and 31),
  jours_panne         integer not null default 0 check (jours_panne >= 0),
  jours_roules        integer check (jours_roules is null or jours_roules >= 0),
  prix_jour           integer not null check (prix_jour >= 0),
  convention          convention_facturation not null default 'inconnue',
  carburant_litres    numeric(10, 2) not null default 0,
  carburant_montant   bigint not null default 0,
  km_parcourus        integer,
  tonnes_transportees numeric(10, 2),
  statut              statut_affretement not null default 'confirme',
  montant_facture     bigint,
  date_facture        date,
  date_reglement      date,
  reference_facture   text,
  numero_demande_x3   text,
  commentaire         text,
  cree_le             timestamptz not null default now(),
  cree_par            uuid references auth.users (id),
  modifie_le          timestamptz,
  modifie_par         uuid references auth.users (id),
  unique (immatriculation, mois)
);

create table prestation (
  id                uuid primary key default gen_random_uuid(),
  numero            text not null unique,
  date              date not null,
  prestataire_id    uuid not null references prestataire (id),
  libelle           text not null,
  business_unit     business_unit,
  unite             unite_prestation not null,
  quantite          numeric(10, 2) not null check (quantite >= 0),
  prix_unitaire     integer not null check (prix_unitaire >= 0),
  convention        convention_facturation not null default 'inconnue',
  statut            statut_affretement not null default 'confirme',
  montant_facture   bigint,
  date_facture      date,
  date_reglement    date,
  reference_facture text,
  numero_demande_x3 text,
  commentaire       text,
  cree_le           timestamptz not null default now(),
  cree_par          uuid references auth.users (id),
  modifie_le        timestamptz,
  modifie_par       uuid references auth.users (id)
);

-- ---------------------------------------------------------------------------
-- 5. Le relevé de transport — un chargement parti un jour donné
-- ---------------------------------------------------------------------------

create table releve_transport (
  id                          uuid primary key default gen_random_uuid(),
  numero                      text not null unique,
  date                        date not null,
  mode                        mode_execution not null,
  prestataire_id              uuid references prestataire (id),
  vehicule_id                 uuid references vehicule (id) on delete set null,
  camion_tiers_immatriculation text references camion_tiers (immatriculation) on delete set null,
  -- L'immatriculation notée à la volée — enlèvement client, prestataire
  -- ponctuel. Elle ne renvoie à aucune fiche, et c'est voulu.
  immatriculation_libre       text,
  chauffeur                   text,
  origine                     text not null,
  destination                 text not null,
  produit                     produit_transporte not null default 'aliment',
  tonnage                     numeric(8, 2) not null check (tonnage >= 0),
  -- Le tonnage du pont bascule, quand il existe : c'est lui qui fait foi.
  tonnage_pese                numeric(8, 2) check (tonnage_pese is null or tonnage_pese >= 0),
  bon_livraison               text,
  affretement_id              uuid references affretement (id) on delete set null,
  cree_le                     timestamptz not null default now(),
  cree_par                    uuid references auth.users (id),
  modifie_le                  timestamptz,
  modifie_par                 uuid references auth.users (id),
  -- Le mode dit ce qui doit être renseigné : le parc cite un véhicule, le
  -- transporteur cite un prestataire.
  constraint releve_parc check (mode <> 'parc' or vehicule_id is not null),
  constraint releve_transporteur check (mode <> 'transporteur' or prestataire_id is not null)
);

create index on releve_transport (date);
create index on releve_transport (prestataire_id, date);
create index on releve_transport (destination);

-- ---------------------------------------------------------------------------
-- 6. L'entretien : programmes, plans, ajustements
-- ---------------------------------------------------------------------------

create table programme_entretien (
  code       text primary key,
  libelle    text not null,
  precision  text,
  categories categorie_vehicule[] not null default '{}',
  base       text not null check (base in ('km', 'heures')),
  actif      boolean not null default true
);

create table operation_entretien (
  code            text primary key,
  programme_code  text not null references programme_entretien (code) on delete cascade,
  libelle         text not null,
  groupe          groupe_operation not null,
  periodicite_km     integer check (periodicite_km is null or periodicite_km > 0),
  periodicite_heures integer check (periodicite_heures is null or periodicite_heures > 0),
  periodicite_mois   integer check (periodicite_mois is null or periodicite_mois > 0),
  mots_cles       text[] not null default '{}',
  duree_heures    numeric(5, 1) not null default 0,
  cout_estime     bigint not null default 0,
  -- Une opération de sécurité ne se reporte pas.
  critique        boolean not null default false,
  ordre           integer not null default 0
);

create table plan_vehicule (
  vehicule_id    uuid primary key references vehicule (id) on delete cascade,
  programme_code text not null references programme_entretien (code),
  cree_le        timestamptz not null default now(),
  cree_par       uuid references auth.users (id),
  modifie_le     timestamptz,
  modifie_par    uuid references auth.users (id)
);

create table ajustement_entretien (
  vehicule_id    uuid not null references vehicule (id) on delete cascade,
  operation_code text not null references operation_entretien (code) on delete cascade,
  km             integer,
  heures         integer,
  mois           integer,
  retiree        boolean not null default false,
  -- Obligatoire : c'est lui qui explique pourquoi ce véhicule s'écarte du gabarit.
  motif          text not null,
  cree_le        timestamptz not null default now(),
  cree_par       uuid references auth.users (id),
  modifie_le     timestamptz,
  modifie_par    uuid references auth.users (id),
  primary key (vehicule_id, operation_code)
);

-- ---------------------------------------------------------------------------
-- 7. Le compte fournisseur : avances et évaluations
--
-- Les dettes ne sont pas une table : elles se **déduisent** des achats, des
-- interventions, des affrètements — c'est ce qui garantit qu'un règlement
-- saisi là-bas éteint la dette ici. Seuls les faits nouveaux s'écrivent.
-- ---------------------------------------------------------------------------

create table avance_prestataire (
  id               uuid primary key default gen_random_uuid(),
  numero           text not null unique,
  prestataire_id   uuid not null references prestataire (id),
  date             date not null,
  montant          bigint not null check (montant > 0),
  motif            text not null,
  imputee_sur      text,
  date_imputation  date,
  -- Qui a décidé — une avance engage la trésorerie du parc.
  autorise_par     text not null,
  cree_le          timestamptz not null default now(),
  cree_par         uuid references auth.users (id),
  modifie_le       timestamptz,
  modifie_par      uuid references auth.users (id)
);

create table evaluation_prestataire (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null unique,
  prestataire_id uuid not null references prestataire (id),
  date           date not null,
  piece_numero   text not null,
  piece_libelle  text not null,
  qualite        smallint not null check (qualite between 1 and 5),
  delai          smallint not null check (delai between 1 and 5),
  prix           smallint not null check (prix between 1 and 5),
  commentaire    text,
  auteur         text not null,
  cree_le        timestamptz not null default now(),
  cree_par       uuid references auth.users (id)
);

create index on evaluation_prestataire (prestataire_id, date);

-- ---------------------------------------------------------------------------
-- 8. Le budget : une enveloppe par poste et business unit
-- ---------------------------------------------------------------------------

create table enveloppe (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null unique,
  exercice      text not null check (exercice ~ '^\d{4}$'),
  poste         poste_depense not null,
  -- Nulle quand l'enveloppe couvre tout le parc.
  business_unit business_unit,
  montant       bigint not null check (montant >= 0),
  -- La saisonnalité : douze parts qui font 1. Nulle : au prorata des jours.
  profil        numeric(6, 4)[] check (profil is null or array_length(profil, 1) = 12),
  -- Ce qui a servi à poser le montant : « réalisé 2025 + 8 % ». C'est cette
  -- phrase qui se discute en comité, pas le chiffre.
  base          text not null,
  commentaire   text,
  cree_le       timestamptz not null default now(),
  cree_par      uuid references auth.users (id),
  modifie_le    timestamptz,
  modifie_par   uuid references auth.users (id),
  unique nulls not distinct (exercice, poste, business_unit)
);

-- ---------------------------------------------------------------------------
-- 9. Les rapports personnalisés — un descripteur composé à la main
-- ---------------------------------------------------------------------------

create table rapport_personnalise (
  id             uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references auth.users (id) on delete cascade,
  nom            text not null,
  description    text not null default '',
  base           text not null,
  colonnes       text[] not null,
  facettes       jsonb not null default '{}',
  periode        jsonb not null,
  perimetre      text not null default 'exploitation',
  tri            jsonb,
  -- Partagé à toute l'organisation, ou gardé pour soi.
  partage        boolean not null default false,
  cree_le        timestamptz not null default now(),
  modifie_le     timestamptz not null default now()
);

create index on rapport_personnalise (utilisateur_id);

-- ---------------------------------------------------------------------------
-- 10. Row Level Security
-- ---------------------------------------------------------------------------

alter table profil_transporteur   enable row level security;
alter table chauffeur_tiers       enable row level security;
alter table camion_tiers          enable row level security;
alter table ligne_tarif           enable row level security;
alter table tarif_journalier      enable row level security;
alter table rattachement_localite enable row level security;
alter table affretement           enable row level security;
alter table mise_a_disposition    enable row level security;
alter table prestation            enable row level security;
alter table releve_transport      enable row level security;
alter table programme_entretien   enable row level security;
alter table operation_entretien   enable row level security;
alter table plan_vehicule         enable row level security;
alter table ajustement_entretien  enable row level security;
alter table avance_prestataire    enable row level security;
alter table evaluation_prestataire enable row level security;
alter table enveloppe             enable row level security;
alter table rapport_personnalise  enable row level security;

-- Lecture : tout compte actif. Le transport, les prix et le budget ne sont pas
-- restreints par site — un correspondant de site n'y touche pas, mais il n'y a
-- rien à lui cacher.
do $$
declare t text;
begin
  foreach t in array array['profil_transporteur', 'chauffeur_tiers', 'camion_tiers', 'ligne_tarif', 'tarif_journalier', 'rattachement_localite', 'affretement', 'mise_a_disposition', 'prestation', 'releve_transport', 'programme_entretien', 'operation_entretien', 'plan_vehicule', 'ajustement_entretien', 'avance_prestataire', 'evaluation_prestataire', 'enveloppe']
  loop
    execute format('create policy lecture_%I on %I for select using (mon_role() is not null)', t, t);
  end loop;
end
$$;

-- Écriture du transport : ceux qui écrivent le parc, plus les achats — c'est
-- eux qui passent les affrètements.
create or replace function peut_ecrire_transport() returns boolean
language sql stable as $$
  select mon_role() in ('administrateur', 'direction', 'gestionnaire-parc', 'achats')
$$;

do $$
declare t text;
begin
  foreach t in array array['profil_transporteur', 'chauffeur_tiers', 'camion_tiers', 'ligne_tarif', 'tarif_journalier', 'rattachement_localite', 'affretement', 'mise_a_disposition', 'prestation', 'avance_prestataire', 'evaluation_prestataire']
  loop
    execute format('create policy ecriture_%I on %I for all using (peut_ecrire_transport()) with check (peut_ecrire_transport())', t, t);
  end loop;
end
$$;

-- Le relevé se saisit par tous ceux qui voient partir un camion.
create policy ecriture_releve_transport on releve_transport for insert with check (mon_role() is not null);
create policy correction_releve_transport on releve_transport for update using (peut_ecrire_transport()) with check (peut_ecrire_transport());

-- L'entretien : la maintenance et le parc.
create or replace function peut_ecrire_entretien() returns boolean
language sql stable as $$
  select mon_role() in ('administrateur', 'direction', 'gestionnaire-parc', 'responsable-maintenance')
$$;

create policy ecriture_plan_vehicule on plan_vehicule for all using (peut_ecrire_entretien()) with check (peut_ecrire_entretien());
create policy ecriture_ajustement on ajustement_entretien for all using (peut_ecrire_entretien()) with check (peut_ecrire_entretien());
-- Les programmes sont un réglage de l'application.
create policy ecriture_programme on programme_entretien for all using (peut_administrer()) with check (peut_administrer());
create policy ecriture_operation on operation_entretien for all using (peut_administrer()) with check (peut_administrer());

-- Le budget se pose en comité : administration et contrôle de gestion.
create policy ecriture_enveloppe on enveloppe for all
  using (mon_role() in ('administrateur', 'direction', 'controle-de-gestion'))
  with check (mon_role() in ('administrateur', 'direction', 'controle-de-gestion'));

-- Un rapport personnalisé appartient à son auteur ; partagé, il se lit par tous.
create policy lecture_rapport_perso on rapport_personnalise for select using (utilisateur_id = auth.uid() or partage);
create policy ecriture_rapport_perso on rapport_personnalise for all using (utilisateur_id = auth.uid()) with check (utilisateur_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 11. Horodatage
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['profil_transporteur', 'chauffeur_tiers', 'camion_tiers', 'ligne_tarif', 'rattachement_localite', 'affretement', 'mise_a_disposition', 'prestation', 'releve_transport', 'plan_vehicule', 'ajustement_entretien', 'avance_prestataire', 'enveloppe']
  loop
    execute format('create trigger %I_horodatage before update on %I for each row execute function marquer_modification()', t, t);
  end loop;
end
$$;

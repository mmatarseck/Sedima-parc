-- ============================================================================
-- SEDIMA Parc — socle du Lot 1
--
-- Ce que cette migration pose : les référentiels, la flotte, les chauffeurs,
-- les transactions qui pèsent sur un véhicule, et le mécanisme de trace qui
-- fait la valeur de l'application — chaque écriture dit qui, quand, pourquoi.
--
-- Ce qu'elle ne pose pas encore, et qui viendra dans 0002 : le module
-- transporteurs (grilles, affrètements, relevé de transport), le budget, et
-- les rapports personnalisés. Ils sont conçus, mais les brancher avant que le
-- socle ne soit repris en données serait mettre la charrue devant les bœufs.
--
-- Conventions, reprises de SEDIMA Opérations :
--   * tout en minuscules, sans accents, au singulier ;
--   * les énumérations sont des types PostgreSQL, jamais des `text` libres —
--     une faute de frappe ne doit pas créer une neuvième catégorie de véhicule ;
--   * chaque table porte `cree_le`, `cree_par`, `modifie_le`, `modifie_par` ;
--   * le rôle n'est jamais lu du client : `get_me()` le résout en SECURITY
--     DEFINER, et toutes les politiques s'appuient sur lui.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Les rôles applicatifs et la résolution de l'utilisateur
-- ---------------------------------------------------------------------------

create type role_applicatif as enum (
  'administrateur',
  'gestionnaire-parc',
  'responsable-maintenance',
  'responsable-carburant',
  'correspondant-site',
  'controle-de-gestion',
  'direction',
  'achats'
);

create type type_site as enum ('usine', 'depot', 'ferme', 'abattoir', 'siege', 'boutique', 'garage');

create table site (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  libelle     text not null,
  region      text not null,
  type        type_site not null,
  actif       boolean not null default true,
  cree_le     timestamptz not null default now(),
  cree_par    uuid references auth.users (id),
  modifie_le  timestamptz,
  modifie_par uuid references auth.users (id)
);

comment on table site is 'Usines, dépôts, abattoirs, garages — le rattachement géographique d''un véhicule et d''un chauffeur.';

-- Le profil applicatif d'un compte. Il n'est jamais modifiable par son
-- titulaire : c'est un administrateur qui attribue un rôle, et la politique
-- d'écriture ci-dessous le garantit.
create table profil (
  utilisateur_id uuid primary key references auth.users (id) on delete cascade,
  nom            text not null,
  role           role_applicatif not null default 'correspondant-site',
  -- Renseigné pour un correspondant de site : il ne voit que le sien.
  site_id        uuid references site (id),
  actif          boolean not null default true,
  cree_le        timestamptz not null default now(),
  cree_par       uuid references auth.users (id),
  modifie_le     timestamptz,
  modifie_par    uuid references auth.users (id)
);

comment on table profil is 'Le rôle et le périmètre d''un compte. Attribué par un administrateur, jamais par l''intéressé.';

-- La fonction que toute politique appelle. SECURITY DEFINER parce qu'elle lit
-- `profil` avant que les politiques de `profil` ne s'appliquent — sans quoi
-- la lecture du rôle dépendrait du rôle, et rien ne serait lisible.
create or replace function get_me()
returns table (utilisateur_id uuid, role role_applicatif, site_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select p.utilisateur_id, p.role, p.site_id
  from profil p
  where p.utilisateur_id = auth.uid() and p.actif
$$;

create or replace function mon_role() returns role_applicatif
language sql stable security definer set search_path = public as $$
  select role from profil where utilisateur_id = auth.uid() and actif
$$;

create or replace function mon_site() returns uuid
language sql stable security definer set search_path = public as $$
  select site_id from profil where utilisateur_id = auth.uid() and actif
$$;

-- Qui règle l'application et clôture les mois. La liste est ici, en un seul
-- endroit : `ROLES_CLOTURANT` du code applicatif en est le reflet, pas la
-- source — le navigateur ne décide jamais d'une autorisation.
create or replace function peut_administrer() returns boolean
language sql stable as $$
  select mon_role() in ('administrateur', 'direction')
$$;

create or replace function peut_ecrire_parc() returns boolean
language sql stable as $$
  select mon_role() in ('administrateur', 'direction', 'gestionnaire-parc')
$$;

create or replace function voit_sanctions() returns boolean
language sql stable as $$
  select mon_role() in ('administrateur', 'direction', 'gestionnaire-parc')
$$;

-- ---------------------------------------------------------------------------
-- 2. Les énumérations du parc
-- ---------------------------------------------------------------------------

create type categorie_vehicule as enum ('camion', 'tracteur', 'semi-remorque', 'camionnette', 'vehicule-leger', 'bus', 'moto', 'engin');
create type categorie_flotte   as enum ('interne', 'adex', 'location', 'prestataire');
create type usage_vehicule     as enum ('vrac', 'frigorifique', 'poussins', 'plateau', 'ridelle', 'citerne', 'benne', 'fourgon', 'tracteur', 'utilitaire', 'autre');
create type energie            as enum ('gasoil', 'essence', 'electrique', 'hybride');
create type statut_vehicule    as enum ('en-service', 'en-backup', 'en-reparation', 'en-restauration', 'hors-service', 'en-mutation', 'retrait-en-cours');
create type business_unit      as enum ('aliment', 'minoterie', 'abattoir', 'couvoir', 'commercial', 'fermes', 'siege');
create type poste_depense      as enum ('carburant', 'maintenance-preventive', 'maintenance-curative', 'pieces', 'pneumatiques', 'assurance', 'conformite', 'frais-de-route', 'peage', 'contravention', 'amortissement', 'salaire', 'divers');
create type aptitude           as enum ('apte', 'apte-avec-reserve', 'inapte');
create type contrat_chauffeur  as enum ('salarie', 'interimaire', 'prestataire');
create type role_affectation   as enum ('titulaire', 'suppleant');
create type motif_indisponibilite as enum ('conge', 'maladie', 'suspension-permis', 'formation', 'autre');
create type type_sanction      as enum ('avertissement', 'blame', 'retenue', 'mise-a-pied');
create type nature_incident    as enum ('accident', 'incident');
create type statut_declaration as enum ('declare', 'qualifie', 'en-traitement', 'clos');
create type responsabilite     as enum ('sedima', 'tiers', 'partagee', 'indeterminee');
create type mission_incident   as enum ('livraison', 'transfert', 'retour-a-vide', 'hors-mission');
create type origine_releve     as enum ('saisie', 'plein', 'garage', 'telematique');
create type origine_depense    as enum ('caisse', 'bon-de-commande', 'facture');
create type type_prestataire   as enum ('garage', 'pieces', 'pneumatiques', 'station', 'carburant', 'assureur', 'centre-visite', 'depanneur', 'transporteur', 'autre');

-- ---------------------------------------------------------------------------
-- 3. Référentiels
-- ---------------------------------------------------------------------------

create table prestataire (
  id                    uuid primary key default gen_random_uuid(),
  numero                text not null unique,
  raison_sociale        text not null,
  type                  type_prestataire not null,
  contact               text,
  telephone             text,
  courriel              text,
  adresse               text,
  ville                 text,
  ninea                 text,
  -- Nul quand on paie à la commande : ce n'est pas zéro jour, c'est une autre règle.
  delai_paiement_jours  integer check (delai_paiement_jours is null or delai_paiement_jours >= 0),
  actif                 boolean not null default true,
  note                  text,
  cree_le               timestamptz not null default now(),
  cree_par              uuid references auth.users (id),
  modifie_le            timestamptz,
  modifie_par           uuid references auth.users (id)
);

-- Les types de document se règlent dans l'application : ils vivent donc en
-- table, pas en énumération — le métier en ajoute sans migration.
create table type_document (
  id            text primary key,
  libelle       text not null,
  -- Trois porteurs, pas deux : la licence de transport couvre toute la flotte.
  porteur       text not null check (porteur in ('vehicule', 'chauffeur', 'flotte')),
  applicabilite text not null,
  validite_mois integer check (validite_mois is null or validite_mois > 0),
  -- Un document critique échu immobilise administrativement le véhicule.
  critique      boolean not null default false,
  standard      boolean not null default false,
  actif         boolean not null default true
);

-- ---------------------------------------------------------------------------
-- 4. La flotte et les chauffeurs
-- ---------------------------------------------------------------------------

create table vehicule (
  id                          uuid primary key default gen_random_uuid(),
  -- Normalisée, sans espace : c'est la clé métier, et deux saisies du même
  -- camion ne doivent pas créer deux véhicules.
  immatriculation             text not null unique,
  vin                         text unique,
  marque                      text not null,
  appellation                 text not null,
  type_modele                 text,
  categorie                   categorie_vehicule not null,
  categorie_flotte            categorie_flotte not null default 'interne',
  usage                       usage_vehicule not null default 'autre',
  transport_special           boolean not null default false,
  energie                     energie not null default 'gasoil',
  business_unit               business_unit,
  site_id                     uuid references site (id),
  statut                      statut_vehicule not null default 'en-service',
  -- Faux pour un engin qui ne roule pas : il sort du taux de disponibilité.
  engage                      boolean not null default true,
  premiere_mise_en_circulation date,
  date_immatriculation        date,
  puissance_cv                integer,
  cylindree                   integer,
  ptac                        integer,
  ptra                        integer,
  poids_vide                  integer,
  charge_utile                integer,
  capacite_reservoir          integer,
  valeur_acquisition          bigint,
  duree_amortissement_annees  integer,
  photo                       text,
  commentaire                 text,
  cree_le                     timestamptz not null default now(),
  cree_par                    uuid references auth.users (id),
  modifie_le                  timestamptz,
  modifie_par                 uuid references auth.users (id)
);

create index on vehicule (site_id);
create index on vehicule (statut);
create index on vehicule (business_unit);

create table chauffeur (
  id                        uuid primary key default gen_random_uuid(),
  matricule_rh              text unique,
  nom                       text not null,
  prenom                    text not null,
  contrat                   contrat_chauffeur not null default 'salarie',
  site_id                   uuid references site (id),
  telephone                 text,
  permis_numero             text,
  permis_categories         text[] not null default '{}',
  permis_delivrance         date,
  permis_echeance           date,
  visite_medicale_echeance  date,
  aptitude                  aptitude not null default 'apte',
  aptitude_motif            text,
  aptitude_date             date,
  date_naissance            date,
  date_embauche             date,
  -- Renseignée quand il quitte l'entreprise : il reste consultable, jamais supprimé.
  date_sortie               date,
  adresse                   text,
  contact_urgence           text,
  cree_le                   timestamptz not null default now(),
  cree_par                  uuid references auth.users (id),
  modifie_le                timestamptz,
  modifie_par               uuid references auth.users (id)
);

create index on chauffeur (site_id);

create table affectation (
  id           uuid primary key default gen_random_uuid(),
  numero       text not null unique,
  vehicule_id  uuid not null references vehicule (id) on delete cascade,
  chauffeur_id uuid not null references chauffeur (id) on delete restrict,
  role         role_affectation not null default 'titulaire',
  debut        date not null,
  -- Nulle quand l'affectation court toujours.
  fin          date,
  motif        text not null,
  cree_le      timestamptz not null default now(),
  cree_par     uuid references auth.users (id),
  modifie_le   timestamptz,
  modifie_par  uuid references auth.users (id),
  constraint affectation_periode check (fin is null or fin >= debut)
);

create index on affectation (vehicule_id, debut);
create index on affectation (chauffeur_id, debut);

-- Un véhicule n'a qu'un titulaire à la fois. La contrainte le dit, plutôt que
-- de laisser deux saisies concurrentes créer un conflit que l'écran signalera
-- trop tard.
create extension if not exists btree_gist;
alter table affectation add constraint affectation_un_seul_titulaire
  exclude using gist (
    vehicule_id with =,
    daterange(debut, coalesce(fin, 'infinity'::date), '[]') with &&
  ) where (role = 'titulaire');

create table indisponibilite (
  id           uuid primary key default gen_random_uuid(),
  numero       text not null unique,
  chauffeur_id uuid not null references chauffeur (id) on delete cascade,
  motif        motif_indisponibilite not null,
  debut        date not null,
  fin          date,
  commentaire  text,
  cree_le      timestamptz not null default now(),
  cree_par     uuid references auth.users (id),
  modifie_le   timestamptz,
  modifie_par  uuid references auth.users (id),
  constraint indisponibilite_periode check (fin is null or fin >= debut)
);

-- ---------------------------------------------------------------------------
-- 5. Les transactions
-- ---------------------------------------------------------------------------

create table document (
  id               uuid primary key default gen_random_uuid(),
  numero           text not null unique,
  type_document_id text not null references type_document (id),
  vehicule_id      uuid references vehicule (id) on delete cascade,
  chauffeur_id     uuid references chauffeur (id) on delete cascade,
  date_effet       date,
  echeance         date,
  emetteur         text,
  numero_piece     text,
  montant          bigint,
  justificatif     boolean not null default false,
  fichier          text,
  cree_le          timestamptz not null default now(),
  cree_par         uuid references auth.users (id),
  modifie_le       timestamptz,
  modifie_par      uuid references auth.users (id),
  -- Un document porte sur un véhicule **ou** sur un chauffeur, jamais les deux.
  constraint document_un_seul_porteur check (num_nonnulls(vehicule_id, chauffeur_id) = 1)
);

create index on document (vehicule_id, echeance);
create index on document (chauffeur_id, echeance);

create table depense (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null unique,
  vehicule_id    uuid references vehicule (id) on delete set null,
  chauffeur_id   uuid references chauffeur (id) on delete set null,
  prestataire_id uuid references prestataire (id),
  date           date not null,
  poste          poste_depense not null,
  libelle        text not null,
  montant        bigint not null,
  beneficiaire   text,
  reference      text,
  origine        origine_depense not null default 'caisse',
  justificatif   boolean not null default false,
  -- Le compteur relevé au moment de la dépense : chaque dépense est une
  -- occasion de lire le kilométrage.
  km             integer,
  km_motif_rejet text,
  cree_le        timestamptz not null default now(),
  cree_par       uuid references auth.users (id),
  modifie_le     timestamptz,
  modifie_par    uuid references auth.users (id),
  -- Une dépense sans véhicule doit rester traçable : elle cite alors quelqu'un.
  constraint depense_tracable check (vehicule_id is not null or beneficiaire is not null)
);

create index on depense (vehicule_id, date);
create index on depense (poste, date);
create index on depense (prestataire_id);

create table plein (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null unique,
  vehicule_id    uuid not null references vehicule (id) on delete cascade,
  chauffeur_id   uuid references chauffeur (id) on delete set null,
  prestataire_id uuid references prestataire (id),
  date           date not null,
  litres         numeric(10, 2) not null check (litres > 0),
  prix_litre     integer not null check (prix_litre > 0),
  montant        bigint not null,
  km             integer,
  -- Vrai quand le réservoir a été rempli : sans cela, la consommation entre
  -- deux pleins ne veut rien dire.
  plein_complet  boolean not null default true,
  source         text not null default 'station',
  reference      text,
  cree_le        timestamptz not null default now(),
  cree_par       uuid references auth.users (id),
  modifie_le     timestamptz,
  modifie_par    uuid references auth.users (id)
);

create index on plein (vehicule_id, date);

create table releve_kilometrique (
  id          uuid primary key default gen_random_uuid(),
  numero      text not null unique,
  vehicule_id uuid not null references vehicule (id) on delete cascade,
  date        date not null,
  km          integer not null check (km >= 0),
  origine     origine_releve not null default 'saisie',
  -- Renseigné quand le contrôle de cohérence a écarté le relevé : on garde la
  -- saisie et la raison du rejet, on ne la supprime pas.
  motif_rejet text,
  cree_le     timestamptz not null default now(),
  cree_par    uuid references auth.users (id)
);

create index on releve_kilometrique (vehicule_id, date);

create table intervention (
  id                   uuid primary key default gen_random_uuid(),
  numero               text not null unique,
  vehicule_id          uuid not null references vehicule (id) on delete cascade,
  prestataire_id       uuid references prestataire (id),
  date                 date not null,
  type                 text not null check (type in ('preventif', 'curatif')),
  objet                text not null,
  montant              bigint not null default 0,
  immobilisation_jours integer not null default 0,
  km                   integer,
  reference            text,
  cree_le              timestamptz not null default now(),
  cree_par             uuid references auth.users (id),
  modifie_le           timestamptz,
  modifie_par          uuid references auth.users (id)
);

create index on intervention (vehicule_id, date);

create table incident (
  id                   uuid primary key default gen_random_uuid(),
  numero               text not null unique,
  vehicule_id          uuid not null references vehicule (id) on delete cascade,
  chauffeur_id         uuid references chauffeur (id) on delete set null,
  date_heure           timestamptz not null,
  nature               nature_incident not null,
  type                 text not null,
  lieu                 text,
  mission              mission_incident,
  responsabilite       responsabilite,
  statut               statut_declaration not null default 'declare',
  blesses              boolean not null default false,
  sinistre_ouvert      boolean not null default false,
  immobilisation_jours integer,
  kilometrage          integer,
  declarant            text,
  description          text,
  cree_le              timestamptz not null default now(),
  cree_par             uuid references auth.users (id),
  modifie_le           timestamptz,
  modifie_par          uuid references auth.users (id)
);

create index on incident (vehicule_id, date_heure);
create index on incident (chauffeur_id, date_heure);

-- Les sanctions sont à part : leur lecture est réservée (voir la politique
-- plus bas), et une jointure imprudente les exposerait avec le reste.
create table sanction (
  id           uuid primary key default gen_random_uuid(),
  numero       text not null unique,
  chauffeur_id uuid not null references chauffeur (id) on delete cascade,
  date         date not null,
  type         type_sanction not null,
  motif        text not null,
  jours        integer check (jours is null or jours > 0),
  incident_id  uuid references incident (id) on delete set null,
  depense_id   uuid references depense (id) on delete set null,
  cree_le      timestamptz not null default now(),
  cree_par     uuid references auth.users (id),
  modifie_le   timestamptz,
  modifie_par  uuid references auth.users (id)
);

-- ---------------------------------------------------------------------------
-- 6. La trace, la clôture et les paramètres
-- ---------------------------------------------------------------------------

-- Chaque modification d'une transaction laisse sa ligne : qui, quand, quel
-- champ, de quoi à quoi, et **pourquoi**. C'est ce qui distingue une
-- application de gestion d'un tableur partagé.
create table modification (
  id             uuid primary key default gen_random_uuid(),
  table_cible    text not null,
  numero         text not null,
  champ          text not null,
  libelle_champ  text not null,
  avant          text,
  apres          text,
  motif          text not null,
  -- Renseigné quand la modification portait sur un mois clos : elle attend
  -- alors une décision.
  mois_clos      text,
  statut         text not null default 'appliquee' check (statut in ('appliquee', 'en-attente', 'refusee')),
  decidee_par    uuid references auth.users (id),
  decidee_le     timestamptz,
  commentaire_decision text,
  cree_le        timestamptz not null default now(),
  cree_par       uuid not null references auth.users (id)
);

create index on modification (table_cible, numero);
create index on modification (statut) where statut = 'en-attente';

create table cloture_mois (
  mois        text primary key check (mois ~ '^\d{4}-\d{2}$'),
  clos_le     timestamptz not null default now(),
  clos_par    uuid not null references auth.users (id),
  rouvert_le  timestamptz,
  rouvert_par uuid references auth.users (id),
  motif       text
);

-- Les paramètres de l'application : une seule ligne par clé, lue par le
-- serveur comme par le navigateur. Une seule vérité.
create table parametre (
  cle         text primary key,
  valeur      jsonb not null,
  modifie_le  timestamptz not null default now(),
  modifie_par uuid references auth.users (id)
);

comment on table parametre is 'Prix de l''énergie datés, règles des documents, programmes d''entretien, règles d''alerte.';

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
--
-- Le principe : **tout le monde lit le parc, peu de gens l'écrivent**, et le
-- correspondant de site ne voit que son site. Les sanctions échappent à la
-- règle générale — elles ne se lisent que par les rôles qui en ont la charge.
-- ---------------------------------------------------------------------------

alter table site                 enable row level security;
alter table profil               enable row level security;
alter table prestataire          enable row level security;
alter table type_document        enable row level security;
alter table vehicule             enable row level security;
alter table chauffeur            enable row level security;
alter table affectation          enable row level security;
alter table indisponibilite      enable row level security;
alter table document             enable row level security;
alter table depense              enable row level security;
alter table plein                enable row level security;
alter table releve_kilometrique  enable row level security;
alter table intervention         enable row level security;
alter table incident             enable row level security;
alter table sanction             enable row level security;
alter table modification         enable row level security;
alter table cloture_mois         enable row level security;
alter table parametre            enable row level security;

-- Lecture : tout compte actif lit les référentiels et le parc.
create policy lecture_site        on site        for select using (mon_role() is not null);
create policy lecture_prestataire on prestataire for select using (mon_role() is not null);
create policy lecture_type_doc    on type_document for select using (mon_role() is not null);
create policy lecture_parametre   on parametre   for select using (mon_role() is not null);
create policy lecture_cloture     on cloture_mois for select using (mon_role() is not null);

-- Le correspondant de site ne voit que les véhicules de son site. Les autres
-- rôles voient tout le parc.
create policy lecture_vehicule on vehicule for select using (
  mon_role() is not null and (mon_role() <> 'correspondant-site' or site_id = mon_site())
);

create policy lecture_chauffeur on chauffeur for select using (
  mon_role() is not null and (mon_role() <> 'correspondant-site' or site_id = mon_site())
);

-- Les transactions suivent leur véhicule : ce que je ne vois pas rouler, je ne
-- vois pas ce qu'il dépense.
create policy lecture_affectation on affectation for select using (
  exists (select 1 from vehicule v where v.id = vehicule_id)
);
create policy lecture_document    on document    for select using (
  (vehicule_id is null or exists (select 1 from vehicule v where v.id = vehicule_id))
  and (chauffeur_id is null or exists (select 1 from chauffeur c where c.id = chauffeur_id))
);
create policy lecture_depense     on depense     for select using (
  vehicule_id is null or exists (select 1 from vehicule v where v.id = vehicule_id)
);
create policy lecture_plein       on plein       for select using (exists (select 1 from vehicule v where v.id = vehicule_id));
create policy lecture_releve      on releve_kilometrique for select using (exists (select 1 from vehicule v where v.id = vehicule_id));
create policy lecture_intervention on intervention for select using (exists (select 1 from vehicule v where v.id = vehicule_id));
create policy lecture_incident    on incident    for select using (exists (select 1 from vehicule v where v.id = vehicule_id));
create policy lecture_indispo     on indisponibilite for select using (exists (select 1 from chauffeur c where c.id = chauffeur_id));
create policy lecture_modification on modification for select using (mon_role() is not null);

-- Les sanctions : lecture réservée. C'est la règle `voitSanctions()` du code,
-- posée ici où elle est opposable.
create policy lecture_sanction on sanction for select using (voit_sanctions());

-- Le profil : chacun lit le sien, l'administrateur les lit tous, et personne
-- ne s'attribue un rôle.
create policy lecture_profil on profil for select using (utilisateur_id = auth.uid() or peut_administrer());
create policy ecriture_profil on profil for all using (peut_administrer()) with check (peut_administrer());

-- Écriture du parc et de ses transactions.
create policy ecriture_vehicule    on vehicule    for all using (peut_ecrire_parc()) with check (peut_ecrire_parc());
create policy ecriture_chauffeur   on chauffeur   for all using (peut_ecrire_parc()) with check (peut_ecrire_parc());
create policy ecriture_affectation on affectation for all using (peut_ecrire_parc()) with check (peut_ecrire_parc());
create policy ecriture_indispo     on indisponibilite for all using (peut_ecrire_parc()) with check (peut_ecrire_parc());
create policy ecriture_document    on document    for all using (peut_ecrire_parc()) with check (peut_ecrire_parc());
create policy ecriture_depense     on depense     for all using (peut_ecrire_parc()) with check (peut_ecrire_parc());
create policy ecriture_intervention on intervention for all using (mon_role() in ('administrateur', 'direction', 'gestionnaire-parc', 'responsable-maintenance'))
  with check (mon_role() in ('administrateur', 'direction', 'gestionnaire-parc', 'responsable-maintenance'));
create policy ecriture_plein       on plein       for all using (mon_role() in ('administrateur', 'direction', 'gestionnaire-parc', 'responsable-carburant'))
  with check (mon_role() in ('administrateur', 'direction', 'gestionnaire-parc', 'responsable-carburant'));
create policy ecriture_incident    on incident    for all using (peut_ecrire_parc()) with check (peut_ecrire_parc());
create policy ecriture_prestataire on prestataire for all using (peut_ecrire_parc()) with check (peut_ecrire_parc());

-- Un relevé kilométrique se saisit par tous ceux qui approchent le véhicule —
-- c'est justement le rôle du correspondant de site.
create policy ecriture_releve on releve_kilometrique for insert with check (mon_role() is not null);

-- Les sanctions : écriture par les mêmes qui les lisent.
create policy ecriture_sanction on sanction for all using (voit_sanctions()) with check (voit_sanctions());

-- La trace ne se modifie pas : on l'écrit, on ne la réécrit jamais.
create policy ecriture_modification on modification for insert with check (mon_role() is not null);
create policy decision_modification on modification for update using (peut_administrer()) with check (peut_administrer());

-- Les référentiels et les paramètres : administration seulement.
create policy ecriture_site      on site      for all using (peut_administrer()) with check (peut_administrer());
create policy ecriture_type_doc  on type_document for all using (peut_administrer()) with check (peut_administrer());
create policy ecriture_parametre on parametre for all using (peut_administrer()) with check (peut_administrer());
create policy ecriture_cloture   on cloture_mois for all using (peut_administrer()) with check (peut_administrer());

-- ---------------------------------------------------------------------------
-- 8. Horodatage automatique
-- ---------------------------------------------------------------------------

create or replace function marquer_modification() returns trigger
language plpgsql as $$
begin
  new.modifie_le := now();
  new.modifie_par := auth.uid();
  return new;
end
$$;

do $$
declare t text;
begin
  foreach t in array array['site', 'profil', 'prestataire', 'vehicule', 'chauffeur', 'affectation', 'indisponibilite', 'document', 'depense', 'plein', 'intervention', 'incident', 'sanction']
  loop
    execute format('create trigger %I_horodatage before update on %I for each row execute function marquer_modification()', t, t);
  end loop;
end
$$;

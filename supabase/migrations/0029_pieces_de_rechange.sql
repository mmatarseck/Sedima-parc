-- ============================================================================
-- SEDIMA Parc — 0029 : les pièces de rechange.
--
-- Décisions du gestionnaire du 9 septembre 2026 (docs/PROPOSITION-PIECES.md) :
-- un seul magasin, l'atelier central ; un stock déduit des mouvements et
-- tenu en quantités — la charge passe à l'achat, une sortie ne crée aucune
-- dépense ; toute sortie rattachée à un ordre de travail, une intervention ou
-- un véhicule ; les pneus suivis un par un dès le départ ; les droits du
-- module Maintenance, pas de nouveau profil.
--
-- Trois tables : `piece` (le référentiel), `mouvement_stock` (le journal —
-- le stock est la somme de ses lignes, rien d'autre) et `pneu` (chaque pneu,
-- sa dimension, son véhicule, sa position, ses kilomètres). Aucun seed : le
-- référentiel se saisit ou s'importe ; le stock initial se pose par une
-- régularisation d'inventaire, signée, avec son motif.
--
-- Qui fait quoi : lire avec la lecture du module « maintenance » ; entrer,
-- sortir, retourner, poser un pneu avec sa saisie ; régulariser avec sa
-- gestion. Un mouvement ne se modifie pas : on le corrige par un autre.
-- ============================================================================

create table if not exists piece (
  id                     uuid primary key default gen_random_uuid(),
  numero                 text not null unique,
  reference              text not null,
  designation            text not null,
  categorie              text not null default 'autre' check (categorie in ('filtration', 'lubrifiant', 'freinage', 'pneumatique', 'electricite', 'transmission', 'moteur', 'carrosserie', 'consommable', 'autre')),
  unite                  text not null default 'piece' check (unite in ('piece', 'litre', 'jeu', 'metre')),
  reference_constructeur text,
  -- Les marques et modèles servis, tels que la flotte les nomme.
  compatibilites         text[] not null default '{}',
  prestataire_id         uuid references prestataire (id),
  fournisseur            text,
  prix_reference         bigint check (prix_reference is null or prix_reference >= 0),
  stock_minimum          integer not null default 0 check (stock_minimum >= 0),
  stock_maximum          integer check (stock_maximum is null or stock_maximum >= 0),
  actif                  boolean not null default true,
  commentaire            text,
  cree_le                timestamptz not null default now(),
  cree_par               uuid references auth.users (id),
  modifie_le             timestamptz,
  modifie_par            uuid references auth.users (id)
);

create unique index on piece (lower(reference));
create index on piece (categorie);

comment on table piece is 'Le référentiel des pièces de rechange : une fiche par pièce, sa référence de casier, ses compatibilités, son seuil.';

create table if not exists mouvement_stock (
  id                  uuid primary key default gen_random_uuid(),
  numero              text not null unique,
  date                date not null,
  nature              text not null check (nature in ('entree', 'sortie', 'retour', 'regularisation')),
  piece_id            uuid not null references piece (id) on delete restrict,
  -- Toujours positive ; une régularisation porte l'écart signé.
  quantite            numeric(12, 2) not null check (quantite >= 0),
  ecart               numeric(12, 2),
  prix_unitaire       bigint check (prix_unitaire is null or prix_unitaire >= 0),
  -- Ce que la ligne cite : la demande d'achat livrée, l'ordre ou l'intervention servie, le véhicule.
  demande_numero      text,
  ordre_numero        text,
  intervention_numero text,
  vehicule_id         uuid references vehicule (id) on delete set null,
  fournisseur         text,
  motif               text,
  auteur_nom          text,
  cree_le             timestamptz not null default now(),
  cree_par            uuid references auth.users (id),
  -- Une sortie ne va pas dans le vide : un ordre, une intervention ou un véhicule.
  constraint sortie_rattachee check (nature <> 'sortie' or num_nonnulls(ordre_numero, intervention_numero, vehicule_id) >= 1),
  -- Une régularisation porte son écart et son motif ; les autres, leur quantité.
  constraint regularisation_motivee check (nature <> 'regularisation' or (ecart is not null and coalesce(trim(motif), '') <> '')),
  constraint quantite_portee check (nature = 'regularisation' or quantite > 0)
);

create index on mouvement_stock (piece_id, date);
create index on mouvement_stock (vehicule_id, date);
create index on mouvement_stock (date desc);

comment on table mouvement_stock is 'Le journal du magasin : entrées, sorties rattachées, retours, régularisations d''inventaire. Le stock d''une pièce est la somme de ses lignes.';

create table if not exists pneu (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null unique,
  piece_id       uuid references piece (id) on delete set null,
  marque         text not null default '',
  dimension      text not null,
  numero_serie   text,
  etat           text not null default 'en-stock' check (etat in ('en-stock', 'monte', 'depose', 'rebute')),
  vehicule_id    uuid references vehicule (id) on delete set null,
  position       text,
  date_pose      date,
  km_pose        integer check (km_pose is null or km_pose >= 0),
  date_depose    date,
  km_depose      integer check (km_depose is null or km_depose >= 0),
  rechapages     integer not null default 0 check (rechapages >= 0),
  commentaire    text,
  cree_le        timestamptz not null default now(),
  cree_par       uuid references auth.users (id),
  modifie_le     timestamptz,
  modifie_par    uuid references auth.users (id),
  -- Un pneu monté est sur un véhicule ; un pneu au magasin n'y est pas.
  constraint pneu_monte_sur_vehicule check (etat <> 'monte' or vehicule_id is not null),
  constraint pneu_en_stock_sans_vehicule check (etat <> 'en-stock' or vehicule_id is null)
);

create index on pneu (vehicule_id) where etat = 'monte';
create index on pneu (etat);

comment on table pneu is 'Chaque pneu du parc, un par un : sa dimension, son véhicule et sa position, ses kilomètres de pose et de dépose.';

-- ---------------------------------------------------------------------------
-- Les politiques : les droits du module Maintenance.
-- ---------------------------------------------------------------------------

alter table piece enable row level security;
alter table mouvement_stock enable row level security;
alter table pneu enable row level security;

create policy lecture_piece on piece for select using ((select peut('maintenance', 'lecture')));
create policy ecriture_piece on piece for all using ((select peut('maintenance', 'saisie'))) with check ((select peut('maintenance', 'saisie')));

create policy lecture_mouvement on mouvement_stock for select using ((select peut('maintenance', 'lecture')));
-- Entrer, sortir, retourner : la saisie ; régulariser : la gestion. Un mouvement ne se modifie ni ne s'efface.
create policy ecriture_mouvement on mouvement_stock for insert with check (
  (select peut('maintenance', 'saisie')) and (nature <> 'regularisation' or (select peut('maintenance', 'gestion')))
);

create policy lecture_pneu on pneu for select using ((select peut('maintenance', 'lecture')));
create policy ecriture_pneu on pneu for all using ((select peut('maintenance', 'saisie'))) with check ((select peut('maintenance', 'saisie')));

-- ============================================================================
-- SEDIMA Parc — 0007 : la fiche d'accès par personne.
--
-- Cadrage du 7 septembre 2026, sur le modèle du formulaire de contact de
-- Fleetio : six profils (administrateur, responsable, maintenance, agent
-- terrain, lecteur, détenteur) posent les défauts ; la fiche de chaque
-- personne s'en écarte module par module, et l'écart n'entre en vigueur
-- qu'approuvé par l'administrateur. Un périmètre — sites, business units,
-- régimes — borne ce que la personne voit.
--
-- `profil.role` reste la clé que `get_me()` rend et que les politiques
-- lisent : chaque profil porte un rôle par défaut, écrit en même temps que
-- la fiche. Le détenteur d'un véhicule — chauffeur ou attributaire — entre
-- dans l'énumération : il ne verra que ses demandes et ses transferts, quand
-- ces tables existeront.
-- ============================================================================

alter type role_applicatif add value if not exists 'detenteur';

create table if not exists acces_utilisateur (
  utilisateur_id       uuid primary key references auth.users (id) on delete cascade,
  prenom               text not null default '',
  nom                  text not null default '',
  courriel             text not null default '',
  telephone            text,
  fonction             text,
  matricule            text,
  actif                boolean not null default true,
  profil               text not null check (profil in ('administrateur', 'responsable', 'maintenance', 'agent-terrain', 'lecteur', 'detenteur')),
  -- { sites: 'tous' | [uuid…], businessUnits: 'toutes' | [...], regimes: 'tous' | [...] }
  perimetre            jsonb not null default '{"sites":"tous","businessUnits":"toutes","regimes":"tous"}'::jsonb,
  -- Les écarts au profil, module par module : { "maintenance": "lecture" }.
  modules              jsonb not null default '{}'::jsonb,
  -- Voit les sanctions ; nul : le défaut du profil.
  sanctions            boolean,
  -- Tant que nul, seul le profil s'applique : les écarts attendent l'administrateur.
  ecarts_approuves_par uuid references auth.users (id),
  ecarts_approuves_le  timestamptz,
  chauffeur_id         uuid references chauffeur (id),
  attributaire_id      uuid references attributaire (id),
  cree_le              timestamptz not null default now(),
  cree_par             uuid references auth.users (id),
  modifie_le           timestamptz,
  modifie_par          uuid references auth.users (id)
);

comment on table acces_utilisateur is 'La fiche d''accès d''une personne : profil, périmètre, écarts par module approuvés par l''administrateur.';

alter table acces_utilisateur enable row level security;

-- Chacun lit sa fiche ; l'administrateur les lit et les écrit toutes.
create policy lecture_acces on acces_utilisateur for select using (utilisateur_id = auth.uid() or mon_role() = 'administrateur');
create policy ecriture_acces on acces_utilisateur for all using (mon_role() = 'administrateur') with check (mon_role() = 'administrateur');

-- L'administrateur écrit aussi le rôle historique du profil.
drop policy if exists ecriture_profil on profil;
create policy ecriture_profil on profil for all using (mon_role() = 'administrateur') with check (mon_role() = 'administrateur');

-- ============================================================================
-- 0066 — Les événements d'un chauffeur (métier, 22 septembre 2026).
--
-- « Garder sur un onglet la possibilité de créer des événements par
-- chauffeur, où l'on pourra renseigner les infos non automatiques — cas
-- disciplinaires, etc. » Ce que l'application ne peut pas déduire des faits
-- du parc : un cas disciplinaire, un retard ou une absence injustifiée, une
-- plainte, une félicitation, une formation. Chaque nature pèse sur
-- l'indicateur « Discipline » du score (domaine/evenements-chauffeur.ts).
--
-- Mêmes droits que les sanctions (0033) : les voir demande de voir les
-- sanctions ; les écrire, en plus, la gestion du module Chauffeurs.
--
-- Rejouable.
-- ============================================================================

create table if not exists evenement_chauffeur (
  id           uuid primary key default gen_random_uuid(),
  numero       text not null unique,
  chauffeur_id uuid not null references chauffeur (id) on delete cascade,
  date         date not null,
  nature       text not null check (nature in ('disciplinaire', 'retard-absence', 'plainte', 'felicitation', 'formation', 'autre')),
  description  text not null,
  piece        text,
  cree_le      timestamptz not null default now(),
  cree_par     uuid references auth.users (id),
  modifie_le   timestamptz,
  modifie_par  uuid references auth.users (id)
);

create index if not exists evenement_chauffeur_chauffeur_date on evenement_chauffeur (chauffeur_id, date);

alter table evenement_chauffeur enable row level security;

drop policy if exists lecture_evenement_chauffeur on evenement_chauffeur;
create policy lecture_evenement_chauffeur on evenement_chauffeur for select using ((select voit_sanctions()));

drop policy if exists ecriture_evenement_chauffeur on evenement_chauffeur;
create policy ecriture_evenement_chauffeur on evenement_chauffeur for insert
  with check ((select voit_sanctions()) and (select peut('chauffeurs', 'gestion')));

drop policy if exists correction_evenement_chauffeur on evenement_chauffeur;
create policy correction_evenement_chauffeur on evenement_chauffeur for update
  using ((select voit_sanctions()) and (select peut('chauffeurs', 'gestion')))
  with check ((select voit_sanctions()) and (select peut('chauffeurs', 'gestion')));

drop policy if exists retrait_evenement_chauffeur on evenement_chauffeur;
create policy retrait_evenement_chauffeur on evenement_chauffeur for delete
  using ((select voit_sanctions()) and (select peut('chauffeurs', 'gestion')));

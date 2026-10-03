-- ============================================================================
-- 0078 — Le suivi de l'activité des utilisateurs.
--
-- Métier, 3 octobre 2026 : « prévoir dans les paramètres un suivi de
-- l'activité des différentes personnes pour voir qui utilise réellement
-- l'application et comment ».
--
-- Trois sources, dont deux existaient déjà :
--
--   * la **connexion** : `auth.users.last_sign_in_at`, tenu par Supabase ;
--   * les **saisies** : chaque table de l'application porte `cree_par` et
--     `cree_le` ; la trace `modification` dit qui a modifié quoi ;
--   * les **écrans consultés** — ce qui manquait, et que cette migration
--     ajoute : `activite_page`, une ligne par personne, par jour et par écran,
--     avec le nombre de vues, la première et la dernière, et l'appareil
--     (bureau ou téléphone). Un compteur agrégé, pas un journal clic par clic :
--     de quoi dire qui vient, quand, sur quels modules, sans tout enregistrer.
--
-- L'écran (Paramètres › Activité des utilisateurs) lit `activite_utilisateurs`,
-- réservée comme le diagnostic à l'administrateur et à la direction. Personne
-- ne lit `activite_page` directement : la table n'a pas de politique de
-- lecture. On n'y écrit que par `noter_visite`, et toujours pour soi.
--
-- Rejouable.
-- ============================================================================

create table if not exists activite_page (
  utilisateur_id uuid not null references auth.users (id) on delete cascade,
  jour           date not null,
  -- L'écran, sans ses identifiants : « /flotte/[…] », « /maintenance ».
  chemin         text not null,
  appareil       text not null default 'bureau' check (appareil in ('bureau', 'telephone')),
  vues           integer not null default 1 check (vues > 0),
  premiere       timestamptz not null default now(),
  derniere       timestamptz not null default now(),
  primary key (utilisateur_id, jour, chemin, appareil)
);
create index if not exists activite_page_jour on activite_page (jour);
comment on table activite_page is 'Les écrans consultés : une ligne par personne, jour, écran et appareil, avec le nombre de vues (0078).';

alter table activite_page enable row level security;
-- Aucune politique : la table ne se lit et ne s'écrit que par les fonctions ci-dessous.

-- Noter une visite : toujours pour soi, compteur incrémenté.
create or replace function noter_visite(chemin text, appareil text default 'bureau') returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  qui uuid := auth.uid();
  ecran text := left(coalesce(nullif(trim(chemin), ''), '/'), 120);
  sur text := case when appareil = 'telephone' then 'telephone' else 'bureau' end;
begin
  if qui is null then
    return;
  end if;
  insert into activite_page as a (utilisateur_id, jour, chemin, appareil)
  values (qui, current_date, ecran, sur)
  on conflict (utilisateur_id, jour, chemin, appareil)
  do update set vues = a.vues + 1, derniere = now();
end
$$;

-- Les saisies d'une personne depuis une date : toutes les tables qui portent cree_par et cree_le.
create or replace function saisies_par_utilisateur(depuis date)
returns table (utilisateur_id uuid, saisies bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  t record;
  requete text := '';
begin
  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables x on x.table_schema = c.table_schema and x.table_name = c.table_name and x.table_type = 'BASE TABLE'
     where c.table_schema = 'public' and c.column_name = 'cree_par'
       and exists (select 1 from information_schema.columns d where d.table_schema = 'public' and d.table_name = c.table_name and d.column_name = 'cree_le')
       and c.table_name not in ('modification', 'activite_page', 'profil')
  loop
    requete := requete || case when requete = '' then '' else ' union all ' end
      || format('select cree_par as u from %I where cree_par is not null and cree_le >= %L', t.table_name, depuis);
  end loop;
  if requete = '' then
    return;
  end if;
  return query execute 'select u, count(*) from (' || requete || ') s group by u';
end
$$;

-- Le tableau de l'écran : une ligne par compte, sur la période.
create or replace function activite_utilisateurs(depuis date)
returns table (
  utilisateur_id uuid,
  nom text,
  role text,
  actif boolean,
  courriel text,
  derniere_connexion timestamptz,
  derniere_activite timestamptz,
  jours_actifs bigint,
  vues bigint,
  vues_telephone bigint,
  saisies bigint,
  modifications bigint,
  ecrans jsonb
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if mon_role() is null or mon_role()::text not in ('administrateur', 'direction') then
    raise exception 'Le suivi de l''activité est réservé à l''administrateur et à la direction.' using errcode = '42501';
  end if;
  return query
  with visites as (
    select a.utilisateur_id as u, count(distinct a.jour) as jours, sum(a.vues) as vues,
           sum(a.vues) filter (where a.appareil = 'telephone') as tel, max(a.derniere) as derniere
      from activite_page a where a.jour >= depuis group by a.utilisateur_id
  ),
  par_ecran as (
    select e.u, jsonb_agg(jsonb_build_object('chemin', e.chemin, 'vues', e.vues) order by e.vues desc) as ecrans
      from (select a.utilisateur_id as u, a.chemin, sum(a.vues) as vues from activite_page a where a.jour >= depuis group by a.utilisateur_id, a.chemin) e
     group by e.u
  ),
  saisi as (select s.utilisateur_id as u, s.saisies from saisies_par_utilisateur(depuis) s),
  -- Une modification écrit une ligne par champ changé : on compte les gestes (même pièce, même instant).
  modifie as (select m.cree_par as u, count(distinct (m.table_cible, m.numero, m.cree_le)) as n from modification m where m.cree_le >= depuis group by m.cree_par)
  select p.utilisateur_id, p.nom, p.role::text, p.actif, u.email::text, u.last_sign_in_at,
         v.derniere, coalesce(v.jours, 0), coalesce(v.vues, 0), coalesce(v.tel, 0),
         coalesce(s.saisies, 0), coalesce(m.n, 0), coalesce(e.ecrans, '[]'::jsonb)
    from profil p
    left join auth.users u on u.id = p.utilisateur_id
    left join visites v on v.u = p.utilisateur_id
    left join par_ecran e on e.u = p.utilisateur_id
    left join saisi s on s.u = p.utilisateur_id
    left join modifie m on m.u = p.utilisateur_id
   order by coalesce(v.derniere, u.last_sign_in_at) desc nulls last, p.nom;
end
$$;

-- Ni PUBLIC ni anon : les comptes connectés seulement (comme 0068).
revoke all on function noter_visite(text, text) from public, anon;
revoke all on function saisies_par_utilisateur(date) from public, anon, authenticated;
revoke all on function activite_utilisateurs(date) from public, anon;
grant execute on function noter_visite(text, text) to authenticated, service_role;
grant execute on function saisies_par_utilisateur(date) to service_role;
grant execute on function activite_utilisateurs(date) to authenticated, service_role;

select count(*) as lignes_activite from activite_page;

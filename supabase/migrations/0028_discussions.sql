-- ============================================================================
-- SEDIMA Parc — 0028 : les discussions des fiches.
--
-- Décision du métier du 3 septembre 2026 : chaque fiche (véhicule,
-- chauffeur) porte un fil de discussion, et les personnes citées sont
-- prévenues. Jusqu'ici le fil ne vivait que dans le navigateur.
--
-- Un message : son fil (« vehicule:AA032EA », « chauffeur:babacar-ndiaye »),
-- son auteur, son texte, les comptes qu'il cite, et les chauffeurs cités —
-- qui ne sont pas des comptes : les nommer les met en évidence, sans
-- notification. Un message ne se modifie ni ne s'efface : c'est une trace.
--
-- Qui fait quoi : toute personne connectée avec un rôle lit et publie ; la
-- publication passe par `publier_message()`, qui signe le message de la
-- session et prévient les comptes cités (table `notification`, 0027).
-- ============================================================================

create table if not exists message (
  id             uuid primary key default gen_random_uuid(),
  sujet          text not null,
  auteur_id      uuid not null references auth.users (id),
  auteur_nom     text not null,
  date           timestamptz not null default now(),
  texte          text not null check (length(texte) between 1 and 4000),
  -- Les comptes cités, prévenus ; les chauffeurs cités, tels que le fil les nomme (« chauffeur:babacar-ndiaye »).
  mentions       uuid[] not null default '{}',
  mentions_libres text[] not null default '{}'
);

create index on message (sujet, date);

comment on table message is 'Le fil de discussion d''une fiche : qui a dit quoi, quand, en citant qui.';

alter table message enable row level security;

create policy lecture_message on message for select using ((select mon_role()) is not null);

-- ---------------------------------------------------------------------------
-- Publier : le message est signé de la session (nom de la fiche d'accès, à
-- défaut du profil), et chaque compte cité, autre que l'auteur, reçoit une
-- notification — courriel à envoyer s'il a une adresse.
-- ---------------------------------------------------------------------------

create or replace function publier_message(p_sujet text, p_libelle text, p_href text, p_texte text, p_mentions uuid[], p_mentions_libres text[])
returns message
language plpgsql
security definer
set search_path = public
as $$
declare
  moi uuid := auth.uid();
  nom text;
  m message;
  cible uuid;
  adresse text;
begin
  if moi is null or mon_role() is null then
    raise exception 'Publier un message demande un compte connecté avec un rôle.';
  end if;
  if p_sujet is null or p_sujet !~ '^(vehicule|chauffeur|prestataire):.+$' then
    raise exception 'Un message se publie sur une fiche : véhicule, chauffeur ou prestataire.';
  end if;
  select coalesce(nullif(trim(a.prenom || ' ' || a.nom), ''), p.nom, 'Compte')
    into nom
    from profil p
    left join acces_utilisateur a on a.utilisateur_id = p.utilisateur_id
   where p.utilisateur_id = moi;
  insert into message (sujet, auteur_id, auteur_nom, texte, mentions, mentions_libres)
  values (p_sujet, moi, coalesce(nom, 'Compte'), p_texte, coalesce(p_mentions, '{}'), coalesce(p_mentions_libres, '{}'))
  returning * into m;
  foreach cible in array coalesce(p_mentions, '{}'::uuid[]) loop
    /* On ne se prévient pas soi-même ; un compte inconnu ou inactif n'est pas prévenu. */
    if cible = moi then continue; end if;
    select a.courriel into adresse from acces_utilisateur a where a.utilisateur_id = cible and a.actif;
    if not found then
      if not exists (select 1 from profil p where p.utilisateur_id = cible and p.actif) then continue; end if;
      adresse := null;
    end if;
    insert into notification (destinataire_id, cle, date, auteur, sujet_libelle, extrait, href, courriel_statut)
    values (cible, 'message:' || m.id::text, m.date, m.auteur_nom, coalesce(p_libelle, p_sujet),
            case when length(p_texte) > 120 then left(p_texte, 117) || '…' else p_texte end,
            coalesce(p_href, '/'),
            case when coalesce(trim(adresse), '') <> '' then 'a-envoyer' else 'sans-courriel' end)
    on conflict (destinataire_id, cle) do nothing;
  end loop;
  return m;
end
$$;

comment on function publier_message(text, text, text, text, uuid[], text[]) is 'Publie un message sur le fil d''une fiche, signé de la session, et prévient les comptes cités.';

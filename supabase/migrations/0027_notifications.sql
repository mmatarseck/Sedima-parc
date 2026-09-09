-- ============================================================================
-- SEDIMA Parc — 0027 : les notifications de la plateforme.
--
-- Décision du métier du 7 septembre 2026 : le détenteur est prévenu par
-- notification de l'application ou par courriel, pas de SMS. La table porte
-- une ligne par fait et par destinataire (une fiche de transfert à signer, un
-- lot de demandes) ; la cloche la lit ; le courriel part depuis le serveur,
-- groupé par destinataire, et la ligne garde où il en est.
--
-- Deux fonctions la remplissent, en SECURITY DEFINER parce qu'elles écrivent
-- pour d'autres que l'appelant et lisent les fiches d'accès : chacune vérifie
-- d'abord que l'appelant a le droit de créer le fait qu'elle annonce. Une
-- même notification (même fait, même personne) ne s'insère qu'une fois.
--
-- Chacun ne lit et ne marque que les siennes ; personne n'insère à la main.
-- ============================================================================

create table if not exists notification (
  id              uuid primary key default gen_random_uuid(),
  destinataire_id uuid not null references auth.users (id) on delete cascade,
  -- « transfert:<uuid> », « demandes:<lot> » : le fait annoncé, une fois par personne.
  cle             text not null,
  date            timestamptz not null default now(),
  auteur          text not null default '',
  sujet_libelle   text not null,
  extrait         text not null default '',
  href            text not null,
  lue_le          timestamptz,
  -- Le courriel : à envoyer, envoyé, sans adresse connue, ou en échec (l'erreur est gardée, le matin réessaie).
  courriel_statut text not null default 'a-envoyer' check (courriel_statut in ('a-envoyer', 'envoye', 'sans-courriel', 'echec')),
  courriel_le     timestamptz,
  courriel_erreur text,
  cree_le         timestamptz not null default now(),
  unique (destinataire_id, cle)
);

create index on notification (destinataire_id, date desc);
create index on notification (courriel_statut) where courriel_statut = 'a-envoyer';

comment on table notification is 'Ce qui attend une personne : une fiche de transfert à signer, un lot de demandes. La cloche la lit, le courriel part groupé.';

alter table notification enable row level security;

create policy lecture_notification on notification for select using (destinataire_id = (select auth.uid()));
create policy marquage_notification on notification for update using (destinataire_id = (select auth.uid())) with check (destinataire_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Prévenir les détenteurs d'un chauffeur ou d'un attributaire : chaque fiche
-- d'accès active de profil « détenteur » qui porte l'un ou l'autre reçoit la
-- notification. Rend le nombre de personnes prévenues (0 si toutes l'étaient).
-- ---------------------------------------------------------------------------

create or replace function notifier_detenteurs(p_cle text, p_chauffeur uuid, p_attributaire uuid, p_auteur text, p_sujet text, p_extrait text, p_href text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  x record;
begin
  if p_chauffeur is null and p_attributaire is null then return 0; end if;
  for x in
    select a.utilisateur_id, a.courriel
      from acces_utilisateur a
     where a.actif and a.profil = 'detenteur'
       and ((p_chauffeur is not null and a.chauffeur_id = p_chauffeur) or (p_attributaire is not null and a.attributaire_id = p_attributaire))
  loop
    insert into notification (destinataire_id, cle, auteur, sujet_libelle, extrait, href, courriel_statut)
    values (x.utilisateur_id, p_cle, coalesce(p_auteur, ''), p_sujet, coalesce(p_extrait, ''), p_href,
            case when coalesce(trim(x.courriel), '') <> '' then 'a-envoyer' else 'sans-courriel' end)
    on conflict (destinataire_id, cle) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end
$$;

/** « AA032EA » → « AA 032 EA ». */
create or replace function plaque_affichee(immat text) returns text
language sql immutable as $$
  select regexp_replace(immat, '^([A-Z]{2})([0-9]{3,4})([A-Z]{2})$', '\1 \2 \3')
$$;

-- Une fiche de transfert : les parties qui n'ont pas encore signé sont prévenues.
create or replace function notifier_transfert(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  n integer := 0;
  sujet text;
  extrait text;
begin
  if not (peut('transferts', 'saisie') and mon_role() <> 'detenteur') then
    raise exception 'La notification d''un transfert demande la saisie du module transferts.';
  end if;
  select tr.*, v.immatriculation, coalesce(u.nom, tr.cree_par_nom, '') as auteur
    into t
    from transfert tr
    join vehicule v on v.id = tr.vehicule_id
    left join profil u on u.utilisateur_id = tr.cree_par
   where tr.id = p_id;
  if not found then return 0; end if;
  if t.annulee_le is not null then return 0; end if;
  sujet := 'Fiche de transfert · ' || plaque_affichee(t.immatriculation);
  extrait := t.motif || ' — à signer sur votre téléphone.';
  if t.signature_remettant is null then
    n := n + notifier_detenteurs('transfert:' || p_id::text, t.remettant_chauffeur_id, t.remettant_attributaire_id, t.auteur, sujet, extrait, '/transferts/' || p_id::text);
  end if;
  if t.signature_recipiendaire is null then
    n := n + notifier_detenteurs('transfert:' || p_id::text, t.recipiendaire_chauffeur_id, t.recipiendaire_attributaire_id, t.auteur, sujet, extrait, '/transferts/' || p_id::text);
  end if;
  return n;
end
$$;

-- Un lot de demandes : chaque détenteur visé est prévenu une fois pour le lot.
create or replace function notifier_demandes(p_lot text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  n integer := 0;
  libelle text;
begin
  if not (peut('demandes', 'saisie') and mon_role() <> 'detenteur') then
    raise exception 'La notification d''un lot de demandes demande la saisie du module demandes.';
  end if;
  for d in
    select distinct on (coalesce(x.chauffeur_id::text, ''), coalesce(x.attributaire_id::text, ''))
           x.chauffeur_id, x.attributaire_id, x.type, x.message, coalesce(x.emise_par_nom, '') as auteur
      from demande x
     where x.lot = p_lot and x.annulee_le is null
     order by coalesce(x.chauffeur_id::text, ''), coalesce(x.attributaire_id::text, ''), x.emise_le
  loop
    libelle := case d.type
      when 'releve-compteur' then 'Relevé de compteur'
      when 'jauge-carburant' then 'Jauge de carburant'
      when 'position' then 'Position du véhicule'
      when 'controle-matin' then 'Contrôle du matin'
      else d.type end;
    n := n + notifier_detenteurs('demandes:' || p_lot, d.chauffeur_id, d.attributaire_id, d.auteur, libelle,
                                 coalesce(nullif(d.message, ''), 'Une demande vous attend sur votre téléphone.'), '/telephone/demandes');
  end loop;
  return n;
end
$$;

comment on function notifier_transfert(uuid) is 'Prévient les parties d''une fiche de transfert qui n''ont pas signé ; rend le nombre de personnes prévenues.';
comment on function notifier_demandes(text) is 'Prévient les détenteurs d''un lot de demandes, une fois par personne ; rend le nombre de personnes prévenues.';

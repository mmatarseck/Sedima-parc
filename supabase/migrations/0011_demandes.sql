-- ============================================================================
-- SEDIMA Parc — 0011 : les demandes poussées aux détenteurs.
--
-- Cadrage mobile du 7 septembre 2026 : le parc pousse une demande ciblée au
-- détenteur d'un véhicule — chauffeur titulaire ou attributaire — : relevé
-- de compteur, jauge, position, contrôle du matin ; à une personne, à
-- plusieurs, ou à tous les détenteurs d'un site. Le détenteur répond depuis
-- son téléphone, photo obligatoire ; le parc suit qui a répondu et qui tarde.
--
-- Une demande est un fait daté : le nom du destinataire y est figé au moment
-- de l'envoi. Les demandes parties ensemble portent le même lot.
--
-- Qui fait quoi :
--   - lire : la saisie ou la lecture du module « demandes », dans le
--     périmètre de la personne ; un détenteur ne voit que ce qui lui est
--     adressé (sa fiche d'accès porte son chauffeur ou son attributaire) ;
--   - envoyer : la saisie du module, hors profil détenteur ;
--   - répondre : le destinataire, une fois, tant que la demande court ;
--   - annuler : la gestion du module, tant qu'il n'y a pas de réponse.
--
-- La fonction situation_journaliere() (0010) gagne les demandes sans réponse
-- à l'échéance, pour la pastille « Demandes sans réponse ».
-- ============================================================================

create table if not exists demande (
  id                  uuid primary key default gen_random_uuid(),
  numero              text not null unique,
  lot                 text not null,
  type                text not null check (type in ('releve-compteur', 'jauge-carburant', 'position', 'controle-matin')),
  vehicule_id         uuid not null references vehicule (id) on delete cascade,
  chauffeur_id        uuid references chauffeur (id) on delete set null,
  attributaire_id     uuid references attributaire (id) on delete set null,
  destinataire_nom    text not null,
  message             text,
  emise_le            timestamptz not null default now(),
  emise_par           uuid references auth.users (id),
  emise_par_nom       text,
  echeance            timestamptz not null,
  repondue_le         timestamptz,
  reponse_valeur      numeric(12, 2),
  reponse_texte       text,
  -- La photo est obligatoire : son nom tant que le stockage n'est pas là, son adresse ensuite.
  reponse_photo       text,
  reponse_commentaire text,
  annulee_le          timestamptz,
  annulee_par         uuid references auth.users (id),
  cree_le             timestamptz not null default now(),
  cree_par            uuid references auth.users (id),
  modifie_le          timestamptz,
  modifie_par         uuid references auth.users (id),
  -- Une demande s'adresse à un chauffeur **ou** à un attributaire, jamais aux deux, jamais à personne.
  constraint demande_un_destinataire check (num_nonnulls(chauffeur_id, attributaire_id) = 1),
  -- Une réponse porte sa photo.
  constraint demande_reponse_avec_photo check (repondue_le is null or reponse_photo is not null)
);

create index on demande (lot);
create index on demande (vehicule_id, emise_le);
create index on demande (chauffeur_id) where repondue_le is null;
create index on demande (attributaire_id) where repondue_le is null;
create index on demande (echeance) where repondue_le is null and annulee_le is null;

comment on table demande is 'Une demande poussée au détenteur d''un véhicule : relevé, jauge, position, contrôle du matin ; sa réponse avec photo.';

-- Le destinataire, c'est moi : ma fiche d'accès porte ce chauffeur ou cet attributaire.
create or replace function suis_destinataire(c uuid, a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from acces_utilisateur x
     where x.utilisateur_id = auth.uid() and x.actif
       and ((c is not null and x.chauffeur_id = c) or (a is not null and x.attributaire_id = a))
  )
$$;

alter table demande enable row level security;

create policy lecture_demande on demande for select using (
  suis_destinataire(chauffeur_id, attributaire_id)
  or (peut('demandes', 'lecture') and mon_role() <> 'detenteur'
      and exists (select 1 from vehicule v where v.id = demande.vehicule_id and dans_mon_perimetre(v.site_id, v.business_unit, v.regime)))
);

create policy envoi_demande on demande for insert with check (
  peut('demandes', 'saisie') and mon_role() <> 'detenteur'
  and exists (select 1 from vehicule v where v.id = demande.vehicule_id and dans_mon_perimetre(v.site_id, v.business_unit, v.regime))
);

-- Répondre (le destinataire) ou annuler (la gestion) : la même politique de
-- mise à jour ; ce que chacun peut changer se tient dans les fonctions serveur.
create policy reponse_demande on demande for update using (
  suis_destinataire(chauffeur_id, attributaire_id) or peut('demandes', 'gestion')
) with check (
  suis_destinataire(chauffeur_id, attributaire_id) or peut('demandes', 'gestion')
);

-- ---------------------------------------------------------------------------
-- La situation journalière compte les demandes sans réponse à l'échéance :
-- échues ce jour-là ou avant, ni répondues à la fin du jour, ni annulées.
-- ---------------------------------------------------------------------------

create or replace function situation_journaliere(depuis date, jusqua date)
returns jsonb
language sql stable
set search_path = public
as $$
  with jours as (
    select d::date as jour from generate_series(depuis, jusqua, interval '1 day') as d
  ),
  statut_du_jour as (
    select
      j.jour,
      v.id as vehicule_id,
      v.engage,
      v.categorie,
      v.transport_special,
      coalesce(
        (select 'en-reparation'::statut_vehicule from intervention i
          where i.vehicule_id = v.id and i.type = 'curatif' and i.immobilisation_jours > 0
            and i.date <= j.jour and i.date + i.immobilisation_jours >= j.jour
          limit 1),
        (select m.avant::statut_vehicule from modification m
          where m.table_cible = 'vehicule' and m.numero = v.immatriculation and m.champ = 'statut'
            and m.statut = 'appliquee' and m.cree_le::date > j.jour
            and m.avant is not null
          order by m.cree_le limit 1),
        v.statut
      ) as statut,
      coalesce(
        (select i.date from intervention i
          where i.vehicule_id = v.id and i.type = 'curatif' and i.immobilisation_jours > 0
            and i.date <= j.jour and i.date + i.immobilisation_jours >= j.jour
          order by i.date desc limit 1),
        (select max(m.cree_le::date) from modification m
          where m.table_cible = 'vehicule' and m.numero = v.immatriculation and m.champ = 'statut'
            and m.statut = 'appliquee' and m.cree_le::date <= j.jour),
        coalesce(v.modifie_le, v.cree_le)::date
      ) as depuis_le
    from jours j cross join vehicule v
  ),
  faits as (
    select
      s.jour,
      s.vehicule_id,
      s.engage,
      s.statut,
      (s.statut not in ('en-mutation', 'retrait-en-cours', 'a-recevoir')) and exists (
        select 1 from type_document td
        where td.porteur = 'vehicule' and td.critique and td.actif
          and case td.applicabilite
                when 'tous' then true
                when 'poids-lourds' then s.categorie in ('camion', 'tracteur', 'semi-remorque', 'bus', 'engin')
                when 'legers' then s.categorie in ('camionnette', 'vehicule-leger', 'moto')
                when 'lourds-et-camionnettes' then s.categorie in ('camion', 'tracteur', 'semi-remorque', 'bus', 'engin', 'camionnette')
                when 'transport-special' then s.transport_special
                else false
              end
          and not exists (
            select 1 from document d
            where d.vehicule_id = s.vehicule_id and d.type_document_id = td.id
              and (d.echeance is null or d.echeance >= s.jour)
          )
      ) as immobilise_admin,
      case when s.statut in ('en-service', 'en-backup') then 0 else greatest(1, s.jour - s.depuis_le + 1) end as immobilise_depuis_jours,
      (select count(*)::int from document d where d.vehicule_id = s.vehicule_id and d.echeance > s.jour and d.echeance <= s.jour + 7) as echeances7,
      (select count(*)::int from document d where d.vehicule_id = s.vehicule_id and d.echeance < s.jour) as echues,
      not exists (select 1 from releve_kilometrique r where r.vehicule_id = s.vehicule_id and r.motif_rejet is null and r.date between s.jour - 6 and s.jour)
        and not exists (select 1 from plein p where p.vehicule_id = s.vehicule_id and p.km is not null and p.date between s.jour - 6 and s.jour) as sans_releve7,
      coalesce((select sum(p.litres) from plein p where p.vehicule_id = s.vehicule_id and p.date = s.jour), 0)::numeric as litres,
      coalesce((select sum(p.montant) from plein p where p.vehicule_id = s.vehicule_id and p.date = s.jour), 0)::bigint as carburant,
      coalesce((select sum(x.montant) from depense x where x.vehicule_id = s.vehicule_id and x.date = s.jour and x.poste not in ('amortissement', 'salaire')), 0)::bigint as depenses,
      (select count(*)::int from incident i where i.vehicule_id = s.vehicule_id and i.nature = 'incident' and i.date_heure::date = s.jour) as pannes,
      (select count(*)::int from incident i where i.vehicule_id = s.vehicule_id and i.nature = 'accident' and i.date_heure::date = s.jour) as accidents,
      s.statut in ('en-service', 'en-backup') and exists (
        select 1 from affectation a
        where a.vehicule_id = s.vehicule_id and a.role = 'titulaire' and a.debut <= s.jour and (a.fin is null or a.fin >= s.jour)
          and not exists (select 1 from indisponibilite n where n.chauffeur_id = a.chauffeur_id and n.debut <= s.jour and (n.fin is null or n.fin >= s.jour))
      ) as pret_a_charger
    from statut_du_jour s
  ),
  flotte as (
    select
      j.jour,
      (select count(*)::int from chauffeur c where (c.date_embauche is null or c.date_embauche <= j.jour) and (c.date_sortie is null or c.date_sortie > j.jour)) as chauffeurs,
      (select count(distinct n.chauffeur_id)::int from indisponibilite n where n.debut <= j.jour and (n.fin is null or n.fin >= j.jour)) as chauffeurs_indisponibles,
      (select j.jour - max(i.date_heure::date) from incident i where i.nature = 'accident' and i.date_heure::date <= j.jour) as jours_sans_accident,
      (select count(*)::int from demande d
        where d.annulee_le is null and d.echeance::date <= j.jour
          and (d.repondue_le is null or d.repondue_le::date > j.jour)) as demandes_sans_reponse
    from jours j
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'jour', j.jour,
    'vehicules', (select coalesce(jsonb_agg(to_jsonb(f) - 'jour'), '[]'::jsonb) from faits f where f.jour = j.jour),
    'flotte', jsonb_build_object(
      'chauffeurs', fl.chauffeurs,
      'chauffeurs_indisponibles', fl.chauffeurs_indisponibles,
      'ordres_ouverts', null,
      'ordres_anciens', null,
      'solde_caisse', null,
      'seuil_caisse', null,
      'cuve_litres', null,
      'cuve_jours', null,
      'jours_sans_accident', fl.jours_sans_accident,
      'demandes_sans_reponse', fl.demandes_sans_reponse
    )
  ) order by j.jour), '[]'::jsonb)
  from jours j join flotte fl on fl.jour = j.jour
$$;

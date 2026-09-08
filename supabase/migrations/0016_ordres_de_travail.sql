-- ============================================================================
-- SEDIMA Parc — 0016 : les ordres de travail.
--
-- L'ordre de travail planifie une intervention : un véhicule, un objet, un
-- garage, une date prévue ; il se démarre (le véhicule entre au garage) et
-- se clôt par l'intervention réalisée, qui garde son numéro. Jusqu'ici les
-- ordres vivaient dans le jeu de démonstration et le navigateur ; l'atelier
-- du téléphone et le module Maintenance les lisent désormais ici.
--
-- Qui fait quoi : lire avec la lecture du module « maintenance » dans son
-- périmètre ; créer, démarrer, clôturer, annuler avec sa saisie.
-- La situation journalière (0010) compte les ordres ouverts et ceux qui
-- ont plus de quinze jours, pour la pastille « Ordres de travail ouverts ».
-- ============================================================================

create table if not exists ordre_travail (
  id                          uuid primary key default gen_random_uuid(),
  numero                      text not null unique,
  vehicule_id                 uuid not null references vehicule (id) on delete cascade,
  type                        text not null check (type in ('preventif', 'curatif')),
  objet                       text not null,
  -- La transaction qui motive l'ordre (observation, incident…) ; nulle pour une échéance du plan.
  origine_numero              text,
  origine_libelle             text,
  prestataire_id              uuid references prestataire (id),
  garage                      text not null default '—',
  date_prevue                 date not null,
  immobilisation_prevue_jours integer,
  montant_estime              bigint,
  statut                      text not null default 'planifie' check (statut in ('planifie', 'en-atelier', 'clos', 'annule')),
  date_debut                  date,
  date_cloture                date,
  intervention_numero         text,
  commentaire                 text,
  demandeur_nom               text,
  cree_le                     timestamptz not null default now(),
  cree_par                    uuid references auth.users (id),
  modifie_le                  timestamptz,
  modifie_par                 uuid references auth.users (id)
);

create index on ordre_travail (vehicule_id, date_prevue);
create index on ordre_travail (statut) where statut in ('planifie', 'en-atelier');

comment on table ordre_travail is 'Un ordre de travail : l''intervention planifiée sur un véhicule, de la prise de rendez-vous à la clôture.';

alter table ordre_travail enable row level security;

create policy lecture_ordre on ordre_travail for select using (
  peut('maintenance', 'lecture')
  and exists (select 1 from vehicule v where v.id = ordre_travail.vehicule_id and dans_mon_perimetre(v.site_id, v.business_unit, v.regime))
);
create policy ecriture_ordre on ordre_travail for all using (peut('maintenance', 'saisie')) with check (peut('maintenance', 'saisie'));

-- ---------------------------------------------------------------------------
-- La situation journalière compte les ordres : ouverts à la fin du jour,
-- et ceux dont le rendez-vous a plus de quinze jours.
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
          and (d.repondue_le is null or d.repondue_le::date > j.jour)) as demandes_sans_reponse,
      -- Un ordre est ouvert à la fin du jour s'il est pris avant ce jour et ni clos ni annulé à cette date.
      (select count(*)::int from ordre_travail o
        where o.cree_le::date <= j.jour and o.statut <> 'annule'
          and (o.date_cloture is null or o.date_cloture > j.jour)) as ordres_ouverts,
      (select count(*)::int from ordre_travail o
        where o.cree_le::date <= j.jour and o.statut <> 'annule'
          and (o.date_cloture is null or o.date_cloture > j.jour)
          and j.jour - o.date_prevue > 15) as ordres_anciens
    from jours j
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'jour', j.jour,
    'vehicules', (select coalesce(jsonb_agg(to_jsonb(f) - 'jour'), '[]'::jsonb) from faits f where f.jour = j.jour),
    'flotte', jsonb_build_object(
      'chauffeurs', fl.chauffeurs,
      'chauffeurs_indisponibles', fl.chauffeurs_indisponibles,
      'ordres_ouverts', fl.ordres_ouverts,
      'ordres_anciens', fl.ordres_anciens,
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

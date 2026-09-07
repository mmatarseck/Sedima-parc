-- ============================================================================
-- SEDIMA Parc — 0010 : la situation journalière, pour les pastilles.
--
-- Décision du métier du 8 septembre 2026 : les pastilles du tableau de bord
-- disent l'état du moment — ce que chaque véhicule et la flotte présentaient
-- à la fin d'un jour — et se comparent à hier en fin de journée ou à la
-- semaine passée, avec quatorze jours en pied. Il leur faut donc une ligne
-- par jour et par véhicule sur quatre semaines : cette fonction les rend
-- d'un coup, en un JSON, dans la lignée de `lire_parc()` (0009).
--
-- Ce qu'elle déduit, et de quoi :
--   - le statut à la fin du jour : le statut courant, corrigé par la trace
--     des modifications (`modification`, champ « statut ») pour les jours
--     qui précèdent un changement, et par les interventions curatives qui
--     immobilisent (en réparation du jour de l'intervention à sa fin) ;
--   - l'immobilisation administrative : un document critique exigé
--     (`type_document`, selon l'applicabilité à la catégorie) manquant ou
--     échu ce jour-là — sauf pour un véhicule sortant ou à recevoir ;
--   - les échéances à sept jours et les échéances passées, depuis `document` ;
--   - « sans relevé depuis sept jours » : ni relevé retenu ni plein avec
--     compteur sur la fenêtre ;
--   - litres, carburant, dépenses (hors amortissement et salaires), pannes et
--     accidents du jour ;
--   - « prêt à charger » : opérationnel, un titulaire affecté ce jour-là,
--     disponible (aucune indisponibilité en cours).
--   - pour la flotte : chauffeurs présents et indisponibles, jours écoulés
--     depuis le dernier accident.
--
-- Ce qu'elle ne rend pas encore, faute de table : les ordres de travail, la
-- caisse et la cuve — les clés sont là, à nul, et les pastilles concernées
-- affichent « — » tant que ces modules n'ont pas leur table.
--
-- Elle s'exécute avec les droits de l'appelant (security invoker) : les
-- politiques — niveaux et périmètre — s'appliquent comme partout.
-- ============================================================================

create or replace function situation_journaliere(depuis date, jusqua date)
returns jsonb
language sql stable
set search_path = public
as $$
  with jours as (
    select d::date as jour from generate_series(depuis, jusqua, interval '1 day') as d
  ),
  -- Le statut d'un véhicule à la fin d'un jour, et depuis quand il y est.
  statut_du_jour as (
    select
      j.jour,
      v.id as vehicule_id,
      v.engage,
      v.categorie,
      v.transport_special,
      coalesce(
        -- Une intervention curative qui immobilise couvre le jour : en réparation.
        (select 'en-reparation'::statut_vehicule from intervention i
          where i.vehicule_id = v.id and i.type = 'curatif' and i.immobilisation_jours > 0
            and i.date <= j.jour and i.date + i.immobilisation_jours >= j.jour
          limit 1),
        -- La trace : la première modification du statut postérieure au jour dit ce qu'il était avant.
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
      -- Immobilisé administrativement : un document critique exigé manque ou est échu.
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
      (select j.jour - max(i.date_heure::date) from incident i where i.nature = 'accident' and i.date_heure::date <= j.jour) as jours_sans_accident
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
      'jours_sans_accident', fl.jours_sans_accident
    )
  ) order by j.jour), '[]'::jsonb)
  from jours j join flotte fl on fl.jour = j.jour
$$;

comment on function situation_journaliere(date, date) is 'Une situation par jour, de depuis à jusqua : ce que chaque véhicule et la flotte présentaient à la fin du jour — la matière des pastilles du tableau de bord.';

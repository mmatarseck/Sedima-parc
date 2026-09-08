-- ============================================================================
-- SEDIMA Parc — 0018 : la situation journalière en ensembles.
--
-- Diagnostic du 8 septembre 2026 en production : situation_journaliere()
-- prenait 8,2 s pour 28 jours et 129 véhicules — le tableau de bord tout
-- entier. La cause : chaque fait de chaque véhicule de chaque jour était une
-- sous-requête corrélée sur sa table, soit des dizaines de milliers de
-- lectures, et chacune repassait par les politiques d'accès (rôle, périmètre,
-- fiche d'accès) ligne par ligne.
--
-- Même résultat, autre forme : chaque table est lue **une fois**, bornée à la
-- fenêtre demandée, dans une expression de table commune — les politiques
-- s'y appliquent une fois, `materialized` pour que Postgres ne la réinjecte pas
-- dans chaque sous-requête — et les faits se déduisent de ces petits ensembles
-- en mémoire. Les fonctions solde_caisse() et stock_cuve() sont reprises en
-- ligne pour la même raison. Rien ne change dans le JSON rendu.
-- ============================================================================

create or replace function situation_journaliere(depuis date, jusqua date)
returns jsonb
language sql stable
set search_path = public
as $$
  with jours as (
    select d::date as jour from generate_series(depuis, jusqua, interval '1 day') as d
  ),
  -- ---- Les tables, lues une fois ------------------------------------------
  veh as materialized (
    select v.id, v.immatriculation, v.engage, v.categorie, v.transport_special, v.statut,
           coalesce(v.modifie_le, v.cree_le)::date as base_le
    from vehicule v
  ),
  reparations as materialized (
    select i.vehicule_id, i.date, (i.date + i.immobilisation_jours)::date as fin
    from intervention i
    where i.type = 'curatif' and i.immobilisation_jours > 0 and i.date <= jusqua and i.date + i.immobilisation_jours >= depuis
  ),
  traces as materialized (
    select m.numero, m.avant, m.cree_le, m.cree_le::date as jour
    from modification m
    where m.table_cible = 'vehicule' and m.champ = 'statut' and m.statut = 'appliquee'
  ),
  criteres as materialized (
    select td.id, td.applicabilite from type_document td where td.porteur = 'vehicule' and td.critique and td.actif
  ),
  docs as materialized (
    select d.vehicule_id, d.type_document_id, d.echeance from document d where d.vehicule_id is not null
  ),
  releves as materialized (
    select r.vehicule_id, r.date from releve_kilometrique r where r.motif_rejet is null and r.date between depuis - 6 and jusqua
  ),
  pleins as materialized (
    select p.vehicule_id, p.date, p.litres, p.montant, p.km from plein p where p.date between depuis - 6 and jusqua
  ),
  pleins_cuve as materialized (
    select p.date, p.litres from plein p where p.source ilike '%cuve%' and p.date <= jusqua
  ),
  depenses as materialized (
    select x.vehicule_id, x.date, x.montant from depense x
    where x.date between depuis and jusqua and x.poste not in ('amortissement', 'salaire')
  ),
  incidents as materialized (
    select i.vehicule_id, i.nature, i.date_heure::date as jour from incident i where i.date_heure::date <= jusqua
  ),
  titulaires as materialized (
    select a.vehicule_id, a.chauffeur_id, a.debut, a.fin from affectation a
    where a.role = 'titulaire' and a.debut <= jusqua and (a.fin is null or a.fin >= depuis)
  ),
  indispos as materialized (
    select n.chauffeur_id, n.debut, n.fin from indisponibilite n where n.debut <= jusqua and (n.fin is null or n.fin >= depuis)
  ),
  effectif as materialized (
    select c.date_embauche, c.date_sortie from chauffeur c
  ),
  demandes_ouvertes as materialized (
    select d.echeance::date as echeance, d.repondue_le::date as repondue from demande d
    where d.annulee_le is null and d.echeance::date <= jusqua
  ),
  ordres as materialized (
    select o.cree_le::date as cree, o.date_prevue, o.date_cloture from ordre_travail o
    where o.statut <> 'annule' and o.cree_le::date <= jusqua
  ),
  caisse as materialized (
    select c.date, case when c.sens = 'entree' then c.montant else -c.montant end as effet from mouvement_caisse c where c.date <= jusqua
  ),
  jauges as materialized (
    select m.date, m.litres, m.numero from mouvement_cuve m where m.sens = 'jauge' and m.date <= jusqua
  ),
  livraisons as materialized (
    select m.date, m.litres from mouvement_cuve m where m.sens = 'livraison' and m.date <= jusqua
  ),
  reports as materialized (
    select coalesce((select (valeur->>'soldeInitial')::bigint from parametre where cle = 'caisse'), 1500000) as solde_initial,
           coalesce((select (valeur->>'seuil')::bigint from parametre where cle = 'caisse'), 200000) as seuil_caisse,
           coalesce((select (valeur->>'stockInitial')::numeric from parametre where cle = 'cuve'), 9000) as stock_initial
  ),
  -- ---- Le statut de chaque véhicule à la fin de chaque jour ---------------
  statut_du_jour as (
    select
      j.jour,
      v.id as vehicule_id,
      v.engage,
      v.categorie,
      v.transport_special,
      coalesce(
        (select 'en-reparation'::statut_vehicule from reparations i
          where i.vehicule_id = v.id and i.date <= j.jour and i.fin >= j.jour limit 1),
        (select t.avant::statut_vehicule from traces t
          where t.numero = v.immatriculation and t.jour > j.jour and t.avant is not null
          order by t.cree_le limit 1),
        v.statut
      ) as statut,
      coalesce(
        (select i.date from reparations i
          where i.vehicule_id = v.id and i.date <= j.jour and i.fin >= j.jour
          order by i.date desc limit 1),
        (select max(t.jour) from traces t where t.numero = v.immatriculation and t.jour <= j.jour),
        v.base_le
      ) as depuis_le
    from jours j cross join veh v
  ),
  -- ---- Les faits par véhicule et par jour ----------------------------------
  faits as (
    select
      s.jour,
      s.vehicule_id,
      s.engage,
      s.statut,
      (s.statut not in ('en-mutation', 'retrait-en-cours', 'a-recevoir')) and exists (
        select 1 from criteres td
        where case td.applicabilite
                when 'tous' then true
                when 'poids-lourds' then s.categorie in ('camion', 'tracteur', 'semi-remorque', 'bus', 'engin')
                when 'legers' then s.categorie in ('camionnette', 'vehicule-leger', 'moto')
                when 'lourds-et-camionnettes' then s.categorie in ('camion', 'tracteur', 'semi-remorque', 'bus', 'engin', 'camionnette')
                when 'transport-special' then s.transport_special
                else false
              end
          and not exists (
            select 1 from docs d
            where d.vehicule_id = s.vehicule_id and d.type_document_id = td.id
              and (d.echeance is null or d.echeance >= s.jour)
          )
      ) as immobilise_admin,
      case when s.statut in ('en-service', 'en-backup') then 0 else greatest(1, s.jour - s.depuis_le + 1) end as immobilise_depuis_jours,
      (select count(*)::int from docs d where d.vehicule_id = s.vehicule_id and d.echeance > s.jour and d.echeance <= s.jour + 7) as echeances7,
      (select count(*)::int from docs d where d.vehicule_id = s.vehicule_id and d.echeance < s.jour) as echues,
      not exists (select 1 from releves r where r.vehicule_id = s.vehicule_id and r.date between s.jour - 6 and s.jour)
        and not exists (select 1 from pleins p where p.vehicule_id = s.vehicule_id and p.km is not null and p.date between s.jour - 6 and s.jour) as sans_releve7,
      coalesce((select sum(p.litres) from pleins p where p.vehicule_id = s.vehicule_id and p.date = s.jour), 0)::numeric as litres,
      coalesce((select sum(p.montant) from pleins p where p.vehicule_id = s.vehicule_id and p.date = s.jour), 0)::bigint as carburant,
      coalesce((select sum(x.montant) from depenses x where x.vehicule_id = s.vehicule_id and x.date = s.jour), 0)::bigint as depenses,
      (select count(*)::int from incidents i where i.vehicule_id = s.vehicule_id and i.nature = 'incident' and i.jour = s.jour) as pannes,
      (select count(*)::int from incidents i where i.vehicule_id = s.vehicule_id and i.nature = 'accident' and i.jour = s.jour) as accidents,
      s.statut in ('en-service', 'en-backup') and exists (
        select 1 from titulaires a
        where a.vehicule_id = s.vehicule_id and a.debut <= s.jour and (a.fin is null or a.fin >= s.jour)
          and not exists (select 1 from indispos n where n.chauffeur_id = a.chauffeur_id and n.debut <= s.jour and (n.fin is null or n.fin >= s.jour))
      ) as pret_a_charger
    from statut_du_jour s
  ),
  -- ---- La flotte, jour par jour --------------------------------------------
  flotte as (
    select
      j.jour,
      (select count(*)::int from effectif c where (c.date_embauche is null or c.date_embauche <= j.jour) and (c.date_sortie is null or c.date_sortie > j.jour)) as chauffeurs,
      (select count(distinct n.chauffeur_id)::int from indispos n where n.debut <= j.jour and (n.fin is null or n.fin >= j.jour)) as chauffeurs_indisponibles,
      (select j.jour - max(i.jour) from incidents i where i.nature = 'accident' and i.jour <= j.jour) as jours_sans_accident,
      (select count(*)::int from demandes_ouvertes d where d.echeance <= j.jour and (d.repondue is null or d.repondue > j.jour)) as demandes_sans_reponse,
      (select count(*)::int from ordres o where o.cree <= j.jour and (o.date_cloture is null or o.date_cloture > j.jour)) as ordres_ouverts,
      (select count(*)::int from ordres o where o.cree <= j.jour and (o.date_cloture is null or o.date_cloture > j.jour) and j.jour - o.date_prevue > 15) as ordres_anciens,
      r.solde_initial + coalesce((select sum(c.effet) from caisse c where c.date <= j.jour), 0) as solde_caisse,
      r.seuil_caisse,
      -- Le stock repart du dernier relevé de jauge du jour ou d'avant ; ce qui suit s'y ajoute ou s'en retire.
      greatest(0, coalesce(jg.litres, r.stock_initial)
        + coalesce((select sum(l.litres) from livraisons l where l.date <= j.jour and (jg.date is null or l.date > jg.date)), 0)
        - coalesce((select sum(p.litres) from pleins_cuve p where p.date <= j.jour and (jg.date is null or p.date > jg.date)), 0)) as cuve_litres,
      (select sum(p.litres) from pleins_cuve p where p.date > j.jour - 7 and p.date <= j.jour) as sorties7
    from jours j
    cross join reports r
    left join lateral (select g.date, g.litres from jauges g where g.date <= j.jour order by g.date desc, g.numero desc limit 1) jg on true
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'jour', j.jour,
    'vehicules', (select coalesce(jsonb_agg(to_jsonb(f) - 'jour'), '[]'::jsonb) from faits f where f.jour = j.jour),
    'flotte', jsonb_build_object(
      'chauffeurs', fl.chauffeurs,
      'chauffeurs_indisponibles', fl.chauffeurs_indisponibles,
      'ordres_ouverts', fl.ordres_ouverts,
      'ordres_anciens', fl.ordres_anciens,
      'solde_caisse', fl.solde_caisse,
      'seuil_caisse', fl.seuil_caisse,
      'cuve_litres', round(fl.cuve_litres, 1),
      'cuve_jours', case when coalesce(fl.sorties7, 0) > 0 then round(fl.cuve_litres / (fl.sorties7 / 7), 1) else null end,
      'jours_sans_accident', fl.jours_sans_accident,
      'demandes_sans_reponse', fl.demandes_sans_reponse
    )
  ) order by j.jour), '[]'::jsonb)
  from jours j join flotte fl on fl.jour = j.jour
$$;

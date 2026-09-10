-- ============================================================================
-- SEDIMA Parc — 0037 : trois zéros qui mentaient, sur les données réelles.
--
-- Le rapport du tableau de bord sur la base à l'état de la production
-- (`scripts/rapport-tableau-reel.mts`, 10 septembre 2026) a montré trois
-- affirmations sans mesure derrière.
--
-- 1. **Toute la flotte immobilisée.** 47 engagés sur 47 hors service, 47
--    « non conformes » chaque mois. La carte grise est critique, exigée de
--    tous — et le parc n'en a enregistré **aucune**. Le calcul lisait l'absence
--    de saisie comme l'absence du document. Un type dont aucune pièce n'existe
--    n'est pas encore suivi : il n'immobilise personne. Dès la première carte
--    grise saisie, la règle s'applique à tous. Le domaine applique la même
--    règle (`exigeDocument`), depuis `types_document_suivis()` ci-dessous.
--
-- 2. **Une caisse de 1 500 kF et une cuve de 9 000 l.** Ce sont le solde reporté
--    et le stock de départ du jeu de démonstration, restés dans `parametre` :
--    aucun mouvement de caisse ni de cuve n'existe. Sans mouvement, le champ
--    sort nul, et la pastille dit « — ».
--
-- 3. **552 M F de factures de prestataires à régler.** Le chargement du
--    transport posait la date du bon de commande en date de facture, sans
--    règlement : trois ans de bons passaient pour une dette. Le correctif
--    `supabase/correctif-reglement-transport.sql` range ces bons en réglés ; la
--    fonction, elle, cesse de compter comme « à régler » une ligne réglée dont
--    la date de règlement n'est pas connue.
--
-- On repart de 0036, comme toujours : une fonction rejouée n'hérite de rien.
-- ============================================================================

create or replace function types_document_suivis()
returns table (type_document_id text)
language sql
stable
security definer
set search_path = public
as $$
  -- Les types dont le parc a enregistré au moins une pièce. Des identifiants,
  -- rien d'autre : la fonction passe outre la lecture restreinte des documents
  -- pour que tout le monde applique la même règle, quel que soit son périmètre.
  select distinct d.type_document_id from document d where mon_role() is not null
  union
  select 'licence-transport' where mon_role() is not null and exists (select 1 from licence_transport)
$$;

comment on function types_document_suivis() is 'Les types de document dont au moins une pièce existe : les autres ne sont pas encore suivis, et leur absence n''immobilise personne.';

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function types_document_suivis() from anon';
  end if;
end
$$;

create or replace function situation_journaliere(depuis date, jusqua date)
returns jsonb
language sql stable
set search_path = public
as $$
  with jours as (
    select d::date as jour from generate_series(depuis, jusqua, interval '1 day') as d
  ),
  -- ---- Les tables, lues une fois (0018) ------------------------------------
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
      -- Un type que le parc n'a jamais enregistré n'est pas suivi (0037).
      and exists (select 1 from document d where d.vehicule_id is not null and d.type_document_id = td.id)
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
  -- Tous les rôles, pas seulement le titulaire, et l'aptitude du conducteur :
  -- c'est la correction de 0031, reprise telle quelle.
  conducteurs as materialized (
    select a.vehicule_id, a.chauffeur_id, a.debut, a.fin, c.aptitude
    from affectation a join chauffeur c on c.id = a.chauffeur_id
    where a.debut <= jusqua and (a.fin is null or a.fin >= depuis)
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
  -- Une caisse ou une cuve sans aucun mouvement n'est pas tenue (0037) : le
  -- solde reporté ou le stock de départ seuls ne sont pas des mesures.
  tenue as materialized (
    select exists (select 1 from mouvement_caisse) as caisse, exists (select 1 from mouvement_cuve) as cuve
  ),
  -- ---- Le parc des prestataires (0035) -------------------------------------
  -- Le droit de lecture est évalué UNE FOIS, pas par jour. S'il est faux, les
  -- huit champs sortent nuls et les pastilles disent « — » plutôt que zéro.
  vu as materialized (select peut('transporteurs', 'lecture') as tiers),
  -- Le dernier plein connu du parc, toutes dates confondues. Il sert a
  -- distinguer « la flotte n'a rien consomme » de « rien n'a ete releve » :
  -- sans lui, une fenetre posterieure au dernier releve affiche zero litre,
  -- ce qui affirme une mesure la ou il n'y en a pas.
  dernier_plein as materialized (select max(p.date) as jour from plein p),
  -- Le référentiel des camions tiers ne porte AUCUNE date d'entrée : ni mise
  -- en service, ni rattachement. Le premier jet comptait ceux dont `cree_le`
  -- précédait le jour évalué ; comme le jeu de départ les crée tous le même
  -- jour, la valeur sortait à zéro sur toute la fenêtre. On compte donc
  -- l'effectif d'aujourd'hui, appliqué à chaque jour — c'est un référentiel,
  -- pas un historique, et mieux vaut le dire que de fabriquer une date.
  tiers_camions as materialized (
    select count(*)::int as n from camion_tiers t where t.actif
  ),
  -- La mise à disposition se facture au mois : sa granularité n'est pas le
  -- jour, et on ne fait pas semblant. Le jour lit le mois qui le contient.
  tiers_mad as materialized (
    select m.mois, m.jours_panne from mise_a_disposition m
    where m.statut <> 'annule' and m.mois >= to_char(depuis - 31, 'YYYY-MM') and m.mois <= to_char(jusqua, 'YYYY-MM')
  ),
  tiers_affretements as materialized (
    select a.date, a.date_livraison, a.statut from affretement a
    where a.statut <> 'annule' and a.date <= jusqua
  ),
  -- Le tonnage confié aux tiers face au tonnage total : le mode dit lequel est
  -- lequel. « enlevement-client » et « prestataire-ponctuel » ne sont pas du
  -- parc non plus ; ils comptent donc dans les tiers comme dans le total. Le
  -- tonnage pesé au pont bascule prime sur le tonnage annoncé.
  tiers_releves as materialized (
    select r.date, r.mode, coalesce(r.tonnage_pese, r.tonnage) as tonnage from releve_transport r
    where r.date between depuis - 6 and jusqua
  ),
  -- Les trois voies de facturation d'un prestataire, mises bout à bout. Le
  -- montant facturé fait foi ; à défaut, le montant convenu ou calculé.
  tiers_factures as materialized (
    select a.date_facture, a.date_reglement, coalesce(a.montant_facture, a.montant_convenu) as montant
      from affretement a where a.date_facture is not null and a.date_facture <= jusqua and a.statut not in ('annule', 'regle')
    union all
    select m.date_facture, m.date_reglement, coalesce(m.montant_facture, ((m.jours_calendaires - m.jours_panne) * m.prix_jour)::bigint)
      from mise_a_disposition m where m.date_facture is not null and m.date_facture <= jusqua and m.statut not in ('annule', 'regle')
    union all
    select p.date_facture, p.date_reglement, coalesce(p.montant_facture, (p.quantite * p.prix_unitaire)::bigint)
      from prestation p where p.date_facture is not null and p.date_facture <= jusqua and p.statut not in ('annule', 'regle')
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
        select 1 from conducteurs a
        where a.vehicule_id = s.vehicule_id and a.debut <= s.jour and (a.fin is null or a.fin >= s.jour)
          and a.aptitude <> 'inapte'
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
      (select dp.jour from dernier_plein dp) as dernier_plein,
      (select count(*)::int from ordres o where o.cree <= j.jour and (o.date_cloture is null or o.date_cloture > j.jour)) as ordres_ouverts,
      (select count(*)::int from ordres o where o.cree <= j.jour and (o.date_cloture is null or o.date_cloture > j.jour) and j.jour - o.date_prevue > 15) as ordres_anciens,
      case when tn.caisse then r.solde_initial + coalesce((select sum(c.effet) from caisse c where c.date <= j.jour), 0) end as solde_caisse,
      r.seuil_caisse,
      -- Le stock repart du dernier relevé de jauge du jour ou d'avant ; ce qui suit s'y ajoute ou s'en retire.
      case when tn.cuve then greatest(0, coalesce(jg.litres, r.stock_initial)
        + coalesce((select sum(l.litres) from livraisons l where l.date <= j.jour and (jg.date is null or l.date > jg.date)), 0)
        - coalesce((select sum(p.litres) from pleins_cuve p where p.date <= j.jour and (jg.date is null or p.date > jg.date)), 0)) end as cuve_litres,
      (select sum(p.litres) from pleins_cuve p where p.date > j.jour - 7 and p.date <= j.jour) as sorties7,
      -- Le parc des prestataires
      (select t.n from tiers_camions t) as tiers_camions,
      (select count(*)::int from tiers_mad m where m.mois = to_char(j.jour, 'YYYY-MM')) as tiers_mad,
      (select coalesce(sum(m.jours_panne), 0)::int from tiers_mad m where m.mois = to_char(j.jour, 'YYYY-MM')) as tiers_mad_panne,
      (select count(*)::int from tiers_affretements a
        where a.date <= j.jour and (a.date_livraison is null or a.date_livraison > j.jour)
          and a.statut in ('demande', 'confirme', 'en-cours')) as tiers_affretements_ouverts,
      (select coalesce(sum(t.tonnage), 0)::numeric from tiers_releves t
        where t.date between j.jour - 6 and j.jour and t.mode <> 'parc') as tiers_tonnage7,
      (select coalesce(sum(t.tonnage), 0)::numeric from tiers_releves t
        where t.date between j.jour - 6 and j.jour) as tonnage7,
      (select count(*)::int from tiers_factures f
        where f.date_facture <= j.jour and (f.date_reglement is null or f.date_reglement > j.jour)) as tiers_factures,
      (select coalesce(sum(f.montant), 0)::bigint from tiers_factures f
        where f.date_facture <= j.jour and (f.date_reglement is null or f.date_reglement > j.jour)) as tiers_factures_montant
    from jours j
    cross join reports r
    cross join tenue tn
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
      'demandes_sans_reponse', fl.demandes_sans_reponse,
      'dernier_plein', fl.dernier_plein,
      'tiers_camions', case when vu.tiers then fl.tiers_camions end,
      'tiers_mad', case when vu.tiers then fl.tiers_mad end,
      'tiers_mad_panne', case when vu.tiers then fl.tiers_mad_panne end,
      'tiers_affretements_ouverts', case when vu.tiers then fl.tiers_affretements_ouverts end,
      'tiers_tonnage7', case when vu.tiers then round(fl.tiers_tonnage7, 1) end,
      'tonnage7', case when vu.tiers then round(fl.tonnage7, 1) end,
      'tiers_factures', case when vu.tiers then fl.tiers_factures end,
      'tiers_factures_montant', case when vu.tiers then fl.tiers_factures_montant end
    )
  ) order by j.jour), '[]'::jsonb)
  from jours j join flotte fl on fl.jour = j.jour cross join vu
$$;

-- ============================================================================
-- SEDIMA Parc — 0017 : la caisse parc et la cuve interne.
--
-- Deux journaux, une même règle : le solde et le stock ne se saisissent pas,
-- ils se déduisent des mouvements.
--
--   * mouvement_caisse : un approvisionnement (entrée) ou une sortie ; la
--     sortie cite la dépense qu'elle règle (règle du métier du 3 septembre
--     2026) — par son numéro, la dépense restant la vérité du véhicule.
--   * mouvement_cuve : une livraison de citerne ou un relevé de jauge. Les
--     sorties ne sont pas ici : ce sont les pleins pris à la cuve (table
--     plein, source « cuve »), une transaction, un numéro.
--
-- Le solde de départ et le seuil de la caisse, le stock de départ de la cuve
-- sont des paramètres (clés « caisse » et « cuve », sous les noms du domaine,
-- réglables dans Paramètres › Caisse et cuve), posés ici à leurs défauts.
-- La situation journalière (0010) rend le solde, le
-- seuil, le stock et l'autonomie de la cuve pour les deux pastilles.
--
-- Qui fait quoi : la caisse se lit et s'écrit avec le module « couts », la
-- cuve avec le module « releves » (relevés, pleins, cuve).
-- ============================================================================

create table if not exists mouvement_caisse (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null unique,
  date           date not null,
  sens           text not null check (sens in ('entree', 'sortie')),
  libelle        text not null,
  montant        bigint not null check (montant > 0),
  beneficiaire   text,
  piece          text,
  justificatif   boolean not null default false,
  -- La dépense réglée, par son numéro ; nulle pour un approvisionnement.
  depense_numero text,
  enregistre_par text,
  cree_le        timestamptz not null default now(),
  cree_par       uuid references auth.users (id),
  modifie_le     timestamptz,
  modifie_par    uuid references auth.users (id)
);
create index on mouvement_caisse (date);
create index on mouvement_caisse (depense_numero) where depense_numero is not null;
comment on table mouvement_caisse is 'Le journal de la caisse parc : approvisionnements et sorties, chaque sortie citant la dépense qu''elle règle.';

create table if not exists mouvement_cuve (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null unique,
  date           date not null,
  sens           text not null check (sens in ('livraison', 'jauge')),
  libelle        text not null,
  -- Litres livrés, ou stock lu pour un relevé de jauge.
  litres         numeric(10, 1) not null check (litres >= 0),
  prix_litre     integer,
  montant        bigint,
  fournisseur    text,
  prestataire_id uuid references prestataire (id),
  piece          text,
  commentaire    text,
  enregistre_par text,
  cree_le        timestamptz not null default now(),
  cree_par       uuid references auth.users (id),
  modifie_le     timestamptz,
  modifie_par    uuid references auth.users (id)
);
create index on mouvement_cuve (date);
comment on table mouvement_cuve is 'Le journal de la cuve interne : livraisons et relevés de jauge ; les sorties sont les pleins pris à la cuve.';

alter table mouvement_caisse enable row level security;
alter table mouvement_cuve enable row level security;

create policy lecture_caisse  on mouvement_caisse for select using (peut('couts', 'lecture'));
create policy ecriture_caisse on mouvement_caisse for all using (peut('couts', 'saisie')) with check (peut('couts', 'saisie'));
create policy lecture_cuve    on mouvement_cuve for select using (peut('releves', 'lecture'));
create policy ecriture_cuve   on mouvement_cuve for all using (peut('releves', 'saisie')) with check (peut('releves', 'saisie'));

-- Les paramètres des deux journaux, à leurs défauts s'ils manquent.
insert into parametre (cle, valeur) values
  ('caisse', '{"soldeInitial": 1500000, "seuil": 200000}'::jsonb),
  ('cuve', '{"stockInitial": 9000}'::jsonb)
on conflict (cle) do nothing;

-- ---------------------------------------------------------------------------
-- Le solde de la caisse et le stock de la cuve à la fin d'un jour.
-- ---------------------------------------------------------------------------

create or replace function solde_caisse(jour date)
returns bigint
language sql stable
set search_path = public
as $$
  select coalesce((select (valeur->>'soldeInitial')::bigint from parametre where cle = 'caisse'), 1500000)
       + coalesce((select sum(case when sens = 'entree' then montant else -montant end) from mouvement_caisse where date <= jour), 0)
$$;

-- Le dernier relevé de jauge recale le stock ; ce qui suit s'y ajoute ou s'en retire.
create or replace function stock_cuve(jour date)
returns numeric
language sql stable
set search_path = public
as $$
  with jauge as (
    select date, litres from mouvement_cuve where sens = 'jauge' and date <= jour order by date desc, numero desc limit 1
  ),
  depart as (
    select coalesce((select litres from jauge), coalesce((select (valeur->>'stockInitial')::numeric from parametre where cle = 'cuve'), 9000)) as litres,
           (select date from jauge) as depuis
  )
  select greatest(0, d.litres
    + coalesce((select sum(m.litres) from mouvement_cuve m where m.sens = 'livraison' and m.date <= jour and (d.depuis is null or m.date > d.depuis)), 0)
    - coalesce((select sum(p.litres) from plein p where p.source ilike '%cuve%' and p.date <= jour and (d.depuis is null or p.date > d.depuis)), 0))
  from depart d
$$;

-- ---------------------------------------------------------------------------
-- La situation journalière porte désormais la caisse et la cuve.
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
      (select count(*)::int from ordre_travail o
        where o.cree_le::date <= j.jour and o.statut <> 'annule'
          and (o.date_cloture is null or o.date_cloture > j.jour)) as ordres_ouverts,
      (select count(*)::int from ordre_travail o
        where o.cree_le::date <= j.jour and o.statut <> 'annule'
          and (o.date_cloture is null or o.date_cloture > j.jour)
          and j.jour - o.date_prevue > 15) as ordres_anciens,
      solde_caisse(j.jour) as solde_caisse,
      coalesce((select (valeur->>'seuil')::bigint from parametre where cle = 'caisse'), 200000) as seuil_caisse,
      stock_cuve(j.jour) as cuve_litres,
      -- L'autonomie : le stock rapporté aux sorties moyennes des sept derniers jours.
      (select sum(p.litres) from plein p where p.source ilike '%cuve%' and p.date > j.jour - 7 and p.date <= j.jour) as sorties7
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

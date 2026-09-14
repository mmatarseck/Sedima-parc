-- ============================================================================
-- SEDIMA Parc — 0050 : les attelages.
--
-- Un tracteur et une semi-remorque sont deux véhicules au référentiel — deux
-- cartes grises, deux visites techniques, deux fiches — mais une seule unité
-- qui roule. La situation du parc lourd les compte d'ailleurs ainsi :
-- « 33 unités opérationnelles, 38 plaques, cinq attelages tracteur + semi ».
--
-- L'application savait déjà tout dire d'un attelage — le type `Attelage`, la
-- fiche véhicule, son bouton « Nouvel attelage », le numéro `ATT-…` — sauf le
-- garder : il n'y avait pas de table. Ce qu'on créait depuis l'écran ne
-- survivait pas au rechargement, et la fiche servait toujours une liste vide.
--
-- CE QU'UN ATTELAGE N'EST PAS. Ce n'est pas une affectation : l'affectation lie
-- une personne à un véhicule, l'attelage lie deux véhicules entre eux. Ce n'est
-- pas non plus une propriété du tracteur : la même semi passe d'un tracteur à
-- l'autre, et c'est précisément ce qu'on veut suivre.
--
-- POURQUOI DEUX COLONNES PLUTÔT QU'UN RÔLE. On aurait pu écrire une ligne par
-- véhicule avec un rôle. Deux colonnes nommées disent la chose telle qu'elle
-- est — un attelage a un tracteur et une remorque, jamais deux tracteurs — et
-- l'exclusion ci-dessous devient vérifiable par la base plutôt que par du code.
-- ============================================================================

create table attelage (
  id          uuid primary key default gen_random_uuid(),
  numero      text not null unique,
  tracteur_id uuid not null references vehicule (id) on delete cascade,
  remorque_id uuid not null references vehicule (id) on delete cascade,
  debut       date not null,
  -- Nulle quand l'attelage court toujours.
  fin         date,
  -- Vrai quand l'attelage vaut jusqu'à nouvel ordre : les cinq attelages de
  -- référence du parc lourd le sont. Faux pour un prêt le temps d'une panne.
  permanent   boolean not null default false,
  motif       text,
  cree_le     timestamptz not null default now(),
  cree_par    uuid references auth.users (id),
  modifie_le  timestamptz,
  modifie_par uuid references auth.users (id),
  -- Un véhicule ne se remorque pas lui-même.
  constraint attelage_deux_vehicules check (tracteur_id <> remorque_id),
  -- Une fin antérieure au début n'est pas une période.
  constraint attelage_periode check (fin is null or fin >= debut)
);

-- Un tracteur tire une remorque à la fois, une remorque est tirée par un
-- tracteur à la fois. Deux index partiels plutôt qu'une contrainte d'exclusion
-- sur la période : ce qu'on veut interdire est l'attelage **en cours** en
-- double, et les attelages clos d'un même couple sont, eux, parfaitement
-- normaux — c'est l'historique.
create unique index attelage_tracteur_courant on attelage (tracteur_id) where fin is null;
create unique index attelage_remorque_courante on attelage (remorque_id) where fin is null;
create index on attelage (remorque_id);
create index on attelage (debut);

create trigger attelage_horodatage before update on attelage for each row execute function marquer_modification();

alter table attelage enable row level security;
create policy lecture_attelage  on attelage for select using (mon_role() is not null);
create policy ecriture_attelage on attelage for all using (peut_ecrire_parc()) with check (peut_ecrire_parc());

-- ---------------------------------------------------------------------------
-- La liste Flotte les lit avec le reste
-- ---------------------------------------------------------------------------
--
-- `lire_parc()` (0009) rend en un JSON tout ce que la liste affiche : la
-- rejouer avec les attelages évite un aller-retour de plus depuis Dakar, où
-- chacun coûte une demi-seconde. Seuls les attelages **en cours** y entrent :
-- la liste répond à « qu'est-ce qui roule attelé aujourd'hui ? », l'historique
-- appartient à la fiche.
--
-- La fonction est redéfinie en entier — c'est la seule façon de la faire en
-- SQL — mais rien d'autre ne change : la clé `attelages` s'ajoute aux
-- quatorze existantes, et un lecteur qui l'ignore continue de marcher.

create or replace function lire_parc(depuis date)
returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'vehicules', (select coalesce(jsonb_agg(to_jsonb(v) order by v.immatriculation), '[]'::jsonb) from vehicule v),
    'sites', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'libelle', s.libelle, 'region', s.region, 'type', s.type)), '[]'::jsonb) from site s),
    'chauffeurs', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nom', c.nom, 'prenom', c.prenom)), '[]'::jsonb) from chauffeur c),
    'affectations', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', a.vehicule_id, 'chauffeur_id', a.chauffeur_id, 'role', a.role, 'debut', a.debut, 'fin', a.fin)), '[]'::jsonb) from affectation a),
    'documents', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', d.vehicule_id, 'type_document_id', d.type_document_id, 'date_effet', d.date_effet, 'echeance', d.echeance)), '[]'::jsonb) from document d where d.vehicule_id is not null),
    'licences', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'perimetre', l.perimetre, 'echeance', l.echeance)), '[]'::jsonb) from licence_transport l),
    'licences_vehicules', (select coalesce(jsonb_agg(jsonb_build_object('licence_id', lv.licence_id, 'vehicule_id', lv.vehicule_id)), '[]'::jsonb) from licence_vehicule lv),
    'releves', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', r.vehicule_id, 'date', r.date, 'km', r.km)), '[]'::jsonb) from releve_kilometrique r where r.motif_rejet is null and r.date >= depuis),
    'depenses', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', x.vehicule_id, 'date', x.date, 'montant', x.montant, 'km', x.km, 'km_motif_rejet', x.km_motif_rejet)), '[]'::jsonb) from depense x where x.date >= depuis),
    'pleins', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', p.vehicule_id, 'date', p.date, 'km', p.km)), '[]'::jsonb) from plein p where p.date >= depuis),
    'interventions', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', i.vehicule_id, 'numero', i.numero, 'date', i.date, 'objet', i.objet, 'km', i.km)), '[]'::jsonb) from intervention i),
    'attributions', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', t.vehicule_id, 'attributaire_id', t.attributaire_id, 'pool', t.pool, 'plan_car', t.plan_car, 'fin', t.fin)), '[]'::jsonb) from attribution_legere t where t.fin is null),
    'attributaires', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'nom', b.nom, 'fonction', b.fonction)), '[]'::jsonb) from attributaire b),
    'a_recevoir', (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'lot', w.lot, 'marque', w.marque, 'modele', w.modele, 'categorie', w.categorie, 'regime', w.regime, 'attributaire_id', w.attributaire_id, 'pool', w.pool, 'business_unit', w.business_unit, 'commentaire', w.commentaire, 'recu_le', w.recu_le)), '[]'::jsonb) from vehicule_a_recevoir w where w.recu_le is null),
    'attelages', (select coalesce(jsonb_agg(jsonb_build_object('tracteur_id', e.tracteur_id, 'remorque_id', e.remorque_id)), '[]'::jsonb) from attelage e where e.fin is null)
  )
$$;

comment on function lire_parc(date) is 'Tout ce que la liste Flotte lit, en un JSON : véhicules, sites, chauffeurs, affectations, documents, licences, faits depuis la date, parc léger, attelages en cours.';

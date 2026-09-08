-- ============================================================================
-- SEDIMA Parc — 0023 : les visites techniques et leurs observations.
--
-- La visite technique (numéro VTE) est un processus : un rendez-vous au
-- centre agréé, un passage, un résultat — acceptée, refusée, annulée — et,
-- après un refus, un délai pour la contre-visite. Le centre relève des
-- observations (numéro OBS) : un défaut, sa catégorie, sa gravité, et leur
-- suivi jusqu'à la correction, par l'intervention qui la fait. Le document
-- « visite technique » de la fiche n'est renouvelé qu'à l'acceptation.
--
-- Jusqu'ici ces deux objets vivaient dans le jeu de démonstration et le
-- navigateur ; la fiche véhicule (lire_fiche), le travail à faire de la
-- Maintenance et la Conformité les lisent désormais ici.
--
-- Qui fait quoi : lire si l'on voit le véhicule ; prendre rendez-vous et
-- enregistrer le résultat avec la saisie des documents (Conformité) ;
-- relever et suivre une observation avec celle des documents ou de la
-- maintenance.
-- ============================================================================

create table if not exists visite_technique (
  id                        uuid primary key default gen_random_uuid(),
  numero                    text not null unique,
  vehicule_id               uuid not null references vehicule (id) on delete cascade,
  type                      text not null default 'visite' check (type in ('visite', 'contre-visite')),
  centre                    text not null,
  date_rendez_vous          date not null,
  heure                     text,
  date_passage              date,
  statut                    text not null default 'rendez-vous' check (statut in ('rendez-vous', 'acceptee', 'refusee', 'annulee')),
  numero_pv                 text,
  date_limite_contre_visite date,
  commentaire               text,
  cree_le                   timestamptz not null default now(),
  cree_par                  uuid references auth.users (id),
  modifie_le                timestamptz,
  modifie_par               uuid references auth.users (id)
);
create index on visite_technique (vehicule_id, date_rendez_vous);
create index on visite_technique (statut) where statut in ('rendez-vous', 'refusee');
comment on table visite_technique is 'Une visite technique : rendez-vous au centre agréé, passage, résultat, et délai de contre-visite après un refus.';

create table if not exists observation_visite (
  id                  uuid primary key default gen_random_uuid(),
  numero              text not null unique,
  -- La visite qui l'a produite, par son numéro : c'est ainsi que l'application la cite.
  visite_numero       text not null references visite_technique (numero) on delete cascade,
  vehicule_id         uuid not null references vehicule (id) on delete cascade,
  libelle             text not null,
  categorie           text not null default 'autre' check (categorie in ('freinage', 'direction', 'eclairage', 'pneumatiques', 'pollution', 'carrosserie', 'vitrage', 'attelage', 'equipements', 'autre')),
  gravite             text not null default 'mineure' check (gravite in ('majeure', 'mineure')),
  statut              text not null default 'a-traiter' check (statut in ('a-traiter', 'en-cours', 'corrigee')),
  intervention_numero text,
  corrigee_le         date,
  commentaire         text,
  cree_le             timestamptz not null default now(),
  cree_par            uuid references auth.users (id),
  modifie_le          timestamptz,
  modifie_par         uuid references auth.users (id)
);
create index on observation_visite (vehicule_id);
create index on observation_visite (visite_numero);
create index on observation_visite (statut) where statut <> 'corrigee';
comment on table observation_visite is 'Un défaut relevé par le centre à une visite technique, suivi jusqu''à sa correction.';

alter table visite_technique enable row level security;
alter table observation_visite enable row level security;

create policy lecture_visite on visite_technique for select using (vehicule_id in (select id from vehicule));
create policy ecriture_visite on visite_technique for all using ((select peut('documents', 'saisie'))) with check ((select peut('documents', 'saisie')));

create policy lecture_observation on observation_visite for select using (vehicule_id in (select id from vehicule));
create policy ecriture_observation on observation_visite for all
  using ((select peut('documents', 'saisie')) or (select peut('maintenance', 'saisie')))
  with check ((select peut('documents', 'saisie')) or (select peut('maintenance', 'saisie')));

-- ---------------------------------------------------------------------------
-- La fiche véhicule rend ses visites et ses observations. Même texte qu'en
-- 0013 pour le reste.
-- ---------------------------------------------------------------------------

create or replace function lire_fiche(immat text)
returns jsonb
language sql stable
set search_path = public
as $$
  select case when v.id is null then null else jsonb_build_object(
    'vehicule', to_jsonb(v),
    'site', (select jsonb_build_object('id', s.id, 'code', s.code, 'libelle', s.libelle, 'region', s.region, 'type', s.type) from site s where s.id = v.site_id),
    'documents', (select coalesce(jsonb_agg(jsonb_build_object('numero', d.numero, 'type_document_id', d.type_document_id, 'date_effet', d.date_effet, 'echeance', d.echeance, 'emetteur', d.emetteur, 'numero_piece', d.numero_piece, 'montant', d.montant, 'justificatif', d.justificatif) order by d.date_effet desc nulls last), '[]'::jsonb) from document d where d.vehicule_id = v.id),
    'licences', (select coalesce(jsonb_agg(jsonb_build_object('numero', l.numero, 'libelle', l.libelle, 'numero_piece', l.numero_piece, 'emetteur', l.emetteur, 'perimetre', l.perimetre, 'date_effet', l.date_effet, 'echeance', l.echeance, 'vehicules', (select count(*) from licence_vehicule x where x.licence_id = l.id)) order by l.echeance), '[]'::jsonb)
                   from licence_transport l where l.perimetre = 'flotte' or exists (select 1 from licence_vehicule lv where lv.licence_id = l.id and lv.vehicule_id = v.id)),
    'affectations', (select coalesce(jsonb_agg(jsonb_build_object('numero', a.numero, 'chauffeur_id', a.chauffeur_id, 'chauffeur', c.prenom || ' ' || c.nom, 'role', a.role, 'debut', a.debut, 'fin', a.fin, 'motif', a.motif) order by a.debut desc), '[]'::jsonb)
                      from affectation a join chauffeur c on c.id = a.chauffeur_id where a.vehicule_id = v.id),
    'releves', (select coalesce(jsonb_agg(jsonb_build_object('numero', r.numero, 'date', r.date, 'km', r.km, 'origine', r.origine, 'motif_rejet', r.motif_rejet) order by r.date desc, r.km desc), '[]'::jsonb) from releve_kilometrique r where r.vehicule_id = v.id),
    'pleins', (select coalesce(jsonb_agg(jsonb_build_object('numero', p.numero, 'date', p.date, 'litres', p.litres, 'prix_litre', p.prix_litre, 'montant', p.montant, 'km', p.km, 'source', p.source, 'reference', p.reference, 'prestataire', (select pr.raison_sociale from prestataire pr where pr.id = p.prestataire_id)) order by p.date desc), '[]'::jsonb) from plein p where p.vehicule_id = v.id),
    'depenses', (select coalesce(jsonb_agg(jsonb_build_object('numero', x.numero, 'date', x.date, 'poste', x.poste, 'libelle', x.libelle, 'montant', x.montant, 'beneficiaire', coalesce(x.beneficiaire, (select pr.raison_sociale from prestataire pr where pr.id = x.prestataire_id)), 'reference', x.reference, 'origine', x.origine, 'justificatif', x.justificatif, 'km', x.km, 'km_motif_rejet', x.km_motif_rejet) order by x.date desc), '[]'::jsonb) from depense x where x.vehicule_id = v.id),
    'interventions', (select coalesce(jsonb_agg(jsonb_build_object('numero', i.numero, 'date', i.date, 'type', i.type, 'objet', i.objet, 'garage', (select pr.raison_sociale from prestataire pr where pr.id = i.prestataire_id), 'montant', i.montant, 'immobilisation_jours', i.immobilisation_jours, 'km', i.km, 'reference', i.reference) order by i.date desc), '[]'::jsonb) from intervention i where i.vehicule_id = v.id),
    'incidents', (select coalesce(jsonb_agg(jsonb_build_object('numero', n.numero, 'date_heure', n.date_heure, 'nature', n.nature, 'type', n.type, 'lieu', n.lieu, 'statut', n.statut, 'immobilisation_jours', n.immobilisation_jours, 'chauffeur', (select c.prenom || ' ' || c.nom from chauffeur c where c.id = n.chauffeur_id)) order by n.date_heure desc), '[]'::jsonb) from incident n where n.vehicule_id = v.id),
    'visites', (select coalesce(jsonb_agg(jsonb_build_object('numero', t.numero, 'type', t.type, 'centre', t.centre, 'date_rendez_vous', t.date_rendez_vous, 'heure', t.heure, 'date_passage', t.date_passage, 'statut', t.statut, 'numero_pv', t.numero_pv, 'date_limite_contre_visite', t.date_limite_contre_visite, 'commentaire', t.commentaire) order by t.date_rendez_vous desc), '[]'::jsonb) from visite_technique t where t.vehicule_id = v.id),
    'observations', (select coalesce(jsonb_agg(jsonb_build_object('numero', o.numero, 'visite_numero', o.visite_numero, 'libelle', o.libelle, 'categorie', o.categorie, 'gravite', o.gravite, 'statut', o.statut, 'intervention_numero', o.intervention_numero, 'corrigee_le', o.corrigee_le, 'commentaire', o.commentaire) order by o.numero), '[]'::jsonb) from observation_visite o where o.vehicule_id = v.id),
    'statuts', (select coalesce(jsonb_agg(jsonb_build_object('le', m.cree_le, 'avant', m.avant, 'apres', m.apres, 'motif', m.motif) order by m.cree_le), '[]'::jsonb)
                 from modification m where m.table_cible = 'vehicule' and m.numero = v.immatriculation and m.champ = 'statut' and m.statut = 'appliquee')
  ) end
  from (select * from vehicule where immatriculation = upper(regexp_replace(immat, '[^A-Za-z0-9]', '', 'g')) limit 1) v
$$;

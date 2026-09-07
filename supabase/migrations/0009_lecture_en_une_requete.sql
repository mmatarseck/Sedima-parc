-- ============================================================================
-- SEDIMA Parc — 0009 : le parc et les chauffeurs se lisent en une requête.
--
-- Revue de performance du 8 septembre 2026 : la liste Flotte faisait
-- quatorze requêtes, les chauffeurs neuf, les grandes tables par pages
-- successives, à 0,5 s l'aller-retour depuis Dakar. Ces deux fonctions
-- rendent en un seul JSON ce que l'application recomposait — les mêmes
-- colonnes, sous les mêmes noms : le code de dérivation ne change pas, il
-- lit un objet au lieu de quatorze tables.
--
-- Elles s'exécutent avec les droits de l'appelant (security invoker) : les
-- politiques — niveaux et périmètre — s'appliquent comme avant.
-- ============================================================================

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
    'a_recevoir', (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'lot', w.lot, 'marque', w.marque, 'modele', w.modele, 'categorie', w.categorie, 'regime', w.regime, 'attributaire_id', w.attributaire_id, 'pool', w.pool, 'business_unit', w.business_unit, 'commentaire', w.commentaire, 'recu_le', w.recu_le)), '[]'::jsonb) from vehicule_a_recevoir w where w.recu_le is null)
  )
$$;

comment on function lire_parc(date) is 'Tout ce que la liste Flotte lit, en un JSON : véhicules, sites, chauffeurs, affectations, documents, licences, faits depuis la date, parc léger.';

create or replace function lire_chauffeurs(depuis date)
returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'chauffeurs', (select coalesce(jsonb_agg(to_jsonb(c) order by c.nom, c.prenom), '[]'::jsonb) from chauffeur c),
    'sites', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'libelle', s.libelle, 'region', s.region, 'type', s.type)), '[]'::jsonb) from site s),
    'vehicules', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'immatriculation', v.immatriculation, 'marque', v.marque, 'appellation', v.appellation)), '[]'::jsonb) from vehicule v),
    'affectations', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', a.vehicule_id, 'chauffeur_id', a.chauffeur_id, 'role', a.role, 'debut', a.debut, 'fin', a.fin)), '[]'::jsonb) from affectation a),
    'indisponibilites', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'numero', n.numero, 'chauffeur_id', n.chauffeur_id, 'motif', n.motif, 'debut', n.debut, 'fin', n.fin, 'commentaire', n.commentaire)), '[]'::jsonb) from indisponibilite n),
    'documents', (select coalesce(jsonb_agg(jsonb_build_object('chauffeur_id', d.chauffeur_id, 'type_document_id', d.type_document_id, 'echeance', d.echeance)), '[]'::jsonb) from document d where d.chauffeur_id is not null),
    'incidents', (select coalesce(jsonb_agg(jsonb_build_object('chauffeur_id', i.chauffeur_id, 'date_heure', i.date_heure)), '[]'::jsonb) from incident i where i.date_heure >= depuis::timestamptz),
    'releves', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', r.vehicule_id, 'date', r.date, 'km', r.km)), '[]'::jsonb) from releve_kilometrique r where r.motif_rejet is null),
    'depenses', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', x.vehicule_id, 'date', x.date, 'poste', x.poste, 'km', x.km, 'km_motif_rejet', x.km_motif_rejet)), '[]'::jsonb) from depense x where x.date >= depuis)
  )
$$;

comment on function lire_chauffeurs(date) is 'Tout ce que la liste Chauffeurs lit, en un JSON.';

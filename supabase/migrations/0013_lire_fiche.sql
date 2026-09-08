-- ============================================================================
-- SEDIMA Parc — 0013 : la fiche véhicule se lit en une requête.
--
-- Dans la lignée de lire_parc() (0009) : tout ce que la fiche 360° d'un
-- véhicule lit — son identité, ses documents, ses affectations, ses relevés,
-- ses pleins, ses dépenses, ses interventions, ses incidents, les licences
-- qui le couvrent, et la trace de ses changements de statut — en un JSON,
-- sous les noms des colonnes. L'application en fait une fiche avec les
-- calculs du domaine (échéances, immobilisation, consommation, coûts, plan
-- d'entretien), les mêmes qu'en démonstration.
--
-- Elle s'exécute avec les droits de l'appelant : hors périmètre, le
-- véhicule est introuvable, et la fonction rend null.
-- ============================================================================

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
    'statuts', (select coalesce(jsonb_agg(jsonb_build_object('le', m.cree_le, 'avant', m.avant, 'apres', m.apres, 'motif', m.motif) order by m.cree_le), '[]'::jsonb)
                 from modification m where m.table_cible = 'vehicule' and m.numero = v.immatriculation and m.champ = 'statut' and m.statut = 'appliquee')
  ) end
  from (select * from vehicule where immatriculation = upper(regexp_replace(immat, '[^A-Za-z0-9]', '', 'g')) limit 1) v
$$;

comment on function lire_fiche(text) is 'Tout ce que la fiche 360° d''un véhicule lit, en un JSON : identité, documents, licences, affectations, relevés, pleins, dépenses, interventions, incidents, trace des statuts.';

-- ============================================================================
-- SEDIMA Parc — 0015 : la fiche chauffeur se lit en une requête.
--
-- Dans la lignée de lire_fiche() (0013) : tout ce que la fiche d'un chauffeur
-- lit — son identité, ses documents, ses affectations avec le véhicule, ses
-- indisponibilités, ses sanctions (si la politique les montre), ses
-- incidents, et ce que sa conduite a produit : les pleins, les
-- contraventions, les frais de route et les relevés des véhicules qu'il
-- conduisait — en un JSON.
--
-- La règle d'attribution, décidée par le métier le 3 septembre 2026 : tout
-- au titulaire ; le suppléant ne reçoit que les jours où le titulaire est
-- indisponible. Un jour donné n'a qu'un conducteur : conducteur_du_jour().
--
-- L'adresse de la fiche porte un identifiant lisible (« moustapha-diaw ») ;
-- la fonction retrouve le chauffeur par son UUID, ou par ce nom aplati.
-- ============================================================================

-- « Moustapha Diaw » → « moustapha-diaw », comme l'application forme ses adresses.
create or replace function slug_chauffeur(prenom text, nom text) returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(
    lower(translate(coalesce(prenom, '') || ' ' || coalesce(nom, ''),
      'àâäáãåéèêëíìîïóòôöõúùûüçñýÿÀÂÄÁÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑÝ',
      'aaaaaaeeeeiiiiooooouuuucnyyaaaaaaeeeeiiiiooooouuuucny')),
    '[^a-z0-9]+', '-', 'g'))
$$;

-- Qui conduisait ce véhicule ce jour-là : le titulaire, sauf s'il est
-- indisponible et qu'un suppléant est désigné ; alors le suppléant.
create or replace function conducteur_du_jour(v uuid, jour date) returns uuid
language sql stable as $$
  with titulaire as (
    select a.chauffeur_id from affectation a
     where a.vehicule_id = v and a.role = 'titulaire' and a.debut <= jour and (a.fin is null or a.fin >= jour)
     order by a.debut desc limit 1
  ),
  suppleant as (
    select a.chauffeur_id from affectation a
     where a.vehicule_id = v and a.role = 'suppleant' and a.debut <= jour and (a.fin is null or a.fin >= jour)
     order by a.debut desc limit 1
  ),
  titulaire_indisponible as (
    select exists (select 1 from indisponibilite i, titulaire t
                    where i.chauffeur_id = t.chauffeur_id and i.debut <= jour and (i.fin is null or i.fin >= jour)) as oui
  )
  select case
    when (select chauffeur_id from titulaire) is not null and not (select oui from titulaire_indisponible) then (select chauffeur_id from titulaire)
    when (select chauffeur_id from suppleant) is not null then (select chauffeur_id from suppleant)
    else (select chauffeur_id from titulaire)
  end
$$;

create or replace function lire_fiche_chauffeur(identifiant text, uuid_devine uuid default null)
returns jsonb
language sql stable
set search_path = public
as $$
  select case when c.id is null then null else jsonb_build_object(
    'chauffeur', to_jsonb(c),
    'site', (select jsonb_build_object('id', s.id, 'code', s.code, 'libelle', s.libelle, 'region', s.region, 'type', s.type) from site s where s.id = c.site_id),
    'documents', (select coalesce(jsonb_agg(jsonb_build_object('numero', d.numero, 'type_document_id', d.type_document_id, 'date_effet', d.date_effet, 'echeance', d.echeance, 'emetteur', d.emetteur, 'numero_piece', d.numero_piece, 'montant', d.montant, 'justificatif', d.justificatif) order by d.date_effet desc nulls last), '[]'::jsonb) from document d where d.chauffeur_id = c.id),
    'affectations', (select coalesce(jsonb_agg(jsonb_build_object('numero', a.numero, 'role', a.role, 'debut', a.debut, 'fin', a.fin, 'motif', a.motif,
                        'vehicule', jsonb_build_object('id', v.id, 'immatriculation', v.immatriculation, 'marque', v.marque, 'appellation', v.appellation, 'categorie', v.categorie, 'business_unit', v.business_unit, 'site', (select s.libelle from site s where s.id = v.site_id))) order by a.debut desc), '[]'::jsonb)
                      from affectation a join vehicule v on v.id = a.vehicule_id where a.chauffeur_id = c.id),
    'indisponibilites', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'numero', n.numero, 'motif', n.motif, 'debut', n.debut, 'fin', n.fin, 'commentaire', n.commentaire) order by n.debut desc), '[]'::jsonb) from indisponibilite n where n.chauffeur_id = c.id),
    'sanctions', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'numero', x.numero, 'date', x.date, 'type', x.type, 'motif', x.motif, 'jours', x.jours, 'incident_numero', (select i.numero from incident i where i.id = x.incident_id), 'depense_numero', (select d.numero from depense d where d.id = x.depense_id)) order by x.date desc), '[]'::jsonb) from sanction x where x.chauffeur_id = c.id),
    'incidents', (select coalesce(jsonb_agg(jsonb_build_object('numero', i.numero, 'nature', i.nature, 'type', i.type, 'date_heure', i.date_heure, 'lieu', i.lieu, 'mission', i.mission, 'responsabilite', i.responsabilite, 'statut', i.statut, 'blesses', i.blesses, 'sinistre_ouvert', i.sinistre_ouvert, 'immobilisation_jours', i.immobilisation_jours, 'kilometrage', i.kilometrage, 'description', i.description,
                     'vehicule', jsonb_build_object('id', v.id, 'immatriculation', v.immatriculation, 'marque', v.marque, 'appellation', v.appellation, 'site_id', v.site_id)) order by i.date_heure desc), '[]'::jsonb)
                   from incident i join vehicule v on v.id = i.vehicule_id where i.chauffeur_id = c.id),
    -- Ce que sa conduite a produit : sur les véhicules qu'il a tenus, les jours où il conduisait.
    'pleins', (select coalesce(jsonb_agg(jsonb_build_object('numero', p.numero, 'vehicule_id', p.vehicule_id, 'date', p.date, 'litres', p.litres, 'montant', p.montant, 'km', p.km) order by p.date desc), '[]'::jsonb)
                from plein p where p.vehicule_id in (select a.vehicule_id from affectation a where a.chauffeur_id = c.id)
                  and (p.chauffeur_id = c.id or (p.chauffeur_id is null and conducteur_du_jour(p.vehicule_id, p.date) = c.id))),
    'depenses', (select coalesce(jsonb_agg(jsonb_build_object('numero', x.numero, 'vehicule_id', x.vehicule_id, 'date', x.date, 'poste', x.poste, 'libelle', x.libelle, 'montant', x.montant, 'reference', x.reference, 'justificatif', x.justificatif) order by x.date desc), '[]'::jsonb)
                  from depense x where x.poste in ('contravention', 'frais-de-route')
                    and (x.chauffeur_id = c.id or (x.chauffeur_id is null and x.vehicule_id is not null and conducteur_du_jour(x.vehicule_id, x.date) = c.id))),
    'releves', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', r.vehicule_id, 'date', r.date, 'km', r.km, 'origine', r.origine, 'valide', r.motif_rejet is null, 'attribue', conducteur_du_jour(r.vehicule_id, r.date) = c.id) order by r.date), '[]'::jsonb)
                 from releve_kilometrique r where r.vehicule_id in (select a.vehicule_id from affectation a where a.chauffeur_id = c.id))
  ) end
  from (select * from chauffeur ch where ch.id = uuid_devine or slug_chauffeur(ch.prenom, ch.nom) = identifiant limit 1) c
$$;

comment on function lire_fiche_chauffeur(text, uuid) is 'Tout ce que la fiche d''un chauffeur lit, en un JSON : identité, documents, affectations, indisponibilités, sanctions, incidents, et ce que sa conduite a produit.';

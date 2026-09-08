-- ============================================================================
-- SEDIMA Parc — 0024 : ce que le tableau de bord lit, en une requête.
--
-- Les courbes du tableau de bord se calculent à la maille véhicule × mois sur
-- deux ans, plus une semaine glissante et la situation du jour. Dans la
-- lignée de lire_parc() (0009) : la fonction rend les faits bruts de la
-- fenêtre — chaque table lue une fois, sous les noms des colonnes — et
-- l'application les agrège avec les mêmes règles du domaine qu'en
-- démonstration (coût d'un affrètement facturé retenue comprise, mise à
-- disposition au prorata du mois en cours, tonnes au relevé de transport,
-- immobilisation administrative, groupe des postes de dépense).
--
-- Les tables de transport (0002) se lisent avec le seul profil ; le reste
-- suit le périmètre des véhicules, comme partout.
-- ============================================================================

create or replace function lire_tableau(depuis date)
returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'vehicules', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', v.id, 'immatriculation', v.immatriculation, 'marque', v.marque, 'appellation', v.appellation,
        'categorie', v.categorie, 'categorie_flotte', v.categorie_flotte, 'business_unit', v.business_unit,
        'site', (select s.libelle from site s where s.id = v.site_id),
        'engage', v.engage, 'transport_special', v.transport_special, 'statut', v.statut, 'regime', v.regime)), '[]'::jsonb)
      from vehicule v),
    'releves', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', r.vehicule_id, 'date', r.date, 'km', r.km)), '[]'::jsonb)
      from releve_kilometrique r where r.motif_rejet is null and r.date >= depuis - 31),
    'pleins', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', p.vehicule_id, 'date', p.date, 'litres', p.litres, 'montant', p.montant, 'km', p.km)), '[]'::jsonb)
      from plein p where p.date >= depuis - 31),
    'depenses', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', x.vehicule_id, 'date', x.date, 'poste', x.poste, 'montant', x.montant)), '[]'::jsonb)
      from depense x where x.vehicule_id is not null and x.date >= depuis),
    'interventions', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', i.vehicule_id, 'date', i.date, 'type', i.type, 'immobilisation_jours', i.immobilisation_jours)), '[]'::jsonb)
      from intervention i where i.date >= depuis - 90),
    'incidents', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', n.vehicule_id, 'date_heure', n.date_heure, 'nature', n.nature, 'type', n.type, 'mission', n.mission, 'blesses', n.blesses)), '[]'::jsonb)
      from incident n where n.date_heure >= depuis),
    'documents', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', d.vehicule_id, 'numero', d.numero, 'type_document_id', d.type_document_id, 'date_effet', d.date_effet, 'echeance', d.echeance)), '[]'::jsonb)
      from document d where d.vehicule_id is not null),
    'statuts', (select coalesce(jsonb_agg(jsonb_build_object('immatriculation', m.numero, 'avant', m.avant, 'apres', m.apres, 'le', m.cree_le) order by m.cree_le), '[]'::jsonb)
      from modification m where m.table_cible = 'vehicule' and m.champ = 'statut' and m.statut = 'appliquee'),
    'chauffeurs', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'date_embauche', c.date_embauche, 'date_sortie', c.date_sortie)), '[]'::jsonb) from chauffeur c),
    'indisponibilites', (select coalesce(jsonb_agg(jsonb_build_object('chauffeur_id', n.chauffeur_id, 'debut', n.debut, 'fin', n.fin)), '[]'::jsonb)
      from indisponibilite n where n.fin is null or n.fin >= depuis),
    'affretements', (select coalesce(jsonb_agg(jsonb_build_object('date', a.date, 'statut', a.statut, 'montant_convenu', a.montant_convenu, 'montant_facture', a.montant_facture, 'tonnage_prevu', a.tonnage_prevu, 'tonnage_livre', a.tonnage_livre)), '[]'::jsonb)
      from affretement a where a.date >= depuis),
    'mises_a_disposition', (select coalesce(jsonb_agg(jsonb_build_object('mois', m.mois, 'statut', m.statut, 'jours_calendaires', m.jours_calendaires, 'jours_panne', m.jours_panne, 'prix_jour', m.prix_jour, 'convention', m.convention, 'montant_facture', m.montant_facture, 'carburant_montant', m.carburant_montant, 'tonnes_transportees', m.tonnes_transportees)), '[]'::jsonb)
      from mise_a_disposition m where m.mois >= to_char(depuis, 'YYYY-MM')),
    'prestations', (select coalesce(jsonb_agg(jsonb_build_object('date', p.date, 'statut', p.statut, 'quantite', p.quantite, 'prix_unitaire', p.prix_unitaire, 'convention', p.convention, 'montant_facture', p.montant_facture)), '[]'::jsonb)
      from prestation p where p.date >= depuis),
    'releves_transport', (select coalesce(jsonb_agg(jsonb_build_object('date', t.date, 'mode', t.mode, 'produit', t.produit, 'tonnage', t.tonnage, 'tonnage_pese', t.tonnage_pese)), '[]'::jsonb)
      from releve_transport t where t.date >= depuis)
  )
$$;

comment on function lire_tableau(date) is 'Les faits bruts du tableau de bord depuis une date : véhicules, relevés, pleins, dépenses, interventions, incidents, documents, trace des statuts, chauffeurs et indisponibilités, transport tiers et relevé de transport.';

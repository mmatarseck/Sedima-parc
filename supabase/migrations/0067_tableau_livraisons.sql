-- ============================================================================
-- 0067 — Le tableau de bord lit les bons de livraison (audit du 23 septembre 2026).
--
-- La table `livraison` (0044) porte 16 771 bons de Sage X3, de novembre 2025 à
-- août 2026, chacun avec son camion et son poids. Le tableau de bord ne la
-- lisait pas : ses coûts à la tonne et son taux d'externalisation
-- s'appuyaient sur le seul relevé de transport de l'UAB (aliment, depuis le
-- 15 juin 2026), alors que les charges rapportées sont celles de tout le parc.
--
-- `lire_tableau` gagne deux clés, agrégées pour rester légères :
--
--   * `livraisons` — tonnes et bons par véhicule, mois et mode (parc,
--     transporteur, client, inconnu) ;
--   * `livraisons_jours` — le nombre de jours de chaque mois qui portent au
--     moins un bon : c'est la couverture, qui dit si un mois est complet.
--
-- Le reste de la fonction est celle de 0039, à l'identique. L'application lit
-- les nouvelles clés si elles sont là ; sans cette migration, le tableau de
-- bord reste au relevé de transport. Rejouable.
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
    'affretements', (select coalesce(jsonb_agg(jsonb_build_object('date', a.date, 'statut', a.statut, 'montant_convenu', a.montant_convenu, 'montant_facture', a.montant_facture, 'tonnage_prevu', a.tonnage_prevu, 'tonnage_livre', a.tonnage_livre, 'regime', coalesce(pt.regime_fiscal::text, 'a-confirmer'))), '[]'::jsonb)
      from affretement a left join profil_transporteur pt on pt.prestataire_id = a.prestataire_id where a.date >= depuis),
    'mises_a_disposition', (select coalesce(jsonb_agg(jsonb_build_object('mois', m.mois, 'statut', m.statut, 'jours_calendaires', m.jours_calendaires, 'jours_panne', m.jours_panne, 'prix_jour', m.prix_jour, 'convention', m.convention, 'montant_facture', m.montant_facture, 'carburant_montant', m.carburant_montant, 'tonnes_transportees', m.tonnes_transportees, 'regime', coalesce(pt.regime_fiscal::text, 'a-confirmer'))), '[]'::jsonb)
      from mise_a_disposition m left join profil_transporteur pt on pt.prestataire_id = m.prestataire_id where m.mois >= to_char(depuis, 'YYYY-MM')),
    'prestations', (select coalesce(jsonb_agg(jsonb_build_object('date', p.date, 'statut', p.statut, 'quantite', p.quantite, 'prix_unitaire', p.prix_unitaire, 'convention', p.convention, 'montant_facture', p.montant_facture, 'regime', coalesce(pt.regime_fiscal::text, 'a-confirmer'))), '[]'::jsonb)
      from prestation p left join profil_transporteur pt on pt.prestataire_id = p.prestataire_id where p.date >= depuis),
    'releves_transport', (select coalesce(jsonb_agg(jsonb_build_object('date', t.date, 'mode', t.mode, 'produit', t.produit, 'tonnage', t.tonnage, 'tonnage_pese', t.tonnage_pese)), '[]'::jsonb)
      from releve_transport t where t.date >= depuis),
    'livraisons', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', l.vehicule_id, 'mois', l.mois, 'mode', l.mode, 'tonnes', l.tonnes, 'bons', l.bons)), '[]'::jsonb)
      from (select vehicule_id, to_char(date, 'YYYY-MM') as mois, mode, round(sum(coalesce(poids_kg, 0)) / 1000.0, 1) as tonnes, count(*) as bons
              from livraison where date >= depuis group by 1, 2, 3) l),
    'livraisons_jours', (select coalesce(jsonb_agg(jsonb_build_object('mois', d.mois, 'jours', d.jours)), '[]'::jsonb)
      from (select to_char(date, 'YYYY-MM') as mois, count(distinct date) as jours from livraison where date >= depuis group by 1) d)
  )
$$;

comment on function lire_tableau(date) is 'Les faits bruts du tableau de bord depuis une date : véhicules, relevés, pleins, dépenses, interventions, incidents, documents, trace des statuts, chauffeurs et indisponibilités, transport tiers, relevé de transport et bons de livraison agrégés (0067).';

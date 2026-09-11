-- ============================================================================
-- SEDIMA Parc — 0039 : le régime fiscal des transporteurs, dit clairement.
--
-- Demande du métier (11 septembre 2026) : « ajuster l'app en rendant clair la
-- TVA de 18 % ou le BRS de 5 %, ce qui nous permettra de voir les charges HT ou
-- TTC ».
--
-- Jusqu'ici, le module Transporteurs ne connaissait que la retenue à la source
-- (BRS, 5 %). Or le CA provisoire d'août 2026 montre qu'A. Dieng, Sokhna Diop et
-- ADEX facturent **hors taxe plus 18 % de TVA**, sans retenue. Les deux régimes
-- ne se lisent pas de la même façon :
--
--   * TVA 18 % : la charge vraie est le hors-taxe, la TVA se récupère ; le TTC
--     est ce qui sort de la trésorerie ;
--   * BRS 5 % : pas de TVA ; SEDIMA retient 5 % de la facture et les reverse au
--     Trésor. Hors taxe et TTC se confondent, le transporteur touche 95 %.
--
-- Le régime est une propriété du transporteur : il vit sur son profil. Il est
-- posé là où une pièce le prouve — le CA provisoire pour la TVA ; les factures
-- et les demandes d'achat 2026 pour la retenue (Dème, Mouhamed Sy, Dame Ndoye,
-- Aïssata Gaye). Tous les autres restent « à confirmer ».
--
-- Les deux lectures du module rendent désormais le régime : `lire_transporteurs`
-- sur le profil, `lire_tableau` sur chaque mission, pour que le tableau de bord
-- lise les coûts hors taxe ou TTC.
--
-- Au passage, le **motif d'affrètement devient facultatif**. Une mission reprise
-- d'un document qui ne le dit pas — le CA provisoire ne dit pas pourquoi le parc
-- a confié la tonne — porterait sinon un motif inventé.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'regime_fiscal') then
    create type regime_fiscal as enum ('tva', 'brs', 'a-confirmer');
  end if;
end
$$;

alter table profil_transporteur add column if not exists regime_fiscal regime_fiscal not null default 'a-confirmer';
comment on column profil_transporteur.regime_fiscal is 'TVA 18 % ajoutée à la facture, retenue à la source de 5 % prélevée dessus, ou à confirmer.';

-- La TVA : le CA provisoire d'août 2026 l'ajoute à 18 % pour ces trois-là.
update profil_transporteur set regime_fiscal = 'tva'
 where regime_fiscal = 'a-confirmer'
   and prestataire_id in (select id from prestataire where numero in ('PRE-2026-00022', 'PRE-2026-00023', 'PRE-2026-00033'));

-- La retenue : relevée sur leurs factures et leurs demandes d'achat 2026.
update profil_transporteur set regime_fiscal = 'brs'
 where regime_fiscal = 'a-confirmer'
   and prestataire_id in (select id from prestataire where numero in ('PRE-2026-00026', 'PRE-2026-00029', 'PRE-2026-00030', 'PRE-2026-00032'));

alter table affretement alter column motif drop not null;
comment on column affretement.motif is 'Pourquoi le parc a confié la mission ; nul quand la pièce reprise ne le dit pas.';
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
      from releve_transport t where t.date >= depuis)
  )
$$;

create or replace function lire_transporteurs(depuis date)
returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'transporteurs', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'numero', p.numero, 'raison_sociale', p.raison_sociale, 'type', p.type, 'contact', p.contact, 'telephone', p.telephone,
        'courriel', p.courriel, 'adresse', p.adresse, 'ville', p.ville, 'ninea', p.ninea, 'delai_paiement_jours', p.delai_paiement_jours,
        'actif', p.actif, 'note', p.note,
        'profil', case when t.prestataire_id is null then null else jsonb_build_object(
          'forme', t.forme, 'sous_contrat', t.sous_contrat, 'reference_contrat', t.reference_contrat, 'debut_contrat', t.debut_contrat,
          'fin_contrat', t.fin_contrat, 'modes', t.modes, 'camions_engages', t.camions_engages, 'commentaire', t.commentaire, 'regime_fiscal', t.regime_fiscal) end
      ) order by p.numero), '[]'::jsonb)
      from prestataire p left join profil_transporteur t on t.prestataire_id = p.id
      where p.type = 'transporteur'),
    'chauffeurs_tiers', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'prestataire_id', c.prestataire_id, 'nom', c.nom, 'telephone', c.telephone, 'actif', c.actif)), '[]'::jsonb)
      from chauffeur_tiers c),
    'camions_tiers', (select coalesce(jsonb_agg(jsonb_build_object(
        'immatriculation', c.immatriculation, 'prestataire_id', c.prestataire_id, 'categorie', c.categorie, 'capacite_tonnes', c.capacite_tonnes,
        'chauffeur_habituel_id', c.chauffeur_habituel_id, 'actif', c.actif, 'commentaire', c.commentaire)), '[]'::jsonb)
      from camion_tiers c),
    'lignes_tarif', (select coalesce(jsonb_agg(jsonb_build_object(
        'numero', l.numero, 'prestataire_id', l.prestataire_id, 'origine', l.origine, 'destination', l.destination, 'categorie', l.categorie,
        'unite', l.unite, 'prix', l.prix, 'minimum', l.minimum, 'debut', l.debut, 'fin', l.fin, 'source', l.source, 'commentaire', l.commentaire)), '[]'::jsonb)
      from ligne_tarif l),
    'tarifs_journaliers', (select coalesce(jsonb_agg(jsonb_build_object(
        'numero', j.numero, 'prestataire_id', j.prestataire_id, 'famille', j.famille, 'prix_jour', j.prix_jour, 'debut', j.debut, 'fin', j.fin,
        'source', j.source, 'convention', j.convention, 'commentaire', j.commentaire)), '[]'::jsonb)
      from tarif_journalier j),
    'rattachements', (select coalesce(jsonb_agg(jsonb_build_object(
        'localite', r.localite, 'destination', r.destination, 'origine', r.origine, 'motif', r.motif, 'date', r.cree_le::date)), '[]'::jsonb)
      from rattachement_localite r),
    'affretements', (select coalesce(jsonb_agg(jsonb_build_object(
        'numero', a.numero, 'date', a.date, 'prestataire_id', a.prestataire_id, 'origine', a.origine, 'destination', a.destination,
        'business_unit', a.business_unit, 'categorie_demandee', a.categorie_demandee, 'immatriculation_externe', a.immatriculation_externe,
        'chauffeur_externe', a.chauffeur_externe, 'tonnage_prevu', a.tonnage_prevu, 'tonnage_livre', a.tonnage_livre, 'distance_km', a.distance_km,
        'motif', a.motif, 'vehicule_remplace', (select v.immatriculation from vehicule v where v.id = a.vehicule_remplace_id),
        'statut', a.statut, 'montant_convenu', a.montant_convenu, 'montant_facture', a.montant_facture, 'prix_exceptionnel', a.prix_exceptionnel,
        'complement_tarif', a.complement_tarif, 'motif_tarif', a.motif_tarif, 'date_livraison', a.date_livraison, 'date_facture', a.date_facture,
        'date_reglement', a.date_reglement, 'reference_facture', a.reference_facture, 'numero_demande_x3', a.numero_demande_x3,
        'numero_bon_commande', a.numero_bon_commande, 'demandeur', a.demandeur, 'commentaire', a.commentaire)), '[]'::jsonb)
      from affretement a where a.date >= depuis),
    'mises_a_disposition', (select coalesce(jsonb_agg(jsonb_build_object(
        'numero', m.numero, 'mois', m.mois, 'prestataire_id', m.prestataire_id, 'immatriculation', m.immatriculation, 'famille', m.famille,
        'jours_calendaires', m.jours_calendaires, 'jours_panne', m.jours_panne, 'jours_roules', m.jours_roules, 'prix_jour', m.prix_jour,
        'convention', m.convention, 'carburant_litres', m.carburant_litres, 'carburant_montant', m.carburant_montant, 'km_parcourus', m.km_parcourus,
        'tonnes_transportees', m.tonnes_transportees, 'statut', m.statut, 'montant_facture', m.montant_facture, 'date_facture', m.date_facture,
        'date_reglement', m.date_reglement, 'reference_facture', m.reference_facture, 'numero_demande_x3', m.numero_demande_x3, 'commentaire', m.commentaire)), '[]'::jsonb)
      from mise_a_disposition m where m.mois >= to_char(depuis, 'YYYY-MM')),
    'prestations', (select coalesce(jsonb_agg(jsonb_build_object(
        'numero', p.numero, 'date', p.date, 'prestataire_id', p.prestataire_id, 'libelle', p.libelle, 'business_unit', p.business_unit,
        'unite', p.unite, 'quantite', p.quantite, 'prix_unitaire', p.prix_unitaire, 'convention', p.convention, 'statut', p.statut,
        'montant_facture', p.montant_facture, 'date_facture', p.date_facture, 'date_reglement', p.date_reglement, 'reference_facture', p.reference_facture,
        'numero_demande_x3', p.numero_demande_x3, 'commentaire', p.commentaire)), '[]'::jsonb)
      from prestation p where p.date >= depuis),
    'releves_transport', (select coalesce(jsonb_agg(jsonb_build_object(
        'numero', t.numero, 'date', t.date, 'mode', t.mode, 'prestataire_id', t.prestataire_id, 'vehicule_id', t.vehicule_id,
        'camion_tiers_immatriculation', t.camion_tiers_immatriculation, 'immatriculation_libre', t.immatriculation_libre, 'chauffeur', t.chauffeur,
        'origine', t.origine, 'destination', t.destination, 'produit', t.produit, 'tonnage', t.tonnage, 'tonnage_pese', t.tonnage_pese,
        'bon_livraison', t.bon_livraison, 'affretement_numero', (select a.numero from affretement a where a.id = t.affretement_id))), '[]'::jsonb)
      from releve_transport t where t.date >= depuis and t.prestataire_id is not null),
    'jours_releves', (select coalesce(jsonb_agg(distinct t.date), '[]'::jsonb)
      from releve_transport t where t.date >= depuis)
  )
$$;

-- ============================================================================
-- SEDIMA Parc — 0025 : ce que le module Transporteurs lit, en une requête.
--
-- La liste des transporteurs et la fiche de chacun se dressent sur les mêmes
-- faits : les prestataires de type transporteur et leur profil, la flotte
-- tierce (camions, chauffeurs), les grilles (à la tonne, à la journée), les
-- rattachements de localités, puis ce que le parc leur a confié sur douze
-- mois — affrètements, mises à disposition, prestations — et ce qu'ils ont
-- chargé au relevé de transport. Dans la lignée de lire_parc() (0009) et de
-- lire_tableau() (0024) : la fonction rend les faits bruts, chaque table lue
-- une fois, et l'application applique les règles du domaine — coût retenue
-- comprise, écart à la grille net à net, notation sur cinq dimensions.
--
-- Le relevé de transport ne rend que les lignes portées par un prestataire :
-- ce sont elles que la fiche montre et que la notation mesure. Les jours
-- relevés, tous modes confondus, disent combien de semaines la période
-- couvre — c'est le dénominateur de la régularité.
--
-- Les tables de transport (0002) se lisent avec le seul profil ; la fonction
-- s'exécute avec les droits de l'appelant, les politiques s'appliquent.
-- ============================================================================

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
          'fin_contrat', t.fin_contrat, 'modes', t.modes, 'camions_engages', t.camions_engages, 'commentaire', t.commentaire) end
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

comment on function lire_transporteurs(date) is 'Les faits bruts du module Transporteurs depuis une date : prestataires transporteurs et profils, flotte tierce, grilles, rattachements, affrètements, mises à disposition, prestations, relevé de transport des tiers et jours relevés.';

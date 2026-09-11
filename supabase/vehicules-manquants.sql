-- ============================================================================
-- SEDIMA Parc — les véhicules du parc que l'application ne connaissait pas.
--
-- **Ce n'est pas une migration.** 17 véhicules créés, une plaque corrigée
-- (AB 930 BB → AB 930 BV), 6 attributions, 3 lots « à recevoir » reçus.
-- Source : FICHE COMPLET VEHICULES PARC LIVRAISONS ET PERSONNELS.xlsx (10/09/2026),
-- cartes grises, plan d'affectation des véhicules légers. Voir
-- docs/CARACTERISTIQUES-VEHICULES.md.
--
-- À jouer AVANT caracteristiques-vehicules.sql, qui complète ensuite les
-- caractéristiques techniques de tous les véhicules, ceux-ci compris.
-- REJOUABLE.
-- ============================================================================

begin;

-- ---- La plaque corrigée : la carte grise dit AB 930 BV ----
update vehicule set immatriculation = 'AB930BV',
       commentaire = concat_ws(' ', commentaire, 'Plaque corrigée le 11 septembre 2026 : AB 930 BV selon la carte grise, l''assurance et l''attestation 2026 (l''application écrivait AB 930 BB).')
 where immatriculation = 'AB930BB'
   and not exists (select 1 from vehicule where immatriculation = 'AB930BV');

-- ---- Les véhicules ----
insert into vehicule (immatriculation, marque, appellation, categorie, categorie_flotte, usage, transport_special, energie, business_unit, statut, engage, commentaire, regime) values
  ('AB060KT', 'Mitsubishi', 'L200 DC', 'camionnette', 'interne', 'utilitaire', false, 'gasoil', 'siege', 'en-service', false, 'Créé le 11 septembre 2026 depuis la fiche complète du parc. Lot 2 neuf, Yacine Siby, Responsable Dépôts (Cascade vf).', 'service'),
  ('AB062KT', 'Mitsubishi', 'L200 DC', 'camionnette', 'interne', 'utilitaire', false, 'gasoil', 'commercial', 'en-service', false, 'Créé le 11 septembre 2026 depuis la fiche complète du parc. Lot 2 neuf, Maimouna Gaye, Responsable Pôle Farine & Bétail ; remplace DK 5679 BL, à réformer (Cascade vf).', 'fonction'),
  ('AB112KT', 'Mitsubishi', 'L200 DC', 'camionnette', 'interne', 'utilitaire', false, 'gasoil', 'commercial', 'en-service', false, 'Créé le 11 septembre 2026 depuis la fiche complète du parc. Lot 2 - 06 neuf, Amacodou Ndiaye ; libère AA 119 AH pour le futur Responsable Logistique (Cascade vf).', 'service'),
  ('AB010KT', 'Mitsubishi', 'L200 DC', 'camionnette', 'interne', 'utilitaire', false, 'gasoil', 'commercial', 'en-service', false, 'Créé le 11 septembre 2026 depuis la fiche complète du parc. Lot 2 - 11 neuf, commercial Sud 2 en recrutement au 1er octobre 2026 (Cascade vf).', 'service'),
  ('AB066KT', 'Mitsubishi', 'L200 DC', 'camionnette', 'interne', 'utilitaire', false, 'gasoil', 'commercial', 'en-service', false, 'Créé le 11 septembre 2026 depuis la fiche complète du parc. Lot 2 - 13 neuf, commercial Zone Nord 2 en recrutement au 1er octobre 2026. Le plan d''affectation écrit AB 056 KT, la fiche du parc AB 066 KT : plaque à confirmer sur la carte grise.', 'service'),
  ('AB178KR', 'SINOTRUK', 'ZZ1168', 'camion', 'interne', 'autre', false, 'gasoil', 'aliment', 'en-mutation', true, 'Créé le 11 septembre 2026 depuis la fiche complète du parc. Camion neuf immatriculé le 21/08/2026, livraison aliment, en mutation (fiche du parc).', 'exploitation'),
  ('AB180KR', 'SINOTRUK', 'ZZ1168', 'camion', 'interne', 'autre', false, 'gasoil', 'aliment', 'en-mutation', true, 'Créé le 11 septembre 2026 depuis la fiche complète du parc. Camion neuf immatriculé le 21/08/2026, livraison aliment, en mutation (fiche du parc).', 'exploitation'),
  ('AB181KR', 'SINOTRUK', 'ZZ1168', 'camion', 'interne', 'autre', false, 'gasoil', 'aliment', 'en-mutation', true, 'Créé le 11 septembre 2026 depuis la fiche complète du parc. Camion neuf immatriculé le 21/08/2026, livraison aliment, en mutation (fiche du parc).', 'exploitation'),
  ('AB938KQ', 'SINOTRUK', 'ZZ1168', 'camion', 'interne', 'autre', false, 'gasoil', 'aliment', 'en-mutation', true, 'Créé le 11 septembre 2026 depuis la fiche complète du parc. Camion neuf immatriculé le 21/08/2026, livraison aliment, en mutation (fiche du parc).', 'exploitation'),
  ('AA542BQ', 'RENAULT', 'Premium', 'tracteur', 'interne', 'tracteur', false, 'gasoil', 'fermes', 'hors-service', true, 'Créé le 11 septembre 2026 depuis la fiche complète du parc. Tracteur Renault Premium 2020 de la ferme de Djilakh, béton et sable, assuré 2026 ; panne moteur (fiche du parc, rapprochement). Chauffeur à la fiche : THIERNO DRAME. PANNE MOTEUR.', 'exploitation'),
  ('AA507BQ', 'SCHMITZ', 'Semi-remorque benne', 'semi-remorque', 'interne', 'benne', false, 'gasoil', 'fermes', 'en-service', true, 'Créé le 11 septembre 2026 depuis la fiche complète du parc. Semi-remorque benne Schmitz attelée à AA 542 BQ, ferme de Djilakh, assurée 2026 (carte grise, rapprochement).', 'exploitation'),
  ('AB361JL', 'HOWO', 'ZZ3317N', 'camion', 'interne', 'benne', false, 'gasoil', 'fermes', 'en-service', true, 'Créé le 11 septembre 2026 depuis la fiche complète du parc. Camion Howo immatriculé le 05/06/2026, affecté aux fermes (carte grise, fiche du parc). Chauffeur à la fiche : THIERNO DRAME.', 'exploitation'),
  ('AB364HK', 'PEUGEOT', '5008', 'vehicule-leger', 'interne', 'utilitaire', false, 'gasoil', 'siege', 'en-service', false, 'Créé le 11 septembre 2026 depuis la fiche complète du parc. Peugeot 5008 immatriculée le 07/04/2026, siège, non affectée (carte grise, fiche du parc).', 'service'),
  ('DK4923BB', 'RENAULT', 'Duster', 'vehicule-leger', 'interne', 'utilitaire', false, 'gasoil', 'siege', 'hors-service', false, 'Créé le 11 septembre 2026 depuis la fiche complète du parc. Renault Duster 2016, siège ; panne moteur, organes et carrosserie (fiche du parc). PANNE MOTEUR, ORGANES, CAROSSERIE ET AUTES.', 'service'),
  ('DK0099BD', 'HYUNDAI', 'ix35', 'vehicule-leger', 'interne', 'utilitaire', false, 'gasoil', 'siege', 'hors-service', false, 'Créé le 11 septembre 2026 depuis la fiche complète du parc. Hyundai ix35 2017, siège ; panne moteur, organes et carrosserie (fiche du parc). PANNE MOTEUR, ORGANES, CAROSSERIE ET AUTES.', 'service'),
  ('AA866YH', 'TOYOTA', 'Land Cruiser Prado', 'vehicule-leger', 'interne', 'utilitaire', false, 'gasoil', 'siege', 'en-service', false, 'Créé le 11 septembre 2026 depuis la fiche complète du parc. Toyota Prado du Directeur général (fiche du parc : « DG Franck ») ; attributaire à créer au référentiel. Chauffeur à la fiche : DG FRANCK.', 'fonction'),
  ('AA372WJ', 'SUZUKI', 'Burgman', 'moto', 'interne', 'autre', false, 'essence', 'commercial', 'en-service', false, 'Créé le 11 septembre 2026 depuis la fiche complète du parc. Scooter Suzuki Burgman 2025 du Teral Shop (fiche du parc). L''assurance écrit AA 372 YJ : plaque à confirmer sur la carte grise. Chauffeur à la fiche : BABACAR  THERAL SHOP.', 'service')
on conflict (immatriculation) do nothing;

-- ---- Les attributions ----
insert into attribution_legere (vehicule_id, attributaire_id, pool, debut, commentaire)
select v.id, x.attributaire_id::uuid, x.pool, x.debut::date, x.commentaire
  from (values
    ('AB060KT', '156e212e-fe7d-415f-a297-f1af17ab658e', null, '2026-09-01', 'Véhicule neuf ou entré au parc le 11 septembre 2026, attribué à Yacine Siby. Lot 2 neuf, Yacine Siby, Responsable Dépôts (Cascade vf).'),
    ('AB062KT', '185a2bb4-768f-4cbc-a6a4-d7386f4ecb60', null, '2026-09-01', 'Véhicule neuf ou entré au parc le 11 septembre 2026, attribué à Maimouna Gaye. Lot 2 neuf, Maimouna Gaye, Responsable Pôle Farine & Bétail ; remplace DK 5679 BL, à réformer (Cascade vf).'),
    ('AB112KT', 'e4366ce4-aac0-43c9-a863-acdeee59cc2b', null, '2026-09-01', 'Véhicule neuf ou entré au parc le 11 septembre 2026, attribué à Amacodou Ndiaye. Lot 2 - 06 neuf, Amacodou Ndiaye ; libère AA 119 AH pour le futur Responsable Logistique (Cascade vf).'),
    ('AB010KT', null, 'Commercial — recrutement Sud 2', null, 'Véhicule neuf ou entré au parc le 11 septembre 2026. Lot 2 - 11 neuf, commercial Sud 2 en recrutement au 1er octobre 2026 (Cascade vf).'),
    ('AB066KT', null, 'Commercial — recrutement Zone Nord 2', null, 'Véhicule neuf ou entré au parc le 11 septembre 2026. Lot 2 - 13 neuf, commercial Zone Nord 2 en recrutement au 1er octobre 2026. Le plan d''affectation écrit AB 056 KT, la fiche du parc AB 066 KT : plaque à confirmer sur la carte grise.'),
    ('AA372WJ', '8feee996-b25a-4383-abd4-e36142c669a8', null, null, 'Véhicule neuf ou entré au parc le 11 septembre 2026, attribué à Babacar (Teral Shop). Scooter Suzuki Burgman 2025 du Teral Shop (fiche du parc). L''assurance écrit AA 372 YJ : plaque à confirmer sur la carte grise.')
  ) as x(immatriculation, attributaire_id, pool, debut, commentaire)
  join vehicule v on v.immatriculation = x.immatriculation
 where not exists (select 1 from attribution_legere a where a.vehicule_id = v.id);

-- ---- Les lots « à recevoir » reçus ----
update vehicule_a_recevoir r
   set recu_le = '2026-09-01', vehicule_id = v.id
  from (values
    ('Lot 2 - 06', 'AB112KT'),
    ('Lot 2 - 11', 'AB010KT'),
    ('Lot 2 - 13', 'AB066KT')
  ) as x(lot, immatriculation)
  join vehicule v on v.immatriculation = x.immatriculation
 where r.lot = x.lot and r.recu_le is null;

commit;

-- ---------------------------------------------------------------------------
-- Vérification
-- ---------------------------------------------------------------------------

select v.immatriculation, v.marque, v.appellation, v.categorie, v.business_unit, v.regime, v.statut,
       coalesce(t.nom, a.pool) as detenteur, r.lot
  from vehicule v
  left join attribution_legere a on a.vehicule_id = v.id
  left join attributaire t on t.id = a.attributaire_id
  left join vehicule_a_recevoir r on r.vehicule_id = v.id
 where v.immatriculation in ('AB060KT', 'AB062KT', 'AB112KT', 'AB010KT', 'AB066KT', 'AB178KR', 'AB180KR', 'AB181KR', 'AB938KQ', 'AA542BQ', 'AA507BQ', 'AB361JL', 'AB364HK', 'DK4923BB', 'DK0099BD', 'AA866YH', 'AA372WJ', 'AB930BV')
 order by v.categorie, v.immatriculation;

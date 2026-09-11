-- ============================================================================
-- SEDIMA Parc — le relevé de transport réel : les camions des transporteurs.
--
-- **Ce n'est pas une migration.** Chargement tiré du relevé de tonnage
-- hebdomadaire de la Direction des Opérations (RECAP TONNAGE HEBDOMMADAIRE),
-- du 2026-06-15 au 2026-09-03. Voir docs/RELEVE-TRANSPORT-REEL.md.
--
-- 11 camions que le référentiel tiers ne connaissait pas. Ils reviennent
-- chaque semaine au relevé : chacun est rattaché au transporteur dont il porte
-- les voyages. La capacité est celle que la feuille écrit (« PLT 40T »).
--
-- REJOUABLE : `on conflict do nothing`. À jouer **dans l'ordre des fichiers**,
-- les camions d'abord.
-- ============================================================================

insert into camion_tiers (immatriculation, prestataire_id, categorie, capacite_tonnes, actif, commentaire) values
  ('DK7179E', (select id from prestataire where numero = 'PRE-2026-00022'), 'camion', 40, true, 'Ajouté le 11 septembre 2026 depuis le relevé de tonnage hebdomadaire : 20 voyage(s) pour A DIENG.'),
  ('TH3166D', (select id from prestataire where numero = 'PRE-2026-00021'), 'camion', 7, true, 'Ajouté le 11 septembre 2026 depuis le relevé de tonnage hebdomadaire : 18 voyage(s) pour A KANE.'),
  ('TH7181B', (select id from prestataire where numero = 'PRE-2026-00021'), 'camion', 7, true, 'Ajouté le 11 septembre 2026 depuis le relevé de tonnage hebdomadaire : 40 voyage(s) pour A KANE.'),
  ('TH5341G', (select id from prestataire where numero = 'PRE-2026-00021'), 'camion', 2, true, 'Ajouté le 11 septembre 2026 depuis le relevé de tonnage hebdomadaire : 53 voyage(s) pour A KANE.'),
  ('DK4430AB', (select id from prestataire where numero = 'PRE-2026-00025'), 'camion', 35, true, 'Ajouté le 11 septembre 2026 depuis le relevé de tonnage hebdomadaire : 33 voyage(s) pour AUTRES.'),
  ('DK9374AX', (select id from prestataire where numero = 'PRE-2026-00027'), 'camion', null, true, 'Ajouté le 11 septembre 2026 depuis le relevé de tonnage hebdomadaire : 26 voyage(s) pour DR WADE.'),
  ('TH8174K', (select id from prestataire where numero = 'PRE-2026-00023'), 'camion', 40, true, 'Ajouté le 11 septembre 2026 depuis le relevé de tonnage hebdomadaire : 12 voyage(s) pour SOKHNA DIOP.'),
  ('AB934HW', (select id from prestataire where numero = 'PRE-2026-00025'), 'camion', 50, true, 'Ajouté le 11 septembre 2026 depuis le relevé de tonnage hebdomadaire : 2 voyage(s) pour AUTRES.'),
  ('AA292FX', (select id from prestataire where numero = 'PRE-2026-00022'), 'camion', 40, true, 'Ajouté le 11 septembre 2026 depuis le relevé de tonnage hebdomadaire : 3 voyage(s) pour A DIENG.'),
  ('AB161HM', (select id from prestataire where numero = 'PRE-2026-00025'), 'camion', 50, true, 'Ajouté le 11 septembre 2026 depuis le relevé de tonnage hebdomadaire : 1 voyage(s) pour AUTRES.'),
  ('AA313CT', (select id from prestataire where numero = 'PRE-2026-00022'), 'camion', 40, true, 'Ajouté le 11 septembre 2026 depuis le relevé de tonnage hebdomadaire : 1 voyage(s) pour A DIENG.')
on conflict do nothing;


-- Vérification
select count(*) as camions_tiers from camion_tiers;

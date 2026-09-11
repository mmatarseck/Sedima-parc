-- ============================================================================
-- SEDIMA Parc — vérification des chargements du 11 septembre 2026.
--
-- **Lecture seule.** À coller une fois dans le SQL Editor après les migrations
-- 0037 à 0040 et leurs chargements. Chaque ligne compare ce que les fichiers
-- joués contiennent à ce que la base porte : `on conflict do nothing` tait un
-- numéro en double, et c'est ainsi qu'une prestation s'était déjà perdue.
--
-- Toutes les lignes doivent sortir « ok ». Une ligne « À VÉRIFIER » dit quel
-- fichier regarder.
--
-- Le SQL Editor n'a pas d'utilisateur connecté : les fonctions qui dépendent
-- du rôle (types de document suivis, champs des tiers du tableau de bord)
-- n'y rendent rien. Les contrôles lisent donc les tables.
-- ============================================================================

with c (ordre, controle, attendu, obtenu) as (
  values
  -- 0037 et son correctif
  (1,  '0037 · cartes grises enregistrées (0 : le type n''est pas encore exigé)', '0',
       (select count(*) from document where type_document_id = 'carte-grise')::text),
  (2,  'correctif · bons de transport rangés réglés', '196',
       (select count(*) from prestation where numero like 'PRS-R-%' and statut = 'regle')::text),
  (3,  'correctif · bons de transport portant encore une date de facture', '0',
       (select count(*) from prestation where numero like 'PRS-R-%' and date_facture is not null)::text),
  -- 0038 et le relevé de transport
  (4,  'relevé · camions de transporteurs ajoutés', '11',
       (select count(*) from camion_tiers where commentaire like '%relevé de tonnage hebdomadaire%')::text),
  (5,  'relevé · voyages', '1079',
       (select count(*) from releve_transport where numero like 'TRP-2026-9%')::text),
  (6,  'relevé · tonnes', '24810.31',
       (select sum(tonnage) from releve_transport where numero like 'TRP-2026-9%')::text),
  (7,  'relevé · voyages du parc', '132',
       (select count(*) from releve_transport where numero like 'TRP-2026-9%' and mode = 'parc')::text),
  (8,  'relevé · dernier voyage', '2026-09-03',
       (select max(date) from releve_transport where numero like 'TRP-2026-9%')::text),
  (9,  '0038 · la situation journalière rend la date du dernier voyage', 'true',
       (select (situation_journaliere(current_date, current_date)->0->'flotte') ? 'dernier_releve_transport')::text),
  -- 0039 et le CA provisoire d'août
  (10, '0039 · transporteurs sous TVA 18 %', '3',
       (select count(*) from profil_transporteur where regime_fiscal = 'tva')::text),
  (11, '0039 · transporteurs sous retenue 5 %', '4',
       (select count(*) from profil_transporteur where regime_fiscal = 'brs')::text),
  (12, '0039 · motif d''affrètement facultatif', 'YES',
       (select is_nullable from information_schema.columns where table_name = 'affretement' and column_name = 'motif')),
  (13, 'août · affrètements (A. Dieng, Sokhna Diop)', '65',
       (select count(*) from affretement where numero like 'AFF-2026-9%')::text),
  (14, 'août · affrètements dont le camion est retrouvé', '65',
       (select count(immatriculation_externe) from affretement where numero like 'AFF-2026-9%')::text),
  (15, 'août · affrètements, montant hors taxe', '11501170',
       (select sum(montant_convenu) from affretement where numero like 'AFF-2026-9%')::text),
  (16, 'août · prestations ADEX au jour', '7',
       (select count(*) from prestation where numero like 'PRS-2026-9%')::text),
  (17, 'août · prestations ADEX, montant hors taxe', '14370000',
       (select sum(round(quantite * prix_unitaire)) from prestation where numero like 'PRS-2026-9%')::text),
  -- 0040
  (18, '0040 · durée d''immobilisation facultative', 'YES',
       (select is_nullable from information_schema.columns where table_name = 'intervention' and column_name = 'immobilisation_jours')),
  (19, '0040 · interventions reprises sans durée', '298',
       (select count(*) from intervention where numero like 'INT-R-%' and immobilisation_jours is null)::text),
  (20, '0040 · interventions reprises encore à zéro jour', '0',
       (select count(*) from intervention where numero like 'INT-R-%' and immobilisation_jours = 0)::text)
)
select controle, attendu, obtenu, case when attendu = obtenu then 'ok' else 'À VÉRIFIER' end as verdict
  from c order by ordre;

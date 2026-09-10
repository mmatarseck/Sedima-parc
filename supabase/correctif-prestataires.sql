-- ============================================================================
-- SEDIMA Parc — les prestataires qui manquaient.
--
-- **Ce n'est pas une migration.** Le correctif des chargements ne portait que
-- sur les interventions, les dépenses et les pleins ; la régénération avait
-- aussi rendu des **fournisseurs** que la première version n'avait pas
-- trouvés, le décalage de colonnes leur faisant rater leur bon.
--
-- 8 garages, magasins et transporteurs manquaient donc au référentiel, et
-- `transport-02-prestations.sql` en citait un : la prestation tombait sur un
-- `prestataire_id` nul, que la table refuse à juste titre.
--
-- À jouer **avant** `transport-02-prestations.sql`.
-- ============================================================================

-- ---- 2 nom(s) repris : le nettoyage est arrivé après le chargement ----
update prestataire set raison_sociale = 'GARAYA TRANSPORT IR PROFORMA' where raison_sociale = 'GARAYA TRANSPORT IR PROFORMA :';
update prestataire set raison_sociale = 'MBAGNICK GAYE I PROFORMA' where raison_sociale = 'MBAGNICK GAYE I PROFORMA :';

-- ---- 8 fournisseur(s) que la première version n'avait pas trouvés ----
insert into prestataire (numero, raison_sociale, type, actif, note) values
  ('PRE-2026-70001', 'FOURNISSEURS DIVERS', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-70002', 'KHABANE GUEYE', 'depanneur', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-70003', 'TSA - TECHNIQUE SECURITE AUTO', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-70004', 'ALIOUNE NDIAYE', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-70005', 'WAKEUR CHEIKH ISSA DIENE', 'pieces', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-70006', 'BAYE MALICK SAMB', 'pieces', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-70007', 'COTOA', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-70008', 'GENERATION AUTOMOBILE', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.')
on conflict (numero) do nothing;


-- ---------------------------------------------------------------------------
-- Vérification : plus aucune prestation ne devrait manquer son prestataire.
-- ---------------------------------------------------------------------------

select count(*) as prestataires from prestataire;

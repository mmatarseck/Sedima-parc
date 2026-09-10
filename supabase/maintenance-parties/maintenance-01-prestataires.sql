-- ============================================================================
-- SEDIMA Parc — maintenance réelle : les fournisseurs.
--
-- **Ce n'est pas une migration.** C'est un chargement de données, tiré du
-- classeur d'extraction des bons de commande du dossier DO — 694 factures
-- PDF, de novembre 2023 à septembre 2026.
--
-- 46 garages, magasins de pièces et pneumaticiens que le référentiel
-- ne connaissait pas. Leur type vient de la catégorie de dépense de leur
-- premier bon. Une intervention sans garage vaut la moitié d'une intervention.
--
-- REJOUABLE : `on conflict do nothing`. Un second passage n'ajoute rien.
-- À jouer **dans l'ordre des fichiers** : les prestataires d'abord, puisque
-- les interventions et les dépenses les citent par leur raison sociale.
-- ============================================================================

insert into prestataire (numero, raison_sociale, type, actif, note) values
  ('PRE-2026-90001', 'TATA INTERNATIONAL / UNITECH', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90002', 'LA SENEGALAISE DE L''AUTOMOBILE', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90003', 'FOUTA POIDS LOURDS', 'pieces', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90004', 'GIE TAP', 'pieces', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90005', 'FIRST GARAGE SENEGAL', 'pieces', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90006', 'SALIKHOU SAMBE', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90007', 'ANEC ENERGIE', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90008', 'CAETANO FORMULA SENEGAL', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90009', 'OUMAR AMATH BIAYE TRANSPORTEUR', 'pneumatiques', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90010', 'MAMADOU KANE', 'pieces', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90011', 'CFAO', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90012', 'TECHNOPOLE CAMION', 'pieces', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90013', 'KHELCOM AUTOMOBILE', 'pieces', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90014', 'STAR PNEUS - MATAR GUEYE', 'pneumatiques', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90015', 'THIERNO DIOUF', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90016', 'MANDIONE SENE', 'pieces', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90017', 'SAKA SENEGAL', 'pneumatiques', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90018', 'SSPI - STE SENEGALAISE DE PRODUITS IND.', 'pneumatiques', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90019', 'KEUR BAYE MOR - GORMACK DIENG', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90020', 'WA NGUIDILE MECANIQUE GENERALE', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90021', 'MOUSSA SENE', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90022', 'GENERAL TRADING SERVICES', 'pieces', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90023', 'ALADJI SYLL', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90024', 'GIE NDIAYE ET FRERES', 'pieces', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90025', 'ETS TOUBA DAROU SALAM', 'pieces', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90026', 'SICAS', 'pneumatiques', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90027', 'GUEYE ALMOURIDIYA LOGISTIQUE', 'pieces', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90028', 'TOUBA DAROU SALAM', 'pieces', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90029', 'ETS MALEYE', 'pneumatiques', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90030', 'KEUR SERIGNE BABACAR SY', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90031', 'BOYE ET FRERES', 'pieces', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90032', 'TALLA DIOP', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90033', 'PRO KMD', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90034', 'DAROU SALAM MECANIQUE GENERALE CHEZ IBRA DIOP', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90035', 'BIRAME NDIAYE', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90036', 'ETABLISSEMENT ESPACE CLIM BECAYE DIOUCK', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90037', 'MBAYE DIASSE', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90038', 'FOURNISSEURS DIVERS', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90039', 'KHABANE GUEYE', 'depanneur', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90040', 'TSA - TECHNIQUE SECURITE AUTO', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90041', 'ALIOUNE NDIAYE', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90042', 'WAKEUR CHEIKH ISSA DIENE', 'pieces', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90043', 'MOUSSA SENE RÉF PROFORMA :', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90044', 'BAYE MALICK SAMB', 'pieces', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90045', 'COTOA', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.'),
  ('PRE-2026-90046', 'GENERATION AUTOMOBILE', 'garage', true, 'Créé le 10 septembre 2026 depuis les bons de commande du dossier DO.')
on conflict (numero) do nothing;

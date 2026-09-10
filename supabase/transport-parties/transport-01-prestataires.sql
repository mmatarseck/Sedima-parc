-- ============================================================================
-- SEDIMA Parc — location et transport réels : les transporteurs.
--
-- **Ce n'est pas une migration.** Chargement tiré du classeur d'extraction des
-- bons de commande du dossier DO — famille « Location & transport », que le
-- chargement de la maintenance avait laissée de côté.
--
-- 25 transporteurs que le référentiel ne connaissait pas. Ceux que le
-- chargement de la maintenance vient de créer ne sont pas recréés ici : un
-- fournisseur qui répare et qui loue reste un seul prestataire.
--
-- REJOUABLE : `on conflict do nothing`. À jouer **dans l'ordre des fichiers**,
-- les transporteurs d'abord.
-- ============================================================================

insert into prestataire (numero, raison_sociale, type, actif, note) values
  ('PRE-2026-80001', 'MOHAMED DEME', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80002', 'MBAGNICK GAYE', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80003', 'MOUSSA SARR TRANSPORTEUR AEROPORT AIBD', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80004', 'GROUP BEYE TRANS COMMERCE', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80005', 'ETS SOKHNA DIOP', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80006', 'SAMBA BASSE', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80007', 'WAKEUR SERIGNE FALLOU', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80008', 'PAPE MOUSSA DIOP MALIKA', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80009', 'MOHAMED ET FRERES', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80010', 'ABDOU KHADRE DIOP', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80011', 'JOACHIM GABOU NGONE FAYE', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80012', 'MBOUP AGRO BUSINESS', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80013', 'DR IBRAHIMA WADE', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80014', 'MOR FALL DIENG', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80015', 'MOUHAMED DEME', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80016', 'GARAYA TRANSPORT', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80017', 'MBAYE DIOP', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80018', 'SECAA (ex SENAC)', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80019', 'MALICK DIOP', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80020', 'GARAYA TRANSPORT IR PROFORMA :', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80021', 'ADA LOCATION VOITURE', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80022', 'MBAGNICK GAYE I PROFORMA :', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80023', 'IBRAHIMA DIALLO TRANSP FRIGO', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80024', 'GLOBAL FOOD SUPPLY SA', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.'),
  ('PRE-2026-80025', 'SPEEDY', 'transporteur', true, 'Créé le 10 septembre 2026 depuis les bons de location et de transport du dossier DO.')
on conflict (numero) do nothing;

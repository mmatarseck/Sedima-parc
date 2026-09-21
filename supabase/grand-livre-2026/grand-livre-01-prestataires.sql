-- ============================================================================
-- SEDIMA Parc — grand livre 2026 : les fournisseurs.
--
-- **Ce n'est pas une migration.** C'est un chargement de données, tiré de
-- `RECAP 31082026.xlsx` (dossier DO, Budget 2027 / Fichiers de travail) :
-- l'extrait du grand livre Sage X3 du 1er janvier au 31 août 2026 et le
-- tableau des immobilisations « matériel de transport ».
-- Fabriqué par `scripts/charger-grand-livre.mts` — voir docs/GRAND-LIVRE-2026.md.
--
-- 4 fournisseurs que le grand livre nomme et que le référentiel ne connaissait pas.
-- Un nom déjà présent (à la graphie près) n'est pas recréé.
--
-- REJOUABLE. À jouer **dans l'ordre des fichiers**, après la migration 0057.
-- ============================================================================

insert into prestataire (numero, raison_sociale, type, actif, note)
select x.numero, x.raison_sociale, x.type::type_prestataire, x.actif, x.note
  from (values
  ('PRE-2026-60001', 'CARROSSERIE FALL ET FRERES', 'garage', true, 'Créé le 18 septembre 2026 depuis le grand livre 2026 (RECAP 31082026).'),
  ('PRE-2026-60002', 'MBAYE YERI', 'garage', true, 'Créé le 18 septembre 2026 depuis le grand livre 2026 (RECAP 31082026).'),
  ('PRE-2026-60003', 'EMG UNIVERSAL AUTO', 'garage', true, 'Créé le 18 septembre 2026 depuis le grand livre 2026 (RECAP 31082026).'),
  ('PRE-2026-60004', 'EDK OIL', 'carburant', true, 'Créé le 18 septembre 2026 depuis le grand livre 2026 (RECAP 31082026).')
  ) as x (numero, raison_sociale, type, actif, note)
 where not exists (select 1 from prestataire p where upper(regexp_replace(p.raison_sociale, '[^A-Za-z0-9]', '', 'g')) = upper(regexp_replace(x.raison_sociale, '[^A-Za-z0-9]', '', 'g')))
on conflict (numero) do nothing;

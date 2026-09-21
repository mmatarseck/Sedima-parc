-- ============================================================================
-- SEDIMA Parc — 0057 : quand le véhicule a été acheté, et sous quelle
-- immobilisation.
--
-- La fiche calculait la valeur nette comptable et la fin d'amortissement
-- depuis la **première mise en circulation**. C'est juste pour un véhicule
-- acheté neuf, et faux pour une occasion : le Hilux de 2019 acheté en mai 2026
-- serait amorti depuis 2023, alors que la comptabilité lui donne 21 M F de
-- valeur nette au 31 août 2026.
--
-- Le tableau des immobilisations (grand livre 2026, 18 septembre) donne la
-- date qui manquait. Deux colonnes :
--
--   * `date_acquisition` — le jour où l'amortissement commence. Vide, la fiche
--     retombe sur la première mise en circulation, comme avant.
--   * `reference_immobilisation` — le numéro de la comptabilité (IMM-201-…),
--     pour retrouver la ligne du tableau, et pour que le chargement sache
--     reconnaître ce qu'il a lui-même écrit.
-- ============================================================================

alter table vehicule add column if not exists date_acquisition         date;
alter table vehicule add column if not exists reference_immobilisation text;

comment on column vehicule.date_acquisition         is 'Le jour où l''amortissement commence ; vide, la première mise en circulation en tient lieu.';
comment on column vehicule.reference_immobilisation is 'Le numéro de l''immobilisation en comptabilité (IMM-201-…).';

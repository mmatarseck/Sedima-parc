-- ============================================================================
-- SEDIMA Parc — 0056 : les contrats des chauffeurs tels que les RH les nomment.
--
-- Les listes du dossier DO (« LISTE CHAUFFEURS SEDIMA 2025 », la liste du
-- pointage) disent d'un chauffeur qu'il est en **CDI**, en **CDD**, ou
-- **journalier**. L'énumération d'origine (0001) ne connaissait que salarié,
-- intérimaire et prestataire : « salarié » confondait le CDI et le CDD, et le
-- journalier n'avait pas de place. Trois valeurs de plus (16 septembre 2026,
-- relevé des listes de chauffeurs) ; les trois d'origine restent — un
-- prestataire reste un prestataire, et rien de ce qui est écrit ne se casse.
--
-- L'ajout d'une valeur d'énumération ne peut pas être suivi de son usage dans
-- la même transaction : les lignes se mettent à jour ensuite, par le script
-- `charger-chauffeurs-rh.mts`, qui écrit aussi les matricules RH réels.
-- ============================================================================

alter type contrat_chauffeur add value if not exists 'cdi';
alter type contrat_chauffeur add value if not exists 'cdd';
alter type contrat_chauffeur add value if not exists 'journalier';

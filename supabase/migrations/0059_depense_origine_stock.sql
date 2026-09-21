-- ============================================================================
-- SEDIMA Parc — 0059 : une dépense peut naître d'une sortie de stock.
--
-- Une pièce prise au magasin pour un service de maintenance porte son coût au
-- véhicule (métier, 21 septembre 2026 : « prendre du stock s'il y en a, et
-- transférer la charge au service »). Mais la pièce a déjà été payée, à
-- l'achat, par sa demande d'achat : le budget la compte là. La dépense du
-- véhicule porte donc une origine à elle, « stock », pour que le coût du
-- véhicule soit juste sans que le budget ne la compte une seconde fois.
--
-- SEULE DANS SON FICHIER : une valeur d'énumération ajoutée ne peut servir que
-- dans une transaction suivante (leçon de 0046 et 0047).
-- ============================================================================

alter type origine_depense add value if not exists 'stock';

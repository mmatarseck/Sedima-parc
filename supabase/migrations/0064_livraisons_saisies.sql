-- ============================================================================
-- 0064 — Des livraisons saisies dans l'application.
--
-- Métier, 22 septembre 2026 : « possibilité de rajouter des livraisons, les
-- éditer, etc., avec les heures de début et de fin en optionnel, et d'autres
-- informations qualitatives au besoin. Prévoir le résumé dans les rapports. »
--
-- Les bons de Sage X3 (0044) gardent leur numéro « BL… » ; une livraison saisie
-- ici prend « LIV-AAAA-NNNNN » et la source « saisie ». Les heures sont
-- facultatives ; les observations disent ce que le bon ne dit pas — retard,
-- client absent, marchandise refusée, route coupée.
--
-- Rejouable.
-- ============================================================================

alter table livraison add column if not exists heure_debut time;
alter table livraison add column if not exists heure_fin time;
alter table livraison add column if not exists observations text;
alter table livraison add column if not exists modifie_le timestamptz;
alter table livraison add column if not exists modifie_par uuid references auth.users (id);

comment on column livraison.heure_debut is 'Heure de départ ou de début de la livraison, facultative.';
comment on column livraison.heure_fin is 'Heure de fin de la livraison, facultative.';
comment on column livraison.observations is 'Ce que le bon ne dit pas : retard, client absent, marchandise refusée…';

-- Une livraison saisie par erreur se supprime, avec sa trace (gestion des relevés).
drop policy if exists retrait_livraison on livraison;
create policy retrait_livraison on livraison for delete using ((select peut('releves', 'gestion')));

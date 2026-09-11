-- ============================================================================
-- SEDIMA Parc — 0040 : « disponibilité 100 % » cesse de mentir.
--
-- Le tableau de bord montrait un parc disponible à 100 % tous les mois de 2026,
-- et une immobilisation moyenne au garage de zéro jour. C'est l'un des six
-- indicateurs du référentiel DO, affiché par défaut.
--
-- Pourquoi. `intervention.immobilisation_jours` était obligatoire, zéro par
-- défaut. Les 298 interventions réelles (bons de commande de maintenance,
-- chargées le 10 septembre 2026) ne disent pas combien de jours le véhicule est
-- resté au garage : le chargement a écrit zéro. Zéro jour d'immobilisation pour
-- 125 réparations curatives — c'est le zéro qui ment, sur un indicateur de
-- direction.
--
-- Le remède tient en deux temps :
--
--   1. la colonne accepte l'inconnu : nulle veut dire « non relevée », et plus
--      aucun défaut ne l'écrit à la place de la personne qui saisit ;
--   2. les interventions reprises des bons, qui portent un zéro faute de mieux,
--      passent à nul.
--
-- Côté domaine, une durée inconnue ne compte pour aucun jour et ne se déguise
-- pas en zéro : la disponibilité du mois sort « — » tant qu'une réparation
-- curative du mois n'a pas de durée, et la durée moyenne au garage ne porte que
-- sur les interventions dont la durée est connue.
--
-- Rejouable : l'`update` ne touche que les interventions reprises (INT-R-) dont
-- la durée vaut encore zéro.
-- ============================================================================

alter table intervention alter column immobilisation_jours drop not null;
alter table intervention alter column immobilisation_jours drop default;
comment on column intervention.immobilisation_jours is 'Jours d''immobilisation au garage ; nul quand la pièce ne le dit pas — ce n''est pas zéro jour.';

update intervention set immobilisation_jours = null
 where numero like 'INT-R-%' and immobilisation_jours = 0;

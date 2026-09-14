-- ============================================================================
-- SEDIMA Parc — 0046 : le statut « sorti ».
--
-- L'énumération s'arrêtait à « retrait en cours » : un état de transition, qui
-- dit qu'une sortie est engagée mais jamais qu'elle est faite. Un véhicule
-- cédé, réformé, détruit ou volé n'avait donc nulle part où aller, et restait
-- dans la liste avec un statut qui mentait sur sa situation.
--
-- « Sorti » est terminal. Le véhicule quitte la liste par défaut, mais
-- **rien n'est supprimé** : sa fiche reste consultable, ses livraisons, ses
-- dépenses, ses pneus, ses mouvements de stock et ses relevés gardent leur
-- rattachement. C'est la règle du chauffeur qui quitte l'entreprise — une date
-- de sortie, pas une ligne effacée.
--
-- L'ajout d'une valeur d'énumération ne peut pas être suivi de son usage dans
-- la même transaction : les colonnes et la contrainte qui la citent sont en
-- 0047.
-- ============================================================================

alter type statut_vehicule add value if not exists 'sorti';

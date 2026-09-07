-- ============================================================================
-- SEDIMA Parc — 0005 : le statut « à recevoir ».
--
-- Le 7 septembre 2026, le métier a fait entrer le lot 2 — quinze véhicules
-- commandés, pas encore livrés ni immatriculés — dans la liste Flotte. Un
-- véhicule commandé est un véhicule du parc qui n'est pas encore là : il lui
-- faut un statut qui le dise, plutôt que d'emprunter « en mutation ». Les
-- lignes elles-mêmes restent dans `vehicule_a_recevoir` tant qu'elles n'ont
-- pas d'immatriculation ; à la réception, elles entrent dans `vehicule`.
-- ============================================================================

alter type statut_vehicule add value if not exists 'a-recevoir';

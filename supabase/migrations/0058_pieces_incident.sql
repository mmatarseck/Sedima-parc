-- ============================================================================
-- SEDIMA Parc — 0058 : les photos et documents d'une déclaration d'incident.
--
-- Métier, 21 septembre 2026 : « rajouter un bouton de création d'un incident
-- ou sinistre, comme sur les autres onglets — possibilité de prendre des
-- photos, entre autres ». Le formulaire de déclaration le promettait depuis le
-- cadrage (« pièces jointes : au branchement de la base ») ; la table n'avait
-- pas de colonne pour elles.
--
-- Plusieurs pièces par déclaration — la photo de l'avant, celle de l'arrière,
-- le constat, le procès-verbal —, d'où un tableau de références vers le seau
-- « pieces », comme la photo d'un véhicule ou la facture d'une dépense.
--
-- À JOUER AVANT le déploiement du code qui l'écrit : une déclaration portant
-- des pièces serait refusée par une base qui n'a pas la colonne.
-- ============================================================================

alter table incident add column if not exists pieces text[] not null default '{}';

comment on column incident.pieces is 'Les photos et documents de la déclaration, dans le seau « pieces » : références « pieces/… ».';

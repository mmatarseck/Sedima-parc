-- ============================================================================
-- SEDIMA Parc — 0006 : la catégorie ajoutée par le métier.
--
-- Le 7 septembre 2026, le métier a demandé que marque, modèle et catégorie
-- des véhicules se tiennent en paramètres, enrichis au fil des créations.
-- Marques et modèles vivent dans `parametre` (clé « vehicules »), en JSON,
-- comme l'énergie ou les règles d'alerte : rien à changer au schéma.
--
-- La catégorie est d'une autre nature : `categorie` est une énumération, clé
-- des règles (documents des poids lourds, plafond kilométrique, programme
-- d'entretien). Les huit valeurs livrées deviennent des **familles** ; une
-- catégorie ajoutée par le métier se rattache à l'une d'elles et se garde à
-- part, dans `categorie_metier` — un identifiant « cat-… » qui renvoie au
-- paramètre. Nulle pour un véhicule qui porte simplement sa famille.
-- ============================================================================

alter table vehicule add column if not exists categorie_metier text check (categorie_metier is null or categorie_metier like 'cat-%');

comment on column vehicule.categorie_metier is 'Catégorie ajoutée dans Paramètres › Véhicules (« cat-… ») ; la famille reste dans categorie et porte les règles.';

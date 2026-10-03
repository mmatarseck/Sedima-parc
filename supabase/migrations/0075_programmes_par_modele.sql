-- ============================================================================
-- 0075 — Les programmes d'entretien par modèle.
--
-- Proposition de maintenance, lot 4 : « un plan par modèle (Mitsubishi L200,
-- Tata LPT 1618, Toyota Hilux…), plus précis que par catégorie ; et toujours
-- l'ajustement par véhicule ». Le métier, 3 octobre 2026 : « plans préventifs
-- par modèle ».
--
-- Un programme porte désormais, en plus de ses catégories, des **modèles** :
-- « Mitsubishi L200 » vaut pour toutes les L200 du parc (DC, SC, DID, pick-up),
-- quelle que soit la casse saisie à l'immatriculation. Le modèle passe devant la
-- catégorie ; le plus précis l'emporte (« Mitsubishi L200 DC » devant
-- « Mitsubishi L200 »). Un modèle n'appartient qu'à un programme, comme une
-- catégorie : l'application y veille à l'enregistrement.
--
-- Rejouable.
-- ============================================================================

alter table programme_entretien add column if not exists modeles text[] not null default '{}';

comment on column programme_entretien.modeles is
  'Marque et appellation (« Mitsubishi L200 ») des véhicules qui suivent ce programme. Le début suffit : « Mitsubishi L200 » couvre « MITSUBISHI L200 pick-up ». Passe devant la catégorie.';

select code, libelle, categories, modeles from programme_entretien order by code;

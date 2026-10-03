-- 0070 — La pièce justificative d'un mouvement de caisse.
--
-- Métier, 2 octobre 2026 : « Sorties de caisse — donner la possibilité de
-- rattacher une pièce justificative ». Le mouvement portait le numéro de la
-- pièce (`piece`) et une case « justificatif fourni », pas le fichier. Il
-- gagne le chemin du fichier dans le seau privé « pieces » (0014, 0049),
-- comme la dépense, le plein ou le procès-verbal de visite.
--
-- Rejouable.

alter table mouvement_caisse add column if not exists fichier text;

comment on column mouvement_caisse.fichier is 'Le justificatif scanné ou photographié (seau « pieces ») (0070).';

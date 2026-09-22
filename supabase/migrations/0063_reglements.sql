-- ============================================================================
-- 0063 — Comment une dépense, un plein ou un service se règle.
--
-- Métier, 22 septembre 2026 : « trouver une logique simple de rattacher tout
-- ça ». La règle tient en trois lignes :
--   * une dépense et un service disent comment ils se règlent : par la caisse,
--     par un bon de commande (son numéro et sa pièce), ou sur facture ;
--   * une sortie de caisse dit ce qu'elle règle — un plein, un service ou une
--     autre dépense — et cite l'élément réglé par son numéro ;
--   * ce qui se règle par la caisse reste « à régler » tant qu'aucune sortie ne
--     le cite.
--
-- mouvement_caisse.depense_numero garde son nom : il cite désormais une
-- dépense (DEP), un plein (PLE) ou un service (OTR).
--
-- Rejouable.
-- ============================================================================

alter table depense add column if not exists numero_bc text;
alter table depense add column if not exists fichier_bc text;
comment on column depense.numero_bc is 'Le bon de commande qui règle la dépense, quand son origine est « bon-de-commande ».';
comment on column depense.fichier_bc is 'La pièce du bon de commande, dans le seau.';

alter table ordre_travail add column if not exists mode_reglement text;
alter table ordre_travail drop constraint if exists ordre_travail_mode_reglement_check;
alter table ordre_travail add constraint ordre_travail_mode_reglement_check check (mode_reglement is null or mode_reglement in ('caisse', 'bon-de-commande', 'facture'));
alter table ordre_travail add column if not exists numero_bc text;
alter table ordre_travail add column if not exists pieces_reglement text[] not null default '{}';
comment on column ordre_travail.mode_reglement is 'Comment le service se règle : caisse, bon de commande ou facture.';
comment on column ordre_travail.pieces_reglement is 'Le bon de commande ou la pièce de caisse du règlement.';

alter table mouvement_caisse add column if not exists objet_reglement text;
alter table mouvement_caisse drop constraint if exists mouvement_caisse_objet_reglement_check;
alter table mouvement_caisse add constraint mouvement_caisse_objet_reglement_check check (objet_reglement is null or objet_reglement in ('carburant', 'service', 'depense'));
comment on column mouvement_caisse.objet_reglement is 'Ce que la sortie règle : un plein, un service ou une autre dépense, cité par depense_numero.';

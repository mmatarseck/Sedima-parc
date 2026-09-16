-- ============================================================================
-- SEDIMA Parc — 0054 : archiver un véhicule.
--
-- Demande du métier du 16 septembre 2026 : « donner la possibilité d'archiver
-- les véhicules ».
--
-- ARCHIVER N'EST PAS SORTIR. « Sorti » (0046, 0047) affirme quelque chose sur
-- le véhicule : il a quitté le parc, tel jour, pour tel motif — c'est un fait
-- daté, terminal, qui compte dans l'histoire de la flotte. Archiver n'affirme
-- rien : la ligne quitte les listes de travail et les listes de choix, sans
-- qu'on dise qu'elle a été cédée ou réformée. C'est le geste pour un doublon,
-- une saisie par erreur, un engin que plus personne ne suit, une plaque dont
-- on attend de savoir ce qu'elle est devenue. Et il se défait d'un clic —
-- une sortie ne se défait pas sans effacer sa date et son motif.
--
-- RIEN N'EST SUPPRIMÉ. La fiche reste consultable, ses dépenses, ses
-- livraisons, ses relevés gardent leur rattachement ; la liste Flotte le
-- retrouve par son filtre « Archivés » et par la recherche. Une date et un
-- motif, sur la ligne, disent quand et pourquoi — et le journal des
-- modifications garde qui.
--
-- CE QUE LES COMPTES EN FONT. Un véhicule archivé se tait partout où un
-- véhicule sorti se tait : la liste Flotte, les listes de choix des
-- formulaires. Les fonctions SQL de situation ne distinguent ni l'un ni
-- l'autre — elles ne le faisaient pas pour « sorti », et l'archivage ne
-- change pas cette règle ici.
-- ============================================================================

alter table vehicule add column if not exists archive_le    timestamptz;
alter table vehicule add column if not exists archive_motif text;

comment on column vehicule.archive_le    is 'Le moment où le véhicule a été archivé — retiré des listes sans rien affirmer sur son sort. Nul tant qu''il n''est pas archivé.';
comment on column vehicule.archive_motif is 'Pourquoi il a été archivé, en clair : doublon, saisie par erreur, plus suivi… Vide si l''archivage n''a pas été motivé.';

-- Les listes lisent « pas archivé » : un index partiel sur les archivés suffit
-- à les retrouver vite sans peser sur le reste du parc.
create index if not exists vehicule_archive_le_idx on vehicule (archive_le desc) where archive_le is not null;

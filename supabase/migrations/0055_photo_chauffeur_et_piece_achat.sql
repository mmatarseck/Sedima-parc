-- ============================================================================
-- SEDIMA Parc — 0055 : la photo d'un chauffeur, la pièce d'une demande d'achat.
--
-- Relevé des fichiers à charger du 16 septembre 2026 : le dossier DO tient
-- trente-neuf photos de chauffeurs (« MALICK/PHOTO CHAUFFEURS ») et un millier
-- de bons de commande scannés (« Maintenance/BON DE COMMANDES ») dont deux
-- cent soixante-quatre répondent à une demande d'achat par leur numéro. Ni la
-- fiche chauffeur ni la demande d'achat n'avaient de colonne pour les tenir.
--
-- LA PHOTO D'UN CHAUFFEUR suit la règle de celle d'un véhicule (0014) : le
-- fichier va au seau privé « pieces », la ligne n'en garde que la référence,
-- relue par une adresse signée. Elle sert à reconnaître la personne — sur la
-- fiche, et demain sur le badge.
--
-- LA PIÈCE D'UNE DEMANDE D'ACHAT est le bon de commande Sage X3 lui-même,
-- scanné : ce que le fournisseur a reçu, ce que la réception contrôle. Même
-- seau, même référence. Une demande sans pièce reste une demande ; la pièce
-- ne change ni son étape ni son montant.
-- ============================================================================

alter table chauffeur     add column if not exists photo   text;
alter table demande_achat add column if not exists fichier text;

comment on column chauffeur.photo       is 'Référence de la photo dans le seau « pieces » (dossier chauffeurs), relue par une adresse signée. Nulle sans photo.';
comment on column demande_achat.fichier is 'Référence du bon de commande scanné dans le seau « pieces » (dossier documents). Nulle sans pièce.';

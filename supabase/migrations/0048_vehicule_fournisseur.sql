-- ============================================================================
-- SEDIMA Parc — 0048 : chez qui le véhicule a été acheté.
--
-- Le formulaire de création demandait le fournisseur depuis le 7 septembre ;
-- la table n'avait pas de colonne pour lui, et il se perdait à
-- l'enregistrement. Le champ a été retiré le 14 septembre plutôt que de
-- continuer à mentir, et le métier a tranché le même jour : **il mérite sa
-- colonne**.
--
-- Deux colonnes, comme partout ailleurs où l'application nomme un fournisseur
-- (`depense`, `piece`, `demande_achat`) : le lien vers le référentiel quand il
-- le connaît, et le nom en clair sinon. Un concessionnaire qui n'a vendu qu'un
-- camion n'a pas à entrer au référentiel des prestataires pour être cité.
--
-- Le lien s'appelle `fournisseur_id` et non `prestataire_id` : sur un véhicule,
-- « prestataire » serait ambigu — un camion fréquente dix garages au long de sa
-- vie, mais n'a été vendu que par un.
-- ============================================================================

alter table vehicule add column if not exists fournisseur_id uuid references prestataire (id);
alter table vehicule add column if not exists fournisseur    text;

comment on column vehicule.fournisseur_id is 'Le vendeur du véhicule, quand il est au référentiel des prestataires.';
comment on column vehicule.fournisseur    is 'Son nom en clair : ce que la saisie a écrit, y compris quand le référentiel ne le connaît pas.';

create index if not exists vehicule_fournisseur_idx on vehicule (fournisseur_id) where fournisseur_id is not null;

-- ============================================================================
-- SEDIMA Parc — 0022 : les demandes d'achat.
--
-- La demande d'achat (numéro DAC) cite la transaction qui la motive —
-- observation de visite, intervention, incident — et suit un circuit : visa
-- du parc, validation de la direction au-delà du seuil, puis ce que Sage X3
-- sait déjà et qu'on relève sans le ressaisir — la DA, le bon de commande et
-- son montant engagé, la livraison, la facture et son montant réel, le
-- règlement (décision du métier du 3 septembre 2026 : l'application ne
-- remplace pas X3, elle rattache et elle suit). Chaque décision est une
-- modification tracée, comme les autres transactions.
--
-- Qui fait quoi : la caisse et les achats vivent dans le module « couts » —
-- lecture pour voir, saisie pour demander et décider ; les rôles qui
-- décident d'une étape sont ceux du domaine (ROLE_DECIDEUR), contrôlés par
-- l'application, la table gardant qui a visé et validé.
-- ============================================================================

create table if not exists demande_achat (
  id                   uuid primary key default gen_random_uuid(),
  numero               text not null unique,
  date                 date not null,
  objet                text not null,
  poste                poste_depense not null default 'divers',
  montant_estime       bigint not null check (montant_estime >= 0),
  prestataire_id       uuid references prestataire (id),
  -- Le fournisseur en clair quand il n'est pas encore dans le référentiel.
  fournisseur          text,
  urgence              text not null default 'normale' check (urgence in ('normale', 'urgente', 'immobilisation')),
  origine_numero       text not null,
  origine_libelle      text,
  vehicule_id          uuid references vehicule (id) on delete set null,
  demandeur_nom        text,
  demandeur_role       role_applicatif,
  etape                text not null default 'soumise' check (etape in ('soumise', 'visee', 'validee', 'commandee', 'livree', 'facturee', 'reglee', 'refusee')),
  visa_par             text,
  visa_le              date,
  valide_par           text,
  validee_le           date,
  numero_demande_x3    text,
  numero_bon_commande  text,
  montant_engage       bigint,
  date_livraison       date,
  date_facture         date,
  montant_reel         bigint,
  date_reglement       date,
  -- La dépense DEP portée par le véhicule pour ce coût, quand elle existe.
  depense_numero       text,
  commentaire_decision text,
  cree_le              timestamptz not null default now(),
  cree_par             uuid references auth.users (id),
  modifie_le           timestamptz,
  modifie_par          uuid references auth.users (id)
);
create index on demande_achat (date);
create index on demande_achat (vehicule_id);
create index on demande_achat (prestataire_id);
create index on demande_achat (etape) where etape not in ('reglee', 'refusee');
comment on table demande_achat is 'Une demande d''achat : ce qui la motive, son circuit de validation, et ce que Sage X3 en sait (DA, bon, livraison, facture, règlement).';

alter table demande_achat enable row level security;

-- Une demande se voit avec la caisse ; celle d'un véhicule, si l'on voit le véhicule.
create policy lecture_achat on demande_achat for select using (
  (select peut('couts', 'lecture')) and (vehicule_id is null or vehicule_id in (select id from vehicule))
);
create policy ecriture_achat on demande_achat for all using ((select peut('couts', 'saisie'))) with check ((select peut('couts', 'saisie')));

-- ============================================================================
-- SEDIMA Parc — mise à jour du 23 septembre 2026 : statuts, chauffeurs.
--
-- **Ce n'est pas une migration.** Rapprochement de la base avec :
--
--   * la « FICHE COMPLET VEHICULES PARC LIVRAISONS ET PERSONNELS » (dossier DO,
--     61. Gestion Parc/MALICK), enregistrée le 23/09/2026 à 08 h 41 ;
--   * la « LISTE DES CHAUFFEURS SEDIMA » (même dossier, 22/09/2026) ;
--   * les points quotidiens de disponibilité de Jacques Louis Baye (mails du
--     10 au 23/09) : « Ndoye et Bathie en réparation » depuis le 16/09 au plus
--     tard, Ndoye dès le 10/09.
--
-- Ne sont repris que les écarts **francs**. Les différences de nommage
-- (« DIA SECURITE » pour Moussa Dia, un pool pour une personne…) et les cas
-- ambigus sont laissés au métier : voir docs/MISE-A-JOUR-2026-09-23.md.
--
-- Chaque changement de statut laisse sa trace dans `modification`, comme un
-- changement fait dans l'application : c'est elle qui date l'immobilisation
-- sur le tableau de bord. La date est celle où la source constate l'état.
--
-- REJOUABLE : un statut ne change que s'il vaut encore l'ancienne valeur ; la
-- trace ne s'écrit que pour ce qui a changé.
-- ============================================================================

begin;

-- 1. Les statuts ---------------------------------------------------------------
with source (immatriculation, avant, apres, le, motif) as (
  values
    -- Au garage d'après la fiche du 23/09 — « en réparation ».
    ('AA105VA', 'en-service', 'en-reparation', timestamptz '2026-09-10 08:00+00', 'Dépannage au garage Djily Dalifort (fiche parc du 23/09 ; « Ndoye en réparation » dès le 10/09)'),
    ('AA285PT', 'en-service', 'en-reparation', timestamptz '2026-09-16 08:00+00', 'Dépannage garage Daniel (fiche parc du 23/09 ; « Bathie en réparation » dès le 16/09)'),
    ('AA180CQ', 'en-service', 'en-reparation', timestamptz '2026-09-23 08:00+00', 'Changement du groupe à ANEC Energy (fiche parc du 23/09)'),
    ('AA186CQ', 'en-service', 'en-reparation', timestamptz '2026-09-23 08:00+00', 'Réparation garage Daniel (fiche parc du 23/09)'),
    ('AA291PT', 'en-service', 'en-reparation', timestamptz '2026-09-23 08:00+00', 'Entretien général chez TATA (fiche parc du 23/09)'),
    ('AA350JN', 'en-service', 'en-reparation', timestamptz '2026-09-23 08:00+00', 'Réparation de boîte en cours (fiche parc du 23/09)'),
    ('AA226SX', 'en-service', 'en-reparation', timestamptz '2026-09-23 08:00+00', 'Entretien général à Keur Massar (fiche parc du 23/09)'),
    ('AA927CA', 'en-service', 'en-reparation', timestamptz '2026-09-23 08:00+00', 'Changement moteur garage Daniel (fiche parc du 23/09)'),
    ('AB364HK', 'hors-service', 'en-reparation', timestamptz '2026-09-23 08:00+00', 'Changement moteur à Thiès (fiche parc du 23/09)'),
    -- Arrêtés sans garage nommé — « hors service ».
    ('AA053AP', 'en-service', 'hors-service', timestamptz '2026-09-23 08:00+00', 'Visite technique à passer (fiche parc du 23/09)'),
    ('AA905CW', 'en-service', 'hors-service', timestamptz '2026-09-23 08:00+00', 'Hors service d''après la fiche parc du 23/09'),
    ('DK5680BL', 'en-service', 'hors-service', timestamptz '2026-09-23 08:00+00', 'Panne à définir après diagnostic du mécanicien (fiche parc du 23/09)'),
    -- Revenus en service d'après la fiche du 23/09.
    ('AA568GA', 'en-reparation', 'en-service', timestamptz '2026-09-23 08:00+00', 'En service d''après la fiche parc du 23/09'),
    ('AB681HE', 'en-reparation', 'en-service', timestamptz '2026-09-23 08:00+00', 'En service d''après la fiche parc du 23/09'),
    ('AA433AJ', 'en-reparation', 'en-service', timestamptz '2026-09-23 08:00+00', 'En service d''après la fiche parc du 23/09 (non affecté)'),
    ('DK8077BD', 'en-reparation', 'en-service', timestamptz '2026-09-23 08:00+00', 'En service d''après la fiche parc du 23/09'),
    ('AA278JE', 'en-reparation', 'en-service', timestamptz '2026-09-23 08:00+00', 'En service d''après la fiche parc du 23/09'),
    ('DK4922BB', 'en-reparation', 'en-service', timestamptz '2026-09-23 08:00+00', 'En service d''après la fiche parc du 23/09'),
    ('DK5347BM', 'hors-service', 'en-service', timestamptz '2026-09-23 08:00+00', 'En service d''après la fiche parc du 23/09'),
    ('AA547JD', 'hors-service', 'en-service', timestamptz '2026-09-23 08:00+00', 'En service d''après la fiche parc du 23/09'),
    ('AA139HP', 'hors-service', 'en-service', timestamptz '2026-09-23 08:00+00', 'En service d''après la fiche parc du 23/09 (Almadies)'),
    ('AB741AP', 'en-restauration', 'en-service', timestamptz '2026-09-23 08:00+00', 'En service, affecté aux missions du personnel (fiche parc du 23/09)')
),
maj as (
  update vehicule v
     set statut = s.apres::statut_vehicule, modifie_le = now()
    from source s
   where v.immatriculation = s.immatriculation
     and v.statut::text = s.avant
  returning v.immatriculation, s.avant, s.apres, s.le, s.motif
)
insert into modification (table_cible, numero, champ, libelle_champ, avant, apres, motif, statut, cree_le, cree_par)
select 'vehicule', m.immatriculation, 'statut', 'Statut', m.avant, m.apres, m.motif, 'appliquee', m.le,
       (select utilisateur_id from profil where role = 'administrateur' and actif order by nom limit 1)
  from maj m;

-- 2. Les chauffeurs --------------------------------------------------------------
-- Matricules RH définitifs à la place des numéros provisoires « SED-… ».
update chauffeur c set matricule_rh = s.matricule, modifie_le = now()
  from (values ('SED-2408', '98475'), ('SED-3243', '98474'), ('SED-2549', '98469'),
               ('SED-2940', '98493'), ('SED-3069', '98476'), ('SED-2247', '98468')) as s (provisoire, matricule)
 where c.matricule_rh = s.provisoire
   and not exists (select 1 from chauffeur x where x.matricule_rh = s.matricule);

-- Passés en CDI d'après la liste du 22/09.
update chauffeur set contrat = 'cdi', modifie_le = now()
 where matricule_rh in ('98403', '98452') and contrat = 'cdd';

-- Deux chauffeurs de la liste du 22/09 qui n'étaient pas en base.
insert into chauffeur (matricule_rh, prenom, nom, contrat)
select s.matricule, s.prenom, s.nom, 'cdi'
  from (values ('98376', 'El Hadji', 'Dabo'), ('99697', 'Khadim', 'Sène')) as s (matricule, prenom, nom)
 where not exists (select 1 from chauffeur c where c.matricule_rh = s.matricule);

-- 3. DK 1306 BB ----------------------------------------------------------------
-- **Retiré le 23/09 au soir.** La première version créait DK 1306 BB, lu sur la
-- fiche parc ; c'était un doublon : le véhicule est en base sous sa nouvelle
-- plaque AB 098 JC (carte grise du 06/05/2026). Voir correctif-dk1306bb.sql,
-- qui rattache ses pleins et supprime le doublon.

commit;

-- Contrôle
select immatriculation, statut from vehicule
 where immatriculation in ('AA105VA', 'AA285PT', 'AA180CQ', 'AA186CQ', 'AA291PT', 'AA350JN', 'AA226SX', 'AA927CA', 'AB364HK',
                           'AA053AP', 'AA905CW', 'DK5680BL', 'AA568GA', 'AB681HE', 'AA433AJ', 'DK8077BD', 'AA278JE', 'DK4922BB',
                           'DK5347BM', 'AA547JD', 'AA139HP', 'AB741AP')
 order by statut, immatriculation;

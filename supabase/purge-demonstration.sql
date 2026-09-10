-- ============================================================================
-- SEDIMA Parc — purger les transactions fabriquées, garder le référentiel.
--
-- **Ce fichier n'est pas une migration.** Il ne se joue pas tout seul et ne
-- s'ajoute pas à la suite : c'est un geste que l'on pose une fois, en
-- connaissance de cause, quand on décide que la base ne portera plus que du
-- réel. Il efface des lignes ; rien ne les ramène sinon un rejeu du seed.
--
-- Pourquoi il existe. Le jeu de départ mêle deux matières que rien ne
-- distingue à l'œil (voir `docs/DONNEES-REELLES.md`) : un **référentiel réel**
-- — véhicules, chauffeurs, sites, prestataires, plans d'entretien, budget,
-- saisis depuis les listes du dossier DO — et des **transactions tirées au
-- sort** : des pleins qui n'ont jamais eu lieu, des dépenses que personne n'a
-- payées, des incidents qui ne se sont pas produits. Les écrans les montrent
-- comme des faits.
--
-- MODE D'EMPLOI, dans cet ordre :
--   1. jouer la PARTIE 1 seule, et lire ce qu'elle compte ;
--   2. si le compte correspond à ce que l'on croit effacer, jouer la PARTIE 2 ;
--   3. jouer la PARTIE 3 pour vérifier ce qui reste.
--
-- Ce que la purge NE touche PAS : `vehicule`, `chauffeur`, `site`,
-- `prestataire`, `affectation`, le parc léger, les licences, les plans
-- d'entretien, le référentiel des transporteurs, les enveloppes du budget,
-- les comptes et leurs accès, les paramètres. Et **les documents
-- d'assurance**, qui viennent de la police 2026 et sont donc réels.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PARTIE 1 — l'inventaire. Lecture seule : rien n'est effacé ici.
-- ---------------------------------------------------------------------------

select 'À EFFACER' as sort, t.table_name as table, n.compte
  from (values
    ('releve_kilometrique'), ('plein'), ('depense'), ('intervention'), ('incident'),
    ('mouvement_caisse'), ('mouvement_cuve'), ('demande_achat'),
    ('releve_transport'), ('affretement'), ('mise_a_disposition'), ('prestation'),
    ('ordre_travail'), ('visite_technique'), ('observation_visite'),
    ('demande'), ('transfert'), ('message'), ('notification'),
    ('mouvement_stock'), ('pneu'), ('piece'),
    ('avance_prestataire'), ('evaluation_prestataire'),
    ('sanction'), ('indisponibilite'), ('modification')
  ) as t(table_name)
  cross join lateral (select (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I', t.table_name), false, true, '')))[1]::text::int as compte) n
union all
select 'À GARDER', t.table_name, n.compte
  from (values
    ('vehicule'), ('chauffeur'), ('site'), ('prestataire'), ('affectation'),
    ('attributaire'), ('attribution_legere'), ('forfait_carburant'), ('vehicule_a_recevoir'),
    ('licence_transport'), ('licence_vehicule'), ('programme_entretien'), ('operation_entretien'),
    ('plan_vehicule'), ('profil_transporteur'), ('camion_tiers'), ('chauffeur_tiers'),
    ('ligne_tarif'), ('tarif_journalier'), ('rattachement_localite'), ('enveloppe'),
    ('acces_utilisateur'), ('profil'), ('parametre'), ('type_document'), ('document')
  ) as t(table_name)
  cross join lateral (select (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I', t.table_name), false, true, '')))[1]::text::int as compte) n
order by sort desc, compte desc;

-- Le détail des documents, qui sont la seule table partagée entre les deux
-- matières : l'assurance vient de la police 2026, le reste est fabriqué.
select type_document_id as type, count(*) as compte,
       case when type_document_id = 'assurance' then 'GARDÉ — police 2026' else 'à effacer' end as sort
  from document group by type_document_id order by compte desc;

-- ---------------------------------------------------------------------------
-- PARTIE 2 — la purge. À ne jouer qu'après avoir lu la partie 1.
--
-- L'ordre suit les dépendances : ce qui cite passe avant ce qui est cité. Le
-- tout dans une transaction — si une ligne résiste, rien n'est effacé.
-- ---------------------------------------------------------------------------

begin;

-- Ce qui ne cite que des transactions.
delete from observation_visite;
delete from evaluation_prestataire;
delete from avance_prestataire;
delete from mouvement_stock;
delete from pneu;
delete from piece;
delete from notification;
delete from message;

-- Le journal des modifications : la trace d'écritures qui n'ont pas eu lieu.
delete from modification;

-- Le transport confié à des tiers.
delete from prestation;
delete from mise_a_disposition;
delete from affretement;
delete from releve_transport;

-- Les faits du parc.
delete from demande;
delete from transfert;
delete from demande_achat;
delete from ordre_travail;
delete from visite_technique;
delete from incident;
delete from intervention;
delete from depense;
delete from plein;
delete from releve_kilometrique;
delete from mouvement_caisse;
delete from mouvement_cuve;

-- Les faits qui touchent les chauffeurs.
delete from sanction;
delete from indisponibilite;

-- Les documents, sauf l'assurance : elle vient de la police 2026, elle est
-- réelle, et l'effacer déclarerait le parc non assuré.
delete from document where type_document_id <> 'assurance';

commit;

-- ---------------------------------------------------------------------------
-- PARTIE 3 — ce qui reste. Rejouer la partie 1 : la colonne « À EFFACER »
-- doit être à zéro partout, sauf `document` qui garde ses assurances, et la
-- colonne « À GARDER » ne doit pas avoir bougé.
-- ---------------------------------------------------------------------------

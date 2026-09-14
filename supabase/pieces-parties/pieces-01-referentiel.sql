-- ============================================================================
-- SEDIMA Parc — les premières pièces du magasin.
--
-- **Ce n'est pas une migration.** 3 pièces : les deux formats de batterie
-- que le parc achète, et le kit d'embrayage des Tata LPT 1618.
-- Sources : SUIVI BATTERIES et FICHE SUIVI DISQUE TATA (dossier DO), et les
-- bons BC17695, BC18521 et BC18812 du référentiel des achats.
-- Voir docs/PIECES-REELLES.md.
--
-- Aucun seuil de réapprovisionnement n'est posé : les classeurs n'en donnent
-- pas, et un minimum inventé déclencherait de fausses demandes d'achat.
--
-- À jouer après maintenance-parties/maintenance-01-prestataires.sql : c'est lui
-- qui porte SICAS, ETS MALEYE et TATA INTERNATIONAL / UNITECH, que chaque
-- fiche rattache par sa raison sociale.
--
-- REJOUABLE : `on conflict do nothing`.
-- ============================================================================

insert into piece (numero, reference, designation, categorie, unite, compatibilites, prestataire_id, fournisseur, prix_reference, commentaire)
values
  ('PCE-R-001', 'BAT-150AH', 'Batterie 150 AH', 'electricite', 'piece', array['Poids lourds']::text[], (select id from prestataire where upper(regexp_replace(raison_sociale, '[^A-Za-z0-9]', '', 'g')) = 'SICAS' limit 1), 'SICAS', 162148, 'Batterie de poids lourd, la plus courante du parc. Prix de référence : le prix unitaire du classeur de suivi (162 148 F). Achetée chez SICAS et chez ETS MALEYE.'),
  ('PCE-R-002', 'BAT-100AH', 'Batterie 100 AH', 'electricite', 'piece', array['Véhicules légers', 'Poids lourds']::text[], (select id from prestataire where upper(regexp_replace(raison_sociale, '[^A-Za-z0-9]', '', 'g')) = 'SICAS' limit 1), 'SICAS', 100061, 'Prix de référence : le prix unitaire du classeur de suivi (100 061 F). Achetée chez SICAS et chez ETS MALEYE.'),
  ('PCE-R-003', 'EMB-TATA-1618', 'Kit d''embrayage Tata LPT 1618 — disque, plateau, butée', 'transmission', 'jeu', array['Tata LPT 1618']::text[], (select id from prestataire where upper(regexp_replace(raison_sociale, '[^A-Za-z0-9]', '', 'g')) = 'TATAINTERNATIONALUNITECH' limit 1), 'TATA INTERNATIONAL / UNITECH', 307862, 'Le classeur écrit « DISQUE PLATEAU BITE » ; le bon BC18812 dit « DISQUE, PLATEAU ET BUTEE POUR LES TATA LPT1618 EN GUISE DE RESERVE ». Prix de référence : 1 539 310 F pour cinq jeux, soit 307 862 F le jeu.')
on conflict (numero) do nothing;

-- ---------------------------------------------------------------------------
-- Vérification : les pièces entrées.
-- ---------------------------------------------------------------------------

select numero, reference, designation, categorie, unite, fournisseur, prix_reference from piece where numero like 'PCE-R-%' order by numero;

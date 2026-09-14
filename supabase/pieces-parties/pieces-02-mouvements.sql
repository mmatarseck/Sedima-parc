-- ============================================================================
-- SEDIMA Parc — le journal du magasin : batteries et embrayages Tata.
--
-- **Ce n'est pas une migration.** 58 mouvements, du 2025-02-04 au 2026-07-01 :
-- 20 entrées, 36 sorties toutes rattachées à leur véhicule,
-- et 2 régularisations.
-- Sources : SUIVI BATTERIES et FICHE SUIVI DISQUE TATA (dossier DO).
-- Voir docs/PIECES-REELLES.md.
--
-- Le magasin n'était pas tenu : les classeurs suivent l'achat et la pose. Une
-- batterie montée est donc entrée puis sortie le même jour, et le motif de
-- l'entrée le dit. Seules la campagne BC17695 (20 batteries 150 AH et 10 de
-- 100 AH reçues) et l'achat Tata BC18812 (5 jeux « en guise de réserve »)
-- annoncent une quantité reçue : ce qu'elles n'ont pas distribué est le stock.
--
-- Les régularisations retirent du magasin les pièces d'une campagne remises à
-- un véhicule que le référentiel ne connaît pas, ou que le classeur ne nomme
-- pas : leur entrée vaut pour tout le bon et ne peut pas s'annuler, mais la
-- pièce n'est plus au magasin. Chacune nomme son cas.
--
-- Stock déduit au terme du journal : BAT-150AH 1, BAT-100AH 0, EMB-TATA-1618 3.
--
-- À jouer après pieces-01-referentiel.sql, et après vehicules-manquants.sql.
--
-- REJOUABLE : `on conflict do nothing`.
-- ============================================================================

insert into mouvement_stock (numero, date, nature, piece_id, quantite, ecart, prix_unitaire, demande_numero, vehicule_id, fournisseur, motif, auteur_nom)
select v.numero, v.date::date, v.nature, p.id, v.quantite, v.ecart, v.prix_unitaire, v.demande_numero, ve.id, v.fournisseur, v.motif, 'Chargement des classeurs de suivi'
  from (values
    ('MVT-R-00001', '2025-02-04', 'entree', 'PCE-R-001', 20, null, null, 'BC17695 / DA20021', null, 'ETS MALEYE', 'Réception de la campagne BC17695, telle que le classeur l''annonce. Le bon (4 février 2025, ETS MALEYE) couvre aussi des pneus : son montant ne se rapporte pas aux seules batteries.'),
    ('MVT-R-00002', '2025-02-04', 'entree', 'PCE-R-002', 10, null, null, 'BC17695 / DA20021', null, 'ETS MALEYE', 'Réception de la campagne BC17695, telle que le classeur l''annonce. Le bon (4 février 2025, ETS MALEYE) couvre aussi des pneus : son montant ne se rapporte pas aux seules batteries.'),
    ('MVT-R-00003', '2025-02-09', 'sortie', 'PCE-R-001', 1, null, null, 'BC17695 / DA20021', 'AA277PT', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »).'),
    ('MVT-R-00004', '2025-02-09', 'sortie', 'PCE-R-002', 2, null, null, 'BC17695 / DA20021', 'AA301PT', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »).'),
    ('MVT-R-00005', '2025-02-09', 'sortie', 'PCE-R-002', 1, null, null, 'BC17695 / DA20021', 'DK2347BD', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »). Date de remise non relevée au classeur : celle de la ligne datée qui précède.'),
    ('MVT-R-00006', '2025-02-10', 'sortie', 'PCE-R-002', 1, null, null, 'BC17695 / DA20021', 'AA180CQ', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »).'),
    ('MVT-R-00007', '2025-02-10', 'sortie', 'PCE-R-002', 1, null, null, 'BC17695 / DA20021', 'DK3454BD', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »). Date de remise non relevée au classeur : celle de la ligne datée qui précède.'),
    ('MVT-R-00008', '2025-02-10', 'sortie', 'PCE-R-002', 1, null, null, 'BC17695 / DA20021', 'AA856FG', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »). Date de remise non relevée au classeur : celle de la ligne datée qui précède.'),
    ('MVT-R-00009', '2025-02-10', 'sortie', 'PCE-R-002', 2, null, null, 'BC17695 / DA20021', 'AA053AP', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »). Date de remise non relevée au classeur : celle de la ligne datée qui précède.'),
    ('MVT-R-00010', '2025-02-10', 'sortie', 'PCE-R-002', 1, null, null, 'BC17695 / DA20021', 'DK4740BH', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »). Date de remise non relevée au classeur : celle de la ligne datée qui précède.'),
    ('MVT-R-00011', '2025-02-10', 'regularisation', 'PCE-R-002', 1, -1, null, null, null, null, 'Remise de la campagne BC17695 à DK 3674 AX, plaque hors référentiel : la sortie ne peut être rattachée à aucun véhicule, et l''entrée du bon vaut pour la campagne entière. L''écart la retire du magasin sans l''imputer. Date de remise non relevée au classeur : celle de la ligne datée qui précède.'),
    ('MVT-R-00012', '2025-02-11', 'sortie', 'PCE-R-001', 2, null, null, 'BC17695 / DA20021', 'AA105VA', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »).'),
    ('MVT-R-00013', '2025-02-12', 'sortie', 'PCE-R-001', 2, null, null, 'BC17695 / DA20021', 'AA985MR', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »).'),
    ('MVT-R-00014', '2025-02-13', 'sortie', 'PCE-R-001', 2, null, null, 'BC17695 / DA20021', 'AA927CA', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »).'),
    ('MVT-R-00015', '2025-02-18', 'sortie', 'PCE-R-001', 2, null, null, 'BC17695 / DA20021', 'AA105VA', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »).'),
    ('MVT-R-00016', '2025-02-26', 'sortie', 'PCE-R-001', 2, null, null, 'BC17695 / DA20021', 'AA350JN', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »).'),
    ('MVT-R-00017', '2025-02-27', 'sortie', 'PCE-R-001', 1, null, null, 'BC17695 / DA20021', 'AA920VA', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »).'),
    ('MVT-R-00018', '2025-02-27', 'sortie', 'PCE-R-001', 2, null, null, 'BC17695 / DA20021', 'AA226SX', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »).'),
    ('MVT-R-00019', '2025-02-27', 'sortie', 'PCE-R-001', 2, null, null, 'BC17695 / DA20021', 'AA565GA', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »). Date de remise non relevée au classeur : celle de la ligne datée qui précède.'),
    ('MVT-R-00020', '2025-02-27', 'sortie', 'PCE-R-001', 2, null, null, 'BC17695 / DA20021', 'AA977MR', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »). Date de remise non relevée au classeur : celle de la ligne datée qui précède.'),
    ('MVT-R-00021', '2025-02-27', 'sortie', 'PCE-R-001', 1, null, null, 'BC17695 / DA20021', 'AA768JV', null, 'Remise de la campagne BC17695, d''après SUIVI BATTERIES (feuille « BC17695 »). Date de remise non relevée au classeur : celle de la ligne datée qui précède.'),
    ('MVT-R-00022', '2025-07-05', 'entree', 'PCE-R-001', 2, null, 162148, 'BC18521 / DA20846', null, 'SICAS', 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Achetée au bon BC18521 / DA20846 (SICAS).'),
    ('MVT-R-00023', '2025-07-05', 'sortie', 'PCE-R-001', 2, null, null, 'BC18521 / DA20846', 'AA093VA', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »).'),
    ('MVT-R-00024', '2025-07-07', 'entree', 'PCE-R-001', 2, null, 162148, null, null, null, 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Le classeur ne nomme pas le bon de cet achat.'),
    ('MVT-R-00025', '2025-07-07', 'sortie', 'PCE-R-001', 2, null, null, null, 'AA633JL', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »).'),
    ('MVT-R-00026', '2025-07-18', 'entree', 'PCE-R-002', 1, null, 100061, null, null, null, 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Le classeur ne nomme pas le bon de cet achat.'),
    ('MVT-R-00027', '2025-07-18', 'sortie', 'PCE-R-002', 1, null, null, null, 'AA433AJ', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »).'),
    ('MVT-R-00028', '2025-07-21', 'entree', 'PCE-R-001', 2, null, 162148, null, null, null, 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Le classeur ne nomme pas le bon de cet achat.'),
    ('MVT-R-00029', '2025-07-21', 'sortie', 'PCE-R-001', 2, null, null, null, 'AA291PT', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »).'),
    ('MVT-R-00030', '2025-07-23', 'entree', 'PCE-R-002', 1, null, 100061, null, null, null, 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Le classeur ne nomme pas le bon de cet achat.'),
    ('MVT-R-00031', '2025-07-23', 'sortie', 'PCE-R-002', 1, null, null, null, 'AA139HP', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »).'),
    ('MVT-R-00032', '2025-08-29', 'entree', 'PCE-R-003', 5, null, 307862, 'BC18812 / DA21232', null, 'TATA INTERNATIONAL / UNITECH', 'Achat du bon BC18812 (29 août 2025, TATA INTERNATIONAL / UNITECH), « en guise de réserve » : cinq jeux à 307 862 F.'),
    ('MVT-R-00033', '2025-08-29', 'sortie', 'PCE-R-003', 1, null, null, 'BC18812 / DA21232', 'AA565GA', null, 'Monté sur le véhicule, d''après FICHE SUIVI DISQUE TATA (« MONTE A TATA »). Date de montage non relevée au classeur : celle du bon d''achat.'),
    ('MVT-R-00034', '2025-08-29', 'regularisation', 'PCE-R-003', 1, -1, null, null, null, null, 'Jeu monté d''après FICHE SUIVI DISQUE TATA, sur un véhicule que le classeur ne nomme pas : la sortie ne peut être rattachée, et l''entrée du bon vaut pour les cinq jeux. L''écart le retire du magasin sans l''imputer. Date non relevée : celle du bon d''achat.'),
    ('MVT-R-00035', '2025-09-15', 'entree', 'PCE-R-001', 1, null, 162148, null, null, null, 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Le classeur ne nomme pas le bon de cet achat.'),
    ('MVT-R-00036', '2025-09-15', 'sortie', 'PCE-R-001', 1, null, null, null, 'AA977MR', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »).'),
    ('MVT-R-00037', '2025-12-04', 'entree', 'PCE-R-001', 2, null, 162148, 'BC400 / DA1023', null, 'SICAS', 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Achetée au bon BC400 / DA1023 (SICAS).'),
    ('MVT-R-00038', '2025-12-04', 'sortie', 'PCE-R-001', 2, null, null, 'BC400 / DA1023', 'AA235MR', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »).'),
    ('MVT-R-00039', '2025-12-08', 'entree', 'PCE-R-001', 2, null, 162148, null, null, null, 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Le classeur ne nomme pas le bon de cet achat.'),
    ('MVT-R-00040', '2025-12-08', 'sortie', 'PCE-R-001', 2, null, null, null, 'AA093VA', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »).'),
    ('MVT-R-00041', '2026-01-01', 'entree', 'PCE-R-001', 2, null, 162148, null, null, null, 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Le classeur ne nomme pas le bon de cet achat.'),
    ('MVT-R-00042', '2026-01-01', 'entree', 'PCE-R-001', 2, null, 162148, null, null, null, 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Le classeur ne nomme pas le bon de cet achat. Date de montage non relevée au classeur : celle de la ligne datée qui précède.'),
    ('MVT-R-00043', '2026-01-01', 'sortie', 'PCE-R-001', 2, null, null, null, 'AA985MR', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »).'),
    ('MVT-R-00044', '2026-01-01', 'sortie', 'PCE-R-001', 2, null, null, null, 'AA768JV', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »). Date de montage non relevée au classeur : celle de la ligne datée qui précède.'),
    ('MVT-R-00045', '2026-01-14', 'entree', 'PCE-R-001', 2, null, 162148, null, null, null, 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Le classeur ne nomme pas le bon de cet achat. Date de montage non relevée au classeur : celle de la ligne datée qui précède.'),
    ('MVT-R-00046', '2026-01-14', 'sortie', 'PCE-R-001', 2, null, null, null, 'AA236MR', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »). Date de montage non relevée au classeur : celle de la ligne datée qui précède.'),
    ('MVT-R-00047', '2026-04-18', 'entree', 'PCE-R-001', 2, null, null, null, null, null, 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Le classeur ne nomme pas le bon de cet achat.'),
    ('MVT-R-00048', '2026-04-18', 'entree', 'PCE-R-001', 1, null, null, null, null, null, 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Le classeur ne nomme pas le bon de cet achat.'),
    ('MVT-R-00049', '2026-04-18', 'entree', 'PCE-R-001', 2, null, null, null, null, null, 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Le classeur ne nomme pas le bon de cet achat.'),
    ('MVT-R-00050', '2026-04-18', 'sortie', 'PCE-R-001', 2, null, null, null, 'AA977MR', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »).'),
    ('MVT-R-00051', '2026-04-18', 'sortie', 'PCE-R-001', 1, null, null, null, 'AA359AH', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »).'),
    ('MVT-R-00052', '2026-04-18', 'sortie', 'PCE-R-001', 2, null, null, null, 'AA768JV', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »).'),
    ('MVT-R-00053', '2026-05-01', 'entree', 'PCE-R-001', 2, null, null, null, null, null, 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Le classeur ne nomme pas le bon de cet achat.'),
    ('MVT-R-00054', '2026-05-01', 'sortie', 'PCE-R-001', 2, null, null, null, 'AA235MR', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »).'),
    ('MVT-R-00055', '2026-06-01', 'entree', 'PCE-R-001', 2, null, null, null, null, null, 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Le classeur ne nomme pas le bon de cet achat.'),
    ('MVT-R-00056', '2026-06-01', 'sortie', 'PCE-R-001', 2, null, null, null, 'AA633JL', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »).'),
    ('MVT-R-00057', '2026-07-01', 'entree', 'PCE-R-001', 2, null, null, null, null, null, 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Le classeur ne nomme pas le bon de cet achat.'),
    ('MVT-R-00058', '2026-07-01', 'sortie', 'PCE-R-001', 2, null, null, null, 'AA905CW', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »).')
  ) as v(numero, date, nature, piece_numero, quantite, ecart, prix_unitaire, demande_numero, immatriculation, fournisseur, motif)
  join piece p on p.numero = v.piece_numero
  left join vehicule ve on ve.immatriculation = v.immatriculation
on conflict (numero) do nothing;

-- ---------------------------------------------------------------------------
-- Vérification : le stock déduit, pièce par pièce.
-- ---------------------------------------------------------------------------

select p.reference, p.designation,
       sum(case m.nature when 'entree' then m.quantite when 'sortie' then -m.quantite else coalesce(m.ecart, 0) end) as stock,
       count(*) filter (where m.nature = 'entree') as entrees,
       count(*) filter (where m.nature = 'sortie') as sorties,
       count(*) filter (where m.nature = 'regularisation') as regularisations,
       count(distinct m.vehicule_id) as vehicules,
       min(m.date) as premier, max(m.date) as dernier
  from piece p join mouvement_stock m on m.piece_id = p.id
 where m.numero like 'MVT-R-%' group by 1, 2 order by 1;

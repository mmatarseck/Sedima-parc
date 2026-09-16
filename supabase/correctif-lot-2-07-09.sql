-- ============================================================================
-- SEDIMA Parc — les lots 2 - 07 et 2 - 09 ne sont plus attendus.
--
-- **Ce n'est pas une migration.** Deux lignes effacées, à la demande du métier
-- du 16 septembre 2026 : « supprimer les véhicules Lot 2 - 07 et 09 — à
-- immatriculer ».
--
-- CE QUE C'EST. Pas des véhicules : des **attentes**. La table
-- `vehicule_a_recevoir` (0004) tient les véhicules commandés et pas encore
-- livrés ; la liste Flotte les affiche « Lot 2 - NN — à immatriculer » tant
-- qu'aucune plaque ne leur est rattachée. Le lot 2, c'est quinze pick-up
-- commandés fin 2025 ; treize ont reçu leur plaque (`correctif-lot-2.sql`,
-- 14 septembre). Les lots 07 et 09 restaient en attente : aucun véhicule neuf
-- n'est arrivé pour eux, et la question posée au métier le 14 septembre
-- trouve ici sa réponse — ils ne viendront pas.
--
-- CE QU'ELLES PORTENT. Lues le 16 septembre sur la base :
--   * Lot 2 - 07 — Mitsubishi L200 DC, régime fonction, business unit
--     commercial, attendu pour Amadou Yoro Ba, « Libère AA397JG pour Alioune
--     Diop » ;
--   * Lot 2 - 09 — Mitsubishi L200 DC, régime service, business unit
--     commercial, attendu pour Pape Bouba Gaye, « Libère AA131EX pour le
--     transport de poussins ».
-- Ni `vehicule_id`, ni `recu_le` : rien n'a jamais été reçu sous ces lots.
-- Aucune table ne référence `vehicule_a_recevoir` par clé étrangère — la
-- ligne ne tient rien d'autre qu'elle-même. Les deux attributaires gardent
-- leur fiche et leur véhicule actuel : la seule chose qui disparaît, c'est la
-- promesse qu'un autre allait le remplacer.
--
-- POURQUOI EFFACER PLUTÔT QUE « RECEVOIR ». Une attente se ferme en la
-- rattachant au véhicule reçu. Ici il n'y a rien à rattacher : fermer la ligne
-- avec une date de réception affirmerait une livraison qui n'a pas eu lieu.
-- Le métier demande que ces deux lignes n'y soient plus.
--
-- LE GARDE-FOU. La suppression ne touche que les deux lots nommés, et
-- seulement s'ils sont encore sans véhicule et sans date de réception. Si
-- l'un des deux a été rattaché depuis cette lecture, il reste — le fichier le
-- dit en partie 3.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PARTIE 1 — l'inventaire. Lecture seule : rien n'est effacé ici.
-- ---------------------------------------------------------------------------

select r.id, r.lot, r.marque, r.modele, r.categorie::text as categorie, r.regime::text as regime,
       r.business_unit::text as business_unit, r.commentaire,
       (select a.nom || coalesce(' — ' || a.fonction, '') from attributaire a where a.id = r.attributaire_id) as attendu_pour,
       r.recu_le, r.vehicule_id, r.cree_le::timestamp(0) as saisie
  from vehicule_a_recevoir r
 where r.lot in ('Lot 2 - 07', 'Lot 2 - 09')
 order by r.lot;

-- ---------------------------------------------------------------------------
-- PARTIE 2 — la suppression. À jouer après avoir lu la partie 1.
-- ---------------------------------------------------------------------------

begin;

delete from vehicule_a_recevoir r
 where r.lot in ('Lot 2 - 07', 'Lot 2 - 09')
   and r.id in ('70e2cee9-d604-4fd2-a3a6-1595a930fcff', 'b73c63da-91cf-45e6-a345-05f5f4a458b8')
   and r.vehicule_id is null
   and r.recu_le is null;

commit;

-- ---------------------------------------------------------------------------
-- PARTIE 3 — la vérification. Zéro ligne attendue ; s'il en reste une, c'est
-- qu'elle a été rattachée à un véhicule entre-temps, et il faut la relire
-- avant de décider.
-- ---------------------------------------------------------------------------

select r.lot, r.recu_le, r.vehicule_id
  from vehicule_a_recevoir r
 where r.lot in ('Lot 2 - 07', 'Lot 2 - 09');

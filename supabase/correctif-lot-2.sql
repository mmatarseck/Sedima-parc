-- ============================================================================
-- SEDIMA Parc — le lot 2 reçoit ses immatriculations.
--
-- **Ce n'est pas une migration.** Le lot 2, ce sont quinze véhicules commandés
-- fin 2025. `vehicule_a_recevoir` les tient en attente, et la liste Flotte les
-- affiche « Lot 2 - NN — à immatriculer » tant qu'aucune plaque ne leur est
-- rattachée. Trois l'avaient été le 11 septembre (lots 06, 11 et 13, plaques
-- AB 112 KT, AB 010 KT et AB 066 KT) ; dix attendaient encore alors que les
-- véhicules, eux, étaient au référentiel depuis l'alignement.
--
-- **Ce qui le prouve.** Les dix pick-up de la série AB ### KP portent déjà leur
-- numéro de lot dans leur commentaire (« Lot 2 - 01 — Remplace DK1307BB… »), et
-- leurs cartes grises, lues le 14 septembre, disent le reste : tous Mitsubishi
-- L200 Dc GI, type LC1TJNUFAL, 2 442 cm3, PTAC 2 755 kg, et des VIN qui se
-- suivent — MMBJNLC10SH0839xx. C'est une seule livraison.
--
-- **Le rattachement se fait par la plaque, pas par le commentaire.** Un même
-- numéro de lot figure sur deux véhicules : le neuf et celui qu'il libère —
-- « Lot 2 - 03 » est écrit sur AB 611 KP *et* sur AA 022 EA, l'ancien véhicule
-- de Bineta Djiba. Rattacher au commentaire prendrait un jour l'ancien pour le
-- neuf. La table ci-dessous nomme donc chaque plaque.
--
-- **Les lots 07 et 09 restent en attente**, et c'est exact : les dix plaques KP
-- couvrent les lots 01 à 05, 08, 10, 12, 14 et 15. Aucun véhicule neuf n'est
-- arrivé pour 07 ni pour 09 — c'est la question posée au métier le
-- 14 septembre (REPRISE.md, point 4), et ce fichier ne la tranche pas.
--
-- REJOUABLE : seules les lignes encore sans véhicule sont touchées.
-- ============================================================================

begin;

update vehicule_a_recevoir r
   set vehicule_id = v.id,
       /* Reçu le jour de son immatriculation : c'est ce que la carte grise
          date, et c'est ce jour-là que le véhicule est devenu utilisable. */
       recu_le = coalesce(v.date_immatriculation, v.premiere_mise_en_circulation, '2026-01-01'::date)
  from (values
    ('Lot 2 - 01', 'AB565KP'),
    ('Lot 2 - 02', 'AB609KP'),
    ('Lot 2 - 03', 'AB611KP'),
    ('Lot 2 - 04', 'AB612KP'),
    ('Lot 2 - 05', 'AB614KP'),
    ('Lot 2 - 08', 'AB615KP'),
    ('Lot 2 - 10', 'AB616KP'),
    ('Lot 2 - 12', 'AB617KP'),
    ('Lot 2 - 14', 'AB619KP'),
    ('Lot 2 - 15', 'AB622KP')
  ) as x(lot, immatriculation)
  join vehicule v on v.immatriculation = x.immatriculation
 where r.lot = x.lot and r.vehicule_id is null;

commit;

-- ---------------------------------------------------------------------------
-- Vérification : ce que le lot 2 attend encore.
-- ---------------------------------------------------------------------------

select r.lot,
       coalesce(plaque_affichee(v.immatriculation), '— à immatriculer') as immatriculation,
       r.recu_le,
       r.commentaire
  from vehicule_a_recevoir r
  left join vehicule v on v.id = r.vehicule_id
 order by r.lot;

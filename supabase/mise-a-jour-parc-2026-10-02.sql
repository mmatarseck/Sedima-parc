-- ============================================================================
-- SEDIMA Parc — mise à jour du 2 octobre 2026 : statuts, batteries.
--
-- **Ce n'est pas une migration.** Rapprochement de la base avec :
--
--   * la « FICHE COMPLET VEHICULES PARC LIVRAISONS ET PERSONNELS » (dossier DO,
--     61. Gestion Parc/MALICK), enregistrée le 28/09/2026 ;
--   * le « SUIVI BATTERIES 2025 » (MALICK/FICHE SUIVI 2026), du 22/09/2026.
--
-- Ne sont repris que les écarts **francs** depuis la mise à jour du 23/09 (voir
-- docs/MISE-A-JOUR-2026-10-02.md). Les écarts déjà laissés au métier le 23/09
-- (DK 1307 BB, AA 898 PZ, plaques anciennes de la fiche…) ne bougent pas.
--
-- REJOUABLE : un statut ne change que s'il vaut encore l'ancienne valeur, la
-- trace ne s'écrit que pour ce qui a changé ; les mouvements de stock portent
-- un numéro et `on conflict do nothing`.
-- ============================================================================

begin;

-- 1. Les statuts ---------------------------------------------------------------
-- Trois véhicules arrêtés le 23/09 sont « En Service » sur la fiche du 28/09.
with source (immatriculation, avant, apres, le, motif) as (
  values
    ('AA105VA', 'en-reparation', 'en-service', timestamptz '2026-09-28 08:00+00', 'Revenu du garage Djily Dalifort : en service sur la fiche parc du 28/09 (voyages au relevé de tonnage dès le 28/09)'),
    ('AA291PT', 'en-reparation', 'en-service', timestamptz '2026-09-28 08:00+00', 'Revenu de l''entretien général chez TATA : en service sur la fiche parc du 28/09'),
    ('AA053AP', 'hors-service', 'en-service', timestamptz '2026-09-28 08:00+00', 'En service sur la fiche parc du 28/09 (citerne vrac tractée par AA 633 JL) ; arrêté le 23/09 pour sa visite technique')
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

-- 2. Les batteries ---------------------------------------------------------------
-- Deux montages de 100 AH, les 21 et 22/09, comme `charger-batteries.mts` les
-- écrit : une entrée déduite du montage, puis la sortie sur le véhicule.
-- Numéros pris à la suite de MVT-R-00058 : régénéré, le chargeur renumérote
-- (la ligne AA 905 CW du 01/07 a quitté le classeur, voir la note).
insert into mouvement_stock (numero, date, nature, piece_id, quantite, ecart, prix_unitaire, demande_numero, vehicule_id, fournisseur, motif, auteur_nom)
select v.numero, v.date::date, v.nature, p.id, v.quantite, v.ecart, v.prix_unitaire, v.demande_numero, ve.id, v.fournisseur, v.motif, 'Chargement des classeurs de suivi'
  from (values
    ('MVT-R-00059', '2026-09-21', 'entree', 'PCE-R-002', 1, null, null, 'BC26090098 / DA2608220', null, 'SICAS', 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Achetée au bon BC26090098 / DA2608220 (SICAS).'),
    ('MVT-R-00060', '2026-09-21', 'sortie', 'PCE-R-002', 1, null, null, 'BC26090098 / DA2608220', 'DK4922BB', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES 2025 (feuille « BATTERIES PL 2025 - 2026 »).'),
    ('MVT-R-00061', '2026-09-22', 'entree', 'PCE-R-002', 1, null, null, null, null, null, 'Entrée déduite du montage : le classeur suit l''achat et la pose, pas le magasin. Le classeur ne nomme pas le bon de cet achat.'),
    ('MVT-R-00062', '2026-09-22', 'sortie', 'PCE-R-002', 1, null, null, null, 'DK9649BG', null, 'Montée sur le véhicule, d''après SUIVI BATTERIES 2025 (feuille « BATTERIES PL 2025 - 2026 »).')
  ) as v(numero, date, nature, piece_numero, quantite, ecart, prix_unitaire, demande_numero, immatriculation, fournisseur, motif)
  join piece p on p.numero = v.piece_numero
  left join vehicule ve on ve.immatriculation = v.immatriculation
on conflict (numero) do nothing;

commit;

-- Contrôle
select immatriculation, statut from vehicule where immatriculation in ('AA105VA', 'AA291PT', 'AA053AP') order by immatriculation;
select m.numero, m.date, m.nature, m.quantite, v.immatriculation
  from mouvement_stock m left join vehicule v on v.id = m.vehicule_id
 where m.numero between 'MVT-R-00059' and 'MVT-R-00062' order by m.numero;

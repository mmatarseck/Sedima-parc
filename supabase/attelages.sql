-- ============================================================================
-- SEDIMA Parc — les cinq attelages du parc lourd.
--
-- **Ce n'est pas une migration.** Cinq lignes, lues sur
-- `BOCAR\M.SECK\SITUATION PARC SEDIMA LOURDS.xlsx`, feuille
-- « VEHICULES OPERATIONELS », le 14 septembre 2026.
--
-- La feuille compte les unités, pas les plaques : cinq de ses lignes en
-- portent deux, séparées par une barre, et le genre le dit — « CAMION VRAC 27T
-- (tracteur+S.remorque) ». Ce sont les cinq attelages annoncés en tête du
-- rapprochement. Le tracteur est toujours écrit en premier, la semi-remorque
-- en second, et les catégories du référentiel le confirment sans exception.
--
-- CE QUI N'EST PAS DATÉ, ET POURQUOI IL EST QUAND MÊME CHARGÉ. La feuille est
-- une **situation** : elle dit ce qui est attelé aujourd'hui, pas depuis quand.
-- Inventer une date de début serait faux ; laisser les cinq attelages dehors
-- serait pire, puisque c'est la réalité du parc. La date retenue est donc celle
-- de la lecture — le 14 septembre 2026 — et le motif dit d'où elle vient, pour
-- que personne ne la prenne pour une date d'attelage. Elle se corrigera d'un
-- clic le jour où le dossier donnera la vraie.
--
-- Tous `permanent` : ce sont les attelages de référence du parc, pas des prêts.
--
-- CE QUI N'ENTRE PAS.
--
--   * **AA 633 JL + AA 769 JV.** Les licences de transport laissent entendre
--     que la citerne vrac AA 769 JV est la semi du tracteur AA 633 JL. La
--     situation, elle, porte AA 633 JL seul et range AA 769 JV parmi les
--     véhicules **en panne**. Un attelage est un fait présent : celui-ci ne
--     l'est plus, et on ne charge pas un attelage sur une supposition.
--   * **AA 542 BQ + AA 507 BQ**, Renault Premium et semi benne Schmitz. Le
--     couple ne vient que de l'assurance 2026 ; il ne figure dans aucune
--     situation de parc. Même règle.
--
-- Les deux sont dans docs/ pour que le métier tranche.
--
-- **Rejouable** : `on conflict (numero) do nothing`, et les index partiels de
-- 0050 refuseraient de toute façon un second attelage en cours pour un même
-- tracteur ou une même semi.
--
-- À jouer après la migration 0050 et après `aligner-referentiel.sql`, qui
-- apporte les dix véhicules.
-- ============================================================================

insert into attelage (numero, tracteur_id, remorque_id, debut, permanent, motif)
select v.numero,
       t.id,
       r.id,
       date '2026-09-14',
       true,
       v.motif
  from (values
    -- numéro,            tracteur,   remorque,   ce que la feuille écrit
    ('ATT-2026-00001', 'AA927CA', 'AA053AP', 'Camion vrac 27 t (tracteur + semi-remorque), UAB — aliments. Attelage constaté à la situation du parc lourd, date de début non documentée.'),
    ('ATT-2026-00002', 'AB932EF', 'AB551HS', 'Camion vrac 30 t acheté en Chine (tracteur + semi-remorque), neuf, UAB — aliments. Attelage constaté à la situation du parc lourd, date de début non documentée.'),
    ('ATT-2026-00003', 'AA737ZW', 'AA713VE', 'Camion plateau nu 35 t (tracteur + semi-remorque), UAB — aliments. Attelage constaté à la situation du parc lourd, date de début non documentée.'),
    ('ATT-2026-00004', 'AA905CW', 'AA214XK', 'Camion plateau nu 35 t (tracteur + semi-remorque), Abattoirs — abattage. Attelage constaté à la situation du parc lourd, date de début non documentée.'),
    ('ATT-2026-00005', 'AA350JN', 'AA909CW', 'Camion citerne à eau pour les fermes (tracteur + citerne), sites — citerne eau. Attelage constaté à la situation du parc lourd, date de début non documentée.')
  ) as v (numero, tracteur, remorque, motif)
  join vehicule t on t.immatriculation = v.tracteur
  join vehicule r on r.immatriculation = v.remorque
on conflict (numero) do nothing;

-- Ce que le fichier a posé, à relire après exécution.
select a.numero,
       plaque_affichee(t.immatriculation) as tracteur,
       plaque_affichee(r.immatriculation) as remorque,
       a.debut,
       a.permanent
  from attelage a
  join vehicule t on t.id = a.tracteur_id
  join vehicule r on r.id = a.remorque_id
 order by a.numero;

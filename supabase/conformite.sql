-- ============================================================================
-- SEDIMA Parc — la conformité réelle : visites techniques et licences.
--
-- **Ce n'est pas une migration.** Chargement tiré des deux fiches de suivi du
-- dossier DO, « MALICK / FICHE SUIVI 2026 ».
--
--   * 113 visites techniques, dont 29 déjà échues ;
--   * 31 licences de transport, dont 2 déjà échues.
--
-- L'ÉCHÉANCE D'UNE VISITE EST CALCULÉE, ET CE N'EST PAS L'INVENTER. La fiche ne
-- porte que la date de passage. Mais l'application déclare elle-même la règle :
-- `type_document` range la visite technique avec `validite_mois = 12`. Poser
-- l'échéance à douze mois du passage, c'est appliquer la règle que le
-- référentiel énonce, et chaque document le dit dans son émetteur.
--
-- Les licences n'ont besoin d'aucune règle : la fiche donne les deux dates.
-- Quand la délivrance manque, on remonte de vingt-quatre mois depuis
-- l'expiration — la validité que le référentiel donne à une licence — parce
-- que la table exige une date d'effet antérieure à l'échéance.
--
-- POURQUOI DES `document` ET NON DES `visite_technique`. Cette table décrit un
-- **rendez-vous** — centre agréé, heure, résultat, délai de contre-visite — et
-- exige un centre que la fiche ne nomme pas. Ce qu'on a ici est une pièce et sa
-- validité : c'est un document, et c'est ce que la Conformité lit.
--
-- Un véhicule qui figure deux fois ne garde que sa **dernière** pièce : c'est
-- celle qui vaut.
--
-- REJOUABLE : `on conflict do nothing` partout.
-- ============================================================================

begin;

-- ---- Les visites techniques ----
insert into document (numero, type_document_id, vehicule_id, date_effet, echeance, emetteur, justificatif) values
  ('DOC-VT-00001', 'visite-technique', (select id from vehicule where immatriculation = 'DK6153AS'), '2022-03-22', '2023-03-22', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00002', 'visite-technique', (select id from vehicule where immatriculation = 'DK7370AL'), '2023-03-19', '2024-03-19', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00003', 'visite-technique', (select id from vehicule where immatriculation = 'DK3032BD'), '2023-08-02', '2024-08-02', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00004', 'visite-technique', (select id from vehicule where immatriculation = 'DK2347BD'), '2023-08-29', '2024-08-29', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00005', 'visite-technique', (select id from vehicule where immatriculation = 'DK5241AN'), '2024-05-21', '2025-05-21', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00006', 'visite-technique', (select id from vehicule where immatriculation = 'AA556JD'), '2024-07-22', '2025-07-22', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00007', 'visite-technique', (select id from vehicule where immatriculation = 'AA966JM'), '2024-08-23', '2025-08-23', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00008', 'visite-technique', (select id from vehicule where immatriculation = 'DK9181BB'), '2024-10-17', '2025-10-17', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00009', 'visite-technique', (select id from vehicule where immatriculation = 'AA909CW'), '2025-02-03', '2026-02-03', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00010', 'visite-technique', (select id from vehicule where immatriculation = 'AA350JN'), '2025-04-03', '2026-04-03', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00011', 'visite-technique', (select id from vehicule where immatriculation = 'AA433AJ'), '2025-04-15', '2026-04-15', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00012', 'visite-technique', (select id from vehicule where immatriculation = 'AA139HP'), '2025-06-11', '2026-06-11', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00013', 'visite-technique', (select id from vehicule where immatriculation = 'AA905CW'), '2025-06-19', '2026-06-19', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00014', 'visite-technique', (select id from vehicule where immatriculation = 'AA484BH'), '2025-06-19', '2026-06-19', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00015', 'visite-technique', (select id from vehicule where immatriculation = 'AA291PT'), '2025-06-22', '2026-06-22', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00016', 'visite-technique', (select id from vehicule where immatriculation = 'AA927CA'), '2025-06-24', '2026-06-24', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00017', 'visite-technique', (select id from vehicule where immatriculation = 'DK9723BD'), '2025-06-26', '2026-06-26', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00018', 'visite-technique', (select id from vehicule where immatriculation = 'DK0082BD'), '2025-07-02', '2026-07-02', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00019', 'visite-technique', (select id from vehicule where immatriculation = 'AA285PT'), '2025-07-10', '2026-07-10', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00020', 'visite-technique', (select id from vehicule where immatriculation = 'AA214JC'), '2025-07-17', '2026-07-17', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00021', 'visite-technique', (select id from vehicule where immatriculation = 'AA278JE'), '2025-07-24', '2026-07-24', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00022', 'visite-technique', (select id from vehicule where immatriculation = 'AA392JG'), '2025-07-28', '2026-07-28', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00023', 'visite-technique', (select id from vehicule where immatriculation = 'AA301PT'), '2025-08-07', '2026-08-07', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00024', 'visite-technique', (select id from vehicule where immatriculation = 'DK5830AK'), '2025-08-11', '2026-08-11', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00025', 'visite-technique', (select id from vehicule where immatriculation = 'AA963JM'), '2025-08-19', '2026-08-19', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00026', 'visite-technique', (select id from vehicule where immatriculation = 'AA485DR'), '2025-08-26', '2026-08-26', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00027', 'visite-technique', (select id from vehicule where immatriculation = 'AA099DZ'), '2025-08-27', '2026-08-27', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00028', 'visite-technique', (select id from vehicule where immatriculation = 'AA189JM'), '2025-08-28', '2026-08-28', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00029', 'visite-technique', (select id from vehicule where immatriculation = 'DK5077AS'), '2025-08-29', '2026-08-29', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00030', 'visite-technique', (select id from vehicule where immatriculation = 'AA769PA'), '2025-09-12', '2026-09-12', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00031', 'visite-technique', (select id from vehicule where immatriculation = 'AA386JG'), '2025-09-17', '2026-09-17', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00032', 'visite-technique', (select id from vehicule where immatriculation = 'DK6875BF'), '2025-09-22', '2026-09-22', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00033', 'visite-technique', (select id from vehicule where immatriculation = 'AA053AP'), '2025-09-24', '2026-09-24', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00034', 'visite-technique', (select id from vehicule where immatriculation = 'AA106NE'), '2025-10-01', '2026-10-01', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00035', 'visite-technique', (select id from vehicule where immatriculation = 'DK1870BG'), '2025-10-07', '2026-10-07', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00036', 'visite-technique', (select id from vehicule where immatriculation = 'DK6154AS'), '2025-10-30', '2026-10-30', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00037', 'visite-technique', (select id from vehicule where immatriculation = 'DK4424BF'), '2025-11-03', '2026-11-03', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00038', 'visite-technique', (select id from vehicule where immatriculation = 'AA277PT'), '2025-11-10', '2026-11-10', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00039', 'visite-technique', (select id from vehicule where immatriculation = 'AA296PT'), '2025-11-20', '2026-11-20', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00040', 'visite-technique', (select id from vehicule where immatriculation = 'AA131EX'), '2025-12-01', '2026-12-01', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00041', 'visite-technique', (select id from vehicule where immatriculation = 'AA300PT'), '2025-12-01', '2026-12-01', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00042', 'visite-technique', (select id from vehicule where immatriculation = 'AA324JE'), '2025-12-02', '2026-12-02', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00043', 'visite-technique', (select id from vehicule where immatriculation = 'AA226SX'), '2025-12-02', '2026-12-02', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00044', 'visite-technique', (select id from vehicule where immatriculation = 'AA633JL'), '2025-12-04', '2026-12-04', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00045', 'visite-technique', (select id from vehicule where immatriculation = 'AA093VA'), '2025-12-07', '2026-12-07', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00046', 'visite-technique', (select id from vehicule where immatriculation = 'DK4517BF'), '2025-12-16', '2026-12-16', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00047', 'visite-technique', (select id from vehicule where immatriculation = 'AA281PT'), '2025-12-18', '2026-12-18', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00048', 'visite-technique', (select id from vehicule where immatriculation = 'AB716FK'), '2025-12-21', '2026-12-21', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00049', 'visite-technique', (select id from vehicule where immatriculation = 'AA966AD'), '2025-12-22', '2026-12-22', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00050', 'visite-technique', (select id from vehicule where immatriculation = 'DK6067AM'), '2025-12-28', '2026-12-28', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00051', 'visite-technique', (select id from vehicule where immatriculation = 'DK9046AT'), '2026-01-02', '2027-01-02', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00052', 'visite-technique', (select id from vehicule where immatriculation = 'AA605TR'), '2026-01-08', '2027-01-08', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00053', 'visite-technique', (select id from vehicule where immatriculation = 'AA562EE'), '2026-01-12', '2027-01-12', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00054', 'visite-technique', (select id from vehicule where immatriculation = 'AB592HD'), '2026-01-23', '2027-01-23', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00055', 'visite-technique', (select id from vehicule where immatriculation = 'AA783BN'), '2026-02-12', '2027-02-12', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00056', 'visite-technique', (select id from vehicule where immatriculation = 'AA105VA'), '2026-02-26', '2027-02-26', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00057', 'visite-technique', (select id from vehicule where immatriculation = 'AA180CQ'), '2026-03-08', '2027-03-08', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00058', 'visite-technique', (select id from vehicule where immatriculation = 'DK1307BB'), '2026-03-24', '2027-03-24', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00059', 'visite-technique', (select id from vehicule where immatriculation = 'AA359AH'), '2026-03-25', '2027-03-25', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00060', 'visite-technique', (select id from vehicule where immatriculation = 'AA568GA'), '2026-03-26', '2027-03-26', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00061', 'visite-technique', (select id from vehicule where immatriculation = 'AA768JV'), '2026-03-30', '2027-03-30', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00062', 'visite-technique', (select id from vehicule where immatriculation = 'DK9649BG'), '2026-04-01', '2027-04-01', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00063', 'visite-technique', (select id from vehicule where immatriculation = 'AB681HE'), '2026-04-02', '2027-04-02', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00064', 'visite-technique', (select id from vehicule where immatriculation = 'AA920VA'), '2026-04-08', '2027-04-08', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00065', 'visite-technique', (select id from vehicule where immatriculation = 'DK3454BD'), '2026-04-10', '2027-04-10', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00066', 'visite-technique', (select id from vehicule where immatriculation = 'DK4922BB'), '2026-04-12', '2027-04-12', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00067', 'visite-technique', (select id from vehicule where immatriculation = 'AA977MR'), '2026-04-14', '2027-04-14', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00068', 'visite-technique', (select id from vehicule where immatriculation = 'DK2346BD'), '2026-04-21', '2027-04-21', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00069', 'visite-technique', (select id from vehicule where immatriculation = 'AB571HZ'), '2026-05-07', '2027-05-07', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00070', 'visite-technique', (select id from vehicule where immatriculation = 'AB792JA'), '2026-05-07', '2027-05-07', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00071', 'visite-technique', (select id from vehicule where immatriculation = 'AB932EF'), '2026-05-10', '2027-05-10', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00072', 'visite-technique', (select id from vehicule where immatriculation = 'AB551HS'), '2026-05-10', '2027-05-10', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00073', 'visite-technique', (select id from vehicule where immatriculation = 'DK5347BM'), '2026-05-17', '2027-05-17', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00074', 'visite-technique', (select id from vehicule where immatriculation = 'AA985MR'), '2026-05-17', '2027-05-17', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00075', 'visite-technique', (select id from vehicule where immatriculation = 'DK5680BL'), '2026-05-19', '2027-05-19', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00076', 'visite-technique', (select id from vehicule where immatriculation = 'AB741AP'), '2026-06-05', '2027-06-05', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00077', 'visite-technique', (select id from vehicule where immatriculation = 'AA990DZ'), '2026-06-08', '2027-06-08', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00078', 'visite-technique', (select id from vehicule where immatriculation = 'DK3033BD'), '2026-06-09', '2027-06-09', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00079', 'visite-technique', (select id from vehicule where immatriculation = 'AA236MR'), '2026-06-10', '2027-06-10', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00080', 'visite-technique', (select id from vehicule where immatriculation = 'AA565GA'), '2026-06-14', '2027-06-14', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00081', 'visite-technique', (select id from vehicule where immatriculation = 'AA186CQ'), '2026-06-14', '2027-06-14', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00082', 'visite-technique', (select id from vehicule where immatriculation = 'AA235MR'), '2026-06-15', '2027-06-15', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00083', 'visite-technique', (select id from vehicule where immatriculation = 'AA021EA'), '2026-06-16', '2027-06-16', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00084', 'visite-technique', (select id from vehicule where immatriculation = 'AA898PZ'), '2026-06-24', '2027-06-24', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00085', 'visite-technique', (select id from vehicule where immatriculation = 'AA032EA'), '2026-06-29', '2027-06-29', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00086', 'visite-technique', (select id from vehicule where immatriculation = 'AA129JC'), '2026-06-30', '2027-06-30', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00087', 'visite-technique', (select id from vehicule where immatriculation = 'AA270JF'), '2026-06-30', '2027-06-30', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00088', 'visite-technique', (select id from vehicule where immatriculation = 'AB078JS'), '2026-07-01', '2027-07-01', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00089', 'visite-technique', (select id from vehicule where immatriculation = 'AA266JC'), '2026-07-01', '2027-07-01', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00090', 'visite-technique', (select id from vehicule where immatriculation = 'AA128JC'), '2026-07-06', '2027-07-06', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00091', 'visite-technique', (select id from vehicule where immatriculation = 'DK8077BD'), '2026-07-09', '2027-07-09', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00092', 'visite-technique', (select id from vehicule where immatriculation = 'AA544JD'), '2026-07-09', '2027-07-09', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00093', 'visite-technique', (select id from vehicule where immatriculation = 'AA713VE'), '2026-07-12', '2027-07-12', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00094', 'visite-technique', (select id from vehicule where immatriculation = 'AA135JC'), '2026-07-12', '2027-07-12', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00095', 'visite-technique', (select id from vehicule where immatriculation = 'AA541JD'), '2026-07-12', '2027-07-12', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00096', 'visite-technique', (select id from vehicule where immatriculation = 'AA554JD'), '2026-07-15', '2027-07-15', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00097', 'visite-technique', (select id from vehicule where immatriculation = 'AA214XK'), '2026-07-16', '2027-07-16', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00098', 'visite-technique', (select id from vehicule where immatriculation = 'DK5679BL'), '2026-07-19', '2027-07-19', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00099', 'visite-technique', (select id from vehicule where immatriculation = 'AA737ZW'), '2026-07-21', '2027-07-21', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00100', 'visite-technique', (select id from vehicule where immatriculation = 'AA550JD'), '2026-07-22', '2027-07-22', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00101', 'visite-technique', (select id from vehicule where immatriculation = 'AA023EA'), '2026-07-23', '2027-07-23', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00102', 'visite-technique', (select id from vehicule where immatriculation = 'AA403JG'), '2026-07-24', '2027-07-24', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00103', 'visite-technique', (select id from vehicule where immatriculation = 'AA390JG'), '2026-07-24', '2027-07-24', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00104', 'visite-technique', (select id from vehicule where immatriculation = 'AA019EA'), '2026-07-24', '2027-07-24', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00105', 'visite-technique', (select id from vehicule where immatriculation = 'AA320JF'), '2026-07-28', '2027-07-28', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00106', 'visite-technique', (select id from vehicule where immatriculation = 'DK4740BH'), '2026-07-30', '2027-07-30', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00107', 'visite-technique', (select id from vehicule where immatriculation = 'AA200EA'), '2026-08-04', '2027-08-04', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00108', 'visite-technique', (select id from vehicule where immatriculation = 'AA119AH'), '2026-08-05', '2027-08-05', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00109', 'visite-technique', (select id from vehicule where immatriculation = 'AA489BH'), '2026-08-05', '2027-08-05', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00110', 'visite-technique', (select id from vehicule where immatriculation = 'AA397JG'), '2026-08-06', '2027-08-06', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00111', 'visite-technique', (select id from vehicule where immatriculation = 'AA389JG'), '2026-08-06', '2027-08-06', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00112', 'visite-technique', (select id from vehicule where immatriculation = 'AA735MY'), '2026-08-06', '2027-08-06', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true),
  ('DOC-VT-00113', 'visite-technique', (select id from vehicule where immatriculation = 'AA022EA'), '2026-08-19', '2027-08-19', 'Fiche de suivi des visites techniques — échéance à 12 mois du passage', true)
on conflict (numero) do nothing;

-- ---- Les licences de transport ----
insert into licence_transport (numero, libelle, numero_piece, emetteur, perimetre, date_effet, echeance) values
  ('LIC-R-00001', 'Licence de transport AA769JV', 'LIC-AA769JV', 'Ministère des Transports', 'partie', '2023-12-21', '2025-12-20'),
  ('LIC-R-00002', 'Licence de transport AA909CW', 'LIC-AA909CW', 'Ministère des Transports', 'partie', '2021-05-18', '2025-12-20'),
  ('LIC-R-00003', 'Licence de transport AA301PT', 'LIC-AA301PT', 'Ministère des Transports', 'partie', '2024-09-12', '2026-09-12'),
  ('LIC-R-00004', 'Licence de transport AA105VA', 'LIC-AA105VA', 'Ministère des Transports', 'partie', '2024-10-22', '2026-10-21'),
  ('LIC-R-00005', 'Licence de transport AA920VA', 'LIC-AA920VA', 'Ministère des Transports', 'partie', '2024-10-23', '2026-10-22'),
  ('LIC-R-00006', 'Licence de transport AA713VE', 'LIC-AA713VE', 'Ministère des Transports', 'partie', '2024-10-23', '2026-10-22'),
  ('LIC-R-00007', 'Licence de transport AA768JV', 'LIC-AA768JV', 'Ministère des Transports', 'partie', '2023-04-24', '2027-04-16'),
  ('LIC-R-00008', 'Licence de transport AA180CQ', 'LIC-AA180CQ', 'Ministère des Transports', 'partie', '2023-04-27', '2027-04-27'),
  ('LIC-R-00009', 'Licence de transport AA235MR', 'LIC-AA235MR', 'Ministère des Transports', 'partie', '2023-05-05', '2027-05-11'),
  ('LIC-R-00010', 'Licence de transport AA977MR', 'LIC-AA977MR', 'Ministère des Transports', 'partie', '2023-05-10', '2027-05-29'),
  ('LIC-R-00011', 'Licence de transport AA236MR', 'LIC-AA236MR', 'Ministère des Transports', 'partie', '2023-05-05', '2027-06-18'),
  ('LIC-R-00012', 'Licence de transport AA186CQ', 'LIC-AA186CQ', 'Ministère des Transports', 'partie', '2025-08-23', '2027-08-27'),
  ('LIC-R-00013', 'Licence de transport AA214XK', 'LIC-AA214XK', 'Ministère des Transports', 'partie', '2025-10-15', '2027-10-14'),
  ('LIC-R-00014', 'Licence de transport AA277PT', 'LIC-AA277PT', 'Ministère des Transports', 'partie', '2025-11-28', '2027-12-01'),
  ('LIC-R-00015', 'Licence de transport AA300PT', 'LIC-AA300PT', 'Ministère des Transports', 'partie', '2025-11-25', '2027-12-01'),
  ('LIC-R-00016', 'Licence de transport AA291PT', 'LIC-AA291PT', 'Ministère des Transports', 'partie', '2025-11-25', '2027-12-01'),
  ('LIC-R-00017', 'Licence de transport AA281PT', 'LIC-AA281PT', 'Ministère des Transports', 'partie', '2025-11-26', '2027-12-01'),
  ('LIC-R-00018', 'Licence de transport AA285PT', 'LIC-AA285PT', 'Ministère des Transports', 'partie', '2025-12-19', '2027-12-30'),
  ('LIC-R-00019', 'Licence de transport AA898PZ', 'LIC-AA898PZ', 'Ministère des Transports', 'partie', '2025-12-19', '2027-12-30'),
  ('LIC-R-00020', 'Licence de transport AA053AP', 'LIC-AA053AP', 'Ministère des Transports', 'partie', '2019-12-19', '2027-12-30'),
  ('LIC-R-00021', 'Licence de transport AA106NE', 'LIC-AA106NE', 'Ministère des Transports', 'partie', '2026-02-04', '2028-02-11'),
  ('LIC-R-00022', 'Licence de transport AA296PT', 'LIC-AA296PT', 'Ministère des Transports', 'partie', '2026-02-04', '2028-02-11'),
  ('LIC-R-00023', 'Licence de transport AB681HE', 'LIC-AB681HE', 'Ministère des Transports', 'partie', '2026-04-22', '2028-04-21'),
  ('LIC-R-00024', 'Licence de transport AB551HS', 'LIC-AB551HS', 'Ministère des Transports', 'partie', '2026-05-19', '2028-05-18'),
  ('LIC-R-00025', 'Licence de transport AA985MR', 'LIC-AA985MR', 'Ministère des Transports', 'partie', '2026-06-30', '2028-06-30'),
  ('LIC-R-00026', 'Licence de transport AA093VA', 'LIC-AA093VA', 'Ministère des Transports', 'partie', '2026-07-17', '2028-07-16'),
  ('LIC-R-00027', 'Licence de transport AA783BN', 'LIC-AA783BN', 'Ministère des Transports', 'partie', '2026-07-24', '2028-07-26'),
  ('LIC-R-00028', 'Licence de transport AA226SX', 'LIC-AA226SX', 'Ministère des Transports', 'partie', '2026-07-24', '2028-07-26'),
  ('LIC-R-00029', 'Licence de transport AA565GA', 'LIC-AA565GA', 'Ministère des Transports', 'partie', '2026-07-24', '2028-07-26'),
  ('LIC-R-00030', 'Licence de transport AA568GA', 'LIC-AA568GA', 'Ministère des Transports', 'partie', '2026-07-24', '2028-07-26'),
  ('LIC-R-00031', 'Licence de transport AA359AH', 'LIC-AA359AH', 'Ministère des Transports', 'partie', '2026-07-24', '2028-07-26')
on conflict (numero) do nothing;

insert into licence_vehicule (licence_id, vehicule_id) values
  ((select id from licence_transport where numero = 'LIC-R-00001'), (select id from vehicule where immatriculation = 'AA769JV')),
  ((select id from licence_transport where numero = 'LIC-R-00002'), (select id from vehicule where immatriculation = 'AA909CW')),
  ((select id from licence_transport where numero = 'LIC-R-00003'), (select id from vehicule where immatriculation = 'AA301PT')),
  ((select id from licence_transport where numero = 'LIC-R-00004'), (select id from vehicule where immatriculation = 'AA105VA')),
  ((select id from licence_transport where numero = 'LIC-R-00005'), (select id from vehicule where immatriculation = 'AA920VA')),
  ((select id from licence_transport where numero = 'LIC-R-00006'), (select id from vehicule where immatriculation = 'AA713VE')),
  ((select id from licence_transport where numero = 'LIC-R-00007'), (select id from vehicule where immatriculation = 'AA768JV')),
  ((select id from licence_transport where numero = 'LIC-R-00008'), (select id from vehicule where immatriculation = 'AA180CQ')),
  ((select id from licence_transport where numero = 'LIC-R-00009'), (select id from vehicule where immatriculation = 'AA235MR')),
  ((select id from licence_transport where numero = 'LIC-R-00010'), (select id from vehicule where immatriculation = 'AA977MR')),
  ((select id from licence_transport where numero = 'LIC-R-00011'), (select id from vehicule where immatriculation = 'AA236MR')),
  ((select id from licence_transport where numero = 'LIC-R-00012'), (select id from vehicule where immatriculation = 'AA186CQ')),
  ((select id from licence_transport where numero = 'LIC-R-00013'), (select id from vehicule where immatriculation = 'AA214XK')),
  ((select id from licence_transport where numero = 'LIC-R-00014'), (select id from vehicule where immatriculation = 'AA277PT')),
  ((select id from licence_transport where numero = 'LIC-R-00015'), (select id from vehicule where immatriculation = 'AA300PT')),
  ((select id from licence_transport where numero = 'LIC-R-00016'), (select id from vehicule where immatriculation = 'AA291PT')),
  ((select id from licence_transport where numero = 'LIC-R-00017'), (select id from vehicule where immatriculation = 'AA281PT')),
  ((select id from licence_transport where numero = 'LIC-R-00018'), (select id from vehicule where immatriculation = 'AA285PT')),
  ((select id from licence_transport where numero = 'LIC-R-00019'), (select id from vehicule where immatriculation = 'AA898PZ')),
  ((select id from licence_transport where numero = 'LIC-R-00020'), (select id from vehicule where immatriculation = 'AA053AP')),
  ((select id from licence_transport where numero = 'LIC-R-00021'), (select id from vehicule where immatriculation = 'AA106NE')),
  ((select id from licence_transport where numero = 'LIC-R-00022'), (select id from vehicule where immatriculation = 'AA296PT')),
  ((select id from licence_transport where numero = 'LIC-R-00023'), (select id from vehicule where immatriculation = 'AB681HE')),
  ((select id from licence_transport where numero = 'LIC-R-00024'), (select id from vehicule where immatriculation = 'AB551HS')),
  ((select id from licence_transport where numero = 'LIC-R-00025'), (select id from vehicule where immatriculation = 'AA985MR')),
  ((select id from licence_transport where numero = 'LIC-R-00026'), (select id from vehicule where immatriculation = 'AA093VA')),
  ((select id from licence_transport where numero = 'LIC-R-00027'), (select id from vehicule where immatriculation = 'AA783BN')),
  ((select id from licence_transport where numero = 'LIC-R-00028'), (select id from vehicule where immatriculation = 'AA226SX')),
  ((select id from licence_transport where numero = 'LIC-R-00029'), (select id from vehicule where immatriculation = 'AA565GA')),
  ((select id from licence_transport where numero = 'LIC-R-00030'), (select id from vehicule where immatriculation = 'AA568GA')),
  ((select id from licence_transport where numero = 'LIC-R-00031'), (select id from vehicule where immatriculation = 'AA359AH'))
on conflict do nothing;

commit;


-- ---------------------------------------------------------------------------
-- Vérification.
-- ---------------------------------------------------------------------------

select 'visites techniques' as quoi, count(*)::int as pieces,
       count(*) filter (where echeance < current_date)::int as echues,
       min(echeance)::text as plus_ancienne, max(echeance)::text as plus_lointaine
  from document where type_document_id = 'visite-technique'
union all
select 'licences', count(*)::int,
       count(*) filter (where echeance < current_date)::int,
       min(echeance)::text, max(echeance)::text
  from licence_transport where numero like 'LIC-R-%';

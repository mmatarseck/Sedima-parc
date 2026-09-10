-- ============================================================================
-- SEDIMA Parc — les compteurs lus sur les bons de commande.
--
-- **Ce n'est pas une migration.** Chargement de 105 relevés kilométriques,
-- sur 30 véhicules, du 2024-01-12 au 2026-08-25.
--
-- D'OÙ ILS VIENNENT. Du **texte** des bons de commande : « ENTRETIEN AUX
-- 16000KM DU VEHICULE AA025HD », « ENTRETIEN DU VÉHICULE AA 032 EA A
-- 175000 km ». Ce n'est pas un relevé quotidien, mais c'est un point daté,
-- exact, et attesté par une facture. L'origine `garage` existe pour ce cas :
-- un compteur lu à l'atelier, ni saisi par un chauffeur ni remonté par une
-- balise.
--
-- POURQUOI DEUX ÉCRITURES. Le kilométrage entre dans `releve_kilometrique` —
-- c'est un fait daté du véhicule — et dans la colonne `km` de l'intervention
-- correspondante, restée nulle au premier chargement. Le même fait à deux
-- endroits qui le regardent différemment : l'histoire du compteur d'un côté,
-- le kilométrage auquel ce travail a été fait de l'autre.
--
-- CE QUI EST ÉCARTÉ. 1 paire(s) de relevés où le compteur recule. Sur un
-- même véhicule, deux relevés en ordre décroissant veulent dire qu'un des deux
-- est faux — coquille de saisie, ou moteur remplacé — et on ne sait pas lequel.
-- Charger les deux abîmerait tout calcul de distance ; charger le plus grand
-- serait arbitraire. Ils restent dehors, nommés ci-dessous.
--   AA554JD : 2026-01-13 78 000 km puis 2026-05-08 69 000 km
--
-- CE QUI N'EST PAS LÀ. Les 599 pleins qui portent un compteur sont déjà en
-- base, dans `plein.km`, et l'application les lit comme des relevés — la
-- situation journalière comme la fiche cherchent le compteur des deux côtés.
-- Les recopier ici mettrait le même fait à deux endroits.
--
-- REJOUABLE : `on conflict (numero) do nothing`, et les mises à jour ne
-- touchent que les interventions dont le kilométrage est encore nul.
-- ============================================================================

begin;

insert into releve_kilometrique (numero, vehicule_id, date, km, origine) values
  ('KM-R-00001', (select id from vehicule where immatriculation = 'AA099DZ'), '2024-01-12', 31900, 'garage'),
  ('KM-R-00002', (select id from vehicule where immatriculation = 'AA386JG'), '2024-02-07', 50000, 'garage'),
  ('KM-R-00003', (select id from vehicule where immatriculation = 'AA189JM'), '2024-02-28', 15000, 'garage'),
  ('KM-R-00004', (select id from vehicule where immatriculation = 'AA032EA'), '2024-03-08', 175000, 'garage'),
  ('KM-R-00005', (select id from vehicule where immatriculation = 'AA390JG'), '2024-03-20', 20000, 'garage'),
  ('KM-R-00006', (select id from vehicule where immatriculation = 'AA403JG'), '2024-03-21', 35000, 'garage'),
  ('KM-R-00007', (select id from vehicule where immatriculation = 'AA554JD'), '2024-04-19', 27000, 'garage'),
  ('KM-R-00008', (select id from vehicule where immatriculation = 'AA544JD'), '2024-05-07', 30700, 'garage'),
  ('KM-R-00009', (select id from vehicule where immatriculation = 'AA562EE'), '2024-05-07', 91000, 'garage'),
  ('KM-R-00010', (select id from vehicule where immatriculation = 'AA128JC'), '2024-06-10', 21500, 'garage'),
  ('KM-R-00011', (select id from vehicule where immatriculation = 'AA266JC'), '2024-06-21', 21000, 'garage'),
  ('KM-R-00012', (select id from vehicule where immatriculation = 'AA403JG'), '2024-06-24', 41000, 'garage'),
  ('KM-R-00013', (select id from vehicule where immatriculation = 'AA135JC'), '2024-08-20', 30000, 'garage'),
  ('KM-R-00014', (select id from vehicule where immatriculation = 'AA554JD'), '2024-08-20', 44000, 'garage'),
  ('KM-R-00015', (select id from vehicule where immatriculation = 'AA390JG'), '2024-08-28', 25000, 'garage'),
  ('KM-R-00016', (select id from vehicule where immatriculation = 'AA392JG'), '2024-09-06', 40000, 'garage'),
  ('KM-R-00017', (select id from vehicule where immatriculation = 'AA541JD'), '2024-09-10', 62000, 'garage'),
  ('KM-R-00018', (select id from vehicule where immatriculation = 'AA266JC'), '2024-09-11', 26000, 'garage'),
  ('KM-R-00019', (select id from vehicule where immatriculation = 'AA769PA'), '2024-09-18', 29000, 'garage'),
  ('KM-R-00020', (select id from vehicule where immatriculation = 'AA021EA'), '2024-09-23', 70000, 'garage'),
  ('KM-R-00021', (select id from vehicule where immatriculation = 'AA764PA'), '2024-09-23', 31000, 'garage'),
  ('KM-R-00022', (select id from vehicule where immatriculation = 'AA544JD'), '2024-09-27', 40000, 'garage'),
  ('KM-R-00023', (select id from vehicule where immatriculation = 'AA389JG'), '2024-10-21', 69000, 'garage'),
  ('KM-R-00024', (select id from vehicule where immatriculation = 'AA403JG'), '2024-12-13', 50000, 'garage'),
  ('KM-R-00025', (select id from vehicule where immatriculation = 'AA128JC'), '2025-01-10', 34000, 'garage'),
  ('KM-R-00026', (select id from vehicule where immatriculation = 'AA392JG'), '2025-01-14', 45000, 'garage'),
  ('KM-R-00027', (select id from vehicule where immatriculation = 'AA541JD'), '2025-01-16', 70000, 'garage'),
  ('KM-R-00028', (select id from vehicule where immatriculation = 'AA389JG'), '2025-02-17', 80000, 'garage'),
  ('KM-R-00029', (select id from vehicule where immatriculation = 'AA403JG'), '2025-03-12', 55000, 'garage'),
  ('KM-R-00030', (select id from vehicule where immatriculation = 'AA963JM'), '2025-03-18', 30000, 'garage'),
  ('KM-R-00031', (select id from vehicule where immatriculation = 'AA386JG'), '2025-03-21', 92000, 'garage'),
  ('KM-R-00032', (select id from vehicule where immatriculation = 'AA550JD'), '2025-04-08', 31000, 'garage'),
  ('KM-R-00033', (select id from vehicule where immatriculation = 'AA764PA'), '2025-04-08', 50000, 'garage'),
  ('KM-R-00034', (select id from vehicule where immatriculation = 'AA266JC'), '2025-05-26', 41000, 'garage'),
  ('KM-R-00035', (select id from vehicule where immatriculation = 'AA390JG'), '2025-05-26', 40000, 'garage'),
  ('KM-R-00036', (select id from vehicule where immatriculation = 'AA541JD'), '2025-05-27', 76000, 'garage'),
  ('KM-R-00037', (select id from vehicule where immatriculation = 'AA769PA'), '2025-05-28', 50000, 'garage'),
  ('KM-R-00038', (select id from vehicule where immatriculation = 'AA403JG'), '2025-06-18', 62000, 'garage'),
  ('KM-R-00039', (select id from vehicule where immatriculation = 'AA544JD'), '2025-06-18', 56000, 'garage'),
  ('KM-R-00040', (select id from vehicule where immatriculation = 'AA963JM'), '2025-06-25', 35000, 'garage'),
  ('KM-R-00041', (select id from vehicule where immatriculation = 'AA099DZ'), '2025-06-30', 56000, 'garage'),
  ('KM-R-00042', (select id from vehicule where immatriculation = 'AA389JG'), '2025-06-30', 91000, 'garage'),
  ('KM-R-00043', (select id from vehicule where immatriculation = 'AA764PA'), '2025-07-10', 60000, 'garage'),
  ('KM-R-00044', (select id from vehicule where immatriculation = 'DK9649BG'), '2025-07-10', 165000, 'garage'),
  ('KM-R-00045', (select id from vehicule where immatriculation = 'AA389JG'), '2025-07-15', 95000, 'garage'),
  ('KM-R-00046', (select id from vehicule where immatriculation = 'AA554JD'), '2025-07-15', 66000, 'garage'),
  ('KM-R-00047', (select id from vehicule where immatriculation = 'AA550JD'), '2025-07-29', 37000, 'garage'),
  ('KM-R-00048', (select id from vehicule where immatriculation = 'AA135JC'), '2025-07-30', 46000, 'garage'),
  ('KM-R-00049', (select id from vehicule where immatriculation = 'AA547JD'), '2025-07-30', 90000, 'garage'),
  ('KM-R-00050', (select id from vehicule where immatriculation = 'AA562EE'), '2025-07-30', 125000, 'garage'),
  ('KM-R-00051', (select id from vehicule where immatriculation = 'AA300PT'), '2025-07-31', 302000, 'garage'),
  ('KM-R-00052', (select id from vehicule where immatriculation = 'AA764PA'), '2025-08-29', 65000, 'garage'),
  ('KM-R-00053', (select id from vehicule where immatriculation = 'AA128JC'), '2025-09-01', 44500, 'garage'),
  ('KM-R-00054', (select id from vehicule where immatriculation = 'AA403JG'), '2025-09-16', 67000, 'garage'),
  ('KM-R-00055', (select id from vehicule where immatriculation = 'AA963JM'), '2025-09-23', 40000, 'garage'),
  ('KM-R-00056', (select id from vehicule where immatriculation = 'AA266JC'), '2025-11-12', 53000, 'garage'),
  ('KM-R-00057', (select id from vehicule where immatriculation = 'AA550JD'), '2025-12-01', 42000, 'garage'),
  ('KM-R-00058', (select id from vehicule where immatriculation = 'AA389JG'), '2025-12-02', 106000, 'garage'),
  ('KM-R-00059', (select id from vehicule where immatriculation = 'AA392JG'), '2025-12-02', 60000, 'garage'),
  ('KM-R-00060', (select id from vehicule where immatriculation = 'AA397JG'), '2025-12-02', 106500, 'garage'),
  ('KM-R-00061', (select id from vehicule where immatriculation = 'AA541JD'), '2025-12-02', 91000, 'garage'),
  ('KM-R-00062', (select id from vehicule where immatriculation = 'AA128JC'), '2025-12-12', 51000, 'garage'),
  ('KM-R-00063', (select id from vehicule where immatriculation = 'AA403JG'), '2025-12-12', 71000, 'garage'),
  ('KM-R-00064', (select id from vehicule where immatriculation = 'AA769PA'), '2025-12-12', 71000, 'garage'),
  ('KM-R-00065', (select id from vehicule where immatriculation = 'AA877YM'), '2025-12-30', 3000, 'garage'),
  ('KM-R-00066', (select id from vehicule where immatriculation = 'AA963JM'), '2025-12-30', 45000, 'garage'),
  ('KM-R-00067', (select id from vehicule where immatriculation = 'DK9649BG'), '2025-12-30', 175000, 'garage'),
  ('KM-R-00068', (select id from vehicule where immatriculation = 'AA544JD'), '2026-01-06', 63000, 'garage'),
  ('KM-R-00069', (select id from vehicule where immatriculation = 'AA764PA'), '2026-01-13', 81000, 'garage'),
  ('KM-R-00070', (select id from vehicule where immatriculation = 'AA021EA'), '2026-02-11', 104000, 'garage'),
  ('KM-R-00071', (select id from vehicule where immatriculation = 'AA099DZ'), '2026-02-13', 65000, 'garage'),
  ('KM-R-00072', (select id from vehicule where immatriculation = 'AA270JF'), '2026-02-13', 55000, 'garage'),
  ('KM-R-00073', (select id from vehicule where immatriculation = 'AA386JG'), '2026-02-13', 122000, 'garage'),
  ('KM-R-00074', (select id from vehicule where immatriculation = 'AA390JG'), '2026-02-13', 50000, 'garage'),
  ('KM-R-00075', (select id from vehicule where immatriculation = 'AA397JG'), '2026-02-13', 115000, 'garage'),
  ('KM-R-00076', (select id from vehicule where immatriculation = 'AA300PT'), '2026-02-24', 332000, 'garage'),
  ('KM-R-00077', (select id from vehicule where immatriculation = 'AA923YM'), '2026-02-24', 3000, 'garage'),
  ('KM-R-00078', (select id from vehicule where immatriculation = 'AA135JC'), '2026-02-25', 51000, 'garage'),
  ('KM-R-00079', (select id from vehicule where immatriculation = 'AA389JG'), '2026-02-25', 112000, 'garage'),
  ('KM-R-00080', (select id from vehicule where immatriculation = 'AA397JG'), '2026-03-02', 120000, 'garage'),
  ('KM-R-00081', (select id from vehicule where immatriculation = 'AA403JG'), '2026-03-13', 77000, 'garage'),
  ('KM-R-00082', (select id from vehicule where immatriculation = 'AA541JD'), '2026-03-13', 97000, 'garage'),
  ('KM-R-00083', (select id from vehicule where immatriculation = 'AA266JC'), '2026-03-23', 63000, 'garage'),
  ('KM-R-00084', (select id from vehicule where immatriculation = 'AA386JG'), '2026-03-23', 128000, 'garage'),
  ('KM-R-00085', (select id from vehicule where immatriculation = 'AA392JG'), '2026-03-23', 65000, 'garage'),
  ('KM-R-00086', (select id from vehicule where immatriculation = 'AA877YM'), '2026-03-23', 7500, 'garage'),
  ('KM-R-00087', (select id from vehicule where immatriculation = 'AA189JM'), '2026-04-03', 31000, 'garage'),
  ('KM-R-00088', (select id from vehicule where immatriculation = 'AA550JD'), '2026-04-03', 47000, 'garage'),
  ('KM-R-00089', (select id from vehicule where immatriculation = 'AA963JM'), '2026-04-21', 50000, 'garage'),
  ('KM-R-00090', (select id from vehicule where immatriculation = 'AA324JE'), '2026-05-08', 66500, 'garage'),
  ('KM-R-00091', (select id from vehicule where immatriculation = 'AA769PA'), '2026-05-08', 82000, 'garage'),
  ('KM-R-00092', (select id from vehicule where immatriculation = 'AA397JG'), '2026-06-11', 128000, 'garage'),
  ('KM-R-00093', (select id from vehicule where immatriculation = 'AA389JG'), '2026-06-15', 120000, 'garage'),
  ('KM-R-00094', (select id from vehicule where immatriculation = 'AA390JG'), '2026-06-29', 55000, 'garage'),
  ('KM-R-00095', (select id from vehicule where immatriculation = 'AA735MY'), '2026-07-06', 62500, 'garage'),
  ('KM-R-00096', (select id from vehicule where immatriculation = 'DK9649BG'), '2026-07-06', 181000, 'garage'),
  ('KM-R-00097', (select id from vehicule where immatriculation = 'AA392JG'), '2026-07-13', 70000, 'garage'),
  ('KM-R-00098', (select id from vehicule where immatriculation = 'AA128JC'), '2026-07-14', 61000, 'garage'),
  ('KM-R-00099', (select id from vehicule where immatriculation = 'AA023EA'), '2026-07-22', 162000, 'garage'),
  ('KM-R-00100', (select id from vehicule where immatriculation = 'AA403JG'), '2026-07-27', 84000, 'garage'),
  ('KM-R-00101', (select id from vehicule where immatriculation = 'AA769PA'), '2026-07-27', 95000, 'garage'),
  ('KM-R-00102', (select id from vehicule where immatriculation = 'AA266JC'), '2026-08-10', 68000, 'garage'),
  ('KM-R-00103', (select id from vehicule where immatriculation = 'AA386JG'), '2026-08-13', 141000, 'garage'),
  ('KM-R-00104', (select id from vehicule where immatriculation = 'AA877YM'), '2026-08-25', 15000, 'garage'),
  ('KM-R-00105', (select id from vehicule where immatriculation = 'AA923YM'), '2026-08-25', 10000, 'garage')
on conflict (numero) do nothing;

-- ---- Le kilométrage porté sur l'intervention qui l'a relevé ----
update intervention set km = 31900 where reference like 'BC15772%' and km is null;
update intervention set km = 50000 where reference like 'BC15904%' and km is null;
update intervention set km = 15000 where reference like 'BC16019%' and km is null;
update intervention set km = 175000 where reference like 'BC16053%' and km is null;
update intervention set km = 20000 where reference like 'BC16112%' and km is null;
update intervention set km = 35000 where reference like 'BC16124%' and km is null;
update intervention set km = 27000 where reference like 'BC16245%' and km is null;
update intervention set km = 30700 where reference like 'BC16326%' and km is null;
update intervention set km = 91000 where reference like 'BC16320%' and km is null;
update intervention set km = 21500 where reference like 'BC16523%' and km is null;
update intervention set km = 21000 where reference like 'BC16515%' and km is null;
update intervention set km = 41000 where reference like 'BC16573%' and km is null;
update intervention set km = 30000 where reference like 'BC16855%' and km is null;
update intervention set km = 44000 where reference like 'BC16857%' and km is null;
update intervention set km = 25000 where reference like 'BC16902%' and km is null;
update intervention set km = 40000 where reference like 'BC16953%' and km is null;
update intervention set km = 62000 where reference like 'BC16958%' and km is null;
update intervention set km = 26000 where reference like 'BC16972%' and km is null;
update intervention set km = 29000 where reference like 'BC16985%' and km is null;
update intervention set km = 70000 where reference like 'BC17011%' and km is null;
update intervention set km = 31000 where reference like 'BC17009%' and km is null;
update intervention set km = 40000 where reference like 'BC17039%' and km is null;
update intervention set km = 69000 where reference like 'BC17164%' and km is null;
update intervention set km = 50000 where reference like 'BC17445%' and km is null;
update intervention set km = 34000 where reference like 'BC17561%' and km is null;
update intervention set km = 45000 where reference like 'BC17590%' and km is null;
update intervention set km = 70000 where reference like 'BC17615%' and km is null;
update intervention set km = 80000 where reference like 'BC17766%' and km is null;
update intervention set km = 55000 where reference like 'BC17919%' and km is null;
update intervention set km = 30000 where reference like 'BC17912%' and km is null;
update intervention set km = 92000 where reference like 'BC17965%' and km is null;
update intervention set km = 31000 where reference like 'BC18037%' and km is null;
update intervention set km = 50000 where reference like 'BC18038%' and km is null;
update intervention set km = 41000 where reference like 'BC18289%' and km is null;
update intervention set km = 40000 where reference like 'BC18288%' and km is null;
update intervention set km = 76000 where reference like 'BC18290%' and km is null;
update intervention set km = 50000 where reference like 'BC18319%' and km is null;
update intervention set km = 62000 where reference like 'BC18396%' and km is null;
update intervention set km = 56000 where reference like 'BC18393%' and km is null;
update intervention set km = 35000 where reference like 'BC18456%' and km is null;
update intervention set km = 56000 where reference like 'BC18492%' and km is null;
update intervention set km = 91000 where reference like 'BC18513%' and km is null;
update intervention set km = 60000 where reference like 'BC18560%' and km is null;
update intervention set km = 165000 where reference like 'BC18561%' and km is null;
update intervention set km = 95000 where reference like 'BC18595%' and km is null;
update intervention set km = 66000 where reference like 'BC18594%' and km is null;
update intervention set km = 37000 where reference like 'BC18653%' and km is null;
update intervention set km = 46000 where reference like 'BC18671%' and km is null;
update intervention set km = 90000 where reference like 'BC18672%' and km is null;
update intervention set km = 125000 where reference like 'BC18673%' and km is null;
update intervention set km = 302000 where reference like 'BC18690%' and km is null;
update intervention set km = 65000 where reference like 'BC18813%' and km is null;
update intervention set km = 44500 where reference like 'BC18797%' and km is null;
update intervention set km = 67000 where reference like 'BC18908%' and km is null;
update intervention set km = 40000 where reference like 'BC18957%' and km is null;
update intervention set km = 53000 where reference like 'CMD2-25110170%' and km is null;
update intervention set km = 42000 where reference like 'CMD2-25120026%' and km is null;
update intervention set km = 106000 where reference like 'CMD2-25120037%' and km is null;
update intervention set km = 60000 where reference like 'CMD2-25120042%' and km is null;
update intervention set km = 106500 where reference like 'CMD2-25120040%' and km is null;
update intervention set km = 91000 where reference like 'CMD2-25120041%' and km is null;
update intervention set km = 51000 where reference like 'CMD2-25120223%' and km is null;
update intervention set km = 71000 where reference like 'CMD2-25120221%' and km is null;
update intervention set km = 71000 where reference like 'CMD2-25120222%' and km is null;
update intervention set km = 3000 where reference like 'CMD2-25120442%' and km is null;
update intervention set km = 45000 where reference like 'CMD2-25120441%' and km is null;
update intervention set km = 175000 where reference like 'CMD2-25120440%' and km is null;
update intervention set km = 63000 where reference like 'CMD2-26010032%' and km is null;
update intervention set km = 81000 where reference like 'CMD2-26010124%' and km is null;
update intervention set km = 104000 where reference like 'CMD2-26020179%' and km is null;
update intervention set km = 65000 where reference like 'CMD2-26020228%' and km is null;
update intervention set km = 55000 where reference like 'CMD2-26020243%' and km is null;
update intervention set km = 122000 where reference like 'CMD2-26020225%' and km is null;
update intervention set km = 50000 where reference like 'CMD2-26020224%' and km is null;
update intervention set km = 115000 where reference like 'CMD2-26020226%' and km is null;
update intervention set km = 332000 where reference like 'CMD2-26020380%' and km is null;
update intervention set km = 3000 where reference like 'CMD2-26020394%' and km is null;
update intervention set km = 51000 where reference like 'CMD2-26020400%' and km is null;
update intervention set km = 112000 where reference like 'CMD2-26020404%' and km is null;
update intervention set km = 120000 where reference like 'CMD2-26030019%' and km is null;
update intervention set km = 77000 where reference like 'CMD2-26030252%' and km is null;
update intervention set km = 97000 where reference like 'CMD2-26030247%' and km is null;
update intervention set km = 63000 where reference like 'CMD2-26030382%' and km is null;
update intervention set km = 128000 where reference like 'CMD2-26030381%' and km is null;
update intervention set km = 65000 where reference like 'CMD2-26030385%' and km is null;
update intervention set km = 7500 where reference like 'CMD2-26030387%' and km is null;
update intervention set km = 31000 where reference like 'CMD2-26040054%' and km is null;
update intervention set km = 47000 where reference like 'CMD2-26040055%' and km is null;
update intervention set km = 50000 where reference like 'CMD2-26040271%' and km is null;
update intervention set km = 66500 where reference like 'CMD2-26050135%' and km is null;
update intervention set km = 82000 where reference like 'CMD2-26050140%' and km is null;
update intervention set km = 128000 where reference like 'CMD2-26060171%' and km is null;
update intervention set km = 120000 where reference like 'CMD2-26060224%' and km is null;
update intervention set km = 55000 where reference like 'CMD2-26060425%' and km is null;
update intervention set km = 62500 where reference like 'CMD2-26070088%' and km is null;
update intervention set km = 181000 where reference like 'CMD2-26070087%' and km is null;
update intervention set km = 70000 where reference like 'CMD2-26070211%' and km is null;
update intervention set km = 61000 where reference like 'CMD2-26070226%' and km is null;
update intervention set km = 162000 where reference like 'CMD2-26070391%' and km is null;
update intervention set km = 84000 where reference like 'CMD2-26070474%' and km is null;
update intervention set km = 95000 where reference like 'CMD2-26070484%' and km is null;
update intervention set km = 68000 where reference like 'CMD2-26080108%' and km is null;
update intervention set km = 141000 where reference like 'CMD2-26080182%' and km is null;
update intervention set km = 15000 where reference like 'CMD2-26080336%' and km is null;
update intervention set km = 10000 where reference like 'CMD2-26080335%' and km is null;

commit;


-- ---------------------------------------------------------------------------
-- Vérification.
-- ---------------------------------------------------------------------------

select count(*) as releves,
       count(distinct vehicule_id) as vehicules,
       min(date) as du, max(date) as au,
       min(km) as km_min, max(km) as km_max
from releve_kilometrique where origine = 'garage';

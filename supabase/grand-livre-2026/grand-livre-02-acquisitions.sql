-- ============================================================================
-- SEDIMA Parc — grand livre 2026 : le prix d'achat des véhicules.
--
-- **Ce n'est pas une migration.** C'est un chargement de données, tiré de
-- `RECAP 31082026.xlsx` (dossier DO, Budget 2027 / Fichiers de travail) :
-- l'extrait du grand livre Sage X3 du 1er janvier au 31 août 2026 et le
-- tableau des immobilisations « matériel de transport ».
-- Fabriqué par `scripts/charger-grand-livre.mts` — voir docs/GRAND-LIVRE-2026.md.
--
-- 89 véhicules reçoivent leur valeur d'acquisition, leur date d'acquisition, leur durée
-- d'amortissement et leur référence d'immobilisation. Chaque ligne dit sa preuve.
--
-- LE GARDE-FOU. Une valeur déjà saisie à la main n'est jamais écrasée : la
-- ligne n'est écrite que si `valeur_acquisition` est vide, ou si elle vient
-- déjà de cette même immobilisation (rejeu).
--
-- REJOUABLE. À jouer **dans l'ordre des fichiers**, après la migration 0057.
-- ============================================================================

with source (immatriculation, valeur, date_acquisition, duree, reference) as (values
  -- 01 4X4 TOYOTA HILUX · Toyota Hilux acquis le 30/09/2011 ; mise en circulation le 06/10/2011
  ('DK6067AM', 14645000, '2011-09-30'::date, 4, 'IMM-201-01213'),
  -- FVN05160 CFAO SNGL 1 TOYOTA HILUX · Toyota Hilux CFAO acquis le 23/04/2012 ; mise en circulation le même jour
  ('DK5241AN', 15330000, '2012-04-23'::date, 4, 'IMM-201-01214'),
  -- F2013101425 SENEGALAISE KIA SORENTO · Kia Sorento acquis le 30/09/2013 ; Kia KU814D mis en circulation le 01/10/2013
  ('DK5077AS', 26590000, '2013-09-30'::date, 4, 'IMM-201-01217'),
  -- F2013101462 SENEGALAISE CITREON C4 · deux Citroën identiques acquises le 15/10/2013, deux mises en circulation ce jour-là
  ('DK6153AS', 16640000, '2013-10-15'::date, 4, 'IMM-201-01218'),
  -- F2013101461 SENEGALAISE CITREON C4 · deux Citroën identiques acquises le 15/10/2013, deux mises en circulation ce jour-là
  ('DK6154AS', 16640000, '2013-10-15'::date, 4, 'IMM-201-01219'),
  -- LA SENEGALAISE DE L'AUTO N° 2014102141 1 KIA SORENTO · Kia Sorento acquis le 10/12/2014 ; mise en circulation le même jour
  ('AB741AP', 25863000, '2014-12-10'::date, 4, 'IMM-201-01221'),
  -- L'AFRICAINE DE L'AUTO RANGE ROVER · seul Range Rover du parc ; mise en circulation le 29/01/2015
  ('AA139HP', 80000000, '2015-01-21'::date, 4, 'IMM-201-01222'),
  -- CFAO MOTORS 1 BUS TOYOTA COASTER PE · bus Toyota Coaster acquis le 24/02/2015 ; Toyota HZB50L mis en circulation le 13/02/2015
  ('AA301PT', 40500000, '2015-02-24'::date, 4, 'IMM-201-01224'),
  -- TOUBA AUTO SALE CHRYSLER · seule Chrysler du parc
  ('DK9181BB', 32690895, '2016-04-19'::date, 4, 'IMM-201-01233'),
  -- UNITECH MOTORS N° UM/SL/1604/01 1 VEHICULE TATA 10T · Tata 10 T acquis le 31/05/2016 ; Tata fourgon 10 T mis en circulation le 01/06/2016
  ('AA226SX', 27500000, '2016-05-31'::date, 4, 'IMM-201-01227'),
  -- LA SENEGALAISE DE L'AUTO N° 2016100637 1MITSUBISHI L200 · deux L200 identiques acquis le 31/05/2016, deux mis en circulation le 20/05/2016
  ('AB098JC', 16540000, '2016-05-31'::date, 4, 'IMM-201-01229'),
  -- LA SENEGALAISE DE L'AUTO N° 2016100638 1MITSUBISHI L200 · deux L200 identiques acquis le 31/05/2016, deux mis en circulation le 20/05/2016
  ('DK1307BB', 16540000, '2016-05-31'::date, 4, 'IMM-201-01230'),
  -- 2 RENAULT DUSTER · « 2 Renault Duster » : les deux seuls Duster du parc, valeur partagée par moitié — 23 719 848 F pour 2 véhicules
  ('DK4922BB', 11859924, '2017-01-01'::date, 5, 'IMM-201-01319'),
  -- 2 RENAULT DUSTER · « 2 Renault Duster » : les deux seuls Duster du parc, valeur partagée par moitié — 23 719 848 F pour 2 véhicules
  ('DK4923BB', 11859924, '2017-01-01'::date, 5, 'IMM-201-01319'),
  -- ACHAT VEHICULE MAN TRUCK BUS TRANSPORT ŒUFS · seul MAN du parc — transport d'œufs
  ('DK2507BD', 33947744, '2017-02-07'::date, 4, 'IMM-201-01234'),
  -- ACHAT VEHICULE LEXUS LX570 M. NGOM · seule Lexus du parc
  ('DK0082BD', 112137863, '2017-02-16'::date, 4, 'IMM-201-01235'),
  -- LA SENEGALAISE DE L'AUTO 1 MITSUBISHI L200 · cinq L200 identiques acquis le 28/02/2017, cinq L200 immatriculés DK 23xx/30xx BD en février-mars 2017
  ('DK2346BD', 17543200, '2017-02-28'::date, 4, 'IMM-201-01236'),
  -- LA SENEGALAISE DE L'AUTO 1 MITSUBISHI L200 · cinq L200 identiques acquis le 28/02/2017, cinq L200 immatriculés DK 23xx/30xx BD en février-mars 2017
  ('DK2347BD', 17543200, '2017-02-28'::date, 4, 'IMM-201-01237'),
  -- LA SENEGALAISE DE L'AUTO 1 MITSUBISHI L200 · cinq L200 identiques acquis le 28/02/2017, cinq L200 immatriculés DK 23xx/30xx BD en février-mars 2017
  ('DK2348BD', 17543200, '2017-02-28'::date, 4, 'IMM-201-01238'),
  -- LA SENEGALAISE DE L'AUTO 1 MITSUBISHI L200 · cinq L200 identiques acquis le 28/02/2017, cinq L200 immatriculés DK 23xx/30xx BD en février-mars 2017
  ('DK3032BD', 17543200, '2017-02-28'::date, 4, 'IMM-201-01239'),
  -- LA SENEGALAISE DE L'AUTO 1 MITSUBISHI L200 · cinq L200 identiques acquis le 28/02/2017, cinq L200 immatriculés DK 23xx/30xx BD en février-mars 2017
  ('DK3033BD', 17543200, '2017-02-28'::date, 4, 'IMM-201-01240'),
  -- CAETANO FORMULA HYUNDAI Ix35 · Hyundai ix35 Caetano acquis le 19/05/2017 ; seul ix35 sans immobilisation nommée
  ('DK0099BD', 17500000, '2017-05-19'::date, 4, 'IMM-201-01241'),
  -- 2 C-ELYSEE commercial · « 2 C-Élysée commercial » acquises le 30/10/2017 ; deux C-Élysée mises en circulation le 16/11/2017, valeur partagée par moitié — 17 980 000 F pour 2 véhicules
  ('DK4424BF', 8990000, '2017-10-30'::date, 5, 'IMM-201-01320'),
  -- 2 C-ELYSEE commercial · « 2 C-Élysée commercial » acquises le 30/10/2017 ; deux C-Élysée mises en circulation le 16/11/2017, valeur partagée par moitié — 17 980 000 F pour 2 véhicules
  ('DK4517BF', 8990000, '2017-10-30'::date, 5, 'IMM-201-01320'),
  -- Hyundai IX35/DIARRASOUBA DK 9723 BD · plaque écrite dans la désignation
  ('DK9723BD', 13600000, '2017-11-30'::date, 5, 'IMM-201-01322'),
  -- CAETANO 1 HYUDAI CRETA YACINE DIOP · seule Hyundai Creta du parc ; mise en circulation le 07/02/2018
  ('DK1870BG', 14500000, '2018-03-09'::date, 4, 'IMM-201-01248'),
  -- AUBINEAU 1 CAMION SEMI REMORQUE · seul camion Aubineau du parc (40 000 poussins)
  ('AA300PT', 157083118, '2018-06-28'::date, 4, 'IMM-201-01253'),
  -- CFAO MOTORS 1 MINI BUS · minibus CFAO acquis le 29/06/2018 ; Toyota Hiace mis en circulation le 13/06/2018
  ('AA296PT', 23500000, '2018-06-29'::date, 4, 'IMM-201-01254'),
  -- LA SENEGALAISE N° 2018102358 · deux L200 identiques acquis le 03/12/2018 ; DK 9839 BK et DK 9840 BK, plaques qui se suivent
  ('DK9839BK', 17194000, '2018-12-03'::date, 4, 'IMM-201-01257'),
  -- LA SENEGALAISE N° 2018102357 · deux L200 identiques acquis le 03/12/2018 ; DK 9839 BK et DK 9840 BK, plaques qui se suivent
  ('DK9840BK', 17194000, '2018-12-03'::date, 4, 'IMM-201-01258'),
  -- CUBAS N°19100057 ACHAT CAMION VRAC · seule citerne vrac CUBAS du parc
  ('AA053AP', 69856509, '2019-01-30'::date, 4, 'IMM-201-01262'),
  -- LA SENEGALAISE DE L'AUTOMOBILE 1 CITROEN GABY · deux Citroën identiques acquises le 28/02/2019 ; deux C-Élysée mises en circulation le 13/02/2019
  ('DK5679BL', 11690000, '2019-02-28'::date, 5, 'IMM-201-01325'),
  -- LA SENEGALAISE DE L'AUTOMOBILE 1 CITROEN DJIBRIL NDIAYE · deux Citroën identiques acquises le 28/02/2019 ; deux C-Élysée mises en circulation le 13/02/2019
  ('DK5680BL', 11690000, '2019-02-28'::date, 5, 'IMM-201-01326'),
  -- FATOU DIAGNE MITSUBISHI ASX MAME DIARRA · seul Mitsubishi ASX du parc
  ('DK9046AT', 7500000, '2019-05-20'::date, 4, 'IMM-201-01264'),
  -- CAETANO ACHAT 1 VEHICULE FORD ISSAKHA DIOUF · Ford acquis le 16/12/2019 ; Ford Ecosport immatriculé le 23/12/2019
  ('DK5347BM', 8755470, '2019-12-16'::date, 4, 'IMM-201-01267'),
  -- DLC N°WDC2923641QA08624 MERCO GL VPE · Mercedes GL acquis le 06/05/2021 ; seul Mercedes GLE du parc immatriculé en 2021
  ('AA485DR', 35000000, '2021-05-06'::date, 4, 'IMM-201-01279'),
  -- CAETANO HYUNDAI SANTA FE DACI · Hyundai Santa Fe Caetano acquis le 21/06/2021 ; mise en circulation le 23/06/2021
  ('AA099DZ', 25058269, '2021-06-21'::date, 4, 'IMM-201-01280'),
  -- LA SENEGALAISE 1 BERLINGO PR CCLE · Berlingo identiques acquis le 06/07/2021 ; AA 019 EA et AA 200 EA mis en circulation fin juin 2021
  ('AA019EA', 10990000, '2021-07-06'::date, 5, 'IMM-201-01339'),
  -- LA SENEGALAISE 1 CITROEN C-ELYSEE · C-Élysée acquise le 06/07/2021 ; seule C-Élysée mise en circulation le 28/06/2021
  ('AA021EA', 9900000, '2021-07-06'::date, 5, 'IMM-201-01342'),
  -- LA SENEGALAISE 1 BERLINGO PR CCLE · Berlingo identiques acquis le 06/07/2021 ; AA 019 EA et AA 200 EA mis en circulation fin juin 2021
  ('AA200EA', 10990000, '2021-07-06'::date, 5, 'IMM-201-01341'),
  -- CAETANO FORMULA N°1.5T-1 BAICX7 AA-214-JC · plaque écrite dans la désignation
  ('AA214JC', 24500000, '2022-06-30'::date, 4, 'IMM-201-01292'),
  -- CFAO N°INV-S-000015057 1 SUZUKI VITARA GLX AA-128-JC · plaque écrite dans la désignation
  ('AA128JC', 16500000, '2022-07-18'::date, 4, 'IMM-201-01303'),
  -- CFAO N°INV-S-000015057 1 SUZUKI VITARA GLX AA-129-JC · plaque écrite dans la désignation
  ('AA129JC', 16500000, '2022-07-18'::date, 4, 'IMM-201-01304'),
  -- CFAO N°INV-S-000015057 1 SUZUKI VITARA GLX AA-135-JC · plaque écrite dans la désignation
  ('AA135JC', 16500000, '2022-07-18'::date, 4, 'IMM-201-01301'),
  -- CFAO N°INVTOYOTA CORROLA CROSS AA-544-JD · plaque écrite dans la désignation
  ('AA544JD', 18900000, '2022-07-22'::date, 4, 'IMM-201-01314'),
  -- CFAO TOYOTA CORROLA CROSS AA-547-JD · plaque écrite dans la désignation
  ('AA547JD', 18900000, '2022-07-22'::date, 4, 'IMM-201-01309'),
  -- CFAO TOYOTA CORROLA CROSS AA-550-JD · plaque écrite dans la désignation
  ('AA550JD', 18900000, '2022-07-22'::date, 4, 'IMM-201-01308'),
  -- CFAO TOYOTA CORROLA CROSS AA-554-JD · plaque écrite dans la désignation
  ('AA554JD', 18900000, '2022-07-22'::date, 4, 'IMM-201-01310'),
  -- CFAO TOYOTA CORROLA CROSS AA-556-JD · plaque écrite dans la désignation
  ('AA556JD', 18900000, '2022-07-22'::date, 4, 'IMM-201-01307'),
  -- CAETANO FORMULA N°255/2022 1 BAICX7 AA-278-JE · plaque écrite dans la désignation
  ('AA278JE', 24500000, '2022-07-26'::date, 4, 'IMM-201-01306'),
  -- CAETANO ONE N°41/2022 1 FORD ECOSPORT AA-324-JE · plaque écrite dans la désignation
  ('AA324JE', 14500000, '2022-07-26'::date, 4, 'IMM-201-01305'),
  -- CFAO N°INV-S-000015057 1 SUZUKI VITARA GLX AA-266-JC · plaque écrite dans la désignation
  ('AA266JC', 16500000, '2022-08-01'::date, 4, 'IMM-201-01302'),
  -- CFAO 2 SUZUKI MAGUETTE NDOYE-MOUHAM-AA 270 JF-AA 320 JF · plaque écrite dans la désignation — 33 000 000 F pour 2 véhicules
  ('AA270JF', 16500000, '2022-08-01'::date, 5, 'IMM-201-01345'),
  -- CFAO 2 SUZUKI MAGUETTE NDOYE-MOUHAM-AA 270 JF-AA 320 JF · plaque écrite dans la désignation — 33 000 000 F pour 2 véhicules
  ('AA320JF', 16500000, '2022-08-01'::date, 5, 'IMM-201-01345'),
  -- LASA 1 MITSUBISHI NEW L200 CHASSIS N°MMBJNKL30NH078053 · numéro de châssis écrit dans la désignation
  ('AA389JG', 17940000, '2022-08-01'::date, 4, 'IMM-201-01311'),
  -- CFAO 1 TOYOTA ALASSANE NDIAYE-AA 541 JD · plaque écrite dans la désignation
  ('AA541JD', 18900000, '2022-08-01'::date, 5, 'IMM-201-01346'),
  -- CFAO N°INV-S-016938TOYOTA CORROLA CROSS AA-189-JM · plaque écrite dans la désignation
  ('AA189JM', 18900000, '2022-08-19'::date, 4, 'IMM-201-01313'),
  -- LASA 1 KIA SORENTO BVA N°KNARH81DDN515746 AA 963 JM · plaque écrite dans la désignation
  ('AA963JM', 36940000, '2022-08-23'::date, 4, 'IMM-201-01299'),
  -- LASA 1 KIA SORENTO BVA N°KNARH81DDN5157345 AA 966 JM · plaque écrite dans la désignation
  ('AA966JM', 36940000, '2022-08-23'::date, 4, 'IMM-201-01300'),
  -- CFAO N°INV-S-000035750 1 BUS TOYOTA WHITE PERSONNEL SED · bus Toyota du personnel acquis le 26/06/2023 ; Coaster mis en circulation le 21/06/2023
  ('AA106NE', 53500000, '2023-06-26'::date, 5, 'IMM-201-01349'),
  -- LASA 01SCOOTER SUZUKI BURGMAN UB125 RESPONS. TEHRAL AA372WJ · plaque écrite dans la désignation
  ('AA372WJ', 1350000, '2025-01-24'::date, 4, 'IMM-201-01359'),
  -- LASA 01 MOTO SUZUKI BURGMAN GRIS UB125 17.04.25 BR30B BC1787 · deux Suzuki Burgman identiques acquis le 17/04/2025 ; deux motos Suzuki du 21/03/2025
  ('AA877YM', 1350000, '2025-04-17'::date, 4, 'IMM-201-01360'),
  -- LASA 01 MOTO SUZUKI BURGMAN BLANC UB125 17.04.25 BR30B BC178 · deux Suzuki Burgman identiques acquis le 17/04/2025 ; deux motos Suzuki du 21/03/2025
  ('AA923YM', 1350000, '2025-04-17'::date, 4, 'IMM-201-01361'),
  -- TRACTAFRIC MOTORS 01 CAMION TRACTEUR ROUTIER 6*4 FAW 390HP 1 · seul tracteur FAW du parc ; mise en circulation le 16/10/2025
  ('AB932EF', 40700000, '2025-09-15'::date, 4, 'IMM-201-01364'),
  -- DAKAR LUXURY CARS 01 VEH HYUNDAI SANTAFE 2021 DIESEL OUSMANE · Santa Fe 2021 acquis le 15/12/2025 ; immatriculé le 18/12/2025
  ('AB716FK', 20500000, '2025-12-15'::date, 4, 'IMM-201-01367'),
  -- MOUSSA NAR FALL MOTORS 01 MERCEDES GLE450 2022 · seule Mercedes GLE 450 du parc
  ('AB936PT', 43800000, '2026-01-21'::date, 4, 'IMM-201-01562'),
  -- CFAO 01 CAMIONNETTE HOHAN 4X2 7-10T, HOWO, CAISSE FERMEE BC · camion 7-10 T caisse fermée de la minoterie acquis le 29/01/2026 ; seul camion 10 T neuf de la minoterie, mis en circulation le 27/03/2026
  ('AB681HE', 21000000, '2026-01-29'::date, 4, 'IMM-201-01564'),
  -- 01 JEEP GRAND CHEROKEE 2017-18 1C4RJFJM5HC897934 AB563HD Mr · plaque écrite dans la désignation
  ('AB563HD', 16400000, '2026-03-11'::date, 4, 'IMM-201-01566'),
  -- DLC 01 HYUNDAI SANTAFE 2020 KMHS381ADLU294953 AB592HD INNOC · plaque écrite dans la désignation
  ('AB592HD', 16950000, '2026-03-11'::date, 4, 'IMM-201-01567'),
  -- 01 TOYOTA HILUX DIESEL 2016-2019-2020 AB571HZ DOCTEUR SOMBON · plaque écrite dans la désignation
  ('AB571HZ', 23330000, '2026-05-06'::date, 4, 'IMM-201-01569'),
  -- 01 TOYOTA HILUX DIESEL 2016-2019-2020 AB792JA ASSANE GUEYE D-NON AFFEC · plaque écrite dans la désignation
  ('AB792JA', 23330000, '2026-05-06'::date, 4, 'IMM-201-01570'),
  -- 01 TOYOTA HILUX DIESEL 2016-2019-2020 AB795JA THIERRY-MACODOU GASSAMA · plaque écrite dans la désignation
  ('AB795JA', 23330000, '2026-05-06'::date, 4, 'IMM-201-01571'),
  -- VISIONARY EPICS SENEGAL 01CAMION BENNE8x4 SINOTRUC TX400 BC2 · camion benne 8×4 Sinotruk acquis le 27/05/2026 ; HOWO ZZ3317 mis en circulation le 05/06/2026
  ('AB361JL', 65000000, '2026-05-27'::date, 4, 'IMM-201-01573'),
  -- HUBEI MANTEN AUTO 01 VRAQUIER BULK FEED AB551HS · plaque écrite dans la désignation
  ('AB551HS', 43198733, '2026-07-01'::date, 4, 'IMMO-201-2185'),
  -- CFAO 01 PICKUP 2CAB TOYOTA HILUX 2.4 MANUEL 2026 AB-900-JW · plaque écrite dans la désignation
  ('AB900JW', 24250000, '2026-07-03'::date, 4, 'IMMO-201-2199'),
  -- CFAO 01 PICKUP 2CAB TOYOTA HILUX 2.4 MANUEL 2026 AB-903-JW · plaque écrite dans la désignation
  ('AB903JW', 24250000, '2026-07-03'::date, 4, 'IMMO-201-2200'),
  -- CFAO 01 PICKUP 2CAB TOYOTA HILUX 2.4 MANUEL 2026 AB-907-JW · plaque écrite dans la désignation
  ('AB907JW', 24250000, '2026-07-03'::date, 4, 'IMMO-201-2201'),
  -- LASA 01 L200 MITSUBISHI 2026 DOUBLE CABINE AUTOMATIC AB282JT · plaque écrite dans la désignation
  ('AB282JT', 32040000, '2026-07-13'::date, 4, 'IMMO-201-2203'),
  -- LASA 01 L200 MITSUBISHI 2026 DOUBLE CABINE AUTOMATIC AB489JY · plaque écrite dans la désignation
  ('AB489JY', 32040000, '2026-07-13'::date, 4, 'IMMO-201-2204'),
  -- LASA 01 MITSUBISHI L200 TRITON 2026 MANUEL 2CAB 2.4 AB565KP · plaque écrite dans la désignation
  ('AB565KP', 19940000, '2026-08-18'::date, 4, 'IMMO-201-2212'),
  -- LASA 01 MITSUBISHI L200 TRITON 2026 MANUEL 2CAB 2.4 AB609KP · plaque écrite dans la désignation
  ('AB609KP', 19940000, '2026-08-18'::date, 4, 'IMMO-201-2213'),
  -- LASA 01 MITSUBISHI L200 TRITON 2026 MANUEL 2CAB 2.4 AB611KP · plaque écrite dans la désignation
  ('AB611KP', 19940000, '2026-08-18'::date, 4, 'IMMO-201-2214'),
  -- LASA 01 MITSUBISHI L200 TRITON 2026 MANUEL 2CAB 2.4 AB612KP · plaque écrite dans la désignation
  ('AB612KP', 19940000, '2026-08-18'::date, 4, 'IMMO-201-2210'),
  -- LASA 01 MITSUBISHI L200 TRITON 2026 MANUEL 2CAB 2.4 AB614KP · plaque écrite dans la désignation
  ('AB614KP', 19940000, '2026-08-18'::date, 4, 'IMMO-201-2207'),
  -- LASA 01 MITSUBISHI L200 TRITON 2026 MANUEL 2CAB 2.4 AB615KP · plaque écrite dans la désignation
  ('AB615KP', 19940000, '2026-08-18'::date, 4, 'IMMO-201-2205'),
  -- LASA 01 MITSUBISHI L200 TRITON 2026 MANUEL 2CAB 2.4 AB616KP · plaque écrite dans la désignation
  ('AB616KP', 19940000, '2026-08-18'::date, 4, 'IMMO-201-2208'),
  -- LASA 01 MITSUBISHI L200 TRITON 2026 MANUEL 2CAB 2.4 AB617KP · plaque écrite dans la désignation
  ('AB617KP', 19940000, '2026-08-18'::date, 4, 'IMMO-201-2206'),
  -- LASA 01 MITSUBISHI L200 TRITON 2026 MANUEL 2CAB 2.4 AB619KP · plaque écrite dans la désignation
  ('AB619KP', 19940000, '2026-08-18'::date, 4, 'IMMO-201-2209'),
  -- LASA 01 MITSUBISHI L200 TRITON 2026 MANUEL 2CAB 2.4 AB622KP · plaque écrite dans la désignation
  ('AB622KP', 19940000, '2026-08-18'::date, 4, 'IMMO-201-2211')
)
update vehicule v
   set valeur_acquisition = s.valeur,
       date_acquisition = s.date_acquisition,
       duree_amortissement_annees = s.duree,
       reference_immobilisation = s.reference
  from source s
 where v.immatriculation = s.immatriculation
   and (v.valeur_acquisition is null or v.reference_immobilisation = s.reference);

-- Ce que la flotte porte après le passage.
select count(*) filter (where valeur_acquisition is not null) as vehicules_valorises,
       sum(valeur_acquisition) as valeur_totale,
       count(*) as vehicules
  from vehicule;

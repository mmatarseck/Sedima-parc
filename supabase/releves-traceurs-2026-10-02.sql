-- ============================================================================
-- SEDIMA Parc — odomètres des balises au 2026-10-02 (Liste_des_traceurs_02-10-2026.xlsx).
--
-- **Ce n'est pas une migration.** Écrit par `scripts/charger-traceurs.mts`.
-- 11 relevés « telematique », un par véhicule, numérotés TEL-261002-<plaque>.
-- Écartés (63) :
--   * AA 019 EA — 90 674 km, invérifiable : aucun compteur connu de AA019EA
--   * AA 119 AH — bond invraisemblable : 259 331 km, contre 182 755 km au 2026-07-08 (relevé saisie), soit 890 km par jour
--   * AA 131 EX — recule : 107 888 km, contre 151 000 km au 2026-07-08 (relevé saisie)
--   * AA 200 EA — 200 031 km, invérifiable : aucun compteur connu de AA200EA
--   * AA 390 JG — recule : 44 594 km, contre 55 300 km au 2026-07-08 (relevé saisie)
--   * AA 392 JG — recule : 41 249 km, contre 70 000 km au 2026-07-13 (relevé garage)
--   * AA 403 JG — bond invraisemblable : 192 657 km, contre 84 000 km au 2026-07-27 (relevé garage), soit 1 622 km par jour
--   * AA 484 BH — 29 136 km, invérifiable : aucun compteur connu de AA484BH
--   * AA 856 FG — 155 701 km, invérifiable : aucun compteur connu de AA856FG
--   * AA 966 AD — 31 351 km, invérifiable : aucun compteur connu de AA966AD
--   * AA 990 DZ — bond invraisemblable : 241 155 km, contre 186 554 km au 2026-07-08 (relevé saisie), soit 635 km par jour
--   * AB 077 FP — 19 327 km, invérifiable : aucun compteur connu de AB077FP
--   * BUS-AA 106 NE — 87 546 km, invérifiable : aucun compteur connu de AA106NE
--   * BUS-AA 296 PT — 335 392 km, invérifiable : aucun compteur connu de AA296PT
--   * CM-AA 093 VA — recule : 228 152 km, contre 230 750 km au 2026-07-08 (relevé saisie)
--   * CM-AA 105 VA — 17 861 km, invérifiable : aucun compteur connu de AA105VA
--   * CM-AA 180 CQ — recule : 50 449 km, contre 685 099 km au 2026-07-08 (relevé saisie)
--   * CM-AA 186 CQ — recule : 7 830 km, contre 134 567 km au 2026-07-08 (relevé saisie)
--   * CM-AA 226 SX — 601 189 km, invérifiable : aucun compteur connu de AA226SX
--   * CM-AA 235 MR — 884 km, invérifiable : aucun compteur connu de AA235MR
--   * CM-AA 236 MR — recule : 32 208 km, contre 492 050 km au 2026-07-08 (relevé saisie)
--   * CM-AA 277 PT — 31 041 km, invérifiable : aucun compteur connu de AA277PT
--   * CM-AA 281 PT — 32 448 km, invérifiable : aucun compteur connu de AA281PT
--   * CM-AA 285 PT — 57 106 km, invérifiable : aucun compteur connu de AA285PT
--   * CM-AA 291 PT — 84 945 km, invérifiable : aucun compteur connu de AA291PT
--   * CM-AA 300 PT — recule : 113 285 km, contre 347 000 km au 2026-07-08 (relevé saisie)
--   * CM-AA 350 JN — 23 307 km, invérifiable : aucun compteur connu de AA350JN
--   * CM-AA 359 AH — bond invraisemblable : 755 688 km, contre 230 925 km au 2026-07-08 (relevé saisie), soit 6 102 km par jour
--   * CM-AA 542 BQ — 34 940 km, invérifiable : aucun compteur connu de AA542BQ
--   * CM-AA 565 GA — recule : 161 328 km, contre 245 675 km au 2026-07-08 (relevé saisie)
--   * CM-AA 568 GA — bond invraisemblable : 316 763 km, contre 104 135 km au 2026-07-08 (relevé saisie), soit 2 472 km par jour
--   * CM-AA 585 HQ — hors du parc (AA585HQ)
--   * CM-AA 605 TR — recule : 64 293 km, contre 152 659 km au 2026-09-02 (relevé saisie)
--   * CM-AA 624 JA — hors du parc (AA624JA)
--   * CM-AA 633 JL — 42 677 km, invérifiable : aucun compteur connu de AA633JL
--   * CM-AA 737 ZW — 16 989 km, invérifiable : aucun compteur connu de AA737ZW
--   * CM-AA 768 JV — recule : 30 050 km, contre 234 789 km au 2026-07-08 (relevé saisie)
--   * CM-AA 783 BN — recule : 133 970 km, contre 345 671 km au 2026-07-08 (relevé saisie)
--   * CM-AA 872 DY — hors du parc (AA872DY)
--   * CM-AA 905 CW — 29 051 km, invérifiable : aucun compteur connu de AA905CW
--   * CM-AA 927 CA — recule : 18 759 km, contre 216 254 km au 2022-04-14 (plein)
--   * CM-AA 977 MR — recule : 35 062 km, contre 357 899 km au 2026-07-08 (relevé saisie)
--   * CM-AA 985 MR — 348 254 km, invérifiable : aucun compteur connu de AA985MR
--   * CM-AB 277 BL — hors du parc (AB277BL)
--   * CM-AB 681 HE — recule : 1 742 km, contre 6 123 km au 2026-07-08 (relevé saisie)
--   * CM-AB 932 EF — bond invraisemblable : 80 773 km, contre 750 km au 2026-07-08 (relevé saisie), soit 931 km par jour
--   * CM-KG 5401 A — hors du parc (KG5401A)
--   * CM-TH 3166 D — hors du parc (TH3166D)
--   * DK 1306 BB — 241 798 km, invérifiable : aucun compteur connu de AB098JC
--   * DK 1514 AM — hors du parc (DK1514AM)
--   * DK 1870 BG — 120 112 km, invérifiable : aucun compteur connu de DK1870BG
--   * DK 2346 BD — recule : 32 082 km, contre 231 354 km au 2026-07-08 (relevé saisie)
--   * DK 2348 BD — recule : 81 857 km, contre 322 134 km au 2026-07-08 (relevé saisie)
--   * DK 4336 AS — hors du parc (DK4336AS)
--   * DK 4424 BF — 168 216 km, invérifiable : aucun compteur connu de DK4424BF
--   * DK 4517 BF — 153 802 km, invérifiable : aucun compteur connu de DK4517BF
--   * DK 5347 BM — 144 934 km, invérifiable : aucun compteur connu de DK5347BM
--   * DK 5680 BL — 147 248 km, invérifiable : aucun compteur connu de DK5680BL
--   * DK 6154 AS — 61 510 km, invérifiable : aucun compteur connu de DK6154AS
--   * DK 6875 BF — bond invraisemblable : 351 753 km, contre 267 900 km au 2026-07-08 (relevé saisie), soit 975 km par jour
--   * DK 9723 BD — 5 555 km, invérifiable : aucun compteur connu de DK9723BD
--   * DK 9839 BK — recule : 70 855 km, contre 201 984 km au 2022-06-21 (plein)
--   * DL 1314 C — hors du parc (DL1314C)
--
-- Rejouable : `on conflict (numero) do nothing`.
-- ============================================================================

insert into releve_kilometrique (numero, vehicule_id, date, km, origine)
select v.numero, ve.id, '2026-10-02'::date, v.km, 'telematique'
  from (values
    ('TEL-261002-AA021EA', 'AA021EA', 124402),
    ('TEL-261002-AA022EA', 'AA022EA', 198405),
    ('TEL-261002-AA023EA', 'AA023EA', 167151),
    ('TEL-261002-AA032EA', 'AA032EA', 361909),
    ('TEL-261002-AA386JG', 'AA386JG', 145301),
    ('TEL-261002-AA389JG', 'AA389JG', 134510),
    ('TEL-261002-AA397JG', 'AA397JG', 144605),
    ('TEL-261002-AA562EE', 'AA562EE', 158101),
    ('TEL-261002-AA735MY', 'AA735MY', 68831),
    ('TEL-261002-AA769PA', 'AA769PA', 99191),
    ('TEL-261002-DK1307BB', 'DK1307BB', 262842)
  ) as v(numero, immatriculation, km)
  join vehicule ve on ve.immatriculation = v.immatriculation
on conflict (numero) do nothing;

select count(*) as releves, min(km) as km_min, max(km) as km_max
  from releve_kilometrique where numero like 'TEL-261002-%';

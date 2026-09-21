-- ============================================================================
-- SEDIMA Parc — une facture qui couvre plusieurs véhicules se répartit entre eux.
--
-- **Ce n'est pas une migration.** Métier, 21 septembre 2026 : « des factures
-- regroupent plusieurs véhicules — à splitter par véhicule pour bien répartir
-- les charges ». Fabriqué par `scripts/repartir-factures.mts`.
--
-- 59 dépenses, 47 775 262 F, deviennent 164 parts. Le premier véhicule portait
-- seul la charge de tous ; chacun porte désormais la sienne.
--
--   * 7 bons sont répartis **selon le grand livre**, qui passe une écriture
--     par véhicule là où le bon n'a qu'un total : ce sont les vraies parts.
--   * 52 le sont **à parts égales** — une convention, pas une mesure : la
--     facture ne ventile pas. La référence de chaque part le dit.
--
-- La dépense d'origine garde son numéro et devient la part du premier
-- véhicule : sa facture, la demande d'achat et la caisse qui la citent la
-- retrouvent. Les autres parts (`…-2`, `…-3`) reprennent sa date, son poste,
-- son fournisseur et **sa facture attachée**. L'intervention jumelle suit, au
-- même suffixe. 12 parts vont à des véhicules absents de la flotte
-- (AA 763 JV, DK 6241 BM, DK 2614 BH, DK 7621 BG, DK 4280 AS, DK 1306 BB, DK 3674 AX, DK 1399 BK, AA 125 JC) : elles restent des dépenses du parc,
-- sans véhicule, et nomment la plaque.
--
-- LE GARDE-FOU. Une ligne n'est touchée que si son montant est encore le total
-- lu, ou déjà sa part. REJOUABLE : un second passage ne change rien.
-- ============================================================================

begin;

-- DEP-C-00026 · CMD2-26040053 · 290 000 F · 6 véhicules · parts du grand livre
update depense set montant = 50000, reference = 'CMD2-26040053 · facture répartie — part 1/6 de 290 000 F, selon le grand livre' where numero = 'DEP-C-00026' and montant in (290000, 50000);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-C-00026-2', (select id from vehicule where immatriculation = 'AA856FG'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 90000, o.beneficiaire, 'CMD2-26040053 · facture répartie — part 2/6 de 290 000 F, selon le grand livre', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-C-00026' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-C-00026-3', (select id from vehicule where immatriculation = 'DK9839BK'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 75000, o.beneficiaire, 'CMD2-26040053 · facture répartie — part 3/6 de 290 000 F, selon le grand livre', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-C-00026' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-C-00026-4', (select id from vehicule where immatriculation = 'AA022EA'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 45000, o.beneficiaire, 'CMD2-26040053 · facture répartie — part 4/6 de 290 000 F, selon le grand livre', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-C-00026' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-C-00026-5', (select id from vehicule where immatriculation = 'AA296PT'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 15000, o.beneficiaire, 'CMD2-26040053 · facture répartie — part 5/6 de 290 000 F, selon le grand livre', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-C-00026' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-C-00026-6', (select id from vehicule where immatriculation = 'DK5679BL'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 15000, o.beneficiaire, 'CMD2-26040053 · facture répartie — part 6/6 de 290 000 F, selon le grand livre', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-C-00026' on conflict (numero) do nothing;
update intervention set montant = 50000, reference = 'CMD2-26040053 · facture répartie — part 1/6 de 290 000 F, selon le grand livre' where numero = 'INT-C-00026' and montant in (290000, 50000);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-C-00026-2', (select id from vehicule where immatriculation = 'AA856FG'), o.prestataire_id, o.date, o.type, o.objet, 90000, null, null, 'CMD2-26040053 · facture répartie — part 2/6 de 290 000 F, selon le grand livre'
  from intervention o where o.numero = 'INT-C-00026' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-C-00026-3', (select id from vehicule where immatriculation = 'DK9839BK'), o.prestataire_id, o.date, o.type, o.objet, 75000, null, null, 'CMD2-26040053 · facture répartie — part 3/6 de 290 000 F, selon le grand livre'
  from intervention o where o.numero = 'INT-C-00026' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-C-00026-4', (select id from vehicule where immatriculation = 'AA022EA'), o.prestataire_id, o.date, o.type, o.objet, 45000, null, null, 'CMD2-26040053 · facture répartie — part 4/6 de 290 000 F, selon le grand livre'
  from intervention o where o.numero = 'INT-C-00026' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-C-00026-5', (select id from vehicule where immatriculation = 'AA296PT'), o.prestataire_id, o.date, o.type, o.objet, 15000, null, null, 'CMD2-26040053 · facture répartie — part 5/6 de 290 000 F, selon le grand livre'
  from intervention o where o.numero = 'INT-C-00026' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-C-00026-6', (select id from vehicule where immatriculation = 'DK5679BL'), o.prestataire_id, o.date, o.type, o.objet, 15000, null, null, 'CMD2-26040053 · facture répartie — part 6/6 de 290 000 F, selon le grand livre'
  from intervention o where o.numero = 'INT-C-00026' on conflict (numero) do nothing;

-- DEP-C-00032 · CMD2-26040372 · 2 259 000 F · 6 véhicules · parts du grand livre
update depense set montant = 144000, reference = 'CMD2-26040372 · facture répartie — part 1/6 de 2 259 000 F, selon le grand livre' where numero = 'DEP-C-00032' and montant in (2259000, 144000);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-C-00032-2', (select id from vehicule where immatriculation = 'DK1870BG'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 716000, o.beneficiaire, 'CMD2-26040372 · facture répartie — part 2/6 de 2 259 000 F, selon le grand livre', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-C-00032' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-C-00032-3', (select id from vehicule where immatriculation = 'DK3033BD'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 680000, o.beneficiaire, 'CMD2-26040372 · facture répartie — part 3/6 de 2 259 000 F, selon le grand livre', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-C-00032' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-C-00032-4', (select id from vehicule where immatriculation = 'DK2346BD'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 332000, o.beneficiaire, 'CMD2-26040372 · facture répartie — part 4/6 de 2 259 000 F, selon le grand livre', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-C-00032' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-C-00032-5', (select id from vehicule where immatriculation = 'DK8077BD'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 317000, o.beneficiaire, 'CMD2-26040372 · facture répartie — part 5/6 de 2 259 000 F, selon le grand livre', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-C-00032' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-C-00032-6', (select id from vehicule where immatriculation = 'AA032EA'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 70000, o.beneficiaire, 'CMD2-26040372 · facture répartie — part 6/6 de 2 259 000 F, selon le grand livre', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-C-00032' on conflict (numero) do nothing;
update intervention set montant = 144000, reference = 'CMD2-26040372 · facture répartie — part 1/6 de 2 259 000 F, selon le grand livre' where numero = 'INT-C-00032' and montant in (2259000, 144000);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-C-00032-2', (select id from vehicule where immatriculation = 'DK1870BG'), o.prestataire_id, o.date, o.type, o.objet, 716000, null, null, 'CMD2-26040372 · facture répartie — part 2/6 de 2 259 000 F, selon le grand livre'
  from intervention o where o.numero = 'INT-C-00032' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-C-00032-3', (select id from vehicule where immatriculation = 'DK3033BD'), o.prestataire_id, o.date, o.type, o.objet, 680000, null, null, 'CMD2-26040372 · facture répartie — part 3/6 de 2 259 000 F, selon le grand livre'
  from intervention o where o.numero = 'INT-C-00032' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-C-00032-4', (select id from vehicule where immatriculation = 'DK2346BD'), o.prestataire_id, o.date, o.type, o.objet, 332000, null, null, 'CMD2-26040372 · facture répartie — part 4/6 de 2 259 000 F, selon le grand livre'
  from intervention o where o.numero = 'INT-C-00032' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-C-00032-5', (select id from vehicule where immatriculation = 'DK8077BD'), o.prestataire_id, o.date, o.type, o.objet, 317000, null, null, 'CMD2-26040372 · facture répartie — part 5/6 de 2 259 000 F, selon le grand livre'
  from intervention o where o.numero = 'INT-C-00032' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-C-00032-6', (select id from vehicule where immatriculation = 'AA032EA'), o.prestataire_id, o.date, o.type, o.objet, 70000, null, null, 'CMD2-26040372 · facture répartie — part 6/6 de 2 259 000 F, selon le grand livre'
  from intervention o where o.numero = 'INT-C-00032' on conflict (numero) do nothing;

-- DEP-C-00033 · CMD2-26040373 · 1 645 000 F · 2 véhicules · parts du grand livre
update depense set montant = 1600000, reference = 'CMD2-26040373 · facture répartie — part 1/2 de 1 645 000 F, selon le grand livre' where numero = 'DEP-C-00033' and montant in (1645000, 1600000);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-C-00033-2', (select id from vehicule where immatriculation = 'AA990DZ'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 45000, o.beneficiaire, 'CMD2-26040373 · facture répartie — part 2/2 de 1 645 000 F, selon le grand livre', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-C-00033' on conflict (numero) do nothing;
update intervention set montant = 1600000, reference = 'CMD2-26040373 · facture répartie — part 1/2 de 1 645 000 F, selon le grand livre' where numero = 'INT-C-00033' and montant in (1645000, 1600000);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-C-00033-2', (select id from vehicule where immatriculation = 'AA990DZ'), o.prestataire_id, o.date, o.type, o.objet, 45000, null, null, 'CMD2-26040373 · facture répartie — part 2/2 de 1 645 000 F, selon le grand livre'
  from intervention o where o.numero = 'INT-C-00033' on conflict (numero) do nothing;

-- DEP-C-00038 · CMD2-26050137 · 718 200 F · 5 véhicules · parts égales
update depense set montant = 143640, reference = 'CMD2-26050137 · facture répartie — part 1/5 de 718 200 F, à parts égales' where numero = 'DEP-C-00038' and montant in (718200, 143640);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-C-00038-2', (select id from vehicule where immatriculation = 'AA856FG'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 143640, o.beneficiaire, 'CMD2-26050137 · facture répartie — part 2/5 de 718 200 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-C-00038' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-C-00038-3', (select id from vehicule where immatriculation = 'AA235MR'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 143640, o.beneficiaire, 'CMD2-26050137 · facture répartie — part 3/5 de 718 200 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-C-00038' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-C-00038-4', (select id from vehicule where immatriculation = 'DK4922BB'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 143640, o.beneficiaire, 'CMD2-26050137 · facture répartie — part 4/5 de 718 200 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-C-00038' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-C-00038-5', (select id from vehicule where immatriculation = 'AA489BH'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 143640, o.beneficiaire, 'CMD2-26050137 · facture répartie — part 5/5 de 718 200 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-C-00038' on conflict (numero) do nothing;
update intervention set montant = 143640, reference = 'CMD2-26050137 · facture répartie — part 1/5 de 718 200 F, à parts égales' where numero = 'INT-C-00038' and montant in (718200, 143640);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-C-00038-2', (select id from vehicule where immatriculation = 'AA856FG'), o.prestataire_id, o.date, o.type, o.objet, 143640, null, null, 'CMD2-26050137 · facture répartie — part 2/5 de 718 200 F, à parts égales'
  from intervention o where o.numero = 'INT-C-00038' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-C-00038-3', (select id from vehicule where immatriculation = 'AA235MR'), o.prestataire_id, o.date, o.type, o.objet, 143640, null, null, 'CMD2-26050137 · facture répartie — part 3/5 de 718 200 F, à parts égales'
  from intervention o where o.numero = 'INT-C-00038' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-C-00038-4', (select id from vehicule where immatriculation = 'DK4922BB'), o.prestataire_id, o.date, o.type, o.objet, 143640, null, null, 'CMD2-26050137 · facture répartie — part 4/5 de 718 200 F, à parts égales'
  from intervention o where o.numero = 'INT-C-00038' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-C-00038-5', (select id from vehicule where immatriculation = 'AA489BH'), o.prestataire_id, o.date, o.type, o.objet, 143640, null, null, 'CMD2-26050137 · facture répartie — part 5/5 de 718 200 F, à parts égales'
  from intervention o where o.numero = 'INT-C-00038' on conflict (numero) do nothing;

-- DEP-GL-ACH260100428-1 · CMD2-26020405 · 276 120 F · 4 véhicules · parts égales
update depense set montant = 69030, reference = 'CMD2-26020405 · ACH260100428 · facture répartie — part 1/4 de 276 120 F, à parts égales' where numero = 'DEP-GL-ACH260100428-1' and montant in (276120, 69030);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260100428-1-2', (select id from vehicule where immatriculation = 'AA905CW'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 69030, o.beneficiaire, 'CMD2-26020405 · ACH260100428 · facture répartie — part 2/4 de 276 120 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260100428-1' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260100428-1-3', (select id from vehicule where immatriculation = 'AA236MR'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 69030, o.beneficiaire, 'CMD2-26020405 · ACH260100428 · facture répartie — part 3/4 de 276 120 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260100428-1' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260100428-1-4', (select id from vehicule where immatriculation = 'AA927CA'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 69030, o.beneficiaire, 'CMD2-26020405 · ACH260100428 · facture répartie — part 4/4 de 276 120 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260100428-1' on conflict (numero) do nothing;
update intervention set montant = 69030, reference = 'CMD2-26020405 · ACH260100428 · facture répartie — part 1/4 de 276 120 F, à parts égales' where numero = 'INT-GL-ACH260100428-1' and montant in (276120, 69030);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260100428-1-2', (select id from vehicule where immatriculation = 'AA905CW'), o.prestataire_id, o.date, o.type, o.objet, 69030, null, null, 'CMD2-26020405 · ACH260100428 · facture répartie — part 2/4 de 276 120 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260100428-1' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260100428-1-3', (select id from vehicule where immatriculation = 'AA236MR'), o.prestataire_id, o.date, o.type, o.objet, 69030, null, null, 'CMD2-26020405 · ACH260100428 · facture répartie — part 3/4 de 276 120 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260100428-1' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260100428-1-4', (select id from vehicule where immatriculation = 'AA927CA'), o.prestataire_id, o.date, o.type, o.objet, 69030, null, null, 'CMD2-26020405 · ACH260100428 · facture répartie — part 4/4 de 276 120 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260100428-1' on conflict (numero) do nothing;

-- DEP-GL-ACH260200202-1 · sans bon · 30 000 F · 2 véhicules · parts égales
update depense set montant = 15000, reference = 'ACH260200202 · facture répartie — part 1/2 de 30 000 F, à parts égales' where numero = 'DEP-GL-ACH260200202-1' and montant in (30000, 15000);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260200202-1-2', (select id from vehicule where immatriculation = 'AA291PT'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 15000, o.beneficiaire, 'ACH260200202 · facture répartie — part 2/2 de 30 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260200202-1' on conflict (numero) do nothing;

-- DEP-GL-ACH260200434-1 · CMD2-26020231 · 2 126 360 F · 2 véhicules · parts égales
update depense set montant = 1063180, reference = 'CMD2-26020231 · ACH260200434 · facture répartie — part 1/2 de 2 126 360 F, à parts égales' where numero = 'DEP-GL-ACH260200434-1' and montant in (2126360, 1063180);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260200434-1-2', (select id from vehicule where immatriculation = 'AA783BN'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 1063180, o.beneficiaire, 'CMD2-26020231 · ACH260200434 · facture répartie — part 2/2 de 2 126 360 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260200434-1' on conflict (numero) do nothing;
update intervention set montant = 1063180, reference = 'CMD2-26020231 · ACH260200434 · facture répartie — part 1/2 de 2 126 360 F, à parts égales' where numero = 'INT-GL-ACH260200434-1' and montant in (2126360, 1063180);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260200434-1-2', (select id from vehicule where immatriculation = 'AA783BN'), o.prestataire_id, o.date, o.type, o.objet, 1063180, null, null, 'CMD2-26020231 · ACH260200434 · facture répartie — part 2/2 de 2 126 360 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260200434-1' on conflict (numero) do nothing;

-- DEP-GL-ACH260300059-1 · sans bon · 32 000 F · 2 véhicules · parts égales
update depense set montant = 16000, reference = 'ACH260300059 · facture répartie — part 1/2 de 32 000 F, à parts égales' where numero = 'DEP-GL-ACH260300059-1' and montant in (32000, 16000);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260300059-1-2', (select id from vehicule where immatriculation = 'AA905CW'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 16000, o.beneficiaire, 'ACH260300059 · facture répartie — part 2/2 de 32 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260300059-1' on conflict (numero) do nothing;
update intervention set montant = 16000, reference = 'ACH260300059 · facture répartie — part 1/2 de 32 000 F, à parts égales' where numero = 'INT-GL-ACH260300059-1' and montant in (32000, 16000);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260300059-1-2', (select id from vehicule where immatriculation = 'AA905CW'), o.prestataire_id, o.date, o.type, o.objet, 16000, null, null, 'ACH260300059 · facture répartie — part 2/2 de 32 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260300059-1' on conflict (numero) do nothing;

-- DEP-GL-ACH260300383-1 · CMD2-26020232 · 531 000 F · 2 véhicules · parts égales
update depense set montant = 265500, reference = 'CMD2-26020232 · ACH260300383 · facture répartie — part 1/2 de 531 000 F, à parts égales' where numero = 'DEP-GL-ACH260300383-1' and montant in (531000, 265500);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260300383-1-2', (select id from vehicule where immatriculation = 'AA542BQ'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 265500, o.beneficiaire, 'CMD2-26020232 · ACH260300383 · facture répartie — part 2/2 de 531 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260300383-1' on conflict (numero) do nothing;
update intervention set montant = 265500, reference = 'CMD2-26020232 · ACH260300383 · facture répartie — part 1/2 de 531 000 F, à parts égales' where numero = 'INT-GL-ACH260300383-1' and montant in (531000, 265500);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260300383-1-2', (select id from vehicule where immatriculation = 'AA542BQ'), o.prestataire_id, o.date, o.type, o.objet, 265500, null, null, 'CMD2-26020232 · ACH260300383 · facture répartie — part 2/2 de 531 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260300383-1' on conflict (numero) do nothing;

-- DEP-GL-ACH260400079-2 · sans bon · 25 000 F · 2 véhicules · parts égales
update depense set montant = 12500, reference = 'ACH260400079 · facture répartie — part 1/2 de 25 000 F, à parts égales' where numero = 'DEP-GL-ACH260400079-2' and montant in (25000, 12500);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260400079-2-2', (select id from vehicule where immatriculation = 'DK4922BB'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 12500, o.beneficiaire, 'ACH260400079 · facture répartie — part 2/2 de 25 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260400079-2' on conflict (numero) do nothing;

-- DEP-GL-ACH260400260-3 · sans bon · 15 000 F · 2 véhicules · parts égales
update depense set montant = 7500, reference = 'ACH260400260 · facture répartie — part 1/2 de 15 000 F, à parts égales' where numero = 'DEP-GL-ACH260400260-3' and montant in (15000, 7500);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260400260-3-2', (select id from vehicule where immatriculation = 'AA266JC'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 7500, o.beneficiaire, 'ACH260400260 · facture répartie — part 2/2 de 15 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260400260-3' on conflict (numero) do nothing;
update intervention set montant = 7500, reference = 'ACH260400260 · facture répartie — part 1/2 de 15 000 F, à parts égales' where numero = 'INT-GL-ACH260400260-3' and montant in (15000, 7500);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260400260-3-2', (select id from vehicule where immatriculation = 'AA266JC'), o.prestataire_id, o.date, o.type, o.objet, 7500, null, null, 'ACH260400260 · facture répartie — part 2/2 de 15 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260400260-3' on conflict (numero) do nothing;

-- DEP-GL-ACH260500131-2 · sans bon · 25 000 F · 2 véhicules · parts égales
update depense set montant = 12500, reference = 'ACH260500131 · facture répartie — part 1/2 de 25 000 F, à parts égales' where numero = 'DEP-GL-ACH260500131-2' and montant in (25000, 12500);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260500131-2-2', (select id from vehicule where immatriculation = 'AA737ZW'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 12500, o.beneficiaire, 'ACH260500131 · facture répartie — part 2/2 de 25 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260500131-2' on conflict (numero) do nothing;
update intervention set montant = 12500, reference = 'ACH260500131 · facture répartie — part 1/2 de 25 000 F, à parts égales' where numero = 'INT-GL-ACH260500131-2' and montant in (25000, 12500);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260500131-2-2', (select id from vehicule where immatriculation = 'AA737ZW'), o.prestataire_id, o.date, o.type, o.objet, 12500, null, null, 'ACH260500131 · facture répartie — part 2/2 de 25 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260500131-2' on conflict (numero) do nothing;

-- DEP-GL-ACH260500271-1 · sans bon · 71 000 F · 4 véhicules · parts égales
update depense set montant = 17750, reference = 'ACH260500271 · facture répartie — part 1/4 de 71 000 F, à parts égales' where numero = 'DEP-GL-ACH260500271-1' and montant in (71000, 17750);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260500271-1-2', (select id from vehicule where immatriculation = 'AA236MR'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 17750, o.beneficiaire, 'ACH260500271 · facture répartie — part 2/4 de 71 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260500271-1' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260500271-1-3', (select id from vehicule where immatriculation = 'AA768JV'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 17750, o.beneficiaire, 'ACH260500271 · facture répartie — part 3/4 de 71 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260500271-1' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260500271-1-4', (select id from vehicule where immatriculation = 'AA633JL'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 17750, o.beneficiaire, 'ACH260500271 · facture répartie — part 4/4 de 71 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260500271-1' on conflict (numero) do nothing;
update intervention set montant = 17750, reference = 'ACH260500271 · facture répartie — part 1/4 de 71 000 F, à parts égales' where numero = 'INT-GL-ACH260500271-1' and montant in (71000, 17750);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260500271-1-2', (select id from vehicule where immatriculation = 'AA236MR'), o.prestataire_id, o.date, o.type, o.objet, 17750, null, null, 'ACH260500271 · facture répartie — part 2/4 de 71 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260500271-1' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260500271-1-3', (select id from vehicule where immatriculation = 'AA768JV'), o.prestataire_id, o.date, o.type, o.objet, 17750, null, null, 'ACH260500271 · facture répartie — part 3/4 de 71 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260500271-1' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260500271-1-4', (select id from vehicule where immatriculation = 'AA633JL'), o.prestataire_id, o.date, o.type, o.objet, 17750, null, null, 'ACH260500271 · facture répartie — part 4/4 de 71 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260500271-1' on conflict (numero) do nothing;

-- DEP-GL-ACH260600179-1 · CMD2-26060254 · 188 800 F · 3 véhicules · parts égales
update depense set montant = 62934, reference = 'CMD2-26060254 · ACH260600179 · facture répartie — part 1/3 de 188 800 F, à parts égales' where numero = 'DEP-GL-ACH260600179-1' and montant in (188800, 62934);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260600179-1-2', (select id from vehicule where immatriculation = 'AA905CW'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 62933, o.beneficiaire, 'CMD2-26060254 · ACH260600179 · facture répartie — part 2/3 de 188 800 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260600179-1' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260600179-1-3', null, o.prestataire_id, o.date, o.poste, left(o.libelle || ' — AA 763 JV, hors flotte', 200), 62933, coalesce(o.beneficiaire, (select raison_sociale from prestataire where id = o.prestataire_id), 'Véhicule hors flotte'), 'CMD2-26060254 · ACH260600179 · facture répartie — part 3/3 de 188 800 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260600179-1' on conflict (numero) do nothing;
update intervention set montant = 62934, reference = 'CMD2-26060254 · ACH260600179 · facture répartie — part 1/3 de 188 800 F, à parts égales' where numero = 'INT-GL-ACH260600179-1' and montant in (188800, 62934);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260600179-1-2', (select id from vehicule where immatriculation = 'AA905CW'), o.prestataire_id, o.date, o.type, o.objet, 62933, null, null, 'CMD2-26060254 · ACH260600179 · facture répartie — part 2/3 de 188 800 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260600179-1' on conflict (numero) do nothing;

-- DEP-GL-ACH260600183-1 · CMD2-26060254 · 277 300 F · 4 véhicules · parts égales
update depense set montant = 69325, reference = 'CMD2-26060254 · ACH260600183 · facture répartie — part 1/4 de 277 300 F, à parts égales' where numero = 'DEP-GL-ACH260600183-1' and montant in (277300, 69325);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260600183-1-2', (select id from vehicule where immatriculation = 'AA737ZW'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 69325, o.beneficiaire, 'CMD2-26060254 · ACH260600183 · facture répartie — part 2/4 de 277 300 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260600183-1' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260600183-1-3', (select id from vehicule where immatriculation = 'AA053AP'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 69325, o.beneficiaire, 'CMD2-26060254 · ACH260600183 · facture répartie — part 3/4 de 277 300 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260600183-1' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260600183-1-4', (select id from vehicule where immatriculation = 'AA768JV'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 69325, o.beneficiaire, 'CMD2-26060254 · ACH260600183 · facture répartie — part 4/4 de 277 300 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260600183-1' on conflict (numero) do nothing;
update intervention set montant = 69325, reference = 'CMD2-26060254 · ACH260600183 · facture répartie — part 1/4 de 277 300 F, à parts égales' where numero = 'INT-GL-ACH260600183-1' and montant in (277300, 69325);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260600183-1-2', (select id from vehicule where immatriculation = 'AA737ZW'), o.prestataire_id, o.date, o.type, o.objet, 69325, null, null, 'CMD2-26060254 · ACH260600183 · facture répartie — part 2/4 de 277 300 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260600183-1' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260600183-1-3', (select id from vehicule where immatriculation = 'AA053AP'), o.prestataire_id, o.date, o.type, o.objet, 69325, null, null, 'CMD2-26060254 · ACH260600183 · facture répartie — part 3/4 de 277 300 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260600183-1' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260600183-1-4', (select id from vehicule where immatriculation = 'AA768JV'), o.prestataire_id, o.date, o.type, o.objet, 69325, null, null, 'CMD2-26060254 · ACH260600183 · facture répartie — part 4/4 de 277 300 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260600183-1' on conflict (numero) do nothing;

-- DEP-GL-ACH260600185-1 · CMD2-26060254 · 76 700 F · 2 véhicules · parts égales
update depense set montant = 38350, reference = 'CMD2-26060254 · ACH260600185 · facture répartie — part 1/2 de 76 700 F, à parts égales' where numero = 'DEP-GL-ACH260600185-1' and montant in (76700, 38350);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260600185-1-2', (select id from vehicule where immatriculation = 'AA977MR'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 38350, o.beneficiaire, 'CMD2-26060254 · ACH260600185 · facture répartie — part 2/2 de 76 700 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260600185-1' on conflict (numero) do nothing;
update intervention set montant = 38350, reference = 'CMD2-26060254 · ACH260600185 · facture répartie — part 1/2 de 76 700 F, à parts égales' where numero = 'INT-GL-ACH260600185-1' and montant in (76700, 38350);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260600185-1-2', (select id from vehicule where immatriculation = 'AA977MR'), o.prestataire_id, o.date, o.type, o.objet, 38350, null, null, 'CMD2-26060254 · ACH260600185 · facture répartie — part 2/2 de 76 700 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260600185-1' on conflict (numero) do nothing;

-- DEP-GL-ACH260600186-1 · CMD2-26060254 · 306 800 F · 3 véhicules · parts égales
update depense set montant = 102268, reference = 'CMD2-26060254 · ACH260600186 · facture répartie — part 1/3 de 306 800 F, à parts égales' where numero = 'DEP-GL-ACH260600186-1' and montant in (306800, 102268);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260600186-1-2', (select id from vehicule where immatriculation = 'AA542BQ'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 102266, o.beneficiaire, 'CMD2-26060254 · ACH260600186 · facture répartie — part 2/3 de 306 800 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260600186-1' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260600186-1-3', (select id from vehicule where immatriculation = 'AA285PT'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 102266, o.beneficiaire, 'CMD2-26060254 · ACH260600186 · facture répartie — part 3/3 de 306 800 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260600186-1' on conflict (numero) do nothing;
update intervention set montant = 102268, reference = 'CMD2-26060254 · ACH260600186 · facture répartie — part 1/3 de 306 800 F, à parts égales' where numero = 'INT-GL-ACH260600186-1' and montant in (306800, 102268);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260600186-1-2', (select id from vehicule where immatriculation = 'AA542BQ'), o.prestataire_id, o.date, o.type, o.objet, 102266, null, null, 'CMD2-26060254 · ACH260600186 · facture répartie — part 2/3 de 306 800 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260600186-1' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260600186-1-3', (select id from vehicule where immatriculation = 'AA285PT'), o.prestataire_id, o.date, o.type, o.objet, 102266, null, null, 'CMD2-26060254 · ACH260600186 · facture répartie — part 3/3 de 306 800 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260600186-1' on conflict (numero) do nothing;

-- DEP-GL-ACH260600252-1 · sans bon · 20 000 F · 4 véhicules · parts égales
update depense set montant = 5000, reference = 'ACH260600252 · facture répartie — part 1/4 de 20 000 F, à parts égales' where numero = 'DEP-GL-ACH260600252-1' and montant in (20000, 5000);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260600252-1-2', (select id from vehicule where immatriculation = 'AB795JA'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 5000, o.beneficiaire, 'ACH260600252 · facture répartie — part 2/4 de 20 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260600252-1' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260600252-1-3', (select id from vehicule where immatriculation = 'AB741AP'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 5000, o.beneficiaire, 'ACH260600252 · facture répartie — part 3/4 de 20 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260600252-1' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260600252-1-4', (select id from vehicule where immatriculation = 'AA990DZ'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 5000, o.beneficiaire, 'ACH260600252 · facture répartie — part 4/4 de 20 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260600252-1' on conflict (numero) do nothing;
update intervention set montant = 5000, reference = 'ACH260600252 · facture répartie — part 1/4 de 20 000 F, à parts égales' where numero = 'INT-GL-ACH260600252-1' and montant in (20000, 5000);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260600252-1-2', (select id from vehicule where immatriculation = 'AB795JA'), o.prestataire_id, o.date, o.type, o.objet, 5000, null, null, 'ACH260600252 · facture répartie — part 2/4 de 20 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260600252-1' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260600252-1-3', (select id from vehicule where immatriculation = 'AB741AP'), o.prestataire_id, o.date, o.type, o.objet, 5000, null, null, 'ACH260600252 · facture répartie — part 3/4 de 20 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260600252-1' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260600252-1-4', (select id from vehicule where immatriculation = 'AA990DZ'), o.prestataire_id, o.date, o.type, o.objet, 5000, null, null, 'ACH260600252 · facture répartie — part 4/4 de 20 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260600252-1' on conflict (numero) do nothing;

-- DEP-GL-ACH260600252-2 · sans bon · 80 000 F · 4 véhicules · parts égales
update depense set montant = 20000, reference = 'ACH260600252 · facture répartie — part 1/4 de 80 000 F, à parts égales' where numero = 'DEP-GL-ACH260600252-2' and montant in (80000, 20000);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260600252-2-2', (select id from vehicule where immatriculation = 'AA053AP'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 20000, o.beneficiaire, 'ACH260600252 · facture répartie — part 2/4 de 80 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260600252-2' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260600252-2-3', (select id from vehicule where immatriculation = 'AA285PT'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 20000, o.beneficiaire, 'ACH260600252 · facture répartie — part 3/4 de 80 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260600252-2' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260600252-2-4', (select id from vehicule where immatriculation = 'AA105VA'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 20000, o.beneficiaire, 'ACH260600252 · facture répartie — part 4/4 de 80 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260600252-2' on conflict (numero) do nothing;
update intervention set montant = 20000, reference = 'ACH260600252 · facture répartie — part 1/4 de 80 000 F, à parts égales' where numero = 'INT-GL-ACH260600252-2' and montant in (80000, 20000);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260600252-2-2', (select id from vehicule where immatriculation = 'AA053AP'), o.prestataire_id, o.date, o.type, o.objet, 20000, null, null, 'ACH260600252 · facture répartie — part 2/4 de 80 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260600252-2' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260600252-2-3', (select id from vehicule where immatriculation = 'AA285PT'), o.prestataire_id, o.date, o.type, o.objet, 20000, null, null, 'ACH260600252 · facture répartie — part 3/4 de 80 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260600252-2' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260600252-2-4', (select id from vehicule where immatriculation = 'AA105VA'), o.prestataire_id, o.date, o.type, o.objet, 20000, null, null, 'ACH260600252 · facture répartie — part 4/4 de 80 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260600252-2' on conflict (numero) do nothing;

-- DEP-GL-ACH260700598-2 · sans bon · 28 000 F · 3 véhicules · parts égales
update depense set montant = 9334, reference = 'ACH260700598 · facture répartie — part 1/3 de 28 000 F, à parts égales' where numero = 'DEP-GL-ACH260700598-2' and montant in (28000, 9334);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260700598-2-2', (select id from vehicule where immatriculation = 'AA768JV'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 9333, o.beneficiaire, 'ACH260700598 · facture répartie — part 2/3 de 28 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260700598-2' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260700598-2-3', (select id from vehicule where immatriculation = 'AA905CW'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 9333, o.beneficiaire, 'ACH260700598 · facture répartie — part 3/3 de 28 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260700598-2' on conflict (numero) do nothing;
update intervention set montant = 9334, reference = 'ACH260700598 · facture répartie — part 1/3 de 28 000 F, à parts égales' where numero = 'INT-GL-ACH260700598-2' and montant in (28000, 9334);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260700598-2-2', (select id from vehicule where immatriculation = 'AA768JV'), o.prestataire_id, o.date, o.type, o.objet, 9333, null, null, 'ACH260700598 · facture répartie — part 2/3 de 28 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260700598-2' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260700598-2-3', (select id from vehicule where immatriculation = 'AA905CW'), o.prestataire_id, o.date, o.type, o.objet, 9333, null, null, 'ACH260700598 · facture répartie — part 3/3 de 28 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260700598-2' on conflict (numero) do nothing;

-- DEP-GL-ACH260700605-1 · sans bon · 12 000 F · 2 véhicules · parts égales
update depense set montant = 6000, reference = 'ACH260700605 · facture répartie — part 1/2 de 12 000 F, à parts égales' where numero = 'DEP-GL-ACH260700605-1' and montant in (12000, 6000);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260700605-1-2', (select id from vehicule where immatriculation = 'AA186CQ'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 6000, o.beneficiaire, 'ACH260700605 · facture répartie — part 2/2 de 12 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260700605-1' on conflict (numero) do nothing;
update intervention set montant = 6000, reference = 'ACH260700605 · facture répartie — part 1/2 de 12 000 F, à parts égales' where numero = 'INT-GL-ACH260700605-1' and montant in (12000, 6000);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260700605-1-2', (select id from vehicule where immatriculation = 'AA186CQ'), o.prestataire_id, o.date, o.type, o.objet, 6000, null, null, 'ACH260700605 · facture répartie — part 2/2 de 12 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260700605-1' on conflict (numero) do nothing;

-- DEP-GL-ACH260800185-1 · sans bon · 130 000 F · 2 véhicules · parts égales
update depense set montant = 65000, reference = 'ACH260800185 · facture répartie — part 1/2 de 130 000 F, à parts égales' where numero = 'DEP-GL-ACH260800185-1' and montant in (130000, 65000);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260800185-1-2', (select id from vehicule where immatriculation = 'AA397JG'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 65000, o.beneficiaire, 'ACH260800185 · facture répartie — part 2/2 de 130 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260800185-1' on conflict (numero) do nothing;
update intervention set montant = 65000, reference = 'ACH260800185 · facture répartie — part 1/2 de 130 000 F, à parts égales' where numero = 'INT-GL-ACH260800185-1' and montant in (130000, 65000);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260800185-1-2', (select id from vehicule where immatriculation = 'AA397JG'), o.prestataire_id, o.date, o.type, o.objet, 65000, null, null, 'ACH260800185 · facture répartie — part 2/2 de 130 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260800185-1' on conflict (numero) do nothing;

-- DEP-GL-ACH260800273-1 · CMD2-26080231 · 306 000 F · 2 véhicules · parts égales
update depense set montant = 153000, reference = 'CMD2-26080231 · ACH260800273 · facture répartie — part 1/2 de 306 000 F, à parts égales' where numero = 'DEP-GL-ACH260800273-1' and montant in (306000, 153000);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260800273-1-2', (select id from vehicule where immatriculation = 'AA990DZ'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 153000, o.beneficiaire, 'CMD2-26080231 · ACH260800273 · facture répartie — part 2/2 de 306 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260800273-1' on conflict (numero) do nothing;
update intervention set montant = 153000, reference = 'CMD2-26080231 · ACH260800273 · facture répartie — part 1/2 de 306 000 F, à parts égales' where numero = 'INT-GL-ACH260800273-1' and montant in (306000, 153000);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260800273-1-2', (select id from vehicule where immatriculation = 'AA990DZ'), o.prestataire_id, o.date, o.type, o.objet, 153000, null, null, 'CMD2-26080231 · ACH260800273 · facture répartie — part 2/2 de 306 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260800273-1' on conflict (numero) do nothing;

-- DEP-GL-ACH260800301-1 · sans bon · 70 000 F · 3 véhicules · parts égales
update depense set montant = 23334, reference = 'ACH260800301 · facture répartie — part 1/3 de 70 000 F, à parts égales' where numero = 'DEP-GL-ACH260800301-1' and montant in (70000, 23334);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260800301-1-2', (select id from vehicule where immatriculation = 'AB681HE'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 23333, o.beneficiaire, 'ACH260800301 · facture répartie — part 2/3 de 70 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260800301-1' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260800301-1-3', (select id from vehicule where immatriculation = 'AA977MR'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 23333, o.beneficiaire, 'ACH260800301 · facture répartie — part 3/3 de 70 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260800301-1' on conflict (numero) do nothing;
update intervention set montant = 23334, reference = 'ACH260800301 · facture répartie — part 1/3 de 70 000 F, à parts égales' where numero = 'INT-GL-ACH260800301-1' and montant in (70000, 23334);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260800301-1-2', (select id from vehicule where immatriculation = 'AB681HE'), o.prestataire_id, o.date, o.type, o.objet, 23333, null, null, 'ACH260800301 · facture répartie — part 2/3 de 70 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260800301-1' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-GL-ACH260800301-1-3', (select id from vehicule where immatriculation = 'AA977MR'), o.prestataire_id, o.date, o.type, o.objet, 23333, null, null, 'ACH260800301 · facture répartie — part 3/3 de 70 000 F, à parts égales'
  from intervention o where o.numero = 'INT-GL-ACH260800301-1' on conflict (numero) do nothing;

-- DEP-GL-ACH260800355-1 · sans bon · 20 000 F · 2 véhicules · parts égales
update depense set montant = 10000, reference = 'ACH260800355 · facture répartie — part 1/2 de 20 000 F, à parts égales' where numero = 'DEP-GL-ACH260800355-1' and montant in (20000, 10000);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-GL-ACH260800355-1-2', (select id from vehicule where immatriculation = 'AA905CW'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 10000, o.beneficiaire, 'ACH260800355 · facture répartie — part 2/2 de 20 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-GL-ACH260800355-1' on conflict (numero) do nothing;

-- DEP-R-00001 · BC15516 · 750 716 F · 2 véhicules · parts égales
update depense set montant = 375358, reference = 'BC15516 · facture répartie — part 1/2 de 750 716 F, à parts égales' where numero = 'DEP-R-00001' and montant in (750716, 375358);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00001-2', null, o.prestataire_id, o.date, o.poste, left(o.libelle || ' — DK 6241 BM, hors flotte', 200), 375358, coalesce(o.beneficiaire, (select raison_sociale from prestataire where id = o.prestataire_id), 'Véhicule hors flotte'), 'BC15516 · facture répartie — part 2/2 de 750 716 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00001' on conflict (numero) do nothing;
update intervention set montant = 375358, reference = 'BC15516 · facture répartie — part 1/2 de 750 716 F, à parts égales' where numero = 'INT-R-00001' and montant in (750716, 375358);

-- DEP-R-00002 · BC15526 · 3 218 378 F · 5 véhicules · parts égales
update depense set montant = 643678, reference = 'BC15526 · facture répartie — part 1/5 de 3 218 378 F, à parts égales' where numero = 'DEP-R-00002' and montant in (3218378, 643678);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00002-2', (select id from vehicule where immatriculation = 'AA568GA'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 643675, o.beneficiaire, 'BC15526 · facture répartie — part 2/5 de 3 218 378 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00002' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00002-3', (select id from vehicule where immatriculation = 'AA707BB'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 643675, o.beneficiaire, 'BC15526 · facture répartie — part 3/5 de 3 218 378 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00002' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00002-4', null, o.prestataire_id, o.date, o.poste, left(o.libelle || ' — DK 2614 BH, hors flotte', 200), 643675, coalesce(o.beneficiaire, (select raison_sociale from prestataire where id = o.prestataire_id), 'Véhicule hors flotte'), 'BC15526 · facture répartie — part 4/5 de 3 218 378 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00002' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00002-5', null, o.prestataire_id, o.date, o.poste, left(o.libelle || ' — DK 6241 BM, hors flotte', 200), 643675, coalesce(o.beneficiaire, (select raison_sociale from prestataire where id = o.prestataire_id), 'Véhicule hors flotte'), 'BC15526 · facture répartie — part 5/5 de 3 218 378 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00002' on conflict (numero) do nothing;
update intervention set montant = 643678, reference = 'BC15526 · facture répartie — part 1/5 de 3 218 378 F, à parts égales' where numero = 'INT-R-00002' and montant in (3218378, 643678);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00002-2', (select id from vehicule where immatriculation = 'AA568GA'), o.prestataire_id, o.date, o.type, o.objet, 643675, null, null, 'BC15526 · facture répartie — part 2/5 de 3 218 378 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00002' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00002-3', (select id from vehicule where immatriculation = 'AA707BB'), o.prestataire_id, o.date, o.type, o.objet, 643675, null, null, 'BC15526 · facture répartie — part 3/5 de 3 218 378 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00002' on conflict (numero) do nothing;

-- DEP-R-00005 · BC15658 · 3 000 000 F · 2 véhicules · parts égales
update depense set montant = 1500000, reference = 'BC15658 · facture répartie — part 1/2 de 3 000 000 F, à parts égales' where numero = 'DEP-R-00005' and montant in (3000000, 1500000);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00005-2', (select id from vehicule where immatriculation = 'AA484BH'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 1500000, o.beneficiaire, 'BC15658 · facture répartie — part 2/2 de 3 000 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00005' on conflict (numero) do nothing;
update intervention set montant = 1500000, reference = 'BC15658 · facture répartie — part 1/2 de 3 000 000 F, à parts égales' where numero = 'INT-R-00005' and montant in (3000000, 1500000);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00005-2', (select id from vehicule where immatriculation = 'AA484BH'), o.prestataire_id, o.date, o.type, o.objet, 1500000, null, null, 'BC15658 · facture répartie — part 2/2 de 3 000 000 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00005' on conflict (numero) do nothing;

-- DEP-R-00009 · BC15736 · 204 250 F · 2 véhicules · parts égales
update depense set montant = 102125, reference = 'BC15736 · facture répartie — part 1/2 de 204 250 F, à parts égales' where numero = 'DEP-R-00009' and montant in (204250, 102125);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00009-2', (select id from vehicule where immatriculation = 'AA296PT'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 102125, o.beneficiaire, 'BC15736 · facture répartie — part 2/2 de 204 250 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00009' on conflict (numero) do nothing;
update intervention set montant = 102125, reference = 'BC15736 · facture répartie — part 1/2 de 204 250 F, à parts égales' where numero = 'INT-R-00009' and montant in (204250, 102125);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00009-2', (select id from vehicule where immatriculation = 'AA296PT'), o.prestataire_id, o.date, o.type, o.objet, 102125, null, null, 'BC15736 · facture répartie — part 2/2 de 204 250 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00009' on conflict (numero) do nothing;

-- DEP-R-00014 · BC15921 · 98 750 F · 2 véhicules · parts égales
update depense set montant = 49375, reference = 'BC15921 · facture répartie — part 1/2 de 98 750 F, à parts égales' where numero = 'DEP-R-00014' and montant in (98750, 49375);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00014-2', (select id from vehicule where immatriculation = 'AA550JD'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 49375, o.beneficiaire, 'BC15921 · facture répartie — part 2/2 de 98 750 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00014' on conflict (numero) do nothing;
update intervention set montant = 49375, reference = 'BC15921 · facture répartie — part 1/2 de 98 750 F, à parts égales' where numero = 'INT-R-00014' and montant in (98750, 49375);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00014-2', (select id from vehicule where immatriculation = 'AA550JD'), o.prestataire_id, o.date, o.type, o.objet, 49375, null, null, 'BC15921 · facture répartie — part 2/2 de 98 750 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00014' on conflict (numero) do nothing;

-- DEP-R-00031 · BC16355 · 1 023 897 F · 4 véhicules · parts égales
update depense set montant = 255975, reference = 'BC16355 · facture répartie — part 1/4 de 1 023 897 F, à parts égales' where numero = 'DEP-R-00031' and montant in (1023897, 255975);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00031-2', (select id from vehicule where immatriculation = 'AA359AH'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 255974, o.beneficiaire, 'BC16355 · facture répartie — part 2/4 de 1 023 897 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00031' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00031-3', (select id from vehicule where immatriculation = 'AA565GA'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 255974, o.beneficiaire, 'BC16355 · facture répartie — part 3/4 de 1 023 897 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00031' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00031-4', null, o.prestataire_id, o.date, o.poste, left(o.libelle || ' — DK 2614 BH, hors flotte', 200), 255974, coalesce(o.beneficiaire, (select raison_sociale from prestataire where id = o.prestataire_id), 'Véhicule hors flotte'), 'BC16355 · facture répartie — part 4/4 de 1 023 897 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00031' on conflict (numero) do nothing;
update intervention set montant = 255975, reference = 'BC16355 · facture répartie — part 1/4 de 1 023 897 F, à parts égales' where numero = 'INT-R-00031' and montant in (1023897, 255975);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00031-2', (select id from vehicule where immatriculation = 'AA359AH'), o.prestataire_id, o.date, o.type, o.objet, 255974, null, null, 'BC16355 · facture répartie — part 2/4 de 1 023 897 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00031' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00031-3', (select id from vehicule where immatriculation = 'AA565GA'), o.prestataire_id, o.date, o.type, o.objet, 255974, null, null, 'BC16355 · facture répartie — part 3/4 de 1 023 897 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00031' on conflict (numero) do nothing;

-- DEP-R-00041 · BC16627 · 1 634 300 F · 3 véhicules · parts égales
update depense set montant = 544768, reference = 'BC16627 · facture répartie — part 1/3 de 1 634 300 F, à parts égales' where numero = 'DEP-R-00041' and montant in (1634300, 544768);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00041-2', null, o.prestataire_id, o.date, o.poste, left(o.libelle || ' — DK 7621 BG, hors flotte', 200), 544766, coalesce(o.beneficiaire, (select raison_sociale from prestataire where id = o.prestataire_id), 'Véhicule hors flotte'), 'BC16627 · facture répartie — part 2/3 de 1 634 300 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00041' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00041-3', (select id from vehicule where immatriculation = 'AA285PT'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 544766, o.beneficiaire, 'BC16627 · facture répartie — part 3/3 de 1 634 300 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00041' on conflict (numero) do nothing;
update intervention set montant = 544768, reference = 'BC16627 · facture répartie — part 1/3 de 1 634 300 F, à parts égales' where numero = 'INT-R-00041' and montant in (1634300, 544768);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00041-3', (select id from vehicule where immatriculation = 'AA285PT'), o.prestataire_id, o.date, o.type, o.objet, 544766, null, null, 'BC16627 · facture répartie — part 3/3 de 1 634 300 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00041' on conflict (numero) do nothing;

-- DEP-R-00042 · BC16709 · 682 137 F · 2 véhicules · parts égales
update depense set montant = 341069, reference = 'BC16709 · facture répartie — part 1/2 de 682 137 F, à parts égales' where numero = 'DEP-R-00042' and montant in (682137, 341069);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00042-2', (select id from vehicule where immatriculation = 'AA403JG'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 341068, o.beneficiaire, 'BC16709 · facture répartie — part 2/2 de 682 137 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00042' on conflict (numero) do nothing;
update intervention set montant = 341069, reference = 'BC16709 · facture répartie — part 1/2 de 682 137 F, à parts égales' where numero = 'INT-R-00042' and montant in (682137, 341069);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00042-2', (select id from vehicule where immatriculation = 'AA403JG'), o.prestataire_id, o.date, o.type, o.objet, 341068, null, null, 'BC16709 · facture répartie — part 2/2 de 682 137 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00042' on conflict (numero) do nothing;

-- DEP-R-00044 · BC16795 · 3 277 703 F · 7 véhicules · parts égales
update depense set montant = 468245, reference = 'BC16795 · facture répartie — part 1/7 de 3 277 703 F, à parts égales' where numero = 'DEP-R-00044' and montant in (3277703, 468245);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00044-2', (select id from vehicule where immatriculation = 'AA985MR'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 468243, o.beneficiaire, 'BC16795 · facture répartie — part 2/7 de 3 277 703 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00044' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00044-3', (select id from vehicule where immatriculation = 'AA783BN'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 468243, o.beneficiaire, 'BC16795 · facture répartie — part 3/7 de 3 277 703 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00044' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00044-4', (select id from vehicule where immatriculation = 'AA565GA'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 468243, o.beneficiaire, 'BC16795 · facture répartie — part 4/7 de 3 277 703 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00044' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00044-5', (select id from vehicule where immatriculation = 'AA359AH'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 468243, o.beneficiaire, 'BC16795 · facture répartie — part 5/7 de 3 277 703 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00044' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00044-6', (select id from vehicule where immatriculation = 'AA291PT'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 468243, o.beneficiaire, 'BC16795 · facture répartie — part 6/7 de 3 277 703 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00044' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00044-7', (select id from vehicule where immatriculation = 'AA568GA'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 468243, o.beneficiaire, 'BC16795 · facture répartie — part 7/7 de 3 277 703 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00044' on conflict (numero) do nothing;
update intervention set montant = 468245, reference = 'BC16795 · facture répartie — part 1/7 de 3 277 703 F, à parts égales' where numero = 'INT-R-00044' and montant in (3277703, 468245);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00044-2', (select id from vehicule where immatriculation = 'AA985MR'), o.prestataire_id, o.date, o.type, o.objet, 468243, null, null, 'BC16795 · facture répartie — part 2/7 de 3 277 703 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00044' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00044-3', (select id from vehicule where immatriculation = 'AA783BN'), o.prestataire_id, o.date, o.type, o.objet, 468243, null, null, 'BC16795 · facture répartie — part 3/7 de 3 277 703 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00044' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00044-4', (select id from vehicule where immatriculation = 'AA565GA'), o.prestataire_id, o.date, o.type, o.objet, 468243, null, null, 'BC16795 · facture répartie — part 4/7 de 3 277 703 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00044' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00044-5', (select id from vehicule where immatriculation = 'AA359AH'), o.prestataire_id, o.date, o.type, o.objet, 468243, null, null, 'BC16795 · facture répartie — part 5/7 de 3 277 703 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00044' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00044-6', (select id from vehicule where immatriculation = 'AA291PT'), o.prestataire_id, o.date, o.type, o.objet, 468243, null, null, 'BC16795 · facture répartie — part 6/7 de 3 277 703 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00044' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00044-7', (select id from vehicule where immatriculation = 'AA568GA'), o.prestataire_id, o.date, o.type, o.objet, 468243, null, null, 'BC16795 · facture répartie — part 7/7 de 3 277 703 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00044' on conflict (numero) do nothing;

-- DEP-R-00062 · BC17062 · 555 000 F · 3 véhicules · parts égales
update depense set montant = 185000, reference = 'BC17062 · facture répartie — part 1/3 de 555 000 F, à parts égales' where numero = 'DEP-R-00062' and montant in (555000, 185000);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00062-2', null, o.prestataire_id, o.date, o.poste, left(o.libelle || ' — DK 4280 AS, hors flotte', 200), 185000, coalesce(o.beneficiaire, (select raison_sociale from prestataire where id = o.prestataire_id), 'Véhicule hors flotte'), 'BC17062 · facture répartie — part 2/3 de 555 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00062' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00062-3', (select id from vehicule where immatriculation = 'AA768JV'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 185000, o.beneficiaire, 'BC17062 · facture répartie — part 3/3 de 555 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00062' on conflict (numero) do nothing;
update intervention set montant = 185000, reference = 'BC17062 · facture répartie — part 1/3 de 555 000 F, à parts égales' where numero = 'INT-R-00062' and montant in (555000, 185000);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00062-3', (select id from vehicule where immatriculation = 'AA768JV'), o.prestataire_id, o.date, o.type, o.objet, 185000, null, null, 'BC17062 · facture répartie — part 3/3 de 555 000 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00062' on conflict (numero) do nothing;

-- DEP-R-00073 · BC17573 · 693 000 F · 5 véhicules · parts égales
update depense set montant = 138600, reference = 'BC17573 · facture répartie — part 1/5 de 693 000 F, à parts égales' where numero = 'DEP-R-00073' and montant in (693000, 138600);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00073-2', (select id from vehicule where immatriculation = 'AA990DZ'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 138600, o.beneficiaire, 'BC17573 · facture répartie — part 2/5 de 693 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00073' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00073-3', (select id from vehicule where immatriculation = 'AA359AH'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 138600, o.beneficiaire, 'BC17573 · facture répartie — part 3/5 de 693 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00073' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00073-4', null, o.prestataire_id, o.date, o.poste, left(o.libelle || ' — DK 6241 BM, hors flotte', 200), 138600, coalesce(o.beneficiaire, (select raison_sociale from prestataire where id = o.prestataire_id), 'Véhicule hors flotte'), 'BC17573 · facture répartie — part 4/5 de 693 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00073' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00073-5', (select id from vehicule where immatriculation = 'AA565GA'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 138600, o.beneficiaire, 'BC17573 · facture répartie — part 5/5 de 693 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00073' on conflict (numero) do nothing;
update intervention set montant = 138600, reference = 'BC17573 · facture répartie — part 1/5 de 693 000 F, à parts égales' where numero = 'INT-R-00073' and montant in (693000, 138600);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00073-2', (select id from vehicule where immatriculation = 'AA990DZ'), o.prestataire_id, o.date, o.type, o.objet, 138600, null, null, 'BC17573 · facture répartie — part 2/5 de 693 000 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00073' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00073-3', (select id from vehicule where immatriculation = 'AA359AH'), o.prestataire_id, o.date, o.type, o.objet, 138600, null, null, 'BC17573 · facture répartie — part 3/5 de 693 000 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00073' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00073-5', (select id from vehicule where immatriculation = 'AA565GA'), o.prestataire_id, o.date, o.type, o.objet, 138600, null, null, 'BC17573 · facture répartie — part 5/5 de 693 000 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00073' on conflict (numero) do nothing;

-- DEP-R-00074 · BC17582 · 1 917 000 F · 2 véhicules · parts égales
update depense set montant = 958500, reference = 'BC17582 · facture répartie — part 1/2 de 1 917 000 F, à parts égales' where numero = 'DEP-R-00074' and montant in (1917000, 958500);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00074-2', null, o.prestataire_id, o.date, o.poste, left(o.libelle || ' — DK 1306 BB, hors flotte', 200), 958500, coalesce(o.beneficiaire, (select raison_sociale from prestataire where id = o.prestataire_id), 'Véhicule hors flotte'), 'BC17582 · facture répartie — part 2/2 de 1 917 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00074' on conflict (numero) do nothing;
update intervention set montant = 958500, reference = 'BC17582 · facture répartie — part 1/2 de 1 917 000 F, à parts égales' where numero = 'INT-R-00074' and montant in (1917000, 958500);

-- DEP-R-00097 · BC18044 · 1 911 586 F · 2 véhicules · parts égales
update depense set montant = 955793, reference = 'BC18044 · facture répartie — part 1/2 de 1 911 586 F, à parts égales' where numero = 'DEP-R-00097' and montant in (1911586, 955793);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00097-2', (select id from vehicule where immatriculation = 'AA565GA'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 955793, o.beneficiaire, 'BC18044 · facture répartie — part 2/2 de 1 911 586 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00097' on conflict (numero) do nothing;
update intervention set montant = 955793, reference = 'BC18044 · facture répartie — part 1/2 de 1 911 586 F, à parts égales' where numero = 'INT-R-00097' and montant in (1911586, 955793);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00097-2', (select id from vehicule where immatriculation = 'AA565GA'), o.prestataire_id, o.date, o.type, o.objet, 955793, null, null, 'BC18044 · facture répartie — part 2/2 de 1 911 586 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00097' on conflict (numero) do nothing;

-- DEP-R-00115 · BC18435 · 349 280 F · 2 véhicules · parts égales
update depense set montant = 174640, reference = 'BC18435 · facture répartie — part 1/2 de 349 280 F, à parts égales' where numero = 'DEP-R-00115' and montant in (349280, 174640);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00115-2', (select id from vehicule where immatriculation = 'AA270JF'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 174640, o.beneficiaire, 'BC18435 · facture répartie — part 2/2 de 349 280 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00115' on conflict (numero) do nothing;
update intervention set montant = 174640, reference = 'BC18435 · facture répartie — part 1/2 de 349 280 F, à parts égales' where numero = 'INT-R-00115' and montant in (349280, 174640);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00115-2', (select id from vehicule where immatriculation = 'AA270JF'), o.prestataire_id, o.date, o.type, o.objet, 174640, null, null, 'BC18435 · facture répartie — part 2/2 de 349 280 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00115' on conflict (numero) do nothing;

-- DEP-R-00120 · BC18489 · 459 250 F · 4 véhicules · parts égales
update depense set montant = 114814, reference = 'BC18489 · facture répartie — part 1/4 de 459 250 F, à parts égales' where numero = 'DEP-R-00120' and montant in (459250, 114814);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00120-2', (select id from vehicule where immatriculation = 'AA359AH'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 114812, o.beneficiaire, 'BC18489 · facture répartie — part 2/4 de 459 250 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00120' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00120-3', (select id from vehicule where immatriculation = 'AA180CQ'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 114812, o.beneficiaire, 'BC18489 · facture répartie — part 3/4 de 459 250 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00120' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00120-4', (select id from vehicule where immatriculation = 'AA093VA'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 114812, o.beneficiaire, 'BC18489 · facture répartie — part 4/4 de 459 250 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00120' on conflict (numero) do nothing;
update intervention set montant = 114814, reference = 'BC18489 · facture répartie — part 1/4 de 459 250 F, à parts égales' where numero = 'INT-R-00120' and montant in (459250, 114814);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00120-2', (select id from vehicule where immatriculation = 'AA359AH'), o.prestataire_id, o.date, o.type, o.objet, 114812, null, null, 'BC18489 · facture répartie — part 2/4 de 459 250 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00120' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00120-3', (select id from vehicule where immatriculation = 'AA180CQ'), o.prestataire_id, o.date, o.type, o.objet, 114812, null, null, 'BC18489 · facture répartie — part 3/4 de 459 250 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00120' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00120-4', (select id from vehicule where immatriculation = 'AA093VA'), o.prestataire_id, o.date, o.type, o.objet, 114812, null, null, 'BC18489 · facture répartie — part 4/4 de 459 250 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00120' on conflict (numero) do nothing;

-- DEP-R-00124 · BC18535 · 161 050 F · 2 véhicules · parts égales
update depense set montant = 80525, reference = 'BC18535 · facture répartie — part 1/2 de 161 050 F, à parts égales' where numero = 'DEP-R-00124' and montant in (161050, 80525);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00124-2', (select id from vehicule where immatriculation = 'AA180CQ'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 80525, o.beneficiaire, 'BC18535 · facture répartie — part 2/2 de 161 050 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00124' on conflict (numero) do nothing;
update intervention set montant = 80525, reference = 'BC18535 · facture répartie — part 1/2 de 161 050 F, à parts égales' where numero = 'INT-R-00124' and montant in (161050, 80525);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00124-2', (select id from vehicule where immatriculation = 'AA180CQ'), o.prestataire_id, o.date, o.type, o.objet, 80525, null, null, 'BC18535 · facture répartie — part 2/2 de 161 050 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00124' on conflict (numero) do nothing;

-- DEP-R-00127 · BC18562 · 509 000 F · 2 véhicules · parts égales
update depense set montant = 254500, reference = 'BC18562 · facture répartie — part 1/2 de 509 000 F, à parts égales' where numero = 'DEP-R-00127' and montant in (509000, 254500);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00127-2', (select id from vehicule where immatriculation = 'AA359AH'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 254500, o.beneficiaire, 'BC18562 · facture répartie — part 2/2 de 509 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00127' on conflict (numero) do nothing;
update intervention set montant = 254500, reference = 'BC18562 · facture répartie — part 1/2 de 509 000 F, à parts égales' where numero = 'INT-R-00127' and montant in (509000, 254500);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00127-2', (select id from vehicule where immatriculation = 'AA359AH'), o.prestataire_id, o.date, o.type, o.objet, 254500, null, null, 'BC18562 · facture répartie — part 2/2 de 509 000 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00127' on conflict (numero) do nothing;

-- DEP-R-00138 · BC18631 · 2 088 950 F · 5 véhicules · parts égales
update depense set montant = 417790, reference = 'BC18631 · facture répartie — part 1/5 de 2 088 950 F, à parts égales' where numero = 'DEP-R-00138' and montant in (2088950, 417790);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00138-2', null, o.prestataire_id, o.date, o.poste, left(o.libelle || ' — DK 3674 AX, hors flotte', 200), 417790, coalesce(o.beneficiaire, (select raison_sociale from prestataire where id = o.prestataire_id), 'Véhicule hors flotte'), 'BC18631 · facture répartie — part 2/5 de 2 088 950 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00138' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00138-3', (select id from vehicule where immatriculation = 'DK4517BF'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 417790, o.beneficiaire, 'BC18631 · facture répartie — part 3/5 de 2 088 950 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00138' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00138-4', (select id from vehicule where immatriculation = 'AA966AD'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 417790, o.beneficiaire, 'BC18631 · facture répartie — part 4/5 de 2 088 950 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00138' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00138-5', (select id from vehicule where immatriculation = 'AA484BH'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 417790, o.beneficiaire, 'BC18631 · facture répartie — part 5/5 de 2 088 950 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00138' on conflict (numero) do nothing;
update intervention set montant = 417790, reference = 'BC18631 · facture répartie — part 1/5 de 2 088 950 F, à parts égales' where numero = 'INT-R-00138' and montant in (2088950, 417790);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00138-3', (select id from vehicule where immatriculation = 'DK4517BF'), o.prestataire_id, o.date, o.type, o.objet, 417790, null, null, 'BC18631 · facture répartie — part 3/5 de 2 088 950 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00138' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00138-4', (select id from vehicule where immatriculation = 'AA966AD'), o.prestataire_id, o.date, o.type, o.objet, 417790, null, null, 'BC18631 · facture répartie — part 4/5 de 2 088 950 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00138' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00138-5', (select id from vehicule where immatriculation = 'AA484BH'), o.prestataire_id, o.date, o.type, o.objet, 417790, null, null, 'BC18631 · facture répartie — part 5/5 de 2 088 950 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00138' on conflict (numero) do nothing;

-- DEP-R-00146 · BC18690 · 1 006 464 F · 2 véhicules · parts égales
update depense set montant = 503232, reference = 'BC18690 · facture répartie — part 1/2 de 1 006 464 F, à parts égales' where numero = 'DEP-R-00146' and montant in (1006464, 503232);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00146-2', null, o.prestataire_id, o.date, o.poste, left(o.libelle || ' — DK 1399 BK, hors flotte', 200), 503232, coalesce(o.beneficiaire, (select raison_sociale from prestataire where id = o.prestataire_id), 'Véhicule hors flotte'), 'BC18690 · facture répartie — part 2/2 de 1 006 464 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00146' on conflict (numero) do nothing;
update intervention set montant = 503232, reference = 'BC18690 · facture répartie — part 1/2 de 1 006 464 F, à parts égales' where numero = 'INT-R-00146' and montant in (1006464, 503232);

-- DEP-R-00147 · BC18708 · 651 950 F · 2 véhicules · parts égales
update depense set montant = 325975, reference = 'BC18708 · facture répartie — part 1/2 de 651 950 F, à parts égales' where numero = 'DEP-R-00147' and montant in (651950, 325975);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00147-2', (select id from vehicule where immatriculation = 'AA093VA'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 325975, o.beneficiaire, 'BC18708 · facture répartie — part 2/2 de 651 950 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00147' on conflict (numero) do nothing;
update intervention set montant = 325975, reference = 'BC18708 · facture répartie — part 1/2 de 651 950 F, à parts égales' where numero = 'INT-R-00147' and montant in (651950, 325975);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00147-2', (select id from vehicule where immatriculation = 'AA093VA'), o.prestataire_id, o.date, o.type, o.objet, 325975, null, null, 'BC18708 · facture répartie — part 2/2 de 651 950 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00147' on conflict (numero) do nothing;

-- DEP-R-00149 · BC18712 · 300 000 F · 2 véhicules · parts égales
update depense set montant = 150000, reference = 'BC18712 · facture répartie — part 1/2 de 300 000 F, à parts égales' where numero = 'DEP-R-00149' and montant in (300000, 150000);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00149-2', (select id from vehicule where immatriculation = 'AA905CW'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 150000, o.beneficiaire, 'BC18712 · facture répartie — part 2/2 de 300 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00149' on conflict (numero) do nothing;
update intervention set montant = 150000, reference = 'BC18712 · facture répartie — part 1/2 de 300 000 F, à parts égales' where numero = 'INT-R-00149' and montant in (300000, 150000);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00149-2', (select id from vehicule where immatriculation = 'AA905CW'), o.prestataire_id, o.date, o.type, o.objet, 150000, null, null, 'BC18712 · facture répartie — part 2/2 de 300 000 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00149' on conflict (numero) do nothing;

-- DEP-R-00156 · BC18814 · 339 840 F · 2 véhicules · parts égales
update depense set montant = 169920, reference = 'BC18814 · facture répartie — part 1/2 de 339 840 F, à parts égales' where numero = 'DEP-R-00156' and montant in (339840, 169920);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00156-2', (select id from vehicule where immatriculation = 'AA032EA'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 169920, o.beneficiaire, 'BC18814 · facture répartie — part 2/2 de 339 840 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00156' on conflict (numero) do nothing;
update intervention set montant = 169920, reference = 'BC18814 · facture répartie — part 1/2 de 339 840 F, à parts égales' where numero = 'INT-R-00156' and montant in (339840, 169920);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00156-2', (select id from vehicule where immatriculation = 'AA032EA'), o.prestataire_id, o.date, o.type, o.objet, 169920, null, null, 'BC18814 · facture répartie — part 2/2 de 339 840 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00156' on conflict (numero) do nothing;

-- DEP-R-00173 · CMD2-25110399 · 448 400 F · 2 véhicules · parts égales
update depense set montant = 224200, reference = 'CMD2-25110399 · facture répartie — part 1/2 de 448 400 F, à parts égales' where numero = 'DEP-R-00173' and montant in (448400, 224200);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00173-2', (select id from vehicule where immatriculation = 'AA105VA'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 224200, o.beneficiaire, 'CMD2-25110399 · facture répartie — part 2/2 de 448 400 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00173' on conflict (numero) do nothing;
update intervention set montant = 224200, reference = 'CMD2-25110399 · facture répartie — part 1/2 de 448 400 F, à parts égales' where numero = 'INT-R-00173' and montant in (448400, 224200);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00173-2', (select id from vehicule where immatriculation = 'AA105VA'), o.prestataire_id, o.date, o.type, o.objet, 224200, null, null, 'CMD2-25110399 · facture répartie — part 2/2 de 448 400 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00173' on conflict (numero) do nothing;

-- DEP-R-00179 · CMD2-25120131 · 724 520 F · 2 véhicules · parts égales
update depense set montant = 362260, reference = 'CMD2-25120131 · facture répartie — part 1/2 de 724 520 F, à parts égales' where numero = 'DEP-R-00179' and montant in (724520, 362260);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00179-2', (select id from vehicule where immatriculation = 'AA266JC'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 362260, o.beneficiaire, 'CMD2-25120131 · facture répartie — part 2/2 de 724 520 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00179' on conflict (numero) do nothing;
update intervention set montant = 362260, reference = 'CMD2-25120131 · facture répartie — part 1/2 de 724 520 F, à parts égales' where numero = 'INT-R-00179' and montant in (724520, 362260);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00179-2', (select id from vehicule where immatriculation = 'AA266JC'), o.prestataire_id, o.date, o.type, o.objet, 362260, null, null, 'CMD2-25120131 · facture répartie — part 2/2 de 724 520 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00179' on conflict (numero) do nothing;

-- DEP-R-00198 · CMD2-26020223 · 345 000 F · 2 véhicules · parts du grand livre
update depense set montant = 120000, reference = 'CMD2-26020223 · facture répartie — part 1/2 de 345 000 F, selon le grand livre' where numero = 'DEP-R-00198' and montant in (345000, 120000);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00198-2', (select id from vehicule where immatriculation = 'DK9839BK'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 225000, o.beneficiaire, 'CMD2-26020223 · facture répartie — part 2/2 de 345 000 F, selon le grand livre', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00198' on conflict (numero) do nothing;
update intervention set montant = 120000, reference = 'CMD2-26020223 · facture répartie — part 1/2 de 345 000 F, selon le grand livre' where numero = 'INT-R-00198' and montant in (345000, 120000);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00198-2', (select id from vehicule where immatriculation = 'DK9839BK'), o.prestataire_id, o.date, o.type, o.objet, 225000, null, null, 'CMD2-26020223 · facture répartie — part 2/2 de 345 000 F, selon le grand livre'
  from intervention o where o.numero = 'INT-R-00198' on conflict (numero) do nothing;

-- DEP-R-00207 · CMD2-26020403 · 1 286 200 F · 3 véhicules · parts égales
update depense set montant = 428734, reference = 'CMD2-26020403 · facture répartie — part 1/3 de 1 286 200 F, à parts égales' where numero = 'DEP-R-00207' and montant in (1286200, 428734);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00207-2', (select id from vehicule where immatriculation = 'AA985MR'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 428733, o.beneficiaire, 'CMD2-26020403 · facture répartie — part 2/3 de 1 286 200 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00207' on conflict (numero) do nothing;
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00207-3', (select id from vehicule where immatriculation = 'AA093VA'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 428733, o.beneficiaire, 'CMD2-26020403 · facture répartie — part 3/3 de 1 286 200 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00207' on conflict (numero) do nothing;
update intervention set montant = 428734, reference = 'CMD2-26020403 · facture répartie — part 1/3 de 1 286 200 F, à parts égales' where numero = 'INT-R-00207' and montant in (1286200, 428734);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00207-2', (select id from vehicule where immatriculation = 'AA985MR'), o.prestataire_id, o.date, o.type, o.objet, 428733, null, null, 'CMD2-26020403 · facture répartie — part 2/3 de 1 286 200 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00207' on conflict (numero) do nothing;
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00207-3', (select id from vehicule where immatriculation = 'AA093VA'), o.prestataire_id, o.date, o.type, o.objet, 428733, null, null, 'CMD2-26020403 · facture répartie — part 3/3 de 1 286 200 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00207' on conflict (numero) do nothing;

-- DEP-R-00210 · CMD2-26030024 · 300 500 F · 2 véhicules · parts égales
update depense set montant = 150250, reference = 'CMD2-26030024 · facture répartie — part 1/2 de 300 500 F, à parts égales' where numero = 'DEP-R-00210' and montant in (300500, 150250);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00210-2', null, o.prestataire_id, o.date, o.poste, left(o.libelle || ' — AA 125 JC, hors flotte', 200), 150250, coalesce(o.beneficiaire, (select raison_sociale from prestataire where id = o.prestataire_id), 'Véhicule hors flotte'), 'CMD2-26030024 · facture répartie — part 2/2 de 300 500 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00210' on conflict (numero) do nothing;
update intervention set montant = 150250, reference = 'CMD2-26030024 · facture répartie — part 1/2 de 300 500 F, à parts égales' where numero = 'INT-R-00210' and montant in (300500, 150250);

-- DEP-R-00214 · CMD2-26030249 · 533 760 F · 2 véhicules · parts du grand livre
update depense set montant = 472740, reference = 'CMD2-26030249 · facture répartie — part 1/2 de 533 760 F, selon le grand livre' where numero = 'DEP-R-00214' and montant in (533760, 472740);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00214-2', (select id from vehicule where immatriculation = 'AA200EA'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 61020, o.beneficiaire, 'CMD2-26030249 · facture répartie — part 2/2 de 533 760 F, selon le grand livre', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00214' on conflict (numero) do nothing;
update intervention set montant = 472740, reference = 'CMD2-26030249 · facture répartie — part 1/2 de 533 760 F, selon le grand livre' where numero = 'INT-R-00214' and montant in (533760, 472740);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00214-2', (select id from vehicule where immatriculation = 'AA200EA'), o.prestataire_id, o.date, o.type, o.objet, 61020, null, null, 'CMD2-26030249 · facture répartie — part 2/2 de 533 760 F, selon le grand livre'
  from intervention o where o.numero = 'INT-R-00214' on conflict (numero) do nothing;

-- DEP-R-00218 · CMD2-26030383 · 3 080 980 F · 2 véhicules · parts égales
update depense set montant = 1540490, reference = 'CMD2-26030383 · facture répartie — part 1/2 de 3 080 980 F, à parts égales' where numero = 'DEP-R-00218' and montant in (3080980, 1540490);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00218-2', (select id from vehicule where immatriculation = 'AA768JV'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 1540490, o.beneficiaire, 'CMD2-26030383 · facture répartie — part 2/2 de 3 080 980 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00218' on conflict (numero) do nothing;
update intervention set montant = 1540490, reference = 'CMD2-26030383 · facture répartie — part 1/2 de 3 080 980 F, à parts égales' where numero = 'INT-R-00218' and montant in (3080980, 1540490);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00218-2', (select id from vehicule where immatriculation = 'AA768JV'), o.prestataire_id, o.date, o.type, o.objet, 1540490, null, null, 'CMD2-26030383 · facture répartie — part 2/2 de 3 080 980 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00218' on conflict (numero) do nothing;

-- DEP-R-00231 · CMD2-26060286 · 3 558 880 F · 2 véhicules · parts égales
update depense set montant = 1779440, reference = 'CMD2-26060286 · facture répartie — part 1/2 de 3 558 880 F, à parts égales' where numero = 'DEP-R-00231' and montant in (3558880, 1779440);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00231-2', (select id from vehicule where immatriculation = 'AA633JL'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 1779440, o.beneficiaire, 'CMD2-26060286 · facture répartie — part 2/2 de 3 558 880 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00231' on conflict (numero) do nothing;
update intervention set montant = 1779440, reference = 'CMD2-26060286 · facture répartie — part 1/2 de 3 558 880 F, à parts égales' where numero = 'INT-R-00231' and montant in (3558880, 1779440);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00231-2', (select id from vehicule where immatriculation = 'AA633JL'), o.prestataire_id, o.date, o.type, o.objet, 1779440, null, null, 'CMD2-26060286 · facture répartie — part 2/2 de 3 558 880 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00231' on conflict (numero) do nothing;

-- DEP-R-00235 · CMD2-26070089 · 155 000 F · 2 véhicules · parts égales
update depense set montant = 77500, reference = 'CMD2-26070089 · facture répartie — part 1/2 de 155 000 F, à parts égales' where numero = 'DEP-R-00235' and montant in (155000, 77500);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00235-2', (select id from vehicule where immatriculation = 'AA386JG'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 77500, o.beneficiaire, 'CMD2-26070089 · facture répartie — part 2/2 de 155 000 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00235' on conflict (numero) do nothing;
update intervention set montant = 77500, reference = 'CMD2-26070089 · facture répartie — part 1/2 de 155 000 F, à parts égales' where numero = 'INT-R-00235' and montant in (155000, 77500);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00235-2', (select id from vehicule where immatriculation = 'AA386JG'), o.prestataire_id, o.date, o.type, o.objet, 77500, null, null, 'CMD2-26070089 · facture répartie — part 2/2 de 155 000 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00235' on conflict (numero) do nothing;

-- DEP-R-00244 · CMD2-26070543 · 811 840 F · 2 véhicules · parts égales
update depense set montant = 405920, reference = 'CMD2-26070543 · facture répartie — part 1/2 de 811 840 F, à parts égales' where numero = 'DEP-R-00244' and montant in (811840, 405920);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00244-2', (select id from vehicule where immatriculation = 'AA180CQ'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 405920, o.beneficiaire, 'CMD2-26070543 · facture répartie — part 2/2 de 811 840 F, à parts égales', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00244' on conflict (numero) do nothing;
update intervention set montant = 405920, reference = 'CMD2-26070543 · facture répartie — part 1/2 de 811 840 F, à parts égales' where numero = 'INT-R-00244' and montant in (811840, 405920);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00244-2', (select id from vehicule where immatriculation = 'AA180CQ'), o.prestataire_id, o.date, o.type, o.objet, 405920, null, null, 'CMD2-26070543 · facture répartie — part 2/2 de 811 840 F, à parts égales'
  from intervention o where o.numero = 'INT-R-00244' on conflict (numero) do nothing;

-- DEP-R-00253 · CMD2-26080279 · 322 401 F · 2 véhicules · parts du grand livre
update depense set montant = 272197, reference = 'CMD2-26080279 · facture répartie — part 1/2 de 322 401 F, selon le grand livre' where numero = 'DEP-R-00253' and montant in (322401, 272197);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00253-2', (select id from vehicule where immatriculation = 'AA737ZW'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 50204, o.beneficiaire, 'CMD2-26080279 · facture répartie — part 2/2 de 322 401 F, selon le grand livre', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00253' on conflict (numero) do nothing;
update intervention set montant = 272197, reference = 'CMD2-26080279 · facture répartie — part 1/2 de 322 401 F, selon le grand livre' where numero = 'INT-R-00253' and montant in (322401, 272197);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00253-2', (select id from vehicule where immatriculation = 'AA737ZW'), o.prestataire_id, o.date, o.type, o.objet, 50204, null, null, 'CMD2-26080279 · facture répartie — part 2/2 de 322 401 F, selon le grand livre'
  from intervention o where o.numero = 'INT-R-00253' on conflict (numero) do nothing;

-- DEP-R-00255 · CMD2-26080285 · 1 816 000 F · 2 véhicules · parts du grand livre
update depense set montant = 1471000, reference = 'CMD2-26080285 · facture répartie — part 1/2 de 1 816 000 F, selon le grand livre' where numero = 'DEP-R-00255' and montant in (1816000, 1471000);
insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)
select 'DEP-R-00255-2', (select id from vehicule where immatriculation = 'AA186CQ'), o.prestataire_id, o.date, o.poste, left(o.libelle || '', 200), 345000, o.beneficiaire, 'CMD2-26080285 · facture répartie — part 2/2 de 1 816 000 F, selon le grand livre', o.origine, o.justificatif, o.photo
  from depense o where o.numero = 'DEP-R-00255' on conflict (numero) do nothing;
update intervention set montant = 1471000, reference = 'CMD2-26080285 · facture répartie — part 1/2 de 1 816 000 F, selon le grand livre' where numero = 'INT-R-00255' and montant in (1816000, 1471000);
insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)
select 'INT-R-00255-2', (select id from vehicule where immatriculation = 'AA186CQ'), o.prestataire_id, o.date, o.type, o.objet, 345000, null, null, 'CMD2-26080285 · facture répartie — part 2/2 de 1 816 000 F, selon le grand livre'
  from intervention o where o.numero = 'INT-R-00255' on conflict (numero) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Vérification — le total de chaque facture est intact. Doit ne rien rendre.
-- ---------------------------------------------------------------------------

with attendu (numero, total) as (values
  ('DEP-C-00026', 290000),
  ('DEP-C-00032', 2259000),
  ('DEP-C-00033', 1645000),
  ('DEP-C-00038', 718200),
  ('DEP-GL-ACH260100428-1', 276120),
  ('DEP-GL-ACH260200202-1', 30000),
  ('DEP-GL-ACH260200434-1', 2126360),
  ('DEP-GL-ACH260300059-1', 32000),
  ('DEP-GL-ACH260300383-1', 531000),
  ('DEP-GL-ACH260400079-2', 25000),
  ('DEP-GL-ACH260400260-3', 15000),
  ('DEP-GL-ACH260500131-2', 25000),
  ('DEP-GL-ACH260500271-1', 71000),
  ('DEP-GL-ACH260600179-1', 188800),
  ('DEP-GL-ACH260600183-1', 277300),
  ('DEP-GL-ACH260600185-1', 76700),
  ('DEP-GL-ACH260600186-1', 306800),
  ('DEP-GL-ACH260600252-1', 20000),
  ('DEP-GL-ACH260600252-2', 80000),
  ('DEP-GL-ACH260700598-2', 28000),
  ('DEP-GL-ACH260700605-1', 12000),
  ('DEP-GL-ACH260800185-1', 130000),
  ('DEP-GL-ACH260800273-1', 306000),
  ('DEP-GL-ACH260800301-1', 70000),
  ('DEP-GL-ACH260800355-1', 20000),
  ('DEP-R-00001', 750716),
  ('DEP-R-00002', 3218378),
  ('DEP-R-00005', 3000000),
  ('DEP-R-00009', 204250),
  ('DEP-R-00014', 98750),
  ('DEP-R-00031', 1023897),
  ('DEP-R-00041', 1634300),
  ('DEP-R-00042', 682137),
  ('DEP-R-00044', 3277703),
  ('DEP-R-00062', 555000),
  ('DEP-R-00073', 693000),
  ('DEP-R-00074', 1917000),
  ('DEP-R-00097', 1911586),
  ('DEP-R-00115', 349280),
  ('DEP-R-00120', 459250),
  ('DEP-R-00124', 161050),
  ('DEP-R-00127', 509000),
  ('DEP-R-00138', 2088950),
  ('DEP-R-00146', 1006464),
  ('DEP-R-00147', 651950),
  ('DEP-R-00149', 300000),
  ('DEP-R-00156', 339840),
  ('DEP-R-00173', 448400),
  ('DEP-R-00179', 724520),
  ('DEP-R-00198', 345000),
  ('DEP-R-00207', 1286200),
  ('DEP-R-00210', 300500),
  ('DEP-R-00214', 533760),
  ('DEP-R-00218', 3080980),
  ('DEP-R-00231', 3558880),
  ('DEP-R-00235', 155000),
  ('DEP-R-00244', 811840),
  ('DEP-R-00253', 322401),
  ('DEP-R-00255', 1816000)
)
select a.numero, a.total, sum(d.montant) as reparti
  from attendu a
  join depense d on d.numero = a.numero or d.numero like a.numero || '-_' or d.numero like a.numero || '-__'
 group by a.numero, a.total
having sum(d.montant) <> a.total;

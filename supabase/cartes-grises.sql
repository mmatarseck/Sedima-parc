-- ============================================================================
-- SEDIMA Parc — ce que disent les cartes grises.
--
-- **Ce n'est pas une migration.** 48 valeurs posées sur 41 véhicules, lues
-- une à une sur les scans du dossier `MALICK/CARTE GRISE VEHICULES` le
-- 14 septembre 2026. Voir docs/CARTES-GRISES.md.
--
-- **Seul un champ vide se remplit** : `coalesce` s'en charge, et le fichier est
-- rejouable sans rien écraser. Les valeurs que la base portait déjà et que la
-- carte contredit ne sont pas touchées — elles sont nommées dans la doc, pour
-- que le métier tranche.
--
-- **Sauf 5 numéros de châssis**, écrits sans `coalesce` : ceux-là étaient
-- inventés par `vinDemo()` de la démonstration, et un VIN faux dans un registre
-- de flotte est pire qu'une case vide. La ligne dit chaque fois lequel elle
-- remplace.
--
-- Un « 0 kg » de carte grise — le PTAC d'une voiture particulière, la puissance
-- d'une remorque — veut dire « sans objet » : il n'entre pas.
--
-- À jouer après aligner-referentiel.sql, vehicules-manquants.sql et
-- caracteristiques-vehicules.sql, tous déjà joués.
-- ============================================================================


update vehicule set vin = coalesce(vin, 'VF7DDNFH5KJ896183') where immatriculation = 'AA021EA';

-- VIN inventé par la démonstration, remplacé par celui de la carte grise.
update vehicule set vin = 'VV1B3SA5ASN188289', premiere_mise_en_circulation = coalesce(premiere_mise_en_circulation, '2019-11-06') where immatriculation = 'AA053AP';

update vehicule set vin = coalesce(vin, 'JTGABAB8106710662') where immatriculation = 'AA106NE';

update vehicule set vin = coalesce(vin, 'SALWA2EFXEA383004'), premiere_mise_en_circulation = coalesce(premiere_mise_en_circulation, '2015-01-29') where immatriculation = 'AA139HP';

update vehicule set vin = coalesce(vin, 'AHTKFCAGX00604226') where immatriculation = 'AA189JM';

update vehicule set vin = coalesce(vin, 'VR7E1NFJELJ914496') where immatriculation = 'AA200EA';

-- VIN inventé par la démonstration, remplacé par celui de la carte grise.
update vehicule set vin = 'VFKT34CW32FX2011' where immatriculation = 'AA214XK';

update vehicule set vin = coalesce(vin, 'TSMLYD21S00B05803') where immatriculation = 'AA266JC';

update vehicule set vin = coalesce(vin, 'MAJBXXMRKBMP30585') where immatriculation = 'AA324JE';

-- VIN inventé par la démonstration, remplacé par celui de la carte grise.
update vehicule set vin = 'MAT386321K7L00277' where immatriculation = 'AA359AH';

update vehicule set vin = coalesce(vin, 'MMBJNKL30NH078053') where immatriculation = 'AA389JG';

update vehicule set vin = coalesce(vin, 'VF7DDNFP5MJ964645') where immatriculation = 'AA390JG';

update vehicule set vin = coalesce(vin, 'VF7DDNFP5MJ964644') where immatriculation = 'AA392JG';

update vehicule set vin = coalesce(vin, 'VF7DDNFP5MJ964646') where immatriculation = 'AA403JG';

update vehicule set type_modele = coalesce(type_modele, '000000'), ptac = coalesce(ptac, 38000), poids_vide = coalesce(poids_vide, 5050), charge_utile = coalesce(charge_utile, 32950), premiere_mise_en_circulation = coalesce(premiere_mise_en_circulation, '2006-05-24'), date_immatriculation = coalesce(date_immatriculation, '2020-07-15') where immatriculation = 'AA507BQ';

update vehicule set vin = coalesce(vin, 'AHTKFCAG200603443') where immatriculation = 'AA541JD';

update vehicule set vin = coalesce(vin, 'AHTKFCAG300604701') where immatriculation = 'AA554JD';

-- VIN inventé par la démonstration, remplacé par celui de la carte grise.
update vehicule set vin = 'VV1SR3ESAFLL70437' where immatriculation = 'AA713VE';

update vehicule set vin = coalesce(vin, 'MMBJNKL30PH078658') where immatriculation = 'AA769PA';

update vehicule set vin = coalesce(vin, 'KNARH81DDN5157346') where immatriculation = 'AA963JM';

update vehicule set vin = coalesce(vin, 'MMBJNKL30HH006910') where immatriculation = 'AB078JS';

update vehicule set vin = coalesce(vin, 'MMBJLLC10SH079793') where immatriculation = 'AB282JT';

update vehicule set vin = coalesce(vin, 'LZZ5EXSC0SD390777') where immatriculation = 'AB361JL';

update vehicule set vin = coalesce(vin, 'VF30ERHE89S251304') where immatriculation = 'AB364HK';

update vehicule set vin = coalesce(vin, 'MMBJLLC10RH012176') where immatriculation = 'AB489JY';

-- VIN inventé par la démonstration, remplacé par celui de la carte grise.
update vehicule set vin = 'LA939VRG2S0CLW700' where immatriculation = 'AB551HS';

update vehicule set vin = coalesce(vin, 'MMBJNLC10SH083967') where immatriculation = 'AB565KP';

update vehicule set vin = coalesce(vin, 'MMBJNLC10SH083994') where immatriculation = 'AB609KP';

update vehicule set vin = coalesce(vin, 'MMBJNLC10SH083992') where immatriculation = 'AB611KP';

update vehicule set vin = coalesce(vin, 'MMBJNLC10SH083988') where immatriculation = 'AB612KP';

update vehicule set vin = coalesce(vin, 'MMBJNLC10SH084003') where immatriculation = 'AB614KP';

update vehicule set vin = coalesce(vin, 'MMBJNLC10SH083986') where immatriculation = 'AB615KP';

update vehicule set vin = coalesce(vin, 'MMBJNLC10SH083927') where immatriculation = 'AB616KP';

update vehicule set vin = coalesce(vin, 'MMBJNLC10SH083978') where immatriculation = 'AB617KP';

update vehicule set vin = coalesce(vin, 'MMBJNLC10SH083976') where immatriculation = 'AB619KP';

update vehicule set vin = coalesce(vin, 'MMBJNLC10SH083969') where immatriculation = 'AB622KP';

update vehicule set vin = coalesce(vin, 'KMHS281HGMU328988') where immatriculation = 'AB716FK';

update vehicule set vin = coalesce(vin, 'AHTDB9CD106651300') where immatriculation = 'AB900JW';

update vehicule set vin = coalesce(vin, 'AHTDB9CD806651309') where immatriculation = 'AB903JW';

update vehicule set vin = coalesce(vin, 'AHTDB9CD306651315') where immatriculation = 'AB907JW';

update vehicule set vin = coalesce(vin, 'KMHS281HGMU328180') where immatriculation = 'AB930BV';

-- ---------------------------------------------------------------------------
-- Les VIN que la démonstration s'est inventés, et dont on n'a pas la carte.
--
-- `vinDemo()` en a fabriqué un pour chaque véhicule du jeu de départ : trois
-- lettres de constructeur, quatorze caractères tirés d'un hachage de la plaque.
-- 50 d'entre eux n'ont pas de carte grise au dossier pour les corriger.
--
-- **Ils sont effacés.** Un numéro de châssis est ce qu'on donne à l'assureur, au
-- constructeur, à la police : faux, il est pire que vide, parce que rien ne dit
-- qu'il l'est. Vide, la fiche demande qu'on le saisisse. Aucune information
-- n'est perdue — ces chaînes se recalculent à partir de l'immatriculation, et
-- c'est bien ce qui prouve qu'elles n'en portaient aucune.
--
-- Les cinq que les cartes grises ont corrigés plus haut ne sont pas concernés.
-- ---------------------------------------------------------------------------

update vehicule set vin = null where immatriculation in ('AA985MR', 'AA977MR', 'AA236MR', 'AA285PT', 'AA105VA', 'AA768JV', 'AA633JL', 'AB932EF', 'AA737ZW', 'AA180CQ', 'AA565GA', 'AA568GA', 'AA093VA', 'AA990DZ', 'DK6875BF', 'AA412UB', 'AA927CA', 'AB681HE', 'AA291PT', 'AA281PT', 'AA920VA', 'AA605TR', 'AA186CQ', 'AA783BN', 'AA226SX', 'AA433AJ', 'AA235MR', 'AA300PT', 'AA898PZ', 'AA277PT', 'AA905CW', 'AA350JN', 'AA909CW', 'DK9839BK', 'DK6874BF', 'AA761JV', 'AA769JV', 'AA217FF', 'DK2507BD', 'DK4003AG', 'DK7619BG', 'DL5941D', 'DK7376AC', 'DK9361BB', 'DK3143BC', 'DK3142BC', 'AA318AM', 'AA654AS', 'DK7620BG', 'DK9619BB');

-- ---------------------------------------------------------------------------
-- Vérification : ce que le référentiel porte désormais.
-- ---------------------------------------------------------------------------

select count(*)::int as vehicules, count(vin)::int as vin, count(ptac)::int as ptac,
       count(charge_utile)::int as charge_utile, count(poids_vide)::int as poids_vide,
       count(puissance_cv)::int as puissance, count(cylindree)::int as cylindree
  from vehicule where statut <> 'sorti';

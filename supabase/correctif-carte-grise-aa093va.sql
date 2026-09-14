-- ============================================================================
-- SEDIMA Parc — la carte grise d'AA 093 VA, manquée par une faute de frappe.
--
-- **Ce n'est pas une migration.** Un véhicule, quatre valeurs.
--
-- POURQUOI À PART. Le scan de ce véhicule est nommé `CARTE GRISE AA 093 VAA`
-- — un A de trop. La lecture des cartes du 14 septembre 2026 ne l'a donc pas
-- rattaché au parc, et AA 093 VA s'est retrouvé parmi les cinquante véhicules
-- dont `cartes-grises.sql` a effacé le VIN inventé faute de carte. Il en avait
-- une. La licence de transport du même véhicule, au même dossier, écrit bien
-- `AA 093 VA` ; la carte elle-même aussi.
--
-- CE QUE LA CARTE DIT. Tata LPT1618, camion frigorifique, titulaire
-- « Sénégalaise de Distribution de Matériel Avicole », première mise en
-- circulation le 24/05/2019, immatriculé le 25/09/2024, immatriculation
-- précédente DK 6241 BM.
--
-- Les deux dates étaient déjà en base, venues du classeur des caractéristiques,
-- et concordent avec la carte ; le `coalesce` les laisse donc telles quelles.
-- Le nombre de places (2) ne se range nulle part : `vehicule` n'a pas la
-- colonne, et en ajouter une pour un camion frigorifique serait disproportionné.
--
-- CE QUI N'ENTRE PAS. Le PTRA « 0 kg » de la carte veut dire « sans objet »,
-- comme partout ailleurs : il n'entre pas. La cylindrée de la carte, 5886 cm3,
-- **contredit** les 5883 déjà en base, venus du classeur des caractéristiques ;
-- un écart de trois centimètres cubes ne vaut pas qu'on écrase une valeur
-- saisie, et il est ici pour que le métier tranche s'il le souhaite.
--
-- `coalesce` partout : seul un champ vide se remplit, le fichier est rejouable.
-- Le VIN fait exception, comme dans `cartes-grises.sql` — celui qu'il remplace
-- est un vide laissé par l'effacement des VIN fabriqués.
--
-- À jouer après `cartes-grises.sql`.
-- ============================================================================

update vehicule
   set vin = coalesce(vin, 'MAT449375K2L00007'),
       premiere_mise_en_circulation = coalesce(premiere_mise_en_circulation, '2019-05-24'),
       date_immatriculation = coalesce(date_immatriculation, '2024-09-25')
 where immatriculation = 'AA093VA';

-- Ce que le correctif a posé, à relire après exécution.
select immatriculation, vin, premiere_mise_en_circulation, date_immatriculation, cylindree
  from vehicule
 where immatriculation = 'AA093VA';

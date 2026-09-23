-- ============================================================================
-- SEDIMA Parc — DK 1306 BB est AB 098 JC : le doublon créé le 23/09 disparaît.
--
-- **Ce n'est pas une migration.** Correction d'une erreur de l'assistant.
--
-- CE QUI S'EST PASSÉ. `mise-a-jour-parc-2026-09-23.sql` a créé DK 1306 BB,
-- lu sur la fiche parc du 23/09 et absent de la base sous cette plaque. Or le
-- véhicule y était déjà : **réimmatriculé AB 098 JC** (carte grise du
-- 06/05/2026), comme le dit le commentaire de sa fiche. La fiche parc garde
-- l'ancienne plaque. Le doublon ne porte que les 4 pleins ajoutés avec lui
-- (PLN-C-09001 à 09004) ; rien d'autre ne le cite.
--
-- CE QUE FAIT CE FICHIER.
--   1. Les 4 pleins passent sur AB 098 JC.
--   2. Trois dépenses restées sans véhicule, dont le libellé nomme DK 1306 BB,
--      y sont rattachées : disques et plaquettes (02/02/2026, 75 000 F), mette
--      avant (05/03/2026, 10 000 F), entretien et main-d'œuvre (10/01/2025,
--      958 500 F).
--   3. Le doublon est supprimé — seulement s'il ne porte plus rien.
--
-- Rejouable.
-- ============================================================================

begin;

update plein set vehicule_id = (select id from vehicule where immatriculation = 'AB098JC')
 where vehicule_id = (select id from vehicule where immatriculation = 'DK1306BB');

update depense set vehicule_id = (select id from vehicule where immatriculation = 'AB098JC'), modifie_le = now()
 where numero in ('DEP-GL-ACH260200053-1', 'DEP-GL-ACH260300034-3', 'DEP-R-00074-2')
   and vehicule_id is null
   and libelle ilike '%1306%';

delete from vehicule v
 where v.immatriculation = 'DK1306BB'
   and not exists (select 1 from plein x where x.vehicule_id = v.id)
   and not exists (select 1 from depense x where x.vehicule_id = v.id)
   and not exists (select 1 from intervention x where x.vehicule_id = v.id)
   and not exists (select 1 from releve_kilometrique x where x.vehicule_id = v.id)
   and not exists (select 1 from document x where x.vehicule_id = v.id)
   and not exists (select 1 from affectation x where x.vehicule_id = v.id)
   and not exists (select 1 from attribution_legere x where x.vehicule_id = v.id);

commit;

-- Contrôle : DK1306BB absent, AB098JC avec 4 pleins et ses dépenses.
select v.immatriculation,
       (select count(*) from plein p where p.vehicule_id = v.id) as pleins,
       (select count(*) from depense d where d.vehicule_id = v.id and d.libelle ilike '%1306%') as depenses_dk1306bb
  from vehicule v where v.immatriculation in ('DK1306BB', 'AB098JC');

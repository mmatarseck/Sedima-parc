-- ============================================================================
-- SEDIMA Parc — le Toyota Prado AA 866 YH du Directeur général.
--
-- **Ce n'est pas une migration.** Un véhicule que deux sources donnent, et
-- que la base n'avait pas :
--
--   * la fiche parc du 23/09/2026 : « AA 866 YH · PRADO · En Service · DG
--     FRANCK » ;
--   * le tableau des immobilisations du grand livre (RECAP 31082026.xlsx,
--     feuille AMORTS) : IMM-201-01572 « 01 TOYOTA PRADO 2025 DIESEL AA866YH
--     FRANCK BAVARD DG », acquis le 06/05/2026 pour 46 600 000 F, amorti sur
--     4 ans, centre Direction générale. Le chargement du grand livre du 18/09
--     l'avait laissé de côté faute de véhicule.
--
-- Ce qui n'est pas connu n'est pas inventé : ni châssis, ni puissance, ni
-- dates de carte grise — la fiche du véhicule les attend.
--
-- L'attribution au Directeur général s'ouvre au jour de l'acquisition ; il
-- n'en a pas d'autre en cours (celle du BAIC X7 AA 205 VH s'est close le
-- 15/09/2026).
--
-- Rejouable.
-- ============================================================================

begin;

insert into vehicule (immatriculation, marque, appellation, categorie, categorie_flotte, usage, transport_special, energie,
                      business_unit, statut, engage, regime, valeur_acquisition, date_acquisition, duree_amortissement_annees,
                      reference_immobilisation, commentaire)
values ('AA866YH', 'Toyota', 'Land Cruiser Prado', 'vehicule-leger', 'interne', 'autre', false, 'gasoil',
        'siege', 'en-service', false, 'fonction', 46600000, '2026-05-06', 4,
        'IMM-201-01572', 'Créé le 23/09/2026 : fiche parc du 23/09 (DG Franck) et immobilisation IMM-201-01572 du grand livre (Prado 2025 diesel, 46 600 000 F).')
on conflict (immatriculation) do nothing;

insert into attribution_legere (vehicule_id, attributaire_id, debut, plan_car, commentaire)
select v.id, a.id, '2026-05-06', false, 'Véhicule de fonction du Directeur général (fiche parc et grand livre, 23/09/2026).'
  from vehicule v, attributaire a
 where v.immatriculation = 'AA866YH'
   and a.nom = 'Franck Bavard'
   and not exists (select 1 from attribution_legere x where x.vehicule_id = v.id and x.fin is null);

commit;

select v.immatriculation, v.marque, v.appellation, v.statut, v.valeur_acquisition, a.nom as attributaire
  from vehicule v
  left join attribution_legere l on l.vehicule_id = v.id and l.fin is null
  left join attributaire a on a.id = l.attributaire_id
 where v.immatriculation = 'AA866YH';

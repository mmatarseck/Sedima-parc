-- ============================================================================
-- 0062 — Main-d'œuvre globale d'un service, programmes d'entretien tenus en
-- base et éditables.
--
-- Métier, 21 septembre 2026 :
--   * « prévoir un montant de main-d'œuvre total » — beaucoup de garages
--     facturent la main-d'œuvre d'un seul montant, sans la ventiler par tâche ;
--   * « les programmes d'entretien doivent être éditables : rajouter ou retirer
--     des tâches, ou rajouter un nouveau programme pour une nouvelle catégorie
--     de véhicule ».
--
-- Les programmes vivaient dans le code. Ils entrent dans les tables prévues
-- depuis 0002 (programme_entretien, operation_entretien), avec les quatre
-- gabarits d'origine. Une opération cite désormais une tâche du catalogue.
-- Son code est préfixé de celui du programme (« leger.vidange-moteur ») : la
-- même opération existe dans plusieurs programmes, et le code est la clé.
--
-- Le responsable du parc les tient : gestion de la maintenance, ou
-- administration des paramètres.
--
-- Rejouable.
-- ============================================================================

alter table ordre_travail add column if not exists main_oeuvre_globale bigint not null default 0;

alter table operation_entretien add column if not exists tache_libelle text;

drop policy if exists ecriture_programme on programme_entretien;
create policy ecriture_programme on programme_entretien for all
  using ((select peut_administrer()) or (select peut('maintenance', 'gestion')))
  with check ((select peut_administrer()) or (select peut('maintenance', 'gestion')));
drop policy if exists ecriture_operation on operation_entretien;
create policy ecriture_operation on operation_entretien for all
  using ((select peut_administrer()) or (select peut('maintenance', 'gestion')))
  with check ((select peut_administrer()) or (select peut('maintenance', 'gestion')));

insert into programme_entretien (code, libelle, precision, categories, base) values
  ('porteur-lourd', 'Poids lourd — porteur et tracteur', 'Vrac, sacherie et traction. Périodicités resserrées : la piste et la surcharge usent plus vite que la route.', array['camion', 'tracteur']::categorie_vehicule[], 'km'),
  ('remorque', 'Semi-remorque', 'Pas de moteur : tout se joue sur le freinage, les pneumatiques et le châssis.', array['semi-remorque']::categorie_vehicule[], 'km'),
  ('leger', 'Véhicule léger et camionnette', 'Livraison, liaison et direction. Le kilométrage tombe vite, la courroie décide de la longévité.', array['camionnette', 'vehicule-leger', 'bus', 'moto']::categorie_vehicule[], 'km'),
  ('engin', 'Engin de manutention', 'Il ne roule pas, il travaille : c''est le compteur horaire qui commande, jamais le kilométrage.', array['engin']::categorie_vehicule[], 'heures')
on conflict (code) do nothing;

insert into operation_entretien (code, programme_code, libelle, groupe, periodicite_km, periodicite_heures, periodicite_mois, mots_cles, duree_heures, cout_estime, critique, ordre) values
  ('porteur-lourd.vidange-moteur', 'porteur-lourd', 'Vidange moteur et filtres', 'moteur'::groupe_operation, 15000, null, 12, array['vidange']::text[], 3, 118500, false, 1),
  ('porteur-lourd.filtres-air-gasoil', 'porteur-lourd', 'Filtre à air et filtre à gasoil', 'moteur'::groupe_operation, 30000, null, 12, array['filtre à air', 'filtre à gasoil', 'filtres']::text[], 2, 62000, false, 2),
  ('porteur-lourd.graissage-chassis', 'porteur-lourd', 'Graissage du châssis', 'chassis'::groupe_operation, 5000, null, 2, array['graissage']::text[], 1, 18000, false, 3),
  ('porteur-lourd.garnitures-frein', 'porteur-lourd', 'Contrôle des garnitures de frein', 'freinage'::groupe_operation, 30000, null, 6, array['frein', 'garniture', 'plaquette']::text[], 4, 245000, true, 4),
  ('porteur-lourd.boite-pont', 'porteur-lourd', 'Huile de boîte et de pont', 'transmission'::groupe_operation, 60000, null, 24, array['boîte', 'pont']::text[], 4, 195000, false, 5),
  ('porteur-lourd.pneumatiques', 'porteur-lourd', 'Contrôle des pneumatiques', 'pneumatiques'::groupe_operation, null, null, 1, array['pneu', 'permutation']::text[], 1, 12000, true, 6),
  ('porteur-lourd.suspension-direction', 'porteur-lourd', 'Contrôle suspension et direction', 'securite'::groupe_operation, 45000, null, 12, array['suspension', 'direction', 'amortisseur']::text[], 3, 165000, true, 7),
  ('remorque.garnitures-frein', 'remorque', 'Contrôle des garnitures de frein', 'freinage'::groupe_operation, 30000, null, 6, array['frein', 'garniture', 'plaquette']::text[], 4, 210000, true, 1),
  ('remorque.graissage-chassis', 'remorque', 'Graissage du châssis et de la sellette', 'chassis'::groupe_operation, 5000, null, 2, array['graissage', 'sellette']::text[], 1, 15000, false, 2),
  ('remorque.pneumatiques', 'remorque', 'Contrôle des pneumatiques', 'pneumatiques'::groupe_operation, null, null, 1, array['pneu', 'permutation']::text[], 1, 12000, true, 3),
  ('remorque.moyeux', 'remorque', 'Graissage et jeu des moyeux', 'chassis'::groupe_operation, 60000, null, 24, array['moyeu', 'roulement']::text[], 4, 145000, false, 4),
  ('remorque.feux-signalisation', 'remorque', 'Feux et signalisation', 'securite'::groupe_operation, null, null, 3, array['feu', 'signalisation', 'éclairage']::text[], 1, 25000, true, 5),
  ('leger.vidange-moteur', 'leger', 'Vidange moteur et filtres', 'moteur'::groupe_operation, 10000, null, 12, array['vidange']::text[], 2, 62000, false, 1),
  ('leger.filtre-air', 'leger', 'Filtre à air', 'moteur'::groupe_operation, 20000, null, 12, array['filtre à air', 'filtres']::text[], 1, 28000, false, 2),
  ('leger.plaquettes-frein', 'leger', 'Contrôle des plaquettes de frein', 'freinage'::groupe_operation, 20000, null, 12, array['frein', 'plaquette']::text[], 2, 85000, true, 3),
  ('leger.courroie-distribution', 'leger', 'Courroie de distribution', 'moteur'::groupe_operation, 100000, null, 60, array['courroie', 'distribution']::text[], 6, 320000, true, 4),
  ('leger.permutation-pneus', 'leger', 'Permutation des pneus', 'pneumatiques'::groupe_operation, 15000, null, 6, array['pneu', 'permutation']::text[], 1, 15000, false, 5),
  ('leger.climatisation', 'leger', 'Entretien de la climatisation', 'chassis'::groupe_operation, null, null, 12, array['clim']::text[], 2, 45000, false, 6),
  ('engin.vidange-moteur', 'engin', 'Vidange moteur et filtres', 'moteur'::groupe_operation, null, 500, 12, array['vidange']::text[], 3, 95000, false, 1),
  ('engin.hydraulique', 'engin', 'Huile et filtres hydrauliques', 'transmission'::groupe_operation, null, 1000, 24, array['hydraulique']::text[], 4, 185000, false, 2),
  ('engin.graissage-chassis', 'engin', 'Graissage général', 'chassis'::groupe_operation, null, 250, 2, array['graissage']::text[], 1, 18000, false, 3),
  ('engin.freins-engin', 'engin', 'Contrôle du freinage', 'freinage'::groupe_operation, null, 1000, 12, array['frein']::text[], 3, 120000, true, 4),
  ('engin.securite-levage', 'engin', 'Contrôle du dispositif de levage', 'securite'::groupe_operation, null, 1000, 12, array['levage', 'mât', 'fourche']::text[], 4, 210000, true, 5)
on conflict (code) do nothing;

update operation_entretien o
   set tache_libelle = v.tache
  from (values
    ('vidange-moteur', 'Remplacement de l''huile moteur et du filtre'),
    ('filtres-air-gasoil', 'Remplacement du filtre à air du moteur'),
    ('filtre-air', 'Remplacement du filtre à air du moteur'),
    ('graissage-chassis', 'Graissage général du véhicule'),
    ('garnitures-frein', 'Inspection des garnitures de frein'),
    ('plaquettes-frein', 'Inspection des freins'),
    ('freins-engin', 'Inspection des freins'),
    ('boite-pont', 'Vidange et remplissage du liquide de transmission'),
    ('pneumatiques', 'Inspection de l''ensemble des pneus'),
    ('permutation-pneus', 'Pneus (Divers)'),
    ('suspension-direction', 'Inspection du système de suspension'),
    ('moyeux', 'Inspection des roulements de roue'),
    ('feux-signalisation', 'Inspection de l''éclairage extérieur'),
    ('courroie-distribution', 'Remplacement de la courroie de distribution'),
    ('climatisation', 'Inspection du système de climatisation'),
    ('hydraulique', 'Remplacement de l''huile et du filtre hydrauliques'),
    ('securite-levage', 'Inspection Multi-Points du Véhicule')
  ) as v (code, tache)
 where o.code = o.programme_code || '.' || v.code
   and o.tache_libelle is null;

select p.code, p.libelle, count(o.code) as operations from programme_entretien p left join operation_entretien o on o.programme_code = p.code group by p.code, p.libelle order by p.code;

-- ============================================================================
-- SEDIMA Parc — véhicules équipés d'une balise au 2026-10-02 (Liste_des_traceurs_02-10-2026.xlsx).
--
-- **Ce n'est pas une migration.** Écrit par `scripts/charger-traceurs.mts`, à jouer
-- après la 0069. 65 véhicules du parc suivis par la plateforme de
-- géolocalisation : leur case « balise » se coche, tracée au journal. Un véhicule
-- absent de la liste garde sa valeur.
--
-- Rejouable : seuls les véhicules pas encore cochés changent.
-- ============================================================================

with maj as (
  update vehicule set balise_geolocalisation = true, modifie_le = now()
   where immatriculation in ('AA019EA', 'AA021EA', 'AA022EA', 'AA023EA', 'AA032EA', 'AA093VA', 'AA105VA', 'AA106NE', 'AA119AH', 'AA131EX', 'AA180CQ', 'AA186CQ', 'AA200EA', 'AA226SX', 'AA235MR', 'AA236MR', 'AA277PT', 'AA281PT', 'AA285PT', 'AA291PT', 'AA296PT', 'AA300PT', 'AA350JN', 'AA359AH', 'AA386JG', 'AA389JG', 'AA390JG', 'AA392JG', 'AA397JG', 'AA403JG', 'AA484BH', 'AA542BQ', 'AA562EE', 'AA565GA', 'AA568GA', 'AA605TR', 'AA633JL', 'AA735MY', 'AA737ZW', 'AA768JV', 'AA769PA', 'AA783BN', 'AA856FG', 'AA905CW', 'AA927CA', 'AA966AD', 'AA977MR', 'AA985MR', 'AA990DZ', 'AB077FP', 'AB078JS', 'AB098JC', 'AB681HE', 'AB932EF', 'DK1307BB', 'DK1870BG', 'DK2346BD', 'DK4424BF', 'DK4517BF', 'DK5347BM', 'DK5680BL', 'DK6154AS', 'DK6875BF', 'DK9723BD', 'DK9839BK')
     and not balise_geolocalisation
  returning immatriculation
)
insert into modification (table_cible, numero, champ, libelle_champ, avant, apres, motif, statut, cree_par)
select 'vehicule', m.immatriculation, 'baliseGeolocalisation', 'Balise de géolocalisation', 'Non', 'Oui',
       'Liste des traceurs de la plateforme de géolocalisation au 2026-10-02', 'appliquee',
       (select utilisateur_id from profil where role = 'administrateur' and actif order by nom limit 1)
  from maj m;

select count(*) filter (where balise_geolocalisation) as equipes, count(*) as parc from vehicule;

-- 0072 — Les camions des transporteurs, suivis comme la flotte.
--
-- Métier, 3 octobre 2026 : « la vue doit présenter la liste des véhicules
-- transporteurs, avec la marque, modèle, etc., chauffeur affecté, statut, type
-- de contrat (mise à disposition, carburant ?)… comme pour notre propre flotte.
-- Et dans chaque page d'un de ses véhicules, on verra l'historique du fuel,
-- les incidents et accidents, les volumes transportés, la conformité admin. »
-- Et le même jour : la disponibilité du matin inclut ceux des prestataires.
--
--   1. Le camion d'un transporteur prend l'identité d'un véhicule du parc :
--      marque, modèle, châssis, mise en circulation, photo, statut (même
--      vocabulaire que le parc), business unit servie, équipements (balise,
--      cartes péage). Et son contrat : au voyage (grille à la tonne), mise à
--      disposition (au jour) ou forfait, et si SEDIMA fournit le carburant.
--   2. Un incident ou un document peut viser un camion de transporteur, comme
--      le plein depuis la 0071 : un seul porteur, jamais deux. Ils se lisent
--      avec le droit de lecture des transporteurs.
--   3. Les indicateurs du parc restent ceux du parc : la situation
--      journalière (jours sans accident) et le tableau de bord ne comptent que
--      les incidents d'un véhicule de SEDIMA.
--
-- Rejouable.

-- 1. L'identité et le contrat du camion --------------------------------------------
alter table camion_tiers
  add column if not exists marque                       text,
  add column if not exists modele                       text,
  add column if not exists vin                          text,
  add column if not exists premiere_mise_en_circulation date,
  add column if not exists photo                        text,
  add column if not exists statut                       statut_vehicule not null default 'en-service',
  add column if not exists business_unit                business_unit,
  add column if not exists type_contrat                 text not null default 'voyage',
  add column if not exists carburant_fourni             boolean not null default false,
  add column if not exists balise_geolocalisation       boolean not null default false,
  add column if not exists carte_peage_secaa            boolean not null default false,
  add column if not exists numero_carte_secaa           text,
  add column if not exists carte_peage_ageroute         boolean not null default false,
  add column if not exists numero_carte_ageroute        text;

alter table camion_tiers drop constraint if exists camion_tiers_type_contrat;
alter table camion_tiers add constraint camion_tiers_type_contrat
  check (type_contrat in ('voyage', 'mise-a-disposition', 'forfait'));

comment on column camion_tiers.type_contrat is 'Au voyage (grille à la tonne), mise à disposition (au jour) ou forfait (0072).';
comment on column camion_tiers.carburant_fourni is 'Vrai quand SEDIMA fournit le carburant (cuve ou station) — les pleins du camion se saisissent alors au module Carburant (0071, 0072).';

-- Point de départ, tiré de ce que la base sait déjà : un camion qui a une fiche
-- de mise à disposition est en mise à disposition, et SEDIMA lui fournit le
-- carburant (décision du métier du 3 octobre 2026 pour Adex) ; un camion du
-- relevé de tonnage livre l'aliment de l'usine. On ne touche qu'aux valeurs
-- par défaut : une saisie faite depuis n'est pas écrasée.
update camion_tiers c set type_contrat = 'mise-a-disposition', carburant_fourni = true
 where c.type_contrat = 'voyage' and not c.carburant_fourni
   and exists (select 1 from mise_a_disposition m where m.immatriculation = c.immatriculation);
update camion_tiers c set business_unit = 'aliment'
 where c.business_unit is null
   and exists (select 1 from releve_transport r where r.camion_tiers_immatriculation = c.immatriculation);

-- 2. Incidents et documents d'un camion de transporteur --------------------------
alter table incident alter column vehicule_id drop not null;
alter table incident add column if not exists camion_tiers_immatriculation text
  references camion_tiers (immatriculation) on update cascade;
alter table incident drop constraint if exists incident_un_seul_porteur;
alter table incident add constraint incident_un_seul_porteur
  check ((vehicule_id is null) <> (camion_tiers_immatriculation is null));
create index if not exists incident_camion_tiers on incident (camion_tiers_immatriculation, date_heure desc)
  where camion_tiers_immatriculation is not null;

drop policy if exists lecture_incident on incident;
create policy lecture_incident on incident for select using (
  vehicule_id in (select vehicule.id from vehicule)
  or (camion_tiers_immatriculation is not null and (select peut('transporteurs', 'lecture')))
);

alter table document add column if not exists camion_tiers_immatriculation text
  references camion_tiers (immatriculation) on update cascade on delete cascade;
alter table document drop constraint if exists document_un_seul_porteur;
alter table document add constraint document_un_seul_porteur
  check (num_nonnulls(vehicule_id, chauffeur_id, camion_tiers_immatriculation) = 1);
create index if not exists document_camion_tiers on document (camion_tiers_immatriculation, echeance)
  where camion_tiers_immatriculation is not null;

drop policy if exists lecture_document on document;
create policy lecture_document on document for select using (
  (vehicule_id is null or vehicule_id in (select vehicule.id from vehicule))
  and (chauffeur_id is null or chauffeur_id in (select chauffeur.id from chauffeur))
  and (camion_tiers_immatriculation is null or (select peut('transporteurs', 'lecture')))
);

-- 3. Les indicateurs du parc restent ceux du parc -----------------------------------
-- Même geste que la 0069 : on corrige la définition en place, sur le texte exact.
do $$
declare
  def text;
begin
  def := pg_get_functiondef('situation_journaliere'::regproc);
  if position('from incident i where i.date_heure::date <= jusqua' in def) > 0 then
    execute replace(def, 'from incident i where i.date_heure::date <= jusqua',
                         'from incident i where i.vehicule_id is not null and i.date_heure::date <= jusqua');
  elsif position('i.vehicule_id is not null and i.date_heure::date <= jusqua' in def) = 0 then
    raise exception 'situation_journaliere : texte attendu introuvable';
  end if;

  def := pg_get_functiondef('lire_tableau'::regproc);
  if position('from incident n where n.date_heure >= depuis' in def) > 0 then
    execute replace(def, 'from incident n where n.date_heure >= depuis',
                         'from incident n where n.vehicule_id is not null and n.date_heure >= depuis');
  elsif position('n.vehicule_id is not null and n.date_heure >= depuis' in def) = 0 then
    raise exception 'lire_tableau : texte attendu introuvable';
  end if;
end
$$;

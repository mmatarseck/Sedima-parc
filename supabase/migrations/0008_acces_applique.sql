-- ============================================================================
-- SEDIMA Parc — 0008 : le serveur applique la fiche d'accès.
--
-- Jusqu'ici les politiques lisaient un rôle historique. Elles lisent
-- désormais un **niveau par module** — aucun, lecture, saisie, gestion — et
-- un **périmètre** — sites, business units, régimes —, tels que la fiche
-- d'accès (0007) les pose. Sans fiche, le rôle historique donne les niveaux
-- de son profil : rien ne se ferme pour un compte qui n'a pas encore de
-- fiche. Un écart au profil ne compte que si l'administrateur l'a approuvé.
--
-- Les fonctions existantes (`peut_administrer`, `peut_ecrire_parc`,
-- `peut_ecrire_transport`, `peut_ecrire_entretien`, `voit_sanctions`) sont
-- redéfinies sur ces niveaux : les politiques qui les appellent suivent sans
-- être réécrites. Celles qui citaient des rôles en dur sont refaites.
-- `PROFILS` du code applicatif (src/domaine/acces.ts) reflète
-- `niveau_par_role` ; la décision est ici.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Les niveaux
-- ---------------------------------------------------------------------------

create or replace function niveau_rang(n text) returns integer
language sql immutable as $$
  select case n when 'gestion' then 3 when 'saisie' then 2 when 'lecture' then 1 else 0 end
$$;

-- Les défauts de chaque profil, par rôle historique. Les nuances des anciens
-- rôles sont gardées : les achats gèrent les transporteurs, le contrôle de
-- gestion pose le budget, le responsable carburant gère les pleins.
create or replace function niveau_par_role(r role_applicatif, m text) returns text
language sql immutable as $$
  select case
    when r is null then 'aucun'
    when r = 'administrateur' then 'gestion'
    when r in ('gestionnaire-parc', 'direction') then
      case m when 'maintenance' then 'lecture' when 'parametres' then 'saisie' else 'gestion' end
    when r = 'responsable-maintenance' then
      case m
        when 'maintenance' then 'gestion'
        when 'flotte' then 'saisie' when 'releves' then 'saisie' when 'incidents' then 'saisie'
        when 'demandes' then 'saisie' when 'transferts' then 'saisie'
        when 'parametres' then 'aucun'
        else 'lecture' end
    when r = 'correspondant-site' then
      case m
        when 'flotte' then 'saisie' when 'releves' then 'saisie' when 'incidents' then 'saisie'
        when 'documents' then 'saisie' when 'demandes' then 'saisie' when 'transferts' then 'saisie'
        when 'chauffeurs' then 'lecture'
        else 'aucun' end
    when r = 'responsable-carburant' then
      case m
        when 'releves' then 'gestion'
        when 'flotte' then 'saisie' when 'incidents' then 'saisie'
        when 'documents' then 'saisie' when 'demandes' then 'saisie' when 'transferts' then 'saisie'
        when 'chauffeurs' then 'lecture'
        else 'aucun' end
    when r = 'controle-de-gestion' then
      case m when 'couts' then 'gestion' when 'parametres' then 'aucun' else 'lecture' end
    when r = 'achats' then
      case m when 'transporteurs' then 'gestion' when 'parametres' then 'aucun' else 'lecture' end
    when r = 'detenteur' then
      case m when 'demandes' then 'saisie' when 'transferts' then 'saisie' else 'aucun' end
    else 'aucun' end
$$;

-- Le niveau de la personne connectée sur un module : son écart approuvé,
-- sinon le défaut de son rôle.
create or replace function mon_niveau(m text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select a.modules ->> m
       from acces_utilisateur a
      where a.utilisateur_id = auth.uid() and a.actif and a.ecarts_approuves_par is not null),
    niveau_par_role(mon_role(), m),
    'aucun')
$$;

create or replace function peut(m text, minimum text) returns boolean
language sql stable as $$
  select mon_role() is not null and niveau_rang(mon_niveau(m)) >= niveau_rang(minimum)
$$;

-- ---------------------------------------------------------------------------
-- 2. Le périmètre
-- ---------------------------------------------------------------------------

-- Un véhicule ou un chauffeur est dans mon périmètre si son site, sa BU et
-- son régime y sont — ou si la fiche dit « tous ». Une valeur absente sur la
-- ligne ne ferme rien : un véhicule sans site se voit de tous ceux qui sont
-- bornés à un site, sans quoi personne ne le rattacherait. Sans fiche, la
-- règle historique du correspondant de site : le sien seulement.
create or replace function dans_mon_perimetre(s uuid, bu business_unit, r regime_usage) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select (a.perimetre -> 'sites' = to_jsonb('tous'::text) or s is null or a.perimetre -> 'sites' ? s::text)
        and (a.perimetre -> 'businessUnits' = to_jsonb('toutes'::text) or bu is null or a.perimetre -> 'businessUnits' ? bu::text)
        and (a.perimetre -> 'regimes' = to_jsonb('tous'::text) or r is null or a.perimetre -> 'regimes' ? r::text)
       from acces_utilisateur a
      where a.utilisateur_id = auth.uid() and a.actif),
    mon_role() <> 'correspondant-site' or s = mon_site(),
    false)
$$;

-- ---------------------------------------------------------------------------
-- 3. Les fonctions que les politiques appellent, redéfinies
-- ---------------------------------------------------------------------------

create or replace function peut_administrer() returns boolean
language sql stable as $$ select peut('parametres', 'gestion') $$;

-- Clôturer un mois et décider des modifications demandées : la saisie des
-- paramètres suffit — c'est ce que le profil Responsable porte.
create or replace function peut_cloturer() returns boolean
language sql stable as $$ select peut('parametres', 'saisie') $$;

create or replace function peut_ecrire_parc() returns boolean
language sql stable as $$ select peut('flotte', 'gestion') $$;

create or replace function peut_ecrire_transport() returns boolean
language sql stable as $$ select peut('transporteurs', 'gestion') $$;

create or replace function peut_ecrire_entretien() returns boolean
language sql stable as $$ select peut('maintenance', 'saisie') $$;

create or replace function voit_sanctions() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select a.sanctions from acces_utilisateur a
      where a.utilisateur_id = auth.uid() and a.actif and a.ecarts_approuves_par is not null and a.sanctions is not null),
    mon_role() in ('administrateur', 'direction', 'gestionnaire-parc'),
    false)
$$;

-- ---------------------------------------------------------------------------
-- 4. Les politiques refaites
-- ---------------------------------------------------------------------------

drop policy if exists lecture_vehicule on vehicule;
create policy lecture_vehicule on vehicule for select using (peut('flotte', 'lecture') and dans_mon_perimetre(site_id, business_unit, regime));

drop policy if exists lecture_chauffeur on chauffeur;
create policy lecture_chauffeur on chauffeur for select using (peut('chauffeurs', 'lecture') and dans_mon_perimetre(site_id, null, null));

drop policy if exists ecriture_chauffeur on chauffeur;
create policy ecriture_chauffeur on chauffeur for all using (peut('chauffeurs', 'gestion')) with check (peut('chauffeurs', 'gestion'));
drop policy if exists ecriture_affectation on affectation;
create policy ecriture_affectation on affectation for all using (peut('chauffeurs', 'gestion')) with check (peut('chauffeurs', 'gestion'));
drop policy if exists ecriture_indispo on indisponibilite;
create policy ecriture_indispo on indisponibilite for all using (peut('chauffeurs', 'gestion')) with check (peut('chauffeurs', 'gestion'));

-- Un document se renouvelle sur le terrain (saisie) ; il se gère au bureau.
drop policy if exists ecriture_document on document;
create policy saisie_document on document for insert with check (peut('documents', 'saisie'));
create policy gestion_document on document for all using (peut('documents', 'gestion')) with check (peut('documents', 'gestion'));

-- Une dépense, un plein, un relevé, une intervention, un incident : un fait
-- se saisit avec la saisie du module ; on ne le retouche qu'avec la gestion.
drop policy if exists ecriture_depense on depense;
create policy saisie_depense on depense for insert with check (peut('flotte', 'saisie'));
create policy gestion_depense on depense for all using (peut('flotte', 'gestion')) with check (peut('flotte', 'gestion'));

drop policy if exists ecriture_plein on plein;
create policy saisie_plein on plein for insert with check (peut('releves', 'saisie'));
create policy gestion_plein on plein for all using (peut('releves', 'gestion')) with check (peut('releves', 'gestion'));

drop policy if exists ecriture_releve on releve_kilometrique;
create policy ecriture_releve on releve_kilometrique for insert with check (peut('releves', 'saisie'));

drop policy if exists ecriture_intervention on intervention;
create policy saisie_intervention on intervention for insert with check (peut('maintenance', 'saisie'));
create policy gestion_intervention on intervention for all using (peut('maintenance', 'gestion')) with check (peut('maintenance', 'gestion'));

drop policy if exists ecriture_incident on incident;
create policy saisie_incident on incident for insert with check (peut('incidents', 'saisie'));
create policy gestion_incident on incident for all using (peut('incidents', 'gestion')) with check (peut('incidents', 'gestion'));

drop policy if exists ecriture_prestataire on prestataire;
create policy ecriture_prestataire on prestataire for all using (peut('transporteurs', 'gestion')) with check (peut('transporteurs', 'gestion'));

drop policy if exists decision_modification on modification;
create policy decision_modification on modification for update using (peut_cloturer()) with check (peut_cloturer());
drop policy if exists ecriture_cloture on cloture_mois;
create policy ecriture_cloture on cloture_mois for all using (peut_cloturer()) with check (peut_cloturer());

drop policy if exists ecriture_enveloppe on enveloppe;
create policy ecriture_enveloppe on enveloppe for all using (peut('couts', 'gestion')) with check (peut('couts', 'gestion'));

-- ---------------------------------------------------------------------------
-- 5. get_me() rend la fiche : profil, périmètre, niveaux, sanctions
-- ---------------------------------------------------------------------------

drop function if exists get_me();
create function get_me()
returns table (utilisateur_id uuid, role role_applicatif, site_id uuid, profil text, perimetre jsonb, niveaux jsonb, sanctions boolean)
language sql stable security definer set search_path = public as $$
  select p.utilisateur_id,
         p.role,
         p.site_id,
         coalesce(a.profil, case p.role
           when 'administrateur' then 'administrateur'
           when 'gestionnaire-parc' then 'responsable' when 'direction' then 'responsable'
           when 'responsable-maintenance' then 'maintenance'
           when 'correspondant-site' then 'agent-terrain' when 'responsable-carburant' then 'agent-terrain'
           when 'detenteur' then 'detenteur'
           else 'lecteur' end),
         coalesce(a.perimetre, '{"sites":"tous","businessUnits":"toutes","regimes":"tous"}'::jsonb),
         (select jsonb_object_agg(m, mon_niveau(m))
            from unnest(array['flotte', 'releves', 'incidents', 'maintenance', 'documents', 'chauffeurs', 'couts', 'transporteurs', 'parametres', 'demandes', 'transferts']) as m),
         voit_sanctions()
  from profil p
  left join acces_utilisateur a on a.utilisateur_id = p.utilisateur_id and a.actif
  where p.utilisateur_id = auth.uid() and p.actif
$$;

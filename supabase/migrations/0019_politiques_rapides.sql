-- ============================================================================
-- SEDIMA Parc — 0019 : les politiques d'accès évaluées une fois par requête.
--
-- Diagnostic du 8 septembre 2026 en production, après 0018 : lire_parc()
-- 844 ms, lire_chauffeurs() 561 ms, situation_journaliere() 1 358 ms. Ce qui
-- reste est le coût des politiques elles-mêmes, rejouées ligne par ligne :
--
--   * les tables de faits (plein, relevé, dépense, document, incident,
--     affectation, intervention, indisponibilité) disaient
--     « exists (select 1 from vehicule v where v.id = vehicule_id) » : pour
--     chaque ligne, une relecture du véhicule, donc de sa politique, donc du
--     rôle, du niveau et du périmètre — trois lectures de profil par ligne ;
--   * dans_mon_perimetre() relisait la fiche d'accès à chaque appel.
--
-- Deux gestes, mêmes règles :
--
--   1. « vehicule_id in (select id from vehicule) » : la sous-requête n'est
--      plus corrélée, Postgres la calcule une fois par requête (sous-plan
--      haché) — les véhicules visibles, avec leur politique, une seule fois.
--   2. Le périmètre se lit une fois — mon_perimetre(), en JSON — et se
--      compare ligne par ligne par une fonction pure, dans_perimetre() ;
--      dans_mon_perimetre() garde sa signature et devient une fonction SQL
--      simple, que Postgres intègre à la requête, où « (select
--      mon_perimetre()) » est un plan initial évalué une fois. peut() suit la
--      même forme.
--
-- Qui voit quoi ne change pas : un véhicule visible reste un véhicule dont
-- le rôle a la lecture du module et dont le site, la BU et le régime sont
-- dans le périmètre ; ses transactions le suivent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Le périmètre, lu une fois
-- ---------------------------------------------------------------------------

-- La fiche d'accès active de la personne (sites, BU, régimes) ; sans fiche,
-- « tout » pour un rôle qui n'est pas correspondant de site, son site seul
-- pour un correspondant ; null sans profil — personne.
create or replace function mon_perimetre() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select a.perimetre from acces_utilisateur a where a.utilisateur_id = auth.uid() and a.actif),
    case
      when mon_role() is null then null
      when mon_role() <> 'correspondant-site' then '{"tout": true}'::jsonb
      else jsonb_build_object('site', mon_site())
    end)
$$;

-- La règle, pure : la même que dans_mon_perimetre() portait, sur un
-- périmètre déjà lu. Une valeur absente sur la ligne ne ferme rien pour une
-- fiche d'accès ; pour un correspondant sans fiche, le site doit être le sien.
create or replace function dans_perimetre(p jsonb, s uuid, bu business_unit, r regime_usage) returns boolean
language sql immutable as $$
  select case
    when p is null then false
    when p ? 'tout' then true
    when p ? 'site' then coalesce(s = (p ->> 'site')::uuid, false)
    else (p -> 'sites' = to_jsonb('tous'::text) or s is null or p -> 'sites' ? s::text)
     and (p -> 'businessUnits' = to_jsonb('toutes'::text) or bu is null or p -> 'businessUnits' ? bu::text)
     and (p -> 'regimes' = to_jsonb('tous'::text) or r is null or p -> 'regimes' ? r::text)
  end
$$;

-- Même signature, même réponse ; plus de security definer, pour que Postgres
-- l'intègre à la requête qui l'appelle.
create or replace function dans_mon_perimetre(s uuid, bu business_unit, r regime_usage) returns boolean
language sql stable security invoker as $$
  select dans_perimetre((select mon_perimetre()), s, bu, r)
$$;

-- Le rôle et le niveau, lus une fois par requête : les deux appels sont des
-- plans initiaux, plus une lecture par ligne.
create or replace function peut(m text, minimum text) returns boolean
language sql stable as $$
  select (select mon_role()) is not null and niveau_rang((select mon_niveau(m))) >= niveau_rang(minimum)
$$;

-- ---------------------------------------------------------------------------
-- 2. Les transactions suivent leur véhicule — en un sous-plan, pas par ligne
-- ---------------------------------------------------------------------------

drop policy if exists lecture_affectation on affectation;
create policy lecture_affectation on affectation for select using (vehicule_id in (select id from vehicule));

drop policy if exists lecture_document on document;
create policy lecture_document on document for select using (
  (vehicule_id is null or vehicule_id in (select id from vehicule))
  and (chauffeur_id is null or chauffeur_id in (select id from chauffeur))
);

drop policy if exists lecture_depense on depense;
create policy lecture_depense on depense for select using (vehicule_id is null or vehicule_id in (select id from vehicule));

drop policy if exists lecture_plein on plein;
create policy lecture_plein on plein for select using (vehicule_id in (select id from vehicule));

drop policy if exists lecture_releve on releve_kilometrique;
create policy lecture_releve on releve_kilometrique for select using (vehicule_id in (select id from vehicule));

drop policy if exists lecture_intervention on intervention;
create policy lecture_intervention on intervention for select using (vehicule_id in (select id from vehicule));

drop policy if exists lecture_incident on incident;
create policy lecture_incident on incident for select using (vehicule_id in (select id from vehicule));

drop policy if exists lecture_indispo on indisponibilite;
create policy lecture_indispo on indisponibilite for select using (chauffeur_id in (select id from chauffeur));

-- Les demandes, transferts et ordres citaient le périmètre du véhicule dans
-- leur politique : la visibilité du véhicule le dit déjà.
drop policy if exists lecture_demande on demande;
create policy lecture_demande on demande for select using (
  suis_destinataire(chauffeur_id, attributaire_id)
  or (peut('demandes', 'lecture') and (select mon_role()) <> 'detenteur' and vehicule_id in (select id from vehicule))
);

drop policy if exists lecture_transfert on transfert;
create policy lecture_transfert on transfert for select using (
  suis_destinataire(remettant_chauffeur_id, remettant_attributaire_id)
  or suis_destinataire(recipiendaire_chauffeur_id, recipiendaire_attributaire_id)
  or (peut('transferts', 'lecture') and (select mon_role()) <> 'detenteur' and vehicule_id in (select id from vehicule))
);

drop policy if exists lecture_ordre on ordre_travail;
create policy lecture_ordre on ordre_travail for select using (
  peut('maintenance', 'lecture') and vehicule_id in (select id from vehicule)
);

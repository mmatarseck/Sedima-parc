-- 0068 — Fermer pour de bon les fonctions aux visiteurs non connectés.
--
-- Le contrôle de sécurité de Supabase (2 octobre 2026) a relevé 23 fonctions
-- SECURITY DEFINER appelables par `anon` — la clé publique du navigateur,
-- avant toute connexion — et 18 fonctions sans `search_path` fixé.
--
-- La 0030 voulait déjà retirer `anon` de seize d'entre elles, mais retirait le
-- droit au seul rôle `anon` : PostgreSQL accorde `execute` à PUBLIC à la
-- création de toute fonction, et `anon` le tenait encore par là. En base, le
-- 2 octobre, `conducteur_du_jour` portait toujours `=X/postgres` (PUBLIC).
-- Le retrait se fait donc ici à PUBLIC **et** à `anon`, puis le droit est
-- rendu nommément à `authenticated` et `service_role`.
--
-- Ce qui était réellement ouvert :
--   * `conducteur_du_jour(v, jour)` ne vérifie rien : sans compte, on y lisait
--     quel chauffeur conduisait un véhicule tel jour ;
--   * `recompter_utilisations_taches()` ne vérifie rien : sans compte, on
--     déclenchait une écriture sur `tache_service`.
-- Les autres (appliquer_transfert, publier_message, notifier_*, ajouter_station,
-- annuaire, types_document_suivis, get_me) refusaient déjà un appel sans compte
-- par leur propre contrôle ; on ferme la porte quand même.
--
-- Laissées volontairement ouvertes à PUBLIC : les fonctions lues par les
-- politiques RLS (mon_role, mon_site, mon_perimetre, mon_niveau, suis_detenteur,
-- suis_destinataire, voit_sanctions, peut*, dans_*). Une politique s'évalue
-- avec les droits de qui lit : les retirer changerait un « aucune ligne » en
-- erreur. Sans compte, elles ne rendent rien (auth.uid() est nul).
--
-- Rejouable. Le banc `scripts/tester-acces.mts` la rejoue après le blanc-seing.

do $$
declare
  f record;
  r text;
begin
  -- 1. Les fonctions qu'appelle l'application : réservées aux comptes connectés.
  for f in
    select p.oid::regprocedure as signature
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('ajouter_station', 'annuaire', 'appliquer_transfert', 'conducteur_du_jour', 'derniere_saisie',
                         'get_me', 'lire_chauffeurs', 'lire_fiche', 'lire_fiche_chauffeur', 'lire_fiches_chauffeurs',
                         'lire_parc', 'lire_prestataires', 'lire_tableau', 'lire_transporteurs', 'notifier_demandes',
                         'notifier_transfert', 'publier_message', 'situation_journaliere', 'types_document_suivis')
  loop
    execute format('revoke execute on function %s from public', f.signature);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon', f.signature);
    end if;
    foreach r in array array['authenticated', 'service_role'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('grant execute on function %s to %I', f.signature, r);
      end if;
    end loop;
  end loop;

  -- 2. Le recompte des tâches : les déclencheurs et les scripts de chargement
  --    (clé de service) l'appellent, personne d'autre.
  -- 3. Les fonctions de déclencheur : un déclencheur s'exécute sans que
  --    PostgreSQL vérifie `execute` sur sa fonction ; personne n'a à les appeler.
  for f in
    select p.oid::regprocedure as signature
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('recompter_utilisations_taches', 'garde_signatures_transfert', 'garder_cloture_service',
                         'prix_reference_a_l_entree', 'recompter_apres_affectation', 'recompter_apres_cloture',
                         'marquer_modification', 'licence_perimetre_coherent', 'licence_flotte_sans_perimetre')
  loop
    execute format('revoke execute on function %s from public', f.signature);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke execute on function %s from %I', f.signature, r);
      end if;
    end loop;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f.signature);
    end if;
  end loop;

  -- 4. Un `search_path` fixé : une fonction ne doit pas résoudre ses noms selon
  --    le chemin de qui l'appelle. Aucune ne lit hors de `public` (vérifié en
  --    base le 2 octobre : ni unaccent ni schéma `extensions`).
  for f in
    select p.oid::regprocedure as signature
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proconfig is null
       and p.proname in ('peut', 'peut_administrer', 'peut_cloturer', 'peut_cloturer_service', 'peut_ecrire_entretien',
                         'peut_ecrire_parc', 'peut_ecrire_transport', 'dans_perimetre', 'dans_mon_perimetre',
                         'niveau_rang', 'niveau_par_role', 'slug_chauffeur', 'plaque_affichee', 'plaques_en_tirets',
                         'plaque_du_texte', 'marquer_modification', 'licence_perimetre_coherent',
                         'licence_flotte_sans_perimetre')
  loop
    execute format('alter function %s set search_path = public', f.signature);
  end loop;
end
$$;

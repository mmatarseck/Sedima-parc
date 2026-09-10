-- ============================================================================
-- SEDIMA Parc — 0030 : fermer ce que les politiques laissaient ouvert.
--
-- Audit du 10 septembre 2026, avant de charger les données réelles. Tant que
-- la base ne portait qu'un jeu inventé, ces trous ne coûtaient rien ; avec les
-- salaires, les tarifs négociés et les discussions du service parc, ils
-- coûteraient cher.
--
-- Le fil commun des quatre défauts : **l'application n'est pas le seul chemin
-- vers la base.** PostgREST expose chaque table et chaque fonction ; un
-- commentaire qui dit « les fonctions serveur s'en assurent » ne protège rien.
-- Ce qui protège, c'est la politique et le déclencheur.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Une dépense sans véhicule n'est plus publique.
--
-- `lecture_depense` (0019) disait : « vehicule_id is null OR le véhicule
-- m'est visible ». La première branche n'était gardée par rien. Or le poste
-- `salaire` existe (0001) et la contrainte `depense_tracable` prévoit
-- justement la dépense sans véhicule, rattachée à un bénéficiaire nommé :
-- tout compte connecté, un détenteur compris, pouvait lire les salaires,
-- primes et frais nominatifs de toute l'entreprise.
-- ---------------------------------------------------------------------------

drop policy if exists lecture_depense on depense;
create policy lecture_depense on depense for select using (
  case
    when vehicule_id is null then (select peut('couts', 'lecture'))
    else vehicule_id in (select id from vehicule)
  end
);

comment on policy lecture_depense on depense is
  'Une dépense rattachée à un véhicule suit la visibilité du véhicule ; une dépense sans véhicule (salaire, frais nominatif) demande le module Coûts.';

-- ---------------------------------------------------------------------------
-- 2. Une partie ne signe plus à la place de l'autre.
--
-- `signature_transfert` (0012) autorise la mise à jour à qui est partie à la
-- remise — sans dire **quelles colonnes**. Un récipiendaire pouvait donc
-- écrire les deux signatures, puis appeler `appliquer_transfert()` et
-- s'attribuer le véhicule.
--
-- Le déclencheur garde le geste réel : sur le terrain, l'agent du parc tend
-- sa tablette et les deux parties signent l'une après l'autre. C'est pourquoi
-- la saisie du module passe ; seule une partie *sans* ce droit — un détenteur
-- — est tenue à sa propre signature.
-- ---------------------------------------------------------------------------

create or replace function garde_signatures_transfert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- L'agent qui tient la tablette recueille les deux signatures. Le niveau de
  -- saisie ne suffit pas à le distinguer : le détenteur l'a aussi, c'est ce
  -- qui lui permet de signer. Le profil, lui, tranche.
  if not suis_detenteur() then return new; end if;
  if new.signature_remettant is distinct from old.signature_remettant
     and not suis_destinataire(old.remettant_chauffeur_id, old.remettant_attributaire_id) then
    raise exception 'Fiche % : seul le remettant signe pour le remettant', old.numero;
  end if;
  if new.signature_recipiendaire is distinct from old.signature_recipiendaire
     and not suis_destinataire(old.recipiendaire_chauffeur_id, old.recipiendaire_attributaire_id) then
    raise exception 'Fiche % : seul le récipiendaire signe pour le récipiendaire', old.numero;
  end if;
  return new;
end
$$;

drop trigger if exists garde_signatures on transfert;
create trigger garde_signatures before update on transfert
  for each row execute function garde_signatures_transfert();

-- ---------------------------------------------------------------------------
-- 3. `appliquer_transfert()` vérifie enfin qui appelle.
--
-- Elle est `security definer` — donc elle ignore les politiques — et son seul
-- garde-fou était un `exists` tautologique qui testait la ligne déjà trouvée.
-- N'importe quel compte connecté pouvait appliquer n'importe quelle fiche
-- signée, ce qui ferme une affectation, en supprime les futures et en ouvre
-- une autre.
-- ---------------------------------------------------------------------------

create or replace function appliquer_transfert(transfert_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t transfert%rowtype;
  jour date;
begin
  select * into t from transfert where id = transfert_id;
  if not found then
    raise exception 'Fiche de transfert introuvable';
  end if;
  -- Être partie à la remise, ou tenir le module. La fonction écrit une
  -- affectation avec ses propres droits : elle doit donc dire elle-même qui
  -- a le droit de la déclencher.
  if not (
    (peut('transferts', 'saisie') and not suis_detenteur())
    or suis_destinataire(t.remettant_chauffeur_id, t.remettant_attributaire_id)
    or suis_destinataire(t.recipiendaire_chauffeur_id, t.recipiendaire_attributaire_id)
  ) then
    raise exception 'Fiche % : vous n''êtes pas partie à cette remise', t.numero;
  end if;
  if t.signature_remettant is null or t.signature_recipiendaire is null then
    raise exception 'La fiche % n''est pas complète : il manque une signature', t.numero;
  end if;
  if t.annulee_le is not null then
    raise exception 'La fiche % est annulée', t.numero;
  end if;
  if t.appliquee_le is not null then
    return;
  end if;
  jour := t.date::date;
  if t.recipiendaire_genre = 'chauffeur' and t.recipiendaire_chauffeur_id is not null then
    update affectation set fin = jour - 1, modifie_le = now()
      where vehicule_id = t.vehicule_id and role = 'titulaire' and fin is null and debut < jour;
    delete from affectation
      where vehicule_id = t.vehicule_id and role = 'titulaire' and fin is null and debut >= jour;
    insert into affectation (numero, vehicule_id, chauffeur_id, role, debut, fin, motif, cree_par)
      values ('AFF-' || t.numero, t.vehicule_id, t.recipiendaire_chauffeur_id, 'titulaire', jour, null, 'Fiche de transfert ' || t.numero || ' — ' || t.motif, auth.uid())
      on conflict (numero) do nothing;
  end if;
  update transfert set appliquee_le = now(), modifie_le = now(), modifie_par = auth.uid() where id = transfert_id;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Les discussions du service parc ne se lisent plus par leur sujet.
--
-- Un fil porte « chauffeur:… » : ce que le parc écrit *sur* un chauffeur
-- était lisible *par* ce chauffeur, et par tout détenteur. La discussion est
-- un outil interne ; le compte détenteur, réduit à son véhicule, n'y entre
-- pas — ni en lecture, ni en publication.
-- ---------------------------------------------------------------------------

create or replace function suis_detenteur() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from acces_utilisateur x
     where x.utilisateur_id = auth.uid() and x.actif and x.profil = 'detenteur'
  )
$$;

comment on function suis_detenteur() is 'Vrai quand ma fiche d''accès active porte le profil détenteur — un chauffeur ou un attributaire, réduit à son véhicule.';

drop policy if exists lecture_message on message;
create policy lecture_message on message for select using (
  (select mon_role()) is not null and not (select suis_detenteur())
);

-- ---------------------------------------------------------------------------
-- 5. Plus rien ne s'appelle sans y être invité.
--
-- Postgres accorde `execute` à `public` par défaut. `notifier_detenteurs()`
-- est `security definer`, ne vérifie pas son appelant et prend tous ses
-- champs en paramètres : n'importe quel compte pouvait faire partir, depuis
-- l'adresse de l'entreprise, un courriel signé « Direction des Opérations »
-- avec le lien de son choix. Ses deux enveloppes, elles, vérifient déjà —
-- et restent seules à pouvoir l'appeler, étant `security definer`.
--
-- `anon` (la clé publique du navigateur, avant connexion) ne doit appeler
-- aucune de ces fonctions.
-- ---------------------------------------------------------------------------

-- Retirer à `public` ne suffit pas : Supabase accorde `execute` sur toute
-- fonction nouvelle du schéma à `anon` et `authenticated` par privilège par
-- défaut. Le droit se retire donc nommément, sinon le compte connecté le
-- garde — c'est le banc `tester-acces.mts` qui l'a montré.
do $$
declare r text;
begin
  execute 'revoke execute on function notifier_detenteurs(text, uuid, uuid, text, text, text, text) from public';
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on function notifier_detenteurs(text, uuid, uuid, text, text, text, text) from %I', r);
    end if;
  end loop;
end
$$;

do $$
declare f record;
begin
  -- Le rôle `anon` est celui de Supabase ; il n'existe pas dans le banc PGlite,
  -- où les migrations sont rejouées à nu. Sans ce garde-fou, la 0030 y échoue
  -- et emporte les dix-sept bancs avec elle.
  if not exists (select 1 from pg_roles where rolname = 'anon') then return; end if;
  for f in
    select p.oid::regprocedure as signature
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('appliquer_transfert', 'publier_message', 'notifier_transfert', 'notifier_demandes',
                         'lire_parc', 'lire_fiche', 'lire_chauffeurs', 'lire_tableau', 'lire_transporteurs',
                         'lire_prestataires', 'situation_journaliere', 'mon_perimetre', 'mon_niveau',
                         'conducteur_du_jour', 'get_me', 'suis_detenteur')
  loop
    execute format('revoke execute on function %s from anon', f.signature);
  end loop;
end
$$;

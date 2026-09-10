-- ============================================================================
-- SEDIMA Parc — 0032 : un annuaire, pour que les citations fonctionnent.
--
-- Défaut trouvé par l'audit du 10 septembre 2026, et confirmé : **le sélecteur
-- de mentions « @ » des discussions est vide pour tout le monde sauf
-- l'administrateur.** Personne ne peut donc citer personne.
--
-- Pourquoi. `personnes-serveur.ts` construit la liste depuis `accesServeur()`,
-- qui lit `acces_utilisateur`. Or `lecture_acces` (0007) ne rend que
-- « ma propre fiche, ou tout si je suis administrateur ». Un responsable, un
-- chef d'atelier, un agent : une seule ligne, la leur. Silencieusement — la
-- lecture ne échoue pas, elle rend un annuaire d'une personne.
--
-- Élargir `lecture_acces` serait le mauvais remède : cette table porte le
-- périmètre, les niveaux par module et le drapeau des sanctions. Un annuaire
-- n'a besoin que d'un nom.
--
-- D'où cette fonction, qui rend **le strict nécessaire pour citer quelqu'un** :
-- l'identifiant, le prénom, le nom, la fonction. Ni courriel, ni téléphone, ni
-- périmètre, ni niveaux, ni sanctions. Elle est `security definer` pour passer
-- outre `lecture_acces`, et elle **vérifie son appelant** : il faut un rôle,
-- et le profil détenteur en est écarté — un chauffeur n'a pas à connaître
-- l'organigramme du parc.
-- ============================================================================

create or replace function annuaire()
returns table (utilisateur_id uuid, prenom text, nom text, fonction text)
language sql
stable
security definer
set search_path = public
as $$
  select a.utilisateur_id, a.prenom, a.nom, a.fonction
    from acces_utilisateur a
   where a.actif
     and mon_role() is not null
     and not suis_detenteur()
   order by a.nom, a.prenom
$$;

comment on function annuaire() is 'Les personnes que l''on peut citer dans une discussion : nom et fonction, rien de plus.';

-- `anon` n'a rien à faire ici ; `authenticated` en a besoin.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function annuaire() from anon';
  end if;
end
$$;

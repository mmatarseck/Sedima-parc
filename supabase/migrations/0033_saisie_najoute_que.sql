-- ============================================================================
-- SEDIMA Parc — 0033 : « saisie » ajoute des faits, elle ne retouche pas le passé.
--
-- C'est ce que `src/domaine/acces.ts` promet au métier, mot pour mot, sur la
-- fiche d'accès de chaque personne. Sept politiques disaient le contraire :
-- écrites `for all`, elles donnaient au niveau **saisie** le droit de modifier
-- **et de supprimer**. Un agent doté de « Coûts : saisie » pouvait effacer une
-- sortie de caisse déjà enregistrée, sans laisser de trace.
--
-- Le bon modèle existait déjà à côté : `ecriture_mouvement` (0029), en
-- `for insert` seul. Les sept s'y rangent — insertion au niveau saisie,
-- modification et suppression au niveau gestion.
--
-- **Aucun profil livré n'y perd quoi que ce soit** : la maintenance et le
-- responsable ont `gestion` sur les modules concernés ; l'agent de terrain a
-- `documents: saisie` et pourra donc toujours *créer* une visite technique,
-- sans plus pouvoir l'effacer — ce qui est précisément l'intention.
--
-- Et un huitième défaut, de la même famille : **voir les sanctions donnait le
-- droit de les écrire.** `ecriture_sanction` (0001) était gardée par
-- `voit_sanctions()`, un drapeau de la fiche d'accès décrit au métier comme
-- purement consultatif. Cocher « voit les sanctions » ouvrait donc l'écriture
-- et la suppression sur les sanctions des chauffeurs. Écrire une sanction
-- demande maintenant, en plus, la **gestion du module Chauffeurs** — ce qu'un
-- acte disciplinaire mérite.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Les sept politiques : ajouter, puis retoucher, ne sont plus le même droit.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('ecriture_caisse',      'mouvement_caisse',   'couts'),
      ('ecriture_cuve',        'mouvement_cuve',     'releves'),
      ('ecriture_ordre',       'ordre_travail',      'maintenance'),
      ('ecriture_achat',       'demande_achat',      'couts'),
      ('ecriture_visite',      'visite_technique',   'documents'),
      ('ecriture_observation', 'observation_visite', 'documents'),
      ('ecriture_piece',       'piece',              'maintenance'),
      ('ecriture_pneu',        'pneu',               'maintenance')
    ) as t(politique, table_cible, module)
  loop
    execute format('drop policy if exists %I on %I', r.politique, r.table_cible);
    execute format('create policy %I on %I for insert with check ((select peut(%L, %L)))', r.politique, r.table_cible, r.module, 'saisie');
    execute format('drop policy if exists %I on %I', r.politique || '_gestion', r.table_cible);
    execute format('create policy %I on %I for update using ((select peut(%L, %L))) with check ((select peut(%L, %L)))', r.politique || '_gestion', r.table_cible, r.module, 'gestion', r.module, 'gestion');
    execute format('drop policy if exists %I on %I', r.politique || '_retrait', r.table_cible);
    execute format('create policy %I on %I for delete using ((select peut(%L, %L)))', r.politique || '_retrait', r.table_cible, r.module, 'gestion');
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Les sanctions : les voir n'est plus les écrire.
-- ---------------------------------------------------------------------------

drop policy if exists ecriture_sanction on sanction;

create policy ecriture_sanction on sanction for insert
  with check ((select voit_sanctions()) and (select peut('chauffeurs', 'gestion')));

create policy correction_sanction on sanction for update
  using ((select voit_sanctions()) and (select peut('chauffeurs', 'gestion')))
  with check ((select voit_sanctions()) and (select peut('chauffeurs', 'gestion')));

create policy retrait_sanction on sanction for delete
  using ((select voit_sanctions()) and (select peut('chauffeurs', 'gestion')));

comment on policy ecriture_sanction on sanction is 'Écrire une sanction demande de les voir ET la gestion du module Chauffeurs : le drapeau de la fiche d''accès est consultatif, il n''ouvre rien.';

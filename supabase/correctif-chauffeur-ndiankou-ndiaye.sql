-- ============================================================================
-- SEDIMA Parc — Ndiankou Ndiaye sort de la liste des chauffeurs.
--
-- **Ce n'est pas une migration.** Une ligne effacée, à la demande du métier du
-- 15 septembre 2026 : « supprimer Ndiankou Ndiaye de la liste des chauffeurs ».
--
-- CE QUE C'EST. Une fiche chauffeur créée le **15 septembre 2026 à 13 h 00**,
-- soit le jour même de la demande. Elle ne porte que ce que le formulaire pose
-- de lui-même : contrat « salarié », aptitude « apte ». Rien d'autre — ni
-- matricule RH, ni téléphone, ni permis, ni visite médicale, ni site de
-- rattachement.
--
-- CE QU'ELLE PORTE, ET CE QUE CELA COÛTE. Rien. Les dix tables qui peuvent
-- citer un chauffeur ont été comptées une à une le 15 septembre : affectation,
-- plein, dépense, document, incident, sanction, indisponibilité, demande,
-- accès utilisateur, transfert. **Zéro ligne partout.** Cette fiche n'a jamais
-- conduit, jamais consommé, jamais rien signé. Rien de vrai ne part avec elle.
--
-- POURQUOI EFFACER PLUTÔT QUE SORTIR DES EFFECTIFS. Une date de sortie dit que
-- quelqu'un a quitté le parc, et garde la fiche consultable avec son
-- historique — c'est le bon geste pour un chauffeur qui s'en va. Ici il n'y a
-- pas d'historique à garder, et la personne n'est jamais entrée : la porter
-- « sortie » affirmerait un départ qui n'a pas eu lieu, et la laisserait dans
-- la liste pour toujours, filtrée mais présente. Le métier demande qu'elle n'y
-- soit plus.
--
-- SI C'ÉTAIT UN AUTRE CONDUCTEUR. Une personne qui tient un véhicule au titre
-- de sa fonction n'a rien à faire dans la liste des chauffeurs du parc : elle
-- se saisit depuis Conducteurs › volet « Autres conducteurs », ou naît de
-- l'attribution d'un véhicule sur sa fiche. Si Ndiankou Ndiaye est de
-- celles-là, effacer ici est le premier geste, et la ressaisir là-bas le
-- second — ce fichier ne fait que le premier.
--
-- LE GARDE-FOU. La suppression ne s'exécute que si la fiche ne porte
-- strictement rien. Si quelque chose y a été rattaché depuis cette lecture, le
-- fichier s'arrête et le dit, plutôt que d'emporter en cascade ce que personne
-- n'a inspecté.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PARTIE 1 — l'inventaire. Lecture seule : rien n'est effacé ici.
-- ---------------------------------------------------------------------------

select c.id, c.prenom, c.nom, c.matricule_rh, c.contrat::text as contrat,
       c.site_id, c.permis_numero, c.date_embauche, c.date_sortie,
       c.cree_le::timestamp(0) as saisie,
       (select count(*) from affectation     x where x.chauffeur_id = c.id) as affectations,
       (select count(*) from plein           x where x.chauffeur_id = c.id) as pleins,
       (select count(*) from depense         x where x.chauffeur_id = c.id) as depenses,
       (select count(*) from document        x where x.chauffeur_id = c.id) as documents,
       (select count(*) from incident        x where x.chauffeur_id = c.id) as incidents,
       (select count(*) from sanction        x where x.chauffeur_id = c.id) as sanctions,
       (select count(*) from indisponibilite x where x.chauffeur_id = c.id) as indisponibilites
  from chauffeur c
 where c.id = 'cd385611-d24d-47e0-ae54-fdbd7eb7f980';

-- ---------------------------------------------------------------------------
-- PARTIE 2 — la suppression. À jouer après avoir lu la partie 1.
--
-- LE GARDE-FOU SE CONSTRUIT SUR LE CATALOGUE, et non sur une liste écrite à la
-- main. Première version, le 15 septembre : la liste comptait « transfert.
-- chauffeur_id », colonne qui n'existe pas — la table porte deux références,
-- `remettant_chauffeur_id` et `recipiendaire_chauffeur_id`. Le bloc s'est
-- arrêté sur l'erreur, sans rien effacer, ce qui est le comportement voulu ;
-- mais un garde-fou qui se trompe de colonne ne garde pas ce qu'il croit.
--
-- On demande donc à Postgres lui-même quelles colonnes pointent vers
-- `chauffeur`, et on les compte toutes. Une table ajoutée demain sera comptée
-- sans que ce fichier change.
-- ---------------------------------------------------------------------------

do $$
declare
  personne uuid := 'cd385611-d24d-47e0-ae54-fdbd7eb7f980';
  nom_lu   text;
  pendant  bigint := 0;
  r        record;
  n        bigint;
begin
  select prenom || ' ' || nom into nom_lu from chauffeur where id = personne;
  if nom_lu is null then
    raise notice 'Cette fiche est déjà absente : rien à faire.';
    return;
  end if;
  -- On refuse d'effacer une autre personne si l'identifiant a changé de mains.
  if nom_lu <> 'Ndiankou Ndiaye' then
    raise exception 'Cet identifiant porte « % » et non « Ndiankou Ndiaye » : ne rien effacer.', nom_lu;
  end if;

  for r in
    select n.nspname as schema, cl.relname as tbl, att.attname as col
      from pg_constraint c
      join pg_class cl      on cl.oid = c.conrelid
      join pg_namespace n   on n.oid = cl.relnamespace
      join pg_class ref     on ref.oid = c.confrelid
      join unnest(c.conkey) as k(attnum) on true
      join pg_attribute att on att.attrelid = c.conrelid and att.attnum = k.attnum
     where c.contype = 'f'
       and ref.relname = 'chauffeur'
       and cl.relname <> 'chauffeur'
     order by cl.relname, att.attname
  loop
    execute format('select count(*) from %I.%I where %I = $1', r.schema, r.tbl, r.col) into n using personne;
    if n > 0 then
      raise notice '  %.% porte % ligne(s)', r.tbl, r.col, n;
    end if;
    pendant := pendant + n;
  end loop;

  if pendant > 0 then
    raise exception 'Ndiankou Ndiaye porte % ligne(s) au total : inspecter avant d''effacer.', pendant;
  end if;

  delete from chauffeur where id = personne;
  raise notice 'Ndiankou Ndiaye effacée de la liste des chauffeurs : fiche du 15 septembre, sans aucune ligne.';
end
$$;

-- ---------------------------------------------------------------------------
-- PARTIE 3 — ce qui reste : plus personne de ce nom au parc.
-- ---------------------------------------------------------------------------

select count(*) as encore_la
  from chauffeur
 where prenom || ' ' || nom ilike 'Ndiankou Ndiaye';

select count(*) as chauffeurs_restants from chauffeur;

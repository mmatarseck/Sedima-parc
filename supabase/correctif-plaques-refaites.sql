-- ============================================================================
-- SEDIMA Parc — un véhicule réimmatriculé n'est pas deux véhicules.
--
-- **Ce n'est pas une migration.** Les cartes grises lues le 14 septembre 2026
-- portent, à leur recto, l'**immatriculation précédente**. Trois d'entre elles
-- nomment une plaque que le référentiel tient encore pour un véhicule à part :
--
--   * DK 1306 BB → **AB 098 JC**. Le référentiel ne connaît que l'ancienne.
--     Les achats et la caisse citent pourtant déjà la nouvelle, sans pouvoir la
--     rattacher à rien.
--   * DK 2348 BD → **AB 078 JS**. Les deux existent. L'ancienne porte les
--     achats, la caisse, le carburant, la maintenance et les pneus ; la
--     nouvelle, la conformité et la caisse. Le coût d'un même pick-up est
--     coupé en deux, et aucune des deux fiches ne dit la vérité.
--   * DK 7485 BK → **AB 364 HK** (confirmé par le métier le 14 septembre).
--     L'ancienne ne porte rien : elle n'est qu'une ligne de l'inventaire de
--     départ que la nouvelle a remplacée.
--
-- DEUX TRAITEMENTS, parce que ce ne sont pas deux situations.
--
--   A. **Le renommage.** Quand la nouvelle plaque n'a pas de fiche, on renomme
--      l'ancienne : rien ne bouge d'autre. Tout ce qui pend au véhicule le fait
--      par son identifiant, pas par sa plaque, et le suit donc sans un mot.
--      Seule exception voulue : `livraison.immatriculation` garde la plaque
--      **telle qu'écrite sur le bon de livraison**. C'est une trace de ce que
--      le papier disait ce jour-là, pas une référence — la réécrire falsifierait
--      la source.
--
--   B. **La fusion.** Quand les deux fiches existent, celle de la **nouvelle**
--      plaque survit : c'est l'identité actuelle du véhicule. Tout ce qui
--      pointait sur l'ancienne est rattaché à la nouvelle, en parcourant les
--      clés étrangères du catalogue plutôt qu'une liste de tables écrite à la
--      main — une table ajoutée demain sera reprise elle aussi.
--
--      L'ancienne ligne n'est pas supprimée : elle passe au statut **sorti**,
--      datée du jour où la nouvelle immatriculation a pris effet, et son
--      commentaire dit dans quelle fiche elle a été fondue. Une plaque a bel et
--      bien quitté le parc ; le véhicule, non.
--
--      La date de sortie vaut ce que vaut la date d'immatriculation de la
--      survivante — c'est la seule que la base connaisse, et le statut « sorti »
--      en exige une (0047). Pour DK 2348 BD elle tombe en 2017, la même année
--      que l'ancienne carte : l'une des deux dates est douteuse, mais
--      l'identité du véhicule, elle, ne l'est pas — les deux cartes portent le
--      même numéro de série, HH006910. À corriger le jour où le métier
--      retrouvera la date exacte du changement de plaque.
--
-- REJOUABLE : le renommage ne s'applique que si la nouvelle plaque est libre,
-- et la fusion que si les deux lignes existent encore.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- A. Le renommage : DK 1306 BB devient AB 098 JC.
-- ---------------------------------------------------------------------------

update vehicule v
   set immatriculation = 'AB098JC',
       commentaire = trim(both ' ' from coalesce(v.commentaire || ' ', '') || 'Réimmatriculé AB-098-JC ; anciennement DK-1306-BB (carte grise du 06/05/2026, immatriculation précédente DK1306BB).'),
       date_immatriculation = coalesce(v.date_immatriculation, '2026-05-06'::date),
       modifie_le = now()
 where v.immatriculation = 'DK1306BB'
   and not exists (select 1 from vehicule x where x.immatriculation = 'AB098JC');

-- ---------------------------------------------------------------------------
-- B. Les fusions : l'ancienne plaque verse son histoire dans la nouvelle.
-- ---------------------------------------------------------------------------

do $$
declare
  couples constant text[] := array[
    'DK2348BD', 'AB078JS',
    'DK7485BK', 'AB364HK'
  ];
  ancienne text;
  nouvelle text;
  source uuid;
  cible uuid;
  sortie date;
  lien record;
  lignes int;
begin
  for i in 1 .. array_length(couples, 1) / 2 loop
    ancienne := couples[2 * i - 1];
    nouvelle := couples[2 * i];
    select id into source from vehicule where immatriculation = ancienne;
    select id into cible from vehicule where immatriculation = nouvelle;
    if source is null or cible is null then
      raise notice 'fusion % → % : une des deux fiches est absente, sautée', ancienne, nouvelle;
      continue;
    end if;

    /* Le jour où la nouvelle immatriculation a pris effet. */
    select coalesce(date_immatriculation, premiere_mise_en_circulation, current_date) into sortie from vehicule where id = cible;

    /* Une seule attribution courante par véhicule (`attribution_legere_courante`,
       0004) : les deux plaques en ont une, et les rattacher toutes deux à la
       même fiche violerait l'index. Celle de l'ancienne plaque n'a plus cours —
       elle a pris fin le jour où la plaque a été remplacée. On la clôt donc au
       lieu de la déplacer ouverte ; la fiche garde ainsi qui détenait le
       véhicule sous son ancien numéro. */
    update attribution_legere
       set fin = coalesce(fin, sortie)
     where vehicule_id = source and fin is null;

    /* Toutes les colonnes qui pointent sur un véhicule, lues dans le catalogue.
       `vehicule` elle-même est exclue : une fiche ne se rattache pas à une
       autre, et c'est le sujet de la fusion, pas son objet. */
    for lien in
      select cl.relname as nom_table, a.attname as colonne
        from pg_constraint k
        join pg_class cl on cl.oid = k.conrelid
        join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
       where k.contype = 'f' and k.confrelid = 'vehicule'::regclass and cl.relname <> 'vehicule'
    loop
      execute format('update %I set %I = $1 where %I = $2', lien.nom_table, lien.colonne, lien.colonne) using cible, source;
      get diagnostics lignes = row_count;
      if lignes > 0 then
        raise notice '% : % ligne(s) de % rattachée(s) à %', lien.nom_table, lignes, ancienne, nouvelle;
      end if;
    end loop;

    update vehicule
       set statut = 'sorti',
           date_sortie = coalesce(date_sortie, sortie),
           motif_sortie = coalesce(motif_sortie, 'autre'),
           engage = false,
           commentaire = trim(both ' ' from coalesce(commentaire || ' ', '') || 'Réimmatriculé ' || plaque_affichee(nouvelle) || ' : même véhicule, historique fondu dans cette fiche (cartes grises, 14 septembre 2026).'),
           modifie_le = now()
     where id = source and coalesce(commentaire, '') not like '%historique fondu%';

    update vehicule
       set commentaire = trim(both ' ' from coalesce(commentaire || ' ', '') || 'Anciennement ' || plaque_affichee(ancienne) || '.'),
           modifie_le = now()
     where id = cible and coalesce(commentaire, '') not like '%Anciennement ' || plaque_affichee(ancienne) || '%';
  end loop;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- Vérification : ce que portent désormais les trois véhicules.
-- ---------------------------------------------------------------------------

select plaque_affichee(v.immatriculation) as immatriculation, v.statut, v.date_sortie,
       (select count(*) from depense d where d.vehicule_id = v.id)        as depenses,
       (select count(*) from plein p where p.vehicule_id = v.id)          as pleins,
       (select count(*) from intervention i where i.vehicule_id = v.id)   as interventions,
       (select count(*) from pneu n where n.vehicule_id = v.id)           as pneus,
       (select count(*) from document x where x.vehicule_id = v.id)       as documents,
       v.commentaire
  from vehicule v
 where v.immatriculation in ('AB098JC', 'DK1306BB', 'DK2348BD', 'AB078JS', 'DK7485BK', 'AB364HK')
 order by v.immatriculation;

-- ============================================================================
-- SEDIMA Parc — 0043 : de quand datent les données du tableau de bord.
--
-- Demande du métier (11 septembre 2026) : « le tableau de bord est toujours
-- lent à charger ; rafraîchir les données qu'à la connexion ou sur appui d'un
-- bouton, visible si les données ne sont pas à jour ».
--
-- Le tableau de bord se calcule désormais une fois, et se garde dans le
-- navigateur. Pour savoir si ce calcul est dépassé sans le refaire, il suffit
-- d'une date : **la dernière saisie** dans les tables que le tableau lit. Si
-- elle est postérieure au calcul, l'écran le dit et propose d'actualiser.
--
-- La fonction lit le catalogue plutôt qu'une liste de colonnes figée : une
-- table de la liste qui gagne `cree_le` ou `modifie_le` demain sera lue. Elle
-- s'exécute avec les droits de l'appelant : chacun ne voit que les saisies de
-- son périmètre, et n'est donc prévenu que de ce qui change ses chiffres. Une
-- suppression ne se voit pas — elle ne laisse pas de date —, ni une écriture
-- dans une table sans ces colonnes (au 11 septembre : cloture_mois,
-- licence_vehicule, operation_entretien, programme_entretien, type_document) :
-- le bouton Actualiser reste là pour elles.
-- ============================================================================

create or replace function derniere_saisie()
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  t record;
  lu timestamptz;
  plus_recent timestamptz;
begin
  for t in
    select c.table_name,
           bool_or(c.column_name = 'cree_le') as cree,
           bool_or(c.column_name = 'modifie_le') as modifie
      from information_schema.columns c
      join information_schema.tables tb
        on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
     where c.table_schema = 'public'
       and c.column_name in ('cree_le', 'modifie_le')
       and c.table_name in (
         'affectation', 'affretement', 'ajustement_entretien', 'attributaire', 'attribution_legere', 'avance_prestataire',
         'camion_tiers', 'chauffeur', 'chauffeur_tiers', 'cloture_mois', 'demande_achat', 'depense',
         'document', 'enveloppe', 'forfait_carburant', 'incident', 'indisponibilite', 'intervention',
         'licence_transport', 'licence_vehicule', 'mise_a_disposition', 'modification', 'mouvement_caisse', 'mouvement_cuve',
         'observation_visite', 'operation_entretien', 'ordre_travail', 'parametre', 'plan_vehicule', 'plein',
         'pneu', 'prestataire', 'prestation', 'profil_transporteur', 'programme_entretien', 'releve_kilometrique',
         'releve_transport', 'sanction', 'site', 'tarif_journalier', 'type_document', 'vehicule',
         'vehicule_a_recevoir', 'visite_technique'
       )
     group by c.table_name
  loop
    execute format(
      'select greatest(%s, %s) from %I',
      case when t.cree then 'max(cree_le)' else 'null::timestamptz' end,
      case when t.modifie then 'max(modifie_le)' else 'null::timestamptz' end,
      t.table_name
    ) into lu;
    if lu is not null and (plus_recent is null or lu > plus_recent) then
      plus_recent := lu;
    end if;
  end loop;
  return plus_recent;
end
$$;

comment on function derniere_saisie() is 'La dernière saisie visible dans les tables que lit le tableau de bord : ce qui dit si un calcul gardé est dépassé.';

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function derniere_saisie() from anon';
  end if;
end
$$;

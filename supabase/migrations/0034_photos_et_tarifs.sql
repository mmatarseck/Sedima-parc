-- ============================================================================
-- SEDIMA Parc — 0034 : les deux derniers points de l'audit du 10 septembre.
--
-- Ils avaient été laissés ouverts non par oubli mais parce qu'ils demandaient
-- de vérifier qu'on ne casserait rien. C'est fait.
--
-- 1. LE SEAU « pieces ». `lecture_pieces` (0014) laisse **tout compte
--    connecté lire toutes les photos justificatives du parc** : tickets de
--    carburant, pièces de dépenses, réserves de transfert, réponses photo des
--    chauffeurs. Le cloisonnement par véhicule qui s'applique aux lignes ne
--    s'applique pas aux fichiers, et les chemins sont devinables.
--
--    Ce qui retenait : un détenteur qui vient d'envoyer sa photo doit la
--    revoir — le champ affiche une vignette juste après l'envoi. Interdire la
--    lecture au détenteur aurait cassé ce geste.
--
--    La sortie est dans `storage.objects.owner` : le seau garde qui a déposé
--    chaque fichier. **Un détenteur ne lit donc que ses propres dépôts**, ce
--    qui suffit exactement à l'aperçu, et rien de plus. Les autres profils
--    lisent comme avant : ils travaillent sur les pièces de tout le parc.
--
-- 2. LES TABLES DE TRANSPORT, TARIFS ET BUDGET. Ouvertes en lecture à
--    tout rôle par la 0002, avec un commentaire assumant le choix — « il n'y a
--    rien à lui cacher ». Ce commentaire a été écrit **avant** que le profil
--    détenteur n'existe (0007). Un chauffeur y lit la grille tarifaire
--    négociée, les affrètements, les avances de trésorerie aux prestataires et
--    leurs évaluations, et le budget par poste. Le profil détenteur en sort ;
--    pour tous les autres, rien ne change.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Le seau : un détenteur ne lit que ce qu'il a déposé.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'Pas de schéma storage ici : politique du seau ignorée.';
    return;
  end if;

  drop policy if exists lecture_pieces on storage.objects;
  create policy lecture_pieces on storage.objects for select to authenticated
    using (
      bucket_id = 'pieces'
      and mon_role() is not null
      and (not suis_detenteur() or owner = auth.uid())
    );
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Les tarifs, les affrètements, les avances, le budget : plus pour le détenteur.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  /* Treize des dix-sept, et non les dix-sept. Les quatre laissées ouvertes —
     `programme_entretien`, `operation_entretien`, `plan_vehicule`,
     `ajustement_entretien` — sont de la **configuration d'entretien**, pas de
     la donnée commerciale : une gamme de vidange ne se cache pas, et la
     restreindre n'apporterait rien qu'un risque de casser une fiche demain.
     On ferme ce qui est sensible, on n'enferme pas ce qui ne l'est pas. */
  foreach t in array array[
    'profil_transporteur', 'chauffeur_tiers', 'camion_tiers', 'ligne_tarif', 'tarif_journalier',
    'rattachement_localite', 'affretement', 'mise_a_disposition', 'prestation', 'releve_transport',
    'avance_prestataire', 'evaluation_prestataire', 'enveloppe'
  ]
  loop
    execute format('drop policy if exists %I on %I', 'lecture_' || t, t);
    execute format('create policy %I on %I for select using ((select mon_role()) is not null and not (select suis_detenteur()))', 'lecture_' || t, t);
  end loop;
end
$$;

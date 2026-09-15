-- ============================================================================
-- SEDIMA Parc — le scooter du Teral Shop était au parc deux fois.
--
-- **Ce n'est pas une migration.** Une ligne effacée, en connaissance de cause.
--
-- CE QUE LE PARC PORTE. Deux motos Suzuki, toutes deux « en service », toutes
-- deux attribuées à Babacar du Teral Shop :
--
--   * `AA 272 YJ` — « Suzuki Moto », saisie le 7 septembre 2026. Ni VIN, ni
--     date de première circulation. Elle ne porte qu'une attribution, qui
--     double celle de l'autre.
--   * `AA 372 WJ` — « Suzuki Burgman », saisie le 11 septembre 2026 depuis la
--     fiche complète du parc. Première circulation le 03/01/2025, et **deux
--     demandes d'achat réglées** qui la nomment en toutes lettres :
--     « ENTRETIEN DU MOTO AA 372 WJ AUX 11700 KMS », puis « AUX 20600 KMS ».
--
-- CE QUI TRANCHE. Deux factures d'entretien payées portent « AA 372 WJ ». Ce
-- n'est pas une saisie d'inventaire qui peut se tromper : c'est un garage qui a
-- lu la plaque sur la moto et s'est fait payer dessus. `AA 272 YJ` est donc la
-- transcription fautive, et c'est elle qui part.
--
-- CE QUI N'EST PAS PERDU. La ligne effacée ne porte qu'une attribution, vers la
-- même personne que l'autre fiche : Babacar. Rien d'autre n'y pend — ni
-- dépense, ni plein, ni relevé, ni document, ni intervention.
--
-- POURQUOI EFFACER PLUTÔT QUE SORTIR DU PARC. Le statut « sorti » (0046) dit
-- qu'un véhicule a quitté la flotte. Celui-ci ne l'a jamais rejointe : il n'a
-- jamais existé. Le sortir laisserait au parc un engin fantôme qu'on
-- compterait encore dans les inventaires.
--
-- LE GARDE-FOU. La suppression ne s'exécute que si la ligne ne porte rien
-- d'autre qu'une attribution. Si quelque chose y a été rattaché depuis cette
-- lecture, le fichier s'arrête et le dit — plutôt que d'emporter en cascade ce
-- que personne n'a inspecté.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PARTIE 1 — l'inventaire. Lecture seule : rien n'est effacé ici.
-- ---------------------------------------------------------------------------

select v.immatriculation, v.marque, v.appellation, v.statut::text as statut, v.cree_le::date as saisie,
       (select count(*) from depense d where d.vehicule_id = v.id)              as depenses,
       (select count(*) from plein p where p.vehicule_id = v.id)                as pleins,
       (select count(*) from releve_kilometrique r where r.vehicule_id = v.id)  as releves,
       (select count(*) from intervention i where i.vehicule_id = v.id)         as interventions,
       (select count(*) from document x where x.vehicule_id = v.id)             as documents,
       (select count(*) from demande_achat a where a.vehicule_id = v.id)        as achats,
       (select count(*) from attribution_legere t where t.vehicule_id = v.id)   as attributions
  from vehicule v
 where v.immatriculation in ('AA272YJ', 'AA372WJ')
 order by v.immatriculation;

-- ---------------------------------------------------------------------------
-- PARTIE 2 — la suppression, si et seulement si la ligne ne porte que son
-- attribution. À jouer après avoir lu la partie 1.
-- ---------------------------------------------------------------------------

do $$
declare
  faux uuid;
  pendant integer;
begin
  select id into faux from vehicule where immatriculation = 'AA272YJ';
  if faux is null then
    raise notice 'AA 272 YJ est déjà absente : rien à faire.';
    return;
  end if;

  select (select count(*) from depense where vehicule_id = faux)
       + (select count(*) from plein where vehicule_id = faux)
       + (select count(*) from releve_kilometrique where vehicule_id = faux)
       + (select count(*) from intervention where vehicule_id = faux)
       + (select count(*) from document where vehicule_id = faux)
       + (select count(*) from demande_achat where vehicule_id = faux)
       + (select count(*) from incident where vehicule_id = faux)
       + (select count(*) from livraison where vehicule_id = faux)
       + (select count(*) from pneu where vehicule_id = faux)
       + (select count(*) from affectation where vehicule_id = faux)
    into pendant;

  if pendant > 0 then
    raise exception 'AA 272 YJ porte % ligne(s) autres que son attribution : inspecter avant d''effacer.', pendant;
  end if;

  delete from attribution_legere where vehicule_id = faux;
  delete from vehicule where id = faux;
  raise notice 'AA 272 YJ effacée : c''était AA 372 WJ, saisie deux fois.';
end
$$;

-- ---------------------------------------------------------------------------
-- PARTIE 3 — ce qui reste : une seule moto du Teral Shop.
-- ---------------------------------------------------------------------------

select immatriculation, marque, appellation, statut::text as statut
  from vehicule
 where categorie = 'moto'
 order by immatriculation;

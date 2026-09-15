-- ============================================================================
-- SEDIMA Parc — le chariot élévateur sort du registre des véhicules.
--
-- **Ce n'est pas une migration.** Une ligne effacée, à la demande du métier du
-- 15 septembre 2026 : « AA-412-UB à retirer de la base ».
--
-- CE QUE C'EST. `AA 412 UB` — Toyota 8FBE20, chariot élévateur électrique de
-- manutention des sacs à l'UAB. Saisi le 6 septembre 2026, catégorie « engin »,
-- **seul engin du parc**, et déjà `engage = false` : il ne comptait donc ni
-- dans le taux de disponibilité ni dans les indicateurs de la flotte.
--
-- CE QU'IL PORTE, ET CE QUE CELA COÛTE. Une seule ligne : un document
-- d'assurance, AXA-2026-8409, 412 000 F, échéance juin 2027. Ce document est
-- **fabriqué**, et cela se démontre : `AA 412 UB` ne figure pas parmi les 139
-- plaques de la police 2026 (`src/donnees/assurance-2026.ts`), qui est la
-- source réelle. Rien de vrai ne part donc avec lui.
--
-- Onze autres documents d'assurance sont dans le même cas — posés sur des
-- véhicules que la police ne couvre pas, dont AB 681 HE que la situation note
-- « pas encore assuré ». Ils ne sont pas traités ici : c'est un autre geste,
-- qui demande sa propre décision.
--
-- POURQUOI EFFACER PLUTÔT QUE SORTIR DU PARC. Le statut « sorti » (0046) dit
-- qu'un véhicule a quitté la flotte, et le garde consultable avec son
-- historique. Ici le métier ne dit pas que le chariot a quitté l'UAB : il dit
-- qu'il n'a pas sa place au registre des véhicules. Un engin de manutention
-- n'est pas un véhicule du parc — il ne roule pas sur la route, n'a ni carte
-- grise ni visite technique, et n'a jamais été engagé.
--
-- SI LE CHARIOT DOIT RESTER SUIVI QUELQUE PART, ce fichier n'est pas la
-- réponse : il faudrait un registre du matériel, qui n'existe pas encore.
-- Effacer ici, c'est décider que le parc ne le suit pas.
--
-- LE GARDE-FOU. La suppression ne s'exécute que si la ligne ne porte rien
-- d'autre que ce document. Si quelque chose y a été rattaché depuis cette
-- lecture, le fichier s'arrête et le dit.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PARTIE 1 — l'inventaire. Lecture seule : rien n'est effacé ici.
-- ---------------------------------------------------------------------------

select v.immatriculation, v.marque, v.appellation, v.categorie::text as categorie, v.statut::text as statut, v.engage,
       (select count(*) from document x where x.vehicule_id = v.id)             as documents,
       (select count(*) from depense d where d.vehicule_id = v.id)              as depenses,
       (select count(*) from plein p where p.vehicule_id = v.id)                as pleins,
       (select count(*) from releve_kilometrique r where r.vehicule_id = v.id)  as releves,
       (select count(*) from intervention i where i.vehicule_id = v.id)         as interventions,
       (select count(*) from demande_achat a where a.vehicule_id = v.id)        as achats
  from vehicule v
 where v.immatriculation = 'AA412UB';

select numero, type_document_id, numero_piece, emetteur, montant, echeance
  from document
 where vehicule_id = (select id from vehicule where immatriculation = 'AA412UB');

-- ---------------------------------------------------------------------------
-- PARTIE 2 — la suppression. À jouer après avoir lu la partie 1.
-- ---------------------------------------------------------------------------

do $$
declare
  engin uuid;
  pendant integer;
begin
  select id into engin from vehicule where immatriculation = 'AA412UB';
  if engin is null then
    raise notice 'AA 412 UB est déjà absente : rien à faire.';
    return;
  end if;

  select (select count(*) from depense where vehicule_id = engin)
       + (select count(*) from plein where vehicule_id = engin)
       + (select count(*) from releve_kilometrique where vehicule_id = engin)
       + (select count(*) from intervention where vehicule_id = engin)
       + (select count(*) from demande_achat where vehicule_id = engin)
       + (select count(*) from incident where vehicule_id = engin)
       + (select count(*) from livraison where vehicule_id = engin)
       + (select count(*) from pneu where vehicule_id = engin)
       + (select count(*) from affectation where vehicule_id = engin)
       + (select count(*) from attribution_legere where vehicule_id = engin)
    into pendant;

  if pendant > 0 then
    raise exception 'AA 412 UB porte % ligne(s) autres que son document d''assurance : inspecter avant d''effacer.', pendant;
  end if;

  delete from document where vehicule_id = engin;
  delete from vehicule where id = engin;
  raise notice 'AA 412 UB effacée : chariot élévateur, hors registre des véhicules.';
end
$$;

-- ---------------------------------------------------------------------------
-- PARTIE 3 — ce qui reste : plus aucun engin au parc.
-- ---------------------------------------------------------------------------

select count(*) as engins_restants from vehicule where categorie = 'engin';

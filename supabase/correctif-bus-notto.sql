-- ============================================================================
-- SEDIMA Parc — le bus du personnel de Notto porte AB 077 FP, pas AA 077 FP.
--
-- **Ce n'est pas une migration.** Un véhicule, une plaque et sa carte grise.
--
-- CE QUI S'EST PASSÉ. Le dossier DO contient un scan nommé
-- `CARTE GRISE AB 077 BP` dont la carte porte en réalité **AB-077-FP**. Le
-- référentiel, lui, ne connaissait qu'un `AA 077 FP` — mêmes chiffres, même
-- suffixe, préfixe différent — décrit comme « Tata Airforce, bus du personnel
-- de Notto ». Le métier a tranché le 14 septembre 2026 : **c'est le même bus**.
--
-- Ce que la carte confirme au passage : première mise en circulation le
-- 02/01/2026, et le relevé carburant du bus de Notto commence le 31/01/2026.
-- Les deux se tiennent — c'est bien un bus neuf de 2026, dont la plaque avait
-- été relevée AA au lieu de AB dans l'inventaire de départ. La confusion AA/AB
-- est attestée deux autres fois dans ce même dossier de scans.
--
-- UN RENOMMAGE, PAS UNE FUSION : `AB 077 FP` n'a pas de fiche. Tout ce qui pend
-- au véhicule — carburant, conformité, documents — le fait par son identifiant,
-- pas par sa plaque, et le suit donc sans un mot. Comme dans
-- `correctif-plaques-refaites.sql`, `livraison.immatriculation` n'est pas
-- réécrit : c'est la trace de ce que le bon de livraison disait ce jour-là.
--
-- CE QUI EST ÉCRASÉ, ET POURQUOI. Contrairement à `cartes-grises.sql`, la
-- marque et l'appellation ne sont **pas** protégées par `coalesce` : « Tata
-- Airforce » n'est pas une valeur à compléter, c'est une erreur de relevé que
-- la carte grise corrige. Force Motors figure d'ailleurs déjà au catalogue des
-- marques du paramétrage, avec son « Autocar 24 places ». Le reste suit la
-- règle habituelle : seul un champ vide se remplit, et le fichier est
-- rejouable.
--
-- Le « 0 kg » de PTRA de la carte veut dire « sans objet » : il n'entre pas.
-- Les 24 places assises ne se rangent nulle part — `vehicule` n'a pas la
-- colonne.
--
-- À jouer après `aligner-referentiel.sql` et `cartes-grises.sql`.
-- ============================================================================

do $$
declare
  cible uuid;
begin
  select id into cible from vehicule where immatriculation = 'AA077FP';
  if cible is null then
    -- Déjà renommé : le fichier est rejouable, il le dit et s'arrête là.
    raise notice 'AA 077 FP est introuvable — déjà renommé, ou jamais chargé.';
    return;
  end if;
  if exists (select 1 from vehicule where immatriculation = 'AB077FP') then
    -- Une fiche AB 077 FP est apparue entre-temps : ce n'est plus un
    -- renommage mais une fusion, et une fusion ne s'improvise pas ici.
    raise exception 'AB 077 FP existe déjà : fusionner les deux fiches, ne pas renommer.';
  end if;

  update vehicule
     set immatriculation = 'AB077FP',
         -- La carte grise fait foi sur l'identité de l'engin.
         marque = 'Force Motors',
         appellation = 'Traveller Super T2',
         type_modele = coalesce(type_modele, 'E4FGD4'),
         vin = coalesce(vin, 'MC1E4FGD4SP023754'),
         premiere_mise_en_circulation = coalesce(premiere_mise_en_circulation, '2026-01-02'),
         date_immatriculation = coalesce(date_immatriculation, '2026-01-02'),
         puissance_cv = coalesce(puissance_cv, 10),
         cylindree = coalesce(cylindree, 3245),
         ptac = coalesce(ptac, 5750),
         poids_vide = coalesce(poids_vide, 3135),
         charge_utile = coalesce(charge_utile, 2615),
         -- On note la correction, sans la faire passer pour une
         -- réimmatriculation : AA 077 FP n'a jamais existé, c'est un relevé
         -- fautif. Le garde empêche la note de se répéter à chaque rejeu.
         commentaire = case
           when coalesce(commentaire, '') like '%relevée AA-077-FP%' then commentaire
           else trim(both ' ' from coalesce(commentaire || ' ', '')) || 'Plaque relevée AA-077-FP à l''inventaire, corrigée sur la carte grise le 14 septembre 2026.'
         end
   where id = cible;

  raise notice 'AA 077 FP → AB 077 FP : bus du personnel de Notto, carte grise du 02/01/2026.';
end
$$;

-- Ce que le correctif a posé, à relire après exécution.
select immatriculation, marque, appellation, vin, premiere_mise_en_circulation, puissance_cv, cylindree, ptac, poids_vide, charge_utile
  from vehicule
 where immatriculation in ('AA077FP', 'AB077FP');

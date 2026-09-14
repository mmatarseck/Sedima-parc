-- ============================================================================
-- SEDIMA Parc — 0049 : le seau des pièces accepte le PDF.
--
-- Le seau « pieces » (0014) n'acceptait que des images, ce qui suffisait à son
-- usage d'alors : une photo de ticket prise au téléphone. Un document de
-- véhicule n'est pas un ticket — une carte grise a deux faces, une police
-- d'assurance plusieurs pages, et les découper en photos séparées obligerait à
-- ouvrir trois fichiers pour lire une pièce.
--
-- Le PDF entre donc, et seulement lui : ni ZIP, ni Word, ni exécutable. Un
-- seau privé où l'on dépose ce qu'on veut est une surface d'attaque, pas un
-- classeur.
--
-- La taille reste plafonnée à 5 Mo. Les scans du dossier DO montent parfois à
-- 7 Mo pour deux pages, faute de compression ; ils sont recomposés à ~150 Ko
-- avant dépôt (`scripts/attacher-cartes-grises.mts`). Relever le plafond
-- reviendrait à archiver le gaspillage plutôt qu'à le corriger.
-- ============================================================================

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Pas de schéma storage ici : seau ignoré.';
    return;
  end if;
  update storage.buckets
     set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
   where id = 'pieces';
end
$$;

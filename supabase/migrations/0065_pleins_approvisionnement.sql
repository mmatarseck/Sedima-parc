-- ============================================================================
-- 0065 — Le plein : où, remboursable, complet ou partiel (métier, 22 septembre 2026).
--
-- « Définir si l'appro a été faite au niveau de la pompe du siège, dans quel
-- cas pas de facture, ou à la station — sélectionner la station, à rajouter
-- dans la foulée si elle n'est pas dans la base —, rattacher la facture, cocher
-- si c'est remboursable (par défaut : ce qui indique un paiement par la
-- caisse), cocher si c'est le plein ou un remplissage partiel. »
--
--  * `plein.source` porte déjà « Cuve interne SEDIMA » ou le nom de la station ;
--    `plein.prestataire_id` la station au référentiel ; `plein.plein_complet`
--    existe depuis le socle (0001) ; la facture est `plein.photo` (0014).
--  * Nouveau : `plein.remboursable` — vrai par défaut, faux pour la pompe du
--    siège. Seul un plein remboursable attend la caisse.
--  * Nouveau : `ajouter_station(nom)` — celui qui saisit un plein n'a pas la
--    main sur le référentiel des prestataires (0008 la réserve à la gestion
--    des transporteurs) ; la fonction retrouve la station par son nom, ou la
--    pose, type « station », sous le prochain numéro PRE.
--
-- Rejouable.
-- ============================================================================

alter table plein add column if not exists remboursable boolean not null default true;

-- La pompe du siège ne se rembourse pas : les pleins de cuve déjà en base non plus.
update plein set remboursable = false where source ilike '%cuve%' and remboursable;

create or replace function ajouter_station(nom text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  saisi text := btrim(coalesce(nom, ''));
  trouve uuid;
  annee text := to_char(current_date, 'YYYY');
  dernier integer;
begin
  if saisi = '' then return null; end if;
  if not (peut('releves', 'saisie') or peut('transporteurs', 'gestion')) then
    raise exception 'Droit de saisie des relevés requis pour ajouter une station';
  end if;
  select id into trouve from prestataire where lower(raison_sociale) = lower(saisi) limit 1;
  if trouve is not null then return trouve; end if;
  select coalesce(max(nullif(regexp_replace(numero, '^PRE-\d{4}-', ''), numero)::integer), 0)
    into dernier from prestataire where numero like 'PRE-' || annee || '-%';
  insert into prestataire (numero, raison_sociale, type, note)
    values ('PRE-' || annee || '-' || lpad((dernier + 1)::text, 5, '0'), saisi, 'station', 'Ajoutée à la saisie d''un plein')
    returning id into trouve;
  return trouve;
end $$;

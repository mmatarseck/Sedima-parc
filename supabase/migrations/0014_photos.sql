-- ============================================================================
-- SEDIMA Parc — 0014 : les photos des pièces justificatives.
--
-- Décision du métier du 7 septembre 2026 : la photo de la pièce est
-- obligatoire — plein, dépense, réponse à une demande, réserve de transfert.
-- Jusqu'ici l'application n'en gardait que le nom. Les photos vivent
-- désormais dans le stockage de Supabase, dans le seau « pieces », privé :
-- on les lit par une adresse signée, avec sa session. Chaque ligne garde le
-- chemin du fichier (« pieces/demandes/2026/09/…jpg »).
--
-- Qui fait quoi : toute personne connectée avec un rôle dépose et lit ;
-- personne n'efface depuis l'application — une pièce est une trace.
-- ============================================================================

-- Le stockage n'existe que sur Supabase : le rejeu local (PGlite) passe outre.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Pas de schéma storage ici : seau et politiques ignorés.';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('pieces', 'pieces', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists depot_pieces on storage.objects;
  create policy depot_pieces on storage.objects for insert to authenticated
    with check (bucket_id = 'pieces' and mon_role() is not null);

  drop policy if exists lecture_pieces on storage.objects;
  create policy lecture_pieces on storage.objects for select to authenticated
    using (bucket_id = 'pieces' and mon_role() is not null);
end
$$;

-- Le plein et la dépense portent leur photo, comme la demande et la réserve de transfert.
alter table plein   add column if not exists photo text;
alter table depense add column if not exists photo text;

comment on column plein.photo   is 'Le chemin de la photo du ticket ou du bon, dans le seau « pieces ».';
comment on column depense.photo is 'Le chemin de la photo de la pièce justificative, dans le seau « pieces ».';

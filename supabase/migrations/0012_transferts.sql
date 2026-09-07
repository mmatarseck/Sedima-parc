-- ============================================================================
-- SEDIMA Parc — 0012 : la fiche de transfert.
--
-- Cadrage mobile du 7 septembre 2026 : toute remise d'un véhicule à un
-- chauffeur ou à un récipiendaire s'accompagne d'une fiche — compteur,
-- carburant, documents à bord, équipements, réserves avec photos, et la
-- signature de celui qui remet et de celui qui reçoit. Complète, elle ouvre
-- l'affectation qui suit et ferme la précédente.
--
-- Qui fait quoi :
--   - lire : le module « transferts » dans son périmètre ; une partie
--     (remettant ou récipiendaire lié à ma fiche d'accès) lit ses fiches ;
--   - créer : la saisie du module, hors profil détenteur ;
--   - signer : chaque partie sa signature (les fonctions serveur s'en
--     assurent), la gestion pour corriger ou annuler ;
--   - appliquer : `appliquer_transfert()`, quand les deux signatures sont
--     là — elle écrit l'affectation avec les droits de la fonction, parce
--     que le détenteur qui signe en dernier ne peut pas écrire une
--     affectation lui-même.
-- ============================================================================

create table if not exists transfert (
  id                          uuid primary key default gen_random_uuid(),
  numero                      text not null unique,
  vehicule_id                 uuid not null references vehicule (id) on delete cascade,
  remettant_genre             text not null check (remettant_genre in ('chauffeur', 'attributaire', 'parc', 'tiers')),
  remettant_chauffeur_id      uuid references chauffeur (id) on delete set null,
  remettant_attributaire_id   uuid references attributaire (id) on delete set null,
  remettant_nom               text not null default '',
  recipiendaire_genre         text not null check (recipiendaire_genre in ('chauffeur', 'attributaire', 'parc', 'tiers')),
  recipiendaire_chauffeur_id  uuid references chauffeur (id) on delete set null,
  recipiendaire_attributaire_id uuid references attributaire (id) on delete set null,
  recipiendaire_nom           text not null default '',
  date                        timestamptz not null,
  motif                       text not null,
  km                          integer check (km is null or km >= 0),
  carburant                   smallint check (carburant is null or carburant between 0 and 100),
  documents_a_bord            text[] not null default '{}',
  -- [{ "libelle": "Roue de secours", "present": true }, …]
  equipements                 jsonb not null default '[]'::jsonb,
  -- [{ "texte": "…", "photo": "…" }, …]
  reserves                    jsonb not null default '[]'::jsonb,
  commentaire                 text,
  -- { "nom": "…", "le": "…", "trace": "data:image/png;base64,…" }
  signature_remettant         jsonb,
  signature_recipiendaire     jsonb,
  annulee_le                  timestamptz,
  annulee_par                 uuid references auth.users (id),
  appliquee_le                timestamptz,
  cree_le                     timestamptz not null default now(),
  cree_par                    uuid references auth.users (id),
  cree_par_nom                text,
  modifie_le                  timestamptz,
  modifie_par                 uuid references auth.users (id)
);

create index on transfert (vehicule_id, date);
create index on transfert (recipiendaire_chauffeur_id) where signature_recipiendaire is null;
create index on transfert (remettant_chauffeur_id) where signature_remettant is null;

comment on table transfert is 'La fiche de transfert d''un véhicule : état des lieux à la remise, deux signatures ; complète, elle ouvre l''affectation qui suit.';

alter table transfert enable row level security;

create policy lecture_transfert on transfert for select using (
  suis_destinataire(remettant_chauffeur_id, remettant_attributaire_id)
  or suis_destinataire(recipiendaire_chauffeur_id, recipiendaire_attributaire_id)
  or (peut('transferts', 'lecture') and mon_role() <> 'detenteur'
      and exists (select 1 from vehicule v where v.id = transfert.vehicule_id and dans_mon_perimetre(v.site_id, v.business_unit, v.regime)))
);

create policy creation_transfert on transfert for insert with check (
  peut('transferts', 'saisie') and mon_role() <> 'detenteur'
  and exists (select 1 from vehicule v where v.id = transfert.vehicule_id and dans_mon_perimetre(v.site_id, v.business_unit, v.regime))
);

create policy signature_transfert on transfert for update using (
  suis_destinataire(remettant_chauffeur_id, remettant_attributaire_id)
  or suis_destinataire(recipiendaire_chauffeur_id, recipiendaire_attributaire_id)
  or peut('transferts', 'gestion')
  or (peut('transferts', 'saisie') and cree_par = auth.uid())
) with check (
  suis_destinataire(remettant_chauffeur_id, remettant_attributaire_id)
  or suis_destinataire(recipiendaire_chauffeur_id, recipiendaire_attributaire_id)
  or peut('transferts', 'gestion')
  or (peut('transferts', 'saisie') and cree_par = auth.uid())
);

-- ---------------------------------------------------------------------------
-- Appliquer une fiche complète : fermer l'affectation titulaire en cours la
-- veille de la remise, ouvrir celle du récipiendaire chauffeur le jour même.
-- Un récipiendaire attributaire ou parc ne change pas l'affectation des
-- chauffeurs ; la fiche vaut alors état des lieux.
-- ---------------------------------------------------------------------------

create or replace function appliquer_transfert(transfert_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t transfert%rowtype;
  jour date;
begin
  -- La fiche doit m'être visible : les politiques de lecture s'appliquent à l'appelant.
  select * into t from transfert where id = transfert_id
    and exists (select 1 from transfert x where x.id = transfert_id);
  if not found then
    raise exception 'Fiche de transfert introuvable';
  end if;
  if t.signature_remettant is null or t.signature_recipiendaire is null then
    raise exception 'La fiche % n''est pas complète : il manque une signature', t.numero;
  end if;
  if t.annulee_le is not null then
    raise exception 'La fiche % est annulée', t.numero;
  end if;
  if t.appliquee_le is not null then
    return;
  end if;
  jour := t.date::date;
  if t.recipiendaire_genre = 'chauffeur' and t.recipiendaire_chauffeur_id is not null then
    update affectation set fin = jour - 1, modifie_le = now()
      where vehicule_id = t.vehicule_id and role = 'titulaire' and fin is null and debut < jour;
    delete from affectation
      where vehicule_id = t.vehicule_id and role = 'titulaire' and fin is null and debut >= jour;
    insert into affectation (numero, vehicule_id, chauffeur_id, role, debut, fin, motif, cree_par)
      values ('AFF-' || t.numero, t.vehicule_id, t.recipiendaire_chauffeur_id, 'titulaire', jour, null, 'Fiche de transfert ' || t.numero || ' — ' || t.motif, auth.uid())
      on conflict (numero) do nothing;
  end if;
  update transfert set appliquee_le = now(), modifie_le = now(), modifie_par = auth.uid() where id = transfert_id;
end
$$;

comment on function appliquer_transfert(uuid) is 'Ferme l''affectation titulaire en cours et ouvre celle du récipiendaire, quand la fiche porte ses deux signatures.';

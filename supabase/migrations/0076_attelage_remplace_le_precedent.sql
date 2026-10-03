-- ============================================================================
-- 0076 — Un attelage ouvert clôt le précédent.
--
-- Métier, 3 octobre 2026 : « comme règle, s'il y a deux attelages, le
-- deuxième qui a été ouvert ferme l'autre à la même date, pour éviter un
-- doublon ».
--
-- Jusqu'ici la base refusait un second attelage en cours pour un même tracteur
-- ou une même semi (index de 0050), sans voir un véhicule passé d'une colonne
-- à l'autre : ATT-2025-90001 tenait AA 053 AP (une semi) pour le tracteur de
-- AA 927 CA, alors que ATT-2026-00001 attelle le même couple dans le bon sens.
--
-- Désormais, ouvrir un attelage clôt, à sa date de début, tout attelage en
-- cours qui cite l'un de ses deux véhicules, dans un rôle ou dans l'autre. Le
-- motif de l'ancien dit lequel l'a clos. Un attelage saisi avec une date de
-- fin (un historique) ne clôt rien. Si l'ancien commence après la date du
-- nouveau, il est clos à sa propre date de début : une fin n'est jamais
-- antérieure au début.
--
-- Puis les doublons déjà en base suivent la même règle : le plus récent
-- (date de début, puis date de saisie) clôt les autres.
--
-- Rejouable.
-- ============================================================================

create or replace function clore_attelage_precedent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.fin is not null then
    return new;
  end if;
  update attelage a
     set fin = greatest(a.debut, new.debut),
         motif = concat_ws(' · ', nullif(a.motif, ''), 'Clos à l''ouverture de ' || new.numero)
   where a.fin is null
     and a.id <> new.id
     and (a.tracteur_id in (new.tracteur_id, new.remorque_id) or a.remorque_id in (new.tracteur_id, new.remorque_id));
  return new;
end;
$$;

drop trigger if exists attelage_clot_le_precedent on attelage;
create trigger attelage_clot_le_precedent
  before insert or update of tracteur_id, remorque_id, fin on attelage
  for each row execute function clore_attelage_precedent();

-- Les doublons déjà en base : le plus récent clôt les autres.
update attelage a
   set fin = greatest(a.debut, b.debut),
       motif = concat_ws(' · ', nullif(a.motif, ''), 'Clos à l''ouverture de ' || b.numero)
  from attelage b
 where a.fin is null
   and b.fin is null
   and a.id <> b.id
   and (a.tracteur_id in (b.tracteur_id, b.remorque_id) or a.remorque_id in (b.tracteur_id, b.remorque_id))
   and (b.debut, b.cree_le, b.numero) > (a.debut, a.cree_le, a.numero);

select numero, debut, fin, motif from attelage order by numero;

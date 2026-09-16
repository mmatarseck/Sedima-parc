-- ============================================================================
-- SEDIMA Parc — 0053 : les rappels, et deux pièces de plus au dossier.
--
-- Demande du métier du 16 septembre 2026 : « dans la section Conformité, lister
-- des rappels définis par véhicule, avec la prochaine échéance, à définir
-- manuellement. Ce ne sera plus de l'ajout de document, mais de la création de
-- rappel ou du suivi sur les visites techniques, le renouvellement de la police
-- d'assurance ou du certificat de salubrité, ou encore, pour les chauffeurs, le
-- permis de conduire. La liste devra rester paramétrable. »
--
-- CE QUI CHANGE DE SENS. Jusqu'ici la conformité se déduisait des documents :
-- l'échéance d'une assurance était celle du dernier scan enregistré. C'était
-- rigoureux et inutilisable — pour dire « l'assurance expire en juin », il
-- fallait enregistrer un document avec son émetteur et sa pièce, alors que le
-- métier sait la date avant d'avoir le papier. Le rappel porte l'échéance, et
-- le document, quand il arrive, la prouve.
--
-- UN RAPPEL PAR PORTEUR ET PAR TYPE. Un véhicule n'a qu'une « prochaine visite
-- technique » à la fois : renouveler ne crée pas une ligne, cela avance
-- l'échéance et note la date du renouvellement. L'histoire des renouvellements
-- est dans la trace des modifications, comme pour tout le reste. Deux index
-- uniques partiels tiennent la règle — un pour les véhicules, un pour les
-- chauffeurs — parce qu'un rappel a l'un ou l'autre, jamais les deux.
--
-- LE TYPE EST CELUI DES DOCUMENTS. La liste des types de documents (Paramètres
-- › Documents) porte déjà le porteur et la validité de chacun ; un rappel cite
-- ce type par son identifiant, comme `document.type_document_id`. Ajouter un
-- type de rappel, c'est ajouter un type de document et cocher « donne lieu à
-- un rappel » : un concept de moins.
--
-- LES RAPPELS DE DÉPART viennent des documents en base : pour chaque véhicule
-- et chaque type qui expire, la dernière échéance connue. Sans cela, l'écran
-- Conformité serait vide le premier jour, alors que le parc sait déjà quand ses
-- assurances tombent. Le bloc est rejouable : ce qui existe n'est pas touché.
--
-- ET DEUX COLONNES. Le dossier d'un véhicule doit montrer les factures et les
-- procès-verbaux de visite ; une intervention et une visite technique peuvent
-- donc porter un fichier, comme un plein ou une dépense le font depuis 0014.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Deux pièces de plus au dossier
-- ---------------------------------------------------------------------------

alter table intervention     add column if not exists fichier text;
alter table visite_technique add column if not exists fichier text;

comment on column intervention.fichier     is 'La facture ou le rapport d''atelier, dans le seau « pieces » — le dossier du véhicule l''ouvre.';
comment on column visite_technique.fichier is 'Le procès-verbal de la visite, dans le seau « pieces » — le dossier du véhicule l''ouvre.';

-- ---------------------------------------------------------------------------
-- 2. La table des rappels
-- ---------------------------------------------------------------------------

create table if not exists rappel (
  id               uuid primary key default gen_random_uuid(),
  numero           text not null unique,
  vehicule_id      uuid references vehicule (id) on delete cascade,
  chauffeur_id     uuid references chauffeur (id) on delete cascade,
  -- Le type de document dont ce rappel suit le renouvellement (Paramètres › Documents).
  type_document_id text not null,
  -- La prochaine échéance, saisie par le métier.
  echeance         date not null,
  -- Le dernier renouvellement constaté : visite passée, police renouvelée.
  fait_le          date,
  -- Le document qui prouve le renouvellement, quand on l'a.
  document_numero  text references document (numero) on delete set null,
  commentaire      text,
  cree_le          timestamptz not null default now(),
  cree_par         uuid references auth.users (id),
  modifie_le       timestamptz,
  modifie_par      uuid references auth.users (id),
  -- Un porteur, et un seul.
  constraint rappel_un_porteur check (
    (vehicule_id is not null and chauffeur_id is null) or (vehicule_id is null and chauffeur_id is not null)
  )
);

create unique index if not exists rappel_vehicule_type  on rappel (vehicule_id, type_document_id)  where vehicule_id  is not null;
create unique index if not exists rappel_chauffeur_type on rappel (chauffeur_id, type_document_id) where chauffeur_id is not null;
create index if not exists rappel_echeance on rappel (echeance);

comment on table rappel is 'La prochaine échéance de chaque pièce à renouveler, par véhicule ou par chauffeur : ce que la Conformité liste et ce dont elle alerte.';

-- ---------------------------------------------------------------------------
-- 3. Qui lit, qui écrit — les mêmes règles que les documents
-- ---------------------------------------------------------------------------

alter table rappel enable row level security;

drop policy if exists lecture_rappel on rappel;
create policy lecture_rappel on rappel for select using (
  (vehicule_id is null or vehicule_id in (select id from vehicule))
  and (chauffeur_id is null or chauffeur_id in (select id from chauffeur))
);

drop policy if exists saisie_rappel on rappel;
create policy saisie_rappel on rappel for insert with check (peut('documents', 'saisie'));

drop policy if exists gestion_rappel on rappel;
create policy gestion_rappel on rappel for all using (peut('documents', 'gestion')) with check (peut('documents', 'gestion'));

-- ---------------------------------------------------------------------------
-- 4. Les rappels de départ, depuis les documents déjà en base
--
-- Pour chaque porteur et chaque type qui expire, la dernière échéance connue.
-- La carte grise n'expire pas : pas de rappel. Rejouable — un rappel déjà posé
-- n'est pas touché, et une base sans document ne pose rien.
-- ---------------------------------------------------------------------------

do $$
declare
  n integer := 0;
  r record;
begin
  for r in
    select d.vehicule_id, d.chauffeur_id, d.type_document_id, max(d.echeance) as echeance
      from document d
     where d.echeance is not null
       and d.type_document_id in ('assurance', 'visite-technique', 'certificat-salubrite', 'carte-transport', 'permis', 'visite-medicale')
       and ((d.vehicule_id is not null and d.chauffeur_id is null) or (d.vehicule_id is null and d.chauffeur_id is not null))
     group by d.vehicule_id, d.chauffeur_id, d.type_document_id
  loop
    if exists (
      select 1 from rappel x
       where x.type_document_id = r.type_document_id
         and x.vehicule_id is not distinct from r.vehicule_id
         and x.chauffeur_id is not distinct from r.chauffeur_id
    ) then
      continue;
    end if;
    n := n + 1;
    insert into rappel (numero, vehicule_id, chauffeur_id, type_document_id, echeance, commentaire)
    values (
      'RAP-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 5, '0'),
      r.vehicule_id, r.chauffeur_id, r.type_document_id, r.echeance,
      'Posé au démarrage depuis la dernière échéance enregistrée.'
    );
  end loop;
  raise notice '% rappel(s) posé(s) depuis les documents.', n;
end
$$;

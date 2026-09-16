-- ============================================================================
-- SEDIMA Parc — dix documents d'assurance vides sortent du registre.
--
-- **Ce n'est pas une migration.** Dix lignes effacées, à la demande du métier
-- du 16 septembre 2026 (« ok pour le reste », sur la liste du matin).
--
-- CE QUE C'EST. Dix lignes de type « assurance », posées sur des véhicules
-- qui ne figurent pas dans la police 2026 (`src/donnees/assurance-2026.ts`,
-- la source réelle) — et qui ne portent **rien** : ni numéro de police, ni
-- émetteur, ni montant, ni échéance, ni fichier. Ce sont des coquilles, posées
-- pour dire « assurance attendue » à l'époque où la Conformité comptait les
-- documents manquants. Elle ne le fait plus : depuis 0053, elle suit des
-- rappels, et une assurance à venir se saisit comme un rappel avec sa date.
--
-- CE QUI N'EST PAS EFFACÉ, ET POURQUOI. La onzième ligne hors police,
-- AB 551 HS, porte une vraie police — AXA-2026-9850, 1 042 000 F, échéance
-- 21 janvier 2027 — et 0053 en a tiré le rappel RAP-2026-00037. Un véhicule
-- absent de la liste de janvier mais assuré depuis ressemble à un achat de
-- l'année, pas à une invention. Elle reste, sauf décision contraire du métier.
--
-- LE GARDE-FOU. Chaque ligne n'est effacée que si elle est **encore** vide et
-- qu'aucun rappel ne la cite comme preuve. Si l'une d'elles a été complétée
-- depuis cette lecture, le fichier s'arrête et le dit.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PARTIE 1 — l'inventaire. Lecture seule : rien n'est effacé ici.
-- ---------------------------------------------------------------------------

select d.numero, v.immatriculation, d.numero_piece, d.emetteur, d.montant, d.echeance, d.fichier,
       (select count(*) from rappel r where r.document_numero = d.numero) as cite_par_un_rappel
  from document d
  join vehicule v on v.id = d.vehicule_id
 where d.numero in ('DOC-2026-22002', 'DOC-2026-41002', 'DOC-2026-42004', 'DOC-2026-43004', 'DOC-2026-47002',
                    'DOC-2026-48002', 'DOC-2026-49004', 'DOC-2026-51004', 'DOC-2026-52004', 'DOC-2026-54002')
 order by d.numero;

-- ---------------------------------------------------------------------------
-- PARTIE 2 — la suppression. À jouer après avoir lu la partie 1.
-- ---------------------------------------------------------------------------

do $$
declare
  vises  text[] := array['DOC-2026-22002', 'DOC-2026-41002', 'DOC-2026-42004', 'DOC-2026-43004', 'DOC-2026-47002',
                         'DOC-2026-48002', 'DOC-2026-49004', 'DOC-2026-51004', 'DOC-2026-52004', 'DOC-2026-54002'];
  pleins text[];
  cites  text[];
  n      integer;
begin
  -- Une ligne qui porte quelque chose n'est plus une coquille : on ne l'efface pas.
  select array_agg(numero) into pleins
    from document
   where numero = any(vises)
     and (type_document_id <> 'assurance' or numero_piece is not null or emetteur is not null
          or montant is not null or echeance is not null or fichier is not null);
  if pleins is not null then
    raise exception 'Ces lignes ne sont plus vides, inspecter avant d''effacer : %', array_to_string(pleins, ', ');
  end if;

  -- Une ligne qu'un rappel cite comme preuve tient un engagement : on ne l'efface pas.
  select array_agg(document_numero) into cites from rappel where document_numero = any(vises);
  if cites is not null then
    raise exception 'Ces lignes sont citées par un rappel : %', array_to_string(cites, ', ');
  end if;

  delete from document where numero = any(vises) and type_document_id = 'assurance';
  get diagnostics n = row_count;
  raise notice '% document(s) d''assurance vide(s) effacé(s).', n;
end
$$;

-- ---------------------------------------------------------------------------
-- PARTIE 3 — ce qui reste : plus aucune assurance sans contenu.
-- ---------------------------------------------------------------------------

select count(*) as assurances_vides_restantes
  from document
 where type_document_id = 'assurance'
   and numero_piece is null and emetteur is null and montant is null and echeance is null and fichier is null;

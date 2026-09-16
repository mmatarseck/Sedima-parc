-- ============================================================================
-- SEDIMA Parc — quatre véhicules neufs retrouvent leur clé : leur châssis.
--
-- **Ce n'est pas une migration.** Quatre lignes corrigées, suite à l'essai du
-- métier du 16 septembre 2026 : « je redémarre le serveur et je teste la
-- création ».
--
-- CE QUI S'EST PASSÉ. Quatre véhicules neufs — deux tracteurs SINOTRUK HOWO et
-- deux remorques JAC 39VRC — ont été créés avec, dans le champ Immatriculation,
-- un provisoire tapé à la main : « (NOUVEAU VRAC 1) », « (NOUVEAU VRAC 1
-- REMORQUE) », « (NOUVEAU VRAC 2) », « (NOUVEAU VRAC 2 REMORQUE) ». Le
-- serveur n'ôtait que les espaces et les tirets : la clé est entrée en base
-- **avec ses parenthèses**. L'adresse de la fiche, elle, est normalisée sans
-- elles — les deux ne se retrouvaient plus, et la fiche disait « introuvable »
-- pour un véhicule qui existait. Le code est corrigé (une seule règle de
-- canonicalisation) ; ce fichier corrige les quatre lignes.
--
-- CE QU'ON LEUR DONNE. Leur clé prévue : « VIN » suivi du numéro de châssis,
-- que chacun porte. C'est ainsi qu'un véhicule sans carte grise entre au parc
-- depuis aujourd'hui ; la fiche l'affiche « Sans plaque · VIN … » avec le
-- bouton « Renseigner la plaque » pour le jour où la carte grise arrive. Leur
-- statut « en mutation » est juste et reste.
--
-- CE QUI SUIT. Le journal des modifications cite un véhicule par son
-- immatriculation : une trace (sur la remorque 1) est renommée avec lui.
-- Tout le reste — documents, dépenses, attelages — le cite par son
-- identifiant, qui ne change pas.
--
-- LE GARDE-FOU. Seules les quatre lignes nommées, encore entre parenthèses,
-- avec un châssis, sont touchées. Une clé « VIN… » déjà prise arrêterait la
-- transaction sur l'unicité — rien ne serait écrit à moitié.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PARTIE 1 — l'inventaire. Lecture seule : ce qui porte une clé qui n'est
-- pas faite de lettres et de chiffres, et ce que chacune deviendra.
-- ---------------------------------------------------------------------------

select v.id, v.immatriculation, v.vin, v.marque, v.appellation, v.statut::text as statut,
       'VIN' || upper(regexp_replace(v.vin, '[^A-Za-z0-9]', '', 'g')) as cle_prevue,
       (select count(*) from modification m where m.table_cible = 'vehicule' and m.numero = v.immatriculation) as traces_journal,
       v.cree_le::timestamp(0) as saisie
  from vehicule v
 where v.immatriculation !~ '^[A-Z0-9]+$'
 order by v.cree_le;

-- ---------------------------------------------------------------------------
-- PARTIE 2 — la correction. À jouer après avoir lu la partie 1.
-- ---------------------------------------------------------------------------

-- Sans expression régulière ni chaîne de CTE : la première version, jouée le
-- 16 septembre au soir, n'a touché aucune ligne — « '^\(' » se lit « ^( »
-- selon le réglage de l'éditeur, et l'expression échoue. Deux mises à jour
-- lisibles, gardées sur l'identifiant, la parenthèse ouvrante et le châssis.

begin;

-- 2a. Le journal d'abord : il cite l'ancienne clé, qu'on va changer.
update modification m
   set numero = 'VIN' || upper(regexp_replace(v.vin, '[^A-Za-z0-9]', '', 'g'))
  from vehicule v
 where m.table_cible = 'vehicule'
   and m.numero = v.immatriculation
   and v.id in ('eef375e0-13e4-4b7e-a42c-ab81d154e50c',
                'c666a237-7668-4796-9734-9c45165429f6',
                '193ed330-54ab-4696-9791-573d9f6d12a7',
                'af6187a4-06da-4efd-954a-f74db763a5b6')
   and left(v.immatriculation, 1) = '('
   and v.vin is not null;

-- 2b. Les véhicules.
update vehicule v
   set immatriculation = 'VIN' || upper(regexp_replace(v.vin, '[^A-Za-z0-9]', '', 'g')),
       modifie_le = now()
 where v.id in ('eef375e0-13e4-4b7e-a42c-ab81d154e50c',
                'c666a237-7668-4796-9734-9c45165429f6',
                '193ed330-54ab-4696-9791-573d9f6d12a7',
                'af6187a4-06da-4efd-954a-f74db763a5b6')
   and left(v.immatriculation, 1) = '('
   and v.vin is not null;

commit;

-- ---------------------------------------------------------------------------
-- PARTIE 3 — la vérification. Les quatre lignes sous leur clé « VIN… », plus
-- aucune clé entre parenthèses, et le journal qui suit.
-- ---------------------------------------------------------------------------

select v.immatriculation, v.vin, v.marque, v.appellation, v.statut::text as statut,
       (select count(*) from modification m where m.table_cible = 'vehicule' and m.numero = v.immatriculation) as traces_journal
  from vehicule v
 where v.id in ('eef375e0-13e4-4b7e-a42c-ab81d154e50c',
                'c666a237-7668-4796-9734-9c45165429f6',
                '193ed330-54ab-4696-9791-573d9f6d12a7',
                'af6187a4-06da-4efd-954a-f74db763a5b6')
 order by v.cree_le;

select count(*) as cles_entre_parentheses from vehicule where left(immatriculation, 1) = '(';

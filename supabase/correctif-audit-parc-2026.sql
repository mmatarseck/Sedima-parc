-- ============================================================================
-- SEDIMA Parc — ce que l'audit interne du parc fait entrer dans la base.
--
-- **Ce n'est pas une migration.** Rapport d'audit de la gestion du parc (période
-- du 1er janvier 2025 au 31 juillet 2026, provisoire) et compte rendu de la
-- réunion de synthèse du 2 septembre 2026. Voir docs/AUDIT-PARC-2026.md.
--
-- Cinq parties, dans une seule transaction :
--
--   A. Les fournisseurs en double. « Deux comptes ouverts sur X3 pour le même
--      fournisseur » : ALIOUNE NDIAYE (FL001251) et GIE NDIAYE ET FRERES
--      (FL100136), le même garagiste passé du GIE à l'entreprise individuelle.
--      Le référentiel en portait trois lignes, et Gormack deux. Tout ce qui les
--      cite est rattaché à une seule ligne ; les autres sont désactivées, et
--      disent dans quelle ligne elles ont été fondues.
--   B. Les contrats. « Seuls trois transporteurs sont liés par un contrat :
--      ADEX, Mamadou Diop et Abdou Kane. » ADEX l'était déjà ; Abdou Kane le
--      devient. Mamadou Diop n'est pas au référentiel des transporteurs.
--   C. Les véhicules. Six véhicules au garage depuis plus d'un an, deux
--      véhicules de livraison sans balise : le constat entre dans leur
--      commentaire, avec ce que le parc a répondu.
--   D. ADEX en août. L'audit confirme le contrat : mise à disposition « 6
--      jours / 7 », décomptée « selon la fonctionnalité du véhicule ». Les jours
--      non facturés sont donc des jours d'indisponibilité. Les six camions
--      chargés en prestations au jour depuis le CA provisoire deviennent des
--      mises à disposition : jours dus du contrat, indisponibilité déduite, même
--      montant hors taxe. La benne sans plaque reste en prestation.
--   E. ADEX en avril. L'audit a pointé trois factures contre les lignes de
--      livraison : 24, 25 et 20 jours facturés pour 13, 16 et 10 jours de
--      livraison. Ces mois entrent en mises à disposition avec leurs jours
--      roulés : l'écart que l'audit relève — 11, 9 et 10 jours payés non
--      roulés — se lit alors dans l'application.
--
-- REJOUABLE : chaque partie se garde de refaire ce qui est fait.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- A. Les fournisseurs en double
-- ---------------------------------------------------------------------------

do $$
declare
  fusions constant text[] := array[
    'PRE-2026-70004', 'PRE-2026-90041',
    'PRE-2026-90024', 'PRE-2026-90041',
    'PRE-2026-90019', 'PRE-2026-00004'
  ];
  source uuid;
  cible uuid;
  lien record;
  lignes int;
begin
  for i in 1 .. array_length(fusions, 1) / 2 loop
    select id into source from prestataire where numero = fusions[2 * i - 1];
    select id into cible from prestataire where numero = fusions[2 * i];
    if source is null or cible is null then
      raise notice 'fusion % dans % : une des deux lignes est absente, sautée', fusions[2 * i - 1], fusions[2 * i];
      continue;
    end if;
    -- Toutes les colonnes qui pointent sur un prestataire, lues dans le catalogue :
    -- une table ajoutée demain sera rattachée elle aussi.
    for lien in
      select cl.relname as nom_table, a.attname as colonne
        from pg_constraint k
        join pg_class cl on cl.oid = k.conrelid
        join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
       where k.contype = 'f' and k.confrelid = 'prestataire'::regclass
    loop
      execute format('update %I set %I = $1 where %I = $2', lien.nom_table, lien.colonne, lien.colonne) using cible, source;
      get diagnostics lignes = row_count;
      if lignes > 0 then
        raise notice '% : % ligne(s) de % rattachée(s) à %', lien.nom_table, lignes, fusions[2 * i - 1], fusions[2 * i];
      end if;
    end loop;
    update prestataire
       set actif = false,
           note = coalesce(note || ' ', '') || 'Fondu dans ' || fusions[2 * i] || ' le 11 septembre 2026 (audit interne du parc : même fournisseur).'
     where id = source and coalesce(note, '') not like '%Fondu dans%';
  end loop;
end
$$;

update prestataire
   set note = coalesce(note || ' ', '') || 'Anciennement GIE NDIAYE ET FRERES : deux comptes X3, FL100136 (le GIE, à fermer) et FL001251 (l''entreprise individuelle, qui porte les nouvelles factures). Garagiste et vendeur de pièces.'
 where numero = 'PRE-2026-90041' and coalesce(note, '') not like '%FL001251%';

update prestataire
   set note = coalesce(note || ' ', '') || 'Audit interne 2026 : en contentieux avec SEDIMA — quatre véhicules immobilisés à son garage de Rufisque depuis plus d''un an, réparations réglées (675 000 F pour deux plateaux) et non effectuées.'
 where numero = 'PRE-2026-00004' and coalesce(note, '') not like '%contentieux%';

-- ---------------------------------------------------------------------------
-- B. Les contrats
-- ---------------------------------------------------------------------------

update profil_transporteur
   set sous_contrat = true,
       reference_contrat = 'Contrat communiqué à l''audit interne du parc (rapport provisoire, 2026)',
       commentaire = coalesce(commentaire || ' ', '') || 'Sous contrat, payé par livraison (audit interne 2026).'
 where prestataire_id = (select id from prestataire where numero = 'PRE-2026-00021')
   and not sous_contrat;

-- ---------------------------------------------------------------------------
-- C. Les véhicules
-- ---------------------------------------------------------------------------

update vehicule set commentaire = coalesce(commentaire || ' — ', '') ||
  'Audit interne 2026 : au garage de Djily (Pikine) depuis plus d''un an, en panne depuis 2020. Le prestataire Daniel a fait un diagnostic et dit pouvoir le réparer, sans devis à ce jour.'
 where immatriculation = 'DK7620BG' and coalesce(commentaire, '') not like '%Audit interne 2026%';

update vehicule set commentaire = coalesce(commentaire || ' — ', '') ||
  'Audit interne 2026 : au garage Gormack (Rufisque) depuis plus d''un an. Le garagiste est en contentieux avec SEDIMA : réparations réglées, non effectuées.'
 where immatriculation in ('DK9619BB', 'DL5941D', 'DK4003AG', 'DK7619BG') and coalesce(commentaire, '') not like '%Audit interne 2026%';

update vehicule set commentaire = coalesce(commentaire || ' — ', '') ||
  'Audit interne 2026 : véhicule de livraison sans balise de géolocalisation ; une commande de balises est engagée.'
 where immatriculation in ('AA920VA', 'AA433AJ') and coalesce(commentaire, '') not like '%Audit interne 2026%';

-- ---------------------------------------------------------------------------
-- D. ADEX en août : des prestations au jour aux mises à disposition
--
-- Août compte 31 jours ; le contrat en paie six sur sept, soit 27. Les jours
-- non facturés sont l'indisponibilité du véhicule. Jours roulés : nuls — le
-- relevé de tonnage d'août est incomplet (la semaine du 7 au 13 ne porte que
-- 15 voyages), et en tirer des jours roulés gonflerait l'écart.
-- ---------------------------------------------------------------------------

delete from prestation
 where numero in ('PRS-2026-90001', 'PRS-2026-90002', 'PRS-2026-90003', 'PRS-2026-90005', 'PRS-2026-90006', 'PRS-2026-90007')
   and statut = 'livre' and montant_facture is null;

insert into mise_a_disposition (numero, mois, prestataire_id, immatriculation, famille, jours_calendaires, jours_panne, jours_roules, prix_jour, convention, statut, montant_facture, commentaire) values
  ('MAD-2026-90001', '2026-08', (select id from prestataire where numero = 'PRE-2026-00033'), 'AA569EC', 'aliments', 31, 8, null, 130000, 'inconnue', 'livre', null, 'CA provisoire d''août 2026 : 19 jours facturés à 130 000 F hors taxe. Contrat 6 jours sur 7 décompté selon l''état du véhicule (audit interne 2026) : 8 jours non facturés comptés en indisponibilité.'),
  ('MAD-2026-90002', '2026-08', (select id from prestataire where numero = 'PRE-2026-00033'), 'AA571EC', 'aliments', 31, 10, null, 130000, 'inconnue', 'livre', null, 'CA provisoire d''août 2026 : 17 jours facturés à 130 000 F hors taxe. Contrat 6 jours sur 7 décompté selon l''état du véhicule (audit interne 2026) : 10 jours non facturés comptés en indisponibilité.'),
  ('MAD-2026-90003', '2026-08', (select id from prestataire where numero = 'PRE-2026-00033'), 'AA573EC', 'aliments', 31, 8, null, 130000, 'inconnue', 'livre', null, 'CA provisoire d''août 2026 : 19 jours facturés à 130 000 F hors taxe. Contrat 6 jours sur 7 décompté selon l''état du véhicule (audit interne 2026) : 8 jours non facturés comptés en indisponibilité.'),
  ('MAD-2026-90004', '2026-08', (select id from prestataire where numero = 'PRE-2026-00033'), 'AA014SR', 'aliments', 31, 5, null, 80000, 'inconnue', 'livre', null, 'CA provisoire d''août 2026 : 22 jours facturés à 80 000 F hors taxe. Contrat 6 jours sur 7 décompté selon l''état du véhicule (audit interne 2026) : 5 jours non facturés comptés en indisponibilité. Famille non écrite sur la pièce : aliments, comme les porteurs du relevé.'),
  ('MAD-2026-90005', '2026-08', (select id from prestataire where numero = 'PRE-2026-00033'), 'AA918NT', 'aliments', 31, 4, null, 110000, 'inconnue', 'livre', null, 'CA provisoire d''août 2026 : 23 jours facturés à 110 000 F hors taxe. Contrat 6 jours sur 7 décompté selon l''état du véhicule (audit interne 2026) : 4 jours non facturés comptés en indisponibilité. Famille non écrite sur la pièce : aliments, comme les porteurs du relevé.'),
  ('MAD-2026-90006', '2026-08', (select id from prestataire where numero = 'PRE-2026-00033'), 'AA076BP', 'oeufs', 31, 17, null, 45000, 'inconnue', 'livre', null, 'CA provisoire d''août 2026 : 10 jours facturés à 45 000 F hors taxe. Contrat 6 jours sur 7 décompté selon l''état du véhicule (audit interne 2026) : 17 jours non facturés comptés en indisponibilité.')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- E. ADEX en avril, d'après l'audit
--
-- Avril compte 30 jours ; le contrat en paie 26. Les factures pointées par
-- l'audit sont réglées depuis : rangées réglées, sans date connue.
-- ---------------------------------------------------------------------------

insert into mise_a_disposition (numero, mois, prestataire_id, immatriculation, famille, jours_calendaires, jours_panne, jours_roules, prix_jour, convention, statut, montant_facture, commentaire) values
  ('MAD-2026-91001', '2026-04', (select id from prestataire where numero = 'PRE-2026-00033'), 'AA573EC', 'aliments', 30, 2, 13, 130000, 'inconnue', 'regle', 3120000, 'Audit interne 2026, factures d''avril : 24 jours facturés, 13 jours sur ligne de livraison — 11 jours payés non roulés. Les jours non facturés comptés en indisponibilité (contrat 6 jours sur 7).'),
  ('MAD-2026-91002', '2026-04', (select id from prestataire where numero = 'PRE-2026-00033'), 'AA571EC', 'aliments', 30, 1, 16, 130000, 'inconnue', 'regle', 3250000, 'Audit interne 2026, factures d''avril : 25 jours facturés, 16 jours sur ligne de livraison — 9 jours payés non roulés. Les jours non facturés comptés en indisponibilité (contrat 6 jours sur 7).'),
  ('MAD-2026-91003', '2026-04', (select id from prestataire where numero = 'PRE-2026-00033'), 'AA569EC', 'aliments', 30, 6, 10, 130000, 'inconnue', 'regle', 2600000, 'Audit interne 2026, factures d''avril : 20 jours facturés, 10 jours sur ligne de livraison — 10 jours payés non roulés. Les jours non facturés comptés en indisponibilité (contrat 6 jours sur 7).')
on conflict do nothing;

commit;


-- ---------------------------------------------------------------------------
-- Vérification
-- ---------------------------------------------------------------------------

select 'fournisseurs fondus, désactivés' as controle, count(*)::text as valeur from prestataire where note like '%Fondu dans%' and not actif
union all
select 'Abdou Kane sous contrat', (select sous_contrat::text from profil_transporteur where prestataire_id = (select id from prestataire where numero = 'PRE-2026-00021'))
union all
select 'véhicules portant le constat de l''audit', count(*)::text from vehicule where commentaire like '%Audit interne 2026%'
union all
select 'mises à disposition ADEX d''août', count(*)::text from mise_a_disposition where numero like 'MAD-2026-900%'
union all
select 'prestations ADEX d''août restantes (la benne)', count(*)::text from prestation where numero like 'PRS-2026-9%'
union all
select 'mises à disposition ADEX d''avril', count(*)::text from mise_a_disposition where numero like 'MAD-2026-910%';

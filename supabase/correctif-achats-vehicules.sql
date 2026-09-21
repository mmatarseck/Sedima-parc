-- ============================================================================
-- SEDIMA Parc — les achats de véhicules sortent des achats, et leurs montants
-- vont là où ils se lisent : sur la fiche de chaque véhicule.
--
-- **Ce n'est pas une migration.** Métier, 21 septembre 2026 : « retirer des
-- achats les achats de véhicules. Les bons montants. »
--
-- CE QUE C'EST. Trois demandes d'achat, chargées le 11 septembre depuis les
-- bons de commande, sont des **investissements** et non des achats du parc :
--
--   DAC-R-00647  CMD2-26080021  15 Mitsubishi L200 Triton      299 100 000 F
--   DAC-R-00377  BC18930        tracteur FAW 6×4                40 700 000 F
--   DAC-R-00459  CMD2-25120278  camionnette HOWO caisse fermée  21 000 000 F
--
-- Soit 360,8 M F qui gonflaient les achats réglés — la troisième rangée à tort
-- en « pièces détachées » par l'extraction. Rien d'autre ne les cite : ni
-- dépense, ni intervention, ni prestation, ni mouvement de caisse.
--
-- LES BONS MONTANTS. Le tracteur (AB 932 EF, 40,7 M F), la camionnette
-- (AB 681 HE, 21 M F) et dix des quinze L200 (19 940 000 F pièce) portent déjà
-- leur valeur depuis le grand livre. Les **cinq L200 immatriculés le
-- 1er septembre 2026** (AB 010/060/062/066/112 KT) sont du même bon, mais
-- entrés après l'arrêté du 31 août : ils reçoivent ici la même valeur — le
-- bon fait 299 100 000 F pour quinze, soit 19 940 000 F pièce, ce que le
-- tableau des immobilisations confirme pour les dix autres. Leur référence
-- d'immobilisation reste vide : la comptabilité ne l'a pas encore donnée.
-- Le vendeur est écrit sur les dix-sept fiches.
--
-- LE GARDE-FOU. Une demande n'est retirée que si elle est encore ce qu'on a lu :
-- même bon, même montant, réglée. Une valeur d'acquisition déjà saisie n'est
-- pas écrasée. Rejouable.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PARTIE 1 — l'inventaire. Lecture seule.
-- ---------------------------------------------------------------------------

select numero, date, numero_bon_commande, montant_estime, poste, etape, fournisseur, left(objet, 70) as objet
  from demande_achat
 where numero in ('DAC-R-00647', 'DAC-R-00377', 'DAC-R-00459')
 order by numero;

-- ---------------------------------------------------------------------------
-- PARTIE 2 — le retrait, et les montants sur les fiches.
-- ---------------------------------------------------------------------------

do $$
declare
  changees text[];
  n        integer;
begin
  select array_agg(d.numero) into changees
    from demande_achat d
    join (values ('DAC-R-00647', 'CMD2-26080021', 299100000), ('DAC-R-00377', 'BC18930', 40700000), ('DAC-R-00459', 'CMD2-25120278', 21000000))
         as lu (numero, bon, montant) on lu.numero = d.numero
   where d.numero_bon_commande is distinct from lu.bon or d.montant_estime <> lu.montant or d.etape <> 'reglee';
  if changees is not null then
    raise exception 'Ces demandes ne sont plus ce qui a été lu, inspecter avant de retirer : %', array_to_string(changees, ', ');
  end if;

  delete from demande_achat where numero in ('DAC-R-00647', 'DAC-R-00377', 'DAC-R-00459');
  get diagnostics n = row_count;
  raise notice '% demande(s) d''achat de véhicules retirée(s).', n;
end
$$;

-- Les cinq L200 du même bon, entrés après l'arrêté du 31 août.
update vehicule
   set valeur_acquisition = 19940000,
       date_acquisition = coalesce(date_acquisition, premiere_mise_en_circulation, date '2026-09-01'),
       duree_amortissement_annees = coalesce(duree_amortissement_annees, 4)
 where immatriculation in ('AB010KT', 'AB060KT', 'AB062KT', 'AB066KT', 'AB112KT')
   and valeur_acquisition is null;

-- Le vendeur, sur les dix-sept fiches — là où il n'est pas déjà écrit.
with vendeurs (immatriculation, vendeur) as (values
  ('AB932EF', 'TRACTAFRIC MOTORS SENEGAL'),
  ('AB681HE', 'CFAO'),
  ('AB565KP', 'LA SENEGALAISE DE L''AUTOMOBILE'), ('AB609KP', 'LA SENEGALAISE DE L''AUTOMOBILE'), ('AB611KP', 'LA SENEGALAISE DE L''AUTOMOBILE'),
  ('AB612KP', 'LA SENEGALAISE DE L''AUTOMOBILE'), ('AB614KP', 'LA SENEGALAISE DE L''AUTOMOBILE'), ('AB615KP', 'LA SENEGALAISE DE L''AUTOMOBILE'),
  ('AB616KP', 'LA SENEGALAISE DE L''AUTOMOBILE'), ('AB617KP', 'LA SENEGALAISE DE L''AUTOMOBILE'), ('AB619KP', 'LA SENEGALAISE DE L''AUTOMOBILE'),
  ('AB622KP', 'LA SENEGALAISE DE L''AUTOMOBILE'), ('AB010KT', 'LA SENEGALAISE DE L''AUTOMOBILE'), ('AB060KT', 'LA SENEGALAISE DE L''AUTOMOBILE'),
  ('AB062KT', 'LA SENEGALAISE DE L''AUTOMOBILE'), ('AB066KT', 'LA SENEGALAISE DE L''AUTOMOBILE'), ('AB112KT', 'LA SENEGALAISE DE L''AUTOMOBILE')
)
update vehicule v
   set fournisseur = x.vendeur,
       fournisseur_id = (select p.id from prestataire p
                          where upper(regexp_replace(p.raison_sociale, '[^A-Za-z0-9]', '', 'g')) = upper(regexp_replace(x.vendeur, '[^A-Za-z0-9]', '', 'g'))
                          limit 1)
  from vendeurs x
 where v.immatriculation = x.immatriculation
   and v.fournisseur is null;

-- ---------------------------------------------------------------------------
-- PARTIE 3 — ce qui reste.
-- ---------------------------------------------------------------------------

select (select count(*) from demande_achat where numero in ('DAC-R-00647', 'DAC-R-00377', 'DAC-R-00459')) as demandes_restantes,
       (select count(*) from vehicule where immatriculation like 'AB%K_' and valeur_acquisition = 19940000) as l200_a_19_940_000,
       (select count(*) from vehicule where valeur_acquisition is not null) as vehicules_valorises;

-- ============================================================================
-- SEDIMA Parc — le véhicule nommé dans le texte est rattaché à la dépense.
--
-- Demande du métier (14 septembre 2026) : « sur les dépenses de caisse et les
-- DA, extraire l'immatriculation du texte si disponible, et codifier le
-- véhicule affecté ».
--
-- Une dépense de caisse dit « Facture lavage AA 985 MR », une demande d'achat
-- « RÉPARATION DU VÉHICULE AA 565 GA » : le véhicule est là, écrit dans la
-- phrase. Sans rattachement, son coût n'entre pas dans l'analyse du véhicule —
-- l'arbitrage entre réparer et réformer se fait alors sur une partie des
-- charges seulement.
--
-- CE QUI EST FAIT. Pour les demandes d'achat (`DAC-R-%`) et les dépenses de la
-- caisse (`DEP-CP-%`) qui n'ont pas encore de véhicule : la première plaque du
-- texte est lue — deux lettres, trois ou quatre chiffres, une ou deux lettres,
-- avec ou sans séparateur — et le véhicule est rattaché **s'il existe au
-- référentiel**. Une plaque inconnue ne crée rien.
--
-- CE QUI NE CHANGE PAS. Le libellé, qui reste celui du document. Le montant.
-- Le bénéficiaire, sauf le « bénéficiaire non nommé » posé faute de véhicule :
-- il s'efface quand le véhicule est trouvé, la dépense restant traçable.
--
-- REJOUABLE : un second passage ne trouve plus rien à rattacher.
-- ============================================================================

/** La première plaque écrite dans un texte, sous sa forme canonique ; nulle s'il n'y en a pas. */
create or replace function plaque_du_texte(texte text) returns text
language sql immutable as $$
  select case when m is null then null else m[1] || m[2] || m[3] end
    from regexp_match(upper(coalesce(texte, '')), '\m([A-Z]{2})[ -]?([0-9]{3,4})[ -]?([A-Z]{1,2})\M') as m
$$;

comment on function plaque_du_texte(text) is 'La première immatriculation lue dans un texte libre — libellé de dépense, objet de demande d''achat.';

begin;

-- ---- Les demandes d'achat : l'objet nomme le véhicule ----
update demande_achat a
   set vehicule_id = v.id
  from vehicule v
 where a.numero like 'DAC-R-%'
   and a.vehicule_id is null
   and v.immatriculation = plaque_du_texte(a.objet);

-- ---- Les dépenses de la caisse parc : le libellé nomme le véhicule ----
update depense d
   set vehicule_id = v.id,
       beneficiaire = case when d.beneficiaire = 'Caisse parc — bénéficiaire non nommé' then null else d.beneficiaire end
  from vehicule v
 where d.numero like 'DEP-CP-%'
   and d.vehicule_id is null
   and v.immatriculation = plaque_du_texte(d.libelle);

-- ---- Le journal de caisse montre la plaque de la sortie ----
update mouvement_caisse m
   set beneficiaire = plaque_affichee(v.immatriculation)
  from depense d join vehicule v on v.id = d.vehicule_id
 where m.numero like 'CAI-CP-%'
   and m.depense_numero = d.numero
   and m.beneficiaire is null;

commit;

-- ---------------------------------------------------------------------------
-- Vérification : ce qui porte désormais un véhicule, et ce qui n'en a pas.
-- ---------------------------------------------------------------------------

select 'demandes d''achat' as lot, count(*) as lignes, count(vehicule_id) as avec_vehicule,
       count(*) filter (where vehicule_id is null and plaque_du_texte(objet) is not null) as plaque_hors_referentiel
  from demande_achat where numero like 'DAC-R-%'
union all
select 'dépenses de caisse', count(*), count(vehicule_id),
       count(*) filter (where vehicule_id is null and plaque_du_texte(libelle) is not null)
  from depense where numero like 'DEP-CP-%';

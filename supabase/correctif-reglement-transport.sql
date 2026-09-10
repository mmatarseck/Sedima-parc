-- ============================================================================
-- SEDIMA Parc — les bons de transport ne sont pas des dettes.
--
-- **Ce n'est pas une migration.** \`transport-02-prestations.sql\` posait, pour
-- chacun des bons de location et de transport, la date du bon de commande en
-- date de facture, et le numéro du bon en référence de facture, sans
-- règlement. Le tableau de bord en tirait **196 factures de prestataires à
-- régler, pour 552 M F** — trois ans de bons, de 2023 à 2026.
--
-- Un bon de commande n'est pas une facture, et l'extraction ne dit rien du
-- règlement. Un bon retenu dans les totaux de dépense est une dépense faite,
-- comme les bons de la maintenance : il passe **réglé**, sans date de facture
-- ni de règlement — elles ne sont pas connues. Le numéro du bon reste cité en
-- commentaire.
--
-- REJOUABLE : ne touche que les bons encore marqués facturés. À jouer après
-- la migration 0037.
-- ============================================================================

begin;

update prestation
   set statut = 'regle',
       date_facture = null,
       reference_facture = null,
       commentaire = 'Bon de commande ' || reference_facture || '. ' || coalesce(commentaire, '')
 where numero like 'PRS-R-%'
   and statut = 'facture'
   and date_reglement is null;

commit;

-- ---------------------------------------------------------------------------
-- Vérification : tous les bons chargés sont réglés, aucun n'a de date de facture.
-- ---------------------------------------------------------------------------

select statut, count(*) as bons, count(date_facture) as avec_date_facture, sum(montant_facture) as montant
  from prestation where numero like 'PRS-R-%' group by statut;

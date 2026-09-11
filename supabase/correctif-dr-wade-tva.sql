-- ============================================================================
-- SEDIMA Parc — Dr Wade Transport est au régime de la TVA.
--
-- **Ce n'est pas une migration.** Le métier, le 11 septembre 2026 : « la taxe
-- de 18 % est de la TVA ». Le registre des DA de septembre portait, sur la
-- facture de Dr Wade (DA200-2609134), une colonne « TVA » de 18 % retranchée du
-- hors taxe, comme une retenue. C'est une TVA : elle s'ajoute au hors taxe.
--
--   * le profil du transporteur passe au régime `tva` : ses coûts se lisent
--     hors taxe, et l'écran montre la TVA à part ;
--   * la demande d'achat garde son coût hors taxe (252 000 F) et dit ce qui est
--     à payer : 297 360 F TTC — le TTC du registre (206 640 F) était faux.
--
-- REJOUABLE.
-- ============================================================================

begin;

update profil_transporteur
   set regime_fiscal = 'tva'
 where prestataire_id = (select id from prestataire where numero = 'PRE-2026-00027')
   and regime_fiscal <> 'tva';

update demande_achat
   set commentaire_decision = commentaire_decision || ' TVA de 18 % confirmée par le métier le 11 septembre 2026 : 252 000 F HT + 45 360 F de TVA = 297 360 F TTC à payer ; le TTC du registre retranchait la TVA.'
 where numero = 'DAC-R-90004'
   and numero_demande_x3 = 'DA200-2609134'
   and commentaire_decision not like '%TVA de 18 % confirmée%';

commit;

select p.numero, p.raison_sociale, pt.regime_fiscal,
       (select commentaire_decision from demande_achat where numero = 'DAC-R-90004') as demande
  from prestataire p join profil_transporteur pt on pt.prestataire_id = p.id
 where p.numero = 'PRE-2026-00027';

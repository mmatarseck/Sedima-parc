-- ============================================================================
-- SEDIMA Parc — les demandes d'achat réelles : le registre de septembre 2026.
--
-- **Ce n'est pas une migration.** 6 DA qui demandent le paiement d'une facture
-- de transporteur. Source : LES DEMANDES D'ACHAT PARC.xlsx (SUIVI_PARC).
--
-- La facture est reçue : la demande est **facturée**, pour son montant hors
-- taxe, et devient une dette envers le transporteur. L'origine est la DA X3
-- elle-même : aucune transaction de l'application ne porte encore ces factures.
--
-- REJOUABLE : `on conflict do nothing`.
-- ============================================================================

insert into demande_achat (numero, date, objet, poste, montant_estime, prestataire_id, fournisseur, urgence, origine_numero, origine_libelle, demandeur_nom, etape, numero_demande_x3, montant_engage, montant_reel, commentaire_decision)
select v.numero, v.date::date, v.objet, 'divers', v.ht::bigint, p.id, v.fournisseur, 'normale', v.da, v.document, 'Gestion parc', 'facturee', v.da, v.ht::bigint, v.ht::bigint, v.commentaire
  from (values
  ('DAC-R-90001', '2026-09-08', 'FACTURE 2° MOUHAMED SY ET FRERES AOUT 2026', 2142000, 'PRE-2026-00029', 'Mouhamed Sy', 'DA200-2609089', 'FACTURE MOUHAMED SY ET FRERES AOUT 2026 2 EME_compressed.pdf', 'Chargée le 11 septembre 2026 depuis le registre des DA du parc (SUIVI_PARC). Registre des DA du parc : HT 2142000, TVA 107100, TTC 2034900 (le registre retranche la colonne TVA du HT).'),
  ('DAC-R-90002', '2026-09-10', 'FACTURE DAME NDOYE AOUT 2026', 1073550, 'PRE-2026-00030', 'Dame Ndoye', 'DA200-2609127', 'DAME NDOYE FACTURE AOUT 2026.pdf', 'Chargée le 11 septembre 2026 depuis le registre des DA du parc (SUIVI_PARC). Registre des DA du parc : HT 1073550, TVA 53677.5, TTC 1019872.5 (le registre retranche la colonne TVA du HT).'),
  ('DAC-R-90003', '2026-09-10', 'FACTURE 100/2026 MOUHAMED DEME AOUT', 1831573, null, 'Mouhamed Deme', 'DA200-2609129', 'FACTURE MOUHAMED DEME AOUT 2026 ABATTOIRS_compressed.pdf', 'Chargée le 11 septembre 2026 depuis le registre des DA du parc (SUIVI_PARC). Registre des DA du parc : HT 1831573, TVA 91578.65000000001, TTC 1739994.35 (le registre retranche la colonne TVA du HT). « DEM » : trois fiches possibles au référentiel (Dème Transport, Mohamed Deme, Mouhamed Deme) ; le fournisseur reste en clair.'),
  ('DAC-R-90004', '2026-09-10', 'FACTURE DR WADE TRANSPORT DE POUSSINS', 252000, 'PRE-2026-00027', 'Dr Wade Transport', 'DA200-2609134', 'FACTURE DR WADE N°004 FIN AOUT 2026.pdf', 'Chargée le 11 septembre 2026 depuis le registre des DA du parc (SUIVI_PARC). Registre des DA du parc : HT 252000, TVA 45360, TTC 206640 (le registre retranche la colonne TVA du HT). Date écrite 10/01/2026 au registre ; le numéro de la DA la place en 09/2026.'),
  ('DAC-R-90005', '2026-09-10', 'FACTURE K2SBT JUILLET ET AOUT 2026', 1020000, 'PRE-2026-00031', 'K2SBT', 'DA200-2609136', 'FACTURE K2SBT JUILLET ET AOUT 2026_compressed.pdf', 'Chargée le 11 septembre 2026 depuis le registre des DA du parc (SUIVI_PARC). Registre des DA du parc : HT 1020000, TVA -, TTC 1020000 (le registre retranche la colonne TVA du HT).'),
  ('DAC-R-90006', '2026-09-10', 'FACTURE JANV A JUIN 2026 - WAKEUR SERIGNE FALLOU', 7142100, 'PRE-2026-80007', 'Wakeur Serigne Fallou', 'DA200-2609139', 'FACTURE WAKEUR SERIGNE FALLOU EXERCICE 2026 - JANVIER A JUIN_compressed-1.pdf', 'Chargée le 11 septembre 2026 depuis le registre des DA du parc (SUIVI_PARC). Registre des DA du parc : HT 7142100, TVA 357105, TTC 6784995 (le registre retranche la colonne TVA du HT).')
  ) as v(numero, date, objet, ht, prestataire_numero, fournisseur, da, document, commentaire)
  left join prestataire p on p.numero = v.prestataire_numero
on conflict (numero) do nothing;

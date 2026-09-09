-- ============================================================================
-- SEDIMA Parc — 0026 : ce que le module Prestataires lit, en une requête.
--
-- Le référentiel des prestataires et, pour chacun, ce qu'il a fait avec le
-- parc : interventions, pleins, sorties de caisse, documents émis, visites
-- techniques, puis les deux faits que rien d'autre ne porte — les avances
-- versées et les évaluations de services (0002). Les demandes d'achat et le
-- transport tiers se lisent par leurs propres fonctions (`demande_achat`,
-- `lire_transporteurs()`), déjà à la forme du domaine : on ne les recopie
-- pas. Dans la lignée de lire_parc() (0009) : les faits bruts, chaque table
-- lue une fois, les règles au domaine — la dette se déduit, la note se
-- calcule (`assembler-prestataires.ts`).
--
-- Le prestataire est cité par sa clé quand la table la porte (interventions,
-- pleins, dépenses) ; les documents et les visites ne portent qu'un nom —
-- émetteur, centre —, l'application le rapproche du référentiel. Les pleins et
-- les dépenses se lisent depuis une date ; le reste sur toute la relation,
-- parce que l'ancienneté et les reprises se comptent sur tout l'historique.
--
-- La fonction s'exécute avec les droits de l'appelant : les politiques du
-- socle décident de ce que chacun voit.
-- ============================================================================

create or replace function lire_prestataires(depuis date)
returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'prestataires', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'numero', p.numero, 'raison_sociale', p.raison_sociale, 'type', p.type, 'contact', p.contact, 'telephone', p.telephone,
        'courriel', p.courriel, 'adresse', p.adresse, 'ville', p.ville, 'ninea', p.ninea, 'delai_paiement_jours', p.delai_paiement_jours,
        'actif', p.actif, 'note', p.note) order by p.numero), '[]'::jsonb)
      from prestataire p),
    'interventions', (select coalesce(jsonb_agg(jsonb_build_object(
        'numero', i.numero, 'prestataire_id', i.prestataire_id, 'date', i.date, 'type', i.type, 'objet', i.objet, 'montant', i.montant,
        'immobilisation_jours', i.immobilisation_jours, 'reference', i.reference,
        'immatriculation', (select v.immatriculation from vehicule v where v.id = i.vehicule_id))), '[]'::jsonb)
      from intervention i where i.prestataire_id is not null),
    'pleins', (select coalesce(jsonb_agg(jsonb_build_object(
        'numero', x.numero, 'prestataire_id', x.prestataire_id, 'source', x.source, 'date', x.date, 'litres', x.litres, 'prix_litre', x.prix_litre, 'montant', x.montant,
        'immatriculation', (select v.immatriculation from vehicule v where v.id = x.vehicule_id))), '[]'::jsonb)
      from plein x where x.date >= depuis and (x.prestataire_id is not null or x.source <> 'station')),
    'depenses', (select coalesce(jsonb_agg(jsonb_build_object(
        'numero', d.numero, 'prestataire_id', d.prestataire_id, 'date', d.date, 'libelle', d.libelle, 'montant', d.montant, 'poste', d.poste,
        'beneficiaire', d.beneficiaire, 'reference', d.reference, 'justificatif', d.justificatif,
        'vehicule', (select jsonb_build_object('immatriculation', v.immatriculation, 'business_unit', v.business_unit,
          'site', (select jsonb_build_object('libelle', s.libelle) from site s where s.id = v.site_id)) from vehicule v where v.id = d.vehicule_id))), '[]'::jsonb)
      from depense d where d.origine = 'caisse' and d.date >= depuis and (d.prestataire_id is not null or d.beneficiaire is not null)),
    'documents', (select coalesce(jsonb_agg(jsonb_build_object(
        'numero', c.numero, 'type_document_id', c.type_document_id, 'date_effet', c.date_effet, 'echeance', c.echeance, 'emetteur', c.emetteur,
        'numero_piece', c.numero_piece, 'montant', c.montant,
        'immatriculation', (select v.immatriculation from vehicule v where v.id = c.vehicule_id))), '[]'::jsonb)
      from document c where c.vehicule_id is not null and c.emetteur is not null),
    'visites', (select coalesce(jsonb_agg(jsonb_build_object(
        'numero', t.numero, 'type', t.type, 'centre', t.centre, 'date_rendez_vous', t.date_rendez_vous, 'date_passage', t.date_passage, 'statut', t.statut, 'numero_pv', t.numero_pv,
        'immatriculation', (select v.immatriculation from vehicule v where v.id = t.vehicule_id))), '[]'::jsonb)
      from visite_technique t),
    'avances', (select coalesce(jsonb_agg(jsonb_build_object(
        'numero', a.numero, 'prestataire_id', a.prestataire_id, 'date', a.date, 'montant', a.montant, 'motif', a.motif,
        'imputee_sur', a.imputee_sur, 'date_imputation', a.date_imputation, 'autorise_par', a.autorise_par)), '[]'::jsonb)
      from avance_prestataire a),
    'evaluations', (select coalesce(jsonb_agg(jsonb_build_object(
        'numero', e.numero, 'prestataire_id', e.prestataire_id, 'date', e.date, 'piece_numero', e.piece_numero, 'piece_libelle', e.piece_libelle,
        'qualite', e.qualite, 'delai', e.delai, 'prix', e.prix, 'commentaire', e.commentaire, 'auteur', e.auteur)), '[]'::jsonb)
      from evaluation_prestataire e)
  )
$$;

comment on function lire_prestataires(date) is 'Les faits bruts du module Prestataires : le référentiel, les interventions, pleins et dépenses de caisse rapportés à un prestataire, les documents émis et les visites techniques, les avances et les évaluations.';

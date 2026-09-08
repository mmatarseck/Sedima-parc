-- ============================================================================
-- SEDIMA Parc — 0021 : les politiques, intégrées aux requêtes.
--
-- La 0019 a fait pire (diagnostic du 8 septembre 2026 au soir : lire_parc()
-- 844 → 1 865 ms, lire_fiche() 242 → 1 897 ms). La leçon : une fonction SQL
-- n'est **intégrée** à la requête qui l'appelle que si son corps est une
-- expression simple, sans sous-requête. En écrivant « (select mon_role()) »
-- dans peut(), on l'a rendue opaque : appelée ligne par ligne, avec ses deux
-- lectures de profil à chaque fois. Et le sous-plan « in (select id from
-- vehicule) » lit les 129 véhicules — avec cette politique devenue chère —
-- à chaque sous-requête d'une fonction.
--
-- La forme juste :
--   * peut() et dans_mon_perimetre() sont des expressions simples, que
--     Postgres intègre ;
--   * les sous-requêtes qui hissent un calcul « une fois par lecture » sont
--     écrites **dans les politiques elles-mêmes**, où elles deviennent des
--     plans initiaux : « (select peut('flotte', 'lecture')) » et
--     « dans_perimetre((select mon_perimetre()), site_id, business_unit,
--     regime) » sur vehicule et chauffeur. Une lecture de véhicules coûte
--     alors une lecture de profil et une comparaison pure par ligne ;
--   * les tables de faits gardent « vehicule_id in (select id from
--     vehicule) » : un sous-plan haché, calculé une fois, sur des véhicules
--     désormais bon marché.
--
-- Mesuré dans PGlite avec un rôle non privilégié et les politiques actives
-- (tester-rls.mjs), ce que la 0019 n'avait pas fait.
-- ============================================================================

-- Expression simple, intégrable : le rôle et le niveau ne sont pas des
-- sous-requêtes ici — c'est la politique qui les hisse.
create or replace function peut(m text, minimum text) returns boolean
language sql stable as $$
  select mon_role() is not null and niveau_rang(mon_niveau(m)) >= niveau_rang(minimum)
$$;

create or replace function dans_mon_perimetre(s uuid, bu business_unit, r regime_usage) returns boolean
language sql stable security invoker as $$
  select dans_perimetre(mon_perimetre(), s, bu, r)
$$;

-- Les deux tables de référence : profil, niveau et périmètre lus une fois
-- par lecture, la règle pure comparée ligne par ligne.
drop policy if exists lecture_vehicule on vehicule;
create policy lecture_vehicule on vehicule for select using (
  (select peut('flotte', 'lecture')) and dans_perimetre((select mon_perimetre()), site_id, business_unit, regime)
);

drop policy if exists lecture_chauffeur on chauffeur;
create policy lecture_chauffeur on chauffeur for select using (
  (select peut('chauffeurs', 'lecture')) and dans_perimetre((select mon_perimetre()), site_id, null, null)
);

-- Les politiques qui ne dépendent d'aucune colonne : un plan initial, une fois.
drop policy if exists lecture_caisse on mouvement_caisse;
create policy lecture_caisse on mouvement_caisse for select using ((select peut('couts', 'lecture')));
drop policy if exists lecture_cuve on mouvement_cuve;
create policy lecture_cuve on mouvement_cuve for select using ((select peut('releves', 'lecture')));
drop policy if exists lecture_modification on modification;
create policy lecture_modification on modification for select using ((select mon_role()) is not null);
drop policy if exists lecture_sanction on sanction;
create policy lecture_sanction on sanction for select using ((select voit_sanctions()));

drop policy if exists lecture_demande on demande;
create policy lecture_demande on demande for select using (
  suis_destinataire(chauffeur_id, attributaire_id)
  or ((select peut('demandes', 'lecture')) and (select mon_role()) <> 'detenteur' and vehicule_id in (select id from vehicule))
);

drop policy if exists lecture_transfert on transfert;
create policy lecture_transfert on transfert for select using (
  suis_destinataire(remettant_chauffeur_id, remettant_attributaire_id)
  or suis_destinataire(recipiendaire_chauffeur_id, recipiendaire_attributaire_id)
  or ((select peut('transferts', 'lecture')) and (select mon_role()) <> 'detenteur' and vehicule_id in (select id from vehicule))
);

drop policy if exists lecture_ordre on ordre_travail;
create policy lecture_ordre on ordre_travail for select using (
  (select peut('maintenance', 'lecture')) and vehicule_id in (select id from vehicule)
);

-- ---------------------------------------------------------------------------
-- Le conducteur du jour, appelé pour chaque plein, relevé et dépense : sous
-- les politiques, chacun de ses appels relisait les affectations avec le
-- sous-plan des véhicules — 129 lignes à chaque fois, des milliers de fois
-- pour toutes les fiches (lire_fiches_chauffeurs() : 9 s dans PGlite). Il ne
-- rend qu'un identifiant de chauffeur, pour un véhicule que l'appelant voit
-- déjà : il lit sans politiques. Même texte qu'en 0015.
-- ---------------------------------------------------------------------------

create or replace function conducteur_du_jour(v uuid, jour date) returns uuid
language sql stable security definer set search_path = public as $$
  with titulaire as (
    select a.chauffeur_id from affectation a
     where a.vehicule_id = v and a.role = 'titulaire' and a.debut <= jour and (a.fin is null or a.fin >= jour)
     order by a.debut desc limit 1
  ),
  suppleant as (
    select a.chauffeur_id from affectation a
     where a.vehicule_id = v and a.role = 'suppleant' and a.debut <= jour and (a.fin is null or a.fin >= jour)
     order by a.debut desc limit 1
  ),
  titulaire_indisponible as (
    select exists (select 1 from indisponibilite i, titulaire t
                    where i.chauffeur_id = t.chauffeur_id and i.debut <= jour and (i.fin is null or i.fin >= jour)) as oui
  )
  select case
    when (select chauffeur_id from titulaire) is not null and not (select oui from titulaire_indisponible) then (select chauffeur_id from titulaire)
    when (select chauffeur_id from suppleant) is not null then (select chauffeur_id from suppleant)
    else (select chauffeur_id from titulaire)
  end
$$;

-- La fiche d'un chauffeur : les dépenses attribuées ne se cherchent plus dans
-- toute la table, seulement sur les véhicules qu'il a tenus — un chauffeur
-- n'est conducteur du jour que d'un véhicule où il est affecté. Même texte
-- qu'en 0015 pour le reste.
create or replace function lire_fiche_chauffeur(identifiant text, uuid_devine uuid default null)
returns jsonb
language sql stable
set search_path = public
as $$
  select case when c.id is null then null else jsonb_build_object(
    'chauffeur', to_jsonb(c),
    'site', (select jsonb_build_object('id', s.id, 'code', s.code, 'libelle', s.libelle, 'region', s.region, 'type', s.type) from site s where s.id = c.site_id),
    'documents', (select coalesce(jsonb_agg(jsonb_build_object('numero', d.numero, 'type_document_id', d.type_document_id, 'date_effet', d.date_effet, 'echeance', d.echeance, 'emetteur', d.emetteur, 'numero_piece', d.numero_piece, 'montant', d.montant, 'justificatif', d.justificatif) order by d.date_effet desc nulls last), '[]'::jsonb) from document d where d.chauffeur_id = c.id),
    'affectations', (select coalesce(jsonb_agg(jsonb_build_object('numero', a.numero, 'role', a.role, 'debut', a.debut, 'fin', a.fin, 'motif', a.motif,
                        'vehicule', jsonb_build_object('id', v.id, 'immatriculation', v.immatriculation, 'marque', v.marque, 'appellation', v.appellation, 'categorie', v.categorie, 'business_unit', v.business_unit, 'site', (select s.libelle from site s where s.id = v.site_id))) order by a.debut desc), '[]'::jsonb)
                      from affectation a join vehicule v on v.id = a.vehicule_id where a.chauffeur_id = c.id),
    'indisponibilites', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'numero', n.numero, 'motif', n.motif, 'debut', n.debut, 'fin', n.fin, 'commentaire', n.commentaire) order by n.debut desc), '[]'::jsonb) from indisponibilite n where n.chauffeur_id = c.id),
    'sanctions', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'numero', x.numero, 'date', x.date, 'type', x.type, 'motif', x.motif, 'jours', x.jours, 'incident_numero', (select i.numero from incident i where i.id = x.incident_id), 'depense_numero', (select d.numero from depense d where d.id = x.depense_id)) order by x.date desc), '[]'::jsonb) from sanction x where x.chauffeur_id = c.id),
    'incidents', (select coalesce(jsonb_agg(jsonb_build_object('numero', i.numero, 'nature', i.nature, 'type', i.type, 'date_heure', i.date_heure, 'lieu', i.lieu, 'mission', i.mission, 'responsabilite', i.responsabilite, 'statut', i.statut, 'blesses', i.blesses, 'sinistre_ouvert', i.sinistre_ouvert, 'immobilisation_jours', i.immobilisation_jours, 'kilometrage', i.kilometrage, 'description', i.description,
                     'vehicule', jsonb_build_object('id', v.id, 'immatriculation', v.immatriculation, 'marque', v.marque, 'appellation', v.appellation, 'site_id', v.site_id)) order by i.date_heure desc), '[]'::jsonb)
                   from incident i join vehicule v on v.id = i.vehicule_id where i.chauffeur_id = c.id),
    -- Ce que sa conduite a produit : sur les véhicules qu'il a tenus, les jours où il conduisait.
    'pleins', (select coalesce(jsonb_agg(jsonb_build_object('numero', p.numero, 'vehicule_id', p.vehicule_id, 'date', p.date, 'litres', p.litres, 'montant', p.montant, 'km', p.km) order by p.date desc), '[]'::jsonb)
                from plein p where p.vehicule_id in (select a.vehicule_id from affectation a where a.chauffeur_id = c.id)
                  and (p.chauffeur_id = c.id or (p.chauffeur_id is null and conducteur_du_jour(p.vehicule_id, p.date) = c.id))),
    'depenses', (select coalesce(jsonb_agg(jsonb_build_object('numero', x.numero, 'vehicule_id', x.vehicule_id, 'date', x.date, 'poste', x.poste, 'libelle', x.libelle, 'montant', x.montant, 'reference', x.reference, 'justificatif', x.justificatif) order by x.date desc), '[]'::jsonb)
                  from depense x where x.poste in ('contravention', 'frais-de-route')
                    and (x.chauffeur_id = c.id or (x.chauffeur_id is null and x.vehicule_id in (select a.vehicule_id from affectation a where a.chauffeur_id = c.id) and conducteur_du_jour(x.vehicule_id, x.date) = c.id))),
    'releves', (select coalesce(jsonb_agg(jsonb_build_object('vehicule_id', r.vehicule_id, 'date', r.date, 'km', r.km, 'origine', r.origine, 'valide', r.motif_rejet is null, 'attribue', conducteur_du_jour(r.vehicule_id, r.date) = c.id) order by r.date), '[]'::jsonb)
                 from releve_kilometrique r where r.vehicule_id in (select a.vehicule_id from affectation a where a.chauffeur_id = c.id))
  ) end
  from (select * from chauffeur ch where ch.id = uuid_devine or slug_chauffeur(ch.prenom, ch.nom) = identifiant limit 1) c
$$;

-- Après le seed : ce que chaque table doit compter, et ce qu'elle compte.
-- À coller dans le SQL Editor une fois seed-05.sql passé ; tout doit dire « ok ».
-- Les attendus sont ceux du générateur (npm run generer-seed) au 6 septembre 2026.
select t.nom as "table", t.attendu, r.n as "en base", case when r.n = t.attendu then 'ok' else 'ÉCART' end as etat
from (values
  ('site', 9), ('prestataire', 33), ('type_document', 8), ('vehicule', 129), ('chauffeur', 21),
  ('attributaire', 77), ('attribution_legere', 110), ('forfait_carburant', 34), ('vehicule_a_recevoir', 5),
  ('affectation', 17), ('document', 109), ('licence_transport', 2), ('licence_vehicule', 4),
  ('depense', 1103), ('plein', 460), ('releve_kilometrique', 615), ('intervention', 95),
  ('incident', 35), ('sanction', 9), ('indisponibilite', 18), ('parametre', 4),
  ('profil_transporteur', 13), ('chauffeur_tiers', 28), ('camion_tiers', 35), ('ligne_tarif', 71),
  ('rattachement_localite', 40), ('affretement', 84), ('mise_a_disposition', 72), ('prestation', 60),
  ('releve_transport', 2926), ('programme_entretien', 4), ('operation_entretien', 23),
  ('avance_prestataire', 4), ('evaluation_prestataire', 8), ('enveloppe', 27)
) as t (nom, attendu)
cross join lateral (
  select (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', t.nom), false, true, '')))[1]::text::int as n
) r
order by case when r.n = t.attendu then 1 else 0 end, t.nom;

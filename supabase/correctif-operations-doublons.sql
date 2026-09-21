-- SEDIMA Parc — les opérations d'entretien en double après 0062 (21 septembre 2026).
-- Le jeu de départ codait « leger:vidange-moteur », 0062 « leger.vidange-moteur » :
-- chaque opération existait deux fois. On garde la seconde, qui cite sa tâche du catalogue.
-- Les ajustements par véhicule suivent l'opération gardée. Rejouable.

update ajustement_entretien a
   set operation_code = replace(a.operation_code, ':', '.')
 where a.operation_code like '%:%'
   and exists (select 1 from operation_entretien o where o.code = replace(a.operation_code, ':', '.'))
   and not exists (select 1 from ajustement_entretien b where b.vehicule_id = a.vehicule_id and b.operation_code = replace(a.operation_code, ':', '.'));

delete from operation_entretien o
 where o.code like '%:%'
   and exists (select 1 from operation_entretien d where d.code = replace(o.code, ':', '.'));

select programme_code, count(*) as operations, count(*) filter (where tache_libelle is null) as sans_tache from operation_entretien group by programme_code order by programme_code;

-- ============================================================================
-- SEDIMA Parc — 0052 : une semi-remorque n'a pas d'énergie.
--
-- `energie` était obligatoire, avec « gasoil » par défaut. Les dix
-- semi-remorques du parc portaient donc « gasoil » — dix valeurs fausses, et
-- fausses de la même façon que les « 0 kg » des cartes grises : ce n'est pas un
-- zéro, c'est « sans objet ». Une remorque n'a pas de moteur (signalé par le
-- métier le 15 septembre 2026, « les plateaux par exemple sont sans énergie »).
--
-- Ce que ça change ailleurs : rien ne se calcule sur l'énergie d'une remorque —
-- elle ne fait pas de plein, elle n'a pas de barème. Ce qui l'affichait dira
-- « sans objet », ce qui est la vérité, plutôt que « Gasoil », qui est faux.
--
-- La colonne devient donc facultative, et les catégories sans moteur sont
-- remises à vide. Seule la semi-remorque est concernée : un engin de chantier a
-- un moteur, une moto aussi.
-- ============================================================================

alter table vehicule alter column energie drop not null;
alter table vehicule alter column energie drop default;

comment on column vehicule.energie is 'Nulle pour ce qui n''a pas de moteur — une semi-remorque. « Gasoil » y serait une valeur inventée.';

update vehicule set energie = null where categorie = 'semi-remorque' and energie is not null;

-- Ce que la migration a remis à vide, à relire après exécution.
select categorie::text as categorie, count(*) filter (where energie is null) as sans_energie, count(*) as total
  from vehicule group by categorie order by categorie;

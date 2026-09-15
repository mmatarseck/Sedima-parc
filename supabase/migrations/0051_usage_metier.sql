-- ============================================================================
-- SEDIMA Parc — 0051 : l'usage ajouté par le métier.
--
-- Le 15 septembre 2026, le métier a demandé de pouvoir écrire dans les listes
-- déroulantes et, quand la valeur n'y est pas, de la créer — en citant l'usage
-- du véhicule.
--
-- `usage` est une énumération : onze valeurs livrées, et l'application ne peut
-- pas en ajouter une douzième depuis un formulaire. Même situation que la
-- catégorie en septembre (0006), et même réponse : les valeurs livrées
-- deviennent des **familles**, un usage ajouté par le métier se garde à part
-- dans `usage_metier` — un identifiant « usa-… » qui renvoie au paramètre.
--
-- UNE DIFFÉRENCE AVEC LA CATÉGORIE, ET ELLE COMPTE. La catégorie porte des
-- règles : documents exigés des poids lourds, plafond kilométrique, programme
-- d'entretien. C'est pourquoi une catégorie ajoutée doit déclarer sa famille —
-- sans quoi l'application ne saurait pas quoi lui appliquer.
--
-- L'usage, lui, ne commande rien : c'est une étiquette qui dit ce que le
-- véhicule transporte — vrac, frigorifique, plateau. Rien dans le domaine ne
-- s'y branche. Un usage ajouté se range donc sous la famille « autre » sans
-- qu'on demande quoi que ce soit à l'agent, et l'écran affiche le libellé
-- qu'il a écrit. Demander une famille pour une étiquette serait une question
-- sans conséquence, et les questions sans conséquence finissent par être
-- répondues au hasard.
-- ============================================================================

alter table vehicule add column if not exists usage_metier text check (usage_metier is null or usage_metier like 'usa-%');

comment on column vehicule.usage_metier is 'Usage ajouté dans Paramètres › Véhicules (« usa-… ») ; la famille reste dans usage, qui ne porte aucune règle.';

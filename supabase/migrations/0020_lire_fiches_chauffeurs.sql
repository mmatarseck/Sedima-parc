-- ============================================================================
-- SEDIMA Parc — 0020 : toutes les fiches chauffeurs en une requête.
--
-- Le classement d'un chauffeur (score SQDCM du mois révolu, rang parmi ses
-- pairs) et la moyenne des kilomètres de la cohorte comparent les fiches
-- entre elles : il faut les lire toutes. Une fonction rend d'un coup ce que
-- lire_fiche_chauffeur() (0015) rend pour un seul, chauffeur par chauffeur,
-- avec son identifiant d'adresse — la page assemble et classe avec les
-- mêmes calculs qu'en démonstration.
--
-- Elle s'exécute avec les droits de l'appelant : seuls les chauffeurs de son
-- périmètre y sont, et le classement se fait parmi eux.
-- ============================================================================

create or replace function lire_fiches_chauffeurs()
returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'identifiant', slug_chauffeur(c.prenom, c.nom),
    'fiche', lire_fiche_chauffeur(slug_chauffeur(c.prenom, c.nom), c.id)
  ) order by c.nom, c.prenom), '[]'::jsonb)
  from chauffeur c
$$;

comment on function lire_fiches_chauffeurs() is 'Toutes les fiches chauffeurs du périmètre en un JSON, pour le classement et les moyennes de la cohorte.';

-- ============================================================================
-- SEDIMA Parc — 0045 : les plaques s'écrivent avec des tirets.
--
-- Décision du métier (11 septembre 2026) : « les nouveaux matricules sont
-- formatés XX-YYY-ZZ, les anciens XX-YYYY-ZZ. Mettre à jour toute la base. »
--
-- CE QUI NE CHANGE PAS. La clé : `vehicule.immatriculation`, les camions tiers,
-- les livraisons rattachées gardent la forme canonique, sans séparateur
-- (« AB060KT »). C'est elle que les pleins, les bons, les livraisons et les
-- adresses des fiches (/flotte/AB060KT) citent, et toute saisie, avec espaces
-- ou tirets, s'y ramène. Les libellés recopiés des documents sources — bons de
-- commande, factures, bons de livraison — gardent l'écriture du document.
--
-- CE QUI CHANGE.
--
--   * `plaque_affichee()` rend « AB-060-KT », « DK-4923-BB », « TH-8174-K » ;
--   * les textes que l'application a écrits avec une plaque à espaces passent
--     au tiret : le sujet des notifications, la plaque libre du relevé de
--     transport, les commentaires des véhicules, des attributions et des
--     véhicules à recevoir.
--
-- REJOUABLE : un texte déjà au tiret ne bouge plus.
-- ============================================================================

create or replace function plaque_affichee(immat text) returns text
language sql immutable as $$
  select case
    when immat ~ '^[A-Z]+[0-9]+[A-Z]*$' then rtrim(regexp_replace(immat, '^([A-Z]+)([0-9]+)([A-Z]*)$', '\1-\2-\3'), '-')
    else immat
  end
$$;

comment on function plaque_affichee(text) is 'La plaque telle qu''elle s''affiche : « AB060KT » → « AB-060-KT », « DK4923BB » → « DK-4923-BB ».';

/** Les plaques à espaces d'un texte libre, passées au tiret : « Remplace DK 5679 BL » → « Remplace DK-5679-BL ». */
create or replace function plaques_en_tirets(texte text) returns text
language sql immutable as $$
  select regexp_replace(texte, '\m([A-Z]{2}) ([0-9]{3,4}) ([A-Z]{1,2})\M', '\1-\2-\3', 'g')
$$;

comment on function plaques_en_tirets(text) is 'Réécrit au tiret les plaques « AA 032 EA » d''un texte écrit par l''application.';

update notification set sujet_libelle = plaques_en_tirets(sujet_libelle)
 where sujet_libelle ~ '\m[A-Z]{2} [0-9]{3,4} [A-Z]{1,2}\M';

/* La plaque libre du relevé : écrite à la volée, elle prend la forme affichée. */
update releve_transport set immatriculation_libre = plaque_affichee(regexp_replace(upper(immatriculation_libre), '[^A-Z0-9]', '', 'g'))
 where immatriculation_libre ~* '^\s*[A-Z]{1,3}[\s-]*[0-9]{3,4}[\s-]*[A-Z]{0,2}\s*$'
   and immatriculation_libre is distinct from plaque_affichee(regexp_replace(upper(immatriculation_libre), '[^A-Z0-9]', '', 'g'));

update vehicule set commentaire = plaques_en_tirets(commentaire)
 where commentaire ~ '\m[A-Z]{2} [0-9]{3,4} [A-Z]{1,2}\M';

update attribution_legere set commentaire = plaques_en_tirets(commentaire)
 where commentaire ~ '\m[A-Z]{2} [0-9]{3,4} [A-Z]{1,2}\M';

update vehicule_a_recevoir set commentaire = plaques_en_tirets(commentaire)
 where commentaire ~ '\m[A-Z]{2} [0-9]{3,4} [A-Z]{1,2}\M';

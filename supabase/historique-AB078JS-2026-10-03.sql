-- Historique de DK-2348-BD reporté sur sa nouvelle plaque AB-078-JS (3 octobre 2026).
--
-- Même véhicule réimmatriculé (carte grise, confirmé par le métier le 3 octobre
-- 2026 : « AB »). Les deux fiches existent depuis le 14 septembre — l'ancienne
-- close (« sorti »), la nouvelle active —, mais l'historique est resté sur
-- l'ancienne : 2 pleins, 6 interventions, 8 dépenses. On le rattache à
-- AB-078-JS ; DK-7485-BK → AB-364-HK n'a rien à reporter.
--
-- Rejouable : un second passage ne trouve plus rien à déplacer.

begin;

update plein set vehicule_id = (select id from vehicule where immatriculation = 'AB078JS')
 where vehicule_id = (select id from vehicule where immatriculation = 'DK2348BD');
update intervention set vehicule_id = (select id from vehicule where immatriculation = 'AB078JS')
 where vehicule_id = (select id from vehicule where immatriculation = 'DK2348BD');
update depense set vehicule_id = (select id from vehicule where immatriculation = 'AB078JS')
 where vehicule_id = (select id from vehicule where immatriculation = 'DK2348BD');

commit;

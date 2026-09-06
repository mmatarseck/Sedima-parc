-- Le premier administrateur. Avant de jouer ce fichier : Authentication ›
-- Users › « Invite user » avec l'adresse du gestionnaire. Le compte existe
-- alors dans auth.users ; ici, on lui donne son rôle — sans recopier d'UUID.
--
-- Remplacer l'adresse et le nom, puis coller dans le SQL Editor.
insert into profil (utilisateur_id, nom, role)
select id, 'Prénom Nom', 'administrateur'
from auth.users
where email = 'adresse@sedima.sn'
on conflict (utilisateur_id) do update set role = 'administrateur', actif = true
returning utilisateur_id, nom, role;

-- Si la réponse est vide, l'adresse ne correspond à aucun compte invité.

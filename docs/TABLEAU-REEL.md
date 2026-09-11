# Le tableau de bord sur les données réelles

*10 septembre 2026.*

Six chargements réels sont entrés en une journée : carburant, maintenance,
transport, kilométrages et conformité. Chacun avait été vérifié seul. Personne
n'avait encore regardé ce que le tableau de bord en tirait **ensemble**.

`scripts/rapport-tableau-reel.mts` le regarde. Il monte une base à l'état de la
production (migrations, seed, purge, puis tous les chargements dans l'ordre) et
assemble les données comme la page. Il imprime ensuite chaque pastille et chaque
courbe, avec en regard la couverture mois par mois. Ce n'est pas un banc, c'est
une photographie, à relancer après chaque chargement.

La première photographie montrait un parc à l'arrêt, une caisse pleine et
552 M F de dettes. Rien de cela n'était vrai.

## Ce qui mentait, et ce qui est dit maintenant

| Pastille ou courbe | Avant | Après |
| --- | ---: | ---: |
| Hors service | 47 / 47 engagés | 18 / 47 |
| Prêts à charger | 0 | 25 |
| Immobilisés administrativement | 47 | 16 |
| Véhicules non conformes (courbe mensuelle) | 47 chaque mois | de 9 à 16 |
| Caisse parc | 1 500 kF | — |
| Autonomie de la cuve | « 9 000 l en cuve » | — |
| Factures tiers à régler | 196, pour 552 208 kF | 0 |

### 1. Une pièce jamais saisie n'est pas une pièce manquante

La carte grise est critique et exigée de tous les véhicules. Le parc n'en a
enregistré **aucune**. Chaque véhicule était donc déclaré « carte grise
manquante », puis immobilisé administrativement : toute la flotte, tous les
mois.

L'absence de saisie n'est pas l'absence du document. **Un type dont le parc
n'a aucune pièce n'est pas encore suivi** : il n'est ni signalé manquant, ni
immobilisant.

Le calcul passe par un seul prédicat, `exigeDocument`. Quand il répond « non
exigé », la liste du parc, la fiche, la Conformité, les rapports, le téléphone
et le tableau de bord cessent tous ensemble d'annoncer la pièce. Le serveur
calcule ce qui est suivi depuis les données, par `types_document_suivis()`
(0037). La fonction SQL `situation_journaliere` applique la même règle à ses
critères.

Types non suivis aujourd'hui : **carte grise, certificat de salubrité, carte
de transport, permis, visite médicale**. L'écran Paramètres › Documents le dit
sur chaque ligne concernée.

> **À savoir avant de saisir la première carte grise.** Dès qu'une pièce d'un
> type existe, la règle s'applique à tous. Une seule carte grise saisie rendra
> les 46 autres véhicules « carte grise manquante », et donc immobilisés. Il
> faut charger les cartes grises en bloc, ou rendre le type non critique le
> temps de la saisie.

Le banc `tester-zeros-sans-mesure` vérifie la règle sur le jeu de départ. Il
efface toutes les cartes grises, puis compare les véhicules immobilisés à ceux
qu'on obtient en rendant la carte grise non critique : **109 contre 109**, et
non 151.

### 2. La courbe mensuelle jugeait sans les licences

La lecture du tableau (`lire_tableau`, 0024) rend les documents des véhicules,
pas les licences de transport. La non-conformité du mois gardait pourtant la
licence dans ses types exigés : elle la trouvait manquante chaque mois, et
tout poids lourd sortait non conforme.

La courbe s'intitule « VT ou assurance échue », et la fonction SQL ne juge que
les pièces portées par le véhicule. Le calcul mensuel fait maintenant de même.
Son dernier mois (16) retombe sur le compte du jour (16).

### 3. Un solde reporté n'est pas un solde

La caisse affichait 1 500 kF et la cuve 9 000 l. Ce sont le solde reporté et le
stock de départ du jeu de démonstration, restés dans `parametre`, alors
qu'aucun mouvement de caisse ni de cuve n'existe. Sans mouvement, la fonction
rend désormais un champ nul, la pastille dit « — », et le serveur ne se replie
plus sur le paramètre. Le seuil, qui est un réglage, reste affiché.

### 4. Un bon de commande n'est pas une facture impayée

Le chargement du transport posait la date du bon en date de facture, et son
numéro en référence, sans règlement. Trois ans de bons, de 2023 à 2026,
passaient ainsi pour une dette de 552 M F.

L'extraction ne dit rien du règlement. Un bon retenu dans les totaux de dépense
est une dépense faite, comme les bons de la maintenance. Il est donc rangé
**réglé**, sans date de facture ni de règlement, et son numéro reste cité en
commentaire. La fonction cesse aussi de compter comme « à régler » une ligne
réglée dont la date de règlement manque.

Le banc reconstruit le fichier tel qu'il a été joué et lui applique le
correctif. Le résultat est identique, ligne à ligne, au nouveau chargement, et
le correctif est rejouable.

## À jouer en production

1. `supabase/migrations/0037_zeros_sans_mesure.sql`
2. `supabase/correctif-reglement-transport.sql`

Tant que 0037 n'est pas jouée, l'application ne tombe pas : faute de
`types_document_suivis()`, tous les types restent suivis, comme avant.

## Ce qui reste vrai, même si c'est rouge

- **16 véhicules immobilisés administrativement** : visite technique échue (29
  sur 113) ou assurance absente. C'est la fiche de suivi 2026.
- **47 véhicules sans relevé depuis 7 jours** : le dernier relevé kilométrique
  chargé date d'août.
- **Carburant « — », dernier relevé le 31/07** : le dossier s'arrête là (0036).

## Les limites connues, que le tableau ne peut pas encore dire

- **Disponibilité à 100 %, immobilisation moyenne à 0** — *corrigé le
  11 septembre 2026 (migration 0040).* Les 298 interventions reprises des bons
  ne disent pas combien de jours le véhicule est resté au garage, et le
  chargement avait écrit zéro. La colonne accepte désormais l'inconnu, et ces
  zéros passent à nul. La disponibilité d'un mois sort « — » tant qu'une
  réparation curative du mois n'a pas de durée. La durée moyenne au garage ne
  porte que sur les durées connues. De janvier à août 2026, les deux
  indicateurs disent « — » : c'est la vérité, le parc ne sait pas.
- **Respect du plan préventif à 100 %** — *corrigé le 11 septembre 2026, sans
  migration.* L'indicateur ne regardait que les kilomètres restants de la
  première échéance : sans compteur, rien n'était jamais en retard. Il
  appliquait en plus l'état du jour à tous les mois passés, dont le plan ne
  garde pas l'historique. Désormais, l'état d'un véhicule se juge sur toutes
  ses opérations :
  - **en retard** dès qu'une opération l'est ;
  - **à jour** seulement si chaque opération a un passage relevé ;
  - **inconnu** sinon.

  Il ne se lit que sur la période en cours, et le taux sort « — » tant qu'un
  véhicule engagé est d'état inconnu. Sur les données réelles :

  | Véhicules engagés | Nombre |
  | --- | ---: |
  | En retard | 10 |
  | Sans retard connu, mais avec des opérations sans passage | 2 |
  | Sans aucun passage relevé | 35 |

  293 opérations sur 307 n'ont pas de passage relevé, et 46 véhicules n'ont pas
  de compteur récent. Le rapport imprime ce décompte sous « PLAN D'ENTRETIEN ».
- **Accidents, pannes, contraventions et absentéisme à 0.** Aucune source n'a
  été chargée. L'état des véhicules en panne du dossier DO ne porte aucune
  date.
- **Coût du transport à la tonne.** Le relevé de tonnage est chargé depuis le
  11 septembre 2026, du 15 juin au 3 septembre ; seuls les mois qu'il couvre en
  entier portent une valeur, et le coût à la tonne des tiers reste à prendre
  avec précaution. Voir `docs/RELEVE-TRANSPORT-REEL.md`.
- **Indisponibilité des véhicules spéciaux à 144 en septembre.** Elle suit les
  statuts du jour, sans historique avant la reprise : le chiffre porte sur les
  seuls jours écoulés depuis.

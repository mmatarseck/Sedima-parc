# Les demandes d'achat réelles

*11 septembre 2026.*

Le métier : « sur le dernier fichier Excel partagé, on y trouve toutes les DA sur
plusieurs mois. Préparer et charger ». La table `demande_achat` (0022) était vide
depuis la purge.

## Les sources

- **`SEDIMA_Maintenance_Parc_Bons_de_commande.xlsx`**
  - C'est l'extraction des 694 bons de commande du dossier DO, de novembre 2023 à
    septembre 2026.
  - Chaque bon cite la DA interne qui l'a demandé (« DA17595 », « DA200-2510034 »).
- **`LES DEMANDES D'ACHAT PARC.xlsx`** (SUIVI_PARC)
  - C'est le registre tenu depuis septembre 2026.
  - Il contient six DA qui demandent le paiement de factures de transporteurs.

## Ce qui est chargé

`supabase/achats-parties/`, deux fichiers.

**`achats-01-bons-de-commande.sql`** : **679 demandes**, une par bon retenu, du
16 novembre 2023 au 2 septembre 2026, pour 1 381 M F TTC.

| Famille | Bons | Montant |
| --- | ---: | ---: |
| Maintenance & réparation | 430 | 405 M F |
| Location & transport | 225 | 587 M F |
| Administratif & divers | 22 | 49 M F |
| Acquisition de véhicules (dont les 15 pick-up) | 2 | 340 M F |

- **Sources des DA** : 645 DA distinctes. Six ont donné deux bons, soit deux
  demandes qui citent la même DA, et le commentaire le dit. 28 bons ne citent pas
  de DA.
- **Bons écartés** : 13 doublons exclus des totaux par l'extraction elle-même,
  et 2 bons en euros.

**`achats-02-registre-septembre.sql`** : **6 demandes**, pour 13 461 223 F HT.

## L'étape : réglée

Un bon retenu dans les totaux est une dépense faite. C'est la règle déjà appliquée
aux bons de la maintenance et du transport (`correctif-reglement-transport.sql`).
Chaque demande est donc **réglée**, sans date de règlement, car elle n'est pas connue.

Sinon, sept cents demandes de 2023 à 2026 pèseraient sur le budget comme autant
d'engagements en cours. L'engagé du budget ne compte que les demandes commandées
et non réglées, et la dette envers un prestataire que les demandes livrées ou
facturées : aucune des 679 n'y entre.

## Le rattachement

Il se fait **en base**, par le numéro du bon. Les chargements de la maintenance ont
été régénérés depuis leur premier passage : seule la base sait quels numéros elle
porte.

| La demande retrouve… | Demandes | Avec dépense |
| --- | ---: | ---: |
| l'intervention chargée depuis le même bon | 298 | 298 |
| la prestation de transport | 196 | — |
| la dépense de frais de mission | 25 | 25 |
| rien : elle cite le bon lui-même | 160 | — |

- **Montants** : la dépense citée porte toujours le montant du bon, sans aucun
  écart.
- **Les 160 demandes sans ligne d'origine** : les frais administratifs, les
  acquisitions, le carburant, et les bons de maintenance dont la plaque n'est
  pas au parc.

## Le registre de septembre : six factures à payer

La facture est reçue : la demande est **facturée**, pour son montant hors taxe, et
devient une dette envers le transporteur.

| DA | Transporteur | HT |
| --- | --- | ---: |
| DA200-2609089 | Mouhamed Sy | 2 142 000 |
| DA200-2609127 | Dame Ndoye | 1 073 550 |
| DA200-2609129 | Mouhamed Deme (en clair) | 1 831 573 |
| DA200-2609134 | Dr Wade Transport | 252 000 |
| DA200-2609136 | K2SBT | 1 020 000 |
| DA200-2609139 | Wakeur Serigne Fallou | 7 142 100 |

- **Colonne « TVA » du registre** : pour quatre transporteurs, c'est la retenue de
  5 % (BRS), retranchée du HT. Pour Dr Wade, c'est une **TVA de 18 %** (confirmé
  par le métier le 11 septembre 2026) : elle s'ajoute au HT, soit 297 360 F TTC à
  payer, et non les 206 640 F du registre. `correctif-dr-wade-tva.sql` passe son
  profil au régime TVA et l'écrit sur la demande.
- **Dr Wade** : le registre date sa DA du 10 janvier 2026. Son numéro
  (DA200-**2609**134) la place en septembre, et c'est cette date qui est retenue.

## À trancher par le métier

- **« DEM »** a trois fiches possibles au référentiel : Dème Transport
  (PRE-2026-00026), MOHAMED DEME (PRE-2026-80001), MOUHAMED DEME (PRE-2026-80015).
  La facture reste en clair tant qu'elles ne sont pas fondues.
- **Wakeur Serigne Fallou facture janvier à juin 2026**, alors que les bons de
  location de la période sont chargés « réglés » (règle ci-dessus). Si ces mois
  n'étaient pas payés, la règle est fausse pour lui.

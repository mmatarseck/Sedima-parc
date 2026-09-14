# Les pneus du parc, un par un

*14 septembre 2026.*

La table `pneu` (0029) était vide : l'écran Pièces annonçait « 0 monté », et la
charge pneumatique d'un véhicule ne se lisait que dans ses dépenses. La gestion
du parc suit pourtant chaque montage, dans deux classeurs du dossier DO.

## Les sources

| Classeur | Période | Ce qu'il donne |
| --- | --- | --- |
| `FICHE SUIVI 2026/SUIVI PNEUS ET MONTAGES 2025.xlsx` | 2025 → août 2026 | Deux feuilles (légers, lourds) : véhicule, dimension, quantité, prix unitaire, bon, demande d'achat, fournisseur, date de montage |
| `PNEUS RECEPTIONNES ET MONTAGES.xlsx` | 2024 | Une feuille par bon de commande : pneus reçus, puis véhicules montés et dates |

## Ce qui est chargé

`supabase/pneus-parties/pneus-01-montages.sql` : **410 pneus montés sur 72
véhicules**, du 10 février 2024 au 8 août 2026 pour les montages datés.

| Dimension | Pneus |
| --- | ---: |
| 315/80R22.5 | 47 |
| 13R22.5 | 40 |
| 7.50R16 | 38 |
| 11R22.5 | 36 |
| 385/65R22.5 | 30 |
| 205R16 | 27 |
| 225/75R16 | 20 |
| *Dimension non relevée* | 46 |

**Un pneu par pneu.** Une ligne « AA-565-GA · 11 R 22,5 · 6 » devient six pneus :
c'est la maille de la table et celle du suivi d'usure. Chacun dit son rang dans
la commande, son bon, sa demande d'achat, son fournisseur et son prix unitaire.

**Les écritures du métier sont lues telles quelles.** « 315/80 R22,5 PNEU
TOLEDO », « 11R/ 22.5 », « 205/ R 16 C 110/108 », « 7.50R16 » donnent
315/80R22.5, 11R22.5, 205R16, 7.50R16. La marque n'est nommée que sur 60 pneus
(Toledo, Double Road, Sportrak, Aplus, Grenlan) ; ailleurs elle reste vide.

**Une commande sert plusieurs véhicules**, et le classeur n'écrit son bon, son
fournisseur, sa date et sa désignation que sur une ligne : elles sont propagées
aux lignes suivantes, que le même prix unitaire rattache à la même commande.

## Ce qui n'est pas chargé

- **La position sur le véhicule, le compteur à la pose, le numéro de série** ne
  sont pas suivis : ils restent vides plutôt qu'inventés. Un pneu déposé ne se
  distingue donc pas encore d'un pneu en service.
- **46 pneus sans dimension** : onze lignes du classeur n'en donnent aucune. Ils
  portent « Dimension non relevée », et non une dimension supposée.
- **Trois montages de 2024 sans véhicule nommé** : le classeur compte les pneus
  montés sans dire sur quoi.
- **Cinq plaques hors référentiel** : DK 3674 AX, DK 7621 BG, DK 4280 AS,
  AB 098 JC, DK 6241 BM — 12 pneus en tout. À trancher : anciennes plaques,
  véhicules d'une autre entité, ou véhicules à créer.

## À jouer

```
supabase/pneus-parties/pneus-01-montages.sql
```

Après les véhicules manquants, dont trois portent des pneus.

Banc : `scripts/tester-pneus-reels.mts`.

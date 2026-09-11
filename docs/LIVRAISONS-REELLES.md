# Les livraisons réelles, par véhicule

*11 septembre 2026.*

Le métier : « préparer aussi les données de livraison et associer aux différents
véhicules ». Sage X3 écrit, sur chaque bon de livraison, la plaque du camion et le
nom du chauffeur. La migration **0044** ouvre la table `livraison`, un bon par
ligne, et la fiche de chaque véhicule gagne un onglet **Livraisons** : les bons
mois par mois (bons, jours, tonnage, clients), puis la liste des bons.

## Les sources

| Source | Période | Sites |
| --- | --- | --- |
| `EXTRACTION_YLIV 2026 ALL.xlsx` | 1er janvier → 8 juillet 2026 | UAB, minoterie, abattoir |
| `ETAT LIVRAISONS MENSUELLES AOUT 2026.xlsx` | 3 → 31 août 2026 | UAB |
| `LIVRAISON NOVEMBRE 2025.xlsx`, `SITUATION LIVRAISONS DECEMBRE 2025.xlsx` | novembre et décembre 2025 | UAB |

Les états mensuels UAB de janvier à mai 2026 sont tirés de l'extraction YLIV :
tous leurs bons y sont. Ils ne sont pas rechargés et servent de contrôle.

**Sans source :** 2025 avant novembre (`LIVRAISONS 2025.xlsx` n'a ni plaque ni
chauffeur), et du 9 juillet au 2 août 2026.

## Ce qui est chargé

`supabase/livraison-parties/` : six fichiers, **16 771 bons**, du 3 novembre 2025 au
31 août 2026. Seuls les bons qui portent une plaque sont gardés.

| Rattachement | Bons | Véhicules |
| --- | ---: | ---: |
| Véhicule du parc | 4 504 | 48 |
| Camion d'un transporteur | 7 571 | 42 |
| Transporteur reconnu au libellé seul | 897 | — |
| Enlèvement par le client | 2 372 | — |
| Plaque hors référentiel, libellé muet | 1 427 | — |

L'UAB livre 12 000 à 17 000 t par mois, la minoterie 3 300 à 4 500 t et
l'abattoir 100 à 180 t.

## Le poids : l'extraction compte en sacs

L'extraction YLIV compte en **unités de stock**. Une ligne « KG » d'aliment y
compte des sacs. Les états mensuels, tirés d'elle, donnent la conversion, ligne
à ligne sur 3 753 lignes :

- ×50 pour les aliments volaille ;
- ×40 pour les aliments ruminants et bétail ;
- ×1 pour le vrac, le maïs, le tourteau et le son.

La minoterie écrit la taille du sac dans la désignation (« BAGUEDOR 50KG »).
L'abattoir compte ses kilos en kilos, et ses poulets à l'unité, que leur calibre
pèse. Aucun camion ne charge plus de 45 t : une ligne qui les dépasserait était
déjà en kilos.

**Contrôle :**

| Mois | Bons communs | Tonnes chargées / tonnes de l'état |
| --- | ---: | ---: |
| Janvier 2026 | 1 238 | 11 212 / 11 209 t (100 %) |
| Mai 2026 | 1 435 | 13 219 / 13 356 t (99 %) |

Les 100 bons dont aucune ligne ne se pèse (unités sans calibre) gardent un poids **nul**,
jamais zéro. L'onglet compte ces bons à part.

## Le rattachement

Il se fait **en base**, au moment de l'insertion, par la plaque :

1. un véhicule du parc ;
2. sinon un camion tiers et le transporteur à qui il appartient ;
3. sinon le libellé du bon.

Les préfixes du libellé ont été vérifiés sur les camions connus qu'ils conduisent :

| Préfixe | Transporteur | Bons vérifiés |
| --- | --- | --- |
| AK/ | Abdou Kane | 2 826 |
| AD/ | Abdou Dieng | 589 |
| MD/, SD/ | Sokhna Diop | 270 |
| MK/ | Moussa Kane | — |
| DW/ | Dr Wade | 1 000 |
| ADEX/ | ADEX | 2 265 |

Les variantes de « lui-même » et d'« enlèvement » disent que le client est venu
chercher sa marchandise.

**Huit plaques mal tapées** sont corrigées sur 398 bons, preuve à l'appui. La plaque du bon reste
écrite dans `immatriculation_source` :

| Plaque du bon | Plaque retenue | Preuve |
| --- | --- | --- |
| DL 7179 E, DL 7179 EC | DK 7179 E | camion d'Abdou Dieng, transporteur du bon |
| DL 3970 E | DK 3970 E | « DL » n'est pas une série |
| AB 292 FX | AA 292 FX | camion d'Abdou Dieng |
| AB 118 CB, AB 118 GB | AA 118 CB | même chauffeur, même flotte |
| AA 271 ZW | AA 271 LW | même chauffeur |
| AA 277 BL | AB 277 BL | camion d'Abdou Kane |

Le relevé de transport n'est pas touché. Il reste la source des tonnes du tableau
de bord : un voyage porte plusieurs bons, et les deux mailles ne s'additionnent pas.

## À trancher par le métier

- **Les camions de Moussa Kane sont rattachés à un autre transporteur.**
  - Au référentiel, AA 118 CB, AA 772 AZ, AA 271 LW, AB 975 FC, AB 934 HW et
    AB 161 HM appartiennent à PRE-2026-00025 (« Abdou K. Diop », la ligne AUTRES
    du relevé).
  - Or plus de 700 bons les attribuent à Moussa Kane (« MK/ »), et l'état d'août
    aussi.
  - Les livraisons suivent le référentiel tant qu'il n'est pas corrigé.
- **DK 4430 AB** est écrit « DJILY » dans l'état d'août ; le référentiel le
  rattache à la même ligne AUTRES.
- **Des plaques qui livrent beaucoup sont absentes du référentiel.**
  - Surtout à la minoterie : AA 275 QA (1 507 t), AA 361 MZ (1 043 t), AA 006 JZ,
    AA 304 LN, AA 929 KE.
  - Chez Abdou Kane : AB 380 DH (375 bons), AA 280 ST (250 bons), DK 0071 AU.
  - Chez Sokhna Diop : TH 8202 F.
  - Camions de clients, ou camions tiers à ajouter ?
- **Juillet et le début d'août 2026** : une extraction YLIV à jour compléterait la
  période.

# Le magasin de pièces, à ses premières matières

*14 septembre 2026.*

Les tables `piece` et `mouvement_stock` (0029) étaient vides : l'écran Pièces
n'avait rien à montrer, et la consommation de pièces d'un véhicule ne se lisait
nulle part. La gestion du parc en suit pourtant deux, au classeur.

## Les sources

| Classeur | Période | Ce qu'il donne |
| --- | --- | --- |
| `FICHE SUIVI 2026/SUIVI BATTERIES.xlsx` | fév. 2025 → juil. 2026 | Trois feuilles : `Feuil1` « BATTERIES PL 2025 - 2026 », une ligne par montage (quantité, prix unitaire, bon, demande, date) ; `BC17695`, la campagne de février 2025 — 20 batteries 150 AH et 10 de 100 AH reçues, puis remises véhicule par véhicule ; `NOUVELLES DEMANDES`, les besoins exprimés |
| `FICHE SUIVI 2026/FICHE SUIVI DISQUE TATA.xlsx` | août 2025 | « 5 DISQUE PLATEAU BITE ACHETE A TATA SUR BC18812 », et les montages faits dessus |

**Les bons étaient déjà au référentiel**, chargés le 11 septembre depuis les
bons de commande du dossier DO. Ils donnent ce que les classeurs taisent — la
date, le fournisseur, la demande d'achat :

| Bon | Date | Fournisseur | Objet |
| --- | --- | --- | --- |
| BC17695 / DA20021 | 4 févr. 2025 | ETS MALEYE | « …ET BATTERIES POUR LES PNEUS LOURDS ET LEGERS DU PARC » |
| BC18521 / DA20846 | 3 juil. 2025 | SICAS | « BATTERIE 100AH ; BATTERIE 150AH » |
| BC18812 / DA21232 | 29 août 2025 | TATA INTERNATIONAL / UNITECH | « ACHAT DISQUE, PLATEAU ET BUTEE POUR LES TATA LPT1618 EN GUISE DE RESERVE » |

C'est le dernier qui tranche la lecture de « DISQUE PLATEAU BITE » : un **kit
d'embrayage** — disque, plateau, butée —, donc `transmission` et non
`freinage`, et une unité en `jeu` et non en pièce.

## Ce qui est chargé

`supabase/pieces-parties/` : **3 pièces** et **58 mouvements**, du 4 février
2025 au 1ᵉʳ juillet 2026, sur **26 véhicules**.

| Référence | Pièce | Prix de référence | Stock déduit |
| --- | --- | ---: | ---: |
| BAT-150AH | Batterie 150 AH | 162 148 F | 1 |
| BAT-100AH | Batterie 100 AH | 100 061 F | 0 |
| EMB-TATA-1618 | Kit d'embrayage Tata LPT 1618 | 307 862 F | 3 |

20 entrées, 36 sorties toutes rattachées à leur véhicule, 2 régularisations.

**L'entrée est déduite du montage.** Le magasin n'était pas tenu : les
classeurs suivent l'achat et la pose, pas le stock. Une batterie montée est
pourtant une batterie achetée, puis sortie. Chaque montage de `Feuil1` produit
donc son entrée à la même date, du même nombre, portant le prix, le bon et la
demande quand la ligne les donne — et son motif le dit. Sans quoi le stock
déduit serait négatif, ce qui serait un plus gros mensonge qu'une entrée datée
du jour de la pose.

**Les deux campagnes, elles, disent leur quantité reçue** — 20 + 10 batteries
sur BC17695, 5 jeux Tata sur BC18812 — et les remises les suivent. Ce qui
reste après les remises est un vrai stock : la 20ᵉ batterie 150 AH de la
campagne de février 2025 n'a jamais été remise, et trois jeux Tata attendent
encore, achetés « en guise de réserve ».

**La date se propage vers le bas**, comme pour les pneus : le classeur est tenu
par bloc et dans l'ordre, et n'écrit la date que là où elle change. 14 lignes
sont datées de la dernière date connue de leur bloc, et leur motif le dit.

**Le stock ne passe jamais par un négatif**, à aucune date et pour aucune
pièce : le banc le vérifie sur le cumul ligne à ligne.

## Ce qui n'est pas chargé

- **Les 15 demandes de la feuille `NOUVELLES DEMANDES`** : des besoins
  exprimés, pas des mouvements. Cinq portent une date d'achat (AA 633 JL,
  AA 768 JV, AA 093 VA, DK 9839 BK, DK 6875 BF, AA 769 PA) sans qu'on sache si
  elles ont été servies. À rapprocher avec le métier avant de les charger,
  comme demandes d'achat ou comme mouvements.
- **Aucun seuil de réapprovisionnement** : les classeurs n'en donnent pas, et
  un minimum inventé déclencherait de fausses demandes d'achat. Les trois
  pièces sont donc « épuisée » ou « à jour », jamais « sous le seuil », tant
  que le gestionnaire n'a pas posé ses minima.
- **Deux plaques hors référentiel** : DK 4003 BG (2 batteries 150 AH, montage
  du 14 janvier 2026) et DK 3674 AX (1 batterie 100 AH, campagne BC17695).
  DK 3674 AX portait déjà des pneus hors référentiel. À trancher : anciennes
  plaques, véhicules d'une autre entité, ou véhicules à créer.
- **Un montage Tata sans véhicule nommé** : le classeur compte le jeu posé sans
  dire sur quoi.

Les trois derniers cas ne laissent pas de pièce fantôme au magasin. Le montage
de DK 4003 BG disparaît **avec son entrée** — elles allaient par paire. Les
deux autres sortent d'une campagne dont l'entrée vaut pour tout le bon et ne
peut pas s'annuler : ils deviennent des **régularisations** d'écart négatif,
qui nomment la plaque ou son absence. C'est à cela qu'une régularisation sert.

- **Le prix unitaire des six derniers montages** (avril à juillet 2026) : le
  classeur ne le porte plus. La valeur indicative retombe sur le prix de
  référence de la pièce.
- **Le montant du bon BC17695** ne se rapporte pas aux seules batteries : il
  couvre aussi 12 pneus. Il n'est donc porté sur aucune entrée.

## À jouer

```
supabase/pieces-parties/pieces-01-referentiel.sql
supabase/pieces-parties/pieces-02-mouvements.sql
```

Dans cet ordre, après `maintenance-parties/maintenance-01-prestataires.sql`
— qui porte SICAS, ETS MALEYE et TATA INTERNATIONAL / UNITECH — et après
`vehicules-manquants.sql`.

Fabriqué par `scripts/charger-batteries.mts`. Banc :
`scripts/tester-pieces-reelles.mts`.

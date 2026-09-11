# Les caractéristiques des véhicules, et les véhicules qui manquaient

*11 septembre 2026.*

Le référentiel ne portait ni date de mise en circulation, ni puissance, ni
cylindrée, ni masses : l'onglet Caractéristiques de chaque fiche disait « — ». La
gestion du parc tient ces valeurs dans `MALICK/FICHE COMPLET VEHICULES PARC
LIVRAISONS ET PERSONNELS.xlsx` (10 septembre 2026), recopiées des cartes grises.
La même fiche nommait 21 plaques inconnues de l'application. Le métier : « créer
les véhicules manquants ».

## À jouer, dans l'ordre

1. `supabase/vehicules-manquants.sql` — les véhicules créés, la plaque corrigée,
   les attributions, les lots reçus.
2. `supabase/caracteristiques-vehicules.sql` — les caractéristiques de tous les
   véhicules, ceux-ci compris, et les kilométrages du 8 juillet.
3. `supabase/correctif-dr-wade-tva.sql` — sans rapport avec les véhicules : Dr Wade
   passe au régime TVA (voir `ACHATS-REELS.md`).

## Les caractéristiques

**152 véhicules complétés.**

| Champ | Véhicules |
| --- | ---: |
| Mise en circulation, immatriculation, type | 149 |
| Puissance, cylindrée | 146 |
| PTAC, charge utile | 98 |
| Poids à vide | 97 |
| PTRA | 7 |

**Ce qui n'est pas chargé :**

- **Un champ déjà rempli n'est jamais écrasé**, à une exception près.
  L'alignement avait posé la mise en circulation au « 1er janvier » de l'année du
  plan d'affectation. La carte grise donne le jour : elle remplace cette date
  quand l'année concorde. Au banc, 47 dates au 1er janvier deviennent 3.
- **Un zéro de la feuille n'est pas une mesure.** Le PTRA vaut 0 sur 143 lignes :
  il reste inconnu.
- **Quatre dates impossibles restent vides** :
  - AA 285 PT : immatriculation illisible ;
  - AA 053 AP : mise en circulation en 2029 ;
  - DK 9046 AT : immatriculation en 2029 ;
  - AA 139 HP : mise en circulation après l'immatriculation.

**32 kilométrages du 8 juillet 2026** entrent comme relevés (`REL-FC-…`). Deux sont
écartés, parce qu'ils feraient reculer le compteur :

| Véhicule | Km au 8 juillet | Relevé postérieur |
| --- | ---: | --- |
| AA 403 JG | 86 000 | 84 000 km le 27 juillet |
| AA 386 JG | 160 000 | 141 000 km le 13 août |

## Les 21 plaques inconnues

### 17 véhicules créés

Chacun avec sa décision écrite dans `scripts/charger-vehicules-manquants.mts`.

| Plaques | Véhicule | BU · régime · statut | Détenteur |
| --- | --- | --- | --- |
| AB 060 KT | Mitsubishi L200 DC neuf | siège · service · en service | Yacine Siby |
| AB 062 KT | idem | commercial · fonction | Maimouna Gaye (remplace DK 5679 BL) |
| AB 112 KT | idem, **Lot 2 - 06 reçu** | commercial · service | Amacodou Ndiaye |
| AB 010 KT | idem, **Lot 2 - 11 reçu** | commercial · service | pool « recrutement Sud 2 » |
| AB 066 KT | idem, **Lot 2 - 13 reçu** | commercial · service | pool « recrutement Zone Nord 2 » |
| AB 178 KR, AB 180 KR, AB 181 KR, AB 938 KQ | Camions Sinotruk ZZ1168 neufs | aliment · exploitation · en mutation | — |
| AA 542 BQ | Tracteur Renault Premium, ferme de Djilakh | fermes · exploitation · hors service | — |
| AA 507 BQ | Semi-remorque benne Schmitz | fermes · exploitation · en service | — |
| AB 361 JL | Camion Howo ZZ3317N | fermes · exploitation · en service | — |
| AB 364 HK | Peugeot 5008 | siège · service · en service | non affectée |
| DK 4923 BB, DK 0099 BD | Renault Duster, Hyundai ix35 | siège · service · hors service | — |
| AA 866 YH | Toyota Prado du Directeur général | siège · fonction · en service | attributaire à créer |
| AA 372 WJ | Scooter Suzuki Burgman | commercial · service · en service | Babacar (Teral Shop) |

Les attributaires et les lots viennent du plan d'affectation des véhicules légers
(« Cascade vf », 9 septembre).

### Une plaque corrigée

**AB 930 BB devient AB 930 BV.** La carte grise, l'assurance, l'attestation 2026 et
la fiche l'écrivent ainsi. Le véhicule garde son identifiant, donc toute son
histoire et son attribution.

### Trois coquilles de la fiche

Elles sont rattachées aux véhicules existants et ne sont pas créées :

| Écrit dans la fiche | Véhicule existant | Preuve |
| --- | --- | --- |
| AA 783 SN | AA 783 BN | carte grise et licence |
| AA 078 JS | AB 078 JS | carte grise, même détenteur |
| DK 6875 DF | DK 6875 BF | ancienne écriture (`plaque-dk6875.sql`) |

## À trancher par le métier

- **AB 077 FP**
  - La fiche le décrit comme un autocar Force Motors Traveller à Notto.
  - La carte grise du dossier est nommée AB 077 BP, et le référentiel porte
    AA 077 FP (bus Tata du personnel de Notto).
  - Rien n'est créé tant que la plaque n'est pas sûre.
- **AB 066 KT ou AB 056 KT** : la fiche écrit la première, le plan d'affectation
  la seconde.
- **AA 372 WJ ou AA 372 YJ** : la fiche écrit la première, l'assurance la seconde.
- **Le Prado du DG** n'a pas d'attributaire au référentiel.
- **Les lots 2 - 07 et 2 - 09** restent « à recevoir ». Or le plan donne à leurs
  détenteurs (Amadou Yoro Ba, Pape Bouba Gaye) des véhicules déjà au parc
  (AB 611 KP, AB 622 KP). Ces lots sont probablement à fermer.

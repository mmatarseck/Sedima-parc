# Ce que disent les cartes grises

*14 septembre 2026.*

Le chargement des caractéristiques du 11 septembre tirait ses valeurs d'un
**tableur recopié** des cartes grises. Les originaux, eux, sont dans
`MALICK/CARTE GRISE VEHICULES` — 90 PDF et 12 `.docx`, **tous des scans**, sans
la moindre couche de texte. Ils ont été lus.

## Comment

Les pages sont des JPEG embarqués (`DCTDecode`, parfois sous une couche Flate) :
`pdf-lib`, déjà au projet pour les étiquettes QR, les sort du PDF ; les `.docx`
les portent dans `word/media`. 200 images en sont sorties. Elles ont ensuite été
**lues à l'œil, une par une**, le 14 septembre 2026.

Il n'y a donc pas d'extraction à relancer : la lecture est le tableau
`CARTES` de `scripts/charger-cartes-grises.mts`, et c'est là qu'on la corrige.

## Ce que la carte grise sénégalaise porte

Au recto : l'immatriculation, la date de 1ʳᵉ mise en circulation, la date
d'immatriculation, le titulaire, **l'immatriculation précédente** — et c'est
elle qui rattache un véhicule à son passé.

Au verso : le genre, la carrosserie, le VIN, l'énergie, la cylindrée, le PTRA,
le poids à vide, la catégorie, la marque, l'appellation commerciale, le type,
la puissance, les places assises, le PTAC, la charge utile.

**Ce qu'elle ne porte pas**, et qu'il ne faut pas venir y chercher : la capacité
du réservoir, la valeur d'acquisition, le site de rattachement.

## Ce qui est chargé

`supabase/cartes-grises.sql` : **48 valeurs sur 41 véhicules**, sur les
42 cartes lues.

| Colonne | Valeurs posées |
| --- | ---: |
| VIN | 40 |
| 1ʳᵉ mise en circulation | 3 |
| Type, PTAC, poids à vide, charge utile, date d'immatriculation | 1 chacun |

Le chiffre est petit, et c'est une bonne nouvelle : **la recopie du 11 septembre
était presque parfaite.** Sur ~240 valeurs confrontées, quatre seulement
divergent. Le gros du butin est ailleurs — les VIN.

## Les VIN de la démonstration étaient fabriqués

`vinDemo()` de `src/donnees/parc-demo.ts` invente un numéro de châssis pour
chaque véhicule du jeu de départ : trois lettres de constructeur et quatorze
caractères tirés d'un hachage de l'immatriculation. Sa note l'annonçait —
« l'inventaire de référence apportera les vrais ».

**55 des 56 VIN du référentiel en venaient.** Seul AA-032-EA en portait un vrai.

La fonction étant déterministe, on la rejoue pour reconnaître un VIN inventé à
coup sûr :

- **5 sont remplacés** par celui de leur carte grise (AA 053 AP, AA 214 XK,
  AA 359 AH, AA 713 VE, AB 551 HS) ;
- **35 autres cartes** en apportent un là où la case était vide ;
- **50 sont effacés**, faute de carte au dossier. Un numéro de châssis est ce
  qu'on donne à l'assureur, au constructeur, à la police : faux, il est pire
  que vide, parce que rien ne dit qu'il l'est. Vide, la fiche demande qu'on le
  saisisse. Aucune information n'est perdue — ces chaînes se recalculent depuis
  l'immatriculation, et c'est bien ce qui prouve qu'elles n'en portaient aucune.

Le référentiel passe donc de 56 VIN dont 55 faux à **41 VIN, tous vrais**.

## Les quatre écarts à trancher

La carte grise est la source primaire ; la base n'est pas écrasée pour autant.
Ces quatre-là sont à arbitrer :

| Véhicule | Champ | Base | Carte grise |
| --- | --- | --- | --- |
| AA 139 HP | Date d'immatriculation | 2022-08-03 | **2022-06-03** |
| AA 541 JD | Puissance | 5 CV | **10 CV** |
| AA 713 VE | Poids à vide | 31 000 kg | **6 000 kg** |
| AB 364 HK | Type / modèle | 0ERHES | **0ERHE8** |

Trois ressemblent à des fautes de recopie : un mois lu 08 pour 06, un `S` pour
un `8`, et pour AA 713 VE le poids à vide qui a pris la valeur de la charge
utile — 31 000 kg à vide pour une semi-remorque dont le PTAC est 37 000, c'est
impossible. Le quatrième (5 CV au lieu de 10) est du même ordre.

## Ce que les cartes ont appris d'autre

- **AB 077 FP.** Le fichier s'appelle « AB 077 BP », mais la carte et sa
  vignette écrivent toutes deux **AB-077-FP**. Le référentiel porte AA 077 FP :
  c'est la première paire de lettres qui est fausse, pas la dernière. La
  question posée le 11 septembre (`REPRISE.md`, point 3) est tranchée.
- **AB 098 JC** est un véhicule de SEDIMA sans fiche. Sa carte porte la raison
  sociale complète — « Sénégalaise de Distribution de Matériel Avicole » —,
  ex-DK 1306 BB, 1ʳᵉ mise en circulation le 20/06/2016. La plaque portait déjà
  des pneus chargés le 14 septembre : **à créer**.
- **DK 2348 BD** n'est pas un second véhicule : même numéro de série que
  AB 078 JS (HH006910). C'est le même pick-up avant son changement de plaque.
- **AA 205 VH** appartient à « S P I - SARL », pas à SEDIMA. Sa carte est au
  dossier ; le véhicule n'est pas au parc. Rien à créer.
- **Les immatriculations précédentes** relevées : AA 139 HP ex-DK 6633 AX,
  AA 507 BQ ex-BQ 096 CN, AA 235 MR ex-DK 3140 BC, AB 930 BV ex-140H07893
  (plaque d'importation). Elles peuvent aider à rattacher des dépenses
  anciennes restées sur l'ancienne plaque.

## Ce qui n'est pas chargé

- **Le VIN de AA 909 CW** : la carte elle-même écrit `XXXXXXXXXXXXXX090`. Le
  document l'ignore ; l'application aussi.
- **Le VIN de AA 507 BQ** : masqué par la vignette de visite technique collée
  sur la carte. À relever sur le véhicule.
- **Les zéros** : une voiture particulière porte « 0 kg » en PTAC, poids à vide
  et charge utile ; une remorque porte « 0 CV » et « 0 cm3 ». C'est « sans
  objet », pas une valeur — 52 zéros écartés.
- **Les licences de transport** (17 fichiers) et l'assurance du dossier : elles
  relèvent des documents du véhicule, pas de ses caractéristiques.

## À jouer

```
supabase/cartes-grises.sql
```

Après `aligner-referentiel.sql`, `vehicules-manquants.sql` et
`caracteristiques-vehicules.sql`, tous déjà joués.

Fabriqué par `scripts/charger-cartes-grises.mts`. Banc :
`scripts/tester-cartes-grises.mts`.

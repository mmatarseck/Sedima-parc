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

## Le document lui-même

Lire les cartes grises en tire les caractéristiques ; c'est la moitié du
travail. L'autre moitié met **le scan dans la fiche** : un clic depuis l'onglet
Conformité ouvre la carte grise du véhicule, au lieu d'aller la chercher sur le
partage DO.

Un véhicule a souvent deux fichiers — recto et verso — et la fiche n'a qu'une
pièce jointe par document. Les pages sont donc remontées en **un seul PDF, dans
l'ordre**. Les douze `.docx` du dossier, où quelqu'un a collé deux photos dans
un document Word, se traitent pareil : sans quoi douze véhicules resteraient
sans pièce.

Le réemballage allège l'enveloppe mais **ne recompresse pas** : sans
bibliothèque d'images, Node ne sait pas réencoder un JPEG. Un scan de 217 Ko
sort à 217 Ko, un de 7 Mo sort à 7 Mo.

État du dossier : **75 plaques, 157 pages, 74 PDF déposables** pour 23,9 Mo.

Dépôt du 14 septembre 2026 : **71 documents créés**.

- **AA-032-EA** sort à 7,1 Mo, au-delà des 5 Mo du seau. Il n'est ni tronqué ni
  déposé de force : il est nommé au compte rendu, à alléger puis à déposer à la
  main.
- **AA-205-VH** est au dossier mais pas au parc (voir plus haut) : sa carte
  n'est rattachée à rien.

### Trois noms de fichiers qui mentent

Le nom d'un scan n'est pas une source : c'est ce que quelqu'un a tapé en le
rangeant. Le dépôt en a démasqué trois, tranchés en relisant la carte à
l'écran — la carte fait foi :

| Nom du fichier | Ce que la carte porte | Ce qu'il fallait en faire |
| --- | --- | --- |
| `CARTE GRISE AA 093 VAA` | **AA-093-VA** | Un A de trop. Le véhicule est au parc ; sa pièce lui revient, et son VIN aussi — voir plus bas. |
| `CARTE GRISE AA 903 JW` | **AB-903-JW** | Doublon du scan déjà nommé correctement, pas un second véhicule. |
| `CARTE GRISE AB 077 BP` | **AB-077-FP** | Un autocar Force Motors absent du référentiel — question ouverte, voir plus bas. |

La confusion AA/AB revient deux fois sur trois : les deux séries coexistent au
Sénégal et se ressemblent à l'œil. La correspondance est écrite dans
`scripts/scans-cartes-grises.mts`, pour qu'une réexécution les rattache.

### Le VIN perdu d'AA 093 VA

La faute de frappe a coûté deux choses à ce véhicule, pas une : sa pièce, et
ses caractéristiques. La lecture des cartes ne l'a pas trouvé, l'a rangé parmi
les cinquante véhicules sans carte grise, et lui a effacé son VIN fabriqué. Il
en avait pourtant une : Tata LPT1618 frigorifique, VIN **MAT449375K2L00007**,
première mise en circulation le 24/05/2019, ex-`DK 6241 BM`.

```
supabase/correctif-carte-grise-aa093va.sql
```

À jouer après `cartes-grises.sql`. La cylindrée de la carte (5886 cm3)
**contredit** les 5883 déjà en base : l'écart est signalé, pas écrasé.

### AB-077-FP, un véhicule qui n'est pas au parc

Carte grise au nom de SEDIMA, première mise en circulation le 02/01/2026 :
autocar **Force Motors Traveller Super T2**, 24 places, gazole, 3245 cm3,
10 CV, PTAC 5750 kg, VIN `MC1E4FGD4SP023754`, immatriculé à Dakar.

Le référentiel ne le connaît pas. Il porte en revanche un **AA-077-FP** —
mêmes chiffres, même suffixe, préfixe différent — décrit comme « Tata Airforce,
bus du personnel de Notto ». Vu que la confusion AA/AB est attestée deux fois
dans ce même dossier, et que « Force Motors » figure au catalogue des marques
avec un « Autocar 24 places », il est **probable** que ce soit le même bus.
Mais la carte le donne neuf de 2026, alors que le parc tient AA-077-FP pour un
bus en service : rien n'est écrit tant que le métier n'a pas tranché.

### Ce qu'il faut pour déposer

Deux variables d'environnement, jamais écrites dans le dépôt :

```
SUPABASE_URL                 l'adresse du projet
SUPABASE_SERVICE_ROLE_KEY    la clé de service
```

La clé de service passe outre les politiques RLS : elle n'a rien à faire dans
un navigateur, et ce script est la seule raison de la sortir.

```
npx tsx scripts/attacher-cartes-grises.mts              (essai à blanc)
npx tsx scripts/attacher-cartes-grises.mts --deposer    (dépôt réel)
```

Sans `--deposer`, le script dit ce qu'il ferait et s'arrête. Il est rejouable :
un véhicule qui porte déjà une carte grise **avec** sa pièce est sauté, un
véhicule qui en porte une **sans** pièce se voit compléter plutôt que doubler.

Migration à jouer d'abord : `supabase/migrations/0049_pieces_pdf.sql`, qui
laisse entrer le PDF dans le seau `pieces` — et rien d'autre : ni ZIP, ni Word,
ni exécutable. Le plafond de 5 Mo reste.

Lecture et recomposition vivent dans `scripts/scans-cartes-grises.mts`, que le
banc `scripts/tester-attachement-cartes.mts` rejoue sur tout le dossier sans
toucher à la base.

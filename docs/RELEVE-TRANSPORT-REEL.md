# Le relevé de transport réel

*11 septembre 2026.*

Le tableau de bord ne savait rien des tonnes. Il n'avait ni part confiée aux
tiers, ni coût du transport à la tonne, ni taux d'externalisation au tonnage.
La table `releve_transport` était vide depuis la purge.

## La source

`RECAP TONNAGE HEBDOMMADAIRE.28.2.xlsx`, tenu par la Direction des Opérations.
Le module Transporteurs a été conçu sur ce relevé : une ligne par camion, un
tonnage et une destination par jour, SEDIMA traité comme un transporteur parmi
les autres. Deux copies existent, dans `61. Gestion Parc/JACQUES SUIVI TONNAGE
LIVRAISON` et `62. Transport & Flotte Automobile`, et elles se lisent à
l'identique. C'est celle du dossier 62 qui est chargée.

L'extraction Sage X3 des livraisons (`EXTRACTION_YLIV 2026 ALL.xlsx`, 67 683
lignes) a été examinée puis écartée. Elle compte 6 015 t seulement en kilos sur
six mois ; le reste est exprimé en palettes, sacs et unités. Les deux tiers de
ses lignes n'ont pas d'immatriculation. Elle dit ce qui a été vendu et livré,
pas avec quel camion.

## Ce qui est chargé

`supabase/releve-parties/`, quatre fichiers à jouer dans l'ordre :

| | Voyages | Tonnes |
| --- | ---: | ---: |
| Parc SEDIMA | 132 | 2 147 |
| Transporteurs | 947 | 22 663 |
| **Total, du 15 juin au 3 septembre 2026** | **1 079** | **24 810** |

Les tiers portent **91 %** des tonnes relevées ; la cible du référentiel est de
35 % au plus. Les transporteurs sont A. Dieng, A. Kane, ADEX, Dr Wade, Sokhna
Diop, et la ligne « AUTRES », que le profil du transporteur PRE-2026-00025
rattache déjà au relevé.

## Le total de la feuille n'est pas une vérité

Chaque semaine se termine par une ligne « TONNAGE JOURNALIER ». La lecture la
compare, jour par jour, à ce qu'elle a retenu.

- **De juin au 30 juillet**, les feuilles ne contiennent **aucune formule** :
  les totaux sont tapés à la main. Dix-neuf jours s'écartent du détail des
  cellules, souvent d'un voyage entier (40 t).
- **À partir du 31 juillet**, le total est un `SUM`. Or Excel ignore les
  cellules tapées en texte, comme « 40T ». Les trois jours en écart s'expliquent
  exactement ainsi, et c'est la feuille qui sous-compte.

Le chargement suit donc le détail des cellules, pas les totaux.

## Ce que la lecture a dû trancher

- **Les jours n'ont pas de date**, seulement un nom, et une semaine peut
  commencer un vendredi. La date se déduit du titre de la semaine et du nom de
  chaque colonne. La feuille « SEM DU 05 AU 10 JUIL » commence par un LUNDI,
  alors que le 5 juillet est un dimanche : **le nom du jour l'emporte**, et la
  semaine est datée du 6 au 11.
- **Des tonnages mal tapés** sont lus : « 10T,5 » donne 10,5 t, « 15T,20 » donne
  15,2 t. D'autres cellules ne sont pas des tonnages et sont laissées de côté :
  « INVENTAIRE MENSUEL », « FERIE », et « TAIBA » (une destination tombée dans la
  colonne du tonnage).
- **L'origine** n'est pas écrite. Ce sont des livraisons d'aliment au départ de
  l'usine : origine « UAB », produit « aliment ».
- **La destination** manque sur 28 voyages. La table l'exige ; la ligne porte
  alors « Non précisée », plutôt qu'une destination inventée.

## Les plaques

- Les camions SEDIMA doivent être des véhicules du parc. **AA 197 JG** n'y
  figure pas : son unique voyage (2,35 t) est écarté.
- Deux coquilles sont corrigées, avec leur preuve :
  - AA 105 VE est le **AA 105 VA** du parc : même chauffeur, Djibril Ndoye,
    attitré à ce camion ;
  - AA 383 JZ est le **AA 383 GZ** d'A. Dieng : même chauffeur, Ibra Gueye.
- **Onze camions de transporteurs** manquaient au référentiel tiers : ils
  reviennent chaque semaine au relevé. Chacun est ajouté et rattaché au
  transporteur dont il porte les voyages, avec la capacité que la feuille écrit
  le plus souvent : DK 7179 E, AA 292 FX et AA 313 CT (A. Dieng) ; TH 3166 D,
  TH 7181 B et TH 5341 G (A. Kane) ; DK 4430 AB, AB 934 HW et AB 161 HM
  (AUTRES) ; DK 9374 AX (Dr Wade) ; TH 8174 K (Sokhna Diop). Le banc vérifie que
  chaque voyage d'un camion tiers cite bien le transporteur à qui ce camion
  appartient.
- **« AA700 »** est tronqué, et Dr Wade a deux camions qui commencent ainsi. Il
  reste en immatriculation libre : on ne choisit pas à la place du relevé.
- Trois voyages de transporteur n'ont pas de plaque ; ils sont gardés, sans
  camion.

## Ce que le tableau de bord en tire

- **Part confiée aux tiers** (pastille, 7 jours). La feuille de la semaine du
  4 septembre est vide. Sans correction, la pastille aurait affiché
  « 0 t sur 7 j ». La migration **0038** rend la date du dernier voyage relevé,
  et la pastille dit « dernier relevé le 03/09 », comme la pastille Carburant
  depuis 0036.
- **Les courbes au tonnage ne portent que des mois entièrement relevés**
  (`releveCouvre`). Rapporter les coûts de tout juin aux tonnes de la seconde
  quinzaine doublait le coût à la tonne. Le mois en cours a de même des coûts
  jusqu'à aujourd'hui, mais des tonnes jusqu'au 3 septembre seulement. Juin et
  septembre sortent donc « — ». Le taux d'externalisation retombe alors sur sa
  base en coût, qui est annoncée comme telle, exactement comme pour janvier à
  mai. En tonnes, il vaut **92,5 % en juillet** et **87,9 % en août**.

## Les limites connues

- **Le coût à la tonne des tiers n'est pas encore fiable** : 606 F/t en
  juillet, 1 259 F/t en août, contre des tarifs de 2 500 à 3 500 F/t. Son
  numérateur vient des bons de commande, datés à leur émission, souvent un mois
  ou plus après le service. Le mois du coût et le mois des tonnes ne se
  recouvrent pas.
- **Le coût à la tonne du parc** rapporte les charges de toute la flotte,
  véhicules légers compris, aux seules tonnes des camions du relevé. Et le
  carburant d'août manque (la source s'arrête au 31 juillet).
- **Un trou au milieu d'une période ne se voit pas.** La semaine du 7 au
  13 août ne compte que 15 voyages (243 t) : la feuille est très probablement
  incomplète, mais le mois d'août passe pour relevé.
- **Les numéros** (`TRP-2026-90001` et suivants) suivent l'ordre date, feuille,
  ligne, colonne. Une semaine ajoutée à la fin ne décale rien. Une correction
  dans une semaine passée décalerait tout ce qui suit : il faudra alors comparer
  au fichier joué, et non au fichier régénéré.

## À jouer en production

1. `supabase/migrations/0038_dernier_releve_transport.sql`
2. `supabase/releve-parties/releve-01-camions.sql` à `releve-04-voyages.sql`, dans l'ordre.

Bancs : `tester-releve-reel.mts`. Diagnostic de lecture :
`npx tsx scripts/extraire-recap-tonnage.mts`.

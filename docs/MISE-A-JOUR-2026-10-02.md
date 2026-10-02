# Mise à jour du parc — 2 octobre 2026 (septembre)

*Ce que le dossier DO et les mails du 23 septembre au 2 octobre 2026 apprennent
de nouveau, comparé à la base. Tout a été lu ; rien n'est joué en base sans
l'accord du métier.*

## État de la base avant la mise à jour

| Donnée | Dernière date en base |
| --- | --- |
| Relevé de tonnage | 17/09/2026 |
| Demandes d'achat | 11/09/2026 (21 des 28 numéros du registre) |
| Pleins de carburant | 31/07/2026 |
| Caisse du parc | 31/08/2026 |
| Livraisons des usines | 31/08/2026 |

## À jouer (dans cet ordre, une fois la PR fusionnée)

1. **`supabase/releve-complement-2026-10-02.sql`** — le relevé de tonnage
   « .29 » (Jacques Louis Baye, mail du 01/10, enregistré dans `62. Transport &
   Flotte Automobile`) : **180 voyages du 18 au 30 septembre**, 483 t par le
   parc, 3 558 t par les transporteurs. Numéros TRP-2026-95179 à 95358.
   - Contrôle jour par jour contre la ligne « TONNAGE JOURNALIER » du classeur :
     tout concorde, sauf le 22/09 (+50 t) — Moussa Fall vers Thiès, saisi
     « 50T » en texte, que la formule d'Excel ignore et que le chargeur compte.
   - AA 022 ED et AA 131 FX sont des coquilles pour les pickups AA 022 EA et
     AA 131 EX : le chargeur les corrige désormais.
2. **`supabase/achats-parties/achats-02-registre-du-parc.sql`** (rejoué) — le
   registre des demandes d'achat du 29/09 : **7 demandes nouvelles**,
   DAC-R-90023 à 90029, **21 137 065 F HT** : factures Moussa Kane (août,
   9,7 M), Sokhna Diop (juillet-août, 8,5 M), Mouhamed Sy (2,5 M), trois
   livraisons d'eau aux fermes, un lavage Shell Jaxay. Les 22 demandes déjà en
   base ne bougent pas (`on conflict do nothing`).
   - **Décision du métier (02/10)** : la caisse CA200-2609130 (eau Karaouni 1,
     100 000 F), saisie deux fois au registre (10 et 11/09), compte une fois.
   - Moussa Kane facturé « 14/08/2026 » au registre : le numéro de la DA le
     place en septembre, la demande est datée du 14/09 (comme le chargeur le
     fait déjà pour les autres).
3. **`supabase/mise-a-jour-parc-2026-10-02.sql`** :
   - **3 véhicules revenus en service** d'après la fiche parc du 28/09 : AA 105
     VA (garage Djily Dalifort), AA 291 PT (entretien TATA), AA 053 AP (citerne
     vrac, arrêtée le 23/09 pour sa visite technique). Tracés au journal au 28/09.
   - **2 batteries de 100 AH montées** : DK 4922 BB le 21/09 (SICAS,
     BC26090098) et DK 9649 BG le 22/09. MVT-R-00059 à 00062.

## Ce qui manque, et où le chercher

- **Carburant** : rien après le 31/07/2026, ni dans le dossier ni dans les
  mails. Le relevé de la station (ou des cartes) d'août et de septembre est à
  demander.
- **Caisse de septembre** : `SEPTEMBRE 1.xlsx` est sur le bureau de Malick
  Ndiaye ; le dossier `RECAP DEPENSES CAISSE PARC` n'en a qu'un raccourci.
- **Livraisons des usines de septembre** : l'état d'août date du 06/09 ; celui
  de septembre n'est pas encore produit.

## À trancher par le métier

- **AA 905 CW** : le suivi des batteries ne porte plus son montage du 01/07
  (2 × 150 AH, en base sous MVT-R-00057/58) ; le véhicule est désormais dans
  la feuille « NOUVELLES DEMANDES ». Montage annulé, ou ligne déplacée ?
- **AA 713 VE** (plateau) : « En restauration » sur la fiche du 28/09, en
  attente de son tracteur AA 737 ZW ; « en service » en base. Laissé tel quel.
- **Le registre a retouché deux demandes déjà en base** (« DEM » devenu
  « DEME », un libellé raccourci) : la base garde la première version.
- Les écarts déjà listés le 23/09 restent ouverts (DK 1307 BB, AA 898 PZ,
  plaques anciennes de la fiche, chauffeurs absents de la liste RH…).

## Outillage

- `charger-batteries.mts` lit `SUIVI BATTERIES 2025.xlsx` (le classeur a été
  renommé). Son fichier régénéré n'est **pas** commité : la ligne AA 905 CW
  ayant quitté le classeur, il renumérote les mouvements à partir de
  MVT-R-00057. Les deux montages de septembre passent par le fichier 3.
- `charger-demandes-achat.mts` saute une demande saisie deux fois (même
  numéro, même montant) et nomme Moussa Kane et Sokhna Diop au référentiel.

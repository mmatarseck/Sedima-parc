# Mise à jour du parc — 23 septembre 2026

*Ce que le dossier DO et les mails du 10 au 23 septembre 2026 apprennent de
nouveau, comparé à la base. Tout a été lu, rien n'a été écrit en base par
l'assistant.*

## Sources lues

- Dossier DO, `6. Logistique & Distribution/61. Gestion Parc` et `62. Transport
  & Flotte Automobile` : tous les fichiers modifiés depuis le 10 septembre.
- Boîte Outlook : mails reçus et envoyés depuis le 10 septembre (parc,
  véhicules, chauffeurs, carburant, transporteurs, maintenance).

## À jouer (SQL Editor, dans cet ordre)

1. **`supabase/mise-a-jour-parc-2026-09-23.sql`**, depuis la fiche parc du
   23/09 (08 h 41), la liste des chauffeurs du 22/09 et les points de
   disponibilité de Jacques Louis Baye :
   - **22 statuts** : 9 véhicules au garage (AA 105 VA depuis le 10/09, AA 285
     PT depuis le 16/09, AA 180 CQ, AA 186 CQ, AA 291 PT, AA 350 JN, AA 226 SX,
     AA 927 CA, AB 364 HK) ; 3 hors service (AA 053 AP, VT à passer ; AA 905
     CW ; DK 5680 BL) ; 10 revenus en service (AA 568 GA, AB 681 HE, AA 433 AJ,
     DK 8077 BD, AA 278 JE, DK 4922 BB, DK 5347 BM, AA 547 JD, AA 139 HP, AB
     741 AP). Chaque changement est tracé au journal, daté du jour où la source
     le constate.
   - **Chauffeurs** : 6 matricules RH définitifs (Omar Cissé 98475, Khalifa
     Ndiaye 98474, Birago Wane 98469, Fallou Ndiaye 98493, Samba Thioub 98476,
     Ousmane Diarra 98468) ; Abdourahim Djitté et Demba Sy passés en CDI ; deux
     chauffeurs créés, El Hadji Dabo (98376) et Khadim Sène (99697).
   - **DK 1306 BB** (Mitsubishi L200, 2016) créé : il figurait sur la fiche et
     dans le plan de renouvellement, pas en base. Ses 4 pleins écartés par le
     correctif du carburant sont rajoutés.
2. **`supabase/releve-complement-2026-09-23.sql`** : le relevé de tonnage
   « 11X » du 18/09 apporte **178 voyages du 4 au 17 septembre** (428 t par le
   parc, 3 515 t par les transporteurs). Écrit par
   `scripts/charger-releve-complement.mts`, qui ne reprend que ce qui manque en
   base. La feuille « SEM DU 11 AU 17-09 » portait encore le titre de la
   semaine du 4 : ses dates ont été recalées sur le nom de la feuille.

Les deux fichiers ont été rejoués deux fois dans PGlite sans erreur.

## À trancher par le métier

### Véhicules

- **AA 866 YH, Toyota Prado du DG Franck** : sur la fiche parc, absent de la
  base. À créer par *Flotte › Nouveau véhicule* (caractéristiques inconnues).
- **Plaques qui ne concordent pas** : AA 783 SN sur la fiche contre AA 783 BN
  en base (TATA, Ziguinchor) ; AA 078 JS contre AB 078 JS (L200, Bakary Sow) ;
  DK 6875 DF contre DK 6875 BF (L200 SC, « réformé à Notto »). La base a
  probablement raison, la fiche est à corriger.
- **DK 1307 BB** : « en service, non affecté » sur la fiche, mais « retrait en
  cours » en base et « à réformer » au plan de renouvellement. Statut laissé tel
  quel.
- **Attributions contradictoires** : AA 291 PT et AA 920 VA, où Abdou Lakhat
  Thiam et Demba Sy sont inversés entre la fiche et la base ; AA 550 JD
  (Mouhamadou Ndoye sur la fiche, Khady Fall Diouf en base) ; DK 6067 AM
  (« garage Keur Massar » sur la fiche, Khadim Sène en base).
- **AA 898 PZ, accidenté, chez TATA** : la fiche l'attribue à Bagouma Diop,
  sorti le 31/07/2026 selon la base. L'accident n'est pas au registre des
  incidents.
- **AA 633 JL** : « pas fonctionnel » le 15/09 (mail d'El Hadji Amadou Diop),
  « en service » sur la fiche du 23/09. Laissé en service.
- **AA 605 TR** : moteur remplacé (mail de Bocar Mbaye du 18/09, DA200-2609050).
  Le kilométrage annoncé (152 659) est inférieur à celui de l'ancien moteur
  (385 469) : compteur remis à zéro ? À clarifier avant d'enregistrer
  l'intervention et le relevé.
- **AB 938 KQ** : la carte grise donne une charge utile (12 420 kg) inférieure
  au poids à vide (12 580 kg). Réclamation en cours auprès de CCBM (22/09).
- **Deux pickups mono-cabine** repris aux commerciaux et versés à la livraison
  Aliments (mail du 23/09) : immatriculations non données.
- **Véhicule « Aubineau »** indisponible (fil « Camion poussins Repro », 17/09) :
  à identifier.
- **AA 131 EX** : l'attribution à Alla Faye est suspendue (RH, 22/09) ; en base,
  il reste au pool « Transport de poussins ».

### Conformité

- **Fiche de renouvellement des assurances 2026** : 10 véhicules assurés sont
  absents du parc (AA 018 EA, AB 820 EL, AA 265 JC, AA 372 YJ, AA 339 EN, DK
  2517 BG, DK 8741 BG, TH 4207 D, AA 708 BB, AA 972 AJ). Ce sont d'autres
  entités, des véhicules sortis, ou des plaques mal saisies (AA 372 YJ pour AA
  372 WJ ?). Deux véhicules sortis y sont encore assurés (DK 2348 BD, DK 7485
  BK).
- Six véhicules ont en base une échéance d'assurance antérieure au 31/12/2026
  (AA 565 GA, AB 932 EF, AA 633 JL, AA 985 MR, AA 236 MR, AA 105 VA) alors que
  la fiche couvre l'année civile. À vérifier sur les attestations.

### Chauffeurs

- **15 chauffeurs actifs en base n'apparaissent pas sur la liste RH du 22/09**,
  dont Badji Kadji, Pape Sène, Ibrahima Camara, Alioune Thiam, Semou Diop, Modou
  Gueye, Cheikh Ba, Mandione Diène, Elhadji Mansour Diagne, Assane Sarr, Ndiaga
  Sylla, Ousmane Faye, Moussa Balla Diallo et Pape Mbaye Diagne. Sont-ils
  partis, intérimaires, ou salariés d'une autre entité ? Personne n'a été sorti.
- **Bagouma Diop** : sorti en base au 31/07, mais toujours sur la liste RH.
- **Recrutement** (mails du 10/09) : Bathie Ndiaye, Gora Diop, Thierno Oumar
  Ndiaye et Michel Côme Ndiaye, tests prévus le 15/09. Aucun résultat trouvé.

### Hors base, pour mémoire

- Proforma GEORIS : 21 balises et 6 jauges pour les nouveaux véhicules.
- Bâches COTOA (BC du 15/09), pneus usés vendus à la SOCOCIM (23/09).
- Incident de livraison du 22/09 : 191 poulettes mortes dans un camion loué
  (477 500 F). Le transporteur n'est pas nommé.
- `RECAP 31082026.xlsx` (Khady Fall Diouf, 18/09) : charges du parc au 31/08.
  Pièce jointe non téléchargée ; c'est la source la plus riche pour la caisse
  et les transporteurs d'août.
- Rapport définitif de l'audit de la gestion du parc (17/09).

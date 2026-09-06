# Cadrage — Déclaration des accidents et incidents

Complément à la note de cadrage v0.1, demandé par la Direction des Opérations le
2 septembre 2026 : l'application doit permettre de **déclarer un accident ou un
incident** sur un véhicule, au moyen de formulaires à remplir, et d'en suivre les
suites (immobilisation, réparation, assurance, responsabilité, coûts).

Ce module n'existe ni dans Fleetio tel que l'équipe l'utilise, ni dans le CDC
SediLiv §8 : il est ajouté au périmètre de cette application.

---

## 1. Pourquoi

- **D_NPVEL** (nombre de pannes véhicules en ligne) et **D_TICV** (temps
  d'indisponibilité des véhicules spéciaux) ne se calculent que si chaque panne et
  chaque immobilisation sont déclarées, datées et rattachées à un véhicule.
- Un **sinistre** ouvre un dossier d'assurance, une éventuelle responsabilité du
  chauffeur, une réparation et des coûts : sans déclaration structurée, ces suites se
  perdent dans des courriels et des feuilles Excel.
- La déclaration est aussi une **occasion de relever le compteur** et de figer l'état
  du véhicule à l'instant de l'événement.

## 2. Vocabulaire

| Terme | Définition |
|---|---|
| **Incident** | Tout événement anormal en exploitation qui n'implique pas de dommage à un tiers : panne en ligne, crevaison, surchauffe, perte de chargement, bris de vitre, vol d'accessoire, immobilisation par les autorités. |
| **Accident** | Événement de circulation avec dommage matériel ou corporel, propre ou à un tiers, avec ou sans constat. Toujours un sinistre potentiel. |
| **Sinistre** | Dossier ouvert auprès de l'assureur à la suite d'un accident (ou d'un incident couvert : vol, incendie, bris de glace). |
| **Déclarant** | La personne qui saisit : gestionnaire de parc, correspondant de site, responsable maintenance. **Jamais le chauffeur** (il n'est pas utilisateur) — il est cité comme conducteur au moment des faits. |

## 3. Le formulaire de déclaration

Un seul formulaire, en **quatre étapes**, dans le langage de l'application (modale
centrée, champs arrondis, frise d'étapes, bouton plein pour valider). Les champs
marqués ● sont obligatoires.

### Étape 1 — Les faits

| Champ | Type | Règle |
|---|---|---|
| Véhicule ● | Recherche (immatriculation) | Pré-rempli quand on déclare depuis la fiche |
| Nature ● | Accident / Incident | Détermine les étapes 3 et 4 |
| Type ● | Liste dépendant de la nature (voir §4) | |
| Date et heure ● | Date + heure | Ne peut pas être dans le futur |
| Lieu ● | Texte libre + site SEDIMA le plus proche | Coordonnées GPS si déclaré depuis le mobile |
| Conducteur au moment des faits ● | Chauffeur affecté proposé par défaut | Peut être un suppléant ou « non affecté » |
| Kilométrage au compteur ● | Nombre | **Passe par le contrôle de cohérence des relevés** (`src/domaine/releves.ts`) : un relevé incohérent est signalé au déclarant avant validation |
| Mission en cours | Livraison / transfert / retour à vide / hors mission | Alimente D_NPVEL (seules les pannes *en mission* comptent) |
| Description ● | Texte long | Ce qui s'est passé, dans les mots du déclarant |
| Pièces jointes | Photos, PDF | Photos du véhicule, du lieu, des dégâts |

### Étape 2 — Conséquences sur le véhicule

| Champ | Type | Règle |
|---|---|---|
| Le véhicule peut-il rouler ? ● | Oui / Non / Avec réserve | |
| Nouveau statut ● | Parmi les sept statuts | Proposé automatiquement : « en-réparation » si non roulant, inchangé sinon. **Ouvre une période de statut horodatée** avec le motif `panne` ou `sinistre` |
| Dépannage / remorquage | Oui / Non + prestataire + coût | Crée une dépense rattachée au véhicule (poste `divers`, origine caisse ou facture) |
| Garage de destination | Liste des garages | |
| Retour prévu | Date estimée | Sert à la disponibilité du jour |

### Étape 3 — Tiers et responsabilité (accident seulement)

| Champ | Type |
|---|---|
| Tiers impliqués | Liste : nom, véhicule, immatriculation, assureur, téléphone |
| Constat amiable | Oui / Non + pièce jointe |
| Intervention de la police ou gendarmerie | Oui / Non + n° de PV + pièce jointe |
| Blessés | Aucun / SEDIMA / tiers / les deux — avec gravité |
| Responsabilité présumée | SEDIMA / tiers / partagée / indéterminée |
| Témoins | Texte |

### Étape 4 — Suites

| Champ | Type | Règle |
|---|---|---|
| Déclarer à l'assureur ● (accident) | Oui / Non | Si oui : ouvre un **dossier sinistre** avec n° de police pré-rempli depuis le document « Assurance » du véhicule |
| Franchise attendue | Montant | |
| Sanction ou retenue chauffeur | Aucune / avertissement / retenue (montant) | Tracée sur la fiche chauffeur (module Chauffeurs) |
| Actions correctives | Texte | Ex. : rappel des consignes, contrôle du plan d'entretien |

À la validation : le journal du véhicule reçoit une entrée, la période de statut est
ouverte, le relevé kilométrique est enregistré (ou écarté avec motif), et les
personnes à prévenir reçoivent une notification (gestionnaire de parc, responsable
maintenance ; direction pour tout accident avec blessé ou tiers).

## 4. Typologies

**Incidents** : panne mécanique · panne électrique · crevaison · surchauffe ·
défaut de freinage · perte ou avarie de chargement · bris de glace · vol ou
vandalisme · immobilisation administrative (contrôle routier, fourrière) · autre.

**Accidents** : collision avec un tiers · collision sans tiers (obstacle, sortie de
route) · renversement · accident au chargement/déchargement · accident corporel ·
incendie.

Les typologies sont des référentiels administrables (module Paramètres), pas des
constantes du code.

## 5. Cycle de vie d'une déclaration

```
Déclaré → Qualifié (gestionnaire de parc) → En traitement → Clos
                                         ↘ Sinistre ouvert → Expertise → Indemnisé → Clos
```

- **Déclaré** : saisi, pas encore relu.
- **Qualifié** : nature et type confirmés, responsabilité présumée posée, garage choisi.
- **En traitement** : réparation en cours ; les interventions et dépenses se rattachent à la déclaration.
- **Clos** : véhicule revenu (la période de statut se ferme) et coûts arrêtés.
- Le dossier sinistre a son propre sous-cycle, piloté par le service en charge des assurances.

## 6. Où cela se voit

- **Fiche véhicule 360°** : nouvel onglet **Incidents & sinistres** (liste, coût total,
  jours d'immobilisation) et bouton **Déclarer un incident** dans l'en-tête.
- **Rail** : module **Incidents & sinistres** (groupe Suivi) — liste de toutes les
  déclarations, filtres par nature, statut, BU, période ; export.
- **Tableau de bord SQDCM** : D_NPVEL et D_TICV en sont calculés ; pastille **S** pour
  les accidents corporels (axe Sécurité).
- **Fiche chauffeur** : accidents et sanctions sur la période d'affectation.
- **Disponibilité du jour** : un véhicule déclaré non roulant sort de « prêt à charger »
  à l'instant de la déclaration.

## 7. Modèle de données (ajout)

```
declaration_incident
  id, vehicule_id, nature (accident|incident), type_id, date_heure, lieu, site_id,
  gps_lat, gps_lng, chauffeur_id, mission, description, kilometrage, releve_id,
  roulant (oui|non|reserve), periode_statut_id, garage_id, retour_prevu,
  statut (declare|qualifie|en_traitement|clos), declarant_id, cree_le
tiers_incident        (declaration_id, nom, immatriculation, assureur, telephone)
sinistre              (declaration_id, numero_police, numero_sinistre, franchise,
                       statut (ouvert|expertise|indemnise|clos), montant_indemnise)
piece_jointe          (declaration_id | sinistre_id, type, url)
```

Toute dépense liée (dépannage, réparation, franchise) reste une **dépense rattachée
au véhicule**, avec un `declaration_id` en plus : le coût total d'un incident est une
somme, jamais une saisie.

## 8. Phasage

- **Lot 1** : formulaire de déclaration (4 étapes), période de statut, journal, liste
  des déclarations, onglet sur la fiche.
- **Lot 2** : dossier sinistre, pièces jointes sur mobile, notifications, rattachement
  des dépenses à la déclaration, D_NPVEL / D_TICV sur le tableau de bord.
- **Lot 3** : saisie mobile hors connexion depuis le lieu de l'accident (par le
  correspondant de site), lien avec la fiche chauffeur et les sanctions.

## 9. Questions ouvertes

- **Q67** — Qui ouvre et suit le dossier sinistre aujourd'hui (service général,
  DAF, DO) ? Ce rôle doit exister dans l'application.
- **Q68** — Existe-t-il un formulaire papier de déclaration d'accident en vigueur ?
  Le reprendre champ à champ pour ne pas perdre d'habitude.
- **Q69** — Les retenues sur salaire des chauffeurs sont-elles décidées au parc ou
  aux RH ? Cela décide si la « sanction » est une donnée ou seulement une note.
- **Q70** — Les incidents des transporteurs externes (Lot 3) sont-ils à déclarer
  ici aussi, ou seulement leurs conséquences sur la livraison ?

/* ============================================================================
 * Ce qui se saisit et se modifie sur chaque type de transaction.
 *
 * Les clés sont celles des objets affichés par les fiches (`DepenseFiche`,
 * `PleinFiche`…) : la modale lit les valeurs dessus, la surcharge s'y
 * réapplique, et une création fabrique l'objet à partir des mêmes clés.
 * À la modification, on ne propose que les champs qui ont un sens après coup ;
 * à la création, quelques champs de plus fixent ce qui ne changera plus (le
 * poste d'une dépense, le type d'un document, le chauffeur d'une affectation).
 * ==========================================================================*/

import type { ChampEdition } from "@/domaine/cloture";
import { URGENCE_ACHAT } from "@/domaine/caisse";
import { SOURCE_TARIF, STATUT_AFFRETEMENT } from "@/domaine/transporteurs";
import { ENERGIE } from "@/domaine/libelles";
import { STATUT_ORDRE } from "@/domaine/maintenance";
import { TYPES_GARAGE, TYPE_PRESTATAIRE } from "@/domaine/prestataires";
import { GARAGES } from "@/donnees/fiche-demo";
import { listePrestataires, optionsPrestataires, optionsPrestatairesParNumero } from "@/donnees/prestataires-demo";
import { camionsTiers, chauffeursTiers } from "@/donnees/flotte-tierce-demo";
import { lireCreations } from "@/lib/clotures-demo";
import { APTITUDE, BUSINESS_UNIT, CATEGORIE_FLOTTE, CATEGORIE_OBSERVATION, GRAVITE_OBSERVATION, MISSION_INCIDENT, MOTIF_IMMOBILISATION, MOTIF_INDISPONIBILITE, NATURE_INCIDENT, POSTE_DEPENSE, RESPONSABILITE, ROLE_AFFECTATION, STATUT_DECLARATION, STATUT_OBSERVATION, STATUT_VEHICULE, STATUT_VISITE, TYPE_INCIDENT, TYPE_SANCTION, TYPE_VISITE, USAGE_VEHICULE } from "@/domaine/libelles";
import type { TypeTransaction } from "@/domaine/reference";
import type { CategorieVehicule } from "@/domaine/types";
import { listeChauffeurs } from "@/donnees/chauffeurs-demo";
import { FLOTTE, SITES } from "@/donnees/parc-demo";
import { cleNom, nomMarqueConnu } from "@/domaine/parametres";
import { lireParametres } from "@/lib/parametres-demo";

const options = (r: Record<string, string>) => Object.entries(r).map(([valeur, libelle]) => ({ valeur, libelle }));
const optionsStatut = () => Object.entries(STATUT_VEHICULE).map(([valeur, d]) => ({ valeur, libelle: d.libelle }));
const optionsAptitude = () => Object.entries(APTITUDE).map(([valeur, d]) => ({ valeur, libelle: d.libelle }));
const optionsSites = () => SITES.map((s) => ({ valeur: s.id, libelle: s.libelle }));
const optionsChauffeurs = () => listeChauffeurs().filter((c) => c.chauffeur.actif).map((c) => ({ valeur: c.id, libelle: c.nomComplet }));
const optionsVehicules = (filtre?: (categorie: CategorieVehicule) => boolean) =>
  FLOTTE.filter((l) => (filtre ? filtre(l.vehicule.categorie) : true)).map((l) => ({ valeur: l.vehicule.id, libelle: `${l.vehicule.immatriculationAffichee} · ${l.vehicule.marque} ${l.vehicule.appellation}` }));

/*
 * Le planning des affectations couvre aussi les camions et les chauffeurs des
 * transporteurs (demande du métier du 5 septembre 2026). Les deux référentiels
 * se proposent donc dans le même choix — le parc d'abord, les tiers ensuite,
 * marqués de leur transporteur : personne ne doit programmer un camion tiers en
 * croyant affecter un camion à nous.
 */
const optionsChauffeursTiers = () =>
  chauffeursTiers()
    .filter((c) => c.actif)
    .map((c) => ({ valeur: c.id, libelle: `${c.nom} · ${raisonSocialeDe(c.transporteurNumero)} (tiers)` }));

const optionsCamionsTiers = () =>
  camionsTiers()
    .filter((c) => c.actif)
    .map((c) => ({ valeur: `tiers:${c.immatriculation}`, libelle: `${c.immatriculationAffichee} · ${raisonSocialeDe(c.transporteurNumero)} (tiers)` }));

function raisonSocialeDe(numero: string): string {
  return listePrestataires().find((p) => p.numero === numero)?.raisonSociale ?? numero;
}

const DATE = (cle: string, libelle = "Date"): ChampEdition => ({ cle, libelle, type: "date", obligatoire: true });

/*
 * Le référentiel des véhicules (Paramètres › Véhicules), relu à chaque
 * ouverture du formulaire : marques et modèles en suggestion — on choisit ce
 * qui existe, on écrit ce qui n'existe pas encore, et la création l'apprend —,
 * catégories en choix, familles et ajouts du métier confondus.
 */
export function champsIdentiteVehicule(): ChampEdition[] {
  const { marques, categories } = lireParametres().vehicules;
  /* Les marques que le parc porte déjà sans être au référentiel se proposent
     aussi, sous le nom du référentiel quand il les connaît. */
  const noms = new Map(marques.map((m) => [cleNom(m.nom), m.nom]));
  for (const l of FLOTTE) if (!noms.has(cleNom(l.vehicule.marque))) noms.set(cleNom(l.vehicule.marque), nomMarqueConnu(l.vehicule.marque, marques));
  const optionsMarques = [...noms.values()].sort((a, b) => a.localeCompare(b, "fr")).map((nom) => ({ valeur: nom, libelle: nom }));
  const modelesDe = (saisie: Record<string, string | boolean>) => {
    const cle = cleNom(String(saisie.marque ?? ""));
    const marque = marques.find((m) => cleNom(m.nom) === cle);
    const modeles = marque ? marque.modeles : cle ? [] : marques.flatMap((m) => m.modeles);
    return modeles.map((m) => ({ valeur: m, libelle: m }));
  };
  return [
    { cle: "marque", libelle: "Marque", type: "suggestion", options: optionsMarques, obligatoire: true },
    { cle: "appellation", libelle: "Modèle (appellation commerciale)", type: "suggestion", suggestionsDe: modelesDe, obligatoire: true },
    { cle: "vin", libelle: "N° de châssis (VIN)", type: "texte" },
    {
      cle: "categorie",
      libelle: "Catégorie",
      type: "choix",
      options: categories.map((c) => ({ valeur: c.id, libelle: c.standard ? c.libelle : `${c.libelle} (${categories.find((f) => f.id === c.famille)?.libelle ?? c.famille})` })),
      obligatoire: true,
    },
  ];
}

/** Les champs d'un type, ceux du véhicule relus des paramètres à chaque appel. */
export function champsCourants(type: TypeTransaction): ChampEdition[] {
  return type === "vehicule" ? champsVehicule() : CHAMPS[type];
}

export const CHAMPS: Record<TypeTransaction, ChampEdition[]> = {
  /* Ni la mise à disposition ni la prestation ne se saisissent encore dans
     l'application : elles arrivent de la facture du transporteur. */
  /* Ajuster une opération du plan pour ce véhicule : la périodicité, et le
     motif qui la justifie. Sans motif, une périodicité resserrée passe pour
     une erreur de saisie à la première revue de coûts. */
  budget: [
    { cle: "montant", libelle: "Montant de l'enveloppe", type: "nombre", unite: "F", obligatoire: true },
    { cle: "base", libelle: "Sur quelle base", type: "texte", obligatoire: true },
    { cle: "commentaire", libelle: "Commentaire", type: "texte" },
  ],
  avance: [
    DATE("date", "Date du versement"),
    { cle: "montant", libelle: "Montant avancé", type: "nombre", unite: "F", obligatoire: true },
    { cle: "motif", libelle: "Motif de l'avance", type: "texte", obligatoire: true },
    { cle: "imputeeSur", libelle: "Imputée sur la pièce", type: "texte" },
    { cle: "autorisePar", libelle: "Autorisée par", type: "texte", obligatoire: true },
  ],
  evaluation: [
    DATE("date", "Date de l'évaluation"),
    { cle: "qualite", libelle: "Qualité — le travail a-t-il été bien fait ?", type: "nombre", unite: "/5", obligatoire: true },
    { cle: "delai", libelle: "Délai — le service a-t-il été rendu dans le temps annoncé ?", type: "nombre", unite: "/5", obligatoire: true },
    { cle: "prix", libelle: "Prix — le facturé correspond-il à l'annoncé ?", type: "nombre", unite: "/5", obligatoire: true },
    { cle: "commentaire", libelle: "Commentaire", type: "texte" },
  ],
  transport: [
    DATE("date", "Date du chargement"),
    { cle: "destination", libelle: "Destination livrée", type: "texte", obligatoire: true },
    { cle: "produit", libelle: "Produit", type: "texte" },
    { cle: "tonnage", libelle: "Tonnage annoncé", type: "nombre", unite: "t" },
    { cle: "tonnagePese", libelle: "Tonnage au pont bascule", type: "nombre", unite: "t" },
    { cle: "bonLivraison", libelle: "Bon de livraison", type: "texte" },
    { cle: "chauffeur", libelle: "Chauffeur", type: "texte" },
  ],
  entretien: [
    { cle: "km", libelle: "Périodicité au kilométrage", type: "nombre", unite: "km" },
    { cle: "heures", libelle: "Périodicité au compteur horaire", type: "nombre", unite: "h" },
    { cle: "mois", libelle: "Périodicité dans le temps", type: "nombre", unite: "mois" },
    /* À ne pas confondre avec le « motif de la modification » que la modale
       demande pour tracer le geste : celui-ci est durable, il reste sur la
       ligne du plan et dit pourquoi ce véhicule s'écarte du gabarit. */
    { cle: "motif", libelle: "Pourquoi ce véhicule s'écarte du gabarit", type: "texte", obligatoire: true },
  ],
  "mise-a-disposition": [],
  prestation: [],
  /* Un affrètement : ce qui reste modifiable après coup. Le transporteur et le
     trajet se fixent à la commande — on n'échange pas un transporteur en cours
     de mission, on annule et on recommande. */
  affretement: [
    DATE("date", "Date de la mission"),
    { cle: "tonnageLivre", libelle: "Tonnage livré", type: "nombre", unite: "t" },
    { cle: "statut", libelle: "Étape", type: "choix", options: options(STATUT_AFFRETEMENT), obligatoire: true },
    { cle: "immatriculationExterne", libelle: "Camion du transporteur", type: "texte" },
    { cle: "chauffeurExterne", libelle: "Chauffeur du transporteur", type: "texte" },
    { cle: "prixUnitaireFacture", libelle: "Prix unitaire facturé", type: "nombre", unite: "F" },
    /* L'exception tarifaire (brainstorm du 5 septembre). Quand ni la grille ni
       le rattachement de la localité ne conviennent : soit un prix qui remplace
       le tarif, soit un complément qui s'y ajoute — un détour, une attente, un
       accès difficile. Le motif est obligatoire : c'est lui qui permettra, plus
       tard, de juger si l'exception mérite de devenir la règle. */
    { cle: "prixExceptionnel", libelle: "Prix exceptionnel (remplace le tarif)", type: "nombre", unite: "F" },
    { cle: "complementTarif", libelle: "Complément au tarif", type: "nombre", unite: "F" },
    { cle: "motifTarif", libelle: "Pourquoi ce prix s'écarte de la grille", type: "texte" },
    { cle: "dateLivraison", libelle: "Livré le", type: "date" },
    { cle: "dateFacture", libelle: "Facturé le", type: "date" },
    { cle: "dateReglement", libelle: "Réglé le", type: "date" },
    { cle: "referenceFacture", libelle: "N° de facture", type: "texte" },
    { cle: "numeroDemandeX3", libelle: "DA Sage X3", type: "texte" },
    { cle: "numeroBonCommande", libelle: "BC Sage X3", type: "texte" },
    { cle: "commentaire", libelle: "Commentaire", type: "texte-long" },
  ],
  /* Une ligne de grille tarifaire. Le prix est celui que le transporteur
     **touche net** ; la facture le majore de la retenue à la source. */
  tarif: [
    { cle: "prix", libelle: "Prix", type: "nombre", unite: "F", obligatoire: true },
    { cle: "minimum", libelle: "Minimum facturable", type: "nombre", unite: "F" },
    DATE("debut", "En vigueur depuis"),
    { cle: "fin", libelle: "Jusqu'au", type: "date" },
    { cle: "source", libelle: "Source du prix", type: "choix", options: Object.entries(SOURCE_TARIF).map(([valeur, d]) => ({ valeur, libelle: d.libelle })), obligatoire: true },
    { cle: "commentaire", libelle: "Commentaire", type: "texte" },
  ],
  depense: [
    DATE("date"),
    { cle: "libelle", libelle: "Libellé", type: "texte", obligatoire: true },
    { cle: "montant", libelle: "Montant", type: "nombre", unite: "F", obligatoire: true },
    { cle: "beneficiaire", libelle: "Bénéficiaire", type: "texte" },
    { cle: "reference", libelle: "Pièce", type: "texte" },
    { cle: "km", libelle: "Km relevé", type: "nombre", unite: "km" },
    { cle: "justificatif", libelle: "Justificatif fourni", type: "oui-non" },
  ],
  plein: [
    DATE("date"),
    { cle: "litres", libelle: "Litres", type: "nombre", unite: "L", obligatoire: true },
    { cle: "prixLitre", libelle: "Prix du litre", type: "nombre", unite: "F" },
    { cle: "montant", libelle: "Montant", type: "nombre", unite: "F", obligatoire: true },
    { cle: "reference", libelle: "Bon de sortie", type: "texte" },
    { cle: "km", libelle: "Km relevé", type: "nombre", unite: "km" },
  ],
  intervention: [
    DATE("date"),
    { cle: "type", libelle: "Type", type: "choix", options: [{ valeur: "preventif", libelle: "Préventif" }, { valeur: "curatif", libelle: "Curatif" }], obligatoire: true },
    { cle: "objet", libelle: "Objet", type: "texte", obligatoire: true },
    { cle: "garage", libelle: "Garage", type: "texte" },
    { cle: "km", libelle: "Km relevé", type: "nombre", unite: "km" },
    { cle: "immobilisationJours", libelle: "Immobilisation", type: "nombre", unite: "j" },
    { cle: "montant", libelle: "Montant", type: "nombre", unite: "F", obligatoire: true },
    { cle: "reference", libelle: "Pièce", type: "texte" },
  ],
  document: [
    { cle: "numeroPiece", libelle: "N° de pièce", type: "texte" },
    { cle: "emetteur", libelle: "Émetteur", type: "texte" },
    { cle: "dateEffet", libelle: "Date d'effet", type: "date", obligatoire: true },
    { cle: "echeance", libelle: "Échéance (calculée si vide, selon la validité du document)", type: "date" },
    { cle: "montant", libelle: "Montant", type: "nombre", unite: "F" },
  ],
  releve: [DATE("date"), { cle: "valeur", libelle: "Compteur", type: "nombre", unite: "km", obligatoire: true }],
  affectation: [DATE("debut", "Début"), { cle: "fin", libelle: "Fin", type: "date" }, { cle: "motif", libelle: "Motif", type: "texte" }],
  attelage: [
    DATE("debut", "Début"),
    { cle: "fin", libelle: "Fin", type: "date" },
    { cle: "permanent", libelle: "Définitif (jusqu'à nouvel ordre)", type: "oui-non" },
    { cle: "motif", libelle: "Motif", type: "texte" },
  ],
  incident: [
    DATE("dateHeure"),
    { cle: "lieu", libelle: "Lieu", type: "texte", obligatoire: true },
    { cle: "mission", libelle: "Mission", type: "choix", options: options(MISSION_INCIDENT) },
    { cle: "kilometrage", libelle: "Kilométrage", type: "nombre", unite: "km" },
    { cle: "roulant", libelle: "Véhicule roulant", type: "choix", options: [{ valeur: "oui", libelle: "Oui" }, { valeur: "non", libelle: "Non" }, { valeur: "reserve", libelle: "Avec réserve" }] },
    { cle: "responsabilite", libelle: "Responsabilité", type: "choix", options: options(RESPONSABILITE) },
    { cle: "statut", libelle: "Statut", type: "choix", options: options(STATUT_DECLARATION) },
    { cle: "description", libelle: "Description", type: "texte-long" },
  ],
  sanction: [
    DATE("date"),
    { cle: "type", libelle: "Type", type: "choix", options: options(TYPE_SANCTION), obligatoire: true },
    { cle: "jours", libelle: "Jours", type: "nombre", unite: "j" },
    { cle: "motif", libelle: "Motif", type: "texte-long", obligatoire: true },
  ],
  indisponibilite: [
    { cle: "motif", libelle: "Motif", type: "choix", options: options(MOTIF_INDISPONIBILITE), obligatoire: true },
    DATE("debut", "Début"),
    { cle: "fin", libelle: "Fin", type: "date" },
    { cle: "commentaire", libelle: "Commentaire", type: "texte" },
  ],
  statut: [
    { cle: "statut", libelle: "Nouveau statut", type: "choix", options: optionsStatut(), obligatoire: true },
    { cle: "motif", libelle: "Motif d'immobilisation", type: "choix", options: options(MOTIF_IMMOBILISATION) },
    DATE("debut", "À compter du"),
    { cle: "commentaire", libelle: "Commentaire", type: "texte" },
  ],
  aptitude: [
    { cle: "aptitude", libelle: "Aptitude", type: "choix", options: optionsAptitude(), obligatoire: true },
    DATE("date", "Date de la décision"),
    { cle: "motif", libelle: "Motif ou réserve", type: "texte-long" },
  ],
  visite: [
    { cle: "type", libelle: "Visite ou contre-visite", type: "choix", options: options(TYPE_VISITE), obligatoire: true },
    { cle: "centre", libelle: "Centre agréé", type: "choix", options: [{ valeur: "CCVA Rufisque", libelle: "CCVA Rufisque" }, { valeur: "CCVA Thiès", libelle: "CCVA Thiès" }, { valeur: "CCVA Dakar", libelle: "CCVA Dakar" }], obligatoire: true },
    DATE("dateRendezVous", "Rendez-vous le"),
    { cle: "heure", libelle: "Heure", type: "texte" },
    { cle: "statut", libelle: "Résultat", type: "choix", options: Object.entries(STATUT_VISITE).map(([valeur, d]) => ({ valeur, libelle: d.libelle })), obligatoire: true },
    { cle: "datePassage", libelle: "Passée le", type: "date" },
    { cle: "numeroPv", libelle: "N° de procès-verbal", type: "texte" },
    { cle: "dateLimiteContreVisite", libelle: "Contre-visite avant le", type: "date" },
    { cle: "commentaire", libelle: "Commentaire", type: "texte-long" },
  ],
  observation: [
    { cle: "libelle", libelle: "Observation du centre", type: "texte", obligatoire: true },
    { cle: "categorie", libelle: "Catégorie", type: "choix", options: options(CATEGORIE_OBSERVATION), obligatoire: true },
    { cle: "gravite", libelle: "Gravité", type: "choix", options: options(GRAVITE_OBSERVATION), obligatoire: true },
    { cle: "statut", libelle: "Suivi", type: "choix", options: Object.entries(STATUT_OBSERVATION).map(([valeur, d]) => ({ valeur, libelle: d.libelle })), obligatoire: true },
    { cle: "interventionNumero", libelle: "Intervention qui la corrige", type: "reference", references: ["intervention"] },
    { cle: "corrigeeLe", libelle: "Corrigée le", type: "date" },
    { cle: "commentaire", libelle: "Commentaire", type: "texte" },
  ],
  /* Un mouvement de caisse : ce qui reste modifiable après coup. Le sens et la
     dépense rattachée se fixent à la création — on ne transforme pas une sortie
     en approvisionnement, on l'annule et on la ressaisit. */
  caisse: [
    DATE("date"),
    { cle: "libelle", libelle: "Libellé", type: "texte", obligatoire: true },
    { cle: "montant", libelle: "Montant", type: "nombre", unite: "F", obligatoire: true },
    { cle: "beneficiaire", libelle: "Bénéficiaire", type: "texte" },
    { cle: "piece", libelle: "Pièce de caisse", type: "texte" },
    { cle: "justificatif", libelle: "Justificatif fourni", type: "oui-non" },
  ],
  achat: [
    DATE("date", "Date de la demande"),
    { cle: "objet", libelle: "Objet de la demande", type: "texte", obligatoire: true },
    { cle: "montantEstime", libelle: "Montant estimé", type: "nombre", unite: "F", obligatoire: true },
    { cle: "prestataireNumero", libelle: "Fournisseur pressenti", type: "choix", options: optionsPrestatairesParNumero() },
    { cle: "numeroDemandeX3", libelle: "N° de DA Sage X3", type: "texte" },
    { cle: "numeroBonCommande", libelle: "Bon de commande Sage X3", type: "texte" },
    { cle: "montantEngage", libelle: "Montant engagé (bon)", type: "nombre", unite: "F" },
    { cle: "montantReel", libelle: "Montant facturé", type: "nombre", unite: "F" },
    { cle: "urgence", libelle: "Urgence", type: "choix", options: options(URGENCE_ACHAT), obligatoire: true },
    /* Ce que la demande vient réparer, remplacer ou régulariser : choisi dans
       l'index, jamais tapé à l'aveugle — c'est la garantie du rattachement. */
    { cle: "origineNumero", libelle: "Transaction d'origine", type: "reference", references: ["observation", "intervention", "incident", "visite", "document", "depense", "plein", "ordre"], obligatoire: true },
    { cle: "commentaireDecision", libelle: "Commentaire", type: "texte-long" },
  ],
  /* Un ordre de travail planifie une intervention : ce qui se modifie après
     coup, c'est le rendez-vous et son avancement. L'intervention réalisée,
     elle, est une transaction INT à part. */
  ordre: [
    DATE("datePrevue", "Date prévue"),
    { cle: "objet", libelle: "Objet", type: "texte", obligatoire: true },
    { cle: "garage", libelle: "Garage", type: "choix", options: GARAGES.map((g) => ({ valeur: g, libelle: g })), obligatoire: true },
    { cle: "immobilisationPrevueJours", libelle: "Immobilisation prévue", type: "nombre", unite: "j" },
    { cle: "montantEstime", libelle: "Montant estimé", type: "nombre", unite: "F" },
    { cle: "statut", libelle: "Statut", type: "choix", options: options(STATUT_ORDRE), obligatoire: true },
    { cle: "dateDebut", libelle: "Entré au garage le", type: "date" },
    { cle: "dateCloture", libelle: "Clos le", type: "date" },
    { cle: "interventionNumero", libelle: "Intervention réalisée", type: "reference", references: ["intervention"] },
    { cle: "commentaire", libelle: "Commentaire", type: "texte-long" },
  ],
  /* Un mouvement de cuve : une livraison ou un relevé de jauge. Les sorties de
     cuve ne se saisissent pas ici — ce sont les pleins, et c'est eux qu'on
     modifie. */
  cuve: [
    DATE("date"),
    { cle: "libelle", libelle: "Libellé", type: "texte", obligatoire: true },
    { cle: "litres", libelle: "Litres (livrés, ou stock relevé pour une jauge)", type: "nombre", unite: "L", obligatoire: true },
    { cle: "prixLitre", libelle: "Prix du litre", type: "nombre", unite: "F" },
    { cle: "montant", libelle: "Montant", type: "nombre", unite: "F" },
    { cle: "fournisseur", libelle: "Fournisseur", type: "texte" },
    { cle: "piece", libelle: "Bordereau ou pièce", type: "texte" },
    { cle: "commentaire", libelle: "Commentaire", type: "texte-long" },
  ],
  /* Une fiche de prestataire : le référentiel de ceux avec qui le parc travaille. */
  prestataire: [
    { cle: "raisonSociale", libelle: "Raison sociale", type: "texte", obligatoire: true },
    { cle: "type", libelle: "Type", type: "choix", options: options(TYPE_PRESTATAIRE), obligatoire: true },
    { cle: "contact", libelle: "Contact", type: "texte" },
    { cle: "telephone", libelle: "Téléphone", type: "texte" },
    { cle: "courriel", libelle: "Courriel", type: "texte" },
    { cle: "adresse", libelle: "Adresse", type: "texte" },
    { cle: "ville", libelle: "Ville", type: "texte" },
    { cle: "ninea", libelle: "NINEA", type: "texte" },
    { cle: "delaiPaiementJours", libelle: "Délai de paiement", type: "nombre", unite: "j" },
    { cle: "actif", libelle: "Actif (proposé au choix dans les formulaires)", type: "oui-non" },
    { cle: "note", libelle: "Note", type: "texte-long" },
  ],
  /* Les champs du véhicule se construisent par `champsVehicule()` : marque,
     modèle et catégorie viennent des paramètres, relus à chaque ouverture. */
  vehicule: [],
  chauffeur: [
    { cle: "prenom", libelle: "Prénom", type: "texte", obligatoire: true },
    { cle: "nom", libelle: "Nom", type: "texte", obligatoire: true },
    { cle: "matriculeRh", libelle: "Matricule RH", type: "texte" },
    { cle: "contrat", libelle: "Contrat", type: "choix", options: [{ valeur: "salarie", libelle: "Salarié" }, { valeur: "interimaire", libelle: "Intérimaire" }, { valeur: "prestataire", libelle: "Prestataire" }], obligatoire: true },
    { cle: "siteId", libelle: "Site de rattachement", type: "choix", options: optionsSites() },
    { cle: "telephone", libelle: "Téléphone", type: "texte" },
    { cle: "permisNumero", libelle: "N° de permis", type: "texte" },
    { cle: "permisEcheance", libelle: "Échéance du permis", type: "date" },
    { cle: "visiteMedicaleEcheance", libelle: "Échéance visite médicale", type: "date" },
    { cle: "dateNaissance", libelle: "Date de naissance", type: "date" },
    { cle: "dateEmbauche", libelle: "Date d'entrée", type: "date" },
    /* L'identité complète de l'onglet du même nom : une modale, une trace. */
    { cle: "dateSortie", libelle: "Date de sortie", type: "date" },
    { cle: "adresse", libelle: "Adresse", type: "texte" },
    { cle: "contactUrgence", libelle: "Contact d'urgence", type: "texte" },
    { cle: "permisCategories", libelle: "Catégories de permis (B · C · D · E)", type: "texte" },
    { cle: "permisDelivrance", libelle: "Permis délivré le", type: "date" },
  ],
};

/** Une contravention est une dépense, vue depuis le chauffeur : moins de champs, et la prise en charge. */
export const CHAMPS_CONTRAVENTION: ChampEdition[] = [
  DATE("date"),
  { cle: "libelle", libelle: "Infraction", type: "texte", obligatoire: true },
  { cle: "montant", libelle: "Montant", type: "nombre", unite: "F", obligatoire: true },
  { cle: "reference", libelle: "N° de PV", type: "texte" },
  { cle: "retenue", libelle: "À la charge du chauffeur", type: "oui-non" },
];

export const CHAMPS_FRAIS: ChampEdition[] = [
  DATE("date"),
  { cle: "libelle", libelle: "Libellé", type: "texte", obligatoire: true },
  { cle: "montant", libelle: "Montant", type: "nombre", unite: "F", obligatoire: true },
  { cle: "reference", libelle: "Pièce caisse", type: "texte" },
  { cle: "justificatif", libelle: "Justificatif fourni", type: "oui-non" },
];

/* -- Le véhicule : identité tirée des paramètres, puis le reste de la fiche ---- */

/** Ce qui se modifie sur une fiche véhicule après sa création. */
export function champsVehicule(): ChampEdition[] {
  return [
    /* L'adresse de la photo se saisit ici ; le cadre de l'en-tête sait aussi
       téléverser un fichier, qu'il redimensionne avant d'enregistrer. */
    { cle: "photo", libelle: "Photo (adresse)", type: "texte" },
    ...champsIdentiteVehicule(),
    { cle: "categorieFlotte", libelle: "Catégorie de flotte", type: "choix", options: options(CATEGORIE_FLOTTE), obligatoire: true },
    { cle: "usage", libelle: "Usage (vrac, frigorifique, plateau…)", type: "choix", options: options(USAGE_VEHICULE), obligatoire: true },
    { cle: "businessUnit", libelle: "Business unit", type: "choix", options: options(BUSINESS_UNIT) },
    { cle: "siteId", libelle: "Site", type: "choix", options: optionsSites() },
    { cle: "energie", libelle: "Énergie", type: "choix", options: options(ENERGIE), obligatoire: true },
    { cle: "transportSpecial", libelle: "Transport spécial", type: "oui-non" },
    { cle: "engage", libelle: "Engagé au parc (compte dans D_TDPA)", type: "oui-non" },
    /* Les caractéristiques de l'onglet du même nom : identification, technique,
       rattachement, valeur. Une seule modale, une seule trace. */
    { cle: "typeModele", libelle: "Type / modèle", type: "texte" },
    { cle: "premiereMiseEnCirculation", libelle: "1re mise en circulation", type: "date" },
    { cle: "dateImmatriculation", libelle: "Date d'immatriculation", type: "date" },
    { cle: "region", libelle: "Région", type: "texte" },
    { cle: "puissanceCv", libelle: "Puissance", type: "nombre", unite: "CV" },
    { cle: "cylindree", libelle: "Cylindrée", type: "nombre", unite: "cm³" },
    { cle: "ptac", libelle: "PTAC", type: "nombre", unite: "kg" },
    { cle: "ptra", libelle: "PTRA", type: "nombre", unite: "kg" },
    { cle: "poidsVide", libelle: "Poids à vide", type: "nombre", unite: "kg" },
    { cle: "chargeUtile", libelle: "Charge utile", type: "nombre", unite: "kg" },
    { cle: "capaciteReservoir", libelle: "Réservoir", type: "nombre", unite: "L" },
    { cle: "entite", libelle: "Entité", type: "texte" },
    { cle: "utilisation", libelle: "Utilisation", type: "texte" },
    { cle: "regimePropriete", libelle: "Régime de propriété", type: "texte" },
    { cle: "gpsActif", libelle: "Télématique (balise active)", type: "oui-non" },
    { cle: "valeurAcquisition", libelle: "Valeur d'acquisition", type: "nombre", unite: "F" },
    { cle: "dureeAmortissementAnnees", libelle: "Durée d'amortissement", type: "nombre", unite: "ans" },
    { cle: "commentaire", libelle: "Commentaire", type: "texte-long" },
  ];
}

/* -- À la création : ce qui se fixe une fois pour toutes ---------------------- */

export interface ContexteCreation {
  pour: "vehicule" | "chauffeur" | "planning" | "caisse" | "maintenance" | "carburant";
  /** Sens d'un mouvement de cuve : une livraison ou un relevé de jauge (les sorties sont les pleins). */
  sensCuve?: "livraison" | "jauge";
  categorie?: CategorieVehicule;
  /** Les visites techniques du véhicule, pour rattacher une observation. */
  visites?: { valeur: string; libelle: string }[];
  /** Sens d'un mouvement de caisse : on ne saisit pas une entrée comme une sortie. */
  sens?: "entree" | "sortie";
  /** Les dépenses caisse en attente de règlement, à rattacher au mouvement. */
  depenses?: { valeur: string; libelle: string }[];
}

/**
 * Champs d'un formulaire de création. Ceux de la modification, précédés de ce
 * qui identifie la transaction : poste d'une dépense, type d'un document,
 * chauffeur d'une affectation, remorque d'un attelage, nature d'un incident.
 */
export function champsCreation(type: TypeTransaction, contexte: ContexteCreation): ChampEdition[] {
  const base = CHAMPS[type];
  switch (type) {
    case "depense":
      return [
        { cle: "poste", libelle: "Poste", type: "choix", options: options(POSTE_DEPENSE).filter((o) => !["carburant", "amortissement", "salaire"].includes(o.valeur)), obligatoire: true },
        { cle: "origine", libelle: "Origine du décaissement", type: "choix", options: [{ valeur: "caisse", libelle: "Caisse parc" }, { valeur: "bon-de-commande", libelle: "Bon de commande" }, { valeur: "facture", libelle: "Facture" }], obligatoire: true },
        ...base,
      ];
    case "plein":
      return [
        /* Depuis le module Carburant, on choisit d'abord le véhicule ; depuis la fiche, il est connu. */
        ...(contexte.pour === "carburant" ? [{ cle: "vehiculeId", libelle: "Véhicule", type: "choix" as const, options: optionsVehicules(), obligatoire: true }] : []),
        { cle: "source", libelle: "Source", type: "choix", options: [{ valeur: "Cuve interne SEDIMA", libelle: "Cuve interne SEDIMA" }, { valeur: "Station Total", libelle: "Station Total" }, { valeur: "Station Shell", libelle: "Station Shell" }], obligatoire: true },
        ...base,
      ];
    case "document":
      return [
        {
          cle: "type",
          libelle: "Document",
          type: "choix",
          /* Les documents sont ceux des paramètres — y compris ceux ajoutés par le
             métier. Un document porté par la flotte (licence) ne se crée pas depuis un véhicule. */
          options: lireParametres()
            .documents.types.filter((t) => (contexte.pour === "chauffeur" ? t.porteur === "chauffeur" : t.porteur === "vehicule"))
            .map((t) => ({ valeur: t.id, libelle: t.libelle })),
          obligatoire: true,
        },
        ...base,
      ];
    case "affectation":
      if (contexte.pour === "planning") {
        return [
          { cle: "vehiculeId", libelle: "Véhicule", type: "choix", options: [...optionsVehicules(), ...optionsCamionsTiers()], obligatoire: true },
          { cle: "chauffeurId", libelle: "Chauffeur", type: "choix", options: [...optionsChauffeurs(), ...optionsChauffeursTiers()], obligatoire: true },
          { cle: "role", libelle: "Rôle", type: "choix", options: options(ROLE_AFFECTATION), obligatoire: true },
          ...base,
        ];
      }
      return contexte.pour === "vehicule"
        ? [{ cle: "chauffeurId", libelle: "Chauffeur", type: "choix", options: optionsChauffeurs(), obligatoire: true }, { cle: "role", libelle: "Rôle", type: "choix", options: options(ROLE_AFFECTATION), obligatoire: true }, ...base]
        : [{ cle: "vehiculeId", libelle: "Véhicule", type: "choix", options: optionsVehicules(), obligatoire: true }, { cle: "role", libelle: "Rôle", type: "choix", options: options(ROLE_AFFECTATION), obligatoire: true }, ...base];
    case "chauffeur":
      /* À la création on demande d'abord ce qui identifie la personne et ce qui
         l'autorise à conduire ; le reste de l'identité se complète ensuite sur
         sa fiche. Un chauffeur enregistré sans permis serait non conforme dès
         sa première journée — vrai, mais inutilisable. */
      return base.filter((c) => !["dateSortie", "adresse", "contactUrgence", "permisDelivrance"].includes(c.cle));
    case "vehicule":
      return [
        { cle: "immatriculation", libelle: "Immatriculation", type: "texte", obligatoire: true },
        { cle: "photo", libelle: "Photo (adresse)", type: "texte" },
        ...champsIdentiteVehicule(),
        { cle: "categorieFlotte", libelle: "Catégorie de flotte", type: "choix", options: options(CATEGORIE_FLOTTE), obligatoire: true },
        { cle: "usage", libelle: "Usage (vrac, frigorifique, plateau…)", type: "choix", options: options(USAGE_VEHICULE), obligatoire: true },
        { cle: "businessUnit", libelle: "Business unit", type: "choix", options: options(BUSINESS_UNIT) },
        { cle: "siteId", libelle: "Site", type: "choix", options: optionsSites() },
        { cle: "energie", libelle: "Énergie", type: "choix", options: options(ENERGIE), obligatoire: true },
        { cle: "transportSpecial", libelle: "Transport spécial", type: "oui-non" },
        { cle: "engage", libelle: "Engagé au parc (compte dans D_TDPA)", type: "oui-non" },
        { cle: "premiereMiseEnCirculation", libelle: "1re mise en circulation", type: "date" },
        { cle: "dateImmatriculation", libelle: "Date d'immatriculation", type: "date" },
        { cle: "chargeUtile", libelle: "Charge utile", type: "nombre", unite: "kg" },
        { cle: "kilometrage", libelle: "Kilométrage à l'entrée", type: "nombre", unite: "km" },
        /* Véhicule léger neuf : la réglementation accorde un délai avant la première
           visite ; l'agent saisit cette date, l'échéancier part de là. */
        { cle: "premiereVisiteTechnique", libelle: "Première visite technique (véhicule neuf : date accordée par la réglementation)", type: "date" },
        { cle: "commentaire", libelle: "Commentaire", type: "texte-long" },
      ];
    case "attelage": {
      const remorque = contexte.categorie === "tracteur";
      return [
        {
          cle: "autreId",
          libelle: remorque ? "Remorque" : "Tracteur",
          type: "choix",
          options: optionsVehicules((c) => (remorque ? c === "semi-remorque" : c === "tracteur")),
          obligatoire: true,
        },
        ...base,
      ];
    }
    case "incident":
      return [
        ...(contexte.pour === "chauffeur" ? [{ cle: "vehiculeId", libelle: "Véhicule", type: "choix" as const, options: optionsVehicules(), obligatoire: true }] : [{ cle: "chauffeurId", libelle: "Conducteur au moment des faits", type: "choix" as const, options: optionsChauffeurs() }]),
        { cle: "nature", libelle: "Nature", type: "choix", options: options(NATURE_INCIDENT), obligatoire: true },
        { cle: "type", libelle: "Type", type: "choix", options: options(TYPE_INCIDENT), obligatoire: true },
        ...base,
      ];
    case "caisse":
      /* Une entrée alimente la caisse et ne règle rien ; une sortie cite
         toujours la dépense qu'elle règle — c'est la règle du métier, portée
         ici par un champ obligatoire plutôt que par une consigne. */
      return contexte.sens === "entree"
        ? [
            DATE("date"),
            { cle: "libelle", libelle: "Libellé", type: "texte", obligatoire: true },
            { cle: "montant", libelle: "Montant", type: "nombre", unite: "F", obligatoire: true },
            { cle: "beneficiaire", libelle: "Remis par", type: "texte" },
            { cle: "piece", libelle: "Bordereau ou pièce", type: "texte" },
            { cle: "justificatif", libelle: "Justificatif fourni", type: "oui-non" },
          ]
        : [{ cle: "depenseNumero", libelle: "Dépense réglée", type: "choix", options: contexte.depenses ?? [], obligatoire: true }, ...base];
    case "achat":
      /* À la demande, on cite le véhicule, le poste et l'origine ; ce qui se
         relève dans X3 (bon, montants) viendra avec les décisions. Le
         fournisseur pressenti se choisit dans le référentiel, fiches créées
         comprises — jamais un nom libre, les statistiques par prestataire en
         dépendent. */
      return [
        { cle: "vehiculeId", libelle: "Véhicule concerné", type: "choix", options: optionsVehicules() },
        { cle: "poste", libelle: "Poste de charge", type: "choix", options: options(POSTE_DEPENSE).filter((o) => !["amortissement", "salaire"].includes(o.valeur)), obligatoire: true },
        ...base
          .filter((c) => !["numeroBonCommande", "montantEngage", "montantReel"].includes(c.cle))
          .map((c) => (c.cle === "prestataireNumero" ? { ...c, options: optionsPrestatairesParNumero(typeof window === "undefined" ? undefined : lireCreations) } : c)),
      ];
    case "ordre":
      /* À la planification, le véhicule, la nature et ce qui motive le travail se
         fixent ; l'avancement (statut, dates, intervention) viendra ensuite. */
      return [
        { cle: "vehiculeId", libelle: "Véhicule", type: "choix", options: optionsVehicules(), obligatoire: true },
        { cle: "type", libelle: "Nature", type: "choix", options: [{ valeur: "preventif", libelle: "Préventif" }, { valeur: "curatif", libelle: "Curatif" }], obligatoire: true },
        { cle: "origineNumero", libelle: "Transaction d'origine (vide pour une échéance du plan)", type: "reference", references: ["observation", "incident", "intervention", "visite"] },
        /* Le commentaire de création est celui de la modale ; le champ
           « commentaire » de l'ordre sert ensuite, à la modification. Le garage
           se choisit parmi les prestataires actifs — fiches créées comprises. */
        ...base
          .filter((c) => !["statut", "dateDebut", "dateCloture", "interventionNumero", "commentaire"].includes(c.cle))
          .map((c) => (c.cle === "garage" ? { ...c, options: optionsPrestataires(TYPES_GARAGE, typeof window === "undefined" ? undefined : lireCreations) } : c)),
      ];
    case "prestataire":
      /* Une fiche naît active ; on la désactive ensuite par modification. */
      return base.filter((c) => c.cle !== "actif");
    case "cuve":
      /* Une livraison remplit la cuve ; un relevé de jauge dit ce qu'elle contient
         vraiment, et l'écart avec le stock théorique se calcule. */
      return contexte.sensCuve === "jauge"
        ? [DATE("date", "Relevé le"), { cle: "litres", libelle: "Stock relevé à la jauge", type: "nombre", unite: "L", obligatoire: true }, { cle: "commentaire", libelle: "Commentaire", type: "texte" }]
        : base.filter((c) => c.cle !== "commentaire");
    case "releve":
      return [...base, { cle: "source", libelle: "Source du relevé", type: "texte" }];
    case "observation":
      return [{ cle: "visiteId", libelle: "Visite technique", type: "choix", options: contexte.visites ?? [], obligatoire: true }, ...base];
    case "visite":
      /* À la prise de rendez-vous, le résultat n'est pas encore connu. */
      return base.filter((c) => !["statut", "datePassage", "numeroPv", "dateLimiteContreVisite"].includes(c.cle));
    default:
      return base;
  }
}

export const CHAMPS_CREATION_CONTRAVENTION: ChampEdition[] = [{ cle: "vehiculeId", libelle: "Véhicule", type: "choix", options: optionsVehicules(), obligatoire: true }, ...CHAMPS_CONTRAVENTION];

/* ============================================================================
 * SEDIMA Logistique & Distribution — types du domaine
 *
 * Trois choix structurants, posés dans la note de cadrage :
 *  1. L'affectation est une entité datée, pas un champ « chauffeur » du véhicule.
 *  2. Toute dépense est un mouvement daté rattaché à un véhicule.
 *  3. Le relevé kilométrique est un fait daté ; l'odomètre courant en est déduit.
 * ==========================================================================*/

/** Immatriculation normalisée : majuscules, sans espace ni tiret. Clé de rapprochement. */
export type Immatriculation = string;

export type CategorieVehicule =
  | "camion"
  | "tracteur"
  | "semi-remorque"
  | "camionnette"
  | "vehicule-leger"
  | "bus"
  | "moto"
  | "engin";

/** Catégorie de flotte au sens du cahier des charges §8.1. */
export type CategorieFlotte = "interne" | "adex" | "location" | "prestataire";

/**
 * Statut d'exploitation, dans le vocabulaire de la gestion de parc.
 *
 * « en-service » et « en-backup » sont les deux états opérationnels : ce sont eux
 * qui alimentent le numérateur du taux de disponibilité D_TDPA. Les cinq autres
 * décrivent des indisponibilités de natures distinctes, qui n'appellent ni les
 * mêmes délais ni les mêmes décisions.
 *
 * Le statut « prêt à charger » du cahier des charges est plus exigeant encore —
 * véhicule opérationnel ET chauffeur affecté ET disponible pour le chargement.
 * Il se déduit, il ne se saisit pas : voir `pretACharger` dans les libellés.
 */
export type StatutVehicule =
  | "en-service"
  | "en-backup"
  | "en-reparation"
  | "en-restauration"
  | "hors-service"
  | "en-mutation"
  | "retrait-en-cours"
  /** Commandé, pas encore livré ni immatriculé — les quinze du lot 2 (7 septembre 2026). */
  | "a-recevoir";

/** Motif d'immobilisation — typé, car D_TICV ne retient que panne et curatif. */
export type MotifImmobilisation =
  | "panne"
  | "maintenance-corrective"
  | "maintenance-preventive"
  | "administratif"
  | "sinistre"
  | "reforme";

export type BusinessUnit =
  | "aliment"
  | "minoterie"
  | "abattoir"
  | "couvoir"
  | "commercial"
  | "fermes"
  | "siege";

export interface Site {
  id: string;
  code: string;
  libelle: string;
  region: string;
  type: "usine" | "depot" | "ferme" | "abattoir" | "siege" | "boutique" | "garage";
}

/** L'usage d'un véhicule — ce qu'il charge. Filtre de la disponibilité du jour. */
export type UsageVehicule = "vrac" | "frigorifique" | "poussins" | "plateau" | "ridelle" | "citerne" | "benne" | "fourgon" | "tracteur" | "utilitaire" | "autre";

/**
 * Énergie d'un véhicule. Le prix de chacune est un paramètre (Paramètres ›
 * Énergie et carburant) ; un véhicule électrique se « recharge » plutôt qu'il
 * ne fait le plein, mais reste un véhicule du parc comme les autres.
 */
export type Energie = "gasoil" | "essence" | "electrique" | "hybride";

/**
 * Ce que le véhicule fait pour l'entreprise — cadrage du 7 septembre 2026 :
 * livrer (exploitation), servir un agent ou un pool (service), équiper une
 * personne selon son niveau (fonction). Seule l'exploitation entre dans les
 * charges de livraison ; tout le parc entre dans la maintenance et le carburant.
 */
export type RegimeUsage = "exploitation" | "service" | "fonction";

export interface Vehicule {
  id: string;
  /** Absent : exploitation — c'est le cas de toute la flotte de transport. */
  regime?: RegimeUsage;
  immatriculation: Immatriculation;
  /** Immatriculation telle qu'affichée : « AA 032 EA ». */
  immatriculationAffichee: string;
  /** Numéro d'identification du véhicule (châssis), 17 caractères. Clé avec le constructeur et l'assureur. */
  vin: string | null;
  marque: string;
  appellation: string;
  typeModele: string | null;
  /** La famille, clé des règles : documents, plafond kilométrique, entretien, silhouette. */
  categorie: CategorieVehicule;
  /**
   * La catégorie ajoutée par le métier dans Paramètres › Véhicules (« cat-… »),
   * quand le véhicule en porte une : elle se nomme à sa place, et sa famille
   * reste dans `categorie`. Absente ou nulle : la famille suffit.
   */
  categorieMetier?: string | null;
  categorieFlotte: CategorieFlotte;
  /** Coché sur la fiche : vracs, transport de poussins, frigorifiques. Sert à D_TICV. */
  transportSpecial: boolean;
  /** Ce que le véhicule transporte ou fait : vrac, frigorifique, plateau… La disponibilité se lit par usage. */
  usage: UsageVehicule;
  /** Faux pour les véhicules hors périmètre de disponibilité (réformés, non immatriculés). */
  engage: boolean;
  premiereMiseEnCirculation: string | null;
  dateImmatriculation: string | null;
  puissanceCv: number | null;
  cylindree: number | null;
  ptac: number | null;
  ptra: number | null;
  poidsVide: number | null;
  chargeUtile: number | null;
  /** L'énergie qui fait rouler le véhicule — électrique compris (décision du métier du 3 septembre). */
  energie: Energie | null;
  capaciteReservoir: number | null;
  businessUnit: BusinessUnit | null;
  siteId: string | null;
  statut: StatutVehicule;
  valeurAcquisition: number | null;
  dureeAmortissementAnnees: number | null;
  commentaire: string | null;
  /**
   * Photo du véhicule, pour le reconnaître d'un coup d'œil — demande du métier
   * du 4 septembre 2026. C'est une **adresse** : une URL, ou une image en ligne
   * pour la démonstration. En production, le fichier ira dans un seau de
   * stockage et la fiche n'en gardera que le lien.
   */
  photo?: string | null;
}

/** Période d'état, horodatée à l'heure. Sans elle, D_TDPA et D_TICV sont incalculables. */
export interface PeriodeStatut {
  id: string;
  vehiculeId: string;
  statut: StatutVehicule;
  motif: MotifImmobilisation | null;
  debut: string;
  fin: string | null;
  commentaire: string | null;
}

/**
 * Aptitude à conduire, **saisie** par la gestion de parc — décision du 3
 * septembre 2026 : elle s'ajoute au statut déduit (affectation, indisponibilité,
 * sortie), elle ne le remplace pas. Une réserve restreint (véhicules légers
 * seulement, lunettes obligatoires…) ; une inaptitude interdit de conduire, quoi
 * qu'en disent les documents.
 */
export type Aptitude = "apte" | "apte-avec-reserve" | "inapte";

export interface Chauffeur {
  id: string;
  matriculeRh: string | null;
  nom: string;
  prenom: string;
  contrat: "salarie" | "interimaire" | "prestataire";
  siteId: string | null;
  permisNumero: string | null;
  permisCategories: string[];
  permisEcheance: string | null;
  visiteMedicaleEcheance: string | null;
  telephone: string | null;
  aptitude: Aptitude;
  /** Ce que dit la réserve ou l'inaptitude, dans les mots de la décision. */
  aptitudeMotif: string | null;
  /** Date de la décision d'aptitude. */
  aptitudeDate: string | null;
  dateNaissance: string | null;
  dateEmbauche: string | null;
  /** Renseignée quand le chauffeur a quitté l'entreprise : il reste consultable, jamais supprimé. */
  dateSortie: string | null;
  /** Faux dès que la date de sortie est passée. Un chauffeur inactif ne peut plus être affecté. */
  actif: boolean;
}

/**
 * Indisponibilité d'un chauffeur — une période datée, comme le statut d'un
 * véhicule. Elle ne rompt pas l'affectation : le titulaire en congé reste
 * titulaire, mais son véhicule ne compte pas « prêt à charger » sans suppléant.
 */
export type MotifIndisponibilite = "conge" | "maladie" | "suspension-permis" | "formation" | "autre";

export interface Indisponibilite {
  id: string;
  numero: string;
  chauffeurId: string;
  motif: MotifIndisponibilite;
  debut: string;
  fin: string | null;
  commentaire: string | null;
}

/**
 * Sanction prononcée à l'encontre d'un chauffeur, le plus souvent à la suite
 * d'un incident ou d'une contravention. Q69 tranchée le 3 septembre 2026 : la
 * sanction est **une trace**, pas une donnée de paie. La retenue sur salaire est
 * donc enregistrée comme décision, sans montant — le montant est une donnée de
 * paie, suivie aux RH et pas ici.
 */
export type TypeSanction = "avertissement" | "blame" | "retenue" | "mise-a-pied";

export interface Sanction {
  id: string;
  numero: string;
  chauffeurId: string;
  date: string;
  type: TypeSanction;
  motif: string;
  /** Jours de mise à pied, quand il y en a. */
  jours: number | null;
  incidentId: string | null;
  depenseId: string | null;
}

/* -- Déclarations d'incident (CADRAGE-INCIDENTS.md §7) ---------------------- */

export type NatureIncident = "accident" | "incident";

/**
 * Typologie des incidents et accidents. Le cadrage la veut administrable dans
 * Paramètres ; tant que ce module n'existe pas, elle vit ici, avec ses libellés
 * dans `libelles.ts`.
 */
export type TypeIncident =
  | "panne-mecanique"
  | "panne-electrique"
  | "crevaison"
  | "surchauffe"
  | "defaut-freinage"
  | "avarie-chargement"
  | "bris-de-glace"
  | "vol-vandalisme"
  | "immobilisation-administrative"
  | "collision-tiers"
  | "collision-sans-tiers"
  | "renversement"
  | "accident-chargement"
  | "accident-corporel"
  | "incendie"
  | "autre";

export type StatutDeclaration = "declare" | "qualifie" | "en-traitement" | "clos";
export type Responsabilite = "sedima" | "tiers" | "partagee" | "indeterminee";
export type MissionIncident = "livraison" | "transfert" | "retour-a-vide" | "hors-mission";

export interface DeclarationIncident {
  id: string;
  numero: string;
  vehiculeId: string;
  nature: NatureIncident;
  type: TypeIncident;
  dateHeure: string;
  lieu: string;
  siteId: string | null;
  /** Conducteur au moment des faits — affecté ou non, jamais le déclarant. */
  chauffeurId: string | null;
  mission: MissionIncident | null;
  description: string;
  kilometrage: number | null;
  roulant: "oui" | "non" | "reserve";
  statut: StatutDeclaration;
  /** Accident seulement. */
  responsabilite: Responsabilite | null;
  blesses: boolean;
  sinistreOuvert: boolean;
  declarantId: string;
}

export type RoleAffectation = "titulaire" | "suppleant";

export interface Affectation {
  id: string;
  vehiculeId: string;
  chauffeurId: string;
  role: RoleAffectation;
  debut: string;
  fin: string | null;
  businessUnit: BusinessUnit | null;
  siteId: string | null;
  motif: string | null;
}

/**
 * Attelage — un tracteur et une remorque (ou semi-remorque) associés, sur une
 * période ou définitivement. Décision du métier du 3 septembre 2026 : c'est
 * une entité datée, comme l'affectation ; `fin` nulle et `permanent` vrai
 * disent « jusqu'à nouvel ordre ». Un jour donné, une remorque n'a qu'un
 * tracteur, et un tracteur qu'une remorque.
 */
export interface Attelage {
  id: string;
  numero: string;
  tracteurId: string;
  remorqueId: string;
  debut: string;
  fin: string | null;
  permanent: boolean;
  motif: string | null;
}

/* -- Visites techniques (décision du métier, 3 septembre 2026) --------------------
 * La visite technique est un processus, pas un simple document : un rendez-vous
 * pris au centre agréé, un passage, un résultat. Un refus laisse des
 * observations — chacune suivie comme une action de maintenance corrective
 * jusqu'à sa clôture — et ouvre un délai pour la contre-visite. Le document
 * « visite technique » de la fiche n'est renouvelé qu'à l'acceptation.
 * ------------------------------------------------------------------------- */

export type TypeVisite = "visite" | "contre-visite";
export type StatutVisite = "rendez-vous" | "acceptee" | "refusee" | "annulee";

export interface VisiteTechnique {
  id: string;
  numero: string;
  vehiculeId: string;
  type: TypeVisite;
  /** Centre agréé : CCVA Rufisque, CCVA Thiès… */
  centre: string;
  dateRendezVous: string;
  heure: string | null;
  /** Renseignée au passage. */
  datePassage: string | null;
  statut: StatutVisite;
  numeroPv: string | null;
  /** Après un refus : date avant laquelle la contre-visite doit être passée. */
  dateLimiteContreVisite: string | null;
  commentaire: string | null;
}

export type CategorieObservation = "freinage" | "direction" | "eclairage" | "pneumatiques" | "pollution" | "carrosserie" | "vitrage" | "attelage" | "equipements" | "autre";
export type GraviteObservation = "majeure" | "mineure";
export type StatutObservation = "a-traiter" | "en-cours" | "corrigee";

/** Un défaut relevé par le centre, à corriger avant la contre-visite. */
export interface ObservationVisite {
  id: string;
  numero: string;
  visiteId: string;
  vehiculeId: string;
  libelle: string;
  categorie: CategorieObservation;
  gravite: GraviteObservation;
  statut: StatutObservation;
  /** Numéro de l'intervention qui la corrige, quand elle existe. */
  interventionNumero: string | null;
  corrigeeLe: string | null;
  commentaire: string | null;
}

/** Les documents livrés avec l'application : le code les connaît (processus de visite, permis…). */
export type TypeDocumentStandard =
  | "carte-grise"
  | "assurance"
  | "visite-technique"
  | "licence-transport"
  | "certificat-salubrite"
  | "carte-transport"
  | "permis"
  | "visite-medicale";

/**
 * Un type de document : standard, ou ajouté par le métier dans Paramètres ›
 * Règles des documents (« doc-… »). Le `string & {}` garde l'autocomplétion
 * des standards tout en acceptant les ajouts.
 */
export type TypeDocument = TypeDocumentStandard | (string & {});

/**
 * Licence de transport — portée par la flotte, ou par une partie de la flotte,
 * jamais par un véhicule seul (décision du métier, 3 septembre 2026). Chaque
 * véhicule couvert l'affiche parmi ses documents ; l'échéancier ne la compte
 * qu'une fois.
 */
export interface LicenceTransport {
  id: string;
  numero: string;
  libelle: string;
  numeroPiece: string;
  emetteur: string;
  perimetre: "flotte" | "partie";
  /** Vide pour la flotte entière. */
  vehiculeIds: string[];
  dateEffet: string;
  echeance: string;
}

export interface Document {
  id: string;
  /** Un document porte sur un véhicule OU sur un chauffeur, jamais les deux. */
  vehiculeId: string | null;
  chauffeurId: string | null;
  type: TypeDocument;
  numeroPiece: string | null;
  emetteur: string | null;
  dateEffet: string | null;
  echeance: string | null;
  montant: number | null;
  fichierUrl: string | null;
}

export type OrigineReleve = "saisie" | "plein" | "garage" | "telematique";

export interface ReleveKilometrique {
  id: string;
  vehiculeId: string;
  date: string;
  valeur: number;
  origine: OrigineReleve;
}

export type PosteDepense =
  | "carburant"
  | "maintenance-preventive"
  | "maintenance-curative"
  | "pieces"
  | "pneumatiques"
  | "assurance"
  | "conformite"
  | "frais-de-route"
  | "peage"
  | "contravention"
  | "amortissement"
  | "salaire"
  | "divers";

export interface Depense {
  id: string;
  vehiculeId: string | null;
  /** Obligatoire dès que vehiculeId est nul — la dépense doit rester traçable. */
  motifSansVehicule: string | null;
  date: string;
  montant: number;
  poste: PosteDepense;
  beneficiaire: string | null;
  reference: string | null;
  justificatifUrl: string | null;
  /** Origine du décaissement : caisse parc, bon de commande, facture directe. */
  origine: "caisse" | "bon-de-commande" | "facture";
}

/* -- Vues dérivées, calculées côté serveur ---------------------------------- */

export interface EcheanceVehicule {
  type: TypeDocument;
  echeance: string;
  joursRestants: number;
}

/** Ligne de la page Flotte : le véhicule augmenté de ce qui se calcule. */
export interface LigneFlotte {
  vehicule: Vehicule;
  chauffeurTitulaire: { id: string; nom: string } | null;
  nombreSuppleants: number;
  site: Site | null;
  kilometrage: number | null;
  dateKilometrage: string | null;
  prochaineEcheanceConformite: EcheanceVehicule | null;
  /**
   * `kmParJour` est le rythme du véhicule, lu sur ses relevés : sans lui, qui
   * veut des jours à partir de kilomètres restants en invente (la Conformité
   * comptait 100 km/jour pour tout le parc, et annonçait donc un poids lourd
   * à 300 km/jour trois fois trop tard). Nul quand on ne l'a pas mesuré.
   */
  prochaineEcheanceEntretien: { libelle: string; kmRestants: number | null; joursRestants: number | null; kmParJour: number | null } | null;
  coutDouzeMois: number | null;
  /** L'autre moitié de l'attelage en cours, s'il y en a un. */
  attelageCourant: { immatriculation: string; immatriculationAffichee: string; role: "tracteur" | "remorque" } | null;
  /** Pour un véhicule de service ou de fonction : qui le tient — une personne ou un pool — et s'il est en plan car. */
  attributaire?: { nom: string; fonction: string | null; pool: boolean; planCar: boolean } | null;
  /** Le statut affiché et compté : le statut saisi, ou « hors service » si un document critique manque ou est échu. */
  statutEffectif?: StatutVehicule;
  /** Les documents critiques en cause, quand le véhicule est immobilisé administrativement. */
  immobilisationAdministrative?: { type: TypeDocument; etat: "echu" | "manquant" | "a-jour" | "bientot" | "permanent" }[];
}

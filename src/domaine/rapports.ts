/* ============================================================================
 * Rapports — le catalogue, et ce qu'un rapport est.
 *
 * Décision du métier du 4 septembre 2026 : « Coûts & analyses » devient
 * **Rapports**. Le coût n'est qu'une dimension parmi d'autres ; ce que
 * l'équipe parc demande, ce sont des **rapports standards** sur chaque
 * dimension — véhicules, coûts, carburant, maintenance, conformité,
 * incidents, chauffeurs, achats, prestataires — puis des **rapports
 * personnalisés** où l'on compose ses colonnes. Le tableau de bord garde son
 * rôle : le coup d'œil du matin, pas la table de données.
 *
 * Un rapport est **décrit**, jamais codé écran par écran : un identifiant, une
 * famille, la chose que compte une ligne, ses colonnes typées, et le fait
 * d'avoir ou non une fenêtre de temps. Le même descripteur sert au catalogue,
 * à la table, aux filtres, au total du pied, à l'export et aux réglages
 * enregistrés — et servira au constructeur de rapports personnalisés, qui ne
 * sera qu'un descripteur composé à la main.
 *
 * **Toutes les colonnes disponibles sont déclarées**, pas seulement celles que
 * l'on montre d'emblée : `parDefaut` dit ce qui s'affiche à l'ouverture, le
 * reste se prend dans le choix des colonnes. Mieux vaut une colonne de plus
 * dans la liste qu'une donnée que le rapport ne sait pas montrer.
 *
 * **Les filtres se déduisent des colonnes** : toute colonne de texte ou d'état
 * est une facette, dont les valeurs proposées sont celles réellement présentes
 * dans le rapport. On ne filtre donc jamais sur rien, et il n'y a pas de liste
 * de filtres à tenir à la main pour chaque rapport.
 *
 * Les lignes, elles, se construisent ailleurs (`src/donnees/rapports-demo.ts`)
 * depuis les fiches ; demain, une vue Supabase par rapport.
 * ==========================================================================*/

import type { Ton } from "./libelles";

/* -- Familles ---------------------------------------------------------------- */

export type FamilleRapport = "flotte" | "parc-leger" | "couts" | "budget" | "carburant" | "maintenance" | "conformite" | "incidents" | "chauffeurs" | "achats" | "prestataires" | "transporteurs";

export const FAMILLE_RAPPORT: Record<FamilleRapport, { libelle: string; precision: string }> = {
  flotte: { libelle: "Flotte & véhicules", precision: "Le référentiel, les affectations, la disponibilité" },
  "parc-leger": { libelle: "Parc léger", precision: "Véhicules de service et de fonction, attributaires, plan car, forfaits carburant, renouvellement" },
  couts: { libelle: "Coûts", precision: "Ce que le parc coûte, par véhicule, par poste, par activité" },
  budget: { libelle: "Budget", precision: "Ce qu'on s'est donné, ce qui est engagé, ce qu'il reste" },
  carburant: { libelle: "Carburant", precision: "Pleins, consommation et cuve interne" },
  maintenance: { libelle: "Maintenance", precision: "Interventions, ordres de travail, à-faire" },
  conformite: { libelle: "Conformité", precision: "Documents, échéances et immobilisations administratives" },
  incidents: { libelle: "Incidents & sinistres", precision: "Déclarations, responsabilité, coût, immobilisation" },
  chauffeurs: { libelle: "Chauffeurs", precision: "Effectif, permis, activité et performance SQDCM" },
  achats: { libelle: "Achats & caisse", precision: "Demandes d'achat, étapes Sage X3, journal de caisse" },
  prestataires: { libelle: "Prestataires", precision: "Garages, fournisseurs et assureurs du parc" },
  transporteurs: { libelle: "Transporteurs", precision: "Ce que le parc confie à des tiers, et à quel prix" },
};

/* -- Colonnes ---------------------------------------------------------------- */

/**
 * Le type dit comment la valeur s'aligne, se formate, se trie, se totalise et
 * se filtre. Il n'y a pas de colonne « libre » : sans type, un export ne sait
 * pas ce qu'il exporte et un total additionne des pourcentages.
 */
export type TypeValeur = "texte" | "nombre" | "montant" | "date" | "mois" | "pourcentage" | "ecart" | "distance" | "volume" | "duree" | "poids" | "etat" | "oui-non";

/** Ce qu'une colonne totalise en pied de table. */
export type TotalColonne = "somme" | "moyenne" | "aucun";

export interface ColonneRapport {
  cle: string;
  libelle: string;
  type: TypeValeur;
  /** Affichée à l'ouverture ; les autres se prennent dans « Colonnes ». */
  parDefaut: boolean;
  total?: TotalColonne;
  largeur?: number;
  /** Précision lue sous l'en-tête, quand la colonne mérite un mot. */
  precision?: string;
  /** Faux pour une colonne dont chaque ligne a sa valeur : un filtre à dix-huit choix ne filtre rien. */
  filtrable?: boolean;
}

/** Les types dont on fait une facette : ceux qui portent un vocabulaire fermé. */
const TYPES_FACETTE: TypeValeur[] = ["texte", "etat", "oui-non", "mois"];

export function estFacette(c: ColonneRapport): boolean {
  return c.filtrable ?? TYPES_FACETTE.includes(c.type);
}

/** Une valeur d'état : un libellé, un ton, et de quoi trier. */
export interface ValeurEtat {
  libelle: string;
  ton: Ton;
  rang?: number;
}

export type ValeurRapport = string | number | boolean | ValeurEtat | null;

export type LigneRapport = Record<string, ValeurRapport>;

export function estEtat(v: ValeurRapport): v is ValeurEtat {
  return typeof v === "object" && v !== null && "libelle" in v;
}

/** Ce sur quoi le tri s'appuie : le nombre, le rang de l'état, ou le libellé. */
export function cleDeTri(v: ValeurRapport): number | string {
  if (v === null) return "";
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (estEtat(v)) return v.rang ?? v.libelle;
  return v;
}

/** Le texte de la valeur, pour la recherche, la facette et l'export. */
export function texteDe(v: ValeurRapport): string {
  if (v === null) return "";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (estEtat(v)) return v.libelle;
  return v;
}

/* -- Définition d'un rapport -------------------------------------------------- */

export interface DefinitionRapport {
  id: string;
  libelle: string;
  /** Une phrase : ce que le rapport liste, et à quelle question il répond. */
  description: string;
  famille: FamilleRapport;
  /** Ce qu'une ligne compte : « véhicules », « pleins », « déclarations ». */
  unite: string;
  colonnes: ColonneRapport[];
  /** Vrai quand le rapport a une fenêtre de temps — sinon, il donne l'état du jour. */
  periode: boolean;
  /** Vrai quand le périmètre du coût (exploitation / complet, question 52) change le résultat. */
  perimetre?: boolean;
  /** Ce que la fenêtre de temps borne, dit en clair : « les pleins listés ». */
  precisionPeriode?: string;
  /** Clé de la colonne qui identifie la ligne — jamais masquée. Par défaut la première. */
  identifiant?: string;
  /** Adresse de la fiche que la ligne ouvre, quand il y en a une. */
  lien?: (ligne: LigneRapport) => string | null;
}

/* -- Fabriques de colonnes ----------------------------------------------------
   Le catalogue compte plus de deux cent cinquante colonnes : les écrire une
   propriété à la fois le rendrait illisible, donc faux. */

type Options = Partial<Omit<ColonneRapport, "cle" | "libelle" | "type">>;
const col =
  (type: TypeValeur, defauts: Options) =>
  (cle: string, libelle: string, o: Options = {}): ColonneRapport => ({ cle, libelle, type, parDefaut: false, ...defauts, ...o });

/** Texte. */
const txt = col("texte", { largeur: 160 });
/** Nombre simple. */
const num = col("nombre", { largeur: 110, total: "somme" });
/** Montant en francs. */
const mnt = col("montant", { largeur: 130, total: "somme" });
/** Date. */
const dte = col("date", { largeur: 120, filtrable: false });
/** Part ou taux, sans signe. */
const pct = col("pourcentage", { largeur: 110 });
/** Écart, lu avec son signe. */
const ecr = col("ecart", { largeur: 130 });
/** Kilomètres. */
const dst = col("distance", { largeur: 130, total: "somme" });
/** Litres. */
const vol = col("volume", { largeur: 110, total: "somme" });
/** Jours. */
const dur = col("duree", { largeur: 120, total: "somme" });
/** Kilogrammes. */
const pds = col("poids", { largeur: 120, total: "somme" });
/** Pastille d'état. */
const eta = col("etat", { largeur: 150 });
/** Oui ou non. */
const oui = col("oui-non", { largeur: 110 });

/* Les colonnes communes à tout rapport qui parle d'un véhicule. */
const IMMAT = txt("immatriculation", "Immat.", { parDefaut: true, largeur: 110, filtrable: false });
const VEHICULE = txt("vehicule", "Véhicule", { parDefaut: true, largeur: 200, filtrable: false });
const MARQUE = txt("marque", "Marque", { largeur: 130 });
const CATEGORIE = txt("categorie", "Catégorie", { parDefaut: true, largeur: 130 });
const CAT_FLOTTE = txt("categorieFlotte", "Flotte", { largeur: 120 });
const USAGE = txt("usage", "Usage", { largeur: 150 });
const ENERGIE_COL = txt("energie", "Énergie", { largeur: 110 });
const BU = txt("businessUnit", "Business unit", { parDefaut: true, largeur: 150 });
const SITE = txt("site", "Site", { largeur: 140 });
const STATUT = eta("statut", "Statut", { parDefaut: true, largeur: 150 });

const VEHICULE_SITUE = [IMMAT, VEHICULE, MARQUE, CATEGORIE, CAT_FLOTTE, USAGE, ENERGIE_COL, BU, SITE];

const lienVehicule = (l: LigneRapport, onglet?: string) => {
  const immat = typeof l.immatriculationCanonique === "string" ? l.immatriculationCanonique : null;
  return immat ? `/flotte/${immat}${onglet ? `?onglet=${onglet}` : ""}` : null;
};
const lienChauffeur = (l: LigneRapport) => (typeof l.chauffeurId === "string" ? `/chauffeurs/${l.chauffeurId}` : null);

/* -- Le catalogue ------------------------------------------------------------- */

export const RAPPORTS: DefinitionRapport[] = [
  /* ================= Flotte ================= */
  {
    id: "flotte-details",
    libelle: "Détail des véhicules",
    description: "Le référentiel complet, une ligne par véhicule : identité, caractéristiques techniques, rattachement, statut, valeur et usure.",
    famille: "flotte",
    unite: "véhicules",
    periode: false,
    lien: (l) => lienVehicule(l),
    colonnes: [
      ...VEHICULE_SITUE,
      txt("appellation", "Appellation", { largeur: 160, filtrable: false }),
      txt("typeModele", "Type / modèle", { largeur: 150, filtrable: false }),
      txt("vin", "N° de châssis", { largeur: 180, filtrable: false }),
      STATUT,
      eta("statutSaisi", "Statut saisi", { largeur: 150, precision: "avant effet des documents" }),
      txt("immobilisationMotif", "Immobilisation admin.", { largeur: 220 }),
      oui("transportSpecial", "Transport spécial"),
      oui("engage", "Engagé au parc", { precision: "compte dans D_TDPA" }),
      txt("chauffeur", "Titulaire", { parDefaut: true, largeur: 170, filtrable: false }),
      num("suppleants", "Suppléants", { largeur: 110 }),
      dst("kilometrage", "Kilométrage", { parDefaut: true }),
      dte("dateKilometrage", "Relevé le"),
      dte("miseEnCirculation", "1re mise en circulation", { largeur: 165 }),
      dte("dateImmatriculation", "Immatriculé le", { largeur: 140 }),
      num("age", "Âge", { largeur: 90, total: "moyenne", precision: "en années" }),
      pds("chargeUtile", "Charge utile"),
      pds("ptac", "PTAC"),
      pds("ptra", "PTRA"),
      pds("poidsVide", "Poids à vide"),
      num("puissanceCv", "Puissance", { largeur: 110, total: "moyenne", precision: "en CV" }),
      num("cylindree", "Cylindrée", { largeur: 110, total: "moyenne", precision: "en cm³" }),
      vol("capaciteReservoir", "Réservoir", { total: "aucun" }),
      mnt("valeurAcquisition", "Valeur d'acquisition", { largeur: 165 }),
      mnt("valeurNetteComptable", "Valeur nette comptable", { largeur: 185 }),
      num("dureeAmortissement", "Amortissement", { largeur: 145, total: "moyenne", precision: "en années" }),
      dte("finAmortissement", "Fin d'amortissement", { largeur: 165 }),
      mnt("coutDouzeMois", "Coût 12 mois", { largeur: 140 }),
      mnt("coutParKm", "Coût au km", { largeur: 120, total: "moyenne" }),
      num("consommationL100", "L/100 km", { largeur: 110, total: "moyenne" }),
      pct("disponibilite", "Disponibilité", { largeur: 130 }),
      txt("prochaineEcheance", "Prochaine échéance", { largeur: 210, filtrable: false }),
      num("documentsATraiter", "Documents à traiter", { largeur: 165 }),
      txt("attelage", "Attelage en cours", { largeur: 185, filtrable: false }),
      txt("region", "Région", { largeur: 120 }),
      txt("commentaire", "Commentaire", { largeur: 280, filtrable: false }),
    ],
  },
  {
    id: "flotte-affectations",
    libelle: "Affectations en cours",
    description: "Qui conduit quoi aujourd'hui : titulaire, suppléants, depuis quand, et les véhicules que personne ne conduit.",
    famille: "flotte",
    unite: "véhicules",
    periode: false,
    lien: (l) => lienVehicule(l, "affectations"),
    colonnes: [
      ...VEHICULE_SITUE,
      STATUT,
      eta("couverture", "Couverture", { parDefaut: true, largeur: 165 }),
      txt("titulaire", "Titulaire", { parDefaut: true, largeur: 180, filtrable: false }),
      dte("depuis", "Titulaire depuis", { parDefaut: true, largeur: 145 }),
      num("anciennete", "Ancienneté", { largeur: 125, total: "moyenne", precision: "en jours" }),
      eta("statutTitulaire", "Situation du titulaire", { largeur: 175 }),
      eta("aptitudeTitulaire", "Aptitude du titulaire", { largeur: 175 }),
      txt("suppleant", "Suppléants", { parDefaut: true, largeur: 200, filtrable: false }),
      num("nombreSuppleants", "Nb suppléants", { largeur: 135 }),
      dst("kmTitulaire", "Km du titulaire", { largeur: 150 }),
      txt("motif", "Motif de l'affectation", { largeur: 220 }),
      txt("telephone", "Téléphone du titulaire", { largeur: 165, filtrable: false }),
    ],
  },
  {
    id: "flotte-disponibilite",
    libelle: "Prêts à charger",
    description: "L'état de disponibilité du jour véhicule par véhicule, et ce qui manque à chacun pour être prêt à charger.",
    famille: "flotte",
    unite: "véhicules",
    periode: false,
    lien: (l) => lienVehicule(l),
    colonnes: [
      ...VEHICULE_SITUE,
      eta("etat", "Disponibilité", { parDefaut: true, largeur: 165 }),
      STATUT,
      eta("statutSaisi", "Statut saisi", { largeur: 150 }),
      txt("conducteur", "Conducteur du jour", { parDefaut: true, largeur: 180, filtrable: false }),
      txt("roleConducteur", "À quel titre", { largeur: 130 }),
      txt("motif", "Ce qui manque", { parDefaut: true, largeur: 280, filtrable: false }),
      txt("immobilisationMotif", "Immobilisation admin.", { largeur: 220 }),
      oui("engage", "Engagé au parc"),
      oui("transportSpecial", "Transport spécial"),
      pds("chargeUtile", "Charge utile"),
      dst("kilometrage", "Kilométrage", { total: "aucun" }),
    ],
  },
  {
    id: "flotte-sans-intervention",
    libelle: "Véhicules sans intervention",
    description: "Les véhicules qu'aucune intervention n'a touchés sur la période — préventif oublié, ou véhicule qui ne roule pas.",
    famille: "flotte",
    unite: "véhicules",
    periode: true,
    precisionPeriode: "les interventions considérées",
    lien: (l) => lienVehicule(l, "maintenance"),
    colonnes: [
      ...VEHICULE_SITUE,
      STATUT,
      dte("derniereIntervention", "Dernière intervention", { parDefaut: true, largeur: 170 }),
      num("joursDepuis", "Depuis", { parDefaut: true, largeur: 110, total: "moyenne", precision: "en jours" }),
      txt("objetDerniere", "Objet de la dernière", { largeur: 250, filtrable: false }),
      txt("garageDernier", "Dernier garage", { largeur: 185 }),
      dst("kmPeriode", "Km sur la période", { parDefaut: true, largeur: 155 }),
      dst("kilometrage", "Compteur", { largeur: 130, total: "aucun" }),
      dte("dernierPlein", "Dernier plein", { largeur: 140 }),
      txt("prochainEntretien", "Prochain entretien", { largeur: 230, filtrable: false }),
    ],
  },

  /* ================= Coûts ================= */
  {
    id: "couts-vehicule",
    libelle: "Coût par véhicule",
    description: "Le coût de possession de chaque véhicule sur la période, décomposé par famille de charges et rapporté au kilomètre.",
    famille: "couts",
    unite: "véhicules",
    periode: true,
    perimetre: true,
    precisionPeriode: "les dépenses retenues",
    lien: (l) => lienVehicule(l, "couts"),
    colonnes: [
      ...VEHICULE_SITUE,
      STATUT,
      dst("km", "Km", { parDefaut: true, largeur: 120 }),
      mnt("carburant", "Carburant", { parDefaut: true }),
      mnt("maintenance", "Maintenance", { parDefaut: true }),
      mnt("autres", "Autres", { parDefaut: true, largeur: 120 }),
      mnt("total", "Total", { parDefaut: true, largeur: 140 }),
      mnt("coutParKm", "Coût au km", { parDefaut: true, largeur: 120, total: "moyenne" }),
      mnt("coutKmCarburant", "Carburant au km", { largeur: 155, total: "moyenne" }),
      mnt("coutKmMaintenance", "Maintenance au km", { largeur: 170, total: "moyenne" }),
      ecr("ecartCategorie", "Écart à la catégorie", { parDefaut: true, largeur: 165 }),
      eta("verdict", "Verdict", { parDefaut: true, largeur: 155 }),
      ecr("tendance", "Tendance", { largeur: 130, precision: "3 mois contre 3 précédents" }),
      vol("litres", "Litres"),
      num("l100", "L/100 km", { largeur: 110, total: "moyenne" }),
      num("referenceL100", "Référence L/100", { largeur: 150, total: "aucun" }),
      ecr("ecartL100", "Écart de consommation", { largeur: 180 }),
      num("curatifs", "Curatifs", { largeur: 100 }),
      dur("immobilisation", "Immobilisation", { largeur: 150, precision: "en jours" }),
      num("age", "Âge", { largeur: 90, total: "moyenne", precision: "en années" }),
      mnt("valeurAcquisition", "Valeur d'acquisition", { largeur: 165 }),
    ],
  },
  {
    id: "couts-poste-mois",
    libelle: "Dépenses par poste",
    description: "Où va l'argent : une ligne par poste de charge, son poids dans le total, sa moyenne mensuelle et son évolution.",
    famille: "couts",
    unite: "postes",
    periode: true,
    perimetre: true,
    precisionPeriode: "les dépenses retenues",
    colonnes: [
      txt("poste", "Poste", { parDefaut: true, largeur: 190 }),
      txt("groupe", "Famille de charges", { parDefaut: true, largeur: 165 }),
      mnt("total", "Total période", { parDefaut: true, largeur: 150 }),
      pct("part", "Part", { parDefaut: true, largeur: 100 }),
      mnt("moyenneMois", "Moyenne par mois", { parDefaut: true, largeur: 165, total: "aucun" }),
      mnt("dernierMois", "Dernier mois complet", { parDefaut: true, largeur: 175 }),
      txt("quandDernier", "Quel mois", { parDefaut: true, largeur: 135, filtrable: false }),
      ecr("evolution", "Évolution", { parDefaut: true, largeur: 130, precision: "dernier mois complet contre la moyenne mensuelle" }),
      mnt("moisLePlusFort", "Mois le plus fort", { largeur: 165, total: "aucun" }),
      txt("quandLePlusFort", "Quand", { largeur: 135, filtrable: false }),
      num("vehicules", "Véhicules concernés", { largeur: 175, total: "aucun" }),
      mnt("parVehicule", "Par véhicule", { largeur: 145, total: "aucun" }),
    ],
  },
  {
    id: "couts-business-unit",
    libelle: "Coût par business unit",
    description: "Ce que chaque activité coûte en véhicules sur la période : total, part, coût au kilomètre et parc mobilisé.",
    famille: "couts",
    unite: "business units",
    periode: true,
    perimetre: true,
    precisionPeriode: "les dépenses retenues",
    colonnes: [
      txt("businessUnit", "Business unit", { parDefaut: true, largeur: 190 }),
      num("vehicules", "Véhicules", { parDefaut: true, largeur: 110 }),
      dst("km", "Km", { parDefaut: true }),
      mnt("carburant", "Carburant", { parDefaut: true }),
      mnt("maintenance", "Maintenance", { parDefaut: true }),
      mnt("autres", "Autres", { largeur: 120 }),
      mnt("total", "Total", { parDefaut: true, largeur: 150 }),
      pct("part", "Part", { parDefaut: true, largeur: 100 }),
      mnt("coutParKm", "Coût au km", { parDefaut: true, largeur: 120, total: "aucun" }),
      vol("litres", "Litres"),
      num("l100", "L/100 km", { largeur: 110, total: "aucun" }),
      num("curatifs", "Curatifs", { largeur: 100 }),
      dur("immobilisation", "Immobilisation", { largeur: 150, precision: "en jours" }),
      mnt("parVehicule", "Coût par véhicule", { largeur: 165, total: "aucun" }),
    ],
  },
  {
    id: "couts-categorie",
    libelle: "Coût par catégorie",
    description: "La comparaison qui sert à arbitrer : coût total et fourchette du coût au kilomètre, catégorie par catégorie.",
    famille: "couts",
    unite: "catégories",
    periode: true,
    perimetre: true,
    precisionPeriode: "les dépenses retenues",
    colonnes: [
      txt("categorie", "Catégorie", { parDefaut: true, largeur: 180 }),
      num("vehicules", "Véhicules", { parDefaut: true, largeur: 110 }),
      dst("km", "Km", { parDefaut: true }),
      mnt("total", "Coût total", { parDefaut: true, largeur: 150 }),
      mnt("coutParKmMedian", "Coût au km médian", { parDefaut: true, largeur: 170, total: "aucun" }),
      mnt("coutParKmMin", "Le plus économe", { parDefaut: true, largeur: 155, total: "aucun" }),
      mnt("coutParKmMax", "Le plus coûteux", { parDefaut: true, largeur: 155, total: "aucun" }),
      txt("vehiculeMax", "Véhicule le plus coûteux", { largeur: 210, filtrable: false }),
      vol("litres", "Litres"),
      num("l100", "L/100 km", { largeur: 110, total: "aucun" }),
      num("referenceL100", "Référence L/100", { largeur: 150, total: "aucun" }),
      num("aArbitrer", "À arbitrer", { largeur: 125, precision: "au-delà de la médiane" }),
      dur("immobilisation", "Immobilisation", { largeur: 150, precision: "en jours" }),
    ],
  },

  /* ================= Carburant ================= */
  {
    id: "carburant-pleins",
    libelle: "Pleins par véhicule",
    description: "Le détail de chaque plein : date, litres, prix du litre, montant, compteur relevé, bon de sortie et provenance.",
    famille: "carburant",
    unite: "pleins",
    periode: true,
    precisionPeriode: "les pleins listés",
    lien: (l) => lienVehicule(l, "carburant"),
    colonnes: [
      dte("date", "Date", { parDefaut: true, largeur: 110 }),
      ...VEHICULE_SITUE,
      eta("provenance", "Provenance", { parDefaut: true, largeur: 145 }),
      txt("source", "Source", { largeur: 175, filtrable: false }),
      vol("litres", "Litres", { parDefaut: true }),
      mnt("prixLitre", "Prix du litre", { parDefaut: true, largeur: 130, total: "moyenne" }),
      mnt("montant", "Montant", { parDefaut: true }),
      dst("km", "Compteur", { parDefaut: true, largeur: 120, total: "aucun" }),
      dst("kmParcourus", "Km depuis le plein précédent", { largeur: 215 }),
      num("l100", "L/100 km", { largeur: 110, total: "moyenne", precision: "depuis le plein précédent" }),
      txt("reference", "Bon de sortie", { largeur: 150, filtrable: false }),
      txt("releve", "Relevé du compteur", { largeur: 210 }),
      txt("numero", "Réf.", { largeur: 150, filtrable: false }),
      oui("creee", "Saisi dans l'application"),
    ],
  },
  {
    id: "carburant-consommation",
    libelle: "Consommation par véhicule",
    description: "Les litres aux 100 km de chaque véhicule sur la période, contre la référence de sa catégorie — la dérive se voit ici.",
    famille: "carburant",
    unite: "véhicules",
    periode: true,
    perimetre: true,
    precisionPeriode: "les pleins et les kilomètres retenus",
    lien: (l) => lienVehicule(l, "carburant"),
    colonnes: [
      ...VEHICULE_SITUE,
      STATUT,
      dst("km", "Km", { parDefaut: true, largeur: 120 }),
      vol("litres", "Litres", { parDefaut: true, largeur: 120 }),
      num("l100", "L/100 km", { parDefaut: true, largeur: 110, total: "moyenne" }),
      num("reference", "Référence", { parDefaut: true, largeur: 110, total: "aucun" }),
      ecr("ecart", "Écart", { parDefaut: true, largeur: 110 }),
      eta("verdict", "Verdict", { parDefaut: true, largeur: 155 }),
      mnt("cout", "Coût carburant", { parDefaut: true, largeur: 155 }),
      mnt("coutParKm", "Carburant au km", { largeur: 155, total: "moyenne" }),
      mnt("prixMoyen", "Prix moyen du litre", { largeur: 170, total: "moyenne" }),
      num("pleins", "Nb de pleins", { largeur: 130 }),
      vol("moyenneParPlein", "Litres par plein", { largeur: 155, total: "moyenne" }),
    ],
  },
  {
    id: "carburant-cuve",
    libelle: "Journal de la cuve",
    description: "Les mouvements de la cuve interne : livraisons, sorties par plein et relevés de jauge, avec le stock recalculé.",
    famille: "carburant",
    unite: "mouvements",
    periode: true,
    precisionPeriode: "les mouvements listés",
    colonnes: [
      dte("date", "Date", { parDefaut: true, largeur: 110 }),
      txt("numero", "Réf.", { parDefaut: true, largeur: 150, filtrable: false }),
      eta("sens", "Sens", { parDefaut: true, largeur: 135 }),
      txt("libelle", "Libellé", { parDefaut: true, largeur: 260, filtrable: false }),
      vol("entree", "Entrée", { parDefaut: true }),
      vol("sortie", "Sortie", { parDefaut: true }),
      vol("stock", "Stock après", { parDefaut: true, largeur: 130, total: "aucun" }),
      vol("ecart", "Écart de jauge", { largeur: 150, total: "aucun" }),
      mnt("montant", "Montant"),
      mnt("prixLitre", "Prix du litre", { largeur: 130, total: "moyenne" }),
      txt("fournisseur", "Fournisseur", { largeur: 190 }),
      txt("piece", "Pièce", { largeur: 150, filtrable: false }),
      txt("immatriculation", "Véhicule", { largeur: 120, filtrable: false }),
      txt("pleinNumero", "Plein rattaché", { largeur: 155, filtrable: false }),
      txt("enregistrePar", "Enregistré par", { largeur: 175 }),
    ],
  },

  /* ================= Maintenance ================= */
  {
    id: "maintenance-interventions",
    libelle: "Interventions",
    description: "Toutes les interventions de la période : préventif ou curatif, garage, coût, compteur et immobilisation.",
    famille: "maintenance",
    unite: "interventions",
    periode: true,
    precisionPeriode: "les interventions listées",
    lien: (l) => lienVehicule(l, "maintenance"),
    colonnes: [
      dte("date", "Date", { parDefaut: true, largeur: 110 }),
      ...VEHICULE_SITUE,
      eta("type", "Type", { parDefaut: true, largeur: 120 }),
      txt("objet", "Objet", { parDefaut: true, largeur: 280, filtrable: false }),
      txt("garage", "Garage", { parDefaut: true, largeur: 190 }),
      dst("km", "Compteur", { largeur: 120, total: "aucun" }),
      mnt("cout", "Coût", { parDefaut: true }),
      dur("immobilisation", "Immobilisation", { parDefaut: true, largeur: 150, precision: "en jours" }),
      mnt("coutParJour", "Coût par jour immobilisé", { largeur: 205, total: "moyenne" }),
      txt("reference", "Pièce", { largeur: 150, filtrable: false }),
      txt("numero", "Réf.", { largeur: 150, filtrable: false }),
      oui("creee", "Saisie dans l'application"),
    ],
  },
  {
    id: "maintenance-ordres",
    libelle: "Ordres de travail",
    description: "Les ordres et où ils en sont : garage retenu, montant estimé, immobilisation prévue, et l'intervention qui les clôt.",
    famille: "maintenance",
    unite: "ordres",
    periode: true,
    precisionPeriode: "la date prévue",
    lien: (l) => lienVehicule(l, "maintenance"),
    colonnes: [
      txt("numero", "Réf.", { parDefaut: true, largeur: 150, filtrable: false }),
      dte("date", "Prévu le", { parDefaut: true, largeur: 120 }),
      ...VEHICULE_SITUE,
      eta("statut", "Statut", { parDefaut: true, largeur: 150 }),
      eta("type", "Type", { parDefaut: true, largeur: 120 }),
      txt("objet", "Objet", { parDefaut: true, largeur: 280, filtrable: false }),
      txt("garage", "Garage", { parDefaut: true, largeur: 190 }),
      mnt("montant", "Montant estimé", { parDefaut: true, largeur: 155 }),
      dur("immobilisationPrevue", "Immobilisation prévue", { largeur: 185, precision: "en jours" }),
      dte("dateDebut", "Entré à l'atelier", { largeur: 155 }),
      dte("dateCloture", "Clos le", { largeur: 120 }),
      num("delaiCloture", "Délai de clôture", { largeur: 155, total: "moyenne", precision: "en jours" }),
      txt("origineNumero", "Transaction d'origine", { largeur: 180, filtrable: false }),
      txt("origineLibelle", "Ce qui l'a motivé", { largeur: 250, filtrable: false }),
      txt("interventionNumero", "Intervention", { largeur: 150, filtrable: false }),
      txt("demandeur", "Demandeur", { largeur: 175 }),
      txt("commentaire", "Commentaire", { largeur: 260, filtrable: false }),
    ],
  },
  {
    id: "maintenance-a-faire",
    libelle: "À faire",
    description: "Ce que les fiches réclament et qui n'est pas encore fait : observations de visite, préventif dû, suites d'incident.",
    famille: "maintenance",
    unite: "travaux",
    periode: false,
    colonnes: [
      ...VEHICULE_SITUE,
      txt("origine", "Origine", { parDefaut: true, largeur: 175 }),
      eta("urgence", "Urgence", { parDefaut: true, largeur: 150 }),
      eta("type", "Type", { largeur: 120 }),
      txt("libelle", "Travail", { parDefaut: true, largeur: 300, filtrable: false }),
      txt("echeance", "Échéance", { parDefaut: true, largeur: 180, filtrable: false }),
      dst("kmRestants", "Km restants", { largeur: 135, total: "aucun" }),
      num("joursRestants", "Jours restants", { largeur: 135, total: "aucun" }),
      txt("ordreNumero", "Ordre déjà ouvert", { largeur: 165, filtrable: false }),
      txt("origineNumero", "Réf. d'origine", { largeur: 150, filtrable: false }),
    ],
  },

  /* ================= Conformité ================= */
  {
    id: "conformite-documents",
    libelle: "Documents et échéances",
    description: "Tous les documents du parc et des chauffeurs, leur état, leur échéance et ce qu'ils immobilisent — l'échéancier en table.",
    famille: "conformite",
    unite: "documents",
    periode: false,
    identifiant: "porteur",
    colonnes: [
      txt("porteur", "Porteur", { parDefaut: true, largeur: 170, filtrable: false }),
      txt("typePorteur", "Type de porteur", { parDefaut: true, largeur: 145 }),
      txt("document", "Document", { parDefaut: true, largeur: 180 }),
      eta("etat", "État", { parDefaut: true, largeur: 150 }),
      dte("echeance", "Échéance", { parDefaut: true, largeur: 120 }),
      num("joursRestants", "Jours restants", { parDefaut: true, largeur: 140, total: "aucun" }),
      dte("dateEffet", "Date d'effet", { largeur: 125 }),
      oui("critique", "Immobilise", { parDefaut: true }),
      txt("emetteur", "Émetteur", { largeur: 210 }),
      txt("numeroPiece", "N° de pièce", { largeur: 150, filtrable: false }),
      mnt("montant", "Coût du document", { largeur: 160 }),
      oui("justificatif", "Justificatif"),
      CATEGORIE,
      BU,
      SITE,
      num("validite", "Validité", { largeur: 120, total: "aucun", precision: "en mois" }),
    ],
  },

  /* ================= Incidents ================= */
  {
    id: "incidents-declarations",
    libelle: "Déclarations d'incidents",
    description: "Accidents et incidents déclarés : nature, mission, responsabilité, coût rattaché, immobilisation et suivi du dossier.",
    famille: "incidents",
    unite: "déclarations",
    periode: true,
    precisionPeriode: "les déclarations listées",
    lien: (l) => lienVehicule(l, "incidents"),
    colonnes: [
      dte("date", "Date", { parDefaut: true, largeur: 110 }),
      txt("heure", "Heure", { largeur: 90, filtrable: false }),
      ...VEHICULE_SITUE,
      eta("nature", "Nature", { parDefaut: true, largeur: 120 }),
      txt("type", "Type", { parDefaut: true, largeur: 170 }),
      txt("chauffeur", "Conducteur", { parDefaut: true, largeur: 170, filtrable: false }),
      txt("lieu", "Lieu", { largeur: 220, filtrable: false }),
      txt("mission", "Mission", { largeur: 150 }),
      txt("responsabilite", "Responsabilité", { parDefaut: true, largeur: 155 }),
      eta("roulant", "Roulant", { largeur: 130 }),
      oui("blesses", "Blessés"),
      oui("sinistreOuvert", "Dossier sinistre"),
      mnt("cout", "Coût", { parDefaut: true }),
      dur("immobilisation", "Immobilisation", { parDefaut: true, largeur: 150, precision: "en jours" }),
      eta("statut", "Suivi", { parDefaut: true, largeur: 155 }),
      dst("kilometrage", "Compteur", { largeur: 120, total: "aucun" }),
      txt("declarant", "Déclarant", { largeur: 175 }),
      txt("numero", "Réf.", { largeur: 150, filtrable: false }),
      txt("description", "Description", { largeur: 320, filtrable: false }),
    ],
  },

  /* ================= Chauffeurs ================= */
  {
    id: "chauffeurs-details",
    libelle: "Détail des chauffeurs",
    description: "L'effectif conducteur : statut, aptitude, permis, visite médicale, véhicule titulaire, activité et antécédents.",
    famille: "chauffeurs",
    unite: "chauffeurs",
    periode: false,
    identifiant: "nom",
    lien: lienChauffeur,
    colonnes: [
      txt("nom", "Chauffeur", { parDefaut: true, largeur: 190, filtrable: false }),
      txt("matricule", "Matricule", { largeur: 120, filtrable: false }),
      eta("statut", "Statut", { parDefaut: true, largeur: 150 }),
      eta("aptitude", "Aptitude", { parDefaut: true, largeur: 150 }),
      eta("conformite", "Conformité", { parDefaut: true, largeur: 155 }),
      txt("vehicule", "Véhicule titulaire", { parDefaut: true, largeur: 170, filtrable: false }),
      txt("suppleances", "Suppléances", { largeur: 185, filtrable: false }),
      SITE,
      txt("contrat", "Contrat", { largeur: 140 }),
      txt("permis", "Catégories de permis", { largeur: 180 }),
      txt("permisNumero", "N° de permis", { largeur: 150, filtrable: false }),
      dte("permisEcheance", "Permis échéance", { parDefaut: true, largeur: 155 }),
      dte("visiteMedicale", "Visite médicale", { parDefaut: true, largeur: 150 }),
      dst("kmDouzeMois", "Km 12 mois", { largeur: 140 }),
      num("contraventions", "Contraventions", { largeur: 150, precision: "sur 12 mois" }),
      num("incidents", "Incidents", { largeur: 120, precision: "sur 12 mois" }),
      txt("indisponibilite", "Indisponibilité en cours", { largeur: 205 }),
      dte("embauche", "Embauché le", { largeur: 130 }),
      num("anciennete", "Ancienneté", { largeur: 130, total: "moyenne", precision: "en années" }),
      txt("telephone", "Téléphone", { largeur: 145, filtrable: false }),
      txt("aptitudeMotif", "Motif d'aptitude", { largeur: 240, filtrable: false }),
    ],
  },
  {
    id: "chauffeurs-performance",
    libelle: "Performance SQDCM",
    description: "Le classement du mois révolu : score par axe, rang, évolution et part de prime attribuée.",
    famille: "chauffeurs",
    unite: "chauffeurs",
    periode: false,
    identifiant: "nom",
    lien: lienChauffeur,
    colonnes: [
      num("rang", "Rang", { parDefaut: true, largeur: 80, total: "aucun" }),
      txt("nom", "Chauffeur", { parDefaut: true, largeur: 190, filtrable: false }),
      txt("vehicule", "Véhicule", { parDefaut: true, largeur: 150, filtrable: false }),
      SITE,
      num("score", "Score", { parDefaut: true, largeur: 100, total: "moyenne" }),
      eta("tranche", "Tranche", { parDefaut: true, largeur: 145 }),
      pct("prime", "Part de prime", { parDefaut: true, largeur: 145 }),
      num("securite", "S", { parDefaut: true, largeur: 80, total: "moyenne", precision: "Sécurité" }),
      num("qualite", "Q", { parDefaut: true, largeur: 80, total: "moyenne", precision: "Qualité" }),
      num("delai", "D", { parDefaut: true, largeur: 80, total: "moyenne", precision: "Délai" }),
      num("cout", "C", { parDefaut: true, largeur: 80, total: "moyenne", precision: "Coût" }),
      num("moral", "M", { parDefaut: true, largeur: 80, total: "moyenne", precision: "Moral" }),
      dst("km", "Km du mois", { parDefaut: true, largeur: 140 }),
      num("rangPrecedent", "Rang précédent", { largeur: 150, total: "aucun" }),
      txt("evolution", "Évolution", { largeur: 125 }),
      oui("classable", "Classable"),
      txt("eliminatoire", "Éliminé par", { largeur: 240, filtrable: false }),
    ],
  },

  /* ================= Achats & caisse ================= */
  {
    id: "achats-demandes",
    libelle: "Demandes d'achat",
    description: "Les demandes et l'étape où chacune en est — visa, validation, puis ce qui est constaté depuis Sage X3.",
    famille: "achats",
    unite: "demandes",
    periode: true,
    precisionPeriode: "la date de la demande",
    lien: (l) => lienVehicule(l),
    colonnes: [
      txt("numero", "Réf.", { parDefaut: true, largeur: 150, filtrable: false }),
      dte("date", "Date", { parDefaut: true, largeur: 110 }),
      txt("objet", "Objet", { parDefaut: true, largeur: 280, filtrable: false }),
      eta("etape", "Étape", { parDefaut: true, largeur: 155 }),
      eta("urgence", "Urgence", { largeur: 135 }),
      IMMAT,
      VEHICULE,
      BU,
      SITE,
      txt("poste", "Poste", { parDefaut: true, largeur: 150 }),
      txt("fournisseur", "Fournisseur", { parDefaut: true, largeur: 190 }),
      mnt("montantEstime", "Estimé", { parDefaut: true }),
      mnt("montantEngage", "Engagé"),
      mnt("montantReel", "Facturé", { parDefaut: true }),
      ecr("ecartEstimation", "Écart à l'estimation", { largeur: 175 }),
      txt("numeroDemandeX3", "DA Sage X3", { largeur: 150, filtrable: false }),
      txt("numeroBonCommande", "BC Sage X3", { largeur: 150, filtrable: false }),
      txt("demandeur", "Demandeur", { largeur: 175 }),
      txt("visaPar", "Visa du parc", { largeur: 175 }),
      dte("visaLe", "Visé le", { largeur: 120 }),
      txt("validePar", "Validée par", { largeur: 175 }),
      dte("valideeLe", "Validée le", { largeur: 125 }),
      dte("dateLivraison", "Livrée le", { largeur: 120 }),
      dte("dateFacture", "Facturée le", { largeur: 130 }),
      dte("dateReglement", "Réglée le", { largeur: 120 }),
      num("delaiTotal", "Délai total", { largeur: 135, total: "moyenne", precision: "en jours" }),
      txt("origineNumero", "Transaction d'origine", { largeur: 180, filtrable: false }),
      txt("depenseNumero", "Dépense du véhicule", { largeur: 175, filtrable: false }),
    ],
  },
  {
    id: "caisse-journal",
    libelle: "Journal de caisse",
    description: "Les entrées et sorties de la caisse parc, la dépense que chaque sortie règle, le justificatif et le solde.",
    famille: "achats",
    unite: "mouvements",
    periode: true,
    precisionPeriode: "les mouvements listés",
    lien: (l) => lienVehicule(l, "couts"),
    colonnes: [
      dte("date", "Date", { parDefaut: true, largeur: 110 }),
      txt("numero", "Réf.", { parDefaut: true, largeur: 150, filtrable: false }),
      eta("sens", "Sens", { largeur: 135 }),
      txt("libelle", "Libellé", { parDefaut: true, largeur: 280, filtrable: false }),
      mnt("entree", "Entrée", { parDefaut: true, largeur: 120 }),
      mnt("sortie", "Sortie", { parDefaut: true, largeur: 120 }),
      mnt("solde", "Solde après", { largeur: 140, total: "aucun" }),
      IMMAT,
      VEHICULE,
      txt("poste", "Poste", { parDefaut: true, largeur: 150 }),
      BU,
      SITE,
      txt("beneficiaire", "Bénéficiaire", { parDefaut: true, largeur: 185 }),
      eta("justificatif", "Justificatif", { parDefaut: true, largeur: 140 }),
      txt("piece", "Pièce de caisse", { largeur: 160, filtrable: false }),
      txt("depenseNumero", "Dépense réglée", { largeur: 160, filtrable: false }),
      txt("enregistrePar", "Enregistré par", { largeur: 175 }),
      oui("creee", "Saisi dans l'application"),
    ],
  },

  /* ================= Prestataires ================= */
  {
    id: "prestataires-activite",
    libelle: "Activité des prestataires",
    description: "Ce que chaque garage, fournisseur ou assureur a représenté sur douze mois : achats, montants, reste à régler et délais.",
    famille: "prestataires",
    unite: "prestataires",
    periode: false,
    identifiant: "nom",
    lien: (l) => (typeof l.numero === "string" ? `/prestataires/${l.numero}` : null),
    colonnes: [
      txt("nom", "Prestataire", { parDefaut: true, largeur: 220, filtrable: false }),
      txt("numero", "Réf.", { largeur: 140, filtrable: false }),
      txt("type", "Type", { parDefaut: true, largeur: 160 }),
      eta("actif", "Statut", { parDefaut: true, largeur: 110 }),
      txt("ville", "Ville", { largeur: 140 }),
      num("demandes", "Achats 12 mois", { parDefaut: true, largeur: 145 }),
      mnt("montant", "Montant 12 mois", { parDefaut: true, largeur: 165 }),
      mnt("enAttente", "Non réglé", { parDefaut: true, largeur: 140 }),
      num("nombreEnAttente", "Demandes en attente", { largeur: 175 }),
      dur("delai", "Délai de règlement", { parDefaut: true, largeur: 170, total: "moyenne" }),
      num("refusees", "Demandes refusées", { largeur: 170 }),
      mnt("panierMoyen", "Montant moyen", { largeur: 155, total: "moyenne" }),
      txt("contact", "Contact", { largeur: 175, filtrable: false }),
      txt("telephone", "Téléphone", { largeur: 145, filtrable: false }),
      txt("courriel", "Courriel", { largeur: 210, filtrable: false }),
      txt("adresse", "Adresse", { largeur: 240, filtrable: false }),
      txt("ninea", "NINEA", { largeur: 140, filtrable: false }),
      num("delaiPaiement", "Délai convenu", { largeur: 150, total: "aucun", precision: "en jours" }),
      txt("note", "Note", { largeur: 300, filtrable: false }),
    ],
  },

  /* ================= Transporteurs ================= */
  {
    id: "transporteurs-affretements",
    libelle: "Affrètements",
    description: "Les missions confiées à des tiers : trajet, tonnage, motif, prix convenu, prix facturé et écart à la grille.",
    famille: "transporteurs",
    unite: "affrètements",
    periode: true,
    precisionPeriode: "la date de la mission",
    colonnes: [
      txt("numero", "Réf.", { parDefaut: true, largeur: 150, filtrable: false }),
      dte("date", "Date", { parDefaut: true, largeur: 110 }),
      txt("transporteur", "Transporteur", { parDefaut: true, largeur: 175 }),
      txt("origine", "Origine", { largeur: 160 }),
      txt("destination", "Destination", { parDefaut: true, largeur: 160 }),
      BU,
      txt("motif", "Motif", { parDefaut: true, largeur: 185 }),
      oui("subi", "Externalisation subie", { precision: "aucun véhicule, ou immobilisé" }),
      txt("categorie", "Porteur demandé", { largeur: 150 }),
      num("tonnage", "Tonnage", { parDefaut: true, largeur: 110, precision: "en tonnes" }),
      dst("distance", "Distance", { largeur: 120 }),
      txt("tarif", "Tarif appliqué", { largeur: 165, filtrable: false }),
      eta("baseTarif", "Base tarifaire", { largeur: 155 }),
      mnt("duNet", "Dû net", { parDefaut: true, largeur: 130 }),
      mnt("factureTtc", "Facturé TTC", { parDefaut: true, largeur: 140 }),
      mnt("retenue", "Retenue à la source", { largeur: 165 }),
      mnt("net", "Net au transporteur", { largeur: 170 }),
      ecr("ecart", "Écart à la grille", { parDefaut: true, largeur: 155 }),
      eta("statut", "Étape", { parDefaut: true, largeur: 135 }),
      dte("dateLivraison", "Livré le", { largeur: 120 }),
      dte("dateFacture", "Facturé le", { largeur: 125 }),
      dte("dateReglement", "Réglé le", { largeur: 120 }),
      txt("referenceFacture", "N° de facture", { largeur: 145, filtrable: false }),
      txt("numeroDemandeX3", "DA Sage X3", { largeur: 150, filtrable: false }),
      txt("immatriculationExterne", "Camion du tiers", { largeur: 145, filtrable: false }),
      txt("chauffeurExterne", "Chauffeur du tiers", { largeur: 165, filtrable: false }),
      txt("demandeur", "Demandeur", { largeur: 175 }),
    ],
  },
  {
    id: "transport-releve",
    libelle: "Relevé de transport",
    description:
      "Ce qui est sorti, chargement par chargement : qui a exécuté, avec quel camion, pour quelle destination, et combien de tonnes. Le parc et les tiers côte à côte — la vue que le compte rendu ADEX du 10 avril réclame.",
    famille: "transporteurs",
    unite: "chargements",
    periode: true,
    precisionPeriode: "la date du chargement",
    colonnes: [
      txt("numero", "Réf.", { parDefaut: true, largeur: 150, filtrable: false }),
      dte("date", "Date", { parDefaut: true, largeur: 110 }),
      txt("semaine", "Semaine", { largeur: 110 }),
      eta("mode", "Exécuté par", { parDefaut: true, largeur: 165 }),
      txt("transporteur", "Transporteur", { parDefaut: true, largeur: 175 }),
      txt("camion", "Camion", { parDefaut: true, largeur: 130 }),
      oui("suivi", "Camion du référentiel", { precision: "sinon, simple mention sur la ligne" }),
      txt("chauffeur", "Chauffeur", { largeur: 165 }),
      txt("origine", "Origine", { largeur: 120 }),
      txt("destination", "Destination", { parDefaut: true, largeur: 155 }),
      txt("destinationTarifaire", "Destination tarifaire", { largeur: 175 }),
      txt("produit", "Produit", { parDefaut: true, largeur: 150 }),
      num("tonnage", "Tonnage annoncé", { parDefaut: true, largeur: 150, precision: "en tonnes" }),
      num("tonnagePese", "Tonnage pesé", { parDefaut: true, largeur: 140, precision: "pont bascule" }),
      ecr("ecartPesee", "Écart de pesée", { largeur: 145 }),
      txt("bonLivraison", "Bon de livraison", { largeur: 155, filtrable: false }),
      txt("affretement", "Affrètement", { largeur: 150, filtrable: false }),
    ],
  },
  {
    id: "transporteurs-activite",
    libelle: "Activité des transporteurs",
    description: "Ce que chaque transporteur a représenté : missions, tonnes, coût, restant dû et écart moyen de facturation.",
    famille: "transporteurs",
    unite: "transporteurs",
    periode: true,
    precisionPeriode: "les missions retenues",
    identifiant: "transporteur",
    lien: (l) => (typeof l.numero === "string" ? `/prestataires/${l.numero}` : null),
    colonnes: [
      txt("transporteur", "Transporteur", { parDefaut: true, largeur: 200, filtrable: false }),
      txt("numero", "Réf.", { largeur: 140, filtrable: false }),
      txt("ville", "Ville", { largeur: 140 }),
      num("missions", "Missions", { parDefaut: true, largeur: 120 }),
      num("tonnes", "Tonnes", { parDefaut: true, largeur: 120, precision: "livrées" }),
      mnt("cout", "Coût", { parDefaut: true, largeur: 150 }),
      mnt("du", "Restant dû", { parDefaut: true, largeur: 140 }),
      ecr("ecartMoyen", "Écart moyen", { parDefaut: true, largeur: 145 }),
      num("horsTolerance", "Hors tolérance", { parDefaut: true, largeur: 150, precision: "au-delà de 5 %" }),
      num("subies", "Missions subies", { largeur: 155 }),
      eta("baseTarif", "Base tarifaire", { parDefaut: true, largeur: 155 }),
      num("lignesGrille", "Lignes de grille", { largeur: 150, total: "aucun" }),
      mnt("panier", "Coût moyen par mission", { largeur: 195, total: "moyenne" }),
    ],
  },
  {
    id: "transporteurs-mises-a-disposition",
    libelle: "Mises à disposition",
    description: "Le modèle ADEX, mois par mois : jours payés, jours roulés, location, carburant servi à la cuve et coût complet.",
    famille: "transporteurs",
    unite: "mois de mise à disposition",
    periode: true,
    precisionPeriode: "le mois servi",
    colonnes: [
      txt("numero", "Réf.", { parDefaut: true, largeur: 150, filtrable: false }),
      txt("mois", "Mois", { parDefaut: true, largeur: 110 }),
      txt("transporteur", "Transporteur", { parDefaut: true, largeur: 175 }),
      txt("immatriculation", "Véhicule", { parDefaut: true, largeur: 140 }),
      txt("famille", "Ce qu'il porte", { parDefaut: true, largeur: 200 }),
      mnt("prixJour", "Prix du jour", { parDefaut: true, largeur: 130, total: "moyenne" }),
      num("joursDus", "Jours dus", { parDefaut: true, largeur: 115 }),
      num("joursRoules", "Jours roulés", { parDefaut: true, largeur: 125 }),
      num("joursPerdus", "Jours payés non roulés", { parDefaut: true, largeur: 190, precision: "le contrat les paie, le pointage ne les voit pas" }),
      num("joursPanne", "Jours de panne", { largeur: 145, precision: "déduits de la facture" }),
      mnt("location", "Location", { parDefaut: true, largeur: 140 }),
      vol("carburantLitres", "Carburant", { parDefaut: true, largeur: 125, precision: "servi à la cuve SEDIMA" }),
      mnt("carburantMontant", "Coût carburant", { parDefaut: true, largeur: 150 }),
      mnt("total", "Coût complet", { parDefaut: true, largeur: 150 }),
      num("tonnes", "Tonnes portées", { parDefaut: true, largeur: 150 }),
      mnt("parJour", "Coût par jour", { largeur: 140, total: "moyenne" }),
      mnt("parTonne", "Coût à la tonne", { parDefaut: true, largeur: 150, total: "moyenne" }),
      eta("statut", "Étape", { parDefaut: true, largeur: 130 }),
      eta("convention", "Convention", { largeur: 175 }),
      dte("dateFacture", "Facturé le", { largeur: 125 }),
      dte("dateReglement", "Réglé le", { largeur: 120 }),
      txt("referenceFacture", "N° de facture", { largeur: 150, filtrable: false }),
      txt("numeroDemandeX3", "DA Sage X3", { largeur: 150, filtrable: false }),
      txt("commentaire", "Commentaire", { largeur: 220, filtrable: false }),
    ],
  },
  {
    id: "transporteurs-prestations",
    libelle: "Prestations hors grille",
    description: "Ce qu'aucune grille ne couvre : œufs, farine, transport du personnel, liaisons Gambie — et sur quel prix la retenue s'applique.",
    famille: "transporteurs",
    unite: "prestations",
    periode: true,
    precisionPeriode: "la date de la prestation",
    colonnes: [
      txt("numero", "Réf.", { parDefaut: true, largeur: 150, filtrable: false }),
      dte("date", "Date", { parDefaut: true, largeur: 110 }),
      txt("transporteur", "Transporteur", { parDefaut: true, largeur: 175 }),
      txt("libelle", "Prestation", { parDefaut: true, largeur: 250 }),
      BU,
      txt("unite", "Base", { parDefaut: true, largeur: 140 }),
      num("quantite", "Quantité", { parDefaut: true, largeur: 115 }),
      mnt("prixUnitaire", "Prix unitaire", { parDefaut: true, largeur: 140, total: "moyenne" }),
      mnt("convenu", "Convenu", { parDefaut: true, largeur: 140 }),
      mnt("factureTtc", "Facturé", { parDefaut: true, largeur: 140 }),
      mnt("retenue", "Retenue à la source", { largeur: 165 }),
      mnt("net", "Net au transporteur", { parDefaut: true, largeur: 170 }),
      eta("convention", "Convention", { parDefaut: true, largeur: 175, precision: "sur quel prix la retenue s'applique" }),
      eta("statut", "Étape", { parDefaut: true, largeur: 130 }),
      dte("dateFacture", "Facturé le", { largeur: 125 }),
      dte("dateReglement", "Réglé le", { largeur: 120 }),
      txt("referenceFacture", "N° de facture", { largeur: 150, filtrable: false }),
      txt("numeroDemandeX3", "DA Sage X3", { largeur: 150, filtrable: false }),
      txt("commentaire", "Commentaire", { largeur: 260, filtrable: false }),
    ],
  },

  /* ================= Transporteurs — l'efficacité ================= *
   * Demande du métier du 5 septembre 2026 : « inclure le rapport pour les
   * transporteurs de l'efficacité du transport au franc à la tonne livrée ».
   * C'est la comparaison qui décide : elle met le parc SEDIMA sur la même
   * ligne que les tiers, parce qu'un taux d'externalisation ne se pilote pas
   * sans savoir lequel des deux coûte le moins cher à la tonne. */
  {
    id: "transporteurs-efficacite",
    libelle: "Efficacité du transport — F/tonne",
    description: "Le coût de la tonne livrée, transporteur par transporteur, le parc SEDIMA compris : la seule comparaison qui tranche entre faire et faire faire.",
    famille: "transporteurs",
    unite: "transporteurs",
    periode: true,
    precisionPeriode: "les chargements comptés",
    identifiant: "transporteur",
    colonnes: [
      txt("transporteur", "Transporteur", { parDefaut: true, largeur: 190, filtrable: false }),
      eta("nature", "Nature", { parDefaut: true, largeur: 130, precision: "parc propre ou tiers" }),
      num("tonnes", "Tonnes livrées", { parDefaut: true, largeur: 145, precision: "en tonnes" }),
      num("chargements", "Chargements", { parDefaut: true, largeur: 135 }),
      mnt("cout", "Coût", { parDefaut: true, largeur: 145 }),
      mnt("coutTonne", "Coût à la tonne", { parDefaut: true, largeur: 160, total: "moyenne", precision: "le chiffre qui compare" }),
      ecr("ecartReference", "Écart au parc", { parDefaut: true, largeur: 145, precision: "en % du coût à la tonne du parc SEDIMA" }),
      pct("partTonnes", "Part des tonnes", { parDefaut: true, largeur: 150 }),
      pct("partCout", "Part du coût", { parDefaut: true, largeur: 140 }),
      num("camions", "Camions", { largeur: 115 }),
      num("tonnesParChargement", "Tonnes/chargement", { largeur: 175, total: "moyenne" }),
      num("destinations", "Destinations", { largeur: 135 }),
      pct("partPesee", "Chargements pesés", { largeur: 165, precision: "part des chargements passés au pont bascule" }),
      ecr("ecartPeseeMoyen", "Écart de pesée", { largeur: 150, precision: "annoncé contre pesé, en %" }),
      eta("contrat", "Contrat", { parDefaut: true, largeur: 145 }),
      txt("modes", "Rémunération", { largeur: 190 }),
      txt("numero", "Réf.", { largeur: 150, filtrable: false }),
    ],
  },
  {
    id: "transport-destinations",
    libelle: "Coût par destination",
    description: "Ce que coûte la tonne livrée sur chaque destination, et par quels moyens elle y va — le tarif de la grille confronté au réel.",
    famille: "transporteurs",
    unite: "destinations",
    periode: true,
    precisionPeriode: "les chargements comptés",
    identifiant: "destination",
    colonnes: [
      txt("destination", "Destination", { parDefaut: true, largeur: 190, filtrable: false }),
      txt("destinationTarifaire", "Destination tarifaire", { parDefaut: true, largeur: 190, precision: "la destination de la grille à laquelle celle-ci est rattachée" }),
      oui("rattachee", "Rattachée", { parDefaut: true, precision: "vrai quand la grille connaît la destination" }),
      num("tonnes", "Tonnes livrées", { parDefaut: true, largeur: 145, precision: "en tonnes" }),
      num("chargements", "Chargements", { parDefaut: true, largeur: 135 }),
      num("transporteurs", "Transporteurs", { parDefaut: true, largeur: 145 }),
      pct("partParc", "Part du parc", { parDefaut: true, largeur: 140, precision: "tonnes portées par la flotte SEDIMA" }),
      mnt("tarifGrille", "Tarif de grille", { largeur: 155, total: "moyenne" }),
      num("tonnesParChargement", "Tonnes/chargement", { largeur: 175, total: "moyenne" }),
      txt("produits", "Produits", { largeur: 200 }),
      dte("premier", "Premier chargement", { largeur: 165 }),
      dte("dernier", "Dernier chargement", { largeur: 165 }),
    ],
  },

  /* ================= Budget ================= */
  {
    id: "budget-postes",
    libelle: "Suivi budgétaire par poste",
    description: "Une ligne par poste de dépense : le budget de l'exercice, l'engagé, le consommé, ce qu'il reste et l'écart au rythme attendu.",
    famille: "budget",
    unite: "postes",
    periode: false,
    identifiant: "poste",
    lien: (l) => (typeof l.cle === "string" ? `/budget/${l.cle}` : null),
    colonnes: [
      txt("poste", "Poste", { parDefaut: true, largeur: 200, filtrable: false }),
      eta("etat", "État", { parDefaut: true, largeur: 155 }),
      mnt("budget", "Budget", { parDefaut: true, largeur: 145 }),
      mnt("consomme", "Consommé", { parDefaut: true, largeur: 145 }),
      mnt("engage", "Engagé", { parDefaut: true, largeur: 135 }),
      mnt("disponible", "Disponible", { parDefaut: true, largeur: 145 }),
      pct("avancement", "Avancement", { parDefaut: true, largeur: 140 }),
      mnt("attendu", "Attendu à date", { parDefaut: true, largeur: 155 }),
      ecr("ecartRythme", "Écart au rythme", { parDefaut: true, largeur: 155, precision: "en points de budget" }),
      num("businessUnits", "Business units", { largeur: 150, total: "aucun" }),
      num("enveloppes", "Enveloppes", { largeur: 130, total: "aucun" }),
      num("sansEnveloppe", "BU sans enveloppe", { largeur: 175, total: "aucun" }),
      oui("saisonnalite", "Saisonnalité", { largeur: 140 }),
      txt("base", "Base du montant", { largeur: 380, filtrable: false }),
    ],
  },
  {
    id: "budget-enveloppes",
    libelle: "Enveloppes par business unit",
    description: "La maille où le budget se défend : une enveloppe par poste et par business unit — le carburant de l'Aliment ne se compense pas avec les pneumatiques de l'Abattoir.",
    famille: "budget",
    unite: "enveloppes",
    periode: false,
    identifiant: "poste",
    colonnes: [
      txt("poste", "Poste", { parDefaut: true, largeur: 190 }),
      BU,
      eta("etat", "État", { parDefaut: true, largeur: 155 }),
      mnt("budget", "Budget", { parDefaut: true, largeur: 145 }),
      mnt("consomme", "Consommé", { parDefaut: true, largeur: 145 }),
      mnt("engage", "Engagé", { parDefaut: true, largeur: 135 }),
      mnt("disponible", "Disponible", { parDefaut: true, largeur: 145 }),
      pct("avancement", "Avancement", { parDefaut: true, largeur: 140 }),
      mnt("attendu", "Attendu à date", { largeur: 155 }),
      ecr("ecartRythme", "Écart au rythme", { parDefaut: true, largeur: 155 }),
      txt("numero", "Réf.", { largeur: 150, filtrable: false }),
      oui("saisonnalite", "Saisonnalité", { largeur: 140 }),
      txt("base", "Base du montant", { largeur: 380, filtrable: false }),
    ],
  },
  {
    id: "budget-engagements",
    libelle: "Engagements en cours",
    description: "Ce qui est commandé et pas encore réglé, bon de commande par bon de commande : le budget en est déjà mangé, même si rien n'est sorti de la caisse.",
    famille: "budget",
    unite: "engagements",
    periode: false,
    identifiant: "objet",
    colonnes: [
      dte("date", "Date", { parDefaut: true, largeur: 115 }),
      txt("objet", "Objet", { parDefaut: true, largeur: 260, filtrable: false }),
      txt("poste", "Poste", { parDefaut: true, largeur: 175 }),
      BU,
      txt("fournisseur", "Fournisseur", { parDefaut: true, largeur: 200 }),
      mnt("montant", "Montant engagé", { parDefaut: true, largeur: 155 }),
      txt("bonCommande", "Bon de commande", { parDefaut: true, largeur: 165, filtrable: false }),
      txt("immatriculation", "Véhicule", { largeur: 120, filtrable: false }),
      num("age", "Âge", { parDefaut: true, largeur: 105, total: "moyenne", precision: "jours depuis la commande" }),
      oui("budgete", "Poste budgété", { parDefaut: true, largeur: 150 }),
      txt("numero", "Réf.", { largeur: 150, filtrable: false }),
    ],
  },

  /* ================= Conformité — les deux autres angles ================= */
  {
    id: "conformite-vehicule",
    libelle: "Conformité par véhicule",
    description: "Un véhicule par ligne : ses pièces à jour, ses pièces échues, la prochaine échéance, et s'il est immobilisé administrativement.",
    famille: "conformite",
    unite: "véhicules",
    periode: false,
    identifiant: "immatriculation",
    lien: (l) => lienVehicule(l, "conformite"),
    colonnes: [
      IMMAT,
      VEHICULE,
      eta("conformite", "Conformité", { parDefaut: true, largeur: 160 }),
      num("documents", "Pièces", { parDefaut: true, largeur: 105, total: "aucun" }),
      num("aJour", "À jour", { parDefaut: true, largeur: 105, total: "aucun" }),
      num("bientot", "Bientôt échues", { parDefaut: true, largeur: 150, total: "aucun" }),
      num("echues", "Échues", { parDefaut: true, largeur: 110, total: "aucun" }),
      num("manquantes", "Manquantes", { parDefaut: true, largeur: 135, total: "aucun" }),
      txt("prochaine", "Prochaine échéance", { parDefaut: true, largeur: 185, filtrable: false }),
      dte("prochaineDate", "Le", { parDefaut: true, largeur: 115 }),
      num("joursRestants", "Jours restants", { parDefaut: true, largeur: 140, total: "aucun" }),
      oui("immobilise", "Immobilisé", { parDefaut: true, largeur: 130, precision: "une pièce critique manque ou est échue" }),
      mnt("coutDocuments", "Coût des pièces", { largeur: 160, precision: "sur douze mois" }),
      CATEGORIE,
      BU,
      SITE,
      STATUT,
    ],
  },
  {
    id: "conformite-visites",
    libelle: "Visites techniques",
    description: "Le processus au complet : rendez-vous pris, passages, refus et contre-visites, avec le centre agréé et le délai tenu.",
    famille: "conformite",
    unite: "visites",
    periode: true,
    precisionPeriode: "les rendez-vous listés",
    identifiant: "immatriculation",
    lien: (l) => lienVehicule(l, "conformite"),
    colonnes: [
      IMMAT,
      VEHICULE,
      txt("type", "Type de visite", { parDefaut: true, largeur: 155 }),
      eta("statut", "Statut", { parDefaut: true, largeur: 155 }),
      dte("dateRendezVous", "Rendez-vous", { parDefaut: true, largeur: 130 }),
      dte("datePassage", "Passage", { parDefaut: true, largeur: 120 }),
      txt("centre", "Centre agréé", { parDefaut: true, largeur: 175 }),
      num("attente", "Délai de passage", { parDefaut: true, largeur: 165, total: "moyenne", precision: "jours entre le rendez-vous et le passage" }),
      dte("dateLimiteContreVisite", "Limite de contre-visite", { largeur: 190 }),
      num("observations", "Observations", { parDefaut: true, largeur: 140, total: "aucun" }),
      num("majeures", "Dont majeures", { parDefaut: true, largeur: 150, total: "aucun" }),
      txt("numeroPv", "N° de PV", { largeur: 140, filtrable: false }),
      CATEGORIE,
      BU,
      SITE,
      txt("commentaire", "Commentaire", { largeur: 300, filtrable: false }),
    ],
  },

  /* ================= Incidents — les deux autres angles ================= */
  {
    id: "incidents-vehicule",
    libelle: "Sinistralité par véhicule",
    description: "Combien d'incidents chaque véhicule a connus, ce qu'ils ont coûté, ce qu'ils ont immobilisé, et la part où notre responsabilité est engagée.",
    famille: "incidents",
    unite: "véhicules",
    periode: true,
    precisionPeriode: "les incidents comptés",
    identifiant: "immatriculation",
    lien: (l) => lienVehicule(l, "incidents"),
    colonnes: [
      IMMAT,
      VEHICULE,
      num("incidents", "Incidents", { parDefaut: true, largeur: 120 }),
      num("accidents", "Dont accidents", { parDefaut: true, largeur: 150 }),
      mnt("cout", "Coût", { parDefaut: true, largeur: 145 }),
      dur("immobilisation", "Immobilisation", { parDefaut: true, largeur: 155, precision: "en jours" }),
      pct("partResponsable", "Part responsable", { parDefaut: true, largeur: 165, precision: "incidents où notre responsabilité est engagée" }),
      num("blesses", "Avec blessés", { parDefaut: true, largeur: 140 }),
      num("sinistres", "Dossiers sinistre", { parDefaut: true, largeur: 165 }),
      num("ouverts", "Dossiers ouverts", { parDefaut: true, largeur: 165 }),
      dte("dernier", "Dernier incident", { parDefaut: true, largeur: 160 }),
      dst("kmDouzeMois", "Km sur la période", { largeur: 170 }),
      num("incidentsPar10000", "Incidents / 10 000 km", { largeur: 195, total: "aucun", precision: "la mesure comparable entre gros et petits rouleurs" }),
      CATEGORIE,
      BU,
      SITE,
      STATUT,
    ],
  },
  {
    id: "incidents-chauffeur",
    libelle: "Sinistralité par chauffeur",
    description: "La même lecture du côté des conducteurs : incidents, responsabilité, coût, contraventions et sanctions prononcées.",
    famille: "incidents",
    unite: "chauffeurs",
    periode: true,
    precisionPeriode: "les incidents comptés",
    identifiant: "nom",
    lien: lienChauffeur,
    colonnes: [
      txt("nom", "Chauffeur", { parDefaut: true, largeur: 190, filtrable: false }),
      txt("vehicule", "Véhicule titulaire", { parDefaut: true, largeur: 165, filtrable: false }),
      num("incidents", "Incidents", { parDefaut: true, largeur: 120 }),
      num("accidents", "Dont accidents", { parDefaut: true, largeur: 150 }),
      num("responsables", "Responsable", { parDefaut: true, largeur: 140 }),
      mnt("cout", "Coût", { parDefaut: true, largeur: 145 }),
      dur("immobilisation", "Immobilisation", { largeur: 155, precision: "en jours" }),
      num("contraventions", "Contraventions", { parDefaut: true, largeur: 150 }),
      mnt("coutContraventions", "Coût des contraventions", { largeur: 200 }),
      num("sanctions", "Sanctions", { parDefaut: true, largeur: 125 }),
      num("joursMiseAPied", "Jours de mise à pied", { largeur: 180 }),
      dte("dernier", "Dernier incident", { parDefaut: true, largeur: 160 }),
      dst("km", "Km sur douze mois", { largeur: 175 }),
      num("incidentsPar10000", "Incidents / 10 000 km", { largeur: 195, total: "aucun" }),
      eta("statut", "Statut", { largeur: 150 }),
      SITE,
    ],
  },

  /* ================= Chauffeurs — deux angles de plus ================= */
  {
    id: "chauffeurs-discipline",
    libelle: "Discipline et disponibilité",
    description: "Ce qui écarte un chauffeur du volant : contraventions, sanctions, absences et indisponibilités, avec les jours perdus.",
    famille: "chauffeurs",
    unite: "chauffeurs",
    periode: false,
    identifiant: "nom",
    lien: lienChauffeur,
    colonnes: [
      txt("nom", "Chauffeur", { parDefaut: true, largeur: 190, filtrable: false }),
      txt("matricule", "Matricule", { largeur: 130, filtrable: false }),
      eta("statut", "Statut", { parDefaut: true, largeur: 150 }),
      eta("disponible", "Disponible", { parDefaut: true, largeur: 145 }),
      txt("motifIndisponibilite", "Motif", { parDefaut: true, largeur: 165 }),
      dte("indisponibleDepuis", "Depuis le", { parDefaut: true, largeur: 125 }),
      num("joursIndisponible", "Jours indisponible", { parDefaut: true, largeur: 175, precision: "sur douze mois" }),
      num("episodes", "Épisodes", { parDefaut: true, largeur: 125 }),
      num("contraventions", "Contraventions", { parDefaut: true, largeur: 150 }),
      num("sanctions", "Sanctions", { parDefaut: true, largeur: 125 }),
      num("joursMiseAPied", "Jours de mise à pied", { parDefaut: true, largeur: 180 }),
      txt("derniereSanction", "Dernière sanction", { largeur: 190, filtrable: false }),
      dte("derniereSanctionDate", "Le", { largeur: 115 }),
      txt("contrat", "Contrat", { largeur: 130 }),
      SITE,
    ],
  },
  {
    id: "chauffeurs-frais",
    libelle: "Frais de route",
    description: "Ce que coûte la route en dehors du camion : frais versés par chauffeur et par mission, avec le justificatif.",
    famille: "chauffeurs",
    unite: "frais",
    periode: true,
    precisionPeriode: "les frais listés",
    identifiant: "chauffeur",
    lien: lienChauffeur,
    colonnes: [
      dte("date", "Date", { parDefaut: true, largeur: 115 }),
      txt("chauffeur", "Chauffeur", { parDefaut: true, largeur: 185, filtrable: false }),
      txt("libelle", "Objet", { parDefaut: true, largeur: 260, filtrable: false }),
      mnt("montant", "Montant", { parDefaut: true, largeur: 140 }),
      txt("vehicule", "Véhicule", { parDefaut: true, largeur: 120, filtrable: false }),
      oui("justificatif", "Justificatif", { parDefaut: true, largeur: 135 }),
      txt("poste", "Poste", { parDefaut: true, largeur: 165 }),
      txt("beneficiaire", "Bénéficiaire", { largeur: 190 }),
      SITE,
      txt("numero", "Réf.", { largeur: 150, filtrable: false }),
    ],
  },

  /* ================= Achats — le cycle ================= */
  {
    id: "achats-cycle",
    libelle: "Délais du cycle d'achat",
    description: "Combien de jours chaque étape prend, de la demande au règlement : c'est là que se voit ce qui bloque, et chez qui.",
    famille: "achats",
    unite: "demandes",
    periode: true,
    precisionPeriode: "les demandes listées",
    identifiant: "objet",
    colonnes: [
      dte("date", "Demandé le", { parDefaut: true, largeur: 130 }),
      txt("objet", "Objet", { parDefaut: true, largeur: 250, filtrable: false }),
      txt("fournisseur", "Fournisseur", { parDefaut: true, largeur: 190 }),
      eta("etape", "Étape", { parDefaut: true, largeur: 160 }),
      mnt("montant", "Montant", { parDefaut: true, largeur: 140 }),
      num("versVisa", "Vers le visa", { parDefaut: true, largeur: 140, total: "moyenne", precision: "jours" }),
      num("versValidation", "Vers la validation", { parDefaut: true, largeur: 170, total: "moyenne", precision: "jours" }),
      num("versCommande", "Vers le bon", { parDefaut: true, largeur: 145, total: "moyenne", precision: "jours" }),
      num("versLivraison", "Vers la livraison", { parDefaut: true, largeur: 165, total: "moyenne", precision: "jours" }),
      num("versFacture", "Vers la facture", { largeur: 155, total: "moyenne", precision: "jours" }),
      num("versReglement", "Vers le règlement", { parDefaut: true, largeur: 175, total: "moyenne", precision: "jours" }),
      num("total", "Cycle complet", { parDefaut: true, largeur: 150, total: "moyenne", precision: "jours, de la demande au règlement" }),
      num("age", "Âge", { parDefaut: true, largeur: 105, total: "aucun", precision: "jours depuis la demande, si non close" }),
      eta("delaiTenu", "Délai tenu", { parDefaut: true, largeur: 150, precision: "règlement dans le délai convenu avec le fournisseur" }),
      txt("urgence", "Urgence", { largeur: 130 }),
      txt("demandeur", "Demandeur", { largeur: 175 }),
      txt("immatriculation", "Véhicule", { largeur: 120, filtrable: false }),
      BU,
      txt("numero", "Réf.", { largeur: 150, filtrable: false }),
    ],
  },

  /* ================= Prestataires — les deux autres angles ================= */
  {
    id: "prestataires-comptes",
    libelle: "Comptes fournisseurs",
    description: "Ce qu'on doit à chacun et ce qu'on lui a avancé : dettes échues, avances non soldées, solde net et ancienneté de la relation.",
    famille: "prestataires",
    unite: "prestataires",
    periode: false,
    identifiant: "nom",
    lien: (l) => (typeof l.numero === "string" ? `/prestataires/${l.numero}?onglet=compte` : null),
    colonnes: [
      txt("nom", "Prestataire", { parDefaut: true, largeur: 210, filtrable: false }),
      txt("type", "Type", { parDefaut: true, largeur: 150 }),
      num("pieces", "Pièces dues", { parDefaut: true, largeur: 135 }),
      mnt("du", "Restant dû", { parDefaut: true, largeur: 150 }),
      mnt("echu", "Dont échu", { parDefaut: true, largeur: 145, precision: "au-delà du délai convenu" }),
      num("piecesEchues", "Pièces échues", { parDefaut: true, largeur: 150 }),
      num("retardMax", "Retard le plus ancien", { parDefaut: true, largeur: 195, total: "aucun", precision: "en jours" }),
      mnt("avances", "Avances versées", { parDefaut: true, largeur: 165 }),
      mnt("avancesNonSoldees", "Avances non soldées", { parDefaut: true, largeur: 190 }),
      mnt("solde", "Solde net", { parDefaut: true, largeur: 145, precision: "dû moins avances non soldées" }),
      num("delaiPaiement", "Délai convenu", { parDefaut: true, largeur: 150, total: "aucun", precision: "en jours" }),
      num("anciennete", "Ancienneté", { largeur: 135, total: "aucun", precision: "en mois" }),
      txt("ville", "Ville", { largeur: 140 }),
      txt("telephone", "Téléphone", { largeur: 160, filtrable: false }),
      txt("numero", "Réf.", { largeur: 150, filtrable: false }),
    ],
  },
  {
    id: "prestataires-evaluations",
    libelle: "Notation des prestataires",
    description: "La note de chacun et ce qui la compose : qualité, délai, prix, reprises et ancienneté — de quoi décider qui l'on rappelle.",
    famille: "prestataires",
    unite: "prestataires",
    periode: false,
    identifiant: "nom",
    lien: (l) => (typeof l.numero === "string" ? `/prestataires/${l.numero}?onglet=evaluation` : null),
    colonnes: [
      txt("nom", "Prestataire", { parDefaut: true, largeur: 210, filtrable: false }),
      txt("type", "Type", { parDefaut: true, largeur: 150 }),
      eta("niveau", "Niveau", { parDefaut: true, largeur: 150 }),
      num("note", "Note", { parDefaut: true, largeur: 105, total: "moyenne", precision: "sur 100" }),
      num("evaluations", "Évaluations", { parDefaut: true, largeur: 135 }),
      num("qualite", "Qualité", { parDefaut: true, largeur: 115, total: "moyenne", precision: "sur 5" }),
      num("delai", "Délai", { parDefaut: true, largeur: 110, total: "moyenne", precision: "sur 5" }),
      num("prix", "Prix", { parDefaut: true, largeur: 105, total: "moyenne", precision: "sur 5" }),
      num("reprises", "Reprises", { parDefaut: true, largeur: 125, precision: "même véhicule, même objet, sous soixante jours" }),
      num("interventions", "Interventions", { parDefaut: true, largeur: 145 }),
      num("anciennete", "Ancienneté", { parDefaut: true, largeur: 135, total: "aucun", precision: "en mois" }),
      mnt("montant", "Montant douze mois", { parDefaut: true, largeur: 185 }),
      dte("derniereEvaluation", "Dernière évaluation", { largeur: 180 }),
      txt("commentaire", "Dernier commentaire", { largeur: 320, filtrable: false }),
      txt("numero", "Réf.", { largeur: 150, filtrable: false }),
    ],
  },

  /* ================= Parc léger =================
     Cadrage du 7 septembre 2026 : les véhicules de service et de fonction ne
     livrent pas, mais leur maintenance et le forfait carburant de leurs
     attributaires sont des charges du parc. Huit rapports pour les tenir :
     l'inventaire, les attributaires, le plan car, les forfaits, ce qu'ils
     pèsent par BU, le renouvellement 2026, les immobilisés, le pool. */
  {
    id: "parc-leger-inventaire",
    libelle: "Inventaire du parc léger",
    description: "Une ligne par véhicule de service ou de fonction : ce qu'il est, qui le tient, dans quel état il est, ce qu'il coûte chaque mois.",
    famille: "parc-leger",
    unite: "véhicules",
    periode: false,
    colonnes: [
      IMMAT,
      VEHICULE,
      MARQUE,
      txt("modele", "Modèle", { largeur: 170 }),
      txt("annee", "Année", { largeur: 90, parDefaut: true }),
      dst("km", "Km", { largeur: 110, total: "aucun" }),
      txt("categorie", "Catégorie", { largeur: 130 }),
      txt("regime", "Régime", { parDefaut: true, largeur: 120 }),
      eta("etat", "État", { parDefaut: true, largeur: 130 }),
      txt("attributaire", "Attributaire ou pool", { parDefaut: true, largeur: 190, filtrable: false }),
      txt("fonction", "Fonction", { parDefaut: true, largeur: 220, filtrable: false }),
      txt("departement", "Département", { parDefaut: true, largeur: 160 }),
      BU,
      oui("planCar", "Plan car", { largeur: 100 }),
      mnt("forfait", "Forfait carburant", { parDefaut: true, largeur: 150, precision: "par mois" }),
      txt("lot", "Lot 2026", { largeur: 120 }),
      txt("observation", "Observation", { largeur: 320, filtrable: false }),
    ],
  },
  {
    id: "parc-leger-attributaires",
    libelle: "Attributaires",
    description: "Une ligne par personne qui tient un véhicule léger : sa fonction, sa BU, ce qu'elle tient, son plan car, son forfait carburant et ce qu'il pèse à l'année.",
    famille: "parc-leger",
    unite: "personnes",
    periode: false,
    identifiant: "nom",
    colonnes: [
      txt("nom", "Attributaire", { parDefaut: true, largeur: 200, filtrable: false }),
      txt("fonction", "Fonction", { parDefaut: true, largeur: 240, filtrable: false }),
      txt("departement", "Département", { parDefaut: true, largeur: 160 }),
      BU,
      num("vehicules", "Véhicules", { parDefaut: true, largeur: 100 }),
      txt("immatriculations", "Immatriculations", { parDefaut: true, largeur: 200, filtrable: false }),
      txt("regime", "Régime", { largeur: 120 }),
      oui("planCar", "Plan car", { parDefaut: true, largeur: 100 }),
      mnt("forfait", "Forfait carburant", { parDefaut: true, largeur: 150, precision: "par mois" }),
      mnt("chargeAnnuelle", "Charge annuelle", { parDefaut: true, largeur: 150, precision: "forfait × 12" }),
    ],
  },
  {
    id: "parc-leger-plan-car",
    libelle: "Plan car",
    description: "Les véhicules cédés à leur attributaire au terme d'une durée : où en est chaque plan, et quand la cession est prévue.",
    famille: "parc-leger",
    unite: "véhicules",
    periode: false,
    colonnes: [
      IMMAT,
      VEHICULE,
      txt("attributaire", "Attributaire", { parDefaut: true, largeur: 200, filtrable: false }),
      txt("fonction", "Fonction", { largeur: 220, filtrable: false }),
      BU,
      num("dureeMois", "Durée", { parDefaut: true, largeur: 100, total: "aucun", precision: "en mois" }),
      txt("debut", "Début", { parDefaut: true, largeur: 120, filtrable: false }),
      num("moisEcoules", "Mois écoulés", { parDefaut: true, largeur: 130, total: "aucun" }),
      txt("cessionPrevue", "Cession prévue", { parDefaut: true, largeur: 140, filtrable: false }),
      eta("statut", "Statut", { parDefaut: true, largeur: 140 }),
      mnt("forfait", "Forfait carburant", { largeur: 150, precision: "par mois" }),
    ],
  },
  {
    id: "parc-leger-forfaits",
    libelle: "Forfaits carburant",
    description: "Ce que chaque carte carburant de véhicule de fonction a coûté sur la période : une ligne par attributaire, le forfait et son cumul.",
    famille: "parc-leger",
    unite: "cartes",
    periode: true,
    precisionPeriode: "les mois de forfait comptés",
    identifiant: "attributaire",
    colonnes: [
      txt("attributaire", "Attributaire", { parDefaut: true, largeur: 200, filtrable: false }),
      txt("fonction", "Fonction", { largeur: 220, filtrable: false }),
      IMMAT,
      VEHICULE,
      txt("departement", "Département", { parDefaut: true, largeur: 160 }),
      BU,
      mnt("forfait", "Forfait mensuel", { parDefaut: true, largeur: 140, total: "aucun" }),
      num("mois", "Mois", { parDefaut: true, largeur: 90, total: "aucun" }),
      mnt("montant", "Montant sur la période", { parDefaut: true, largeur: 190 }),
    ],
  },
  {
    id: "parc-leger-charges-bu",
    libelle: "Charges du parc léger par business unit",
    description: "Ce que les véhicules légers coûtent à chaque business unit sur la période : les forfaits carburant, et le nombre de véhicules et de cartes qui les portent.",
    famille: "parc-leger",
    unite: "business units",
    periode: true,
    precisionPeriode: "les forfaits comptés",
    identifiant: "businessUnit",
    colonnes: [
      BU,
      num("vehicules", "Véhicules légers", { parDefaut: true, largeur: 150 }),
      num("service", "De service", { parDefaut: true, largeur: 110 }),
      num("fonction", "De fonction", { parDefaut: true, largeur: 120 }),
      num("cartes", "Cartes carburant", { parDefaut: true, largeur: 150 }),
      mnt("forfaitMensuel", "Forfaits par mois", { parDefaut: true, largeur: 160 }),
      mnt("montant", "Forfaits sur la période", { parDefaut: true, largeur: 190 }),
      pct("part", "Part du total", { parDefaut: true, largeur: 120 }),
    ],
  },
  {
    id: "parc-leger-renouvellement",
    libelle: "Renouvellement 2026",
    description: "Le plan de cascade des vingt véhicules neufs : le lot, qui reçoit quoi, ce qu'il libère, et ce qu'il en advient.",
    famille: "parc-leger",
    unite: "mouvements",
    periode: false,
    identifiant: "lot",
    colonnes: [
      txt("lot", "Lot", { parDefaut: true, largeur: 110 }),
      txt("vehicule", "Véhicule", { parDefaut: true, largeur: 220, filtrable: false }),
      eta("etat", "État", { parDefaut: true, largeur: 130 }),
      txt("beneficiaire", "Bénéficiaire", { parDefaut: true, largeur: 200, filtrable: false }),
      txt("fonction", "Fonction", { parDefaut: true, largeur: 240, filtrable: false }),
      txt("departement", "Département", { largeur: 160 }),
      BU,
      txt("regime", "Régime", { largeur: 120 }),
      txt("devenir", "Ce qu'il en advient", { parDefaut: true, largeur: 340, filtrable: false }),
    ],
  },
  {
    id: "parc-leger-immobilises",
    libelle: "Véhicules légers immobilisés",
    description: "Ce qui ne roule pas : en panne ou à réformer, avec l'âge, le compteur et le motif — de quoi décider entre réparer et sortir.",
    famille: "parc-leger",
    unite: "véhicules",
    periode: false,
    colonnes: [
      IMMAT,
      VEHICULE,
      txt("annee", "Année", { parDefaut: true, largeur: 90 }),
      dst("km", "Km", { parDefaut: true, largeur: 110, total: "aucun" }),
      eta("etat", "État", { parDefaut: true, largeur: 130 }),
      txt("departement", "Département", { parDefaut: true, largeur: 160 }),
      BU,
      txt("ancienDetenteur", "Ancien détenteur", { largeur: 200, filtrable: false }),
      txt("motif", "Motif", { parDefaut: true, largeur: 340, filtrable: false }),
    ],
  },
  {
    id: "parc-leger-pool",
    libelle: "Véhicules de pool",
    description: "Les véhicules légers que personne ne tient en propre : disponibles pour les missions d'un service ou d'un site.",
    famille: "parc-leger",
    unite: "véhicules",
    periode: false,
    colonnes: [
      IMMAT,
      VEHICULE,
      txt("categorie", "Catégorie", { largeur: 130 }),
      txt("pool", "Pool ou service", { parDefaut: true, largeur: 220 }),
      txt("departement", "Département", { largeur: 160 }),
      BU,
      eta("etat", "État", { parDefaut: true, largeur: 130 }),
      txt("observation", "Observation", { parDefaut: true, largeur: 320, filtrable: false }),
    ],
  },
];

export function rapportParId(id: string): DefinitionRapport | null {
  return RAPPORTS.find((r) => r.id === id) ?? null;
}

export function rapportsDeFamille(famille: FamilleRapport): DefinitionRapport[] {
  return RAPPORTS.filter((r) => r.famille === famille);
}

/** Les familles qui portent au moins un rapport, dans l'ordre du catalogue. */
export function famillesServies(): FamilleRapport[] {
  return (Object.keys(FAMILLE_RAPPORT) as FamilleRapport[]).filter((f) => RAPPORTS.some((r) => r.famille === f));
}

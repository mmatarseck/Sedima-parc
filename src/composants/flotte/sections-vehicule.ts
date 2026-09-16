import { BUSINESS_UNIT, CATEGORIE_FLOTTE, ENERGIE, STATUT_VEHICULE, USAGE_VEHICULE } from "@/domaine/libelles";
import { REGIME_USAGE } from "@/domaine/parc-leger";
import type { ChampEdition } from "@/domaine/cloture";
import { champsIdentiteVehicule } from "@/composants/transactions/champs";

/* ============================================================================
 * La création d'un véhicule, en cinq sections — sur le modèle de Fleetio
 * (demande du métier du 7 septembre 2026) : Détails, Entretien, Cycle de vie,
 * Finances, Caractéristiques. Chaque section a ses cartes, chaque carte ses
 * champs ; les champs sont ceux de la fiche, pour que ce qui se saisit ici se
 * relise là. Marque, modèle et catégorie viennent des paramètres
 * (champsIdentiteVehicule) ; les sites, de la page.
 *
 * **On ne demande que ce qu'on sait garder** (14 septembre 2026). Une sixième
 * section, « Réglages », et trois champs d'autres cartes proposaient balise,
 * entité juridique, utilisation, région et régime de propriété : cinq valeurs
 * que la fiche déduit des relevés, de la business unit, de l'usage, du site et
 * de la catégorie de flotte. On pouvait les taper ; rien ne les enregistrait.
 * ==========================================================================*/

export interface CarteFormulaire {
  titre: string;
  precision?: string;
  champs: ChampEdition[];
}

export interface SectionFormulaire {
  cle: string;
  libelle: string;
  precision: string;
  cartes: CarteFormulaire[];
}

export interface ContexteNouveauVehicule {
  sites: { valeur: string; libelle: string }[];
  /** Les prestataires qui peuvent avoir vendu un véhicule, par raison sociale. */
  fournisseurs: { valeur: string; libelle: string }[];
}

const options = (r: Record<string, string>) => Object.entries(r).map(([valeur, libelle]) => ({ valeur, libelle }));

export function sectionsNouveauVehicule(contexte: ContexteNouveauVehicule): SectionFormulaire[] {
  return [
    {
      cle: "details",
      libelle: "Détails",
      precision: "Identité et classement",
      cartes: [
        {
          titre: "Identification",
          precision: "Marque et modèle se choisissent dans la liste ; ce qui n'y est pas se crée sur place et entre au référentiel",
          champs: [
            /* Facultative depuis le 16 septembre 2026 : un véhicule neuf entre
               avant sa carte grise. Sans plaque, le châssis en tient lieu — le
               formulaire l'exige alors, et pose le véhicule « en mutation ». */
            { cle: "immatriculation", libelle: "Immatriculation — vide tant que la carte grise n'est pas là", type: "texte" },
            ...champsIdentiteVehicule(),
            { cle: "typeModele", libelle: "Type / modèle (carte grise)", type: "texte" },
            { cle: "energie", libelle: "Énergie", type: "choix", options: options(ENERGIE), obligatoire: true },
            { cle: "photo", libelle: "Photo (adresse)", type: "texte" },
          ],
        },
        {
          titre: "Classement",
          precision: "Ce que le véhicule fait pour l'entreprise, et où il est rattaché",
          champs: [
            { cle: "statut", libelle: "Statut", type: "choix", options: Object.entries(STATUT_VEHICULE).map(([valeur, d]) => ({ valeur, libelle: d.libelle })), obligatoire: true },
            { cle: "regime", libelle: "Régime d'usage", type: "choix", options: Object.entries(REGIME_USAGE).map(([valeur, d]) => ({ valeur, libelle: `${d.libelle} — ${d.precision}` })), obligatoire: true },
            { cle: "categorieFlotte", libelle: "Catégorie de flotte", type: "choix", options: options(CATEGORIE_FLOTTE), obligatoire: true },
            { cle: "usage", libelle: "Usage (vrac, frigorifique, plateau…)", type: "choix", options: options(USAGE_VEHICULE), obligatoire: true },
            { cle: "businessUnit", libelle: "Business unit", type: "choix", options: options(BUSINESS_UNIT) },
            { cle: "siteId", libelle: "Site", type: "suggestion", options: contexte.sites },
            { cle: "transportSpecial", libelle: "Transport spécial (denrées, poussins)", type: "oui-non" },
            { cle: "engage", libelle: "Engagé au parc (compte dans la disponibilité)", type: "oui-non" },
          ],
        },
      ],
    },
    {
      cle: "entretien",
      libelle: "Entretien",
      precision: "Programme et premier passage",
      cartes: [
        {
          titre: "Première visite technique",
          precision: "Le programme d'entretien est celui de la famille du véhicule ; il s'ajuste ensuite sur la fiche, opération par opération",
          /* Le choix « Programme » a été retiré le 14 septembre 2026 : il ne
             proposait que le programme de la famille — qui s'applique de
             lui-même — et « aucun », qui demanderait une ligne de
             `plan_vehicule` que la création n'écrit pas encore. Choisir
             « aucun » n'avait donc aucun effet. */
          champs: [{ cle: "premiereVisiteTechnique", libelle: "Première visite technique (véhicule neuf : date accordée par la réglementation)", type: "date" }],
        },
      ],
    },
    {
      cle: "cycle",
      libelle: "Cycle de vie",
      precision: "Entrée au parc, durée prévue",
      cartes: [
        {
          titre: "Mise en service",
          champs: [
            { cle: "premiereMiseEnCirculation", libelle: "1re mise en circulation", type: "date" },
            { cle: "dateImmatriculation", libelle: "Date d'immatriculation", type: "date" },
            /* Le kilométrage d'entrée n'est pas une propriété du véhicule mais
               un premier relevé : il est écrit comme tel, daté du jour. */
            { cle: "kilometrage", libelle: "Kilométrage à l'entrée", type: "nombre", unite: "km" },
          ],
        },
        {
          titre: "Durée de vie prévue",
          precision: "Ce que l'amortissement et le renouvellement lisent",
          champs: [{ cle: "dureeAmortissementAnnees", libelle: "Durée d'amortissement", type: "nombre", unite: "ans" }],
        },
      ],
    },
    {
      cle: "finances",
      libelle: "Finances",
      precision: "Achat et propriété",
      cartes: [
        {
          titre: "Achat",
          /* Le régime de propriété ne se saisit pas : la fiche le déduit de la
             catégorie de flotte — propriété SEDIMA, mise à disposition ADEX,
             location. Le demander ici donnerait deux réponses à la même
             question, dont une seule serait lue.
             Le fournisseur, lui, a sa colonne depuis le 14 septembre 2026
             (0048) : on choisit dans le référentiel, ou l'on écrit un nom qui
             n'y est pas — un concessionnaire qui n'a vendu qu'un camion n'a pas
             à devenir prestataire pour être cité. */
          champs: [
            { cle: "fournisseur", libelle: "Fournisseur (vendeur du véhicule)", type: "suggestion", options: contexte.fournisseurs },
            { cle: "valeurAcquisition", libelle: "Valeur d'acquisition", type: "nombre", unite: "F" },
            { cle: "commentaire", libelle: "Notes", type: "texte-long" },
          ],
        },
      ],
    },
    {
      cle: "caracteristiques",
      libelle: "Caractéristiques",
      precision: "Ce que dit la carte grise",
      cartes: [
        {
          titre: "Motorisation",
          champs: [
            { cle: "puissanceCv", libelle: "Puissance", type: "nombre", unite: "CV" },
            { cle: "cylindree", libelle: "Cylindrée", type: "nombre", unite: "cm³" },
            { cle: "capaciteReservoir", libelle: "Réservoir", type: "nombre", unite: "L" },
          ],
        },
        {
          titre: "Poids et charges",
          champs: [
            { cle: "ptac", libelle: "PTAC", type: "nombre", unite: "kg" },
            { cle: "ptra", libelle: "PTRA", type: "nombre", unite: "kg" },
            { cle: "poidsVide", libelle: "Poids à vide", type: "nombre", unite: "kg" },
            { cle: "chargeUtile", libelle: "Charge utile", type: "nombre", unite: "kg" },
          ],
        },
      ],
    },
    /* La section « Réglages » a disparu le 14 septembre 2026 : elle ne portait
       que la balise, l'entité juridique et l'utilisation — trois valeurs que la
       fiche déduit des relevés, de la business unit et de l'usage. Les demander
       à la création, c'était les perdre à l'enregistrement. */
  ];
}

/** Tous les champs, à plat : ce que la création enregistre et trace. */
export function champsDesSections(sections: SectionFormulaire[]): ChampEdition[] {
  return sections.flatMap((s) => s.cartes.flatMap((c) => c.champs));
}

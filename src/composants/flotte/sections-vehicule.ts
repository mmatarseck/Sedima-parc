import { BUSINESS_UNIT, CATEGORIE_FLOTTE, ENERGIE, STATUT_VEHICULE, USAGE_VEHICULE } from "@/domaine/libelles";
import { REGIME_USAGE } from "@/domaine/parc-leger";
import type { ChampEdition } from "@/domaine/cloture";
import { champsIdentiteVehicule } from "@/composants/transactions/champs";

/* ============================================================================
 * La création d'un véhicule, en six sections — sur le modèle de Fleetio
 * (demande du métier du 7 septembre 2026) : Détails, Entretien, Cycle de vie,
 * Finances, Caractéristiques, Réglages. Chaque section a ses cartes, chaque
 * carte ses champs ; les champs sont ceux de la fiche, pour que ce qui se
 * saisit ici se relise là. Marque, modèle et catégorie viennent des
 * paramètres (champsIdentiteVehicule) ; sites et fournisseurs de la page.
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
            { cle: "immatriculation", libelle: "Immatriculation", type: "texte", obligatoire: true },
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
          titre: "Programme d'entretien",
          precision: "Le programme de la famille s'applique de lui-même ; il s'ajuste ensuite sur la fiche, opération par opération",
          champs: [
            {
              cle: "programmeEntretien",
              libelle: "Programme",
              type: "choix",
              options: [
                { valeur: "famille", libelle: "Programme de la famille du véhicule (recommandé)" },
                { valeur: "aucun", libelle: "Aucun — pas de rappel d'entretien" },
              ],
              obligatoire: true,
            },
            { cle: "premiereVisiteTechnique", libelle: "Première visite technique (véhicule neuf : date accordée par la réglementation)", type: "date" },
          ],
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
            { cle: "kilometrage", libelle: "Kilométrage à l'entrée", type: "nombre", unite: "km" },
            { cle: "region", libelle: "Région d'immatriculation", type: "texte" },
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
          champs: [
            { cle: "fournisseur", libelle: "Fournisseur", type: "suggestion", options: contexte.fournisseurs },
            { cle: "valeurAcquisition", libelle: "Valeur d'acquisition", type: "nombre", unite: "F" },
            { cle: "regimePropriete", libelle: "Régime de propriété", type: "suggestion", options: [{ valeur: "Propriété", libelle: "Propriété" }, { valeur: "Location", libelle: "Location" }, { valeur: "Crédit-bail", libelle: "Crédit-bail" }, { valeur: "Plan car", libelle: "Plan car" }] },
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
    {
      cle: "reglages",
      libelle: "Réglages",
      precision: "Compteur, télématique, rattachement",
      cartes: [
        {
          titre: "Compteur et télématique",
          precision: "Le parc compte en kilomètres ; les engins en heures se suivent par leur relevé",
          champs: [
            { cle: "gpsActif", libelle: "Télématique (balise active)", type: "oui-non" },
            { cle: "entite", libelle: "Entité juridique", type: "suggestion", options: [{ valeur: "SEDIMA SA", libelle: "SEDIMA SA" }, { valeur: "SEDIMA Abattoirs", libelle: "SEDIMA Abattoirs" }, { valeur: "KFC", libelle: "KFC" }, { valeur: "Batix", libelle: "Batix" }] },
            { cle: "utilisation", libelle: "Utilisation", type: "texte" },
          ],
        },
      ],
    },
  ];
}

/** Tous les champs, à plat : ce que la création enregistre et trace. */
export function champsDesSections(sections: SectionFormulaire[]): ChampEdition[] {
  return sections.flatMap((s) => s.cartes.flatMap((c) => c.champs));
}

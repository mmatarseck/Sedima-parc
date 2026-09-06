import { EcranReferentiels, type BlocReferentiel, type EntreeReferentiel } from "@/composants/parametres/EcranReferentiels";
import { titrePage } from "@/domaine/marque";
import {
  BUSINESS_UNIT,
  CATEGORIE_FLOTTE,
  CATEGORIE_VEHICULE,
  CONTRAT_CHAUFFEUR,
  ENERGIE,
  MISSION_INCIDENT,
  MOTIF_INDISPONIBILITE,
  NATURE_INCIDENT,
  POSTE_DEPENSE,
  RESPONSABILITE,
  ROLE_AFFECTATION,
  STATUT_VEHICULE,
  TYPE_INCIDENT,
  TYPE_SANCTION,
  USAGE_VEHICULE,
} from "@/domaine/libelles";
import { MODE_REMUNERATION } from "@/domaine/flotte-tierce";
import { TYPE_PRESTATAIRE } from "@/domaine/prestataires";
import { MOTIF_AFFRETEMENT, UNITE_TARIF } from "@/domaine/transporteurs";
import { FLOTTE } from "@/donnees/parc-demo";
import { fichesChauffeurs, listeChauffeurs } from "@/donnees/chauffeurs-demo";
import { listeIncidents } from "@/donnees/incidents-demo";
import { prestataires as listePrestataires, sites as listeSites, vehiculesParSite } from "@/donnees/referentiels";
import { affretements } from "@/donnees/transporteurs-demo";
import { fichePourImmatriculation } from "@/donnees/fiche-demo";

export const metadata = { title: titrePage("Référentiels") };

/**
 * Les référentiels de l'application, avec le nombre d'enregistrements qui
 * portent chaque valeur.
 *
 * Ce compte n'est pas décoratif : c'est lui qui dit si une valeur peut encore
 * disparaître. Il se calcule ici, côté serveur, sur les mêmes données que les
 * écrans — un référentiel qui compterait autrement que la liste qu'il décrit ne
 * servirait qu'à semer le doute.
 */

/** Compte, pour chaque clé d'un registre, les éléments qui la portent. */
function bloc<T extends string>(
  cle: string,
  titre: string,
  precision: string,
  unite: string,
  registre: Record<T, string | { libelle: string; precision?: string }>,
  usages: Map<string, number>,
  href: string | null = null,
): BlocReferentiel {
  const entrees: EntreeReferentiel[] = Object.entries(registre).map(([k, v]) => {
    const valeur = v as string | { libelle: string; precision?: string };
    return {
      cle: k,
      libelle: typeof valeur === "string" ? valeur : valeur.libelle,
      precision: typeof valeur === "string" ? null : (valeur.precision ?? null),
      usages: usages.get(k) ?? 0,
    };
  });
  entrees.sort((a, b) => b.usages - a.usages || a.libelle.localeCompare(b.libelle, "fr"));
  return { cle, titre, precision, unite, entrees, href };
}

function compter<T>(elements: T[], cle: (x: T) => string | null | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of elements) {
    const k = cle(e);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export default async function PageReferentiels() {
  /* Sites et prestataires viennent de la base quand elle est branchée ; les
     véhicules par site se comptent sur la même source que les sites. */
  const [sites, parSite, prestataires] = await Promise.all([listeSites(), vehiculesParSite(), listePrestataires()]);
  const vehicules = FLOTTE.map((l) => l.vehicule);
  const chauffeurs = listeChauffeurs();
  const incidents = listeIncidents();
  const missions = affretements();

  /* Les dépenses de toutes les fiches : c'est la seule façon de compter ce que
     chaque poste porte réellement. */
  const depenses = FLOTTE.flatMap((l) => fichePourImmatriculation(l.vehicule.immatriculation)?.depenses ?? []);
  const affectations = FLOTTE.flatMap((l) => fichePourImmatriculation(l.vehicule.immatriculation)?.affectations ?? []);
  /* Les sanctions vivent sur les fiches chauffeur, pas sur la liste. */
  const sanctions = fichesChauffeurs().flatMap((f) => f.sanctions);

  const blocs: BlocReferentiel[] = [
    {
      cle: "sites",
      titre: "Sites",
      precision: "Usines, dépôts, abattoirs, garages — le rattachement géographique d'un véhicule et d'un chauffeur",
      unite: "véhicules",
      href: "/flotte",
      entrees: sites.map((s) => ({
        cle: s.code,
        libelle: s.libelle,
        precision: `${s.type} · région de ${s.region}`,
        usages: parSite.get(s.id) ?? 0,
      })).sort((a, b) => b.usages - a.usages || a.libelle.localeCompare(b.libelle, "fr")),
    },
    bloc("categorie-vehicule", "Catégories de véhicule", "Ce qu'est l'engin — elle décide du plan d'entretien et de la comparaison des coûts", "véhicules", CATEGORIE_VEHICULE, compter(vehicules, (v) => v.categorie), "/flotte"),
    bloc("usage", "Usages", "Ce que le véhicule transporte ou fait — vrac, frigorifique, plateau", "véhicules", USAGE_VEHICULE, compter(vehicules, (v) => v.usage), "/flotte"),
    bloc("categorie-flotte", "Catégories de flotte", "Interne, en location, mise à disposition — qui possède et qui paie", "véhicules", CATEGORIE_FLOTTE, compter(vehicules, (v) => v.categorieFlotte), "/flotte"),
    bloc("energie", "Énergies", "Ce que le véhicule consomme — elle décide du prix appliqué au plein", "véhicules", ENERGIE, compter(vehicules, (v) => v.energie), "/carburant"),
    bloc("business-unit", "Business units", "L'activité que le véhicule sert — la maille des budgets et des coûts", "véhicules", BUSINESS_UNIT, compter(vehicules, (v) => v.businessUnit), "/budget"),
    {
      cle: "statut-vehicule",
      titre: "Statuts de véhicule",
      precision: "L'état déclaré — c'est lui qui décide de la disponibilité du jour",
      unite: "véhicules",
      href: "/disponibilite",
      entrees: Object.entries(STATUT_VEHICULE)
        .map(([k, d]) => ({ cle: k, libelle: d.libelle, precision: d.precision, usages: vehicules.filter((v) => v.statut === k).length }))
        .sort((a, b) => b.usages - a.usages || a.libelle.localeCompare(b.libelle, "fr")),
    },
    bloc("poste-depense", "Postes de dépense", "La nature de la dépense — la maille des budgets et des rapports de coût", "dépenses", POSTE_DEPENSE, compter(depenses, (d) => d.poste), "/budget"),
    bloc("nature-incident", "Natures d'incident", "Accident ou incident — la distinction qui décide du dossier sinistre", "déclarations", NATURE_INCIDENT, compter(incidents, (i) => i.nature), "/incidents"),
    bloc("type-incident", "Types d'incident", "Ce qui s'est passé — collision, bris, vol, panne immobilisante", "déclarations", TYPE_INCIDENT, compter(incidents, (i) => i.type), "/incidents"),
    bloc("mission-incident", "Missions au moment de l'incident", "Ce que le véhicule faisait — livraison, transfert, retour à vide, hors mission", "déclarations", MISSION_INCIDENT, compter(incidents, (i) => i.mission), "/incidents"),
    bloc("responsabilite", "Responsabilités", "À qui l'incident est imputé — elle décide de la franchise et du recours", "déclarations", RESPONSABILITE, compter(incidents, (i) => i.responsabilite), "/incidents"),
    bloc("role-affectation", "Rôles d'affectation", "Titulaire ou suppléant — qui conduit d'ordinaire, qui remplace", "affectations", ROLE_AFFECTATION, compter(affectations, (a) => a.role), "/affectations"),
    bloc("contrat-chauffeur", "Types de contrat", "Salarié, intérimaire, prestataire — le lien qui unit le chauffeur au parc", "chauffeurs", CONTRAT_CHAUFFEUR, compter(chauffeurs, (c) => c.chauffeur.contrat), "/chauffeurs"),
    bloc("motif-indisponibilite", "Motifs d'indisponibilité", "Pourquoi un chauffeur ne peut pas prendre le volant", "chauffeurs", MOTIF_INDISPONIBILITE, compter(chauffeurs, (c) => c.indisponibilite?.motif), "/chauffeurs"),
    bloc("type-sanction", "Types de sanction", "L'échelle disciplinaire — réservée aux rôles qui voient les sanctions", "chauffeurs", TYPE_SANCTION, compter(sanctions, (x) => x.type), "/chauffeurs"),
    bloc("type-prestataire", "Types de prestataire", "Garage, fournisseur, assureur, transporteur — ce qu'on attend de lui", "prestataires", TYPE_PRESTATAIRE, compter(prestataires, (p) => p.type), "/prestataires"),
    bloc("motif-affretement", "Motifs d'affrètement", "Pourquoi le parc a confié la mission à un tiers — subi ou choisi", "missions", MOTIF_AFFRETEMENT, compter(missions, (a) => a.motif), "/rapports/transporteurs-affretements"),
    bloc("unite-tarif", "Bases de tarif", "À la tonne, au forfait, au kilomètre — ce sur quoi le prix se calcule", "lignes de grille", UNITE_TARIF, new Map(), "/transporteurs"),
    bloc("mode-remuneration", "Modes de rémunération", "Comment le transporteur est payé — la tonne livrée est la règle", "transporteurs", MODE_REMUNERATION, new Map(), "/transporteurs"),
  ];

  return <EcranReferentiels blocs={blocs} />;
}

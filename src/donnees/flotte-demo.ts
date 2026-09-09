/* ============================================================================
 * Les lignes de la Flotte en démonstration — sans un seul import serveur,
 * pour que l'assistant du navigateur puisse dresser les rapports dessus.
 *
 * Le parc de transport vient des fiches de démonstration (statut effectif
 * et coût sur douze mois compris) ; le parc léger du dossier DO, véhicules à
 * recevoir compris (fusion du 7 septembre 2026).
 * ==========================================================================*/

import type { EtatLeger, VehiculeLeger } from "@/domaine/parc-leger";
import { PARAMETRES_DEFAUT, type Parametres } from "@/domaine/parametres";
import type { LigneFlotte, Vehicule } from "@/domaine/types";
import { fichePourImmatriculation } from "./fiche-demo";
import { FLOTTE } from "./parc-demo";
import { attributairePour, depensesForfaits, vehiculesLegers } from "./parc-leger-demo";

/* -- Le parc léger dans la liste (fusion du 7 septembre 2026) ------------------ */

/** L'état du dossier parc, traduit en statut de véhicule. */
const STATUT_LEGER: Record<EtatLeger, Vehicule["statut"]> = { actif: "en-service", pool: "en-backup", panne: "en-reparation", "a-reformer": "retrait-en-cours", "a-recevoir": "a-recevoir" };

/**
 * Un véhicule léger comme ligne de la Flotte : pas de chauffeur mais un
 * attributaire, pas d'échéance de conformité ni d'entretien tant que ses
 * documents et son plan ne sont pas tenus, et pour coût le forfait carburant
 * de l'année. Les véhicules à recevoir n'y entrent pas : sans immatriculation,
 * ce ne sont pas encore des véhicules du parc.
 */
export function ligneLegere(v: VehiculeLeger, coutDouzeMois: number | null, personne?: { nom: string; fonction: string | null } | null): LigneFlotte {
  /* La personne vient du dossier de démonstration, ou de la base quand c'est elle qui parle. */
  const a = personne ?? attributairePour(v.attributaireId);
  const vehicule: Vehicule = {
    id: v.id,
    regime: v.regime,
    immatriculation: v.immatriculation ?? v.id,
    immatriculationAffichee: v.immatriculationAffichee,
    vin: null,
    marque: v.marque,
    appellation: v.modele,
    typeModele: null,
    categorie: v.categorie,
    categorieFlotte: "interne",
    transportSpecial: false,
    usage: v.categorie === "bus" ? "autre" : "utilitaire",
    engage: false,
    premiereMiseEnCirculation: v.annee ? `${v.annee}-01-01` : null,
    dateImmatriculation: null,
    puissanceCv: null,
    cylindree: null,
    ptac: null,
    ptra: null,
    poidsVide: null,
    chargeUtile: null,
    energie: "gasoil",
    capaciteReservoir: null,
    businessUnit: v.businessUnit,
    siteId: null,
    statut: STATUT_LEGER[v.etat],
    valeurAcquisition: null,
    dureeAmortissementAnnees: null,
    commentaire: [v.lot, v.commentaire].filter(Boolean).join(" — ") || null,
  };
  return {
    vehicule,
    chauffeurTitulaire: null,
    nombreSuppleants: 0,
    site: null,
    kilometrage: v.kilometrage,
    dateKilometrage: null,
    prochaineEcheanceConformite: null,
    prochaineEcheanceEntretien: null,
    coutDouzeMois,
    attelageCourant: null,
    statutEffectif: vehicule.statut,
    immobilisationAdministrative: [],
    attributaire: a ? { nom: a.nom, fonction: a.fonction, pool: false, planCar: v.planCar !== null } : v.pool ? { nom: v.pool, fonction: null, pool: true, planCar: false } : null,
  };
}

/**
 * Les lignes du parc léger de la démonstration, véhicules à recevoir compris :
 * le lot 2 est dans la Flotte, au statut « à recevoir », sous son numéro de lot
 * en attendant l'immatriculation (demande du métier, 7 septembre 2026).
 */
export function lignesLegeresDemo(): LigneFlotte[] {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const depuis = `${Number(aujourdhui.slice(0, 4)) - 1}${aujourdhui.slice(4)}`;
  const coutPar = new Map<string, number>();
  for (const d of depensesForfaits(aujourdhui, PARAMETRES_DEFAUT.parcLeger.forfaitCarburantMensuel)) {
    if (d.date >= depuis) coutPar.set(d.vehiculeId, (coutPar.get(d.vehiculeId) ?? 0) + d.montant);
  }
  return vehiculesLegers().map((v) => ligneLegere(v, coutPar.get(v.id) ?? null));
}

/* -- Les lignes de la base -------------------------------------------------- */

/**
 * Les lignes de la Flotte en démonstration. Le statut effectif vient des
 * documents de la fiche : un document critique manquant ou échu immobilise le
 * véhicule administrativement. Le coût sur douze mois est celui des dépenses
 * de la fiche — la même somme que l'Aperçu, pas un chiffre à part. Un léger
 * déjà dans la flotte de transport n'est pas doublé.
 */
export function lignesFlotteDemonstration(parametres: Parametres): LigneFlotte[] {
  const transport = FLOTTE.map((l) => {
    const f = fichePourImmatriculation(l.vehicule.immatriculation, parametres);
    const imm = f?.immobilisationAdministrative ?? null;
    return { ...l, coutDouzeMois: f?.indicateurs.coutDouzeMois ?? l.coutDouzeMois, statutEffectif: imm?.statut ?? l.vehicule.statut, immobilisationAdministrative: imm?.documents ?? [] };
  });
  const immats = new Set(transport.map((l) => l.vehicule.immatriculation));
  return [...transport, ...lignesLegeresDemo().filter((l) => !immats.has(l.vehicule.immatriculation))];
}

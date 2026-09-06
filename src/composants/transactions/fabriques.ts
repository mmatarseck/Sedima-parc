/* ============================================================================
 * Fabriques — d'une création (valeurs saisies) à l'objet que la fiche affiche.
 *
 * Une création ne porte que ce que le formulaire a demandé ; la fiche, elle,
 * attend des objets complets (`PleinFiche`, `DocumentFiche`…). Les fabriques
 * comblent l'écart avec ce qui se déduit : l'état d'un document depuis son
 * échéance, le libellé d'un véhicule depuis son immatriculation, les initiales
 * d'un chauffeur. En production, ce travail est celui des vues.
 * ==========================================================================*/

import { idChauffeur, initialesDe, type AffectationChauffeur, type ContraventionChauffeur, type EcheanceChauffeur, type FraisDeRoute, type IncidentChauffeur, type LigneChauffeur } from "@/domaine/chauffeur";
import type { Creation } from "@/domaine/cloture";
import type { AffectationFiche, AttelageFiche, DepenseFiche, DocumentFiche, EtatDocument, EvenementJournal, Intervention, PeriodeStatutFiche, PleinFiche, ReleveFiche } from "@/domaine/fiche";
import { BUSINESS_UNIT, MOTIF_INDISPONIBILITE, STATUT_VEHICULE, TYPE_DOCUMENT, TYPE_INCIDENT } from "@/domaine/libelles";
import type { BusinessUnit, CategorieFlotte, DeclarationIncident, Indisponibilite, LigneFlotte, ObservationVisite, Sanction, TypeDocument, UsageVehicule, VisiteTechnique } from "@/domaine/types";
import { listeChauffeurs } from "@/donnees/chauffeurs-demo";
import { FLOTTE, SITES } from "@/donnees/parc-demo";
import { joursRestants } from "@/lib/format";
import { echeanceCalculee } from "@/domaine/documents";
import type { LigneIncident } from "@/domaine/incidents";
import { lienOrigine, type LigneAchat, type LigneMouvement } from "@/domaine/caisse";
import type { Prestataire } from "@/domaine/prestataires";
import type { LigneOrdre } from "@/domaine/maintenance";
import type { LigneCuve } from "@/domaine/carburant";
import { ROLES } from "@/domaine/roles";
import type { DepenseCaisse } from "@/donnees/caisse-demo";
import { afficher, normaliser } from "@/domaine/immatriculation";
import type { CategorieVehicule, Energie } from "@/domaine/types";
import { lireParametres } from "@/lib/parametres-demo";

const s = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));
const n = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
const b = (v: unknown): boolean => Boolean(v);

function vehiculeDe(id: string | null) {
  return FLOTTE.find((l) => l.vehicule.id === id) ?? null;
}

function etatDocument(echeance: string | null): { etat: EtatDocument; joursRestants: number | null } {
  if (!echeance) return { etat: "permanent", joursRestants: null };
  const j = joursRestants(echeance, new Date("2026-09-02T00:00:00Z"));
  return { etat: j === null ? "a-jour" : j < 0 ? "echu" : j <= 30 ? "bientot" : "a-jour", joursRestants: j };
}

/* -- Fiche véhicule ------------------------------------------------------------ */

export function fabriquerPlein(c: Creation): PleinFiche {
  const v = c.valeurs;
  const litres = n(v.litres) ?? 0;
  const montant = n(v.montant) ?? 0;
  return { id: c.numero, numero: c.numero, date: s(v.date) ?? c.date.slice(0, 10), source: s(v.source) ?? "Saisie", litres, prixLitre: n(v.prixLitre) ?? (litres > 0 ? Math.round(montant / litres) : 0), montant, reference: s(v.reference) ?? "", km: n(v.km), kmMotifRejet: null };
}

export function fabriquerDepense(c: Creation): DepenseFiche {
  const v = c.valeurs;
  return {
    id: c.numero,
    numero: c.numero,
    date: s(v.date) ?? c.date.slice(0, 10),
    poste: (s(v.poste) as DepenseFiche["poste"]) ?? "divers",
    libelle: s(v.libelle) ?? "",
    montant: n(v.montant) ?? 0,
    beneficiaire: s(v.beneficiaire),
    reference: s(v.reference),
    origine: (s(v.origine) as DepenseFiche["origine"]) ?? "caisse",
    justificatif: b(v.justificatif),
    km: n(v.km),
    kmMotifRejet: null,
  };
}

export function fabriquerIntervention(c: Creation): Intervention {
  const v = c.valeurs;
  return { numero: c.numero, date: s(v.date) ?? c.date.slice(0, 10), type: (s(v.type) as Intervention["type"]) ?? "curatif", objet: s(v.objet) ?? "", garage: s(v.garage) ?? "—", km: n(v.km), immobilisationJours: n(v.immobilisationJours) ?? 0, montant: n(v.montant) ?? 0, reference: s(v.reference) ?? "" };
}

export function fabriquerDocument(c: Creation, categorie?: CategorieVehicule): DocumentFiche {
  const v = c.valeurs;
  const type = (s(v.type) as TypeDocument) ?? "assurance";
  /* Sans échéance saisie, la durée de validité du type la donne : l'alerte suivra. */
  void categorie;
  const echeance = s(v.echeance) ?? echeanceCalculee(type, s(v.dateEffet), lireParametres());
  const { etat, joursRestants: j } = etatDocument(echeance);
  return { numero: c.numero, type, numeroPiece: s(v.numeroPiece), emetteur: s(v.emetteur), dateEffet: s(v.dateEffet), echeance, montant: n(v.montant), justificatif: false, etat, joursRestants: j };
}

export function fabriquerReleve(c: Creation): ReleveFiche {
  const v = c.valeurs;
  return { numero: c.numero, date: s(v.date) ?? c.date.slice(0, 10), valeur: n(v.valeur) ?? 0, origine: "saisie", source: s(v.source) ?? `Saisie manuelle — ${c.auteur}`, depenseId: null, valide: true, motifRejet: null };
}

export function fabriquerAffectationVehicule(c: Creation, buSite: string): AffectationFiche {
  const v = c.valeurs;
  const chauffeur = listeChauffeurs().find((x) => x.id === s(v.chauffeurId)) ?? null;
  return { numero: c.numero, chauffeur: chauffeur?.nomComplet ?? null, chauffeurId: chauffeur?.id ?? null, initiales: chauffeur?.initiales ?? "—", role: (s(v.role) as AffectationFiche["role"]) ?? "titulaire", debut: s(v.debut) ?? c.date.slice(0, 10), fin: s(v.fin), buSite, kmParcourus: 0, motif: s(v.motif) ?? "Saisie dans l'application" };
}

export function fabriquerAttelage(c: Creation, roleDuVehicule: "tracteur" | "remorque"): AttelageFiche {
  const v = c.valeurs;
  const autre = vehiculeDe(s(v.autreId))?.vehicule ?? null;
  return { numero: c.numero, role: roleDuVehicule, autreId: autre?.id ?? "", autreImmatriculation: autre?.immatriculation ?? "", autreImmatriculationAffichee: autre?.immatriculationAffichee ?? "—", autreVehicule: autre ? `${autre.marque} ${autre.appellation}` : "—", debut: s(v.debut) ?? c.date.slice(0, 10), fin: s(v.fin), permanent: b(v.permanent), motif: s(v.motif) };
}

export function fabriquerPeriodeStatut(c: Creation): PeriodeStatutFiche {
  const v = c.valeurs;
  return { statut: (s(v.statut) as PeriodeStatutFiche["statut"]) ?? "en-service", motif: (s(v.motif) as PeriodeStatutFiche["motif"]) ?? null, debut: s(v.debut) ?? c.date.slice(0, 10), fin: null, jours: 0 };
}

/** Un incident déclaré depuis la fiche véhicule laisse une entrée au journal. */
export function fabriquerEvenementIncident(c: Creation): EvenementJournal {
  const v = c.valeurs;
  const chauffeur = listeChauffeurs().find((x) => x.id === s(v.chauffeurId));
  return {
    date: (s(v.dateHeure) ?? c.date).slice(0, 10),
    auteur: c.auteur,
    initiales: initialesDe(c.auteur),
    categorie: "note",
    texte: `${s(v.nature) === "accident" ? "Accident" : "Incident"} déclaré (${c.numero}) — ${TYPE_INCIDENT[(s(v.type) as keyof typeof TYPE_INCIDENT) ?? "autre"].toLowerCase()}, ${s(v.lieu) ?? "lieu non précisé"}${chauffeur ? `, conducteur ${chauffeur.nomComplet}` : ""}.${s(v.description) ? ` ${s(v.description)}` : ""}`,
  };
}

export function fabriquerVisite(c: Creation, vehiculeId: string): VisiteTechnique {
  const v = c.valeurs;
  return {
    id: c.numero,
    numero: c.numero,
    vehiculeId,
    type: (s(v.type) as VisiteTechnique["type"]) ?? "visite",
    centre: s(v.centre) ?? "CCVA Rufisque",
    dateRendezVous: s(v.dateRendezVous) ?? c.date.slice(0, 10),
    heure: s(v.heure),
    datePassage: s(v.datePassage),
    statut: (s(v.statut) as VisiteTechnique["statut"]) ?? "rendez-vous",
    numeroPv: s(v.numeroPv),
    dateLimiteContreVisite: s(v.dateLimiteContreVisite),
    commentaire: s(v.commentaire),
  };
}

export function fabriquerObservation(c: Creation, vehiculeId: string): ObservationVisite {
  const v = c.valeurs;
  return {
    id: c.numero,
    numero: c.numero,
    visiteId: s(v.visiteId) ?? "",
    vehiculeId,
    libelle: s(v.libelle) ?? "",
    categorie: (s(v.categorie) as ObservationVisite["categorie"]) ?? "autre",
    gravite: (s(v.gravite) as ObservationVisite["gravite"]) ?? "mineure",
    statut: (s(v.statut) as ObservationVisite["statut"]) ?? "a-traiter",
    interventionNumero: s(v.interventionNumero),
    corrigeeLe: s(v.corrigeeLe),
    commentaire: s(v.commentaire),
  };
}

export function fabriquerEvenementStatut(c: Creation): EvenementJournal {
  const v = c.valeurs;
  return { date: s(v.debut) ?? c.date.slice(0, 10), auteur: c.auteur, initiales: initialesDe(c.auteur), categorie: "statut", texte: `Statut passé à « ${STATUT_VEHICULE[(s(v.statut) as keyof typeof STATUT_VEHICULE) ?? "en-service"].libelle} » (${c.numero})${s(v.commentaire) ? ` — ${s(v.commentaire)}` : ""}.` };
}

/* -- Fiche chauffeur ----------------------------------------------------------- */

export function fabriquerAffectationChauffeur(c: Creation): AffectationChauffeur | null {
  const v = c.valeurs;
  const l = vehiculeDe(s(v.vehiculeId));
  if (!l) return null;
  const bu = l.vehicule.businessUnit ? BUSINESS_UNIT[l.vehicule.businessUnit] : "—";
  return { id: c.numero, numero: c.numero, vehiculeId: l.vehicule.id, immatriculation: l.vehicule.immatriculation, immatriculationAffichee: l.vehicule.immatriculationAffichee, vehicule: `${l.vehicule.marque} ${l.vehicule.appellation}`, role: (s(v.role) as AffectationChauffeur["role"]) ?? "titulaire", debut: s(v.debut) ?? c.date.slice(0, 10), fin: s(v.fin), buSite: `${bu} · ${l.site?.libelle ?? "—"}`, kmParcourus: 0, motif: s(v.motif) ?? "Saisie dans l'application" };
}

export function fabriquerDocumentChauffeur(c: Creation): DocumentFiche {
  const d = fabriquerDocument(c);
  return { ...d, type: (s(c.valeurs.type) as TypeDocument) ?? "permis" };
}

export function fabriquerContravention(c: Creation): ContraventionChauffeur | null {
  const v = c.valeurs;
  const l = vehiculeDe(s(v.vehiculeId));
  if (!l) return null;
  return { id: c.numero, numero: c.numero, date: s(v.date) ?? c.date.slice(0, 10), vehiculeId: l.vehicule.id, immatriculationAffichee: l.vehicule.immatriculationAffichee, libelle: s(v.libelle) ?? "", montant: n(v.montant) ?? 0, reference: s(v.reference), retenue: b(v.retenue) };
}

export function fabriquerFrais(c: Creation, vehiculeId: string | null): FraisDeRoute | null {
  const v = c.valeurs;
  const l = vehiculeDe(s(v.vehiculeId) ?? vehiculeId);
  return { id: c.numero, numero: c.numero, date: s(v.date) ?? c.date.slice(0, 10), vehiculeId: l?.vehicule.id ?? "", immatriculationAffichee: l?.vehicule.immatriculationAffichee ?? "—", libelle: s(v.libelle) ?? "", montant: n(v.montant) ?? 0, reference: s(v.reference), justificatif: b(v.justificatif) };
}

export function fabriquerIncidentChauffeur(c: Creation, chauffeurId: string): IncidentChauffeur | null {
  const v = c.valeurs;
  const l = vehiculeDe(s(v.vehiculeId));
  if (!l) return null;
  const declaration: DeclarationIncident = {
    id: c.numero,
    numero: c.numero,
    vehiculeId: l.vehicule.id,
    nature: (s(v.nature) as DeclarationIncident["nature"]) ?? "incident",
    type: (s(v.type) as DeclarationIncident["type"]) ?? "autre",
    dateHeure: `${(s(v.dateHeure) ?? c.date).slice(0, 10)}T08:00:00`,
    lieu: s(v.lieu) ?? "",
    siteId: l.vehicule.siteId,
    chauffeurId,
    mission: (s(v.mission) as DeclarationIncident["mission"]) ?? null,
    description: s(v.description) ?? "",
    kilometrage: n(v.kilometrage),
    roulant: (s(v.roulant) as DeclarationIncident["roulant"]) ?? "oui",
    statut: (s(v.statut) as DeclarationIncident["statut"]) ?? "declare",
    responsabilite: (s(v.responsabilite) as DeclarationIncident["responsabilite"]) ?? null,
    blesses: false,
    sinistreOuvert: false,
    declarantId: c.auteur,
  };
  return { declaration, immatriculationAffichee: l.vehicule.immatriculationAffichee, vehicule: `${l.vehicule.marque} ${l.vehicule.appellation}`, cout: 0, immobilisationJours: 0 };
}

export function fabriquerSanction(c: Creation, chauffeurId: string): Sanction {
  const v = c.valeurs;
  return { id: c.numero, numero: c.numero, chauffeurId, date: s(v.date) ?? c.date.slice(0, 10), type: (s(v.type) as Sanction["type"]) ?? "avertissement", motif: s(v.motif) ?? "", jours: n(v.jours), incidentId: null, depenseId: null };
}

export function fabriquerIndisponibilite(c: Creation, chauffeurId: string): Indisponibilite {
  const v = c.valeurs;
  return { id: c.numero, numero: c.numero, chauffeurId, motif: (s(v.motif) as Indisponibilite["motif"]) ?? "autre", debut: s(v.debut) ?? c.date.slice(0, 10), fin: s(v.fin), commentaire: s(v.commentaire) };
}

export function fabriquerEvenementAptitude(c: Creation): EvenementJournal {
  const v = c.valeurs;
  return { date: s(v.date) ?? c.date.slice(0, 10), auteur: c.auteur, initiales: initialesDe(c.auteur), categorie: "statut", texte: `Décision d'aptitude (${c.numero}) : ${s(v.aptitude) ?? "—"}${s(v.motif) ? ` — ${s(v.motif)}` : ""}.` };
}

export function fabriquerEvenementIndisponibilite(c: Creation): EvenementJournal {
  const v = c.valeurs;
  return { date: s(v.debut) ?? c.date.slice(0, 10), auteur: c.auteur, initiales: initialesDe(c.auteur), categorie: "statut", texte: `${MOTIF_INDISPONIBILITE[(s(v.motif) as keyof typeof MOTIF_INDISPONIBILITE) ?? "autre"]} (${c.numero}) du ${s(v.debut) ?? "?"}${s(v.fin) ? ` au ${s(v.fin)}` : ""}${s(v.commentaire) ? ` — ${s(v.commentaire)}` : ""}.` };
}

/** Le libellé d'un site, pour un identifiant surchargé sur une fiche. */
export function libelleSite(siteId: string | null): string | null {
  return SITES.find((x) => x.id === siteId)?.libelle ?? null;
}

/** Libellé d'un type de document, pour les titres de modale. */
export function libelleDocument(type: TypeDocument): string {
  return TYPE_DOCUMENT[type];
}

/**
 * Un véhicule créé dans l'application, en ligne de flotte. Sa première visite
 * technique saisie devient son échéance de conformité — pour un véhicule léger
 * neuf, c'est la date accordée par la réglementation, sans règle d'exemption.
 */
export function fabriquerLigneFlotte(c: Creation): LigneFlotte {
  const v = c.valeurs;
  const canonique = normaliser(s(v.immatriculation) ?? c.numero);
  const oui = (x: unknown) => x === "oui" || x === true;
  const vt = s(v.premiereVisiteTechnique);
  const j = vt ? joursRestants(vt, new Date("2026-09-02T00:00:00Z")) : null;
  const km = n(v.kilometrage);
  return {
    vehicule: {
      id: canonique,
      immatriculation: canonique,
      immatriculationAffichee: afficher(canonique),
      vin: s(v.vin),
      marque: s(v.marque) ?? "",
      appellation: s(v.appellation) ?? "",
      typeModele: s(v.typeModele),
      categorie: (s(v.categorie) as CategorieVehicule) ?? "camion",
      categorieFlotte: (s(v.categorieFlotte) as CategorieFlotte) ?? "interne",
      transportSpecial: oui(v.transportSpecial),
      usage: (s(v.usage) as UsageVehicule) ?? "autre",
      engage: v.engage === undefined || v.engage === null ? true : oui(v.engage),
      premiereMiseEnCirculation: s(v.premiereMiseEnCirculation),
      dateImmatriculation: s(v.dateImmatriculation),
      puissanceCv: null,
      cylindree: null,
      ptac: null,
      ptra: null,
      poidsVide: null,
      chargeUtile: n(v.chargeUtile),
      energie: (s(v.energie) as Energie) ?? "gasoil",
      capaciteReservoir: null,
      businessUnit: (s(v.businessUnit) as BusinessUnit) ?? null,
      siteId: s(v.siteId),
      statut: "en-service",
      valeurAcquisition: n(v.valeurAcquisition),
      dureeAmortissementAnnees: null,
      commentaire: s(v.commentaire),
    },
    chauffeurTitulaire: null,
    nombreSuppleants: 0,
    site: SITES.find((x) => x.id === s(v.siteId)) ?? null,
    kilometrage: km,
    dateKilometrage: km === null ? null : c.date.slice(0, 10),
    prochaineEcheanceConformite: vt && j !== null ? { type: "visite-technique", echeance: vt, joursRestants: j } : null,
    prochaineEcheanceEntretien: null,
    coutDouzeMois: null,
    attelageCourant: null,
    statutEffectif: "en-service",
    immobilisationAdministrative: [],
  };
}

/**
 * Une déclaration créée par le formulaire en quatre étapes, en ligne de liste —
 * pour le module Incidents & sinistres et l'onglet de la fiche véhicule.
 */
export function fabriquerLigneIncident(c: Creation): LigneIncident | null {
  const v = c.valeurs;
  const l = vehiculeDe(s(v.vehiculeId));
  if (!l) return null;
  const chauffeur = listeChauffeurs().find((x) => x.id === s(v.chauffeurId)) ?? null;
  const blesses = typeof v.blesses === "boolean" ? v.blesses : Boolean(s(v.blesses) && s(v.blesses) !== "aucun");
  return {
    numero: c.numero,
    vehiculeId: l.vehicule.id,
    immatriculation: l.vehicule.immatriculation,
    immatriculationAffichee: l.vehicule.immatriculationAffichee,
    vehicule: `${l.vehicule.marque} ${l.vehicule.appellation}`,
    businessUnit: l.vehicule.businessUnit,
    site: l.site?.libelle ?? null,
    nature: (s(v.nature) as LigneIncident["nature"]) ?? "incident",
    type: (s(v.type) as LigneIncident["type"]) ?? "autre",
    dateHeure: s(v.dateHeure) ?? c.date.slice(0, 16),
    lieu: s(v.lieu) ?? "",
    chauffeurId: chauffeur?.id ?? null,
    chauffeur: chauffeur?.nomComplet ?? s(v.chauffeur) ?? null,
    mission: (s(v.mission) as LigneIncident["mission"]) ?? null,
    roulant: (s(v.roulant) as LigneIncident["roulant"]) ?? "oui",
    statut: (s(v.statut) as LigneIncident["statut"]) ?? "declare",
    responsabilite: (s(v.responsabilite) as LigneIncident["responsabilite"]) ?? null,
    blesses,
    sinistreOuvert: Boolean(v.sinistreOuvert),
    cout: n(v.coutDepannage),
    immobilisationJours: null,
    description: s(v.description) ?? "",
    kilometrage: n(v.kilometrage),
    declarant: s(v.declarant) ?? c.auteur,
    creee: true,
  };
}

/* -- Caisse & achats ------------------------------------------------------------ */

/**
 * Un mouvement de caisse créé dans l'application. Le solde est laissé à zéro :
 * il se recalcule sur le journal entier, il ne s'attache pas à une ligne.
 * Le véhicule et le poste viennent de la dépense rattachée, résolue dans la
 * liste des dépenses à régler que l'écran a reçue du serveur.
 */
export function fabriquerLigneMouvement(c: Creation, depenses: DepenseCaisse[]): LigneMouvement {
  const v = c.valeurs;
  const numeroDepense = s(v.depenseNumero);
  const d = numeroDepense ? (depenses.find((x) => x.numero === numeroDepense) ?? null) : null;
  return {
    numero: c.numero,
    date: s(v.date) ?? c.date.slice(0, 10),
    sens: numeroDepense ? "sortie" : ((s(v.sens) as LigneMouvement["sens"]) ?? "entree"),
    libelle: s(v.libelle) ?? d?.libelle ?? "",
    montant: n(v.montant) ?? 0,
    beneficiaire: s(v.beneficiaire) ?? d?.beneficiaire ?? null,
    piece: s(v.piece),
    justificatif: b(v.justificatif),
    depenseNumero: numeroDepense,
    poste: d?.poste ?? null,
    vehiculeId: d?.vehiculeId ?? null,
    immatriculation: d?.immatriculation ?? null,
    immatriculationAffichee: d?.immatriculationAffichee ?? null,
    businessUnit: d?.businessUnit ?? null,
    site: d?.site ?? null,
    soldeApres: 0,
    enregistrePar: c.auteur,
    creee: true,
  };
}

/**
 * Une demande d'achat créée dans l'application : elle naît soumise, jamais
 * validée d'avance. Le fournisseur est cité par son numéro PRE ; sa raison
 * sociale se lit dans le référentiel, fiches créées comprises.
 */
export function fabriquerLigneAchat(c: Creation, prestataires: Prestataire[]): LigneAchat {
  const v = c.valeurs;
  const l = vehiculeDe(s(v.vehiculeId));
  const origineNumero = s(v.origineNumero) ?? "";
  const prestataireNumero = s(v.prestataireNumero);
  const prestataire = prestataireNumero ? (prestataires.find((p) => p.numero === prestataireNumero) ?? null) : null;
  return {
    numero: c.numero,
    date: s(v.date) ?? c.date.slice(0, 10),
    objet: s(v.objet) ?? "",
    poste: (s(v.poste) as LigneAchat["poste"]) ?? "divers",
    montantEstime: n(v.montantEstime) ?? 0,
    prestataireNumero,
    fournisseur: prestataire?.raisonSociale ?? s(v.fournisseur),
    urgence: (s(v.urgence) as LigneAchat["urgence"]) ?? "normale",
    origineNumero,
    origineLibelle: null,
    origineHref: lienOrigine(origineNumero, l?.vehicule.immatriculation ?? null),
    vehiculeId: l?.vehicule.id ?? null,
    immatriculation: l?.vehicule.immatriculation ?? null,
    immatriculationAffichee: l?.vehicule.immatriculationAffichee ?? null,
    businessUnit: l?.vehicule.businessUnit ?? null,
    site: l?.site?.libelle ?? null,
    demandeur: c.auteur,
    /* La création ne retient que le nom de l'auteur ; le rôle s'en déduit, et
       c'est lui qu'on préviendra de la décision. */
    demandeurRole: ROLES.find((r) => r.nom === c.auteur)?.role ?? "gestionnaire-parc",
    etape: (s(v.etape) as LigneAchat["etape"]) ?? "soumise",
    visaPar: s(v.visaPar),
    visaLe: s(v.visaLe),
    validePar: s(v.validePar),
    valideeLe: s(v.valideeLe),
    numeroDemandeX3: s(v.numeroDemandeX3),
    numeroBonCommande: s(v.numeroBonCommande),
    montantEngage: n(v.montantEngage),
    dateLivraison: s(v.dateLivraison),
    dateFacture: s(v.dateFacture),
    montantReel: n(v.montantReel),
    dateReglement: s(v.dateReglement),
    depenseNumero: s(v.depenseNumero),
    commentaireDecision: s(v.commentaireDecision),
    creee: true,
  };
}

/* -- Maintenance ---------------------------------------------------------------- */

/** Un ordre de travail créé dans l'application : il naît planifié, jamais clos d'avance. */
export function fabriquerLigneOrdre(c: Creation): LigneOrdre | null {
  const v = c.valeurs;
  const l = vehiculeDe(s(v.vehiculeId));
  if (!l) return null;
  const origineNumero = s(v.origineNumero);
  return {
    numero: c.numero,
    vehiculeId: l.vehicule.id,
    immatriculation: l.vehicule.immatriculation,
    immatriculationAffichee: l.vehicule.immatriculationAffichee,
    vehicule: `${l.vehicule.marque} ${l.vehicule.appellation}`,
    businessUnit: l.vehicule.businessUnit,
    site: l.site?.libelle ?? null,
    type: (s(v.type) as LigneOrdre["type"]) ?? "curatif",
    objet: s(v.objet) ?? "",
    origineNumero,
    origineLibelle: origineNumero ? null : "Plan d'entretien",
    garage: s(v.garage) ?? "—",
    datePrevue: s(v.datePrevue) ?? c.date.slice(0, 10),
    immobilisationPrevueJours: n(v.immobilisationPrevueJours),
    montantEstime: n(v.montantEstime),
    statut: (s(v.statut) as LigneOrdre["statut"]) ?? "planifie",
    dateDebut: s(v.dateDebut),
    dateCloture: s(v.dateCloture),
    interventionNumero: s(v.interventionNumero),
    commentaire: s(v.commentaire),
    demandeur: c.auteur,
    creee: true,
  };
}

/* -- Carburant ------------------------------------------------------------------ */

/**
 * Un mouvement de cuve créé dans l'application : une livraison quand il porte
 * un libellé, un relevé de jauge sinon (le formulaire de jauge n'en demande pas).
 * Le stock après et l'écart se recalculent sur le journal entier.
 */
export function fabriquerLigneCuve(c: Creation): LigneCuve {
  const v = c.valeurs;
  const libelle = s(v.libelle);
  const litres = n(v.litres) ?? 0;
  const prixLitre = n(v.prixLitre);
  return {
    numero: c.numero,
    date: s(v.date) ?? c.date.slice(0, 10),
    sens: libelle ? "livraison" : "jauge",
    libelle: libelle ?? "Relevé de jauge",
    litres,
    prixLitre,
    montant: n(v.montant) ?? (prixLitre !== null ? Math.round(litres * prixLitre) : null),
    fournisseur: s(v.fournisseur),
    piece: s(v.piece),
    pleinNumero: null,
    vehiculeId: null,
    immatriculation: null,
    immatriculationAffichee: null,
    businessUnit: null,
    site: null,
    ecart: null,
    stockApres: 0,
    enregistrePar: c.auteur,
    creee: true,
  };
}

/**
 * Un chauffeur créé depuis la liste, mis à la forme d'une ligne de liste.
 *
 * Comme pour un véhicule, la fiche complète viendra avec la base : ici on ne
 * fabrique que ce que la liste sait montrer — identité, contrat, site, permis
 * et visite médicale. Les échéances sont calculées à la même règle que les
 * autres, sans quoi un chauffeur créé apparaîtrait à jour alors qu'il n'a
 * aucune pièce.
 */
export function fabriquerLigneChauffeur(c: Creation): LigneChauffeur {
  const v = c.valeurs;
  const prenom = s(v.prenom) ?? "";
  const nom = s(v.nom) ?? "";
  const nomComplet = `${prenom} ${nom}`.trim() || c.numero;
  const aujourdhui = new Date(`${c.date.slice(0, 10)}T00:00:00Z`);
  const echeance = (type: TypeDocument, valeur: string | null): EcheanceChauffeur => ({
    type,
    echeance: valeur,
    joursRestants: valeur ? joursRestants(valeur, aujourdhui) : null,
    manquant: valeur === null,
  });
  const categories = (s(v.permisCategories) ?? "")
    .split(/[^A-Za-z0-9]+/)
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);

  return {
    id: idChauffeur(nomComplet),
    chauffeur: {
      id: idChauffeur(nomComplet),
      matriculeRh: s(v.matriculeRh),
      nom,
      prenom,
      contrat: (s(v.contrat) as "salarie" | "interimaire" | "prestataire") ?? "salarie",
      siteId: s(v.siteId),
      permisNumero: s(v.permisNumero),
      permisCategories: categories,
      permisEcheance: s(v.permisEcheance),
      visiteMedicaleEcheance: s(v.visiteMedicaleEcheance),
      telephone: s(v.telephone),
      aptitude: "apte",
      aptitudeMotif: null,
      aptitudeDate: null,
      dateNaissance: s(v.dateNaissance),
      dateEmbauche: s(v.dateEmbauche),
      dateSortie: s(v.dateSortie),
      actif: s(v.dateSortie) === null,
    },
    nomComplet,
    initiales: initialesDe(nomComplet),
    site: SITES.find((x) => x.id === s(v.siteId)) ?? null,
    /* Sans affectation, un chauffeur créé est disponible : c'est exactement ce
       que l'écran des affectations doit pouvoir lui proposer. */
    statut: "disponible",
    indisponibilite: null,
    vehiculeTitulaire: null,
    suppleances: [],
    permis: echeance("permis", s(v.permisEcheance)),
    visiteMedicale: echeance("visite-medicale", s(v.visiteMedicaleEcheance)),
    kmDouzeMois: null,
    contraventionsDouzeMois: 0,
    incidentsDouzeMois: 0,
  };
}

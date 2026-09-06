/* ============================================================================
 * Fiche véhicule 360° — vues dérivées.
 *
 * Tout ce qui s'affiche sur la fiche se calcule à partir des faits datés du
 * domaine (affectations, documents, relevés, dépenses, périodes de statut).
 * Ces types décrivent le résultat du calcul, tel que la page le consomme ;
 * demain ils seront produits côté serveur par des vues Supabase.
 * ==========================================================================*/

import type { LigneFlotte, MotifImmobilisation, ObservationVisite, PosteDepense, RoleAffectation, StatutVehicule, TypeDocument, VisiteTechnique } from "./types";
import { groupeDuPoste } from "./libelles";

export type EtatDocument = "a-jour" | "bientot" | "echu" | "manquant" | "permanent";

export interface DocumentFiche {
  numero: string;
  type: TypeDocument;
  /** Pour une licence : « Toute la flotte », « 4 véhicules ». */
  portee?: string | null;
  numeroPiece: string | null;
  emetteur: string | null;
  dateEffet: string | null;
  echeance: string | null;
  montant: number | null;
  justificatif: boolean;
  etat: EtatDocument;
  joursRestants: number | null;
}

export interface EcheanceFiche {
  libelle: string;
  /** Date en toutes lettres courtes, ou repère kilométrique. */
  repere: string;
  precision: string;
  ton: "favorable" | "vigilance" | "defavorable" | "neutre";
}

export interface AffectationFiche {
  /** Numéro de référence unique — voir src/domaine/reference.ts. */
  numero: string;
  chauffeur: string | null;
  /** Identifiant de la fiche chauffeur, pour y aller d'un clic. */
  chauffeurId: string | null;
  initiales: string;
  role: RoleAffectation | null;
  debut: string;
  fin: string | null;
  buSite: string;
  kmParcourus: number;
  motif: string;
}

/** L'attelage vu depuis un véhicule : l'autre moitié, et le rôle que ce véhicule y tient. */
export interface AttelageFiche {
  numero: string;
  /** Rôle de ce véhicule dans l'attelage. */
  role: "tracteur" | "remorque";
  autreId: string;
  autreImmatriculation: string;
  autreImmatriculationAffichee: string;
  autreVehicule: string;
  debut: string;
  fin: string | null;
  permanent: boolean;
  motif: string | null;
}

/**
 * Le plan d'entretien d'un véhicule : le gabarit de sa catégorie, ce que le
 * véhicule y change, et l'état de chaque opération face au compteur. Voir
 * `domaine/entretien.ts` — ici la fiche ne fait que porter le résultat.
 */
export interface PlanEntretienFiche {
  programmeCode: string;
  programmeLibelle: string;
  programmePrecision: string;
  base: "km" | "heures";
  /** La date du calcul : elle sert au recalcul côté écran, après un ajustement. */
  aujourdhui: string;
  compteurs: import("./entretien").CompteursVehicule;
  echeances: import("./entretien").EcheanceEntretien[];
}

export interface Intervention {
  numero: string;
  date: string;
  type: "preventif" | "curatif";
  objet: string;
  garage: string;
  km: number | null;
  immobilisationJours: number;
  montant: number;
  reference: string;
}

export interface ConsommationMensuelle {
  /** « 2026-03 ». */
  mois: string;
  source: string;
  litres: number;
  kmParcourus: number;
  litresAux100: number;
  ecartPct: number;
  cout: number;
}

/**
 * Une dépense rattachée au véhicule, quelle que soit sa voie de paiement :
 * caisse parc, bon de commande X3, facture directe. C'est la ligne de base de
 * l'onglet Coûts — les agrégats par poste et par mois s'en déduisent.
 */
export interface DepenseFiche {
  id: string;
  /** Numéro de référence unique. Un plein, une intervention ou un document et la dépense qu'ils portent partagent le même : une transaction, un numéro. */
  numero: string;
  date: string;
  poste: PosteDepense;
  libelle: string;
  montant: number;
  beneficiaire: string | null;
  reference: string | null;
  origine: "caisse" | "bon-de-commande" | "facture";
  justificatif: boolean;
  /** Compteur relevé au moment de la dépense — chaque dépense est une occasion de le lire. */
  km: number | null;
  /** Renseigné quand le relevé a été écarté par le contrôle de cohérence. */
  kmMotifRejet: string | null;
}

/**
 * Relevé kilométrique — un fait daté, d'origine tracée. Chaque intervention,
 * chaque plein, chaque dépense est une occasion de relever le compteur : c'est
 * de ces relevés, et non d'un champ « kilométrage » saisi à part, que se
 * déduisent l'odomètre courant, la moyenne mensuelle et les échéances d'entretien.
 */
export interface ReleveFiche {
  numero: string;
  date: string;
  valeur: number;
  origine: "saisie" | "plein" | "garage" | "telematique" | "depense";
  /** Ce qui a donné lieu au relevé : « Plein cuve siège », « Garage SEDIMA — vidange ». */
  source: string;
  /** Dépense qui a porté le relevé, s'il y en a une. */
  depenseId: string | null;
  /** Faux quand le contrôle de cohérence l'a écarté — voir src/domaine/releves.ts. */
  valide: boolean;
  motifRejet: string | null;
}

/**
 * Un plein — la transaction élémentaire du carburant. Le cumul mensuel n'est
 * qu'une lecture ; c'est le plein qui porte le bon de sortie, le prix et le
 * relevé du compteur.
 */
export interface PleinFiche {
  id: string;
  numero: string;
  date: string;
  source: string;
  litres: number;
  prixLitre: number;
  montant: number;
  reference: string;
  km: number | null;
  kmMotifRejet: string | null;
}

/** Les trois familles de charges d'un véhicule, telles que le métier les lit. */
export type GroupeCharge = "carburant" | "maintenance" | "autres";

export interface CoutParPoste {
  poste: PosteDepense;
  montant: number;
}

export interface ChargeGroupe {
  groupe: GroupeCharge;
  montant: number;
  postes: CoutParPoste[];
}

export interface CoutMensuel {
  mois: string;
  montant: number;
  /** Le détail du mois par famille de charges — ce qui rend la barre empilable. */
  parGroupe: Record<GroupeCharge, number>;
}

export interface EvenementJournal {
  date: string;
  auteur: string;
  initiales: string;
  categorie: "statut" | "affectation" | "document" | "intervention" | "depense" | "releve" | "note";
  texte: string;
  /** Vrai pour ce qui relève des sanctions : masqué aux rôles non habilités. */
  confidentiel?: boolean;
}

export interface PeriodeStatutFiche {
  statut: StatutVehicule;
  motif: MotifImmobilisation | null;
  debut: string;
  fin: string | null;
  jours: number;
}

export interface IdentiteFiche {
  typeModele: string | null;
  premiereMiseEnCirculation: string | null;
  dateImmatriculation: string | null;
  region: string;
  puissanceCv: number | null;
  cylindree: number | null;
  ptac: number | null;
  ptra: number | null;
  poidsVide: number | null;
  chargeUtile: number | null;
  energie: import("./types").Energie | null;
  capaciteReservoir: number | null;
  utilisation: string;
  regimePropriete: string;
  entite: string;
  valeurAcquisition: number | null;
  dureeAmortissementAnnees: number | null;
  valeurNetteComptable: number | null;
  finAmortissement: string | null;
  gpsActif: boolean;
}

export interface IndicateursFiche {
  kilometrage: number | null;
  kmParMois: number | null;
  consommationL100: number | null;
  coutDouzeMois: number | null;
  coutParKm: number | null;
  disponibilitePct: number | null;
}

/**
 * Les trois lectures d'un ensemble de dépenses : par poste, par famille de
 * charges, et par mois. Une seule règle de calcul, que le jeu de démonstration
 * applique au serveur et que la fiche réapplique dès qu'une dépense est créée
 * ou modifiée dans le navigateur — sans quoi l'Aperçu montrerait des agrégats
 * plus vieux que les listes qu'il résume.
 */
export function agregerCouts(
  depenses: { date: string; poste: PosteDepense; montant: number }[],
  mois: string[],
): { coutsParPoste: CoutParPoste[]; chargesParGroupe: ChargeGroupe[]; coutsMensuels: CoutMensuel[]; total: number } {
  const parPoste = new Map<PosteDepense, number>();
  for (const d of depenses) parPoste.set(d.poste, (parPoste.get(d.poste) ?? 0) + d.montant);
  const coutsParPoste: CoutParPoste[] = [...parPoste.entries()].map(([poste, montant]) => ({ poste, montant }));
  const chargesParGroupe: ChargeGroupe[] = (["carburant", "maintenance", "autres"] as const).map((groupe) => {
    const postes = coutsParPoste.filter((c) => groupeDuPoste(c.poste) === groupe).sort((a, b) => b.montant - a.montant);
    return { groupe, montant: postes.reduce((somme, c) => somme + c.montant, 0), postes };
  });
  const coutsMensuels: CoutMensuel[] = mois.map((m) => {
    const duMois = depenses.filter((d) => d.date.startsWith(m));
    const parGroupe: Record<GroupeCharge, number> = { carburant: 0, maintenance: 0, autres: 0 };
    for (const d of duMois) parGroupe[groupeDuPoste(d.poste)] += d.montant;
    return { mois: m, montant: duMois.reduce((somme, d) => somme + d.montant, 0), parGroupe };
  });
  return { coutsParPoste, chargesParGroupe, coutsMensuels, total: depenses.reduce((somme, d) => somme + d.montant, 0) };
}

export interface FicheVehicule {
  ligne: LigneFlotte;
  identite: IdentiteFiche;
  indicateurs: IndicateursFiche;
  echeances: EcheanceFiche[];
  documents: DocumentFiche[];
  affectations: AffectationFiche[];
  attelages: AttelageFiche[];
  /** Le processus de visite technique : rendez-vous, passages, refus, contre-visites. */
  visitesTechniques: VisiteTechnique[];
  /** Les défauts relevés par le centre, suivis comme actions correctives. */
  observationsVisite: ObservationVisite[];
  /** Nulle quand tous les documents critiques sont en règle. Voir src/domaine/documents.ts. */
  immobilisationAdministrative: import("./documents").ImmobilisationAdministrative | null;
  planEntretien: PlanEntretienFiche;
  prochaineIntervention: { libelle: string; kmRestants: number; joursEstimes: number; aKm: number } | null;
  interventions: Intervention[];
  carburant: ConsommationMensuelle[];
  referenceL100: number;
  depenses: DepenseFiche[];
  pleins: PleinFiche[];
  releves: ReleveFiche[];
  coutsParPoste: CoutParPoste[];
  chargesParGroupe: ChargeGroupe[];
  coutsMensuels: CoutMensuel[];
  journal: EvenementJournal[];
  periodesStatut: PeriodeStatutFiche[];
}

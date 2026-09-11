/* ============================================================================
 * La flotte tierce — les camions et les chauffeurs qui ne sont pas à nous.
 *
 * Brainstorm du 5 septembre 2026 avec la Direction des Opérations. Ce qui en
 * ressort, et qui commande tout ce fichier :
 *
 *   « Le transporteur, sous contrat ou non, met à disposition un certain nombre
 *     de véhicules bien identifiés avec des chauffeurs bien identifiés, mais on
 *     ne le paie qu'à la tonne livrée. »
 *
 * Ce n'est pas une vue de l'esprit : le relevé hebdomadaire de tonnage tenu par
 * la DO (`RECAP TONNAGE HEBDOMMADAIRE.xlsx`, treize semaines) est exactement
 * cette liste — transporteur, chauffeur nommé, camion immatriculé, téléphone,
 * puis destination et tonnage jour par jour. **SEDIMA y figure comme un
 * transporteur parmi les autres**, ce qui est précisément le « pilotage
 * unifié » dont le compte rendu ADEX du 10 avril 2025 déplore l'absence.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * **La règle qui décide de ce qui existe ici.** On ne crée un objet au
 * référentiel que si on doit le suivre **dans le temps**. Un camion de
 * transporteur dédié, on suit ses missions, ses tonnages, sa disponibilité — il
 * existe. Le camion d'un client venu enlever sa marchandise une seule fois, on
 * veut seulement savoir qui est passé : c'est un **champ de la transaction**,
 * pas une fiche. Lui en donner une remplirait le parc de véhicules fantômes que
 * personne ne mettrait jamais à jour.
 * ==========================================================================*/

import type { Ton } from "./libelles";
import type { RegimeFiscal } from "./transporteurs";
import type { CategorieVehicule } from "./types";

/* -- Ce qu'est un transporteur ---------------------------------------------- */

/**
 * Un transporteur est une société ou une personne physique. La distinction
 * n'est pas cosmétique : elle décide de ce qu'on peut lui demander — un NINEA,
 * une attestation fiscale, une assurance flotte — et de ce qui serait absurde
 * de réclamer à un particulier qui roule avec son camion.
 */
export type FormeTransporteur = "societe" | "particulier";

export const FORME_TRANSPORTEUR: Record<FormeTransporteur, { libelle: string; precision: string }> = {
  societe: { libelle: "Société", precision: "Personne morale — NINEA, registre de commerce, attestation fiscale" },
  particulier: { libelle: "Particulier", precision: "Personne physique — le camion est à lui, il conduit ou fait conduire" },
};

/**
 * Comment le transporteur est payé.
 *
 * **La tonne livrée est la règle.** La journée est le régime de la mise à
 * disposition — ADEX aujourd'hui, d'autres demain, puisque le métier demande de
 * pouvoir en ajouter. La mission est le régime du ponctuel : il vient une fois,
 * pour un transport précis, et c'est tout.
 *
 * Ce n'est donc pas une catégorie de transporteur mais un **attribut de son
 * contrat**, et un même transporteur peut en porter deux — le plan d'action du
 * compte rendu ADEX vise justement à faire passer ADEX de la journée à « au km,
 * à la tonne ou au mU ».
 */
export type ModeRemuneration = "tonne" | "journee" | "mission";

export const MODE_REMUNERATION: Record<ModeRemuneration, { libelle: string; precision: string; ton: Ton }> = {
  tonne: { libelle: "À la tonne livrée", precision: "Le régime courant : le tonnage relevé à la livraison commande le montant", ton: "favorable" },
  journee: { libelle: "À la journée", precision: "Mise à disposition d'un camion et de son chauffeur, payée au jour, roulé ou non", ton: "vigilance" },
  mission: { libelle: "À la mission", precision: "Un transport ponctuel, convenu au coup par coup", ton: "neutre" },
};

/**
 * Le profil d'un transporteur : ce qui le qualifie en tant que partenaire de
 * transport, par-dessus sa fiche de prestataire.
 *
 * `sousContrat` est délibérément un booléen et non un statut à trois valeurs :
 * la question 42 a montré qu'un tableur de tarifs tenu par la gestion de parc
 * n'est pas un contrat. Ou bien il y a un écrit signé, ou bien il n'y en a pas.
 */
export interface ProfilTransporteur {
  /** Le numéro du prestataire : le profil ne double pas l'identité, il la complète. */
  numero: string;
  forme: FormeTransporteur;
  sousContrat: boolean;
  /** Référence de l'écrit qui lie les parties, quand il existe. */
  referenceContrat: string | null;
  debutContrat: string | null;
  finContrat: string | null;
  /** Un transporteur peut cumuler : ADEX est à la journée, et passera à la tonne. */
  modes: ModeRemuneration[];
  /** Ce qu'il s'engage à mettre à disposition, quand c'est écrit. */
  camionsEngages: number | null;
  /** TVA 18 % ou retenue à la source 5 % : ce qui dit si une charge se lit hors taxe ou TTC. */
  regimeFiscal: RegimeFiscal;
  commentaire: string | null;
}

/** Vrai quand le transporteur roule sans écrit : un écart ne s'y conteste pas. */
export function sansEcrit(p: ProfilTransporteur): boolean {
  return !p.sousContrat;
}

/* -- La flotte ---------------------------------------------------------------- */

/**
 * Un camion de transporteur, nommé et suivi.
 *
 * Il n'entre pas dans le parc : il n'a ni carte grise à notre nom, ni entretien
 * à notre charge, ni valeur à amortir. Ce qu'on en suit, c'est ce qu'il fait
 * pour nous — les tonnes qu'il porte et les missions qu'il tient.
 */
export interface CamionTiers {
  /** « AA312CT », sans espace : la même normalisation que le parc. */
  immatriculation: string;
  immatriculationAffichee: string;
  transporteurNumero: string;
  categorie: CategorieVehicule;
  /** Capacité utile annoncée, en tonnes. Nulle tant qu'elle n'a pas été relevée. */
  capaciteTonnes: number | null;
  /** Le chauffeur qui le conduit d'ordinaire — un camion tiers en change peu. */
  chauffeurHabituelId: string | null;
  actif: boolean;
  commentaire: string | null;
}

/**
 * Un chauffeur de transporteur.
 *
 * Le téléphone est la donnée la plus utile de toutes : c'est par lui que
 * l'exploitation joint le camion en route, et le relevé hebdomadaire de la DO
 * le porte pour chaque ligne. Il figure donc ici, et non en commentaire.
 */
export interface ChauffeurTiers {
  id: string;
  nom: string;
  telephone: string | null;
  transporteurNumero: string;
  actif: boolean;
}

/** Les camions d'un transporteur, actifs d'abord. */
export function camionsDe(camions: CamionTiers[], transporteurNumero: string): CamionTiers[] {
  return camions.filter((c) => c.transporteurNumero === transporteurNumero).sort((a, b) => Number(b.actif) - Number(a.actif) || a.immatriculationAffichee.localeCompare(b.immatriculationAffichee));
}

export function chauffeursDe(chauffeurs: ChauffeurTiers[], transporteurNumero: string): ChauffeurTiers[] {
  return chauffeurs.filter((c) => c.transporteurNumero === transporteurNumero).sort((a, b) => Number(b.actif) - Number(a.actif) || a.nom.localeCompare(b.nom));
}

/** La capacité qu'un transporteur peut engager : la somme de ses camions actifs. */
export function capaciteTotale(camions: CamionTiers[]): number | null {
  const actifs = camions.filter((c) => c.actif && c.capaciteTonnes !== null);
  if (actifs.length === 0) return null;
  return actifs.reduce((somme, c) => somme + (c.capaciteTonnes ?? 0), 0);
}

/* -- Le rattachement d'une localité à une destination tarifaire -------------- */

/**
 * Le problème que la grille ne voit pas.
 *
 * Les contrats fixent un prix **par destination** — Thiès, Touba, Kaolack. Mais
 * on livre à Bayakh, Niakhirate, Kaniac, Wayembam, Gorom : sur les 245 libellés
 * de destination du relevé hebdomadaire, une poignée seulement figure dans la
 * grille. Jusqu'ici l'application rapprochait les libellés et déclarait « hors
 * grille » tout ce qui ne tombait pas juste — ce qui est faux dans l'esprit, et
 * fabriquait de faux écarts de facturation.
 *
 * Une localité livrée se **rattache** donc à une destination tarifaire, et le
 * rattachement se **retient** : la deuxième fois, il est proposé. Sans mémoire,
 * on refait vingt fois le même arbitrage et deux personnes le tranchent
 * différemment ; avec mémoire, l'écart se discute parce qu'il repose sur une
 * règle écrite, datée et signée.
 */
export interface RattachementLocalite {
  /** Le libellé tel qu'il est écrit sur le relevé : « BAYAKH », « TIV PEUL ». */
  localite: string;
  /** La destination de la grille à laquelle on le facture. */
  destination: string;
  /**
   * D'où vient le rattachement : négocié avec le transporteur (`convenu`), ou
   * décidé à l'usage par l'exploitation (`usage`). Le premier s'oppose, le
   * second se discute — la même distinction que pour les grilles.
   */
  origine: "convenu" | "usage";
  motif: string | null;
  auteur: string | null;
  date: string | null;
}

/** La destination tarifaire d'une localité, si elle est rattachée. */
export function destinationTarifaire(localite: string, rattachements: RattachementLocalite[]): RattachementLocalite | null {
  const cle = normaliserLocalite(localite);
  return rattachements.find((r) => normaliserLocalite(r.localite) === cle) ?? null;
}

/** « TIV PEUL », « Tiv-Peul », « tiv peul » désignent le même endroit. */
export function normaliserLocalite(libelle: string): string {
  return libelle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/* -- L'exception tarifaire ---------------------------------------------------- */

/**
 * Ce qu'on fait quand ni la grille ni le rattachement ne conviennent.
 *
 * Deux formes, demandées par le métier : un **prix exceptionnel** qui remplace
 * le tarif, ou un **complément** qui s'ajoute au tarif de la destination
 * rattachée — le cas d'une localité un peu plus loin que celle de la grille.
 *
 * Et surtout, la troisième idée, qui est celle qui fait vivre une grille :
 * **l'exception peut devenir la règle**. Une fois posée et jugée bonne, elle se
 * promeut en ligne de grille ou en rattachement, et cesse d'être une exception.
 * C'est ainsi qu'une grille tarifaire se construit réellement — par les cas
 * rencontrés, non par une négociation qui aurait tout prévu.
 */
export interface ExceptionTarifaire {
  /** Prix qui remplace celui de la grille, dans l'unité de la ligne rattachée. */
  prixExceptionnel: number | null;
  /** Montant ajouté au tarif normal — un détour, une attente, un accès difficile. */
  complement: number | null;
  motif: string;
  auteur: string | null;
  date: string | null;
  /** Vrai quand l'exception a été reprise comme référence pour l'avenir. */
  promue: boolean;
}

/** Le montant retenu, exception comprise. `base` est le montant de la grille. */
export function montantAvecException(base: number | null, e: ExceptionTarifaire | null): number | null {
  if (!e) return base;
  const socle = e.prixExceptionnel ?? base;
  if (socle === null) return e.complement;
  return socle + (e.complement ?? 0);
}

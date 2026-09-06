/* ============================================================================
 * Affectations — le planning véhicule × période et ses règles.
 *
 * L'affectation est une entité datée (choix structurant n° 1). Ce module la lit
 * en travers : tous les véhicules, tous les chauffeurs, une période. Il en tire
 * ce que la gestion de parc regarde chaque matin — qui conduit quoi, quel
 * véhicule est sans chauffeur, quel chauffeur est libre, et ce qui cloche.
 * ==========================================================================*/

import type { LigneChauffeur } from "./chauffeur";
import { peutConduire } from "./chauffeur";
import { STATUT_VEHICULE } from "./libelles";
import type { CategorieVehicule, RoleAffectation, StatutVehicule } from "./types";

export interface AffectationPlanning {
  numero: string;
  chauffeurId: string | null;
  chauffeur: string | null;
  role: RoleAffectation | null;
  debut: string;
  fin: string | null;
  motif: string;
}

export interface VehiculePlanning {
  id: string;
  immatriculation: string;
  immatriculationAffichee: string;
  marque: string;
  appellation: string;
  categorie: CategorieVehicule;
  statut: StatutVehicule;
  engage: boolean;
  site: string | null;
  siteId: string | null;
  affectations: AffectationPlanning[];
  /**
   * Renseigné pour un camion de transporteur — il n'appartient pas au parc.
   *
   * Le métier a demandé le 5 septembre 2026 de pouvoir « programmer les
   * chauffeurs et les véhicules des prestataires, mais les rendre distinctifs
   * par rapport à la flotte SEDIMA ». Les deux vivent donc sur le même
   * planning, parce que c'est la même journée d'exploitation qu'on organise,
   * mais rien ne les confond : ni la couleur, ni la pastille, ni les compteurs
   * du bandeau, qui ne comptent que le parc.
   */
  tiers: { transporteurNumero: string; transporteur: string } | null;
}

/** Vrai pour un camion de transporteur : il ne compte pas dans les indicateurs du parc. */
export function estTiers(v: VehiculePlanning): boolean {
  return v.tiers !== null;
}

export function couvre(a: { debut: string; fin: string | null }, jour: string): boolean {
  return a.debut <= jour && (a.fin === null || a.fin >= jour);
}

export function titulaireLeJour(v: VehiculePlanning, jour: string): AffectationPlanning | null {
  return v.affectations.find((a) => a.role === "titulaire" && a.chauffeurId && couvre(a, jour)) ?? null;
}

export function suppleantsLeJour(v: VehiculePlanning, jour: string): AffectationPlanning[] {
  return v.affectations.filter((a) => a.role === "suppleant" && a.chauffeurId && couvre(a, jour));
}

/* -- Ce qui cloche -------------------------------------------------------------- */

export type GraviteConflit = "defavorable" | "vigilance";

export interface Conflit {
  cle: string;
  gravite: GraviteConflit;
  titre: string;
  precision: string;
  vehiculeId: string | null;
  chauffeurId: string | null;
}

/**
 * Les conflits du jour, du plus grave au plus bénin :
 *  - deux titulaires en même temps sur un véhicule ;
 *  - un chauffeur titulaire de deux véhicules en même temps ;
 *  - un titulaire indisponible ou inapte, sans suppléant en place ;
 *  - un chauffeur affecté alors qu'il ne peut pas conduire (documents, aptitude) ;
 *  - un véhicule opérationnel sans titulaire.
 */
export function conflits(vehicules: VehiculePlanning[], chauffeurs: LigneChauffeur[], jour: string): Conflit[] {
  const liste: Conflit[] = [];
  const parId = new Map(chauffeurs.map((c) => [c.id, c]));

  for (const v of vehicules) {
    const titulaires = v.affectations.filter((a) => a.role === "titulaire" && a.chauffeurId && couvre(a, jour));
    if (titulaires.length > 1) {
      liste.push({ cle: `2t-${v.id}`, gravite: "defavorable", titre: `${v.immatriculationAffichee} a ${titulaires.length} titulaires en même temps`, precision: titulaires.map((t) => t.chauffeur).join(", "), vehiculeId: v.id, chauffeurId: null });
    }
    const t = titulaires[0] ?? null;
    if (t?.chauffeurId) {
      const c = parId.get(t.chauffeurId);
      if (c) {
        const suppleants = suppleantsLeJour(v, jour).filter((s) => {
          const cs = parId.get(s.chauffeurId!);
          return cs ? peutConduire(cs) : false;
        });
        if (c.statut === "indisponible" && suppleants.length === 0) {
          liste.push({ cle: `ind-${v.id}`, gravite: "defavorable", titre: `${v.immatriculationAffichee} sans conducteur aujourd'hui`, precision: `${c.nomComplet} est indisponible et aucun suppléant apte n'est en place`, vehiculeId: v.id, chauffeurId: c.id });
        } else if (!peutConduire(c) && c.statut !== "indisponible") {
          liste.push({ cle: `apt-${v.id}`, gravite: "defavorable", titre: `${c.nomComplet} ne peut pas conduire ${v.immatriculationAffichee}`, precision: c.chauffeur.aptitude === "inapte" ? "Déclaré inapte" : "Permis ou visite médicale non valide", vehiculeId: v.id, chauffeurId: c.id });
        }
      }
    } else if (v.engage && STATUT_VEHICULE[v.statut].operationnel) {
      liste.push({ cle: `st-${v.id}`, gravite: "vigilance", titre: `${v.immatriculationAffichee} sans titulaire`, precision: `${v.marque} ${v.appellation} · ${STATUT_VEHICULE[v.statut].libelle}${v.site ? ` · ${v.site}` : ""}`, vehiculeId: v.id, chauffeurId: null });
    }
  }

  const parChauffeur = new Map<string, VehiculePlanning[]>();
  for (const v of vehicules) {
    const t = titulaireLeJour(v, jour);
    if (!t?.chauffeurId) continue;
    parChauffeur.set(t.chauffeurId, [...(parChauffeur.get(t.chauffeurId) ?? []), v]);
  }
  for (const [id, vs] of parChauffeur) {
    if (vs.length > 1) {
      const c = parId.get(id);
      liste.push({ cle: `2v-${id}`, gravite: "defavorable", titre: `${c?.nomComplet ?? id} est titulaire de ${vs.length} véhicules`, precision: vs.map((v) => v.immatriculationAffichee).join(", "), vehiculeId: null, chauffeurId: id });
    }
  }

  return liste.sort((a, b) => (a.gravite === b.gravite ? 0 : a.gravite === "defavorable" ? -1 : 1));
}

/* -- Propositions --------------------------------------------------------------- */

export interface Proposition {
  chauffeur: LigneChauffeur;
  /** Pourquoi lui, en une ligne. */
  raison: string;
  score: number;
}

const LOURDS: CategorieVehicule[] = ["camion", "tracteur", "semi-remorque", "bus", "engin"];

/**
 * Qui pour un véhicule sans chauffeur ? Les disponibles qui peuvent conduire,
 * classés : permis adapté à la catégorie, même site, ancienneté sur ce type de
 * véhicule. Une proposition, pas une décision.
 */
export function propositions(v: VehiculePlanning, chauffeurs: LigneChauffeur[], limite = 3): Proposition[] {
  const lourd = LOURDS.includes(v.categorie);
  return chauffeurs
    .filter((c) => c.statut === "disponible" && peutConduire(c))
    .map((c) => {
      let score = 0;
      const raisons: string[] = [];
      const permisLourd = c.chauffeur.permisCategories.includes("C") || c.chauffeur.permisCategories.includes("E");
      if (lourd && permisLourd) {
        score += 3;
        raisons.push("permis poids lourd");
      } else if (!lourd) {
        score += 2;
      } else {
        score -= 5;
        raisons.push("permis léger seulement");
      }
      if (c.site?.id && c.site.id === v.siteId) {
        score += 2;
        raisons.push("même site");
      }
      if (c.chauffeur.contrat === "salarie") score += 1;
      return { chauffeur: c, raison: raisons.length ? raisons.join(", ") : "disponible", score };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score || a.chauffeur.nomComplet.localeCompare(b.chauffeur.nomComplet, "fr"))
    .slice(0, limite);
}

/* -- Période du planning --------------------------------------------------------- */

/**
 * Zoom du planning — un curseur continu, en pixels par jour.
 *
 * Trois repères servent de presets : Mois (dix mois à l'écran), Jour (une
 * colonne par jour), Heure (une colonne par heure). Entre deux, la grille
 * choisit sa maille d'après la place qu'un jour occupe : moins de 12 px, on
 * lit des mois ; moins de 240 px, des jours ; au-delà, des heures. La fenêtre
 * de temps suit le zoom en maille jour et heure — ce qui tient dans à peu près
 * 1 400 px, aujourd'hui aux trois cinquièmes, pour voir surtout ce qui vient ;
 * en maille mois, dix mois entiers.
 */
export type EchellePlanning = "mois" | "jour" | "heure";

/** Pixels par jour aux deux bouts du curseur, et position des repères (0–100). */
export const ZOOM_MIN = 3;
export const ZOOM_MAX = 1200;

export function pxParJourDe(curseur: number): number {
  const t = Math.max(0, Math.min(100, curseur)) / 100;
  return ZOOM_MIN * Math.pow(ZOOM_MAX / ZOOM_MIN, t);
}

export function curseurDe(pxParJour: number): number {
  return Math.round((Math.log(pxParJour / ZOOM_MIN) / Math.log(ZOOM_MAX / ZOOM_MIN)) * 100);
}

export const ECHELLES: { cle: EchellePlanning; libelle: string; precision: string; pxParJour: number }[] = [
  { cle: "mois", libelle: "Mois", precision: "une colonne par mois — dix mois à l'écran", pxParJour: 3 },
  { cle: "jour", libelle: "Jour", precision: "une colonne par jour — cinq semaines à l'écran", pxParJour: 34 },
  { cle: "heure", libelle: "Heure", precision: "une colonne par heure — trois jours à l'écran", pxParJour: 720 },
];

export function echelleDe(pxParJour: number): EchellePlanning {
  if (pxParJour < 12) return "mois";
  if (pxParJour < 240) return "jour";
  return "heure";
}

export interface ColonnePlanning {
  cle: string;
  libelle: string;
  /** Sous le libellé : le jour de la semaine, la date d'un premier créneau. */
  sousLibelle: string | null;
  /** Vrai pour la colonne qui contient aujourd'hui. */
  courante: boolean;
  /** Vrai pour un samedi ou un dimanche, teinté dans la grille. */
  weekend: boolean;
  /** Largeur en pixels, proportionnelle à la durée couverte. */
  largeur: number;
}

export interface BornesPlanning {
  echelle: EchellePlanning;
  pxParJour: number;
  /** ISO à la seconde, en UTC — toutes les positions se calculent là-dessus. */
  debut: string;
  fin: string;
  colonnes: ColonnePlanning[];
  /** Largeur totale de la piste, en pixels. */
  largeur: number;
  /** Où placer le trait d'aujourd'hui. */
  maintenant: string;
}

const MOIS_COURTS = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEP", "OCT", "NOV", "DÉC"];
const JOURS_COURTS = ["di", "lu", "ma", "me", "je", "ve", "sa"];
const LARGEUR_FENETRE = 1400;

function isoJour(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function bornesPlanning(reference: string, pxParJour = 3): BornesPlanning {
  const [a, m, j] = reference.split("-").map(Number);
  const echelle = echelleDe(pxParJour);
  const colonnes: ColonnePlanning[] = [];
  const joursFenetre = Math.max(3, Math.round(LARGEUR_FENETRE / pxParJour));
  const avant = Math.round(joursFenetre * 0.6);
  const apres = joursFenetre - avant;

  if (echelle === "mois") {
    /* Des mois entiers : six en arrière, trois en avant — dix mois, quel que
       soit le zoom dans cette maille ; zoomer élargit les colonnes. */
    const moisAvant = 6;
    const moisApres = 3;
    const debut = new Date(Date.UTC(a!, m! - 1 - moisAvant, 1));
    const fin = new Date(Date.UTC(a!, m! + moisApres, 0));
    for (let i = -moisAvant; i <= moisApres; i++) {
      const d = new Date(Date.UTC(a!, m! - 1 + i, 1));
      const jours = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      colonnes.push({ cle: isoJour(d).slice(0, 7), libelle: `${MOIS_COURTS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`, sousLibelle: null, courante: i === 0, weekend: false, largeur: Math.round(jours * pxParJour) });
    }
    return { echelle, pxParJour, debut: `${isoJour(debut)}T00:00:00Z`, fin: `${isoJour(fin)}T23:59:59Z`, colonnes, largeur: colonnes.reduce((s, c) => s + c.largeur, 0), maintenant: `${reference}T00:00:00Z` };
  }

  if (echelle === "jour") {
    const debut = new Date(Date.UTC(a!, m! - 1, j! - avant));
    const fin = new Date(Date.UTC(a!, m! - 1, j! + apres));
    for (let i = -avant; i <= apres; i++) {
      const d = new Date(Date.UTC(a!, m! - 1, j! + i));
      const jourSemaine = d.getUTCDay();
      colonnes.push({
        cle: isoJour(d),
        libelle: String(d.getUTCDate()),
        sousLibelle: d.getUTCDate() === 1 || i === -avant ? MOIS_COURTS[d.getUTCMonth()]! : JOURS_COURTS[jourSemaine]!,
        courante: i === 0,
        weekend: jourSemaine === 0 || jourSemaine === 6,
        largeur: Math.round(pxParJour),
      });
    }
    return { echelle, pxParJour, debut: `${isoJour(debut)}T00:00:00Z`, fin: `${isoJour(fin)}T23:59:59Z`, colonnes, largeur: colonnes.reduce((s, c) => s + c.largeur, 0), maintenant: `${reference}T00:00:00Z` };
  }

  const debut = new Date(Date.UTC(a!, m! - 1, j! - avant));
  const fin = new Date(Date.UTC(a!, m! - 1, j! + apres));
  const largeurHeure = Math.max(18, Math.round(pxParJour / 24));
  for (let jour = -avant; jour <= apres; jour++) {
    const d = new Date(Date.UTC(a!, m! - 1, j! + jour));
    for (let h = 0; h < 24; h++) {
      colonnes.push({
        cle: `${isoJour(d)}T${String(h).padStart(2, "0")}`,
        libelle: `${String(h).padStart(2, "0")}h`,
        sousLibelle: h === 0 ? `${JOURS_COURTS[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}` : null,
        courante: jour === 0 && h === 12,
        weekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
        largeur: largeurHeure,
      });
    }
  }
  return { echelle, pxParJour, debut: `${isoJour(debut)}T00:00:00Z`, fin: `${isoJour(fin)}T23:59:59Z`, colonnes, largeur: colonnes.reduce((s, c) => s + c.largeur, 0), maintenant: `${reference}T12:00:00Z` };
}

/** Bornes ISO d'une affectation, journées entières, pour la placer sur la grille. */
export function bornesAffectation(a: { debut: string; fin: string | null }, bornes: BornesPlanning): { debut: string; fin: string } {
  return { debut: `${a.debut}T00:00:00Z`, fin: a.fin ? `${a.fin}T23:59:59Z` : bornes.fin };
}

/** Position d'une date entre deux bornes, en pourcentage. */
export function position(jour: string, debut: string, fin: string): number {
  const d = new Date(debut).getTime();
  const f = new Date(fin).getTime();
  const x = new Date(jour).getTime();
  return Math.max(0, Math.min(100, ((x - d) / (f - d)) * 100));
}

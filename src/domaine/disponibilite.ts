/* ============================================================================
 * Disponibilité du jour — le statut « prêt à charger » et la capacité.
 *
 * Le cahier des charges §8 le définit ainsi : un véhicule est prêt à charger
 * s'il est **opérationnel** (statut effectif en service ou en backup, engagé au
 * parc), s'il a **un conducteur affecté** aujourd'hui, et si ce conducteur est
 * **disponible et apte** (ni indisponible, ni inapte, documents valides). Il se
 * déduit, il ne se saisit pas. La capacité est la somme des charges utiles des
 * véhicules prêts, par catégorie.
 * ==========================================================================*/

import type { LigneChauffeur } from "./chauffeur";
import { peutConduire } from "./chauffeur";
import type { ImmobilisationAdministrative } from "./documents";
import { MOTIF_INDISPONIBILITE, STATUT_VEHICULE, TYPE_DOCUMENT } from "./libelles";
import type { BusinessUnit, CategorieFlotte, CategorieVehicule, StatutVehicule, UsageVehicule } from "./types";

export type EtatDisponibilite = "pret" | "sans-conducteur" | "conducteur-empeche" | "immobilise" | "hors-perimetre";

export const ETAT_DISPONIBILITE: Record<EtatDisponibilite, { libelle: string; couleur: string; precision: string }> = {
  pret: { libelle: "Prêt à charger", couleur: "var(--color-statut-service)", precision: "Opérationnel, conducteur affecté, disponible et apte" },
  "sans-conducteur": { libelle: "Sans conducteur", couleur: "var(--color-statut-backup)", precision: "Opérationnel, mais personne au volant aujourd'hui" },
  "conducteur-empeche": { libelle: "Conducteur empêché", couleur: "var(--color-statut-reparation)", precision: "Opérationnel, mais le conducteur est indisponible ou inapte" },
  immobilise: { libelle: "Immobilisé", couleur: "var(--color-statut-hors-service)", precision: "Réparation, restauration, hors service, immobilisation administrative" },
  "hors-perimetre": { libelle: "Hors périmètre", couleur: "var(--color-statut-retrait)", precision: "En mutation, en retrait ou non engagé au parc" },
};

export interface ConducteurDuJour {
  id: string;
  nom: string;
  role: "titulaire" | "suppleant";
  /** Pourquoi il ne peut pas conduire, s'il ne le peut pas. */
  empechement: string | null;
}

export interface LigneDisponibilite {
  vehiculeId: string;
  immatriculation: string;
  immatriculationAffichee: string;
  marque: string;
  appellation: string;
  categorie: CategorieVehicule;
  categorieFlotte: CategorieFlotte;
  businessUnit: BusinessUnit | null;
  usage: UsageVehicule;
  transportSpecial: boolean;
  site: string | null;
  statutSaisi: StatutVehicule;
  statutEffectif: StatutVehicule;
  immobilisation: ImmobilisationAdministrative | null;
  engage: boolean;
  chargeUtile: number | null;
  conducteur: ConducteurDuJour | null;
  etat: EtatDisponibilite;
  /** Ce qui manque pour être prêt, en une ligne. */
  motif: string | null;
}

/** Le conducteur du jour : le titulaire s'il peut conduire, sinon un suppléant qui le peut, sinon le titulaire empêché. */
export function conducteurDuJour(
  affectations: { chauffeurId: string | null; chauffeur: string | null; role: "titulaire" | "suppleant" | null; debut: string; fin: string | null }[],
  chauffeurs: Map<string, LigneChauffeur>,
  jour: string,
): ConducteurDuJour | null {
  const enCours = affectations.filter((a) => a.chauffeurId && a.role && a.debut <= jour && (a.fin === null || a.fin >= jour));
  const decrire = (a: (typeof enCours)[number]): ConducteurDuJour => {
    const c = chauffeurs.get(a.chauffeurId!);
    let empechement: string | null = null;
    if (!c) empechement = "chauffeur inconnu";
    else if (!c.chauffeur.actif) empechement = "sorti des effectifs";
    else if (c.statut === "indisponible") empechement = c.indisponibilite ? `indisponible — ${MOTIF_INDISPONIBILITE[c.indisponibilite.motif].toLowerCase()}` : "indisponible";
    else if (c.chauffeur.aptitude === "inapte") empechement = "déclaré inapte";
    else if (!peutConduire(c)) empechement = "permis ou visite médicale non valide";
    return { id: a.chauffeurId!, nom: a.chauffeur ?? c?.nomComplet ?? a.chauffeurId!, role: a.role as "titulaire" | "suppleant", empechement };
  };
  const titulaires = enCours.filter((a) => a.role === "titulaire").map(decrire);
  const suppleants = enCours.filter((a) => a.role === "suppleant").map(decrire);
  return titulaires.find((t) => !t.empechement) ?? suppleants.find((s) => !s.empechement) ?? titulaires[0] ?? suppleants[0] ?? null;
}

export function etatDisponibilite(l: Pick<LigneDisponibilite, "engage" | "statutEffectif" | "conducteur" | "immobilisation">): { etat: EtatDisponibilite; motif: string | null } {
  if (!l.engage || l.statutEffectif === "en-mutation" || l.statutEffectif === "retrait-en-cours" || l.statutEffectif === "a-recevoir") {
    return { etat: "hors-perimetre", motif: !l.engage ? "non engagé au parc" : STATUT_VEHICULE[l.statutEffectif].libelle.toLowerCase() };
  }
  if (!STATUT_VEHICULE[l.statutEffectif].operationnel) {
    return { etat: "immobilise", motif: l.immobilisation ? `immobilisation administrative — ${l.immobilisation.documents.map((d) => `${TYPE_DOCUMENT[d.type].toLowerCase()} ${d.etat === "manquant" ? "manquante" : "échue"}`).join(", ")}` : STATUT_VEHICULE[l.statutEffectif].libelle.toLowerCase() };
  }
  if (!l.conducteur) return { etat: "sans-conducteur", motif: "aucun chauffeur affecté" };
  if (l.conducteur.empechement) return { etat: "conducteur-empeche", motif: `${l.conducteur.nom} : ${l.conducteur.empechement}` };
  return { etat: "pret", motif: null };
}

export interface CapaciteCategorie {
  cle: string;
  libelle: string;
  engages: number;
  operationnels: number;
  prets: number;
  /** Charge utile prête, en kg. */
  chargeUtilePrete: number;
  chargeUtileTotale: number;
}

export function capaciteParCategorie(lignes: LigneDisponibilite[], libelles: Record<string, string>, cleDe: (l: LigneDisponibilite) => string): CapaciteCategorie[] {
  const parCle = new Map<string, CapaciteCategorie>();
  for (const l of lignes) {
    if (!l.engage) continue;
    const cle = cleDe(l);
    const c = parCle.get(cle) ?? { cle, libelle: libelles[cle] ?? cle, engages: 0, operationnels: 0, prets: 0, chargeUtilePrete: 0, chargeUtileTotale: 0 };
    c.engages++;
    c.chargeUtileTotale += l.chargeUtile ?? 0;
    if (STATUT_VEHICULE[l.statutEffectif].operationnel && l.etat !== "hors-perimetre") c.operationnels++;
    if (l.etat === "pret") {
      c.prets++;
      c.chargeUtilePrete += l.chargeUtile ?? 0;
    }
    parCle.set(cle, c);
  }
  return [...parCle.values()].sort((a, b) => b.engages - a.engages);
}

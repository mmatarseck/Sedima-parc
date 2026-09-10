/* ============================================================================
 * Règles des documents — validité, criticité, immobilisation administrative.
 *
 * Décisions du métier du 3 septembre 2026 :
 *  - chaque document a une durée de validité ; la prochaine échéance se calcule
 *    depuis la date d'effet, et l'alerte suit sans saisie ;
 *  - un document **critique** manquant ou échu fait passer le véhicule à un
 *    statut approprié : « hors service » pour motif administratif, sans qu'on
 *    ait à le saisir. Le statut saisi reste en mémoire ; l'application affiche
 *    et compte le statut effectif ;
 *  - la visite technique est annuelle pour tous ; pour un véhicule léger neuf,
 *    l'agent saisit la date de la première visite à la création du véhicule —
 *    pas de règle d'exemption dans l'application.
 *
 * La liste des documents, leur validité, leur criticité et leur applicabilité
 * sont des **paramètres** (src/domaine/parametres.ts), réglables dans
 * Paramètres › Règles des documents. Ce fichier ne porte que le calcul.
 * ==========================================================================*/

import type { EtatDocument } from "./fiche";
import { PARAMETRES_DEFAUT, definitionDocument, type ApplicabiliteDocument, type Parametres } from "./parametres";
import type { CategorieVehicule, MotifImmobilisation, StatutVehicule, TypeDocument } from "./types";

export interface ProfilVehicule {
  categorie: CategorieVehicule;
  transportSpecial: boolean;
}

const LOURDS: CategorieVehicule[] = ["camion", "tracteur", "semi-remorque", "bus", "engin"];
const LEGERS: CategorieVehicule[] = ["camionnette", "vehicule-leger", "moto"];
export const estLourd = (c: CategorieVehicule) => LOURDS.includes(c);
export const estLeger = (c: CategorieVehicule) => LEGERS.includes(c);

function applicable(a: ApplicabiliteDocument, v: ProfilVehicule): boolean {
  switch (a) {
    case "tous":
      return true;
    case "poids-lourds":
      return estLourd(v.categorie);
    case "legers":
      return estLeger(v.categorie);
    case "lourds-et-camionnettes":
      return estLourd(v.categorie) || v.categorie === "camionnette";
    case "transport-special":
      return v.transportSpecial;
  }
}

/** Le document est-il exigé de ce véhicule ? Un document retiré des paramètres ne l'est plus. */
export function exigeDocument(type: TypeDocument, v: ProfilVehicule, p: Parametres = PARAMETRES_DEFAUT): boolean {
  const d = definitionDocument(type, p);
  /* Un type que le parc n'a jamais enregistré n'est pas suivi : le déclarer
     manquant partout immobiliserait toute la flotte sur une absence de saisie. */
  if (!d || d.porteur === "chauffeur" || d.suivi === false) return false;
  return applicable(d.applicabilite, v);
}

export function validiteMois(type: TypeDocument, p: Parametres = PARAMETRES_DEFAUT): number | null {
  return definitionDocument(type, p)?.validiteMois ?? null;
}

/** L'échéance calculée depuis la date d'effet : la veille du même jour, n mois plus tard. */
export function echeanceCalculee(type: TypeDocument, dateEffet: string | null, p: Parametres = PARAMETRES_DEFAUT): string | null {
  const mois = validiteMois(type, p);
  if (!dateEffet || mois === null) return null;
  const [a, m, j] = dateEffet.slice(0, 10).split("-").map(Number);
  const d = new Date(Date.UTC(a!, m! - 1 + mois, j! - 1));
  return d.toISOString().slice(0, 10);
}

export interface ImmobilisationAdministrative {
  statut: StatutVehicule;
  motif: MotifImmobilisation;
  /** Les documents critiques en cause, avec leur état. */
  documents: { type: TypeDocument; etat: EtatDocument }[];
}

/**
 * Le statut effectif d'un véhicule : le statut saisi, sauf si un document
 * critique exigé manque ou est échu — le véhicule est alors hors service pour
 * motif administratif. Un véhicule déjà sortant (mutation, retrait) le reste.
 */
export function immobilisationAdministrative(
  v: ProfilVehicule & { statut: StatutVehicule },
  documents: { type: TypeDocument; etat: EtatDocument }[],
  p: Parametres = PARAMETRES_DEFAUT,
): ImmobilisationAdministrative | null {
  /* Un véhicule sortant ou pas encore reçu n'a pas de documents à tenir. */
  if (v.statut === "en-mutation" || v.statut === "retrait-en-cours" || v.statut === "a-recevoir") return null;
  const critique = (t: TypeDocument) => (definitionDocument(t, p)?.critique ?? false) && exigeDocument(t, v, p);
  const enCause = documents.filter((d) => critique(d.type) && (d.etat === "echu" || d.etat === "manquant"));
  /* Un document critique exigé qui n'est même pas dans la liste manque aussi. */
  for (const d of p.documents.types) {
    if (d.porteur === "chauffeur" || !critique(d.id)) continue;
    if (!documents.some((x) => x.type === d.id)) enCause.push({ type: d.id, etat: "manquant" });
  }
  if (enCause.length === 0) return null;
  return { statut: "hors-service", motif: "administratif", documents: enCause };
}

export function statutEffectif(v: ProfilVehicule & { statut: StatutVehicule }, documents: { type: TypeDocument; etat: EtatDocument }[], p?: Parametres): StatutVehicule {
  return immobilisationAdministrative(v, documents, p)?.statut ?? v.statut;
}

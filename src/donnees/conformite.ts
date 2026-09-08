/* ============================================================================
 * L'échéancier de la Conformité, lu avec la session de l'utilisateur.
 *
 * Chaque document de chaque véhicule et de chaque chauffeur, les licences de
 * transport, le processus de visite technique (délai de contre-visite,
 * rendez-vous pris) et la prochaine échéance d'entretien, sur une seule
 * liste. Base branchée, tout vient des tables : les lignes de la liste Flotte
 * (immobilisation, entretien), les documents des véhicules, les licences et
 * leurs véhicules, les visites en cours et les observations ouvertes (0023),
 * les fiches chauffeurs. Sinon, les fiches de démonstration. Aucune fonction
 * nouvelle : quatre lectures bornées, chacune une fois.
 * ==========================================================================*/

import { cache } from "react";
import { niveauPour, trier, type Echeance } from "@/domaine/conformite";
import { exigeDocument } from "@/domaine/documents";
import { TYPE_DOCUMENT } from "@/domaine/libelles";
import type { Parametres } from "@/domaine/parametres";
import type { FicheChauffeur } from "@/domaine/chauffeur";
import type { LigneFlotte, TypeDocument } from "@/domaine/types";
import { joursRestants } from "@/lib/format";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { DATE_REFERENCE, fichesChauffeurs } from "./chauffeurs-demo";
import { fichePourImmatriculation } from "./fiche-demo";
import { fichesChauffeursServeur } from "./fiche-chauffeur";
import { lignesFlotte, parcServeur } from "./flotte";
import { FLOTTE, LICENCES } from "./parc-demo";

/* -- Ce que la base rend ------------------------------------------------------- */

export interface DocumentVehiculeBase {
  numero: string;
  vehicule_id: string;
  type_document_id: string;
  date_effet: string | null;
  echeance: string | null;
  numero_piece: string | null;
  emetteur: string | null;
}

export interface LicenceBase {
  numero: string;
  libelle: string;
  numero_piece: string;
  emetteur: string;
  perimetre: "flotte" | "partie";
  echeance: string;
  licence_vehicule: { vehicule: { immatriculation: string } | null }[];
}

export interface VisiteEnCoursBase {
  numero: string;
  vehicule_id: string;
  type: "visite" | "contre-visite";
  centre: string;
  date_rendez_vous: string;
  heure: string | null;
  statut: "rendez-vous" | "refusee";
  numero_pv: string | null;
  date_limite_contre_visite: string | null;
}

export interface ObservationOuverteBase {
  vehicule_id: string;
}

export interface FaitsConformite {
  documents: DocumentVehiculeBase[];
  licences: LicenceBase[];
  visites: VisiteEnCoursBase[];
  observations: ObservationOuverteBase[];
}

const fmtKm = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Les échéances des chauffeurs : les mêmes en démonstration et base branchée, depuis leurs fiches. */
function echeancesChauffeurs(fiches: FicheChauffeur[]): Echeance[] {
  const echeances: Echeance[] = [];
  for (const f of fiches) {
    const c = f.ligne;
    if (!c.chauffeur.actif) continue;
    const precision = c.vehiculeTitulaire ? `Titulaire de ${c.vehiculeTitulaire.immatriculationAffichee}${c.site ? ` · ${c.site.libelle}` : ""}` : (c.site?.libelle ?? "Sans véhicule");
    for (const d of f.documents) {
      echeances.push({
        cle: `c-${c.id}-${d.numero}`,
        numero: d.numero,
        sujet: "chauffeur",
        sujetId: c.id,
        sujetLibelle: c.nomComplet,
        sujetPrecision: precision,
        sujetHref: `/chauffeurs/${c.id}?onglet=documents&ref=${d.numero}`,
        type: d.type,
        libelle: TYPE_DOCUMENT[d.type],
        numeroPiece: d.numeroPiece,
        emetteur: d.emetteur,
        echeance: d.echeance,
        joursRestants: d.joursRestants,
        niveau: niveauPour(d.joursRestants, d.etat === "manquant", d.etat === "permanent"),
        repere: null,
        site: c.site?.libelle ?? null,
      });
    }
  }
  return echeances;
}

/**
 * L'échéancier, base branchée — pur, pour le banc d'essai. Les véhicules sont
 * ceux d'exploitation ; un document exigé qui manque apparaît, comme sur la
 * fiche ; la licence se lit une fois, par licence ; un refus de visite sans
 * contre-visite prise ouvre son délai ; un rendez-vous est une échéance.
 */
export function echeancesDepuisLaBase(lignes: LigneFlotte[], uuidParImmat: Map<string, string>, faits: FaitsConformite, fichesChauffeurs: FicheChauffeur[], parametres: Parametres, aujourdhui: string): Echeance[] {
  const reference = new Date(`${aujourdhui}T00:00:00Z`);
  const echeances: Echeance[] = [];
  const observationsPar = new Map<string, number>();
  for (const o of faits.observations) observationsPar.set(o.vehicule_id, (observationsPar.get(o.vehicule_id) ?? 0) + 1);
  const couverts = new Set(faits.licences.flatMap((l) => (l.perimetre === "flotte" ? ["*"] : l.licence_vehicule.map((x) => x.vehicule?.immatriculation ?? ""))));

  for (const l of lignes) {
    const v = l.vehicule;
    if (v.regime && v.regime !== "exploitation") continue;
    const uuid = uuidParImmat.get(v.immatriculation);
    if (!uuid) continue;
    const precision = `${v.marque} ${v.appellation}${l.site ? ` · ${l.site.libelle}` : ""}`;
    const href = (suite: string) => `/flotte/${v.immatriculation}?onglet=conformite${suite}`;
    const documents = faits.documents.filter((d) => d.vehicule_id === uuid);
    const commun = { sujet: "vehicule" as const, sujetId: v.id, sujetLibelle: v.immatriculationAffichee, sujetPrecision: precision, site: l.site?.libelle ?? null, repere: null };

    for (const d of documents) {
      const type = d.type_document_id as TypeDocument;
      if (type === "licence-transport") continue;
      const j = joursRestants(d.echeance, reference);
      const permanent = !d.echeance && !parametres.documents.types.find((t) => t.id === type)?.validiteMois;
      echeances.push({ ...commun, cle: `v-${v.id}-${d.numero}`, numero: d.numero, sujetHref: href(`&ref=${d.numero}`), type, libelle: TYPE_DOCUMENT[type], numeroPiece: d.numero_piece, emetteur: d.emetteur, echeance: d.echeance, joursRestants: j, niveau: niveauPour(j, false, permanent) });
    }
    /* Ce que la fiche exige et qu'elle n'a pas : manquant, il immobilise ou il gêne. */
    for (const def of parametres.documents.types) {
      if (def.porteur === "chauffeur" || !exigeDocument(def.id as TypeDocument, v, parametres)) continue;
      if (documents.some((d) => d.type_document_id === def.id)) continue;
      if (def.id === "licence-transport" && (couverts.has("*") || couverts.has(v.immatriculation))) continue;
      echeances.push({ ...commun, cle: `v-${v.id}-manquant-${def.id}`, numero: null, sujetHref: href(""), type: def.id as TypeDocument, libelle: TYPE_DOCUMENT[def.id as TypeDocument], numeroPiece: null, emetteur: null, echeance: null, joursRestants: null, niveau: niveauPour(null, true) });
    }
    const visites = faits.visites.filter((x) => x.vehicule_id === uuid);
    const refus = visites.find((x) => x.statut === "refusee");
    const contreVisitePrise = visites.some((x) => x.type === "contre-visite" && x.statut === "rendez-vous");
    if (refus?.date_limite_contre_visite && !contreVisitePrise) {
      const j = joursRestants(refus.date_limite_contre_visite, reference);
      const ouvertes = observationsPar.get(uuid) ?? 0;
      echeances.push({ ...commun, cle: `v-${v.id}-contre-visite`, numero: refus.numero, sujetHref: href(`&ref=${refus.numero}`), type: "contre-visite", libelle: `Contre-visite à programmer · ${ouvertes} observation${ouvertes > 1 ? "s" : ""} à corriger`, numeroPiece: refus.numero_pv, emetteur: refus.centre, echeance: refus.date_limite_contre_visite, joursRestants: j, niveau: niveauPour(j, false) });
    }
    for (const rdv of visites.filter((x) => x.statut === "rendez-vous")) {
      const j = joursRestants(rdv.date_rendez_vous, reference);
      echeances.push({ ...commun, cle: `v-${v.id}-${rdv.numero}`, numero: rdv.numero, sujetHref: href(`&ref=${rdv.numero}`), type: "rendez-vous", libelle: `Rendez-vous ${rdv.type === "contre-visite" ? "contre-visite" : "visite technique"}${rdv.heure ? ` à ${rdv.heure}` : ""}`, numeroPiece: null, emetteur: rdv.centre, echeance: rdv.date_rendez_vous, joursRestants: j, niveau: niveauPour(j, false) });
    }
    const p = l.prochaineEcheanceEntretien;
    if (p && (p.joursRestants !== null || p.kmRestants !== null)) {
      const jours = p.joursRestants ?? (p.kmRestants !== null ? Math.max(0, Math.round(p.kmRestants / 100)) : null);
      echeances.push({ ...commun, cle: `v-${v.id}-entretien`, numero: null, sujetHref: `/flotte/${v.immatriculation}?onglet=entretien`, type: "entretien", libelle: p.libelle, numeroPiece: null, emetteur: null, echeance: null, joursRestants: jours, niveau: niveauPour(jours, false), repere: p.kmRestants !== null ? `dans ${fmtKm(Math.max(0, p.kmRestants))} km` : null });
    }
  }

  for (const lic of faits.licences) {
    const j = joursRestants(lic.echeance, reference);
    const immats = lic.licence_vehicule.map((x) => x.vehicule?.immatriculation).filter((x): x is string => Boolean(x));
    const affichees = immats.map((i) => lignes.find((l) => l.vehicule.immatriculation === i)?.vehicule.immatriculationAffichee ?? i);
    echeances.push({
      cle: `lic-${lic.numero}`,
      numero: lic.numero,
      sujet: "vehicule",
      sujetId: "flotte",
      sujetLibelle: lic.perimetre === "flotte" ? "Toute la flotte" : `${immats.length} véhicules`,
      sujetPrecision: lic.perimetre === "flotte" ? lic.libelle : `${lic.libelle} — ${affichees.join(", ")}`,
      sujetHref: "/flotte",
      type: "licence-transport",
      libelle: TYPE_DOCUMENT["licence-transport"],
      numeroPiece: lic.numero_piece,
      emetteur: lic.emetteur,
      echeance: lic.echeance,
      joursRestants: j,
      niveau: niveauPour(j, false),
      repere: null,
      site: null,
    });
  }

  return trier([...echeances, ...echeancesChauffeurs(fichesChauffeurs)]);
}

/* -- La démonstration : depuis les fiches, une seule source ------------------ */

function echeancesDemonstration(parametres: Parametres): Echeance[] {
  const echeances: Echeance[] = [];
  const reference = new Date(`${DATE_REFERENCE}T00:00:00Z`);
  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation, parametres);
    if (!f) continue;
    const v = l.vehicule;
    const precision = `${v.marque} ${v.appellation}${l.site ? ` · ${l.site.libelle}` : ""}`;
    const commun = { sujet: "vehicule" as const, sujetId: v.id, sujetLibelle: v.immatriculationAffichee, sujetPrecision: precision, site: l.site?.libelle ?? null, repere: null };
    for (const d of f.documents) {
      /* Une licence portée par la flotte est une seule échéance : elle est ajoutée plus bas, une fois. */
      if (d.type === "licence-transport" && d.etat !== "manquant") continue;
      echeances.push({ ...commun, cle: `v-${v.id}-${d.numero}`, numero: d.numero, sujetHref: `/flotte/${v.immatriculation}?onglet=conformite&ref=${d.numero}`, type: d.type, libelle: TYPE_DOCUMENT[d.type], numeroPiece: d.numeroPiece, emetteur: d.emetteur, echeance: d.echeance, joursRestants: d.joursRestants, niveau: niveauPour(d.joursRestants, d.etat === "manquant", d.etat === "permanent") });
    }
    for (const d of f.immobilisationAdministrative?.documents ?? []) {
      if (d.etat !== "manquant" || f.documents.some((x) => x.type === d.type)) continue;
      echeances.push({ ...commun, cle: `v-${v.id}-manquant-${d.type}`, numero: null, sujetHref: `/flotte/${v.immatriculation}?onglet=conformite`, type: d.type, libelle: TYPE_DOCUMENT[d.type], numeroPiece: null, emetteur: null, echeance: null, joursRestants: null, niveau: niveauPour(null, true) });
    }
    const refus = f.visitesTechniques.find((x) => x.statut === "refusee");
    const contreVisitePrise = f.visitesTechniques.some((x) => x.type === "contre-visite" && x.statut === "rendez-vous");
    if (refus?.dateLimiteContreVisite && !contreVisitePrise) {
      const j = joursRestants(refus.dateLimiteContreVisite, reference);
      const ouvertes = f.observationsVisite.filter((o) => o.statut !== "corrigee").length;
      echeances.push({ ...commun, cle: `v-${v.id}-contre-visite`, numero: refus.numero, sujetHref: `/flotte/${v.immatriculation}?onglet=conformite&ref=${refus.numero}`, type: "contre-visite", libelle: `Contre-visite à programmer · ${ouvertes} observation${ouvertes > 1 ? "s" : ""} à corriger`, numeroPiece: refus.numeroPv, emetteur: refus.centre, echeance: refus.dateLimiteContreVisite, joursRestants: j, niveau: niveauPour(j, false) });
    }
    for (const rdv of f.visitesTechniques.filter((x) => x.statut === "rendez-vous")) {
      const j = joursRestants(rdv.dateRendezVous, reference);
      echeances.push({ ...commun, cle: `v-${v.id}-${rdv.numero}`, numero: rdv.numero, sujetHref: `/flotte/${v.immatriculation}?onglet=conformite&ref=${rdv.numero}`, type: "rendez-vous", libelle: `Rendez-vous ${rdv.type === "contre-visite" ? "contre-visite" : "visite technique"}${rdv.heure ? ` à ${rdv.heure}` : ""}`, numeroPiece: null, emetteur: rdv.centre, echeance: rdv.dateRendezVous, joursRestants: j, niveau: niveauPour(j, false) });
    }
    if (f.prochaineIntervention) {
      const p = f.prochaineIntervention;
      echeances.push({ ...commun, cle: `v-${v.id}-entretien`, numero: null, sujetHref: `/flotte/${v.immatriculation}?onglet=entretien`, type: "entretien", libelle: p.libelle, numeroPiece: null, emetteur: null, echeance: null, joursRestants: p.joursEstimes, niveau: niveauPour(p.joursEstimes, false), repere: `dans ${fmtKm(p.kmRestants)} km` });
    }
  }
  for (const lic of LICENCES) {
    const j = joursRestants(lic.echeance, reference);
    const immats = lic.vehiculeIds.map((id) => FLOTTE.find((l) => l.vehicule.id === id)?.vehicule.immatriculationAffichee ?? id);
    echeances.push({ cle: `lic-${lic.id}`, numero: lic.numero, sujet: "vehicule", sujetId: "flotte", sujetLibelle: lic.perimetre === "flotte" ? "Toute la flotte" : `${lic.vehiculeIds.length} véhicules`, sujetPrecision: lic.perimetre === "flotte" ? lic.libelle : `${lic.libelle} — ${immats.join(", ")}`, sujetHref: "/flotte", type: "licence-transport", libelle: TYPE_DOCUMENT["licence-transport"], numeroPiece: lic.numeroPiece, emetteur: lic.emetteur, echeance: lic.echeance, joursRestants: j, niveau: niveauPour(j, false), repere: null, site: null });
  }
  return trier([...echeances, ...echeancesChauffeurs(fichesChauffeurs())]);
}

/* -- Ce que la page appelle -------------------------------------------------- */

export interface ConformiteServeur {
  echeances: Echeance[];
  aujourdhui: string;
}

async function conformiteServeurBrut(parametres: Parametres): Promise<ConformiteServeur> {
  if (!authentificationReelle()) return { echeances: echeancesDemonstration(parametres), aujourdhui: DATE_REFERENCE };
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const client = await clientServeur();
  const [lignes, fiches, documents, licences, visites, observations] = await Promise.all([
    lignesFlotte(parametres),
    fichesChauffeursServeur(),
    client.from("document").select("numero, vehicule_id, type_document_id, date_effet, echeance, numero_piece, emetteur").not("vehicule_id", "is", null).limit(5000).returns<DocumentVehiculeBase[]>(),
    client.from("licence_transport").select("numero, libelle, numero_piece, emetteur, perimetre, echeance, licence_vehicule (vehicule (immatriculation))").returns<LicenceBase[]>(),
    client.from("visite_technique").select("numero, vehicule_id, type, centre, date_rendez_vous, heure, statut, numero_pv, date_limite_contre_visite").in("statut", ["rendez-vous", "refusee"]).limit(2000).returns<VisiteEnCoursBase[]>(),
    client.from("observation_visite").select("vehicule_id").neq("statut", "corrigee").limit(2000).returns<ObservationOuverteBase[]>(),
  ]);
  for (const [nom, lecture] of [["documents", documents], ["licences", licences], ["visites", visites], ["observations", observations]] as const) {
    if (lecture.error) console.warn(`Conformité — ${nom} : lecture impossible (${lecture.error.message}).`);
  }
  /* L'identifiant en base de chaque véhicule visible : la liste ne porte que l'immatriculation, le parc déjà lu a les deux. */
  const parc = await parcServeur();
  const uuidParImmat = new Map(parc.vehicules.map((v) => [v.immatriculation, v.id]));
  const faits: FaitsConformite = { documents: documents.data ?? [], licences: licences.data ?? [], visites: visites.data ?? [], observations: observations.data ?? [] };
  return { echeances: echeancesDepuisLaBase(lignes, uuidParImmat, faits, fiches, parametres, aujourdhui), aujourdhui };
}

export const conformiteServeur = cache(conformiteServeurBrut);

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

import { lignesLues } from "./lecture";
import { cache } from "react";
import { niveauPour, trier, type Echeance } from "@/domaine/conformite";
import { idChauffeur } from "@/domaine/chauffeur";
import { TYPE_DOCUMENT } from "@/domaine/libelles";
import type { Parametres } from "@/domaine/parametres";
import type { FicheChauffeur } from "@/domaine/chauffeur";
import type { LigneFlotte, TypeDocument } from "@/domaine/types";
import { joursRestants } from "@/lib/format";
import { clientServeur } from "@/lib/supabase";
import { echeancesChauffeurs, fmtKm } from "./conformite-demo";
import { fichesChauffeursServeur } from "./fiche-chauffeur";
import { lignesFlotte, parcServeur } from "./flotte";

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

interface RappelBase {
  numero: string;
  vehicule_id: string | null;
  chauffeur_id: string | null;
  type_document_id: string;
  echeance: string;
  fait_le: string | null;
  document_numero: string | null;
  chauffeur: { nom: string; prenom: string } | null;
}

export interface FaitsConformite {
  documents: DocumentVehiculeBase[];
  licences: LicenceBase[];
  visites: VisiteEnCoursBase[];
  observations: ObservationOuverteBase[];
  /** Les rappels (0053) ; un lecteur d'avant la table n'en rend pas. */
  rappels?: RappelBase[];
}

export function echeancesDepuisLaBase(lignes: LigneFlotte[], uuidParImmat: Map<string, string>, faits: FaitsConformite, fichesChauffeurs: FicheChauffeur[], parametres: Parametres, aujourdhui: string): Echeance[] {
  const reference = new Date(`${aujourdhui}T00:00:00Z`);
  const echeances: Echeance[] = [];
  const observationsPar = new Map<string, number>();
  for (const o of faits.observations) observationsPar.set(o.vehicule_id, (observationsPar.get(o.vehicule_id) ?? 0) + 1);

  for (const l of lignes) {
    const v = l.vehicule;
    if (v.regime && v.regime !== "exploitation") continue;
    const uuid = uuidParImmat.get(v.immatriculation);
    if (!uuid) continue;
    const precision = `${v.marque} ${v.appellation}${l.site ? ` · ${l.site.libelle}` : ""}`;
    const href = (suite: string) => `/flotte/${v.immatriculation}?onglet=conformite${suite}`;
    const commun = { sujet: "vehicule" as const, sujetId: v.id, sujetLibelle: v.immatriculationAffichee, sujetPrecision: precision, site: l.site?.libelle ?? null, repere: null };

    /*
     * LES RAPPELS, ET NON PLUS LES DOCUMENTS (16 septembre 2026). L'échéance
     * d'une assurance n'est plus celle du dernier scan enregistré : c'est celle
     * que le métier a saisie sur le rappel. Le document, quand il arrive, la
     * prouve — il se cite sur le rappel, et se lit au dossier du véhicule.
     *
     * Plus de ligne « manquant » non plus : un document absent n'est pas une
     * échéance, et immobiliser un véhicule pour un scan qu'on n'a pas encore
     * classé était précisément ce que le métier a demandé de retirer le 15.
     */
    for (const r of (faits.rappels ?? []).filter((x) => x.vehicule_id === uuid)) {
      const j = joursRestants(r.echeance, reference);
      const def = parametres.documents.types.find((t) => t.id === r.type_document_id);
      echeances.push({ ...commun, cle: `v-${v.id}-${r.numero}`, numero: r.numero, sujetHref: href(`&ref=${r.numero}`), type: r.type_document_id as TypeDocument, libelle: def?.libelle ?? TYPE_DOCUMENT[r.type_document_id as TypeDocument] ?? r.type_document_id, numeroPiece: r.document_numero, emetteur: r.fait_le ? `renouvelé le ${r.fait_le.slice(8, 10)}/${r.fait_le.slice(5, 7)}/${r.fait_le.slice(0, 4)}` : null, echeance: r.echeance, joursRestants: j, niveau: niveauPour(j, false) });
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
      /* Des kilomètres restants ne font des jours qu'au rythme du véhicule.
         Faute de l'avoir mesuré, on garde l'ordre de grandeur d'avant. */
      const rythme = p.kmParJour ?? 100;
      const jours = p.joursRestants ?? (p.kmRestants !== null ? Math.max(0, Math.round(p.kmRestants / rythme)) : null);
      echeances.push({ ...commun, cle: `v-${v.id}-entretien`, numero: null, sujetHref: `/flotte/${v.immatriculation}?onglet=entretien`, type: "entretien", libelle: p.libelle, numeroPiece: null, emetteur: null, echeance: null, joursRestants: jours, niveau: niveauPour(jours, false), repere: p.kmRestants !== null ? `dans ${fmtKm(Math.max(0, p.kmRestants))} km` : null });
    }
  }

  /* Les rappels des chauffeurs — permis, visite médicale — sur la même liste.
     Le nom vient de la lecture ; l'adresse de la fiche s'en dérive. */
  for (const r of (faits.rappels ?? []).filter((x) => x.chauffeur_id && x.chauffeur)) {
    const nom = `${r.chauffeur!.prenom} ${r.chauffeur!.nom}`.trim();
    const adresse = idChauffeur(nom);
    const j = joursRestants(r.echeance, reference);
    const def = parametres.documents.types.find((t) => t.id === r.type_document_id);
    echeances.push({ cle: `c-${adresse}-${r.numero}`, numero: r.numero, sujet: "chauffeur", sujetId: adresse, sujetLibelle: nom, sujetPrecision: "Chauffeur", sujetHref: `/chauffeurs/${adresse}?onglet=documents&ref=${r.numero}`, type: r.type_document_id as TypeDocument, libelle: def?.libelle ?? TYPE_DOCUMENT[r.type_document_id as TypeDocument] ?? r.type_document_id, numeroPiece: r.document_numero, emetteur: r.fait_le ? `renouvelé le ${r.fait_le.slice(8, 10)}/${r.fait_le.slice(5, 7)}/${r.fait_le.slice(0, 4)}` : null, echeance: r.echeance, joursRestants: j, niveau: niveauPour(j, false), repere: null, site: null });
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

export interface ConformiteServeur {
  echeances: Echeance[];
  aujourdhui: string;
}

async function conformiteServeurBrut(parametres: Parametres): Promise<ConformiteServeur> {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const client = await clientServeur();
  const [lignes, fiches, documents, licences, visites, observations, rappelsLus] = await Promise.all([
    lignesFlotte(parametres),
    fichesChauffeursServeur(),
    client.from("document").select("numero, vehicule_id, type_document_id, date_effet, echeance, numero_piece, emetteur").not("vehicule_id", "is", null).limit(5000).returns<DocumentVehiculeBase[]>(),
    client.from("licence_transport").select("numero, libelle, numero_piece, emetteur, perimetre, echeance, licence_vehicule (vehicule (immatriculation))").returns<LicenceBase[]>(),
    client.from("visite_technique").select("numero, vehicule_id, type, centre, date_rendez_vous, heure, statut, numero_pv, date_limite_contre_visite").in("statut", ["rendez-vous", "refusee"]).limit(2000).returns<VisiteEnCoursBase[]>(),
    client.from("observation_visite").select("vehicule_id").neq("statut", "corrigee").limit(2000).returns<ObservationOuverteBase[]>(),
    client.from("rappel").select("numero, vehicule_id, chauffeur_id, type_document_id, echeance, fait_le, document_numero, chauffeur (nom, prenom)").order("echeance").limit(5000).returns<RappelBase[]>(),
  ]);
  /* L'identifiant en base de chaque véhicule visible : la liste ne porte que l'immatriculation, le parc déjà lu a les deux. */
  const parc = await parcServeur();
  const uuidParImmat = new Map(parc.vehicules.map((v) => [v.immatriculation, v.id]));
  const faits: FaitsConformite = { documents: lignesLues("Documents des véhicules", documents), licences: lignesLues("Licences de transport", licences), visites: lignesLues("Visites techniques en cours", visites), observations: lignesLues("Observations ouvertes", observations) };
  faits.rappels = lignesLues("Rappels", rappelsLus);
  return { echeances: echeancesDepuisLaBase(lignes, uuidParImmat, faits, fiches, parametres, aujourdhui), aujourdhui };
}

export const conformiteServeur = cache(conformiteServeurBrut);

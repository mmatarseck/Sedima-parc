/* ============================================================================
 * La Maintenance, lue avec la session de l'utilisateur.
 *
 * Base branchée, la même règle qu'en démonstration : **le travail à faire ne
 * se saisit pas, il se déduit** — des échéances du plan d'entretien confrontées
 * aux interventions, des véhicules immobilisés en réparation, des incidents
 * en cours qui ont laissé le véhicule non roulant ; et les ordres ouverts
 * disent ce qui est déjà pris. Les interventions sont celles de la table,
 * avec le véhicule et le garage. Aucune table nouvelle : le parc lu pour la
 * liste Flotte (`lire_parc()`) suffit, complété d'une lecture des incidents en
 * cours et d'une des interventions.
 *
 * Les observations de visite technique (0023) entrent dans le travail à faire
 * tant qu'elles ne sont pas corrigées, avec le délai de contre-visite de la
 * visite qui les a produites.
 * ==========================================================================*/

import { cache } from "react";
import { appelleUneAction, libelleEcheance } from "@/domaine/entretien";
import { afficher } from "@/domaine/immatriculation";
import { MOTIF_IMMOBILISATION, STATUT_VEHICULE, TYPE_INCIDENT } from "@/domaine/libelles";
import { estOuvert, type LigneInterventionFlotte, type LigneOrdre, type LigneTravail } from "@/domaine/maintenance";
import type { Parametres } from "@/domaine/parametres";
import type { BusinessUnit, LigneFlotte, TypeIncident } from "@/domaine/types";
import { date as formaterDate } from "@/lib/format";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { echeancesEntretienDeLaBase, lignesFlotte, parcServeur, type ParcBrut } from "./flotte";
import { interventionsFlotte, travauxAFaire } from "./maintenance-demo";
import { ordresServeur } from "./ordres";

/* -- Interventions ------------------------------------------------------------- */

export interface LigneInterventionBase {
  numero: string;
  vehicule_id: string;
  date: string;
  type: "preventif" | "curatif";
  objet: string;
  montant: number;
  immobilisation_jours: number | null;
  km: number | null;
  reference: string | null;
  vehicule: { immatriculation: string; marque: string; appellation: string; business_unit: BusinessUnit | null; site: { libelle: string } | null } | null;
  prestataire: { raison_sociale: string } | null;
}

export function interventionDepuisLigne(l: LigneInterventionBase): LigneInterventionFlotte {
  const v = l.vehicule;
  return {
    numero: l.numero,
    date: l.date,
    type: l.type,
    objet: l.objet,
    garage: l.prestataire?.raison_sociale ?? "—",
    km: l.km,
    immobilisationJours: l.immobilisation_jours,
    montant: Number(l.montant),
    reference: l.reference ?? "",
    vehiculeId: v?.immatriculation ?? l.vehicule_id,
    immatriculation: v?.immatriculation ?? l.vehicule_id,
    immatriculationAffichee: v ? afficher(v.immatriculation) : l.vehicule_id,
    vehicule: v ? `${v.marque} ${v.appellation}` : "—",
    businessUnit: v?.business_unit ?? null,
    site: v?.site?.libelle ?? null,
    creee: false,
  };
}

async function interventionsServeurBrut(): Promise<LigneInterventionFlotte[]> {
  if (!authentificationReelle()) return interventionsFlotte();
  const client = await clientServeur();
  const lecture = await client
    .from("intervention")
    .select("numero, vehicule_id, date, type, objet, montant, immobilisation_jours, km, reference, vehicule (immatriculation, marque, appellation, business_unit, site (libelle)), prestataire (raison_sociale)")
    .order("date", { ascending: false })
    .limit(3000)
    .returns<LigneInterventionBase[]>();
  if (lecture.error) {
    console.warn(`Interventions : lecture impossible (${lecture.error.message}).`);
    return [];
  }
  return lecture.data.map(interventionDepuisLigne);
}

export const interventionsServeur = cache(interventionsServeurBrut);

/* -- Le travail à faire --------------------------------------------------------- */

/** Un incident en cours, tel que la table le dit ; « non roulant » est écrit dans la description par l'application. */
export interface IncidentEnCours {
  numero: string;
  vehicule_id: string;
  date_heure: string;
  type: string;
  immobilisation_jours: number | null;
  description: string | null;
}

/** Une observation non corrigée, avec le délai de contre-visite de sa visite. */
export interface ObservationOuverte {
  numero: string;
  vehicule_id: string;
  libelle: string;
  statut: string;
  intervention_numero: string | null;
  visite_technique: { date_limite_contre_visite: string | null } | null;
}

function joursEntre(debut: string, fin: string): number {
  return Math.max(0, Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86_400_000));
}

function porteur(l: LigneFlotte) {
  return {
    vehiculeId: l.vehicule.id,
    immatriculation: l.vehicule.immatriculation,
    immatriculationAffichee: l.vehicule.immatriculationAffichee,
    vehicule: `${l.vehicule.marque} ${l.vehicule.appellation}`,
    businessUnit: l.vehicule.businessUnit,
    site: l.site?.libelle ?? null,
  };
}

/** Un incident laisse le véhicule non roulant s'il l'immobilise, ou si la déclaration le dit. */
export function laisseNonRoulant(i: IncidentEnCours): boolean {
  return (i.immobilisation_jours ?? 0) > 0 || /non roulant/i.test(i.description ?? "");
}

/**
 * Le travail à faire, déduit des lignes de la liste, du parc brut, des ordres
 * et des incidents en cours — pur, pour le banc d'essai.
 */
export function travauxDepuisLaBase(lignes: LigneFlotte[], parc: ParcBrut, ordres: LigneOrdre[], incidents: IncidentEnCours[], aujourdhui: string, observations: ObservationOuverte[] = []): LigneTravail[] {
  const ouverts = ordres.filter((o) => estOuvert(o.statut));
  const ordrePour = (vehiculeId: string, origineNumero: string | null, type: "preventif" | "curatif") =>
    ouverts.find((o) => o.vehiculeId === vehiculeId && (origineNumero ? o.origineNumero === origineNumero : o.origineNumero === null && o.type === type))?.numero ?? null;
  const uuidParImmat = new Map(parc.vehicules.map((v) => [v.immatriculation, v.id]));
  const ligneParUuid = new Map<string, LigneFlotte>();
  const lignes_ = lignes.filter((l) => l.vehicule.regime === "exploitation");
  for (const l of lignes_) {
    const uuid = uuidParImmat.get(l.vehicule.immatriculation);
    if (uuid) ligneParUuid.set(uuid, l);
  }
  const nonRoulants = incidents.filter(laisseNonRoulant);
  const vehiculesAvecIncident = new Set(nonRoulants.map((i) => i.vehicule_id));

  const travaux: LigneTravail[] = [];
  for (const l of lignes_) {
    const uuid = uuidParImmat.get(l.vehicule.immatriculation);
    if (!uuid) continue;
    const p = porteur(l);
    const compteur = l.kilometrage !== null && l.dateKilometrage ? { km: l.kilometrage, date: l.dateKilometrage } : null;
    for (const e of echeancesEntretienDeLaBase(l.vehicule, uuid, compteur, parc).filter(appelleUneAction)) {
      const ordreNumero = ordrePour(l.vehicule.id, null, "preventif");
      travaux.push({ cle: `echeance:${l.vehicule.id}:${e.code}`, nature: "echeance", urgence: ordreNumero ? "en-cours" : e.etat === "en-retard" ? "en-retard" : "a-planifier", type: "preventif", ...p, objet: e.libelle, origineNumero: null, echeance: libelleEcheance(e).toLowerCase(), kmRestants: e.kmRestants, joursRestants: e.joursRestants, ordreNumero });
    }
    const statut = l.vehicule.statut;
    if ((statut === "en-reparation" || statut === "en-restauration") && !vehiculesAvecIncident.has(uuid)) {
      const ordreNumero = ordrePour(l.vehicule.id, null, "curatif");
      /* La date d'entrée en réparation est dans la trace des statuts, que la liste ne lit pas : l'ordre ouvert la porte, sinon on s'en tient au statut. */
      const depuis = ouverts.find((o) => o.numero === ordreNumero)?.dateDebut ?? null;
      travaux.push({ cle: `immobilisation:${l.vehicule.id}`, nature: "immobilisation", urgence: ordreNumero ? "en-cours" : "a-planifier", type: "curatif", ...p, objet: `${STATUT_VEHICULE[statut].libelle} — ${MOTIF_IMMOBILISATION.panne.toLowerCase()}`, origineNumero: null, echeance: depuis ? `depuis le ${formaterDate(depuis)} · ${joursEntre(depuis, aujourdhui)} j` : "à remettre en état", kmRestants: null, joursRestants: null, ordreNumero });
    }
  }
  for (const o of observations) {
    const l = ligneParUuid.get(o.vehicule_id);
    if (!l) continue;
    const ordreNumero = ordrePour(l.vehicule.id, o.numero, "curatif");
    const limite = o.visite_technique?.date_limite_contre_visite ?? null;
    travaux.push({ cle: `observation:${o.numero}`, nature: "observation", urgence: ordreNumero || o.intervention_numero ? "en-cours" : "a-planifier", type: "curatif", ...porteur(l), objet: o.libelle, origineNumero: o.numero, echeance: limite ? `contre-visite avant le ${formaterDate(limite)}` : "avant la contre-visite", kmRestants: null, joursRestants: limite ? joursEntre(aujourdhui, limite) : null, ordreNumero });
  }
  for (const i of nonRoulants) {
    const l = ligneParUuid.get(i.vehicule_id);
    if (!l) continue;
    const ordreNumero = ordrePour(l.vehicule.id, i.numero, "curatif");
    /* Chaîne ISO par PostgREST, objet Date par un pilote direct : le jour se lit des deux. */
    const jour = (typeof i.date_heure === "string" ? i.date_heure : new Date(i.date_heure).toISOString()).slice(0, 10);
    travaux.push({ cle: `incident:${i.numero}`, nature: "incident", urgence: ordreNumero ? "en-cours" : "a-planifier", type: "curatif", ...porteur(l), objet: `Remise en état — ${TYPE_INCIDENT[i.type as TypeIncident] ?? i.type}`, origineNumero: i.numero, echeance: `depuis le ${formaterDate(jour)} · ${joursEntre(jour, aujourdhui)} j`, kmRestants: null, joursRestants: null, ordreNumero });
  }
  const rang: Record<LigneTravail["urgence"], number> = { "en-retard": 0, "a-planifier": 1, "en-cours": 2, "a-venir": 3 };
  return travaux.sort((a, b) => rang[a.urgence] - rang[b.urgence] || (a.kmRestants ?? 0) - (b.kmRestants ?? 0));
}

async function travauxServeurBrut(parametres: Parametres): Promise<LigneTravail[]> {
  if (!authentificationReelle()) return travauxAFaire();
  const client = await clientServeur();
  const [lignes, parc, ordres, incidents, observations] = await Promise.all([
    lignesFlotte(parametres),
    parcServeur(),
    ordresServeur(),
    client.from("incident").select("numero, vehicule_id, date_heure, type, immobilisation_jours, description").neq("statut", "clos").limit(2000).returns<IncidentEnCours[]>(),
    client.from("observation_visite").select("numero, vehicule_id, libelle, statut, intervention_numero, visite_technique (date_limite_contre_visite)").neq("statut", "corrigee").limit(2000).returns<ObservationOuverte[]>(),
  ]);
  if (incidents.error) console.warn(`Incidents en cours : lecture impossible (${incidents.error.message}).`);
  /* Table pas encore jouée : pas d'observation, pas d'erreur. */
  if (observations.error) console.warn(`Observations de visite : lecture impossible (${observations.error.message}).`);
  return travauxDepuisLaBase(lignes, parc, ordres, incidents.data ?? [], parc.aujourdhui, observations.data ?? []);
}

export const travauxServeur = cache(travauxServeurBrut);

/* ============================================================================
 * Chauffeurs — données de démonstration.
 *
 * Les noms sont ceux de l'inventaire du parc. Tout le reste se déduit des
 * fiches véhicules : les affectations viennent des fiches, et avec elles les
 * kilomètres, la consommation, les contraventions, les frais de route et les
 * pannes de chaque période. Un chauffeur n'a donc jamais deux vérités — ce que
 * dit sa fiche est exactement ce que disent les fiches de ses véhicules.
 *
 * Ce fichier disparaît dès que Supabase est branché.
 * ==========================================================================*/

import {
  debutPeriode,
  idChauffeur,
  initialesDe,
  statutChauffeur,
  type AffectationChauffeur,
  type ConsommationChauffeur,
  type ContraventionChauffeur,
  type EcheanceChauffeur,
  type FicheChauffeur,
  type FraisDeRoute,
  type IncidentChauffeur,
  type LigneChauffeur,
  type ReleveAttribue,
  type VehiculeAffecte,
} from "@/domaine/chauffeur";
import type { DocumentFiche, EvenementJournal } from "@/domaine/fiche";
import { MOTIF_INDISPONIBILITE, TYPE_INCIDENT, TYPE_SANCTION } from "@/domaine/libelles";
import type { Aptitude, Chauffeur, Indisponibilite, MotifIndisponibilite, Responsabilite, Sanction, TypeIncident } from "@/domaine/types";
import { formerNumero } from "@/domaine/reference";
import { date, nombre } from "@/lib/format";
import { fichePourImmatriculation } from "./fiche-demo";
import { FLOTTE, SITES } from "./parc-demo";

/** Date de référence des données de démonstration — la même que les fiches véhicules. */
const AUJOURDHUI = new Date("2026-09-02T00:00:00Z");

/** La même date, en ISO, pour les écrans qui lisent « sur période ». */
export const DATE_REFERENCE = AUJOURDHUI.toISOString().slice(0, 10);

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function decaler(jours: number, depuis: Date = AUJOURDHUI): string {
  const d = new Date(depuis);
  d.setUTCDate(d.getUTCDate() + jours);
  return iso(d);
}

function joursEntre(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (24 * 3600 * 1000));
}

function joursRestants(echeance: string | null): number | null {
  return echeance ? joursEntre(iso(AUJOURDHUI), echeance) : null;
}

/** Générateur pseudo-aléatoire déterministe (mulberry32), pour des fiches stables. */
function graine(cle: string): () => number {
  let h = 1779033703 ^ cle.length;
  for (let i = 0; i < cle.length; i++) {
    h = Math.imul(h ^ cle.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function entre(alea: () => number, min: number, max: number): number {
  return Math.round(min + alea() * (max - min));
}

function choisir<T>(alea: () => number, liste: readonly T[]): T {
  return liste[entre(alea, 0, liste.length - 1)]!;
}

/* -- Ce qui ne se déduit pas des véhicules ---------------------------------- */

interface Complement {
  contrat?: Chauffeur["contrat"];
  site?: string;
  /** Jours restants du permis et de la visite médicale, quand on veut forcer un cas. */
  permisJ?: number;
  visiteJ?: number;
  permisManquant?: boolean;
  sortie?: string;
  aptitude?: { valeur: Aptitude; motif: string; date: string };
  indisponibilite?: { motif: MotifIndisponibilite; debutJ: number; finJ: number | null; commentaire?: string };
  /** Indisponibilités à dates fixes, pour coller aux suppléances des fiches véhicules. */
  indisponibilites?: { motif: MotifIndisponibilite; debut: string; fin: string; commentaire?: string }[];
  accident?: { type: TypeIncident; responsabilite: Responsabilite; joursAvant: number; blesses?: boolean };
}

/**
 * Cas forcés, pour que la liste montre chaque situation au moins une fois :
 * un titulaire en congé, un permis suspendu, un permis échu, un intérimaire
 * sans affectation, un départ. Les autres chauffeurs sont tirés au sort.
 */
const COMPLEMENTS: Record<string, Complement> = {
  "Talla Diène": { indisponibilite: { motif: "conge", debutJ: -6, finJ: 15, commentaire: "Congé annuel" } },
  "Cheikh Sarr": { permisJ: 12, accident: { type: "collision-tiers", responsabilite: "tiers", joursAvant: 47 } },
  "Mamadou Diop": { visiteJ: -18, aptitude: { valeur: "apte-avec-reserve", motif: "Sous réserve du renouvellement de la visite médicale — avis du médecin du travail", date: "2026-08-20" } },
  "Boubacar Dieng": { accident: { type: "collision-sans-tiers", responsabilite: "sedima", joursAvant: 128 } },
  "Amadou Baldé": { permisJ: 58, accident: { type: "accident-chargement", responsabilite: "sedima", joursAvant: 210 }, aptitude: { valeur: "apte-avec-reserve", motif: "Véhicules légers seulement — port de lunettes obligatoire", date: "2026-03-12" } },
  "Khalifa Ndiaye": { contrat: "interimaire" },
  "Moustapha Diaw": { visiteJ: 24, indisponibilites: [{ motif: "conge", debut: "2026-02-03", fin: "2026-02-21", commentaire: "Congé annuel — suppléance d'Ibrahima Camara" }] },
  "Ibrahima Camara": { contrat: "interimaire", site: "s-thies" },
  "Mor Ndiaye": { site: "s-km" },
  "Pape Sène": { site: "s-km", visiteJ: 41 },
  "Ousmane Faye": { site: "s-siege" },
  "Modou Gueye": { site: "s-uab" },
  "Alioune Thiam": { contrat: "interimaire", site: "s-mbour", permisJ: -34 },
  "Ndiaga Sylla": { site: "s-km", indisponibilite: { motif: "suspension-permis", debutJ: -40, finJ: 50, commentaire: "Suspension administrative de 3 mois — excès de vitesse RN1" }, aptitude: { valeur: "inapte", motif: "Permis suspendu — inapte jusqu'à restitution", date: "2026-07-24" } },
  "Saliou Mbengue": { site: "s-siege", sortie: "2026-03-31" },
};

/** Chauffeurs sans affectation dans les fiches véhicules : disponibles, indisponibles ou sortis. */
const SANS_VEHICULE = ["Modou Gueye", "Alioune Thiam", "Ndiaga Sylla", "Saliou Mbengue"];

const LIEUX = ["RN1, sortie de Diamniadio", "Autoroute Dakar–Thiès, PK 32", "Route de Rufisque, Bargny", "RN2, entrée de Tivaouane", "Zone industrielle de Keur Massar", "Pont de Ndiassane", "Route des Niayes, Kayar", "Parking usine UAB"];

const TYPE_PAR_OBJET: [RegExp, TypeIncident][] = [
  [/batterie|alternateur/i, "panne-electrique"],
  [/pneu/i, "crevaison"],
  [/radiateur|durite|surchauffe/i, "surchauffe"],
  [/frein|plaquette/i, "defaut-freinage"],
  [/.*/, "panne-mecanique"],
];

function typeIncidentPourObjet(objet: string): TypeIncident {
  return TYPE_PAR_OBJET.find(([motif]) => motif.test(objet))![1];
}

function joursDuMois(mois: string): number {
  const [a, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(a!, m!, 0)).getUTCDate();
}

/* -- Construction ----------------------------------------------------------- */

interface Construit {
  ligne: LigneChauffeur;
  fiche: FicheChauffeur;
}

/**
 * Indisponibilités d'un chauffeur — tirées à part, avec leur propre graine, parce
 * que l'attribution des kilomètres au suppléant dépend de celles du titulaire :
 * il faut les connaître pour tout le monde avant de calculer qui que ce soit.
 */
function indisponibilitesDe(id: string, nom: string, actif: boolean, rang: number): Indisponibilite[] {
  const alea = graine(`${id}:indisponibilites`);
  const complement = COMPLEMENTS[nom] ?? {};
  const liste: Indisponibilite[] = [];
  if (complement.indisponibilite) {
    const i = complement.indisponibilite;
    liste.push({ id: `i-${id}-1`, numero: "", chauffeurId: id, motif: i.motif, debut: decaler(i.debutJ), fin: i.finJ === null ? null : decaler(i.finJ), commentaire: i.commentaire ?? null });
  }
  for (const [k, i] of (complement.indisponibilites ?? []).entries()) {
    liste.push({ id: `i-${id}-fixe-${k}`, numero: "", chauffeurId: id, motif: i.motif, debut: i.debut, fin: i.fin, commentaire: i.commentaire ?? null });
  }
  if (actif && alea() > 0.45) {
    const debut = decaler(-entre(alea, 120, 330));
    liste.push({ id: `i-${id}-2`, numero: "", chauffeurId: id, motif: alea() > 0.3 ? "conge" : "maladie", debut, fin: decaler(entre(alea, 7, 28), new Date(debut)), commentaire: null });
  }
  if (alea() > 0.7) {
    const debut = decaler(-entre(alea, 30, 200));
    liste.push({ id: `i-${id}-3`, numero: "", chauffeurId: id, motif: "formation", debut, fin: decaler(entre(alea, 1, 3), new Date(debut)), commentaire: "Éco-conduite et arrimage — session SEDIMA" });
  }
  /* Séquence propre au chauffeur (son rang en tête), chronologique. */
  liste.sort((a, b) => a.debut.localeCompare(b.debut)).forEach((i, k) => {
    i.numero = formerNumero("indisponibilite", i.debut, rang * 100 + k + 1);
  });
  return liste.sort((a, b) => b.debut.localeCompare(a.debut));
}

function couvre(debut: string, fin: string | null, d: string): boolean {
  return d >= debut && (fin === null || d <= fin);
}

/** Part d'un mois, jour par jour, où un prédicat est vrai. */
function partDuMois(mois: string, conduit: (jour: string) => boolean): number {
  const n = joursDuMois(mois);
  let jours = 0;
  for (let j = 1; j <= n; j++) if (conduit(`${mois}-${String(j).padStart(2, "0")}`)) jours++;
  return jours / n;
}

function construireTout(): Construit[] {
  const fiches = FLOTTE.map((l) => fichePourImmatriculation(l.vehicule.immatriculation)!);
  const siteParId = new Map(SITES.map((s) => [s.id, s]));

  /* ---- Qui existe : titulaires, suppléants, et les cas sans véhicule ---- */
  const noms = new Map<string, string>(); // id → nom complet
  for (const l of FLOTTE) if (l.chauffeurTitulaire) noms.set(l.chauffeurTitulaire.id, l.chauffeurTitulaire.nom);
  for (const f of fiches) for (const a of f.affectations) if (a.chauffeurId && a.chauffeur) noms.set(a.chauffeurId, a.chauffeur);
  for (const n of SANS_VEHICULE) noms.set(idChauffeur(n), n);

  const indisponibilitesPar = new Map<string, Indisponibilite[]>();
  const rangs = new Map<string, number>();
  let rang = 0;
  for (const [id, nom] of noms) {
    rangs.set(id, ++rang);
    const sortie = COMPLEMENTS[nom]?.sortie ?? null;
    indisponibilitesPar.set(id, indisponibilitesDe(id, nom, !sortie || sortie > iso(AUJOURDHUI), rang));
  }

  /* ---- Affectations, par chauffeur, depuis les fiches véhicules ---- */
  const affectationsPar = new Map<string, AffectationChauffeur[]>();
  for (const f of fiches) {
    const v = f.ligne.vehicule;
    for (const a of f.affectations) {
      if (!a.chauffeurId || !a.role) continue;
      const liste = affectationsPar.get(a.chauffeurId) ?? [];
      liste.push({
        id: `a-${v.immatriculation}-${a.chauffeurId}-${a.debut}`,
        numero: a.numero,
        vehiculeId: v.id,
        immatriculation: v.immatriculation,
        immatriculationAffichee: v.immatriculationAffichee,
        vehicule: `${v.marque} ${v.appellation}`,
        role: a.role,
        debut: a.debut,
        fin: a.fin,
        buSite: a.buSite,
        kmParcourus: a.kmParcourus,
        motif: a.motif,
      });
      affectationsPar.set(a.chauffeurId, liste);
    }
  }

  const resultats: Construit[] = [];

  for (const [id, nom] of noms) {
    const alea = graine(id);
    const complement = COMPLEMENTS[nom] ?? {};
    const rangChauffeur = rangs.get(id)!;
    let sequenceSanction = 0;
    const numeroSanction = (dateIso: string) => formerNumero("sanction", dateIso, rangChauffeur * 100 + ++sequenceSanction);
    const affectations = (affectationsPar.get(id) ?? []).sort((a, b) => (a.fin === null ? -1 : b.fin === null ? 1 : b.debut.localeCompare(a.debut)));
    const titulaire = affectations.find((a) => a.role === "titulaire" && a.fin === null) ?? null;
    const suppleances = affectations.filter((a) => a.role === "suppleant" && a.fin === null);
    const conduitLourd = affectations.some((a) => /camion|tracteur|vrac|frigo|magnum|kerax|premium|ridelle|lpt|at260|ca4250/i.test(a.vehicule));

    const mots = nom.split(/\s+/);
    const nomFamille = mots[mots.length - 1]!;
    const prenom = mots.slice(0, -1).join(" ");

    /* ---- Identité ---- */
    const premiereAffectation = affectations.length ? affectations.reduce((min, a) => (a.debut < min ? a.debut : min), affectations[0]!.debut) : null;
    const anneeEmbauche = premiereAffectation ? Math.min(Number(premiereAffectation.slice(0, 4)), 2025) - entre(alea, 0, 4) : entre(alea, 2012, 2025);
    const dateEmbauche = `${Math.max(2005, anneeEmbauche)}-${String(entre(alea, 1, 12)).padStart(2, "0")}-${String(entre(alea, 1, 28)).padStart(2, "0")}`;
    const dateNaissance = `${entre(alea, 1968, 1994)}-${String(entre(alea, 1, 12)).padStart(2, "0")}-${String(entre(alea, 1, 28)).padStart(2, "0")}`;
    const dateSortie = complement.sortie ?? null;
    const actif = !dateSortie || dateSortie > iso(AUJOURDHUI);
    const aptitude = complement.aptitude ?? null;

    const permisCategories = conduitLourd || alea() > 0.4 ? (alea() > 0.5 ? ["B", "C", "E"] : ["B", "C", "D", "E"]) : ["B"];
    const permisEcheance = complement.permisManquant ? null : decaler(complement.permisJ ?? entre(alea, 45, 1400));
    const visiteMedicaleEcheance = decaler(complement.visiteJ ?? entre(alea, 35, 330));

    const siteId = complement.site ?? (titulaire ? (FLOTTE.find((l) => l.vehicule.id === titulaire.vehiculeId)?.vehicule.siteId ?? null) : choisir(alea, ["s-km", "s-siege", "s-thies", "s-uab"]));

    const chauffeur: Chauffeur = {
      id,
      matriculeRh: `SED-${entre(alea, 1040, 3980)}`,
      nom: nomFamille,
      prenom,
      contrat: complement.contrat ?? (alea() > 0.85 ? "interimaire" : "salarie"),
      siteId,
      permisNumero: complement.permisManquant ? null : `${choisir(alea, ["DK", "TH", "DL"])}-${entre(alea, 100_000, 999_999)}`,
      permisCategories,
      permisEcheance,
      visiteMedicaleEcheance,
      telephone: `77 ${entre(alea, 100, 999)} ${String(entre(alea, 0, 99)).padStart(2, "0")} ${String(entre(alea, 0, 99)).padStart(2, "0")}`,
      aptitude: aptitude?.valeur ?? "apte",
      aptitudeMotif: aptitude?.motif ?? null,
      aptitudeDate: aptitude?.date ?? (alea() > 0.5 ? decaler(-entre(alea, 30, 300)) : null),
      dateNaissance,
      dateEmbauche,
      dateSortie,
      actif,
    };

    /* ---- Indisponibilités ---- */
    const indisponibilites = indisponibilitesPar.get(id) ?? [];
    const aujourdhui = iso(AUJOURDHUI);
    const indisponibiliteCourante = indisponibilites.find((i) => i.debut <= aujourdhui && (i.fin === null || i.fin >= aujourdhui)) ?? null;

    /* ---- Consommation : les mois de chaque véhicule, au prorata des jours ---- */
    const consommation: ConsommationChauffeur[] = [];
    const contraventions: ContraventionChauffeur[] = [];
    const fraisDeRoute: FraisDeRoute[] = [];
    const incidents: IncidentChauffeur[] = [];
    const sanctions: Sanction[] = [];
    const releves: ReleveAttribue[] = [];

    for (const a of affectations) {
      const f = fiches.find((x) => x.ligne.vehicule.id === a.vehiculeId)!;
      const v = f.ligne.vehicule;

      /* Règle d'attribution, décidée par le métier le 3 septembre 2026 : **tout au
         titulaire**. Le suppléant ne reçoit que les jours où le titulaire est
         indisponible (congé, maladie, suspension, formation) ou absent — c'est
         alors lui qui conduit, et lui seul. Un jour donné n'a qu'un conducteur. */
      const titulaireLeJour = (jour: string) => f.affectations.find((x) => x.role === "titulaire" && x.chauffeurId && couvre(x.debut, x.fin, jour)) ?? null;
      const titulaireIndisponible = (jour: string) => {
        const t = titulaireLeJour(jour);
        return t === null || (indisponibilitesPar.get(t.chauffeurId!) ?? []).some((i) => couvre(i.debut, i.fin, jour));
      };
      const unSuppleantLeJour = (jour: string) => f.affectations.some((x) => x.role === "suppleant" && x.chauffeurId && couvre(x.debut, x.fin, jour));
      const conduisait = (jour: string): boolean => {
        if (!couvre(a.debut, a.fin, jour)) return false;
        if (a.role === "titulaire") return !(titulaireIndisponible(jour) && unSuppleantLeJour(jour));
        return titulaireIndisponible(jour);
      };

      for (const c of f.carburant) {
        const part = partDuMois(c.mois, conduisait);
        if (part < 0.03) continue;
        consommation.push({
          mois: c.mois,
          vehiculeId: v.id,
          immatriculationAffichee: v.immatriculationAffichee,
          litres: Math.round(c.litres * part * 10) / 10,
          kmParcourus: Math.round(c.kmParcourus * part),
          litresAux100: c.litresAux100,
          referenceL100: f.referenceL100,
          ecartPct: c.ecartPct,
          cout: Math.round(c.cout * part),
        });
      }

      for (const d of f.depenses) {
        if (!conduisait(d.date)) continue;
        if (d.poste === "contravention") {
          const retenue = alea() > 0.45;
          contraventions.push({ id: d.id, numero: d.numero, date: d.date, vehiculeId: v.id, immatriculationAffichee: v.immatriculationAffichee, libelle: d.libelle, montant: d.montant, reference: d.reference, retenue });
          if (retenue) {
            const dateSanction = decaler(entre(alea, 3, 12), new Date(d.date));
            sanctions.push({ id: `s-${d.id}`, numero: numeroSanction(dateSanction), chauffeurId: id, date: dateSanction, type: "retenue", motif: `Contravention — ${d.libelle}`, jours: null, incidentId: null, depenseId: d.id });
          }
        }
        if (d.poste === "frais-de-route" && d.beneficiaire === nom) {
          fraisDeRoute.push({ id: d.id, numero: d.numero, date: d.date, vehiculeId: v.id, immatriculationAffichee: v.immatriculationAffichee, libelle: d.libelle, montant: d.montant, reference: d.reference, justificatif: d.justificatif });
        }
      }

      /* Les relevés saisis à la main pendant sa conduite — la balise ne dit rien du chauffeur. */
      for (const r of f.releves) {
        if (r.origine === "telematique" || !conduisait(r.date)) continue;
        releves.push({ date: r.date, vehiculeId: v.id, valide: r.valide });
      }

      /* Une panne en ligne, c'est une intervention curative pendant l'affectation. */
      for (const i of f.interventions) {
        if (i.type !== "curatif" || !conduisait(i.date)) continue;
        const type = typeIncidentPourObjet(i.objet);
        incidents.push({
          declaration: {
            id: `inc-${v.immatriculation}-${i.date}`,
            numero: i.numero.replace(/^INT/, "INC"),
            vehiculeId: v.id,
            nature: "incident",
            type,
            dateHeure: `${i.date}T${String(entre(alea, 5, 18)).padStart(2, "0")}:${choisir(alea, ["05", "20", "40", "55"])}:00`,
            lieu: choisir(alea, LIEUX),
            siteId: v.siteId,
            chauffeurId: id,
            mission: choisir(alea, ["livraison", "livraison", "transfert", "retour-a-vide"] as const),
            description: `${TYPE_INCIDENT[type]} — ${i.objet.toLowerCase()}. Véhicule remorqué vers ${i.garage}.`,
            kilometrage: i.km,
            roulant: type === "crevaison" ? "reserve" : "non",
            statut: "clos",
            responsabilite: null,
            blesses: false,
            sinistreOuvert: false,
            declarantId: "gestionnaire-parc",
          },
          immatriculationAffichee: v.immatriculationAffichee,
          vehicule: `${v.marque} ${v.appellation}`,
          cout: i.montant,
          immobilisationJours: i.immobilisationJours ?? 0,
        });
      }
    }

    /* ---- Accident forcé, avec ses suites ---- */
    if (complement.accident && titulaire) {
      const acc = complement.accident;
      const dateAcc = decaler(-acc.joursAvant);
      const idAcc = `acc-${id}-${dateAcc}`;
      const tiers = acc.responsabilite === "tiers" || acc.responsabilite === "partagee";
      incidents.push({
        declaration: {
          id: idAcc,
          numero: formerNumero("incident", dateAcc, 90_000 + rangChauffeur),
          vehiculeId: titulaire.vehiculeId,
          nature: "accident",
          type: acc.type,
          dateHeure: `${dateAcc}T${String(entre(alea, 6, 19)).padStart(2, "0")}:30:00`,
          lieu: choisir(alea, LIEUX),
          siteId,
          chauffeurId: id,
          mission: "livraison",
          description:
            acc.type === "collision-tiers"
              ? "Collision latérale avec un taxi au carrefour, constat amiable établi. Dégâts sur l'aile avant droite et le rétroviseur."
              : acc.type === "collision-sans-tiers"
                ? "Sortie de route en manœuvre de nuit, choc contre une borne. Pare-chocs et phare avant gauche à remplacer."
                : "Chute d'une palette au déchargement, ridelle arrière tordue. Pas de blessé.",
          kilometrage: null,
          roulant: acc.type === "accident-chargement" ? "oui" : "reserve",
          statut: acc.joursAvant > 90 ? "clos" : "en-traitement",
          responsabilite: acc.responsabilite,
          blesses: acc.blesses ?? false,
          sinistreOuvert: tiers || acc.type !== "accident-chargement",
          declarantId: "gestionnaire-parc",
        },
        immatriculationAffichee: titulaire.immatriculationAffichee,
        vehicule: titulaire.vehicule,
        cout: acc.type === "accident-chargement" ? entre(alea, 120, 380) * 1000 : entre(alea, 450, 1800) * 1000,
        immobilisationJours: acc.type === "accident-chargement" ? 1 : entre(alea, 3, 12),
      });
      if (acc.responsabilite === "sedima") {
        const dateSanctionAcc = decaler(entre(alea, 5, 15), new Date(dateAcc));
        sanctions.push({
          id: `s-${idAcc}`,
          numero: numeroSanction(dateSanctionAcc),
          chauffeurId: id,
          date: dateSanctionAcc,
          type: acc.type === "accident-chargement" ? "avertissement" : "blame",
          motif: `${acc.type === "accident-chargement" ? "Accident au chargement" : "Accident responsable"} du ${date(dateAcc)} — rappel des consignes`,
          jours: null,
          incidentId: idAcc,
          depenseId: null,
        });
      }
    }
    if (complement.indisponibilite?.motif === "suspension-permis") {
      sanctions.push({ id: `s-${id}-susp`, numero: numeroSanction(decaler(complement.indisponibilite.debutJ)), chauffeurId: id, date: decaler(complement.indisponibilite.debutJ), type: "mise-a-pied", motif: "Suspension administrative du permis — mise à pied conservatoire", jours: 90, incidentId: null, depenseId: null });
    }

    incidents.sort((a, b) => b.declaration.dateHeure.localeCompare(a.declaration.dateHeure));
    contraventions.sort((a, b) => b.date.localeCompare(a.date));
    fraisDeRoute.sort((a, b) => b.date.localeCompare(a.date));
    sanctions.sort((a, b) => b.date.localeCompare(a.date));
    consommation.sort((a, b) => b.mois.localeCompare(a.mois) || a.immatriculationAffichee.localeCompare(b.immatriculationAffichee));

    /* ---- Documents ---- */
    const jPermis = joursRestants(permisEcheance);
    const jVisite = joursRestants(visiteMedicaleEcheance);
    const etat = (j: number | null, manquant: boolean): DocumentFiche["etat"] => (manquant ? "manquant" : j === null ? "a-jour" : j < 0 ? "echu" : j <= 30 ? "bientot" : "a-jour");
    const permisEffet = permisEcheance ? decaler(-5 * 365, new Date(permisEcheance)) : null;
    const visiteEffet = decaler(-365, new Date(visiteMedicaleEcheance));
    const documents: DocumentFiche[] = [
      {
        numero: formerNumero("document", permisEffet ?? iso(AUJOURDHUI), rangChauffeur * 100 + 1),
        type: "permis",
        numeroPiece: chauffeur.permisNumero,
        emetteur: chauffeur.permisNumero ? "Direction des Transports terrestres" : null,
        dateEffet: permisEffet,
        echeance: permisEcheance,
        montant: null,
        justificatif: Boolean(chauffeur.permisNumero),
        etat: etat(jPermis, !chauffeur.permisNumero),
        joursRestants: jPermis,
      },
      {
        numero: formerNumero("document", visiteEffet, rangChauffeur * 100 + 2),
        type: "visite-medicale",
        numeroPiece: `VM-${visiteEffet.slice(0, 4)}-${entre(alea, 100, 999)}`,
        emetteur: alea() > 0.5 ? "Médecine du travail — IPRES" : "Centre médical SEDIMA",
        dateEffet: visiteEffet,
        echeance: visiteMedicaleEcheance,
        montant: 15_000,
        justificatif: alea() > 0.2,
        etat: etat(jVisite, false),
        joursRestants: jVisite,
      },
    ];

    /* ---- Ligne de liste ---- */
    const versAffecte = (a: AffectationChauffeur): VehiculeAffecte => {
      const v = FLOTTE.find((l) => l.vehicule.id === a.vehiculeId)!.vehicule;
      return { vehiculeId: v.id, immatriculation: v.immatriculation, immatriculationAffichee: v.immatriculationAffichee, marque: v.marque, appellation: v.appellation, role: a.role, debut: a.debut };
    };
    const permis: EcheanceChauffeur = { type: "permis", echeance: permisEcheance, joursRestants: jPermis, manquant: !chauffeur.permisNumero };
    const visiteMedicale: EcheanceChauffeur = { type: "visite-medicale", echeance: visiteMedicaleEcheance, joursRestants: jVisite, manquant: false };
    const depuisDouzeMois = debutPeriode(12, AUJOURDHUI);
    const kmDouzeMois = consommation.filter((c) => `${c.mois}-01` >= depuisDouzeMois).reduce((s, c) => s + c.kmParcourus, 0);

    const ligne: LigneChauffeur = {
      chauffeur,
      id,
      nomComplet: nom,
      initiales: initialesDe(nom),
      site: siteId ? (siteParId.get(siteId) ?? null) : null,
      statut: statutChauffeur(chauffeur, indisponibiliteCourante, Boolean(titulaire) || suppleances.length > 0),
      indisponibilite: indisponibiliteCourante,
      vehiculeTitulaire: titulaire ? versAffecte(titulaire) : null,
      suppleances: suppleances.map(versAffecte),
      permis,
      visiteMedicale,
      kmDouzeMois: affectations.length ? kmDouzeMois : null,
      contraventionsDouzeMois: contraventions.filter((c) => c.date >= depuisDouzeMois).length,
      incidentsDouzeMois: incidents.filter((i) => i.declaration.dateHeure.slice(0, 10) >= depuisDouzeMois).length,
    };

    /* ---- Journal ---- */
    const journal: EvenementJournal[] = [];
    for (const a of affectations) {
      journal.push({ date: a.debut, auteur: "M. Seck", initiales: "MS", categorie: "affectation", texte: `Affecté comme ${a.role === "titulaire" ? "titulaire" : "suppléant"} sur ${a.immatriculationAffichee} (${a.vehicule}) — ${a.motif.toLowerCase()}.` });
      if (a.fin) journal.push({ date: a.fin, auteur: "M. Seck", initiales: "MS", categorie: "affectation", texte: `Fin d'affectation sur ${a.immatriculationAffichee} — ${nombre(a.kmParcourus)} km parcourus sur la période.` });
    }
    for (const d of documents) {
      if (d.dateEffet) journal.push({ date: d.dateEffet, auteur: "Service parc", initiales: "SP", categorie: "document", texte: `${d.type === "permis" ? "Permis de conduire" : "Visite médicale"} ${d.numeroPiece ?? ""} enregistré${d.type === "permis" ? "" : "e"} (${d.emetteur}), échéance ${date(d.echeance)}.` });
    }
    for (const i of incidents) {
      journal.push({ date: i.declaration.dateHeure.slice(0, 10), auteur: "M. Seck", initiales: "MS", categorie: "note", texte: `${i.declaration.nature === "accident" ? "Accident" : "Incident"} déclaré sur ${i.immatriculationAffichee} — ${TYPE_INCIDENT[i.declaration.type].toLowerCase()}, ${i.declaration.lieu}.` });
    }
    for (const s of sanctions) {
      journal.push({ date: s.date, auteur: "Direction des Opérations", initiales: "DO", categorie: "note", texte: `${TYPE_SANCTION[s.type]}${s.jours ? ` de ${s.jours} jours` : ""} — ${s.motif}.`, confidentiel: true });
    }
    for (const c of contraventions) {
      journal.push({ date: c.date, auteur: "Service parc", initiales: "SP", categorie: "depense", texte: `Contravention sur ${c.immatriculationAffichee} — ${c.libelle} (${nombre(c.montant)} F)${c.retenue ? ", retenue sur salaire" : ", prise en charge par le parc"}.` });
    }
    for (const i of indisponibilites) {
      journal.push({ date: i.debut, auteur: "M. Seck", initiales: "MS", categorie: "statut", texte: `${MOTIF_INDISPONIBILITE[i.motif]} du ${date(i.debut)}${i.fin ? ` au ${date(i.fin)}` : ""}${i.commentaire ? ` — ${i.commentaire}` : ""}.` });
    }
    if (dateSortie) journal.push({ date: dateSortie, auteur: "Direction des Opérations", initiales: "DO", categorie: "statut", texte: "Sortie des effectifs — fin de contrat." });
    journal.push({ date: dateEmbauche, auteur: "Service RH", initiales: "RH", categorie: "note", texte: `Entrée dans l'entreprise — contrat ${chauffeur.contrat === "salarie" ? "salarié" : chauffeur.contrat}, matricule ${chauffeur.matriculeRh}.` });
    journal.sort((a, b) => b.date.localeCompare(a.date));

    const age = Math.floor((AUJOURDHUI.getTime() - new Date(dateNaissance).getTime()) / (365.25 * 24 * 3600 * 1000));
    const anciennete = Math.round(((dateSortie ? new Date(dateSortie) : AUJOURDHUI).getTime() - new Date(dateEmbauche).getTime()) / (365.25 * 24 * 3600 * 1000) * 10) / 10;

    const fiche: FicheChauffeur = {
      ligne,
      identite: {
        dateNaissance,
        age,
        dateEmbauche,
        ancienneteAnnees: anciennete,
        dateSortie,
        adresse: `${choisir(alea, ["Rufisque", "Keur Massar", "Thiès", "Pikine", "Bargny", "Diamniadio", "Mbour"])} — ${choisir(alea, ["quartier Santhiaba", "cité SEDIMA", "quartier Escale", "Hann Maristes", "cité Djiby Diallo"])}`,
        contactUrgence: `${choisir(alea, ["Awa", "Fatou", "Aïssatou", "Mariama", "Ndèye"])} ${nomFamille} · 76 ${entre(alea, 100, 999)} ${String(entre(alea, 0, 99)).padStart(2, "0")} ${String(entre(alea, 0, 99)).padStart(2, "0")}`,
        permisNumero: chauffeur.permisNumero,
        permisDelivrance: permisEffet,
        permisCategories,
      },
      documents,
      affectations,
      consommation,
      contraventions,
      incidents,
      sanctions,
      indisponibilites,
      fraisDeRoute,
      releves: releves.sort((a, b) => b.date.localeCompare(a.date)),
      journal: journal.slice(0, 24),
    };

    resultats.push({ ligne, fiche });
  }

  const ordre = { "en-poste": 0, disponible: 1, indisponible: 2, sorti: 3 } as const;
  resultats.sort((a, b) => ordre[a.ligne.statut] - ordre[b.ligne.statut] || a.ligne.chauffeur.nom.localeCompare(b.ligne.chauffeur.nom, "fr"));
  return resultats;
}

let TOUT: Construit[] | null = null;

function tout(): Construit[] {
  if (!TOUT) TOUT = construireTout();
  return TOUT;
}

/** Toutes les lignes de la liste Chauffeurs, dans l'ordre statut puis nom. */
export function listeChauffeurs(): LigneChauffeur[] {
  return tout().map((c) => c.ligne);
}

/** Toutes les fiches — pour le classement, qui compare les chauffeurs entre eux. */
export function fichesChauffeurs(): FicheChauffeur[] {
  return tout().map((c) => c.fiche);
}

/** La fiche d'un chauffeur, par identifiant d'adresse. */
export function fichePourChauffeur(id: string): FicheChauffeur | null {
  return tout().find((c) => c.ligne.id === id)?.fiche ?? null;
}

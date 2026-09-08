/* ============================================================================
 * Fiche véhicule 360° — données de démonstration.
 *
 * Le véhicule AA 032 EA reprend les valeurs de la maquette validée. Les autres
 * fiches sont dérivées de leur ligne de flotte par un générateur déterministe :
 * même véhicule, même fiche, à chaque chargement. Tout ceci disparaît dès que
 * Supabase est branché — la forme des données, elle, reste celle de
 * `src/domaine/fiche.ts`.
 * ==========================================================================*/

import type {
  AffectationFiche,
  AttelageFiche,
  ConsommationMensuelle,
  DepenseFiche,
  DocumentFiche,
  EcheanceFiche,
  EtatDocument,
  EvenementJournal,
  FicheVehicule,
  IndicateursFiche,
  Intervention,
  PeriodeStatutFiche,
  PlanEntretienFiche,
  PleinFiche,
  ReleveFiche,
} from "@/domaine/fiche";
import { agregerCouts } from "@/domaine/fiche";
import { POSTE_DEPENSE, STATUT_VEHICULE, TYPE_DOCUMENT, USAGE_VEHICULE } from "@/domaine/libelles";
import { controlerReleves } from "@/domaine/releves";
import { formerNumero, type TypeTransaction } from "@/domaine/reference";
import { exigeDocument, immobilisationAdministrative } from "@/domaine/documents";
import { PARAMETRES_DEFAUT, empreinteParametres, libelleDocumentCourant, prixEnergie, type Parametres } from "@/domaine/parametres";
import { normaliser } from "@/domaine/immatriculation";
import { idChauffeur } from "@/domaine/chauffeur";
import type { LigneFlotte, ObservationVisite, TypeDocument, Vehicule, VisiteTechnique } from "@/domaine/types";
import { BUSINESS_UNIT } from "@/domaine/libelles";
import { ATTELAGES, FLOTTE, LICENCES } from "./parc-demo";
import { date, joursRestants, nombre } from "@/lib/format";
import type { CompteursVehicule } from "@/domaine/entretien";
import { echeancesDuPlan } from "@/domaine/entretien";
import { passagesReleves, planDuVehicule, programmeParDefaut } from "./entretien-demo";

/** Date de référence des données de démonstration. */
const AUJOURDHUI = new Date("2026-09-02T00:00:00Z");

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function decaler(jours: number, depuis: Date = AUJOURDHUI): string {
  const d = new Date(depuis);
  d.setUTCDate(d.getUTCDate() + jours);
  return iso(d);
}

function moisRelatif(delta: number): string {
  const d = new Date(Date.UTC(AUJOURDHUI.getUTCFullYear(), AUJOURDHUI.getUTCMonth() + delta, 1));
  return iso(d).slice(0, 7);
}

/**
 * Générateur pseudo-aléatoire déterministe (mulberry32), pour des fiches
 * stables. Exporté : les autres jeux de démonstration en dérivent leurs
 * propres séries sans réinventer le procédé.
 */
export function graine(cle: string): () => number {
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

function initiales(nom: string | null): string {
  if (!nom) return "—";
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]!.toUpperCase())
    .join("");
}

function etatDocument(joursRestants: number | null, manquant: boolean, permanent: boolean): EtatDocument {
  if (manquant) return "manquant";
  if (permanent) return "permanent";
  if (joursRestants === null) return "a-jour";
  if (joursRestants < 0) return "echu";
  if (joursRestants <= 30) return "bientot";
  return "a-jour";
}

/** Les garages du jeu de démonstration — le module Maintenance les propose au choix. */
export const GARAGES = ["La Sénégalaise de l'Automobile", "Garage SEDIMA", "First Garage", "Garage Gormack", "TATA Pikine", "ANEC Pikine"];

const OBJETS_CURATIFS = [
  "Remplacement batterie 12V",
  "Injecteurs — démarrage difficile",
  "Alternateur",
  "Boîte de vitesses — synchro 3e",
  "Pneumatiques avant (x2)",
  "Groupe froid — compresseur",
  "Radiateur et durites",
  "Embrayage",
];

import { REFERENCE_L100 } from "@/domaine/assembler-fiche";

const MOIS_COURTS = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEP", "OCT", "NOV", "DÉC"];

export function libelleMois(mois: string, court = false): string {
  const [a, m] = mois.split("-").map(Number);
  if (court) return MOIS_COURTS[m! - 1] ?? mois;
  const longs = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const nom = longs[m! - 1] ?? mois;
  return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${a}`;
}

function construire(l: LigneFlotte, parametres: Parametres): FicheVehicule {
  const v = l.vehicule;
  const alea = graine(v.immatriculation);

  /* Numéros de référence : une séquence par type, propre au véhicule (son rang
     dans la flotte en tête), pour que deux fiches ne se marchent jamais dessus.
     En production, une séquence PostgreSQL par type et par année. */
  const rangVehicule = FLOTTE.findIndex((x) => x.vehicule.immatriculation === v.immatriculation) + 1;
  const compteurs: Partial<Record<TypeTransaction, number>> = {};
  const numeroPour = (type: TypeTransaction, dateIso: string): string => {
    compteurs[type] = (compteurs[type] ?? 0) + 1;
    return formerNumero(type, dateIso, rangVehicule * 1000 + compteurs[type]!);
  };
  /** Attribue, dans l'ordre chronologique, un numéro à ce qui n'en a pas encore. */
  const numeroter = <T extends { numero: string }>(liste: T[], type: TypeTransaction, dateDe: (x: T) => string) => {
    [...liste].sort((a, b) => dateDe(a).localeCompare(dateDe(b))).forEach((x) => {
      if (!x.numero) x.numero = numeroPour(type, dateDe(x));
    });
  };
  const estAA032 = v.immatriculation === "AA032EA";
  const refL100 = REFERENCE_L100[v.categorie] ?? 20;
  const lourd = v.categorie === "camion" || v.categorie === "tracteur" || v.categorie === "semi-remorque";

  /* ---- Identité ---- */
  const anneeMec = estAA032 ? 2021 : entre(alea, 2014, 2024);
  const mec = estAA032 ? "2021-06-28" : `${anneeMec}-${String(entre(alea, 1, 12)).padStart(2, "0")}-${String(entre(alea, 1, 28)).padStart(2, "0")}`;
  const valeur = estAA032 ? 18_500_000 : lourd ? entre(alea, 38, 95) * 1_000_000 : entre(alea, 12, 24) * 1_000_000;
  const duree = lourd ? 7 : 5;
  const ageAnnees = (AUJOURDHUI.getTime() - new Date(mec).getTime()) / (365.25 * 24 * 3600 * 1000);
  const vnc = Math.max(0, Math.round(valeur * (1 - Math.min(1, ageAnnees / duree))));
  const finAmort = new Date(mec);
  finAmort.setUTCFullYear(finAmort.getUTCFullYear() + duree);

  const identite = {
    typeModele: estAA032 ? "KL3TENJTL" : `${v.marque.slice(0, 2).toUpperCase()}${entre(alea, 100, 999)}-${entre(alea, 10, 99)}`,
    premiereMiseEnCirculation: mec,
    dateImmatriculation: mec,
    region: l.site?.region ?? "Dakar",
    puissanceCv: estAA032 ? 10 : lourd ? entre(alea, 18, 42) : entre(alea, 8, 12),
    cylindree: estAA032 ? 2477 : lourd ? entre(alea, 6, 13) * 1000 : entre(alea, 2000, 2800),
    ptac: estAA032 ? 2760 : lourd ? entre(alea, 16, 44) * 1000 : entre(alea, 2500, 3500),
    ptra: v.categorie === "tracteur" ? entre(alea, 40, 60) * 1000 : null,
    poidsVide: estAA032 ? 1690 : lourd ? entre(alea, 6, 14) * 1000 : entre(alea, 1500, 2200),
    chargeUtile: estAA032 ? 1070 : lourd ? entre(alea, 8, 30) * 1000 : entre(alea, 800, 1300),
    energie: v.energie,
    capaciteReservoir: estAA032 ? 75 : lourd ? entre(alea, 200, 400) : entre(alea, 60, 80),
    utilisation: v.transportSpecial ? "Transport spécial" : lourd ? "Livraison" : "Liaison et livraison",
    regimePropriete: v.categorieFlotte === "interne" ? "Propre" : v.categorieFlotte === "adex" ? "Mise à disposition ADEX" : "Location",
    entite: "SEDIMA SA",
    valeurAcquisition: valeur,
    dureeAmortissementAnnees: duree,
    valeurNetteComptable: vnc,
    finAmortissement: iso(finAmort),
    gpsActif: estAA032 || alea() > 0.55,
  };

  /* ---- Kilométrage et indicateurs ---- */
  const kmActuel = l.kilometrage ?? (lourd ? entre(alea, 180_000, 520_000) : entre(alea, 90_000, 300_000));
  const kmParMois = estAA032 ? 5890 : lourd ? entre(alea, 3200, 7800) : entre(alea, 2400, 6200);
  const consommation = estAA032 ? 11.2 : Math.round(refL100 * (0.95 + alea() * 0.25) * 10) / 10;
  const coutDouzeMois = l.coutDouzeMois ?? (lourd ? entre(alea, 5, 14) * 1_000_000 : entre(alea, 2, 6) * 1_000_000);
  const kmDouzeMois = kmParMois * 12;
  const operationnel = STATUT_VEHICULE[v.statut].operationnel;
  const disponibilite = estAA032 ? 94 : operationnel ? entre(alea, 86, 98) : entre(alea, 42, 78);

  const indicateurs: IndicateursFiche = {
    kilometrage: kmActuel,
    kmParMois,
    consommationL100: consommation,
    coutDouzeMois,
    coutParKm: kmDouzeMois > 0 ? Math.round(coutDouzeMois / kmDouzeMois) : null,
    disponibilitePct: disponibilite,
  };

  /** Compteur estimé à une date passée, au rythme mensuel du véhicule. */
  function kmALaDate(dateIso: string): number {
    const jours = (AUJOURDHUI.getTime() - new Date(dateIso).getTime()) / (24 * 3600 * 1000);
    return Math.max(0, Math.round(kmActuel - (jours / 30.44) * kmParMois));
  }

  /* ---- Documents et conformité ---- */
  const jVT = l.prochaineEcheanceConformite?.type === "visite-technique" ? l.prochaineEcheanceConformite.joursRestants : entre(alea, -20, 160);
  const jAss = l.prochaineEcheanceConformite?.type === "assurance" ? l.prochaineEcheanceConformite.joursRestants : entre(alea, 20, 300);

  function doc(
    type: TypeDocument,
    numero: string | null,
    emetteur: string | null,
    effetJ: number | null,
    echeanceJ: number | null,
    montant: number | null,
    options: { manquant?: boolean; permanent?: boolean } = {},
  ): DocumentFiche {
    const manquant = options.manquant ?? false;
    return {
      numero: "",
      type,
      numeroPiece: manquant ? null : numero,
      emetteur: manquant ? null : emetteur,
      dateEffet: manquant || effetJ === null ? null : decaler(effetJ),
      echeance: manquant || echeanceJ === null ? null : decaler(echeanceJ),
      montant: manquant ? null : montant,
      justificatif: !manquant,
      etat: etatDocument(echeanceJ, manquant, options.permanent ?? false),
      joursRestants: manquant ? null : echeanceJ,
    };
  }

  const documents: DocumentFiche[] = [
    doc("assurance", `AXA-2026-${entre(alea, 1000, 9999)}`, "AXA Sénégal", jAss - 365, jAss, lourd ? entre(alea, 900, 1600) * 1000 : 412_000),
    doc("carte-grise", `CG-${String(anneeMec).slice(2)}-${entre(alea, 100_000, 999_999)}`, "DTT", null, null, null, { permanent: true }),
  ];
  /* La visite technique n'est portée que si les paramètres l'exigent de ce
     véhicule (un document retiré des paramètres n'est plus suivi). */
  if (exigeDocument("visite-technique", v, parametres)) {
    documents.unshift(doc("visite-technique", `PV-26-${entre(alea, 1000, 9999)}`, "CCVA", jVT - 183, jVT, lourd ? 55_000 : 35_000));
  }
  /* Le certificat de salubrité ne concerne que les véhicules qui transportent
     des denrées : vracs aliment, frigorifiques, poussins — les « transports
     spéciaux » de la fiche. Pas de vignette : elle n'est plus dans le processus. */
  if (v.transportSpecial) {
    const jSal = v.immatriculation === "AA180CQ" ? -9 : entre(alea, 12, 220);
    documents.push(doc("certificat-salubrite", `CS-${entre(alea, 1000, 9999)}`, "Service d'hygiène — Ministère de la Santé", jSal - 365, jSal, 25_000));
  }
  /* La licence de transport est portée par la flotte, ou par une partie : le
     véhicule affiche celle qui le couvre — la plus proche de son échéance s'il
     en a plusieurs. Un véhicule que rien ne couvre est non conforme. */
  const licences = LICENCES.filter((lic) => lic.perimetre === "flotte" || lic.vehiculeIds.includes(v.id)).sort((a, b) => a.echeance.localeCompare(b.echeance));
  if (licences.length) {
    const lic = licences[0]!;
    const jl = joursRestants(lic.echeance, AUJOURDHUI);
    documents.push({
      numero: lic.numero,
      type: "licence-transport",
      portee: lic.perimetre === "flotte" ? "Toute la flotte" : `${lic.vehiculeIds.length} véhicules — ${lic.libelle.toLowerCase()}`,
      numeroPiece: lic.numeroPiece,
      emetteur: lic.emetteur,
      dateEffet: lic.dateEffet,
      echeance: lic.echeance,
      montant: null,
      justificatif: true,
      etat: etatDocument(jl, false, false),
      joursRestants: jl,
    });
  } else if (lourd || v.categorie === "camionnette") {
    documents.push(doc("licence-transport", null, null, null, null, null, { manquant: true }));
  }
  if (v.transportSpecial) {
    documents.push(doc("carte-transport", `CT-${entre(alea, 1000, 9999)}`, "Direction des Transports terrestres", -300, 65, 75_000));
  }
  numeroter(documents, "document", (d) => d.dateEffet ?? iso(AUJOURDHUI));

  /* Un document critique manquant ou échu immobilise le véhicule, sans saisie. */
  const immobilisation = immobilisationAdministrative(v, documents, parametres);

  const interventions: Intervention[] = [];
  const nbInterventions = estAA032 ? 4 : entre(alea, 3, 7);
  let joursCursor = -entre(alea, 20, 80);

  /*
   * Les entretiens préventifs sont **tirés du plan du véhicule**, et datés à
   * une fraction de leur périodicité. Sans cela le jeu de démonstration et le
   * plan ne se parlaient pas : les objets d'intervention étaient pris dans une
   * liste fixe, et la flotte entière ressortait en retard sur tout — non parce
   * qu'elle l'était, mais parce que les deux séries s'ignoraient.
   *
   * L'avance tirée va de 20 % à 115 % de la périodicité : la plupart des
   * opérations sont donc à jour, quelques-unes arrivent à échéance, quelques
   * autres sont dépassées. C'est ce qu'on veut montrer.
   */
  const operationsDuPlan = programmeParDefaut(v.categorie).operations.filter((o) => o.periodicite.km !== null || o.periodicite.mois !== null);
  let rangOperationTiree = entre(alea, 0, Math.max(0, operationsDuPlan.length - 1));

  for (let i = 0; i < nbInterventions; i++) {
    const preventif = estAA032 ? i % 2 === 0 || i === 3 : alea() > 0.45;
    const immob = preventif ? 1 : entre(alea, 1, lourd ? 9 : 5);
    const montant = preventif
      ? lourd
        ? entre(alea, 180, 420) * 1000
        : entre(alea, 95, 140) * 1000
      : lourd
        ? entre(alea, 250, 2200) * 1000
        : entre(alea, 60, 420) * 1000;

    /* Un préventif se date de son plan ; un curatif tombe quand il tombe. */
    const operation = preventif && operationsDuPlan.length > 0 ? operationsDuPlan[rangOperationTiree++ % operationsDuPlan.length]! : null;
    let dateIntervention = decaler(joursCursor);
    if (operation) {
      const avance = 0.2 + alea() * 0.95;
      const joursDepuis =
        operation.periodicite.km !== null
          ? Math.round(((operation.periodicite.km * avance) / Math.max(1, kmParMois)) * 30)
          : Math.round((operation.periodicite.mois ?? 12) * 30 * avance);
      dateIntervention = decaler(-Math.max(1, Math.min(joursDepuis, 900)));
    }

    interventions.push({
      numero: "",
      date: dateIntervention,
      type: preventif ? "preventif" : "curatif",
      objet: operation ? operation.libelle : OBJETS_CURATIFS[entre(alea, 0, OBJETS_CURATIFS.length - 1)]!,
      garage: GARAGES[entre(alea, 0, GARAGES.length - 1)]!,
      km: kmALaDate(dateIntervention),
      immobilisationJours: immob,
      montant,
      reference: alea() > 0.4 ? `BC${entre(alea, 15_000, 16_999)}` : `ACH${entre(alea, 2500, 2699)}`,
    });
    joursCursor -= entre(alea, 35, 80);
  }
  if (estAA032) {
    interventions.splice(0, interventions.length,
      { numero: "", date: "2026-06-14", type: "preventif", objet: "Vidange + filtres", garage: "La Sénégalaise de l'Automobile", km: kmALaDate("2026-06-14"), immobilisationJours: 1, montant: 118_500, reference: "BC15904" },
      { numero: "", date: "2026-05-02", type: "curatif", objet: "Remplacement batterie Varta 12V 60Ah", garage: "Garage SEDIMA", km: kmALaDate("2026-05-02"), immobilisationJours: 1, montant: 71_685, reference: "ACH2601" },
      { numero: "", date: "2026-03-18", type: "curatif", objet: "Injecteurs — démarrage difficile", garage: "First Garage", km: kmALaDate("2026-03-18"), immobilisationJours: 4, montant: 385_000, reference: "BC15665" },
      { numero: "", date: "2026-01-11", type: "preventif", objet: "Vidange + permutation pneus", garage: "La Sénégalaise de l'Automobile", km: kmALaDate("2026-01-11"), immobilisationJours: 1, montant: 132_000, reference: "BC15839" },
    );
  }
  numeroter(interventions, "intervention", (i) => i.date);

  /* ---- Le plan d'entretien ----
     Il vient après les interventions parce qu'il s'y confronte : une
     périodicité ne dit rien tant qu'on ne sait pas quand l'opération a été
     faite pour la dernière fois. */
  const programme = programmeParDefaut(v.categorie);
  const plan = planDuVehicule(v.id, v.categorie);
  /* Un engin compte des heures. Le compteur horaire n'existe pas encore dans le
     jeu de démonstration : on l'estime sur la durée de service, et le jour où
     l'atelier le relèvera, seule cette ligne changera. */
  const heuresParJour = programme.base === "heures" ? 6 : 0;
  const compteurHeures = programme.base === "heures" ? entre(alea, 3_200, 9_800) : null;
  const compteursVehicule: CompteursVehicule = {
    km: kmActuel,
    heures: compteurHeures,
    kmParJour: Math.max(1, Math.round(kmParMois / 30)),
    heuresParJour: Math.max(0.5, heuresParJour),
    miseEnService: v.premiereMiseEnCirculation,
  };
  const echeancesEntretien = echeancesDuPlan(
    programme,
    plan,
    passagesReleves(programme, interventions, heuresParJour, compteurHeures, iso(AUJOURDHUI)),
    compteursVehicule,
    iso(AUJOURDHUI),
  );
  /* Un numéro par opération, stable : il ne suit pas l'ordre d'affichage,
     qui change avec l'état, mais le rang de l'opération dans le gabarit —
     sans quoi un ajustement changerait de ligne en vieillissant. */
  const rangOperation = new Map(programme.operations.map((o, i) => [o.code, i + 1]));
  for (const e of echeancesEntretien) e.numero = formerNumero("entretien", iso(AUJOURDHUI), rangVehicule * 1000 + (rangOperation.get(e.code) ?? 0));

  const planEntretien: PlanEntretienFiche = {
    programmeCode: programme.code,
    programmeLibelle: programme.libelle,
    programmePrecision: programme.precision,
    base: programme.base,
    aujourdhui: iso(AUJOURDHUI),
    compteurs: compteursVehicule,
    echeances: echeancesEntretien,
  };

  /* La prochaine intervention affichée en tête de fiche est **la première
     échéance du plan**, et non plus une vidange posée d'avance : les deux se
     contredisaient dès que l'historique disait autre chose. */
  const premiere = echeancesEntretien.find((e) => e.kmRestants !== null || e.joursRestants !== null) ?? null;
  const prochaineIntervention =
    premiere === null
      ? null
      : {
          libelle: premiere.libelle,
          kmRestants: premiere.kmRestants ?? 0,
          joursEstimes: Math.max(0, premiere.joursRestants ?? Math.round((premiere.kmRestants ?? 0) / Math.max(1, compteursVehicule.kmParJour))),
          aKm: premiere.dueA.km ?? kmActuel,
        };

  /* ---- Carburant ----
     Chaque mois se valorise au **barème de son mois**, et non au prix du jour :
     un litre consommé en janvier 2025 a coûté ce qu'il coûtait alors. Avec un
     prix unique, une baisse du gasoil aurait rétroactivement allégé deux ans de
     dépenses, et le coût au kilomètre de l'an dernier serait devenu faux. */
  const carburant: ConsommationMensuelle[] = [];
  for (let delta = -8; delta <= -1; delta++) {
    const mois = moisRelatif(delta);
    const km = Math.round(kmParMois * (0.8 + alea() * 0.4));
    const derive = estAA032 && mois === "2026-03" ? 1.28 : alea() > 0.85 ? 1.15 + alea() * 0.15 : 0.97 + alea() * 0.1;
    const l100 = Math.round(refL100 * derive * 10) / 10;
    const litres = Math.round((km * l100) / 100 * 10) / 10;
    carburant.push({
      mois,
      source: identite.gpsActif && delta >= -5 ? "Cuve + GPS" : l.site?.type === "usine" ? "Cuve usine" : "Cuve siège",
      litres,
      kmParcourus: km,
      litresAux100: l100,
      ecartPct: Math.round(((l100 - refL100) / refL100) * 1000) / 10,
      cout: Math.round(litres * prixEnergie(v.energie, `${mois}-15`, parametres)),
    });
  }
  if (estAA032) {
    const fixes: Record<string, [number, number, number, number]> = {
      "2026-01": [790.9, 7120, 11.1, 498_300],
      "2026-02": [578.0, 5480, 10.5, 364_100],
      "2026-03": [864.0, 6450, 13.4, 544_300],
      "2026-04": [699.6, 6443, 10.9, 440_700],
      "2026-05": [742.3, 6810, 10.9, 467_600],
      "2026-06": [688.9, 6540, 10.5, 434_000],
    };
    for (const c of carburant) {
      const f = fixes[c.mois];
      if (f) {
        c.litres = f[0];
        c.kmParcourus = f[1];
        c.litresAux100 = f[2];
        c.cout = f[3];
        c.ecartPct = Math.round(((f[2] - 10.5) / 10.5) * 1000) / 10;
      }
    }
  }

  /* ---- Dépenses ----
   * Toute dépense est un mouvement daté rattaché au véhicule, quelle que soit
   * sa voie de paiement. Les agrégats par poste et par mois s'en déduisent :
   * une seule source, pas deux séries à réconcilier. */
  const depenses: DepenseFiche[] = [];
  let numero = 0;
  const idSuivant = () => `d-${v.immatriculation}-${++numero}`;

  for (const i of interventions) {
    depenses.push({
      id: idSuivant(),
      numero: i.numero,
      date: i.date,
      poste: i.type === "preventif" ? "maintenance-preventive" : "maintenance-curative",
      libelle: i.objet,
      montant: i.montant,
      beneficiaire: i.garage,
      reference: i.reference,
      origine: i.reference.startsWith("BC") ? "bon-de-commande" : "facture",
      justificatif: true,
      kmMotifRejet: null,
      km: i.km,
    });
  }

  for (const d of documents) {
    if (!d.montant || !d.dateEffet) continue;
    depenses.push({
      id: idSuivant(),
      numero: d.numero,
      date: d.dateEffet,
      poste: d.type === "assurance" ? "assurance" : "conformite",
      libelle: `${TYPE_DOCUMENT[d.type]} ${d.numeroPiece ?? ""}`.trim(),
      montant: d.montant,
      beneficiaire: d.emetteur,
      reference: d.numeroPiece,
      origine: "facture",
      justificatif: true,
      kmMotifRejet: null,
      km: null,
    });
  }

  /* Pleins : la transaction élémentaire. Chaque mois de cumul est éclaté en
     deux à quatre pleins datés, dont la somme redonne exactement le cumul —
     le graphique mensuel de l'Aperçu et la liste des pleins ne peuvent pas
     diverger. Chaque plein porte son bon de sortie et son relevé de compteur. */
  const pleins: PleinFiche[] = [];
  for (const c of carburant) {
    const nb = entre(alea, 2, 4);
    const poids = Array.from({ length: nb }, () => 0.6 + alea() * 0.8);
    const somme = poids.reduce((a, b) => a + b, 0);
    const jours = Array.from({ length: nb }, () => entre(alea, 2, 27)).sort((a, b) => a - b);
    let litresRestants = c.litres;
    let coutRestant = c.cout;
    for (let k = 0; k < nb; k++) {
      const dernier = k === nb - 1;
      const litres = dernier ? Math.round(litresRestants * 10) / 10 : Math.round((c.litres * poids[k]!) / somme * 10) / 10;
      const montant = dernier ? coutRestant : Math.round((c.cout * litres) / c.litres);
      litresRestants = Math.round((litresRestants - litres) * 10) / 10;
      coutRestant -= montant;
      const date = `${c.mois}-${String(jours[k]).padStart(2, "0")}`;
      const id = idSuivant();
      const source = c.source.startsWith("Cuve") ? "Cuve interne SEDIMA" : "Station Total";
      const reference = `BS-${c.mois.replace("-", "")}-${entre(alea, 100, 999)}`;
      const km = kmALaDate(date);
      const numero = numeroPour("plein", date);
      pleins.push({ id, numero, date, source, litres, prixLitre: Math.round(montant / Math.max(1, litres)), montant, reference, km, kmMotifRejet: null });
      depenses.push({
        id,
        numero,
        date,
        poste: "carburant",
        libelle: `Gasoil ${source === "Station Total" ? "station" : "cuve"} — ${nombre(litres, 1)} L`,
        montant,
        beneficiaire: source,
        reference,
        origine: "caisse",
        justificatif: true,
        kmMotifRejet: null,
        km,
      });
    }
  }
  pleins.sort((a, b) => b.date.localeCompare(a.date));

  /* Caisse parc : ce qui n'est ni entretien ni carburant ni document, et qui
     pèse pourtant — péages, frais de route, contraventions, pneus, divers. */
  const baseConnue = depenses.reduce((somme, d) => somme + d.montant, 0);
  const reste = Math.max(0, coutDouzeMois - baseConnue);
  const partPneus = Math.max(Math.round(reste * 0.4), (lourd ? 900 : 260) * 1000);
  const nbPneus = lourd ? 2 : 1;
  for (let k = 0; k < nbPneus; k++) {
    depenses.push({
      id: idSuivant(),
      numero: "",
      date: decaler(-entre(alea, 20, 320)),
      poste: "pneumatiques",
      libelle: lourd ? `Pneumatiques ${k === 0 ? "arrière (x4)" : "avant (x2)"} — 315/80 R22.5` : "Pneumatiques (x4) — 265/65 R17",
      montant: Math.round(partPneus / nbPneus),
      beneficiaire: "Pneus Plus Dakar",
      reference: `BC${entre(alea, 15_000, 16_999)}`,
      origine: "bon-de-commande",
      justificatif: true,
      kmMotifRejet: null,
      km: 0,
    });
    depenses[depenses.length - 1]!.km = kmALaDate(depenses[depenses.length - 1]!.date);
  }

  const partRoute = Math.max(Math.round(reste * 0.45), (lourd ? 45 : 25) * 1000 * 12);
  const partPeage = Math.max(Math.round(reste * 0.1), 9 * 1000 * 9);
  for (let delta = -12; delta <= -1; delta++) {
    const mois = moisRelatif(delta);
    const jour = (dd: number) => `${mois}-${String(dd).padStart(2, "0")}`;
    depenses.push({
      id: idSuivant(),
      numero: "",
      date: jour(entre(alea, 2, 27)),
      poste: "frais-de-route",
      libelle: `Frais de route ${l.chauffeurTitulaire?.nom ?? "chauffeur"} — ${entre(alea, 3, 9)} déplacements`,
      montant: Math.round((partRoute / 12) * (0.7 + alea() * 0.6)),
      beneficiaire: l.chauffeurTitulaire?.nom ?? null,
      reference: `CP-${mois.replace("-", "")}-${entre(alea, 10, 99)}`,
      origine: "caisse",
      justificatif: alea() > 0.15,
      kmMotifRejet: null,
      km: null,
    });
    if (alea() > 0.25) {
      depenses.push({
        id: idSuivant(),
        numero: "",
        date: jour(entre(alea, 2, 27)),
        poste: "peage",
        libelle: "Péage autoroute Dakar–Diamniadio–Thiès",
        montant: Math.round((partPeage / 9) * (0.6 + alea() * 0.8)),
        beneficiaire: "SECAA",
        reference: null,
        origine: "caisse",
        justificatif: alea() > 0.3,
        kmMotifRejet: null,
        km: null,
      });
    }
  }

  const nbContraventions = alea() > 0.6 ? entre(alea, 1, 2) : 0;
  for (let k = 0; k < nbContraventions; k++) {
    depenses.push({
      id: idSuivant(),
      numero: "",
      date: decaler(-entre(alea, 10, 330)),
      poste: "contravention",
      libelle: ["Excès de vitesse — RN2", "Stationnement gênant — Dakar Plateau", "Surcharge — pont bascule Diamniadio"][entre(alea, 0, 2)],
      montant: [12_000, 24_000, 50_000][entre(alea, 0, 2)],
      beneficiaire: "Trésor public",
      reference: `PV-${entre(alea, 100_000, 999_999)}`,
      origine: "caisse",
      justificatif: true,
      kmMotifRejet: null,
      km: 0,
    });
    depenses[depenses.length - 1]!.km = kmALaDate(depenses[depenses.length - 1]!.date);
  }

  const partDivers = Math.max(Math.round(reste * 0.05), 60 * 1000);
  const divers: [string, number][] = [["Lavage et nettoyage cabine", 0.4], ["Extincteur et triangle — remplacement", 0.35], ["Bâche et sangles d'arrimage", 0.25]];
  for (const [libelle, part] of divers) {
    depenses.push({
      id: idSuivant(),
      numero: "",
      date: decaler(-entre(alea, 5, 340)),
      poste: "divers",
      libelle,
      montant: Math.max(5_000, Math.round(partDivers * part)),
      beneficiaire: null,
      reference: null,
      origine: "caisse",
      justificatif: alea() > 0.4,
      kmMotifRejet: null,
      km: null,
    });
  }

  depenses.sort((a, b) => b.date.localeCompare(a.date));
  numeroter(depenses, "depense", (d) => d.date);

  /* ---- Relevés kilométriques ----
   * Chaque dépense qui porte un compteur est un relevé, d'origine tracée. La
   * balise, quand il y en a une, en ajoute un par mois. L'odomètre courant est
   * le plus récent d'entre eux — jamais un champ saisi à part. */
  const bruts: Omit<ReleveFiche, "valide" | "motifRejet">[] = [];
  for (const d of depenses) {
    if (d.km === null) continue;
    const garage = d.poste === "maintenance-preventive" || d.poste === "maintenance-curative";
    bruts.push({
      numero: "",
      date: d.date,
      valeur: d.km,
      origine: d.poste === "carburant" ? "plein" : garage ? "garage" : "depense",
      source: d.poste === "carburant" ? `Plein — ${d.beneficiaire ?? "cuve"}` : garage ? `${d.beneficiaire ?? "Garage"} — ${d.libelle}` : `${POSTE_DEPENSE[d.poste]} — ${d.libelle}`,
      depenseId: d.id,
    });
  }
  if (identite.gpsActif) {
    for (let delta = -5; delta <= 0; delta++) {
      const d = delta === 0 ? decaler(-1) : `${moisRelatif(delta)}-01`;
      bruts.push({ numero: "", date: d, valeur: kmALaDate(d), origine: "telematique", source: "Balise Teltonika — relevé automatique", depenseId: null });
    }
  }

  /* Deux erreurs de saisie plausibles, pour montrer le contrôle à l'œuvre :
     un chiffre oublié au plein (compteur qui recule), un compteur d'un autre
     véhicule à la contravention (bond invraisemblable). */
  const depensesCarburant = depenses.filter((d) => d.poste === "carburant");
  if (depensesCarburant.length > 3 && alea() > 0.45) {
    const cible = depensesCarburant[2]!;
    cible.km = Math.round((cible.km ?? 0) / 10);
    const plein = pleins.find((x) => x.id === cible.id);
    if (plein) plein.km = cible.km;
    const r = bruts.find((x) => x.depenseId === cible.id);
    if (r) r.valeur = cible.km;
  }
  const contravention = depenses.find((d) => d.poste === "contravention");
  if (contravention && contravention.km !== null) {
    contravention.km = contravention.km + entre(alea, 120_000, 260_000);
    const r = bruts.find((x) => x.depenseId === contravention.id);
    if (r) r.valeur = contravention.km;
  }

  const releves: ReleveFiche[] = controlerReleves(bruts, v.categorie).sort(
    (a, b) => b.date.localeCompare(a.date) || b.valeur - a.valeur,
  );
  numeroter(releves, "releve", (r) => r.date);
  for (const r of releves) {
    if (!r.valide && r.depenseId) {
      const d = depenses.find((x) => x.id === r.depenseId);
      if (d) d.kmMotifRejet = r.motifRejet;
      const plein = pleins.find((x) => x.id === r.depenseId);
      if (plein) plein.kmMotifRejet = r.motifRejet;
    }
  }
  const dernierValide = releves.find((r) => r.valide);
  if (dernierValide) {
    indicateurs.kilometrage = dernierValide.valeur;
  }

  /* ---- Coûts (dérivés des dépenses) ----
     Le calcul vit dans le domaine : la fiche le rejoue dans le navigateur dès
     qu'une dépense y est créée ou modifiée, et les deux lectures concordent. */
  const moisDouze: string[] = [];
  for (let delta = -12; delta <= -1; delta++) moisDouze.push(moisRelatif(delta));
  const { coutsParPoste, chargesParGroupe, coutsMensuels, total: totalDepenses } = agregerCouts(depenses, moisDouze);
  indicateurs.coutDouzeMois = totalDepenses;
  indicateurs.coutParKm = kmDouzeMois > 0 ? Math.round(totalDepenses / kmDouzeMois) : null;

  /* ---- Affectations ---- */
  const bu = v.businessUnit ? BUSINESS_UNIT[v.businessUnit] : "—";
  const buSite = `${bu} · ${l.site?.libelle ?? "—"}`;
  const affectations: AffectationFiche[] = [];
  if (l.chauffeurTitulaire) {
    const debut = estAA032 ? "2021-07-12" : decaler(-entre(alea, 200, 1600));
    affectations.push({
      numero: "",
      chauffeur: l.chauffeurTitulaire.nom,
      chauffeurId: l.chauffeurTitulaire.id,
      initiales: initiales(l.chauffeurTitulaire.nom),
      role: "titulaire",
      debut,
      fin: null,
      buSite,
      kmParcourus: estAA032 ? 301_200 : Math.round(kmParMois * ((AUJOURDHUI.getTime() - new Date(debut).getTime()) / (30.44 * 24 * 3600 * 1000)) * 0.9),
      motif: "Affectation initiale",
    });
  }
  if (l.nombreSuppleants > 0 || estAA032) {
    const suppleant = estAA032 ? "Ibrahima Camara" : ["Mor Ndiaye", "Pape Sène", "Ousmane Faye"][entre(alea, 0, 2)]!;
    affectations.push({
      numero: "",
      chauffeur: suppleant,
      chauffeurId: idChauffeur(suppleant),
      initiales: initiales(suppleant),
      role: "suppleant",
      debut: estAA032 ? "2026-02-03" : decaler(-entre(alea, 40, 120)),
      fin: estAA032 ? "2026-02-21" : l.nombreSuppleants > 0 ? null : decaler(-entre(alea, 5, 30)),
      buSite,
      kmParcourus: estAA032 ? 3480 : entre(alea, 1200, 6000),
      motif: estAA032 ? "Congés du titulaire" : l.nombreSuppleants > 0 ? "Double équipage" : "Remplacement temporaire",
    });
  }
  affectations.push({
    numero: "",
    chauffeur: null,
    chauffeurId: null,
    initiales: "—",
    role: null,
    debut: mec,
    fin: affectations.length ? affectations[affectations.length - 1]!.debut : null,
    buSite: "Siège · Rufisque",
    kmParcourus: entre(alea, 60, 240),
    motif: "Livraison concessionnaire",
  });
  numeroter(affectations, "affectation", (a) => a.debut);
  affectations.sort((a, b) => (a.fin === null ? -1 : b.fin === null ? 1 : b.debut.localeCompare(a.debut)));

  /* ---- Attelages ---- */
  const attelages: AttelageFiche[] = ATTELAGES.filter((a) => a.tracteurId === v.id || a.remorqueId === v.id)
    .map((a) => {
      const role = a.tracteurId === v.id ? ("tracteur" as const) : ("remorque" as const);
      const autreId = role === "tracteur" ? a.remorqueId : a.tracteurId;
      const autre = FLOTTE.find((x) => x.vehicule.id === autreId)?.vehicule;
      return {
        numero: a.numero,
        role,
        autreId,
        autreImmatriculation: autreId,
        autreImmatriculationAffichee: autre?.immatriculationAffichee ?? autreId,
        autreVehicule: autre ? `${autre.marque} ${autre.appellation}` : "—",
        debut: a.debut,
        fin: a.fin,
        permanent: a.permanent,
        motif: a.motif,
      };
    })
    .sort((a, b) => (a.fin === null ? -1 : b.fin === null ? 1 : b.debut.localeCompare(a.debut)));

  /* ---- Visites techniques ----
   * Chaque véhicule a passé la visite qui a produit son document : acceptée, à
   * la date d'effet, avec le même numéro de PV. Trois véhicules montrent la
   * suite du processus : un rendez-vous à venir, un refus avec observations et
   * contre-visite programmée, un refus sans contre-visite encore prise. */
  const visitesTechniques: VisiteTechnique[] = [];
  const observationsVisite: ObservationVisite[] = [];
  const visiteVT = documents.find((d) => d.type === "visite-technique" && d.etat !== "manquant" && d.dateEffet);
  const centre = l.site?.region === "Thiès" ? "CCVA Thiès" : "CCVA Rufisque";
  if (visiteVT?.dateEffet) {
    visitesTechniques.push({
      id: `vt-${v.immatriculation}-1`,
      numero: numeroPour("visite", visiteVT.dateEffet),
      vehiculeId: v.id,
      type: "visite",
      centre,
      dateRendezVous: visiteVT.dateEffet,
      heure: "08:30",
      datePassage: visiteVT.dateEffet,
      statut: "acceptee",
      numeroPv: visiteVT.numeroPiece,
      dateLimiteContreVisite: null,
      commentaire: null,
    });
  }
  const observation = (visite: VisiteTechnique, libelle: string, categorie: ObservationVisite["categorie"], gravite: ObservationVisite["gravite"], statut: ObservationVisite["statut"], interventionNumero: string | null, corrigeeLe: string | null): ObservationVisite => ({
    id: `obs-${v.immatriculation}-${observationsVisite.length + 1}`,
    numero: numeroPour("observation", visite.datePassage ?? visite.dateRendezVous),
    visiteId: visite.id,
    vehiculeId: v.id,
    libelle,
    categorie,
    gravite,
    statut,
    interventionNumero,
    corrigeeLe,
    commentaire: null,
  });
  if (v.immatriculation === "AA236MR") {
    visitesTechniques.unshift({ id: `vt-${v.immatriculation}-2`, numero: numeroPour("visite", "2026-09-08"), vehiculeId: v.id, type: "visite", centre, dateRendezVous: "2026-09-08", heure: "09:30", datePassage: null, statut: "rendez-vous", numeroPv: null, dateLimiteContreVisite: null, commentaire: "Renouvellement — échéance le 10/09" });
  }
  if (v.immatriculation === "AA737ZW") {
    const refus: VisiteTechnique = { id: `vt-${v.immatriculation}-2`, numero: numeroPour("visite", "2026-08-12"), vehiculeId: v.id, type: "visite", centre, dateRendezVous: "2026-08-12", heure: "10:00", datePassage: "2026-08-12", statut: "refusee", numeroPv: "PV-26-4402", dateLimiteContreVisite: "2026-10-12", commentaire: "Trois observations, dont deux majeures" };
    const contre: VisiteTechnique = { id: `vt-${v.immatriculation}-3`, numero: numeroPour("visite", "2026-09-10"), vehiculeId: v.id, type: "contre-visite", centre, dateRendezVous: "2026-09-10", heure: "08:00", datePassage: null, statut: "rendez-vous", numeroPv: null, dateLimiteContreVisite: null, commentaire: "Après correction du freinage et des pneus" };
    visitesTechniques.unshift(contre, refus);
    observationsVisite.push(
      observation(refus, "Freinage — efficacité insuffisante sur l'essieu arrière", "freinage", "majeure", "en-cours", interventions[0]?.numero ?? null, null),
      observation(refus, "Feu stop droit hors service", "eclairage", "mineure", "corrigee", null, "2026-08-14"),
      observation(refus, "Pneumatiques avant usés au-delà du témoin", "pneumatiques", "majeure", "a-traiter", null, null),
    );
  }
  if (v.immatriculation === "AB551HS") {
    const refus: VisiteTechnique = { id: `vt-${v.immatriculation}-2`, numero: numeroPour("visite", "2026-08-21"), vehiculeId: v.id, type: "visite", centre: "CCVA Rufisque", dateRendezVous: "2026-08-21", heure: "11:00", datePassage: "2026-08-21", statut: "refusee", numeroPv: "PV-26-4511", dateLimiteContreVisite: "2026-10-21", commentaire: "Contre-visite à programmer après la restauration" };
    visitesTechniques.unshift(refus);
    observationsVisite.push(
      observation(refus, "Dispositif d'attelage — jeu excessif à la sellette", "attelage", "majeure", "a-traiter", null, null),
      observation(refus, "Feux de gabarit arrière hors service", "eclairage", "mineure", "a-traiter", null, null),
    );
  }

  /* ---- Périodes de statut ---- */
  const periodesStatut: PeriodeStatutFiche[] = [];
  if (!operationnel) {
    const debut = decaler(-entre(alea, 3, 60));
    periodesStatut.push({
      statut: v.statut,
      motif: v.statut === "en-reparation" ? "panne" : v.statut === "en-restauration" ? "maintenance-corrective" : v.statut === "hors-service" ? "panne" : null,
      debut,
      fin: null,
      jours: Math.round((AUJOURDHUI.getTime() - new Date(debut).getTime()) / (24 * 3600 * 1000)),
    });
  }
  for (const i of interventions.filter((x) => x.type === "curatif")) {
    periodesStatut.push({ statut: "en-reparation", motif: "panne", debut: i.date, fin: decaler(i.immobilisationJours, new Date(i.date)), jours: i.immobilisationJours });
  }
  periodesStatut.push({ statut: "en-service", motif: null, debut: mec, fin: null, jours: 0 });

  /* ---- Échéances (aperçu) ---- */
  const echeances: EcheanceFiche[] = [];
  for (const d of documents) {
    if (d.etat === "permanent") continue;
    if (d.etat === "manquant") {
      echeances.push({ libelle: TYPE_DOCUMENT[d.type], repere: "—", precision: "Document manquant, à fournir", ton: "defavorable" });
      continue;
    }
    const j = d.joursRestants ?? 0;
    echeances.push({
      libelle: TYPE_DOCUMENT[d.type],
      repere: d.echeance ?? "—",
      precision:
        j < 0
          ? `Échue depuis ${Math.abs(j)} jours · ${d.emetteur ?? ""}`
          : j === 0
            ? "Échéance aujourd'hui"
            : `Échéance dans ${j} jours · ${d.emetteur ?? ""}`,
      ton: j < 0 ? "defavorable" : j <= 30 ? "vigilance" : "favorable",
    });
  }
  if (prochaineIntervention) {
    echeances.push({
      libelle: prochaineIntervention.libelle,
      repere: `≈ ${nombre(prochaineIntervention.aKm)} km`,
      precision: `Dans ${nombre(prochaineIntervention.kmRestants)} km, soit environ ${prochaineIntervention.joursEstimes} jours`,
      ton: prochaineIntervention.kmRestants < 1000 ? "vigilance" : "favorable",
    });
  }
  echeances.sort((a, b) => {
    const ordre = { defavorable: 0, vigilance: 1, favorable: 2, neutre: 3 };
    return ordre[a.ton] - ordre[b.ton];
  });

  /* ---- Journal ---- */
  const journal: EvenementJournal[] = [];
  for (const r of releves.filter((x) => x.valide && x.origine !== "telematique").slice(0, 2)) {
    journal.push({ date: r.date, auteur: r.origine === "plein" ? "Relevé cuve" : "Service parc", initiales: r.origine === "plein" ? "RC" : "SP", categorie: "releve", texte: `Relevé kilométrique ${nombre(r.valeur)} km — ${r.source}.` });
  }
  for (const i of interventions.slice(0, 3)) {
    journal.push({
      date: i.date,
      auteur: "Aly Bo",
      initiales: "AB",
      categorie: "intervention",
      texte: `${i.type === "preventif" ? "Entretien préventif" : "Intervention curative"} — ${i.objet} chez ${i.garage} (${nombre(i.montant)} F, ${i.reference}).`,
    });
    if (i.type === "curatif") {
      journal.push({ date: i.date, auteur: "M. Seck", initiales: "MS", categorie: "statut", texte: `Statut passé à « En réparation » — panne signalée par le chauffeur.` });
      journal.push({ date: decaler(i.immobilisationJours, new Date(i.date)), auteur: "M. Seck", initiales: "MS", categorie: "statut", texte: `Retour « En service » après ${i.immobilisationJours} jour${i.immobilisationJours > 1 ? "s" : ""} d'immobilisation.` });
    }
  }
  for (const a of affectations.filter((x) => x.chauffeur)) {
    journal.push({ date: a.debut, auteur: "M. Seck", initiales: "MS", categorie: "affectation", texte: `${a.chauffeur} affecté comme ${a.role === "titulaire" ? "titulaire" : "suppléant"} — ${a.motif.toLowerCase()}.` });
  }
  for (const d of documents.filter((x) => x.dateEffet && x.etat !== "permanent")) {
    journal.push({ date: d.dateEffet!, auteur: "Service parc", initiales: "SP", categorie: "document", texte: `${TYPE_DOCUMENT[d.type]} ${d.numeroPiece} enregistrée (${d.emetteur}), échéance ${date(d.echeance)}.` });
  }
  if (v.commentaire) {
    journal.push({ date: decaler(-entre(alea, 1, 12)), auteur: "M. Seck", initiales: "MS", categorie: "note", texte: v.commentaire });
  }
  journal.sort((a, b) => b.date.localeCompare(a.date));

  return {
    ligne: l,
    identite,
    indicateurs,
    echeances,
    documents,
    affectations,
    attelages,
    visitesTechniques,
    observationsVisite,
    immobilisationAdministrative: immobilisation,
    planEntretien,
    prochaineIntervention,
    interventions,
    carburant,
    referenceL100: refL100,
    depenses,
    pleins,
    releves,
    coutsParPoste,
    chargesParGroupe,
    coutsMensuels,
    journal: journal.slice(0, 18),
    periodesStatut,
  };
}

/**
 * La fiche d'un véhicule créé dans l'application — une fiche vierge.
 *
 * Un véhicule qui vient d'entrer au parc n'a pas d'historique : ni plein, ni
 * dépense, ni intervention, ni affectation. Sa fiche n'en montre pas moins son
 * identité, ses documents — tous manquants, sauf la visite technique dont la
 * date a été saisie à la création et la licence de flotte qui le couvre déjà —
 * et l'**immobilisation administrative qui en découle** : un véhicule sans
 * carte grise ni assurance ne roule pas, et la fiche doit le dire dès le
 * premier jour. Les onglets se remplissent ensuite par le menu « Ajouter ».
 *
 * Les numéros des documents manquants partent de 99 001 : ils ne croisent ni
 * les séquences du jeu de démonstration ni celles des créations (90 001).
 */
/** Le plan d'un véhicule neuf : le gabarit de sa catégorie, aucun passage. */
function planVierge(v: Vehicule): PlanEntretienFiche {
  const programme = programmeParDefaut(v.categorie);
  const plan = planDuVehicule(v.id, v.categorie);
  const compteurs: CompteursVehicule = { km: null, heures: null, kmParJour: 1, heuresParJour: 1, miseEnService: v.premiereMiseEnCirculation };
  return {
    programmeCode: programme.code,
    programmeLibelle: programme.libelle,
    programmePrecision: programme.precision,
    base: programme.base,
    aujourdhui: iso(AUJOURDHUI),
    compteurs,
    echeances: echeancesDuPlan(programme, plan, new Map(), compteurs, iso(AUJOURDHUI)),
  };
}

export function ficheVierge(l: LigneFlotte, parametres: Parametres = PARAMETRES_DEFAUT): FicheVehicule {
  const v = l.vehicule;
  const aujourdhui = iso(AUJOURDHUI);
  const vt = l.prochaineEcheanceConformite?.type === "visite-technique" ? l.prochaineEcheanceConformite.echeance : null;
  /* La licence de transport est portée par la flotte : celle qui couvre tout le
     parc couvre aussi le véhicule qui vient d'y entrer. Une licence de périmètre
     partiel, elle, ne le couvre pas tant qu'il n'y a pas été ajouté. */
  const licence = LICENCES.filter((lic) => lic.perimetre === "flotte").sort((a, b) => a.echeance.localeCompare(b.echeance))[0] ?? null;

  let sequence = 99_000;
  const documents: DocumentFiche[] = [];
  for (const def of parametres.documents.types) {
    if (!exigeDocument(def.id, v, parametres)) continue;
    if (def.id === "licence-transport" && licence) {
      const j = joursRestants(licence.echeance, AUJOURDHUI);
      documents.push({
        numero: licence.numero,
        type: "licence-transport",
        portee: "Toute la flotte",
        numeroPiece: licence.numeroPiece,
        emetteur: licence.emetteur,
        dateEffet: licence.dateEffet,
        echeance: licence.echeance,
        montant: null,
        justificatif: true,
        etat: etatDocument(j, false, false),
        joursRestants: j,
      });
      continue;
    }
    /* La date de la première visite vaut échéance : l'échéancier part de là,
       sans qu'aucun procès-verbal n'ait encore été fourni. */
    const echeance = def.id === "visite-technique" && vt ? vt : null;
    const j = echeance ? joursRestants(echeance, AUJOURDHUI) : null;
    documents.push({
      numero: formerNumero("document", aujourdhui, ++sequence),
      type: def.id,
      numeroPiece: null,
      emetteur: null,
      dateEffet: null,
      echeance,
      montant: null,
      justificatif: false,
      etat: echeance ? etatDocument(j, false, false) : etatDocument(null, true, false),
      joursRestants: j,
    });
  }

  const immobilisation = immobilisationAdministrative(v, documents, parametres);
  const echeances: EcheanceFiche[] = documents
    .filter((d) => d.etat !== "permanent")
    .map((d) => ({
      libelle: libelleDocumentCourant(d.type),
      repere: d.echeance ? date(d.echeance) : "à fournir",
      precision: d.echeance ? `dans ${nombre(d.joursRestants ?? 0)} jours` : "aucune pièce enregistrée",
      ton: d.etat === "manquant" || d.etat === "echu" ? "defavorable" : d.etat === "bientot" ? "vigilance" : "favorable",
    }));

  return {
    ligne: l,
    identite: {
      typeModele: v.typeModele,
      premiereMiseEnCirculation: v.premiereMiseEnCirculation,
      dateImmatriculation: v.dateImmatriculation,
      region: l.site?.region ?? "Dakar",
      puissanceCv: v.puissanceCv,
      cylindree: v.cylindree,
      ptac: v.ptac,
      ptra: v.ptra,
      poidsVide: v.poidsVide,
      chargeUtile: v.chargeUtile,
      energie: v.energie,
      capaciteReservoir: v.capaciteReservoir,
      utilisation: USAGE_VEHICULE[v.usage] ?? "—",
      regimePropriete: v.categorieFlotte === "interne" ? "Propriété SEDIMA" : "Sous-traitance",
      entite: v.businessUnit ? BUSINESS_UNIT[v.businessUnit] : "SEDIMA SA",
      valeurAcquisition: v.valeurAcquisition,
      dureeAmortissementAnnees: v.dureeAmortissementAnnees,
      valeurNetteComptable: v.valeurAcquisition,
      finAmortissement: null,
      gpsActif: false,
    },
    /* Aucun indicateur ne se calcule sur une fiche sans historique : mieux vaut
       le vide qu'un zéro qui se lirait comme une mesure. */
    indicateurs: { kilometrage: l.kilometrage, kmParMois: null, consommationL100: null, coutDouzeMois: null, coutParKm: null, disponibilitePct: null },
    echeances,
    documents,
    affectations: [],
    attelages: [],
    visitesTechniques: [],
    observationsVisite: [],
    immobilisationAdministrative: immobilisation,
    /* Un véhicule qui vient d'être créé hérite du gabarit de sa catégorie : le
       plan existe avant le premier entretien, et toutes ses opérations sont
       sans référence — ce qui est exactement la vérité. */
    planEntretien: planVierge(v),
    prochaineIntervention: null,
    interventions: [],
    carburant: [],
    referenceL100: REFERENCE_L100[v.categorie] ?? 20,
    depenses: [],
    pleins: [],
    releves: [],
    coutsParPoste: [],
    chargesParGroupe: [],
    coutsMensuels: [],
    journal: [],
    periodesStatut: [],
  };
}

const CACHE = new Map<string, FicheVehicule>();

/**
 * La fiche d'un véhicule, par immatriculation sous n'importe quelle écriture.
 * Les paramètres (règles des documents) font partie de la clé de cache : deux
 * réglages différents donnent deux fiches différentes.
 */
export function fichePourImmatriculation(brut: string, parametres: Parametres = PARAMETRES_DEFAUT): FicheVehicule | null {
  const canonique = normaliser(brut);
  const cle = `${canonique}|${empreinteParametres(parametres)}`;
  const existante = CACHE.get(cle);
  if (existante) return existante;
  const l = FLOTTE.find((x) => x.vehicule.immatriculation === canonique);
  if (!l) return null;
  const f = construire(l, parametres);
  CACHE.set(cle, f);
  return f;
}

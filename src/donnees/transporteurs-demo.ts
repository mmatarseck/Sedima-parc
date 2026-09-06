/* ============================================================================
 * Affrètements et grilles tarifaires — d'après le dossier de la Direction des
 * Opérations, non d'après une invention.
 *
 * **Les tarifs sont ceux de `61. Gestion Parc/BOCAR/M.SECK/TARIF
 * TRANSPOTEURS.xlsx`** : destinations, transporteurs et prix à la tonne, plus
 * les forfaits poulets et phosphate. Les prix y sont **nets** — ce que le
 * transporteur touche —, et la facture les majore de la retenue à la source de
 * 5 % (BRS). Cette mécanique a été vérifiée sur les 593 lignes de voyage de
 * `62. Transport & Flotte Automobile/Données Finance/FACTURES DES TRANSPORTEURS
 * 2026.xlsx` : 56 lignes sur 57 concordent avec la grille × 1,05, et 319 sur
 * 319 vérifient net = TTC × 0,95.
 *
 * Les missions, elles, sont **engendrées** sur ces trajets et ces prix : le
 * fichier de factures ne couvre que janvier à avril 2026, alors que
 * l'application montre douze mois glissants. Les écarts de facturation sont
 * voulus dans le jeu — un transporteur qui majore est ce que le module doit
 * rendre visible, et une démonstration où tout tombe juste ne prouverait rien.
 *
 * En production : tables `affretement` et `tarif_transporteur`, la première
 * alimentée à la commande puis au constat de facture depuis Sage X3.
 * ==========================================================================*/

import { formerNumero } from "@/domaine/reference";
import { prixCuve } from "@/domaine/parametres";
import {
  coutAffretement,
  coutMiseADisposition,
  coutPrestation,
  factureDepuisNet,
  factureSelonConvention,
  joursDus,
  type Affretement,
  type ConventionFacturation,
  type FamilleMad,
  type LigneTarif,
  type MiseADisposition,
  type MotifAffretement,
  type Prestation,
  type SourceTarif,
  type StatutAffretement,
  type TarifJournalier,
  type UnitePrestation,
  type UniteTarif,
} from "@/domaine/transporteurs";
import type { BusinessUnit, CategorieVehicule } from "@/domaine/types";
import { DATE_REFERENCE } from "./chauffeurs-demo";
import { graine } from "./fiche-demo";
import { FLOTTE } from "./parc-demo";
import { listePrestataires } from "./prestataires-demo";
import { camionsTiers, chauffeursTiers, rattachements } from "./flotte-tierce-demo";

/* -- Les transporteurs du référentiel -------------------------------------------- */

export function transporteurs() {
  return listePrestataires().filter((p) => p.type === "transporteur" && p.actif);
}

function parNom(nom: string) {
  return listePrestataires().find((t) => t.raisonSociale === nom) ?? null;
}

/* -- La grille, telle qu'elle est tenue ------------------------------------------- */

/** Le tarif à la tonne, destination par destination. Colonnes du tableur. */
const PAR_TONNE: { destination: string; km: number; prix: Record<string, number> }[] = [
  { destination: "Dakar", km: 45, prix: { "Abdou Kane": 2500, "Abdou Dieng": 2500, "Sokhna Diop": 2500, "Moussa Kane": 2500, "Abdou K. Diop": 2500 } },
  { destination: "Notto", km: 62, prix: { "Abdou Kane": 3500, "Abdou Dieng": 3500, "Sokhna Diop": 4000, "Moussa Kane": 3500 } },
  { destination: "Thiès", km: 70, prix: { "Abdou Kane": 3500, "Abdou Dieng": 3500, "Sokhna Diop": 3500, "Moussa Kane": 3500, "Abdou K. Diop": 3500 } },
  { destination: "Mbour", km: 83, prix: { "Abdou Kane": 4000, "Abdou Dieng": 4000, "Sokhna Diop": 4000, "Moussa Kane": 4000, "Abdou K. Diop": 4000 } },
  { destination: "Tivaouane", km: 95, prix: { "Abdou Kane": 5000, "Abdou Dieng": 5000, "Sokhna Diop": 5000, "Moussa Kane": 5000 } },
  { destination: "Ngaye", km: 105, prix: { "Abdou Kane": 5000, "Abdou Dieng": 6000, "Sokhna Diop": 6000, "Moussa Kane": 5000 } },
  { destination: "Kellé", km: 140, prix: { "Abdou Kane": 6000, "Sokhna Diop": 6000 } },
  { destination: "Touba", km: 194, prix: { "Abdou Kane": 6000, "Abdou Dieng": 6000, "Sokhna Diop": 6000, "Moussa Kane": 6000 } },
  { destination: "Kaolack", km: 192, prix: { "Abdou Kane": 6000, "Abdou Dieng": 6000, "Sokhna Diop": 6000, "Moussa Kane": 6000 } },
  { destination: "Louga", km: 203, prix: { "Abdou Kane": 6000, "Abdou Dieng": 6000, "Sokhna Diop": 6000, "Moussa Kane": 6000 } },
  { destination: "Potou", km: 225, prix: { "Abdou Kane": 7000, "Abdou Dieng": 8000, "Sokhna Diop": 7000 } },
  { destination: "Saint-Louis", km: 264, prix: { "Abdou Kane": 8000, "Abdou Dieng": 7500, "Sokhna Diop": 8000, "Moussa Kane": 7500 } },
  { destination: "Foundiougne", km: 210, prix: { "Abdou Kane": 11000, "Abdou Dieng": 12000, "Sokhna Diop": 12000, "Moussa Kane": 11000 } },
  { destination: "Rosso", km: 380, prix: { "Abdou Kane": 11000, "Abdou Dieng": 12000, "Sokhna Diop": 12000, "Moussa Kane": 11000 } },
  { destination: "Ziguinchor", km: 454, prix: { "Abdou Kane": 18000, "Abdou Dieng": 17500, "Sokhna Diop": 22000, "Moussa Kane": 17500 } },
];

/** Les forfaits au voyage — poulets vers l'abattoir, phosphate, véhicules légers. */
const FORFAITS: { destination: string; km: number; prix: Record<string, number>; commentaire: string }[] = [
  { destination: "Dakar", km: 45, prix: { "Abdou Kane": 100_000, "Dème Transport": 100_000 }, commentaire: "Transfert de poulets, au voyage" },
  { destination: "Ndieder", km: 118, prix: { "Abdou Kane": 80_000, "Dème Transport": 80_000 }, commentaire: "Transfert de poulets, au voyage" },
  { destination: "Ndiar", km: 96, prix: { "Abdou Kane": 80_000, "Dème Transport": 80_000 }, commentaire: "Transfert de poulets, au voyage" },
  { destination: "Kagnack", km: 132, prix: { "Abdou Kane": 90_000, "Dème Transport": 90_000 }, commentaire: "Transfert de poulets, au voyage" },
  { destination: "Thiès", km: 70, prix: { "Abdou Kane": 140_000, "Dème Transport": 140_000 }, commentaire: "Transfert de poulets, au voyage" },
  { destination: "Lam-Lam", km: 88, prix: { "Abdou Kane": 140_000 }, commentaire: "Transport de phosphate, au voyage" },
];

/** L'origine : tout part de l'usine d'aliment, sauf les poulets qui vont à l'abattoir. */
const ORIGINE_VRAC = "UAB";
const ORIGINE_POULETS = "Abattoirs";

/*
 * La source de chaque prix. Le tableur est écrit, mais il n'est pas signé :
 * seules les lignes des transporteurs sous contrat cadre sont opposables. C'est
 * ce que le métier doit trancher (question 42, second volet).
 */
/*
 * D'où vient le prix, transporteur par transporteur — **corrigé le 5 septembre
 * 2026**, après que le métier a tranché : « les tarifs sont définis de façon
 * informelle, il n'y a pas de contrat de charge ».
 *
 * Abdou Kane et Abdou Dieng portaient « contrat signé », ce qui contredisait
 * leur profil sans contrat écrit : la notation faisait apparaître l'incohérence
 * en affichant « aucun contrat écrit · 100 % de la grille opposable ». Seul
 * ADEX a un écrit, et il porte sur une mise à disposition, non sur une grille à
 * la tonne. Tout le reste est un accord verbal, ou reste à confirmer.
 */
const SOURCE_PAR_TRANSPORTEUR: Record<string, SourceTarif> = {
  "Abdou Kane": "accord-verbal",
  "Abdou Dieng": "accord-verbal",
  "Moussa Kane": "accord-verbal",
  "Sokhna Diop": "accord-verbal",
  "Abdou K. Diop": "a-confirmer",
  "Dème Transport": "a-confirmer",
};

const DEBUT_GRILLE = "2025-09-01";

let CACHE_TARIFS: LigneTarif[] | null = null;

export function grillesTarifaires(): LigneTarif[] {
  if (CACHE_TARIFS) return CACHE_TARIFS;
  const lignes: LigneTarif[] = [];
  let rang = 0;

  const poser = (transporteur: string, origine: string, destination: string, unite: UniteTarif, prix: number, commentaire: string | null) => {
    const p = parNom(transporteur);
    rang++;
    lignes.push({
      numero: formerNumero("tarif", DEBUT_GRILLE, rang),
      transporteurNumero: p?.numero ?? "",
      transporteur,
      origine,
      destination,
      /* La grille ne distingue pas les catégories de porteur : le prix est au
         tonnage transporté, quel que soit le camion qui l'emmène. */
      categorie: null,
      unite,
      prix,
      minimum: null,
      debut: DEBUT_GRILLE,
      fin: null,
      source: SOURCE_PAR_TRANSPORTEUR[transporteur] ?? "a-confirmer",
      commentaire,
    });
  };

  for (const d of PAR_TONNE) for (const [t, prix] of Object.entries(d.prix)) poser(t, ORIGINE_VRAC, d.destination, "tonne", prix, null);
  for (const f of FORFAITS) for (const [t, prix] of Object.entries(f.prix)) poser(t, ORIGINE_POULETS, f.destination, "forfait", prix, f.commentaire);

  CACHE_TARIFS = lignes;
  return CACHE_TARIFS;
}

/* -- Les affrètements -------------------------------------------------------------- */

const MOTIFS: MotifAffretement[] = ["pointe", "aucun-disponible", "vehicule-immobilise", "hors-perimetre", "capacite-particuliere"];
const DEMANDEURS = ["M. Seck", "Responsable maintenance", "Correspondant Keur Massar", "Direction des Opérations"];

/** La business unit servie : l'aliment part de l'UAB, les poulets de l'abattoir. */
function businessUnitDe(origine: string): BusinessUnit {
  return origine === ORIGINE_POULETS ? "abattoir" : "aliment";
}

function decaler(jours: number): string {
  const d = new Date(`${DATE_REFERENCE}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

let CACHE: Affretement[] | null = null;

/**
 * Les affrètements des douze derniers mois, engendrés sur la vraie grille.
 * Les tonnages suivent ce que porte un camion sénégalais de vrac : trente à
 * quarante tonnes sur les longues distances, moins près de Dakar.
 */
/*
 * Où l'on livre réellement.
 *
 * La grille parle de Thiès, de Notto, de Mbour ; le relevé hebdomadaire de la
 * Direction des Opérations parle de Bayakh, de Kaniac, de Niakhirate, de Tiv
 * Peul — 245 libellés distincts, dont une quinzaine seulement figure dans la
 * grille. Générer les missions sur les seules destinations tarifaires donnait
 * un jeu trop propre, où le rattachement des localités n'avait jamais lieu de
 * servir et où le défaut qu'il corrige restait invisible.
 *
 * Une mission sur deux part donc vers une localité rattachée à sa destination
 * tarifaire, comme dans le relevé.
 */
function livraisonReelle(destination: string, rang: number): string {
  if (rang % 2 === 0) return destination;
  const voisines = rattachements().filter((x) => x.destination === destination);
  return voisines.length > 0 ? voisines[rang % voisines.length]!.localite : destination;
}

function camionDe(transporteurNumero: string, rang: number) {
  const siens = camionsTiers().filter((c) => c.transporteurNumero === transporteurNumero);
  return siens.length > 0 ? siens[rang % siens.length]! : null;
}

function chauffeurDe(transporteurNumero: string, rang: number) {
  const siens = chauffeursTiers().filter((c) => c.transporteurNumero === transporteurNumero);
  return siens.length > 0 ? siens[rang % siens.length]! : null;
}

export function affretements(): Affretement[] {
  if (CACHE) return CACHE;
  const alea = graine("affretements-sedima-2026");
  const entre = (min: number, max: number) => min + Math.floor(alea() * (max - min + 1));
  const grilles = grillesTarifaires();
  const liste: Affretement[] = [];

  for (let i = 0; i < 84; i++) {
    const tarif = grilles[entre(0, grilles.length - 1)]!;
    const info = tarif.unite === "tonne" ? PAR_TONNE.find((d) => d.destination === tarif.destination) : FORFAITS.find((f) => f.destination === tarif.destination && f.km);
    const km = info?.km ?? 100;

    /* La série court jusqu'à la veille : le mois en cours doit porter
       quelques missions, sans quoi le taux d'externalisation s'y lit vide et
       passe pour une source non branchée. */
    const jours = -358 + Math.round((i / 83) * 357) + entre(-3, 1);
    const date = decaler(Math.min(-1, jours));
    /* Un forfait poulets porte un lot, pas un tonnage : on note le poids réel,
       mais il n'entre pas dans le prix. */
    const tonnage = tarif.unite === "forfait" ? entre(3, 8) : km > 200 ? entre(30, 40) : entre(18, 34);
    const categorie: CategorieVehicule = tarif.unite === "forfait" ? "camion" : km > 200 ? "tracteur" : "camion";

    /* Le net dû par la grille — c'est lui que le transporteur doit toucher. */
    const attenduNet = tarif.unite === "tonne" ? Math.round(tarif.prix * tonnage) : tarif.prix;

    const age = -Math.min(-1, jours);
    const statut: StatutAffretement = age < 3 ? "demande" : age < 7 ? "confirme" : age < 12 ? "livre" : age < 45 ? "facture" : entre(0, 27) === 0 ? "annule" : "regle";
    const livre = statut === "livre" || statut === "facture" || statut === "regle";
    const facture = statut === "facture" || statut === "regle";

    /* Les écarts, voulus : Sokhna Diop et Abdou K. Diop majorent parfois, les
       transporteurs sous contrat facturent au tarif. */
    const derive = tarif.source === "contrat" ? entre(-1, 1) / 100 : tarif.source === "accord-verbal" ? entre(-1, 9) / 100 : entre(0, 16) / 100;
    const tonnageLivre = livre ? (tarif.unite === "forfait" ? tonnage : Math.max(1, tonnage + entre(-2, 1))) : null;
    const netReel = tarif.unite === "tonne" && tonnageLivre !== null ? Math.round(tarif.prix * tonnageLivre * (1 + derive)) : Math.round(attenduNet * (1 + derive));

    liste.push({
      numero: formerNumero("affretement", date, i + 1),
      date,
      transporteurNumero: tarif.transporteurNumero,
      transporteur: tarif.transporteur,
      origine: tarif.origine,
      destination: livraisonReelle(tarif.destination, i),
      businessUnit: businessUnitDe(tarif.origine),
      categorieDemandee: categorie,
      /* Le camion et le chauffeur viennent du **référentiel tiers**, et non
         d'un tirage : le transporteur roule avec ses camions, pas avec des
         immatriculations inventées à chaque mission. */
      immatriculationExterne: livre ? (camionDe(tarif.transporteurNumero, i)?.immatriculationAffichee ?? null) : null,
      chauffeurExterne: livre ? (chauffeurDe(tarif.transporteurNumero, i)?.nom ?? null) : null,
      tonnagePrevu: tonnage,
      tonnageLivre,
      distanceKm: km,
      motif: MOTIFS[entre(0, MOTIFS.length - 1)]!,
      vehiculeRemplaceId: entre(0, 2) === 0 ? (FLOTTE[entre(0, FLOTTE.length - 1)]?.vehicule.id ?? null) : null,
      statut,
      montantConvenu: attenduNet,
      /* Deux missions sur quatre-vingt-quatre portent une exception : un détour
         par Malicounda, une attente au déchargement. C'est la proportion que le
         métier décrit — l'exception est rare, mais elle doit exister. */
      prixExceptionnel: i === 79 ? 4200 : null,
      complementTarif: i === 81 ? 25_000 : null,
      motifTarif: i === 79 ? "Détour par Malicounda, piste impraticable" : i === 81 ? "Attente de six heures au déchargement" : null,
      /* La facture porte le montant **majoré de la retenue** : c'est ainsi que
         le transporteur touche net ce dont on est convenu. */
      montantFacture: facture ? factureDepuisNet(netReel) : null,
      dateLivraison: livre ? decaler(Math.min(-1, jours + entre(0, 2))) : null,
      dateFacture: facture ? decaler(Math.min(-1, jours + entre(3, 14))) : null,
      dateReglement: statut === "regle" ? decaler(Math.min(-1, jours + entre(25, 60))) : null,
      referenceFacture: facture ? `N${entre(40, 99)}-${date.slice(2, 4)}` : null,
      numeroDemandeX3: facture ? `DA200-${date.slice(2, 4)}${date.slice(5, 7)}${String(entre(100, 999))}` : null,
      numeroBonCommande: facture ? `BC${18000 + i * 3}` : null,
      demandeur: DEMANDEURS[entre(0, DEMANDEURS.length - 1)]!,
      commentaire: null,
      creee: false,
    });
  }

  CACHE = liste.sort((a, b) => b.date.localeCompare(a.date));
  return CACHE;
}

/* ============================================================================
 * Les mises à disposition ADEX
 *
 * **Les prix sont ceux de la feuille « ADEX »** du même tableur : 130 000 F par
 * jour pour un porteur d'aliments, de farines ou de poulets, 45 000 F pour la
 * camionnette à œufs, 85 000 F pour la navette de son de blé. La note du
 * tableur fait le reste du contrat : payable six jours sur sept sauf panne,
 * avec dotation carburant.
 *
 * **Les immatriculations sont réelles** : ce sont les six véhicules marqués
 * ADEX dans `61. Gestion Parc/MALICK/CARBURANT/CONSOMMATION CARBURANT
 * VEHICULES ADEX 2024 - 2025.xlsx`, et les litres servis suivent les ordres de
 * grandeur qu'on y lit — de 125 à 230 litres par mois pour la camionnette à
 * œufs, de 1 050 à 1 830 pour les porteurs. C'est ce fichier qui prouve que le
 * carburant des véhicules ADEX sort de la cuve SEDIMA.
 * ==========================================================================*/

/* Le prix de la cuve au mois de la mise à disposition : une dotation de mars
   2025 ne se valorise pas au barème de 2026. */

/** Le prix journalier, famille par famille — feuille « ADEX » du tableur. */
const PRIX_JOUR_ADEX: Record<FamilleMad, number> = {
  aliments: 130_000,
  oeufs: 45_000,
  "son-de-ble": 85_000,
};

/** Les véhicules mis à disposition, avec la fourchette de litres relevée sur 2024. */
const VEHICULES_ADEX: { immatriculation: string; famille: FamilleMad; litres: [number, number]; tonnes: [number, number] }[] = [
  { immatriculation: "AA-569-EC", famille: "aliments", litres: [1140, 1830], tonnes: [420, 640] },
  { immatriculation: "AA-571-EC", famille: "aliments", litres: [1055, 1660], tonnes: [400, 610] },
  { immatriculation: "AA-573-EC", famille: "aliments", litres: [1070, 1840], tonnes: [410, 630] },
  { immatriculation: "AA-567-EC", famille: "oeufs", litres: [200, 490], tonnes: [55, 95] },
  { immatriculation: "AA-076-BP", famille: "oeufs", litres: [125, 230], tonnes: [40, 75] },
  { immatriculation: "AA-658-JS", famille: "son-de-ble", litres: [190, 525], tonnes: [230, 390] },
];

const NOM_ADEX = "ADEX Express";

/*
 * La convention de facturation d'ADEX n'est **pas** vérifiée : le fichier de
 * factures 2026 ne porte aucune facture ADEX, la mise à disposition se réglant
 * hors de ce circuit. On ne sait donc pas si les 130 000 F sont nets ou bruts —
 * l'écart annuel se compte pourtant en millions (question 72).
 */
const CONVENTION_ADEX: ConventionFacturation = "inconnue";

let CACHE_TARIFS_JOUR: TarifJournalier[] | null = null;

export function tarifsJournaliers(): TarifJournalier[] {
  if (CACHE_TARIFS_JOUR) return CACHE_TARIFS_JOUR;
  const adex = parNom(NOM_ADEX);
  CACHE_TARIFS_JOUR = (Object.keys(PRIX_JOUR_ADEX) as FamilleMad[]).map((famille, rang) => ({
    numero: formerNumero("tarif", DEBUT_GRILLE, 900 + rang),
    transporteurNumero: adex?.numero ?? "",
    transporteur: NOM_ADEX,
    famille,
    prixJour: PRIX_JOUR_ADEX[famille],
    debut: DEBUT_GRILLE,
    fin: null,
    /* Une note de bas de tableur n'est pas un contrat : le compte rendu de
       réunion dit d'ailleurs le contrat actuel « inadapté et à revoir ». */
    source: "a-confirmer",
    convention: CONVENTION_ADEX,
    commentaire: "Mise à disposition payable 6 jours sur 7 sauf panne, dotation carburant à la charge de SEDIMA",
  }));
  return CACHE_TARIFS_JOUR;
}

/** Les douze derniers mois, du plus ancien au plus récent. */
function douzeMois(): string[] {
  const mois: string[] = [];
  const d = new Date(`${DATE_REFERENCE}T00:00:00Z`);
  for (let i = 11; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    mois.push(m.toISOString().slice(0, 7));
  }
  return mois;
}

function joursDuMois(mois: string): number {
  const [a, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(a!, m!, 0)).getUTCDate();
}

let CACHE_MAD: MiseADisposition[] | null = null;

export function misesADisposition(): MiseADisposition[] {
  if (CACHE_MAD) return CACHE_MAD;
  const alea = graine("mad-adex-2026");
  const entre = (min: number, max: number) => min + Math.floor(alea() * (max - min + 1));
  const adex = parNom(NOM_ADEX);
  const liste: MiseADisposition[] = [];
  let rang = 0;

  for (const mois of douzeMois()) {
    const enCoursDeMois = mois === DATE_REFERENCE.slice(0, 7);
    /* Le mois en cours n'est pas encore servi en entier : le compter plein
       ferait porter à deux jours de septembre le coût de trente, et le taux
       d'externalisation du mois passerait à 100 %. */
    const cal = enCoursDeMois ? Number(DATE_REFERENCE.slice(8, 10)) : joursDuMois(mois);
    const partDuMois = cal / joursDuMois(mois);
    for (const v of VEHICULES_ADEX) {
      rang++;
      const prixJour = PRIX_JOUR_ADEX[v.famille];
      /* La panne suspend le paiement — c'est la seule remise du contrat, et
         elle ne joue que si quelqu'un l'a relevée. */
      const panne = entre(0, 9) === 0 ? entre(2, 6) : 0;
      const dus = joursDus({ joursCalendaires: cal, joursPanne: panne });
      /* Le pointage du gestionnaire de parc : les jours où le véhicule a
         vraiment chargé. L'écart avec les jours dus est le gisement. */
      const roules = Math.max(0, dus - entre(0, 6));
      const litres = Math.round(entre(v.litres[0], v.litres[1]) * partDuMois);
      const statut: StatutAffretement = enCoursDeMois ? "en-cours" : mois >= decaler(-75).slice(0, 7) ? "facture" : "regle";
      const facture = statut === "facture" || statut === "regle";
      const finDeMois = `${mois}-${String(cal).padStart(2, "0")}`;

      liste.push({
        numero: formerNumero("mise-a-disposition", `${mois}-01`, rang),
        mois,
        transporteurNumero: adex?.numero ?? "",
        transporteur: NOM_ADEX,
        immatriculation: v.immatriculation,
        famille: v.famille,
        joursCalendaires: cal,
        joursPanne: panne,
        joursRoules: roules,
        prixJour,
        convention: CONVENTION_ADEX,
        carburantLitres: litres,
        carburantMontant: litres * prixCuve(`${mois}-15`),
        /* Personne ne relève le kilométrage d'un véhicule qui n'est pas au
           parc : c'est ce qui empêche aujourd'hui de négocier au km, comme le
           demande le plan d'action du compte rendu ADEX. */
        kmParcourus: null,
        /* Le tonnage, lui, se lit sur les bons de livraison. */
        tonnesTransportees: Math.round(entre(v.tonnes[0], v.tonnes[1]) * partDuMois),
        statut,
        montantFacture: facture ? factureSelonConvention(dus * prixJour, CONVENTION_ADEX) : null,
        dateFacture: facture ? finDeMois : null,
        dateReglement: statut === "regle" ? decaler(-30) : null,
        referenceFacture: facture ? `ADX-${mois.slice(2, 4)}${mois.slice(5, 7)}-${String(rang).padStart(3, "0")}` : null,
        numeroDemandeX3: facture ? `DA200-${mois.slice(2, 4)}${mois.slice(5, 7)}${String(entre(100, 999))}` : null,
        commentaire: panne > 0 ? `${panne} jours d'immobilisation déduits` : null,
      });
    }
  }

  CACHE_MAD = liste.sort((a, b) => b.mois.localeCompare(a.mois) || a.immatriculation.localeCompare(b.immatriculation));
  return CACHE_MAD;
}

/* ============================================================================
 * Les prestations hors grille
 *
 * Relevées une à une dans `FACTURES DES TRANSPORTEURS 2026.xlsx` : la
 * livraison d'œufs et de farine de Mouhamed Sy (facture N42-26, DA200-2601295),
 * le transport du personnel des abattoirs de Dame Ndoye (DA200-2601046, 62
 * rotations à 21 050 F en janvier), les farines et œufs de K2SBT (DA200-2602119,
 * 33 voyages à 60 000 F) et les liaisons Gambie d'Aïssata Gaye (250 000 F le
 * voyage, retenue de 12 500 F).
 *
 * **La convention de facturation vient de ces mêmes factures** : chez Mouhamed
 * Sy, 1 464 000 F facturés donnent 1 390 800 F nets — la retenue est prise sur
 * le prix convenu, et le transporteur touche 5 % de moins que l'affiché. Chez
 * Dème, à l'inverse, 140 000 F de grille donnent 147 368 F de facture. Deux
 * conventions, aucune écrite (question 72).
 * ==========================================================================*/

const PRESTATIONS_TYPES: {
  transporteur: string;
  libelle: string;
  unite: UnitePrestation;
  prixUnitaire: number;
  quantite: [number, number];
  convention: ConventionFacturation;
  businessUnit: "aliment" | "abattoir" | null;
  commentaire: string | null;
}[] = [
  {
    transporteur: "Mouhamed Sy",
    libelle: "Livraison d'œufs — Dakar",
    unite: "voyage",
    prixUnitaire: 42_000,
    quantite: [26, 36],
    convention: "brut-retenu",
    businessUnit: "abattoir",
    commentaire: "Le tableur intitule la colonne « prix sac » ; le montant est celui d'un voyage — à confirmer",
  },
  { transporteur: "Mouhamed Sy", libelle: "Livraison de farine — Dakar", unite: "voyage", prixUnitaire: 40_000, quantite: [2, 6], convention: "brut-retenu", businessUnit: "aliment", commentaire: null },
  {
    transporteur: "Dame Ndoye",
    libelle: "Transport du personnel des abattoirs",
    unite: "rotation",
    prixUnitaire: 21_050,
    quantite: [54, 66],
    convention: "brut-retenu",
    businessUnit: "abattoir",
    commentaire: "Ni tonne ni voyage de marchandise : la prestation ne relève d'aucune grille",
  },
  { transporteur: "K2SBT", libelle: "Transport de farines et d'œufs", unite: "voyage", prixUnitaire: 60_000, quantite: [24, 36], convention: "inconnue", businessUnit: "aliment", commentaire: null },
  { transporteur: "Aïssata Gaye", libelle: "Liaison Gambie — Casamance", unite: "voyage", prixUnitaire: 250_000, quantite: [1, 4], convention: "brut-retenu", businessUnit: "aliment", commentaire: null },
];

let CACHE_PRESTATIONS: Prestation[] | null = null;

export function prestations(): Prestation[] {
  if (CACHE_PRESTATIONS) return CACHE_PRESTATIONS;
  const alea = graine("prestations-hors-grille-2026");
  const entre = (min: number, max: number) => min + Math.floor(alea() * (max - min + 1));
  const liste: Prestation[] = [];
  let rang = 0;

  for (const mois of douzeMois()) {
    const cal = joursDuMois(mois);
    const enCoursDeMois = mois === DATE_REFERENCE.slice(0, 7);
    for (const t of PRESTATIONS_TYPES) {
      rang++;
      const p = parNom(t.transporteur);
      /* La prestation se facture au mois échu : on la date de la fin du mois
         servi, ou de la veille pour le mois en cours. */
      const date = enCoursDeMois ? decaler(-1) : `${mois}-${String(cal).padStart(2, "0")}`;
      /* Au prorata des jours écoulés pour le mois en cours : deux jours de
         septembre ne portent pas un mois de prestations. */
      const brute = entre(t.quantite[0], t.quantite[1]);
      const quantite = enCoursDeMois ? Math.max(1, Math.round((brute * Number(DATE_REFERENCE.slice(8, 10))) / cal)) : brute;
      const statut: StatutAffretement = enCoursDeMois ? "en-cours" : date >= decaler(-75) ? "facture" : "regle";
      const facture = statut === "facture" || statut === "regle";
      const convenu = quantite * t.prixUnitaire;

      liste.push({
        numero: formerNumero("prestation", date, rang),
        date,
        transporteurNumero: p?.numero ?? "",
        transporteur: t.transporteur,
        libelle: t.libelle,
        businessUnit: t.businessUnit,
        unite: t.unite,
        quantite,
        prixUnitaire: t.prixUnitaire,
        convention: t.convention,
        statut,
        montantFacture: facture ? factureSelonConvention(convenu, t.convention) : null,
        dateFacture: facture ? date : null,
        dateReglement: statut === "regle" ? decaler(-25) : null,
        referenceFacture: facture ? `N${entre(40, 99)}-${mois.slice(2, 4)}` : null,
        numeroDemandeX3: facture ? `DA200-${mois.slice(2, 4)}${mois.slice(5, 7)}${String(entre(100, 999))}` : null,
        commentaire: t.commentaire,
      });
    }
  }

  CACHE_PRESTATIONS = liste.sort((a, b) => b.date.localeCompare(a.date));
  return CACHE_PRESTATIONS;
}

/** Ce que les tiers coûtent au parc sur un mois, tous modèles confondus. */
export function coutTiersDuMois(mois: string): { affretements: number; misesADisposition: number; prestations: number; carburantAdex: number; total: number } {
  const aff = affretements()
    .filter((a) => a.date.slice(0, 7) === mois)
    .reduce((s, a) => s + coutAffretement(a), 0);
  const mad = misesADisposition().filter((m) => m.mois === mois);
  const couts = mad.map((m) => coutMiseADisposition(m));
  const pres = prestations()
    .filter((p) => p.date.slice(0, 7) === mois)
    .reduce((s, p) => s + coutPrestation(p), 0);
  const location = couts.reduce((s, c) => s + c.location, 0);
  const carburant = couts.reduce((s, c) => s + c.carburant, 0);
  return { affretements: aff, misesADisposition: location, prestations: pres, carburantAdex: carburant, total: aff + location + carburant + pres };
}

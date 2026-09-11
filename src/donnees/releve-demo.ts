/* ============================================================================
 * Le relevé de transport — le tableur de la DO, porté sur douze mois.
 *
 * Il ne s'invente pas : il se **dérive** de ce que l'application tient déjà.
 * Chaque affrètement devient une ligne de relevé au mode « transporteur », et
 * l'on complète avec les rotations du parc, les enlèvements client et les
 * transports ponctuels, dans les proportions du relevé hebdomadaire réel.
 *
 * Cette dérivation n'est pas un artifice : c'est ainsi que le relevé se
 * remplira en production. La saisie de la semaine se fera sur l'écran, et les
 * missions déjà connues — affrètements commandés, rotations planifiées — y
 * seront proposées d'avance plutôt que ressaisies.
 *
 * **Proportions visées**, tirées du relevé de la DO où SEDIMA figure comme un
 * transporteur parmi les autres : le parc porte à peu près un tiers des
 * rotations, les transporteurs un peu plus de la moitié, et le reste se répartit
 * entre enlèvements client et transports ponctuels.
 * ==========================================================================*/

import type { LigneReleve, ModeExecution, ProduitTransporte } from "@/domaine/releve-transport";
import { semaineDe } from "@/domaine/releve-transport";
import { destinationTarifaire } from "@/domaine/flotte-tierce";
import { formerNumero } from "@/domaine/reference";
import { graine } from "./fiche-demo";
import { camionsTiers, chauffeursTiers, rattachements } from "./flotte-tierce-demo";
import { FLOTTE } from "./parc-demo";
import { affretements, misesADisposition } from "./transporteurs-demo";
import { DATE_REFERENCE } from "./chauffeurs-demo";

/**
 * Cinquante-deux semaines.
 *
 * Le tableur de la DO en tient treize, et c'est déjà beaucoup pour une saisie à
 * la main. Mais un coût à la tonne se lit sur l'année, et rapporter douze mois
 * de charges à trois mois de tonnage donnait 51 000 F la tonne au lieu de
 * 13 000 — les deux termes d'un ratio doivent couvrir la même période, faute de
 * quoi l'indicateur ment d'un facteur quatre.
 */
const SEMAINES = 52;

/* Les localités réellement livrées par le parc, telles que le relevé les écrit.
   Elles ne sont pas dans la grille — le parc n'en a pas besoin, il ne se
   facture pas — mais elles doivent ressembler à ce que l'exploitation voit. */
const LOCALITES_PARC = [
  "MBOUR",
  "THIES",
  "POUT",
  "BAYAKH",
  "TOUBA",
  "KAOLACK",
  "NIAKHIRATE",
  "SANGALKAM",
  "BAMBILOR",
  "TIV PEUL",
  "NOTTO",
  "LOUGA",
  "KANIAC",
  "MALIKA",
  "GOROM",
  "NDOYENE",
];

const CLIENTS_ENLEVEURS = ["Ferme Ndiaye — Sébikotane", "Aviculture du Cap-Vert", "Coopérative de Notto", "GIE Diamniadio", "Ferme Sow — Pout"];
const PONCTUELS = ["Garaya Transport", "Wakeur Serigne", "Khelcom Transport", "Moussa Gueye", "GIE de l'Espoir"];

const PRODUITS_PARC: ProduitTransporte[] = ["aliment", "aliment", "aliment", "son-de-ble", "poussins", "oeufs"];

let CACHE: LigneReleve[] | null = null;

function decaler(jours: number): string {
  const d = new Date(`${DATE_REFERENCE}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

function immatriculationInventee(alea: () => number): string {
  const lettre = () => String.fromCharCode(65 + Math.floor(alea() * 26));
  return `DK-${1000 + Math.floor(alea() * 8999)}-${lettre()}${lettre()}`;
}

/**
 * Le relevé complet, de la plus récente à la plus ancienne des lignes.
 *
 * L'ordre importe : c'est la semaine en cours qu'on saisit et qu'on contrôle,
 * les précédentes ne servent qu'à comparer.
 */
export function relevesTransport(): LigneReleve[] {
  if (CACHE) return CACHE;

  const alea = graine("releve-transport");
  const liens = rattachements();
  const camions = camionsTiers();
  const chauffeurs = chauffeursTiers();
  const parcRoulant = FLOTTE.filter((l) => l.vehicule.engage && (l.vehicule.categorie === "camion" || l.vehicule.categorie === "tracteur"));
  const lignes: LigneReleve[] = [];
  let rang = 0;

  const poser = (
    date: string,
    mode: ModeExecution,
    champs: Omit<LigneReleve, "numero" | "date" | "semaine" | "mode" | "destinationTarifaire">,
  ): void => {
    rang += 1;
    const rattachee = destinationTarifaire(champs.destination, liens);
    lignes.push({
      numero: formerNumero("transport", date, rang),
      date,
      semaine: semaineDe(date),
      mode,
      /* La destination tarifaire est celle de la grille quand la localité y
         figure, sinon celle à laquelle elle est rattachée. Le parc n'en a pas
         besoin pour rouler, mais elle sert à comparer son coût à celui d'un
         tiers sur le même trajet — la comparaison que réclame le compte rendu. */
      destinationTarifaire: rattachee?.destination ?? champs.destination,
      ...champs,
    });
  };

  /* ---- 1. Ce que les tiers ont porté : chaque affrètement fait une ligne ---- */
  const debut = decaler(-SEMAINES * 7);
  for (const a of affretements()) {
    if (a.date < debut || a.statut === "annule" || a.statut === "demande") continue;
    const camion = camions.find((c) => c.immatriculationAffichee === a.immatriculationExterne) ?? null;
    poser(a.date, camion ? "transporteur" : "prestataire-ponctuel", {
      transporteurNumero: a.transporteurNumero,
      transporteur: a.transporteur,
      vehiculeId: null,
      camionTiersImmatriculation: camion?.immatriculationAffichee ?? null,
      immatriculationLibre: camion ? null : a.immatriculationExterne,
      chauffeurLibre: camion ? null : a.chauffeurExterne,
      chauffeur: a.chauffeurExterne,
      origine: a.origine,
      destination: a.destination,
      produit: "aliment",
      tonnage: a.tonnagePrevu,
      /* Le pont bascule ne pèse pas tout : deux voyages sur trois, et l'écart
         reste faible. C'est ce qui rend le contrôle possible sans le rendre
         systématique. */
      tonnagePese: a.tonnageLivre !== null && alea() > 0.33 ? a.tonnageLivre : null,
      bonLivraison: `BL-${a.date.slice(0, 7).replace("-", "")}-${100 + Math.floor(alea() * 800)}`,
      affretementNumero: a.numero,
    });
  }

  /* ---- 1 bis. Les mises à disposition ----
     Sept camions ADEX roulent six jours sur sept : sans eux, le relevé montrait
     une semaine sans aucun transporteur, et un taux d'externalisation de six
     pour cent quand le coût en dit cinquante-cinq. Le tonnage du mois se
     répartit sur les jours roulés, camion par camion. */
  for (const m of misesADisposition()) {
    if (m.tonnesTransportees === null || m.joursRoules === null || m.joursRoules <= 0) continue;
    const camion = camions.find((c) => c.immatriculationAffichee === m.immatriculation) ?? null;
    const chauffeur = chauffeurs.find((c) => c.id === camion?.chauffeurHabituelId) ?? null;
    const parJour = m.tonnesTransportees / m.joursRoules;
    let poses = 0;
    for (let jourDuMois = 1; jourDuMois <= 31 && poses < m.joursRoules; jourDuMois++) {
      const date = `${m.mois}-${String(jourDuMois).padStart(2, "0")}`;
      if (date < debut || date >= DATE_REFERENCE) continue;
      const d = new Date(`${date}T00:00:00Z`);
      if (Number.isNaN(d.getTime()) || d.getUTCDay() === 0) continue;
      poses += 1;
      const tonnage = Math.round(parJour * (0.85 + alea() * 0.3) * 10) / 10;
      poser(date, "transporteur", {
        transporteurNumero: m.transporteurNumero,
        transporteur: m.transporteur,
        vehiculeId: null,
        camionTiersImmatriculation: camion?.immatriculationAffichee ?? m.immatriculation,
        immatriculationLibre: null,
        chauffeurLibre: null,
        chauffeur: chauffeur?.nom ?? null,
        origine: "UAB",
        destination: LOCALITES_PARC[Math.floor(alea() * LOCALITES_PARC.length)]!,
        produit: m.famille === "oeufs" ? "oeufs" : m.famille === "son-de-ble" ? "son-de-ble" : "aliment",
        tonnage,
        tonnagePese: alea() > 0.45 ? Math.round(tonnage * (1 + (alea() - 0.5) * 0.03) * 10) / 10 : null,
        bonLivraison: `BL-${m.mois.replace("-", "")}-${100 + Math.floor(alea() * 800)}`,
        /* La mise à disposition se facture au mois, pas au chargement : la
           ligne de relevé porte le transport, la facture vit ailleurs. */
        affretementNumero: null,
      });
    }
  }

  /* ---- 2. Ce que le parc a porté ---- */
  for (let jour = -SEMAINES * 7; jour <= -1; jour++) {
    const date = decaler(jour);
    const j = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (j === 0) continue; /* On ne charge pas le dimanche. */
    /* Deux à cinq rotations par jour ouvré, selon la saison de l'aliment. */
    const rotations = 2 + Math.floor(alea() * 4);
    for (let k = 0; k < rotations; k++) {
      const ligne = parcRoulant[Math.floor(alea() * parcRoulant.length)];
      if (!ligne) continue;
      const produit = PRODUITS_PARC[Math.floor(alea() * PRODUITS_PARC.length)]!;
      const tonnage = produit === "poussins" || produit === "oeufs" ? Math.round((2 + alea() * 4) * 10) / 10 : Math.round((14 + alea() * 22) * 10) / 10;
      poser(date, "parc", {
        transporteurNumero: null,
        transporteur: null,
        vehiculeId: ligne.vehicule.id,
        camionTiersImmatriculation: null,
        immatriculationLibre: null,
        chauffeurLibre: null,
        chauffeur: ligne.chauffeurTitulaire?.nom ?? null,
        origine: "UAB",
        destination: LOCALITES_PARC[Math.floor(alea() * LOCALITES_PARC.length)]!,
        produit,
        tonnage,
        /* Le bruit de pesée est **proportionnel** : quatre cents kilos d'écart
           sur trois tonnes de poussins font treize pour cent, et l'alerte se
           déclencherait sur un arrondi plutôt que sur un vrai manquant. */
        tonnagePese: alea() > 0.4 ? Math.round(tonnage * (1 + (alea() - 0.5) * 0.03) * 10) / 10 : null,
        bonLivraison: `BL-${date.slice(0, 7).replace("-", "")}-${100 + Math.floor(alea() * 800)}`,
        affretementNumero: null,
      });
    }
  }

  /* ---- 3. Les enlèvements par les clients ---- */
  for (let jour = -SEMAINES * 7; jour <= -1; jour++) {
    if (alea() > 0.55) continue;
    const date = decaler(jour);
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) continue;
    const client = CLIENTS_ENLEVEURS[Math.floor(alea() * CLIENTS_ENLEVEURS.length)]!;
    const tonnage = Math.round((3 + alea() * 12) * 10) / 10;
    poser(date, "enlevement-client", {
      transporteurNumero: null,
      transporteur: client,
      vehiculeId: null,
      camionTiersImmatriculation: null,
      /* Ni fiche véhicule ni fiche chauffeur : on note qui est passé, un point.
         C'est la règle posée au brainstorm du 5 septembre. */
      immatriculationLibre: immatriculationInventee(alea),
      chauffeurLibre: "Chauffeur du client",
      chauffeur: "Chauffeur du client",
      origine: "UAB",
      destination: LOCALITES_PARC[Math.floor(alea() * LOCALITES_PARC.length)]!,
      produit: "aliment",
      tonnage,
      tonnagePese: alea() > 0.25 ? Math.round(tonnage * (1 + (alea() - 0.5) * 0.03) * 10) / 10 : null,
      bonLivraison: `BL-${date.slice(0, 7).replace("-", "")}-${100 + Math.floor(alea() * 800)}`,
      affretementNumero: null,
    });
  }

  /* ---- 4. Les transports ponctuels ---- */
  for (let semaine = 0; semaine < SEMAINES; semaine++) {
    if (alea() > 0.65) continue;
    const date = decaler(-semaine * 7 - Math.floor(alea() * 6) - 1);
    poser(date, "prestataire-ponctuel", {
      transporteurNumero: null,
      transporteur: PONCTUELS[Math.floor(alea() * PONCTUELS.length)]!,
      vehiculeId: null,
      camionTiersImmatriculation: null,
      immatriculationLibre: immatriculationInventee(alea),
      chauffeurLibre: null,
      chauffeur: null,
      origine: "UAB",
      destination: LOCALITES_PARC[Math.floor(alea() * LOCALITES_PARC.length)]!,
      produit: alea() > 0.5 ? "oeufs" : "aliment",
      tonnage: Math.round((4 + alea() * 10) * 10) / 10,
      tonnagePese: null,
      bonLivraison: null,
      affretementNumero: null,
    });
  }

  CACHE = lignes.sort((a, b) => b.date.localeCompare(a.date) || a.numero.localeCompare(b.numero));
  return CACHE;
}

/** Les semaines couvertes, de la plus récente à la plus ancienne. */
export function semainesRelevees(): string[] {
  return [...new Set(relevesTransport().map((l) => l.semaine))].sort((a, b) => b.localeCompare(a));
}

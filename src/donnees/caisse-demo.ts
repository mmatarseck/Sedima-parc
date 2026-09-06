/* ============================================================================
 * Caisse & achats — données de démonstration.
 *
 * Une seule vérité, comme partout ailleurs : le journal de caisse ne réinvente
 * aucune dépense. Il relit celles des fiches véhicules dont l'origine du
 * décaissement est « caisse parc », et en fait des sorties qui les citent. Les
 * dépenses les plus récentes restent volontairement non réglées : ce sont
 * celles que l'écran propose de régler, et c'est ainsi qu'on voit la règle à
 * l'œuvre — une sortie de caisse cite toujours la dépense qu'elle règle.
 *
 * Les demandes d'achat, elles, naissent de ce qui les motive : une observation
 * de visite technique à corriger, une intervention curative, une déclaration
 * d'incident. Chacune cite le numéro de sa transaction d'origine, règle posée
 * par le métier le 3 septembre 2026, et son fournisseur par son numéro PRE.
 * Celles qui ont franchi la validation sont suivies dans Sage X3 : un numéro
 * de bon, une date de livraison, un montant facturé, une date de règlement —
 * rien de plus, X3 garde le reste.
 * ==========================================================================*/

import { avecSolde, lienOrigine, statistiquesParPrestataire, type EtapeAchat, type LigneAchat, type LigneMouvement, type StatistiquesPrestataire } from "@/domaine/caisse";
import { formerNumero } from "@/domaine/reference";
import type { BusinessUnit, PosteDepense } from "@/domaine/types";
import { date as formaterDate, montant as formaterMontant } from "@/lib/format";
import { fichePourImmatriculation, graine } from "./fiche-demo";
import { listeIncidents } from "./incidents-demo";
import { FLOTTE } from "./parc-demo";
import { listePrestataires, prestatairePour } from "./prestataires-demo";

/** Date de référence du jeu de démonstration, comme dans les autres modules. */
const AUJOURDHUI = "2026-09-02";

/**
 * Solde de départ de la caisse parc, à l'ouverture du journal. En production,
 * c'est le solde reporté de l'exercice précédent.
 */
export const SOLDE_INITIAL = 1_500_000;

/**
 * Les dépenses réglées en espèces des douze derniers jours restent en attente :
 * la caisse n'a pas encore été rapprochée. C'est ce qui alimente le volet
 * « à régler » de l'écran.
 */
const JOURS_NON_REGLES = 12;

function decaler(iso: string, jours: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

/** Une dépense de fiche véhicule, augmentée de son porteur — la matière du journal. */
export interface DepenseCaisse {
  numero: string;
  date: string;
  libelle: string;
  montant: number;
  poste: PosteDepense;
  beneficiaire: string | null;
  reference: string | null;
  justificatif: boolean;
  vehiculeId: string;
  immatriculation: string;
  immatriculationAffichee: string;
  businessUnit: BusinessUnit | null;
  site: string | null;
}

let CACHE_DEPENSES: DepenseCaisse[] | null = null;

/** Toutes les dépenses de la flotte dont le décaissement passe par la caisse parc. */
export function depensesCaisse(): DepenseCaisse[] {
  if (CACHE_DEPENSES) return CACHE_DEPENSES;
  const liste: DepenseCaisse[] = [];
  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation);
    if (!f) continue;
    for (const d of f.depenses) {
      if (d.origine !== "caisse") continue;
      liste.push({
        numero: d.numero,
        date: d.date,
        libelle: d.libelle,
        montant: d.montant,
        poste: d.poste,
        beneficiaire: d.beneficiaire,
        reference: d.reference,
        justificatif: d.justificatif,
        vehiculeId: l.vehicule.id,
        immatriculation: l.vehicule.immatriculation,
        immatriculationAffichee: l.vehicule.immatriculationAffichee,
        businessUnit: l.vehicule.businessUnit,
        site: l.site?.libelle ?? null,
      });
    }
  }
  liste.sort((a, b) => a.date.localeCompare(b.date) || a.numero.localeCompare(b.numero));
  CACHE_DEPENSES = liste;
  return liste;
}

/** La limite entre ce qui est réglé et ce qui attend le passage en caisse. */
const LIMITE_REGLEMENT = decaler(AUJOURDHUI, -JOURS_NON_REGLES);

/** Les dépenses caisse qu'aucun mouvement ne règle encore — le volet « à régler ». */
export function depensesAReglier(): DepenseCaisse[] {
  return depensesCaisse()
    .filter((d) => d.date > LIMITE_REGLEMENT)
    .sort((a, b) => b.date.localeCompare(a.date));
}

let CACHE_JOURNAL: LigneMouvement[] | null = null;

/**
 * Le journal, du plus récent au plus ancien, solde calculé sur chaque ligne.
 *
 * Chaque dépense réglée donne une sortie qui la cite ; chaque début de mois
 * donne un approvisionnement dimensionné sur les sorties du mois, arrondi au
 * quart de million supérieur — comme le fait la comptabilité quand elle
 * réalimente la caisse parc.
 */
export function journalCaisse(): LigneMouvement[] {
  if (CACHE_JOURNAL) return CACHE_JOURNAL;
  const reglees = depensesCaisse().filter((d) => d.date <= LIMITE_REGLEMENT);

  /* Ce qu'il faudra remettre en caisse chaque mois, pour dimensionner les
     approvisionnements avant de numéroter quoi que ce soit. */
  const parMois = new Map<string, number>();
  for (const d of reglees) parMois.set(d.date.slice(0, 7), (parMois.get(d.date.slice(0, 7)) ?? 0) + d.montant);

  const bruts: Omit<LigneMouvement, "numero" | "soldeApres">[] = [];

  for (const [mois, total] of parMois) {
    const alea = graine(`appro-${mois}`);
    /* La caisse est un fonds fixe : on y remet ce que le mois a consommé,
       arrondi au quart de million. Sans cela, le solde dériverait à la hausse
       de mois en mois et ne voudrait plus rien dire. */
    const montant = Math.round(total / 250_000) * 250_000;
    bruts.push({
      date: `${mois}-01`,
      sens: "entree",
      libelle: `Approvisionnement de la caisse parc — ${mois}`,
      montant,
      beneficiaire: "Trésorerie SEDIMA",
      piece: `BQ-${mois.replace("-", "")}-${100 + Math.round(alea() * 800)}`,
      justificatif: true,
      depenseNumero: null,
      poste: null,
      vehiculeId: null,
      immatriculation: null,
      immatriculationAffichee: null,
      businessUnit: null,
      site: null,
      enregistrePar: "Contrôle de gestion",
      creee: false,
    });
  }

  for (const d of reglees) {
    const alea = graine(`caisse-${d.numero}`);
    /* Le passage en caisse suit la dépense d'un jour ou deux : la pièce est
       rapportée, puis remboursée. */
    const jours = Math.round(alea() * 2);
    bruts.push({
      date: decaler(d.date, jours),
      sens: "sortie",
      libelle: d.libelle,
      montant: d.montant,
      beneficiaire: d.beneficiaire,
      piece: d.reference ?? `CP-${d.date.slice(2, 4)}${d.date.slice(5, 7)}-${100 + Math.round(alea() * 800)}`,
      justificatif: d.justificatif,
      depenseNumero: d.numero,
      poste: d.poste,
      vehiculeId: d.vehiculeId,
      immatriculation: d.immatriculation,
      immatriculationAffichee: d.immatriculationAffichee,
      businessUnit: d.businessUnit,
      site: d.site,
      enregistrePar: "Caisse parc",
      creee: false,
    });
  }

  /* Numérotation chronologique, une séquence par année comme en base. */
  bruts.sort((a, b) => a.date.localeCompare(b.date) || (a.sens === b.sens ? 0 : a.sens === "entree" ? -1 : 1));
  const sequences = new Map<string, number>();
  const mouvements: LigneMouvement[] = bruts.map((m) => {
    const annee = m.date.slice(0, 4);
    const suivant = (sequences.get(annee) ?? 0) + 1;
    sequences.set(annee, suivant);
    return { ...m, numero: formerNumero("caisse", m.date, suivant), soldeApres: 0 };
  });

  CACHE_JOURNAL = avecSolde(mouvements, SOLDE_INITIAL);
  return CACHE_JOURNAL;
}

/* -- Demandes d'achat -------------------------------------------------------- */

const FOURNISSEURS = ["Pneus Plus Dakar", "SENEMECA", "Espace Auto Sénégal", "CFAO Motors", "Sénégalaise de l'Automobile", "Établissements Diagne & Frères", "TATA Pikine"];

/** Un fournisseur pressenti, par son nom et son numéro PRE quand le référentiel le connaît. */
function fournisseurAleatoire(alea: () => number): { fournisseur: string; prestataireNumero: string | null } {
  const nom = FOURNISSEURS[Math.round(alea() * (FOURNISSEURS.length - 1))]!;
  return { fournisseur: nom, prestataireNumero: prestatairePour(nom)?.numero ?? null };
}

/** Un numéro de DA tel que Sage X3 les forme : « DA200-2608123 ». */
function numeroDaX3(date: string, alea: () => number): string {
  return `DA200-${date.slice(2, 4)}${date.slice(5, 7)}${String(1_000 + Math.round(alea() * 8_999))}`;
}

let CACHE_ACHATS: LigneAchat[] | null = null;

/**
 * Les demandes d'achat de démonstration, dérivées de ce qui les motive.
 * Trois sources, dans l'ordre où le parc les rencontre : une observation de
 * visite technique à corriger avant la contre-visite, une intervention
 * curative qui a consommé des pièces, une déclaration d'incident à réparer.
 */
export function demandesAchat(): LigneAchat[] {
  if (CACHE_ACHATS) return CACHE_ACHATS;
  const prestataires = listePrestataires();
  const lignes: LigneAchat[] = [];
  const sequences = new Map<string, number>();
  const numeroter = (date: string): string => {
    const annee = date.slice(0, 4);
    const suivant = (sequences.get(annee) ?? 0) + 1;
    sequences.set(annee, suivant);
    return formerNumero("achat", date, suivant);
  };

  const ajouter = (l: Omit<LigneAchat, "numero" | "origineHref">) => {
    lignes.push({ ...l, numero: "", origineHref: lienOrigine(l.origineNumero, l.immatriculation) });
  };

  /* Les champs relevés dans X3, vides tant que l'étape n'est pas atteinte. */
  const x3Vide = {
    numeroDemandeX3: null,
    numeroBonCommande: null,
    montantEngage: null,
    dateLivraison: null,
    dateFacture: null,
    montantReel: null,
    dateReglement: null,
    depenseNumero: null,
  };

  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation);
    if (!f) continue;
    const v = l.vehicule;
    const alea = graine(`achat-${v.immatriculation}`);
    const commun = {
      vehiculeId: v.id,
      immatriculation: v.immatriculation,
      immatriculationAffichee: v.immatriculationAffichee,
      businessUnit: v.businessUnit,
      site: l.site?.libelle ?? null,
      visaPar: null,
      visaLe: null,
      validePar: null,
      valideeLe: null,
      ...x3Vide,
      commentaireDecision: null,
      creee: false,
    };

    /* Une observation de visite technique ouverte : la contre-visite ne passera
       pas sans la pièce. C'est le cas d'école de la demande urgente. */
    const observation = f.observationsVisite.find((o) => o.statut !== "corrigee");
    if (observation) {
      const date = decaler(AUJOURDHUI, -Math.round(alea() * 20) - 2);
      ajouter({
        ...commun,
        date,
        objet: `${observation.libelle} — avant contre-visite`,
        poste: "pieces",
        montantEstime: 120_000 + Math.round(alea() * 12) * 25_000,
        ...fournisseurAleatoire(alea),
        urgence: observation.gravite === "majeure" ? "immobilisation" : "urgente",
        origineNumero: observation.numero,
        origineLibelle: `Observation · ${observation.libelle}`,
        demandeur: "Responsable maintenance",
        demandeurRole: "responsable-maintenance",
        etape: "soumise",
      });
    }

    /* Une intervention curative récente : pièces à recompléter. Selon son
       ancienneté, la demande en est à une étape ou une autre du circuit — et
       les plus anciennes ont fait tout le chemin dans X3 jusqu'au règlement. */
    const intervention = f.interventions.filter((i) => i.type === "curatif").sort((a, b) => b.date.localeCompare(a.date))[0];
    if (intervention && alea() > 0.35) {
      const date = decaler(intervention.date, Math.round(alea() * 6));
      const montantEstime = Math.max(60_000, Math.round((intervention.montant * (0.3 + alea() * 0.4)) / 5_000) * 5_000);
      const etapes: EtapeAchat[] = ["visee", "validee", "commandee", "livree", "facturee", "reglee", "reglee", "refusee"];
      const etape = etapes[Math.min(etapes.length - 1, Math.floor(alea() * etapes.length))]!;
      const rang = etapes.indexOf(etape);
      const fournisseur = fournisseurAleatoire(alea);
      const prestataire = prestataires.find((p) => p.numero === fournisseur.prestataireNumero) ?? null;
      const validee = rang >= 1 && etape !== "refusee";
      const commandee = rang >= 2 && etape !== "refusee";
      const livree = rang >= 3 && etape !== "refusee";
      const facturee = rang >= 4 && etape !== "refusee";
      const reglee = etape === "reglee";
      const montantEngage = commandee ? Math.round((montantEstime * (0.92 + alea() * 0.16)) / 500) * 500 : null;
      const dateLivraison = livree ? decaler(date, 5 + Math.round(alea() * 10)) : null;
      const dateFacture = facturee && dateLivraison ? decaler(dateLivraison, 3 + Math.round(alea() * 7)) : null;
      ajouter({
        ...commun,
        date,
        objet: `Pièces — ${intervention.objet}`,
        poste: "pieces",
        montantEstime,
        ...fournisseur,
        urgence: alea() > 0.7 ? "urgente" : "normale",
        origineNumero: intervention.numero,
        origineLibelle: `Intervention · ${intervention.objet}`,
        demandeur: "Responsable maintenance",
        demandeurRole: "responsable-maintenance",
        etape,
        visaPar: "M. Seck",
        visaLe: decaler(date, 1),
        validePar: validee ? (montantEstime >= 500_000 ? "Direction des Opérations" : "M. Seck — sous le seuil") : null,
        valideeLe: validee ? decaler(date, 2) : null,
        /* La DA Sage X3 est saisie dès le visa : c'est elle que cite l'état de règlement du métier. */
        numeroDemandeX3: numeroDaX3(date, alea),
        numeroBonCommande: commandee ? `BC${17_000 + Math.round(alea() * 900)}` : null,
        montantEngage,
        dateLivraison,
        dateFacture,
        /* Le coût réel s'écarte parfois du bon : transport, pièce substituée. */
        montantReel: facturee && montantEngage !== null ? (alea() < 0.2 ? Math.round((montantEngage * (0.97 + alea() * 0.06)) / 100) * 100 : montantEngage) : null,
        dateReglement: reglee && dateFacture ? decaler(dateFacture, prestataire?.delaiPaiementJours ?? 30) : null,
        /* La dépense du véhicule est celle de l'intervention citée : une transaction, un numéro. */
        depenseNumero: facturee ? intervention.numero : null,
        commentaireDecision: etape === "refusee" ? "Pièce disponible en stock magasin : demande sans objet." : null,
      });
    }
  }

  /* Les sinistres en cours : remise en état, franchise, expertise. */
  for (const i of listeIncidents().filter((x) => x.sinistreOuvert && x.statut !== "clos").slice(0, 4)) {
    const alea = graine(`achat-inc-${i.numero}`);
    const date = decaler(i.dateHeure.slice(0, 10), 1 + Math.round(alea() * 3));
    ajouter({
      date,
      objet: `Remise en état après sinistre — ${i.immatriculationAffichee}`,
      poste: "maintenance-curative",
      montantEstime: 350_000 + Math.round(alea() * 20) * 50_000,
      ...fournisseurAleatoire(alea),
      urgence: i.roulant === "non" ? "immobilisation" : "urgente",
      origineNumero: i.numero,
      origineLibelle: `Déclaration · ${i.immatriculationAffichee}`,
      vehiculeId: i.vehiculeId,
      immatriculation: i.immatriculation,
      immatriculationAffichee: i.immatriculationAffichee,
      businessUnit: i.businessUnit,
      site: i.site,
      demandeur: "Gestionnaire de parc",
      demandeurRole: "gestionnaire-parc",
      etape: alea() > 0.5 ? "visee" : "soumise",
      visaPar: null,
      visaLe: null,
      validePar: null,
      valideeLe: null,
      ...x3Vide,
      commentaireDecision: null,
      creee: false,
    });
  }

  lignes.sort((a, b) => b.date.localeCompare(a.date));
  for (const l of lignes) l.numero = numeroter(l.date);
  CACHE_ACHATS = lignes;
  return lignes;
}

/** Ce que chaque prestataire a vendu au parc sur douze mois — pour la liste des prestataires. */
export function statistiquesPrestataires(): Record<string, StatistiquesPrestataire> {
  return Object.fromEntries(statistiquesParPrestataire(demandesAchat(), decaler(AUJOURDHUI, -365)));
}

/** Libellé d'option d'une dépense à régler : tout ce qu'il faut pour la reconnaître. */
export function libelleDepense(d: DepenseCaisse): string {
  return `${d.numero} · ${formaterDate(d.date)} · ${d.immatriculationAffichee} · ${d.libelle} — ${formaterMontant(d.montant)}`;
}

/* ============================================================================
 * Caisse & achats — le domaine du module F.
 *
 * Deux objets, une même règle de fond : rien ne sort de la caisse et rien ne
 * s'achète sans citer la transaction d'origine.
 *
 *  - Le **mouvement de caisse** est daté, numéroté CAI, et une sortie
 *    référence obligatoirement la dépense qu'elle règle (règle du métier du
 *    3 septembre 2026). Sans ce lien, la dépense sort de l'analyse par
 *    véhicule et fausse l'arbitrage entre réparer et réformer — c'est le
 *    deuxième choix structurant du projet.
 *  - La **demande d'achat** est numérotée DAC et cite le numéro de la
 *    transaction qui la motive (l'intervention, l'observation de visite, la
 *    déclaration d'incident). Elle franchit un circuit de validation dont les
 *    étapes dépendent du montant, puis **on la suit dans Sage X3** — commandée,
 *    livrée, facturée, réglée — sans rien ressaisir de ce que X3 sait déjà.
 *
 * **L'application ne se substitue pas à Sage X3** (décision du métier du
 * 3 septembre 2026, soir) : tout le processus d'achat — bon de commande,
 * réception, facture, règlement — vit dans X3. Ici, on rattache une demande à
 * un véhicule, une intervention, un incident ; on en connaît le coût ; on sait
 * à quelle étape elle en est. Chaque étape ne porte qu'une date et, au plus,
 * une référence ou un montant.
 *
 * Ce fichier ne porte que les règles ; les données de démonstration sont dans
 * `src/donnees/caisse-demo.ts`. En production : tables `mouvement_caisse` et
 * `demande_achat`, la seconde reliée à la DA et au BC de Sage X3 (lot 3).
 * ==========================================================================*/

import type { Ton } from "./libelles";
import { TYPE_TRANSACTION, typeDuNumero } from "./reference";
import type { Role } from "./roles";
import { trouverRole } from "./roles";
import type { BusinessUnit, PosteDepense } from "./types";

/* -- Journal de caisse ------------------------------------------------------- */

export type SensCaisse = "entree" | "sortie";

export const SENS_CAISSE: Record<SensCaisse, string> = {
  entree: "Approvisionnement",
  sortie: "Sortie",
};

/**
 * Un mouvement du journal de caisse.
 *
 * Le montant est toujours positif : c'est le sens qui donne le signe, comme
 * dans un livre de caisse tenu à la main. Le solde après mouvement se calcule,
 * il ne se saisit jamais.
 */
export interface LigneMouvement {
  numero: string;
  date: string;
  sens: SensCaisse;
  libelle: string;
  montant: number;
  /** À qui l'argent est remis, ou d'où il vient pour un approvisionnement. */
  beneficiaire: string | null;
  /** Référence externe : reçu, bordereau de banque, bon de caisse. */
  piece: string | null;
  justificatif: boolean;
  /** La dépense réglée — obligatoire pour une sortie. */
  depenseNumero: string | null;
  poste: PosteDepense | null;
  vehiculeId: string | null;
  immatriculation: string | null;
  immatriculationAffichee: string | null;
  businessUnit: BusinessUnit | null;
  site: string | null;
  /** Solde de la caisse après ce mouvement — déduit, jamais saisi. */
  soldeApres: number;
  enregistrePar: string;
  /** Créé dans l'application (pas dans le jeu de démonstration). */
  creee: boolean;
}

/**
 * L'état d'un mouvement, tel que le porte le filet de la liste.
 * « Non rattachée » est l'anomalie que la règle interdit : elle reste visible
 * pour être régularisée, jamais masquée.
 */
export type EtatMouvement = "approvisionnement" | "regle" | "sans-justificatif" | "non-rattache";

export function etatMouvement(m: LigneMouvement): EtatMouvement {
  if (m.sens === "entree") return "approvisionnement";
  if (!m.depenseNumero) return "non-rattache";
  if (!m.justificatif) return "sans-justificatif";
  return "regle";
}

export const LIBELLE_ETAT_MOUVEMENT: Record<EtatMouvement, string> = {
  approvisionnement: "Approvisionnement",
  regle: "Réglée et justifiée",
  "sans-justificatif": "Sans justificatif",
  "non-rattache": "Sans dépense rattachée",
};

export const PRECISION_ETAT_MOUVEMENT: Record<EtatMouvement, string> = {
  approvisionnement: "Alimentation de la caisse parc",
  regle: "Dépense rattachée, pièce au dossier",
  "sans-justificatif": "La pièce justificative manque encore",
  "non-rattache": "À régulariser : une sortie cite toujours la dépense qu'elle règle",
};

export const COULEUR_ETAT_MOUVEMENT: Record<EtatMouvement, string> = {
  approvisionnement: "var(--color-accent)",
  regle: "var(--color-attenue-2)",
  "sans-justificatif": "var(--color-vigilance)",
  "non-rattache": "var(--color-defavorable)",
};

export const TON_ETAT_MOUVEMENT: Record<EtatMouvement, Ton> = {
  approvisionnement: "neutre",
  regle: "favorable",
  "sans-justificatif": "vigilance",
  "non-rattache": "defavorable",
};

/** Signe du mouvement dans le solde : une entrée alimente, une sortie décaisse. */
export function effet(m: { sens: SensCaisse; montant: number }): number {
  return m.sens === "entree" ? m.montant : -m.montant;
}

/**
 * Recalcule le solde après chaque mouvement, du plus ancien au plus récent.
 * Le journal est rendu du plus récent au plus ancien : c'est la seule façon de
 * porter un solde juste sur chaque ligne sans le saisir.
 */
export function avecSolde(mouvements: LigneMouvement[], soldeInitial = 0): LigneMouvement[] {
  const chronologique = [...mouvements].sort((a, b) => a.date.localeCompare(b.date) || a.numero.localeCompare(b.numero));
  let solde = soldeInitial;
  /* Sans recopie, on écrirait dans les objets rendus par le serveur : le solde
     est une lecture du journal, il n'appartient pas à la transaction. */
  return chronologique
    .map((m) => {
      solde += effet(m);
      return { ...m, soldeApres: solde };
    })
    .reverse();
}

export function soldeDe(mouvements: LigneMouvement[], soldeInitial = 0): number {
  return mouvements.reduce((s, m) => s + effet(m), soldeInitial);
}

/* -- Demandes d'achat -------------------------------------------------------- */

/**
 * Les étapes du circuit. Chacune est un état atteint, pas une action : la
 * décision fait passer à la suivante, et la trace dit qui l'a prise.
 *
 * Trois premières étapes dans l'application (validation), trois suivantes
 * **constatées** depuis Sage X3 (commandée, livrée, facturée), puis le
 * règlement. Suivre, pas refaire.
 */
export type EtapeAchat = "soumise" | "visee" | "validee" | "commandee" | "livree" | "facturee" | "reglee" | "refusee";

export const ETAPE_ACHAT: Record<EtapeAchat, string> = {
  soumise: "Soumise",
  visee: "Visa parc",
  validee: "Validée",
  commandee: "Commandée",
  livree: "Livrée",
  facturee: "Facturée",
  reglee: "Réglée",
  refusee: "Refusée",
};

export const PRECISION_ETAPE_ACHAT: Record<EtapeAchat, string> = {
  soumise: "En attente du visa du gestionnaire de parc",
  visee: "Visée par le parc",
  validee: "Validée par la direction",
  commandee: "Bon de commande émis dans Sage X3, livraison attendue",
  livree: "Livraison constatée, facture attendue dans Sage X3",
  facturee: "Facture enregistrée dans Sage X3, règlement à venir",
  reglee: "Réglée par la trésorerie — circuit clos",
  refusee: "Refusée, avec motif",
};

export const TON_ETAPE_ACHAT: Record<EtapeAchat, Ton> = {
  soumise: "vigilance",
  visee: "neutre",
  validee: "neutre",
  commandee: "neutre",
  livree: "neutre",
  facturee: "neutre",
  reglee: "favorable",
  refusee: "defavorable",
};

export const COULEUR_ETAPE_ACHAT: Record<EtapeAchat, string> = {
  soumise: "var(--color-defavorable)",
  visee: "var(--color-vigilance)",
  validee: "var(--color-vigilance)",
  commandee: "var(--color-accent)",
  livree: "var(--color-accent)",
  facturee: "var(--color-accent)",
  reglee: "var(--color-attenue-2)",
  refusee: "var(--color-attenue-2)",
};

/** Où en est la demande, en gros : chez nous, dans X3, ou close. */
export type PhaseAchat = "validation" | "x3" | "close";

export const PHASE_ACHAT: Record<PhaseAchat, string> = {
  validation: "En validation",
  x3: "Dans Sage X3",
  close: "Close",
};

export function phaseDe(etape: EtapeAchat): PhaseAchat {
  if (etape === "soumise" || etape === "visee" || etape === "validee") return "validation";
  if (etape === "reglee" || etape === "refusee") return "close";
  return "x3";
}

export type UrgenceAchat = "normale" | "urgente" | "immobilisation";

export const URGENCE_ACHAT: Record<UrgenceAchat, string> = {
  normale: "Normale",
  urgente: "Urgente",
  immobilisation: "Véhicule immobilisé",
};

export const TON_URGENCE: Record<UrgenceAchat, Ton> = {
  normale: "neutre",
  urgente: "vigilance",
  immobilisation: "defavorable",
};

/**
 * Au-delà de ce montant, la direction valide après le visa du parc. En
 * dessous, le visa du parc suffit et les achats commandent. Seuil à porter
 * dans Paramètres avec le barème SQDCM.
 */
export const SEUIL_VALIDATION_DIRECTION = 500_000;

export interface LigneAchat {
  numero: string;
  date: string;
  objet: string;
  poste: PosteDepense;
  montantEstime: number;
  /** Le fournisseur par son numéro PRE — la clé des statistiques par prestataire. */
  prestataireNumero: string | null;
  fournisseur: string | null;
  urgence: UrgenceAchat;
  /** Le numéro de la transaction qui motive la demande — règle du métier. */
  origineNumero: string;
  origineLibelle: string | null;
  origineHref: string | null;
  vehiculeId: string | null;
  immatriculation: string | null;
  immatriculationAffichee: string | null;
  businessUnit: BusinessUnit | null;
  site: string | null;
  demandeur: string;
  /** Le rôle du demandeur : c'est lui qu'on prévient de la décision. */
  demandeurRole: Role;
  etape: EtapeAchat;
  visaPar: string | null;
  visaLe: string | null;
  validePar: string | null;
  valideeLe: string | null;
  /* -- Ce que l'on relève dans Sage X3, une référence ou une date par étape -- */
  /** La demande d'achat saisie dans Sage X3 — « DA200-2601023 ». */
  numeroDemandeX3: string | null;
  /** Le bon de commande émis dans Sage X3 — « BC18767 ». */
  numeroBonCommande: string | null;
  /** Le montant du bon : ce qui est engagé, quand le devis remplace l'estimation. */
  montantEngage: number | null;
  dateLivraison: string | null;
  dateFacture: string | null;
  /** Le montant facturé : le coût réel, celui qui compte pour le véhicule. */
  montantReel: number | null;
  dateReglement: string | null;
  /** La dépense DEP portée par le véhicule pour ce coût, quand elle existe. */
  depenseNumero: string | null;
  commentaireDecision: string | null;
  creee: boolean;
}

/**
 * Le coût d'une demande, au plus juste de ce que l'on sait : facturé, sinon
 * engagé, sinon estimé. C'est ce montant que porte l'analyse par véhicule.
 */
export function coutDe(l: Pick<LigneAchat, "montantEstime" | "montantEngage" | "montantReel">): { montant: number; nature: "reel" | "engage" | "estime" } {
  if (l.montantReel !== null) return { montant: l.montantReel, nature: "reel" };
  if (l.montantEngage !== null) return { montant: l.montantEngage, nature: "engage" };
  return { montant: l.montantEstime, nature: "estime" };
}

export const NATURE_COUT: Record<"reel" | "engage" | "estime", string> = {
  reel: "facturé",
  engage: "engagé",
  estime: "estimé",
};

/** Qui produit chaque étape. En production, la même liste devient une politique RLS. */
export const ROLE_DECIDEUR: Record<EtapeAchat, Role[]> = {
  soumise: ["gestionnaire-parc", "responsable-maintenance", "correspondant-site", "administrateur"],
  visee: ["gestionnaire-parc", "administrateur"],
  validee: ["direction", "administrateur"],
  commandee: ["achats", "administrateur"],
  /* La livraison se constate là où la marchandise arrive. */
  livree: ["gestionnaire-parc", "responsable-maintenance", "responsable-carburant", "correspondant-site", "administrateur"],
  /* La facture et le règlement se lisent dans X3 : ceux qui y ont accès. */
  facturee: ["achats", "controle-de-gestion", "administrateur"],
  reglee: ["controle-de-gestion", "achats", "administrateur"],
  refusee: ["gestionnaire-parc", "direction", "achats", "administrateur"],
};

/**
 * L'étape suivante d'une demande. Une demande sous le seuil saute la
 * validation de la direction : le visa du parc vaut accord, les achats
 * commandent. Nulle quand la demande est arrivée au bout ou refusée.
 */
export function prochaineEtape(l: Pick<LigneAchat, "etape" | "montantEstime">): EtapeAchat | null {
  switch (l.etape) {
    case "soumise":
      return "visee";
    case "visee":
      return l.montantEstime >= SEUIL_VALIDATION_DIRECTION ? "validee" : "commandee";
    case "validee":
      return "commandee";
    case "commandee":
      return "livree";
    case "livree":
      return "facturee";
    case "facturee":
      return "reglee";
    default:
      return null;
  }
}

const ATTENTE: Record<EtapeAchat, string> = {
  soumise: "",
  visee: "Visa du gestionnaire de parc",
  validee: "Validation de la direction",
  commandee: "Commande par les achats (bon Sage X3)",
  livree: "Constat de la livraison",
  facturee: "Facture enregistrée dans Sage X3",
  reglee: "Règlement par la trésorerie",
  refusee: "",
};

/** Ce que la demande attend, en clair, pour la colonne « En attente de ». */
export function attenteDe(l: Pick<LigneAchat, "etape" | "montantEstime">): string {
  const suivante = prochaineEtape(l);
  if (!suivante) return l.etape === "refusee" ? "Close — refusée" : "Rien : réglée, circuit clos";
  return ATTENTE[suivante];
}

const ROLE_ATTENDU: Record<EtapeAchat, Role | null> = {
  soumise: null,
  visee: "gestionnaire-parc",
  validee: "direction",
  commandee: "achats",
  livree: "gestionnaire-parc",
  facturee: "achats",
  reglee: "controle-de-gestion",
  refusee: null,
};

/** Le rôle attendu à l'étape suivante — celui qu'on prévient à la décision. */
export function roleAttendu(l: Pick<LigneAchat, "etape" | "montantEstime">): Role | null {
  const suivante = prochaineEtape(l);
  return suivante ? ROLE_ATTENDU[suivante] : null;
}

export function peutDecider(role: Role | null | undefined, l: Pick<LigneAchat, "etape" | "montantEstime">): boolean {
  const suivante = prochaineEtape(l);
  if (!suivante) return false;
  return ROLE_DECIDEUR[suivante].includes(trouverRole(role).role);
}

/**
 * Le lien vers la transaction citée par une demande, quand son numéro se
 * reconnaît et que le véhicule est connu : citer une référence ne suffit pas,
 * il faut pouvoir l'ouvrir.
 */
export function lienOrigine(numero: string, immatriculation: string | null): string | null {
  const type = typeDuNumero(numero);
  if (!type || !immatriculation) return null;
  const onglet = TYPE_TRANSACTION[type].ongletVehicule;
  if (!onglet) return null;
  return `/flotte/${immatriculation}?onglet=${onglet}&ref=${numero}`;
}

/** Un refus reste possible tant que rien n'est commandé dans X3. */
export function peutRefuser(role: Role | null | undefined, l: Pick<LigneAchat, "etape" | "montantEstime">): boolean {
  if (phaseDe(l.etape) !== "validation") return false;
  return ROLE_DECIDEUR.refusee.includes(trouverRole(role).role);
}

export function estEnCoursAchat(etape: EtapeAchat): boolean {
  return phaseDe(etape) !== "close";
}

/** Le circuit que suivra une demande de ce montant, pour l'annoncer à la saisie. */
export function circuitDe(montant: number): EtapeAchat[] {
  const validation: EtapeAchat[] = montant >= SEUIL_VALIDATION_DIRECTION ? ["soumise", "visee", "validee"] : ["soumise", "visee"];
  return [...validation, "commandee", "livree", "facturee", "reglee"];
}

/**
 * La transaction d'origine porte-t-elle déjà le coût sur la fiche ? Une
 * intervention, un document, un plein ou une dépense sont eux-mêmes des
 * dépenses du véhicule : la demande qui les cite ne doit pas en créer une
 * seconde à la facturation. Une observation ou un incident, non.
 */
export function originePorteLeCout(origineNumero: string): boolean {
  const type = typeDuNumero(origineNumero);
  return type === "intervention" || type === "depense" || type === "document" || type === "plein";
}

/* -- Statistiques par prestataire -------------------------------------------- */

export interface StatistiquesPrestataire {
  /** Demandes commandées ou au-delà : ce qui a vraiment été acheté. */
  demandes: number;
  /** Coût de ces demandes — facturé, sinon engagé. */
  montant: number;
  /** Commandé et pas encore réglé : ce que l'on doit au prestataire. */
  enAttente: number;
  montantEnAttente: number;
  /** Demandes refusées où ce prestataire était pressenti. */
  refusees: number;
  /** Jours moyens entre la facture et le règlement, quand les deux sont connus. */
  delaiReglementJours: number | null;
}

/**
 * Ce que chaque prestataire a vendu au parc depuis une date, lu sur les
 * demandes d'achat. Demande du métier du 3 septembre 2026 : « voir les
 * statistiques par prestataire » — la fiche du prestataire en fait le détail.
 */
export function statistiquesParPrestataire(demandes: LigneAchat[], depuis: string): Map<string, StatistiquesPrestataire> {
  const stats = new Map<string, StatistiquesPrestataire & { delais: number[] }>();
  for (const d of demandes) {
    if (!d.prestataireNumero || d.date < depuis) continue;
    let s = stats.get(d.prestataireNumero);
    if (!s) {
      s = { demandes: 0, montant: 0, enAttente: 0, montantEnAttente: 0, refusees: 0, delaiReglementJours: null, delais: [] };
      stats.set(d.prestataireNumero, s);
    }
    if (d.etape === "refusee") {
      s.refusees += 1;
      continue;
    }
    if (phaseDe(d.etape) === "validation") continue;
    const cout = coutDe(d).montant;
    s.demandes += 1;
    s.montant += cout;
    if (d.etape !== "reglee") {
      s.enAttente += 1;
      s.montantEnAttente += cout;
    }
    if (d.dateFacture && d.dateReglement) s.delais.push(Math.round((Date.parse(d.dateReglement) - Date.parse(d.dateFacture)) / 86_400_000));
  }
  return new Map([...stats].map(([k, { delais, ...s }]) => [k, { ...s, delaiReglementJours: delais.length ? Math.round(delais.reduce((a, b) => a + b, 0) / delais.length) : null }]));
}

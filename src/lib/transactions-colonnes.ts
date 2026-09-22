/* ============================================================================
 * Ce qu'une transaction saisie dans l'application devient en base : la table,
 * et les colonnes que ses valeurs remplissent.
 *
 * Vingt types ont leur table — relevé, plein, dépense, document, incident,
 * affectation, intervention, indisponibilité, sanction (0001), l'ordre de
 * travail (0016), le mouvement de caisse et celui de la cuve (0017), la
 * demande d'achat (0022), la visite technique et son observation (0023), et
 * le transport confié à des tiers (0002) : la ligne de relevé de transport,
 * la ligne de grille, l'affrètement, la mise à disposition, la prestation —
 * et le statut d'un véhicule s'écrit sur sa ligne avec sa trace. Ce qui n'a
 * pas de table reste dans le navigateur, et `tableDe` le dit.
 *
 * Ce module est pur — pas de base, pas de navigateur — pour se vérifier seul
 * et servir la fonction serveur comme les tests.
 * ==========================================================================*/

import { CATEGORIES_PERMIS } from "@/domaine/chauffeur";
import { normaliser, provisoireDepuisVin } from "@/domaine/immatriculation";
import { USAGES_STANDARD, cleNom, idUsage } from "@/domaine/parametres";
import type { TypeTransaction } from "@/domaine/reference";
import { PRODUIT_TRANSPORTE, type ProduitTransporte } from "@/domaine/releve-transport";

export type TableBranchee =
  | "releve_kilometrique"
  | "plein"
  | "depense"
  | "document"
  | "incident"
  | "affectation"
  | "attelage"
  | "intervention"
  | "indisponibilite"
  | "sanction"
  | "ordre_travail"
  | "mouvement_caisse"
  | "mouvement_cuve"
  | "demande_achat"
  | "visite_technique"
  | "observation_visite"
  | "releve_transport"
  | "ligne_tarif"
  | "affretement"
  | "mise_a_disposition"
  | "prestation"
  | "avance_prestataire"
  | "evaluation_prestataire"
  | "enveloppe"
  | "piece"
  | "mouvement_stock"
  | "pneu"
  | "vehicule"
  | "chauffeur"
  | "prestataire"
  | "attributaire"
  | "rappel"
  | "signalement"
  | "tache_service";

const TABLES: Partial<Record<TypeTransaction, TableBranchee>> = {
  releve: "releve_kilometrique",
  plein: "plein",
  depense: "depense",
  document: "document",
  incident: "incident",
  affectation: "affectation",
  attelage: "attelage",
  intervention: "intervention",
  indisponibilite: "indisponibilite",
  sanction: "sanction",
  ordre: "ordre_travail",
  caisse: "mouvement_caisse",
  cuve: "mouvement_cuve",
  achat: "demande_achat",
  visite: "visite_technique",
  observation: "observation_visite",
  transport: "releve_transport",
  tarif: "ligne_tarif",
  affretement: "affretement",
  "mise-a-disposition": "mise_a_disposition",
  prestation: "prestation",
  avance: "avance_prestataire",
  evaluation: "evaluation_prestataire",
  piece: "piece",
  mouvement: "mouvement_stock",
  pneu: "pneu",
  budget: "enveloppe",
  /* La fiche véhicule elle-même : elle se crée et se modifie comme une
     transaction, mais sa clé est son immatriculation, pas un numéro — c'est
     `cleDe` qui le dit à l'écriture. */
  vehicule: "vehicule",
  /* La personne, comme la fiche véhicule : elle se crée et se modifie comme
     une transaction, mais sa clé n'est pas un numéro — c'est `cleDe` qui le dit
     à l'écriture. */
  chauffeur: "chauffeur",
  /* Le prestataire, lui, porte bien un numéro : sa clé est celle de tout le
     monde, et les commandes comme les factures le citent ainsi. */
  prestataire: "prestataire",
  attributaire: "attributaire",
  rappel: "rappel",
  signalement: "signalement",
  tache: "tache_service",
};

/**
 * La colonne qui identifie une ligne, et la valeur à y chercher. Tout se repère
 * par `numero`, sauf le véhicule : sa clé métier est son immatriculation, et la
 * fiche la porte sous la forme « VEH-AA032EA ».
 */
/**
 * Les catégories de permis, du texte saisi vers le tableau que la base attend.
 *
 * ELLE NE DÉCOUPE PLUS LETTRE PAR LETTRE. L'ancienne version balayait le texte
 * à la recherche de A, B, C, D ou E : un permis réel portant « A1 B » entrait
 * donc « A, B », et « C1E » entrait « C, E ». Trois catégories sénégalaises sur
 * dix étaient impossibles à enregistrer, et deux autres se transformaient en
 * silence (corrigé le 15 septembre 2026, sur une carte montrée par le métier).
 *
 * On lit maintenant des **jetons entiers** — ce que les cases à cocher posent,
 * et ce qu'un ancien texte libre donne aussi une fois découpé sur ses
 * séparateurs. Un jeton hors de la liste n'est pas jeté : il est gardé tel quel.
 * Trente-six chauffeurs portent un « E » seul venu de l'ancien modèle, et
 * choisir à leur place entre BE, C1E, CE et DE serait inventer.
 */
export function categoriesPermis(brut: unknown): string[] {
  const jetons = Array.isArray(brut)
    ? brut.map((x) => String(x).trim().toUpperCase())
    : typeof brut === "string"
      ? brut.toUpperCase().split(/[^A-Z0-9]+/)
      : [];
  const vues = new Set(jetons.filter(Boolean));
  const connues = CATEGORIES_PERMIS.filter((c) => vues.has(c));
  /*
   * Ce que la carte ne connaît pas est écarté — sauf les cinq lettres seules de
   * l'ancien modèle, que trente-six chauffeurs portent en base. Les garder,
   * c'est refuser d'effacer ce qu'on n'a pas su lire ; s'arrêter là, c'est
   * refuser d'entrer « ET » ou « PERMIS » parce qu'un texte libre les contenait.
   */
  const HERITAGE = new Set(["A", "B", "C", "D", "E"]);
  const heritees = [...vues].filter((x) => HERITAGE.has(x) && !CATEGORIES_PERMIS.includes(x as (typeof CATEGORIES_PERMIS)[number]));
  return [...connues, ...heritees];
}

/**
 * « Personne — retirer le chauffeur », dans le champ Chauffeur d'une affectation.
 *
 * Une valeur choisie, et non un champ laissé vide : c'est ce qui distingue le
 * geste voulu de l'étourderie, et cela permet au champ de rester obligatoire.
 * Elle vit ici parce que les deux rives la lisent — le formulaire qui la
 * propose, l'écriture qui la reconnaît — et qu'un module de saisie du
 * navigateur n'a pas sa place dans une action de serveur.
 */
export const RETRAIT_CHAUFFEUR = "retirer";

export function cleDe(type: TypeTransaction, numero: string): { colonne: string; valeur: string } {
  if (type === "vehicule") return { colonne: "immatriculation", valeur: immatriculationCanonique(numero.replace(/^VEH-/i, "")) };
  /* Le chauffeur se repère par son identifiant de table. La fiche le nomme
     « CHA-babacar-ndiaye » : c'est son adresse lisible, pas sa clé. L'écriture
     la traduit — elle seule a la base sous la main. */
  if (type === "chauffeur") return { colonne: "id", valeur: numero.replace(/^CHA-/i, "") };
  /* L'attributaire porte l'identifiant de sa table : sa fiche le connaît, il
     n'y a rien à traduire. */
  if (type === "attributaire") return { colonne: "id", valeur: numero.replace(/^ATB-/i, "") };
  return { colonne: "numero", valeur: numero };
}

/** La table d'un type ; nulle tant qu'il n'en a pas. Le statut est à part : il s'écrit sur le véhicule. */
export function tableDe(type: TypeTransaction): TableBranchee | null {
  return TABLES[type] ?? null;
}

/** Les identifiants résolus par le serveur avant l'écriture. */
export interface Rattachement {
  vehiculeId: string | null;
  chauffeurId: string | null;
  prestataireId: string | null;
  /** Le camion du référentiel tiers, par sa plaque canonique — nul quand la plaque n'y est pas : elle reste alors libre. */
  camionTiers?: string | null;
  /** L'affrètement que cite une ligne de relevé, résolu par son numéro. */
  affretementId?: string | null;
  /** La pièce de rechange qu'un mouvement ou un pneu cite, résolue par son numéro. */
  pieceId?: string | null;
  /** Le site, résolu ou créé par le serveur : la saisie peut porter un nom plutôt qu'un identifiant. */
  siteId?: string | null;
  /**
   * L'autre moitié d'un attelage : le seul cas où une transaction lie **deux**
   * véhicules. `vehiculeId` reste celui de la fiche d'où l'on saisit.
   */
  autreVehiculeId?: string | null;
}

/**
 * Le produit transporté, tel que la base le nomme. L'écran laisse le champ
 * libre et pré-remplit « Aliment volaille » : on reconnaît le libellé comme la
 * clé, sans accent ni casse, et l'aliment reste le produit par défaut — c'est
 * lui que le parc porte neuf fois sur dix.
 */
export function produitDepuis(brut: unknown): ProduitTransporte {
  const t = texte(brut);
  if (!t) return "aliment";
  const simple = (x: string) =>
    x
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const cherche = simple(t);
  for (const [cle, d] of Object.entries(PRODUIT_TRANSPORTE)) {
    if (simple(cle) === cherche || simple(d.libelle) === cherche) return cle as ProduitTransporte;
  }
  return "aliment";
}

const texte = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
/**
 * Les colonnes du service de maintenance (0060), écrites seulement quand la
 * saisie les porte : un ordre créé par l'ancien chemin reste un ordre, et
 * s'écrit même sur une base qui n'a pas joué 0060.
 */
function colonnesDuService(v: Record<string, unknown>): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if (v.priorite !== undefined) c.priorite = texte(v.priorite) ?? "planifie";
  if (v.dateFin !== undefined) c.date_fin = texte(v.dateFin);
  if (v.kilometrage !== undefined) c.kilometrage = nombre(v.kilometrage);
  if (v.numeroFacture !== undefined) c.numero_facture = texte(v.numeroFacture);
  if (v.lignes !== undefined) c.lignes = jsonDe(v.lignes);
  if (v.remiseMode !== undefined) c.remise_mode = texte(v.remiseMode) ?? "montant";
  if (v.remiseValeur !== undefined) c.remise_valeur = nombre(v.remiseValeur) ?? 0;
  if (v.mainOeuvreGlobale !== undefined) c.main_oeuvre_globale = nombre(v.mainOeuvreGlobale) ?? 0;
  if (v.tvaTaux !== undefined) c.tva_taux = nombre(v.tvaTaux) ?? 0;
  if (v.brsTaux !== undefined) c.brs_taux = nombre(v.brsTaux) ?? 0;
  if (v.pieces !== undefined) c.pieces = tableauDe(v.pieces);
  if (v.signalements !== undefined) c.signalements = tableauDe(v.signalements);
  /* Le règlement (0063) : écrit seulement quand il est dit, pour qu'une base sans 0063 prenne encore les services. */
  if (texte(v.modeReglement)) c.mode_reglement = texte(v.modeReglement);
  if (texte(v.numeroBc)) c.numero_bc = texte(v.numeroBc);
  if (tableauDe(v.piecesReglement)?.length) c.pieces_reglement = tableauDe(v.piecesReglement);
  return c;
}

/** Un tableau de chaînes, d'un tableau ou d'une chaîne JSON — la forme d'une saisie. */
function tableauDe(v: unknown): string[] {
  let brut = v;
  if (typeof v === "string") {
    if (!v.trim()) return [];
    try {
      brut = JSON.parse(v);
    } catch {
      return v.split(/\s*[·,]\s*/).filter(Boolean);
    }
  }
  return Array.isArray(brut) ? brut.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
}

/** Une valeur JSON, d'un objet ou d'une chaîne : les lignes d'un service. */
function jsonDe(v: unknown): unknown {
  if (typeof v !== "string") return v ?? [];
  try {
    return JSON.parse(v);
  } catch {
    return [];
  }
}

/** La catégorie Fleetio d'un système : le chiffre des dizaines — 013 Freins en 1, Châssis ; 111 en 1, 999 en 9. */
function categorieDuSysteme(systeme: string | null): string | null {
  if (!systeme || !/^\d{3}$/.test(systeme)) return null;
  return systeme === "111" ? "1" : systeme === "999" ? "9" : systeme[1]!;
}

/* Les pièces d'une déclaration (0058) : la colonne n'est écrite que s'il y en a,
   pour qu'une déclaration sans pièce passe même sur une base qui n'a pas joué 0058. */
const piecesDe = (v: unknown): { pieces?: string[] } => {
  const refs = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  return refs.length ? { pieces: refs } : {};
};
const nombre = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const booleen = (v: unknown): boolean => v === true || v === "oui" || v === "true";
const entier = (v: unknown): number | null => {
  const n = nombre(v);
  return n === null ? null : Math.round(n);
};

/* La catégorie d'un véhicule se saisit en un champ et s'écrit en deux colonnes :
   la **famille** (`categorie`, l'énumération du socle) décide des règles —
   documents, plafond kilométrique, entretien, silhouette —, et la catégorie
   ajoutée par le métier dans Paramètres (`categorie_metier`, « cat-… ») ne fait
   que la nommer plus précisément. L'écran connaît la famille de ce qu'il
   propose et la joint sous `categorieFamille` ; sans elle, une catégorie
   métier ne peut pas être classée, et on refuse plutôt que de deviner. */
const categorieMetierSaisie = (v: Record<string, unknown>): string | null => {
  const c = texte(v.categorie);
  return c && c.startsWith("cat-") ? c : (texte(v.categorieMetier) ?? null);
};
const familleSaisie = (v: Record<string, unknown>): string | null => {
  const c = texte(v.categorie);
  if (c && !c.startsWith("cat-")) return c;
  return texte(v.categorieFamille);
};

/**
 * L'usage du véhicule, scindé en deux comme la catégorie (0051).
 *
 * `usage` est une énumération : un usage ajouté par le métier n'y entre pas. Il
 * se range dans `usage_metier` — « usa-… » — et l'énumération reçoit « autre ».
 * Contrairement à la catégorie, aucune règle ne s'y branche : il n'y a donc pas
 * de famille à demander, et personne à interroger sur une question sans
 * conséquence.
 */
/** L'usage livré qui porte ce libellé, ou cet identifiant ; nul pour un usage du métier. */
const usageLivre = (saisi: string): string | null => {
  const cle = cleNom(saisi);
  return USAGES_STANDARD.find((u) => u.id === saisi || cleNom(u.libelle) === cle)?.id ?? null;
};
/**
 * Ce qu'une saisie d'usage donne aux deux colonnes.
 *
 * Le champ porte un **libellé** — « Frigorifique », « Bétaillère » — parce que
 * c'est ce qu'on lit et ce qu'on écrit. La colonne `usage`, elle, est une
 * énumération en minuscules. Sans ce découpage, modifier l'usage d'un véhicule
 * envoyait « Frigorifique » dans l'énumération et Postgres refusait — y compris
 * pour un usage parfaitement ordinaire, choisi dans la liste.
 */
export function scinderUsage(saisi: string): { usage: string; usage_metier: string | null } {
  const livre = usageLivre(saisi);
  if (livre) return { usage: livre, usage_metier: null };
  if (saisi.startsWith("usa-")) return { usage: "autre", usage_metier: saisi };
  return { usage: "autre", usage_metier: idUsage(saisi) };
}

const usageSaisi = (v: Record<string, unknown>): string => {
  const u = texte(v.usage);
  return u ? (usageLivre(u) ?? "autre") : "autre";
};
const usageMetierSaisie = (v: Record<string, unknown>): string | null => {
  const u = texte(v.usage);
  if (!u) return texte(v.usageMetier) ?? null;
  if (u.startsWith("usa-")) return u;
  return usageLivre(u) ? null : idUsage(u);
};

/** « 2026-09-02T08:00 » ou « 2026-09-02 » → un horodatage complet, en UTC comme tout le jeu de données. */
export function horodatage(brut: unknown): string | null {
  const t = texte(brut);
  if (!t) return null;
  if (t.length <= 10) return `${t}T08:00:00.000Z`;
  if (/Z$|[+-]\d\d:\d\d$/.test(t)) return t;
  return `${t.length === 16 ? `${t}:00` : t}.000Z`;
}

/**
 * La ligne à insérer pour une création. Nulle quand une valeur obligatoire
 * manque — le motif dit laquelle, pour que l'écran puisse le montrer.
 */
export function ligneCreation(type: TypeTransaction, numero: string, valeurs: Record<string, unknown>, r: Rattachement): { ligne: Record<string, unknown> } | { refus: string } {
  const v = valeurs;
  switch (type) {
    case "releve": {
      const km = nombre(v.valeur);
      if (!r.vehiculeId) return { refus: "relevé sans véhicule" };
      if (km === null) return { refus: "relevé sans compteur" };
      return { ligne: { numero, vehicule_id: r.vehiculeId, date: texte(v.date), km: Math.round(km), origine: "saisie" } };
    }
    case "plein": {
      const litres = nombre(v.litres);
      const montant = nombre(v.montant);
      if (!r.vehiculeId) return { refus: "plein sans véhicule" };
      if (!litres || litres <= 0 || montant === null) return { refus: "plein sans litres ou sans montant" };
      const prixLitre = nombre(v.prixLitre) ?? Math.round(montant / litres);
      return { ligne: { numero, vehicule_id: r.vehiculeId, chauffeur_id: r.chauffeurId, prestataire_id: r.prestataireId, date: texte(v.date), litres, prix_litre: Math.max(1, Math.round(prixLitre)), montant: Math.round(montant), km: nombre(v.km), plein_complet: true, source: texte(v.source) ?? "station", reference: texte(v.reference), photo: texte(v.photo) } };
    }
    case "depense": {
      const montant = nombre(v.montant);
      const libelle = texte(v.libelle);
      if (montant === null || !libelle) return { refus: "dépense sans montant ou sans libellé" };
      if (!r.vehiculeId && !texte(v.beneficiaire)) return { refus: "dépense sans véhicule ni bénéficiaire" };
      return { ligne: { numero, vehicule_id: r.vehiculeId, chauffeur_id: r.chauffeurId, prestataire_id: r.prestataireId, date: texte(v.date), poste: texte(v.poste) ?? "divers", libelle, montant: Math.round(montant), beneficiaire: texte(v.beneficiaire), reference: texte(v.reference), origine: texte(v.origine) ?? "caisse", justificatif: booleen(v.justificatif) || Boolean(texte(v.photo)), km: nombre(v.km), photo: texte(v.photo), ...(texte(v.numeroBc) ? { numero_bc: texte(v.numeroBc), fichier_bc: texte(v.fichierBc) } : {}) } };
    }
    case "document": {
      const typeDoc = texte(v.type);
      if (!typeDoc) return { refus: "document sans type" };
      if (!r.vehiculeId && !r.chauffeurId) return { refus: "document sans porteur" };
      /* Le fichier joint vaut justificatif : on ne coche pas « fourni » à côté
         d'une pièce qu'on vient d'attacher. */
      const fichier = texte(v.fichier);
      return { ligne: { numero, type_document_id: typeDoc, vehicule_id: r.vehiculeId, chauffeur_id: r.vehiculeId ? null : r.chauffeurId, date_effet: texte(v.dateEffet), echeance: texte(v.echeance), emetteur: texte(v.emetteur), numero_piece: texte(v.numeroPiece), montant: nombre(v.montant), fichier, justificatif: booleen(v.justificatif) || Boolean(fichier) } };
    }
    case "incident": {
      const dateHeure = horodatage(v.dateHeure);
      if (!r.vehiculeId) return { refus: "incident sans véhicule" };
      if (!dateHeure) return { refus: "incident sans date" };
      const roulant = texte(v.roulant);
      const description = [texte(v.description), roulant === "non" ? "Véhicule non roulant." : roulant === "reserve" ? "Véhicule roulant avec réserve." : null].filter(Boolean).join(" ") || null;
      return { ligne: { numero, vehicule_id: r.vehiculeId, chauffeur_id: r.chauffeurId, date_heure: dateHeure, nature: texte(v.nature) ?? "incident", type: texte(v.type) ?? "autre", lieu: texte(v.lieu), mission: texte(v.mission), responsabilite: texte(v.responsabilite), statut: texte(v.statut) ?? "declare", kilometrage: nombre(v.kilometrage), description, ...piecesDe(v.pieces) } };
    }
    case "affectation": {
      if (!r.vehiculeId || !r.chauffeurId) return { refus: "affectation sans véhicule ou sans chauffeur" };
      return { ligne: { numero, vehicule_id: r.vehiculeId, chauffeur_id: r.chauffeurId, role: texte(v.role) ?? "titulaire", debut: texte(v.debut), fin: texte(v.fin), motif: texte(v.motif) ?? "Saisie dans l'application" } };
    }
    case "attelage": {
      /* Le seul lien entre deux véhicules du référentiel. Le rôle vient de la
         fiche d'où l'on saisit : une semi-remorque attelle un tracteur, un
         tracteur attelle une semi — la base ne devine pas lequel est lequel. */
      if (!r.vehiculeId || !r.autreVehiculeId) return { refus: "attelage sans les deux véhicules" };
      if (r.vehiculeId === r.autreVehiculeId) return { refus: "un véhicule ne se remorque pas lui-même" };
      const remorqueIci = texte(v.role) === "remorque";
      return {
        ligne: {
          numero,
          tracteur_id: remorqueIci ? r.autreVehiculeId : r.vehiculeId,
          remorque_id: remorqueIci ? r.vehiculeId : r.autreVehiculeId,
          debut: texte(v.debut),
          fin: texte(v.fin),
          permanent: booleen(v.permanent),
          motif: texte(v.motif),
        },
      };
    }
    case "intervention": {
      if (!r.vehiculeId) return { refus: "intervention sans véhicule" };
      if (!texte(v.objet)) return { refus: "intervention sans objet" };
      return { ligne: { numero, vehicule_id: r.vehiculeId, prestataire_id: r.prestataireId, date: texte(v.date), type: texte(v.type) ?? "curatif", objet: texte(v.objet), montant: Math.round(nombre(v.montant) ?? 0), immobilisation_jours: nombre(v.immobilisationJours) === null ? null : Math.round(nombre(v.immobilisationJours) ?? 0), km: nombre(v.km), reference: texte(v.reference) } };
    }
    case "indisponibilite": {
      if (!r.chauffeurId) return { refus: "indisponibilité sans chauffeur" };
      return { ligne: { numero, chauffeur_id: r.chauffeurId, motif: texte(v.motif) ?? "autre", debut: texte(v.debut), fin: texte(v.fin), commentaire: texte(v.commentaire) } };
    }
    case "ordre": {
      if (!r.vehiculeId) return { refus: "ordre de travail sans véhicule" };
      if (!texte(v.objet)) return { refus: "ordre de travail sans objet" };
      return { ligne: { numero, vehicule_id: r.vehiculeId, type: texte(v.type) ?? "curatif", objet: texte(v.objet), origine_numero: texte(v.origineNumero), origine_libelle: texte(v.origineLibelle), prestataire_id: r.prestataireId, garage: texte(v.garage) ?? "—", date_prevue: texte(v.datePrevue), immobilisation_prevue_jours: nombre(v.immobilisationPrevueJours), montant_estime: nombre(v.montantEstime), statut: texte(v.statut) ?? "planifie", date_debut: texte(v.dateDebut), date_cloture: texte(v.dateCloture), intervention_numero: texte(v.interventionNumero), commentaire: texte(v.commentaire), demandeur_nom: texte(v.demandeur), ...colonnesDuService(v) } };
    }
    case "signalement": {
      if (!r.vehiculeId) return { refus: "signalement sans véhicule" };
      if (!texte(v.description)) return { refus: "signalement sans description" };
      return {
        ligne: {
          numero,
          vehicule_id: r.vehiculeId,
          date: texte(v.date),
          priorite: texte(v.priorite) ?? "normale",
          systeme: texte(v.systeme),
          description: texte(v.description),
          details: texte(v.details),
          kilometrage: nombre(v.kilometrage),
          statut: texte(v.statut) ?? "ouvert",
          declarant: texte(v.declarant),
          ...piecesDe(v.pieces),
        },
      };
    }
    case "tache": {
      const libelle = texte(v.libelle);
      if (!libelle) return { refus: "tâche sans libellé" };
      const systeme = texte(v.systeme);
      return {
        ligne: {
          numero,
          libelle,
          description: texte(v.description),
          systeme,
          categorie: categorieDuSysteme(systeme),
          ensemble: texte(v.ensemble),
          type_defaut: texte(v.typeDefaut),
          actif: v.actif === undefined ? true : booleen(v.actif),
          source: "saisie",
        },
      };
    }
    case "caisse": {
      /* Une sortie cite la dépense qu'elle règle ; sans dépense, c'est un approvisionnement. */
      const montant = nombre(v.montant);
      const depenseNumero = texte(v.depenseNumero);
      if (!montant || montant <= 0) return { refus: "mouvement de caisse sans montant" };
      if (!texte(v.libelle)) return { refus: "mouvement de caisse sans libellé" };
      return { ligne: { numero, date: texte(v.date), sens: depenseNumero ? "sortie" : (texte(v.sens) ?? "entree"), libelle: texte(v.libelle), montant: Math.round(montant), beneficiaire: texte(v.beneficiaire), piece: texte(v.piece), justificatif: booleen(v.justificatif), depense_numero: depenseNumero, enregistre_par: texte(v.enregistrePar), ...(texte(v.objetReglement) ? { objet_reglement: texte(v.objetReglement) } : {}) } };
    }
    case "cuve": {
      /* Une livraison porte un libellé ; un relevé de jauge n'en a pas, il dit ce que la cuve contient. */
      const litres = nombre(v.litres);
      const prixLitre = nombre(v.prixLitre);
      if (litres === null || litres < 0) return { refus: "mouvement de cuve sans litres" };
      const livraison = Boolean(texte(v.libelle));
      const montant = nombre(v.montant) ?? (prixLitre !== null ? Math.round(litres * prixLitre) : null);
      return { ligne: { numero, date: texte(v.date), sens: livraison ? "livraison" : "jauge", libelle: texte(v.libelle) ?? "Relevé de jauge", litres: Math.round(litres * 10) / 10, prix_litre: livraison && prixLitre !== null ? Math.round(prixLitre) : null, montant: livraison && montant !== null ? Math.round(montant) : null, fournisseur: livraison ? texte(v.fournisseur) : null, prestataire_id: livraison ? r.prestataireId : null, piece: texte(v.piece), commentaire: texte(v.commentaire), enregistre_par: texte(v.enregistrePar) } };
    }
    case "achat": {
      /* Une demande cite toujours ce qui la motive : c'est la règle du métier, pas une convention. */
      const montantEstime = nombre(v.montantEstime);
      if (!texte(v.objet)) return { refus: "demande d'achat sans objet" };
      if (montantEstime === null || montantEstime < 0) return { refus: "demande d'achat sans montant estimé" };
      if (!texte(v.origineNumero)) return { refus: "demande d'achat sans transaction d'origine" };
      return { ligne: { numero, date: texte(v.date), objet: texte(v.objet), poste: texte(v.poste) ?? "divers", montant_estime: Math.round(montantEstime), prestataire_id: r.prestataireId, fournisseur: texte(v.fournisseur), urgence: texte(v.urgence) ?? "normale", origine_numero: texte(v.origineNumero), origine_libelle: texte(v.origineLibelle), vehicule_id: r.vehiculeId, demandeur_nom: texte(v.demandeur), demandeur_role: texte(v.demandeurRole), etape: texte(v.etape) ?? "soumise", commentaire_decision: texte(v.commentaireDecision) } };
    }
    case "visite": {
      if (!r.vehiculeId) return { refus: "visite technique sans véhicule" };
      if (!texte(v.centre)) return { refus: "visite technique sans centre" };
      const rendezVous = texte(v.dateRendezVous) ?? texte(v.date);
      if (!rendezVous) return { refus: "visite technique sans date de rendez-vous" };
      return { ligne: { numero, vehicule_id: r.vehiculeId, type: texte(v.type) ?? "visite", centre: texte(v.centre), date_rendez_vous: rendezVous, heure: texte(v.heure), date_passage: texte(v.datePassage), statut: texte(v.statut) ?? "rendez-vous", numero_pv: texte(v.numeroPv), date_limite_contre_visite: texte(v.dateLimiteContreVisite), commentaire: texte(v.commentaire) } };
    }
    case "observation": {
      /* L'observation cite la visite qui l'a produite, par son numéro. */
      if (!r.vehiculeId) return { refus: "observation sans véhicule" };
      if (!texte(v.visiteId)) return { refus: "observation sans visite technique" };
      if (!texte(v.libelle)) return { refus: "observation sans libellé" };
      return { ligne: { numero, visite_numero: texte(v.visiteId), vehicule_id: r.vehiculeId, libelle: texte(v.libelle), categorie: texte(v.categorie) ?? "autre", gravite: texte(v.gravite) ?? "mineure", statut: texte(v.statut) ?? "a-traiter", intervention_numero: texte(v.interventionNumero), corrigee_le: texte(v.corrigeeLe), commentaire: texte(v.commentaire) } };
    }
    case "transport": {
      /* Une ligne du relevé : un chargement parti un jour donné. Le mode dit
         qui a transporté — le transporteur du référentiel quand la fiche le
         porte, le parc quand un véhicule est cité, un ponctuel sinon. */
      const tonnage = nombre(v.tonnage);
      const date = texte(v.date);
      if (!date) return { refus: "livraison sans date" };
      if (!texte(v.destination)) return { refus: "livraison sans destination" };
      if (tonnage === null || tonnage < 0) return { refus: "livraison sans tonnage" };
      const camionTiers = r.camionTiers ?? null;
      const mode = texte(v.mode) ?? (r.prestataireId ? "transporteur" : r.vehiculeId ? "parc" : "prestataire-ponctuel");
      if (mode === "transporteur" && !r.prestataireId) return { refus: "livraison sans transporteur" };
      if (mode === "parc" && !r.vehiculeId) return { refus: "livraison du parc sans véhicule" };
      const plaqueLibre = texte(v.immatriculationLibre) ?? texte(v.camion) ?? texte(v.immatriculation);
      return {
        ligne: {
          numero,
          date,
          mode,
          prestataire_id: r.prestataireId,
          vehicule_id: mode === "parc" ? r.vehiculeId : null,
          camion_tiers_immatriculation: camionTiers,
          immatriculation_libre: camionTiers ? null : plaqueLibre,
          chauffeur: texte(v.chauffeur) ?? texte(v.chauffeurLibre),
          origine: texte(v.origine) ?? "UAB",
          destination: texte(v.destination),
          produit: produitDepuis(v.produit),
          tonnage: Math.round(tonnage * 100) / 100,
          tonnage_pese: nombre(v.tonnagePese) === null ? null : Math.round(nombre(v.tonnagePese)! * 100) / 100,
          bon_livraison: texte(v.bonLivraison),
          affretement_id: r.affretementId ?? null,
        },
      };
    }
    case "tarif": {
      /* Une ligne de grille — le plus souvent une exception promue en règle.
         Le prix est net ; il vaut pour toute catégorie de porteur. */
      const prix = nombre(v.prix);
      if (!r.prestataireId) return { refus: "ligne de tarif sans transporteur" };
      if (!texte(v.origine) || !texte(v.destination)) return { refus: "ligne de tarif sans trajet" };
      if (prix === null || prix < 0) return { refus: "ligne de tarif sans prix" };
      const minimum = nombre(v.minimum);
      return {
        ligne: {
          numero,
          prestataire_id: r.prestataireId,
          origine: texte(v.origine),
          destination: texte(v.destination),
          categorie: texte(v.categorie),
          unite: texte(v.unite) ?? "tonne",
          prix: Math.round(prix),
          minimum: minimum === null ? null : Math.round(minimum),
          debut: texte(v.debut) ?? texte(v.date),
          fin: texte(v.fin),
          source: texte(v.source) ?? "accord-verbal",
          commentaire: texte(v.commentaire),
        },
      };
    }
    case "affretement": {
      /* La mission confiée à un tiers. L'exception tarifaire porte son motif,
         ou elle n'existe pas : c'est la règle de la base, on la dit avant elle. */
      const tonnagePrevu = nombre(v.tonnagePrevu) ?? nombre(v.tonnage);
      if (!r.prestataireId) return { refus: "affrètement sans transporteur" };
      if (!texte(v.date)) return { refus: "affrètement sans date" };
      if (!texte(v.origine) || !texte(v.destination)) return { refus: "affrètement sans trajet" };
      if (tonnagePrevu === null || tonnagePrevu < 0) return { refus: "affrètement sans tonnage prévu" };
      if (!texte(v.motif)) return { refus: "affrètement sans motif" };
      if (!texte(v.demandeur)) return { refus: "affrètement sans demandeur" };
      const prixExceptionnel = nombre(v.prixExceptionnel);
      const complement = nombre(v.complementTarif);
      if ((prixExceptionnel !== null || complement !== null) && !texte(v.motifTarif)) return { refus: "exception tarifaire sans motif" };
      const tonnageLivre = nombre(v.tonnageLivre);
      const montantFacture = nombre(v.montantFacture);
      return {
        ligne: {
          numero,
          date: texte(v.date),
          prestataire_id: r.prestataireId,
          origine: texte(v.origine),
          destination: texte(v.destination),
          business_unit: texte(v.businessUnit),
          categorie_demandee: texte(v.categorieDemandee) ?? "camion",
          immatriculation_externe: r.camionTiers ?? null,
          chauffeur_externe: texte(v.chauffeurExterne) ?? texte(v.chauffeur),
          tonnage_prevu: Math.round(tonnagePrevu * 100) / 100,
          tonnage_livre: tonnageLivre === null ? null : Math.round(tonnageLivre * 100) / 100,
          distance_km: Math.round(nombre(v.distanceKm) ?? 0),
          motif: texte(v.motif),
          vehicule_remplace_id: r.vehiculeId,
          statut: texte(v.statut) ?? "demande",
          montant_convenu: Math.round(nombre(v.montantConvenu) ?? 0),
          montant_facture: montantFacture === null ? null : Math.round(montantFacture),
          prix_exceptionnel: prixExceptionnel === null ? null : Math.round(prixExceptionnel),
          complement_tarif: complement === null ? null : Math.round(complement),
          motif_tarif: texte(v.motifTarif),
          date_livraison: texte(v.dateLivraison),
          date_facture: texte(v.dateFacture),
          date_reglement: texte(v.dateReglement),
          reference_facture: texte(v.referenceFacture),
          numero_demande_x3: texte(v.numeroDemandeX3),
          numero_bon_commande: texte(v.numeroBonCommande),
          demandeur: texte(v.demandeur),
          commentaire: texte(v.commentaire),
        },
      };
    }
    case "mise-a-disposition": {
      /* Un mois de camion tiers. Le camion est celui du référentiel, ou ce
         n'est pas une mise à disposition : on ne loue pas une plaque inconnue. */
      const prixJour = nombre(v.prixJour);
      const joursCalendaires = nombre(v.joursCalendaires);
      const mois = texte(v.mois) ?? texte(v.date)?.slice(0, 7) ?? null;
      if (!r.prestataireId) return { refus: "mise à disposition sans transporteur" };
      if (!mois || !/^\d{4}-\d{2}$/.test(mois)) return { refus: "mise à disposition sans mois" };
      if (!r.camionTiers) return { refus: "mise à disposition sans camion du référentiel" };
      if (!texte(v.famille)) return { refus: "mise à disposition sans famille de produit" };
      if (joursCalendaires === null || joursCalendaires < 1 || joursCalendaires > 31) return { refus: "mise à disposition sans jours calendaires" };
      if (prixJour === null || prixJour < 0) return { refus: "mise à disposition sans prix journalier" };
      const roules = nombre(v.joursRoules);
      const km = nombre(v.kmParcourus);
      const tonnes = nombre(v.tonnesTransportees);
      const montantFacture = nombre(v.montantFacture);
      return {
        ligne: {
          numero,
          mois,
          prestataire_id: r.prestataireId,
          immatriculation: r.camionTiers,
          famille: texte(v.famille),
          jours_calendaires: Math.round(joursCalendaires),
          jours_panne: Math.max(0, Math.round(nombre(v.joursPanne) ?? 0)),
          jours_roules: roules === null ? null : Math.max(0, Math.round(roules)),
          prix_jour: Math.round(prixJour),
          convention: texte(v.convention) ?? "inconnue",
          carburant_litres: Math.round((nombre(v.carburantLitres) ?? 0) * 100) / 100,
          carburant_montant: Math.round(nombre(v.carburantMontant) ?? 0),
          km_parcourus: km === null ? null : Math.round(km),
          tonnes_transportees: tonnes === null ? null : Math.round(tonnes * 100) / 100,
          statut: texte(v.statut) ?? "confirme",
          montant_facture: montantFacture === null ? null : Math.round(montantFacture),
          date_facture: texte(v.dateFacture),
          date_reglement: texte(v.dateReglement),
          reference_facture: texte(v.referenceFacture),
          numero_demande_x3: texte(v.numeroDemandeX3),
          commentaire: texte(v.commentaire),
        },
      };
    }
    case "prestation": {
      /* Ce que le parc achète en transport hors grille : une quantité, un prix unitaire, une convention. */
      const quantite = nombre(v.quantite);
      const prixUnitaire = nombre(v.prixUnitaire);
      if (!r.prestataireId) return { refus: "prestation sans transporteur" };
      if (!texte(v.date)) return { refus: "prestation sans date" };
      if (!texte(v.libelle)) return { refus: "prestation sans libellé" };
      if (!texte(v.unite)) return { refus: "prestation sans unité" };
      if (quantite === null || quantite < 0) return { refus: "prestation sans quantité" };
      if (prixUnitaire === null || prixUnitaire < 0) return { refus: "prestation sans prix unitaire" };
      const montantFacture = nombre(v.montantFacture);
      return {
        ligne: {
          numero,
          date: texte(v.date),
          prestataire_id: r.prestataireId,
          libelle: texte(v.libelle),
          business_unit: texte(v.businessUnit),
          unite: texte(v.unite),
          quantite: Math.round(quantite * 100) / 100,
          prix_unitaire: Math.round(prixUnitaire),
          convention: texte(v.convention) ?? "inconnue",
          statut: texte(v.statut) ?? "confirme",
          montant_facture: montantFacture === null ? null : Math.round(montantFacture),
          date_facture: texte(v.dateFacture),
          date_reglement: texte(v.dateReglement),
          reference_facture: texte(v.referenceFacture),
          numero_demande_x3: texte(v.numeroDemandeX3),
          commentaire: texte(v.commentaire),
        },
      };
    }
    case "budget": {
      /* Une enveloppe : un montant pour un poste, une business unit (ou tout le
         parc) et un exercice, avec la base qui la justifie — c'est la phrase
         qui se discute en comité, pas le chiffre. */
      const montant = nombre(v.montant);
      const exercice = texte(v.exercice) ?? texte(v.date)?.slice(0, 4) ?? null;
      if (!exercice || !/^\d{4}$/.test(exercice)) return { refus: "enveloppe sans exercice" };
      if (!texte(v.poste)) return { refus: "enveloppe sans poste" };
      if (montant === null || montant < 0) return { refus: "enveloppe sans montant" };
      if (!texte(v.base)) return { refus: "enveloppe sans base" };
      return { ligne: { numero, exercice, poste: texte(v.poste), business_unit: texte(v.businessUnit), montant: Math.round(montant), profil: null, base: texte(v.base), commentaire: texte(v.commentaire) } };
    }
    case "piece": {
      /* Une fiche du référentiel : sa référence de casier, sa désignation, ses compatibilités, son seuil. */
      if (!texte(v.reference)) return { refus: "pièce sans référence" };
      if (!texte(v.designation)) return { refus: "pièce sans désignation" };
      const compatibilites = (texte(v.compatibilites) ?? "").split(/[;,]/).map((x) => x.trim()).filter(Boolean);
      return { ligne: { numero, reference: texte(v.reference), designation: texte(v.designation), categorie: texte(v.categorie) ?? "autre", unite: texte(v.unite) ?? "piece", reference_constructeur: texte(v.referenceConstructeur), compatibilites, prestataire_id: r.prestataireId, fournisseur: texte(v.fournisseur), prix_reference: nombre(v.prixReference) === null ? null : Math.round(nombre(v.prixReference)!), stock_minimum: Math.max(0, Math.round(nombre(v.stockMinimum) ?? 0)), stock_maximum: nombre(v.stockMaximum) === null ? null : Math.max(0, Math.round(nombre(v.stockMaximum)!)), actif: v.actif === undefined ? true : booleen(v.actif), commentaire: texte(v.commentaire) } };
    }
    case "mouvement": {
      /* Le stock ne se saisit pas, il se déduit : une entrée cite sa livraison, une sortie ce qu'elle sert, une régularisation son motif. */
      const nature = texte(v.nature) ?? "sortie";
      const quantite = nombre(v.quantite);
      const ecart = nombre(v.ecart);
      if (!r.pieceId) return { refus: "mouvement sans pièce" };
      if (!texte(v.date)) return { refus: "mouvement sans date" };
      if (!["entree", "sortie", "retour", "regularisation"].includes(nature)) return { refus: "mouvement d'une nature inconnue" };
      if (nature === "regularisation") {
        if (ecart === null || ecart === 0) return { refus: "régularisation sans écart" };
        if (!texte(v.motif)) return { refus: "régularisation sans motif" };
      } else if (quantite === null || quantite <= 0) return { refus: "mouvement sans quantité" };
      if (nature === "sortie" && !r.vehiculeId && !texte(v.ordreNumero) && !texte(v.interventionNumero)) return { refus: "sortie sans ordre, intervention ni véhicule : rien ne sort dans le vide" };
      return { ligne: { numero, date: texte(v.date), nature, piece_id: r.pieceId, quantite: nature === "regularisation" ? Math.abs(ecart!) : quantite, ecart: nature === "regularisation" ? ecart : null, prix_unitaire: nombre(v.prixUnitaire) === null ? null : Math.round(nombre(v.prixUnitaire)!), demande_numero: texte(v.demandeNumero), ordre_numero: texte(v.ordreNumero), intervention_numero: texte(v.interventionNumero), vehicule_id: r.vehiculeId, fournisseur: texte(v.fournisseur), motif: texte(v.motif), auteur_nom: texte(v.auteur) } };
    }
    case "pneu": {
      /* Un pneu, un par un : sa dimension, et s'il est monté, son véhicule, sa position, ses kilomètres de pose. */
      const etat = texte(v.etat) ?? (r.vehiculeId ? "monte" : "en-stock");
      if (!texte(v.dimension)) return { refus: "pneu sans dimension" };
      if (etat === "monte" && !r.vehiculeId) return { refus: "pneu monté sans véhicule" };
      return { ligne: { numero, piece_id: r.pieceId, marque: texte(v.marque) ?? "", dimension: texte(v.dimension), numero_serie: texte(v.numeroSerie), etat, vehicule_id: etat === "en-stock" ? null : r.vehiculeId, position: texte(v.position), date_pose: texte(v.datePose), km_pose: nombre(v.kmPose) === null ? null : Math.round(nombre(v.kmPose)!), date_depose: texte(v.dateDepose), km_depose: nombre(v.kmDepose) === null ? null : Math.round(nombre(v.kmDepose)!), rechapages: Math.max(0, Math.round(nombre(v.rechapages) ?? 0)), commentaire: texte(v.commentaire) } };
    }
    case "avance": {
      /* Un décaissement fait avant le service : il engage la trésorerie, il dit qui l'a décidé. */
      const montant = nombre(v.montant);
      if (!r.prestataireId) return { refus: "avance sans prestataire" };
      if (!texte(v.date)) return { refus: "avance sans date" };
      if (montant === null || montant <= 0) return { refus: "avance sans montant" };
      if (!texte(v.motif)) return { refus: "avance sans motif" };
      if (!texte(v.autorisePar)) return { refus: "avance sans autorisation" };
      return { ligne: { numero, prestataire_id: r.prestataireId, date: texte(v.date), montant: Math.round(montant), motif: texte(v.motif), imputee_sur: texte(v.imputeeSur), date_imputation: texte(v.dateImputation), autorise_par: texte(v.autorisePar) } };
    }
    case "evaluation": {
      /* Trois notes de 1 à 5 sur la pièce évaluée ; l'auteur est la personne de la session. */
      const note = (x: unknown) => {
        const n = nombre(x);
        return n === null ? null : Math.round(n);
      };
      const qualite = note(v.qualite);
      const delai = note(v.delai);
      const prix = note(v.prix);
      if (!r.prestataireId) return { refus: "évaluation sans prestataire" };
      if (!texte(v.date)) return { refus: "évaluation sans date" };
      if (!texte(v.pieceNumero)) return { refus: "évaluation sans pièce évaluée" };
      if ([qualite, delai, prix].some((n) => n === null || n < 1 || n > 5)) return { refus: "évaluation sans les trois notes de 1 à 5" };
      if (!texte(v.auteur)) return { refus: "évaluation sans auteur" };
      return { ligne: { numero, prestataire_id: r.prestataireId, date: texte(v.date), piece_numero: texte(v.pieceNumero), piece_libelle: texte(v.pieceLibelle) ?? texte(v.pieceNumero), qualite, delai, prix, commentaire: texte(v.commentaire), auteur: texte(v.auteur) } };
    }
    case "rappel": {
      /* La prochaine échéance de ce qui se renouvelle, sur un véhicule ou un
         chauffeur — l'un ou l'autre, jamais les deux, et la base le tient. */
      const type = texte(v.type);
      const echeance = texte(v.echeance);
      if (!type) return { refus: "rappel sans type" };
      if (!echeance) return { refus: "rappel sans échéance" };
      if (!r.vehiculeId && !r.chauffeurId) return { refus: "rappel sans véhicule ni chauffeur" };
      return { ligne: { numero, vehicule_id: r.vehiculeId, chauffeur_id: r.vehiculeId ? null : r.chauffeurId, type_document_id: type, echeance, fait_le: texte(v.faitLe), document_numero: texte(v.documentNumero), commentaire: texte(v.commentaire) } };
    }
    case "sanction": {
      if (!r.chauffeurId) return { refus: "sanction sans chauffeur" };
      if (!texte(v.motif)) return { refus: "sanction sans motif" };
      return { ligne: { numero, chauffeur_id: r.chauffeurId, date: texte(v.date), type: texte(v.type) ?? "avertissement", motif: texte(v.motif), jours: nombre(v.jours) } };
    }
    case "prestataire": {
      const raisonSociale = texte(v.raisonSociale);
      if (!raisonSociale) return { refus: "prestataire sans raison sociale" };
      return {
        ligne: {
          numero,
          raison_sociale: raisonSociale,
          type: texte(v.type) ?? "autre",
          contact: texte(v.contact),
          telephone: texte(v.telephone),
          courriel: texte(v.courriel),
          adresse: texte(v.adresse),
          ville: texte(v.ville),
          ninea: texte(v.ninea),
          /* Nul quand on paie à la commande : ce n'est pas zéro jour, c'est
             une autre règle — la colonne le dit déjà (0001). */
          delai_paiement_jours: nombre(v.delaiPaiementJours),
          /* Une fiche naît active : on la désactive ensuite par modification. */
          actif: v.actif === undefined ? true : booleen(v.actif),
          note: texte(v.note),
        },
      };
    }

    /*
     * Un « autre conducteur » : quelqu'un qui tient un véhicule au titre de sa
     * fonction, et que le parc suit à ce seul titre.
     *
     * Le nom suffit, et c'est tout ce que la table exige. Rien de ce qu'on
     * demande à un chauffeur du parc — permis, visite médicale, aptitude — n'a
     * de sens ici : le lui réclamer le ferait paraître non conforme pour des
     * pièces que personne n'a à lui demander.
     */
    case "attributaire": {
      const nom = texte(v.nom);
      if (!nom) return { refus: "autre conducteur sans nom" };
      return {
        ligne: {
          nom,
          fonction: texte(v.fonction),
          departement: texte(v.departement),
          business_unit: texte(v.businessUnit),
          matricule_rh: texte(v.matriculeRh),
          /* Une fiche naît active : on la désactive ensuite par modification. */
          actif: v.actif === undefined ? true : booleen(v.actif),
        },
      };
    }
    /* La personne n'a pas de numéro non plus : sa clé est celle de la table,
       et l'écriture la dérive de son nom pour que l'adresse lisible de sa
       fiche — « CHA-babacar-ndiaye » — continue de la désigner. */
    case "chauffeur": {
      const prenom = texte(v.prenom);
      const nom = texte(v.nom);
      if (!prenom || !nom) return { refus: "chauffeur sans nom ou sans prénom" };
      return {
        ligne: {
          nom,
          prenom,
          matricule_rh: texte(v.matriculeRh),
          contrat: texte(v.contrat) ?? "salarie",
          site_id: r.siteId ?? texte(v.siteId),
          telephone: texte(v.telephone),
          permis_numero: texte(v.permisNumero),
          permis_categories: categoriesPermis(v.permisCategories),
          permis_delivrance: texte(v.permisDelivrance),
          permis_echeance: texte(v.permisEcheance),
          visite_medicale_echeance: texte(v.visiteMedicaleEcheance),
          /* Une fiche naît apte : une réserve ou une inaptitude est une
             décision datée, qui se prend ensuite et se trace. */
          aptitude: texte(v.aptitude) ?? "apte",
          date_naissance: texte(v.dateNaissance),
          date_embauche: texte(v.dateEmbauche),
          date_sortie: texte(v.dateSortie),
          adresse: texte(v.adresse),
          contact_urgence: texte(v.contactUrgence),
        },
      };
    }
    /* Le véhicule n'a pas de numéro : sa clé métier est son immatriculation, et
       c'est elle qui doit être unique. Le reste se complète sur la fiche. */
    case "vehicule": {
      /* Sans plaque, le châssis tient lieu d'immatriculation et le véhicule
         entre « en mutation » (16 septembre 2026) — la même règle que le
         formulaire, tenue ici pour tout chemin qui n'y passerait pas. */
      const sansPlaque = !texte(v.immatriculation);
      const vinSaisi = texte(v.vin);
      const immatriculation = sansPlaque ? (vinSaisi && vinSaisi.length >= 6 ? provisoireDepuisVin(vinSaisi) : "") : immatriculationCanonique(texte(v.immatriculation) ?? "");
      if (!immatriculation) return { refus: "véhicule sans immatriculation ni numéro de châssis" };
      const marque = texte(v.marque);
      const appellation = texte(v.appellation);
      if (!marque || !appellation) return { refus: "véhicule sans marque ou sans modèle" };
      const categorie = familleSaisie(v);
      if (!categorie) return { refus: "véhicule sans catégorie" };
      const statutSaisi = texte(v.statut) ?? "en-service";
      const statut = sansPlaque && statutSaisi === "en-service" ? "en-mutation" : statutSaisi;
      const dateSortie = texte(v.dateSortie);
      if (statut === "sorti" && !dateSortie) return { refus: "véhicule sorti sans date de sortie" };
      return {
        ligne: {
          immatriculation,
          vin: texte(v.vin),
          marque,
          appellation,
          type_modele: texte(v.typeModele),
          categorie,
          categorie_metier: categorieMetierSaisie(v),
          categorie_flotte: texte(v.categorieFlotte) ?? "interne",
          regime: texte(v.regime) ?? "exploitation",
          usage: usageSaisi(v),
          usage_metier: usageMetierSaisie(v),
          transport_special: booleen(v.transportSpecial),
          /* Une semi-remorque n'a pas de moteur : son énergie reste vide (0052).
             Pour le reste, le gasoil est le défaut du parc — dire « gasoil »
             d'un camion sans précision est raisonnable ; le dire d'une remorque
             ne l'est pas. */
          energie: categorie === "semi-remorque" ? null : (texte(v.energie) ?? "gasoil"),
          business_unit: texte(v.businessUnit),
          site_id: r.siteId ?? texte(v.siteId),
          statut,
          engage: v.engage === undefined ? true : booleen(v.engage),
          /* Chez qui il a été acheté : le lien quand le référentiel le connaît,
             le nom en clair dans tous les cas (0048). */
          fournisseur_id: r.prestataireId,
          fournisseur: texte(v.fournisseur),
          date_sortie: dateSortie,
          motif_sortie: texte(v.motifSortie),
          premiere_mise_en_circulation: texte(v.premiereMiseEnCirculation),
          date_immatriculation: texte(v.dateImmatriculation),
          puissance_cv: entier(v.puissanceCv),
          cylindree: entier(v.cylindree),
          ptac: entier(v.ptac),
          ptra: entier(v.ptra),
          poids_vide: entier(v.poidsVide),
          charge_utile: entier(v.chargeUtile),
          capacite_reservoir: entier(v.capaciteReservoir),
          valeur_acquisition: entier(v.valeurAcquisition),
          duree_amortissement_annees: entier(v.dureeAmortissementAnnees),
          date_acquisition: texte(v.dateAcquisition),
          reference_immobilisation: texte(v.referenceImmobilisation),
          photo: texte(v.photo),
          commentaire: texte(v.commentaire),
        },
      };
    }
    default:
      return { refus: `pas de table pour ${type}` };
  }
}

/* Les champs qu'une modification peut changer, et leur colonne. Ce qui n'y est
   pas (le véhicule d'une dépense, la nature d'un incident) se corrige en
   annulant et ressaisissant, comme le bureau le fait. */
const COLONNES: Partial<Record<TypeTransaction, Record<string, string>>> = {
  releve: { date: "date", valeur: "km" },
  plein: { date: "date", litres: "litres", prixLitre: "prix_litre", montant: "montant", reference: "reference", km: "km", source: "source", photo: "photo" },
  depense: { date: "date", poste: "poste", libelle: "libelle", montant: "montant", beneficiaire: "beneficiaire", reference: "reference", km: "km", justificatif: "justificatif", origine: "origine", photo: "photo", numeroBc: "numero_bc", fichierBc: "fichier_bc" },
  document: { numeroPiece: "numero_piece", emetteur: "emetteur", dateEffet: "date_effet", echeance: "echeance", montant: "montant", fichier: "fichier" },
  incident: { dateHeure: "date_heure", lieu: "lieu", mission: "mission", kilometrage: "kilometrage", responsabilite: "responsabilite", statut: "statut", description: "description" },
  affectation: { debut: "debut", fin: "fin", motif: "motif" },
  attributaire: {
    nom: "nom",
    fonction: "fonction",
    departement: "departement",
    businessUnit: "business_unit",
    matriculeRh: "matricule_rh",
    actif: "actif",
  },
  /* Un rappel se renouvelle par modification : l'échéance avance, la date du
     renouvellement se note, le document qui le prouve se cite. Le type et le
     porteur, eux, ne changent pas — un autre type est un autre rappel. */
  rappel: {
    echeance: "echeance",
    faitLe: "fait_le",
    documentNumero: "document_numero",
    commentaire: "commentaire",
  },
  prestataire: {
    raisonSociale: "raison_sociale",
    type: "type",
    contact: "contact",
    telephone: "telephone",
    courriel: "courriel",
    adresse: "adresse",
    ville: "ville",
    ninea: "ninea",
    delaiPaiementJours: "delai_paiement_jours",
    actif: "actif",
    note: "note",
  },
  /* La fiche d'une personne. Le nom et le prénom en font partie : on corrige
     une orthographe, on n'invente pas quelqu'un d'autre — et la trace dit qui
     a changé quoi. L'aptitude, elle, ne se modifie pas ici : c'est une
     décision datée, qui a son propre formulaire et sa propre écriture. */
  chauffeur: {
    nom: "nom",
    prenom: "prenom",
    matriculeRh: "matricule_rh",
    contrat: "contrat",
    siteId: "site_id",
    telephone: "telephone",
    permisNumero: "permis_numero",
    permisCategories: "permis_categories",
    permisDelivrance: "permis_delivrance",
    permisEcheance: "permis_echeance",
    visiteMedicaleEcheance: "visite_medicale_echeance",
    dateNaissance: "date_naissance",
    dateEmbauche: "date_embauche",
    dateSortie: "date_sortie",
    adresse: "adresse",
    contactUrgence: "contact_urgence",
    photo: "photo",
  },
  /* Les deux véhicules ne se changent pas après coup : un attelage qui change
     de tracteur est un autre attelage. On clôt et on en saisit un nouveau. */
  attelage: { debut: "debut", fin: "fin", permanent: "permanent", motif: "motif" },
  intervention: { date: "date", type: "type", objet: "objet", km: "km", immobilisationJours: "immobilisation_jours", montant: "montant", reference: "reference", fichier: "fichier" },
  indisponibilite: { motif: "motif", debut: "debut", fin: "fin", commentaire: "commentaire" },
  sanction: { date: "date", type: "type", jours: "jours", motif: "motif" },
  caisse: { date: "date", libelle: "libelle", montant: "montant", beneficiaire: "beneficiaire", piece: "piece", justificatif: "justificatif", objetReglement: "objet_reglement", depenseNumero: "depense_numero" },
  cuve: { date: "date", libelle: "libelle", litres: "litres", prixLitre: "prix_litre", montant: "montant", fournisseur: "fournisseur", piece: "piece", commentaire: "commentaire" },
  achat: { date: "date", objet: "objet", poste: "poste", montantEstime: "montant_estime", fournisseur: "fournisseur", urgence: "urgence", etape: "etape", visaPar: "visa_par", visaLe: "visa_le", validePar: "valide_par", valideeLe: "validee_le", numeroDemandeX3: "numero_demande_x3", numeroBonCommande: "numero_bon_commande", montantEngage: "montant_engage", dateLivraison: "date_livraison", dateFacture: "date_facture", montantReel: "montant_reel", dateReglement: "date_reglement", depenseNumero: "depense_numero", commentaireDecision: "commentaire_decision", fichier: "fichier" },
  visite: { type: "type", centre: "centre", dateRendezVous: "date_rendez_vous", heure: "heure", datePassage: "date_passage", statut: "statut", numeroPv: "numero_pv", dateLimiteContreVisite: "date_limite_contre_visite", commentaire: "commentaire", fichier: "fichier" },
  observation: { libelle: "libelle", categorie: "categorie", gravite: "gravite", statut: "statut", interventionNumero: "intervention_numero", corrigeeLe: "corrigee_le", commentaire: "commentaire" },
  ordre: {
    datePrevue: "date_prevue", objet: "objet", garage: "garage", immobilisationPrevueJours: "immobilisation_prevue_jours", montantEstime: "montant_estime", statut: "statut", dateDebut: "date_debut", dateCloture: "date_cloture", interventionNumero: "intervention_numero", commentaire: "commentaire",
    /* Le service de maintenance (0060). */
    priorite: "priorite", dateFin: "date_fin", kilometrage: "kilometrage", numeroFacture: "numero_facture", lignes: "lignes", remiseMode: "remise_mode", remiseValeur: "remise_valeur", mainOeuvreGlobale: "main_oeuvre_globale", modeReglement: "mode_reglement", numeroBc: "numero_bc", piecesReglement: "pieces_reglement", tvaTaux: "tva_taux", brsTaux: "brs_taux", pieces: "pieces", signalements: "signalements",
  },
  signalement: { date: "date", priorite: "priorite", systeme: "systeme", description: "description", details: "details", kilometrage: "kilometrage", pieces: "pieces", statut: "statut" },
  tache: { libelle: "libelle", description: "description", systeme: "systeme", ensemble: "ensemble", typeDefaut: "type_defaut", actif: "actif" },
  /* Le relevé : ce que le pont bascule ou le bon de livraison corrigent après
     coup. Le camion et le transporteur se fixent à la saisie. */
  transport: { date: "date", destination: "destination", produit: "produit", tonnage: "tonnage", tonnagePese: "tonnage_pese", bonLivraison: "bon_livraison", chauffeur: "chauffeur", origine: "origine" },
  tarif: { prix: "prix", minimum: "minimum", debut: "debut", fin: "fin", source: "source", commentaire: "commentaire" },
  /* Un affrètement : ce qui reste modifiable après coup. Le transporteur et le
     trajet se fixent à la commande — on n'échange pas un transporteur en cours
     de mission, on annule et on recommande. */
  affretement: { date: "date", tonnageLivre: "tonnage_livre", statut: "statut", chauffeurExterne: "chauffeur_externe", montantFacture: "montant_facture", prixExceptionnel: "prix_exceptionnel", complementTarif: "complement_tarif", motifTarif: "motif_tarif", dateLivraison: "date_livraison", dateFacture: "date_facture", dateReglement: "date_reglement", referenceFacture: "reference_facture", numeroDemandeX3: "numero_demande_x3", numeroBonCommande: "numero_bon_commande", commentaire: "commentaire" },
  "mise-a-disposition": { joursPanne: "jours_panne", joursRoules: "jours_roules", carburantLitres: "carburant_litres", carburantMontant: "carburant_montant", kmParcourus: "km_parcourus", tonnesTransportees: "tonnes_transportees", statut: "statut", montantFacture: "montant_facture", dateFacture: "date_facture", dateReglement: "date_reglement", referenceFacture: "reference_facture", numeroDemandeX3: "numero_demande_x3", commentaire: "commentaire" },
  prestation: { date: "date", libelle: "libelle", quantite: "quantite", prixUnitaire: "prix_unitaire", statut: "statut", montantFacture: "montant_facture", dateFacture: "date_facture", dateReglement: "date_reglement", referenceFacture: "reference_facture", numeroDemandeX3: "numero_demande_x3", commentaire: "commentaire" },
  /* L'avance s'impute après coup : c'est sa vie même. */
  avance: { date: "date", montant: "montant", motif: "motif", imputeeSur: "imputee_sur", dateImputation: "date_imputation", autorisePar: "autorise_par" },
  evaluation: { date: "date", qualite: "qualite", delai: "delai", prix: "prix", commentaire: "commentaire" },
  /* La fiche d'une pièce se corrige ; un mouvement, jamais (on le corrige par un autre) ; un pneu suit sa vie : monté, déposé, rebuté. */
  piece: { reference: "reference", designation: "designation", categorie: "categorie", unite: "unite", referenceConstructeur: "reference_constructeur", fournisseur: "fournisseur", prixReference: "prix_reference", stockMinimum: "stock_minimum", stockMaximum: "stock_maximum", actif: "actif", commentaire: "commentaire" },
  pneu: { marque: "marque", dimension: "dimension", numeroSerie: "numero_serie", etat: "etat", position: "position", datePose: "date_pose", kmPose: "km_pose", dateDepose: "date_depose", kmDepose: "km_depose", rechapages: "rechapages", commentaire: "commentaire" },
  /* L'enveloppe se corrige en comité : le montant et la base ; jamais son poste ni sa business unit — ce serait une autre enveloppe. */
  budget: { montant: "montant", base: "base", commentaire: "commentaire" },
  /* La fiche véhicule. L'immatriculation en fait partie : une plaque se
     refait, et jusqu'ici il fallait recréer le véhicule pour la corriger — ce
     qui aurait détaché ses dépenses, ses pneus et ses livraisons. Elle se
     normalise comme partout (« AB-060-KT » → « AB060KT »).
     `categorie` n'y est pas : elle s'écrit en deux colonnes, et la modification
     la traite à part.
     Ce qui se calcule ne s'écrit pas : la région vient du site, l'utilisation
     de l'usage, le régime de propriété de la catégorie de flotte, l'entité de
     la business unit, la balise des relevés. */
  vehicule: {
    immatriculation: "immatriculation",
    vin: "vin",
    marque: "marque",
    appellation: "appellation",
    typeModele: "type_modele",
    categorieFlotte: "categorie_flotte",
    regime: "regime",
    usage: "usage",
    usageMetier: "usage_metier",
    transportSpecial: "transport_special",
    energie: "energie",
    businessUnit: "business_unit",
    siteId: "site_id",
    engage: "engage",
    dateSortie: "date_sortie",
    motifSortie: "motif_sortie",
    premiereMiseEnCirculation: "premiere_mise_en_circulation",
    dateImmatriculation: "date_immatriculation",
    puissanceCv: "puissance_cv",
    cylindree: "cylindree",
    ptac: "ptac",
    ptra: "ptra",
    poidsVide: "poids_vide",
    chargeUtile: "charge_utile",
    capaciteReservoir: "capacite_reservoir",
    valeurAcquisition: "valeur_acquisition",
    dureeAmortissementAnnees: "duree_amortissement_annees",
    dateAcquisition: "date_acquisition",
    referenceImmobilisation: "reference_immobilisation",
    /* Le nom du fournisseur seulement : le lien vers le référentiel se résout
       en base, que ce module pur ne connaît pas — `ecrireModification` s'en
       charge, comme `rattacher` le fait à la création. */
    fournisseur: "fournisseur",
    photo: "photo",
    commentaire: "commentaire",
  },
};

const NUMERIQUES = new Set([
  "km", "litres", "prix_litre", "montant", "kilometrage", "immobilisation_jours", "jours", "immobilisation_prevue_jours", "montant_estime", "montant_engage", "montant_reel",
  "tonnage", "tonnage_pese", "tonnage_livre", "prix", "minimum", "montant_facture", "prix_exceptionnel", "complement_tarif", "jours_panne", "jours_roules", "carburant_litres", "carburant_montant", "km_parcourus", "tonnes_transportees", "quantite", "prix_unitaire",
  "qualite", "delai", "quantite", "ecart", "prix_unitaire", "prix_reference", "stock_minimum", "stock_maximum", "km_pose", "km_depose", "rechapages",
  "puissance_cv", "cylindree", "ptac", "ptra", "poids_vide", "charge_utile", "capacite_reservoir", "valeur_acquisition", "duree_amortissement_annees",
]);
/* Les colonnes qui gardent leurs décimales : des litres, des tonnes, des quantités. */
const DECIMALES = new Set(["litres", "tonnage", "tonnage_pese", "tonnage_livre", "carburant_litres", "tonnes_transportees", "quantite", "remise_valeur", "tva_taux", "brs_taux"]);
/* Les colonnes JSON et les tableaux (0058, 0060) : ni un texte, ni un nombre. */
const JSONS = new Set(["lignes"]);
const TABLEAUX = new Set(["pieces", "signalements", "pieces_reglement"]);
/* Les colonnes que la base veut en booléen. Une case « oui/non » arrive de la
   modale en texte : sans cette liste, « non » entrerait tel quel et Postgres le
   lirait comme vrai — une fiche qu'on croit désactivée resterait proposée. */
const BOOLEENS = new Set(["justificatif", "transport_special", "engage", "actif", "permanent", "retiree"]);
const HORODATES = new Set(["date_heure"]);
const PRODUITS = new Set(["produit"]);
/* Les colonnes qui portent une plaque : elle se range sous sa forme canonique,
   sans séparateur, quelle que soit la façon dont elle a été tapée. */
const PLAQUES = new Set(["immatriculation"]);

/** Les colonnes qu'une modification change ; vide quand rien de ce qui a changé n'a de colonne. */
export function colonnesModification(type: TypeTransaction, diffs: { champ: string; valeur: unknown }[]): Record<string, unknown> {
  const carte = COLONNES[type];
  if (!carte) return {};
  const ligne: Record<string, unknown> = {};
  /* La catégorie change deux colonnes d'un coup. Choisir une famille standard
     la pose et efface la catégorie métier — d'où le `null` explicite. Choisir
     une catégorie ajoutée par le métier (« cat-… ») ne pose qu'elle : sa
     famille est déclarée dans les paramètres, que ce module pur ne lit pas, et
     laisser la famille en place vaut mieux que d'en deviner une. */
  const categorie = diffs.find((d) => d.champ === "categorie");
  if (type === "vehicule" && categorie) {
    const v = { categorie: categorie.valeur, categorieFamille: diffs.find((d) => d.champ === "categorieFamille")?.valeur };
    const famille = familleSaisie(v);
    if (famille) ligne.categorie = famille;
    ligne.categorie_metier = categorieMetierSaisie(v);
  }
  for (const d of diffs) {
    const colonne = carte[d.champ];
    if (!colonne) continue;
    if (PLAQUES.has(colonne)) {
      const plaque = immatriculationCanonique(texte(d.valeur) ?? "");
      if (plaque) ligne[colonne] = plaque;
      continue;
    }
    if (JSONS.has(colonne)) {
      ligne[colonne] = jsonDe(d.valeur);
      continue;
    }
    if (TABLEAUX.has(colonne)) {
      ligne[colonne] = tableauDe(d.valeur);
      continue;
    }
    if (colonne === "systeme" && type === "tache") ligne.categorie = categorieDuSysteme(texte(d.valeur));
    if (NUMERIQUES.has(colonne) || DECIMALES.has(colonne)) {
      const n = nombre(d.valeur);
      ligne[colonne] = n === null ? null : DECIMALES.has(colonne) ? Math.round(n * 100) / 100 : Math.round(n);
    } else if (BOOLEENS.has(colonne)) ligne[colonne] = booleen(d.valeur);
    else if (HORODATES.has(colonne)) ligne[colonne] = horodatage(d.valeur);
    else if (PRODUITS.has(colonne)) ligne[colonne] = produitDepuis(d.valeur);
    else ligne[colonne] = texte(d.valeur);
  }
  return ligne;
}

/** Le sujet d'une création, décomposé : « vehicule:AA032EA » → { genre, cle } ; « transporteur:PRE-2026-00021 » est un prestataire. */
export function decomposerSujet(sujet: string): { genre: "vehicule" | "chauffeur" | "prestataire" | "autre"; cle: string } {
  const [genre, ...reste] = sujet.split(":");
  const cle = reste.join(":");
  if (genre === "vehicule" && cle) return { genre: "vehicule", cle };
  if (genre === "chauffeur" && cle) return { genre: "chauffeur", cle };
  if ((genre === "transporteur" || genre === "prestataire") && cle) return { genre: "prestataire", cle };
  return { genre: "autre", cle: sujet };
}

export const EST_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * L'immatriculation canonique d'un sujet — la règle du domaine, et elle seule.
 * Cette fonction n'ôtait que les espaces et les tirets ; « (NOUVEAU VRAC 1) »
 * entrait donc en base avec ses parenthèses, quand l'adresse de la fiche
 * était normalisée sans elles : le véhicule créé était introuvable
 * (16 septembre 2026). Une clé, une règle.
 */
export function immatriculationCanonique(cle: string): string {
  return normaliser(cle);
}

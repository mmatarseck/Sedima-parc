/* ============================================================================
 * Paramètres — ce qui se règle dans l'application, pas dans le code.
 *
 * Premier lot : les règles des documents (décisions du métier, 3 septembre
 * 2026). La liste des documents elle-même est un paramètre : le métier peut en
 * ajouter, en renommer, en retirer. Chaque document dit qui le porte, à quels
 * véhicules il s'applique, combien de temps il vaut et s'il immobilise. Les
 * huit documents livrés avec l'application sont « standard » : leur
 * identifiant est connu du code (la visite technique a son processus, le
 * permis interdit de conduire). Toute ligne se retire : un document retiré
 * n'est plus exigé, plus calculé, plus proposé — les pièces déjà enregistrées
 * restent lisibles sous leur nom. « Valeurs par défaut » ramène la liste livrée.
 *
 * Pas de règle d'exemption pour les véhicules légers neufs : à la création du
 * véhicule, l'agent saisit la date de la première visite technique (celle que
 * la réglementation lui accorde), et l'échéancier part de là.
 * ==========================================================================*/

import type { CategorieVehicule, TypeDocument } from "./types";
import { ALERTES, PREVENANCE_DEFAUT, type FamilleAlerte } from "./alertes";
import { PASTILLE_PAR_ID, SEUILS_DEFAUT } from "./pastilles";
import { ROLES, type Role } from "./roles";

export type PorteurDocument = "vehicule" | "chauffeur" | "flotte";

/** À qui le document s'applique, parmi les véhicules (ou tous les chauffeurs). */
export type ApplicabiliteDocument = "tous" | "poids-lourds" | "legers" | "lourds-et-camionnettes" | "transport-special";

export const PORTEUR_DOCUMENT: Record<PorteurDocument, string> = {
  vehicule: "Véhicule",
  chauffeur: "Chauffeur",
  flotte: "Flotte",
};

export const APPLICABILITE_DOCUMENT: Record<ApplicabiliteDocument, string> = {
  tous: "Tous les véhicules",
  "poids-lourds": "Poids lourds",
  legers: "Véhicules légers",
  "lourds-et-camionnettes": "Poids lourds et camionnettes",
  "transport-special": "Transports spéciaux (denrées)",
};

export interface DefinitionDocument {
  /** Identifiant stable : « visite-technique », ou « doc-… » pour un document ajouté. */
  id: TypeDocument;
  libelle: string;
  porteur: PorteurDocument;
  applicabilite: ApplicabiliteDocument;
  /** Durée de validité en mois ; nulle pour un document permanent. */
  validiteMois: number | null;
  /** Manquant ou échu, il immobilise le véhicule (ou interdit de conduire). */
  critique: boolean;
  /** Livré avec l'application : connu du code (processus, interdictions). */
  standard: boolean;
  /**
   * Faux quand le parc n'a **jamais** enregistré une pièce de ce type : le
   * document n'est alors pas encore suivi, et son absence ne dit rien — ni
   * manquant, ni immobilisant. Calculé par le serveur depuis les données, jamais
   * saisi ; absent, le document est suivi.
   */
  suivi?: boolean;
}

export interface ParametresDocuments {
  types: DefinitionDocument[];
}

/**
 * Un barème de prix, **en vigueur à partir d'une date**.
 *
 * Demande du métier du 4 septembre 2026 : « les prix d'hydrocarbure changent,
 * il faut prévoir une gestion d'historique des prix, et utiliser les prix
 * définis aux périodes dédiées ».
 *
 * C'est plus qu'un confort. Un prix unique appliqué rétroactivement à deux ans
 * d'historique **réécrit le passé** : la dépense de carburant de janvier 2025
 * changerait de montant parce que le gasoil a baissé en 2026, et le coût au
 * kilomètre de l'an dernier deviendrait faux. Un fait comptable se valorise au
 * prix de son jour, jamais au prix d'aujourd'hui.
 */
export interface BaremeEnergie {
  /** Date d'entrée en vigueur, incluse. Le barème vaut jusqu'au suivant. */
  debut: string;
  prixLitreGasoil: number;
  prixLitreEssence: number;
  /** Prix du kWh pour les véhicules électriques et hybrides rechargeables. */
  prixKwh: number;
  prixLitreCuve: number;
  /** D'où vient ce barème : arrêté, facture fournisseur, relevé de cuve. */
  source: string;
}

/**
 * Énergie et carburant (décision du métier du 3 septembre 2026) : les prix se
 * règlent ici, jamais dans le code. Le prix du litre selon l'énergie du
 * véhicule pré-remplit un plein ; le prix du litre livré en citerne, une
 * livraison de cuve ; la contenance borne le stock de la cuve interne.
 *
 * Les prix vivent dans `baremes`, du plus ancien au plus récent. La contenance
 * de la cuve, elle, n'est pas un prix : elle ne se date pas.
 */
export interface ParametresEnergie {
  baremes: BaremeEnergie[];
  capaciteCuve: number;
}

/**
 * Les règles d'alerte de l'organisation — à ne pas confondre avec le réglage
 * personnel de chacun (« Mes notifications »).
 *
 * Ce que l'administrateur fixe ici, c'est **ce qu'un nouveau compte reçoit sans
 * rien toucher** : quelles familles d'alerte lui sont poussées selon son rôle,
 * et à combien de jours l'échéancier prévient. Chacun reste libre de s'en
 * écarter ensuite ; mais sans défaut sensé, personne ne règle rien et tout le
 * monde reçoit tout — ce qui revient à ne rien recevoir.
 */
export interface ReglesAlerte {
  /** Par famille, les rôles qui la reçoivent par défaut. Vide : personne. */
  destinataires: Partial<Record<FamilleAlerte, Role[]>>;
  /** Jours de prévenance des échéances, du plus lointain au plus proche. */
  prevenance: number[];
}

export const REGLES_ALERTE_DEFAUT: ReglesAlerte = {
  /* Le défaut de départ : chaque famille est poussée aux rôles qu'elle
     concerne — ceux que sa définition désigne, ou tous quand elle n'en
     désigne aucun. */
  destinataires: Object.fromEntries(ALERTES.map((a) => [a.cle, a.roles ?? []])),
  prevenance: PREVENANCE_DEFAUT,
};

/**
 * Le parc léger — cadrage du 7 septembre 2026 : la durée du plan car et le
 * forfait carburant mensuel des véhicules de fonction, en paramètres, avec
 * les valeurs par défaut données par le métier (cinq ans, 150 000 F par
 * mois). Chaque dossier peut s'en écarter. La mensualité du plan car ne se
 * suit pas : c'est une donnée de paie.
 */
export interface ParametresParcLeger {
  planCarDureeMois: number;
  forfaitCarburantMensuel: number;
}

export const PARC_LEGER_DEFAUT: ParametresParcLeger = {
  planCarDureeMois: 60,
  forfaitCarburantMensuel: 150_000,
};

function normaliserParcLeger(brut: unknown): ParametresParcLeger {
  const b = (brut ?? {}) as Partial<Record<keyof ParametresParcLeger, unknown>>;
  const entier = (v: unknown, defaut: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : defaut);
  return {
    planCarDureeMois: entier(b.planCarDureeMois, PARC_LEGER_DEFAUT.planCarDureeMois),
    forfaitCarburantMensuel: entier(b.forfaitCarburantMensuel, PARC_LEGER_DEFAUT.forfaitCarburantMensuel),
  };
}

/**
 * Les seuils des pastilles du tableau de bord — décision du métier du
 * 8 septembre 2026 : des seuils **en nombre**, réglables, jamais en part. Une
 * valeur par pastille qui en porte un ; le catalogue (pastilles.ts) donne le
 * défaut et le sens du rouge. Une pastille absente d'ici garde son défaut.
 */
export interface ParametresPastilles {
  seuils: Record<string, number>;
}

export const PASTILLES_PARAM_DEFAUT: ParametresPastilles = { seuils: { ...SEUILS_DEFAUT } };

function normaliserPastilles(brut: unknown): ParametresPastilles {
  const b = (brut ?? {}) as Partial<Record<keyof ParametresPastilles, unknown>>;
  const seuils: Record<string, number> = { ...SEUILS_DEFAUT };
  const lus = (b.seuils ?? {}) as Record<string, unknown>;
  for (const [id, v] of Object.entries(lus)) {
    /* Seule une pastille du catalogue qui porte un seuil se règle ; le reste est ignoré. */
    if (!PASTILLE_PAR_ID.get(id)?.seuil) continue;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) seuils[id] = Math.round(v);
  }
  return { seuils };
}

/* ---- Caisse parc et cuve interne (8 septembre 2026) ---------------------
 * Deux journaux dont le solde et le stock se déduisent des mouvements : il
 * leur faut un point de départ — le report à l'ouverture du journal — et,
 * pour la caisse, le seuil sous lequel la pastille passe au rouge. */

export interface ParametresCaisse {
  /** Le solde reporté à l'ouverture du journal, en francs. */
  soldeInitial: number;
  /** Sous ce solde, la caisse appelle un réapprovisionnement. */
  seuil: number;
}

export interface ParametresCuve {
  /** Le stock reporté à l'ouverture du journal, en litres. */
  stockInitial: number;
}

export const CAISSE_DEFAUT: ParametresCaisse = { soldeInitial: 1_500_000, seuil: 200_000 };
export const CUVE_DEFAUT: ParametresCuve = { stockInitial: 9_000 };

const entierPositif = (v: unknown, defaut: number): number => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(/\s/g, "")) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : defaut;
};

function normaliserCaisse(brut: unknown): ParametresCaisse {
  const b = (brut ?? {}) as Partial<Record<keyof ParametresCaisse, unknown>>;
  return { soldeInitial: entierPositif(b.soldeInitial, CAISSE_DEFAUT.soldeInitial), seuil: entierPositif(b.seuil, CAISSE_DEFAUT.seuil) };
}

function normaliserCuve(brut: unknown): ParametresCuve {
  const b = (brut ?? {}) as Partial<Record<keyof ParametresCuve, unknown>>;
  return { stockInitial: entierPositif(b.stockInitial, CUVE_DEFAUT.stockInitial) };
}

/* ---- Référentiel des véhicules -----------------------------------------
 * Demande du métier du 7 septembre 2026 : « maintenir les paramètres des
 * véhicules en paramètres, qui pourront être rajoutés au fur et à mesure
 * qu'on crée des véhicules — marque, modèle, catégorie ».
 *
 * Le dossier parc montre pourquoi : la même marque y est écrite MITSUBISHI,
 * MITSIBUSHI et MITSIBUHSI, la même remorque Lecitrailer et LECITRAILE. Une
 * liste tenue ici est proposée au formulaire ; ce qui s'y saisit de nouveau
 * y entre aussitôt, et l'orthographe ne dérive plus.
 *
 * Les catégories sont d'une autre nature : ce sont les clés des règles
 * (poids lourd ou léger pour les documents, plafond kilométrique, programme
 * d'entretien, silhouette). Les huit livrées sont donc des **familles**,
 * fixes ; le métier en ajoute autant qu'il veut, chacune rattachée à la
 * famille dont elle suit les règles. Un véhicule porte la famille dans
 * `categorie` et, s'il y a lieu, la catégorie ajoutée dans `categorieMetier`.
 */

export interface MarqueVehicule {
  nom: string;
  modeles: string[];
}

export interface CategorieVehiculeParametree {
  /** « camion » pour une famille livrée, « cat-… » pour une catégorie ajoutée. */
  id: string;
  libelle: string;
  /** La famille livrée dont la catégorie suit les règles. */
  famille: CategorieVehicule;
  /** Livrée avec l'application : c'est une famille, elle ne se retire pas. */
  standard: boolean;
}

export interface ParametresVehicules {
  marques: MarqueVehicule[];
  categories: CategorieVehiculeParametree[];
}

export const FAMILLES_VEHICULE: readonly CategorieVehicule[] = ["camion", "tracteur", "semi-remorque", "camionnette", "vehicule-leger", "bus", "moto", "engin"];

const LIBELLE_FAMILLE: Record<CategorieVehicule, string> = {
  camion: "Camion",
  tracteur: "Tracteur",
  "semi-remorque": "Semi-remorque",
  camionnette: "Camionnette",
  "vehicule-leger": "Véhicule léger",
  bus: "Bus",
  moto: "Moto",
  engin: "Engin",
};

export const CATEGORIES_STANDARD: CategorieVehiculeParametree[] = FAMILLES_VEHICULE.map((f) => ({ id: f, libelle: LIBELLE_FAMILLE[f], famille: f, standard: true }));

/*
 * La liste de départ des marques et modèles : ce que le dossier parc de
 * septembre 2026 contient, orthographié une fois pour toutes. Elle n'est
 * qu'un point de départ — chaque création de véhicule la complète.
 */
export const MARQUES_DEFAUT: MarqueVehicule[] = [
  { nom: "Renault", modeles: ["Kerax", "Magnum", "Premium", "Lander", "Master", "Duster", "Oroch", "Stepway"] },
  { nom: "Tata", modeles: ["LPT 1618", "LPT 1109", "LPT 613"] },
  { nom: "Mitsubishi", modeles: ["L200", "L200 Sportero", "ASX"] },
  { nom: "Toyota", modeles: ["Hilux", "Corolla Cross", "Coaster", "Hiace", "Prado", "Land Cruiser"] },
  { nom: "Citroën", modeles: ["Berlingo", "C-Elysée", "C3", "C3 Aircross"] },
  { nom: "Hyundai", modeles: ["Santa Fe", "Tucson", "Creta", "Sonata", "ix35"] },
  { nom: "Kia", modeles: ["Sorento", "Sportage", "Sonet", "Optima"] },
  { nom: "Suzuki", modeles: ["Vitara", "Moto 125"] },
  { nom: "Peugeot", modeles: ["Boxer", "508", "5008"] },
  { nom: "Ford", modeles: ["EcoSport", "Ranger", "Focus"] },
  { nom: "BAIC", modeles: ["X7"] },
  { nom: "Iveco", modeles: ["AT260", "Eurocargo"] },
  { nom: "MAN", modeles: ["TGM"] },
  { nom: "FAW", modeles: ["CA4250"] },
  { nom: "JAC", modeles: ["HFC9640"] },
  { nom: "Mercedes", modeles: ["Sprinter", "Classe C", "4Matic"] },
  { nom: "Force Motors", modeles: ["Autocar 24 places"] },
  { nom: "Cubas Segre", modeles: ["Citerne vrac"] },
  { nom: "Lecitrailer", modeles: ["Citerne vrac", "Plateau nu"] },
  { nom: "Trailor", modeles: ["Plateau nu"] },
  { nom: "Schmitz", modeles: ["Semi benne"] },
  { nom: "Coder", modeles: ["Citerne à eau"] },
  { nom: "Yamaha", modeles: ["Majesty 250"] },
  { nom: "Caterpillar", modeles: ["966C"] },
  { nom: "Land Rover", modeles: ["Range Rover Sport"] },
  { nom: "Lexus", modeles: ["LX570"] },
  { nom: "Chrysler", modeles: ["Grand Voyager"] },
  { nom: "Jeep", modeles: [] },
  { nom: "Nissan", modeles: ["Rogue"] },
];

export const VEHICULES_DEFAUT: ParametresVehicules = {
  marques: MARQUES_DEFAUT,
  categories: CATEGORIES_STANDARD,
};

/** Clé de rapprochement d'un nom : « MITSUBISHI », « Mitsubishi » et « mitsubishi  » sont la même marque. */
export function cleNom(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** « Mitsubishi » quel que soit le nom saisi, si la marque est connue ; sinon le nom saisi, nettoyé. */
export function nomMarqueConnu(nom: string, marques: MarqueVehicule[]): string {
  const cle = cleNom(nom);
  return marques.find((m) => cleNom(m.nom) === cle)?.nom ?? nom.replace(/\s+/g, " ").trim();
}

/**
 * Les marques complétées d'une marque et d'un modèle : ce qu'une création de
 * véhicule apprend. Rend la même liste si rien n'est nouveau, pour que
 * l'appelant sache s'il y a quelque chose à enregistrer.
 */
export function apprendreMarqueModele(marques: MarqueVehicule[], marque: string, modele: string | null): MarqueVehicule[] {
  const nom = marque.replace(/\s+/g, " ").trim();
  if (!nom) return marques;
  const cle = cleNom(nom);
  const mod = (modele ?? "").replace(/\s+/g, " ").trim();
  const existante = marques.find((m) => cleNom(m.nom) === cle);
  if (!existante) return [...marques, { nom, modeles: mod ? [mod] : [] }].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  if (!mod || existante.modeles.some((x) => cleNom(x) === cleNom(mod))) return marques;
  return marques.map((m) => (m === existante ? { ...m, modeles: [...m.modeles, mod].sort((a, b) => a.localeCompare(b, "fr")) } : m));
}

/** « cat-citerne-eau » : un identifiant lisible, unique parmi les existants. */
export function nouvelIdCategorie(libelle: string, existants: CategorieVehiculeParametree[]): string {
  const base = `cat-${identifiant(libelle)}`.replace(/-$/, "") || "cat-nouvelle";
  let id = base;
  let n = 2;
  while (existants.some((c) => c.id === id)) id = `${base}-${n++}`;
  return id;
}

/** La famille d'une catégorie, livrée ou ajoutée ; la famille elle-même si l'identifiant est inconnu. */
export function familleDe(id: string, categories: CategorieVehiculeParametree[] = VEHICULES_DEFAUT.categories): CategorieVehicule {
  const c = categories.find((x) => x.id === id);
  if (c) return c.famille;
  return (FAMILLES_VEHICULE as readonly string[]).includes(id) ? (id as CategorieVehicule) : "camion";
}

function normaliserVehicules(brut: unknown): ParametresVehicules {
  const b = (brut ?? {}) as Partial<Record<keyof ParametresVehicules, unknown>>;
  /* Les marques : une par nom, sans doublon ni modèle vide, triées. */
  const marques: MarqueVehicule[] = [];
  if (Array.isArray(b.marques)) {
    for (const m of b.marques) {
      if (!m || typeof m !== "object") continue;
      const nom = typeof (m as MarqueVehicule).nom === "string" ? (m as MarqueVehicule).nom.replace(/\s+/g, " ").trim() : "";
      if (!nom || marques.some((x) => cleNom(x.nom) === cleNom(nom))) continue;
      const bruts = Array.isArray((m as MarqueVehicule).modeles) ? (m as MarqueVehicule).modeles : [];
      const modeles: string[] = [];
      for (const x of bruts) {
        const mod = typeof x === "string" ? x.replace(/\s+/g, " ").trim() : "";
        if (mod && !modeles.some((y) => cleNom(y) === cleNom(mod))) modeles.push(mod);
      }
      marques.push({ nom, modeles: modeles.sort((x, y) => x.localeCompare(y, "fr")) });
    }
  }
  marques.sort((x, y) => x.nom.localeCompare(y.nom, "fr"));

  /* Les catégories : les huit familles toujours présentes (renommables, jamais
     retirées), puis les ajouts, chacun rattaché à une famille connue. */
  const bruts = Array.isArray(b.categories) ? b.categories : [];
  const categories: CategorieVehiculeParametree[] = CATEGORIES_STANDARD.map((s) => {
    const lu = bruts.find((c) => c && typeof c === "object" && (c as CategorieVehiculeParametree).id === s.id) as Partial<CategorieVehiculeParametree> | undefined;
    const libelle = typeof lu?.libelle === "string" && lu.libelle.trim() ? lu.libelle.trim() : s.libelle;
    return { ...s, libelle };
  });
  for (const c of bruts) {
    if (!c || typeof c !== "object") continue;
    const x = c as Partial<CategorieVehiculeParametree>;
    if (typeof x.id !== "string" || !x.id.startsWith("cat-") || categories.some((y) => y.id === x.id)) continue;
    const famille = (FAMILLES_VEHICULE as readonly string[]).includes(x.famille as string) ? (x.famille as CategorieVehicule) : "camion";
    const libelle = typeof x.libelle === "string" && x.libelle.trim() ? x.libelle.trim() : humaniser(x.id.replace(/^cat-/, ""));
    categories.push({ id: x.id, libelle, famille, standard: false });
  }
  return { marques: marques.length > 0 ? marques : MARQUES_DEFAUT.map((m) => ({ ...m, modeles: [...m.modeles] })), categories };
}

export interface Parametres {
  documents: ParametresDocuments;
  energie: ParametresEnergie;
  alertes: ReglesAlerte;
  parcLeger: ParametresParcLeger;
  vehicules: ParametresVehicules;
  pastilles: ParametresPastilles;
  caisse: ParametresCaisse;
  cuve: ParametresCuve;
}

const standard = (d: Omit<DefinitionDocument, "standard">): DefinitionDocument => ({ ...d, standard: true });

/*
 * Les barèmes du jeu de démonstration. **Ce ne sont pas les arrêtés réels** :
 * ce sont quatre paliers plausibles qui donnent au module de quoi fonctionner
 * avant que la gestion de parc ne saisisse les vrais. Chacun porte sa source,
 * et c'est cette colonne qui dira, le jour venu, ce qui a été vérifié.
 *
 * Le dernier barème reprend exactement les prix que l'application appliquait
 * jusqu'ici : rien ne bouge sur la période courante, seul le passé se corrige.
 */
export const BAREMES_DEFAUT: BaremeEnergie[] = [
  { debut: "2024-07-01", prixLitreGasoil: 755, prixLitreEssence: 1_015, prixKwh: 115, prixLitreCuve: 705, source: "Barème de démonstration — à remplacer par l'arrêté" },
  { debut: "2025-01-01", prixLitreGasoil: 690, prixLitreEssence: 990, prixKwh: 115, prixLitreCuve: 645, source: "Barème de démonstration — à remplacer par l'arrêté" },
  { debut: "2025-09-01", prixLitreGasoil: 655, prixLitreEssence: 990, prixKwh: 120, prixLitreCuve: 615, source: "Barème de démonstration — à remplacer par l'arrêté" },
  { debut: "2026-03-01", prixLitreGasoil: 630, prixLitreEssence: 990, prixKwh: 120, prixLitreCuve: 590, source: "Prix appliqués par l'application depuis le 3 septembre 2026" },
];

export const ENERGIE_DEFAUT: ParametresEnergie = {
  baremes: BAREMES_DEFAUT,
  capaciteCuve: 30_000,
};

/**
 * Le barème en vigueur à une date : le dernier dont la date d'effet est passée.
 *
 * Avant le premier barème connu, on rend le premier plutôt que rien : mieux
 * vaut un prix ancien qu'un montant nul, et l'écran des paramètres dit à partir
 * de quand l'historique est tenu.
 */
export function baremeALaDate(date: string, p: Parametres = PARAMETRES_DEFAUT): BaremeEnergie {
  const baremes = p.energie.baremes;
  const dernier = baremes.at(-1)!;
  for (let i = baremes.length - 1; i >= 0; i--) if (baremes[i]!.debut <= date) return baremes[i]!;
  return baremes[0] ?? dernier;
}

/**
 * Le prix unitaire de l'énergie d'un véhicule **à une date donnée** : le litre,
 * ou le kWh pour l'électrique.
 *
 * La date est obligatoire, et c'est voulu : un appelant qui n'y pense pas ne
 * doit pas obtenir silencieusement le prix du jour pour valoriser un plein de
 * l'an dernier. Pour une saisie du jour, on passe la date du jour.
 */
export function prixEnergie(energie: import("./types").Energie | null | undefined, date: string, p: Parametres = PARAMETRES_DEFAUT): number {
  const bareme = baremeALaDate(date, p);
  switch (energie) {
    case "essence":
      return bareme.prixLitreEssence;
    case "electrique":
      return bareme.prixKwh;
    default:
      return bareme.prixLitreGasoil;
  }
}

/** Le prix du litre livré en citerne à une date : la cuve interne se valorise ainsi. */
export function prixCuve(date: string, p: Parametres = PARAMETRES_DEFAUT): number {
  return baremeALaDate(date, p).prixLitreCuve;
}

export const PARAMETRES_DEFAUT: Parametres = {
  energie: ENERGIE_DEFAUT,
  alertes: REGLES_ALERTE_DEFAUT,
  parcLeger: PARC_LEGER_DEFAUT,
  vehicules: VEHICULES_DEFAUT,
  pastilles: PASTILLES_PARAM_DEFAUT,
  caisse: CAISSE_DEFAUT,
  cuve: CUVE_DEFAUT,
  documents: {
    types: [
      standard({ id: "carte-grise", libelle: "Carte grise", porteur: "vehicule", applicabilite: "tous", validiteMois: null, critique: true }),
      standard({ id: "assurance", libelle: "Assurance", porteur: "vehicule", applicabilite: "tous", validiteMois: 12, critique: true }),
      standard({ id: "visite-technique", libelle: "Visite technique", porteur: "vehicule", applicabilite: "tous", validiteMois: 12, critique: true }),
      standard({ id: "licence-transport", libelle: "Licence de transport", porteur: "flotte", applicabilite: "lourds-et-camionnettes", validiteMois: 24, critique: true }),
      standard({ id: "certificat-salubrite", libelle: "Certificat de salubrité", porteur: "vehicule", applicabilite: "transport-special", validiteMois: 12, critique: true }),
      standard({ id: "carte-transport", libelle: "Carte de transport", porteur: "vehicule", applicabilite: "transport-special", validiteMois: 12, critique: false }),
      standard({ id: "permis", libelle: "Permis de conduire", porteur: "chauffeur", applicabilite: "tous", validiteMois: 60, critique: true }),
      standard({ id: "visite-medicale", libelle: "Visite médicale", porteur: "chauffeur", applicabilite: "tous", validiteMois: 12, critique: true }),
    ],
  },
};

const PORTEURS: PorteurDocument[] = ["vehicule", "chauffeur", "flotte"];
const APPLICABILITES: ApplicabiliteDocument[] = ["tous", "poids-lourds", "legers", "lourds-et-camionnettes", "transport-special"];

/** Une définition lue du stockage, remise d'aplomb champ par champ. */
function normaliser(brut: unknown): DefinitionDocument | null {
  if (!brut || typeof brut !== "object") return null;
  const b = brut as Partial<DefinitionDocument>;
  if (typeof b.id !== "string" || !b.id) return null;
  const defaut = PARAMETRES_DEFAUT.documents.types.find((t) => t.id === b.id);
  return {
    id: b.id,
    libelle: typeof b.libelle === "string" && b.libelle.trim() ? b.libelle.trim() : (defaut?.libelle ?? humaniser(b.id)),
    porteur: PORTEURS.includes(b.porteur as PorteurDocument) ? (b.porteur as PorteurDocument) : (defaut?.porteur ?? "vehicule"),
    applicabilite: APPLICABILITES.includes(b.applicabilite as ApplicabiliteDocument) ? (b.applicabilite as ApplicabiliteDocument) : (defaut?.applicabilite ?? "tous"),
    validiteMois: typeof b.validiteMois === "number" && Number.isFinite(b.validiteMois) && b.validiteMois > 0 ? Math.round(b.validiteMois) : null,
    critique: typeof b.critique === "boolean" ? b.critique : (defaut?.critique ?? false),
    standard: Boolean(defaut),
    ...(b.suivi === false ? { suivi: false } : {}),
  };
}

/** Les paramètres enregistrés, complétés par les défauts pour tout ce qui manque. */
export function fusionnerParametres(partiel: unknown): Parametres {
  const p = (partiel ?? {}) as Partial<{ documents: { types?: unknown }; energie: Partial<Record<keyof ParametresEnergie, unknown>> }>;
  const d = p.documents ?? {};
  /* Ce qui est enregistré fait foi, y compris l'absence d'un document standard retiré. */
  const types = Array.isArray(d.types) ? d.types.map(normaliser).filter((t): t is DefinitionDocument => t !== null) : PARAMETRES_DEFAUT.documents.types.map((t) => ({ ...t }));
  /* Un prix absent ou invalide reprend le défaut : l'écran ne montre jamais de blanc. */
  const e = (p.energie ?? {}) as Partial<{ baremes: unknown; capaciteCuve: unknown }>;
  const capaciteCuve = typeof e.capaciteCuve === "number" && Number.isFinite(e.capaciteCuve) && e.capaciteCuve >= 0 ? e.capaciteCuve : ENERGIE_DEFAUT.capaciteCuve;
  /* Les barèmes sont relus un par un et **retriés** : un barème saisi après coup
     pour un mois passé doit se ranger à sa place, sinon la recherche par date
     rendrait le mauvais prix. */
  const baremes = Array.isArray(e.baremes) ? e.baremes.map(normaliserBareme).filter((b): b is BaremeEnergie => b !== null).sort((a, b) => a.debut.localeCompare(b.debut)) : [];
  return {
    documents: { types },
    energie: { baremes: baremes.length > 0 ? baremes : BAREMES_DEFAUT.map((b) => ({ ...b })), capaciteCuve },
    alertes: normaliserReglesAlerte((p as { alertes?: unknown }).alertes),
    parcLeger: normaliserParcLeger((p as { parcLeger?: unknown }).parcLeger),
    vehicules: normaliserVehicules((p as { vehicules?: unknown }).vehicules),
    pastilles: normaliserPastilles((p as { pastilles?: unknown }).pastilles),
    caisse: normaliserCaisse((p as { caisse?: unknown }).caisse),
    cuve: normaliserCuve((p as { cuve?: unknown }).cuve),
  };
}

function normaliserBareme(brut: unknown): BaremeEnergie | null {
  if (!brut || typeof brut !== "object") return null;
  const b = brut as Partial<Record<keyof BaremeEnergie, unknown>>;
  if (typeof b.debut !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.debut)) return null;
  const prix = (cle: "prixLitreGasoil" | "prixLitreEssence" | "prixKwh" | "prixLitreCuve") => {
    const v = b[cle];
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
  };
  return {
    debut: b.debut,
    prixLitreGasoil: prix("prixLitreGasoil"),
    prixLitreEssence: prix("prixLitreEssence"),
    prixKwh: prix("prixKwh"),
    prixLitreCuve: prix("prixLitreCuve"),
    source: typeof b.source === "string" && b.source.trim() ? b.source.trim() : "Saisi dans l'application",
  };
}

export function definitionDocument(type: TypeDocument, p: Parametres = PARAMETRES_DEFAUT): DefinitionDocument | null {
  return p.documents.types.find((t) => t.id === type) ?? null;
}

/** « certificat-gaz » : le libellé en identifiant, sans accent ni espace. */
function identifiant(libelle: string): string {
  return libelle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** « doc-certificat-gaz » : un identifiant lisible, unique parmi les existants. */
export function nouvelIdDocument(libelle: string, existants: DefinitionDocument[]): string {
  const base = `doc-${identifiant(libelle)}`.replace(/-$/, "") || "doc-nouveau";
  let id = base;
  let n = 2;
  while (existants.some((t) => t.id === id)) id = `${base}-${n++}`;
  return id;
}

/** Ce qu'un identifiant dit de lui-même quand aucun libellé n'est connu. */
function humaniser(id: string): string {
  const texte = id.replace(/^doc-/, "").replace(/-/g, " ");
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/* ---- Libellés courants -------------------------------------------------
 * Les écrans nomment les documents par TYPE_DOCUMENT[type] (libelles.ts), qui
 * lit ce registre. Il est alimenté à chaque lecture des paramètres — sur le
 * serveur par parametresServeur(), dans le navigateur par lireParametres() —
 * pour qu'un document ajouté ou renommé soit nommé partout sans que chaque
 * écran ne porte les paramètres. Un document retiré garde un nom lisible,
 * dérivé de son identifiant. En production, ce registre est la table des
 * documents. */

let LIBELLES: Record<string, string> = Object.fromEntries(PARAMETRES_DEFAUT.documents.types.map((t) => [t.id, t.libelle]));
let TYPES_COURANTS: DefinitionDocument[] = PARAMETRES_DEFAUT.documents.types;
let VEHICULES_COURANTS: ParametresVehicules = VEHICULES_DEFAUT;

export function appliquerLibelles(p: Parametres): void {
  LIBELLES = Object.fromEntries(p.documents.types.map((t) => [t.id, t.libelle]));
  TYPES_COURANTS = p.documents.types;
  VEHICULES_COURANTS = p.vehicules;
}

/** Le référentiel des véhicules tel que la dernière lecture des paramètres l'a posé. */
export function vehiculesCourants(): ParametresVehicules {
  return VEHICULES_COURANTS;
}

/**
 * Le nom d'une catégorie de véhicule : celle ajoutée par le métier si le
 * véhicule en porte une, sinon sa famille — sous le libellé courant, qui a pu
 * être renommé. Une catégorie ajoutée puis retirée retombe sur sa famille.
 */
export function libelleCategorieCourant(famille: CategorieVehicule, categorieMetier?: string | null): string {
  const c = VEHICULES_COURANTS.categories;
  if (categorieMetier) {
    const ajoutee = c.find((x) => x.id === categorieMetier);
    if (ajoutee) return ajoutee.libelle;
  }
  return c.find((x) => x.id === famille)?.libelle ?? LIBELLE_FAMILLE[famille];
}

export function libelleDocumentCourant(type: string): string {
  return LIBELLES[type] ?? PARAMETRES_DEFAUT.documents.types.find((t) => t.id === type)?.libelle ?? humaniser(type);
}

export function typesDocumentsCourants(): DefinitionDocument[] {
  return TYPES_COURANTS;
}

/** Clé de cache : deux jeux de paramètres identiques donnent la même clé. */
export function empreinteParametres(p: Parametres): string {
  return JSON.stringify(p);
}

/** Clé du stockage local qui porte les paramètres — et nom de l'ancien cookie unique. */
export const COOKIE_PARAMETRES = "sedima.parc.parametres";

/**
 * En démonstration, le serveur lit les paramètres dans des cookies : **un par
 * clé**, sous ce préfixe, et seulement pour ce qui diffère des défauts. Un
 * cookie unique ne suffisait plus : depuis le référentiel des véhicules, les
 * paramètres encodés dépassent les 4 Ko qu'un navigateur accepte, et
 * l'écriture échouait sans bruit — les pages du serveur restaient aux
 * défauts.
 */
export const PREFIXE_COOKIE_PARAMETRES = "sedima.parc.parametres.";

export const CLES_PARAMETRES: (keyof Parametres)[] = ["documents", "energie", "alertes", "parcLeger", "vehicules", "pastilles", "caisse", "cuve"];

/** Un cookie ne porte pas plus de 4 Ko, nom compris : au-delà, le navigateur le refuse sans rien dire. */
export const TAILLE_MAX_COOKIE = 3_900;

/* base64url d'un JSON en UTF-8 : plus compact que l'URL-encodage, qui triple
   chaque guillemet et sextuple chaque accent. Disponible au navigateur comme
   au serveur (TextEncoder, btoa). */
export function encoderValeurCookie(valeur: unknown): string {
  const octets = new TextEncoder().encode(JSON.stringify(valeur));
  let binaire = "";
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** L'inverse ; accepte aussi l'ancien URL-encodage. Nul quand rien ne se lit. */
export function decoderValeurCookie(brut: string): unknown {
  try {
    const b64 = brut.replace(/-/g, "+").replace(/_/g, "/");
    const binaire = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const octets = Uint8Array.from(binaire, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(octets));
  } catch {
    try {
      return JSON.parse(decodeURIComponent(brut));
    } catch {
      return null;
    }
  }
}

/**
 * Relecture des règles d'alerte enregistrées.
 *
 * Ce qui est écrit fait foi, y compris une famille dont plus personne n'est
 * destinataire : c'est une décision, pas un oubli. Seules les valeurs
 * impossibles — une famille inconnue, un rôle inconnu, une prévenance vide —
 * reprennent le défaut, sans quoi l'écran montrerait un blanc.
 */
function normaliserReglesAlerte(brut: unknown): ReglesAlerte {
  if (!brut || typeof brut !== "object") return { destinataires: { ...REGLES_ALERTE_DEFAUT.destinataires }, prevenance: [...REGLES_ALERTE_DEFAUT.prevenance] };
  const r = brut as Partial<Record<keyof ReglesAlerte, unknown>>;
  const famillesConnues = new Set(ALERTES.map((a) => a.cle));
  const rolesConnus = new Set(ROLES.map((x) => x.role));

  const destinataires: ReglesAlerte["destinataires"] = {};
  const brutDest = (r.destinataires ?? {}) as Record<string, unknown>;
  for (const [cle, valeur] of Object.entries(brutDest)) {
    if (!famillesConnues.has(cle as FamilleAlerte) || !Array.isArray(valeur)) continue;
    destinataires[cle as FamilleAlerte] = valeur.filter((x): x is Role => typeof x === "string" && rolesConnus.has(x as Role));
  }
  /* Une famille jamais réglée reprend son défaut : ajouter une famille au code
     ne doit pas la rendre muette pour les comptes déjà enregistrés. */
  for (const a of ALERTES) if (!(a.cle in destinataires)) destinataires[a.cle] = [...(REGLES_ALERTE_DEFAUT.destinataires[a.cle] ?? [])];

  const prevenance = Array.isArray(r.prevenance)
    ? [...new Set(r.prevenance.filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x > 0 && x <= 365))].sort((a, b) => b - a)
    : [];
  return { destinataires, prevenance: prevenance.length > 0 ? prevenance : [...REGLES_ALERTE_DEFAUT.prevenance] };
}

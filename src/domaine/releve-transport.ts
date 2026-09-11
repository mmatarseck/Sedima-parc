/* ============================================================================
 * Le relevé de transport — ce qui est parti, avec quoi, et pour combien.
 *
 * Phase 2 du chantier Transporteurs, calée le 5 septembre 2026. Le métier a
 * d'abord signalé que la structuration des livraisons relevait de l'équipe
 * logistique, puis confirmé que **l'outil logistique n'existe pas** : cette
 * application doit donc porter le suivi des transports affectés, pour permettre
 * les rapports et la facturation rattachée.
 *
 * Ce n'est pas un objet inventé pour l'occasion. La Direction des Opérations le
 * tient déjà, à la main, dans `RECAP TONNAGE HEBDOMMADAIRE.xlsx` : treize
 * semaines, une ligne par transporteur et par chauffeur, un camion immatriculé,
 * puis destination et tonnage jour par jour. On reprend ce relevé, on ne le
 * remplace pas.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * **Le mode d'exécution est le pivot.** C'est lui qui dit qui a transporté, ce
 * qu'on suit du véhicule, et ce qu'on paie :
 *
 *   parc                  → notre camion, notre chauffeur. Coût = charges fixes
 *                           du parc, aucune facture. C'est le terme de
 *                           comparaison de tout le reste.
 *   transporteur          → camion et chauffeur **du référentiel tiers**, payés
 *                           à la tonne livrée (ou à la journée en mise à
 *                           disposition). C'est ici que naît la facturation.
 *   enlèvement client     → le client vient chercher sa marchandise. On note
 *                           l'immatriculation et le chauffeur, **sans créer de
 *                           fiche** : on ne les suivra jamais.
 *   prestataire ponctuel  → il vient une fois, pour un transport précis. Même
 *                           traitement : deux champs, pas un référentiel.
 *
 * La distinction entre les deux premiers modes et les deux derniers est la règle
 * énoncée au brainstorm : **on ne crée un objet que si on doit le suivre dans le
 * temps**. Ici, elle se lit dans le type : `vehiculeId` et `camionTiers`
 * référencent ; `immatriculationLibre` et `chauffeurLibre` ne référencent rien.
 * ==========================================================================*/

import type { Ton } from "./libelles";

/* -- Qui exécute --------------------------------------------------------------- */

export type ModeExecution = "parc" | "transporteur" | "enlevement-client" | "prestataire-ponctuel";

export const MODE_EXECUTION: Record<ModeExecution, { libelle: string; precision: string; ton: Ton; externe: boolean }> = {
  parc: { libelle: "Parc SEDIMA", precision: "Notre camion, notre chauffeur — le coût est celui du parc, il n'y a pas de facture", ton: "favorable", externe: false },
  transporteur: { libelle: "Transporteur", precision: "Camion et chauffeur du transporteur, identifiés au référentiel — payé à la tonne livrée", ton: "vigilance", externe: true },
  "enlevement-client": { libelle: "Enlèvement client", precision: "Le client vient chercher sa marchandise : on note qui est passé, rien de plus", ton: "neutre", externe: false },
  "prestataire-ponctuel": { libelle: "Prestataire ponctuel", precision: "Un transport confié une fois, hors contrat et hors référentiel", ton: "defavorable", externe: true },
};

/** L'ordre d'affichage : du parc au plus lointain. */
export const MODES: ModeExecution[] = ["parc", "transporteur", "enlevement-client", "prestataire-ponctuel"];

/**
 * Ce qui est transporté. Le produit ne décide pas du tarif — c'est la
 * destination qui le fait — mais il décide de l'unité : les poulets et les œufs
 * se comptent en voyages ou en sacs, jamais en tonnes.
 */
export type ProduitTransporte = "aliment" | "son-de-ble" | "poussins" | "poulets" | "oeufs" | "phosphate" | "personnel" | "autre";

export const PRODUIT_TRANSPORTE: Record<ProduitTransporte, { libelle: string; enTonnes: boolean }> = {
  aliment: { libelle: "Aliment volaille", enTonnes: true },
  "son-de-ble": { libelle: "Son de blé", enTonnes: true },
  poussins: { libelle: "Poussins d'un jour", enTonnes: false },
  poulets: { libelle: "Poulets vifs", enTonnes: false },
  oeufs: { libelle: "Œufs", enTonnes: false },
  phosphate: { libelle: "Phosphate", enTonnes: true },
  personnel: { libelle: "Personnel", enTonnes: false },
  autre: { libelle: "Autre", enTonnes: true },
};

/* -- La ligne de relevé ---------------------------------------------------------- */

export interface LigneReleve {
  numero: string;
  date: string;
  /** « 2026-S36 » : le relevé se tient et se contrôle à la semaine. */
  semaine: string;
  mode: ModeExecution;
  /** Renseigné pour les modes « transporteur » et « prestataire ponctuel ». */
  transporteurNumero: string | null;
  transporteur: string | null;
  /** Le véhicule du parc, quand c'est le parc qui roule. */
  vehiculeId: string | null;
  /** Le camion du référentiel tiers, quand c'est un transporteur. */
  camionTiersImmatriculation: string | null;
  /**
   * L'immatriculation notée à la volée — enlèvement client, prestataire
   * ponctuel. Elle ne renvoie à aucune fiche, et c'est voulu.
   */
  immatriculationLibre: string | null;
  chauffeurLibre: string | null;
  /** Le nom du chauffeur, quel que soit le mode : c'est lui qu'on appelle. */
  chauffeur: string | null;
  origine: string;
  /** La localité réellement livrée, telle qu'elle est écrite sur le relevé. */
  destination: string;
  /** La destination de la grille à laquelle elle est rattachée, s'il y en a une. */
  destinationTarifaire: string | null;
  produit: ProduitTransporte;
  /** Le tonnage annoncé au départ. */
  tonnage: number;
  /** Le tonnage du pont bascule, quand il existe : c'est lui qui fait foi. */
  tonnagePese: number | null;
  bonLivraison: string | null;
  /** L'affrètement qui porte la facturation de ce transport, s'il y en a un. */
  affretementNumero: string | null;
}

/** Le tonnage qui fait foi : le pesage l'emporte sur l'annoncé. */
export function tonnageRetenu(l: Pick<LigneReleve, "tonnage" | "tonnagePese">): number {
  return l.tonnagePese ?? l.tonnage;
}

/** L'immatriculation à montrer, quelle que soit l'origine du camion. */
export function immatriculationDe(l: Pick<LigneReleve, "camionTiersImmatriculation" | "immatriculationLibre" | "vehiculeId">, immatDuParc?: (id: string) => string | null): string | null {
  if (l.camionTiersImmatriculation) return l.camionTiersImmatriculation;
  if (l.immatriculationLibre) return l.immatriculationLibre;
  if (l.vehiculeId && immatDuParc) return immatDuParc(l.vehiculeId);
  return null;
}

/**
 * L'écart entre le pesé et l'annoncé, en pourcentage.
 *
 * C'est le premier contrôle que permet le relevé, et il ne coûte rien : un
 * transporteur payé à la tonne annoncée n'a aucune raison de sous-déclarer, un
 * transporteur payé au pesage non plus — mais l'écart systématique d'un même
 * camion, lui, se voit.
 */
export function ecartPesee(l: Pick<LigneReleve, "tonnage" | "tonnagePese">): number | null {
  if (l.tonnagePese === null || l.tonnage === 0) return null;
  return Math.round(((l.tonnagePese - l.tonnage) / l.tonnage) * 1000) / 10;
}

/** Au-delà, l'écart de pesée mérite qu'on aille voir. */
export const SEUIL_ECART_PESEE = 3;

/* -- Ce que le relevé produit ---------------------------------------------------- */

export interface TonnagePeriode {
  /** Tonnes portées par le parc — le terme de comparaison. */
  interne: number;
  /** Tonnes confiées à des tiers : transporteurs et prestataires ponctuels. */
  externe: number;
  /** Tonnes enlevées par les clients eux-mêmes : ni nous, ni un tiers payé. */
  enlevees: number;
  total: number;
}

export function tonnagesPar(lignes: LigneReleve[]): TonnagePeriode {
  const t: TonnagePeriode = { interne: 0, externe: 0, enlevees: 0, total: 0 };
  for (const l of lignes) {
    if (!PRODUIT_TRANSPORTE[l.produit].enTonnes) continue;
    const tonnes = tonnageRetenu(l);
    t.total += tonnes;
    if (l.mode === "parc") t.interne += tonnes;
    else if (l.mode === "enlevement-client") t.enlevees += tonnes;
    else t.externe += tonnes;
  }
  return { interne: arrondi(t.interne), externe: arrondi(t.externe), enlevees: arrondi(t.enlevees), total: arrondi(t.total) };
}

/** Le premier et le dernier jour relevés ; nul pour un relevé vide. */
export function bornesDuReleve(lignes: { date: string }[]): { premier: string; dernier: string } | null {
  if (lignes.length === 0) return null;
  let premier = lignes[0]!.date;
  let dernier = premier;
  for (const l of lignes) {
    if (l.date < premier) premier = l.date;
    if (l.date > dernier) dernier = l.date;
  }
  return { premier, dernier };
}

/**
 * Le relevé couvre-t-il **toute** la période ? (11 septembre 2026)
 *
 * Le relevé réel commence le 15 juin 2026 et s'arrête au 3 septembre. Rapporter
 * les coûts d'un mois entier aux tonnes d'un demi-mois doublait le coût à la
 * tonne de juin ; le mois en cours, dont le coût court jusqu'à aujourd'hui,
 * n'a de tonnes que jusqu'au dernier voyage relevé. Une période n'a donc de
 * tonnes que si le relevé commence avant elle et finit après elle, à quelques
 * jours près — un week-end en début ou en fin de mois ne porte pas de voyage.
 *
 * Ce contrôle ne voit pas les trous **au milieu** d'une période : une semaine
 * restée presque vide dans la feuille compte comme relevée.
 */
export function releveCouvre(bornes: { premier: string; dernier: string } | null, debut: string, fin: string, margeJours = 3): boolean {
  if (!bornes) return false;
  const decaler = (jour: string, k: number) => new Date(Date.parse(`${jour}T00:00:00Z`) + k * 86_400_000).toISOString().slice(0, 10);
  return bornes.premier <= decaler(debut, margeJours) && bornes.dernier >= decaler(fin, -margeJours);
}

/**
 * Le taux d'externalisation **en tonnes**, enfin.
 *
 * C'est la réponse à la question 71 : le référentiel DO définit C_TED_EXT sur
 * les tonnes, l'application le calculait faute de mieux en coût de transport.
 * Le relevé porte les tonnages, la base juste devient possible.
 *
 * Les enlèvements client ne comptent dans aucun des deux termes : la
 * marchandise n'a été transportée ni par nous, ni par un tiers que nous payons.
 * Les inclure gonflerait artificiellement le dénominateur et ferait baisser le
 * taux sans qu'aucune décision n'ait été prise.
 */
export function tauxExternalisationTonnes(t: TonnagePeriode): number | null {
  const base = t.interne + t.externe;
  if (base <= 0) return null;
  return Math.round((t.externe / base) * 1000) / 10;
}

function arrondi(n: number): number {
  return Math.round(n * 10) / 10;
}

/** La semaine ISO d'une date, sous la forme « 2026-S36 ». */
export function semaineDe(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const jour = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - jour);
  const debutAnnee = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semaine = Math.ceil(((d.getTime() - debutAnnee.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-S${String(semaine).padStart(2, "0")}`;
}

/** « 2026-S36 » → « semaine 36, 2026 ». */
export function libelleSemaine(semaine: string): string {
  const [annee, s] = semaine.split("-S");
  return `Semaine ${Number(s)}, ${annee}`;
}

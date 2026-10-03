/* ============================================================================
 * Volumes transportés et facturation calculée — le rapport de Jacques, en mieux.
 *
 * Demande du métier du 3 octobre 2026 : « pouvoir générer un rapport comme ce
 * que Jacques envoie pour suivre les volumes transportés, en faisant le calcul
 * de facturation basé sur les tarifs fixés et la zone de rapprochement proche
 * de la zone contractuelle ».
 *
 * LA GRILLE DE LA SEMAINE. Le « RECAP TONNAGE HEBDOMADAIRE » : une ligne par
 * camion, groupée par transporteur (SEDIMA d'abord), une colonne par jour du
 * vendredi au jeudi — sa semaine —, le tonnage et la destination du jour, le
 * total du camion à droite et celui du jour en bas.
 *
 * LA FACTURATION. Chaque voyage d'un transporteur payé au voyage se facture au
 * tonnage, au prix de la grille de **ce** transporteur pour la **zone** de la
 * destination :
 *   - la destination est une zone du contrat (Thiès, Touba…) : son prix ;
 *   - sinon, la localité est rattachée à une zone (Bayakh → Notto) : le prix de
 *     cette zone — c'est la zone de rapprochement ;
 *   - une destination composée (« KM/BENT », deux déchargements) se facture à
 *     la plus chère de ses parties : c'est la plus éloignée ;
 *   - le minimum de la ligne, quand elle en a un, s'applique au voyage.
 * Ce qui ne se calcule pas se dit, et ne compte pas zéro : localité à
 * rattacher, zone sans tarif chez ce transporteur. Un camion mis à disposition
 * se facture au jour (fiche de mise à disposition) : ses tonnes comptent, pas
 * de prix à la tonne. Les voyages du parc SEDIMA n'ont pas de facture.
 * ==========================================================================*/

import { normaliserLocalite } from "./flotte-tierce";

export interface VoyageReleve {
  numero: string;
  date: string;
  /** Nul pour un voyage du parc SEDIMA. */
  transporteurNumero: string | null;
  transporteur: string;
  plaque: string;
  plaqueAffichee: string;
  /** Vrai quand la plaque est au référentiel des transporteurs ; faux pour une plaque libre. */
  camionConnu: boolean;
  type: string;
  capaciteTonnes: number | null;
  typeContrat: "voyage" | "mise-a-disposition" | "forfait" | "parc";
  chauffeur: string | null;
  origine: string;
  destination: string;
  tonnage: number;
}

export interface TarifZone {
  transporteurNumero: string;
  origine: string;
  destination: string;
  unite: "tonne" | "forfait" | "km";
  prix: number;
  minimum: number | null;
  debut: string;
  fin: string | null;
}

export interface Rattachement {
  localite: string;
  destination: string;
  motif: string | null;
}

export type StatutFacturation = "calcule" | "mad" | "forfait" | "parc" | "a-rattacher" | "sans-tarif";

export const STATUT_FACTURATION: Record<StatutFacturation, { libelle: string; precision: string }> = {
  calcule: { libelle: "Calculé", precision: "Tonnage × prix de la grille pour la zone" },
  mad: { libelle: "Mise à disposition", precision: "Facturé au jour sur la fiche de mise à disposition, pas à la tonne" },
  forfait: { libelle: "Forfait", precision: "Camion au forfait : pas de prix à la tonne" },
  parc: { libelle: "Parc SEDIMA", precision: "Camion de SEDIMA : pas de facture" },
  "a-rattacher": { libelle: "Localité à rattacher", precision: "La destination n'est ni une zone du contrat ni rattachée à une zone : Paramètres › Zones" },
  "sans-tarif": { libelle: "Zone sans tarif", precision: "La zone est connue, mais la grille de ce transporteur n'a pas de prix pour elle" },
};

export interface VoyageFacture extends VoyageReleve {
  /** La zone du contrat retenue — celle du prix. */
  zone: string | null;
  /** Comment la zone a été trouvée : directe, rattachée, ou la plus chère d'une destination composée. */
  rapprochement: "directe" | "rattachee" | "composee" | null;
  prixTonne: number | null;
  montant: number | null;
  statut: StatutFacturation;
}

/** Les parties d'une destination composée : « KM/BENT » → KM, BENT. */
function parties(destination: string): string[] {
  return destination
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
}

/** La zone d'une partie de destination : la zone du contrat elle-même, ou celle à laquelle la localité est rattachée. */
function zoneDe(partie: string, zones: Map<string, string>, rattachements: Map<string, string>): { zone: string; directe: boolean } | null {
  const cle = normaliserLocalite(partie);
  const directe = zones.get(cle);
  if (directe) return { zone: directe, directe: true };
  const rattachee = rattachements.get(cle);
  return rattachee ? { zone: rattachee, directe: false } : null;
}

export function facturer(voyages: VoyageReleve[], tarifs: TarifZone[], rattachements: Rattachement[]): VoyageFacture[] {
  /* Les zones du contrat, sous leur forme normalisée : « THIES » retrouve « Thiès ». */
  const zones = new Map(tarifs.map((t) => [normaliserLocalite(t.destination), t.destination]));
  const rattaches = new Map(rattachements.map((r) => [normaliserLocalite(r.localite), r.destination]));
  const prixDe = (v: VoyageReleve, zone: string): TarifZone | null => {
    const candidates = tarifs.filter(
      (t) => t.transporteurNumero === v.transporteurNumero && normaliserLocalite(t.origine) === normaliserLocalite(v.origine) && t.destination === zone && t.debut <= v.date && (t.fin === null || t.fin >= v.date),
    );
    return candidates.sort((a, b) => b.debut.localeCompare(a.debut))[0] ?? null;
  };

  return voyages.map((v) => {
    const morceaux = parties(v.destination).map((p) => zoneDe(p, zones, rattaches));
    const trouvees = morceaux.filter((z): z is { zone: string; directe: boolean } => z !== null);
    const base = { ...v, zone: null, rapprochement: null, prixTonne: null, montant: null } as Omit<VoyageFacture, "statut">;
    if (v.typeContrat === "parc") return { ...base, zone: trouvees[0]?.zone ?? null, statut: "parc" as const };
    if (trouvees.length === 0 || trouvees.length < morceaux.length) {
      /* Une seule partie inconnue suffit à rendre le prix douteux : on ne devine pas. */
      return { ...base, zone: trouvees[0]?.zone ?? null, statut: v.typeContrat === "mise-a-disposition" ? ("mad" as const) : v.typeContrat === "forfait" ? ("forfait" as const) : ("a-rattacher" as const) };
    }
    /* La plus chère des parties : un double déchargement se paie à la plus éloignée. */
    const tarifes = trouvees.map((z) => ({ ...z, tarif: prixDe(v, z.zone) })).sort((a, b) => (b.tarif?.prix ?? -1) - (a.tarif?.prix ?? -1));
    const retenue = tarifes[0]!;
    const rapprochement = trouvees.length > 1 ? ("composee" as const) : retenue.directe ? ("directe" as const) : ("rattachee" as const);
    if (v.typeContrat === "mise-a-disposition") return { ...base, zone: retenue.zone, rapprochement, statut: "mad" as const };
    if (v.typeContrat === "forfait") return { ...base, zone: retenue.zone, rapprochement, statut: "forfait" as const };
    const t = retenue.tarif;
    if (!t || t.unite !== "tonne") return { ...base, zone: retenue.zone, rapprochement, statut: "sans-tarif" as const };
    const montant = Math.round(Math.max(t.prix * v.tonnage, t.minimum ?? 0));
    return { ...base, zone: retenue.zone, rapprochement, prixTonne: t.prix, montant, statut: "calcule" as const };
  });
}

/* -- La facturation par transporteur ----------------------------------------------- */

export interface SyntheseTransporteur {
  transporteurNumero: string | null;
  transporteur: string;
  voyages: number;
  tonnes: number;
  tonnesCalculees: number;
  montant: number;
  /** Ce qui reste à régler avant de pouvoir facturer : localités à rattacher, zones sans tarif. */
  enSuspens: number;
  tonnesEnSuspens: number;
  tonnesMad: number;
  camions: number;
}

export function syntheseParTransporteur(voyages: VoyageFacture[]): SyntheseTransporteur[] {
  const m = new Map<string, VoyageFacture[]>();
  for (const v of voyages) m.set(v.transporteurNumero ?? "parc", [...(m.get(v.transporteurNumero ?? "parc") ?? []), v]);
  const arrondi = (x: number) => Math.round(x * 10) / 10;
  return [...m.values()]
    .map((liste) => {
      const suspens = liste.filter((v) => v.statut === "a-rattacher" || v.statut === "sans-tarif");
      return {
        transporteurNumero: liste[0]!.transporteurNumero,
        transporteur: liste[0]!.transporteur,
        voyages: liste.length,
        tonnes: arrondi(liste.reduce((s, v) => s + v.tonnage, 0)),
        tonnesCalculees: arrondi(liste.filter((v) => v.statut === "calcule").reduce((s, v) => s + v.tonnage, 0)),
        montant: liste.reduce((s, v) => s + (v.montant ?? 0), 0),
        enSuspens: suspens.length,
        tonnesEnSuspens: arrondi(suspens.reduce((s, v) => s + v.tonnage, 0)),
        tonnesMad: arrondi(liste.filter((v) => v.statut === "mad").reduce((s, v) => s + v.tonnage, 0)),
        camions: new Set(liste.map((v) => v.plaque)).size,
      };
    })
    .sort((a, b) => (a.transporteurNumero === null ? -1 : b.transporteurNumero === null ? 1 : b.tonnes - a.tonnes));
}

/* -- La grille de la semaine ---------------------------------------------------------- */

/** Le vendredi qui ouvre la semaine du relevé (vendredi → jeudi). */
export function debutSemaine(jour: string): string {
  const d = new Date(`${jour}T00:00:00Z`);
  const recul = (d.getUTCDay() - 5 + 7) % 7;
  d.setUTCDate(d.getUTCDate() - recul);
  return d.toISOString().slice(0, 10);
}

export function joursDeLaSemaine(debut: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${debut}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export interface LigneGrille {
  transporteur: string;
  transporteurNumero: string | null;
  plaque: string;
  plaqueAffichee: string;
  type: string;
  capaciteTonnes: number | null;
  chauffeur: string | null;
  /** Par jour : les voyages du jour (tonnage, destination). */
  jours: { tonnage: number; destinations: string[] }[];
  total: number;
}

export function grilleSemaine(voyages: VoyageReleve[], jours: string[]): { lignes: LigneGrille[]; totauxJour: number[]; total: number } {
  const index = new Map(jours.map((j, i) => [j, i]));
  const m = new Map<string, LigneGrille>();
  for (const v of voyages) {
    const i = index.get(v.date);
    if (i === undefined) continue;
    const cle = `${v.transporteurNumero ?? "parc"}|${v.plaque}`;
    const l = m.get(cle) ?? {
      transporteur: v.transporteur,
      transporteurNumero: v.transporteurNumero,
      plaque: v.plaque,
      plaqueAffichee: v.plaqueAffichee,
      type: v.type,
      capaciteTonnes: v.capaciteTonnes,
      chauffeur: v.chauffeur,
      jours: jours.map(() => ({ tonnage: 0, destinations: [] as string[] })),
      total: 0,
    };
    l.jours[i]!.tonnage += v.tonnage;
    l.jours[i]!.destinations.push(v.destination);
    l.total += v.tonnage;
    if (!l.chauffeur && v.chauffeur) l.chauffeur = v.chauffeur;
    m.set(cle, l);
  }
  const lignes = [...m.values()].sort(
    (a, b) => (a.transporteurNumero === null ? -1 : b.transporteurNumero === null ? 1 : a.transporteur.localeCompare(b.transporteur, "fr")) || b.total - a.total,
  );
  const totauxJour = jours.map((_, i) => Math.round(lignes.reduce((s, l) => s + l.jours[i]!.tonnage, 0) * 100) / 100);
  return { lignes, totauxJour, total: Math.round(totauxJour.reduce((s, x) => s + x, 0) * 100) / 100 };
}

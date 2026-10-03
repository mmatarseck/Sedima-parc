/* ============================================================================
 * Le point du matin — les véhicules disponibles pour les opérations du jour.
 *
 * Demande du métier du 3 octobre 2026 : « un rapport de disponibilité des
 * véhicules pour les opérations de la journée, incluant ceux des prestataires,
 * groupé par BU, comme ce que Jacques envoie tous les jours mais en mieux, en
 * indiquant les capacités dispo, et un mail prêt à être envoyé à une liste de
 * distribution ». Puis, le même jour : « mettre sous forme de tableau », et
 * les capacités qui ne se comptent pas en tonnes.
 *
 * Disponible, pour un véhicule du parc : opérationnel, au régime
 * d'exploitation, avec un chauffeur au volant aujourd'hui. Les opérationnels
 * sans chauffeur se disent à part — c'est une capacité qu'une affectation
 * libérerait. Pour un camion de transporteur : engagé, et opérationnel au
 * statut que le parc lui tient.
 *
 * LES CAPACITÉS. Un véhicule de chargement spécialisé (0073) — œufs, poussins,
 * poulettes ou poulets vifs — compte dans son unité (plateaux, milliers de
 * poussins, sujets), et non dans les tonnes : additionner la charge utile d'un
 * camion de poussins aux tonnes d'aliment ne dirait rien de ce qu'on peut
 * livrer. Les tonnes et chaque unité se totalisent chacune de leur côté.
 * ==========================================================================*/

import { CHARGEMENT_SPECIAL, capaciteSpecialeTexte, type ChargementSpecial } from "./chargement";
import type { LigneCamionTiers } from "./camions-tiers";
import type { LigneDisponibilite } from "./disponibilite";
import { BUSINESS_UNIT, STATUT_VEHICULE } from "./libelles";
import type { BusinessUnit } from "./types";

/** Les capacités d'un ensemble de véhicules : les tonnes, et chaque unité spécialisée. */
export interface Capacites {
  tonnes: number;
  speciales: Partial<Record<ChargementSpecial, number>>;
}

export interface VehiculeDuMatin {
  immatriculation: string;
  immatriculationAffichee: string;
  /** « camion », « vrac », « plateau », « pick-up », « poussins »… */
  type: string;
  capaciteTonnes: number | null;
  /** Le chargement spécialisé, qui remplace les tonnes quand il est posé. */
  special: { nature: ChargementSpecial; valeur: number | null } | null;
  chauffeur: string | null;
  href: string;
}

export interface GroupeDuMatin {
  /** « SEDIMA », ou le nom du transporteur. */
  nom: string;
  tiers: boolean;
  disponibles: VehiculeDuMatin[];
  /** Opérationnels mais sans chauffeur aujourd'hui (parc seulement). */
  sansChauffeur: VehiculeDuMatin[];
  capacites: Capacites;
}

export interface BuDuMatin {
  bu: BusinessUnit | null;
  libelle: string;
  groupes: GroupeDuMatin[];
  capacites: Capacites;
  nombre: number;
}

export interface ImmobiliseDuMatin {
  immatriculationAffichee: string;
  type: string;
  motif: string;
  /** Nul pour un véhicule du parc. */
  transporteur: string | null;
  bu: string;
  href: string;
}

export interface PointDuMatin {
  jour: string;
  bus: BuDuMatin[];
  immobilises: ImmobiliseDuMatin[];
  totalVehicules: number;
  capacites: Capacites;
  /** La part des tonnes disponibles qui roule chez les transporteurs. */
  partTiers: number;
}

const arrondi = (x: number) => Math.round(x * 10) / 10;

const TYPE_SPECIAL: Record<ChargementSpecial, string> = { oeufs: "camion à œufs", poussins: "camion à poussins", "volailles-vives": "camion de volailles" };

/* Le pluriel des types : « 2 camions à poussins », « 3 vracs », « 2 véhicules légers ». */
const PLURIEL: Record<string, string> = {
  camion: "camions", vrac: "vracs", frigo: "frigos", plateau: "plateaux", "pick-up": "pick-up", fourgon: "fourgons", bus: "bus",
  "véhicule léger": "véhicules légers", "camion à œufs": "camions à œufs", "camion à poussins": "camions à poussins", "camion de volailles": "camions de volailles",
};

/** Le type tel qu'on le dit au téléphone : vrac, plateau, pick-up, camion. */
function typeParc(l: LigneDisponibilite): string {
  if (l.chargementSpecial) return TYPE_SPECIAL[l.chargementSpecial];
  if (l.usage === "vrac") return "vrac";
  if (l.usage === "frigorifique") return "frigo";
  if (l.categorie === "tracteur" || l.categorie === "semi-remorque") return "plateau";
  if (l.categorie === "camionnette") return "pick-up";
  if (l.categorie === "vehicule-leger") return "véhicule léger";
  if (l.categorie === "bus") return "bus";
  return "camion";
}

function typeTiers(c: LigneCamionTiers): string {
  if (c.chargementSpecial) return TYPE_SPECIAL[c.chargementSpecial];
  if (c.categorie === "tracteur") return "plateau";
  if (c.categorie === "camionnette") return (c.capaciteTonnes ?? 0) > 1.5 ? "fourgon" : "pick-up";
  if (c.categorie === "vehicule-leger") return "véhicule léger";
  return "camion";
}

export function capacitesDe(liste: VehiculeDuMatin[]): Capacites {
  const speciales: Partial<Record<ChargementSpecial, number>> = {};
  let tonnes = 0;
  for (const v of liste) {
    if (v.special) {
      if (v.special.valeur) speciales[v.special.nature] = arrondi((speciales[v.special.nature] ?? 0) + v.special.valeur);
    } else tonnes += v.capaciteTonnes ?? 0;
  }
  return { tonnes: arrondi(tonnes), speciales };
}

function additionner(a: Capacites, b: Capacites): Capacites {
  const speciales = { ...a.speciales };
  for (const [k, v] of Object.entries(b.speciales) as [ChargementSpecial, number][]) speciales[k] = arrondi((speciales[k] ?? 0) + v);
  return { tonnes: arrondi(a.tonnes + b.tonnes), speciales };
}

const VIDE: Capacites = { tonnes: 0, speciales: {} };

function grouperParBu<T>(liste: T[], bu: (x: T) => BusinessUnit | null): Map<BusinessUnit | null, T[]> {
  const m = new Map<BusinessUnit | null, T[]>();
  for (const x of liste) m.set(bu(x), [...(m.get(bu(x)) ?? []), x]);
  return m;
}

export function pointDuMatin(parc: LigneDisponibilite[], camions: LigneCamionTiers[], jour: string): PointDuMatin {
  const exploitation = parc.filter((l) => l.regime === "exploitation" && l.etat !== "hors-perimetre");
  const pretsParc = exploitation.filter((l) => l.etat === "pret");
  const sansParc = exploitation.filter((l) => l.etat === "sans-conducteur" || l.etat === "conducteur-empeche");
  const engages = camions.filter((c) => c.actif);
  const operationnel = (c: LigneCamionTiers) => STATUT_VEHICULE[c.statut]?.operationnel ?? true;
  const pretsTiers = engages.filter(operationnel);

  const versParc = (l: LigneDisponibilite): VehiculeDuMatin => ({
    immatriculation: l.immatriculation,
    immatriculationAffichee: l.immatriculationAffichee,
    type: typeParc(l),
    capaciteTonnes: l.chargeUtile ? arrondi(l.chargeUtile / 1000) : null,
    special: l.chargementSpecial ? { nature: l.chargementSpecial, valeur: l.capaciteSpeciale ?? null } : null,
    /* En deux quarts (0074) : « matin X · soir Y ». */
    chauffeur: l.conducteur?.quarts?.length ? l.conducteur.quarts.map((q) => `${q.quart} ${q.nom}`).join(" · ") : (l.conducteur?.nom ?? null),
    href: `/flotte/${l.immatriculation}`,
  });
  const versTiers = (c: LigneCamionTiers): VehiculeDuMatin => ({
    immatriculation: c.immatriculation,
    immatriculationAffichee: c.immatriculationAffichee,
    type: typeTiers(c),
    capaciteTonnes: c.capaciteTonnes,
    special: c.chargementSpecial ? { nature: c.chargementSpecial, valeur: c.capaciteSpeciale } : null,
    chauffeur: c.chauffeur?.nom ?? c.chauffeurReleve,
    href: `/transporteurs/camions/${c.immatriculation}`,
  });
  const parCapacite = (a: VehiculeDuMatin, b: VehiculeDuMatin) => (b.capaciteTonnes ?? 0) - (a.capaciteTonnes ?? 0) || a.immatriculation.localeCompare(b.immatriculation);

  const prets = grouperParBu(pretsParc, (l) => l.businessUnit);
  const sans = grouperParBu(sansParc, (l) => l.businessUnit);
  const tiers = grouperParBu(pretsTiers, (c) => c.businessUnit);
  const cles = new Set<BusinessUnit | null>([...prets.keys(), ...sans.keys(), ...tiers.keys()]);
  const ordre = Object.keys(BUSINESS_UNIT) as BusinessUnit[];

  const bus: BuDuMatin[] = [...cles]
    .sort((a, b) => (a === null ? 1 : b === null ? -1 : ordre.indexOf(a) - ordre.indexOf(b)))
    .map((bu) => {
      const groupes: GroupeDuMatin[] = [];
      const dispoParc = (prets.get(bu) ?? []).map(versParc).sort(parCapacite);
      const sansChauffeur = (sans.get(bu) ?? []).map(versParc).sort(parCapacite);
      if (dispoParc.length || sansChauffeur.length) groupes.push({ nom: "SEDIMA", tiers: false, disponibles: dispoParc, sansChauffeur, capacites: capacitesDe(dispoParc) });
      const parTransporteur = new Map<string, LigneCamionTiers[]>();
      for (const c of tiers.get(bu) ?? []) parTransporteur.set(c.transporteur, [...(parTransporteur.get(c.transporteur) ?? []), c]);
      for (const [nom, liste] of [...parTransporteur].sort((a, b) => a[0].localeCompare(b[0], "fr"))) {
        const dispo = liste.map(versTiers).sort(parCapacite);
        groupes.push({ nom, tiers: true, disponibles: dispo, sansChauffeur: [], capacites: capacitesDe(dispo) });
      }
      return {
        bu,
        libelle: bu ? BUSINESS_UNIT[bu] : "BU non renseignée",
        groupes,
        capacites: groupes.reduce((s, g) => additionner(s, g.capacites), VIDE),
        nombre: groupes.reduce((s, g) => s + g.disponibles.length, 0),
      };
    });

  const libelleBu = (bu: BusinessUnit | null) => (bu ? BUSINESS_UNIT[bu] : "—");
  const immobilises: ImmobiliseDuMatin[] = [
    ...exploitation
      .filter((l) => l.etat === "immobilise")
      .map((l) => ({ immatriculationAffichee: l.immatriculationAffichee, type: typeParc(l), motif: STATUT_VEHICULE[l.statutEffectif].libelle, transporteur: null, bu: libelleBu(l.businessUnit), href: `/flotte/${l.immatriculation}` })),
    ...engages
      .filter((c) => !operationnel(c))
      .map((c) => ({ immatriculationAffichee: c.immatriculationAffichee, type: typeTiers(c), motif: STATUT_VEHICULE[c.statut]?.libelle ?? c.statut, transporteur: c.transporteur, bu: libelleBu(c.businessUnit), href: `/transporteurs/camions/${c.immatriculation}` })),
  ];
  const capacites = bus.reduce((s, b) => additionner(s, b.capacites), VIDE);
  const tonnesTiers = bus.flatMap((b) => b.groupes.filter((g) => g.tiers)).reduce((s, g) => s + g.capacites.tonnes, 0);
  return { jour, bus, immobilises, totalVehicules: bus.reduce((s, b) => s + b.nombre, 0), capacites, partTiers: capacites.tonnes ? Math.round((tonnesTiers / capacites.tonnes) * 100) : 0 };
}

/* -- Les textes ----------------------------------------------------------------- */

const t = (x: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(x).replace(/ /g, " ")} t`;

/** « 245 t · 40 k poussins · 1 200 plateaux » ; « — » quand rien. */
export function texteCapacites(c: Capacites): string {
  const parties = [c.tonnes ? t(c.tonnes) : null, ...(Object.entries(c.speciales) as [ChargementSpecial, number][]).map(([n, v]) => capaciteSpecialeTexte(n, v))].filter(Boolean);
  return parties.length ? parties.join(" · ") : "—";
}

/** La capacité d'un véhicule, dans son unité. */
export function texteCapaciteVehicule(v: VehiculeDuMatin): string {
  if (v.special) return v.special.valeur ? capaciteSpecialeTexte(v.special.nature, v.special.valeur) : `${CHARGEMENT_SPECIAL[v.special.nature].unite} ?`;
  return v.capaciteTonnes ? t(v.capaciteTonnes) : "—";
}

/** « 3 camions, 2 vracs, 1 pick-up » : la composition, à la manière du message de Jacques. */
export function resumeGroupe(liste: VehiculeDuMatin[]): string {
  const m = new Map<string, number>();
  for (const v of liste) m.set(v.type, (m.get(v.type) ?? 0) + 1);
  return [...m].map(([type, n]) => `${n} ${n > 1 ? (PLURIEL[type] ?? type) : type}`).join(", ");
}

export function sujetCourriel(p: PointDuMatin, jourLong: string): string {
  return `Véhicules disponibles ce matin — ${jourLong} — ${p.totalVehicules} véhicules, ${texteCapacites(p.capacites)}`;
}

/** Le corps en texte : pour la messagerie qui ne reçoit que du texte. */
export function texteCourriel(p: PointDuMatin, jourLong: string): string {
  const lignes: string[] = ["Bonjour à tous,", "", `Voici les véhicules disponibles ce matin, ${jourLong}.`, ""];
  for (const b of p.bus) {
    lignes.push(`${b.libelle.toUpperCase()} — ${b.nombre} véhicule${b.nombre > 1 ? "s" : ""} · ${texteCapacites(b.capacites)}`);
    for (const g of b.groupes) {
      lignes.push(`   ${g.nom} : ${g.disponibles.length ? `${resumeGroupe(g.disponibles)} (${texteCapacites(g.capacites)})` : "aucun véhicule prêt"}`);
      if (g.disponibles.length) lignes.push(`      ${g.disponibles.map((v) => `${v.immatriculationAffichee} ${texteCapaciteVehicule(v)}${v.chauffeur ? ` (${v.chauffeur})` : ""}`).join(" ; ")}`);
      if (g.sansChauffeur.length) lignes.push(`      sans chauffeur : ${g.sansChauffeur.map((v) => v.immatriculationAffichee).join(", ")}`);
    }
    lignes.push("");
  }
  lignes.push(`TOTAL : ${p.totalVehicules} véhicules · ${texteCapacites(p.capacites)} (${p.partTiers} % des tonnes chez les transporteurs)`);
  if (p.immobilises.length) lignes.push("", `Immobilisés : ${p.immobilises.map((i) => `${i.immatriculationAffichee}${i.transporteur ? ` (${i.transporteur})` : ""} — ${i.motif.toLowerCase()}`).join(" ; ")}`);
  lignes.push("", "Cordialement,");
  return lignes.join("\n");
}

const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Le même point en tableau HTML, à coller dans Outlook : un vrai tableau, avec
 * ses bordures et ses en-têtes, que la messagerie garde tel quel.
 */
export function tableauHtml(p: PointDuMatin, jourLong: string): string {
  const cel = "border:1px solid #d0d5dd;padding:6px 10px;font:13px Calibri,Arial,sans-serif;vertical-align:top";
  const ent = `${cel};background:#f2f4f7;font-weight:bold;text-align:left`;
  const lignes: string[] = [];
  for (const b of p.bus) {
    lignes.push(`<tr><td colspan="5" style="${cel};background:#e8f1ec;font-weight:bold">${echapper(b.libelle)} — ${b.nombre} véhicule${b.nombre > 1 ? "s" : ""} · ${echapper(texteCapacites(b.capacites))}</td></tr>`);
    for (const g of b.groupes) {
      const detail = g.disponibles.map((v) => `${echapper(v.immatriculationAffichee)} ${echapper(texteCapaciteVehicule(v))}${v.chauffeur ? ` <span style="color:#667085">(${echapper(v.chauffeur)})</span>` : ""}`).join("<br>");
      lignes.push(
        `<tr><td style="${cel};font-weight:bold">${echapper(g.nom)}</td><td style="${cel};text-align:right">${g.disponibles.length}</td><td style="${cel}">${echapper(g.disponibles.length ? resumeGroupe(g.disponibles) : "aucun véhicule prêt")}</td><td style="${cel};text-align:right;white-space:nowrap">${echapper(texteCapacites(g.capacites))}</td><td style="${cel}">${detail}${g.sansChauffeur.length ? `<br><span style="color:#b54708">Sans chauffeur : ${g.sansChauffeur.map((v) => echapper(v.immatriculationAffichee)).join(", ")}</span>` : ""}</td></tr>`,
      );
    }
  }
  lignes.push(`<tr><td style="${ent}">Total</td><td style="${ent};text-align:right">${p.totalVehicules}</td><td style="${ent}"></td><td style="${ent};text-align:right;white-space:nowrap">${echapper(texteCapacites(p.capacites))}</td><td style="${ent}">${p.partTiers} % des tonnes chez les transporteurs</td></tr>`);
  const immobilises = p.immobilises.length
    ? `<p style="font:13px Calibri,Arial,sans-serif;margin:12px 0 4px"><b>Immobilisés (${p.immobilises.length})</b> : ${p.immobilises.map((i) => `${echapper(i.immatriculationAffichee)}${i.transporteur ? ` (${echapper(i.transporteur)})` : ""} — ${echapper(i.motif.toLowerCase())}`).join(" ; ")}</p>`
    : "";
  return `<p style="font:13px Calibri,Arial,sans-serif">Véhicules disponibles ce matin, ${echapper(jourLong)} :</p><table style="border-collapse:collapse"><thead><tr><th style="${ent}">Parc ou transporteur</th><th style="${ent}">Prêts</th><th style="${ent}">Composition</th><th style="${ent}">Capacité</th><th style="${ent}">Véhicules et chauffeurs</th></tr></thead><tbody>${lignes.join("")}</tbody></table>${immobilises}`;
}

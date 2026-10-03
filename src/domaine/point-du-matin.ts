/* ============================================================================
 * Le point du matin — les véhicules disponibles pour les opérations du jour.
 *
 * Demande du métier du 3 octobre 2026 : « un rapport de disponibilité des
 * véhicules pour les opérations de la journée, incluant ceux des prestataires,
 * groupé par BU, comme ce que Jacques envoie tous les jours mais en mieux, en
 * indiquant les capacités dispo, et un mail prêt à être envoyé à une liste de
 * distribution ».
 *
 * Le message de Jacques dit, chaque matin : « SEDIMA 3 camions + 3 vracs +
 * 2 pickups ; ADEX 1 plateau 35 T + 1 camion 10 T… ». On dit la même chose,
 * tiré des statuts plutôt que recompté à la main, et mieux : par business
 * unit, avec la capacité de chaque groupe, la plaque et le chauffeur de
 * chaque véhicule, et ce qui est immobilisé.
 *
 * Disponible, pour un véhicule du parc : opérationnel, au régime
 * d'exploitation, avec un chauffeur au volant aujourd'hui. Les opérationnels
 * sans chauffeur se disent à part — c'est une capacité qu'une affectation
 * libérerait. Pour un camion de transporteur : engagé, et opérationnel au
 * statut que le parc lui tient.
 * ==========================================================================*/

import type { LigneDisponibilite } from "./disponibilite";
import type { LigneCamionTiers } from "./camions-tiers";
import { BUSINESS_UNIT, STATUT_VEHICULE } from "./libelles";
import type { BusinessUnit } from "./types";

export interface VehiculeDuMatin {
  immatriculation: string;
  immatriculationAffichee: string;
  /** « camion », « vrac », « plateau », « pick-up »… */
  type: string;
  capaciteTonnes: number | null;
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
  capaciteTonnes: number;
}

export interface BuDuMatin {
  bu: BusinessUnit | null;
  libelle: string;
  groupes: GroupeDuMatin[];
  capaciteTonnes: number;
  nombre: number;
}

export interface PointDuMatin {
  jour: string;
  bus: BuDuMatin[];
  immobilises: { immatriculationAffichee: string; type: string; motif: string; transporteur: string | null; href: string }[];
  totalVehicules: number;
  totalCapacite: number;
  partTiers: number;
}

const arrondi = (x: number) => Math.round(x * 10) / 10;

/** Le type tel qu'on le dit au téléphone : vrac, plateau, pick-up, camion. */
function typeParc(l: LigneDisponibilite): string {
  if (l.usage === "vrac") return "vrac";
  if (l.usage === "frigorifique") return "frigo";
  if (l.categorie === "tracteur" || l.categorie === "semi-remorque") return "plateau";
  if (l.categorie === "camionnette") return "pick-up";
  if (l.categorie === "vehicule-leger") return "véhicule léger";
  if (l.categorie === "bus") return "bus";
  return "camion";
}

function typeTiers(c: LigneCamionTiers): string {
  if (c.categorie === "tracteur") return "plateau";
  if (c.categorie === "camionnette") return (c.capaciteTonnes ?? 0) > 1.5 ? "fourgon" : "pick-up";
  if (c.categorie === "vehicule-leger") return "véhicule léger";
  return "camion";
}

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
    chauffeur: l.conducteur?.nom ?? null,
    href: `/flotte/${l.immatriculation}`,
  });
  const versTiers = (c: LigneCamionTiers): VehiculeDuMatin => ({
    immatriculation: c.immatriculation,
    immatriculationAffichee: c.immatriculationAffichee,
    type: typeTiers(c),
    capaciteTonnes: c.capaciteTonnes,
    chauffeur: c.chauffeur?.nom ?? c.chauffeurReleve,
    href: `/transporteurs/camions/${c.immatriculation}`,
  });
  const capacite = (liste: VehiculeDuMatin[]) => arrondi(liste.reduce((s, v) => s + (v.capaciteTonnes ?? 0), 0));
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
      if (dispoParc.length || sansChauffeur.length) groupes.push({ nom: "SEDIMA", tiers: false, disponibles: dispoParc, sansChauffeur, capaciteTonnes: capacite(dispoParc) });
      const parTransporteur = new Map<string, LigneCamionTiers[]>();
      for (const c of tiers.get(bu) ?? []) parTransporteur.set(c.transporteur, [...(parTransporteur.get(c.transporteur) ?? []), c]);
      for (const [nom, liste] of [...parTransporteur].sort((a, b) => a[0].localeCompare(b[0], "fr"))) {
        const dispo = liste.map(versTiers).sort(parCapacite);
        groupes.push({ nom, tiers: true, disponibles: dispo, sansChauffeur: [], capaciteTonnes: capacite(dispo) });
      }
      const tous = groupes.flatMap((g) => g.disponibles);
      return { bu, libelle: bu ? BUSINESS_UNIT[bu] : "Business unit non renseignée", groupes, capaciteTonnes: capacite(tous), nombre: tous.length };
    });

  const immobilises = [
    ...exploitation
      .filter((l) => l.etat === "immobilise")
      .map((l) => ({ immatriculationAffichee: l.immatriculationAffichee, type: typeParc(l), motif: STATUT_VEHICULE[l.statutEffectif].libelle.toLowerCase(), transporteur: null, href: `/flotte/${l.immatriculation}` })),
    ...engages.filter((c) => !operationnel(c)).map((c) => ({ immatriculationAffichee: c.immatriculationAffichee, type: typeTiers(c), motif: (STATUT_VEHICULE[c.statut]?.libelle ?? c.statut).toLowerCase(), transporteur: c.transporteur, href: `/transporteurs/camions/${c.immatriculation}` })),
  ];
  const totalVehicules = bus.reduce((s, b) => s + b.nombre, 0);
  const totalCapacite = arrondi(bus.reduce((s, b) => s + b.capaciteTonnes, 0));
  const capaciteTiers = arrondi(bus.flatMap((b) => b.groupes.filter((g) => g.tiers)).reduce((s, g) => s + g.capaciteTonnes, 0));
  return { jour, bus, immobilises, totalVehicules, totalCapacite, partTiers: totalCapacite ? Math.round((capaciteTiers / totalCapacite) * 100) : 0 };
}

/* -- Le texte du courriel -------------------------------------------------------- */

const t = (x: number) => `${String(x).replace(".", ",")} t`;

/** « 3 camions 20 t, 2 vracs, 1 pick-up » : le résumé à la manière du message de Jacques, capacités comprises. */
export function resumeGroupe(liste: VehiculeDuMatin[]): string {
  const m = new Map<string, number>();
  for (const v of liste) {
    const cle = `${v.type}${v.capaciteTonnes ? ` ${t(v.capaciteTonnes)}` : ""}`;
    m.set(cle, (m.get(cle) ?? 0) + 1);
  }
  return [...m].map(([cle, n]) => {
    const [type, ...reste] = cle.split(" ");
    const pluriel = n > 1 && !/[sx]$/.test(type!) && type !== "véhicule" ? `${type}s` : type;
    return `${n} ${pluriel}${reste.length ? ` ${reste.join(" ")}` : ""}`;
  }).join(", ");
}

export function sujetCourriel(p: PointDuMatin, jourLong: string): string {
  return `Véhicules disponibles ce matin — ${jourLong} — ${p.totalVehicules} véhicules, ${t(p.totalCapacite)}`;
}

export function texteCourriel(p: PointDuMatin, jourLong: string, signature: string | null): string {
  const lignes: string[] = ["Bonjour à tous,", "", `Voici les véhicules disponibles ce matin, ${jourLong}, par business unit.`, ""];
  for (const b of p.bus) {
    if (b.nombre === 0 && b.groupes.every((g) => g.sansChauffeur.length === 0)) continue;
    lignes.push(`■ ${b.libelle.toUpperCase()} — ${b.nombre} véhicule${b.nombre > 1 ? "s" : ""}, ${t(b.capaciteTonnes)} de capacité`);
    for (const g of b.groupes) {
      if (g.disponibles.length === 0 && g.sansChauffeur.length === 0) continue;
      lignes.push(`  ${g.nom} : ${g.disponibles.length ? `${resumeGroupe(g.disponibles)} — ${t(g.capaciteTonnes)}` : "aucun véhicule prêt"}`);
      for (const v of g.disponibles) lignes.push(`     · ${v.immatriculationAffichee} ${v.type}${v.capaciteTonnes ? ` ${t(v.capaciteTonnes)}` : ""}${v.chauffeur ? ` — ${v.chauffeur}` : ""}`);
      if (g.sansChauffeur.length) lignes.push(`     + sans chauffeur ce matin : ${g.sansChauffeur.map((v) => `${v.immatriculationAffichee} (${v.type})`).join(", ")}`);
    }
    lignes.push("");
  }
  lignes.push(`TOTAL : ${p.totalVehicules} véhicules disponibles, ${t(p.totalCapacite)} de capacité, dont ${p.partTiers} % chez les transporteurs.`);
  if (p.immobilises.length) {
    lignes.push("", `Immobilisés (${p.immobilises.length}) :`);
    for (const i of p.immobilises) lignes.push(`  · ${i.immatriculationAffichee} ${i.type}${i.transporteur ? ` (${i.transporteur})` : ""} — ${i.motif}`);
  }
  lignes.push("", "Cordialement,");
  if (signature) lignes.push(signature);
  return lignes.join("\n");
}

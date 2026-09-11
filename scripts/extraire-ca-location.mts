/* ============================================================================
 * Le « CA provisoire » d'août 2026 des transporteurs, lu et confronté au relevé.
 *
 * `61. Gestion Parc/BIRAHIME FALL/CA PROVISOIRE AOUT 2026 LOCATION.xlsx` tient,
 * pour le mois d'août, ce que chaque transporteur facturera :
 *
 *   * une feuille récapitulative, un montant par transporteur ;
 *   * le détail **voyage par voyage** d'A. Dieng et de Sokhna Diop : date,
 *     camion, client, tare, poids brut, poids net au pont bascule, tarif à la
 *     tonne, montant ;
 *   * le détail d'ADEX en **jours facturés** × prix du jour, par camion.
 *
 * Ce script ne charge rien. Il lit, vérifie ce que la feuille affirme — le net
 * est-il brut moins tare, le montant est-il net × tarif, les totaux tombent-ils
 * juste —, repère les voyages saisis deux fois, et **confronte chaque voyage
 * au relevé de tonnage hebdomadaire** : même camion, même jour. Deux sources
 * tenues par deux personnes qui disent la même chose se valident l'une l'autre ;
 * là où elles divergent, l'une des deux se trompe.
 *
 * Lancer : npx tsx scripts/extraire-ca-location.mts
 * ==========================================================================*/
import { pathToFileURL } from "node:url";
import { SOURCES_RECAP, lireRecap } from "./extraire-recap-tonnage.mts";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";

export const SOURCE_CA = "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/61. Gestion Parc/BIRAHIME FALL/CA PROVISOIRE AOUT 2026 LOCATION.xlsx";

/** Les plaques mal tapées dans la feuille, redressées vers le référentiel tiers. */
export const COQUILLES_CA: Record<string, string> = { DL7179E: "DK7179E", AB287GF: "AB287GR", AA287GR: "AB287GR", AA909DZ: "AA909AZ" };

export interface VoyageFacture {
  feuille: string;
  ligne: number;
  date: string;
  plaque: string;
  client: string;
  tare: number;
  brut: number;
  /** Poids net au pont bascule, en kilos. */
  net: number;
  produit: string | null;
  /** Tarif à la tonne, hors taxe. */
  tarif: number;
  /** Montant hors taxe, tel que la feuille l'écrit. */
  montant: number;
}

export interface JoursFactures {
  libelle: string;
  plaque: string | null;
  jours: number;
  prixJour: number;
  montant: number;
}

export interface LectureCa {
  voyages: VoyageFacture[];
  adex: JoursFactures[];
  totaux: Record<string, { ht: number | null; taxe: number | null; ttc: number | null }>;
  recapitulatif: { transporteur: string; montant: number }[];
  anomalies: string[];
}

const texte = (c: Cellule | undefined) => String(c ?? "").trim();
const nombre = (c: Cellule | undefined) => (typeof c === "number" ? c : null);
const plaqueDe = (s: string) => {
  const p = s.replace(/^TATA\s+IMAT\s*/i, "").replace(/[\s-]/g, "").toUpperCase();
  return COQUILLES_CA[p] ?? p;
};

export function lireCa(source = SOURCE_CA): LectureCa {
  const feuilles = lireClasseur(source);
  const anomalies: string[] = [];
  const voyages: VoyageFacture[] = [];
  const totaux: LectureCa["totaux"] = {};

  for (const nom of ["AB DIENG", "SOKHNA"]) {
    const f = feuilles.find((x) => x.nom === nom);
    if (!f) {
      anomalies.push(`feuille « ${nom} » absente`);
      continue;
    }
    const pieds: number[] = [];
    f.lignes.forEach((l, i) => {
      const d = l.findIndex((c) => /^\d{4}-\d{2}-\d{2}$/.test(texte(c)));
      if (d < 0) {
        /* Les lignes de pied : un seul nombre, en dernière colonne. */
        const valeurs = l.map(nombre).filter((x): x is number => x !== null);
        if (valeurs.length === 1 && l.filter((c) => texte(c) !== "").length === 1 && valeurs[0]! > 100_000) pieds.push(valeurs[0]!);
        return;
      }
      const [tare, brut, net] = [nombre(l[d + 3]), nombre(l[d + 4]), nombre(l[d + 5])];
      const aProduit = typeof l[d + 6] === "string";
      const tarif = nombre(l[d + (aProduit ? 7 : 6)]);
      const montant = nombre(l[d + (aProduit ? 8 : 7)]);
      if (tare === null || brut === null || net === null || tarif === null || montant === null) {
        anomalies.push(`« ${nom} » ligne ${i + 1} : voyage incomplet, ignoré`);
        return;
      }
      const v: VoyageFacture = { feuille: nom, ligne: i + 1, date: texte(l[d]), plaque: plaqueDe(texte(l[d + 1])), client: texte(l[d + 2]).replace(/\s+/g, " "), tare, brut, net, produit: aProduit ? texte(l[d + 6]) : null, tarif, montant: Math.round(montant) };
      if (brut - tare !== net) anomalies.push(`« ${nom} » ${v.date} ${v.plaque} : net ${net} kg, mais brut − tare = ${brut - tare} kg`);
      const attendu = Math.round((net / 1000) * tarif);
      if (Math.abs(attendu - v.montant) > 1) anomalies.push(`« ${nom} » ${v.date} ${v.plaque} : montant ${v.montant} F, mais ${net / 1000} t × ${tarif} F = ${attendu} F (arrondi à la tonne ?)`);
      voyages.push(v);
    });
    totaux[nom] = { ht: pieds[0] ?? null, taxe: pieds[1] ?? null, ttc: pieds[2] ?? null };
  }

  const adex: JoursFactures[] = [];
  const fa = feuilles.find((x) => x.nom === "ADEX");
  if (fa) {
    const pieds: number[] = [];
    for (const l of fa.lignes) {
      const libelle = texte(l[1]);
      if (!libelle) {
        const m = nombre(l[4]);
        if (m !== null) pieds.push(m);
        continue;
      }
      const [jours, prixJour, montant] = [nombre(l[2]) ?? 0, nombre(l[3]) ?? 0, nombre(l[4]) ?? 0];
      const plaque = /[A-Z]{2}-?\s?\d{3}-?\s?[A-Z]{2}/i.exec(libelle.replace(/IMAT\s*/i, ""))?.[0];
      adex.push({ libelle, plaque: plaque ? plaqueDe(plaque) : null, jours, prixJour, montant });
      if (jours * prixJour !== montant) anomalies.push(`ADEX « ${libelle} » : ${jours} j × ${prixJour} F ≠ ${montant} F`);
    }
    totaux.ADEX = { ht: pieds[0] ?? null, taxe: pieds[1] ?? null, ttc: pieds[2] ?? null };
  }

  const recapitulatif: LectureCa["recapitulatif"] = [];
  const fr = feuilles.find((x) => /^CA PROVISOIRE/i.test(x.nom));
  for (const l of fr?.lignes ?? []) {
    const [nom, montant] = [texte(l[0]), nombre(l[1])];
    if (nom && montant !== null) recapitulatif.push({ transporteur: nom, montant: Math.round(montant * 100) / 100 });
  }

  /* Les totaux : la somme des lignes, puis la taxe, puis ce que le récapitulatif reprend. */
  for (const [nom, t] of Object.entries(totaux)) {
    const somme = nom === "ADEX" ? adex.reduce((s, x) => s + x.montant, 0) : voyages.filter((v) => v.feuille === nom).reduce((s, v) => s + v.montant, 0);
    if (t.ht !== null && Math.abs(t.ht - somme) > 1) anomalies.push(`« ${nom} » : total hors taxe ${t.ht} F, mais les lignes font ${somme} F`);
    if (t.ht !== null && t.taxe !== null && Math.abs(t.taxe - t.ht * 0.18) > 1) anomalies.push(`« ${nom} » : la taxe ${t.taxe} F n'est pas 18 % du hors taxe`);
  }
  const cle = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "");
  for (const [nom, alias] of [["AB DIENG", "ABDDIENG"], ["SOKHNA", "SOKHNA"], ["ADEX", "ADEX"]] as const) {
    const r = recapitulatif.find((x) => cle(x.transporteur) === alias);
    const ttc = totaux[nom]?.ttc;
    if (r && ttc !== null && ttc !== undefined && Math.abs(r.montant - ttc) > 1) anomalies.push(`récapitulatif : ${r.transporteur} ${r.montant} F, mais sa feuille totalise ${ttc} F TTC (écart ${Math.round(r.montant - ttc)} F)`);
  }

  /* Deux pesées identiques — même camion, même jour, même tare, même brut — sont une saisie en double. */
  const vues = new Map<string, VoyageFacture>();
  for (const v of voyages) {
    const k = `${v.feuille}|${v.date}|${v.plaque}|${v.tare}|${v.brut}`;
    const premier = vues.get(k);
    if (premier) anomalies.push(`« ${v.feuille} » ${v.date} ${v.plaque} : pesée identique aux lignes ${premier.ligne} et ${v.ligne} (tare ${v.tare}, brut ${v.brut}) — ${v.montant} F en double ?`);
    else vues.set(k, v);
  }
  return { voyages, adex, totaux, recapitulatif, anomalies };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const ca = lireCa();
  console.log(`${ca.voyages.length} voyages facturés au détail, ${ca.adex.length} lignes de jours ADEX, ${ca.recapitulatif.length} lignes au récapitulatif`);
  for (const [nom, t] of Object.entries(ca.totaux)) console.log(`  ${nom.padEnd(9)} HT ${t.ht} · taxe ${t.taxe} · TTC ${t.ttc}`);
  const totalRecap = ca.recapitulatif.filter((r) => r.transporteur !== "").reduce((s, r) => s + r.montant, 0);
  console.log(`  récapitulatif : ${ca.recapitulatif.map((r) => `${r.transporteur} ${Math.round(r.montant)}`).join(" · ")} (somme des lignes ${Math.round(totalRecap)})`);

  /* -- Confrontation au relevé de tonnage ---------------------------------- */
  const recap = lireRecap(SOURCES_RECAP[0]!);
  const COQUILLES_RELEVE: Record<string, string> = { AA383JZ: "AA383GZ" };
  const TRANSPORTEUR: Record<string, string> = { "AB DIENG": "A DIENG", SOKHNA: "SOKHNA DIOP" };
  const plusJours = (d: string, k: number) => new Date(Date.parse(`${d}T00:00:00Z`) + k * 86_400_000).toISOString().slice(0, 10);
  const releve = recap.voyages
    .filter((v) => v.date >= "2026-08-01" && v.date <= "2026-08-31")
    .map((v) => ({ ...v, plaque: v.immatriculation ? (COQUILLES_RELEVE[v.immatriculation] ?? v.immatriculation) : null, pris: false }));

  for (const feuille of ["AB DIENG", "SOKHNA"]) {
    const transporteur = TRANSPORTEUR[feuille]!;
    const siens = releve.filter((r) => r.transporteur === transporteur);
    const factures = ca.voyages.filter((v) => v.feuille === feuille);
    let exact = 0;
    let decale = 0;
    const orphelins: string[] = [];
    const ecartsPoids: number[] = [];
    for (const v of factures) {
      let r = siens.find((x) => !x.pris && x.plaque === v.plaque && x.date === v.date);
      if (r) exact++;
      else {
        r = siens.find((x) => !x.pris && x.plaque === v.plaque && (x.date === plusJours(v.date, -1) || x.date === plusJours(v.date, 1)));
        if (r) decale++;
      }
      if (r) {
        r.pris = true;
        ecartsPoids.push(r.tonnage - v.net / 1000);
      } else orphelins.push(`${v.date} ${v.plaque} ${v.net / 1000} t ${v.client}`);
    }
    const nonFactures = siens.filter((x) => !x.pris);
    console.log(`\n${feuille} — ${factures.length} voyages facturés, ${siens.length} au relevé d'août`);
    console.log(`  ${exact} retrouvés le même jour, ${decale} à un jour près, ${orphelins.length} absents du relevé, ${nonFactures.length} voyages relevés sans facture`);
    if (ecartsPoids.length) {
      const moyen = ecartsPoids.reduce((s, x) => s + x, 0) / ecartsPoids.length;
      console.log(`  relevé − pesée : écart moyen ${Math.round(moyen * 100) / 100} t, de ${Math.round(Math.min(...ecartsPoids) * 100) / 100} à ${Math.round(Math.max(...ecartsPoids) * 100) / 100} t`);
    }
    for (const o of orphelins) console.log(`    facturé, absent du relevé : ${o}`);
    for (const n of nonFactures) console.log(`    relevé, absent de la facture : ${n.date} ${n.plaque ?? "sans plaque"} ${n.tonnage} t ${n.destination ?? ""}`);
  }

  console.log("\nADEX — jours facturés :");
  for (const a of ca.adex) console.log(`  ${a.libelle.padEnd(30)} ${String(a.jours).padStart(3)} j × ${String(a.prixJour).padStart(6)} = ${a.montant} · ${releve.filter((r) => r.transporteur === "ADEX" && r.plaque === a.plaque).length} voyage(s) au relevé d'août`);

  console.log(`\n${ca.anomalies.length} anomalie(s) :`);
  for (const a of ca.anomalies) console.log(`  ${a}`);
}

/* ============================================================================
 * Le relevé de tonnage hebdomadaire, lu tel que la Direction des Opérations le
 * tient : `RECAP TONNAGE HEBDOMMADAIRE.28.2.xlsx`.
 *
 * Une feuille par semaine. Deux lignes de titre (le mois, puis « SEMAINE DU 14
 * AU 20-08 »), un en-tête sur trois lignes — transporteurs, chauffeurs, puis
 * pour chaque jour une paire tonnage / destination, puis l'immatriculation, la
 * capacité et le téléphone. Le transporteur n'est écrit que sur la première
 * ligne de son bloc. La dernière ligne, « TONNAGE JOURNALIER », totalise chaque
 * jour : c'est le contrôle de la lecture.
 *
 * **Le total de la feuille n'est pas une vérité.** Excel ne somme que les
 * cellules numériques : un « 40T » tapé en texte en est absent. La lecture
 * refait donc aussi la somme à la manière d'Excel ; quand elle retombe sur le
 * total de la feuille, l'écart est expliqué, et c'est la feuille qui se trompe.
 *
 * Les jours ne portent pas de date, seulement un nom — et la semaine ne
 * commence pas toujours un lundi (« VENDREDI, SAMEDI/DIMANCHE, LUNDI… »). La
 * date se déduit du titre de la semaine et du nom de chaque colonne. **Quand le
 * titre et le nom du jour se contredisent, le nom du jour gagne** : la date
 * retenue est la plus proche du titre qui porte ce nom, et l'écart est signalé.
 *
 * Le téléphone n'est pas lu : il n'a rien à faire dans un relevé.
 *
 * Lancer seul pour le diagnostic : npx tsx scripts/extraire-recap-tonnage.mts
 * ==========================================================================*/
import { pathToFileURL } from "node:url";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";

const DO = "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution";
export const SOURCES_RECAP = [
  `${DO}/62. Transport & Flotte Automobile/RECAP TONNAGE HEBDOMMADAIRE.28.2.xlsx`,
  `${DO}/61. Gestion Parc/JACQUES SUIVI TONNAGE LIVRAISON/RECAP TONNAGE HEBDOMMADAIRE.28.2.xlsx`,
];

export interface Voyage {
  feuille: string;
  /** Rang de la ligne et de la colonne dans la feuille : l'adresse du voyage. */
  ligne: number;
  colonne: number;
  date: string;
  transporteur: string;
  chauffeur: string | null;
  /** Sans espace ni tiret, en capitales : « AA977MR ». */
  immatriculation: string | null;
  /** Ce que la feuille écrit de la capacité : « PLT 40T », « CAMION 20T ». */
  capacite: string | null;
  tonnage: number;
  destination: string | null;
}

export interface Semaine {
  feuille: string;
  debut: string;
  jours: string[];
  voyages: number;
  tonnage: number;
  /** Le total « TONNAGE JOURNALIER » de la feuille, jour par jour. */
  controle: (number | null)[];
  /** Ce que la lecture a retenu, jour par jour. */
  lu: number[];
  /** La somme telle qu'Excel la fait : les seules cellules numériques. */
  excel: number[];
}

export interface Lecture {
  source: string;
  semaines: Semaine[];
  voyages: Voyage[];
  anomalies: string[];
}

const texte = (c: Cellule | undefined) => String(c ?? "").trim();
const MOIS: [RegExp, number][] = [
  [/JANV/, 1], [/F[EÉ]V/, 2], [/MARS/, 3], [/AVRIL/, 4], [/MAI/, 5], [/JUIN/, 6],
  [/JUIL/, 7], [/AO[UÛ]T/, 8], [/SEPT/, 9], [/OCTO/, 10], [/NOVE/, 11], [/D[EÉ]CE/, 12],
];
const JOURS: [RegExp, number][] = [[/^DIM/, 0], [/^LUN/, 1], [/^MAR/, 2], [/^MER/, 3], [/^JEU/, 4], [/^VEN/, 5], [/^SAM/, 6]];

function premierMois(t: string): number | null {
  const u = t.toUpperCase();
  let meilleur: { i: number; m: number } | null = null;
  for (const [re, m] of MOIS) {
    const x = re.exec(u);
    if (x && (!meilleur || x.index < meilleur.i)) meilleur = { i: x.index, m };
  }
  return meilleur?.m ?? null;
}
const iso = (a: number, m: number, j: number) => new Date(Date.UTC(a, m - 1, j)).toISOString().slice(0, 10);
const jourSemaine = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
const plus = (d: string, k: number) => new Date(Date.parse(`${d}T00:00:00Z`) + k * 86_400_000).toISOString().slice(0, 10);
const arrondi = (x: number) => Math.round(x * 1000) / 1000;

/** « 20T », « 18,6T », « 10T,5 », « 40 », 17.1 — ou null si la cellule n'est pas un tonnage. */
export function tonnageDe(c: Cellule | undefined): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  const s = texte(c).replace(/\s/g, "").replace(",", ".").toUpperCase();
  const simple = /^(\d+(?:\.\d+)?)T?$/.exec(s);
  if (simple) return Number(simple[1]);
  /* « 10T,5 » : la virgule tapée après l'unité. */
  const apres = /^(\d+)T\.(\d+)$/.exec(s);
  return apres ? Number(`${apres[1]}.${apres[2]}`) : null;
}

export function lireRecap(source: string): Lecture {
  const semaines: Semaine[] = [];
  const voyages: Voyage[] = [];
  const anomalies: string[] = [];

  for (const f of lireClasseur(source)) {
    const lignes = f.lignes;
    const iTitre = lignes.findIndex((l) => /SEMAINE\s+DU/i.test(texte(l[0])));
    const iEntete = lignes.findIndex((l) => /^TRA?N?SPORTEURS|^TRANPORTEURS/i.test(texte(l[0])));
    if (iTitre < 0 || iEntete < 0) {
      anomalies.push(`« ${f.nom} » : ni titre de semaine ni en-tête, feuille ignorée`);
      continue;
    }
    const titreMois = lignes.slice(0, iTitre).map((l) => texte(l[0])).find((t) => t !== "") ?? "";
    const dateMois = /^(\d{4})-(\d{2})-\d{2}$/.exec(titreMois);
    const annee = dateMois ? Number(dateMois[1]) : Number(/20\d\d/.exec(titreMois)?.[0] ?? NaN);
    const moisTitre = dateMois ? Number(dateMois[2]) : premierMois(titreMois);
    const sem = /SEMAINE\s+DU\s*(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s*AU/i.exec(texte(lignes[iTitre]![0]));
    if (!sem || !Number.isFinite(annee) || moisTitre === null) {
      anomalies.push(`« ${f.nom} » : semaine illisible (« ${titreMois} », « ${texte(lignes[iTitre]![0])} »), feuille ignorée`);
      continue;
    }
    const titre = iso(annee, sem[2] ? Number(sem[2]) : moisTitre, Number(sem[1]));

    const entete = lignes[iEntete]!;
    const nomsJours = lignes[iEntete + 1] ?? [];
    const sousEntete = lignes[iEntete + 2] ?? [];
    const cImmat = entete.findIndex((c) => /^IMMAT/i.test(texte(c)));
    if (cImmat < 0) {
      anomalies.push(`« ${f.nom} » : colonne d'immatriculation introuvable, feuille ignorée`);
      continue;
    }
    const colonnes: { col: number; date: string }[] = [];
    let precedent: { date: string; jour: number } | null = null;
    for (let c = 2; c < cImmat; c++) {
      if (texte(sousEntete[c]).toUpperCase() !== "TONNAGE") continue;
      const nom = texte(nomsJours[c]).toUpperCase();
      const jour = JOURS.find(([re]) => re.test(nom))?.[1];
      if (jour === undefined) {
        anomalies.push(`« ${f.nom} » : jour « ${nom} » illisible en colonne ${c}, colonne ignorée`);
        continue;
      }
      let date: string;
      if (!precedent) {
        /* Le nom du jour gagne : la date la plus proche du titre qui le porte. */
        const decalage = [0, 1, -1, 2, -2, 3, -3].find((k) => jourSemaine(plus(titre, k)) === jour)!;
        date = plus(titre, decalage);
        if (decalage !== 0) anomalies.push(`« ${f.nom} » : le titre dit ${titre}, qui n'est pas un « ${nom} » ; semaine datée du ${date}`);
      } else {
        date = plus(precedent.date, (jour - precedent.jour + 7) % 7 || 7);
      }
      colonnes.push({ col: c, date });
      precedent = { date, jour: jourSemaine(date) };
    }

    const lu = colonnes.map(() => 0);
    const excel = colonnes.map(() => 0);
    let controle: (number | null)[] = colonnes.map(() => null);
    let transporteur = "";
    let n = 0;
    for (let i = iEntete + 3; i < lignes.length; i++) {
      const l = lignes[i]!;
      if (/TONNAGE\s+JOURNALIER/i.test(texte(l[1])) || /TONNAGE\s+JOURNALIER/i.test(texte(l[0]))) {
        controle = colonnes.map(({ col }) => tonnageDe(l[col]));
        break;
      }
      if (texte(l[0])) transporteur = texte(l[0]).replace(/\s+/g, " ").toUpperCase();
      const chauffeur = texte(l[1]).replace(/\s+/g, " ") || null;
      const immat = texte(l[cImmat]).replace(/[\s-]/g, "").toUpperCase() || null;
      const capacite = texte(l[cImmat + 1]) || null;
      colonnes.forEach(({ col, date }, k) => {
        const brut = l[col];
        if (typeof brut === "number") excel[k]! += brut;
        const destination = texte(l[col + 1]).replace(/\s+/g, " ") || null;
        if (texte(brut) === "") {
          if (destination) anomalies.push(`« ${f.nom} » ${date} ${transporteur}/${chauffeur ?? "—"} : destination « ${destination} » sans tonnage`);
          return;
        }
        const t = tonnageDe(brut);
        if (t === null) {
          anomalies.push(`« ${f.nom} » ${date} ${transporteur}/${chauffeur ?? "—"} : « ${texte(brut)} » n'est pas un tonnage`);
          return;
        }
        if (t === 0) return;
        if (!transporteur) {
          anomalies.push(`« ${f.nom} » ${date} : ${t} t sans transporteur, écarté`);
          return;
        }
        lu[k]! += t;
        n++;
        voyages.push({ feuille: f.nom, ligne: i, colonne: col, date, transporteur, chauffeur, immatriculation: immat, capacite, tonnage: t, destination });
      });
    }
    semaines.push({ feuille: f.nom, debut: colonnes[0]?.date ?? titre, jours: colonnes.map((c) => c.date), voyages: n, tonnage: arrondi(lu.reduce((s, x) => s + x, 0)), controle, lu: lu.map(arrondi), excel: excel.map(arrondi) });
  }
  return { source, semaines, voyages, anomalies };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [source] = SOURCES_RECAP;
  const r = lireRecap(source!);
  console.log(`\n########## ${source!.split("/").slice(-2).join("/")}`);
  let inexpliques = 0;
  for (const s of r.semaines) {
    console.log(`  ${s.feuille.padEnd(26)} du ${s.debut} : ${String(s.voyages).padStart(3)} voyages ${String(s.tonnage).padStart(9)} t`);
    s.jours.forEach((d, k) => {
      const c = s.controle[k];
      if (c === null || c === undefined || Math.abs(c - s.lu[k]!) <= 0.001) return;
      const explique = Math.abs(c - s.excel[k]!) <= 0.001;
      if (!explique) inexpliques++;
      console.log(`      ${d} : lu ${s.lu[k]} · feuille ${c} · somme à la manière d'Excel ${s.excel[k]} → ${explique ? "la feuille ignore des tonnages tapés en texte" : "ÉCART INEXPLIQUÉ"}`);
    });
  }
  const total = r.voyages.reduce((x, v) => x + v.tonnage, 0);
  console.log(`  → ${r.voyages.length} voyages, ${Math.round(total)} t, du ${r.voyages.map((v) => v.date).sort()[0]} au ${r.voyages.map((v) => v.date).sort().at(-1)} · ${inexpliques} écart(s) inexpliqué(s)`);

  const parImmat = new Map<string, { transporteurs: Set<string>; chauffeurs: Set<string>; capacites: Set<string>; n: number; t: number }>();
  for (const v of r.voyages) {
    const k = v.immatriculation ?? "(sans)";
    const x = parImmat.get(k) ?? { transporteurs: new Set<string>(), chauffeurs: new Set<string>(), capacites: new Set<string>(), n: 0, t: 0 };
    x.transporteurs.add(v.transporteur);
    if (v.chauffeur) x.chauffeurs.add(v.chauffeur);
    if (v.capacite) x.capacites.add(v.capacite);
    x.n++;
    x.t += v.tonnage;
    parImmat.set(k, x);
  }
  console.log("\n  Par immatriculation :");
  for (const [k, x] of [...parImmat.entries()].sort()) {
    console.log(`     ${k.padEnd(9)} ${[...x.transporteurs].join("+").padEnd(12)} ${String(x.n).padStart(4)} v ${String(Math.round(x.t)).padStart(5)} t · ${[...x.capacites].join(", ")} · ${[...x.chauffeurs].join(", ")}`);
  }
  console.log(`\n  ${r.anomalies.length} anomalie(s) :`);
  for (const a of r.anomalies) console.log(`     ${a}`);
}

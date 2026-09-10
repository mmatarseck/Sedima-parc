/* ============================================================================
 * Le carburant réel de 2025 et 2026, tiré du dossier DO.
 *
 * Demande du métier, 10 septembre 2026 : « une fois les données réelles
 * consolidées, mettre à jour la base avec les données de 2025 et 2026 ». Le
 * référentiel est chargé depuis ce matin ; il lui manque une histoire. Le
 * carburant est la seule matière du dossier qui soit à la fois **datée**,
 * **volumineuse** et **tenue régulièrement** : c'est par là qu'on commence.
 *
 * DEUX GRANULARITÉS, ET IL FAUT LES DISTINGUER.
 *
 *   1. `SUIVI CONSOMMATION HEBDOMADAIRE` — un classeur par semaine, une
 *      feuille par jour, une ligne par **plein** : chauffeur, véhicule,
 *      quantité, heure, parfois kilomètres. C'est une transaction, datée au
 *      jour. Couverture : **janvier à avril 2025**, vingt semaines.
 *
 *   2. `FICHIER DETAILLE` — un classeur par mois, une ligne par véhicule,
 *      une **quantité cumulée** sur le mois. Ce n'est pas une transaction.
 *      Couverture : juillet à décembre 2025, puis janvier à juillet 2026.
 *
 * Les deux sont réelles, mais elles ne se chargent pas de la même façon, et le
 * pire serait de les confondre : un cumul mensuel posé comme un plein
 * inventerait une date, un lieu et un geste qui n'ont pas eu lieu. Ce script
 * les rend donc **séparées**, et la décision de chargement se prend après.
 *
 * CE QUE LE DOSSIER NE DIT NULLE PART : **le prix du litre.** Le carburant se
 * tire sur puce à la pompe, la quantité est suivie, la facturation vit
 * ailleurs. Or la table `plein` exige `prix_litre > 0`. Cette contrainte
 * encode une hypothèse — « tout plein a un prix connu » — que la donnée réelle
 * contredit. C'est la contrainte qui devra céder, pas la donnée.
 *
 * Lancer : npx tsx scripts/extraire-carburant.mts [dossier de sortie]
 * ==========================================================================*/

import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";
import { normaliser } from "../src/domaine/immatriculation";

const RACINE =
  "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/61. Gestion Parc/MALICK/CARBURANT";
const SORTIE = process.argv[2] ?? join(process.cwd(), "scratchpad-carburant");

/** Tous les classeurs d'un dossier, récursivement ; les fichiers de verrou d'Excel exclus. */
function classeurs(dossier: string, sortie: string[] = []): string[] {
  if (!existsSync(dossier)) return sortie;
  for (const e of readdirSync(dossier)) {
    const p = join(dossier, e);
    if (statSync(p).isDirectory()) classeurs(p, sortie);
    else if (/\.xlsx$/i.test(e) && !e.startsWith("~$")) sortie.push(p);
  }
  return sortie;
}

const texte = (c: Cellule) => (c === null || c === undefined ? "" : String(c).trim());
const nombre = (c: Cellule): number | null => {
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  const t = texte(c).replace(/\s/g, "").replace(",", ".");
  const n = Number(t);
  return t !== "" && Number.isFinite(n) ? n : null;
};
/** La forme d'une immatriculation sénégalaise, une fois les séparateurs ôtés. */
const FORME = /^[A-Z]{2}\d{3,4}[A-Z]{1,2}$/;
const plaque = (c: Cellule): string | null => {
  const p = normaliser(texte(c));
  return FORME.test(p) ? p : null;
};

export interface Plein {
  date: string;
  immatriculation: string;
  chauffeur: string | null;
  litres: number;
  km: number | null;
  heure: string | null;
  source: string;
}
export interface CumulMensuel {
  mois: string;
  immatriculation: string;
  litres: number;
  entite: string | null;
  source: string;
}

/* -- 1. Les pleins, un par un (hebdomadaires) ------------------------------ */

const pleins: Plein[] = [];
const refusesPleins: { fichier: string; feuille: string; raison: string; ligne: string }[] = [];

for (const fichier of classeurs(RACINE).filter((f) => /HEBDOMADAIRE/i.test(f))) {
  const court = fichier.split(/[\\/]/).slice(-1)[0]!;
  let feuilles;
  try {
    feuilles = lireClasseur(fichier);
  } catch (e) {
    refusesPleins.push({ fichier: court, feuille: "", raison: `classeur illisible : ${e instanceof Error ? e.message : String(e)}`, ligne: "" });
    continue;
  }
  for (const f of feuilles) {
    /* La date de la journée est posée seule en tête de feuille, avant
       l'en-tête. On la cherche dans les trois premières lignes plutôt que de
       la déduire du nom du fichier : « SEM DU 28-04 AU 31-04 » porte un
       31 avril qui n'existe pas, et une date fausse vaut moins que rien. */
    let jour: string | null = null;
    for (const l of f.lignes.slice(0, 3)) for (const c of l) if (typeof c === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c)) jour = c;
    if (!jour) {
      refusesPleins.push({ fichier: court, feuille: f.nom, raison: "aucune date en tête de feuille", ligne: "" });
      continue;
    }
    /* L'en-tête donne l'ordre des colonnes : il varie d'un classeur à l'autre. */
    const rangEntete = f.lignes.findIndex((l) => l.some((c) => /VEHICULE/i.test(texte(c))));
    if (rangEntete < 0) {
      refusesPleins.push({ fichier: court, feuille: f.nom, raison: "aucun en-tête « VEHICULES »", ligne: "" });
      continue;
    }
    const entete = f.lignes[rangEntete]!.map((c) => texte(c).toUpperCase());
    const cChauffeur = entete.findIndex((e) => /CHAUFFEUR/.test(e));
    const cVehicule = entete.findIndex((e) => /VEHICULE/.test(e));
    const cLitres = entete.findIndex((e) => /QTT|QUANTIT/.test(e));
    const cHeure = entete.findIndex((e) => /HEURE/.test(e));
    const cKm = entete.findIndex((e) => /KLM|KM/.test(e));

    for (const l of f.lignes.slice(rangEntete + 1)) {
      const brut = JSON.stringify(l).slice(0, 120);
      const immat = plaque(l[cVehicule] ?? null);
      const litres = nombre(l[cLitres] ?? null);
      if (!immat && !litres) continue; /* ligne vide ou de total : on passe */
      if (!immat) {
        /* « GOROM 2 », « BT6511C » : des engins de chantier et des citernes de
           tiers, qui ne sont pas du parc. On les compte pour le dire. */
        refusesPleins.push({ fichier: court, feuille: f.nom, raison: `pas une plaque du parc : « ${texte(l[cVehicule] ?? null)} »`, ligne: brut });
        continue;
      }
      if (litres === null || litres <= 0) {
        refusesPleins.push({ fichier: court, feuille: f.nom, raison: "quantité absente ou nulle", ligne: brut });
        continue;
      }
      const km = cKm >= 0 ? nombre(l[cKm] ?? null) : null;
      pleins.push({
        date: jour,
        immatriculation: immat,
        chauffeur: cChauffeur >= 0 ? texte(l[cChauffeur] ?? null) || null : null,
        litres: Math.round(litres * 100) / 100,
        km: km !== null && km > 100 ? Math.round(km) : null,
        heure: cHeure >= 0 ? texte(l[cHeure] ?? null) || null : null,
        source: court,
      });
    }
  }
}

/* -- 2. Les cumuls mensuels (fichiers détaillés) --------------------------- */

const MOIS: Record<string, string> = {
  JANVIER: "01", FEVRIER: "02", MARS: "03", AVRIL: "04", MAI: "05", JUIN: "06",
  JUILLET: "07", AOUT: "08", SEPTEMBRE: "09", OCTOBRE: "10", NOVEMBRE: "11", DECEMBRE: "12",
};

const cumuls: CumulMensuel[] = [];
const refusesCumuls: { fichier: string; raison: string }[] = [];

for (const fichier of classeurs(RACINE).filter((f) => /FICHIER DETAILLE/i.test(f))) {
  const court = fichier.split(/[\\/]/).slice(-1)[0]!;
  const majuscule = court.toUpperCase();
  const nomMois = Object.keys(MOIS).find((m) => majuscule.includes(m));
  const annee = /\b(20\d{2})\b/.exec(majuscule)?.[1];
  if (!nomMois || !annee) {
    refusesCumuls.push({ fichier: court, raison: "mois ou année introuvable dans le nom du fichier" });
    continue;
  }
  const mois = `${annee}-${MOIS[nomMois]}`;
  for (const f of lireClasseur(fichier)) {
    const rangEntete = f.lignes.findIndex((l) => l.some((c) => /MATRICULE/i.test(texte(c))));
    if (rangEntete < 0) continue;
    const entete = f.lignes[rangEntete]!.map((c) => texte(c).toUpperCase());
    const cImmat = entete.findIndex((e) => /MATRICULE/.test(e));
    const cQuantite = entete.findIndex((e) => /QUANTITE/.test(e));
    const cEntite = entete.findIndex((e) => /ENTITE/.test(e));
    for (const l of f.lignes.slice(rangEntete + 1)) {
      const immat = plaque(l[cImmat] ?? null);
      const litres = nombre(l[cQuantite] ?? null);
      if (!immat || litres === null || litres <= 0) continue;
      cumuls.push({ mois, immatriculation: immat, litres: Math.round(litres * 100) / 100, entite: cEntite >= 0 ? texte(l[cEntite] ?? null) || null : null, source: court });
    }
  }
}

/* -- 3. Le rapport --------------------------------------------------------- */

const parMois = (d: string) => d.slice(0, 7);
const moisPleins = [...new Set(pleins.map((p) => parMois(p.date)))].sort();
const moisCumuls = [...new Set(cumuls.map((c) => c.mois))].sort();
const plaquesPleins = new Set(pleins.map((p) => p.immatriculation));
const plaquesCumuls = new Set(cumuls.map((c) => c.immatriculation));

console.log(`PLEINS (transactions datées)`);
console.log(`  ${pleins.length} pleins, ${plaquesPleins.size} véhicules, ${Math.round(pleins.reduce((s, p) => s + p.litres, 0)).toLocaleString("fr-FR")} litres`);
console.log(`  du ${pleins.map((p) => p.date).sort()[0] ?? "—"} au ${pleins.map((p) => p.date).sort().at(-1) ?? "—"} · mois : ${moisPleins.join(" ")}`);
console.log(`  ${pleins.filter((p) => p.km !== null).length} portent un kilométrage, ${pleins.filter((p) => p.chauffeur).length} un chauffeur`);
console.log(`  ${refusesPleins.length} ligne(s) écartée(s)`);
for (const [raison, n] of Object.entries(refusesPleins.reduce<Record<string, number>>((a, r) => ({ ...a, [r.raison.replace(/« .* »/, "« … »")]: (a[r.raison.replace(/« .* »/, "« … »")] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log(`     ${n} × ${raison}`);

console.log(`\nCUMULS MENSUELS (pas des transactions)`);
console.log(`  ${cumuls.length} lignes, ${plaquesCumuls.size} véhicules, ${Math.round(cumuls.reduce((s, c) => s + c.litres, 0)).toLocaleString("fr-FR")} litres`);
console.log(`  mois : ${moisCumuls.join(" ")}`);
if (refusesCumuls.length) console.log(`  ${refusesCumuls.length} classeur(s) écarté(s) : ${refusesCumuls.map((r) => r.fichier).join(", ")}`);

writeFileSync(join(SORTIE.replace(/[\\/]$/, "") + ".json"), JSON.stringify({ pleins, cumuls, refusesPleins, refusesCumuls }, null, 1), "utf8");
console.log(`\nÉcrit : ${SORTIE.replace(/[\\/]$/, "")}.json`);

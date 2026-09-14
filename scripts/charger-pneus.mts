/* ============================================================================
 * Fabrique `supabase/pneus-parties/` — les pneus du parc, un par un.
 *
 * La table `pneu` (0029) est vide : l'écran Pièces annonce « 0 monté », et la
 * charge pneumatique d'un véhicule ne se lit que dans ses dépenses. La gestion
 * du parc suit pourtant chaque montage, dans deux classeurs du dossier DO :
 *
 *   * **SUIVI PNEUS ET MONTAGES 2025** (`MALICK/FICHE SUIVI 2026`) — deux
 *     feuilles, les légers et les lourds : une ligne par véhicule servi, avec
 *     la dimension, la quantité, le prix unitaire, le bon de commande, la
 *     demande d'achat, le fournisseur et la date de montage. De 2025 à
 *     août 2026.
 *   * **PNEUS RECEPTIONNES ET MONTAGES** (`MALICK`) — une feuille par bon de
 *     commande de 2024, nommée du bon et du fournisseur : les pneus reçus, puis
 *     les véhicules montés et leur date.
 *
 * UN PNEU PAR PNEU. Une ligne « AA 565 GA · 11 R 22,5 · 6 » est six pneus :
 * c'est la maille de la table, et celle du suivi d'usure. La dimension et la
 * marque se lisent dans la désignation (« 11 R 22,5 PNEU DOUBLE ROAD ») ; le
 * reste — prix, bon, demande, fournisseur — va au commentaire, faute de colonne.
 *
 * CE QU'ON NE SAIT PAS, et qu'on n'invente pas : la position sur le véhicule,
 * le compteur à la pose, le numéro de série. Ils restent vides.
 *
 * CE QU'ON ÉCARTE : les lignes sans véhicule nommé — le classeur en compte
 * quelques-unes, où le montage n'a pas été rattaché —, et les plaques que le
 * référentiel ne connaît pas. Elles sont nommées au compte rendu.
 *
 * LES GROUPES. Une même commande sert plusieurs véhicules : le bon, la demande,
 * le fournisseur et la date ne sont écrits que sur une ligne du groupe, les
 * suivantes partageant le prix unitaire. On les propage au groupe.
 *
 * Lancer : npx tsx scripts/charger-pneus.mts
 * ==========================================================================*/

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";
import { normaliser } from "../src/domaine/immatriculation";

const M = "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/61. Gestion Parc/MALICK";
const SUIVI = join(M, "FICHE SUIVI 2026", "SUIVI PNEUS ET MONTAGES 2025.xlsx");
const RECEPTIONS = join(M, "PNEUS RECEPTIONNES ET MONTAGES.xlsx");
const projet = process.cwd();

const texte = (c: Cellule) => (c === null || c === undefined ? "" : String(c).trim());
const entier = (c: Cellule): number | null => {
  const n = typeof c === "number" ? c : Number(texte(c).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};
const PLAQUE = /^[A-Z]{2}\d{3,4}[A-Z]{1,2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * La dimension d'un pneu. Le métier l'écrit de vingt façons — « 315/80 R22,5 PNEU TOLEDO »,
 * « 11R/ 22.5 », « 205/ R 16 C 110/108 », « 7.50R16 » : on compacte, puis on lit la largeur,
 * la série quand elle est là, et le diamètre. « 315/80R22.5 », « 11R22.5 », « 205R16 ».
 */
function dimensionDe(designation: string): string | null {
  const d = designation.toUpperCase().replace(/,/g, ".").replace(/[\s]/g, "");
  const m = /(\d{1,3}(?:\.\d{2})?)(?:\/(\d{2,3}))?\/?R(\d{1,2}(?:\.\d)?)/.exec(d);
  if (!m) return null;
  return `${m[1]}${m[2] ? `/${m[2]}` : ""}R${m[3]}`;
}

/** La marque, quand la désignation la nomme après le mot « PNEU ». */
function marqueDe(designation: string): string {
  const d = designation.toUpperCase().replace(/\s+/g, " ");
  const m = /PNEUS? +([A-Z][A-Z ]{2,})/.exec(d);
  if (!m) return "";
  return m[1]!.trim().replace(/\bD$/, "").trim();
}

interface Montage {
  plaque: string;
  ecrite: string;
  dimension: string | null;
  marque: string;
  quantite: number;
  datePose: string | null;
  commentaire: string;
  source: string;
}

const montages: Montage[] = [];
const ecartes: Record<string, number> = {};
const ecarte = (raison: string) => (ecartes[raison] = (ecartes[raison] ?? 0) + 1);
const sansDimension: string[] = [];

/* -- 1. Le suivi des montages, 2025-2026 ------------------------------------ */

for (const feuille of lireClasseur(SUIVI)) {
  const debut = feuille.lignes.findIndex((l) => l.map(texte).includes("IMMAT"));
  if (debut < 0) continue;
  const h = feuille.lignes[debut]!.map((c) => texte(c).replace(/\s+/g, " "));
  const col = (nom: string) => h.findIndex((c) => c.toUpperCase().startsWith(nom));
  const c = { immat: col("IMMAT"), designation: col("DESIGNATION"), qte: col("QTITE"), pu: col("PU"), ptt: col("PTT"), bc: col("N* BC"), da: col("N* DA"), fournisseur: col("FOURNISSEUR"), date: col("DATE MONTAGE") };
  if (Object.values(c).some((i) => i < 0)) throw new Error(`${feuille.nom} : colonnes introuvables (${h.join(" | ")})`);

  /* Une commande sert plusieurs véhicules : son bon, sa demande, son fournisseur et sa date
     ne sont écrits qu'une fois, et les lignes du groupe partagent le prix unitaire. */
  const lignes = feuille.lignes.slice(debut + 1).filter((l) => texte(l[c.immat]));
  let groupe: { bc: string; da: string; fournisseur: string; date: string; designation: string; pu: number | null } = { bc: "", da: "", fournisseur: "", date: "", designation: "", pu: null };
  for (const l of lignes) {
    const pu = entier(l[c.pu]);
    const bc = texte(l[c.bc]);
    const da = texte(l[c.da]);
    const fournisseur = texte(l[c.fournisseur]);
    const date = texte(l[c.date]);
    const memeCommande = pu !== null && pu === groupe.pu;
    if (!memeCommande || bc || fournisseur) {
      groupe = {
        bc: bc || (memeCommande ? groupe.bc : ""),
        da: da || (memeCommande ? groupe.da : ""),
        fournisseur: fournisseur || (memeCommande ? groupe.fournisseur : ""),
        date: date || (memeCommande ? groupe.date : ""),
        designation: memeCommande ? groupe.designation : "",
        pu,
      };
    }
    const quantite = entier(l[c.qte]);
    const ecrite = texte(l[c.immat]);
    const plaque = normaliser(ecrite);
    if (!quantite) {
      ecarte("ligne sans quantité");
      continue;
    }
    if (!PLAQUE.test(plaque)) {
      ecarte("ligne sans plaque lisible");
      continue;
    }
    /* La désignation, comme le bon, n'est écrite que sur la première ligne de la commande. */
    const designation = texte(l[c.designation]) || (pu === groupe.pu ? groupe.designation : "");
    groupe.designation = designation || groupe.designation;
    const dimension = dimensionDe(designation);
    if (!dimension) sansDimension.push(`${ecrite} : « ${designation || "(sans désignation)"} »`);
    const pieces = [
      groupe.bc ? `bon ${groupe.bc}` : null,
      groupe.da ? `demande ${groupe.da}` : null,
      groupe.fournisseur || null,
      pu ? `${pu} F le pneu` : null,
    ].filter(Boolean);
    montages.push({
      plaque, ecrite, dimension, marque: marqueDe(designation), quantite,
      datePose: DATE.test(groupe.date) ? groupe.date : null,
      commentaire: `Suivi des pneus du parc (${feuille.nom.toLowerCase()})${pieces.length ? ` — ${pieces.join(", ")}` : ""}${designation && !dimension ? ` — désignation : ${designation}` : ""}`,
      source: "Suivi des montages 2025-2026",
    });
  }
}

/* -- 2. Les réceptions et montages de 2024 ---------------------------------- */

for (const feuille of lireClasseur(RECEPTIONS)) {
  const debut = feuille.lignes.findIndex((l) => l.map(texte).some((c) => /REFERENCES PNEUS/i.test(c)));
  if (debut < 0) continue;
  const h = feuille.lignes[debut]!.map((c) => texte(c).replace(/\s+/g, " ").toUpperCase());
  const c = { ref: h.findIndex((x) => x.startsWith("REFERENCES")), recus: h.findIndex((x) => x.startsWith("NBRES PNEUS") && !x.includes("MONTES")), plaque: h.findIndex((x) => x.startsWith("MATRICULES")), montes: h.findIndex((x) => x.includes("MONTES")), date: h.findIndex((x) => x.startsWith("DATE")) };
  if (c.ref < 0 || c.plaque < 0 || c.montes < 0) throw new Error(`${feuille.nom} : colonnes introuvables (${h.join(" | ")})`);
  const entete = feuille.lignes.slice(0, debut).flat().map(texte).join(" ");
  const recu = /(\d{2})\/(\d{2})\/(\d{4})/.exec(entete);
  const bon = /^(BC\d+|BONCDE\d+|\S+)/.exec(feuille.nom)?.[1] ?? feuille.nom;
  const fournisseur = feuille.nom.replace(/^\S+\s*/, "").trim();

  let reference = "";
  for (const l of feuille.lignes.slice(debut + 1)) {
    if (texte(l[c.ref])) reference = texte(l[c.ref]);
    const ecrite = texte(l[c.plaque]);
    const quantite = entier(l[c.montes]);
    if (!quantite) continue;
    if (!ecrite) {
      ecarte("montage de 2024 sans véhicule nommé");
      continue;
    }
    const plaque = normaliser(ecrite);
    if (!PLAQUE.test(plaque)) {
      ecarte("ligne sans plaque lisible");
      continue;
    }
    const date = texte(l[c.date]);
    const dimension = dimensionDe(reference);
    if (!dimension) sansDimension.push(`${ecrite} : « ${reference || "(sans référence)"} » (${feuille.nom})`);
    montages.push({
      plaque, ecrite, dimension, marque: marqueDe(reference), quantite,
      datePose: DATE.test(date) ? date : null,
      commentaire: `Pneus reçus au bon ${bon}${fournisseur ? ` (${fournisseur})` : ""}${recu ? `, le ${recu[1]}/${recu[2]}/${recu[3]}` : ""}${DATE.test(date) ? "" : date ? ` — montage noté « ${date} »` : ""}${dimension ? "" : ` — référence : ${reference}`}`,
      source: "Réceptions et montages 2024",
    });
  }
}

/* -- 3. Le parc, et les pneus un par un ------------------------------------- */

const parc = new Set<string>();
for (const f of ["supabase/seed.sql", "supabase/aligner-referentiel.sql", "supabase/vehicules-manquants.sql"]) {
  const t = readFileSync(join(projet, f), "utf8");
  for (const b of t.matchAll(/insert into vehicule \([^)]*\) values[\s\S]*?\non conflict[^;]*;/g)) {
    for (const m of b[0].matchAll(/'([A-Z]{2}\d{3,4}[A-Z]{1,2})'/g)) parc.add(m[1]!);
  }
}
const horsParc = new Map<string, number>();
const pneus: { numero: string; marque: string; dimension: string; plaque: string; datePose: string | null; commentaire: string }[] = [];
montages.sort((a, b) => (a.datePose ?? "9999").localeCompare(b.datePose ?? "9999") || a.plaque.localeCompare(b.plaque));
for (const m of montages) {
  if (!parc.has(m.plaque)) {
    horsParc.set(m.ecrite, (horsParc.get(m.ecrite) ?? 0) + m.quantite);
    continue;
  }
  for (let i = 0; i < m.quantite; i++) {
    pneus.push({
      numero: `PNE-R-${String(pneus.length + 1).padStart(5, "0")}`,
      marque: m.marque,
      dimension: m.dimension ?? "Dimension non relevée",
      plaque: m.plaque,
      datePose: m.datePose,
      commentaire: `${m.commentaire} — pneu ${i + 1} sur ${m.quantite}.`,
    });
  }
}

/* -- 4. Le fichier ---------------------------------------------------------- */

const dossier = join(projet, "supabase/pneus-parties");
rmSync(dossier, { recursive: true, force: true });
mkdirSync(dossier, { recursive: true });
const sql = (v: string | null) => (v === null || v === "" ? "null" : `'${v.replace(/'/g, "''")}'`);
const dates = pneus.map((p) => p.datePose).filter(Boolean).sort() as string[];

writeFileSync(
  join(dossier, "pneus-01-montages.sql"),
  `-- ============================================================================
-- SEDIMA Parc — les pneus du parc, un par un.
--
-- **Ce n'est pas une migration.** ${pneus.length} pneus montés sur ${new Set(pneus.map((p) => p.plaque)).size} véhicules,
-- du ${dates[0]} au ${dates.at(-1)} pour ceux dont le montage est daté. Sources : SUIVI PNEUS
-- ET MONTAGES 2025 et PNEUS RECEPTIONNES ET MONTAGES (dossier DO).
-- Voir docs/PNEUS-REELS.md.
--
-- La position sur le véhicule, le compteur à la pose et le numéro de série ne
-- sont pas suivis : ils restent vides plutôt qu'inventés.
--
-- REJOUABLE : \`on conflict do nothing\`.
-- ============================================================================

insert into pneu (numero, marque, dimension, etat, vehicule_id, date_pose, commentaire)
select v.numero, coalesce(v.marque, ''), v.dimension, 'monte', ve.id, v.date_pose::date, v.commentaire
  from (values
${pneus.map((p) => `    (${sql(p.numero)}, ${sql(p.marque)}, ${sql(p.dimension)}, ${sql(p.plaque)}, ${sql(p.datePose)}, ${sql(p.commentaire)})`).join(",\n")}
  ) as v(numero, marque, dimension, immatriculation, date_pose, commentaire)
  join vehicule ve on ve.immatriculation = v.immatriculation
on conflict (numero) do nothing;

-- ---------------------------------------------------------------------------
-- Vérification : les pneus montés, par dimension.
-- ---------------------------------------------------------------------------

select dimension, count(*) as pneus, count(distinct vehicule_id) as vehicules, min(date_pose) as premier, max(date_pose) as dernier
  from pneu where numero like 'PNE-R-%' group by dimension order by 2 desc;
`,
);

/* -- 5. Le compte rendu ----------------------------------------------------- */

const parDimension = new Map<string, number>();
for (const p of pneus) parDimension.set(p.dimension, (parDimension.get(p.dimension) ?? 0) + 1);
console.log(`${montages.length} montages lus, ${pneus.length} pneus sur ${new Set(pneus.map((p) => p.plaque)).size} véhicules du parc`);
console.log(`datés : ${pneus.filter((p) => p.datePose).length} ; avec une marque : ${pneus.filter((p) => p.marque).length} ; du ${dates[0]} au ${dates.at(-1)}`);
console.log("\npar dimension :");
for (const [d, n] of [...parDimension].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${d.padEnd(22)} ${String(n).padStart(4)}`);
console.log("\nécartés :", ecartes);
console.log(`\nplaques hors référentiel : ${[...horsParc].map(([p, n]) => `${p} (${n})`).join(", ") || "aucune"}`);
console.log(`\n${sansDimension.length} lignes sans dimension lisible :`);
for (const s of sansDimension.slice(0, 15)) console.log(`  ${s}`);

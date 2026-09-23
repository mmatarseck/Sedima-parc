/* ============================================================================
 * Rapprocher les pleins en base des parties canoniques du carburant.
 *
 * CE QUI S'EST PASSÉ (audit du 23 septembre 2026). Le 10 septembre 2026, un
 * premier chargement du carburant a été joué vers 18 h 58 avec une version
 * antérieure du générateur : 1 022 pleins de 2025-2026 sous les numéros
 * PLN-R-000001 à PLN-R-001029. Les parties d'aujourd'hui ont été jouées
 * ensuite ; elles numérotent **par date depuis 2022**, si bien que :
 *
 *   * leurs numéros 000001 à 001029 (les pleins de 2022) étaient déjà pris :
 *     `on conflict (numero) do nothing` les a écartés — **2022 manque** ;
 *   * leurs pleins de 2025-2026 sont entrés sous d'autres numéros — ils
 *     **doublent** ceux du premier chargement.
 *
 * Même nombre de lignes au total (5 871), mais environ mille pleins de 2025-2026
 * comptés deux fois — dont les 415 cumuls mensuels de juillet 2025 à juillet
 * 2026, soit les litres des douze derniers mois doublés sur le tableau de bord
 * et dans les rapports — et mille pleins de 2022 absents.
 *
 * CE SCRIPT compare **par contenu** — véhicule, date, litres, prix, compteur,
 * plein complet, source ; pas la référence du tarif, dont le libellé a changé
 * entre les deux versions — la base aux parties, en multiensemble (deux pleins
 * identiques le même jour restent deux pleins). Il écrit la différence :
 *
 *   * les lignes en trop, retirées par numéro — celles du premier chargement
 *     d'abord, jamais une ligne saisie dans l'application (préfixe PLN-R ou
 *     PLN-C seulement) ;
 *   * les lignes manquantes, ajoutées sous des numéros PLN-C neufs.
 *
 * Il ne touche pas à la base : il la lit, et écrit
 * `supabase/correctif-pleins-doublons.sql`, que le métier joue dans le SQL
 * Editor.
 *
 * Lancer : npx tsx scripts/reconcilier-pleins.mts
 * ==========================================================================*/

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const l of readFileSync(join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(l);
  if (m && !l.trimStart().startsWith("#")) process.env[m[1]!] ??= m[2]!.trim().replace(/^(['"])(.*)\1$/, "$2");
}
const pg = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

/* -- Les parties canoniques ---------------------------------------------------- */
const motif = /^\s*\('(PLN-R-\d+)', \(select id from vehicule where immatriculation = '([^']+)'\), '(\d{4}-\d{2}-\d{2})', ([\d.]+), (\d+), round\([^)]*\), (\d+|null), (true|false), '([^']+)', '[^']*'\)[,;]?\s*$/;
interface Canon { numero: string; ligne: string; cle: string }
const canon: Canon[] = [];
const dossier = join(process.cwd(), "supabase", "carburant-parties");
for (const f of readdirSync(dossier).filter((x) => x.endsWith(".sql")).sort()) {
  for (const l of readFileSync(join(dossier, f), "utf8").split(/\r?\n/)) {
    const m = motif.exec(l);
    if (!m) continue;
    canon.push({ numero: m[1]!, ligne: l.trim().replace(/[,;]$/, ""), cle: [m[2], m[3], Number(m[4]), Number(m[5]), m[6] === "null" ? "" : Number(m[6]), m[7], m[8]].join("|") });
  }
}

/* -- La base ---------------------------------------------------------------------- */
const immat = new Map<string, string>();
for (const v of (await pg.from("vehicule").select("id, immatriculation")).data ?? []) immat.set(v.id, v.immatriculation);
interface Ligne { numero: string; vehicule_id: string; date: string; litres: number; prix_litre: number; km: number | null; plein_complet: boolean; source: string; cree_le: string }
const base: Ligne[] = [];
for (let de = 0; ; de += 1000) {
  const x = await pg.from("plein").select("numero, vehicule_id, date, litres, prix_litre, km, plein_complet, source, cree_le").order("numero").range(de, de + 999);
  if (x.error) throw new Error(x.error.message);
  base.push(...(x.data as Ligne[]));
  if (x.data!.length < 1000) break;
}
/*
 * Les plaques des parties qui ont changé depuis : le véhicule a été
 * réimmatriculé, son historique vit sous la nouvelle plaque. Sans cette table,
 * le rapprochement croirait ses pleins en trop sous l'une et manquants sous
 * l'autre (DK 1306 BB, 23 septembre 2026).
 */
const REIMMATRICULES: Record<string, string> = { DK1306BB: "AB098JC", DK2348BD: "AB078JS", DK7485BK: "AB364HK" };
for (const c of canon) {
  const [plaque, ...reste] = c.cle.split("|");
  const nouvelle = REIMMATRICULES[plaque!];
  if (nouvelle) {
    c.cle = [nouvelle, ...reste].join("|");
    c.ligne = c.ligne.replace(`immatriculation = '${plaque}'`, `immatriculation = '${nouvelle}'`);
  }
}
const cleBase = (p: Ligne) => [immat.get(p.vehicule_id) ?? "?", p.date, Number(p.litres), p.prix_litre, p.km ?? "", p.plein_complet, p.source].join("|");

/* -- La différence, en multiensemble ------------------------------------------------ */
const attendus = new Map<string, Canon[]>();
for (const c of canon) attendus.set(c.cle, [...(attendus.get(c.cle) ?? []), c]);
const presents = new Map<string, Ligne[]>();
for (const p of base) presents.set(cleBase(p), [...(presents.get(cleBase(p)) ?? []), p]);

const aRetirer: Ligne[] = [];
const aAjouter: Canon[] = [];
for (const [cle, lignes] of presents) {
  const voulu = attendus.get(cle)?.length ?? 0;
  if (lignes.length <= voulu) continue;
  /* Les lignes d'un chargement (PLN-R, PLN-C) seules peuvent partir ; du premier chargement d'abord. */
  const candidates = lignes.filter((p) => /^PLN-[RC]-/.test(p.numero)).sort((a, b) => a.cree_le.localeCompare(b.cree_le) || a.numero.localeCompare(b.numero));
  aRetirer.push(...candidates.slice(0, lignes.length - voulu));
}
/*
 * Un plein dont le véhicule n'est pas au parc ne peut pas entrer : `plein.vehicule_id`
 * est obligatoire, et la sous-requête des parties rendrait nul. Le premier
 * correctif l'ignorait et le SQL Editor l'a refusé (23502, PLN-C-00025) — la
 * transaction entière est retombée, rien n'a été écrit. Ces pleins sont
 * écartés et comptés : ce sont des véhicules sortis avant la reprise.
 */
const connues = new Set(immat.values());
const ecartes = new Map<string, number>();
for (const [cle, lignes] of attendus) {
  const la = presents.get(cle)?.length ?? 0;
  if (lignes.length <= la) continue;
  const plaque = cle.split("|")[0]!;
  if (!connues.has(plaque)) {
    ecartes.set(plaque, (ecartes.get(plaque) ?? 0) + lignes.length - la);
    continue;
  }
  aAjouter.push(...lignes.slice(la));
}

/* -- Le SQL ------------------------------------------------------------------------ */
const dernierC = Math.max(0, ...base.filter((p) => p.numero.startsWith("PLN-C-")).map((p) => Number(p.numero.slice(6))));
let k = dernierC;
const insertions = aAjouter.sort((a, b) => a.numero.localeCompare(b.numero)).map((c) => c.ligne.replace(`'${c.numero}'`, `'PLN-C-${String(++k).padStart(5, "0")}'`));
const litresRetires = aRetirer.reduce((s, p) => s + Number(p.litres), 0);
const annees = (l: { date: string }[]) => [...new Set(l.map((p) => p.date.slice(0, 4)))].sort().join(", ");
const partie = (liste: string[], taille: number) => Array.from({ length: Math.ceil(liste.length / taille) }, (_, i) => liste.slice(i * taille, (i + 1) * taille));

const sql = `-- ============================================================================
-- SEDIMA Parc — les pleins chargés deux fois, et ceux de 2022 qui manquaient.
--
-- **Ce n'est pas une migration.** Écrit par \`scripts/reconcilier-pleins.mts\`
-- le ${new Date().toISOString().slice(0, 10)}, en lisant la base : c'est la différence, ligne à ligne,
-- entre les pleins en base et les parties \`supabase/carburant-parties/\`.
--
-- POURQUOI. Le 10 septembre 2026, un premier chargement (version antérieure du
-- générateur) a pris les numéros PLN-R-000001 à 001029 pour des pleins de
-- 2025-2026. Les parties actuelles, jouées ensuite, numérotent depuis 2022 :
-- leurs pleins de 2022 ont été écartés (numéros déjà pris), leurs pleins de
-- 2025-2026 sont entrés en double. Les litres des douze derniers mois étaient
-- comptés deux fois (tableau de bord, consommation, rapports).
--
--   * ${aRetirer.length} pleins retirés (en double) — ${Math.round(litresRetires).toLocaleString("fr-FR")} litres, années ${annees(aRetirer) || "—"} ;
--   * ${insertions.length} pleins ajoutés (manquants) — années ${annees(aAjouter.map((c) => ({ date: c.cle.split("|")[1]! }))) || "—"} ;
--   * ${[...ecartes.values()].reduce((s, x) => s + x, 0)} pleins des parties écartés : leur véhicule n'est pas au parc (${[...ecartes.keys()].sort().join(", ") || "aucun"}).
--
-- Rien de saisi dans l'application n'est touché : seules des lignes PLN-R et
-- PLN-C (chargements) sont retirées. Rejouable : les retraits visent des
-- numéros, les ajouts se font \`on conflict (numero) do nothing\`.
-- ============================================================================

begin;

${partie(aRetirer.map((p) => `'${p.numero}'`), 40).map((l) => `delete from plein where numero in (${l.join(", ")});`).join("\n")}

${partie(insertions, 400).map((l) => `insert into plein (numero, vehicule_id, date, litres, prix_litre, montant, km, plein_complet, source, reference) values\n  ${l.join(",\n  ")}\non conflict (numero) do nothing;`).join("\n\n")}

commit;

-- Contrôle : ${canon.length} pleins attendus depuis les parties, plus ceux saisis dans l'application.
select count(*) as pleins_de_chargement from plein where numero like 'PLN-R-%' or numero like 'PLN-C-%';
`;
writeFileSync(join(process.cwd(), "supabase", "correctif-pleins-doublons.sql"), sql);
console.log(`Parties : ${canon.length} pleins. Base : ${base.length}. À retirer : ${aRetirer.length} (${Math.round(litresRetires)} L, ${annees(aRetirer)}). À ajouter : ${insertions.length}.`);
console.log(`Écartés (véhicule absent du parc) : ${JSON.stringify(Object.fromEntries(ecartes))}`);
console.log(`Retraits par lot : ${JSON.stringify(Object.fromEntries([...new Set(aRetirer.map((p) => p.cree_le.slice(0, 16)))].map((l) => [l, aRetirer.filter((p) => p.cree_le.slice(0, 16) === l).length])))}`);
console.log(`Taille du fichier : ${Math.round(sql.length / 1024)} Ko`);

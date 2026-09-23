/* ============================================================================
 * Le complément du relevé de transport : les semaines que la base n'a pas.
 *
 * POURQUOI UN SECOND CHARGEUR (23 septembre 2026). `charger-releve-transport`
 * numérote tout le relevé dans l'ordre des dates : rejoué sur une version plus
 * récente du classeur, il renumérote, et une correction dans une semaine
 * passée décalerait tous les numéros — c'est exactement ce qui a doublé les
 * pleins le 10 septembre. Ce script ne touche pas aux semaines déjà en base :
 * il lit la dernière date du relevé **en base**, ne retient que les voyages
 * postérieurs, et les numérote dans une série à part (TRP-2026-95xxx, puis la
 * suite des numéros déjà pris dans cette série).
 *
 * Le référentiel est lu **en base** — pas dans le jeu de départ : les camions
 * du parc reçus depuis (AB 178 KR…) doivent être reconnus. Mêmes règles que
 * le chargeur d'origine : un camion SEDIMA absent du parc est écarté, un
 * transporteur inconnu aussi ; une plaque de tiers inconnue reste en
 * immatriculation libre (on ne crée pas de camion ici).
 *
 * Il lit la base et le classeur, et n'écrit que
 * `supabase/releve-complement-<date>.sql`, que le métier joue.
 *
 * Lancer : npx tsx scripts/charger-releve-complement.mts "<chemin du classeur>"
 * ==========================================================================*/

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { lireRecap } from "./extraire-recap-tonnage.mts";

for (const l of readFileSync(join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(l);
  if (m && !l.trimStart().startsWith("#")) process.env[m[1]!] ??= m[2]!.trim().replace(/^(['"])(.*)\1$/, "$2");
}
const pg = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const source = process.argv[2];
if (!source) throw new Error("Usage : npx tsx scripts/charger-releve-complement.mts <classeur>");
const echappe = (s: string) => s.replace(/'/g, "''");

/** Mêmes correspondances que `charger-releve-transport.mts`. */
const TRANSPORTEURS: Record<string, string> = { "A DIENG": "PRE-2026-00022", "A KANE": "PRE-2026-00021", ADEX: "PRE-2026-00033", "DR WADE": "PRE-2026-00027", "SOKHNA DIOP": "PRE-2026-00023", AUTRES: "PRE-2026-00025" };
const COQUILLES: Record<string, string> = { AA105VE: "AA105VA", AA383JZ: "AA383GZ" };

const parc = new Set(((await pg.from("vehicule").select("immatriculation")).data ?? []).map((v) => v.immatriculation as string));
const camions = new Set(((await pg.from("camion_tiers").select("immatriculation")).data ?? []).map((v) => v.immatriculation as string));
const derniere = ((await pg.from("releve_transport").select("date").order("date", { ascending: false }).limit(1)).data ?? [])[0]?.date as string;
const pris = ((await pg.from("releve_transport").select("numero").like("numero", "TRP-2026-95%")).data ?? []).map((r) => Number(String(r.numero).slice(9)));
let suivant = Math.max(95000, ...pris) + 1;

const lecture = lireRecap(source);
/*
 * Le titre d'une feuille recopiée n'est pas toujours mis à jour : dans
 * « RECAP … 11X », la feuille « SEM DU 11 AU 17-09 (2) » porte encore le
 * titre « SEMAINE DU 04 » — ses 91 voyages ne sont pas ceux du 4 au 10 (4 en
 * commun sur 91), mais le lecteur les datait de cette semaine-là. Quand le jour
 * du **nom de la feuille** contredit le premier jour lu dans le titre, le nom
 * l'emporte : les dates sont décalées d'autant.
 */
for (const s of lecture.semaines) {
  const jourNom = Number(/SEM DU (\d{1,2})\b/.exec(s.feuille)?.[1] ?? NaN);
  const jourTitre = Number(s.debut.slice(8, 10));
  const ecart = jourNom - jourTitre;
  if (!Number.isFinite(ecart) || ecart <= 0 || ecart > 14) continue;
  console.warn(`⚠ « ${s.feuille} » : titre au ${s.debut}, nom au ${jourNom} — dates décalées de ${ecart} jours`);
  for (const v of lecture.voyages) if (v.feuille === s.feuille) v.date = new Date(Date.parse(`${v.date}T00:00:00Z`) + ecart * 86_400_000).toISOString().slice(0, 10);
}
const nouveaux = lecture.voyages.filter((v) => v.date > derniere).sort((a, b) => a.date.localeCompare(b.date) || a.feuille.localeCompare(b.feuille) || a.ligne - b.ligne || a.colonne - b.colonne);
const ecartes = new Map<string, number>();
const valeurs: string[] = [];
let tonnesParc = 0, tonnesTiers = 0;
for (const v of nouveaux) {
  const plaque = v.immatriculation ? (COQUILLES[v.immatriculation] ?? v.immatriculation) : null;
  let mode: "parc" | "transporteur", prestataire = "null", vehicule = "null", camion = "null", libre = "null";
  if (v.transporteur === "SEDIMA") {
    if (!plaque || !parc.has(plaque)) { const k = `camion SEDIMA absent du parc (${plaque ?? "sans plaque"})`; ecartes.set(k, (ecartes.get(k) ?? 0) + v.tonnage); continue; }
    mode = "parc";
    vehicule = `(select id from vehicule where immatriculation = '${plaque}')`;
    tonnesParc += v.tonnage;
  } else {
    const p = TRANSPORTEURS[v.transporteur];
    if (!p) { const k = `transporteur inconnu (${v.transporteur})`; ecartes.set(k, (ecartes.get(k) ?? 0) + v.tonnage); continue; }
    mode = "transporteur";
    prestataire = `(select id from prestataire where numero = '${p}')`;
    if (plaque && camions.has(plaque)) camion = `(select immatriculation from camion_tiers where immatriculation = '${plaque}')`;
    else if (plaque) libre = `'${plaque}'`;
    tonnesTiers += v.tonnage;
  }
  valeurs.push(`  ('TRP-2026-${String(suivant++).padStart(5, "0")}', '${v.date}', '${mode}', ${prestataire}, ${vehicule}, ${camion}, ${libre}, ${v.chauffeur ? `'${echappe(v.chauffeur)}'` : "null"}, 'UAB', '${echappe(v.destination ?? "Non précisée")}', 'aliment', ${Math.round(v.tonnage * 100) / 100})`);
}

const dates = nouveaux.map((v) => v.date);
const fichier = join(process.cwd(), "supabase", `releve-complement-${new Date().toISOString().slice(0, 10)}.sql`);
writeFileSync(fichier, `-- ============================================================================
-- SEDIMA Parc — complément du relevé de transport (${source.split(/[\\/]/).at(-1)}).
--
-- **Ce n'est pas une migration.** Écrit par \`scripts/charger-releve-complement.mts\` :
-- les seuls voyages postérieurs au ${derniere}, dernière date du relevé en base.
-- ${valeurs.length} voyages du ${dates[0]} au ${dates.at(-1)} — ${Math.round(tonnesParc)} t par le parc, ${Math.round(tonnesTiers)} t par les transporteurs.
-- Écartés : ${[...ecartes].map(([k, t]) => `${k} ${Math.round(t)} t`).join(" ; ") || "aucun"}.
--
-- Rejouable : \`on conflict (numero) do nothing\`.
-- ============================================================================

insert into releve_transport (numero, date, mode, prestataire_id, vehicule_id, camion_tiers_immatriculation, immatriculation_libre, chauffeur, origine, destination, produit, tonnage) values
${valeurs.join(",\n")}
on conflict (numero) do nothing;

select mode, count(*) as voyages, sum(tonnage) as tonnes, min(date) as du, max(date) as au
  from releve_transport where date > '${derniere}' group by mode;
`);
console.log(`Dernière date en base : ${derniere}. ${valeurs.length} voyages nouveaux (${dates[0]} → ${dates.at(-1)}), parc ${Math.round(tonnesParc)} t, tiers ${Math.round(tonnesTiers)} t. Écartés : ${JSON.stringify([...ecartes])}`);

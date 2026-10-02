/* ============================================================================
 * Fabrique `supabase/releves-traceurs-<date>.sql` — les odomètres des balises.
 *
 * LA SOURCE (2 octobre 2026). « Liste des traceurs » exportée de la plateforme
 * de géolocalisation (compte sedima-sn6) par Birahim Fall : une ligne par
 * balise, avec l'**odomètre** du véhicule au jour de l'export. C'est un relevé
 * daté de chaque véhicule équipé, et `origine_releve` a sa valeur pour lui :
 * « telematique ».
 *
 * LE VÉHICULE. Le nom de la balise porte la plaque, parfois précédée du genre
 * (« CM-AA 093 VA », « BUS-AA 106 NE ») ; le mémo et le champ « Id chauffeur »
 * la répètent. On prend la première des trois que le parc connaît : « AA 023
 * GA » est une coquille du nom, le mémo dit AA 023 EA. Les plaques
 * réimmatriculées (DK 1306 BB → AB 098 JC…) passent à leur nouvelle plaque,
 * comme dans `reconcilier-pleins.mts`.
 *
 * CE QU'ON REFUSE, comme `charger-kilometrages.mts` : un odomètre **inférieur**
 * au dernier compteur connu du véhicule — relevé valide ou plein. Une balise
 * compte depuis sa pose, ou a été remise à zéro, ou suit un moteur remplacé :
 * on ne sait pas lequel, et charger un compteur qui recule abîmerait tout calcul
 * de distance. Le relevé est écarté, et nommé. De même un véhicule hors du parc,
 * ou une balise sans odomètre.
 *
 * Le premier passage (export du 02/10/2026) l'a montré : l'odomètre d'une balise
 * n'est pas le compteur du tableau de bord. Vingt reculaient, et d'autres
 * faisaient des bonds impossibles (AA 359 AH : 230 925 km en juillet, 755 688
 * au 2 octobre). Deux garde-fous de plus, donc :
 *   * **une vitesse plausible** — au plus 400 km par jour (`MAX_KM_JOUR`) depuis le
 *     dernier compteur connu ; au-delà, la balise ne compte pas ce que compte le
 *     véhicule ;
 *   * **un compteur de référence** — sans compteur connu, rien ne dit si
 *     l'odomètre est celui du véhicule ou celui de la balise (AA 235 MR, un
 *     camion, à 884 km) : le relevé n'est pas chargé, il est nommé.
 *
 * Il lit la base (clé de service, en lecture) et le classeur, et n'écrit que le
 * fichier SQL, que le métier joue.
 *
 * Lancer : npx tsx scripts/charger-traceurs.mts "<chemin du classeur>" [AAAA-MM-JJ]
 * ==========================================================================*/

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";
import { normaliser } from "../src/domaine/immatriculation";

for (const l of readFileSync(join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(l);
  if (m && !l.trimStart().startsWith("#")) process.env[m[1]!] ??= m[2]!.trim().replace(/^(['"])(.*)\1$/, "$2");
}
const pg = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const source = process.argv[2];
if (!source) throw new Error('Usage : npx tsx scripts/charger-traceurs.mts "<classeur>" [AAAA-MM-JJ]');
/* La date de l'export : en argument, sinon lue dans le nom du fichier (« _02-10-2026 »). */
const dansLeNom = /(\d{2})-(\d{2})-(\d{4})/.exec(source.split(/[\\/]/).at(-1) ?? "");
const date = process.argv[3] ?? (dansLeNom ? `${dansLeNom[3]}-${dansLeNom[2]}-${dansLeNom[1]}` : "");
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date de l'export introuvable : la donner en second argument.");

const REIMMATRICULES: Record<string, string> = { DK1306BB: "AB098JC", DK2348BD: "AB078JS", DK7485BK: "AB364HK" };
/** Au-delà, l'écart au dernier compteur n'est pas un trajet : un camion Dakar–Touba aller-retour fait ~400 km. */
const MAX_KM_JOUR = 400;
const texte = (c: Cellule | undefined) => (c === null || c === undefined ? "" : String(c).trim());
const plaquesDe = (t: string) => [...t.matchAll(/\b([A-Z]{2})[\s-]?(\d{3,4})[\s-]?([A-Z]{1,2})\b/gi)].map((m) => normaliser(m[0]));

/* -- La base : le parc et le dernier compteur connu de chaque véhicule ------- */
const vehicules = ((await pg.from("vehicule").select("id, immatriculation")).data ?? []) as { id: string; immatriculation: string }[];
const parc = new Map(vehicules.map((v) => [v.immatriculation, v.id]));
const dernier = new Map<string, { km: number; date: string; ou: string }>();
const retenir = (id: string, km: number | null, d: string, ou: string) => {
  if (!km) return;
  const x = dernier.get(id);
  if (!x || km > x.km) dernier.set(id, { km, date: d, ou });
};
for (let page = 0; ; page++) {
  const { data } = await pg.from("releve_kilometrique").select("vehicule_id, km, date, origine, motif_rejet").is("motif_rejet", null).range(page * 1000, page * 1000 + 999);
  for (const r of data ?? []) retenir(r.vehicule_id, r.km, r.date, `relevé ${r.origine}`);
  if (!data || data.length < 1000) break;
}
for (let page = 0; ; page++) {
  const { data } = await pg.from("plein").select("vehicule_id, km, date").not("km", "is", null).range(page * 1000, page * 1000 + 999);
  for (const r of data ?? []) retenir(r.vehicule_id, r.km, r.date, "plein");
  if (!data || data.length < 1000) break;
}

/* -- Le classeur ------------------------------------------------------------ */
const feuille = lireClasseur(source).find((f) => f.nom === "Liste des traceurs");
if (!feuille) throw new Error("Feuille « Liste des traceurs » absente.");
const en = feuille.lignes[0]!.map((c) => texte(c));
const col = (nom: string) => {
  const i = en.indexOf(nom);
  if (i < 0) throw new Error(`Colonne « ${nom} » absente.`);
  return i;
};

const retenus: { plaque: string; km: number; balise: string; avant: string }[] = [];
const ecartes: { balise: string; raison: string }[] = [];
for (const l of feuille.lignes.slice(1)) {
  const balise = texte(l[col("Nom")]);
  if (!balise) continue;
  const odometre = Number(texte(l[col("Odomètre")]));
  const candidates = [...plaquesDe(balise.replace(/^(CM|BUS)-/i, "")), ...plaquesDe(texte(l[col("Id chauffeur")])), ...plaquesDe(texte(l[col("Mémo")]))].map((p) => REIMMATRICULES[p] ?? p);
  const plaque = candidates.find((p) => parc.has(p));
  if (!plaque) {
    ecartes.push({ balise, raison: `hors du parc (${[...new Set(candidates)].join(", ") || "sans plaque"})` });
    continue;
  }
  if (!Number.isFinite(odometre) || odometre <= 0) {
    ecartes.push({ balise, raison: "pas d'odomètre" });
    continue;
  }
  const km = Math.round(odometre);
  const connu = dernier.get(parc.get(plaque)!);
  const fr = (n: number) => n.toLocaleString("fr-FR");
  if (!connu) {
    ecartes.push({ balise, raison: `${fr(km)} km, invérifiable : aucun compteur connu de ${plaque}` });
    continue;
  }
  if (km < connu.km) {
    ecartes.push({ balise, raison: `recule : ${fr(km)} km, contre ${fr(connu.km)} km au ${connu.date} (${connu.ou})` });
    continue;
  }
  const jours = Math.max(1, (Date.parse(date) - Date.parse(connu.date)) / 86_400_000);
  if ((km - connu.km) / jours > MAX_KM_JOUR) {
    ecartes.push({ balise, raison: `bond invraisemblable : ${fr(km)} km, contre ${fr(connu.km)} km au ${connu.date} (${connu.ou}), soit ${fr(Math.round((km - connu.km) / jours))} km par jour` });
    continue;
  }
  retenus.push({ plaque, km, balise, avant: `${connu.km} km au ${connu.date} (${connu.ou})` });
}

/* Deux balises sur le même véhicule : la plus haute l'emporte, l'autre est nommée. */
const parPlaque = new Map<string, (typeof retenus)[number]>();
for (const r of retenus) {
  const x = parPlaque.get(r.plaque);
  if (x) ecartes.push({ balise: (x.km >= r.km ? r : x).balise, raison: `seconde balise de ${r.plaque}` });
  if (!x || r.km > x.km) parPlaque.set(r.plaque, r);
}
const lignes = [...parPlaque.values()].sort((a, b) => a.plaque.localeCompare(b.plaque));

const echappe = (s: string) => s.replace(/'/g, "''");
const compact = date.slice(2).replace(/-/g, "");
const fichier = join(process.cwd(), "supabase", `releves-traceurs-${date}.sql`);
writeFileSync(
  fichier,
  `-- ============================================================================
-- SEDIMA Parc — odomètres des balises au ${date} (${echappe(source.split(/[\\/]/).at(-1)!)}).
--
-- **Ce n'est pas une migration.** Écrit par \`scripts/charger-traceurs.mts\`.
-- ${lignes.length} relevés « telematique », un par véhicule, numérotés TEL-${compact}-<plaque>.
-- Écartés (${ecartes.length}) :
${ecartes.map((e) => `--   * ${e.balise} — ${e.raison}`).join("\n")}
--
-- Rejouable : \`on conflict (numero) do nothing\`.
-- ============================================================================

insert into releve_kilometrique (numero, vehicule_id, date, km, origine)
select v.numero, ve.id, '${date}'::date, v.km, 'telematique'
  from (values
${lignes.map((r) => `    ('TEL-${compact}-${r.plaque}', '${r.plaque}', ${r.km})`).join(",\n")}
  ) as v(numero, immatriculation, km)
  join vehicule ve on ve.immatriculation = v.immatriculation
on conflict (numero) do nothing;

select count(*) as releves, min(km) as km_min, max(km) as km_max
  from releve_kilometrique where numero like 'TEL-${compact}-%';
`,
);

console.log(`${lignes.length} relevés retenus au ${date}, ${ecartes.length} écartés → ${fichier}`);
for (const r of lignes) console.log(`  ${r.plaque.padEnd(9)} ${String(r.km).padStart(8)} km  (avant : ${r.avant})`);
console.log("Écartés :");
for (const e of ecartes) console.log(`  ${e.balise.padEnd(16)} ${e.raison}`);

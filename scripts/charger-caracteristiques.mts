/* ============================================================================
 * Fabrique `supabase/caracteristiques-vehicules.sql` — ce que la carte grise
 * dit de chaque véhicule.
 *
 * Le référentiel ne portait ni date de mise en circulation, ni puissance, ni
 * cylindrée, ni masses : l'onglet Caractéristiques de la fiche disait « — »
 * partout. La gestion du parc tient ces valeurs dans
 * `MALICK/FICHE COMPLET VEHICULES PARC LIVRAISONS ET PERSONNELS.xlsx`
 * (10 septembre 2026), deux feuilles : « Listes Véhicules » et « Liste des
 * Pickups », recopiées des cartes grises.
 *
 * CE QU'ON CHARGE. Les dates de première mise en circulation et
 * d'immatriculation, le type, la puissance, la cylindrée, le PTRA, le PTAC,
 * le poids à vide et la charge utile — et le kilométrage relevé le 8 juillet
 * 2026 quand la feuille en porte un.
 *
 * CE QU'ON NE FAIT PAS.
 *
 *   * **Écraser.** Seul un champ vide se remplit : une valeur déjà en base a
 *     été saisie ou vérifiée, la feuille ne la contredit pas en silence. Une
 *     exception, et une seule : la mise en circulation « 1er janvier » que
 *     l'alignement a posée faute de mieux, d'après l'année du plan
 *     d'affectation (« 2021 »). La carte grise donne le jour : elle la remplace
 *     quand l'année concorde, et la laisse sinon.
 *   * **Charger un zéro.** La feuille écrit 0 pour « non relevé » : un PTRA de
 *     0 kg sur 143 lignes n'est pas une masse. Zéro devient inconnu.
 *   * **Charger une date impossible** : future (une mise en circulation en
 *     2029), ou postérieure à l'immatriculation.
 *   * **Faire reculer un compteur** : un kilométrage du 8 juillet plus petit
 *     qu'un compteur antérieur déjà chargé (pleins, bons de commande), ou plus
 *     grand qu'un compteur postérieur, est laissé dehors et nommé.
 *   * **Créer les véhicules absents** : c'est `vehicules-manquants.sql`, joué
 *     avant, qui les crée avec leurs décisions écrites
 *     (`charger-vehicules-manquants.mts`). Ce fichier les complète ensuite comme
 *     les autres ; une plaque qui resterait absente est listée.
 *
 * Lancer : npx tsx scripts/charger-caracteristiques.mts
 * ==========================================================================*/

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";
import { normaliser } from "../src/domaine/immatriculation";
import { COQUILLES, CREES, RENOMMAGES } from "./charger-vehicules-manquants.mts";

const FICHE = "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/61. Gestion Parc/MALICK/FICHE COMPLET VEHICULES PARC LIVRAISONS ET PERSONNELS.xlsx";
const DATE_RELEVE = "2026-07-08";
const AUJOURDHUI = "2026-09-11";
const projet = process.cwd();

const texte = (c: Cellule) => (c === null || c === undefined ? "" : String(c).trim());
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Une valeur mesurée : un nombre strictement positif. Zéro, vide ou texte, c'est inconnu. */
const mesure = (c: Cellule): number | null => {
  const n = typeof c === "number" ? c : Number(texte(c).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

/* -- 1. Le référentiel et les compteurs déjà chargés ------------------------ */

const lire = (f: string) => readFileSync(join(projet, f), "utf8");
const parc = new Set<string>();
for (const f of ["supabase/seed.sql", "supabase/aligner-referentiel.sql"]) {
  for (const b of lire(f).matchAll(/insert into vehicule \([^)]*\) values[\s\S]*?\non conflict[^;]*;/g)) {
    for (const m of b[0].matchAll(/^\s+\('[0-9a-f-]{36}', '([A-Z]{2}\d{3,4}[A-Z]{1,2})'/gm)) parc.add(m[1]!);
  }
}
/* Les véhicules créés et la plaque corrigée par `vehicules-manquants.sql`, joué avant ce fichier : ils se complètent comme les autres. */
for (const p of [...CREES, ...Object.values(RENOMMAGES)]) parc.add(p);
/** Les écritures de la fiche que le référentiel porte sous une autre plaque : coquilles, ancienne plaque (voir `plaque-dk6875.sql`). */
const ALIAS: Record<string, string> = { ...COQUILLES };

const compteurs = new Map<string, { date: string; km: number; source: string }[]>();
const noter = (plaque: string, date: string, km: number, source: string) => compteurs.set(plaque, [...(compteurs.get(plaque) ?? []), { date, km, source }]);
for (const m of lire("supabase/kilometrages.sql").matchAll(/\('(KM-R-\d+)', \(select id from vehicule where immatriculation = '([A-Z0-9]+)'\), '(\d{4}-\d{2}-\d{2})', (\d+)/g)) noter(m[2]!, m[3]!, Number(m[4]), m[1]!);
const pleins = [...readdirSync(join(projet, "supabase/carburant-parties")).filter((f) => f.endsWith(".sql")).map((f) => `supabase/carburant-parties/${f}`), "supabase/correctif-chargements.sql"];
for (const f of pleins) {
  for (const m of lire(f).matchAll(/\('(PLN-[A-Z]-\d+)', \(select id from vehicule where immatriculation = '([A-Z0-9]+)'\), '(\d{4}-\d{2}-\d{2})', [\d.]+, \d+, round\([^)]*\), (\d+)/g)) noter(m[2]!, m[3]!, Number(m[4]), m[1]!);
}

/* -- 2. La feuille ---------------------------------------------------------- */

interface Caracteristiques {
  plaque: string;
  ecrite: string;
  feuille: string;
  premiere: string | null;
  immatriculation: string | null;
  typeModele: string | null;
  puissance: number | null;
  cylindree: number | null;
  ptra: number | null;
  ptac: number | null;
  poidsVide: number | null;
  chargeUtile: number | null;
  km: number | null;
}

const lues = new Map<string, Caracteristiques>();
const absents: string[] = [];
const notes: string[] = [];
const conflits: string[] = [];

for (const feuille of lireClasseur(FICHE)) {
  const debut = feuille.lignes.findIndex((l) => l.map(texte).includes("N° Immatriculation"));
  if (debut < 0) continue;
  const entete = feuille.lignes[debut]!.map((c) => texte(c).replace(/\s+/g, " "));
  const col = (nom: string) => {
    const i = entete.indexOf(nom);
    if (i < 0) throw new Error(`${feuille.nom} : colonne « ${nom} » absente`);
    return i;
  };
  const c = {
    plaque: col("N° Immatriculation"), premiere: col("Date de 1ère mise en circulation"), immat: col("Date Immatriculation"), type: col("Type / Modèle"),
    puissance: col("Puissance, CV"), cylindree: col("Cylindrée, cm3"), ptra: col("PTRA, kg"), ptac: col("PTAC, kg"), pv: col("PV, kg"), cu: col("CU, kg"), km: col(`Kilométrage (${DATE_RELEVE})`),
  };
  for (const l of feuille.lignes.slice(debut + 1)) {
    const ecrite = texte(l[c.plaque]);
    if (!ecrite) continue;
    const brute = normaliser(ecrite);
    const plaque = ALIAS[brute] ?? brute;
    if (!parc.has(plaque)) {
      absents.push(ecrite);
      continue;
    }
    const date = (i: number, libelle: string): string | null => {
      const v = texte(l[i]);
      if (!v) return null;
      if (!DATE.test(v)) {
        notes.push(`${ecrite} : ${libelle} « ${v} » illisible, laissée vide`);
        return null;
      }
      if (v > AUJOURDHUI) {
        notes.push(`${ecrite} : ${libelle} ${v} dans le futur, laissée vide`);
        return null;
      }
      return v;
    };
    let premiere = date(c.premiere, "mise en circulation");
    const immatriculation = date(c.immat, "immatriculation");
    if (premiere && immatriculation && premiere > immatriculation) {
      notes.push(`${ecrite} : mise en circulation ${premiere} après l'immatriculation ${immatriculation}, laissée vide`);
      premiere = null;
    }
    const lu: Caracteristiques = {
      plaque, ecrite, feuille: feuille.nom, premiere, immatriculation, typeModele: texte(l[c.type]) || null,
      puissance: mesure(l[c.puissance]), cylindree: mesure(l[c.cylindree]), ptra: mesure(l[c.ptra]), ptac: mesure(l[c.ptac]), poidsVide: mesure(l[c.pv]), chargeUtile: mesure(l[c.cu]), km: mesure(l[c.km]),
    };
    const deja = lues.get(plaque);
    if (!deja) {
      lues.set(plaque, lu);
      continue;
    }
    /* La même plaque sur les deux feuilles : la première lue garde ses valeurs, la seconde comble ses vides, un désaccord est nommé. */
    for (const k of ["premiere", "immatriculation", "typeModele", "puissance", "cylindree", "ptra", "ptac", "poidsVide", "chargeUtile", "km"] as const) {
      if (deja[k] === null) (deja as unknown as Record<string, unknown>)[k] = lu[k];
      else if (lu[k] !== null && lu[k] !== deja[k]) conflits.push(`${ecrite} : ${k} ${deja[k]} (${deja.feuille}) / ${lu[k]} (${lu.feuille})`);
    }
  }
}

/* -- 3. Le kilométrage du 8 juillet, contrôlé -------------------------------- */

const releves: { plaque: string; km: number }[] = [];
const recules: string[] = [];
for (const v of lues.values()) {
  if (v.km === null) continue;
  const connus = compteurs.get(v.plaque) ?? [];
  const avant = connus.filter((x) => x.date <= DATE_RELEVE).sort((a, b) => b.date.localeCompare(a.date))[0];
  const apres = connus.filter((x) => x.date > DATE_RELEVE).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (avant && avant.km > v.km) recules.push(`${v.ecrite} : ${v.km} km le ${DATE_RELEVE}, mais ${avant.km} km le ${avant.date} (${avant.source})`);
  else if (apres && apres.km < v.km) recules.push(`${v.ecrite} : ${v.km} km le ${DATE_RELEVE}, mais ${apres.km} km le ${apres.date} (${apres.source})`);
  else releves.push({ plaque: v.plaque, km: v.km });
}

/* -- 4. Le fichier ---------------------------------------------------------- */

const vehicules = [...lues.values()].sort((a, b) => a.plaque.localeCompare(b.plaque));
const utiles = vehicules.filter((v) => [v.premiere, v.immatriculation, v.typeModele, v.puissance, v.cylindree, v.ptra, v.ptac, v.poidsVide, v.chargeUtile].some((x) => x !== null));
const sql = (v: string | number | null) => (v === null ? "null" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`);
const compte = (k: keyof Caracteristiques) => vehicules.filter((v) => v[k] !== null).length;

writeFileSync(
  join(projet, "supabase/caracteristiques-vehicules.sql"),
  `-- ============================================================================
-- SEDIMA Parc — ce que la carte grise dit de chaque véhicule.
--
-- **Ce n'est pas une migration.** Source : FICHE COMPLET VEHICULES PARC
-- LIVRAISONS ET PERSONNELS.xlsx (gestion du parc, 10 septembre 2026). Voir
-- docs/CARACTERISTIQUES-VEHICULES.md.
--
-- ${utiles.length} véhicules complétés, ${releves.length} relevés kilométriques du ${DATE_RELEVE.split("-").reverse().join("/")}.
-- Puissance pour ${compte("puissance")} véhicules, PTAC pour ${compte("ptac")}.
--
-- Seul un champ vide se remplit ; un zéro de la feuille reste inconnu.
-- REJOUABLE : un second passage ne change rien.
-- ============================================================================

begin;

update vehicule v set
  premiere_mise_en_circulation = case
    when v.premiere_mise_en_circulation is null then x.premiere::date
    /* La date « 1er janvier » de l'alignement n'était que l'année : la carte grise donne le jour, si l'année concorde. */
    when to_char(v.premiere_mise_en_circulation, 'MM-DD') = '01-01' and extract(year from v.premiere_mise_en_circulation) = extract(year from x.premiere::date) then x.premiere::date
    else v.premiere_mise_en_circulation
  end,
  date_immatriculation         = coalesce(v.date_immatriculation, x.immatriculation_le::date),
  type_modele                  = coalesce(v.type_modele, x.type_modele),
  puissance_cv                 = coalesce(v.puissance_cv, x.puissance::int),
  cylindree                    = coalesce(v.cylindree, x.cylindree::int),
  ptra                         = coalesce(v.ptra, x.ptra::int),
  ptac                         = coalesce(v.ptac, x.ptac::int),
  poids_vide                   = coalesce(v.poids_vide, x.poids_vide::int),
  charge_utile                 = coalesce(v.charge_utile, x.charge_utile::int)
  from (values
${utiles.map((v) => `    (${sql(v.plaque)}, ${sql(v.premiere)}, ${sql(v.immatriculation)}, ${sql(v.typeModele)}, ${sql(v.puissance)}, ${sql(v.cylindree)}, ${sql(v.ptra)}, ${sql(v.ptac)}, ${sql(v.poidsVide)}, ${sql(v.chargeUtile)})`).join(",\n")}
  ) as x(immatriculation, premiere, immatriculation_le, type_modele, puissance, cylindree, ptra, ptac, poids_vide, charge_utile)
 where v.immatriculation = x.immatriculation;

insert into releve_kilometrique (numero, vehicule_id, date, km, origine)
select x.numero, v.id, '${DATE_RELEVE}', x.km, 'saisie'
  from (values
${releves.map((r, i) => `    ('REL-FC-${String(i + 1).padStart(5, "0")}', ${sql(r.plaque)}, ${r.km})`).join(",\n")}
  ) as x(numero, immatriculation, km)
  join vehicule v on v.immatriculation = x.immatriculation
on conflict (numero) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Vérification : combien de véhicules portent désormais chaque caractéristique.
-- ---------------------------------------------------------------------------

select count(*) as vehicules,
       count(premiere_mise_en_circulation) as mise_en_circulation, count(date_immatriculation) as immatriculation,
       count(puissance_cv) as puissance, count(cylindree) as cylindree, count(ptac) as ptac, count(ptra) as ptra,
       count(poids_vide) as poids_vide, count(charge_utile) as charge_utile,
       (select count(*) from releve_kilometrique where numero like 'REL-FC-%') as releves_du_8_juillet
  from vehicule;
`,
);

/* -- 5. Le compte rendu ----------------------------------------------------- */

console.log(`${vehicules.length} véhicules du parc lus sur la feuille, ${utiles.length} avec au moins une caractéristique`);
console.log(`mise en circulation ${compte("premiere")}, immatriculation ${compte("immatriculation")}, type ${compte("typeModele")}, puissance ${compte("puissance")}, cylindrée ${compte("cylindree")}, PTRA ${compte("ptra")}, PTAC ${compte("ptac")}, poids à vide ${compte("poidsVide")}, charge utile ${compte("chargeUtile")}`);
console.log(`kilométrages du ${DATE_RELEVE} : ${compte("km")} lus, ${releves.length} chargés, ${recules.length} écartés`);
for (const r of recules) console.log(`  écarté — ${r}`);
console.log(`\n${notes.length} valeurs laissées vides :`);
for (const n of notes) console.log(`  ${n}`);
console.log(`\n${conflits.length} désaccords entre les deux feuilles :`);
for (const x of conflits) console.log(`  ${x}`);
console.log(`\n${absents.length} plaques absentes du référentiel : ${absents.join(", ")}`);

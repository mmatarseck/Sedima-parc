/* ============================================================================
 * Fabrique `supabase/taches-service.sql` — le catalogue des tâches de service,
 * tiré de l'export Fleetio (21 septembre 2026).
 *
 * L'export compte 510 tâches ; 350 ont servi au moins une fois, pour 11 481
 * utilisations. Décision du métier du même jour : partir de celles-là, avec la
 * classification de Fleetio (catégorie, système, ensemble).
 *
 * LE NETTOYAGE.
 *   * « main d'oeuvre » (1 678 utilisations) n'est pas une tâche : c'est la
 *     colonne main-d'œuvre de chaque ligne de service. Écartée, avec les
 *     libellés qui ne désignent pas un travail — « Maintenance curative »,
 *     « Maintenance préventive », « Transport ».
 *   * Les doublons se fondent : même libellé aux accents, à la casse et à la
 *     ponctuation près (« MOTEUR DIVERS » et « Moteur (Divers) »), et quelques
 *     synonymes relus à la main (« vidange » est « Remplacement de l'huile
 *     moteur et du filtre »). Le nom fondu reste en alias : il se retrouve
 *     encore dans le formulaire.
 *   * Les 143 tâches créées à la main dans Fleetio n'ont aucun code : leur
 *     système se reconnaît au libellé (`systemeReconnu`) ; celles qu'on ne
 *     reconnaît pas passent en « Divers », marquées **à classer**.
 *
 * Rejouable : une tâche dont le libellé existe déjà n'est pas recréée.
 *
 * Lancer : npx tsx scripts/charger-taches-fleetio.mts [chemin de l'export]
 * ==========================================================================*/

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { lireClasseur } from "./lire-xlsx.mts";
import { systemeDe, systemeReconnu } from "../src/domaine/categories-maintenance";
import { cleTache } from "../src/domaine/taches";

const EXPORT = process.argv[2] ?? "C:/Users/mamadou.seck/Downloads/fleetio-service-task-export-2026-09-21.xlsx";

const texte = (x: unknown) => String(x ?? "").trim();
const entier = (x: unknown) => Number(x ?? 0) || 0;
const echappe = (s: string) => s.replace(/'/g, "''");

/** Ce qui n'est pas une tâche de maintenance. */
const ECARTES = new Set(["main d'oeuvre", "MAIN DOEUVRE", "Maintenance curative", "Maintenance préventive", "Transport"].map(cleTache));

/** Les synonymes relus à la main : le premier est absorbé par le second. */
const SYNONYMES: [string, string][] = [
  ["vidange", "Remplacement de l'huile moteur et du filtre"],
  ["Electrical System (Miscellaneous)", "Système électrique (Divers)"],
  ["Carrosserie et châssis (Divers)", "Carrosserie (Divers)"],
  ["MAIN D OEUVRE DEPANNAGE", "Assistance routière/remorquage"],
];
const VERS = new Map(SYNONYMES.map(([a, b]) => [cleTache(a), cleTache(b)]));

/** La nature habituelle d'une tâche, lue dans son nom : l'entretien prévu, ou la réparation. */
function typeDe(libelle: string): "preventif" | "curatif" | null {
  if (/inspection|contr[ôo]le|v[ée]rification|vidange|huile|lubrifi|graissage|entretien|rotation|[ée]quilibrage|alignement|couple de serrage|couple des|nettoyage|remplissage|filtre|service de|test/i.test(libelle)) return "preventif";
  if (/r[ée]paration|remplacement|divers|changement|d[ée]pannage|remorquage|carrosserie/i.test(libelle)) return "curatif";
  return null;
}

interface Tache {
  libelle: string;
  description: string | null;
  categorie: string | null;
  systeme: string | null;
  ensemble: string | null;
  utilisations: number;
  alias: string[];
  aClasser: boolean;
}

const lignes = lireClasseur(EXPORT)[0]!.lignes;
const entete = lignes[0]!.map(texte);
const col = (nom: string) => {
  const i = entete.indexOf(nom);
  if (i < 0) throw new Error(`colonne « ${nom} » introuvable dans l'export`);
  return i;
};
const cNom = col("Name"), cDesc = col("Description"), cUtil = col("Service Entries"), cCat = col("Default Category Code"), cSys = col("Default System Code"), cEns = col("Default Assembly Code");

const parCle = new Map<string, Tache>();
let lues = 0, jamais = 0, ecartees = 0, fondues = 0;
for (const l of lignes.slice(1)) {
  const libelle = texte(l[cNom]).replace(/\s+/g, " ");
  if (!libelle) continue;
  lues++;
  const utilisations = entier(l[cUtil]);
  if (utilisations === 0) {
    jamais++;
    continue;
  }
  const k0 = cleTache(libelle);
  if (ECARTES.has(k0)) {
    ecartees++;
    continue;
  }
  const k = VERS.get(k0) ?? k0;
  const systemeFleetio = texte(l[cSys]) || null;
  const categorieFleetio = texte(l[cCat]) || null;
  const deja = parCle.get(k);
  if (deja) {
    fondues++;
    deja.utilisations += utilisations;
    if (cleTache(deja.libelle) !== k0) deja.alias.push(libelle);
    /* Le libellé retenu est celui du synonyme cible, ou le plus utilisé ; un code Fleetio passe devant une reconnaissance. */
    if (k0 === k && cleTache(deja.libelle) !== k) {
      deja.alias.push(deja.libelle);
      deja.libelle = libelle;
    }
    if (systemeFleetio && (!deja.systeme || deja.aClasser)) {
      deja.systeme = systemeFleetio;
      deja.categorie = categorieFleetio ?? systemeDe(systemeFleetio)?.categorie ?? null;
      deja.aClasser = false;
    }
    if (!deja.ensemble && texte(l[cEns])) deja.ensemble = texte(l[cEns]);
    continue;
  }
  let systeme = systemeFleetio;
  let categorie = categorieFleetio;
  let aClasser = false;
  if (!systeme && !categorie) {
    systeme = systemeReconnu(libelle);
    if (!systeme) {
      systeme = "999";
      aClasser = true;
    }
    categorie = systemeDe(systeme)?.categorie ?? null;
  }
  parCle.set(k, { libelle, description: texte(l[cDesc]) || null, categorie, systeme, ensemble: texte(l[cEns]) || null, utilisations, alias: k0 === k ? [] : [libelle], aClasser });
}
/* Un synonyme lu avant sa cible a pris la place : on rend son nom à la cible. */
for (const [, cible] of SYNONYMES.map(([a, b]) => [a, b] as const)) {
  const t = parCle.get(cleTache(cible));
  if (t && cleTache(t.libelle) !== cleTache(cible)) {
    t.alias.push(t.libelle);
    t.libelle = cible;
  }
}

const taches = [...parCle.values()].sort((a, b) => b.utilisations - a.utilisations || a.libelle.localeCompare(b.libelle, "fr"));
const lignesSql = taches.map((t, i) => {
  const alias = t.alias.filter((a, j, x) => x.indexOf(a) === j && cleTache(a) !== cleTache(t.libelle));
  const tableau = alias.length ? `array[${alias.map((a) => `'${echappe(a)}'`).join(", ")}]::text[]` : `'{}'::text[]`;
  const sql = (v: string | null) => (v === null ? "null" : `'${echappe(v)}'`);
  return `  ('TCH-2026-${String(i + 1).padStart(5, "0")}', ${sql(t.libelle)}, ${sql(t.description)}, ${sql(t.categorie)}, ${sql(t.systeme)}, ${sql(t.ensemble && /^\d{3}$/.test(t.ensemble) ? t.ensemble : null)}, ${sql(typeDe(t.libelle))}, ${tableau}, ${t.utilisations}, 'fleetio', ${t.aClasser})`;
});

const aClasser = taches.filter((t) => t.aClasser);
const reconnues = taches.filter((t) => !t.aClasser && !t.ensemble && t.systeme && t.alias.length === 0).length;
writeFileSync(
  join(process.cwd(), "supabase/taches-service.sql"),
  `-- ============================================================================
-- SEDIMA Parc — le catalogue des tâches de service, tiré de l'export Fleetio.
--
-- **Ce n'est pas une migration.** À jouer après 0060. Fabriqué par
-- \`scripts/charger-taches-fleetio.mts\` — voir docs/SERVICES-MAINTENANCE.md.
--
-- ${lues} tâches dans l'export ; ${jamais} jamais utilisées, laissées ; ${ecartees} qui ne sont pas des
-- tâches (main-d'œuvre, « maintenance curative »…), écartées ; ${fondues} doublons fondus.
-- Restent **${taches.length} tâches**, classées comme Fleetio (catégorie, système, ensemble),
-- ${aClasser.length} à classer. Leurs utilisations dans Fleetio ordonnent les listes.
--
-- REJOUABLE : une tâche dont le libellé existe déjà n'est pas recréée.
-- ============================================================================

insert into tache_service (numero, libelle, description, categorie, systeme, ensemble, type_defaut, alias, utilisations, source, a_classer) values
${lignesSql.join(",\n")}
on conflict do nothing;

select count(*) as taches, count(*) filter (where a_classer) as a_classer, sum(utilisations) as utilisations from tache_service;
`,
  "utf8",
);

console.log(`${lues} tâches lues · ${jamais} jamais utilisées · ${ecartees} écartées · ${fondues} fondues`);
console.log(`${taches.length} tâches au catalogue · ${aClasser.length} à classer · ${reconnues} classées par leur libellé ou sans ensemble`);
const parCategorie = new Map<string, number>();
for (const t of taches) parCategorie.set(t.categorie ?? "—", (parCategorie.get(t.categorie ?? "—") ?? 0) + 1);
console.log(`par catégorie : ${[...parCategorie].sort().map(([c, n]) => `${c}: ${n}`).join(" · ")}`);
console.log(`à classer : ${aClasser.slice(0, 30).map((t) => t.libelle).join(" | ")}`);
console.log(`fondues : ${taches.filter((t) => t.alias.length).slice(0, 12).map((t) => `${t.libelle} ← ${t.alias.join(", ")}`).join(" | ")}`);
console.log("supabase/taches-service.sql");

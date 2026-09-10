/* Les champs figés du mode base — la chasse aux chiffres inventés, faite par
 * la machine.
 *
 * Le 10 septembre 2026, trois défauts de la même famille ont été trouvés à la
 * main : `cout: 0` sur les incidents d'un chauffeur, `kmParcourus: 0` sur les
 * affectations des rapports, un rythme de 100 km/jour posé pour tout le parc.
 * Chaque fois, le lecteur de la base remplissait un champ d'une valeur
 * inventée là où la démonstration porte une vraie donnée — et l'écran
 * l'affichait comme un fait.
 *
 * La signature est toujours la même : **en base le champ ne prend qu'une
 * seule valeur sur tout le parc, en démonstration il en prend plusieurs.**
 * Ce banc la cherche seul, sur les lignes de la Flotte et sur les
 * affectations, et nomme les champs suspects.
 *
 * Il ne dit pas « défaut » : un champ peut être constant pour de bonnes
 * raisons (une flotte d'une seule business unit, un seed plus pauvre que le
 * dossier de démonstration). Il dit « à regarder », et la liste des cas déjà
 * jugés plus bas évite de rejuger deux fois les mêmes.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-constantes.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { PARAMETRES_DEFAUT } from "../src/domaine/parametres";
import { ligneDepuisLaBase, type ParcBrut } from "../src/donnees/flotte";
import { lignesFlotteDemonstration } from "../src/donnees/flotte-demo";
import { affectationsDepuisLeParc } from "../src/donnees/rapports";
import { affectationsDemonstration } from "../src/donnees/rapports-demo";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();
const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key);
  insert into auth.users values ('00000000-0000-0000-0000-000000000001');
  create function auth.uid() returns uuid language sql stable as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;`);
for (const m of readdirSync(join(projet, "supabase/migrations")).sort()) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
for (const p of readdirSync(join(projet, "supabase/seed-parties")).filter((f) => f.endsWith(".sql")).sort()) {
  const texte = readFileSync(join(projet, "supabase/seed-parties", p), "utf8");
  let courant: string[] = [];
  for (const ligne of texte.split("\n")) {
    courant.push(ligne);
    if (/^on conflict .*;$/.test(ligne.trim())) {
      try {
        await pg.exec(courant.join("\n"));
      } catch {}
      courant = [];
    }
  }
}

/* -- Les cas déjà jugés : nommés ici pour ne pas les rejuger à chaque passage.
 *
 * Un champ n'entre dans cette liste qu'avec sa raison écrite. Retirer une
 * ligne, c'est rouvrir le dossier — c'est le but.
 * ------------------------------------------------------------------------ */
const JUGES: Record<string, string> = {
  "ligne.attelageCourant": "la base n'a pas de table d'attelage (aveu en tête de flotte.ts) ; l'écran rend « pas d'attelage », ce qui reste faux sur un tracteur attelé — dossier ouvert, il faudrait une table",
  "affectation.numero": "lire_parc() (0009) ne projette pas a.numero : sa liste d'affectations ne porte que vehicule_id, chauffeur_id, role, debut, fin. Aucune colonne de rapport ne montre ce numéro aujourd'hui ; en ajouter une le montrerait vide, et il faudrait alors élargir la projection",
  "affectation.motif": "lire_parc() (0009) ne projette pas a.motif non plus, pour la même raison et avec la même conséquence. La fiche, elle, le lit bien (lire_fiche, 0013/0023)",
};

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

/* -- Le comptage des valeurs distinctes, champ par champ --------------------- */

/** Les chemins de tous les champs terminaux d'un objet, « a.b.c ». Un tableau est un terminal : on compare sa longueur. */
function chemins(objet: unknown, prefixe: string, sortie: Set<string>, profondeur = 0): void {
  if (objet === null || typeof objet !== "object" || Array.isArray(objet) || profondeur > 3) {
    sortie.add(prefixe);
    return;
  }
  for (const [cle, valeur] of Object.entries(objet)) chemins(valeur, prefixe ? `${prefixe}.${cle}` : cle, sortie, profondeur + 1);
}

function valeurA(objet: unknown, chemin: string): unknown {
  let courant = objet;
  for (const morceau of chemin.split(".")) {
    if (courant === null || typeof courant !== "object") return undefined;
    courant = (courant as Record<string, unknown>)[morceau];
  }
  return courant;
}

/** Ce qu'on compare : une valeur réduite à sa trace, un tableau à sa longueur. */
function trace(v: unknown): string {
  if (Array.isArray(v)) return `[${v.length}]`;
  if (v === null || v === undefined) return "∅";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function distinctes(lignes: unknown[], chemin: string): Set<string> {
  const vues = new Set<string>();
  for (const l of lignes) vues.add(trace(valeurA(l, chemin)));
  return vues;
}

/**
 * Les champs figés en base et vivants en démonstration. Rend la liste des
 * suspects, avec la valeur unique que la base leur donne.
 */
function suspects(base: unknown[], demo: unknown[], prefixe: string): { chemin: string; valeur: string; enDemo: number }[] {
  if (!base.length || !demo.length) return [];
  const tous = new Set<string>();
  for (const l of base.slice(0, 20)) chemins(l, "", tous);
  const trouves: { chemin: string; valeur: string; enDemo: number }[] = [];
  for (const chemin of [...tous].sort()) {
    const enBase = distinctes(base, chemin);
    if (enBase.size !== 1) continue;
    const seule = [...enBase][0]!;
    /* Une valeur unique qui n'est ni vide ni fausse peut être un vrai fait
       partagé ; c'est le contraste avec la démonstration qui accuse. */
    const enDemo = distinctes(demo, chemin);
    if (enDemo.size < 2) continue;
    trouves.push({ chemin: `${prefixe}.${chemin}`, valeur: seule, enDemo: enDemo.size });
  }
  return trouves;
}

/* -- 1. Les lignes de la Flotte --------------------------------------------- */

const aujourdhui = new Date().toISOString().slice(0, 10);
const j = (await pg.query(`select lire_parc($1) as j`, [`${Number(aujourdhui.slice(0, 4)) - 1}${aujourdhui.slice(4)}`])).rows[0].j as any;
const parc: ParcBrut = {
  aujourdhui,
  attributions: j.attributions,
  attributaires: new Map(j.attributaires.map((a: any) => [a.id, a])),
  aRecevoir: j.a_recevoir,
  vehicules: j.vehicules,
  sites: new Map(j.sites.map((s: any) => [s.id, { id: s.id, code: s.code, libelle: s.libelle, region: s.region, type: s.type }])),
  chauffeurs: new Map(j.chauffeurs.map((c: any) => [c.id, c])),
  affectations: j.affectations,
  documents: j.documents,
  licences: j.licences,
  licencesVehicules: j.licences_vehicules,
  releves: j.releves,
  depenses: j.depenses,
  pleins: j.pleins,
  interventions: j.interventions,
};
const lignesBase = parc.vehicules.map((v) => ligneDepuisLaBase(v, parc, PARAMETRES_DEFAUT));
const lignesDemo = lignesFlotteDemonstration(PARAMETRES_DEFAUT);
console.log(`flotte : ${lignesBase.length} lignes en base, ${lignesDemo.length} en démonstration`);

/* -- 2. Les affectations des rapports --------------------------------------- */

const affectationsBase = [...affectationsDepuisLeParc(parc).values()].flat();
const affectationsDemo = [...affectationsDemonstration(PARAMETRES_DEFAUT).values()].flat();
console.log(`affectations : ${affectationsBase.length} en base, ${affectationsDemo.length} en démonstration`);

/* -- 3. Le verdict ----------------------------------------------------------- */

const trouves = [...suspects(lignesBase, lignesDemo, "ligne"), ...suspects(affectationsBase, affectationsDemo, "affectation")];
const neufs = trouves.filter((t) => !(t.chemin in JUGES));
const connus = trouves.filter((t) => t.chemin in JUGES);

for (const t of connus) console.log(`   déjà jugé  ${t.chemin} = ${t.valeur} — ${JUGES[t.chemin]}`);
for (const t of neufs) console.log(`   À REGARDER ${t.chemin} : figé à ${t.valeur} en base, ${t.enDemo} valeurs distinctes en démonstration`);

attendu(`aucun champ figé de plus qu'attendu (${connus.length} déjà jugé(s), ${neufs.length} nouveau(x))`, neufs.length === 0);

console.log(echecs === 0 ? "tout passe" : `${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

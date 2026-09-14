/* Ce que disent les cartes grises.
 *
 * `supabase/cartes-grises.sql` pose sur le référentiel ce qui a été lu sur les
 * scans du dossier DO. Ce banc le joue à la suite des chargements de
 * production et vérifie :
 *
 *   * que les valeurs annoncées entrent, et que le fichier est rejouable ;
 *   * qu'**aucun VIN fabriqué ne subsiste** — ni ceux que les cartes ont
 *     corrigés, ni les cinquante restants, effacés faute de carte ;
 *   * que tout VIN chargé a ses dix-sept caractères et qu'aucun n'est en
 *     double : deux véhicules ne partagent pas un châssis ;
 *   * qu'aucun zéro de carte grise n'est entré comme une masse ou une
 *     puissance ;
 *   * que ce que la carte grise ne dit pas — réservoir, valeur d'acquisition —
 *     n'a pas bougé.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-cartes-grises.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();
const MOI = "00000000-0000-0000-0000-000000000001";

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key);
  insert into auth.users values ('${MOI}');
  create function auth.uid() returns uuid language sql stable as $$ select '${MOI}'::uuid $$;`);
for (const r of ["anon", "authenticated", "service_role"]) {
  try {
    await pg.exec(`create role ${r}`);
  } catch {}
}
for (const m of readdirSync(join(projet, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
await pg.exec(`insert into profil (utilisateur_id, nom, role, actif) values ('${MOI}', 'Banc', 'administrateur', true) on conflict do nothing;`);
for (const p of readdirSync(join(projet, "supabase/seed-parties")).filter((f) => f.endsWith(".sql")).sort()) {
  let courant: string[] = [];
  for (const ligne of readFileSync(join(projet, "supabase/seed-parties", p), "utf8").split("\n")) {
    courant.push(ligne);
    if (!/^on conflict .*;$/.test(ligne.trim())) continue;
    try {
      await pg.exec(courant.join("\n"));
    } catch {}
    courant = [];
  }
}
const purge = readFileSync(join(projet, "supabase/purge-demonstration.sql"), "utf8");
await pg.exec(purge.slice(purge.indexOf("begin;"), purge.indexOf("commit;") + 7));
const jouer = async (f: string) => {
  const t = readFileSync(join(projet, "supabase", f), "utf8");
  const fin = t.indexOf("-- ---------------------------------------------------------------------------\n-- Vérification");
  await pg.exec(fin < 0 ? t : t.slice(0, fin));
};
await pg.exec(readFileSync(join(projet, "supabase/aligner-referentiel.sql"), "utf8"));
await jouer("vehicules-manquants.sql");
await jouer("caracteristiques-vehicules.sql");

const un = async <T>(sql: string): Promise<T> => (await pg.query(sql)).rows[0] as T;
const compter = async (colonne: string) => (await un<{ n: number }>(`select count(${colonne})::int as n from vehicule`)).n;

/* -- Avant --------------------------------------------------------------- */

const avant = { vin: await compter("vin"), ptac: await compter("ptac"), reservoir: await compter("capacite_reservoir"), valeur: await compter("valeur_acquisition") };

/* Les VIN fabriqués : la fonction de la démonstration, rejouée ici pour les
   reconnaître à coup sûr — trois lettres de constructeur, quatorze caractères
   tirés d'un hachage de l'immatriculation. */
function suffixeInvente(canonique: string): string {
  let h = 7;
  for (const ch of canonique) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const alphabet = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  let suite = "";
  for (let i = 0; i < 14; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    suite += alphabet[h % alphabet.length];
  }
  return suite;
}
const fabrique = (v: { immatriculation: string; vin: string }) => v.vin.length === 17 && v.vin.slice(3) === suffixeInvente(v.immatriculation);
const tousLesVin = async () => (await pg.query<{ immatriculation: string; vin: string }>(`select immatriculation, vin from vehicule where vin is not null`)).rows;
const reelsAvant = (await tousLesVin()).filter((v) => !fabrique(v)).length;
console.log(`    avant : ${avant.vin} VIN, dont ${avant.vin - reelsAvant} fabriqués par la démonstration`);

/* -- Ce que le fichier annonce -------------------------------------------- */

const fichier = readFileSync(join(projet, "supabase/cartes-grises.sql"), "utf8");
const [, annonceValeurs, annonceVehicules] = /\*\*Ce n'est pas une migration\.\*\* (\d+) valeurs posées sur (\d+) véhicules/.exec(fichier) ?? [];
const [, annonceRemplaces] = /\*\*Sauf (\d+) numéros de châssis\*\*/.exec(fichier) ?? [];
const [, annonceEffaces] = /-- (\d+) d'entre eux n'ont pas de carte grise/.exec(fichier) ?? [];

/* -- Après ---------------------------------------------------------------- */

await jouer("cartes-grises.sql");
const apres = { vin: await compter("vin"), ptac: await compter("ptac"), reservoir: await compter("capacite_reservoir"), valeur: await compter("valeur_acquisition") };
console.log(`    VIN ${avant.vin} → ${apres.vin} · PTAC ${avant.ptac} → ${apres.ptac}`);

attendu(`le fichier annonce ${annonceValeurs} valeurs sur ${annonceVehicules} véhicules, et ${annonceRemplaces} VIN remplacés`, Number(annonceValeurs) > 0 && Number(annonceVehicules) > 0 && Number(annonceRemplaces) > 0);
attendu(`le PTAC gagne ${apres.ptac - avant.ptac} véhicules (${avant.ptac} → ${apres.ptac})`, apres.ptac > avant.ptac);

const restants = await tousLesVin();
const inventes = restants.filter(fabrique);
attendu(`aucun VIN fabriqué ne subsiste (${inventes.length} trouvé${inventes.length > 1 ? "s" : ""}${inventes.length ? " : " + inventes.map((v) => v.immatriculation).join(", ") : ""})`, inventes.length === 0);
/* Ce qui reste est exactement : ce qui était réel avant, plus ce que les cartes
   apportent — les cinq remplacés compris, puisqu'ils ne comptaient pas comme
   réels avant. Tout le reste a été effacé. */
const poses = (fichier.match(/\bvin = (?:coalesce\(vin, )?'/g) ?? []).length;
attendu(`${apres.vin} VIN en base = ${reelsAvant} déjà réel(s) + ${poses} posé(s) par les cartes`, apres.vin === reelsAvant + poses);
attendu(`les ${annonceEffaces} VIN fabriqués sans carte sont effacés`, Number(annonceEffaces) === avant.vin - reelsAvant - Number(annonceRemplaces));

/* Dix-sept caractères est la norme, mais la carte d'une semi-remorque ancienne
   en porte parfois seize — celle de AA 214 XK écrit VFKT34CW32FX2011, et c'est
   ce qu'il faut charger. On contrôle donc la forme, pas la longueur exacte :
   des majuscules et des chiffres, assez longs pour être un numéro de série. */
const horsForme = restants.filter((v) => !/^[A-Z0-9]{11,17}$/.test(v.vin));
attendu(`tout VIN chargé a la forme d'un numéro de série (${horsForme.length} hors forme${horsForme.length ? " : " + horsForme.map((v) => `${v.immatriculation} ${v.vin}`).join(", ") : ""})`, horsForme.length === 0);
const courts = restants.filter((v) => v.vin.length !== 17);
console.log(`    ${courts.length} VIN de moins de dix-sept caractères : ${courts.map((v) => `${v.immatriculation} (${v.vin.length})`).join(", ") || "aucun"}`);
const doublons = await un<{ n: number }>(`select count(*)::int as n from (select vin from vehicule where vin is not null group by vin having count(*) > 1) d`);
attendu(`deux véhicules ne partagent pas un châssis (${doublons.n} VIN en double)`, doublons.n === 0);

/* Un zéro de carte grise n'est pas une masse. */
const zeros = await un<{ n: number }>(`select count(*)::int as n from vehicule
  where ptac = 0 or poids_vide = 0 or charge_utile = 0 or puissance_cv = 0 or cylindree = 0`);
attendu(`aucun zéro entré comme masse ou puissance (${zeros.n})`, zeros.n === 0);

/* Cohérence des masses : la charge utile ne dépasse pas le PTAC. */
const incoherentes = (await pg.query<{ immatriculation: string; ptac: number; charge_utile: number; poids_vide: number }>(`select immatriculation, ptac, charge_utile, poids_vide from vehicule
  where (charge_utile is not null and ptac is not null and charge_utile > ptac)
     or (poids_vide is not null and ptac is not null and poids_vide > ptac)`)).rows;
attendu(`les masses restent cohérentes (${incoherentes.length} contradiction${incoherentes.length > 1 ? "s" : ""}${incoherentes.length ? " : " + incoherentes.map((v) => v.immatriculation).join(", ") : ""})`, incoherentes.length === 0);

/* Ce que la carte grise ne dit pas n'a pas bougé. */
attendu(`ce que la carte grise ignore n'a pas bougé : réservoir ${apres.reservoir}, valeur d'acquisition ${apres.valeur}`, apres.reservoir === avant.reservoir && apres.valeur === avant.valeur);

/* Rejouable. */
await jouer("cartes-grises.sql");
const rejoue = { vin: await compter("vin"), ptac: await compter("ptac") };
attendu("rejouable : le fichier rejoué ne change rien", rejoue.vin === apres.vin && rejoue.ptac === apres.ptac);

/* Un échantillon, lu à la main sur la carte : il doit se retrouver tel quel. */
const tata = await un<{ vin: string; ptac: number; charge_utile: number; type_modele: string }>(`select vin, ptac, charge_utile, type_modele from vehicule where immatriculation = 'AA359AH'`);
attendu(`AA-359-AH porte ce que sa carte dit (${tata?.vin}, ${tata?.ptac} kg, ${tata?.type_modele})`, tata?.vin === "MAT386321K7L00277" && tata.ptac === 4400 && tata.charge_utile === 2500 && tata.type_modele === "386321FI");

/* -- Le correctif d'AA 093 VA ---------------------------------------------- */
/* Son scan est nommé « AA 093 VAA » — un A de trop — si bien que la lecture des
   cartes l'a compté parmi les véhicules sans carte grise et lui a effacé son
   VIN. Le correctif le lui rend ; le banc vérifie qu'il le rend bien, sans
   défaire ce que le fichier principal a posé. */
const avantCorrectif = await compter("vin");
const sansVin = await un<{ vin: string | null }>(`select vin from vehicule where immatriculation = 'AA093VA'`);
attendu("AA 093 VA est bien sans VIN avant le correctif (la faute de frappe le lui avait ôté)", sansVin !== null && sansVin.vin === null);
await jouer("correctif-carte-grise-aa093va.sql");
const apresCorrectif = await un<{ vin: string; premiere: string | null; immat: string | null }>(`select vin, premiere_mise_en_circulation::text as premiere, date_immatriculation::text as immat from vehicule where immatriculation = 'AA093VA'`);
attendu(`AA 093 VA porte le VIN de sa carte (${apresCorrectif?.vin})`, apresCorrectif?.vin === "MAT449375K2L00007");
attendu(`ses dates, déjà en base, n'ont pas bougé (${apresCorrectif?.premiere} → ${apresCorrectif?.immat})`, apresCorrectif?.premiere === "2019-05-24" && apresCorrectif?.immat === "2024-09-25");
const apresUn = await compter("vin");
attendu(`le correctif ajoute un VIN et un seul (${avantCorrectif} → ${apresUn})`, apresUn === avantCorrectif + 1);
await jouer("correctif-carte-grise-aa093va.sql");
attendu("rejouable : le correctif rejoué ne change rien", (await compter("vin")) === apresUn);
const inventesApres = (await tousLesVin()).filter(fabrique);
attendu(`aucun VIN fabriqué n'est revenu (${inventesApres.length})`, inventesApres.length === 0);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);

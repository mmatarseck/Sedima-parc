/* ============================================================================
 * Banc du suivi de l'activité (0078) : l'écran noté sans ses identifiants, le
 * module qu'il désigne, le niveau d'usage ; puis, avec PGlite, la migration —
 * une visite comptée pour soi seul, les saisies et modifications d'une
 * personne, et la lecture réservée à l'administrateur et à la direction.
 *
 *   PGLITE_DIR=/tmp/pglite node --import tsx scripts/tester-activite.mts
 * ==========================================================================*/

import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { cheminActivite, moduleActivite, modulesDe, niveauUsage } from "../src/domaine/activite";

let echecs = 0;
function attendu(libelle: string, ok: boolean) {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
}

attendu(`un écran se note sans ses identifiants (${cheminActivite("/flotte/AA032EA?onglet=entretien")})`, cheminActivite("/flotte/AA032EA?onglet=entretien") === "/flotte/[…]");
attendu("un numéro ou un identifiant de base ne se note pas non plus", cheminActivite("/maintenance/OTR-2026-00012") === "/maintenance/[…]" && cheminActivite("/parametres/utilisateurs/3f2b6a1c-0d4e-4f5a-9b8c-7d6e5f4a3b2c") === "/parametres/utilisateurs/[…]");
attendu("les écrans nommés restent lisibles", cheminActivite("/parametres/entretien") === "/parametres/entretien" && cheminActivite("/") === "/");
attendu("le module d'un écran : la flotte, le tableau de bord, le téléphone et ce qu'on y fait", moduleActivite("/flotte/[…]") === "Flotte" && moduleActivite("/") === "Tableau de bord" && moduleActivite("/telephone/atelier") === "Téléphone · atelier" && moduleActivite("/telephone") === "Téléphone · accueil");
attendu(
  "les modules d'une personne, cumulés et triés",
  JSON.stringify(modulesDe([{ chemin: "/flotte", vues: 2 }, { chemin: "/flotte/[…]", vues: 5 }, { chemin: "/maintenance", vues: 3 }])) === JSON.stringify([{ module: "Flotte", vues: 7 }, { module: "Maintenance", vues: 3 }]),
);
attendu(
  "le niveau d'usage sur 30 jours : régulier dès 10 jours, occasionnel, inactif, jamais connecté",
  niveauUsage({ joursActifs: 10, derniereConnexion: "x", saisies: 0 }, 30) === "regulier" &&
    niveauUsage({ joursActifs: 2, derniereConnexion: "x", saisies: 0 }, 30) === "occasionnel" &&
    niveauUsage({ joursActifs: 0, derniereConnexion: "x", saisies: 0 }, 30) === "inactif" &&
    niveauUsage({ joursActifs: 0, derniereConnexion: null, saisies: 0 }, 30) === "jamais",
);

const bac = process.env.PGLITE_DIR ?? "";
if (bac) {
  const require = createRequire(join(bac, "package.json"));
  const { PGlite } = require("@electric-sql/pglite");
  const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
  const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
  const MOI = "00000000-0000-0000-0000-000000000001";
  const AUTRE = "00000000-0000-0000-0000-000000000002";
  const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
  /* auth.uid() lit un réglage : de quoi changer de compte en cours de banc. */
  await pg.exec(`create schema auth; create table auth.users (id uuid primary key, email text, last_sign_in_at timestamptz);
    insert into auth.users values ('${MOI}', 'admin@sedima.sn', now()), ('${AUTRE}', 'parc@sedima.sn', null);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('banc.uid', true), '')::uuid $$;
    select set_config('banc.uid', '${MOI}', false);`);
  for (const role of ["anon", "authenticated", "service_role"]) {
    try {
      await pg.exec(`create role ${role}`);
    } catch {}
  }
  for (const m of readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(join("supabase/migrations", m), "utf8"));
  await pg.exec(readFileSync("supabase/migrations/0078_suivi_activite.sql", "utf8"));
  await pg.exec(`insert into profil (utilisateur_id, nom, role) values ('${MOI}', 'Matar Seck', 'administrateur'), ('${AUTRE}', 'Gestionnaire', 'gestionnaire-parc') on conflict (utilisateur_id) do update set role = excluded.role, actif = true;`);

  await pg.exec(`select noter_visite('/flotte/[…]'); select noter_visite('/flotte/[…]'); select noter_visite('/telephone/atelier', 'telephone');`);
  const visites = (await pg.query(`select chemin, appareil, vues from activite_page where utilisateur_id = '${MOI}' order by chemin`)).rows as { chemin: string; appareil: string; vues: number }[];
  attendu(`une visite se compte pour soi, par écran et appareil (${JSON.stringify(visites)})`, visites.length === 2 && visites[0]!.vues === 2 && visites[1]!.appareil === "telephone");
  await pg.exec(`select set_config('banc.uid', '', false); select noter_visite('/flotte');`);
  const anonymes = ((await pg.query(`select count(*)::int as n from activite_page where chemin = '/flotte'`)).rows[0] as { n: number }).n;
  attendu("sans compte, rien ne se note", anonymes === 0);
  await pg.exec(`select set_config('banc.uid', '${MOI}', false);`);

  /* Une saisie et une modification (deux champs du même geste). */
  await pg.exec(`insert into vehicule (immatriculation, marque, appellation, categorie, cree_par) values ('ZZ078AC', 'TATA', 'Essai', 'camion', '${MOI}');
    insert into modification (table_cible, numero, champ, libelle_champ, avant, apres, motif, cree_par, cree_le) values
      ('vehicule', 'ZZ078AC', 'marque', 'Marque', 'TATA', 'Tata', 'essai', '${MOI}', '2026-10-03 10:00:00+00'),
      ('vehicule', 'ZZ078AC', 'appellation', 'Appellation', 'Essai', 'LPT', 'essai', '${MOI}', '2026-10-03 10:00:00+00');`);
  const lignes = (await pg.query(`select * from activite_utilisateurs(current_date - 29)`)).rows as { utilisateur_id: string; nom: string; jours_actifs: number; vues: number; vues_telephone: number; saisies: number; modifications: number; courriel: string; ecrans: { chemin: string }[]; derniere_connexion: string | null }[];
  const moi = lignes.find((l) => l.utilisateur_id === MOI);
  const autre = lignes.find((l) => l.utilisateur_id === AUTRE);
  attendu(
    `l'activité d'une personne : 1 jour, 3 écrans dont 1 au téléphone, 1 saisie au moins, 1 modification (${moi?.jours_actifs}, ${moi?.vues}, ${moi?.vues_telephone}, ${moi?.saisies}, ${moi?.modifications})`,
    Number(moi?.jours_actifs) === 1 && Number(moi?.vues) === 3 && Number(moi?.vues_telephone) === 1 && Number(moi?.saisies) >= 1 && Number(moi?.modifications) === 1 && moi?.courriel === "admin@sedima.sn" && moi.ecrans.length === 2,
  );
  attendu("un compte jamais connecté est listé, à zéro", Number(autre?.vues) === 0 && autre?.derniere_connexion === null);

  await pg.exec(`select set_config('banc.uid', '${AUTRE}', false);`);
  let refus = "";
  try {
    await pg.query(`select * from activite_utilisateurs(current_date - 29)`);
  } catch (e) {
    refus = e instanceof Error ? e.message : String(e);
  }
  attendu(`la lecture est réservée à l'administrateur et à la direction (${refus})`, refus.includes("réservé"));
  const lecture = await pg.query(`select count(*)::int as n from activite_page`);
  attendu("0078 rejouable", (lecture.rows[0] as { n: number }).n >= 2);
}

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
if (echecs) process.exit(1);

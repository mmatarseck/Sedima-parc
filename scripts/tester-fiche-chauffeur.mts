/* Vérifie lire_fiche_chauffeur() (0015) dans PGlite avec le seed, puis
 * l'assembleur du domaine : la fiche de Moustapha Diaw, titulaire de AA 032 EA.
 * Lancer : PGLITE_DIR=<dossier avec @electric-sql/pglite> npx tsx scripts/tester-fiche-chauffeur.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { assemblerFicheChauffeur } from "../src/domaine/assembler-fiche-chauffeur";
import { listeChauffeurs } from "../src/donnees/chauffeurs-demo";
import { classer, kmMoyen } from "../src/domaine/performance";
import { faitsChauffeurDepuisJson } from "../src/donnees/fiche-chauffeur";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");

const projet = process.cwd();
const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
for (const m of readdirSync(join(projet, "supabase/migrations")).sort()) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
for (const p of readdirSync(join(projet, "supabase/seed-parties")).filter((f) => f.endsWith(".sql")).sort()) {
  const texte = readFileSync(join(projet, "supabase/seed-parties", p), "utf8");
  let courant: string[] = [];
  for (const ligne of texte.split("\n")) {
    courant.push(ligne);
    if (/^on conflict .*;$/.test(ligne.trim())) { try { await pg.exec(courant.join("\n")); } catch {} courant = []; }
  }
}

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => { console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`); if (!ok) echecs++; };

attendu(`slug : ${(await pg.query(`select slug_chauffeur('Moustapha', 'Diaw') as s`)).rows[0].s}`, (await pg.query(`select slug_chauffeur('Talla', 'Diène') as s`)).rows[0].s === "talla-diene");
const t0 = performance.now();
const j = (await pg.query(`select lire_fiche_chauffeur($1, null) as j`, ["moustapha-diaw"])).rows[0].j;
console.log(`lire_fiche_chauffeur en ${Math.round(performance.now() - t0)} ms`);
attendu(`trouvé par le nom aplati (${j?.chauffeur?.prenom} ${j?.chauffeur?.nom})`, j?.chauffeur?.nom === "Diaw");
for (const cle of ["documents", "affectations", "pleins", "releves"] as const) attendu(`${cle} : ${j[cle].length}`, j[cle].length > 0);
console.log(`indisponibilités ${j.indisponibilites.length}, sanctions ${j.sanctions.length}, incidents ${j.incidents.length}, dépenses attribuées ${j.depenses.length}`);
attendu(`inconnu → null`, (await pg.query(`select lire_fiche_chauffeur('personne', null) as j`)).rows[0].j === null);

/* La règle d'attribution : le suppléant ne reçoit que les jours d'indisponibilité du titulaire. */
const v = (await pg.query(`select id from vehicule where immatriculation = 'AA032EA'`)).rows[0] as { id: string };
const titulaire = (await pg.query(`select conducteur_du_jour($1, '2026-08-15'::date) as c`, [v.id])).rows[0].c;
const attenduTitulaire = (await pg.query(`select chauffeur_id from affectation where vehicule_id = $1 and role = 'titulaire' and debut <= '2026-08-15' and (fin is null or fin >= '2026-08-15')`, [v.id])).rows[0]?.chauffeur_id;
attendu(`conducteur du 15 août : le titulaire`, titulaire === attenduTitulaire);

const ligne = listeChauffeurs().find((l) => l.id === "moustapha-diaw")!;
const fiche = assemblerFicheChauffeur(ligne, faitsChauffeurDepuisJson(j, "moustapha-diaw"), "2026-09-02");
attendu(`${fiche.documents.length} documents (${fiche.documents.map((d) => `${d.type} ${d.etat}`).join(", ")})`, fiche.documents.some((d) => d.type === "permis") && fiche.documents.some((d) => d.type === "visite-medicale"));
attendu(`${fiche.affectations.length} affectations, ${fiche.affectations[0]?.immatriculationAffichee} ${fiche.affectations[0]?.kmParcourus} km`, fiche.affectations.length > 0 && (fiche.affectations[0]?.kmParcourus ?? 0) > 0);
attendu(`${fiche.consommation.length} mois de consommation, ${fiche.consommation[0]?.litresAux100} L/100 en ${fiche.consommation[0]?.mois}`, fiche.consommation.length > 0);
attendu(`${fiche.contraventions.length} contraventions, ${fiche.fraisDeRoute.length} frais de route, ${fiche.releves.length} relevés attribués`, fiche.releves.length > 0);
attendu(`journal ${fiche.journal.length} lignes, âge ${fiche.identite.age}, ancienneté ${fiche.identite.ancienneteAnnees} ans`, fiche.journal.length > 0 && fiche.identite.age !== null);

/* Toutes les fiches en une requête (0020), pour le classement et la cohorte. */
const t1 = performance.now();
const toutes = (await pg.query(`select lire_fiches_chauffeurs() as j`)).rows[0].j as { id: string; identifiant: string; fiche: any }[];
console.log(`lire_fiches_chauffeurs en ${Math.round(performance.now() - t1)} ms, ${toutes.length} chauffeurs`);
const lignes = listeChauffeurs();
const fiches = toutes.flatMap((f) => { const l = lignes.find((x) => x.id === f.identifiant); return l && f.fiche ? [assemblerFicheChauffeur(l, faitsChauffeurDepuisJson(f.fiche, l.id), "2026-09-02")] : []; });
attendu(`${fiches.length} fiches assemblées sur ${toutes.length} (identifiants retrouvés dans la liste)`, fiches.length === toutes.length && fiches.length > 15);
const classement = classer(fiches, "2026-08");
const classes = classement.filter((l) => l.rang !== null);
attendu(`classement d'août : ${classes.length} classés sur ${classement.length}, premier ${classes[0]?.evaluation.chauffeurId} (score ${classes[0]?.evaluation.score})`, classes.length > 5 && classes[0]?.rang === 1);
attendu(`les rangs sont 1..n sans trou`, classes.every((l, i) => l.rang === i + 1));
const moyenne = kmMoyen(fiches, "2025-09-01", "2026-09-02");
attendu(`kilomètres moyens de la cohorte sur douze mois : ${Math.round(moyenne ?? 0)} km`, (moyenne ?? 0) > 10000);
console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);

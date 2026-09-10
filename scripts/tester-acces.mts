/* Ce qu'un compte réduit obtient vraiment — les politiques jouées de son côté.
 *
 * L'audit du 10 septembre 2026 a montré que `tester-rls.mjs` n'éprouvait les
 * politiques qu'avec un compte **administrateur**, et seulement pour en
 * chronométrer les lectures. Personne ne vérifiait ce qu'un *détenteur* — un
 * chauffeur, réduit à son véhicule — pouvait atteindre. Quatre trous y
 * vivaient, fermés par la migration 0030.
 *
 * Ce banc joue le rôle du détenteur, tente les abus un par un, et **exige un
 * refus**. Le rappel qui compte : l'application n'est pas le seul chemin vers
 * la base — PostgREST expose chaque table et chaque fonction, donc un abus se
 * décrit ici en SQL nu, comme un attaquant l'écrirait.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-acces.mts */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();

const ADMIN = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const DETENTEUR = "dddddddd-dddd-4ddd-dddd-dddddddddddd";
const AGENT = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });

/* `auth.uid()` lit un réglage de session : on change de compte en cours de banc. */
await pg.exec(`create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('essai.uid', true), '')::uuid $$;`);
for (const r of ["anon", "authenticated", "service_role"]) {
  try {
    await pg.exec(`create role ${r}`);
  } catch {}
}
/* Filtre sur l'extension : sans lui, un fichier mis de côté en « .sql.off »
   serait joué quand même — et une preuve « le banc échoue sans la 0030 »
   n'en serait pas une. */
for (const m of readdirSync(join(projet, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
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

/* Un chauffeur du jeu, son véhicule, et les comptes qui vont avec. */
const chauffeur = (await pg.query(`select id, prenom, nom from chauffeur order by nom limit 1`)).rows[0] as { id: string; prenom: string; nom: string };
const vehicule = (await pg.query(`select id, immatriculation from vehicule order by immatriculation limit 1`)).rows[0] as { id: string; immatriculation: string };

await pg.exec(`insert into auth.users (id) values ('${ADMIN}'), ('${DETENTEUR}'), ('${AGENT}');
  insert into profil (utilisateur_id, nom, role, actif) values
    ('${ADMIN}', 'Admin Essai', 'administrateur', true),
    ('${DETENTEUR}', '${chauffeur.prenom} ${chauffeur.nom}', 'correspondant-site', true),
    ('${AGENT}', 'Agent Essai', 'correspondant-site', true);
  insert into acces_utilisateur (utilisateur_id, prenom, nom, courriel, actif, profil, chauffeur_id) values
    ('${DETENTEUR}', '${chauffeur.prenom}', '${chauffeur.nom}', 'detenteur@essai.sn', true, 'detenteur', '${chauffeur.id}');
  insert into acces_utilisateur (utilisateur_id, prenom, nom, courriel, actif, profil) values
    ('${AGENT}', 'Agent', 'Essai', 'agent@essai.sn', true, 'agent-terrain'),
    ('${ADMIN}', 'Admin', 'Essai', 'admin@essai.sn', true, 'administrateur');
  grant usage on schema public, auth to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant execute on all functions in schema public to authenticated;
  grant execute on function auth.uid() to authenticated;`);

/* Supabase accorde `execute` sur toute fonction nouvelle à `anon` et
   `authenticated` : le blanc-seing ci-dessus le reproduit. La 0030 est donc
   rejouée après, comme en production, pour que ses retraits soient les
   derniers mots — sans quoi le banc éprouverait le blanc-seing, pas la
   migration. */
const fermeture = join(projet, "supabase/migrations/0030_fermeture_des_acces.sql");
if (existsSync(fermeture)) await pg.exec(readFileSync(fermeture, "utf8"));
else console.log("⚠ 0030 absente : le banc éprouve l'état d'avant la fermeture.");

/* Une dépense sans véhicule, comme un salaire : c'est elle que la 0030 protège. */
await pg.exec(`insert into depense (numero, vehicule_id, date, poste, libelle, montant, beneficiaire)
  values ('DEP-ESSAI-SALAIRE', null, current_date, 'salaire', 'Salaire de septembre', 850000, 'Directeur des opérations')
  on conflict (numero) do nothing;`);

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

/**
 * Joue une requête sous un compte donné. `set` et non `set local` : chaque
 * requête PGlite est sa propre transaction, un réglage local ne lui
 * survivrait pas — et le banc croirait à un refus là où il n'y a qu'un
 * compte vide. Le premier jet est tombé dans ce piège.
 */
async function sous(uid: string, sql: string): Promise<{ lignes: unknown[] } | { refus: string }> {
  await pg.exec(`set essai.uid = '${uid}'; set role authenticated;`);
  try {
    const r = await pg.query(sql);
    return { lignes: r.rows as unknown[] };
  } catch (e) {
    return { refus: e instanceof Error ? e.message : String(e) };
  } finally {
    await pg.exec(`reset role`);
  }
}

console.log(`\nJeu : chauffeur ${chauffeur.prenom} ${chauffeur.nom}, véhicule ${vehicule.immatriculation}.\n`);

/* -- 1. Les dépenses sans véhicule ------------------------------------------- */

const salaireDetenteur = await sous(DETENTEUR, `select numero, montant, beneficiaire from depense where vehicule_id is null`);
attendu(
  "un détenteur ne lit aucune dépense sans véhicule (salaires, frais nominatifs)",
  "lignes" in salaireDetenteur && salaireDetenteur.lignes.length === 0,
);

const salaireAdmin = await sous(ADMIN, `select numero from depense where vehicule_id is null`);
attendu("l'administrateur, lui, les lit toujours", "lignes" in salaireAdmin && salaireAdmin.lignes.length > 0);

/* -- 2. Les discussions internes ---------------------------------------------- */

/* Posé par le propriétaire des tables : la publication passe normalement par
   `publier_message()`, ce n'est pas elle qu'on éprouve ici mais la lecture. */
await pg.exec(`insert into message (sujet, auteur_id, auteur_nom, texte)
  values ('chauffeur:${chauffeur.id}', '${ADMIN}', 'Admin Essai', 'Retard répété, à recadrer.');`);

const filsDetenteur = await sous(DETENTEUR, `select count(*)::int as n from message`);
attendu(
  "un détenteur ne lit aucune discussion du service parc, pas même celle qui le nomme",
  "lignes" in filsDetenteur && (filsDetenteur.lignes[0] as { n: number }).n === 0,
);

const filsAgent = await sous(AGENT, `select count(*)::int as n from message`);
attendu("un agent de terrain les lit", "lignes" in filsAgent && (filsAgent.lignes[0] as { n: number }).n > 0);

/* -- 3. La fiche de transfert : une partie ne signe pas pour l'autre --------- */

await pg.exec(`insert into transfert (numero, vehicule_id, remettant_genre, remettant_nom, recipiendaire_genre, recipiendaire_chauffeur_id, recipiendaire_nom, date, motif)
  values ('TRF-ESSAI', '${vehicule.id}', 'parc', 'Service parc', 'chauffeur', '${chauffeur.id}', '${chauffeur.prenom} ${chauffeur.nom}', now(), 'Essai de garde')
  on conflict (numero) do nothing;`);

const signeLesDeux = await sous(
  DETENTEUR,
  `update transfert set signature_remettant = '{"nom":"Service parc","le":"2026-09-10","trace":"x"}'::jsonb,
                        signature_recipiendaire = '{"nom":"moi","le":"2026-09-10","trace":"x"}'::jsonb
    where numero = 'TRF-ESSAI' returning numero`,
);
attendu("un détenteur ne peut pas signer à la place du remettant", "refus" in signeLesDeux);

const signeLasienne = await sous(
  DETENTEUR,
  `update transfert set signature_recipiendaire = '{"nom":"moi","le":"2026-09-10","trace":"x"}'::jsonb
    where numero = 'TRF-ESSAI' returning numero`,
);
attendu("il signe bien la sienne", "lignes" in signeLasienne && signeLasienne.lignes.length === 1);

/* -- 4. Appliquer une fiche dont on n'est pas partie -------------------------- */

/* La signature du remettant manque, puisque le détenteur n'a pas pu la forger :
   la fiche ne peut pas s'appliquer, même par un agent qui en a le droit. */
const appliqueIncomplete = await sous(AGENT, `select appliquer_transfert((select id from transfert where numero = 'TRF-ESSAI'))`);
attendu("une fiche à qui il manque une signature ne s'applique pas", "refus" in appliqueIncomplete && /signature/i.test(appliqueIncomplete.refus));

/* Et un détenteur étranger à la remise ne l'applique pas davantage, quand bien
   même son profil porte la saisie sur les transferts — c'est elle qui lui sert
   à signer la sienne. */
await pg.exec(`update transfert set signature_remettant = '{"nom":"Service parc","le":"2026-09-10","trace":"x"}'::jsonb where numero = 'TRF-ESSAI';
  insert into auth.users (id) values ('eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee');
  insert into profil (utilisateur_id, nom, role, actif) values ('eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee', 'Autre Détenteur', 'correspondant-site', true);
  insert into acces_utilisateur (utilisateur_id, prenom, nom, courriel, actif, profil, chauffeur_id)
    select 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee', c.prenom, c.nom, 'autre@essai.sn', true, 'detenteur', c.id
      from chauffeur c where c.id <> '${chauffeur.id}' order by c.nom limit 1;`);
const appliqueEtranger = await sous("eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee", `select appliquer_transfert((select id from transfert where numero = 'TRF-ESSAI'))`);
attendu("un détenteur étranger à la remise ne l'applique pas", "refus" in appliqueEtranger && /partie/i.test(appliqueEtranger.refus));

/* -- 5. Le courriel signé de l'entreprise ------------------------------------- */

/* -- 6. L'annuaire des citations ---------------------------------------------
 *
 * `acces_utilisateur` ne se lit que pour soi-même, sauf administrateur : le
 * sélecteur de mentions était vide pour tout le monde, sans erreur. La 0032
 * ouvre un annuaire minimal — nom et fonction — à qui a un rôle, détenteur
 * excepté.
 * ------------------------------------------------------------------------- */

const annuaireAgent = await sous(AGENT, `select count(*)::int as n from annuaire()`);
attendu(
  "un agent de terrain lit l'annuaire des citations",
  "lignes" in annuaireAgent && (annuaireAgent.lignes[0] as { n: number }).n > 1,
);

const annuaireDetenteur = await sous(DETENTEUR, `select count(*)::int as n from annuaire()`);
attendu(
  "un détenteur n'y lit personne — il n'a pas à connaître l'organigramme",
  "lignes" in annuaireDetenteur && (annuaireDetenteur.lignes[0] as { n: number }).n === 0,
);

const annuaireSansCourriel = await sous(AGENT, `select * from annuaire() limit 1`);
attendu(
  "l'annuaire ne rend que l'identifiant, le prénom, le nom et la fonction",
  "lignes" in annuaireSansCourriel && Object.keys((annuaireSansCourriel.lignes[0] ?? {}) as object).sort().join(",") === "fonction,nom,prenom,utilisateur_id",
);

/* -- 7. « Saisie » ajoute, elle ne retouche pas ------------------------------
 *
 * Sept politiques étaient écrites `for all` et donnaient au niveau saisie le
 * droit d'effacer. On l'éprouve sur la caisse, la plus sensible : l'agent de
 * terrain reçoit `couts: saisie` le temps du contrôle.
 * ------------------------------------------------------------------------- */

await pg.exec(`update acces_utilisateur set modules = '{"couts":"saisie"}'::jsonb, ecarts_approuves_par = '${ADMIN}', ecarts_approuves_le = now() where utilisateur_id = '${AGENT}';
  insert into mouvement_caisse (numero, date, sens, libelle, montant)
  values ('MVT-ESSAI', current_date, 'sortie', 'Essai de garde', 5000) on conflict (numero) do nothing;`);

const ajout = await sous(AGENT, `insert into mouvement_caisse (numero, date, sens, libelle, montant) values ('MVT-ESSAI-2', current_date, 'sortie', 'Ajouté par la saisie', 2500) returning numero`);
attendu("le niveau saisie ajoute bien un mouvement de caisse", "lignes" in ajout && ajout.lignes.length === 1);

const effacement = await sous(AGENT, `delete from mouvement_caisse where numero = 'MVT-ESSAI' returning numero`);
attendu("mais il n'en efface aucun — retoucher le passé demande la gestion", "lignes" in effacement && effacement.lignes.length === 0);

/* -- 8. Voir les sanctions n'est pas les écrire ------------------------------- */

await pg.exec(`update acces_utilisateur set sanctions = true, modules = '{"couts":"saisie","chauffeurs":"lecture"}'::jsonb where utilisateur_id = '${AGENT}';`);
const sanctionEcrite = await sous(
  AGENT,
  `insert into sanction (numero, chauffeur_id, date, type, motif) values ('SAN-ESSAI', '${chauffeur.id}', current_date, 'avertissement', 'Essai de garde') returning numero`,
);
attendu(
  "cocher « voit les sanctions » n'ouvre pas l'écriture des sanctions",
  "refus" in sanctionEcrite || ("lignes" in sanctionEcrite && sanctionEcrite.lignes.length === 0),
);

const forgeCourriel = await sous(
  DETENTEUR,
  `select notifier_detenteurs('essai-forge', '${chauffeur.id}', null, 'Direction des Opérations', 'Mise à jour de vos accès', 'Cliquez ici', 'https://ailleurs.example')`,
);
attendu("un détenteur ne déclenche pas un courriel signé de l'entreprise", "refus" in forgeCourriel);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);
